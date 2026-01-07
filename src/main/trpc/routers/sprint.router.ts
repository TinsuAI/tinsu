import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { sprints } from '../../db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const sprintRouter = router({
  // List all sprints (ordered by start_date descending)
  // Story 3.1.5: Filter by current project
  getAll: publicProcedure.query(({ ctx }) => {
    // AC12: Return empty array if no project open
    if (!ctx.projectId) {
      return []
    }
    return ctx.db
      .select()
      .from(sprints)
      .where(eq(sprints.project_id, ctx.projectId))
      .orderBy(desc(sprints.start_date))
      .all()
  }),

  // Get active sprint
  // Story 3.1.5: Filter by current project
  getActive: publicProcedure.query(({ ctx }) => {
    // AC12: Return null if no project open
    if (!ctx.projectId) {
      return null
    }
    return (
      ctx.db
        .select()
        .from(sprints)
        .where(and(eq(sprints.is_active, true), eq(sprints.project_id, ctx.projectId)))
        .get() ?? null
    )
  }),

  // Get single sprint by ID
  // Story 3.1.5: Verify sprint belongs to current project (single query optimization)
  getById: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    // Use single query with project filter for efficiency and security
    const sprint = ctx.projectId
      ? ctx.db
          .select()
          .from(sprints)
          .where(and(eq(sprints.id, input.id), eq(sprints.project_id, ctx.projectId)))
          .get()
      : ctx.db.select().from(sprints).where(eq(sprints.id, input.id)).get()

    if (!sprint) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return sprint
  }),

  // Create new sprint
  // Story 3.1.5: Set project_id from context
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
        .insert(sprints)
        .values({
          id,
          name: input.name,
          start_date: input.start_date,
          end_date: input.end_date,
          is_active: input.is_active,
          project_id: ctx.projectId, // AC9: Set project_id from context
          created_at: now
        })
        .returning()
        .get()
    }),

  // Update sprint
  // Story 3.1.5: Verify sprint belongs to current project
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

      // Update with project ownership check
      const result = ctx.projectId
        ? ctx.db
            .update(sprints)
            .set(updateData)
            .where(and(eq(sprints.id, id), eq(sprints.project_id, ctx.projectId)))
            .returning()
            .get()
        : ctx.db.update(sprints).set(updateData).where(eq(sprints.id, id)).returning().get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }
      return result
    }),

  // Set sprint as active (deactivates all others in the same project)
  // Story 3.1.5: Scope to current project
  setActive: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // AC12: Throw error if no project open
    if (!ctx.projectId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No project open'
      })
    }

    // Deactivate all sprints in current project first
    ctx.db
      .update(sprints)
      .set({ is_active: false })
      .where(eq(sprints.project_id, ctx.projectId))
      .run()

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
  // Story 3.1.5: Verify sprint belongs to current project
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // Delete with project ownership check
    const result = ctx.projectId
      ? ctx.db
          .delete(sprints)
          .where(and(eq(sprints.id, input.id), eq(sprints.project_id, ctx.projectId)))
          .returning()
          .get()
      : ctx.db.delete(sprints).where(eq(sprints.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return result
  })
})
