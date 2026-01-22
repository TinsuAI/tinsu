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
import { tasks } from '../../db/schema'
import { eq, isNotNull } from 'drizzle-orm'

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
    .mutation(async ({ ctx, input }) => {
      try {
        // Story 8.2: Ensure worktrees are gitignored before creating
        await GitService.ensureWorktreesIgnored(ctx.projectRoot)

        // Story 8.3: Pass taskTitle for descriptive branch naming
        const result = await GitService.createWorktree(ctx.projectRoot, input.taskId, input.taskTitle)
        return { worktreePath: result.worktreePath, branchName: result.branchName }
      } catch (error) {
        if (error instanceof GitError) {
          if (error.message.includes('dangerous characters')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid taskId: contains dangerous characters'
            })
          }
          if (error.message.includes('does not exist')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Project path does not exist: ${ctx.projectRoot}`
            })
          }
          // Story 8.2 AC 6: Provide clear error message
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message
          })
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create worktree: ${errorMessage}`
        })
      }
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
    })
})
