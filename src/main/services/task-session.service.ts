import { db } from '../db'
import { task_sessions, sessionHistory } from '../db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

/**
 * Service for managing session-task mappings.
 *
 * Maps Claude Code session IDs to task IDs for hook event routing.
 * Uses in-memory cache for O(1) lookups on hot path.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * CACHE INVALIDATION NOTE:
 * The database uses ON DELETE CASCADE for task_sessions when a task is deleted.
 * However, this only affects the database - the in-memory cache is NOT automatically
 * cleared. When deleting a task, callers MUST call clearSession(taskId) to
 * invalidate the cache entry. The cache has a max size limit to prevent unbounded
 * growth from orphaned entries.
 *
 * @see TES-1.7: Session-Task Mapping & Event Routing
 */
export class TaskSessionService {
  /**
   * In-memory cache: sessionId -> taskId
   * Hot path for hook events - must be fast (<1ms target)
   */
  private static sessionToTaskCache: Map<string, string> = new Map()

  /**
   * Maximum cache size to prevent unbounded memory growth.
   * When exceeded, oldest entries are evicted (FIFO).
   */
  private static readonly MAX_CACHE_SIZE = 1000

  /**
   * Updates the Claude Code session_id for a task.
   * Called when the first hook fires and session_id becomes known.
   *
   * AC#3: Given Claude Code session starts, when the session_id becomes known
   * (from hook payload), then the task_sessions record is updated with the session_id.
   *
   * @param taskId - The task's unique identifier
   * @param sessionId - The Claude Code session ID from hook payload
   *
   * @example
   * ```typescript
   * // Called when first hook fires
   * await TaskSessionService.updateSessionId('task-123', 'claude-session-abc')
   * ```
   */
  static async updateSessionId(taskId: string, sessionId: string, workflowType?: string): Promise<void> {
    // Update database - set current active session
    await db
      .update(task_sessions)
      .set({ session_id: sessionId })
      .where(eq(task_sessions.task_id, taskId))

    // Also save to session history for traceability
    await db.insert(sessionHistory).values({
      id: uuid(),
      task_id: taskId,
      session_id: sessionId,
      workflow_type: workflowType ?? null,
      started_at: new Date()
    })

    console.log('[TaskSessionService] Session registered and saved to history:', {
      taskId,
      sessionId,
      workflowType
    })

    // Evict oldest entry if cache is full (FIFO eviction)
    if (this.sessionToTaskCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.sessionToTaskCache.keys().next().value
      if (oldestKey) {
        this.sessionToTaskCache.delete(oldestKey)
      }
    }

    // Update cache for fast lookups
    this.sessionToTaskCache.set(sessionId, taskId)
  }

  /**
   * Gets the taskId for a given Claude Code session_id.
   * Uses cache-first lookup for performance (hot path).
   *
   * AC#1: Looks up the task_id from task_sessions table.
   *
   * @param sessionId - The Claude Code session ID
   * @returns The task ID if found, null if not found (orphan event)
   *
   * @example
   * ```typescript
   * const taskId = await TaskSessionService.getTaskBySessionId('claude-session-abc')
   * if (taskId) {
   *   // Route event to task
   * }
   * ```
   */
  static async getTaskBySessionId(sessionId: string): Promise<string | null> {
    // Check cache first (hot path - O(1))
    const cached = this.sessionToTaskCache.get(sessionId)
    if (cached) return cached

    // Fall back to database - check current active session first
    const record = db.select().from(task_sessions).where(eq(task_sessions.session_id, sessionId)).get()

    if (record) {
      // Update cache for future lookups
      this.sessionToTaskCache.set(sessionId, record.task_id)
      return record.task_id
    }

    // Also check session history for historical sessions
    // This allows hook events from previous workflows to still be routed correctly
    const historyRecord = db.select().from(sessionHistory).where(eq(sessionHistory.session_id, sessionId)).get()

    if (historyRecord) {
      // Update cache for future lookups
      this.sessionToTaskCache.set(sessionId, historyRecord.task_id)
      return historyRecord.task_id
    }

    return null
  }

  /**
   * Routes a hook event to the correct task.
   * Returns taskId if found, null if orphan event.
   *
   * AC#1: Routes the event to the correct task's activity log.
   * AC#2: If session_id is not found, logs as "orphan event" for debugging.
   *
   * Does NOT throw on orphan events - logs warning instead.
   *
   * @param sessionId - The Claude Code session ID from hook payload
   * @param eventType - The hook event type (Stop, PostToolUse, etc.)
   * @param payload - The full hook payload for debugging
   * @returns The task ID if found, null if orphan event
   *
   * @example
   * ```typescript
   * const taskId = await TaskSessionService.routeHookEvent(
   *   'claude-session-abc',
   *   'PostToolUse',
   *   { session_id: '...', tool: 'Read' }
   * )
   * if (taskId) {
   *   await activityLogService.logEvent(taskId, eventType, payload)
   * }
   * ```
   */
  static async routeHookEvent(
    sessionId: string,
    eventType: string,
    payload: unknown
  ): Promise<string | null> {
    const taskId = await this.getTaskBySessionId(sessionId)

    if (!taskId) {
      // AC#2: Orphan event - log for debugging but don't throw
      console.warn('[TaskSessionService] Orphan hook event received:', {
        sessionId,
        eventType,
        payload
      })
      return null
    }

    return taskId
  }

  /**
   * Clears session mapping when task completes or is deleted.
   *
   * @param taskId - The task's unique identifier
   *
   * @example
   * ```typescript
   * // When task is completed or deleted
   * TaskSessionService.clearSession('task-123')
   * ```
   */
  static clearSession(taskId: string): void {
    // Find and remove from cache by value (taskId)
    for (const [sessionId, tid] of this.sessionToTaskCache) {
      if (tid === taskId) {
        this.sessionToTaskCache.delete(sessionId)
        break
      }
    }
  }

  /**
   * Marks the current session as ended in session history.
   * Called when clearing context before starting a new workflow.
   *
   * @param taskId - The task's unique identifier
   */
  static async endCurrentSession(taskId: string): Promise<void> {
    // Get the current session_id from task_sessions
    const currentSession = db
      .select()
      .from(task_sessions)
      .where(eq(task_sessions.task_id, taskId))
      .get()

    if (currentSession?.session_id) {
      // Mark this session as ended in history
      await db
        .update(sessionHistory)
        .set({ ended_at: new Date() })
        .where(eq(sessionHistory.session_id, currentSession.session_id))

      console.log('[TaskSessionService] Marked session as ended:', {
        taskId,
        sessionId: currentSession.session_id
      })
    }

    // Clear from cache
    this.clearSession(taskId)
  }

  /**
   * Marks a session as ended in session history by session_id.
   * Called when the Stop hook fires (agent completes).
   *
   * @param sessionId - The Claude Code session ID
   */
  static async markSessionEnded(sessionId: string): Promise<void> {
    await db
      .update(sessionHistory)
      .set({ ended_at: new Date() })
      .where(eq(sessionHistory.session_id, sessionId))

    console.log('[TaskSessionService] Marked session as ended:', { sessionId })
  }

  /**
   * Clears all cached mappings.
   * Used for testing to ensure test isolation.
   */
  static clearCache(): void {
    this.sessionToTaskCache.clear()
  }

  /**
   * Gets the current cache size.
   * Useful for testing and debugging.
   */
  static getCacheSize(): number {
    return this.sessionToTaskCache.size
  }
}
