/**
 * Activity Log Service - Stub for TES-1.11
 *
 * This is a minimal implementation for logging session lifecycle events.
 * The full implementation with database persistence, streaming, and filtering
 * will be completed in TES Epic 2 (Activity Log & Event Tracking).
 *
 * For now, this logs to console and provides the interface that
 * TaskTerminalService and StallDetectorService will use.
 *
 * @see TES-1.11: Session End & Unresponsive Detection (Task 2)
 * @see TES-2.2: Activity Log Service Core (full implementation)
 */

/**
 * Activity event types supported by the system.
 *
 * TES-1.11 adds session lifecycle events:
 * - session_ended: Terminal session process exited
 * - stall_detected: No output received for threshold duration
 * - stall_recovered: Output received after stall state
 */
export type ActivityEventType =
  | 'status_change'
  | 'agent_start'
  | 'agent_complete'
  | 'tool_used'
  | 'user_command'
  | 'automation_trigger'
  | 'error'
  // TES-1.11 session lifecycle events
  | 'session_ended'
  | 'stall_detected'
  | 'stall_recovered'

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
 * Union type for all activity payloads.
 */
export type ActivityPayload =
  | SessionEndedPayload
  | StallDetectedPayload
  | StallRecoveredPayload
  | Record<string, unknown>

/**
 * Activity Log Service
 *
 * Provides methods for logging activity events. Currently logs to console.
 * Will be extended in TES-2 to persist to database and stream to UI.
 */
export class ActivityLogService {
  /**
   * Log an activity event for a task.
   *
   * @param taskId - The task ID the event relates to
   * @param eventType - Type of activity event
   * @param payload - Event-specific data
   *
   * @example
   * ```typescript
   * await ActivityLogService.logActivity('task-123', 'session_ended', {
   *   reason: 'process_exit',
   *   sessionName: 'tinsu-project-task-123'
   * })
   * ```
   */
  static async logActivity(
    taskId: string,
    eventType: ActivityEventType,
    payload: ActivityPayload
  ): Promise<void> {
    // TES-1.11: Log to console for now, will persist to DB in TES-2
    const timestamp = new Date().toISOString()
    console.log(`[ActivityLog] ${timestamp} | ${taskId} | ${eventType}:`, payload)

    // TODO (TES-2.2): Persist to task_activities table
    // TODO (TES-2.13): Emit event for real-time streaming
  }
}
