import { z } from 'zod'
import { join } from 'path'
import { statSync } from 'fs'
import type { Stats } from 'fs'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { planning_artifact_statuses, PLANNING_ARTIFACT_STATUS } from '../../db/schema'
import { BMAD_WORKFLOWS } from './planning-workflow-constants'

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
        const status: 'draft' | 'approved' | 'missing' = !exists
          ? 'missing'
          : persistedStatus === 'approved'
            ? 'approved'
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
    })
})
