import { z } from 'zod'
import path from 'path'
import { eq } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { StoryImportService } from '../../services/story-import.service'
import { existsSync } from 'fs'
import { sprints } from '../../db/schema'

/**
 * Extracts a story prefix from an epics file name.
 * - "epics.md" -> null (no prefix)
 * - "epics-task-execution-sandbox.md" -> "tes"
 * - "epics-feature-name.md" -> "fn"
 *
 * The prefix is derived by taking the first letter of each word after "epics-".
 */
function extractPrefixFromEpicsFileName(epicsFilePath: string): string | null {
  const fileName = path.basename(epicsFilePath, '.md')

  // Base case: just "epics" -> no prefix
  if (fileName === 'epics') {
    return null
  }

  // Pattern: "epics-{words...}" -> extract words and create abbreviation
  if (fileName.startsWith('epics-')) {
    const suffix = fileName.slice('epics-'.length)
    const words = suffix.split('-')
    // Take first letter of each word to create prefix
    const prefix = words.map(w => w[0]).join('')
    return prefix.toLowerCase()
  }

  // Unknown pattern - no prefix
  return null
}

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
        statusFilePath: z.string().optional(),
        sprintId: z.string().optional() // Sprint to assign imported epics to
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
          input.statusFilePath,
          input.sprintId
        )

        // Update the sprint with the story prefix and epics file path if a sprint was specified
        // This enables the sync feature to filter stories by prefix for this sprint
        if (input.sprintId) {
          const storyPrefix = extractPrefixFromEpicsFileName(input.epicsFilePath)
          ctx.db
            .update(sprints)
            .set({
              story_prefix: storyPrefix,
              epics_file_path: input.epicsFilePath
            })
            .where(eq(sprints.id, input.sprintId))
            .run()
          console.log(`[Import] Updated sprint ${input.sprintId} with story_prefix="${storyPrefix ?? '(none)'}" and epics_file_path="${input.epicsFilePath}"`)
        }

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
