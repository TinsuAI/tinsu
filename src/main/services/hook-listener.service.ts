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
import { z } from 'zod'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db'
import { task_sessions, taskActivities } from '../db/schema'
import { ActivityLogService } from './activity-log.service'
import { AutomationService } from './automation.service'

/** Default port for the hook listener HTTP server */
const DEFAULT_PORT = 3847

/** Path to the port file that hook scripts read */
const PORT_FILE = '/tmp/tinsu-hook-port'

/** Maximum body size for incoming requests (64KB) */
const MAX_BODY_SIZE = 64 * 1024

/** Maximum command length before truncation (TES-2.7) */
const MAX_COMMAND_LENGTH = 100

/**
 * Zod schema for Stop hook payload validation.
 * Validates payloads from Claude Code Stop hook.
 */
export const StopHookPayloadSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  hook_event_name: z.literal('Stop')
})

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
          console.error('[HookListener] Invalid stop hook payload:', parseResult.error.errors)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.errors }))
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
          console.error('[HookListener] Invalid tool-use hook payload:', parseResult.error.errors)
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid payload', details: parseResult.error.errors }))
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
   *
   * @param payload - Stop hook payload
   *
   * @see TES-2.6: Agent Start/Complete Event Capture
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

    // If no session found, this might be the first hook event for this session.
    // The session_id may not have been set yet. We need a different approach.
    // For now, log as orphan if not found (session_id mapping happens via other means).
    if (!session) {
      console.warn(
        `[HookListener] Orphan stop event - session_id not found in task_sessions:`,
        payload.session_id
      )
      // TES-2.6 Task 2.3: Handle orphan events gracefully
      return
    }

    const taskId = session.task_id
    const phase = session.current_phase ?? 'manual'

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
    try {
      await ActivityLogService.logActivity(taskId, 'agent_complete', {
        phase,
        duration_ms,
        session_id: payload.session_id
      })
    } catch (error) {
      console.error('[HookListener] Failed to log agent_complete activity:', error)
    }

    // TES-2.9: Trigger AutomationService.onAgentComplete for workflow transitions
    // This logs the automation_trigger event and (in future) advances the workflow
    await AutomationService.onAgentComplete(taskId, phase)
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
    const session = db
      .select()
      .from(task_sessions)
      .where(eq(task_sessions.session_id, payload.session_id))
      .get()

    if (!session) {
      console.warn(
        `[HookListener] Orphan tool-use event - session_id not found:`,
        payload.session_id
      )
      return
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
    try {
      await ActivityLogService.logActivity(taskId, 'tool_used', activityPayload)
    } catch (error) {
      console.error('[HookListener] Failed to log tool_used activity:', error)
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
}
