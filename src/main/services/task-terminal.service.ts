import { exec } from 'child_process'
import { promisify } from 'util'
import { v4 as uuid } from 'uuid'
import { db } from '../db'
import { task_sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { TmuxService } from './tmux.service'
import { sessionEventEmitter } from '../lib/session-events'
import { ActivityLogService } from './activity-log.service'

const execAsync = promisify(exec)

/** Timeout for tmux commands in milliseconds (matching TmuxService pattern) */
const TMUX_COMMAND_TIMEOUT = 5000

/**
 * Regex to validate safe shell argument (alphanumeric, dash, underscore only)
 * Used to prevent command injection attacks
 */
const SAFE_SHELL_ARG_REGEX = /^[a-zA-Z0-9_-]+$/

/**
 * Error type returned by promisified exec
 */
interface ExecError extends Error {
  stderr?: string
}

/**
 * Service for managing per-task tmux sessions.
 *
 * Each task gets an isolated tmux session for command execution.
 * Sessions are named with the pattern: tinsu-{projectName}-{taskId}
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * @see TES-1.3: tmux Session Creation Service
 */
/** Polling interval for session exit detection (ms) */
const SESSION_MONITOR_INTERVAL = 2000

export class TaskTerminalService {
  /**
   * In-memory cache for session name lookups to avoid repeated DB queries.
   * Maps taskId -> tmux session name
   */
  private static sessionCache: Map<string, string> = new Map()

  /**
   * TES-1.11: Session monitors for detecting session exit.
   * Maps taskId -> interval timer ID
   */
  private static sessionMonitors: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Creates a new tmux session for a task.
   * Returns existing session name if one already exists (AC#2).
   *
   * @param taskId - The task's unique identifier
   * @param projectName - Project name for session naming
   * @returns The tmux session name (e.g., "tinsu-myapp-task123")
   * @throws Error if tmux command fails (AC#3)
   *
   * @example
   * ```typescript
   * try {
   *   const sessionName = await TaskTerminalService.createSession(taskId, 'myproject')
   *   console.log(`Created session: ${sessionName}`)
   * } catch (error) {
   *   console.error('Failed to create terminal session:', error)
   * }
   * ```
   */
  static async createSession(taskId: string, projectName: string): Promise<string> {
    // Security: Validate taskId to prevent command injection
    if (!SAFE_SHELL_ARG_REGEX.test(taskId)) {
      throw new Error(`Invalid taskId format: must contain only alphanumeric, dash, or underscore characters`)
    }

    // Check tmux is available before attempting session creation
    const tmuxInstalled = await TmuxService.checkTmuxInstalled()
    if (!tmuxInstalled) {
      throw new Error('tmux is not installed. Please install tmux to use terminal sessions.')
    }

    // AC#2: Check for existing session first (database + tmux)
    const existingSession = await this.getSessionName(taskId)
    if (existingSession) {
      // Verify tmux session actually exists
      const tmuxExists = await this.tmuxSessionExists(existingSession)
      if (tmuxExists) {
        return existingSession
      }
      // Session record exists but tmux session is gone - recreate tmux session
      // This happens after system reboot when old session is marked as 'ended' (TES-1.10)
      await this.createTmuxSession(existingSession)

      // TES-1.10: Reset session state since we're starting fresh
      // Clear session_id and current_phase to indicate new active session
      await db.update(task_sessions)
        .set({
          session_id: null,
          current_phase: null  // Reset from 'ended' to active (null = active)
        })
        .where(eq(task_sessions.task_id, taskId))

      return existingSession
    }

    // Generate session name using convention: tinsu-{projectName}-{taskId}
    // Sanitize project name: lowercase, replace spaces with dashes, remove special chars
    const sanitizedProject = projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    const sessionName = `tinsu-${sanitizedProject}-${taskId}`

    // AC#1: Create tmux session
    await this.createTmuxSession(sessionName)

    // AC#1: Create database record
    // Handle race condition: if another request inserted first, query and return existing
    try {
      await db.insert(task_sessions).values({
        id: uuid(),
        task_id: taskId,
        tmux_session: sessionName,
        session_id: null, // Set later when Claude Code session starts
        current_phase: null, // Set when workflow begins
        created_at: new Date()
      })
    } catch (error) {
      // Check if it's a unique constraint violation (race condition)
      const errMsg = (error as Error).message || ''
      if (errMsg.includes('UNIQUE constraint failed') || errMsg.includes('duplicate key')) {
        // Another request won the race - return the existing session
        const existing = await this.getSessionName(taskId)
        if (existing) {
          return existing
        }
      }
      throw error
    }

    // Update cache
    this.sessionCache.set(taskId, sessionName)

    return sessionName
  }

  /**
   * Checks if a tmux session exists for the given task.
   *
   * @param taskId - The task's unique identifier
   * @returns true if session exists, false otherwise
   */
  static async hasSession(taskId: string): Promise<boolean> {
    const sessionName = await this.getSessionName(taskId)
    if (!sessionName) {
      return false
    }
    return this.tmuxSessionExists(sessionName)
  }

  /**
   * Kills the tmux session for a task and removes the database record.
   *
   * @param taskId - The task's unique identifier
   */
  static async killSession(taskId: string): Promise<void> {
    const sessionName = await this.getSessionName(taskId)
    if (!sessionName) {
      return // No session to kill
    }

    // TES-1.11: Stop monitoring before killing session
    this.stopSessionMonitor(taskId)

    // Clear cache first to prevent stale reads during cleanup
    this.sessionCache.delete(taskId)

    // Kill tmux session (ignore errors if session doesn't exist)
    try {
      await execAsync(`tmux kill-session -t ${sessionName}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      })
    } catch {
      // Session might already be gone - that's fine
    }

    // Delete database record (cache already cleared, so safe even if this fails)
    await db.delete(task_sessions).where(eq(task_sessions.task_id, taskId))
  }

  /**
   * Gets the tmux session name for a task from the database.
   * Uses in-memory cache for performance.
   *
   * @param taskId - The task's unique identifier
   * @returns The session name or null if not found
   */
  static async getSessionName(taskId: string): Promise<string | null> {
    // Check cache first
    const cached = this.sessionCache.get(taskId)
    if (cached) {
      return cached
    }

    // Query database
    const existing = db.select().from(task_sessions).where(eq(task_sessions.task_id, taskId)).get()

    if (existing) {
      // Update cache
      this.sessionCache.set(taskId, existing.tmux_session)
      return existing.tmux_session
    }

    return null
  }

  /**
   * Clears the session cache.
   * Useful for testing or when session data changes externally.
   */
  static clearCache(): void {
    this.sessionCache.clear()
  }

  /**
   * Validates all task sessions on app startup.
   * Detects and handles stale sessions (DB record exists but tmux gone after reboot).
   *
   * Call this AFTER db connection established, BEFORE handling tRPC requests.
   *
   * For each task_sessions record:
   * - Check if tmux session actually exists via `tmux has-session -t {name}`
   * - If tmux session missing, mark record as historical (current_phase='ended')
   * - Clear session_id since Claude Code session is also gone after reboot
   * - Clear session cache to prevent stale reads
   *
   * @see TES-1.10: Scrollback Survival After System Reboot
   */
  static async validateSessionsOnStartup(): Promise<void> {
    try {
      const sessions = db.select().from(task_sessions).all()
      console.log(`[TaskTerminalService] Validating ${sessions.length} session(s) on startup...`)

      // Filter to only active sessions (skip already ended ones)
      const activeSessions = sessions.filter(s => s.current_phase !== 'ended')

      if (activeSessions.length === 0) {
        console.log(`[TaskTerminalService] Startup validation complete: 0 valid, 0 stale (marked as ended)`)
        return
      }

      // TES-1.10 Performance: Parallelize tmux session checks
      // With 50+ sessions, sequential checks could exceed <5s NFR target
      const validationResults = await Promise.allSettled(
        activeSessions.map(async (session) => {
          const tmuxExists = await this.tmuxSessionExists(session.tmux_session)
          return { session, tmuxExists }
        })
      )

      let staleCount = 0
      let validCount = 0

      // Process results and update stale sessions
      for (const result of validationResults) {
        if (result.status === 'rejected') {
          // Treat check failures as stale (conservative approach)
          continue
        }

        const { session, tmuxExists } = result.value

        if (!tmuxExists) {
          // Stale session detected - tmux gone after reboot
          console.log(
            `[TaskTerminalService] Stale session detected for task ${session.task_id}, ` +
            `tmux session ${session.tmux_session} no longer exists`
          )

          // Clear session state but keep record for history tracking
          await db.update(task_sessions)
            .set({
              session_id: null,
              current_phase: 'ended'  // Mark as historical
            })
            .where(eq(task_sessions.task_id, session.task_id))

          // Clear cache for this task
          this.sessionCache.delete(session.task_id)

          staleCount++
        } else {
          validCount++
        }
      }

      console.log(
        `[TaskTerminalService] Startup validation complete: ` +
        `${validCount} valid, ${staleCount} stale (marked as ended)`
      )
    } catch (error) {
      console.warn('[TaskTerminalService] Startup validation error:', error)
      // Don't throw - startup should continue even if validation fails
    }
  }

  /**
   * Gets the tmux attach command for a task's terminal session.
   *
   * Used to attach xterm.js to an existing tmux session via node-pty.
   * Returns the full command string that can be executed in a PTY.
   *
   * @param taskId - The task's unique identifier
   * @returns The attach command string, or null if no session exists
   *
   * @example
   * ```typescript
   * const cmd = await TaskTerminalService.getAttachCommand('task-123')
   * if (cmd) {
   *   // cmd = "tmux attach-session -t tinsu-myproject-task-123"
   *   ptyService.spawn('bash', ['-c', cmd])
   * }
   * ```
   *
   * @see TES-1.4: xterm.js Terminal Attachment
   */
  static async getAttachCommand(taskId: string): Promise<string | null> {
    const sessionName = await this.getSessionName(taskId)
    if (!sessionName) {
      return null
    }

    // Verify tmux session actually exists
    const exists = await this.tmuxSessionExists(sessionName)
    if (!exists) {
      return null
    }

    return `tmux attach-session -t ${sessionName}`
  }

  /**
   * Sends a command to a task's tmux session.
   *
   * Uses tmux send-keys to inject a command into the session.
   * The command is automatically followed by Enter to execute it.
   *
   * @param taskId - The task's unique identifier
   * @param command - The command to send (will have Enter appended)
   * @throws Error if session doesn't exist or send-keys fails
   *
   * @example
   * ```typescript
   * await TaskTerminalService.sendCommand('task-123', 'npm run test')
   * // Executes "npm run test" in the task's tmux session
   * ```
   *
   * @see TES-1.4: xterm.js Terminal Attachment
   */
  static async sendCommand(taskId: string, command: string): Promise<void> {
    const sessionName = await this.getSessionName(taskId)
    if (!sessionName) {
      throw new Error(`No terminal session for task ${taskId}`)
    }

    // Verify tmux session exists
    const exists = await this.tmuxSessionExists(sessionName)
    if (!exists) {
      throw new Error(`tmux session ${sessionName} no longer exists`)
    }

    // Use tmux send-keys with Enter to execute the command
    // JSON.stringify handles escaping special characters in the command
    await execAsync(
      `tmux send-keys -t ${sessionName} ${JSON.stringify(command)} Enter`,
      { timeout: TMUX_COMMAND_TIMEOUT }
    )
  }

  /**
   * Creates a new tmux detached session.
   *
   * @param sessionName - The name for the tmux session
   * @throws Error if tmux command fails
   */
  private static async createTmuxSession(sessionName: string): Promise<void> {
    try {
      await execAsync(`tmux new-session -d -s ${sessionName}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      })
    } catch (error) {
      const execError = error as ExecError
      // Check if session already exists (duplicate name conflict)
      if (execError.stderr?.includes('duplicate session')) {
        // Session already exists - this is fine
        return
      }
      throw error
    }
  }

  /**
   * Checks if a tmux session with the given name exists.
   *
   * @param sessionName - The tmux session name to check
   * @returns true if session exists, false otherwise
   */
  private static async tmuxSessionExists(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      })
      return true // Exit code 0 = session exists
    } catch {
      return false // Exit code 1 = session doesn't exist
    }
  }

  // ===== TES-1.11: Session Exit Detection =====

  /**
   * Start monitoring a task's tmux session for exit.
   *
   * Uses periodic polling with `tmux has-session` to detect when the session ends.
   * When exit is detected:
   * 1. Updates task_sessions.current_phase to 'ended'
   * 2. Clears session cache
   * 3. Emits session:ended event for UI updates
   *
   * @param taskId - The task ID to monitor
   *
   * @see TES-1.11: Session End & Unresponsive Detection (AC: #1, #2)
   */
  static async startSessionMonitor(taskId: string): Promise<void> {
    // Avoid duplicate monitors
    if (this.sessionMonitors.has(taskId)) {
      return
    }

    const sessionName = await this.getSessionName(taskId)
    if (!sessionName) {
      console.warn(`[TaskTerminalService] Cannot monitor task ${taskId}: no session record`)
      return
    }

    // Verify session actually exists before starting monitor
    const exists = await this.tmuxSessionExists(sessionName)
    if (!exists) {
      console.warn(`[TaskTerminalService] Cannot monitor task ${taskId}: tmux session ${sessionName} doesn't exist`)
      return
    }

    console.log(`[TaskTerminalService] Starting session monitor for task ${taskId}`)

    // Poll every 2 seconds to detect session exit
    const interval = setInterval(async () => {
      try {
        const sessionExists = await this.tmuxSessionExists(sessionName)
        if (!sessionExists) {
          // Session ended - clean up and notify
          console.log(`[TaskTerminalService] Session ended for task ${taskId} (session: ${sessionName})`)
          this.stopSessionMonitor(taskId)
          await this.handleSessionEnded(taskId, sessionName, 'process_exit')
        }
      } catch (error) {
        // Log but don't stop monitor - transient errors are possible
        console.warn(`[TaskTerminalService] Monitor check failed for task ${taskId}:`, error)
      }
    }, SESSION_MONITOR_INTERVAL)

    this.sessionMonitors.set(taskId, interval)
  }

  /**
   * Stop monitoring a task's session.
   *
   * Called when:
   * - Session exit is detected (by monitor itself)
   * - Session is explicitly killed via killSession()
   * - App is shutting down
   *
   * @param taskId - The task ID to stop monitoring
   */
  static stopSessionMonitor(taskId: string): void {
    const interval = this.sessionMonitors.get(taskId)
    if (interval) {
      clearInterval(interval)
      this.sessionMonitors.delete(taskId)
      console.log(`[TaskTerminalService] Stopped session monitor for task ${taskId}`)
    }
  }

  /**
   * Stop all session monitors.
   *
   * Called during app shutdown to clean up resources.
   */
  static stopAllSessionMonitors(): void {
    for (const [taskId, interval] of this.sessionMonitors) {
      clearInterval(interval)
      console.log(`[TaskTerminalService] Stopped session monitor for task ${taskId} (shutdown)`)
    }
    this.sessionMonitors.clear()
  }

  /**
   * Check if a session monitor is running for a task.
   *
   * @param taskId - The task ID to check
   * @returns true if monitor is active
   */
  static isMonitoring(taskId: string): boolean {
    return this.sessionMonitors.has(taskId)
  }

  /**
   * Handle session ended event.
   *
   * Updates database, clears cache, logs activity, and emits event for UI notification.
   *
   * @param taskId - The task ID whose session ended
   * @param sessionName - The tmux session name
   * @param reason - Why the session ended
   *
   * @see TES-1.11 Task 2: Session end activity logging
   */
  private static async handleSessionEnded(
    taskId: string,
    sessionName: string,
    reason: 'process_exit' | 'session_killed' | 'detected_stale'
  ): Promise<void> {
    // Update database to mark session as ended
    await db.update(task_sessions)
      .set({ current_phase: 'ended' })
      .where(eq(task_sessions.task_id, taskId))

    // Clear cache
    this.sessionCache.delete(taskId)

    // TES-1.11 Task 2: Log activity event for session end
    await ActivityLogService.logActivity(taskId, 'session_ended', {
      reason,
      sessionName
    })

    // Emit event for UI subscription
    sessionEventEmitter.emitSessionEnded({
      taskId,
      sessionName,
      reason
    })
  }
}
