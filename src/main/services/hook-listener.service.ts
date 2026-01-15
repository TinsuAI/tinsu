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

/** Default port for the hook listener HTTP server */
const DEFAULT_PORT = 3847

/** Path to the port file that hook scripts read */
const PORT_FILE = '/tmp/tinsu-hook-port'

/** Maximum body size for incoming requests (64KB) */
const MAX_BODY_SIZE = 64 * 1024

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
   * Logs the event for debugging.
   *
   * @param payload - Stop hook payload
   *
   * TODO: TES-2.6 - Call ActivityLogService to log agent_complete event
   * TODO: TES-2.6 - Trigger AutomationService.onAgentComplete()
   */
  async onStopHook(payload: StopHookPayload): Promise<void> {
    console.log('[HookListener] Stop hook received:', JSON.stringify(payload, null, 2))
    // Future integration points (TES-2.6):
    // - Call ActivityLogService to log agent_complete event
    // - Trigger AutomationService.onAgentComplete() for workflow transitions
  }

  /**
   * Handle PostToolUse hook event.
   *
   * Called after each tool use in Claude Code.
   * Logs the event for debugging.
   *
   * @param payload - Tool use hook payload
   *
   * TODO: TES-2.7 - Call ActivityLogService to log tool_used event
   */
  async onToolUseHook(payload: ToolUseHookPayload): Promise<void> {
    console.log('[HookListener] Tool use hook received:', JSON.stringify(payload, null, 2))
    // Future integration point (TES-2.7):
    // - Call ActivityLogService to log tool_used event
  }
}
