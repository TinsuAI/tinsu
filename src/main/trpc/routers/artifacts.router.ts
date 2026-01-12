import { z } from 'zod'
import { shell } from 'electron'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ARTIFACT_TYPE } from '../../db/schema'
import { ArtifactLinkingService } from '../../services/artifact-linking.service'

/**
 * tRPC router for artifact operations
 * Story 3.10: Link Artifacts to Tasks
 */
export const artifactsRouter = router({
  /**
   * Get all artifacts linked to a task
   * Returns artifacts with existence status
   */
  getArtifactsForTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      return ArtifactLinkingService.getArtifactsWithStatus(input.taskId)
    }),

  /**
   * Link an artifact to a task
   * Validates that the artifact file exists before linking
   */
  linkArtifact: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        artifactType: z.enum(ARTIFACT_TYPE),
        artifactPath: z.string(),
        sectionRef: z.string().optional()
      })
    )
    .mutation(async ({ input }) => {
      // Validate artifact exists
      if (!ArtifactLinkingService.checkArtifactExists(input.artifactPath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Artifact file not found: ${input.artifactPath}`
        })
      }

      return ArtifactLinkingService.linkArtifactToTask(
        input.taskId,
        input.artifactType,
        input.artifactPath,
        input.sectionRef
      )
    }),

  /**
   * Unlink an artifact from a task
   */
  unlinkArtifact: publicProcedure
    .input(z.object({ taskArtifactId: z.string() }))
    .mutation(async ({ input }) => {
      await ArtifactLinkingService.unlinkArtifactFromTask(input.taskArtifactId)
      return { success: true }
    }),

  /**
   * Open an artifact in the system editor
   * Uses Electron's shell.openPath to launch the default application
   */
  openArtifactInEditor: publicProcedure
    .input(z.object({ artifactPath: z.string() }))
    .mutation(async ({ input }) => {
      if (!ArtifactLinkingService.checkArtifactExists(input.artifactPath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact file not found: ${input.artifactPath}`
        })
      }

      try {
        await shell.openPath(input.artifactPath)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to open artifact: ${(error as Error).message}`
        })
      }
    })
})
