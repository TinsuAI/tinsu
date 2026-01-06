import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, epics, sprints, TASK_STATUS } from '../../db/schema'
import { eq, asc, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Zod schema for task status validation
const taskStatusSchema = z.enum(TASK_STATUS)

export const taskRouter = router({
  // List all tasks (ordered by sort_order within each status)
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(tasks).orderBy(asc(tasks.sort_order)).all()
  }),

  // Story 3.2: Get planning tasks ordered by phase_number
  // Returns tasks where task_type = 'planning', including the is_start_here field
  getPlanningTasks: publicProcedure.query(({ ctx }) => {
    return ctx.db
      .select()
      .from(tasks)
      .where(eq(tasks.task_type, 'planning'))
      .orderBy(asc(tasks.phase_number))
      .all()
  }),

  // Get single task by ID
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()
    if (!task) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }
    return task
  }),

  // Get task with epic and sprint relations (Story 2.5)
  getWithRelations: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()
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
  getAllWithEpics: publicProcedure.query(({ ctx }) => {
    const allTasks = ctx.db.select().from(tasks).orderBy(asc(tasks.sort_order)).all()
    const allEpics = ctx.db.select().from(epics).all()

    // Create a map for quick epic lookup
    const epicMap = new Map(allEpics.map((e) => [e.id, e]))

    return allTasks.map((task) => ({
      ...task,
      epic: task.epic_id ? epicMap.get(task.epic_id) ?? null : null
    }))
  }),

  // Create new task (inserts at top of column with sort_order = 0)
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
      const id = randomUUID()
      const now = new Date()

      // Shift existing tasks in this column down (increment sort_order)
      // This ensures new task appears at top with sort_order = 0
      ctx.db
        .update(tasks)
        .set({ sort_order: sql`${tasks.sort_order} + 1` })
        .where(eq(tasks.status, input.status))
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
          created_at: now,
          updated_at: now
        })
        .returning()
        .get()
    }),

  // Update task status
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: taskStatusSchema
      })
    )
    .mutation(({ ctx, input }) => {
      const result = ctx.db
        .update(tasks)
        .set({ status: input.status, updated_at: new Date() })
        .where(eq(tasks.id, input.id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }
      return result
    }),

  // Update task (including epic/sprint assignment) - Story 2.5
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
    .mutation(({ ctx, input }) => {
      const { id, ...updateData } = input

      const result = ctx.db
        .update(tasks)
        .set({ ...updateData, updated_at: new Date() })
        .where(eq(tasks.id, id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }
      return result
    }),

  // Delete task
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const result = ctx.db.delete(tasks).where(eq(tasks.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }
    return result
  }),

  // Reorder tasks within a column (batch update sort_order)
  reorder: publicProcedure
    .input(
      z.object({
        taskIds: z.array(z.string()),
        status: taskStatusSchema
      })
    )
    .mutation(({ ctx, input }) => {
      // Update sort_order for each task based on array position
      const now = new Date()
      for (let i = 0; i < input.taskIds.length; i++) {
        ctx.db
          .update(tasks)
          .set({ sort_order: i, updated_at: now })
          .where(and(eq(tasks.id, input.taskIds[i]), eq(tasks.status, input.status)))
          .run()
      }
      // Return count directly per tRPC pattern (no wrapper object)
      return input.taskIds.length
    })
})
