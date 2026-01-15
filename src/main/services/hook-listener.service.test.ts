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
    service = new HookListenerService()
    // Each test gets a unique port to avoid conflicts
    testPort = portCounter++
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
})
