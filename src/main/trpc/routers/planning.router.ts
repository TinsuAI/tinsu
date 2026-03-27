import { z } from 'zod'
import { join } from 'path'
import { readFileSync, statSync, readdirSync } from 'fs'
import type { Stats } from 'fs'
import crypto from 'crypto'
import { eq, desc, and, or } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { planning_artifact_statuses, PLANNING_ARTIFACT_STATUS, workflow_runs, WORKFLOW_RUN_STATUS, gate_decisions } from '../../db/schema'
import { BMAD_WORKFLOWS } from './planning-workflow-constants'
import { parseReadinessReport } from '../../services/readiness-gate.service'
import { GitService } from '../../services/git.service'
import type { ArtifactVersionEntry } from '../../services/git.service'

/**
 * Get the base directory for a workflow's artifacts.
 * Defaults to `_bmad-output/planning-artifacts/` unless overridden via `baseDir`.
 */
function getWorkflowBaseDir(bmadOutputDir: string, workflow: (typeof BMAD_WORKFLOWS)[number]): string {
  const sub = workflow.baseDir ?? 'planning-artifacts'
  return sub ? join(bmadOutputDir, sub) : bmadOutputDir
}

/**
 * Resolve a workflow entry to an actual file path relative to its base dir.
 * For entries with `filename`, returns it directly.
 * For entries with `glob`, scans the subdirectory and returns the most recent match.
 */
