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
    last_assistant_message: z.string().optional(),
    cwd: z.string(),
    transcript_path: z.string()
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
    hook_event_name: z.literal('PostToolUse')
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
    hook_event_name: z.literal('PreToolUse')
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
    type: z.string(),
    message: z.string(),
    hook_event_name: z.literal('Notification')
  })
  .passthrough()

/** Chat Notification hook payload type */
export type ChatNotificationHookPayload = z.infer<typeof ChatNotificationHookPayloadSchema>

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

  /** Reference to ChatCliService for chat orphan UUID registration */
  private chatCliService: ChatCliService | null = null

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
    if (method === 'POST' && url === '/api/hooks/chat-stop') {
      try {
        const body = await this.parseBody(req)
        const parseResult = ChatStopHookPayloadSchema.safeParse(body)
        if (!parseResult.success) {
          console.error('[HookListener] Invalid chat-stop hook payload:', parseResult.error.issues)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.issues }))
          return
        }
        await this.onChatStopHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
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
        await this.onChatPreToolUseHook(parseResult.data)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
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

    // Look up chat_sessions by matching session_uuid = payload.session_id
    let session = db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.session_uuid, payload.session_id))
      .get()

    // If not found, Claude Code may have ignored --session-id and used its own UUID.
    // Try to match with a recently-spawned session via chatCliService.
    if (!session) {
      session = this.tryRegisterChatOrphan(payload.session_id) ?? undefined
    }

    if (!session) {
      console.warn(
        `[HookListener] Chat stop event - no chat session found for session_id:`,
        payload.session_id
      )
      return
    }

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

    // Look up chat_sessions by matching session_uuid = payload.session_id
    let session = db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.session_uuid, payload.session_id))
      .get()

    if (!session) {
      session = this.tryRegisterChatOrphan(payload.session_id) ?? undefined
    }

    if (!session) {
      console.warn(
        `[HookListener] Chat tool-use event - no chat session found for session_id:`,
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
        content: `Tool: ${payload.tool_name}`,
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

    // Look up chat_sessions by matching session_uuid = payload.session_id
    let session = db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.session_uuid, payload.session_id))
      .get()

    if (!session) {
      session = this.tryRegisterChatOrphan(payload.session_id) ?? undefined
    }

    if (!session) {
      console.warn(
        `[HookListener] Chat pre-tool-use event - no chat session found for session_id:`,
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

    // Look up chat_sessions by matching session_uuid = payload.session_id
    let session = db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.session_uuid, payload.session_id))
      .get()

    if (!session) {
      session = this.tryRegisterChatOrphan(payload.session_id) ?? undefined
    }

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
   * Try to register an orphan chat session UUID.
   *
   * When Claude Code ignores the --session-id flag and generates its own UUID,
   * hook events arrive with a session_id that doesn't match any chat_sessions.session_uuid.
   * This method uses chatCliService to find the TinSu session that was expecting a
   * different UUID, and updates the DB to match the actual Claude Code UUID.
   *
   * @param actualUuid - The actual Claude Code session UUID from the hook event
   * @returns The chat_sessions record if registration succeeded, null otherwise
   */
  private tryRegisterChatOrphan(actualUuid: string): typeof chat_sessions.$inferSelect | null {
    if (!this.chatCliService) return null

    const orphan = this.chatCliService.findOrphanSession(actualUuid)
    if (!orphan) return null

    // Update DB session_uuid to match the actual Claude Code UUID
    db.update(chat_sessions)
      .set({ session_uuid: actualUuid, updated_at: new Date() })
      .where(eq(chat_sessions.id, orphan.sessionId))
      .run()

    // Update the in-memory tracking in chatCliService
    this.chatCliService.updateSessionUuid(orphan.sessionId, actualUuid)

    console.log(
      `[HookListener] Registered actual Claude Code UUID for chat session ${orphan.sessionId}: ` +
        `${orphan.expectedUuid} → ${actualUuid}`
    )

    return db
      .select()
      .from(chat_sessions)
      .where(eq(chat_sessions.id, orphan.sessionId))
      .get() ?? null
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
      if (wf) {
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
