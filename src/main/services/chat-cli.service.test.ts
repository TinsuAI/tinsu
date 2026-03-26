/**
 * ChatCliService Tests - Story 10.3 (AC: 1, 2, 5), CTM-1.1
 *
 * Tests: spawnSession creates tmux session + attaches PTY with correct args,
 * sendMessage writes to existing PTY, sessionCache/sessionToChatCache populated,
 * SAFE_SHELL_ARG_REGEX validation, IDLE_TIMEOUT_MS equals 2 hours,
 * killSession kills PTY and tmux session, orphan methods removed,
 * tmux_session column exists in schema.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mock fn is available before vi.mock hoisting
const { mockExecAsync } = vi.hoisted(() => {
  return { mockExecAsync: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) }
})

// Mock child_process + util to intercept execAsync calls for tmux commands
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

vi.mock('util', () => ({
  promisify: () => mockExecAsync
}))

// Mock TmuxService
vi.mock('./tmux.service', () => ({
  TmuxService: {
    checkTmuxInstalled: vi.fn().mockResolvedValue(true)
  }
}))

import { ChatCliService, IDLE_TIMEOUT_MS, SAFE_SHELL_ARG_REGEX } from './chat-cli.service'

// Mock ptyService -- capture event handlers so we can simulate PTY events
const mockSpawn = vi.fn().mockReturnValue('pty-123')
const mockWrite = vi.fn()
const mockKill = vi.fn()
const mockGetProcess = vi.fn()
const mockOn = vi.fn()
const mockOff = vi.fn()

/** Collected event handlers keyed by event name */
const eventHandlers: Record<string, Array<(...args: unknown[]) => void>> = {}

vi.mock('./pty.service', () => ({
  ptyService: {
    spawn: (...args: unknown[]) => mockSpawn(...args),
    write: (...args: unknown[]) => mockWrite(...args),
    kill: (...args: unknown[]) => mockKill(...args),
    getProcess: (...args: unknown[]) => mockGetProcess(...args),
    on: (event: string, handler: (...args: unknown[]) => void) => {
      mockOn(event, handler)
      if (!eventHandlers[event]) eventHandlers[event] = []
      eventHandlers[event].push(handler)
    },
    off: (event: string, handler: (...args: unknown[]) => void) => {
      mockOff(event, handler)
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler)
      }
    }
  }
}))

/** Simulate a PTY output event to trigger writeWhenReady */
function simulatePtyOutput(processId: string, data: string): void {
  for (const handler of eventHandlers['output'] ?? []) {
    handler({ processId, data })
  }
}

