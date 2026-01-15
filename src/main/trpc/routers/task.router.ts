import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, epics, sprints, TASK_STATUS } from '../../db/schema'
import { eq, asc, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { StorySyncService } from '../../services/story-sync.service'
import { TaskTerminalService } from '../../services/task-terminal.service'
import { ConfigService } from '../../services/config.service'
import { activityLogService } from '../../services'

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
    return ctx.db
      .select()
      .from(tasks)
      .where(eq(tasks.project_id, ctx.projectId))
      .orderBy(asc(tasks.sort_order))
      .all()
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
    return task
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

    return allTasks.map((task) => ({
      ...task,
      epic: task.epic_id ? epicMap.get(task.epic_id) ?? null : null
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

          // Create tmux session (reuses existing if present - AC: 2)
          const sessionName = await TaskTerminalService.createSession(input.id, projectName)
          console.log(`Created tmux session: ${sessionName}`)
        } catch (error) {
          // AC: 3 - Log error and propagate meaningful message for frontend toast
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('Failed to create terminal session:', errorMessage)

          // Provide user-friendly error message based on error type
          let userMessage = 'Failed to create terminal session'
          if (errorMessage.includes('tmux is not installed')) {
            userMessage = 'tmux is not installed. Please install tmux to use terminal sessions.'
          } else if (errorMessage.includes('Invalid taskId')) {
            userMessage = 'Invalid task ID format'
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: userMessage,
            cause: error
          })
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
