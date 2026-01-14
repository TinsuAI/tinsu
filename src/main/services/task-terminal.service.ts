import { exec } from 'child_process'
import { promisify } from 'util'
import { v4 as uuid } from 'uuid'
import { db } from '../db'
import { task_sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { TmuxService } from './tmux.service'

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
export class TaskTerminalService {
  /**
   * In-memory cache for session name lookups to avoid repeated DB queries.
   * Maps taskId -> tmux session name
   */
  private static sessionCache: Map<string, string> = new Map()

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
      await this.createTmuxSession(existingSession)
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
    const existing = await db.query.task_sessions.findFirst({
      where: eq(task_sessions.task_id, taskId)
    })

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
}
