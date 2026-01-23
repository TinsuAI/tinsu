import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, epics, sprints, agent_runs, TASK_STATUS } from '../../db/schema'
import { eq, asc, desc, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { StorySyncService } from '../../services/story-sync.service'
import { TaskTerminalService } from '../../services/task-terminal.service'
import { ConfigService } from '../../services/config.service'
import { activityLogService, AutomationService } from '../../services'
import { GitService, GitError } from '../../services/git.service'
import { categorizeGitError } from '../../../shared/types/git-error.types'

/**
 * Map database status to file status format.
 * DB uses snake_case, files use kebab-case.
 * Story 5.2b: Added create_story status mapping
 */
function mapDbStatusToFileStatus(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    backlog: 'ready-for-dev',
    create_story: 'create-story', // Story 5.2b
    in_progress: 'in-progress',
    review: 'review',
    done: 'done'
  }
  return statusMap[dbStatus] || 'ready-for-dev'
}

// Zod schema for task status validation
const taskStatusSchema = z.enum(TASK_STATUS)

export const taskRouter = router({
  // List all tasks (ordered by sort_order within each status)
  // Story 3.1.5: Filter by current project
  getAll: publicProcedure.query(({ ctx }) => {
    // AC12: Return empty array if no project open
    if (!ctx.projectId) {
      return []
    }
    const allTasks = ctx.db
      .select()
      .from(tasks)
      .where(eq(tasks.project_id, ctx.projectId))
      .orderBy(asc(tasks.sort_order))
      .all()

    // Story 7.5: Parse inline_comments JSON string to array
    return allTasks.map((task) => ({
      ...task,
      inline_comments: task.inline_comments
        ? JSON.parse(task.inline_comments)
        : null
    }))
  }),

  // Story 3.2: Get planning tasks ordered by phase_number
  // Story 3.1.5: Filter by current project
  getPlanningTasks: publicProcedure.query(({ ctx }) => {
    // AC12: Return empty array if no project open
    if (!ctx.projectId) {
      return []
    }
    return ctx.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.task_type, 'planning'), eq(tasks.project_id, ctx.projectId)))
      .orderBy(asc(tasks.phase_number))
      .all()
  }),

  // Get single task by ID
  // Story 3.1.5: Verify task belongs to current project (single query optimization)
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    // Use single query with project filter for efficiency and security
    const task = ctx.projectId
      ? ctx.db
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, input.id), eq(tasks.project_id, ctx.projectId)))
          .get()
      : ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()

    if (!task) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }

    // Story 7.5: Parse inline_comments JSON string to array
    return {
      ...task,
      inline_comments: task.inline_comments
        ? JSON.parse(task.inline_comments)
        : null
    }
  }),

  // Get task with epic and sprint relations (Story 2.5)
  // Story 3.1.5: Verify task belongs to current project (single query optimization)
  getWithRelations: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      // Use single query with project filter for efficiency and security
      const task = ctx.projectId
        ? ctx.db
            .select()
            .from(tasks)
            .where(and(eq(tasks.id, input.id), eq(tasks.project_id, ctx.projectId)))
            .get()
        : ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Fetch related epic and sprint if assigned
      const epic = task.epic_id
        ? ctx.db.select().from(epics).where(eq(epics.id, task.epic_id)).get()
        : null
      const sprint = task.sprint_id
        ? ctx.db.select().from(sprints).where(eq(sprints.id, task.sprint_id)).get()
        : null

      return { ...task, epic, sprint }
    }),

  // Get all tasks with their related epics (Story 2.5)
  // Story 3.1.5: Filter by current project
  getAllWithEpics: publicProcedure.query(({ ctx }) => {
    // AC12: Return empty array if no project open
    if (!ctx.projectId) {
      return []
    }
    const allTasks = ctx.db
      .select()
      .from(tasks)
      .where(eq(tasks.project_id, ctx.projectId))
      .orderBy(asc(tasks.sort_order))
      .all()
    const allEpics = ctx.db
      .select()
      .from(epics)
      .where(eq(epics.project_id, ctx.projectId))
      .all()

    // Create a map for quick epic lookup
    const epicMap = new Map(allEpics.map((e) => [e.id, e]))

    // Story 7.5: Parse inline_comments JSON string to array
    return allTasks.map((task) => ({
      ...task,
      epic: task.epic_id ? epicMap.get(task.epic_id) ?? null : null,
      inline_comments: task.inline_comments
        ? JSON.parse(task.inline_comments)
        : null
    }))
  }),

  // Create new task (inserts at top of column with sort_order = 0)
  // Story 3.1.5: Set project_id from context
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        status: taskStatusSchema.default('backlog'),
        epic_id: z.string().optional(),
        sprint_id: z.string().optional()
      })
    )
    .mutation(({ ctx, input }) => {
      // AC12: Throw error if no project open
      if (!ctx.projectId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No project open'
        })
      }

      const id = randomUUID()
      const now = new Date()

      // Shift existing tasks in this column down (increment sort_order)
      // This ensures new task appears at top with sort_order = 0
      // Story 3.1.5: Only shift tasks in current project
      ctx.db
        .update(tasks)
        .set({ sort_order: sql`${tasks.sort_order} + 1` })
        .where(and(eq(tasks.status, input.status), eq(tasks.project_id, ctx.projectId)))
        .run()

      return ctx.db
        .insert(tasks)
        .values({
          id,
          title: input.title,
          description: input.description,
          status: input.status,
          sort_order: 0, // New task at top of column
          epic_id: input.epic_id,
          sprint_id: input.sprint_id,
          project_id: ctx.projectId, // AC9: Set project_id from context
          created_at: now,
          updated_at: now
        })
        .returning()
        .get()
    }),

  // Update task status
  // Story 3.9: Sync status change to story file (AC: 1)
  // Story TES-1.3: Create tmux session when moving to in_progress (AC: 1)
  // Story TES-2.5: Log status_change activity when status changes (AC: 1, 2)
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: taskStatusSchema
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TES-2.5 AC1: Capture old status BEFORE update
      const oldTask = ctx.db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .get()

      if (!oldTask) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      const result = ctx.db
        .update(tasks)
        .set({ status: input.status, updated_at: new Date() })
        .where(eq(tasks.id, input.id))
        .returning()
        .get()

      // This shouldn't happen since we checked above, but handle gracefully
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // TES-2.5 AC1: Log status_change activity (only if status actually changed)
      if (oldTask.status !== input.status) {
        try {
          await activityLogService.logActivity(input.id, 'status_change', {
            from: oldTask.status,
            to: input.status
          })
        } catch (error) {
          // TES-2.5 Edge Case #5: Don't fail status update if activity logging fails
          console.error('[TES-2.5] Failed to log status_change activity:', error)
        }
      }

      // Story TES-1.3: Create tmux session when moving to in_progress or create_story (AC: 1)
      // Story 8.2: Create git worktree for isolated task execution
      // Story tasks need session created at create_story phase for the create-story workflow
      if (input.status === 'in_progress' || input.status === 'create_story') {
        try {
          // Get project name from config (or use folder name as fallback)
          const configService = new ConfigService(ctx.projectRoot)
          let projectName: string
          try {
            const config = configService.loadConfig()
            projectName = config.projectName
          } catch {
            // Fallback to folder name if config doesn't exist
            projectName = ctx.projectRoot.split('/').pop() || 'project'
          }

          // Story 8.2: Create git worktree for isolated agent execution (AC: 1, 2, 3)
          // Check if task already has a worktree (AC: 3 - reuse existing)
          let worktreePath = result.worktree_path

          if (!worktreePath) {
            // Check if worktree exists on filesystem (e.g., from previous run)
            const hasExistingWorktree = await GitService.hasWorktree(ctx.projectRoot, input.id)

            if (hasExistingWorktree) {
              // Story 8.2 AC 3: Reuse existing worktree
              worktreePath = await GitService.getWorktreePath(ctx.projectRoot, input.id)
              console.log(`Reusing existing worktree: ${worktreePath}`)

              // Story 8.3 AC 5: Retrieve branch name from existing worktree for display
              if (worktreePath) {
                const existingBranchName = await GitService.getBranchNameFromWorktree(worktreePath)
                if (existingBranchName) {
                  ctx.db
                    .update(tasks)
                    .set({
                      worktree_path: worktreePath,
                      branch_name: existingBranchName,
                      updated_at: new Date()
                    })
                    .where(eq(tasks.id, input.id))
                    .run()
                  console.log(`Retrieved branch name from existing worktree: ${existingBranchName}`)
                }
              }
            } else {
              // Story 8.2 AC 1, 2, 4, 6: Create new worktree (failure triggers rollback per AC 6)
              // Story 8.3: Pass task title for descriptive branch naming
              const worktreeResult = await GitService.createWorktree(ctx.projectRoot, input.id, result.title)
              worktreePath = worktreeResult.worktreePath
              console.log(`Created git worktree: ${worktreePath} with branch: ${worktreeResult.branchName}`)

              // Story 8.3 AC 5: Update task record with branch name
              ctx.db
                .update(tasks)
                .set({
                  worktree_path: worktreePath,
                  branch_name: worktreeResult.branchName,
                  updated_at: new Date()
                })
                .where(eq(tasks.id, input.id))
                .run()
            }
          } else {
            // Story 8.2 AC 5: Task already has worktree path in database
            // Story 8.3 AC 5: Retrieve branch name if missing
            if (!result.branch_name && worktreePath) {
              const existingBranchName = await GitService.getBranchNameFromWorktree(worktreePath)
              if (existingBranchName) {
                ctx.db
                  .update(tasks)
                  .set({
                    branch_name: existingBranchName,
                    updated_at: new Date()
                  })
                  .where(eq(tasks.id, input.id))
                  .run()
                console.log(`Retrieved missing branch name: ${existingBranchName}`)
              }
            }
          }

          // Create tmux session (reuses existing if present - AC: 2)
          const sessionName = await TaskTerminalService.createSession(input.id, projectName)
          console.log(`Created tmux session: ${sessionName}`)

          // Story TES-2.9: Trigger automation event logging (and future automation)
          // Only trigger if specifically moving to in_progress
          if (input.status === 'in_progress') {
            await AutomationService.onStatusInProgress(input.id, result.task_type)
          }
        } catch (error) {
          // Story 8.2 AC 6: On failure, rollback status change
          // Restore the previous status
          ctx.db
            .update(tasks)
            .set({ status: oldTask.status, updated_at: new Date() })
            .where(eq(tasks.id, input.id))
            .run()

          // AC: 3 - Log error and propagate meaningful message for frontend toast
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('Failed to start task:', errorMessage)

          // Story 8.10 AC2: Categorize git errors for recovery dialog
          if (error instanceof GitError) {
            const recoverableError = categorizeGitError(error)
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: recoverableError.message,
              cause: {
                ...error,
                recoverable: recoverableError // Attach categorized error for frontend
              }
            })
          }

          // Provide user-friendly error message based on error type
          let userMessage = 'Failed to start task'
          if (errorMessage.includes('tmux is not installed')) {
            userMessage = 'tmux is not installed. Please install tmux to use terminal sessions.'
          } else if (errorMessage.includes('Invalid taskId')) {
            userMessage = 'Invalid task ID format'
          } else if (errorMessage.includes('Git not found')) {
            userMessage = 'Git not found. Please install git.'
          } else if (errorMessage.includes('Not a git repository')) {
            userMessage = 'Project is not a git repository. Initialize git first.'
          } else if (errorMessage.includes('worktree')) {
            userMessage = `Failed to create git worktree: ${errorMessage}`
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: userMessage,
            cause: error
          })
        }
      }

      // Story 8.5: Merge worktree branch to main when task transitions from review → done
      // Story 8.7: Check for conflicts BEFORE merge attempt (AC 1, 4)
      if (input.status === 'done' && oldTask.status === 'review') {
        // Only merge if task has a worktree branch (Story 8.5 AC 1, 2)
        if (result.worktree_path && result.branch_name) {
          try {
            // Story 8.7 AC 1, 4: Check for conflicts BEFORE attempting merge
            const conflictCheck = await GitService.detectMergeConflicts(
              ctx.projectRoot,
              result.branch_name
            )

            if (conflictCheck.hasConflicts) {
              // Story 8.7 AC 2: Update task with conflict status
              ctx.db
                .update(tasks)
                .set({
                  has_merge_conflict: 1,
                  conflict_files: JSON.stringify(conflictCheck.conflictFiles),
                  updated_at: new Date()
                })
                .where(eq(tasks.id, input.id))
                .run()

              // Story 8.7: Rollback status change - cannot complete with conflicts
              ctx.db
                .update(tasks)
                .set({ status: oldTask.status, updated_at: new Date() })
                .where(eq(tasks.id, input.id))
                .run()

              const conflictList = conflictCheck.conflictFiles.join(', ') || 'unknown files'
              console.error(`[Story 8.7] Merge conflict detected in files: ${conflictList}`)

              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: `Cannot complete task: merge conflict in ${conflictList}. Resolve conflicts before completing.`
              })
            }

            // Story 8.7 AC 4: No conflicts detected, proceed with merge
            const mergeResult = await GitService.mergeWorktree(
              ctx.projectRoot,
              result.branch_name,
              input.id,
              result.title
            )

            if (mergeResult.success) {
              // Story 8.5 AC 2: Update task with merge_commit_sha
              // Story 8.7: Clear conflict status after successful merge
              ctx.db
                .update(tasks)
                .set({
                  merge_commit_sha: mergeResult.commitSha,
                  has_merge_conflict: 0,
                  conflict_files: null,
                  updated_at: new Date()
                })
                .where(eq(tasks.id, input.id))
                .run()

              // Update result to include merge_commit_sha for return value
              result.merge_commit_sha = mergeResult.commitSha

              console.log(
                `[Story 8.5] Merged branch ${result.branch_name} to main (${mergeResult.mergeType}): ${mergeResult.commitSha}`
              )

              // Story 8.6: Cleanup worktree and branch after successful merge
              // Story 8.6 Task 3.2: Check preserveWorktrees setting before cleanup
              const configService = new ConfigService(ctx.projectRoot)
              let preserveWorktrees = false
              try {
                const config = configService.loadConfig()
                preserveWorktrees = config.preserveWorktrees ?? false
              } catch {
                // If config can't be loaded, default to not preserving
                preserveWorktrees = false
              }

              if (!preserveWorktrees) {
                // Story 8.6 Task 3.1, 3.3: Cleanup worktree after merge success
                try {
                  const cleanupResult = await GitService.removeWorktree(
                    ctx.projectRoot,
                    result.worktree_path!,
                    result.branch_name!
                  )

                  if (cleanupResult.success) {
                    // Story 8.6 Task 3.3: Clear worktree_path in task record
                    ctx.db
                      .update(tasks)
                      .set({ worktree_path: null, updated_at: new Date() })
                      .where(eq(tasks.id, input.id))
                      .run()

                    // Update result to reflect cleared worktree_path
                    result.worktree_path = null

                    console.log(
                      `[Story 8.6] Worktree cleaned up successfully (worktree: ${cleanupResult.worktreeRemoved}, branch: ${cleanupResult.branchDeleted})`
                    )

                    // Story 8.6 Task 3.5: Log cleanup activity
                    try {
                      await activityLogService.logActivity(input.id, 'status_change', {
                        from: 'review',
                        to: 'done',
                        worktreeCleanup: {
                          success: true,
                          worktreeRemoved: cleanupResult.worktreeRemoved,
                          branchDeleted: cleanupResult.branchDeleted
                        }
                      })
                    } catch (logError) {
                      // Don't fail cleanup if activity logging fails
                      console.error('[Story 8.6] Failed to log cleanup activity:', logError)
                    }
                  } else {
                    // Story 8.6 Task 3.4: Log warning but don't rollback
                    console.warn(`[Story 8.6] Worktree cleanup warning: ${cleanupResult.error}`)
                  }
                } catch (cleanupError) {
                  // Story 8.6 AC 3: Best-effort cleanup - log warning but don't fail
                  const errorMessage =
                    cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
                  console.warn('[Story 8.6] Worktree cleanup failed:', errorMessage)
                }
              } else {
                console.log('[Story 8.6] Worktree preserved per settings')
              }

              // Story 8.5 Task 3.5: Log merge activity
              try {
                await activityLogService.logActivity(input.id, 'status_change', {
                  from: 'review',
                  to: 'done',
                  merge: {
                    success: true,
                    commitSha: mergeResult.commitSha,
                    mergeType: mergeResult.mergeType,
                    branchName: mergeResult.branchName
                  }
                })
              } catch (logError) {
                // Don't fail merge if activity logging fails
                console.error('[Story 8.5] Failed to log merge activity:', logError)
              }
            } else {
              // Story 8.5 AC 6, Task 3.4: Merge failed (conflicts) - rollback status change
              ctx.db
                .update(tasks)
                .set({ status: oldTask.status, updated_at: new Date() })
                .where(eq(tasks.id, input.id))
                .run()

              const conflictList = mergeResult.conflictFiles?.join(', ') || 'unknown files'
              console.error(`[Story 8.5] Merge conflict in files: ${conflictList}`)

              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: `Cannot complete task: merge conflict in ${conflictList}. Resolve conflicts in Story 8.7.`
              })
            }
          } catch (error) {
            // Story 8.5 Task 3.4: On merge error, rollback status change
            if (!(error instanceof TRPCError)) {
              ctx.db
                .update(tasks)
                .set({ status: oldTask.status, updated_at: new Date() })
                .where(eq(tasks.id, input.id))
                .run()

              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              console.error('[Story 8.5] Merge failed:', errorMessage)

              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to merge branch: ${errorMessage}`,
                cause: error
              })
            }
            // Re-throw TRPCError (conflict case)
            throw error
          }
        }
      }

      // Story 3.9: Sync status to story file if path exists (AC: 1)
      if (result.story_file_path) {
        try {
          const fileStatus = mapDbStatusToFileStatus(input.status)
          await StorySyncService.updateStoryFileStatus(result.story_file_path, fileStatus)
        } catch (error) {
          // Log but don't fail the status update if file sync fails
          console.error('Failed to sync status to file:', error)
        }
      }

      return result
    }),

  // Story 7.4: Reject task with feedback and return to in_progress
  // AC 2: Move task back to In Progress with feedback stored
  // AC 3: Store feedback in rejection_feedback column, linked to agent run
  rejectWithFeedback: publicProcedure
    .input(
      z.object({
        id: z.string(),
        feedback: z.string().nullable()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Capture current status before update
      const oldTask = ctx.db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .get()

      if (!oldTask) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Story 7.4 AC 3: Find the most recent agent run for this task
      const latestAgentRun = ctx.db
        .select({ id: agent_runs.id })
        .from(agent_runs)
        .where(eq(agent_runs.task_id, input.id))
        .orderBy(desc(agent_runs.start_time))
        .limit(1)
        .get()

      // Story 7.4 AC 2, 3: Update status to in_progress and store feedback linked to agent run
      const result = ctx.db
        .update(tasks)
        .set({
          status: 'in_progress',
          rejection_feedback: input.feedback,
          rejected_agent_run_id: latestAgentRun?.id || null,
          updated_at: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Story 7.4 Task 3.5: Log 'rejection' activity event
      try {
        await activityLogService.logActivity(input.id, 'rejection', {
          feedback: input.feedback,
          previousStatus: oldTask.status
        })
      } catch (error) {
        // Don't fail rejection if activity logging fails
        console.error('[Story 7.4] Failed to log rejection activity:', error)
      }

      // Also log the status_change event
      try {
        await activityLogService.logActivity(input.id, 'status_change', {
          from: oldTask.status,
          to: 'in_progress',
          reason: 'rejection'
        })
      } catch (error) {
        console.error('[Story 7.4] Failed to log status_change activity:', error)
      }

      return result
    }),

  // Story 7.5: Request changes with inline comments
  // AC 4: Collect inline comments as structured feedback
  // AC 4: Move task back to In Progress
  // AC 5: Store comments for agent to receive in context
  requestChanges: publicProcedure
    .input(
      z.object({
        id: z.string(),
        inlineComments: z.array(
          z.object({
            id: z.string(),
            filePath: z.string(),
            lineNumber: z.number(),
            content: z.string(),
            createdAt: z.number()
          })
        )
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Capture current status before update
      const oldTask = ctx.db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, input.id))
        .get()

      if (!oldTask) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Story 7.5 AC 4: Update status to in_progress and store inline comments as JSON
      const result = ctx.db
        .update(tasks)
        .set({
          status: 'in_progress',
          inline_comments: JSON.stringify(input.inlineComments),
          updated_at: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Story 7.5 Task 10.5: Log 'request_changes' activity event
      try {
        await activityLogService.logActivity(input.id, 'status_change', {
          from: oldTask.status,
          to: 'in_progress',
          reason: 'request_changes',
          commentCount: input.inlineComments.length
        })
      } catch (error) {
        console.error('[Story 7.5] Failed to log request_changes activity:', error)
      }

      // Return task with comment count for toast message
      return {
        ...result,
        commentCount: input.inlineComments.length
      }
    }),

  // Update task (including epic/sprint assignment) - Story 2.5
  // Story 3.1.5: Verify task belongs to current project
  // Story TES-2.5: Log status_change activity when status changes via update mutation
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1, 'Title is required').optional(),
        description: z.string().nullable().optional(),
        status: taskStatusSchema.optional(),
        epic_id: z.string().nullable().optional(),
        sprint_id: z.string().nullable().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input

      // TES-2.5: Capture old status if status is being changed
      let oldStatus: string | null = null
      if (input.status !== undefined) {
        const oldTask = ctx.db
          .select({ status: tasks.status })
          .from(tasks)
          .where(eq(tasks.id, id))
          .get()
        oldStatus = oldTask?.status ?? null
      }

      // Update with project ownership check
      const result = ctx.projectId
        ? ctx.db
            .update(tasks)
            .set({ ...updateData, updated_at: new Date() })
            .where(and(eq(tasks.id, id), eq(tasks.project_id, ctx.projectId)))
            .returning()
            .get()
        : ctx.db
            .update(tasks)
            .set({ ...updateData, updated_at: new Date() })
            .where(eq(tasks.id, id))
            .returning()
            .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // TES-2.5: Log status_change activity if status actually changed
      if (input.status !== undefined && oldStatus !== null && oldStatus !== input.status) {
        try {
          await activityLogService.logActivity(id, 'status_change', {
            from: oldStatus,
            to: input.status
          })
        } catch (error) {
          // Don't fail the update if activity logging fails
          console.error('[TES-2.5] Failed to log status_change activity in update mutation:', error)
        }
      }

      return result
    }),

  // Delete task
  // Story 3.1.5: Verify task belongs to current project
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // Delete with project ownership check
    const result = ctx.projectId
      ? ctx.db
          .delete(tasks)
          .where(and(eq(tasks.id, input.id), eq(tasks.project_id, ctx.projectId)))
          .returning()
          .get()
      : ctx.db.delete(tasks).where(eq(tasks.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }
    return result
  }),

  // Delete all tasks in current project
  deleteAll: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.projectId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No project open'
      })
    }

    const result = ctx.db
      .delete(tasks)
      .where(eq(tasks.project_id, ctx.projectId))
      .returning()
      .all()

    return { deletedCount: result.length }
  }),

  // Story 3.3: Update artifact path for a planning task
  updateArtifactPath: publicProcedure
    .input(
      z.object({
        id: z.string(),
        artifactPath: z.string()
      })
    )
    .mutation(({ ctx, input }) => {
      // Update artifact_path with project ownership check
      const result = ctx.projectId
        ? ctx.db
            .update(tasks)
            .set({
              artifact_path: input.artifactPath,
              updated_at: new Date()
            })
            .where(and(eq(tasks.id, input.id), eq(tasks.project_id, ctx.projectId)))
            .returning()
            .get()
        : ctx.db
            .update(tasks)
            .set({
              artifact_path: input.artifactPath,
              updated_at: new Date()
            })
            .where(eq(tasks.id, input.id))
            .returning()
            .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }
      return result
    }),

  // Story 3.7: Update full_content for a story task
  updateFullContent: publicProcedure
    .input(
      z.object({
        id: z.string(),
        fullContent: z.string()
      })
    )
    .mutation(({ ctx, input }) => {
      // Update full_content with project ownership check
      const result = ctx.projectId
        ? ctx.db
            .update(tasks)
            .set({
              full_content: input.fullContent,
              updated_at: new Date()
            })
            .where(and(eq(tasks.id, input.id), eq(tasks.project_id, ctx.projectId)))
            .returning()
            .get()
        : ctx.db
            .update(tasks)
            .set({
              full_content: input.fullContent,
              updated_at: new Date()
            })
            .where(eq(tasks.id, input.id))
            .returning()
            .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }
      return result
    }),

  // Reorder tasks within a column (batch update sort_order)
  // Story 3.1.5: Scope to current project
  reorder: publicProcedure
    .input(
      z.object({
        taskIds: z.array(z.string()),
        status: taskStatusSchema
      })
    )
    .mutation(({ ctx, input }) => {
      // AC12: Require project to be open for reorder
      if (!ctx.projectId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No project open'
        })
      }

      // Update sort_order for each task based on array position
      // Story 3.1.5: Verify task belongs to current project
      const now = new Date()
      for (let i = 0; i < input.taskIds.length; i++) {
        ctx.db
          .update(tasks)
          .set({ sort_order: i, updated_at: now })
          .where(
            and(
              eq(tasks.id, input.taskIds[i]),
              eq(tasks.status, input.status),
              eq(tasks.project_id, ctx.projectId)
            )
          )
          .run()
      }
      // Return count directly per tRPC pattern (no wrapper object)
      return input.taskIds.length
    })
})
