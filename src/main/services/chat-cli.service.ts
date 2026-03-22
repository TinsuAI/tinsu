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
 * - CLAUDE_PROJECT_DIR env var points to a directory with chat-specific hooks
 *   that POST to /api/hooks/chat-stop (not /api/hooks/stop).
 * - Chat sessions are INTERACTIVE: no --dangerously-skip-permissions.
 * - Idle sessions (>30 min) are auto-killed to free resources (Story 10.6).
 *
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 * @see Story 10.6: Session Persistence & Resume (AC: 5)
 */

import { ptyService } from './pty.service'
import type { PtyExitEvent } from './pty.service'

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
   * Spawn a new Claude Code CLI session for a chat.
   *
   * Creates an interactive `claude` process with --session-id flag.
   * Sets CLAUDE_PROJECT_DIR to the chat hooks directory so chat-specific
   * hook scripts are used (posting to /api/hooks/chat-stop instead of /api/hooks/stop).
   *
   * @param sessionId - TinSu's internal chat session ID (chat_sessions.id)
   * @param sessionUuid - Claude Code session UUID (chat_sessions.session_uuid)
   * @param projectPath - Working directory for the claude process
   * @param initialMessage - First user message to send to stdin
   * @param personaContext - Optional persona context to prepend to the initial message (Story 10.4)
   * @returns The PTY processId
   *
   * @see AC 1: Spawns claude with --session-id UUID
   * @see Story 10.4: Persona context prepended to first message
   */
  spawnSession(
    sessionId: string,
    sessionUuid: string,
    projectPath: string,
    initialMessage: string,
    personaContext?: string
  ): string {
    const processId = ptyService.spawn('claude', ['--session-id', sessionUuid], {
      cwd: projectPath,
      env: {
        CLAUDE_PROJECT_DIR: this.chatHooksDir
      }
    })

    // Write to stdin: prepend persona context if provided (Story 10.4 AC: 1-5)
    const stdinContent = personaContext
      ? personaContext + '\n\n' + initialMessage + '\n'
      : initialMessage + '\n'
    ptyService.write(processId, stdinContent)

    // Track session
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })

    // Track activity for idle timeout (Story 10.6)
    this.lastActivityMap.set(sessionId, Date.now())

    console.log(
      `[ChatCliService] Spawned session ${sessionId} (uuid: ${sessionUuid}, pid: ${processId})`
    )

    return processId
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

    ptyService.write(info.processId, message + '\n')

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
    const processId = ptyService.spawn(
      'claude',
      ['--resume', '--session-id', sessionUuid],
      {
        cwd: projectPath,
        env: {
          CLAUDE_PROJECT_DIR: this.chatHooksDir
        }
      }
    )

    // Write message to stdin
    ptyService.write(processId, message + '\n')

    // Update session map with new process
    this.sessions.set(sessionId, {
      processId,
      sessionUuid,
      status: 'running'
    })

    // Track activity for idle timeout (Story 10.6)
    this.lastActivityMap.set(sessionId, Date.now())

    console.log(
      `[ChatCliService] Resumed session ${sessionId} (uuid: ${sessionUuid}, pid: ${processId})`
    )

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
        console.warn(
          `[ChatCliService] PTY exited for session ${sessionId} (code: ${event.exitCode})`
        )
        break
      }
    }
  }
}