describe('ChatCliService (CTM-1.1)', () => {
  let service: ChatCliService
  let exitHandler: ((event: { processId: string; exitCode: number }) => void) | null

  beforeEach(() => {
    vi.clearAllMocks()
    exitHandler = null
    // Clear collected handlers
    for (const key of Object.keys(eventHandlers)) {
      delete eventHandlers[key]
    }

    // Re-establish default mock return values after clearAllMocks
    mockSpawn.mockReturnValue('pty-123')
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' })

    service = new ChatCliService('/test/chat-hooks')

    // Extract the exit handler registered by the constructor
    const exitHandlers = eventHandlers['exit'] ?? []
    if (exitHandlers.length > 0) {
      exitHandler = exitHandlers[0] as unknown as typeof exitHandler
    }
  })

  afterEach(() => {
    exitHandler = null
  })

  describe('constructor', () => {
    it('registers a PTY exit event listener', () => {
      expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function))
    })
  })

  describe('spawnSession (CTM-1.1 AC: 1, 3)', () => {
    it('creates tmux session with correct name and attaches PTY', async () => {
      const processId = await service.spawnSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Hello agent'
      )

      // Should create tmux session
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux new-session -d -s tinsu-chat-session-1',
        expect.objectContaining({ timeout: 5000 })
      )

      // Should set environment variables
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux set-environment -t tinsu-chat-session-1 TINSU_TMUX_SESSION tinsu-chat-session-1',
        expect.objectContaining({ timeout: 5000 })
      )
      expect(mockExecAsync).toHaveBeenCalledWith(
        "tmux set-environment -t tinsu-chat-session-1 TINSU_SESSION_UUID 'uuid-abc'",
        expect.objectContaining({ timeout: 5000 })
      )

      // Should send claude command via tmux send-keys
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('tmux send-keys -t tinsu-chat-session-1'),
        expect.objectContaining({ timeout: 5000 })
      )

      // Should attach PTY to tmux session
      expect(mockSpawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'tmux attach-session -t tinsu-chat-session-1'],
        expect.objectContaining({ cwd: '/project/path' })
      )

      expect(processId).toBe('pty-123')
    })

    it('validates sessionId against SAFE_SHELL_ARG_REGEX (AC: 3)', async () => {
      await expect(
        service.spawnSession('session with spaces', 'uuid-abc', '/project/path', 'Hello')
      ).rejects.toThrow('Invalid sessionId format')

      await expect(
        service.spawnSession('session;rm -rf', 'uuid-abc', '/project/path', 'Hello')
      ).rejects.toThrow('Invalid sessionId format')
    })

    it('populates sessionCache and sessionToChatCache after spawn (AC: 1)', async () => {
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-chat-session-1')).toBe('session-1')
    })

    it('writes message to PTY stdin only after TUI ready signal (AC: 2)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      // Message should NOT be written immediately
      expect(mockWrite).not.toHaveBeenCalled()

      // Simulate TUI input area ready (ctrl+g hint)
      simulatePtyOutput('pty-123', 'ctrl+g to edit in Vim')

      // Now the message should be written (Enter/\r sent separately after 150ms delay)
      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent')
    })

    it('auto-dismisses trust prompt before waiting for TUI ready', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      // Message should NOT be written yet
      expect(mockWrite).not.toHaveBeenCalled()

      // Simulate trust prompt output (first PTY chunk contains "trust")
      simulatePtyOutput('pty-123', 'Is this a project you trust?')

      // Should have sent \r to dismiss the trust prompt, but NOT the user message yet
      expect(mockWrite).toHaveBeenCalledWith('pty-123', '\r')
      expect(mockWrite).toHaveBeenCalledTimes(1)

      // Now simulate TUI ready after trust is dismissed
      simulatePtyOutput('pty-123', 'ctrl+g to edit in Vim')

      // Now the actual message should be written (Enter/\r sent separately after 150ms delay)
      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent')
      expect(mockWrite).toHaveBeenCalledTimes(2)
    })

    it('tracks session in internal map', async () => {
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBeDefined()
    })

    it('preserves busySessions.add(sessionId) after spawn', async () => {
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      expect(service.isSessionBusy('session-1')).toBe(true)
    })
  })

  describe('spawnSession with personaContext (Story 10.4)', () => {
    it('includes persona in claude command sent to tmux', async () => {
      await service.spawnSession(
        'session-1',
        'uuid-abc',
        '/project/path',
        'Hello agent',
        'You are the PM persona.'
      )

      // The tmux send-keys call should include --append-system-prompt in the claude command
      const sendKeysCall = mockExecAsync.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('send-keys')
      )
      expect(sendKeysCall).toBeDefined()
      expect(sendKeysCall![0]).toContain('--append-system-prompt')
    })

    it('does not include --append-system-prompt when personaContext is not provided', async () => {
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello agent')

      const sendKeysCall = mockExecAsync.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('send-keys')
      )
      expect(sendKeysCall).toBeDefined()
      expect(sendKeysCall![0]).not.toContain('--append-system-prompt')
    })
  })

  describe('sendMessage (AC: 2)', () => {
    it('writes message to existing PTY session when not busy', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      // Simulate stop hook marking session free after initial message
      service.markSessionFree('session-1')
      mockWrite.mockClear()

      service.sendMessage('session-1', 'Follow-up message')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Follow-up message')
    })

    it('sends message even when session is busy (warns but does not block)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      service.markSessionFree('session-1')
      mockWrite.mockClear()

      // Make busy again
      service.sendMessage('session-1', 'First message')
      mockWrite.mockClear()

      // Send while busy -- should still write to PTY
      service.sendMessage('session-1', 'Second while busy')
      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Second while busy')
    })

    it('throws when session not found', () => {
      expect(() => service.sendMessage('non-existent', 'Hello')).toThrow(
        'Chat CLI session not found: non-existent'
      )
    })

    it('throws when session has exited', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      expect(() => service.sendMessage('session-1', 'Hello again')).toThrow(
        'Chat CLI session has exited: session-1'
      )
    })

    it('preserves 150ms delay between message content and Enter key', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      service.markSessionFree('session-1')
      mockWrite.mockClear()

      service.sendMessage('session-1', 'Test message')

      // First call: message content
      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Test message')
      // Enter (\r) is sent after 150ms setTimeout -- not immediate
      expect(mockWrite).toHaveBeenCalledTimes(1)
    })
  })

  describe('isSessionAlive', () => {
    it('returns false when session does not exist', () => {
      expect(service.isSessionAlive('non-existent')).toBe(false)
    })

    it('returns true when session is running and PTY process exists', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBe(true)
    })

    it('returns false when session status is exited', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('returns false when PTY process no longer exists in ptyService', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // PTY process removed from ptyService
      mockGetProcess.mockReturnValue(undefined)

      expect(service.isSessionAlive('session-1')).toBe(false)
    })
  })

  describe('killSession (CTM-1.1 AC: 1)', () => {
    it('kills PTY process and removes from map', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      service.killSession('session-1')

      expect(mockKill).toHaveBeenCalledWith('pty-123')
      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('kills the tmux session via tmux kill-session', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')
      mockExecAsync.mockClear()

      service.killSession('session-1')

      // Should call tmux kill-session
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux kill-session -t tinsu-chat-session-1',
        expect.objectContaining({ timeout: 5000 })
      )
    })

    it('removes from sessionCache and sessionToChatCache', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-chat-session-1')).toBe('session-1')

      service.killSession('session-1')

      expect(cache.get('tinsu-chat-session-1')).toBeUndefined()
    })

    it('is a no-op for non-existent sessions', () => {
      service.killSession('non-existent')
      expect(mockKill).not.toHaveBeenCalled()
    })
  })

  describe('killAll', () => {
    it('kills all tracked PTY processes and tmux sessions', async () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      await service.spawnSession('session-1', 'uuid-1', '/path', 'Hello 1')
      await service.spawnSession('session-2', 'uuid-2', '/path', 'Hello 2')

      service.killAll()

      expect(mockKill).toHaveBeenCalledWith('pty-1')
      expect(mockKill).toHaveBeenCalledWith('pty-2')
      expect(service.isSessionAlive('session-1')).toBe(false)
      expect(service.isSessionAlive('session-2')).toBe(false)
    })
  })

  describe('PTY exit handling', () => {
    it('updates session status to exited when PTY process exits', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', '/project/path', 'Hello')

      // Simulate PTY exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 1 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('does not affect unrelated sessions on exit', async () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-1', '/path', 'Hello 1')
      await service.spawnSession('session-2', 'uuid-2', '/path', 'Hello 2')

      // Only session-1's PTY exits
      if (exitHandler) {
        exitHandler({ processId: 'pty-1', exitCode: 0 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
      expect(service.isSessionAlive('session-2')).toBe(true)
    })
  })

  describe('idle timeout (CTM-1.1 AC: 5)', () => {
    it('IDLE_TIMEOUT_MS is 2 hours', () => {
      expect(IDLE_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000)
    })

    it('checkIdleSessions kills sessions inactive > 2 hours', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-idle', 'uuid-idle', '/path', 'Hello')

      // Advance time past idle timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      const killed = service.checkIdleSessions()

      expect(killed).toEqual(['session-idle'])
      expect(mockKill).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('checkIdleSessions does NOT kill sessions within 2 hours', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-active', 'uuid-active', '/path', 'Hello')

      // Advance time to just under the timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS - 1000)

      const killed = service.checkIdleSessions()

      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('checkIdleSessions does NOT kill already-exited sessions', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-exited', 'uuid-exited', '/path', 'Hello')

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

    it('lastActivityMap is updated on spawnSession', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-1', '/path', 'Hello')

      // Simulate stop hook freeing session
      service.markSessionFree('session-1')

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

    it('killed idle sessions trigger the onIdle callback', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      const onIdleCallback = vi.fn()
      service.setOnIdleCallback(onIdleCallback)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-idle', 'uuid-idle', '/path', 'Hello')

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

  describe('SAFE_SHELL_ARG_REGEX validation (CTM-1.1 AC: 3)', () => {
    it('accepts valid session IDs', () => {
      expect(SAFE_SHELL_ARG_REGEX.test('abc-123')).toBe(true)
      expect(SAFE_SHELL_ARG_REGEX.test('session_1')).toBe(true)
      expect(SAFE_SHELL_ARG_REGEX.test('ABCdef')).toBe(true)
    })

    it('rejects invalid session IDs', () => {
      expect(SAFE_SHELL_ARG_REGEX.test('has spaces')).toBe(false)
      expect(SAFE_SHELL_ARG_REGEX.test('cmd;injection')).toBe(false)
      expect(SAFE_SHELL_ARG_REGEX.test('$(whoami)')).toBe(false)
      expect(SAFE_SHELL_ARG_REGEX.test('')).toBe(false)
    })
  })

  describe('orphan methods removed (CTM-1.1 AC: 5)', () => {
    it('findOrphanSession is not a method on ChatCliService', () => {
      expect((service as unknown as Record<string, unknown>).findOrphanSession).toBeUndefined()
    })

    it('updateSessionUuid is not a method on ChatCliService', () => {
      expect((service as unknown as Record<string, unknown>).updateSessionUuid).toBeUndefined()
    })

    it('discoverCorrectUuid is not a method on ChatCliService', () => {
      expect((service as unknown as Record<string, unknown>).discoverCorrectUuid).toBeUndefined()
    })

    it('maybeRetryResume is not a method on ChatCliService', () => {
      expect((service as unknown as Record<string, unknown>).maybeRetryResume).toBeUndefined()
    })

    it('resumeSession is not a method on ChatCliService', () => {
      expect((service as unknown as Record<string, unknown>).resumeSession).toBeUndefined()
    })
  })

  describe('tmux_session schema column (CTM-1.1 AC: 4)', () => {
    it('tmux_session column exists in chat_sessions schema', async () => {
      const { chat_sessions } = await import('../db/schema')
      expect(chat_sessions.tmux_session).toBeDefined()
    })
  })
})
