/**
 * Chat CLI Service - Story 10.3, 10.6
 *
 * Manages Claude Code CLI PTY processes for chat sessions.
 * Uses ptyService singleton (node-pty, NOT tmux) to spawn interactive
 * `claude` processes for conversational planning sessions.
 *
 * Key design decisions:
 * - node-pty (not tmux) because chat sessions are interactive and lightweight.
 *   If the app restarts, PTY dies but Claude Code's --resume flag restores context.
 * - Uses --settings CLI flag to inject chat-specific hooks that POST to
 *   /api/hooks/chat-stop (not /api/hooks/stop). This is required because
 *   Claude Code resolves project settings from the git root, not from env vars.
 * - Chat sessions are INTERACTIVE: no --dangerously-skip-permissions.
 * - Idle sessions (>30 min) are auto-killed to free resources (Story 10.6).
 *
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 * @see Story 10.6: Session Persistence & Resume (AC: 5)
 */

import { ptyService } from './pty.service'
import type { PtyExitEvent, PtyOutputEvent } from './pty.service'

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

/** Idle timeout threshold: 30 minutes in milliseconds (Story 10.6 AC: 5) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/**
 * Service for managing Claude Code CLI processes for chat sessions.
 *
 * Maintains an in-memory map: sessionId -> ChatCliSessionInfo
 * where sessionId is TinSu's internal chat_sessions.id (PK).
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class ChatCliService {
  /** Map from TinSu sessionId (chat_sessions.id) to CLI process info */
  private sessions: Map<string, ChatCliSessionInfo> = new Map()

  /** Map from sessionId to last activity timestamp (Date.now()) (Story 10.6) */
  private lastActivityMap: Map<string, number> = new Map()

  /** Path to the chat-specific hooks directory */
  private chatHooksDir: string

  /** Interval handle for idle session checks (Story 10.6) */
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null

  /** Callback invoked when a session is killed due to idle timeout (Story 10.6) */
  private onIdleCallback: ((sessionId: string) => void) | null = null

  /** Reverse map: PTY processId -> sessionId (for output/exit log correlation) */
  private processToSessionMap: Map<string, string> = new Map()

  constructor(chatHooksDir: string) {
    this.chatHooksDir = chatHooksDir

    // Listen for PTY output events to log what Claude is saying/doing
    ptyService.on('output', (event: PtyOutputEvent) => {
      const sessionId = this.processToSessionMap.get(event.processId)
      if (sessionId) {
        // Strip ANSI codes for cleaner logging, truncate to 500 chars
        const clean = event.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
        if (clean.length > 0) {
          const truncated = clean.length > 500 ? clean.slice(0, 500) + '...' : clean
          console.log(`[ChatCliService:output] session=${sessionId} | ${truncated}`)
        }
      }
    })

    // Listen for PTY exit events to update session map
    ptyService.on('exit', (event: PtyExitEvent) => {
      this.handlePtyExit(event)
    })

    // Start periodic idle session check (every 60 seconds) (Story 10.6 AC: 5)
    this.idleCheckInterval = setInterval(() => this.checkIdleSessions(), 60_000)
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
      }
    })
  }

  /**
   * Spawn a new Claude Code CLI session for a chat.
   *
   * Creates an interactive `claude` process with --session-id flag.
   * Persona context is injected via --append-system-prompt (not stdin).
   * Uses --settings to inject chat-specific hooks that POST to
   * /api/hooks/chat-stop (not /api/hooks/stop).
   *
   * The user message is written to stdin only AFTER Claude's TUI is ready,
   * detected by watching PTY output for the interactive prompt.
   *
   * @param sessionId - TinSu's internal chat session ID (chat_sessions.id)
   * @param sessionUuid - Claude Code session UUID (chat_sessions.session_uuid)
   * @param projectPath - Working directory for the claude process
   * @param initialMessage - First user message to send to stdin
   * @param personaContext - Optional persona context injected as system prompt (Story 10.4)
   * @returns The PTY processId
   *
   * @see AC 1: Spawns claude with --session-id UUID
   * @see Story 10.4: Persona context via --append-system-prompt
   */
  spawnSession(
    sessionId: string,
    sessionUuid: string,
    projectPath: string,
    initialMessage: string,
    personaContext?: string
  ): string {
    const spawnArgs = ['--session-id', sessionUuid, '--settings', this.buildChatSettingsJson()]

    // Story 10.4: Inject persona context as system prompt (not stdin)
    if (personaContext) {
      spawnArgs.push('--append-system-prompt', personaContext)
    }

    console.log(`[ChatCliService] Spawning: claude --session-id ${sessionUuid} --settings "<json>" ${personaContext ? '--append-system-prompt "<persona>"' : ''}`)
    console.log(`[ChatCliService] cwd: ${projectPath}`)

    const processId = ptyService.spawn('claude', spawnArgs, { cwd: projectPath })

    // Track session and reverse map immediately
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })
    this.processToSessionMap.set(processId, sessionId)
    this.lastActivityMap.set(sessionId, Date.now())

    console.log(
      `[ChatCliService] Spawned session ${sessionId} (uuid: ${sessionUuid}, pid: ${processId})`
    )

    // Wait for Claude's TUI to be ready before writing the user message.
    // The TUI outputs escape sequences and prompt indicators when ready.
    this.writeWhenReady(processId, sessionId, initialMessage)

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
      // Use \r (carriage return) not \n — Claude's TUI is in raw mode
      // and expects \r (what Enter key sends) to submit the message.
      ptyService.write(processId, message + '\r')
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
      // NOTE: The welcome box (╭╰) appears BEFORE the input widget is ready —
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
   * Writes the message followed by a newline to the PTY stdin.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @param message - Message content to send
   * @throws Error if session not found or exited
   *
   * @see AC 2: Message sent to existing PTY session
   */
  sendMessage(sessionId: string, message: string): void {
    const info = this.sessions.get(sessionId)
    if (!info) {
      throw new Error(`Chat CLI session not found: ${sessionId}`)
    }
    if (info.status === 'exited') {
      throw new Error(`Chat CLI session has exited: ${sessionId}`)
    }

    // Use \r (carriage return) — Claude's TUI in raw mode expects \r for Enter
    ptyService.write(info.processId, message + '\r')

    // Track activity for idle timeout (Story 10.6)
    this.lastActivityMap.set(sessionId, Date.now())
  }

  /**
   * Resume an exited or crashed CLI session.
   *
   * Spawns claude with --resume --session-id flags to pick up
   * where the previous conversation left off.
   *
   * @param sessionId - TinSu's internal chat session ID
   * @param sessionUuid - Claude Code session UUID
   * @param projectPath - Working directory for the claude process
   * @param message - Message to send after resuming
   * @param _personaContext - Intentionally unused. On resume, Claude Code's --resume flag
   *   restores the full conversation history including the original persona injection.
   *   Parameter exists for API symmetry with spawnSession. (Story 10.4)
   * @returns The new PTY processId
   *
   * @see AC 5: Resume with --resume --session-id
   * @see Story 10.4: Persona context NOT re-injected on resume
   */
  resumeSession(
    sessionId: string,
    sessionUuid: string,
    projectPath: string,
    message: string,
    _personaContext?: string
  ): string {
    const spawnArgs = ['--resume', '--session-id', sessionUuid, '--settings', this.buildChatSettingsJson()]
    console.log(`[ChatCliService] Resuming: claude --resume --session-id ${sessionUuid} --settings "<json>"`)

    const processId = ptyService.spawn('claude', spawnArgs, { cwd: projectPath })

    // Update session map with new process
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })
    this.processToSessionMap.set(processId, sessionId)
    this.lastActivityMap.set(sessionId, Date.now())

    console.log(
      `[ChatCliService] Resumed session ${sessionId} (uuid: ${sessionUuid}, pid: ${processId})`
    )

    // Wait for TUI ready before writing message
    this.writeWhenReady(processId, sessionId, message)

    return processId
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
   * Kill a chat CLI session's PTY process.
   *
   * Kills the underlying PTY process and removes from the session map.
   *
   * @param sessionId - TinSu's internal chat session ID
   */
  killSession(sessionId: string): void {
    const info = this.sessions.get(sessionId)
    if (!info) return

    this.processToSessionMap.delete(info.processId)
    ptyService.kill(info.processId)
    this.sessions.delete(sessionId)
    this.lastActivityMap.delete(sessionId)

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
      ptyService.kill(info.processId)
      console.log(`[ChatCliService] Killed session ${sessionId} (cleanup)`)
    }
    this.sessions.clear()
    this.lastActivityMap.clear()
  }

  /**
   * Handle PTY exit events.
   * Updates the session map status to 'exited' when a PTY process dies.
   * Does NOT terminate the chat session or change DB status --
   * the session remains 'active' so it can be resumed.
   *
   * @see AC 5: CLI crash handling
   */
  private handlePtyExit(event: PtyExitEvent): void {
    for (const [sessionId, info] of this.sessions) {
      if (info.processId === event.processId) {
        info.status = 'exited'
        this.processToSessionMap.delete(event.processId)
        console.warn(
          `[ChatCliService] PTY EXITED for session ${sessionId} (code: ${event.exitCode}, signal: ${(event as Record<string, unknown>).signal ?? 'none'})`
        )
        break
      }
    }
  }
}
