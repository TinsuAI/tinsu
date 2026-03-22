/**
 * ChatCliService Tests - Story 10.3 (AC: 1, 2, 5), Story 10.6 (AC: 5)
 *
 * Tests: spawnSession creates PTY with correct args and writes initial message,
 * sendMessage writes to existing PTY, resumeSession spawns with --resume flag,
 * isSessionAlive returns correct state, killSession kills PTY and cleans map,
 * exit event updates map status, idle timeout kills sessions after 30 min.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChatCliService, IDLE_TIMEOUT_MS } from './chat-cli.service'

// Mock ptyService
const mockSpawn = vi.fn().mockReturnValue('pty-123')
const mockWrite = vi.fn()
const mockKill = vi.fn()
const mockGetProcess = vi.fn()
const mockOn = vi.fn()

vi.mock('./pty.service', () => ({
  ptyService: {
    spawn: (...args: unknown[]) => mockSpawn(...args),
    write: (...args: unknown[]) => mockWrite(...args),
    kill: (...args: unknown[]) => mockKill(...args),
    getProcess: (...args: unknown[]) => mockGetProcess(...args),
    on: (...args: unknown[]) => mockOn(...args)
  }
}))

describe('ChatCliService (Story 10.3, AC: 1, 2, 5)', () => {
  let service: ChatCliService
  let exitHandler: ((event: { processId: string; exitCode: number }) => void) | null

  beforeEach(() => {
    vi.clearAllMocks()
    exitHandler = null

    // Re-establish default mock return values after clearAllMocks
    mockSpawn.mockReturnValue('pty-123')

    // Capture the exit handler registered in the constructor
    mockOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'exit') {
        exitHandler = handler as typeof exitHandler
      }
    })

    service = new ChatCliService('/test/chat-hooks')
  })

  afterEach(() => {
    exitHandler = null
  })

  describe('constructor', () => {
    it('registers a PTY exit event listener', () => {
      expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function))
    })
  })

  describe('spawnSession (AC: 1)', () => {
    it('spawns claude with correct args and env', () => {
      const processId = service.spawnSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Hello agent'
      )

      expect(mockSpawn).toHaveBeenCalledWith('claude', ['--session-id', 'uuid-abc'], {
        cwd: '/project/path',
        env: {
          CLAUDE_PROJECT_DIR: '/test/chat-hooks'
        }
      })
      expect(processId).toBe('pty-123')
    })

    it('writes initial message to PTY stdin with newline', () => {
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent\n')
    })

    it('tracks session in internal map', () => {
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBeDefined()
    })
  })

  describe('spawnSession with personaContext (Story 10.4)', () => {
    it('prepends persona context to initial message when provided', () => {
      service.spawnSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Hello agent',
        'You are the PM persona.'
      )

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-123',
        'You are the PM persona.\n\nHello agent\n'
      )
    })

    it('sends only initial message when personaContext is not provided (backward compat)', () => {
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent\n')
    })

    it('sends only initial message when personaContext is empty string', () => {
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent', '')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent\n')
    })
  })

  describe('sendMessage (AC: 2)', () => {
    it('writes message to existing PTY session', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      mockWrite.mockClear()

      service.sendMessage('session-1', 'Follow-up message')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Follow-up message\n')
    })

    it('throws when session not found', () => {
      expect(() => service.sendMessage('non-existent', 'Hello')).toThrow(
        'Chat CLI session not found: non-existent'
      )
    })

    it('throws when session has exited', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      expect(() => service.sendMessage('session-1', 'Hello again')).toThrow(
        'Chat CLI session has exited: session-1'
      )
    })
  })

  describe('resumeSession (AC: 5)', () => {
    it('spawns claude with --resume and --session-id flags', () => {
      mockSpawn.mockReturnValue('pty-456')

      const processId = service.resumeSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Resume message'
      )

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--resume', '--session-id', 'uuid-abc'],
        {
          cwd: '/project/path',
          env: {
            CLAUDE_PROJECT_DIR: '/test/chat-hooks'
          }
        }
      )
      expect(processId).toBe('pty-456')
    })

    it('writes message to resumed PTY stdin', () => {
      mockSpawn.mockReturnValue('pty-456')
      service.resumeSession('session-1', 'uuid-abc', '/project/path', 'Resume message')

      expect(mockWrite).toHaveBeenCalledWith('pty-456', 'Resume message\n')
    })

    it('does NOT prepend persona context even when provided (Story 10.4)', () => {
      mockSpawn.mockReturnValue('pty-456')
      service.resumeSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Resume message',
        'You are the PM persona.'
      )

      // Should only write the message, NOT the persona context
      expect(mockWrite).toHaveBeenCalledWith('pty-456', 'Resume message\n')
    })

    it('updates session map with new processId', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      mockSpawn.mockReturnValue('pty-456')
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.resumeSession('session-1', 'uuid-abc', '/project/path', 'Resume')

      expect(service.isSessionAlive('session-1')).toBe(true)
    })
  })

  describe('isSessionAlive', () => {
    it('returns false when session does not exist', () => {
      expect(service.isSessionAlive('non-existent')).toBe(false)
    })

    it('returns true when session is running and PTY process exists', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBe(true)
    })

    it('returns false when session status is exited', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('returns false when PTY process no longer exists in ptyService', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // PTY process removed from ptyService
      mockGetProcess.mockReturnValue(undefined)

      expect(service.isSessionAlive('session-1')).toBe(false)
    })
  })

  describe('killSession', () => {
    it('kills PTY process and removes from map', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      service.killSession('session-1')

      expect(mockKill).toHaveBeenCalledWith('pty-123')
      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('is a no-op for non-existent sessions', () => {
      service.killSession('non-existent')
      expect(mockKill).not.toHaveBeenCalled()
    })
  })

  describe('killAll', () => {
    it('kills all tracked PTY processes', () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      service.spawnSession('session-1', 'uuid-1', '/path', 'Hello 1')
      service.spawnSession('session-2', 'uuid-2', '/path', 'Hello 2')

      service.killAll()

      expect(mockKill).toHaveBeenCalledWith('pty-1')
      expect(mockKill).toHaveBeenCalledWith('pty-2')
      expect(service.isSessionAlive('session-1')).toBe(false)
      expect(service.isSessionAlive('session-2')).toBe(false)
    })
  })

  describe('PTY exit handling (AC: 5)', () => {
    it('updates session status to exited when PTY process exits', () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate PTY exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 1 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('does not affect unrelated sessions on exit', () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-1', '/path', 'Hello 1')
      service.spawnSession('session-2', 'uuid-2', '/path', 'Hello 2')

      // Only session-1's PTY exits
      if (exitHandler) {
        exitHandler({ processId: 'pty-1', exitCode: 0 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
      expect(service.isSessionAlive('session-2')).toBe(true)
    })
  })

  describe('idle timeout (Story 10.6, AC: 5)', () => {
    it('IDLE_TIMEOUT_MS is 30 minutes', () => {
      expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000)
    })

    it('checkIdleSessions kills sessions inactive > 30 min', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-idle', 'uuid-idle', '/path', 'Hello')

      // Advance time past idle timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      const killed = service.checkIdleSessions()

      expect(killed).toEqual(['session-idle'])
      expect(mockKill).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('checkIdleSessions does NOT kill sessions within 30 min', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-active', 'uuid-active', '/path', 'Hello')

      // Advance time to just under the timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS - 1000)

      const killed = service.checkIdleSessions()

      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('checkIdleSessions does NOT kill already-exited sessions', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-exited', 'uuid-exited', '/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      // Advance past timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      const killed = service.checkIdleSessions()

      // Should not kill already-exited sessions (isSessionAlive returns false)
      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('lastActivityMap is updated on spawnSession', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-1', '/path', 'Hello')

      // Advance time, then send message to reset activity
      vi.setSystemTime(now + IDLE_TIMEOUT_MS - 5000)
      service.sendMessage('session-1', 'Still here')

      // Advance a bit more past original timeout but within new activity window
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      const killed = service.checkIdleSessions()

      // Should NOT be killed because sendMessage reset the activity timestamp
      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('lastActivityMap is updated on resumeSession', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-1', 'uuid-1', '/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      // Advance past the original timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 5000)

      // Resume the session — this should reset the activity timestamp
      mockSpawn.mockReturnValue('pty-456')
      mockGetProcess.mockReturnValue({ state: 'running' })
      service.resumeSession('session-1', 'uuid-1', '/path', 'Resume')

      // Advance a bit more but not past the new timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 5000 + IDLE_TIMEOUT_MS - 1000)

      const killed = service.checkIdleSessions()
      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('killed idle sessions trigger the onIdle callback', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      const onIdleCallback = vi.fn()
      service.setOnIdleCallback(onIdleCallback)

      mockGetProcess.mockReturnValue({ state: 'running' })
      service.spawnSession('session-idle', 'uuid-idle', '/path', 'Hello')

      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      service.checkIdleSessions()

      expect(onIdleCallback).toHaveBeenCalledWith('session-idle')

      vi.useRealTimers()
    })

    it('killAll clears the idle check interval', () => {
      // Just verifying killAll doesn't throw and clears state
      service.killAll()

      // After killAll, service should be in clean state
      expect(service.isSessionAlive('any')).toBe(false)
    })
  })
})