function resolveArtifactFilename(baseDir: string, workflow: (typeof BMAD_WORKFLOWS)[number]): string | null {
  if (workflow.filename) return workflow.filename

  if (workflow.glob) {
    // Pattern like "brainstorming/brainstorming-session-*.md"
    const lastSlash = workflow.glob.lastIndexOf('/')
    const subdir = lastSlash >= 0 ? workflow.glob.slice(0, lastSlash) : ''
    const pattern = lastSlash >= 0 ? workflow.glob.slice(lastSlash + 1) : workflow.glob
    // Convert glob * to regex
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')

    try {
      const dir = subdir ? join(baseDir, subdir) : baseDir
      const files = readdirSync(dir)
        .filter((f) => regex.test(f))
        .sort()
        .reverse() // most recent first (date-stamped names sort naturally)
      if (files.length > 0) {
        return subdir ? join(subdir, files[0]) : files[0]
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  return null
}

/**
 * tRPC router for BMAD planning workspace artifact scanning and status tracking.
 * Story 9.2: Phase Progress Dashboard
 */
export const planningRouter = router({
  /**
   * Scan the planning-artifacts directory for known artifact files.
   * Returns status info for each workflow's expected output file.
   */
  scanArtifacts: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bmadOutputDir = join(ctx.projectRoot, '_bmad-output')

      // Load persisted statuses for this project
      const persistedStatuses = await ctx.db
        .select()
        .from(planning_artifact_statuses)
        .where(eq(planning_artifact_statuses.project_id, input.projectId))

      const statusMap = new Map(persistedStatuses.map((s) => [s.artifact_key, s.status]))

      return BMAD_WORKFLOWS.map((workflow) => {
        const baseDir = getWorkflowBaseDir(bmadOutputDir, workflow)
        const resolved = resolveArtifactFilename(baseDir, workflow)
        const filename = resolved ?? workflow.filename ?? workflow.glob ?? ''

        let fileStat: Stats | null = null
        if (resolved) {
          try {
            fileStat = statSync(join(baseDir, resolved))
          } catch {
            // File does not exist
          }
        }
        const exists = fileStat !== null

        let lastModified: number | null = null
        let sizeBytes: number | null = null

        if (fileStat) {
          lastModified = fileStat.mtimeMs
          sizeBytes = fileStat.size
        }

        // Determine status: missing if file doesn't exist, else check persisted status
        const persistedStatus = statusMap.get(workflow.workflowKey)
        const status: 'draft' | 'in-review' | 'approved' | 'missing' = !exists
          ? 'missing'
          : persistedStatus === 'approved'
            ? 'approved'
            : persistedStatus === 'in-review'
              ? 'in-review'
              : 'draft'

        return {
          workflowKey: workflow.workflowKey,
          filename,
          exists,
          lastModified,
          sizeBytes,
          status
        }
      })
    }),

  /**
   * Get the full content of a planning artifact file.
   * Story 9.3: Artifact Viewer with Status Lifecycle
   */
  getArtifactContent: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        workflowKey: z.string()
      })
    )
    .query(({ ctx, input }) => {
      const workflow = BMAD_WORKFLOWS.find((a) => a.workflowKey === input.workflowKey)
      if (!workflow) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown workflow: ${input.workflowKey}`
        })
      }

      const bmadOutputDir = join(ctx.projectRoot, '_bmad-output')
      const baseDir = getWorkflowBaseDir(bmadOutputDir, workflow)
      const resolved = resolveArtifactFilename(baseDir, workflow)
      if (!resolved) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found for workflow: ${input.workflowKey}`
        })
      }
      const filePath = join(baseDir, resolved)
      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found: ${resolved}`
        })
      }

      let stat: { mtimeMs: number; size: number }
      try {
        stat = statSync(filePath)
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found: ${resolved}`
        })
      }
      // Build relative path from project root for display
      const sub = workflow.baseDir ?? 'planning-artifacts'
      const relBase = sub ? `_bmad-output/${sub}` : '_bmad-output'
      return {
        content,
        filePath: `${relBase}/${resolved}`,
        lastModified: stat.mtimeMs,
        sizeBytes: stat.size,
        wordCount: content.split(/\s+/).filter(Boolean).length,
        workflowKey: input.workflowKey
      }
    }),

  /**
   * Update the approval status of a planning artifact.
   * Upserts the status row for the given project + artifact key.
   */
  updateArtifactStatus: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        artifactKey: z.string(),
        status: z.enum(PLANNING_ARTIFACT_STATUS)
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate the artifact key is known
      const knownKeys = BMAD_WORKFLOWS.map((a) => a.workflowKey)
      if (!knownKeys.includes(input.artifactKey)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown artifact key: ${input.artifactKey}`
        })
      }

      // Atomic upsert via ON CONFLICT DO UPDATE — eliminates race condition on double-click
      await ctx.db
        .insert(planning_artifact_statuses)
        .values({
          id: crypto.randomUUID(),
          project_id: input.projectId,
          artifact_key: input.artifactKey,
          status: input.status,
          updated_at: new Date()
        })
        .onConflictDoUpdate({
          target: [planning_artifact_statuses.project_id, planning_artifact_statuses.artifact_key],
          set: {
            status: input.status,
            updated_at: new Date()
          }
        })

      return { artifactKey: input.artifactKey, status: input.status }
    }),

  /**
   * Create a workflow run record.
   * Story 9.5: Guided Workflow Run Tracker (AC: 3)
   */
  createWorkflowRun: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        workflowKey: z.string(),
        phase: z.enum(['analysis', 'planning', 'solutioning']),
        agentName: z.string().optional(),
        taskId: z.string().optional(),
        inputArtifacts: z.array(z.string()).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const knownKeys = BMAD_WORKFLOWS.map((w) => w.workflowKey)
      if (!knownKeys.includes(input.workflowKey)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown workflow key: ${input.workflowKey}`
        })
      }

      const id = crypto.randomUUID()
      const now = new Date()

      await ctx.db.insert(workflow_runs).values({
        id,
        project_id: input.projectId,
        workflow_key: input.workflowKey,
        phase: input.phase,
        status: 'running',
        started_at: now,
        input_artifacts: input.inputArtifacts ? JSON.stringify(input.inputArtifacts) : null,
        agent_name: input.agentName ?? null,
        task_id: input.taskId ?? null
      })

      const created = ctx.db.select().from(workflow_runs).where(eq(workflow_runs.id, id)).get()
      if (!created) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create workflow run' })
      }
      return created
    }),

  /**
   * Update a workflow run's status and optionally set output artifacts.
   * Story 9.5: Guided Workflow Run Tracker (AC: 3)
   */
  updateWorkflowRun: publicProcedure
    .input(
      z.object({
        runId: z.string(),
        status: z.enum(WORKFLOW_RUN_STATUS),
        outputArtifacts: z.array(z.string()).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const terminalStatuses: string[] = ['succeeded', 'failed', 'cancelled']
      const isTerminal = terminalStatuses.includes(input.status)

      // Guard: prevent re-opening a terminal run
      const existing = ctx.db.select().from(workflow_runs).where(eq(workflow_runs.id, input.runId)).get()
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Workflow run not found: ${input.runId}` })
      }
      if (terminalStatuses.includes(existing.status) && !isTerminal) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition terminal run from '${existing.status}' to '${input.status}'`
        })
      }

      await ctx.db
        .update(workflow_runs)
        .set({
          status: input.status,
          finished_at: isTerminal ? new Date() : undefined,
          output_artifacts: input.outputArtifacts ? JSON.stringify(input.outputArtifacts) : undefined
        })
        .where(eq(workflow_runs.id, input.runId))

      const updated = ctx.db.select().from(workflow_runs).where(eq(workflow_runs.id, input.runId)).get()
      if (!updated) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update workflow run' })
      }
      return updated
    }),

  /**
   * List workflow runs for a project, ordered by most recent.
   * Story 9.5: Guided Workflow Run Tracker (AC: 4)
   */
  listWorkflowRuns: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().int().positive().max(200).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 20

      const runs = await ctx.db
        .select()
        .from(workflow_runs)
        .where(eq(workflow_runs.project_id, input.projectId))
        .orderBy(desc(workflow_runs.started_at))
        .limit(limit)

      return runs.map((run) => ({
        ...run,
        input_artifacts: (() => { try { return run.input_artifacts ? JSON.parse(run.input_artifacts) as string[] : [] } catch { return [] } })(),
        output_artifacts: (() => { try { return run.output_artifacts ? JSON.parse(run.output_artifacts) as string[] : [] } catch { return [] } })()
      }))
    }),

  /**
   * Get the currently active workflow run for a project (running or needs-input).
   * Story 9.5: Guided Workflow Run Tracker (AC: 1)
   */
  getActiveWorkflowRun: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db
        .select()
        .from(workflow_runs)
        .where(
          and(
            eq(workflow_runs.project_id, input.projectId),
            or(
              eq(workflow_runs.status, 'running'),
              eq(workflow_runs.status, 'needs-input')
            )
          )
        )
        .orderBy(desc(workflow_runs.started_at))
        .limit(1)
        .get()

      if (!run) return null

      return {
        ...run,
        input_artifacts: (() => { try { return run.input_artifacts ? JSON.parse(run.input_artifacts) as string[] : [] } catch { return [] } })(),
        output_artifacts: (() => { try { return run.output_artifacts ? JSON.parse(run.output_artifacts) as string[] : [] } catch { return [] } })()
      }
    }),

  /**
   * Parse the readiness report and save the gate decision to DB.
   * Story 9.6: Readiness Gate Results Panel (AC: 1, 2, 4)
   */
  parseAndSaveGateResult: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        workflowRunId: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const artifactsDir = join(ctx.projectRoot, '_bmad-output', 'planning-artifacts')

      // Try readiness-check.md first, then glob for implementation-readiness-report-*.md
      let reportContent: string | null = null

      try {
        reportContent = readFileSync(join(artifactsDir, 'readiness-check.md'), 'utf-8')
      } catch {
        // Not found, try glob pattern
      }

      if (!reportContent) {
        try {
          const files = readdirSync(artifactsDir)
          const matches = files
            .filter((f) => f.startsWith('implementation-readiness-report-') && f.endsWith('.md'))
            .sort()
            .reverse()

          if (matches.length > 0) {
            reportContent = readFileSync(join(artifactsDir, matches[0]), 'utf-8')
          }
        } catch {
          // Directory not found or read error
        }
      }

      if (!reportContent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No readiness report found in planning-artifacts directory'
        })
      }

      const parsed = parseReadinessReport(reportContent)
      const id = crypto.randomUUID()

      await ctx.db.insert(gate_decisions).values({
        id,
        project_id: input.projectId,
        decision: parsed.decision,
        rationale: parsed.rationale,
        issues: parsed.issues.length > 0 ? JSON.stringify(parsed.issues) : null,
        created_at: new Date(),
        workflow_run_id: input.workflowRunId ?? null
      })

      const saved = ctx.db.select().from(gate_decisions).where(eq(gate_decisions.id, id)).get()
      if (!saved) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save gate decision' })
      }

      return {
        ...saved,
        issues: parsed.issues
      }
    }),

  /**
   * Get the most recent gate decision for a project.
   * Story 9.6: Readiness Gate Results Panel (AC: 1, 4)
   */
  getLatestGateDecision: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = ctx.db
        .select()
        .from(gate_decisions)
        .where(eq(gate_decisions.project_id, input.projectId))
        .orderBy(desc(gate_decisions.created_at))
        .limit(1)
        .get()

      if (!result) return null
      return {
        ...result,
        issues: (() => { try { return result.issues ? JSON.parse(result.issues) : [] } catch { return [] } })()
      }
    }),

  /**
   * List gate decisions for a project, ordered by most recent.
   * Story 9.6: Readiness Gate Results Panel (AC: 3, 4)
   */
  listGateDecisions: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().int().positive().max(200).optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 10

      const results = await ctx.db
        .select()
        .from(gate_decisions)
        .where(eq(gate_decisions.project_id, input.projectId))
        .orderBy(desc(gate_decisions.created_at))
        .limit(limit)

      return results.map((r) => ({
        ...r,
        issues: (() => { try { return r.issues ? JSON.parse(r.issues) : [] } catch { return [] } })()
      }))
    }),

  /**
   * Approve all planning artifacts for implementation.
   * Only succeeds if the latest gate decision is 'pass'.
   * Story 9.6: Readiness Gate Results Panel (AC: 5)
   */
  approveForImplementation: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check latest gate decision
      const latestDecision = ctx.db
        .select()
        .from(gate_decisions)
        .where(eq(gate_decisions.project_id, input.projectId))
        .orderBy(desc(gate_decisions.created_at))
        .limit(1)
        .get()

      if (!latestDecision || latestDecision.decision !== 'pass') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot approve: latest gate decision must be "pass"'
        })
      }

      // Upsert all known artifact statuses to 'approved'
      const artifactKeys = BMAD_WORKFLOWS.map((w) => w.workflowKey)
      let artifactCount = 0

      for (const artifactKey of artifactKeys) {
        await ctx.db
          .insert(planning_artifact_statuses)
          .values({
            id: crypto.randomUUID(),
            project_id: input.projectId,
            artifact_key: artifactKey,
            status: 'approved',
            updated_at: new Date()
          })
          .onConflictDoUpdate({
            target: [planning_artifact_statuses.project_id, planning_artifact_statuses.artifact_key],
            set: {
              status: 'approved',
              updated_at: new Date()
            }
          })
        artifactCount++
      }

      return { approved: true, artifactCount }
    }),

  /**
   * Get version history (git commits) for a specific planning artifact file.
   * Story 9.7: Artifact Version Diff View (AC: 4, 5)
   */
  getArtifactVersionHistory: publicProcedure
    .input(z.object({ projectId: z.string(), workflowKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = BMAD_WORKFLOWS.find((a) => a.workflowKey === input.workflowKey)
      if (!workflow) return [] as ArtifactVersionEntry[]

      const bmadOutputDir = join(ctx.projectRoot, '_bmad-output')
      const baseDir = getWorkflowBaseDir(bmadOutputDir, workflow)
      const resolved = resolveArtifactFilename(baseDir, workflow)
      if (!resolved) return [] as ArtifactVersionEntry[]

      // P8: Use forward slashes — git requires '/' regardless of OS
      const sub = workflow.baseDir ?? 'planning-artifacts'
      const relBase = sub ? `_bmad-output/${sub}` : '_bmad-output'
      const relPath = `${relBase}/${resolved}`.replace(/\\/g, '/')
      return GitService.getFileVersionHistory(ctx.projectRoot, relPath)
    }),

  /**
   * Get the content of an artifact at two commits for diff comparison.
   * Story 9.7: Artifact Version Diff View (AC: 2, 3, 5)
   */
  getArtifactVersionDiff: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        workflowKey: z.string(),
        fromCommitSha: z.string(), // empty string or 'initial' means "before first commit"
        toCommitSha: z.string().min(1, 'toCommitSha must not be empty') // P10: prevent empty toCommitSha → 500
      })
    )
    .query(async ({ ctx, input }) => {
      const workflow = BMAD_WORKFLOWS.find((a) => a.workflowKey === input.workflowKey)
      if (!workflow) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown workflow: ${input.workflowKey}`
        })
      }

      const bmadOutputDir = join(ctx.projectRoot, '_bmad-output')
      const baseDir = getWorkflowBaseDir(bmadOutputDir, workflow)
      const resolved = resolveArtifactFilename(baseDir, workflow)
      if (!resolved) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found for workflow: ${input.workflowKey}`
        })
      }

      // P8: Use forward slashes — git requires '/' regardless of OS
      const sub = workflow.baseDir ?? 'planning-artifacts'
      const relBase = sub ? `_bmad-output/${sub}` : '_bmad-output'
      const relPath = `${relBase}/${resolved}`.replace(/\\/g, '/')

      // Get "from" content — empty string if initial creation
      let original = ''
      if (input.fromCommitSha && input.fromCommitSha !== 'initial') {
        original = await GitService.getFileContentAtCommit(ctx.projectRoot, relPath, input.fromCommitSha)
      }

      // Get "to" content
      const modified = await GitService.getFileContentAtCommit(ctx.projectRoot, relPath, input.toCommitSha)

      return {
        original,
        modified,
        language: 'markdown' as const
      }
    }),

  /**
   * Read any file within the project by relative path.
   * Used by SessionDocumentsBar to display arbitrary session documents.
   */
  getFileByPath: publicProcedure
    .input(z.object({ relativePath: z.string().min(1) }))
    .query(({ ctx, input }) => {
      // Security: prevent path traversal
      if (input.relativePath.includes('..')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Path traversal not allowed' })
      }
      // Handle both absolute paths (from hook payloads) and relative paths
      const isAbsolute = input.relativePath.startsWith('/')
      const filePath = isAbsolute ? input.relativePath : join(ctx.projectRoot, input.relativePath)
      try {
        const content = readFileSync(filePath, 'utf-8')
        const stat = statSync(filePath)
        return {
          content,
          filePath: input.relativePath,
          lastModified: stat.mtimeMs,
          sizeBytes: stat.size,
          wordCount: content.split(/\s+/).filter(Boolean).length
        }
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND', message: `File not found: ${input.relativePath}` })
      }
    })
})
