import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { epics, EPIC_COLORS } from '../../db/schema'
import { eq, asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Zod schema for epic color validation
const epicColorSchema = z.enum(EPIC_COLORS)

export const epicRouter = router({
  // List all epics
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(epics).orderBy(asc(epics.title)).all()
  }),

  // Get single epic by ID
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const epic = ctx.db.select().from(epics).where(eq(epics.id, input.id)).get()
    if (!epic) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
    }
    return epic
  }),

  // Create new epic
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        color: epicColorSchema.default('blue')
      })
    )
    .mutation(({ ctx, input }) => {
      const id = randomUUID()
      const now = new Date()

      return ctx.db
        .insert(epics)
        .values({
          id,
          title: input.title,
          description: input.description,
          color: input.color,
          created_at: now
        })
        .returning()
        .get()
    }),

  // Update epic
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1, 'Title is required').optional(),
        description: z.string().optional(),
        color: epicColorSchema.optional()
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...updateData } = input

      const result = ctx.db
        .update(epics)
        .set(updateData)
        .where(eq(epics.id, id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
      }
      return result
    }),

  // Delete epic
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    const result = ctx.db.delete(epics).where(eq(epics.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
    }
    return result
  })
})
