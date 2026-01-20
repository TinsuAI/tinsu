/**
 * Activity Log Service - TES-2.2
 *
 * Full implementation with database persistence for activity events.
 * Provides methods for logging and querying task activity events.
 *
 * @see TES-2.2: Activity Log Service Core
 * @see Architecture: AR3 - ActivityLogService
 */

import { nanoid } from 'nanoid'
import { eq, desc, inArray, gt, and } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { TRPCError } from '@trpc/server'
import {
  taskActivities,
  tasks,
  type TaskActivity,
  type NewTaskActivity,
  type ActivityEventType as SchemaActivityEventType
} from '../db/schema'
import { activityEmitter } from './activity-emitter'

/**
 * Re-export ActivityEventType from schema for convenience.
 */
export type ActivityEventType = SchemaActivityEventType

/**
 * Session ended event payload.
 */
export interface SessionEndedPayload {
  /** Why the session ended */
  reason: 'process_exit' | 'session_killed' | 'detected_stale'
  /** tmux session name */
  sessionName: string
}

/**
 * Stall detected event payload.
 */
export interface StallDetectedPayload {
  /** When the last output was received (timestamp) */
  lastOutputTime: number
  /** How long the stall threshold is in milliseconds */
  stallDurationMs: number
}

/**
 * Stall recovered event payload.
 */
export interface StallRecoveredPayload {
  /** How long the session was stalled (ms) */
  stalledDurationMs: number
}

/**
 * Error event payload for logging errors from agents, hooks, or services.
 *
 * Used for capturing error details when:
 * - Agent execution fails (via Stop hook)
 * - Hook delivery fails (ActivityLogService throws)
 * - tmux session creation fails
 *
 * @see TES-2.10: Error Event Capture
 */
export interface ErrorEventPayload {
  /** Human-readable error message (required) */
  message: string
  /** Error code if available (e.g., 'ECONNREFUSED', 'ENOENT', 'HOOK_FAILED') */
  code?: string
  /** Stack trace if available (truncated for storage) */
  stack?: string
  /** Source of the error for debugging */
  source?: 'agent' | 'hook_delivery' | 'tmux_creation' | 'session_lookup'
}

/**
 * Union type for all activity payloads.
 */
export type ActivityPayload =
  | SessionEndedPayload
  | StallDetectedPayload
  | StallRecoveredPayload
  | ErrorEventPayload
  | Record<string, unknown>

/**
 * Options for querying activities.
 */
export interface ActivityQueryOptions {
  /** Filter by specific event types */
  eventTypes?: ActivityEventType[]
  /** Maximum number of results (default: 100) */
  limit?: number
  /** Offset for pagination (default: 0) */
  offset?: number
  /** Filter activities created after this timestamp (Unix ms) */
  since?: number
}

/**
 * Activity Log Service
 *
 * Provides methods for logging and querying activity events.
 * All events are persisted to the task_activities table.
 *
 * @see TES-2.2: Activity Log Service Core
 */
export class ActivityLogService {
  /** Database instance for persistence */
  private db: BetterSQLite3Database

  /**
   * Create a new ActivityLogService instance.
   *
   * @param db - Drizzle database instance
   */
  constructor(db: BetterSQLite3Database) {
    this.db = db
  }

  /**
   * Log an activity event for a task.
   *
   * Persists the event to the task_activities table with a unique ID
   * and accurate timestamp. Also logs to console for debugging visibility.
   *
   * @param taskId - The task ID the event relates to
   * @param eventType - Type of activity event
   * @param payload - Event-specific data (optional)
   * @returns The created TaskActivity record
   *
   * @example
   * ```typescript
   * const activity = await activityLogService.logActivity('task-123', 'session_ended', {
   *   reason: 'process_exit',
   *   sessionName: 'tinsu-project-task-123'
   * })
   * console.log('Created activity:', activity.id)
   * ```
   */
  async logActivity(
    taskId: string,
    eventType: ActivityEventType,
    payload?: ActivityPayload
  ): Promise<TaskActivity> {
    // Validate task exists before insert (M1 fix: graceful error handling)
    const taskExists = this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get()

    if (!taskExists) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Task not found: ${taskId}`
      })
    }

    // Generate unique ID and timestamp
    const newActivity: NewTaskActivity = {
      id: nanoid(),
      task_id: taskId,
      event_type: eventType,
      payload: payload ? JSON.stringify(payload) : null,
      created_at: Date.now()
    }

    // Insert into database
    const [created] = this.db
      .insert(taskActivities)
      .values(newActivity)
      .returning()
      .all()

    // TES-2.13: Emit event for real-time streaming to renderer
    activityEmitter.emitActivity(created)

    return created
  }

  /**
   * Query activities for a task with optional filtering.
   *
   * Returns activities sorted by created_at descending (newest first).
   * Supports filtering by event types, pagination, and time range.
   *
   * @param taskId - The task ID to query activities for
   * @param options - Query options for filtering and pagination
   * @returns Array of TaskActivity records
   *
   * @example
   * ```typescript
   * // Get last 10 error events
   * const errors = await activityLogService.getActivities('task-123', {
   *   eventTypes: ['error'],
   *   limit: 10
   * })
   *
   * // Get activities since a timestamp
   * const recent = await activityLogService.getActivities('task-123', {
   *   since: Date.now() - 60000 // Last minute
   * })
   * ```
   */
  async getActivities(
    taskId: string,
    options?: ActivityQueryOptions
  ): Promise<TaskActivity[]> {
    // Build conditions array
    const conditions = [eq(taskActivities.task_id, taskId)]

    // Add eventTypes filter if provided
    if (options?.eventTypes?.length) {
      conditions.push(inArray(taskActivities.event_type, options.eventTypes))
    }

    // Add since filter if provided
    if (options?.since !== undefined) {
      conditions.push(gt(taskActivities.created_at, options.since))
    }

    // Build and execute query
    const results = this.db
      .select()
      .from(taskActivities)
      .where(and(...conditions))
      .orderBy(desc(taskActivities.created_at))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0)
      .all()

    return results
  }
}

// ===== Static Compatibility Layer =====
// For backward compatibility with TES-1.11 code that uses static methods.
// This will be removed when TaskTerminalService and StallDetectorService are updated.

/** Singleton instance for static method compatibility - lazily initialized */
let _instance: ActivityLogService | null = null

/**
 * Set the singleton instance.
 * Called from services/index.ts after db is initialized.
 */
export function setActivityLogServiceInstance(instance: ActivityLogService): void {
  _instance = instance
}

/**
 * Get the singleton instance.
 * @throws Error if instance not set via setActivityLogServiceInstance()
 */
function getInstance(): ActivityLogService {
  if (!_instance) {
    throw new Error(
      'ActivityLogService not initialized. Ensure setActivityLogServiceInstance() is called from services/index.ts before using static methods.'
    )
  }
  return _instance
}

/**
 * Static compatibility namespace.
 * @deprecated Use instance methods via activityLogService export instead.
 */
export namespace ActivityLogService {
  /**
   * Log an activity event (static compatibility).
   * @deprecated Use instance method via activityLogService export.
   */
  export async function logActivity(
    taskId: string,
    eventType: ActivityEventType,
    payload?: ActivityPayload
  ): Promise<TaskActivity> {
    return getInstance().logActivity(taskId, eventType, payload)
  }
}
