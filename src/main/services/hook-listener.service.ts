/**
 * Hook Listener Service - TES-2.3
 *
 * HTTP server for receiving Claude Code hook events.
 * Provides endpoints for Stop, PostToolUse, and health check.
 *
 * @see TES-2.3: Hook Listener HTTP Server
 * @see Architecture: AR3 - HookListenerService
 * @see Architecture: AR8 - HTTP endpoints for hook IPC
 */

import * as http from 'http'
import * as fs from 'fs'
import { basename } from 'path'
import { z } from 'zod'
import { eq, desc, and, isNull, or } from 'drizzle-orm'
import { db } from '../db'
import { tasks, task_sessions, taskActivities, workflow_runs, chat_sessions, chat_messages } from '../db/schema'
import crypto from 'crypto'
import { BMAD_WORKFLOWS } from '../trpc/routers/planning-workflow-constants'
import { ActivityLogService } from './activity-log.service'
import { AutomationService } from './automation.service'
import { TaskSessionService } from './task-session.service'
import { GitService } from './git.service'
import type { ChatCliService } from './chat-cli.service'

/** Default port for the hook listener HTTP server */
const DEFAULT_PORT = 3847

/** Path to the port file that hook scripts read */
const PORT_FILE = '/tmp/tinsu-hook-port'

/** Maximum body size for incoming requests (64KB) */
const MAX_BODY_SIZE = 64 * 1024

/** Maximum command length before truncation (TES-2.7) */
const MAX_COMMAND_LENGTH = 100

/** Maximum error message length before truncation (TES-2.10) */
const MAX_ERROR_LENGTH = 1000

/** Maximum stack trace length before truncation (TES-2.10) */
const MAX_STACK_LENGTH = 1000

/**
 * Zod schema for Stop hook payload validation.
 * Validates payloads from Claude Code Stop hook.
 *
 * Note: Additional fields (exit_code, error, etc.) may be present
 * depending on Claude Code version. Use passthrough() to preserve them.
 *
 * @see TES-2.10: Error Event Capture - added passthrough for error detection
 */
export const StopHookPayloadSchema = z
  .object({
    session_id: z.string(),
    transcript_path: z.string(),
    cwd: z.string(),
    hook_event_name: z.literal('Stop'),
    // TES-2.10: Optional error-related fields that may be present
    exit_code: z.number().optional(),
    error: z.string().optional(),
    error_code: z.string().optional()
  })
  .passthrough() // Allow additional fields for future compatibility

/**
 * Stop hook payload from Claude Code.
 * Received when Claude Code session ends.
 */
export type StopHookPayload = z.infer<typeof StopHookPayloadSchema>

/**
 * Zod schema for PostToolUse hook payload validation.
 * Validates payloads from Claude Code PostToolUse hook.
 */
export const ToolUseHookPayloadSchema = z.object({
  session_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.any()),
  hook_event_name: z.literal('PostToolUse')
})

/**
 * PostToolUse hook payload from Claude Code.
 * Received after each tool use.
 */
export type ToolUseHookPayload = z.infer<typeof ToolUseHookPayloadSchema>

/**
 * Story 10.1: Zod schema for Chat Stop hook payload validation.
 * Validates payloads from Claude Code Stop hook for chat sessions.
 * Uses separate /api/hooks/chat-stop endpoint to avoid task execution side effects.
 */
export const ChatStopHookPayloadSchema = z
  .object({
    session_id: z.string(),
    hook_event_name: z.literal('Stop'),
    last_assistant_message: z.string().nullish(),
    cwd: z.string(),
    transcript_path: z.string(),
    /** CTM-1.2: tmux session name for routing to correct chat session */
    tmux_session: z.string().optional()
  })
  .passthrough()

/** Chat Stop hook payload type */
export type ChatStopHookPayload = z.infer<typeof ChatStopHookPayloadSchema>

/**
 * Story 10.1: Zod schema for Chat Tool Use hook payload validation.
 * Validates payloads from Claude Code PostToolUse hook for chat sessions.
 * Uses separate /api/hooks/chat-tool-use endpoint to avoid task execution side effects.
 */
export const ChatToolUseHookPayloadSchema = z
  .object({
    session_id: z.string(),
    tool_name: z.string(),
    tool_input: z.record(z.string(), z.any()),
    hook_event_name: z.literal('PostToolUse'),
    /** CTM-1.2: tmux session name for routing to correct chat session */
    tmux_session: z.string().optional()
  })
  .passthrough()

/** Chat Tool Use hook payload type */
export type ChatToolUseHookPayload = z.infer<typeof ChatToolUseHookPayloadSchema>

/**
 * Story 10.5: Zod schema for Chat PreToolUse hook payload validation.
 * Validates payloads from Claude Code PreToolUse hook for chat sessions.
 * Uses separate /api/hooks/chat-pre-tool-use endpoint.
 */
export const ChatPreToolUseHookPayloadSchema = z
  .object({
    session_id: z.string(),
    tool_name: z.string(),
    tool_input: z.record(z.string(), z.any()),
    hook_event_name: z.literal('PreToolUse'),
    /** CTM-1.2: tmux session name for routing to correct chat session */
    tmux_session: z.string().optional()
  })
  .passthrough()

/** Chat PreToolUse hook payload type */
export type ChatPreToolUseHookPayload = z.infer<typeof ChatPreToolUseHookPayloadSchema>

/**
 * Story 10.5: Zod schema for Chat Notification hook payload validation.
 * Validates payloads from Claude Code Notification hook for chat sessions.
 * Uses separate /api/hooks/chat-notification endpoint.
 */
export const ChatNotificationHookPayloadSchema = z
  .object({
    session_id: z.string(),
    type: z.string().default('unknown'),
    message: z.string().default(''),
    hook_event_name: z.literal('Notification'),
    /** CTM-1.2: tmux session name for routing to correct chat session */
    tmux_session: z.string().optional()
  })
  .passthrough()

/** Chat Notification hook payload type */
export type ChatNotificationHookPayload = z.infer<typeof ChatNotificationHookPayloadSchema>

/**
 * Status data received from the Claude Code statusLine command.
 * Updated in real-time as the CLI renders its status bar.
 */
export interface ChatSessionStatusData {
  /** Context window usage percentage (0-100) */
  contextUsedPercent: number | null
  /** 5-hour rate limit usage percentage (0-100) */
  fiveHourUsedPercent: number | null
  /** 7-day rate limit usage percentage (0-100) */
  sevenDayUsedPercent: number | null
  /** 5-hour rate limit remaining seconds (null if unknown) */
  fiveHourResetSeconds: number | null
  /** 7-day rate limit remaining seconds (null if unknown) */
  sevenDayResetSeconds: number | null
  /** Model display name */
  model: string | null
  /** Timestamp when this status was last updated */
  updatedAt: number
}

/**
 * Health check response.
 */
export interface HealthResponse {
  status: 'ok'
  port: number
  uptime: number
}

/**
 * Hook Listener Service
 *
 * HTTP server that receives events from Claude Code hook scripts.
 * Runs on localhost on a configurable port (default 3847).
 *
 * Endpoints:
 * - POST /api/hooks/stop - Receive Stop hook events
 * - POST /api/hooks/tool-use - Receive PostToolUse hook events
 * - GET /api/hooks/health - Health check
 *
 * @see TES-2.3: Hook Listener HTTP Server
 */
