/**
 * Chat CLI Service - Story 10.3, 10.6, CTM-1.1, CTM-1.3, CTM-2.1, CTM-2.2
 *
 * Manages Claude Code CLI processes for chat sessions via tmux.
 * Uses a two-layer model: tmux session (persistence) + PTY (I/O).
 *
 * Architecture (CTM-1.1):
 *   tmux session (persistence layer) --- tinsu-{projectName}-{sessionId}
 *     |-- PTY attached via ptyService.spawn(tmux attach ...) (I/O layer)
 *          |-- claude --session-id {uuid} (agent process)
 *
 * Key design decisions:
 * - tmux sessions survive app restarts for persistent conversations.
 * - PTY is the I/O channel: messages written via ptyService.write() (byte-level stdin),
 *   NOT via tmux send-keys (which has escaping issues with multi-line/special chars).
 * - Uses --settings CLI flag to inject chat-specific hooks.
 * - Chat sessions pass --dangerously-skip-permissions when skip_permissions=true (Auto mode).
 * - When skip_permissions=false, the PreToolUse hook handles manual approval via the UI.
 * - Idle sessions (>2 hours) are auto-killed to free resources.
 *
 * CTM-1.3: Startup validation and three-case session recovery:
 *   - validateSessionsOnStartup(): Detects alive/dead tmux sessions on app start
 *   - reattachSession(): Re-attaches PTY to alive tmux (Case B)
 *   - isTmuxAlive(): Public check for tmux session existence
 *
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 * @see Story 10.6: Session Persistence & Resume (AC: 5)
 * @see CTM-1.1: tmux Session Creation & PTY Attachment
 * @see CTM-1.3: Session Recovery & Startup Validation
 */

import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { ptyService } from './pty.service'
import { TmuxService } from './tmux.service'
import { db } from '../db'
import { chat_sessions, chat_messages } from '../db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import crypto from 'crypto'
import type { PtyExitEvent, PtyOutputEvent } from './pty.service'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

/** Timeout for tmux commands in milliseconds */
const TMUX_COMMAND_TIMEOUT = 5000

/**
 * Regex to validate safe shell arguments (alphanumeric, dash, underscore only).
 * Used to prevent command injection attacks in tmux session names.
 */
export const SAFE_SHELL_ARG_REGEX = /^[a-zA-Z0-9_-]+$/

/** Status of a chat CLI process */
export type ChatCliSessionStatus = 'running' | 'exited'

/** In-memory tracking info for a chat CLI process */
export interface ChatCliSessionInfo {
  /** PTY process ID from ptyService */
  processId: string
  /** Claude Code session UUID (--session-id value) */
  sessionUuid: string
  /** Current process status */
  status: ChatCliSessionStatus
}

/** Idle timeout threshold: 2 hours in milliseconds (CTM-1.1 AC: 5) */
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000

