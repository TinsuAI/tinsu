/**
 * Hook Listener Service Tests - TES-2.3
 *
 * Tests for the HTTP server that receives Claude Code hook events.
 *
 * @see TES-2.3: Hook Listener HTTP Server
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as http from 'http'
import {
  HookListenerService,
  type StopHookPayload,
  type ToolUseHookPayload
} from './hook-listener.service'

// Mock database and ActivityLogService for TES-2.6 tests
const mockDbSelectGet = vi.fn()
const mockDbSelectAll = vi.fn()
const mockDbSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      get: mockDbSelectGet,
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          all: mockDbSelectAll
        }))
      }))
    }))
  }))
}))

vi.mock('../db', () => ({
  db: {
    select: () => mockDbSelect()
  }
}))

vi.mock('../db/schema', () => ({
  task_sessions: { session_id: 'session_id', task_id: 'task_id' },
  taskActivities: { task_id: 'task_id', event_type: 'event_type', created_at: 'created_at' }
}))

const mockLogActivity = vi.fn()
vi.mock('./activity-log.service', () => ({
  ActivityLogService: {
    logActivity: (...args: unknown[]) => mockLogActivity(...args)
  }
}))

const PORT_FILE = '/tmp/tinsu-hook-port'

/**
 * Helper to make HTTP requests to the hook listener.
 */
async function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(data)
        } catch {
          parsedBody = data
        }
        resolve({ status: res.statusCode || 0, body: parsedBody })
      })
    })

    req.on('error', reject)

    if (body !== undefined) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

