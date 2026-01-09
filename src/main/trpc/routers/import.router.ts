import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { StoryImportService } from '../../services/story-import.service'
import { existsSync } from 'fs'

/**
 * tRPC router for story import operations.
 *
 * Provides procedures for importing epics and stories from epics.md files
 * into the database.
 *
 * Story 3.7: Story Import After Epics Phase
 */
export const importRouter = router({
  /**
   * Imports stories from an epics.md file.
   *
   * Parses the epics.md file and creates:
   * - Epic records in the epics table
   * - Story tasks in the tasks table, linked to epics
   *
   * @param projectId - ID of the project to import into
   * @param epicsFilePath - Absolute path to the epics.md file
   * @param statusFilePath - Optional path to sprint-status.yaml for status mapping
   * @returns Import result with counts of created epics and stories
   * @throws NOT_FOUND if epics file doesn't exist
   * @throws PRECONDITION_FAILED if no project is open
   * @throws INTERNAL_SERVER_ERROR if parsing fails
   */
  importStoriesFromEpics: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        epicsFilePath: z.string(),
        statusFilePath: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // AC12: Throw error if no project open
      if (!ctx.projectId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No project open'
        })
      }

      // Validate epics file exists
      if (!existsSync(input.epicsFilePath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Epics file not found: ${input.epicsFilePath}`
        })
      }

      try {
        // Use the project ID from context (security: don't trust client input)
        const result = await StoryImportService.importFromEpicsFile(
          ctx.db,
          ctx.projectId,
          input.epicsFilePath,
          input.statusFilePath
        )

        return result
      } catch (error) {
        // Re-throw TRPCErrors as-is
        if (error instanceof TRPCError) {
          throw error
        }

        // Wrap other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to parse epics file: ${error instanceof Error ? error.message : String(error)}`,
          cause: error
        })
      }
    })
})
