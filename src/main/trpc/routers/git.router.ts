/**
 * Git Router - TES-4.1
 *
 * tRPC router for git operations.
 * Provides procedures for fetching git diff data.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { GitService } from '../../services/git.service'

/**
 * Git router procedures.
 *
 * - getDiff: Fetch git diff for the current project
 */
export const gitRouter = router({
  /**
   * Get git diff for the current project.
   *
   * Returns both staged and unstaged changes relative to HEAD.
   * The diff includes files, hunks, and line-by-line changes.
   *
   * @example
   * ```typescript
   * const diff = await trpc.git.getDiff.query()
   * console.log(`${diff.summary.filesChanged} files changed`)
   * ```
   */
  getDiff: publicProcedure.query(async ({ ctx }) => {
      try {
        // Use project root from context for git operations
        const diff = await GitService.getDiff(ctx.projectRoot)
        return diff
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Check if it's a git-specific error
        if (errorMessage.includes('not a git repository')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The project directory is not a git repository'
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get git diff: ${errorMessage}`
        })
      }
    })
})
