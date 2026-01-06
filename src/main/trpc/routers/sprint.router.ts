import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { sprints } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const sprintRouter = router({
  // List all sprints (ordered by start_date descending)
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(sprints).orderBy(desc(sprints.start_date)).all()
  }),

  // Get active sprint
  getActive: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(sprints).where(eq(sprints.is_active, true)).get() ?? null
  }),

  // Get single sprint by ID
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const sprint = ctx.db.select().from(sprints).where(eq(sprints.id, input.id)).get()
    if (!sprint) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return sprint
  }),

  // Create new sprint
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required'),
        start_date: z.date().optional(),
        end_date: z.date().optional(),
        is_active: z.boolean().default(false)
      })
    )
    .mutation(({ ctx, input }) => {
      const id = randomUUID()
      const now = new Date()

      return ctx.db
        .insert(sprints)
        .values({
          id,
          name: input.name,
          start_date: input.start_date,
          end_date: input.end_date,
          is_active: input.is_active,
          created_at: now
        })
        .returning()
        .get()
    }),

  // Update sprint
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Name is required').optional(),
        start_date: z.date().nullable().optional(),
        end_date: z.date().nullable().optional(),
        is_active: z.boolean().optional()
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...updateData } = input

      const result = ctx.db
        .update(sprints)
        .set(updateData)
        .where(eq(sprints.id, id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }
      return result
    }),

  // Set sprint as active (deactivates all others)
  setActive: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // Deactivate all sprints first
    ctx.db.update(sprints).set({ is_active: false }).run()

    // Activate the selected sprint
    const result = ctx.db
      .update(sprints)
      .set({ is_active: true })
      .where(eq(sprints.id, input.id))
      .returning()
      .get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return result
  }),

  // Delete sprint
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const result = ctx.db.delete(sprints).where(eq(sprints.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return result
  })
})
