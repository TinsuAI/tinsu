import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, TASK_STATUS } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Zod schema for task status validation
const taskStatusSchema = z.enum(TASK_STATUS)

export const taskRouter = router({
  // List all tasks
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(tasks).all()
  }),

  // Get single task by ID
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()
    if (!task) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }
    return task
  }),

  // Create new task
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
      return ctx.db
        .insert(tasks)
        .values({
          id,
          title: input.title,
          description: input.description,
          status: input.status,
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

  // Delete task
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const result = ctx.db.delete(tasks).where(eq(tasks.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
    }
    return result
  })
})
