/**
 * Git Router - TES-4.1, Story 8.1
 *
 * tRPC router for git operations.
 * Provides procedures for fetching git diff data and git foundation operations.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.1: Git Service Foundation
 */

import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { GitService, GitError } from '../../services/git.service'

/**
 * Git router procedures.
 *
 * - getDiff: Fetch git diff for the current project
 * - checkGitInstalled: Check if git is available
 * - ensureGitInstalled: Ensure git is installed (throws if not)
 * - isGitRepository: Check if a path is a git repository
 * - ensureGitRepository: Ensure path is a git repository (throws if not)
 * - ensureWorktreesIgnored: Add worktrees to gitignore
 */
export const gitRouter = router({
  /**
   * Check if git is installed on the system.
   *
   * @returns true if git is installed, false otherwise
   * @throws TRPCError on unexpected failures
   *
   * @see Story 8.1: AC 3 - Detect missing git dependency
   *
   * @example
   * ```typescript
   * const installed = await trpc.git.checkGitInstalled.query()
   * if (!installed) {
   *   showError('Git not found. Please install git.')
   * }
   * ```
   */
  checkGitInstalled: publicProcedure.query(async () => {
    try {
      return await GitService.checkGitInstalled()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to check git installation: ${errorMessage}`
      })
    }
  }),

  /**
   * Ensure git is installed on the system.
   *
   * @throws TRPCError with NOT_FOUND if git is not installed
   * @throws TRPCError on unexpected failures
   *
   * @see Story 8.1: AC 3 - Detect missing git dependency
   *
   * @example
   * ```typescript
   * await trpc.git.ensureGitInstalled.query()
   * // Git is installed, safe to proceed
   * ```
   */
  ensureGitInstalled: publicProcedure.query(async () => {
    try {
      await GitService.ensureGitInstalled()
      return { success: true }
    } catch (error) {
      if (error instanceof GitError && error.message.includes('Git not found')) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Git not found. Please install git.'
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to verify git installation: ${errorMessage}`
      })
    }
  }),

  /**
   * Check if a path is a git repository.
   *
   * @param input.path - Optional path to check (defaults to project root)
   * @returns true if path is a git repository, false otherwise
   * @throws TRPCError if path is invalid or does not exist
   *
   * @see Story 8.1: AC 4 - Detect missing .git folder
   *
   * @example
   * ```typescript
   * const isRepo = await trpc.git.isGitRepository.query()
   * if (!isRepo) {
   *   showError('Not a git repository')
   * }
   * ```
   */
  isGitRepository: publicProcedure
    .input(
      z.object({
        path: z.string().optional()
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pathToCheck = input?.path || ctx.projectRoot

      try {
        return await GitService.isGitRepository(pathToCheck)
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid path: contains dangerous characters'
            })
          }
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Path does not exist: ${pathToCheck}`
            })
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check repository: ${errorMessage}`
        })
      }
    }),

  /**
   * Ensure a path is a git repository.
   *
   * @param input.path - Optional path to check (defaults to project root)
   * @throws TRPCError with BAD_REQUEST if not a git repository
   * @throws TRPCError if path is invalid or does not exist
   *
   * @see Story 8.1: AC 4 - Detect missing .git folder
   *
   * @example
   * ```typescript
   * await trpc.git.ensureGitRepository.query()
   * // Path is a git repository, safe to proceed
   * ```
   */
  ensureGitRepository: publicProcedure
    .input(
      z.object({
        path: z.string().optional()
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pathToCheck = input?.path || ctx.projectRoot

      try {
        await GitService.ensureGitRepository(pathToCheck)
        return { success: true }
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('Not a git repository')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Not a git repository'
            })
          }
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid path: contains dangerous characters'
            })
          }
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Path does not exist: ${pathToCheck}`
            })
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to verify repository: ${errorMessage}`
        })
      }
    }),

  /**
   * Ensure worktrees directory is added to .gitignore.
   *
   * This must be called before any worktree operations.
   * Adds `.tinsu/worktrees/` to .gitignore if not already present.
   *
   * @param input.projectPath - Optional path (defaults to project root)
   * @throws TRPCError if path is invalid or operation fails
   *
   * @see Story 8.1: AC 6 - Add worktrees to gitignore
   *
   * @example
   * ```typescript
   * await trpc.git.ensureWorktreesIgnored.mutate()
   * // Now safe to create worktrees
   * ```
   */
  ensureWorktreesIgnored: publicProcedure
    .input(
      z.object({
        projectPath: z.string().optional()
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const projectPath = input?.projectPath || ctx.projectRoot

      try {
        await GitService.ensureWorktreesIgnored(projectPath)
        return { success: true }
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid path: contains dangerous characters'
            })
          }
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Project path does not exist: ${projectPath}`
            })
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update gitignore: ${errorMessage}`
        })
      }
    }),

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
