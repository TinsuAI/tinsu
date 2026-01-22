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
import { GitErrorRecoveryService } from '../../services/git-error-recovery.service'
import { GitLogService } from '../../services/git-log.service'
import { categorizeGitError, type GitRecoverableError } from '../../../shared/types/git-error.types'
import { tasks } from '../../db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'

// Story 8.10: Type-safe return types for error recovery
type CreateWorktreeSuccess = {
  success: true
  worktreePath: string
  branchName: string
}

type CreateWorktreeFailure = {
  success: false
  error: GitRecoverableError
}

type CreateWorktreeResult = CreateWorktreeSuccess | CreateWorktreeFailure

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
  }),

  /**
   * Create a git worktree for isolated task execution.
   *
   * Creates a worktree at .tinsu/worktrees/{taskId}/ with a new branch
   * based on the current HEAD. Ensures worktrees are gitignored.
   *
   * @param input.taskId - Unique task identifier
   * @param input.taskTitle - Optional task title for descriptive branch naming (Story 8.3)
   * @returns Object with worktreePath and branchName on success
   * @throws TRPCError if worktree creation fails
   *
   * @see Story 8.2: AC 1, 2, 4, 5, 6
   * @see Story 8.3: AC 1, 2, 3, 4 - Descriptive branch naming
   *
   * @example
   * ```typescript
   * const { worktreePath, branchName } = await trpc.git.createWorktree.mutate({
   *   taskId: 'abc123',
   *   taskTitle: 'Add User Authentication'
   * })
   * // worktreePath = '/project/.tinsu/worktrees/abc123'
   * // branchName = 'tinsu/story-abc123-add-user-authentication'
   * ```
   */
  createWorktree: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        taskTitle: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }): Promise<CreateWorktreeResult> => {
      const startTime = Date.now()

      // Story 8.10: Record operation start for crash recovery
      GitErrorRecoveryService.recordOperationStart(ctx.projectRoot, {
        operationType: 'createWorktree',
        taskId: input.taskId,
        startedAt: startTime,
        status: 'pending'
      })

      // Story 8.10 Task 6: Log operation start
      GitLogService.logStart(ctx.projectRoot, 'createWorktree', input.taskId, 'git worktree add', {
        taskTitle: input.taskTitle
      })

      try {
        // Story 8.2: Ensure worktrees are gitignored before creating
        await GitService.ensureWorktreesIgnored(ctx.projectRoot)

        // Story 8.3: Pass taskTitle for descriptive branch naming
        const result = await GitService.createWorktree(ctx.projectRoot, input.taskId, input.taskTitle)

        // Story 8.10: Record operation complete
        GitErrorRecoveryService.recordOperationComplete(ctx.projectRoot, 'createWorktree', input.taskId)

        // Story 8.10 Task 6: Log operation success
        const durationMs = Date.now() - startTime
        GitLogService.logSuccess(ctx.projectRoot, 'createWorktree', input.taskId, durationMs, {
          worktreePath: result.worktreePath,
          branchName: result.branchName
        })

        return {
          success: true as const,
          worktreePath: result.worktreePath,
          branchName: result.branchName
        }
      } catch (error) {
        const durationMs = Date.now() - startTime

        // Story 8.10: Record operation failed and wrap with recoverable error
        if (error instanceof GitError) {
          GitErrorRecoveryService.recordOperationFailed(
            ctx.projectRoot,
            'createWorktree',
            input.taskId,
            error.message
          )

          // Story 8.10 Task 6: Log operation failure
          GitLogService.logFailure(
            ctx.projectRoot,
            'createWorktree',
            input.taskId,
            error.message,
            undefined,
            'git worktree add',
            durationMs
          )

          // Story 8.10 Task 3.1, 3.2: Wrap errors with GitRecoverableError
          const recoverableError = categorizeGitError(error)

          // Return structured error response instead of throwing
          return {
            success: false as const,
            error: recoverableError
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        GitErrorRecoveryService.recordOperationFailed(ctx.projectRoot, 'createWorktree', input.taskId, errorMessage)

        // Story 8.10 Task 6: Log operation failure
        GitLogService.logFailure(
          ctx.projectRoot,
          'createWorktree',
          input.taskId,
          errorMessage,
          undefined,
          'git worktree add',
          durationMs
        )

        // Generic error - create a recoverable error
        const fakeGitError = new GitError(errorMessage, 'createWorktree')
        return {
          success: false as const,
          error: categorizeGitError(fakeGitError)
        }
      }
    }),

  /**
   * Retry worktree creation after cleaning up partial state.
   *
   * Called when user clicks "Retry" after a worktree creation failure.
   * Cleans up any partial worktree state before attempting again.
   *
   * @param input.taskId - Task ID to retry worktree for
   * @param input.taskTitle - Optional task title for branch naming
   * @returns Object with worktreePath and branchName on success, or error
   *
   * @see Story 8.10: AC 2, Task 3.3
   */
  retryWorktreeCreation: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        taskTitle: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now()

      // Story 8.10 Task 3.3: Clean up partial state first
      const worktreePath = join(ctx.projectRoot, '.tinsu', 'worktrees', input.taskId)

      // Remove partial worktree directory if exists
      if (existsSync(worktreePath)) {
        try {
          rmSync(worktreePath, { recursive: true, force: true })
        } catch (error) {
          // Best effort cleanup - log but don't fail
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'retryWorktreeCreation',
            taskId: input.taskId,
            status: 'failed',
            error: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { phase: 'pre-retry-cleanup', worktreePath }
          })
        }
      }

      // Clear any incomplete operation records
      GitErrorRecoveryService.removeOperation(ctx.projectRoot, 'createWorktree', input.taskId)

      // Prune stale worktree references
      try {
        await GitService.ensureGitInstalled()
        const { execSync } = await import('child_process')
        execSync('git worktree prune', { cwd: ctx.projectRoot, timeout: 5000 })
      } catch (error) {
        // Best effort prune - log but don't fail
        GitLogService.log(ctx.projectRoot, {
          timestamp: new Date().toISOString(),
          operationType: 'pruneWorktrees',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          details: { phase: 'pre-retry-prune' }
        })
      }

      // Story 8.10: Record operation start
      GitErrorRecoveryService.recordOperationStart(ctx.projectRoot, {
        operationType: 'createWorktree',
        taskId: input.taskId,
        worktreePath,
        startedAt: startTime,
        status: 'pending'
      })

      // Story 8.10 Task 6: Log retry start
      GitLogService.logStart(ctx.projectRoot, 'createWorktree', input.taskId, 'git worktree add (retry)', {
        taskTitle: input.taskTitle,
        isRetry: true
      })

      try {
        await GitService.ensureWorktreesIgnored(ctx.projectRoot)
        const result = await GitService.createWorktree(ctx.projectRoot, input.taskId, input.taskTitle)

        GitErrorRecoveryService.recordOperationComplete(ctx.projectRoot, 'createWorktree', input.taskId)

        // Story 8.10 Task 6: Log retry success
        const durationMs = Date.now() - startTime
        GitLogService.logSuccess(ctx.projectRoot, 'createWorktree', input.taskId, durationMs, {
          worktreePath: result.worktreePath,
          branchName: result.branchName,
          isRetry: true,
          outcome: 'Retry succeeded'
        })

        return {
          success: true as const,
          worktreePath: result.worktreePath,
          branchName: result.branchName
        }
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        GitErrorRecoveryService.recordOperationFailed(ctx.projectRoot, 'createWorktree', input.taskId, errorMessage)

        // Story 8.10 Task 6: Log retry failure
        GitLogService.logFailure(
          ctx.projectRoot,
          'createWorktree',
          input.taskId,
          errorMessage,
          undefined,
          'git worktree add (retry)',
          durationMs
        )

        if (error instanceof GitError) {
          return {
            success: false as const,
            error: categorizeGitError(error)
          }
        }

        const fakeGitError = new GitError(errorMessage, 'createWorktree')
        return {
          success: false as const,
          error: categorizeGitError(fakeGitError)
        }
      }
    }),

  /**
   * Skip worktree creation and proceed without git isolation.
   *
   * Called when user clicks "Skip" after a worktree creation failure.
   * Sets the worktree_skipped flag on the task for tracking.
   *
   * @param input.taskId - Task ID to skip worktree for
   * @returns Success status
   *
   * @see Story 8.10: AC 2, Task 3.4
   */
  skipWorktreeCreation: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Story 8.10 Task 3.4: Set worktree_skipped flag
      ctx.db
        .update(tasks)
        .set({
          worktree_skipped: 1,
          updated_at: new Date()
        })
        .where(eq(tasks.id, input.taskId))
        .run()

      // Clear operation record
      GitErrorRecoveryService.removeOperation(ctx.projectRoot, 'createWorktree', input.taskId)

      // Story 8.10 Task 6: Log user choice to skip
      GitLogService.log(ctx.projectRoot, {
        timestamp: new Date().toISOString(),
        operationType: 'createWorktree',
        taskId: input.taskId,
        status: 'succeeded',
        details: { skipped: true, userChoice: 'skip' }
      })

      // Clean up any partial state
      const worktreePath = join(ctx.projectRoot, '.tinsu', 'worktrees', input.taskId)
      if (existsSync(worktreePath)) {
        try {
          rmSync(worktreePath, { recursive: true, force: true })
        } catch (error) {
          // Best effort cleanup - log but don't fail the skip operation
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'skipWorktreeCreation',
            taskId: input.taskId,
            status: 'failed',
            error: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { phase: 'post-skip-cleanup', worktreePath }
          })
        }
      }

      return { success: true }
    }),

  /**
   * Check if a worktree exists for a task.
   *
   * @param input.taskId - Unique task identifier
   * @returns true if worktree exists, false otherwise
   *
   * @see Story 8.2: AC 3
   *
   * @example
   * ```typescript
   * const exists = await trpc.git.hasWorktree.query({ taskId: 'abc123' })
   * if (exists) {
   *   console.log('Worktree already exists')
   * }
   * ```
   */
  hasWorktree: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await GitService.hasWorktree(ctx.projectRoot, input.taskId)
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid taskId: contains dangerous characters'
            })
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check worktree: ${errorMessage}`
        })
      }
    }),

  /**
   * Get the worktree path for a task if it exists.
   *
   * @param input.taskId - Unique task identifier
   * @returns Object with worktreePath (null if doesn't exist)
   *
   * @example
   * ```typescript
   * const { worktreePath } = await trpc.git.getWorktreePath.query({ taskId: 'abc123' })
   * if (worktreePath) {
   *   console.log('Worktree at:', worktreePath)
   * }
   * ```
   */
  getWorktreePath: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const worktreePath = await GitService.getWorktreePath(ctx.projectRoot, input.taskId)
        return { worktreePath }
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid taskId: contains dangerous characters'
            })
          }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get worktree path: ${errorMessage}`
        })
      }
    }),

  /**
   * Generate a branch name for a task without creating a worktree.
   *
   * Useful for previewing what the branch name would be before creating.
   *
   * @param input.taskId - Unique task identifier
   * @param input.taskTitle - Task title for slug generation
   * @returns Object with generated branchName
   *
   * @see Story 8.3: AC 5 - Display branch name in task details
   *
   * @example
   * ```typescript
   * const { branchName } = await trpc.git.getBranchName.query({
   *   taskId: 'abc123',
   *   taskTitle: 'Add User Authentication'
   * })
   * // branchName = 'tinsu/story-abc123-add-user-authentication'
   * ```
   */
  getBranchName: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        taskTitle: z.string().min(1, 'taskTitle is required')
      })
    )
    .query(({ input }) => {
      try {
        const branchName = GitService.generateBranchName(input.taskId, input.taskTitle)
        return { branchName }
      } catch (error) {
        if (error instanceof GitError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate branch name: ${errorMessage}`
        })
      }
    }),

  /**
   * Get diff for a task, handling both active tasks (worktree diff) and
   * completed tasks (historical diff from merge commit).
   *
   * @param input.worktreePath - Path to the task's worktree (for active tasks)
   * @param input.mergeCommitSha - The merge commit SHA (for completed tasks)
   * @returns GitDiffResult with files and summary
   * @throws TRPCError if both or neither parameter provided
   * @throws TRPCError if diff cannot be retrieved
   *
   * @see Story 8.5: AC 6 - Historical diff for done tasks
   *
   * @example
   * ```typescript
   * // Active task with worktree:
   * const diff = await trpc.git.getTaskDiff.query({
   *   worktreePath: '/project/.tinsu/worktrees/abc123'
   * })
   *
   * // Completed task with merge commit:
   * const diff = await trpc.git.getTaskDiff.query({
   *   mergeCommitSha: 'abc123def456'
   * })
   * ```
   */
  getTaskDiff: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().optional(),
        mergeCommitSha: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      // Story 8.5 Task 5.1: Determine which diff method to use
      const hasWorktree = Boolean(input.worktreePath)
      const hasMergeCommit = Boolean(input.mergeCommitSha)

      // Validate: must have exactly one source
      if (!hasWorktree && !hasMergeCommit) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either worktreePath or mergeCommitSha must be provided'
        })
      }

      try {
        // Story 8.5 Task 5.2: For done tasks, use getHistoricalDiff
        if (hasMergeCommit) {
          return await GitService.getHistoricalDiff(ctx.projectRoot, input.mergeCommitSha!)
        }

        // Story 8.5 Task 5.3: For active tasks, use getDiff with worktree path
        return await GitService.getDiff(input.worktreePath!)
      } catch (error) {
        if (error instanceof GitError) {
          // Differentiate between "commit not found" and "worktree not found"
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: hasMergeCommit
                ? `Merge commit not found: ${input.mergeCommitSha}`
                : `Worktree path does not exist: ${input.worktreePath}`
            })
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get task diff: ${errorMessage}`
        })
      }
    }),

  /**
   * List orphaned worktrees (worktrees without active tasks).
   *
   * Returns worktrees in .tinsu/worktrees/ that don't have a corresponding
   * task with a matching worktree_path in the database.
   *
   * @returns Array of orphaned worktrees with path, branchName, and isLocked
   * @throws TRPCError if listing fails
   *
   * @see Story 8.6: AC 5 - List worktrees without active tasks
   *
   * @example
   * ```typescript
   * const orphaned = await trpc.git.listOrphanedWorktrees.query()
   * console.log(`Found ${orphaned.length} orphaned worktrees`)
   * ```
   */
  listOrphanedWorktrees: publicProcedure.query(async ({ ctx }) => {
    try {
      // Story 8.6 Task 5.1: Query active worktree paths from tasks table
      const activeTasks = ctx.db
        .select({ worktree_path: tasks.worktree_path })
        .from(tasks)
        .where(isNotNull(tasks.worktree_path))
        .all()

      const activeWorktreePaths = activeTasks
        .map((t) => t.worktree_path)
        .filter((p): p is string => p !== null)

      // Story 8.6 Task 4.1-4.5: Get orphaned worktrees
      const orphaned = await GitService.listOrphanedWorktrees(ctx.projectRoot, activeWorktreePaths)

      return orphaned
    } catch (error) {
      if (error instanceof GitError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        })
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to list orphaned worktrees: ${errorMessage}`
      })
    }
  }),

  /**
   * Remove an orphaned worktree.
   *
   * Removes the specified worktree and its associated branch.
   * This is called from the settings UI when user wants to clean up
   * orphaned worktrees manually.
   *
   * @param input.worktreePath - Path to the orphaned worktree
   * @param input.branchName - Branch name associated with the worktree
   * @returns RemoveWorktreeResult with success status
   * @throws TRPCError if removal fails
   *
   * @see Story 8.6: AC 5 - Delete orphaned worktrees manually
   *
   * @example
   * ```typescript
   * const result = await trpc.git.removeOrphanedWorktree.mutate({
   *   worktreePath: '/project/.tinsu/worktrees/orphan-task',
   *   branchName: 'tinsu/story-orphan-task-feature'
   * })
   * if (result.success) {
   *   console.log('Orphaned worktree removed')
   * }
   * ```
   */
  removeOrphanedWorktree: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required'),
        branchName: z.string().min(1, 'branchName is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Story 8.6 Task 5.2: Remove the orphaned worktree
        const result = await GitService.removeWorktree(
          ctx.projectRoot,
          input.worktreePath,
          input.branchName
        )

        return result
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid path: contains dangerous characters'
            })
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to remove orphaned worktree: ${errorMessage}`
        })
      }
    }),

  /**
   * Check for merge conflicts before merging a task branch.
   *
   * Uses `git merge --no-commit --no-ff` to test if a merge would succeed,
   * then immediately aborts to restore clean state. Updates task's conflict
   * status in the database.
   *
   * @param input.taskId - Task ID to check conflicts for
   * @returns ConflictDetectionResult with conflict status and file list
   * @throws TRPCError if task not found or branch doesn't exist
   *
   * @see Story 8.7: AC 1, 2, 4 - Conflict detection
   *
   * @example
   * ```typescript
   * const result = await trpc.git.checkForConflicts.mutate({ taskId: 'abc123' })
   * if (result.hasConflicts) {
   *   console.log(`Conflicts in: ${result.conflictFiles.join(', ')}`)
   * }
   * ```
   */
  checkForConflicts: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Story 8.7 Task 4.1: Get task and branch name from database
        const task = ctx.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, input.taskId))
          .get()

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Task not found: ${input.taskId}`
          })
        }

        if (!task.branch_name) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Task has no branch: ${input.taskId}`
          })
        }

        // Story 8.7 Task 4.2: Call GitService.detectMergeConflicts
        const result = await GitService.detectMergeConflicts(ctx.projectRoot, task.branch_name)

        // Story 8.7 Task 4.3: Update task's conflict status in database
        ctx.db
          .update(tasks)
          .set({
            has_merge_conflict: result.hasConflicts ? 1 : 0,
            conflict_files: result.conflictFiles.length > 0 ? JSON.stringify(result.conflictFiles) : null,
            updated_at: new Date()
          })
          .where(eq(tasks.id, input.taskId))
          .run()

        // Story 8.7 Task 4.4: Return result
        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        if (error instanceof GitError) {
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            })
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check for conflicts: ${errorMessage}`
        })
      }
    }),

  /**
   * Get the content of a conflicting file from a worktree.
   *
   * @param input.worktreePath - Path to the task's worktree
   * @param input.filePath - Relative path to the file within the worktree
   * @returns The file content as a string
   * @throws TRPCError if file doesn't exist or path is invalid
   *
   * @see Story 8.8: AC 1, 2 - Load conflict file content
   *
   * @example
   * ```typescript
   * const content = await trpc.git.getConflictFileContent.query({
   *   worktreePath: '/project/.tinsu/worktrees/abc123',
   *   filePath: 'src/main.ts'
   * })
   * ```
   */
  getConflictFileContent: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required'),
        filePath: z.string().min(1, 'filePath is required')
      })
    )
    .query(async ({ input }) => {
      const { resolve } = await import('path')
      const { existsSync, readFileSync } = await import('fs')

      // Validate paths don't contain dangerous characters
      if (/[;&|`$<>]/.test(input.worktreePath) || /[;&|`$<>]/.test(input.filePath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: contains dangerous characters'
        })
      }

      const fullPath = resolve(input.worktreePath, input.filePath)

      // Ensure path is within worktree (prevent directory traversal)
      const normalizedWorktree = resolve(input.worktreePath)
      if (!fullPath.startsWith(normalizedWorktree)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: file path must be within worktree'
        })
      }

      if (!existsSync(fullPath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `File not found: ${input.filePath}`
        })
      }

      try {
        return readFileSync(fullPath, 'utf-8')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to read file: ${errorMessage}`
        })
      }
    }),

  /**
   * Save resolved content to a conflict file in the worktree.
   *
   * @param input.worktreePath - Path to the task's worktree
   * @param input.filePath - Relative path to the file within the worktree
   * @param input.content - The resolved content to write
   * @returns Success status
   * @throws TRPCError if path is invalid or write fails
   *
   * @see Story 8.8: AC 2, 3 - Save resolved content
   *
   * @example
   * ```typescript
   * await trpc.git.saveConflictFileContent.mutate({
   *   worktreePath: '/project/.tinsu/worktrees/abc123',
   *   filePath: 'src/main.ts',
   *   content: 'resolved content here'
   * })
   * ```
   */
  saveConflictFileContent: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required'),
        filePath: z.string().min(1, 'filePath is required'),
        content: z.string()
      })
    )
    .mutation(async ({ input }) => {
      const { resolve } = await import('path')
      const { writeFileSync } = await import('fs')

      // Validate paths don't contain dangerous characters
      if (/[;&|`$<>]/.test(input.worktreePath) || /[;&|`$<>]/.test(input.filePath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: contains dangerous characters'
        })
      }

      const fullPath = resolve(input.worktreePath, input.filePath)

      // Ensure path is within worktree (prevent directory traversal)
      const normalizedWorktree = resolve(input.worktreePath)
      if (!fullPath.startsWith(normalizedWorktree)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: file path must be within worktree'
        })
      }

      try {
        writeFileSync(fullPath, input.content, 'utf-8')
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to save file: ${errorMessage}`
        })
      }
    }),

  /**
   * Stage a resolved file in the worktree.
   *
   * @param input.worktreePath - Path to the task's worktree
   * @param input.filePath - Relative path to the file to stage
   * @returns Success status
   * @throws TRPCError if staging fails
   *
   * @see Story 8.8: AC 4 - Stage resolved files for commit
   *
   * @example
   * ```typescript
   * await trpc.git.stageResolvedFile.mutate({
   *   worktreePath: '/project/.tinsu/worktrees/abc123',
   *   filePath: 'src/main.ts'
   * })
   * ```
   */
  stageResolvedFile: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required'),
        filePath: z.string().min(1, 'filePath is required')
      })
    )
    .mutation(async ({ input }) => {
      const { resolve } = await import('path')
      const { existsSync: fsExistsSync } = await import('fs')

      // Validate paths don't contain dangerous characters
      if (/[;&|`$<>]/.test(input.worktreePath) || /[;&|`$<>]/.test(input.filePath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: contains dangerous characters'
        })
      }

      const normalizedWorktree = resolve(input.worktreePath)

      if (!fsExistsSync(normalizedWorktree)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Worktree not found: ${input.worktreePath}`
        })
      }

      try {
        await GitService.stageFile(normalizedWorktree, input.filePath)
        return { success: true }
      } catch (error) {
        if (error instanceof GitError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to stage file: ${errorMessage}`
        })
      }
    }),

  /**
   * Complete conflict resolution by committing the merge.
   *
   * After all conflicts are resolved and staged, this commits the merge
   * and updates the task's conflict status in the database.
   *
   * @param input.worktreePath - Path to the task's worktree
   * @param input.taskId - Task ID for database update
   * @returns Success status
   * @throws TRPCError if commit fails
   *
   * @see Story 8.8: AC 4 - Complete merge after resolution
   *
   * @example
   * ```typescript
   * await trpc.git.completeConflictResolution.mutate({
   *   worktreePath: '/project/.tinsu/worktrees/abc123',
   *   taskId: 'abc123'
   * })
   * ```
   */
  completeConflictResolution: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required'),
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { resolve } = await import('path')
      const { existsSync: fsExistsSync2 } = await import('fs')

      // Validate paths don't contain dangerous characters
      if (/[;&|`$<>]/.test(input.worktreePath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: contains dangerous characters'
        })
      }

      const normalizedWorktree = resolve(input.worktreePath)

      if (!fsExistsSync2(normalizedWorktree)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Worktree not found: ${input.worktreePath}`
        })
      }

      try {
        // Complete the merge commit
        await GitService.completeMergeCommit(normalizedWorktree)

        // Update task's conflict status in database
        ctx.db
          .update(tasks)
          .set({
            has_merge_conflict: 0,
            conflict_files: null,
            updated_at: new Date()
          })
          .where(eq(tasks.id, input.taskId))
          .run()

        return { success: true }
      } catch (error) {
        if (error instanceof GitError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to complete merge: ${errorMessage}`
        })
      }
    }),

  /**
   * Get branch status compared to main.
   *
   * Returns commits ahead, commits behind, and uncommitted changes status
   * for a task's branch. Used by BranchStatusIndicator component.
   *
   * @param input.branchName - Branch name to compare against main
   * @param input.worktreePath - Optional path to worktree for uncommitted changes check
   * @returns BranchStatus with commitsAhead, commitsBehind, hasUncommittedChanges
   * @throws TRPCError if branch doesn't exist or comparison fails
   *
   * @see Story 8.9: AC 2, 3 - Branch status indicators
   *
   * @example
   * ```typescript
   * const status = await trpc.git.getBranchStatus.query({
   *   branchName: 'tinsu/story-abc123-feature',
   *   worktreePath: '/project/.tinsu/worktrees/abc123'
   * })
   * if (status.commitsBehind > 0) {
   *   console.log(`Branch is ${status.commitsBehind} commits behind main`)
   * }
   * ```
   */
  getBranchStatus: publicProcedure
    .input(
      z.object({
        branchName: z.string().min(1, 'branchName is required'),
        worktreePath: z.string().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await GitService.getBranchStatus(
          ctx.projectRoot,
          input.branchName,
          input.worktreePath
        )
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message
            })
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get branch status: ${errorMessage}`
        })
      }
    }),

  /**
   * Auto-commit uncommitted changes in a worktree.
   *
   * Called when an agent finishes to preserve its work. If there are
   * uncommitted changes, they are staged and committed with "WIP: Agent changes".
   *
   * @param input.worktreePath - Path to the task's worktree
   * @returns Object with committed flag and optional commitSha
   * @throws TRPCError if path is invalid or commit fails
   *
   * @see Story 8.9: AC 3 - Auto-commit on agent completion
   *
   * @example
   * ```typescript
   * const result = await trpc.git.autoCommitWorktreeChanges.mutate({
   *   worktreePath: '/project/.tinsu/worktrees/abc123'
   * })
   * if (result.committed) {
   *   console.log(`Auto-committed changes: ${result.commitSha}`)
   * }
   * ```
   */
  autoCommitWorktreeChanges: publicProcedure
    .input(
      z.object({
        worktreePath: z.string().min(1, 'worktreePath is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now()

      // Story 8.10 Task 6: Log auto-commit start
      GitLogService.logStart(ctx.projectRoot, 'autoCommit', undefined, 'git commit -m "WIP: Agent changes"', {
        worktreePath: input.worktreePath
      })

      try {
        const result = await GitService.autoCommitWorktreeChanges(input.worktreePath)

        // Story 8.10 Task 6: Log auto-commit result
        const durationMs = Date.now() - startTime
        GitLogService.logSuccess(ctx.projectRoot, 'autoCommit', undefined, durationMs, {
          worktreePath: input.worktreePath,
          committed: result.committed,
          commitSha: result.commitSha
        })

        return result
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Story 8.10 Task 6: Log auto-commit failure
        GitLogService.logFailure(
          ctx.projectRoot,
          'autoCommit',
          undefined,
          errorMessage,
          undefined,
          'git commit -m "WIP: Agent changes"',
          durationMs
        )

        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid path: contains dangerous characters'
            })
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to auto-commit changes: ${errorMessage}`
        })
      }
    }),

  /**
   * Open the worktree directory in the system's default editor.
   *
   * Uses Electron's shell.openPath() to open the directory.
   *
   * @param input.path - Path to open in the system editor
   * @returns Success status and any error message from the shell
   *
   * @see Story 8.8: AC 5 - Open in external editor
   *
   * @example
   * ```typescript
   * await trpc.git.openInSystemEditor.mutate({
   *   path: '/project/.tinsu/worktrees/abc123'
   * })
   * ```
   */
  openInSystemEditor: publicProcedure
    .input(
      z.object({
        path: z.string().min(1, 'path is required')
      })
    )
    .mutation(async ({ input }) => {
      const { resolve } = await import('path')
      const { existsSync: fsExistsSync3 } = await import('fs')
      const { shell } = await import('electron')

      // Validate path doesn't contain dangerous characters
      if (/[;&|`$<>]/.test(input.path)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid path: contains dangerous characters'
        })
      }

      const normalizedPath = resolve(input.path)

      if (!fsExistsSync3(normalizedPath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Path not found: ${input.path}`
        })
      }

      try {
        const result = await shell.openPath(normalizedPath)
        // shell.openPath returns empty string on success, error message on failure
        if (result) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to open editor: ${result}`
          })
        }
        return { success: true }
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to open editor: ${errorMessage}`
        })
      }
    }),

  /**
   * Merge a task's worktree branch back to main with error recovery.
   *
   * This is an alternative to the task.updateStatus flow that provides
   * detailed error handling with retry/skip options for merge failures.
   *
   * @param input.taskId - Task ID to merge
   * @param input.branchName - Branch name to merge
   * @param input.taskTitle - Task title for merge commit message
   * @returns MergeResult with success status or error with recovery options
   *
   * @see Story 8.10: AC 3, Task 4.1, 4.2, 4.3
   *
   * @example
   * ```typescript
   * const result = await trpc.git.mergeTaskBranch.mutate({
   *   taskId: 'abc123',
   *   branchName: 'tinsu/story-abc123-feature',
   *   taskTitle: 'Add authentication'
   * })
   * if (!result.success && result.error.category === 'merge_failed') {
   *   // Show merge error dialog with retry option
   * }
   * ```
   */
  mergeTaskBranch: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        branchName: z.string().min(1, 'branchName is required'),
        taskTitle: z.string().min(1, 'taskTitle is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now()
      const command = `git merge ${input.branchName}`

      // Story 8.10 Task 4.1: Record merge operation start
      GitErrorRecoveryService.recordOperationStart(ctx.projectRoot, {
        operationType: 'merge',
        taskId: input.taskId,
        branchName: input.branchName,
        startedAt: startTime,
        status: 'pending'
      })

      // Story 8.10 Task 6: Log merge operation start
      GitLogService.logStart(ctx.projectRoot, 'merge', input.taskId, command, {
        branchName: input.branchName,
        taskTitle: input.taskTitle
      })

      try {
        const result = await GitService.mergeWorktree(
          ctx.projectRoot,
          input.branchName,
          input.taskId,
          input.taskTitle
        )

        // Story 8.10 Task 4.2: Record operation complete on success
        GitErrorRecoveryService.recordOperationComplete(ctx.projectRoot, 'merge', input.taskId)

        const durationMs = Date.now() - startTime

        if (result.success) {
          // Story 8.10 Task 6: Log merge success
          GitLogService.logSuccess(ctx.projectRoot, 'merge', input.taskId, durationMs, {
            commitSha: result.commitSha,
            mergeType: result.mergeType
          })

          return {
            success: true as const,
            commitSha: result.commitSha,
            mergeType: result.mergeType
          }
        } else {
          // Merge conflict - log as succeeded with conflict details (conflicts are expected workflow state, not errors)
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'merge',
            taskId: input.taskId,
            status: 'succeeded',
            command,
            durationMs,
            details: { hasConflict: true, conflictFiles: result.conflictFiles }
          })

          return {
            success: false as const,
            isConflict: true,
            conflictFiles: result.conflictFiles || []
          }
        }
      } catch (error) {
        const durationMs = Date.now() - startTime

        // Story 8.10 Task 4.3: Wrap errors with GitRecoverableError, preserve worktree
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        GitErrorRecoveryService.recordOperationFailed(ctx.projectRoot, 'merge', input.taskId, errorMessage)

        // Story 8.10 Task 6: Log merge failure
        GitLogService.logFailure(
          ctx.projectRoot,
          'merge',
          input.taskId,
          errorMessage,
          undefined,
          command,
          durationMs
        )

        // Story 8.10 AC 3: Worktree preserved on merge failure (already logged above)

        if (error instanceof GitError) {
          return {
            success: false as const,
            isConflict: false,
            error: categorizeGitError(error)
          }
        }

        const fakeGitError = new GitError(errorMessage, 'git merge')
        return {
          success: false as const,
          isConflict: false,
          error: categorizeGitError(fakeGitError)
        }
      }
    }),

  /**
   * Retry a failed merge operation.
   *
   * Clears the failed operation record and attempts the merge again.
   * The worktree should be preserved from the original failure.
   *
   * @param input.taskId - Task ID to retry merge for
   * @param input.branchName - Branch name to merge
   * @param input.taskTitle - Task title for merge commit message
   * @returns MergeResult with success status or error
   *
   * @see Story 8.10: AC 3, Task 4.4
   */
  retryMerge: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        branchName: z.string().min(1, 'branchName is required'),
        taskTitle: z.string().min(1, 'taskTitle is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now()
      const command = `git merge ${input.branchName} (retry)`

      // Story 8.10 Task 4.4: Clear previous failed operation
      GitErrorRecoveryService.removeOperation(ctx.projectRoot, 'merge', input.taskId)

      // Ensure no merge in progress
      try {
        const { execSync } = await import('child_process')
        execSync('git merge --abort', { cwd: ctx.projectRoot, timeout: 5000, stdio: 'pipe' })
      } catch {
        // Ignore - may not be in merge state
      }

      // Story 8.10 Task 4.5: Record new operation start
      GitErrorRecoveryService.recordOperationStart(ctx.projectRoot, {
        operationType: 'merge',
        taskId: input.taskId,
        branchName: input.branchName,
        startedAt: startTime,
        status: 'pending'
      })

      // Story 8.10 Task 6: Log retry start
      GitLogService.logStart(ctx.projectRoot, 'merge', input.taskId, command, {
        branchName: input.branchName,
        taskTitle: input.taskTitle,
        isRetry: true
      })

      try {
        const result = await GitService.mergeWorktree(
          ctx.projectRoot,
          input.branchName,
          input.taskId,
          input.taskTitle
        )

        GitErrorRecoveryService.recordOperationComplete(ctx.projectRoot, 'merge', input.taskId)

        const durationMs = Date.now() - startTime

        if (result.success) {
          // Story 8.10 Task 6: Log retry success
          GitLogService.logSuccess(ctx.projectRoot, 'merge', input.taskId, durationMs, {
            commitSha: result.commitSha,
            mergeType: result.mergeType,
            isRetry: true
          })

          return {
            success: true as const,
            commitSha: result.commitSha,
            mergeType: result.mergeType
          }
        } else {
          // Merge conflict on retry
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'merge',
            taskId: input.taskId,
            status: 'failed',
            command,
            durationMs,
            error: 'Merge conflict detected on retry',
            details: { conflictFiles: result.conflictFiles, isRetry: true }
          })

          return {
            success: false as const,
            isConflict: true,
            conflictFiles: result.conflictFiles || []
          }
        }
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        GitErrorRecoveryService.recordOperationFailed(ctx.projectRoot, 'merge', input.taskId, errorMessage)

        // Story 8.10 Task 6: Log retry failure
        GitLogService.logFailure(
          ctx.projectRoot,
          'merge',
          input.taskId,
          errorMessage,
          undefined,
          command,
          durationMs
        )

        if (error instanceof GitError) {
          return {
            success: false as const,
            isConflict: false,
            error: categorizeGitError(error)
          }
        }

        const fakeGitError = new GitError(errorMessage, 'git merge')
        return {
          success: false as const,
          isConflict: false,
          error: categorizeGitError(fakeGitError)
        }
      }
    }),

  /**
   * Check for incomplete git operations that may need recovery.
   *
   * Called on project open to detect operations that were interrupted.
   * Returns incomplete operations for user to resolve.
   *
   * @returns Array of incomplete operations with recovery options
   *
   * @see Story 8.10: AC 4, Task 5.1
   */
  getIncompleteOperations: publicProcedure.query(async ({ ctx }) => {
    const incomplete = GitErrorRecoveryService.getIncompleteOperations(ctx.projectRoot)
    const failed = GitErrorRecoveryService.getFailedOperations(ctx.projectRoot)

    return {
      incomplete,
      failed,
      hasIssues: incomplete.length > 0 || failed.length > 0
    }
  }),

  /**
   * Perform crash recovery check on project open.
   *
   * This is called when a project is opened to detect any incomplete
   * git operations from a previous session that crashed or was interrupted.
   *
   * Story 8.10 Task 5.1, 5.2, 5.3, 5.4:
   * - Reads git-operations.json on startup
   * - Checks for pending operations (age > 5 minutes assumed crashed)
   * - Returns operations needing user decision
   *
   * @returns Object with crash recovery info and options
   *
   * @see Story 8.10: AC 4 - Crash recovery detection
   */
  checkCrashRecovery: publicProcedure.query(async ({ ctx }) => {
    // Story 8.10 Task 5.1: Read operations file
    const incomplete = GitErrorRecoveryService.getIncompleteOperations(ctx.projectRoot)
    const failed = GitErrorRecoveryService.getFailedOperations(ctx.projectRoot)

    // Story 8.10 Task 5.2: Check age of pending operations
    // Operations older than 5 minutes are considered crashed
    // Rationale: Normal git operations complete in <1min. 5min threshold avoids false positives
    // for large repos while still detecting genuine crashes quickly enough to be useful.
    // NFR22: Branch operations complete within 5 seconds for repos up to 10GB
    const CRASH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
    const now = Date.now()

    const crashedOperations = incomplete.filter((op) => {
      const age = now - op.startedAt
      return age > CRASH_THRESHOLD_MS
    })

    // Story 8.10 Task 5.3: Validate filesystem state for crashed operations
    const operationsNeedingRecovery = await Promise.all(
      crashedOperations.map(async (op) => {
        // Check if worktree still exists (partial state)
        let hasPartialState = false
        if (op.worktreePath) {
          hasPartialState = existsSync(op.worktreePath)
        } else if (op.taskId) {
          const expectedPath = join(ctx.projectRoot, '.tinsu', 'worktrees', op.taskId)
          hasPartialState = existsSync(expectedPath)
        }

        // Story 8.10 Task 5.4: Return operations needing user decision
        return {
          ...op,
          hasPartialState,
          // Suggest actions based on operation type
          suggestedActions:
            op.operationType === 'createWorktree'
              ? hasPartialState
                ? ['retry', 'skip', 'cleanup']
                : ['retry', 'dismiss']
              : op.operationType === 'merge'
                ? ['retry', 'dismiss']
                : ['dismiss']
        }
      })
    )

    return {
      hasRecoveryNeeded: operationsNeedingRecovery.length > 0 || failed.length > 0,
      crashedOperations: operationsNeedingRecovery,
      failedOperations: failed,
      summary:
        operationsNeedingRecovery.length > 0 || failed.length > 0
          ? `Found ${operationsNeedingRecovery.length} interrupted operation(s) and ${failed.length} failed operation(s) from a previous session.`
          : null
    }
  }),

  /**
   * Cleanup partial worktree state from a crashed operation.
   *
   * Removes partial worktree directory and prunes git worktree references.
   *
   * @param input.taskId - Task ID with partial state
   *
   * @see Story 8.10: Task 5.5
   */
  cleanupPartialWorktree: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required')
      })
    )
    .mutation(async ({ ctx, input }) => {
      const worktreePath = join(ctx.projectRoot, '.tinsu', 'worktrees', input.taskId)

      // Remove directory if exists
      if (existsSync(worktreePath)) {
        try {
          rmSync(worktreePath, { recursive: true, force: true })
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'cleanupPartialWorktree',
            taskId: input.taskId,
            status: 'succeeded',
            details: { worktreePath }
          })
        } catch (error) {
          GitLogService.log(ctx.projectRoot, {
            timestamp: new Date().toISOString(),
            operationType: 'cleanupPartialWorktree',
            taskId: input.taskId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            details: { worktreePath }
          })
        }
      }

      // Prune git worktree references
      try {
        const { execSync } = await import('child_process')
        execSync('git worktree prune', { cwd: ctx.projectRoot, timeout: 5000, stdio: 'pipe' })
        GitLogService.log(ctx.projectRoot, {
          timestamp: new Date().toISOString(),
          operationType: 'pruneWorktrees',
          status: 'succeeded'
        })
      } catch (error) {
        GitLogService.log(ctx.projectRoot, {
          timestamp: new Date().toISOString(),
          operationType: 'pruneWorktrees',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Remove operation record
      GitErrorRecoveryService.removeOperation(ctx.projectRoot, 'createWorktree', input.taskId)

      return { success: true }
    }),

  /**
   * Dismiss/clear an incomplete or failed operation.
   *
   * Called when user chooses to ignore a recovery prompt.
   *
   * @param input.operationType - Type of operation to dismiss
   * @param input.taskId - Optional task ID to match specific operation
   *
   * @see Story 8.10: Task 5.6
   */
  dismissOperation: publicProcedure
    .input(
      z.object({
        operationType: z.string().min(1, 'operationType is required'),
        taskId: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      GitErrorRecoveryService.removeOperation(ctx.projectRoot, input.operationType, input.taskId)
      GitLogService.log(ctx.projectRoot, {
        timestamp: new Date().toISOString(),
        operationType: 'dismissOperation',
        taskId: input.taskId,
        status: 'succeeded',
        details: { dismissedOperation: input.operationType }
      })
      return { success: true }
    }),

  /**
   * Get git operation logs for a specific date.
   *
   * Returns detailed logs for debugging git issues.
   *
   * @param input.date - Optional date in YYYY-MM-DD format (defaults to today)
   * @returns Array of log entries
   *
   * @see Story 8.10: Task 6.4, Task 8
   */
  getLogs: publicProcedure
    .input(
      z.object({
        date: z.string().optional()
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const logs = GitLogService.readLogs(ctx.projectRoot, input?.date)
      return logs
    }),

  /**
   * List available log dates.
   *
   * @returns Array of available dates (most recent first)
   *
   * @see Story 8.10: Task 8
   */
  getLogDates: publicProcedure.query(async ({ ctx }) => {
    return GitLogService.listLogDates(ctx.projectRoot)
  }),

  /**
   * Get log storage statistics.
   *
   * @returns Object with log count and total size
   *
   * @see Story 8.10: Task 8
   */
  getLogStats: publicProcedure.query(async ({ ctx }) => {
    const dates = GitLogService.listLogDates(ctx.projectRoot)
    const totalSize = GitLogService.getLogsSize(ctx.projectRoot)

    return {
      fileCount: dates.length,
      totalSizeBytes: totalSize,
      totalSizeFormatted:
        totalSize < 1024
          ? `${totalSize} B`
          : totalSize < 1024 * 1024
            ? `${(totalSize / 1024).toFixed(1)} KB`
            : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    }
  }),

  /**
   * Cleanup old log files.
   *
   * Removes log files older than 7 days.
   *
   * @see Story 8.10: Task 6.5
   */
  cleanupLogs: publicProcedure.mutation(async ({ ctx }) => {
    GitLogService.cleanupOldLogs(ctx.projectRoot)
    return { success: true }
  })
})