describe('HookListenerService', () => {
  let service: HookListenerService
  let testPort: number

  // Counter to ensure unique ports per test
  let portCounter = 38500

  beforeEach(() => {
    vi.clearAllMocks()
    service = new HookListenerService()
    // Each test gets a unique port to avoid conflicts
    testPort = portCounter++
    // Reset database mocks
    mockDbSelectGet.mockReset()
    mockDbSelectAll.mockReset()
    mockLogActivity.mockReset()
  })

  afterEach(async () => {
    // Ensure server is stopped after each test
    if (service.isRunning()) {
      await service.stop()
    }
    // Clean up port file if it exists
    if (fs.existsSync(PORT_FILE)) {
      fs.unlinkSync(PORT_FILE)
    }
  })

  describe('start()', () => {
    it('should start server and listen on specified port', async () => {
      await service.start(testPort)

      expect(service.isRunning()).toBe(true)
      expect(service.getPort()).toBe(testPort)
    })

    it('should write port to port file', async () => {
      await service.start(testPort)

      expect(fs.existsSync(PORT_FILE)).toBe(true)
      const writtenPort = fs.readFileSync(PORT_FILE, 'utf-8')
      expect(writtenPort).toBe(String(testPort))
    })

    it('should use default port 3847 when not specified', async () => {
      // Test that getPort() returns 3847 before starting (default value)
      const defaultService = new HookListenerService()
      expect(defaultService.getPort()).toBe(3847)

      // Try to start on default port - may fail if 3847 is in use
      try {
        await defaultService.start()
        // Verify port is still 3847 after starting
        expect(defaultService.getPort()).toBe(3847)
        expect(defaultService.isRunning()).toBe(true)
        await defaultService.stop()
      } catch (err) {
        // If port 3847 is already in use, verify the error message
        expect((err as Error).message).toBe('Port 3847 is already in use')
        // The default port value should still be correct even if start failed
        expect(defaultService.getPort()).toBe(3847)
      }
    })

    it('should reject with error if port is already in use', async () => {
      // Start first server
      await service.start(testPort)

      // Try to start second server on same port
      const secondService = new HookListenerService()
      await expect(secondService.start(testPort)).rejects.toThrow(
        `Port ${testPort} is already in use`
      )
    })
  })

  describe('stop()', () => {
    it('should stop server gracefully', async () => {
      await service.start(testPort)
      expect(service.isRunning()).toBe(true)

      await service.stop()
      expect(service.isRunning()).toBe(false)
    })

    it('should clean up port file on stop', async () => {
      await service.start(testPort)
      expect(fs.existsSync(PORT_FILE)).toBe(true)

      await service.stop()
      expect(fs.existsSync(PORT_FILE)).toBe(false)
    })

    it('should be idempotent when called multiple times', async () => {
      await service.start(testPort)

      await service.stop()
      await service.stop() // Should not throw
      await service.stop() // Should not throw

      expect(service.isRunning()).toBe(false)
    })

    it('should work even if server was never started', async () => {
      // Should not throw
      await expect(service.stop()).resolves.toBeUndefined()
    })
  })

  describe('GET /api/hooks/health', () => {
    it('should return 200 with status ok', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'GET', '/api/hooks/health')

      expect(response.status).toBe(200)
      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ok',
          port: testPort
        })
      )
    })

    it('should include uptime in response', async () => {
      await service.start(testPort)

      // Wait a bit to ensure uptime > 0
      await new Promise((resolve) => setTimeout(resolve, 100))

      const response = await makeRequest(testPort, 'GET', '/api/hooks/health')

      expect(response.status).toBe(200)
      expect((response.body as { uptime: number }).uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('POST /api/hooks/stop', () => {
    it('should parse valid payload and return 200', async () => {
      await service.start(testPort)

      const payload: StopHookPayload = {
        session_id: 'test-session-123',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      const response = await makeRequest(testPort, 'POST', '/api/hooks/stop', payload)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
    })

    it('should call onStopHook handler with payload', async () => {
      await service.start(testPort)

      const onStopHookSpy = vi.spyOn(service, 'onStopHook')

      const payload: StopHookPayload = {
        session_id: 'test-session-456',
        transcript_path: '/tmp/transcript2.json',
        cwd: '/home/user/another-project',
        hook_event_name: 'Stop'
      }

      await makeRequest(testPort, 'POST', '/api/hooks/stop', payload)

      expect(onStopHookSpy).toHaveBeenCalledWith(payload)
    })

    it('should return 400 for invalid JSON', async () => {
      await service.start(testPort)

      // Send raw invalid JSON
      const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/hooks/stop',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          },
          (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              resolve({ status: res.statusCode || 0, body: JSON.parse(data) })
            })
          }
        )
        req.on('error', reject)
        req.write('not valid json {{{')
        req.end()
      })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'Invalid JSON' })
    })

    it('should return 400 for empty body (fails Zod validation)', async () => {
      await service.start(testPort)

      // Send request with no body
      const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/hooks/stop',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          },
          (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              resolve({ status: res.statusCode || 0, body: JSON.parse(data) })
            })
          }
        )
        req.on('error', reject)
        req.end() // No body
      })

      // Empty body fails Zod validation since required fields are missing
      expect(response.status).toBe(400)
      expect(response.body).toEqual(
        expect.objectContaining({ error: 'Invalid payload' })
      )
    })

    it('should return 400 for request body exceeding 64KB limit', async () => {
      await service.start(testPort)

      // Create a body larger than 64KB (65KB)
      const largePayload = { data: 'x'.repeat(65 * 1024) }

      const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/hooks/stop',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          },
          (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              try {
                resolve({ status: res.statusCode || 0, body: JSON.parse(data) })
              } catch {
                resolve({ status: res.statusCode || 0, body: data })
              }
            })
          }
        )
        req.on('error', (err) => {
          // Connection may be reset when body too large - this is expected
          resolve({ status: 0, body: { error: err.message } })
        })
        req.write(JSON.stringify(largePayload))
        req.end()
      })

      // Either server responds with 400 or connection is reset
      if (response.status !== 0) {
        expect(response.status).toBe(400)
        expect(response.body).toEqual({ error: 'Request body too large' })
      }
      // If status is 0, connection was reset which is acceptable behavior
    })
  })

  describe('POST /api/hooks/tool-use', () => {
    it('should parse valid payload and return 200', async () => {
      await service.start(testPort)

      const payload: ToolUseHookPayload = {
        session_id: 'test-session-789',
        tool_name: 'Read',
        tool_input: { file_path: '/home/user/file.ts' },
        hook_event_name: 'PostToolUse'
      }

      const response = await makeRequest(testPort, 'POST', '/api/hooks/tool-use', payload)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
    })

    it('should call onToolUseHook handler with payload', async () => {
      await service.start(testPort)

      const onToolUseHookSpy = vi.spyOn(service, 'onToolUseHook')

      const payload: ToolUseHookPayload = {
        session_id: 'test-session-abc',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/test.ts', content: 'console.log("test")' },
        hook_event_name: 'PostToolUse'
      }

      await makeRequest(testPort, 'POST', '/api/hooks/tool-use', payload)

      expect(onToolUseHookSpy).toHaveBeenCalledWith(payload)
    })

    it('should return 400 for invalid JSON', async () => {
      await service.start(testPort)

      const response = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/hooks/tool-use',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          },
          (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              resolve({ status: res.statusCode || 0, body: JSON.parse(data) })
            })
          }
        )
        req.on('error', reject)
        req.write('{ malformed json')
        req.end()
      })

      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'Invalid JSON' })
    })
  })

  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'GET', '/unknown/path')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Not found' })
    })

    it('should return 404 for wrong method on known path', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'PUT', '/api/hooks/health')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({ error: 'Not found' })
    })

    it('should return 404 for POST on health endpoint', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'POST', '/api/hooks/health')

      expect(response.status).toBe(404)
    })

    it('should return 404 for GET on stop endpoint', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'GET', '/api/hooks/stop')

      expect(response.status).toBe(404)
    })
  })

  describe('CORS support', () => {
    it('should set CORS headers on responses', async () => {
      await service.start(testPort)

      const response = await new Promise<{ headers: http.IncomingHttpHeaders }>(
        (resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port: testPort,
              path: '/api/hooks/health',
              method: 'GET'
            },
            (res) => {
              res.on('data', () => {})
              res.on('end', () => {
                resolve({ headers: res.headers })
              })
            }
          )
          req.on('error', reject)
          req.end()
        }
      )

      expect(response.headers['access-control-allow-origin']).toBe('*')
    })

    it('should handle OPTIONS preflight requests', async () => {
      await service.start(testPort)

      const response = await new Promise<{ status: number }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/api/hooks/stop',
            method: 'OPTIONS'
          },
          (res) => {
            res.on('data', () => {})
            res.on('end', () => {
              resolve({ status: res.statusCode || 0 })
            })
          }
        )
        req.on('error', reject)
        req.end()
      })

      expect(response.status).toBe(204)
    })
  })

  describe('Handler methods', () => {
    it('onStopHook should log payload', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const payload: StopHookPayload = {
        session_id: 'log-test-session',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HookListener] Stop hook received:',
        expect.stringContaining('log-test-session')
      )

      consoleSpy.mockRestore()
    })

    it('onToolUseHook should log payload', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const payload: ToolUseHookPayload = {
        session_id: 'tool-log-test-session',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HookListener] Tool use hook received:',
        expect.stringContaining('tool-log-test-session')
      )

      consoleSpy.mockRestore()
    })
  })

  // TES-2.6: Agent Start/Complete Event Capture tests
  describe('onStopHook agent_complete logging (TES-2.6)', () => {
    it('logs agent_complete activity when Stop hook fires with mapped session', async () => {
      // Mock: session exists with this session_id
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: 'test-session-abc',
        current_phase: 'dev-story'
      })

      // Mock: agent_start event exists for duration calculation
      mockDbSelectAll.mockReturnValueOnce([
        { id: 'activity-1', task_id: 'task-123', event_type: 'agent_start', created_at: Date.now() - 5000 }
      ])

      const payload: StopHookPayload = {
        session_id: 'test-session-abc',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should have logged agent_complete
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-123',
        'agent_complete',
        expect.objectContaining({
          phase: 'dev-story',
          session_id: 'test-session-abc'
        })
      )
    })

    it('calculates duration_ms from agent_start timestamp (TES-2.6 AC#3)', async () => {
      const startTime = Date.now() - 10000 // 10 seconds ago

      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-duration',
        tmux_session: 'tinsu-project-task-duration',
        session_id: 'duration-session',
        current_phase: 'code-review'
      })

      mockDbSelectAll.mockReturnValueOnce([
        { id: 'activity-1', task_id: 'task-duration', event_type: 'agent_start', created_at: startTime }
      ])

      const payload: StopHookPayload = {
        session_id: 'duration-session',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should have logged with duration_ms calculated
      expect(mockLogActivity).toHaveBeenCalled()
      const callArgs = mockLogActivity.mock.calls[0]
      expect(callArgs[0]).toBe('task-duration')
      expect(callArgs[1]).toBe('agent_complete')
      expect(callArgs[2].duration_ms).toBeGreaterThanOrEqual(10000)
      expect(callArgs[2].duration_ms).toBeLessThan(11000) // Allow 1s margin
    })

    it('sets duration_ms to null when no agent_start event found (TES-2.6 edge case)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-no-start',
        tmux_session: 'tinsu-project-task-no-start',
        session_id: 'no-start-session',
        current_phase: 'manual'
      })

      // No agent_start events
      mockDbSelectAll.mockReturnValueOnce([])

      const consoleSpy = vi.spyOn(console, 'warn')

      const payload: StopHookPayload = {
        session_id: 'no-start-session',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should have logged warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No agent_start event found')
      )

      // Should have logged with duration_ms = null
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-no-start',
        'agent_complete',
        expect.objectContaining({
          phase: 'manual',
          duration_ms: null,
          session_id: 'no-start-session'
        })
      )

      consoleSpy.mockRestore()
    })

    it('handles orphan session_id gracefully (TES-2.6 Task 2.3)', async () => {
      // Mock: no session found for this session_id
      mockDbSelectGet.mockReturnValueOnce(undefined)

      const consoleSpy = vi.spyOn(console, 'warn')

      const payload: StopHookPayload = {
        session_id: 'orphan-session-xyz',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should have logged warning about orphan
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Orphan stop event'),
        'orphan-session-xyz'
      )

      // Should NOT have tried to log activity
      expect(mockLogActivity).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('uses "manual" as default phase when current_phase is null', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-no-phase',
        tmux_session: 'tinsu-project-task-no-phase',
        session_id: 'null-phase-session',
        current_phase: null // No phase set
      })

      mockDbSelectAll.mockReturnValueOnce([
        { id: 'activity-1', task_id: 'task-no-phase', event_type: 'agent_start', created_at: Date.now() - 1000 }
      ])

      const payload: StopHookPayload = {
        session_id: 'null-phase-session',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should default to 'manual'
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-no-phase',
        'agent_complete',
        expect.objectContaining({
          phase: 'manual'
        })
      )
    })

    it('includes session_id in payload for debugging (TES-2.6 Task 3.4)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-debug',
        tmux_session: 'tinsu-project-task-debug',
        session_id: 'debug-session-id',
        current_phase: 'dev-story'
      })

      mockDbSelectAll.mockReturnValueOnce([
        { id: 'activity-1', task_id: 'task-debug', event_type: 'agent_start', created_at: Date.now() - 1000 }
      ])

      const payload: StopHookPayload = {
        session_id: 'debug-session-id',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      await service.onStopHook(payload)

      // Should include session_id in payload
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-debug',
        'agent_complete',
        expect.objectContaining({
          session_id: 'debug-session-id'
        })
      )
    })

    it('continues even if activity logging fails', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-log-fail',
        tmux_session: 'tinsu-project-task-log-fail',
        session_id: 'fail-session',
        current_phase: 'dev-story'
      })

      mockDbSelectAll.mockReturnValueOnce([
        { id: 'activity-1', task_id: 'task-log-fail', event_type: 'agent_start', created_at: Date.now() - 1000 }
      ])

      // Make logActivity throw
      mockLogActivity.mockRejectedValueOnce(new Error('Database error'))

      const consoleSpy = vi.spyOn(console, 'error')

      const payload: StopHookPayload = {
        session_id: 'fail-session',
        transcript_path: '/tmp/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'Stop'
      }

      // Should not throw
      await expect(service.onStopHook(payload)).resolves.toBeUndefined()

      // Should have logged error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log agent_complete'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  // TES-2.7: Tool Usage Event Capture tests
  describe('onToolUseHook tool_used logging (TES-2.7)', () => {
    it('logs tool_used activity when PostToolUse hook fires with mapped session (TES-2.7 AC#1)', async () => {
      // Mock: session exists with this session_id
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: 'test-session-abc',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'test-session-abc',
        tool_name: 'Edit',
        tool_input: { file_path: '/src/test.ts', old_string: 'old', new_string: 'new' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-123',
        'tool_used',
        expect.objectContaining({
          tool: 'Edit',
          file: '/src/test.ts'
        })
      )
    })

    it('includes tool name in payload (TES-2.7 AC#1)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-tool-name',
        tmux_session: 'tinsu-project-task-tool-name',
        session_id: 'tool-name-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'tool-name-session',
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-tool-name',
        'tool_used',
        expect.objectContaining({
          tool: 'Grep'
        })
      )
    })

    it('extracts file_path for Read tool (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-read',
        tmux_session: 'tinsu-project-task-read',
        session_id: 'read-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'read-session',
        tool_name: 'Read',
        tool_input: { file_path: '/home/user/project/src/main.ts' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-read',
        'tool_used',
        expect.objectContaining({
          tool: 'Read',
          file: '/home/user/project/src/main.ts'
        })
      )
    })

    it('extracts file_path for Write tool (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-write',
        tmux_session: 'tinsu-project-task-write',
        session_id: 'write-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'write-session',
        tool_name: 'Write',
        tool_input: { file_path: '/tmp/new-file.ts', content: 'export const foo = 1' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-write',
        'tool_used',
        expect.objectContaining({
          tool: 'Write',
          file: '/tmp/new-file.ts'
        })
      )
    })

    it('extracts pattern for Glob tool (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-glob',
        tmux_session: 'tinsu-project-task-glob',
        session_id: 'glob-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'glob-session',
        tool_name: 'Glob',
        tool_input: { pattern: '**/*.ts', path: '/src' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      // Should use path first if available, then pattern
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-glob',
        'tool_used',
        expect.objectContaining({
          tool: 'Glob',
          file: '/src'
        })
      )
    })

    it('generates change summary for Edit tool (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-edit-summary',
        tmux_session: 'tinsu-project-task-edit-summary',
        session_id: 'edit-summary-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'edit-summary-session',
        tool_name: 'Edit',
        tool_input: {
          file_path: '/src/component.tsx',
          old_string: 'line1\nline2\nline3',
          new_string: 'line1\nline2\nline3\nline4\nline5'
        },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-edit-summary',
        'tool_used',
        expect.objectContaining({
          tool: 'Edit',
          file: '/src/component.tsx',
          summary: '+5 -3' // 5 new lines added, 3 old lines removed (git-style)
        })
      )
    })

    it('generates "file edited" summary when old_string/new_string not provided (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-edit-no-strings',
        tmux_session: 'tinsu-project-task-edit-no-strings',
        session_id: 'edit-no-strings-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'edit-no-strings-session',
        tool_name: 'Edit',
        tool_input: { file_path: '/src/file.ts' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-edit-no-strings',
        'tool_used',
        expect.objectContaining({
          tool: 'Edit',
          summary: 'file edited'
        })
      )
    })

    it('generates "N lines modified" when line count unchanged but content changed (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-edit-same-lines',
        tmux_session: 'tinsu-project-task-edit-same-lines',
        session_id: 'edit-same-lines-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'edit-same-lines-session',
        tool_name: 'Edit',
        tool_input: {
          file_path: '/src/file.ts',
          old_string: 'const foo = 1\nconst bar = 2',
          new_string: 'const foo = 99\nconst bar = 88'
        },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-edit-same-lines',
        'tool_used',
        expect.objectContaining({
          tool: 'Edit',
          summary: '2 lines modified'
        })
      )
    })

    it('extracts and truncates command for Bash tool (TES-2.7 AC#3)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-bash',
        tmux_session: 'tinsu-project-task-bash',
        session_id: 'bash-session',
        current_phase: 'dev-story'
      })

      const longCommand = 'npm run build && npm run test && npm run lint && npm run format && npm run check && npm run deploy && npm run cleanup'

      const payload: ToolUseHookPayload = {
        session_id: 'bash-session',
        tool_name: 'Bash',
        tool_input: { command: longCommand },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-bash',
        'tool_used',
        expect.objectContaining({
          tool: 'Bash'
        })
      )

      // Verify command is truncated to 100 chars + "..."
      const callArgs = mockLogActivity.mock.calls[0]
      expect(callArgs[2].command).toHaveLength(103) // 100 + "..."
      expect(callArgs[2].command).toMatch(/^.{100}\.\.\.$/)
    })

    it('does not truncate short Bash commands (TES-2.7 AC#3)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-bash-short',
        tmux_session: 'tinsu-project-task-bash-short',
        session_id: 'bash-short-session',
        current_phase: 'dev-story'
      })

      const shortCommand = 'npm run test'

      const payload: ToolUseHookPayload = {
        session_id: 'bash-short-session',
        tool_name: 'Bash',
        tool_input: { command: shortCommand },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-bash-short',
        'tool_used',
        expect.objectContaining({
          tool: 'Bash',
          command: 'npm run test'
        })
      )
    })

    it('handles orphan session_id gracefully (TES-2.7 Task 1.2)', async () => {
      mockDbSelectGet.mockReturnValueOnce(undefined)

      const consoleSpy = vi.spyOn(console, 'warn')

      const payload: ToolUseHookPayload = {
        session_id: 'orphan-session',
        tool_name: 'Read',
        tool_input: { file_path: '/src/file.ts' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Orphan tool-use event'),
        'orphan-session'
      )
      expect(mockLogActivity).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('continues even if activity logging fails (TES-2.7 Task 2.4)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-log-fail',
        tmux_session: 'tinsu-project-task-log-fail',
        session_id: 'log-fail-session',
        current_phase: 'dev-story'
      })

      // Make logActivity throw
      mockLogActivity.mockRejectedValueOnce(new Error('Database error'))

      const consoleSpy = vi.spyOn(console, 'error')

      const payload: ToolUseHookPayload = {
        session_id: 'log-fail-session',
        tool_name: 'Read',
        tool_input: { file_path: '/src/file.ts' },
        hook_event_name: 'PostToolUse'
      }

      // Should not throw
      await expect(service.onToolUseHook(payload)).resolves.toBeUndefined()

      // Should have logged error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log tool_used'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('logs tool without file/command for unknown tool types (TES-2.7 edge case)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-unknown-tool',
        tmux_session: 'tinsu-project-task-unknown-tool',
        session_id: 'unknown-tool-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'unknown-tool-session',
        tool_name: 'WebFetch',
        tool_input: { url: 'https://example.com' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-unknown-tool',
        'tool_used',
        { tool: 'WebFetch' }
      )
    })

    it('extracts pattern for Grep tool when path not provided (TES-2.7 AC#2)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-grep',
        tmux_session: 'tinsu-project-task-grep',
        session_id: 'grep-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'grep-session',
        tool_name: 'Grep',
        tool_input: { pattern: 'TODO|FIXME' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      // Falls back to pattern when path not provided
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-grep',
        'tool_used',
        expect.objectContaining({
          tool: 'Grep',
          file: 'TODO|FIXME'
        })
      )
    })

    it('logs Task tool without extracting additional fields (TES-2.7 edge case)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-subagent',
        tmux_session: 'tinsu-project-task-subagent',
        session_id: 'task-tool-session',
        current_phase: 'dev-story'
      })

      const payload: ToolUseHookPayload = {
        session_id: 'task-tool-session',
        tool_name: 'Task',
        tool_input: { prompt: 'Search for TODO comments', subagent_type: 'Explore' },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      // Task tool logs only tool name, no file/command extraction
      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-subagent',
        'tool_used',
        { tool: 'Task' }
      )
    })

    it('does not truncate exactly 100 character command (boundary test)', async () => {
      mockDbSelectGet.mockReturnValueOnce({
        id: 'session-1',
        task_id: 'task-bash-boundary',
        tmux_session: 'tinsu-project-task-bash-boundary',
        session_id: 'bash-boundary-session',
        current_phase: 'dev-story'
      })

      // Exactly 100 characters
      const exactCommand = 'a'.repeat(100)

      const payload: ToolUseHookPayload = {
        session_id: 'bash-boundary-session',
        tool_name: 'Bash',
        tool_input: { command: exactCommand },
        hook_event_name: 'PostToolUse'
      }

      await service.onToolUseHook(payload)

      expect(mockLogActivity).toHaveBeenCalledWith(
        'task-bash-boundary',
        'tool_used',
        expect.objectContaining({
          tool: 'Bash',
          command: exactCommand // Should NOT be truncated
        })
      )

      // Verify no "..." suffix
      const callArgs = mockLogActivity.mock.calls[0]
      expect(callArgs[2].command).toHaveLength(100)
      expect(callArgs[2].command).not.toContain('...')
    })
  })
})