/**
 * Service for managing Claude Code CLI processes for chat sessions.
 *
 * Uses tmux sessions for persistence with PTY attachment for I/O.
 * Maintains in-memory caches for O(1) lookups:
 * - sessions: sessionId -> ChatCliSessionInfo (PTY process tracking)
 * - sessionCache: chatSessionId -> tmuxSessionName (forward lookup)
 * - sessionToChatCache: tmuxSessionName -> chatSessionId (reverse lookup for hooks)
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class ChatCliService {
  /** Map from TinSu sessionId (chat_sessions.id) to CLI process info */
  private sessions: Map<string, ChatCliSessionInfo> = new Map()

  /** Map from sessionId to last activity timestamp (Date.now()) (Story 10.6) */
  private lastActivityMap: Map<string, number> = new Map()

  /**
   * Tracks whether a session is busy (Claude is generating a response).
   * Set true when a user message is sent, cleared when a chat-stop hook fires.
   * Prevents writing to PTY stdin while the TUI is in output mode,
   * which would lose the message or cancel Claude's current generation.
   */
  private busySessions: Set<string> = new Set()

  /** Path to the chat-specific hooks directory */
  private chatHooksDir: string

  /** CTM-2.2: Interval handle for health monitoring (2-second polling) */
  private monitorInterval: ReturnType<typeof setInterval> | null = null

  /** CTM-2.2: Registered listeners for session status change events */
  private statusListeners: Set<(sessionId: string, status: string) => void> = new Set()

  /** Callback invoked when a session is killed due to idle timeout (Story 10.6) */
  private onIdleCallback: ((sessionId: string) => void) | null = null

  /** Reverse map: PTY processId -> sessionId (for output/exit log correlation) */
  private processToSessionMap: Map<string, string> = new Map()

  /** CTM-1.1: Forward cache: chatSessionId -> tmuxSessionName */
  private sessionCache: Map<string, string> = new Map()

  /** CTM-1.1: Reverse cache: tmuxSessionName -> chatSessionId (for hook routing in Story 1.2) */
  private sessionToChatCache: Map<string, string> = new Map()

  /** Buffer for capturing slash command overlay output per PTY process */
  private slashCmdBuffer: Map<string, { chunks: string[]; timer: ReturnType<typeof setTimeout> | null }> = new Map()

  constructor(chatHooksDir: string) {
    this.chatHooksDir = chatHooksDir

    // Listen for PTY exit events to update session map
    ptyService.on('exit', (event: PtyExitEvent) => {
      this.handlePtyExit(event)
    })

    // Listen for PTY output to detect and capture slash command overlay responses.
    // Claude Code renders slash command results in a TUI overlay with "Esc to close".
    // We capture the output, auto-dismiss with Escape, and store as a chat message.
    ptyService.on('output', (event: PtyOutputEvent) => {
      this.handleSlashCommandOutput(event)
    })

    // CTM-2.2: Start health monitoring (replaces standalone idle check interval)
    this.startMonitoring()
  }

  /**
   * Start health monitoring: 2-second interval that polls `tmux has-session`
   * for every cached session and runs idle timeout checks.
   *
   * CTM-2.2 AC 1: Polls every 2 seconds for all cached sessions.
   * CTM-2.2 AC 2: Detects dead tmux sessions within one polling interval (<2s, NFR32).
   * CTM-2.2 AC 3, 4: Runs idle timeout checks (2-hour threshold) in same cycle.
   *
   * Idempotent: if monitorInterval is already set, clears it before creating a new one.
   *
   * @see CTM-2.2 Task 1, Task 3, Task 4
   */
  startMonitoring(): void {
    // Task 4.3: Idempotent -- clear existing interval if present
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }

    this.monitorInterval = setInterval(async () => {
      // Task 1.4: Snapshot sessionCache entries to guard against concurrent iteration
      const entries = Array.from(this.sessionCache.entries())

      for (const [sessionId, tmuxName] of entries) {
        const alive = await this.tmuxSessionExists(tmuxName)
        if (!alive) {
          // Remove from in-memory caches
          this.sessionCache.delete(sessionId)
          this.sessionToChatCache.delete(tmuxName)

          // Update DB: mark session as paused
          try {
            db.update(chat_sessions)
              .set({ status: 'paused', updated_at: new Date() })
              .where(eq(chat_sessions.id, sessionId))
              .run()
          } catch (dbError) {
            console.warn(`[ChatCliService] Health monitor: DB update failed for session ${sessionId}:`, dbError)
          }

          // Emit status change event for UI (Task 2.4)
          this.emitSessionStatus(sessionId, 'exited')

          console.log(`[ChatCliService] Health monitor: session ${sessionId} tmux exited, marked paused`)
        }
      }

      // Task 3.2: Run idle check at the END of each polling cycle
      // Idle timeout resets on each sendMessage() call (user message), not on agent output.
      this.checkIdleSessions()
    }, 2000)
  }

  /**
   * Register a listener for session status change events.
   *
   * Returns an unsubscribe function to remove the listener.
   *
   * @param listener - Callback invoked with (sessionId, status) on status changes
   * @returns Unsubscribe function
   *
   * @see CTM-2.2 Task 2.2
   */
  onSessionStatus(listener: (sessionId: string, status: string) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /**
   * Emit a session status change event to all registered listeners.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @param status - The new status (e.g., 'exited', 'idle-timeout')
   *
   * @see CTM-2.2 Task 2.3
   */
  private emitSessionStatus(sessionId: string, status: string): void {
    for (const listener of this.statusListeners) {
      listener(sessionId, status)
    }
  }

  /**
   * Get the reverse lookup cache (tmuxSessionName -> chatSessionId).
   * Used by HookListenerService in Story 1.2 for routing hooks by tmux session name.
   */
  getSessionToChatCache(): Map<string, string> {
    return this.sessionToChatCache
  }

  /**
   * Check if a tmux session with the given name exists.
   *
   * Runs `tmux has-session -t {sessionName}` with TMUX_COMMAND_TIMEOUT.
   * Returns true on exit code 0, false otherwise.
   * Same pattern as TaskTerminalService.tmuxSessionExists().
   *
   * @param sessionName - The tmux session name to check
   * @returns true if session exists, false otherwise
   *
   * @see CTM-1.3 Task 1.1
   */
  private async tmuxSessionExists(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      })
      return true // Exit code 0 = session exists
    } catch {
      return false // Exit code 1 = session doesn't exist
    }
  }

  /**
   * Check if Claude Code is actively running inside a tmux session's pane.
   * Uses `tmux list-panes` to inspect the current command of the active pane.
   * Returns false if the pane is running a bare shell (bash/zsh), meaning Claude has exited.
   */
  private async isClaudeRunningInTmux(sessionName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `tmux list-panes -t ${sessionName} -F '#{pane_current_command}'`,
        { timeout: TMUX_COMMAND_TIMEOUT }
      )
      const cmd = stdout.trim().toLowerCase()
      // Claude Code runs as a node process; a bare shell means Claude exited
      return cmd !== 'bash' && cmd !== 'zsh' && cmd !== 'sh' && cmd !== 'fish'
    } catch {
      return false
    }
  }

  /**
   * Validate chat sessions on startup.
   *
   * Queries all active chat sessions with a tmux_session value, checks which
   * tmux sessions are still alive, rebuilds caches for alive ones, and marks
   * dead ones as 'paused' in the database.
   *
   * Parallelizes tmux checks with Promise.allSettled() to meet NFR29 (<5s for 20 sessions).
   * Failures are treated conservatively as dead sessions.
   *
   * @see CTM-1.3 AC 1: Startup validation
   * @see CTM-1.3 Task 1
   */
  async validateSessionsOnStartup(): Promise<void> {
    try {
      // Query all active sessions with tmux_session set
      const activeSessions = db
        .select()
        .from(chat_sessions)
        .where(and(eq(chat_sessions.status, 'active'), isNotNull(chat_sessions.tmux_session)))
        .all()

      if (activeSessions.length === 0) {
        console.log('[ChatCliService] Startup validation: 0 active sessions')
        return
      }

      // Parallelize tmux checks (NFR29: <5s for 20 sessions)
      const results = await Promise.allSettled(
        activeSessions.map(async (session) => ({
          session,
          alive: await this.tmuxSessionExists(session.tmux_session!)
        }))
      )

      let aliveCount = 0
      let pausedCount = 0

      for (const result of results) {
        if (result.status === 'rejected') {
          // Conservative: treat failures as dead
          pausedCount++
          continue
        }
        const { session, alive } = result.value
        if (alive) {
          // Populate caches for alive sessions (lazy PTY reattach in Case B)
          this.sessionCache.set(session.id, session.tmux_session!)
          this.sessionToChatCache.set(session.tmux_session!, session.id)
          aliveCount++
        } else {
          // Mark dead sessions as paused in DB
          db.update(chat_sessions)
            .set({ status: 'paused', updated_at: new Date() })
            .where(eq(chat_sessions.id, session.id))
            .run()
          pausedCount++
        }
      }

      console.log(
        `[ChatCliService] Startup validation complete: ${aliveCount} alive, ${pausedCount} paused`
      )
    } catch (error) {
      console.warn('[ChatCliService] Startup validation error:', error)
      // Don't throw -- startup should continue
    }
  }

  /**
   * Re-attach a PTY to an existing alive tmux session (Case B).
   *
   * Used when the app restarted and the tmux session is still alive but the PTY
   * is detached. Creates a new PTY attached to the tmux session and updates
   * in-memory tracking maps.
   *
   * CRITICAL: Does NOT call writeWhenReady() or add to busySessions.
   * The TUI is already initialized in the tmux session. The subsequent
   * sendMessage() call writes directly via ptyService.write().
   *
   * @param sessionId - TinSu's internal chat session ID (chat_sessions.id)
   * @param sessionUuid - Claude Code session UUID (chat_sessions.session_uuid)
   * @param projectPath - Working directory for the PTY spawn
   * @returns The new PTY processId
   * @throws Error if session not in cache or tmux session is dead
   *
   * @see CTM-1.3 AC 2: PTY re-attachment
   * @see CTM-1.3 Task 2
   */
  async reattachSession(
    sessionId: string,
    sessionUuid: string,
    projectPath: string
  ): Promise<string> {
    // Look up tmux session name from cache
    const tmuxSessionName = this.sessionCache.get(sessionId)
    if (!tmuxSessionName) {
      throw new Error(`No cached tmux session for chat session: ${sessionId}`)
    }

    // Verify tmux session is still alive before attempting PTY attach
    const alive = await this.tmuxSessionExists(tmuxSessionName)
    if (!alive) {
      throw new Error(`tmux session ${tmuxSessionName} is no longer alive`)
    }

    // Attach PTY to the existing tmux session
    const processId = ptyService.spawn('bash', ['-c', `tmux attach-session -t ${tmuxSessionName}`], {
      cwd: projectPath
    })

    // Update in-memory tracking maps
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })
    this.processToSessionMap.set(processId, sessionId)
    this.lastActivityMap.set(sessionId, Date.now())

    // NOTE: Do NOT call writeWhenReady() or busySessions.add() here.
    // The TUI is already initialized. sendMessage() will handle writing.

    console.log(
      `[ChatCliService] Re-attached PTY to session ${sessionId} (tmux: ${tmuxSessionName}, pid: ${processId})`
    )

    return processId
  }

  /**
   * Check if the tmux session for a chat session is alive.
   *
   * Used by the router to distinguish Case B (tmux alive, PTY detached)
   * from Case C (tmux dead).
   *
   * @param sessionId - TinSu's internal chat session ID
   * @returns true if tmux session exists, false otherwise
   *
   * @see CTM-1.3 AC 4: Three-case session handler
   * @see CTM-1.3 Task 3
   */
  async isTmuxAlive(sessionId: string, fallbackTmuxName?: string): Promise<boolean> {
    const tmuxSessionName = this.sessionCache.get(sessionId) || fallbackTmuxName || null
    if (!tmuxSessionName) {
      return false
    }
    const alive = await this.tmuxSessionExists(tmuxSessionName)
    if (!alive) return false

    // Populate cache from DB fallback so subsequent lookups (reattach, hooks) work
    if (!this.sessionCache.has(sessionId)) {
      this.sessionCache.set(sessionId, tmuxSessionName)
      this.sessionToChatCache.set(tmuxSessionName, sessionId)
    }

    // Tmux exists but Claude may have exited (bare shell prompt).
    // Return false so Case C re-launches Claude in the existing tmux session.
    const claudeRunning = await this.isClaudeRunningInTmux(tmuxSessionName)
    if (!claudeRunning) {
      console.log(
        `[ChatCliService] tmux session ${tmuxSessionName} alive but Claude not running — will re-launch`
      )
      return false
    }

    return true
  }

  /**
   * Set the callback to be invoked when a session is killed due to idle timeout.
   * Used by the main process initialization to update DB status to 'paused'.
   *
   * @param callback - Function called with the sessionId of each idle-killed session
   *
   * @see Story 10.6: Session Persistence & Resume (AC: 5)
   */
  setOnIdleCallback(callback: (sessionId: string) => void): void {
    this.onIdleCallback = callback
  }

  /**
   * Check for idle sessions and kill those inactive for > IDLE_TIMEOUT_MS.
   *
   * Iterates lastActivityMap, finds sessions where Date.now() - lastActivity > IDLE_TIMEOUT_MS
   * AND isSessionAlive() returns true, kills those sessions, and invokes the onIdle callback.
   *
   * @returns Array of session IDs that were killed due to inactivity
   *
   * @see Story 10.6: Session Persistence & Resume (AC: 5)
   */
  checkIdleSessions(): string[] {
    const now = Date.now()
    const killedSessionIds: string[] = []

    for (const [sessionId, lastActivity] of this.lastActivityMap) {
      if (now - lastActivity > IDLE_TIMEOUT_MS && this.isSessionAlive(sessionId)) {
        // CTM-2.2 Task 3.4: Emit idle-timeout event before killing
        this.emitSessionStatus(sessionId, 'idle-timeout')

        this.killSession(sessionId)
        killedSessionIds.push(sessionId)
        console.log(
          `[ChatCliService] Killed idle session ${sessionId} (inactive for ${Math.round((now - lastActivity) / 60000)} min)`
        )

        if (this.onIdleCallback) {
          this.onIdleCallback(sessionId)
        }
      }
    }

    return killedSessionIds
  }

  /**
   * Build the --settings JSON string with absolute paths to chat hook scripts.
   *
   * Claude Code resolves project settings from the git root, so we use the
   * --settings CLI flag to inject chat-specific hooks alongside any project hooks.
   * Absolute paths are used because $CLAUDE_PROJECT_DIR is set by Claude Code
   * to the git root at runtime, not to our chat-hooks directory.
   */
  private buildChatSettingsJson(): string {
    const dir = this.chatHooksDir
    return JSON.stringify({
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'command', command: `bash "${dir}/stop.sh"` }] }],
        PostToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `bash "${dir}/tool-use.sh"` }] }],
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `bash "${dir}/pre-tool-use.sh"` }] }],
        Notification: [{ matcher: '', hooks: [{ type: 'command', command: `bash "${dir}/notification.sh"` }] }]
      },
      statusLine: {
        type: 'command',
        command: `bash "${dir}/status.sh"`
      }
    })
  }

  /**
   * Build tmux session name following project convention: tinsu-{projectName}-{sessionId}
   * Matches the task terminal naming pattern from TaskTerminalService.
   */
  buildTmuxSessionName(projectName: string, sessionId: string): string {
    const sanitizedProject = projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    return `tinsu-${sanitizedProject}-${sessionId}`
  }

  /**
   * Spawn a new Claude Code CLI session inside a tmux session.
   *
   * CTM-1.1: Two-layer model:
   * 1. Creates a detached tmux session named `tinsu-{projectName}-{sessionId}`
   * 2. Sets environment variables on the tmux session
   * 3. Sends `claude` command into the tmux session via send-keys
   * 4. Attaches a PTY to the tmux session for I/O
   * 5. Waits for TUI ready, then writes the user message via PTY
   *
   * @param sessionId - TinSu's internal chat session ID (chat_sessions.id)
   * @param sessionUuid - Claude Code session UUID (chat_sessions.session_uuid)
   * @param projectName - Project name for tmux session naming
   * @param projectPath - Working directory for the claude process
   * @param initialMessage - First user message to send to stdin
   * @param personaContext - Optional persona context injected as system prompt (Story 10.4)
   * @returns The PTY processId
   *
   * @see CTM-1.1 AC 1: tmux session creation with PTY attachment
   * @see CTM-1.1 AC 3: SAFE_SHELL_ARG_REGEX validation
   * @see Story 10.4: Persona context via --append-system-prompt
   */
  async spawnSession(
    sessionId: string,
    sessionUuid: string,
    projectName: string,
    projectPath: string,
    initialMessage: string,
    personaContext?: string,
    /** Use --resume instead of --session-id to resume an existing Claude Code session */
    resume?: boolean,
    /** When true, pass --dangerously-skip-permissions to auto-approve all tool use */
    skipPermissions?: boolean
  ): Promise<string> {
    // CTM-1.1 AC 3: Validate sessionId against SAFE_SHELL_ARG_REGEX
    if (!SAFE_SHELL_ARG_REGEX.test(sessionId)) {
      throw new Error(`Invalid sessionId format: must contain only alphanumeric, dash, or underscore characters`)
    }

    // Check tmux is available
    const tmuxInstalled = await TmuxService.checkTmuxInstalled()
    if (!tmuxInstalled) {
      throw new Error('tmux is not installed. Please install tmux to use chat sessions.')
    }

    const tmuxSessionName = this.buildTmuxSessionName(projectName, sessionId)

    // CTM-1.1 AC 1: Create detached tmux session
    console.log(`[ChatCliService] Creating tmux session: ${tmuxSessionName}`)
    try {
      await execAsync(`tmux new-session -d -s ${tmuxSessionName} -c ${JSON.stringify(projectPath)}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      })
    } catch (error) {
      const execError = error as { stderr?: string }
      // Session already exists - that's fine (idempotent)
      if (!execError.stderr?.includes('duplicate session')) {
        throw error
      }
    }

    // CTM-1.1 AC 1: Set environment variables on the tmux session
    await execAsync(
      `tmux set-environment -t ${tmuxSessionName} TINSU_TMUX_SESSION ${tmuxSessionName}`,
      { timeout: TMUX_COMMAND_TIMEOUT }
    )
    await execAsync(
      `tmux set-environment -t ${tmuxSessionName} TINSU_SESSION_UUID '${sessionUuid}'`,
      { timeout: TMUX_COMMAND_TIMEOUT }
    )

    // CTM-1.1 AC 1: Build and send claude command into tmux session
    // Use --resume for re-launching an exited session, --session-id for fresh sessions
    const claudeArgs = resume
      ? ['--resume', sessionUuid, '--settings', this.buildChatSettingsJson()]
      : ['--session-id', sessionUuid, '--settings', this.buildChatSettingsJson()]
    if (skipPermissions) {
      claudeArgs.push('--dangerously-skip-permissions')
    }
    if (personaContext) {
      claudeArgs.push('--append-system-prompt', personaContext)
    }

    // Build the full command string for tmux send-keys
    // Use single quotes to protect special characters in the settings JSON and persona
    // (bash inside the tmux session interprets these single-quoted arguments)
    // Prefix with env vars inline so the claude process and its hook scripts inherit them.
    // (tmux set-environment only affects new windows/panes, not the already-running shell)
    const envPrefix = `TINSU_SESSION_UUID='${sessionUuid}' TINSU_TMUX_SESSION='${tmuxSessionName}'`
    const claudeCommand = `${envPrefix} claude ${claudeArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
    console.log(`[ChatCliService] Sending claude command to tmux: claude ${resume ? '--resume' : '--session-id'} ${sessionUuid} --settings "<json>" ${personaContext ? '--append-system-prompt "<persona>"' : ''}`)

    // Use execFileAsync (not execAsync) to bypass shell interpretation entirely.
    // The persona text can contain backticks, <>, $, etc. that /bin/sh would
    // misinterpret as command substitution or redirections.
    await execFileAsync('tmux', ['send-keys', '-t', tmuxSessionName, claudeCommand, 'Enter'], {
      timeout: TMUX_COMMAND_TIMEOUT
    })

    // CTM-1.1 AC 1: Attach PTY to the tmux session for I/O
    const processId = ptyService.spawn('bash', ['-c', `tmux attach-session -t ${tmuxSessionName}`], {
      cwd: projectPath
    })

    // CTM-1.1 AC 1: Populate both caches atomically
    this.sessionCache.set(sessionId, tmuxSessionName)
    this.sessionToChatCache.set(tmuxSessionName, sessionId)

    // Track session and reverse map immediately
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })
    this.processToSessionMap.set(processId, sessionId)
    this.lastActivityMap.set(sessionId, Date.now())

    console.log(
      `[ChatCliService] Spawned session ${sessionId} (uuid: ${sessionUuid}, tmux: ${tmuxSessionName}, pid: ${processId})`
    )

    // Wait for Claude's TUI to be ready before writing the user message.
    // The TUI outputs escape sequences and prompt indicators when ready.
    this.writeWhenReady(processId, sessionId, initialMessage)

    // Mark busy -- message will be submitted once TUI is ready
    this.busySessions.add(sessionId)

    return processId
  }

  /**
   * Wait for Claude's TUI to be ready, then write the message to stdin.
   *
   * Watches PTY output for indicators that the interactive prompt is loaded
   * (e.g., box-drawing characters from the welcome screen). Falls back to a
   * timeout if the prompt isn't detected within 15 seconds.
   */
  private writeWhenReady(processId: string, sessionId: string, message: string): void {
    let written = false
    let trustDismissed = false

    const doWrite = (): void => {
      if (written) return
      written = true
      ptyService.off('output', outputHandler)

      // Guard: don't write to a process that has already exited
      const proc = ptyService.getProcess(processId)
      if (!proc || proc.state !== 'running') {
        console.warn(`[ChatCliService] Process ${processId} already exited, skipping write for session ${sessionId}`)
        return
      }

      console.log(`[ChatCliService] TUI ready, writing message to stdin (${message.length} chars): ${message.slice(0, 200)}`)
      // Write message content first, then send \r (Enter) separately after a
      // short delay. When written in a single call, the terminal treats the
      // entire payload (including \r) as a "paste" and the TUI interprets \r
      // as a literal newline rather than as a submit action.
      const isSlashCommand = message.startsWith('/')
      ptyService.write(processId, message)
      setTimeout(() => {
        const p = ptyService.getProcess(processId)
        if (p && p.state === 'running') {
          ptyService.write(processId, '\r')
          // Slash commands trigger Claude Code's autocomplete — first Enter
          // selects the item, second Enter submits. The TUI needs time to
          // process autocomplete selection and re-render before the submit Enter.
          if (isSlashCommand) {
            setTimeout(() => {
              const p2 = ptyService.getProcess(processId)
              if (p2 && p2.state === 'running') {
                ptyService.write(processId, '\r')
              }
            }, 500)
          }
        }
      }, 300)
    }

    const outputHandler = (event: PtyOutputEvent): void => {
      if (event.processId !== processId) return

      // Auto-dismiss the "trust this folder" safety prompt.
      // On first launch in a new project dir, Claude CLI shows an interactive
      // prompt asking "Is this a project you created or one you trust?" with
      // option 1 ("Yes, I trust this") pre-selected. We send Enter to confirm.
      // Strip ANSI codes for reliable text matching.
      if (!trustDismissed) {
        const clean = event.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
        // The trust prompt text arrives split across multiple PTY events,
        // so we can't require both "trust" and "Enter" in a single chunk.
        // The first chunk contains "trust" (from "Is this a project you trust?").
        if (clean.includes('trust')) {
          trustDismissed = true
          console.log(`[ChatCliService] Auto-dismissing trust prompt for session ${sessionId}`)
          ptyService.write(processId, '\r')
          return
        }
      }

      // Detect TUI input area ready: the input widget shows "ctrl+g" hint
      // or the effort indicator "high" / "/effort" when the prompt is active.
      // NOTE: The welcome box appears BEFORE the input widget is ready --
      // we must wait for the actual input area indicators.
      if (event.data.includes('ctrl+g') || event.data.includes('/effort')) {
        console.log(`[ChatCliService] Detected TUI input ready for session ${sessionId}`)
        doWrite()
      }
    }

    ptyService.on('output', outputHandler)

    // Fallback: write after 15s regardless
    setTimeout(() => {
      if (!written) {
        console.warn(`[ChatCliService] TUI ready timeout for session ${sessionId}, writing anyway`)
        doWrite()
      }
    }, 15_000)
  }

  /**
   * Send a message to an existing chat CLI session.
   *
   * Writes the message to the PTY stdin (which is attached to the tmux session).
   * The PTY is the I/O channel -- messages are written via ptyService.write(),
   * NOT via tmux send-keys.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @param message - Message content to send
   * @throws Error if session not found or exited
   *
   * @see CTM-1.1 AC 2: Message written via ptyService.write()
   */
  sendMessage(sessionId: string, message: string): void {
    const info = this.sessions.get(sessionId)
    if (!info) {
      throw new Error(`Chat CLI session not found: ${sessionId}`)
    }
    if (info.status === 'exited') {
      throw new Error(`Chat CLI session has exited: ${sessionId}`)
    }

    // Log if session is busy (agent still generating) but still send --
    // blocking messages caused worse UX issues (permanently stuck sessions)
    // than the risk of messages being lost during generation.
    if (this.busySessions.has(sessionId)) {
      console.warn(`[ChatCliService] Session ${sessionId} is busy, sending anyway (agent may be generating)`)
    }

    // Write message content, then Enter after a short delay.
    // For slash commands, a second Enter is needed: first Enter selects the
    // autocomplete item, second Enter submits the command.
    // The TUI needs time between Enter presses to process autocomplete selection
    // and re-render — 150ms was too short and caused the submit to be swallowed.
    const isSlashCommand = message.startsWith('/')
    ptyService.write(info.processId, message)
    setTimeout(() => {
      const proc = ptyService.getProcess(info.processId)
      if (proc && proc.state === 'running') {
        ptyService.write(info.processId, '\r')
        if (isSlashCommand) {
          setTimeout(() => {
            const p2 = ptyService.getProcess(info.processId)
            if (p2 && p2.state === 'running') {
              ptyService.write(info.processId, '\r')
            }
          }, 500)
        }
      }
    }, 300)

    // Mark session as busy until chat-stop hook fires
    this.busySessions.add(sessionId)

    // Track activity for idle timeout (Story 10.6)
    // CTM-2.2 Task 5.3: The idle timeout (2 hours) resets on each sendMessage() call
    // (user message), not on agent output. This ensures sessions stay alive while the
    // user is actively chatting, regardless of agent response frequency.
    this.lastActivityMap.set(sessionId, Date.now())
  }

  /**
   * Mark a session as no longer busy (Claude finished generating).
   * Called by the hook listener when a chat-stop hook fires.
   *
   * @param sessionId - TinSu's internal chat session ID
   */
  markSessionFree(sessionId: string): void {
    this.busySessions.delete(sessionId)
  }

  /**
   * Check if a session is currently busy (Claude is generating a response).
   */
  isSessionBusy(sessionId: string): boolean {
    return this.busySessions.has(sessionId)
  }

  /**
   * Get the live status of a chat session.
   *
   * CTM-2.1 Task 6: Returns a high-level status for session visibility:
   * - 'thinking': Agent is actively generating a response (busySessions)
   * - 'idle': Session is alive but not generating
   * - 'exited': PTY process has exited (session may still be alive in tmux)
   * - 'unknown': Session was never tracked or has been fully cleaned up
   *
   * Foundation for Story 2.3 (live status badges) but needed now
   * for background session visibility and <500ms switch verification.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @returns Live status of the session
   *
   * @see CTM-2.1 AC 2, 3
   */
  getSessionStatus(sessionId: string): 'thinking' | 'idle' | 'exited' | 'unknown' {
    if (this.busySessions.has(sessionId)) return 'thinking'
    const info = this.sessions.get(sessionId)
    if (!info) return 'unknown'
    if (info.status === 'exited') return 'exited'
    return 'idle'
  }

  /**
   * Check if a chat CLI session's PTY process is still alive.
   *
   * Checks both the in-memory map and the underlying PTY process state.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @returns true if session exists and PTY process is running
   */
  isSessionAlive(sessionId: string): boolean {
    const info = this.sessions.get(sessionId)
    if (!info) return false
    if (info.status === 'exited') return false

    const proc = ptyService.getProcess(info.processId)
    return proc !== undefined && proc.state === 'running'
  }

  /**
   * Check if a CLI session was ever tracked for this sessionId.
   * Returns true even if the session has exited (status 'exited').
   * Returns false only if no session was ever spawned for this chat.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @returns true if session exists in the map (any status)
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Kill a chat CLI session's PTY process and tmux session.
   *
   * CTM-1.1: Also kills the underlying tmux session and removes from caches.
   *
   * @param sessionId - TinSu's internal chat session ID
   */
  killSession(sessionId: string): void {
    const info = this.sessions.get(sessionId)
    if (!info) return

    // Kill tmux session (ignore errors if session doesn't exist)
    const tmuxSessionName = this.sessionCache.get(sessionId)
    if (tmuxSessionName) {
      execAsync(`tmux kill-session -t ${tmuxSessionName}`, {
        timeout: TMUX_COMMAND_TIMEOUT
      }).catch(() => {
        // Session might already be gone -- that's fine
      })
      this.sessionToChatCache.delete(tmuxSessionName)
    }

    this.processToSessionMap.delete(info.processId)
    ptyService.kill(info.processId)
    this.sessions.delete(sessionId)
    this.sessionCache.delete(sessionId)
    this.lastActivityMap.delete(sessionId)
    this.busySessions.delete(sessionId)

    console.log(`[ChatCliService] Killed session ${sessionId}`)
  }

  /**
   * Kill all chat CLI sessions.
   * Called on app shutdown to clean up.
   */
  killAll(): void {
    // CTM-2.2 Task 3.5: Clear health monitoring interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }

    for (const [sessionId, info] of this.sessions) {
      // Kill tmux session
      const tmuxSessionName = this.sessionCache.get(sessionId)
      if (tmuxSessionName) {
        execAsync(`tmux kill-session -t ${tmuxSessionName}`, {
          timeout: TMUX_COMMAND_TIMEOUT
        }).catch(() => {
          // Ignore errors during cleanup
        })
      }

      ptyService.kill(info.processId)
      console.log(`[ChatCliService] Killed session ${sessionId} (cleanup)`)
    }
    this.sessions.clear()
    this.sessionCache.clear()
    this.sessionToChatCache.clear()
    this.lastActivityMap.clear()
    this.busySessions.clear()
  }

  /**
   * Handle PTY exit events.
   * Updates the session map status to 'exited' when a PTY process dies.
   * Does NOT terminate the chat session or change DB status --
   * the session remains 'active' so it can be recovered (Story 1.3).
   */
  /**
   * Detect and capture slash command overlay output from Claude Code's TUI.
   *
   * Claude Code renders slash command responses (e.g., /skills, /cost, /status)
   * in a full-screen TUI overlay that shows "Esc to close" at the bottom.
   * This blocks further input until Escape is pressed.
   *
   * We buffer PTY output chunks, detect the "Esc to close" marker, then:
   * 1. Send Escape to dismiss the overlay (unblock the session)
   * 2. Store the captured text as a chat message for the user to read
   */
  private handleSlashCommandOutput(event: PtyOutputEvent): void {
    const sessionId = this.processToSessionMap.get(event.processId)
    if (!sessionId) return

    // Strip ANSI escape codes for pattern matching
    const clean = event.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')

    // Start buffering when we see content that looks like a command response
    // (we buffer all output and only act on "Esc to close")
    let buf = this.slashCmdBuffer.get(event.processId)

    if (!buf) {
      // Only start buffering if this looks like slash command output
      // (not regular assistant messages). Slash command overlays contain
      // structured text without the usual assistant message patterns.
      if (clean.includes('Esc to close')) {
        // Single-chunk response — process immediately
        buf = { chunks: [event.data], timer: null }
        this.slashCmdBuffer.set(event.processId, buf)
      } else {
        return
      }
    } else {
      buf.chunks.push(event.data)
      // Reset debounce timer — wait for all chunks to arrive
      if (buf.timer) clearTimeout(buf.timer)
    }

    // Check if we've received the "Esc to close" marker
    const allText = buf.chunks.join('')
    const allClean = allText.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')

    if (allClean.includes('Esc to close')) {
      // Clear buffer
      if (buf.timer) clearTimeout(buf.timer)
      this.slashCmdBuffer.delete(event.processId)

      // Extract meaningful text: strip ANSI, clean up whitespace
      const lines = allClean
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l !== 'Esc to close')

      if (lines.length > 0) {
        const content = lines.join('\n')

        // Store as a tool message in the chat so the UI can display it
        const session = this.sessions.get(sessionId)
        if (session) {
          db.insert(chat_messages)
            .values({
              id: crypto.randomUUID(),
              session_id: sessionId,
              role: 'tool',
              content,
              tool_name: '__command_output__',
              tool_input: JSON.stringify({ type: 'slash_command_response' }),
              created_at: new Date()
            })
            .run()

          console.log(
            `[ChatCliService] Captured slash command output for session ${sessionId} (${lines.length} lines)`
          )
        }
      }

      // Auto-dismiss the overlay so the session isn't blocked
      const proc = ptyService.getProcess(event.processId)
      if (proc && proc.state === 'running') {
        ptyService.write(event.processId, '\x1b') // Escape to close overlay
      }
      return
    }

    // Set a timeout to stop buffering if "Esc to close" never arrives (safety net)
    buf.timer = setTimeout(() => {
      this.slashCmdBuffer.delete(event.processId)
    }, 10_000)
  }

  private handlePtyExit(event: PtyExitEvent): void {
    for (const [sessionId, info] of this.sessions) {
      if (info.processId === event.processId) {
        info.status = 'exited'
        this.processToSessionMap.delete(event.processId)
        this.busySessions.delete(sessionId)
        console.warn(
          `[ChatCliService] PTY EXITED for session ${sessionId} (code: ${event.exitCode}, signal: ${(event as unknown as Record<string, unknown>).signal ?? 'none'})`
        )
        break
      }
    }
  }
}