export class HookListenerService {
  /** HTTP server instance */
  private server: http.Server | null = null

  /** Port the server is listening on */
  private port: number = DEFAULT_PORT

  /** Server start time for uptime calculation */
  private startTime: number = 0

  /** Reference to ChatCliService for session cache access and session lifecycle management */
  private chatCliService: ChatCliService | null = null

  /**
   * In-memory cache of the latest status data for each chat session.
   * Key: Claude Code session UUID, Value: status payload with timestamp.
   * Updated by the /api/hooks/chat-status endpoint (from statusLine hook).
   */
  private chatSessionStatus: Map<string, ChatSessionStatusData> = new Map()

  /**
   * Tracks sessions where assistant text has already been extracted for the current turn.
   * Prevents duplicate extraction. Cleared when Stop hook fires for the session.
   * Key: chat session DB ID.
   */
  private turnTextExtracted: Set<string> = new Set()

  /**
   * Pending permission requests — held HTTP responses waiting for user approval.
   * Key: requestId, Value: resolve callback + metadata.
   */
  private pendingPermissions: Map<string, {
    resolve: (decision: 'allow' | 'deny') => void
    sessionId: string
    toolName: string
    timeout: ReturnType<typeof setTimeout>
  }> = new Map()

  /**
   * Start the HTTP server.
   *
   * @param port - Port to listen on (default: 3847)
   * @throws Error if port is already in use
   *
   * @example
   * ```typescript
   * const service = new HookListenerService()
   * await service.start(3847)
   * console.log('Hook listener started')
   * ```
   */
  async start(port: number = DEFAULT_PORT): Promise<void> {
    this.port = port
    this.startTime = Date.now()

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error('[HookListener] Request handler error:', err)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    })

    return new Promise((resolve, reject) => {
      this.server!.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`))
        } else {
          reject(err)
        }
      })

      this.server!.listen(port, '127.0.0.1', () => {
        // Write port to temp file for hook scripts to discover
        try {
          fs.writeFileSync(PORT_FILE, String(port))
          console.log(`[HookListener] Started on port ${port}`)
          resolve()
        } catch (err) {
          console.warn('[HookListener] Failed to write port file:', err)
          // Continue anyway - server is running, just port discovery may fail
          resolve()
        }
      })
    })
  }

  /**
   * Stop the HTTP server gracefully.
   *
   * @example
   * ```typescript
   * await service.stop()
   * console.log('Hook listener stopped')
   * ```
   */

  /**
   * Set the ChatCliService reference for chat orphan UUID registration.
   * Called after both services are instantiated to avoid circular dependencies.
   */
  setChatCliService(service: ChatCliService): void {
    this.chatCliService = service
  }

  /**
   * Resolve a pending permission request.
   * Called by the tRPC resolvePermission mutation when the user clicks Approve/Deny.
   * Unblocks the held PreToolUse hook HTTP response.
   */
  resolvePermission(requestId: string, decision: 'allow' | 'deny'): boolean {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) return false
    clearTimeout(pending.timeout)
    pending.resolve(decision)
    this.pendingPermissions.delete(requestId)
    console.log(`[HookListener] Permission ${requestId} resolved: ${decision}`)
    return true
  }

  /**
   * Best-effort attempt to mark a session as free using the Claude Code session UUID
   * or tmux session name. Used as a safety net when the stop hook handler fails
   * (validation error, crash, etc.) to prevent sessions from being permanently stuck
   * in "busy" state.
   *
   * CTM-1.2: Updated to also try lookup by tmux_session when session_uuid lookup fails.
   */
  private tryMarkSessionFreeByUuid(sessionUuid: string | undefined, tmuxSession?: string): void {
    if (!this.chatCliService) return
    try {
      let session: typeof chat_sessions.$inferSelect | undefined

      // Try session_uuid first
      if (sessionUuid) {
        session = db
          .select()
          .from(chat_sessions)
          .where(eq(chat_sessions.session_uuid, sessionUuid))
          .get()
      }

      // CTM-1.2: Fall back to tmux_session lookup
      if (!session && tmuxSession) {
        session = db
          .select()
          .from(chat_sessions)
          .where(eq(chat_sessions.tmux_session, tmuxSession))
          .get()
      }

      if (session) {
        this.chatCliService.markSessionFree(session.id)
        console.log(`[HookListener] Safety: marked session ${session.id} as free after stop hook error`)
      }
    } catch {
      // Best effort — don't throw
    }
  }

  /**
   * CTM-1.2: Centralized chat session resolution from hook payloads.
   *
   * Implements a three-strategy lookup:
   * 1. tmux_session cache lookup via sessionToChatCache (O(1))
   * 2. tmux_session DB fallback via chat_sessions.tmux_session (populates cache on hit)
   * 3. Legacy session_uuid DB fallback via chat_sessions.session_uuid
   *
   * This replaces the repeated session_uuid-only lookup + tryRegisterChatOrphan() pattern
   * across all 5 chat hook handlers.
   *
   * @param payload - Object containing session_id and optional tmux_session
   * @returns The chat_sessions record if found, undefined otherwise
   */
  private resolveChatSession(payload: { session_id: string; tmux_session?: string }): typeof chat_sessions.$inferSelect | undefined {
    // Strategy 1: tmux_session cache lookup (O(1))
    if (payload.tmux_session) {
      const cachedSessionId = this.chatCliService?.getSessionToChatCache().get(payload.tmux_session)
      if (cachedSessionId) {
        const session = db.select().from(chat_sessions).where(eq(chat_sessions.id, cachedSessionId)).get()
        if (session) return session
      }

      // Strategy 2: tmux_session DB fallback
      const dbSession = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.tmux_session, payload.tmux_session))
        .get()
      if (dbSession) {
        // Populate cache for future O(1) lookups
        if (this.chatCliService) {
          this.chatCliService.getSessionToChatCache().set(payload.tmux_session, dbSession.id)
        }
        return dbSession
      }
    }

    // Strategy 3: Legacy session_uuid fallback
    return db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.session_uuid, payload.session_id))
      .get()
  }

  /**
   * Clean up all pending permissions for a session (e.g., on CLI crash or session kill).
   * Auto-denies any outstanding requests.
   */
  cleanupPendingPermissions(sessionId: string): void {
    for (const [requestId, pending] of this.pendingPermissions) {
      if (pending.sessionId === sessionId) {
        clearTimeout(pending.timeout)
        pending.resolve('deny')
        this.pendingPermissions.delete(requestId)
        console.log(`[HookListener] Auto-denied permission ${requestId} (session cleanup)`)
      }
    }
  }

  /**
   * Get the latest status data for a chat session by its Claude Code UUID.
   * Returns null if no status has been received yet.
   */
  getChatSessionStatus(sessionUuid: string): ChatSessionStatusData | null {
    return this.chatSessionStatus.get(sessionUuid) ?? null
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // Clean up port file AFTER server closes to avoid race condition
          // where hook scripts read port file but server is already closing
          try {
            if (fs.existsSync(PORT_FILE)) {
              fs.unlinkSync(PORT_FILE)
            }
          } catch (err) {
            console.warn('[HookListener] Failed to clean up port file:', err)
          }
          console.log('[HookListener] Stopped')
          this.server = null
          resolve()
        })
      } else {
        // Server not running, still clean up port file if it exists
        try {
          if (fs.existsSync(PORT_FILE)) {
            fs.unlinkSync(PORT_FILE)
          }
        } catch (err) {
          console.warn('[HookListener] Failed to clean up port file:', err)
        }
        resolve()
      }
    })
  }

  /**
   * Check if the server is currently running.
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening
  }

  /**
   * Get the port the server is listening on.
   */
  getPort(): number {
    return this.port
  }

  /**
   * Handle incoming HTTP request.
   * Routes to appropriate endpoint handler.
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { method, url } = req

    // Set common headers
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Route: GET /api/hooks/health
    if (method === 'GET' && url === '/api/hooks/health') {
      const response: HealthResponse = {
        status: 'ok',
        port: this.port,
        uptime: Math.floor((Date.now() - this.startTime) / 1000)
      }
      res.writeHead(200)
      res.end(JSON.stringify(response))
      return
    }

    // Route: POST /api/hooks/stop
    if (method === 'POST' && url === '/api/hooks/stop') {
      try {
        const body = await this.parseBody(req)
        const parseResult = StopHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error('[HookListener] Invalid stop hook payload:', parseResult.error.issues)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onStopHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        const isRequestError = err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error('[HookListener] Request error on /api/hooks/stop:', (err as Error).message)
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/stop:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/tool-use
    if (method === 'POST' && url === '/api/hooks/tool-use') {
      try {
        const body = await this.parseBody(req)
        const parseResult = ToolUseHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error('[HookListener] Invalid tool-use hook payload:', parseResult.error.issues)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onToolUseHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        const isRequestError = err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error('[HookListener] Request error on /api/hooks/tool-use:', (err as Error).message)
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/tool-use:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/chat-stop (Story 10.1)
    // CRITICAL: Always call markSessionFree even on errors to prevent
    // sessions from being permanently stuck in "busy" state.
    if (method === 'POST' && url === '/api/hooks/chat-stop') {
      let rawBody: Record<string, unknown> | null = null
      try {
        rawBody = await this.parseBody(req) as Record<string, unknown>
        const parseResult = ChatStopHookPayloadSchema.safeParse(rawBody)
        if (!parseResult.success) {
          console.error('[HookListener] Invalid chat-stop hook payload:', parseResult.error.issues)
          // Still try to free the session even if payload validation fails
          this.tryMarkSessionFreeByUuid(rawBody?.session_id as string | undefined, rawBody?.tmux_session as string | undefined)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onChatStopHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        // Always try to free the session on error
        this.tryMarkSessionFreeByUuid(rawBody?.session_id as string | undefined, rawBody?.tmux_session as string | undefined)
        const isRequestError =
          err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error(
            '[HookListener] Request error on /api/hooks/chat-stop:',
            (err as Error).message
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/chat-stop:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/chat-tool-use (Story 10.1)
    if (method === 'POST' && url === '/api/hooks/chat-tool-use') {
      try {
        const body = await this.parseBody(req)
        const parseResult = ChatToolUseHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error(
            '[HookListener] Invalid chat-tool-use hook payload:',
            parseResult.error.issues
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onChatToolUseHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        const isRequestError =
          err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error(
            '[HookListener] Request error on /api/hooks/chat-tool-use:',
            (err as Error).message
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/chat-tool-use:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/chat-pre-tool-use (Story 10.5)
    // When skip_permissions is ON: respond instantly with auto-approve.
    // When skip_permissions is OFF: hold the HTTP response until the user
    // clicks Approve/Deny in the chat UI, then respond with the decision.
    if (method === 'POST' && url === '/api/hooks/chat-pre-tool-use') {
      try {
        const body = await this.parseBody(req)
        const parseResult = ChatPreToolUseHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error(
            '[HookListener] Invalid chat-pre-tool-use hook payload:',
            parseResult.error.issues
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }

        // Store tool activity in DB (always, regardless of skip_permissions)
        await this.onChatPreToolUseHook(parseResult.data)

        // Look up session to check skip_permissions
        const decision = await this.resolvePreToolUseDecision(parseResult.data)

        res.writeHead(200)
        res.end(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: decision,
            permissionDecisionReason: decision === 'allow'
              ? 'Approved by TinSu chat session'
              : 'Denied by user in TinSu chat'
          }
        }))
      } catch (err) {
        const isRequestError =
          err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error(
            '[HookListener] Request error on /api/hooks/chat-pre-tool-use:',
            (err as Error).message
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/chat-pre-tool-use:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/chat-notification (Story 10.5)
    if (method === 'POST' && url === '/api/hooks/chat-notification') {
      try {
        const body = await this.parseBody(req)
        const parseResult = ChatNotificationHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error(
            '[HookListener] Invalid chat-notification hook payload:',
            parseResult.error.issues
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onChatNotificationHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        const isRequestError =
          err instanceof Error &&
          ['Invalid JSON', 'Request body too large', 'Request aborted'].includes(err.message)
        if (isRequestError) {
          console.error(
            '[HookListener] Request error on /api/hooks/chat-notification:',
            (err as Error).message
          )
          res.writeHead(400)
          res.end(JSON.stringify({ error: (err as Error).message }))
        } else {
          console.error('[HookListener] Handler error on /api/hooks/chat-notification:', err)
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      }
      return
    }

    // Route: POST /api/hooks/chat-status (StatusLine data)
    // CTM-1.2: Updated to read tmux_session from body and resolve session UUID
    // via tmux_session when session_uuid is missing or unresolvable.
    if (method === 'POST' && url === '/api/hooks/chat-status') {
      try {
        const body = await this.parseBody(req) as Record<string, unknown>
        let sessionUuid = body.session_id as string | undefined
        const tmuxSession = body.tmux_session as string | undefined
        const status = body.status as Record<string, unknown> | undefined

        // CTM-1.2: If sessionUuid is empty/missing but tmux_session is present,
        // resolve the session to discover its UUID for the status cache key
        if ((!sessionUuid || sessionUuid === '') && tmuxSession) {
          const resolved = this.resolveChatSession({
            session_id: sessionUuid || '',
            tmux_session: tmuxSession
          })
          if (resolved) {
            sessionUuid = resolved.session_uuid ?? undefined
          }
        }

        if (sessionUuid && status) {
          const contextWindow = status.context_window as Record<string, unknown> | undefined
          const rateLimits = status.rate_limits as Record<string, unknown> | undefined
          const fiveHour = rateLimits?.five_hour as Record<string, unknown> | undefined
          const sevenDay = rateLimits?.seven_day as Record<string, unknown> | undefined
          const model = status.model as Record<string, unknown> | undefined

          this.chatSessionStatus.set(sessionUuid, {
            contextUsedPercent: (contextWindow?.used_percentage as number) ?? null,
            fiveHourUsedPercent: (fiveHour?.used_percentage as number) ?? null,
            sevenDayUsedPercent: (sevenDay?.used_percentage as number) ?? null,
            fiveHourResetSeconds: (fiveHour?.reset_seconds as number) ?? null,
            sevenDayResetSeconds: (sevenDay?.reset_seconds as number) ?? null,
            model: (model?.display_name as string) ?? null,
            updatedAt: Date.now()
          })
        }

        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid payload' }))
      }
      return
    }

    // 404 for unknown routes
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }

  /**
   * Parse JSON body from request stream.
   *
   * @param req - Incoming HTTP request
   * @returns Parsed JSON body
   * @throws Error if body is invalid JSON or exceeds size limit
   */
  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let data = ''
      let size = 0
      let settled = false

      const doResolve = (value: unknown) => {
        if (!settled) {
          settled = true
          resolve(value)
        }
      }

      const doReject = (err: Error) => {
        if (!settled) {
          settled = true
          reject(err)
        }
      }

      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BODY_SIZE) {
          req.destroy()
          doReject(new Error('Request body too large'))
          return
        }
        data += chunk.toString()
      })

      req.on('end', () => {
        if (data.length === 0) {
          // Empty body - treat as empty object
          doResolve({})
          return
        }
        try {
          const parsed = JSON.parse(data)
          doResolve(parsed)
        } catch {
          doReject(new Error('Invalid JSON'))
        }
      })

      req.on('error', (err) => doReject(err instanceof Error ? err : new Error(String(err))))

      // Handle request abort/close to prevent promise leak
      req.on('close', () => {
        doReject(new Error('Request aborted'))
      })
    })
  }

  /**
   * Handle Stop hook event.
   *
   * Called when Claude Code session ends.
   * Logs agent_complete activity with duration calculated from agent_start.
   * Also detects and logs error events when agent exits with errors.
   *
   * @param payload - Stop hook payload
   *
   * @see TES-2.6: Agent Start/Complete Event Capture
   * @see TES-2.10: Error Event Capture
   */
  async onStopHook(payload: StopHookPayload): Promise<void> {
    console.log('[HookListener] Stop hook received:', JSON.stringify(payload, null, 2))

    // TES-2.6: Look up task_id from session_id
    // First, try to find a task_session with this session_id
    let session = db
      .select()
      .from(task_sessions)
      .where(eq(task_sessions.session_id, payload.session_id))
      .get()

    // TES-1.7: If session not found, try to register the orphan session_id
    // This handles the case where the Stop hook is the first hook event received
    if (!session) {
      console.log(
        `[HookListener] Session not found for ${payload.session_id}, attempting auto-registration...`
      )
      session = (await this.tryRegisterOrphanSession(payload.session_id)) ?? undefined

      if (!session) {
        console.warn(
          `[HookListener] Orphan stop event - could not register session_id:`,
          payload.session_id
        )
        return
      }
    }

    const taskId = session.task_id
    const phase = session.current_phase ?? 'manual'

    // Story 8.9 AC 3: Auto-commit uncommitted changes when agent finishes
    // This preserves agent work before transitioning to next workflow step
    try {
      await this.autoCommitOnAgentComplete(taskId)
    } catch (autoCommitError) {
      // Log warning but don't fail the whole hook processing
      console.warn('[HookListener] Auto-commit failed (non-critical):', autoCommitError)
    }

    // TES-2.10: Detect error condition from payload
    // Error indicators: exit_code > 0, error field present, or error_code field present
    const hasError = this.detectAgentError(payload)

    // TES-2.10: Log error event if agent exited with error
    if (hasError) {
      try {
        const errorMessage = this.extractErrorMessage(payload)
        const errorCode = payload.error_code ?? (payload.exit_code !== undefined ? `EXIT_${payload.exit_code}` : undefined)

        await ActivityLogService.logActivity(taskId, 'error', {
          message: errorMessage,
          code: errorCode,
          source: 'agent' as const
        })
      } catch (logError) {
        console.warn('[HookListener] Failed to log agent error activity:', logError)
        // Continue - don't let error logging break the main flow
      }
    }

    // TES-2.6: Calculate duration_ms from agent_start event timestamp
    let duration_ms: number | null = null
    try {
      // Query most recent agent_start event for this task
      const startEvents = db
        .select()
        .from(taskActivities)
        .where(
          and(
            eq(taskActivities.task_id, taskId),
            eq(taskActivities.event_type, 'agent_start')
          )
        )
        .orderBy(desc(taskActivities.created_at))
        .limit(1)
        .all()

      if (startEvents.length > 0) {
        const startTime = startEvents[0].created_at
        duration_ms = Date.now() - startTime
      } else {
        console.warn(`[HookListener] No agent_start event found for task ${taskId} - duration_ms will be null`)
      }
    } catch (error) {
      console.warn('[HookListener] Failed to calculate duration:', error)
    }

    // TES-2.6: Log agent_complete activity
    // TES-2.10: Wrap with hook delivery error capture
    try {
      await ActivityLogService.logActivity(taskId, 'agent_complete', {
        phase,
        duration_ms,
        session_id: payload.session_id
      })
    } catch (error) {
      console.error('[HookListener] Failed to log agent_complete activity:', error)
      // TES-2.10: Log hook delivery failure as error event
      await this.logHookDeliveryError(taskId, 'agent_complete', error)
    }

    // Story 9.5: Update workflow run status on agent completion
    try {
      await this.updateWorkflowRunOnComplete(taskId, hasError)
    } catch (wfError) {
      console.warn('[HookListener] Failed to update workflow run:', wfError)
    }

    // TES-2.9: Trigger AutomationService.onAgentComplete for workflow transitions
    // This logs the automation_trigger event and (in future) advances the workflow
    await AutomationService.onAgentComplete(taskId, phase)

    // Mark the session as ended in session history for traceability
    try {
      await TaskSessionService.markSessionEnded(payload.session_id)
    } catch (error) {
      console.warn('[HookListener] Failed to mark session as ended:', error)
    }
  }

  /**
   * Detect if the Stop hook payload indicates an agent error.
   *
   * Error conditions:
   * - exit_code > 0 (non-zero exit)
   * - error field is present and non-empty
   * - error_code field is present
   *
   * @param payload - Stop hook payload
   * @returns true if error detected
   *
   * @see TES-2.10: Error Event Capture
   */
  private detectAgentError(payload: StopHookPayload): boolean {
    // Check for non-zero exit code
    if (payload.exit_code !== undefined && payload.exit_code > 0) {
      return true
    }

    // Check for error message field
    if (payload.error && typeof payload.error === 'string' && payload.error.length > 0) {
      return true
    }

    // Check for error code field
    if (payload.error_code && typeof payload.error_code === 'string' && payload.error_code.length > 0) {
      return true
    }

    return false
  }

  /**
   * Extract error message from Stop hook payload.
   *
   * Priority:
   * 1. error field if present
   * 2. Construct message from exit_code if present
   * 3. Default message
   *
   * @param payload - Stop hook payload
   * @returns Human-readable error message
   *
   * @see TES-2.10: Error Event Capture
   */
  private extractErrorMessage(payload: StopHookPayload): string {
    // Use error field if present
    if (payload.error && typeof payload.error === 'string' && payload.error.length > 0) {
      // Truncate if too long
      if (payload.error.length > MAX_ERROR_LENGTH) {
        return payload.error.substring(0, MAX_ERROR_LENGTH) + '...'
      }
      return payload.error
    }

    // Construct message from exit code
    if (payload.exit_code !== undefined && payload.exit_code > 0) {
      return `Agent exited with code ${payload.exit_code}`
    }

    // Default message
    return 'Agent execution failed'
  }

  /**
   * Handle PostToolUse hook event.
   *
   * Called after each tool use in Claude Code.
   * Logs tool_used activity with tool-specific payload.
   *
   * @param payload - Tool use hook payload
   *
   * @see TES-2.7: Tool Usage Event Capture
   */
  async onToolUseHook(payload: ToolUseHookPayload): Promise<void> {
    console.log('[HookListener] Tool use hook received:', JSON.stringify(payload, null, 2))

    // TES-2.7 Task 1: Look up task_id from session_id (same pattern as onStopHook)
    let session = db
      .select()
      .from(task_sessions)
      .where(eq(task_sessions.session_id, payload.session_id))
      .get()

    // TES-1.7: If session not found, try to register the orphan session_id
    if (!session) {
      console.log(
        `[HookListener] Session not found for ${payload.session_id}, attempting auto-registration...`
      )
      session = (await this.tryRegisterOrphanSession(payload.session_id)) ?? undefined

      if (!session) {
        console.warn(
          `[HookListener] Orphan tool-use event - could not register session_id:`,
          payload.session_id
        )
        return
      }
    }

    const taskId = session.task_id

    // TES-2.7 Task 2: Build payload based on tool type
    const activityPayload: {
      tool: string
      file?: string
      command?: string
      summary?: string
    } = {
      tool: payload.tool_name
    }

    // TES-2.7 Task 3: Extract file path for file operations
    // Priority: file_path (Read/Edit/Write) → path (Glob/Grep directory) → pattern (Glob/Grep fallback)
    // For Glob/Grep, prefer 'path' over 'pattern' because the directory is more meaningful
    // for activity tracking than the glob/regex pattern itself.
    if (['Read', 'Edit', 'Write', 'Glob', 'Grep'].includes(payload.tool_name)) {
      const filePath =
        payload.tool_input.file_path ?? payload.tool_input.path ?? payload.tool_input.pattern
      if (filePath && typeof filePath === 'string') {
        activityPayload.file = filePath
      }
    }

    // TES-2.7 Task 5: Extract command for Bash tool (truncated to MAX_COMMAND_LENGTH chars)
    if (payload.tool_name === 'Bash') {
      const command = payload.tool_input.command
      if (command && typeof command === 'string') {
        activityPayload.command =
          command.length > MAX_COMMAND_LENGTH
            ? command.substring(0, MAX_COMMAND_LENGTH) + '...'
            : command
      }
    }

    // TES-2.7 Task 4: Generate summary for Edit tool
    if (payload.tool_name === 'Edit') {
      activityPayload.summary = this.generateEditSummary(payload.tool_input)
    }

    // TES-2.7: Log tool_used activity
    // TES-2.10: Wrap with hook delivery error capture
    try {
      await ActivityLogService.logActivity(taskId, 'tool_used', activityPayload)
    } catch (error) {
      console.error('[HookListener] Failed to log tool_used activity:', error)
      // TES-2.10: Log hook delivery failure as error event
      await this.logHookDeliveryError(taskId, 'tool_used', error)
    }
  }

  /**
   * Handle Chat Stop hook event (Story 10.1).
   *
   * Called when a Claude Code chat session ends.
   * Stores the last_assistant_message in chat_messages and updates session timestamps.
   * Does NOT trigger task automation or orphan registration.
   *
   * @param payload - Chat Stop hook payload
   *
   * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 3)
   */
  async onChatStopHook(payload: ChatStopHookPayload): Promise<void> {
    console.log('[HookListener] Chat stop hook received for session_id:', payload.session_id)

    // CTM-1.2: Use centralized session resolution (tmux_session cache -> tmux_session DB -> session_uuid DB)
    const session = this.resolveChatSession(payload)

    if (!session) {
      console.warn(
        `[HookListener] Chat stop event - no chat session found for session_id:`,
        payload.session_id
      )
      return
    }

    // Check if we already stored intermediate assistant text for this turn.
    // If so, skip storing again from Stop to prevent duplicates.
    const alreadyStoredIntermediate = this.turnTextExtracted.has(session.id)
    this.turnTextExtracted.delete(session.id)

    if (!alreadyStoredIntermediate) {
      // Resolve the assistant message: check payload field first, then fall back
      // to reading the Claude Code transcript JSONL file. Claude Code's Stop hook
      // payload may or may not include the response depending on version and mode.
      let assistantMessage: string | undefined =
        payload.last_assistant_message ??
        (payload as Record<string, unknown>).result as string | undefined

      // Fallback: read the transcript JSONL file and extract the last assistant text
      if (assistantMessage == null && payload.transcript_path) {
        try {
          assistantMessage = this.extractLastAssistantMessage(payload.transcript_path)
        } catch (err) {
          console.warn('[HookListener] Failed to read transcript for chat response:', err)
        }
      }

      if (assistantMessage != null) {
        const messageId = crypto.randomUUID()
        const now = new Date()

        db.insert(chat_messages)
          .values({
            id: messageId,
            session_id: session.id,
            role: 'assistant',
            content: assistantMessage,
            created_at: now
          })
          .run()

        // Update session timestamps
        db.update(chat_sessions)
          .set({
            last_message_at: now,
            updated_at: now
          })
          .where(eq(chat_sessions.id, session.id))
          .run()

        console.log(
          `[HookListener] Stored chat assistant message for session ${session.id}`
        )
      } else {
        console.warn(`[HookListener] No assistant message found for chat session ${session.id}`)
      }
    } else {
      console.log(
        `[HookListener] Skipping Stop assistant text for session ${session.id} — already stored during PreToolUse`
      )
      // Still update session timestamps
      const now = new Date()
      db.update(chat_sessions)
        .set({
          last_message_at: now,
          updated_at: now
        })
        .where(eq(chat_sessions.id, session.id))
        .run()
    }

    // Mark session as free so queued messages can be flushed
    if (this.chatCliService) {
      this.chatCliService.markSessionFree(session.id)
    }
  }

  /**
   * Extract the last assistant text message from a Claude Code transcript JSONL file.
   *
   * Claude Code stores conversations as JSONL where each line is a JSON object.
   * Assistant messages have `type: "assistant"` with `message.content` containing
   * an array of content blocks. We find the last entry with a `text` block.
   *
   * @param transcriptPath - Absolute path to the .jsonl transcript file
   * @returns The last assistant text message, or undefined if not found
   */
  private extractLastAssistantMessage(transcriptPath: string): string | undefined {
    if (!fs.existsSync(transcriptPath)) return undefined

    const content = fs.readFileSync(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n')

    // Walk backwards to find the last assistant message with text content
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as Record<string, unknown>
        if (entry.type !== 'assistant') continue

        const message = entry.message as Record<string, unknown> | undefined
        if (!message || message.role !== 'assistant') continue

        const contentBlocks = message.content as Array<Record<string, unknown>> | undefined
        if (!Array.isArray(contentBlocks)) continue

        // Find the last text block in the content array
        for (let j = contentBlocks.length - 1; j >= 0; j--) {
          if (contentBlocks[j].type === 'text' && typeof contentBlocks[j].text === 'string') {
            return contentBlocks[j].text as string
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    return undefined
  }

  /**
   * Extract the latest assistant text blocks from a Claude Code transcript JSONL.
   *
   * Reads backwards from the end to find the most recent assistant entry that
   * contains text content blocks (not just tool_use blocks). Returns the
   * concatenated text from all text blocks in that entry.
   *
   * This is used during execution (on first PreToolUse) to capture the
   * assistant's opening text before tool calls begin.
   *
   * @param transcriptPath - Absolute path to the .jsonl transcript file
   * @returns The assistant text, or undefined if none found or only tool_use blocks
   */
  private extractLatestAssistantTextBlocks(transcriptPath: string): string | undefined {
    if (!fs.existsSync(transcriptPath)) return undefined

    const content = fs.readFileSync(transcriptPath, 'utf-8')
    const lines = content.trim().split('\n')

    // Walk backwards to find the last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as Record<string, unknown>
        if (entry.type !== 'assistant') continue

        const message = entry.message as Record<string, unknown> | undefined
        if (!message || message.role !== 'assistant') continue

        const contentBlocks = message.content as Array<Record<string, unknown>> | undefined
        if (!Array.isArray(contentBlocks)) continue

        // Collect all text blocks from this entry
        const textParts: string[] = []
        for (const block of contentBlocks) {
          if (block.type === 'text' && typeof block.text === 'string') {
            textParts.push(block.text as string)
          }
        }

        // Only return if there are text blocks AND tool_use blocks (mixed turn).
        // If only text blocks exist, this is a pure text response that will be
        // captured by the Stop hook. We only want intermediate text before tools.
        const hasToolUse = contentBlocks.some((b) => b.type === 'tool_use')
        if (textParts.length > 0 && hasToolUse) {
          return textParts.join('\n\n')
        }

        // Found an assistant entry but it's pure tool_use or pure text — stop searching
        return undefined
      } catch {
        // Skip malformed lines
      }
    }

    return undefined
  }

  /**
   * Handle Chat Tool Use hook event (Story 10.1).
   *
   * Called after each tool use in a Claude Code chat session.
   * Stores the tool activity in chat_messages with role "tool".
   * Does NOT trigger task automation or orphan registration.
   *
   * @param payload - Chat Tool Use hook payload
   *
   * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 4)
   */
  async onChatToolUseHook(payload: ChatToolUseHookPayload): Promise<void> {
    console.log('[HookListener] Chat tool-use hook received:', JSON.stringify(payload, null, 2))

    // CTM-1.2: Use centralized session resolution (tmux_session cache -> tmux_session DB -> session_uuid DB)
    const session = this.resolveChatSession(payload)

    if (!session) {
      console.warn(
        `[HookListener] Chat tool-use event - no chat session found for session_id:`,
        payload.session_id
      )
      return
    }

    const messageId = crypto.randomUUID()
    const now = new Date()

    // Extract text from tool_response for display in the chat UI
    const responseText = this.extractToolResponseText(
      (payload as Record<string, unknown>).tool_response
    )
    const content = responseText || `Tool: ${payload.tool_name}`

    db.insert(chat_messages)
      .values({
        id: messageId,
        session_id: session.id,
        role: 'tool',
        content,
        tool_name: payload.tool_name,
        tool_input: JSON.stringify(payload.tool_input),
        created_at: now
      })
      .run()

    // Update session timestamps
    db.update(chat_sessions)
      .set({
        updated_at: now
      })
      .where(eq(chat_sessions.id, session.id))
      .run()

    console.log(
      `[HookListener] Stored chat tool-use event for session ${session.id}: ${payload.tool_name}`
    )

    // Story 10.7: Detect artifact writes in planning-artifacts directory (AC: 1)
    const isArtifactWrite =
      (payload.tool_name === 'Write' || payload.tool_name === 'Edit') &&
      typeof payload.tool_input?.file_path === 'string' &&
      payload.tool_input.file_path.includes('_bmad-output/planning-artifacts/')

    if (isArtifactWrite) {
      const filePath = payload.tool_input.file_path as string
      const filename = basename(filePath)
      const matchedWorkflow = BMAD_WORKFLOWS.find((w) => w.filename === filename)
      const workflowKey = matchedWorkflow?.workflowKey ?? null

      const artifactMessageId = crypto.randomUUID()

      db.insert(chat_messages)
        .values({
          id: artifactMessageId,
          session_id: session.id,
          role: 'tool',
          content: `Artifact created: ${filename}`,
          tool_name: '__artifact_created__',
          tool_input: JSON.stringify({ filename, workflowKey, filePath }),
          created_at: now
        })
        .run()

      console.log(
        `[HookListener] Artifact detected in chat session ${session.id}: ${filename} (workflowKey: ${workflowKey})`
      )
    }
  }

  /**
   * Handle Chat PreToolUse hook event (Story 10.5).
   *
   * Called before each tool use in a Claude Code chat session.
   * Stores the tool activity in chat_messages with role "tool" and
   * content prefix "PreToolUse:" to distinguish from PostToolUse events.
   *
   * @param payload - Chat PreToolUse hook payload
   *
   * @see Story 10.5: Tool Activity & Working Indicators (AC: 1)
   */
  async onChatPreToolUseHook(payload: ChatPreToolUseHookPayload): Promise<void> {
    console.log('[HookListener] Chat pre-tool-use hook received:', JSON.stringify(payload, null, 2))

    // CTM-1.2: Use centralized session resolution (tmux_session cache -> tmux_session DB -> session_uuid DB)
    const session = this.resolveChatSession(payload)

    if (!session) {
      console.warn(
        `[HookListener] Chat pre-tool-use event - no chat session found for session_id:`,
        payload.session_id
      )
      return
    }

    const now = new Date()

    // Extract assistant text from transcript on the first tool call of a turn.
    // Claude Code writes text blocks to the transcript BEFORE firing PreToolUse hooks,
    // so by now the assistant's opening text (e.g., "Let me investigate...") is available.
    // Only mark as extracted when text is actually stored — otherwise the Stop hook
    // must still store the final assistant message.
    if (!this.turnTextExtracted.has(session.id)) {
      const transcriptPath = (payload as Record<string, unknown>).transcript_path as string | undefined
      if (transcriptPath) {
        try {
          const assistantText = this.extractLatestAssistantTextBlocks(transcriptPath)
          if (assistantText) {
            this.turnTextExtracted.add(session.id)
            const assistantMsgId = crypto.randomUUID()
            db.insert(chat_messages)
              .values({
                id: assistantMsgId,
                session_id: session.id,
                role: 'assistant',
                content: assistantText,
                created_at: new Date(now.getTime() - 1) // 1ms before tool event for correct ordering
              })
              .run()
            console.log(
              `[HookListener] Stored intermediate assistant text for session ${session.id} (${assistantText.length} chars)`
            )
          }
        } catch (err) {
          console.warn('[HookListener] Failed to extract intermediate assistant text:', err)
        }
      }
    }

    const messageId = crypto.randomUUID()

    db.insert(chat_messages)
      .values({
        id: messageId,
        session_id: session.id,
        role: 'tool',
        content: `PreToolUse: ${payload.tool_name}`,
        tool_name: payload.tool_name,
        tool_input: JSON.stringify(payload.tool_input),
        created_at: now
      })
      .run()

    // Update session timestamps
    db.update(chat_sessions)
      .set({
        updated_at: now
      })
      .where(eq(chat_sessions.id, session.id))
      .run()

    console.log(
      `[HookListener] Stored chat pre-tool-use event for session ${session.id}: ${payload.tool_name}`
    )
  }

  /**
   * Determine whether to auto-approve or wait for user decision on a PreToolUse event.
   *
   * When skip_permissions is true (default): returns 'allow' immediately.
   * When skip_permissions is false: stores a permission request in the DB,
   * holds the response until the user clicks Approve/Deny in the chat UI,
   * then returns the decision.
   */
  private async resolvePreToolUseDecision(payload: ChatPreToolUseHookPayload): Promise<'allow' | 'deny'> {
    // CTM-1.2: Use centralized session resolution
    const session = this.resolveChatSession(payload)

    if (!session) {
      // Can't find session — auto-approve to avoid blocking
      return 'allow'
    }

    // Auto-approve mode: respond instantly
    if (session.skip_permissions) {
      return 'allow'
    }

    // Manual approval mode: hold response until user decides
    const requestId = crypto.randomUUID()
    console.log(
      `[HookListener] Permission required for session ${session.id}: ${payload.tool_name} (requestId: ${requestId})`
    )

    // Store permission request as a special chat message so the UI can render it
    db.insert(chat_messages)
      .values({
        id: crypto.randomUUID(),
        session_id: session.id,
        role: 'tool',
        content: `Permission request: ${payload.tool_name}`,
        tool_name: '__permission_request__',
        tool_input: JSON.stringify({
          requestId,
          toolName: payload.tool_name,
          toolInput: payload.tool_input
        }),
        created_at: new Date()
      })
      .run()

    // Create a Promise that resolves when the user clicks Approve/Deny
    return new Promise<'allow' | 'deny'>((resolve) => {
      // 4-minute timeout (under the 5-min curl --max-time)
      const timeout = setTimeout(() => {
        if (this.pendingPermissions.has(requestId)) {
          this.pendingPermissions.delete(requestId)
          console.warn(`[HookListener] Permission ${requestId} timed out, auto-denying`)

          // Store timeout message in chat
          db.insert(chat_messages)
            .values({
              id: crypto.randomUUID(),
              session_id: session.id,
              role: 'tool',
              content: 'Permission request timed out (auto-denied after 4 minutes)',
              tool_name: '__notification__',
              tool_input: JSON.stringify({ type: 'permission_timeout', message: `Tool "${payload.tool_name}" permission request timed out` }),
              created_at: new Date()
            })
            .run()

          resolve('deny')
        }
      }, 4 * 60 * 1000) // 4 minutes

      this.pendingPermissions.set(requestId, {
        resolve,
        sessionId: session.id,
        toolName: payload.tool_name,
        timeout
      })
    })
  }

  /**
   * Handle Chat Notification hook event (Story 10.5).
   *
   * Called when a notification event occurs in a Claude Code chat session
   * (e.g., permission prompts). Stores as a chat_message with role "tool"
   * and tool_name "__notification__".
   *
   * @param payload - Chat Notification hook payload
   *
   * @see Story 10.5: Tool Activity & Working Indicators (AC: 5)
   */
  async onChatNotificationHook(payload: ChatNotificationHookPayload): Promise<void> {
    console.log('[HookListener] Chat notification hook received:', JSON.stringify(payload, null, 2))

    // CTM-1.2: Use centralized session resolution (tmux_session cache -> tmux_session DB -> session_uuid DB)
    const session = this.resolveChatSession(payload)

    if (!session) {
      console.warn(
        `[HookListener] Chat notification event - no chat session found for session_id:`,
        payload.session_id
      )
      return
    }

    const messageId = crypto.randomUUID()
    const now = new Date()

    db.insert(chat_messages)
      .values({
        id: messageId,
        session_id: session.id,
        role: 'tool',
        content: `Notification: ${payload.type}: ${payload.message}`,
        tool_name: '__notification__',
        tool_input: JSON.stringify({ type: payload.type, message: payload.message }),
        created_at: now
      })
      .run()

    // Update session timestamps
    db.update(chat_sessions)
      .set({
        updated_at: now
      })
      .where(eq(chat_sessions.id, session.id))
      .run()

    console.log(
      `[HookListener] Stored chat notification for session ${session.id}: ${payload.type}`
    )
  }

  /**
   * Try to register an orphan session_id with an active task.
   *
   * When a hook event arrives with a session_id that's not in the database,
   * this method attempts to find an active task_session (has tmux session but
   * no session_id yet) and register the session_id with it.
   *
   * This handles the case where Claude Code starts inside a tmux session and
   * the first hook event fires before the session_id has been registered.
   *
   * @param sessionId - The Claude Code session_id from the hook payload
   * @returns The task_session record if registration succeeded, null otherwise
   *
   * @see TES-1.7: Session-Task Mapping & Event Routing
   */
  private async tryRegisterOrphanSession(sessionId: string): Promise<typeof task_sessions.$inferSelect | null> {
    // Find active task_sessions with null session_id
    // Active means: has tmux session and current_phase is NOT 'ended'
    const activeSessions = db
      .select()
      .from(task_sessions)
      .where(
        and(
          isNull(task_sessions.session_id),
          // current_phase is null (active) or not 'ended'
          // Note: null means active, 'ended' means historical
          // We want: session_id IS NULL AND (current_phase IS NULL OR current_phase != 'ended')
        )
      )
      .all()
      .filter(s => s.current_phase !== 'ended')

    if (activeSessions.length === 0) {
      console.warn(
        `[HookListener] No active task sessions without session_id found for orphan:`,
        sessionId
      )
      return null
    }

    if (activeSessions.length > 1) {
      // Multiple active sessions - ambiguous, can't auto-register
      // Log which sessions are active for debugging
      console.warn(
        `[HookListener] Multiple active task sessions without session_id (${activeSessions.length}):`,
        activeSessions.map(s => ({ task_id: s.task_id, tmux_session: s.tmux_session }))
      )
      // Still try to register with the most recently created one (best guess)
      const mostRecent = activeSessions.reduce((latest, current) =>
        current.created_at > latest.created_at ? current : latest
      )
      console.log(
        `[HookListener] Auto-registering session_id with most recent task:`,
        mostRecent.task_id
      )
      // Pass current_phase as workflow type for session history tracking
      await TaskSessionService.updateSessionId(mostRecent.task_id, sessionId, mostRecent.current_phase ?? undefined)

      // Return the updated session
      return db
        .select()
        .from(task_sessions)
        .where(eq(task_sessions.session_id, sessionId))
        .get() ?? null
    }

    // Exactly one active session - register the session_id
    const targetSession = activeSessions[0]
    console.log(
      `[HookListener] Auto-registering orphan session_id ${sessionId} with task ${targetSession.task_id}`
    )

    // Pass current_phase as workflow type for session history tracking
    await TaskSessionService.updateSessionId(targetSession.task_id, sessionId, targetSession.current_phase ?? undefined)

    // Return the updated session
    return db
      .select()
      .from(task_sessions)
      .where(eq(task_sessions.session_id, sessionId))
      .get() ?? null
  }

  /**
   * Extract human-readable text from a tool_response payload.
   * Handles different response shapes: strings, arrays with text elements,
   * and objects with content/text fields. Truncates to 4000 chars.
   */
  private extractToolResponseText(toolResponse: unknown): string | null {
    if (!toolResponse) return null

    try {
      // Direct string response (e.g., Bash stdout, Read file content)
      if (typeof toolResponse === 'string') {
        return toolResponse.slice(0, 4000)
      }

      if (typeof toolResponse !== 'object') return null

      const resp = toolResponse as Record<string, unknown>

      // WebSearch: results array contains objects (title/url) and text strings
      if (Array.isArray(resp.results)) {
        const textParts = resp.results.filter((r): r is string => typeof r === 'string')
        if (textParts.length > 0) {
          return textParts.join('\n').slice(0, 4000)
        }
      }

      // Generic: look for common text fields
      if (typeof resp.content === 'string') return resp.content.slice(0, 4000)
      if (typeof resp.text === 'string') return resp.text.slice(0, 4000)
      if (typeof resp.stdout === 'string') return resp.stdout.slice(0, 4000)
      if (typeof resp.output === 'string') return resp.output.slice(0, 4000)

      // Fallback: stringify the response (truncated)
      const json = JSON.stringify(resp, null, 2)
      if (json.length > 50) return json.slice(0, 4000)

      return null
    } catch {
      return null
    }
  }

  /**
   * Log a hook delivery failure as an error event.
   *
   * When logging an activity fails (e.g., agent_complete, tool_used),
   * this method attempts to log the delivery failure itself as an error event.
   *
   * @param taskId - Task ID the original event was for
   * @param originalEventType - The event type that failed to log
   * @param error - The error that caused the failure
   *
   * @see TES-2.10: Error Event Capture (AC: #2)
   */
  private async logHookDeliveryError(
    taskId: string,
    originalEventType: string,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error && error.stack
      ? (error.stack.length > MAX_STACK_LENGTH ? error.stack.substring(0, MAX_STACK_LENGTH) + '...' : error.stack)
      : undefined

    try {
      await ActivityLogService.logActivity(taskId, 'error', {
        message: `Failed to log ${originalEventType} event: ${errorMessage}`,
        code: 'HOOK_DELIVERY_FAILED',
        source: 'hook_delivery' as const,
        stack
      })
    } catch (logError) {
      // Last resort - just log to console if even error logging fails
      console.error('[HookListener] Failed to log hook delivery error event:', logError)
    }
  }

  /**
   * Generate a summary for Edit tool usage.
   * Format: "+N -M" showing lines added/removed (git-style), or "file edited" if calculation not possible.
   *
   * For replacements, shows actual lines: old lines are removed, new lines are added.
   * Example: replacing 3 lines with 5 lines = "+5 -3"
   *
   * @param toolInput - The tool_input from Edit tool
   * @returns Human-readable summary of the edit
   *
   * @see TES-2.7: Tool Usage Event Capture
   */
  private generateEditSummary(toolInput: Record<string, unknown>): string {
    const oldString = toolInput.old_string
    const newString = toolInput.new_string

    if (typeof oldString !== 'string' || typeof newString !== 'string') {
      return 'file edited'
    }

    const oldLines = oldString.split('\n').length
    const newLines = newString.split('\n').length

    if (oldLines === newLines) {
      // Same line count but content changed
      return `${newLines} lines modified`
    }

    // Show actual lines replaced (git-style: lines added, lines removed)
    return `+${newLines} -${oldLines}`
  }

  /**
   * Update the workflow run record when an agent completes or fails.
   *
   * Story 9.5: Guided Workflow Run Tracker (AC: 3)
   *
   * @param taskId - Task ID to find the active workflow run for
   * @param hasError - Whether the agent exited with an error
   */
  private async updateWorkflowRunOnComplete(taskId: string, hasError: boolean): Promise<void> {
    // Check if the task is a planning task
    const task = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get()

    if (!task || task.task_type !== 'planning') {
      return
    }

    // Find the active workflow_run for this task (running OR needs-input)
    const activeRun = db
      .select()
      .from(workflow_runs)
      .where(
        and(
          eq(workflow_runs.task_id, taskId),
          or(
            eq(workflow_runs.status, 'running'),
            eq(workflow_runs.status, 'needs-input')
          )
        )
      )
      .get()

    if (!activeRun) {
      console.log(`[HookListener] No active workflow run found for task ${taskId}`)
      return
    }

    const newStatus = hasError ? 'failed' : 'succeeded'
    const now = new Date()

    // Determine output artifacts from BMAD_WORKFLOWS constant (statically imported)
    let outputArtifacts: string[] | null = null
    if (!hasError) {
      const wf = BMAD_WORKFLOWS.find((w) => w.workflowKey === activeRun.workflow_key)
      if (wf?.filename) {
        outputArtifacts = [wf.filename]
      }
    }

    // Update only if the run is still in the expected active state (prevents TOCTOU double-update)
    db.update(workflow_runs)
      .set({
        status: newStatus,
        finished_at: now,
        output_artifacts: outputArtifacts ? JSON.stringify(outputArtifacts) : null
      })
      .where(
        and(
          eq(workflow_runs.id, activeRun.id),
          or(
            eq(workflow_runs.status, 'running'),
            eq(workflow_runs.status, 'needs-input')
          )
        )
      )
      .run()

    console.log(`[HookListener] Updated workflow run ${activeRun.id} to ${newStatus}`)
  }

  /**
   * Auto-commit uncommitted changes in a task's worktree when agent completes.
   *
   * This preserves the agent's work by creating a "WIP: Agent changes" commit
   * if there are any uncommitted changes in the worktree.
   *
   * @param taskId - Task ID to check for worktree and commit changes
   *
   * @see Story 8.9: AC 3 - Auto-commit on agent completion
   */
  private async autoCommitOnAgentComplete(taskId: string): Promise<void> {
    // Get the task to find its worktree_path
    const task = db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get()

    if (!task) {
      console.log(`[HookListener] Auto-commit skipped: task ${taskId} not found`)
      return
    }

    // Only tasks with worktrees can have uncommitted changes
    if (!task.worktree_path) {
      console.log(`[HookListener] Auto-commit skipped: task ${taskId} has no worktree`)
      return
    }

    // Call GitService to auto-commit any uncommitted changes
    console.log(`[HookListener] Auto-committing changes in worktree for task ${taskId}`)
    const result = await GitService.autoCommitWorktreeChanges(task.worktree_path)

    if (result.committed) {
      console.log(`[HookListener] Auto-committed changes in worktree ${task.worktree_path}: ${result.commitSha}`)

      // Log the auto-commit as an activity
      try {
        await ActivityLogService.logActivity(taskId, 'auto_commit', {
          commit_sha: result.commitSha,
          message: 'WIP: Agent changes'
        })
      } catch (logError) {
        console.warn('[HookListener] Failed to log auto_commit activity:', logError)
      }
    } else {
      console.log(`[HookListener] No uncommitted changes to auto-commit in worktree ${task.worktree_path}`)
    }
  }
}
