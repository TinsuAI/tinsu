import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { epics, EPIC_COLORS } from '../../db/schema'
import { eq, asc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Zod schema for epic color validation
const epicColorSchema = z.enum(EPIC_COLORS)

export const epicRouter = router({
  // List all epics
  // Story 3.1.5: Filter by current project
  getAll: publicProcedure.query(({ ctx }) => {
    // AC12: Return empty array if no project open
    if (!ctx.projectId) {
      return []
    }
    return ctx.db
      .select()
      .from(epics)
      .where(eq(epics.project_id, ctx.projectId))
      .orderBy(asc(epics.title))
      .all()
  }),

  // Get single epic by ID
  // Story 3.1.5: Verify epic belongs to current project (single query optimization)
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    // Use single query with project filter for efficiency and security
    const epic = ctx.projectId
      ? ctx.db
          .select()
          .from(epics)
          .where(and(eq(epics.id, input.id), eq(epics.project_id, ctx.projectId)))
          .get()
      : ctx.db.select().from(epics).where(eq(epics.id, input.id)).get()

    if (!epic) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
    }
    return epic
  }),

  // Create new epic
  // Story 3.1.5: Set project_id from context
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Title is required'),
        description: z.string().optional(),
        color: epicColorSchema.default('blue')
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

      return ctx.db
        .insert(epics)
        .values({
          id,
          title: input.title,
          description: input.description,
          color: input.color,
          project_id: ctx.projectId, // AC9: Set project_id from context
          created_at: now
        })
        .returning()
        .get()
    }),

  // Update epic
  // Story 3.1.5: Verify epic belongs to current project
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

      // Update with project ownership check
      const result = ctx.projectId
        ? ctx.db
            .update(epics)
            .set(updateData)
            .where(and(eq(epics.id, id), eq(epics.project_id, ctx.projectId)))
            .returning()
            .get()
        : ctx.db.update(epics).set(updateData).where(eq(epics.id, id)).returning().get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
      }
      return result
    }),

  // Delete epic
  // Story 3.1.5: Verify epic belongs to current project
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // Delete with project ownership check
    const result = ctx.projectId
      ? ctx.db
          .delete(epics)
          .where(and(eq(epics.id, input.id), eq(epics.project_id, ctx.projectId)))
          .returning()
          .get()
      : ctx.db.delete(epics).where(eq(epics.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
    }
    return result
  })
})
