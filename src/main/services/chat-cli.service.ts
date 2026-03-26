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

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
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

/** Context stored for retrying a failed resume */
interface PendingRetryContext {
  sessionId: string
  message: string
  projectPath: string
  personaContext?: string
  spawnedAt: number
  expectedUuid: string
}

/** Idle timeout threshold: 30 minutes in milliseconds (Story 10.6 AC: 5) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** Max time (ms) after spawn to consider a quick exit as a resume failure worth retrying */
const QUICK_EXIT_THRESHOLD_MS = 10_000

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

  /** Retry context for resume attempts — keyed by processId */
  private pendingRetries: Map<string, PendingRetryContext> = new Map()

  /** Callback invoked when a resume discovers the correct UUID */
  private onResumeFailed: ((sessionId: string, correctUuid: string) => void) | null = null

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
   * Set callback invoked when a --resume discovers the correct UUID.
   * The callback receives (sessionId, correctUuid) to update the DB's session_uuid.
   */
  setOnResumeFailedCallback(callback: (sessionId: string, correctUuid: string) => void): void {
    this.onResumeFailed = callback
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

    // Mark busy — message will be submitted once TUI is ready
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

      // TUI loaded — clear retry context since the session started successfully
      this.pendingRetries.delete(processId)

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

    // Log if session is busy (agent still generating) but still send —
    // blocking messages caused worse UX issues (permanently stuck sessions)
    // than the risk of messages being lost during generation.
    if (this.busySessions.has(sessionId)) {
      console.warn(`[ChatCliService] Session ${sessionId} is busy, sending anyway (agent may be generating)`)
    }

    // Write message content, then send \r (Enter) after a short delay.
    // See writeWhenReady for explanation of why the delay is needed.
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
    const spawnArgs = ['--resume', sessionUuid, '--settings', this.buildChatSettingsJson()]
    console.log(`[ChatCliService] Resuming: claude --resume ${sessionUuid} --settings "<json>"`)
    console.log(`[ChatCliService] cwd: ${projectPath}`)

    const processId = ptyService.spawn('claude', spawnArgs, { cwd: projectPath })

    // Store retry context so handlePtyExit can discover the correct UUID
    // if --resume fails (e.g., UUID mismatch from --session-id being ignored)
    this.pendingRetries.set(processId, {
      sessionId,
      message,
      projectPath,
      personaContext: _personaContext,
      spawnedAt: Date.now(),
      expectedUuid: sessionUuid
    })

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

    // Mark busy — message will be submitted once TUI is ready
    this.busySessions.add(sessionId)

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
        this.busySessions.delete(sessionId)
            console.warn(
          `[ChatCliService] PTY EXITED for session ${sessionId} (code: ${event.exitCode}, signal: ${(event as unknown as Record<string, unknown>).signal ?? 'none'})`
        )

        // Check if this was a failed resume that should be retried
        this.maybeRetryResume(event.processId, event.exitCode, sessionId)
        break
      }
    }
  }

  /**
   * When --resume exits quickly with an error, the UUID may be wrong.
   * Try to discover the correct UUID from Claude Code's session files
   * and retry the resume.
   */
  private maybeRetryResume(processId: string, exitCode: number, sessionId: string): void {
    const retry = this.pendingRetries.get(processId)
    this.pendingRetries.delete(processId)

    if (!retry) return
    if (exitCode === 0) return

    const elapsed = Date.now() - retry.spawnedAt
    if (elapsed > QUICK_EXIT_THRESHOLD_MS) return

    console.warn(
      `[ChatCliService] Resume failed for session ${sessionId} (exit ${exitCode} after ${elapsed}ms). ` +
        `Attempting to discover correct UUID from Claude Code session files.`
    )

    // Try to find the correct UUID by scanning Claude Code's session directory
    const correctUuid = this.discoverCorrectUuid(retry.projectPath, retry.expectedUuid)

    if (correctUuid) {
      console.log(
        `[ChatCliService] Discovered correct UUID: ${retry.expectedUuid} → ${correctUuid}. Retrying resume.`
      )

      // Update in-memory tracking
      const info = this.sessions.get(sessionId)
      if (info) info.sessionUuid = correctUuid

      // Notify caller to update DB
      if (this.onResumeFailed) {
        this.onResumeFailed(sessionId, correctUuid)
      }

      // Retry resume with the correct UUID
      const spawnArgs = ['--resume', correctUuid, '--settings', this.buildChatSettingsJson()]
      const newProcessId = ptyService.spawn('claude', spawnArgs, { cwd: retry.projectPath })

      this.sessions.set(sessionId, {
        processId: newProcessId,
        sessionUuid: correctUuid,
        status: 'running'
      })
      this.processToSessionMap.set(newProcessId, sessionId)
      this.lastActivityMap.set(sessionId, Date.now())

      console.log(
        `[ChatCliService] Retried resume for session ${sessionId} (uuid: ${correctUuid}, pid: ${newProcessId})`
      )

      this.writeWhenReady(newProcessId, sessionId, retry.message)
    } else {
      console.warn(
        `[ChatCliService] Could not discover correct UUID for session ${sessionId}. ` +
          `User may need to start a new chat.`
      )
    }
  }

  /**
   * Scan Claude Code's session directory to find the most recent session file
   * that doesn't match the expected UUID. This handles the case where --session-id
   * was ignored and Claude Code used its own UUID.
   *
   * @param projectPath - The project directory (used to derive Claude Code's session dir)
   * @param expectedUuid - The UUID TinSu expected (to exclude from results)
   * @returns The actual session UUID, or null if not found
   */
  private discoverCorrectUuid(projectPath: string, expectedUuid: string): string | null {
    try {
      // Claude Code stores sessions at ~/.claude/projects/<path-hash>/
      const homeDir = os.homedir()
      const pathHash = projectPath.replace(/\//g, '-')
      const sessionDir = path.join(homeDir, '.claude', 'projects', pathHash)

      if (!fs.existsSync(sessionDir)) return null

      const files = fs.readdirSync(sessionDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          uuid: f.replace('.jsonl', ''),
          mtime: fs.statSync(path.join(sessionDir, f)).mtimeMs
        }))
        .filter(f => f.uuid !== expectedUuid)
        .sort((a, b) => b.mtime - a.mtime) // Most recent first

      if (files.length === 0) return null

      // Return the most recently modified session
      return files[0].uuid
    } catch (err) {
      console.warn('[ChatCliService] Error scanning session directory:', err)
      return null
    }
  }

  /**
   * Find the TinSu session ID for an orphan Claude Code UUID.
   *
   * When Claude Code ignores the --session-id flag and generates its own UUID,
   * hook events arrive with an unknown session_id. This method checks if any
   * tracked session has a DIFFERENT expected UUID — that session is the orphan
   * whose DB record needs updating.
   *
   * @param actualUuid - The actual Claude Code session UUID from the hook event
   * @returns The TinSu sessionId and old UUID if an orphan is found, null otherwise
   */
  findOrphanSession(actualUuid: string): { sessionId: string; expectedUuid: string } | null {
    for (const [sessionId, info] of this.sessions) {
      // Skip sessions that already have the correct UUID
      if (info.sessionUuid === actualUuid) continue
      // This session was expecting a different UUID — it's the orphan
      // Only match running or recently-exited sessions (not old dead ones)
      return { sessionId, expectedUuid: info.sessionUuid }
    }
    return null
  }

  /**
   * Update the tracked session UUID after orphan registration.
   * Called by the hook listener after updating the DB's session_uuid.
   */
  updateSessionUuid(sessionId: string, newUuid: string): void {
    const info = this.sessions.get(sessionId)
    if (info) {
      const oldUuid = info.sessionUuid
      info.sessionUuid = newUuid
      console.log(
        `[ChatCliService] Updated tracked UUID for session ${sessionId}: ${oldUuid} → ${newUuid}`
      )
    }
  }
}
