/**
 * Stall Detector Service
 *
 * Monitors terminal sessions for stalled (unresponsive) state.
 * A session is considered stalled if no output is received for a configured
 * threshold duration (default: 5 minutes).
 *
 * When stall is detected, emits session:stalled event.
 * When output is received after stall, emits session:recovered event.
 *
 * @see TES-1.11: Session End & Unresponsive Detection (AC: #3)
 */

import { sessionEventEmitter } from '../lib/session-events'
import { ActivityLogService } from './activity-log.service'

/** Default stall threshold in milliseconds (5 minutes) */
const DEFAULT_STALL_THRESHOLD_MS = 5 * 60 * 1000

/** Check interval for stall detection (30 seconds) */
const STALL_CHECK_INTERVAL_MS = 30 * 1000

interface SessionTrackingInfo {
  /** Task ID for this session */
  taskId: string
  /** Timestamp of last output received */
  lastOutputTime: number
  /** Whether session is currently in stalled state */
  isStalled: boolean
}

/**
 * Stall Detector Service
 *
 * Tracks terminal output timing and detects unresponsive sessions.
 */
export class StallDetectorService {
  /**
   * Active session tracking information.
   * Maps taskId -> tracking info
   */
  private static sessions: Map<string, SessionTrackingInfo> = new Map()

  /**
   * Interval timer for periodic stall checks.
   */
  private static checkInterval: NodeJS.Timeout | null = null

  /**
   * Configurable stall threshold in milliseconds.
   */
  private static stallThresholdMs: number = DEFAULT_STALL_THRESHOLD_MS

  /**
   * Start tracking a session for stall detection.
   *
   * Call this when a terminal session becomes active.
   * The session will be monitored for output activity.
   *
   * @param taskId - The task ID to start tracking
   */
  static startTracking(taskId: string): void {
    if (this.sessions.has(taskId)) {
      return // Already tracking
    }

    console.log(`[StallDetectorService] Started tracking task ${taskId}`)

    this.sessions.set(taskId, {
      taskId,
      lastOutputTime: Date.now(),
      isStalled: false
    })

    // Start check interval if not already running
    this.ensureCheckInterval()
  }

  /**
   * Stop tracking a session.
   *
   * Call this when a terminal session ends or is detached.
   *
   * @param taskId - The task ID to stop tracking
   */
  static stopTracking(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (!session) {
      return
    }

    console.log(`[StallDetectorService] Stopped tracking task ${taskId}`)
    this.sessions.delete(taskId)

    // Stop check interval if no more sessions
    if (this.sessions.size === 0) {
      this.stopCheckInterval()
    }
  }

  /**
   * Record output received for a session.
   *
   * Call this whenever output is received from the terminal.
   * Resets the stall timer and emits recovery event if was stalled.
   *
   * @param taskId - The task ID that received output
   */
  static recordOutput(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (!session) {
      return // Not tracking this session
    }

    const now = Date.now()
    const wasStalled = session.isStalled
    const previousLastOutputTime = session.lastOutputTime // Capture BEFORE update

    // Update last output time
    session.lastOutputTime = now

    // Check if recovering from stall
    if (wasStalled) {
      // Calculate actual stall duration: time since last output before this one
      const stalledDurationMs = now - previousLastOutputTime

      console.log(`[StallDetectorService] Session recovered for task ${taskId}`)
      session.isStalled = false

      // Log activity
      ActivityLogService.logActivity(taskId, 'stall_recovered', {
        stalledDurationMs
      })

      // Emit recovery event
      sessionEventEmitter.emitSessionRecovered({
        taskId
      })
    }
  }

  /**
   * Check if a session is currently stalled.
   *
   * @param taskId - The task ID to check
   * @returns true if session is in stalled state
   */
  static isStalled(taskId: string): boolean {
    return this.sessions.get(taskId)?.isStalled ?? false
  }

  /**
   * Get the stall threshold in milliseconds.
   */
  static getStallThreshold(): number {
    return this.stallThresholdMs
  }

  /**
   * Set the stall threshold in milliseconds.
   *
   * @param thresholdMs - New threshold in milliseconds
   */
  static setStallThreshold(thresholdMs: number): void {
    this.stallThresholdMs = thresholdMs
  }

  /**
   * Clear all tracking (for testing/cleanup).
   */
  static clearAll(): void {
    this.sessions.clear()
    this.stopCheckInterval()
  }

  /**
   * Ensure the check interval is running.
   */
  private static ensureCheckInterval(): void {
    if (this.checkInterval) {
      return // Already running
    }

    this.checkInterval = setInterval(() => {
      this.checkForStalls()
    }, STALL_CHECK_INTERVAL_MS)

    console.log('[StallDetectorService] Started stall check interval')
  }

  /**
   * Stop the check interval.
   */
  private static stopCheckInterval(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('[StallDetectorService] Stopped stall check interval')
    }
  }

  /**
   * Check all tracked sessions for stalls.
   */
  private static checkForStalls(): void {
    const now = Date.now()

    for (const session of this.sessions.values()) {
      // Skip if already stalled
      if (session.isStalled) {
        continue
      }

      const timeSinceOutput = now - session.lastOutputTime

      if (timeSinceOutput >= this.stallThresholdMs) {
        console.log(
          `[StallDetectorService] Stall detected for task ${session.taskId} ` +
          `(no output for ${Math.round(timeSinceOutput / 1000)}s)`
        )

        session.isStalled = true

        // Log activity
        ActivityLogService.logActivity(session.taskId, 'stall_detected', {
          lastOutputTime: session.lastOutputTime,
          stallDurationMs: this.stallThresholdMs
        })

        // Emit stall event
        sessionEventEmitter.emitSessionStalled({
          taskId: session.taskId,
          lastOutputTime: session.lastOutputTime,
          stallDurationMs: this.stallThresholdMs
        })
      }
    }
  }
}
