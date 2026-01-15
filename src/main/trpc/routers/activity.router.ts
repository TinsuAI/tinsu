/**
 * Activity Router - TES-2.2
 *
 * tRPC router for activity log operations.
 * Provides procedures for logging and querying task activities.
 *
 * @see TES-2.2: Activity Log Service Core
 * @see Architecture: activity.router.ts
 */

import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { ACTIVITY_EVENT_TYPE } from '../../db/schema'

/**
 * Activity router procedures.
 *
 * - listActivities: Query activities for a task with optional filtering
 * - logActivity: Create a new activity event for a task
 */
export const activityRouter = router({
  /**
   * List activities for a task with optional filtering.
   *
   * Returns activities sorted by created_at descending (newest first).
   * Supports filtering by event types, pagination (limit/offset), and time range (since).
   *
   * @example
   * ```typescript
   * // Get last 10 activities
   * const activities = await trpc.activity.listActivities.query({
   *   taskId: 'task-123',
   *   limit: 10
   * })
   *
   * // Get error events only
   * const errors = await trpc.activity.listActivities.query({
   *   taskId: 'task-123',
   *   eventTypes: ['error']
   * })
   * ```
   */
  listActivities: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        eventTypes: z.array(z.enum(ACTIVITY_EVENT_TYPE)).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
        offset: z.number().int().min(0).default(0),
        since: z.number().int().optional()
      })
    )
    .query(({ input, ctx }) => {
      return ctx.activityLogService.getActivities(input.taskId, {
        eventTypes: input.eventTypes,
        limit: input.limit,
        offset: input.offset,
        since: input.since
      })
    }),

  /**
   * Log a new activity event for a task.
   *
   * Creates a new activity record with unique ID and timestamp.
   * Returns the created activity record.
   *
   * @example
   * ```typescript
   * const activity = await trpc.activity.logActivity.mutate({
   *   taskId: 'task-123',
   *   eventType: 'user_command',
   *   payload: { command: 'npm run test' }
   * })
   * ```
   */
  logActivity: publicProcedure
    .input(
      z.object({
        taskId: z.string().min(1, 'taskId is required'),
        eventType: z.enum(ACTIVITY_EVENT_TYPE),
        payload: z.record(z.unknown()).optional()
      })
    )
    .mutation(({ input, ctx }) => {
      return ctx.activityLogService.logActivity(
        input.taskId,
        input.eventType,
        input.payload
      )
    })
})
