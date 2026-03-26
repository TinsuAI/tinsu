/**
 * Chat CLI Service - Story 10.3, 10.6, CTM-1.1, CTM-1.3
 *
 * Manages Claude Code CLI processes for chat sessions via tmux.
 * Uses a two-layer model: tmux session (persistence) + PTY (I/O).
 *
 * Architecture (CTM-1.1):
 *   tmux session (persistence layer) --- tinsu-chat-{sessionId}
 *     |-- PTY attached via ptyService.spawn(tmux attach ...) (I/O layer)
 *          |-- claude --session-id {uuid} (agent process)
 *
 * Key design decisions:
 * - tmux sessions survive app restarts for persistent conversations.
 * - PTY is the I/O channel: messages written via ptyService.write() (byte-level stdin),
 *   NOT via tmux send-keys (which has escaping issues with multi-line/special chars).
 * - Uses --settings CLI flag to inject chat-specific hooks.
 * - Chat sessions are INTERACTIVE: no --dangerously-skip-permissions.
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

import { exec } from 'child_process'
import { promisify } from 'util'
import { ptyService } from './pty.service'
import { TmuxService } from './tmux.service'
import { db } from '../db'
import { chat_sessions } from '../db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import type { PtyExitEvent, PtyOutputEvent } from './pty.service'

const execAsync = promisify(exec)

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

  /** Interval handle for idle session checks (Story 10.6) */
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null

  /** Callback invoked when a session is killed due to idle timeout (Story 10.6) */
  private onIdleCallback: ((sessionId: string) => void) | null = null

  /** Reverse map: PTY processId -> sessionId (for output/exit log correlation) */
  private processToSessionMap: Map<string, string> = new Map()

  /** CTM-1.1: Forward cache: chatSessionId -> tmuxSessionName */
  private sessionCache: Map<string, string> = new Map()

  /** CTM-1.1: Reverse cache: tmuxSessionName -> chatSessionId (for hook routing in Story 1.2) */
  private sessionToChatCache: Map<string, string> = new Map()

  constructor(chatHooksDir: string) {
    this.chatHooksDir = chatHooksDir

    // Listen for PTY exit events to update session map
    ptyService.on('exit', (event: PtyExitEvent) => {
      this.handlePtyExit(event)
    })

    // Start periodic idle session check (every 60 seconds) (Story 10.6 AC: 5)
    this.idleCheckInterval = setInterval(() => this.checkIdleSessions(), 60_000)
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
  async isTmuxAlive(sessionId: string): Promise<boolean> {
    const tmuxSessionName = this.sessionCache.get(sessionId)
    if (!tmuxSessionName) {
      return false
    }
    return this.tmuxSessionExists(tmuxSessionName)
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
   * Spawn a new Claude Code CLI session inside a tmux session.
   *
   * CTM-1.1: Two-layer model:
   * 1. Creates a detached tmux session named `tinsu-chat-{sessionId}`
   * 2. Sets environment variables on the tmux session
   * 3. Sends `claude` command into the tmux session via send-keys
   * 4. Attaches a PTY to the tmux session for I/O
   * 5. Waits for TUI ready, then writes the user message via PTY
   *
   * @param sessionId - TinSu's internal chat session ID (chat_sessions.id)
   * @param sessionUuid - Claude Code session UUID (chat_sessions.session_uuid)
   * @param projectPath - Working directory for the claude process
   * @param initialMessage - First user message to send to stdin
   * @param personaContext - Optional persona context injected as system prompt (Story 10.4)
   * @returns The PTY processId
   *
   * @see CTM-1.1 AC 1: tmux session creation with PTY attachment
   * @see CTM-1.1 AC 3: tinsu-chat- prefix and SAFE_SHELL_ARG_REGEX validation
   * @see Story 10.4: Persona context via --append-system-prompt
   */
  async spawnSession(
    sessionId: string,
    sessionUuid: string,
    projectPath: string,
    initialMessage: string,
    personaContext?: string
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

    const tmuxSessionName = `tinsu-chat-${sessionId}`

    // CTM-1.1 AC 1: Create detached tmux session
    console.log(`[ChatCliService] Creating tmux session: ${tmuxSessionName}`)
    try {
      await execAsync(`tmux new-session -d -s ${tmuxSessionName}`, {
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
    const claudeArgs = ['--session-id', sessionUuid, '--settings', this.buildChatSettingsJson()]
    if (personaContext) {
      claudeArgs.push('--append-system-prompt', personaContext)
    }

    // Build the full command string for tmux send-keys
    // Use single quotes to protect special characters in the settings JSON and persona
    const claudeCommand = `claude ${claudeArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`
    console.log(`[ChatCliService] Sending claude command to tmux: claude --session-id ${sessionUuid} --settings "<json>" ${personaContext ? '--append-system-prompt "<persona>"' : ''}`)

    await execAsync(
      `tmux send-keys -t ${tmuxSessionName} ${JSON.stringify(claudeCommand)} Enter`,
      { timeout: TMUX_COMMAND_TIMEOUT }
    )

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
      // as a literal newline rather than as a submit action. The 150ms gap
      // ensures the TUI exits paste mode before receiving Enter.
      ptyService.write(processId, message)
      setTimeout(() => {
        const p = ptyService.getProcess(processId)
        if (p && p.state === 'running') {
          ptyService.write(processId, '\r')
        }
      }, 150)
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

    // Write message content, then send \r (Enter) after a short delay.
    // See writeWhenReady for explanation of why the 150ms delay is needed.
    ptyService.write(info.processId, message)
    setTimeout(() => {
      const proc = ptyService.getProcess(info.processId)
      if (proc && proc.state === 'running') {
        ptyService.write(info.processId, '\r')
      }
    }, 150)

    // Mark session as busy until chat-stop hook fires
    this.busySessions.add(sessionId)

    // Track activity for idle timeout (Story 10.6)
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
    // Clear idle check interval (Story 10.6)
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
      this.idleCheckInterval = null
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
  }

  /**
   * Handle PTY exit events.
   * Updates the session map status to 'exited' when a PTY process dies.
   * Does NOT terminate the chat session or change DB status --
   * the session remains 'active' so it can be recovered (Story 1.3).
   */
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
