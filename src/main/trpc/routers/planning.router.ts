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

/**
 * Known artifact files to detect, mapped from workflow key to expected filename.
 * Story 9.2: Phase Progress Dashboard
 */
const ARTIFACT_FILES: Array<{ workflowKey: string; filename: string }> = BMAD_WORKFLOWS

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
      const artifactsDir = join(ctx.projectRoot, '_bmad-output', 'planning-artifacts')

      // Load persisted statuses for this project
      const persistedStatuses = await ctx.db
        .select()
        .from(planning_artifact_statuses)
        .where(eq(planning_artifact_statuses.project_id, input.projectId))

      const statusMap = new Map(persistedStatuses.map((s) => [s.artifact_key, s.status]))

      return ARTIFACT_FILES.map(({ workflowKey, filename }) => {
        const filePath = join(artifactsDir, filename)

        // Use statSync inside try/catch to avoid TOCTOU race between existsSync and statSync
        let fileStat: Stats | null = null
        try {
          fileStat = statSync(filePath)
        } catch {
          // File does not exist
        }
        const exists = fileStat !== null

        let lastModified: number | null = null
        let sizeBytes: number | null = null

        if (fileStat) {
          lastModified = fileStat.mtimeMs
          sizeBytes = fileStat.size
        }

        // Determine status: missing if file doesn't exist, else check persisted status
        const persistedStatus = statusMap.get(workflowKey)
        const status: 'draft' | 'in-review' | 'approved' | 'missing' = !exists
          ? 'missing'
          : persistedStatus === 'approved'
            ? 'approved'
            : persistedStatus === 'in-review'
              ? 'in-review'
              : 'draft'

        return {
          workflowKey,
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
      const workflow = ARTIFACT_FILES.find((a) => a.workflowKey === input.workflowKey)
      if (!workflow) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown workflow: ${input.workflowKey}`
        })
      }

      const filePath = join(ctx.projectRoot, '_bmad-output', 'planning-artifacts', workflow.filename)
      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found: ${workflow.filename}`
        })
      }

      let stat: { mtimeMs: number; size: number }
      try {
        stat = statSync(filePath)
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact not found: ${workflow.filename}`
        })
      }
      return {
        content,
        filePath: `_bmad-output/planning-artifacts/${workflow.filename}`,
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
      const knownKeys = ARTIFACT_FILES.map((a) => a.workflowKey)
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
    })
})
