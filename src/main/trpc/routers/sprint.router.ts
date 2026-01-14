import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { sprints, epics, tasks, SPRINT_STATUS } from '../../db/schema'
import { eq, desc, and, ne, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// Sprint status enum for validation
const sprintStatusSchema = z.enum(SPRINT_STATUS)

export const sprintRouter = router({
  // List all sprints (ordered by status priority: active first, then planning, then completed)
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

  // Get active sprint (status = 'active')
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
        .where(and(eq(sprints.status, 'active'), eq(sprints.project_id, ctx.projectId)))
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
  // Architecture Addendum: Uses status field, supports goal
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Name is required'),
        start_date: z.date().optional(),
        end_date: z.date().optional(),
        status: sprintStatusSchema.default('planning'),
        goal: z.string().optional()
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
          status: input.status,
          goal: input.goal,
          project_id: ctx.projectId,
          created_at: now
        })
        .returning()
        .get()
    }),

  // Update sprint
  // Architecture Addendum: Includes goal, velocity, capacity; enforces completed sprint guard
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Name is required').optional(),
        start_date: z.date().nullable().optional(),
        end_date: z.date().nullable().optional(),
        goal: z.string().nullable().optional(),
        velocity: z.number().nullable().optional(),
        capacity: z.number().nullable().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input

      // Check if sprint is completed (read-only guard)
      const existingSprint = ctx.db.select().from(sprints).where(eq(sprints.id, id)).get()

      if (!existingSprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }

      if (existingSprint.status === 'completed') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot modify completed sprint'
        })
      }

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

  // Update sprint status
  // Architecture Addendum: Enforces single-active constraint
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: sprintStatusSchema
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

      // Check existing sprint
      const existingSprint = ctx.db
        .select()
        .from(sprints)
        .where(and(eq(sprints.id, input.id), eq(sprints.project_id, ctx.projectId)))
        .get()

      if (!existingSprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }

      // Cannot revert completed sprint (Architecture Addendum: Read-only guard)
      if (existingSprint.status === 'completed' && input.status !== 'completed') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot revert completed sprint status'
        })
      }

      // Enforce single-active constraint
      if (input.status === 'active') {
        const activeSprint = ctx.db
          .select()
          .from(sprints)
          .where(
            and(
              eq(sprints.project_id, ctx.projectId),
              eq(sprints.status, 'active'),
              ne(sprints.id, input.id)
            )
          )
          .get()

        if (activeSprint) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Sprint "${activeSprint.name}" is already active. Complete or deactivate it first.`
          })
        }
      }

      // Update status
      const result = ctx.db
        .update(sprints)
        .set({ status: input.status })
        .where(eq(sprints.id, input.id))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }
      return result
    }),

  // Set sprint as active (convenience method - sets status to 'active')
  // Maintains backwards compatibility with existing UI
  setActive: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // AC12: Throw error if no project open
    if (!ctx.projectId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No project open'
      })
    }

    // Enforce single-active constraint - deactivate any currently active sprint
    ctx.db
      .update(sprints)
      .set({ status: 'planning' })
      .where(and(eq(sprints.project_id, ctx.projectId), eq(sprints.status, 'active')))
      .run()

    // Activate the selected sprint
    const result = ctx.db
      .update(sprints)
      .set({ status: 'active' })
      .where(eq(sprints.id, input.id))
      .returning()
      .get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return result
  }),

  // Delete sprint with cascade
  // Architecture Addendum: Application-level cascade delete
  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    // Check if sprint exists and belongs to current project
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

    // Get all epic IDs for this sprint
    const sprintEpics = ctx.db
      .select({ id: epics.id })
      .from(epics)
      .where(eq(epics.sprint_id, input.id))
      .all()

    // Delete tasks for each epic
    for (const epic of sprintEpics) {
      ctx.db.delete(tasks).where(eq(tasks.epic_id, epic.id)).run()
    }

    // Delete epics
    ctx.db.delete(epics).where(eq(epics.sprint_id, input.id)).run()

    // Delete sprint
    const result = ctx.db.delete(sprints).where(eq(sprints.id, input.id)).returning().get()

    if (!result) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
    }
    return result
  }),

  // Link epic to sprint
  // Architecture Addendum: Epic linking
  linkEpicToSprint: publicProcedure
    .input(z.object({ epicId: z.string(), sprintId: z.string() }))
    .mutation(({ ctx, input }) => {
      // Verify sprint exists
      const sprint = ctx.db.select().from(sprints).where(eq(sprints.id, input.sprintId)).get()
      if (!sprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sprint not found' })
      }

      // Cannot link to completed sprint
      if (sprint.status === 'completed') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot add epics to completed sprint'
        })
      }

      // Update epic with sprint assignment
      const result = ctx.db
        .update(epics)
        .set({ sprint_id: input.sprintId })
        .where(eq(epics.id, input.epicId))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
      }
      return result
    }),

  // Unlink epic from sprint (set sprint_id to null)
  unlinkEpicFromSprint: publicProcedure
    .input(z.object({ epicId: z.string() }))
    .mutation(({ ctx, input }) => {
      const result = ctx.db
        .update(epics)
        .set({ sprint_id: null })
        .where(eq(epics.id, input.epicId))
        .returning()
        .get()

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Epic not found' })
      }
      return result
    }),

  // Get epics for a sprint
  getSprintEpics: publicProcedure
    .input(z.object({ sprintId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.select().from(epics).where(eq(epics.sprint_id, input.sprintId)).all()
    }),

  // Get orphaned epics (no sprint assigned)
  getOrphanedEpics: publicProcedure.query(({ ctx }) => {
    if (!ctx.projectId) {
      return []
    }
    return ctx.db
      .select()
      .from(epics)
      .where(and(eq(epics.project_id, ctx.projectId), isNull(epics.sprint_id)))
      .all()
  })
})
