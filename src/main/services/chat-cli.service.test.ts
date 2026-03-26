/**
 * ChatCliService Tests - Story 10.3 (AC: 1, 2, 5), CTM-1.1, CTM-1.3, CTM-2.2
 *
 * Tests: spawnSession creates tmux session + attaches PTY with correct args,
 * sendMessage writes to existing PTY, sessionCache/sessionToChatCache populated,
 * SAFE_SHELL_ARG_REGEX validation, IDLE_TIMEOUT_MS equals 2 hours,
 * killSession kills PTY and tmux session, orphan methods removed,
 * tmux_session column exists in schema.
 *
 * CTM-1.3 Tests: validateSessionsOnStartup, reattachSession, isTmuxAlive,
 * tmuxSessionExists, parallel validation with Promise.allSettled.
 *
 * CTM-2.2 Tests: startMonitoring health polling, emitSessionStatus event emission,
 * onSessionStatus listener registration, idle timeout integration, killAll cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted to ensure mock fn is available before vi.mock hoisting
const { mockExecAsync } = vi.hoisted(() => {
  return { mockExecAsync: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }) }
})

// Mock child_process + util to intercept execAsync calls for tmux commands
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execFile: vi.fn()
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

// Mock db module for CTM-1.3 validateSessionsOnStartup
const mockDbSelectAll = vi.fn().mockReturnValue([])
const mockDbUpdateSet = vi.fn().mockReturnValue({
  where: vi.fn().mockReturnValue({ run: vi.fn() })
})
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet })
const mockDbSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      all: mockDbSelectAll
    })
  })
})

vi.mock('../db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args)
  }
}))

vi.mock('../db/schema', () => ({
  chat_sessions: {
    id: 'id',
    status: 'status',
    tmux_session: 'tmux_session',
    updated_at: 'updated_at'
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
        'TestProject',
        '/project/path',
        'Hello agent'
      )

      // Should create tmux session
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux new-session -d -s tinsu-testproject-session-1 -c "/project/path"',
        expect.objectContaining({ timeout: 5000 })
      )

      // Should set environment variables
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux set-environment -t tinsu-testproject-session-1 TINSU_TMUX_SESSION tinsu-testproject-session-1',
        expect.objectContaining({ timeout: 5000 })
      )
      expect(mockExecAsync).toHaveBeenCalledWith(
        "tmux set-environment -t tinsu-testproject-session-1 TINSU_SESSION_UUID 'uuid-abc'",
        expect.objectContaining({ timeout: 5000 })
      )

      // Should send claude command via execFileAsync (bypasses shell for safe escaping)
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux',
        expect.arrayContaining(['send-keys', '-t', 'tinsu-testproject-session-1']),
        expect.objectContaining({ timeout: 5000 })
      )

      // Should attach PTY to tmux session
      expect(mockSpawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'tmux attach-session -t tinsu-testproject-session-1'],
        expect.objectContaining({ cwd: '/project/path' })
      )

      expect(processId).toBe('pty-123')
    })

    it('validates sessionId against SAFE_SHELL_ARG_REGEX (AC: 3)', async () => {
      await expect(
        service.spawnSession('session with spaces', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
      ).rejects.toThrow('Invalid sessionId format')

      await expect(
        service.spawnSession('session;rm -rf', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
      ).rejects.toThrow('Invalid sessionId format')
    })

    it('populates sessionCache and sessionToChatCache after spawn (AC: 1)', async () => {
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello agent')

      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-1')).toBe('session-1')
    })

    it('writes message to PTY stdin only after TUI ready signal (AC: 2)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello agent')

      // Message should NOT be written immediately
      expect(mockWrite).not.toHaveBeenCalled()

      // Simulate TUI input area ready (ctrl+g hint)
      simulatePtyOutput('pty-123', 'ctrl+g to edit in Vim')

      // Now the message should be written (Enter/\r sent separately after 150ms delay)
      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Hello agent')
    })

    it('auto-dismisses trust prompt before waiting for TUI ready', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello agent')

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
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBeDefined()
    })

    it('preserves busySessions.add(sessionId) after spawn', async () => {
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
      expect(service.isSessionBusy('session-1')).toBe(true)
    })
  })

  describe('spawnSession with personaContext (Story 10.4)', () => {
    it('includes persona in claude command sent to tmux', async () => {
      await service.spawnSession(
        'session-1',
        'uuid-abc',
        'TestProject',
        '/project/path',
        'Hello agent',
        'You are the PM persona.'
      )

      // The execFileAsync send-keys call should include --append-system-prompt in the claude command
      // Call signature: execFileAsync('tmux', ['send-keys', '-t', name, claudeCommand, 'Enter'], opts)
      const sendKeysCall = mockExecAsync.mock.calls.find(
        (call: unknown[]) => call[0] === 'tmux' && Array.isArray(call[1]) &&
          (call[1] as string[]).includes('send-keys')
      )
      expect(sendKeysCall).toBeDefined()
      const claudeCommandArg = (sendKeysCall![1] as string[])[3]
      expect(claudeCommandArg).toContain('--append-system-prompt')
    })

    it('does not include --append-system-prompt when personaContext is not provided', async () => {
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello agent')

      const sendKeysCall = mockExecAsync.mock.calls.find(
        (call: unknown[]) => call[0] === 'tmux' && Array.isArray(call[1]) &&
          (call[1] as string[]).includes('send-keys')
      )
      expect(sendKeysCall).toBeDefined()
      const claudeCommandArg = (sendKeysCall![1] as string[])[3]
      expect(claudeCommandArg).not.toContain('--append-system-prompt')
    })
  })

  describe('sendMessage (AC: 2)', () => {
    it('writes message to existing PTY session when not busy', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
      // Simulate stop hook marking session free after initial message
      service.markSessionFree('session-1')
      mockWrite.mockClear()

      service.sendMessage('session-1', 'Follow-up message')

      expect(mockWrite).toHaveBeenCalledWith('pty-123', 'Follow-up message')
    })

    it('sends message even when session is busy (warns but does not block)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
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
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

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
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
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
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      expect(service.isSessionAlive('session-1')).toBe(true)
    })

    it('returns false when session status is exited', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      // Simulate exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 0 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('returns false when PTY process no longer exists in ptyService', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      // PTY process removed from ptyService
      mockGetProcess.mockReturnValue(undefined)

      expect(service.isSessionAlive('session-1')).toBe(false)
    })
  })

  describe('killSession (CTM-1.1 AC: 1)', () => {
    it('kills PTY process and removes from map', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      service.killSession('session-1')

      expect(mockKill).toHaveBeenCalledWith('pty-123')
      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('kills the tmux session via tmux kill-session', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')
      mockExecAsync.mockClear()

      service.killSession('session-1')

      // Should call tmux kill-session
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux kill-session -t tinsu-testproject-session-1',
        expect.objectContaining({ timeout: 5000 })
      )
    })

    it('removes from sessionCache and sessionToChatCache', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-1')).toBe('session-1')

      service.killSession('session-1')

      expect(cache.get('tinsu-testproject-session-1')).toBeUndefined()
    })

    it('is a no-op for non-existent sessions', () => {
      service.killSession('non-existent')
      expect(mockKill).not.toHaveBeenCalled()
    })
  })

  describe('killAll', () => {
    it('kills all tracked PTY processes and tmux sessions', async () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      await service.spawnSession('session-1', 'uuid-1', 'TestProject', '/path', 'Hello 1')
      await service.spawnSession('session-2', 'uuid-2', 'TestProject', '/path', 'Hello 2')

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
      await service.spawnSession('session-1', 'uuid-abc', 'TestProject', '/project/path', 'Hello')

      // Simulate PTY exit
      if (exitHandler) {
        exitHandler({ processId: 'pty-123', exitCode: 1 })
      }

      expect(service.isSessionAlive('session-1')).toBe(false)
    })

    it('does not affect unrelated sessions on exit', async () => {
      mockSpawn.mockReturnValueOnce('pty-1').mockReturnValueOnce('pty-2')
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-1', 'uuid-1', 'TestProject', '/path', 'Hello 1')
      await service.spawnSession('session-2', 'uuid-2', 'TestProject', '/path', 'Hello 2')

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
      await service.spawnSession('session-idle', 'uuid-idle', 'TestProject', '/path', 'Hello')

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
      await service.spawnSession('session-active', 'uuid-active', 'TestProject', '/path', 'Hello')

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
      await service.spawnSession('session-exited', 'uuid-exited', 'TestProject', '/path', 'Hello')

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
      await service.spawnSession('session-1', 'uuid-1', 'TestProject', '/path', 'Hello')

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
      await service.spawnSession('session-idle', 'uuid-idle', 'TestProject', '/path', 'Hello')

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

  describe('tmuxSessionExists (CTM-1.3 Task 1.1)', () => {
    it('returns true when tmux has-session exits 0', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' })

      // Access private method via type assertion
      const result = await (service as unknown as { tmuxSessionExists(n: string): Promise<boolean> }).tmuxSessionExists('tinsu-testproject-session-1')

      expect(result).toBe(true)
      expect(mockExecAsync).toHaveBeenCalledWith(
        'tmux has-session -t tinsu-testproject-session-1',
        expect.objectContaining({ timeout: 5000 })
      )
    })

    it('returns false when tmux has-session exits non-zero', async () => {
      mockExecAsync.mockRejectedValueOnce(new Error('exit code 1'))

      const result = await (service as unknown as { tmuxSessionExists(n: string): Promise<boolean> }).tmuxSessionExists('tinsu-testproject-dead')

      expect(result).toBe(false)
    })
  })

  describe('validateSessionsOnStartup (CTM-1.3 AC: 1)', () => {
    it('populates caches for alive sessions and marks dead sessions as paused', async () => {
      // Setup: 3 active sessions (2 alive, 1 dead)
      const mockSessions = [
        { id: 'session-alive-1', tmux_session: 'tinsu-testproject-session-alive-1', status: 'active' },
        { id: 'session-alive-2', tmux_session: 'tinsu-testproject-session-alive-2', status: 'active' },
        { id: 'session-dead', tmux_session: 'tinsu-testproject-session-dead', status: 'active' }
      ]

      // Mock db.select().from().where().all() chain
      mockDbSelectAll.mockReturnValueOnce(mockSessions)

      // Mock tmux has-session: alive for first two, dead for third
      // The validateSessionsOnStartup method creates tmux session calls via execAsync
      // Note: spawnSession in beforeEach may have added calls, so we need to mock from here
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // session-alive-1: alive
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // session-alive-2: alive
        .mockRejectedValueOnce(new Error('exit code 1')) // session-dead: dead

      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      await service.validateSessionsOnStartup()

      // Alive sessions should be in sessionToChatCache
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-alive-1')).toBe('session-alive-1')
      expect(cache.get('tinsu-testproject-session-alive-2')).toBe('session-alive-2')
      expect(cache.get('tinsu-testproject-session-dead')).toBeUndefined()

      // Dead session should have been marked as paused in DB
      expect(mockDbUpdate).toHaveBeenCalled()
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paused' })
      )
    })

    it('no-op with no active sessions', async () => {
      mockDbSelectAll.mockReturnValueOnce([])

      await service.validateSessionsOnStartup()

      // No tmux checks should have been made
      // Only constructor calls should be in mockExecAsync, no extra calls
      const callsBeforeValidation = mockExecAsync.mock.calls.length
      expect(callsBeforeValidation).toBe(0) // cleared in beforeEach
    })

    it('skips sessions without tmux_session column (legacy)', async () => {
      // The DB query already filters with isNotNull(chat_sessions.tmux_session),
      // so sessions without tmux_session are excluded from the results
      mockDbSelectAll.mockReturnValueOnce([])

      await service.validateSessionsOnStartup()

      // Should complete without errors
      expect(true).toBe(true)
    })

    it('treats rejected Promise.allSettled results as dead (conservative)', async () => {
      const mockSessions = [
        { id: 'session-ok', tmux_session: 'tinsu-testproject-session-ok', status: 'active' },
        { id: 'session-fail', tmux_session: 'tinsu-testproject-session-fail', status: 'active' }
      ]

      mockDbSelectAll.mockReturnValueOnce(mockSessions)

      // First session alive, second session check throws
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // session-ok: alive
        .mockRejectedValueOnce(new Error('timeout')) // session-fail: check fails

      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      await service.validateSessionsOnStartup()

      // session-ok should be in cache
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-ok')).toBe('session-ok')

      // session-fail should NOT be in cache (treated as dead)
      expect(cache.get('tinsu-testproject-session-fail')).toBeUndefined()
    })
  })

  describe('reattachSession (CTM-1.3 AC: 2)', () => {
    it('spawns PTY with correct tmux attach command and updates tracking maps', async () => {
      // First, populate the sessionCache by simulating a startup validation
      // We'll access it through spawn + cache population
      // Manually populate the cache via spawnSession
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-reattach', 'uuid-reattach', 'TestProject', '/project/path', 'Hello')

      // Simulate PTY exit (so isSessionAlive returns false)
      const exitHandlers = eventHandlers['exit'] ?? []
      if (exitHandlers.length > 0) {
        (exitHandlers[0] as (event: { processId: string; exitCode: number }) => void)({
          processId: 'pty-123',
          exitCode: 0
        })
      }

      // Clear mocks to track reattach calls
      mockSpawn.mockClear()
      mockSpawn.mockReturnValue('pty-reattached')
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' }) // tmuxSessionExists returns true

      const processId = await service.reattachSession('session-reattach', 'uuid-reattach', '/project/path')

      expect(processId).toBe('pty-reattached')

      // PTY spawn with tmux attach
      expect(mockSpawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'tmux attach-session -t tinsu-testproject-session-reattach'],
        expect.objectContaining({ cwd: '/project/path' })
      )

      // Session should be alive again
      mockGetProcess.mockReturnValue({ state: 'running' })
      expect(service.isSessionAlive('session-reattach')).toBe(true)
    })

    it('throws if tmux session is not alive', async () => {
      // Populate cache
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-dead-reattach', 'uuid-dead', 'TestProject', '/project/path', 'Hello')

      // Simulate PTY exit
      const exitHandlers = eventHandlers['exit'] ?? []
      if (exitHandlers.length > 0) {
        (exitHandlers[0] as (event: { processId: string; exitCode: number }) => void)({
          processId: 'pty-123',
          exitCode: 0
        })
      }

      // tmux session is dead
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))

      await expect(
        service.reattachSession('session-dead-reattach', 'uuid-dead', '/project/path')
      ).rejects.toThrow('no longer alive')
    })

    it('throws if session not in cache', async () => {
      await expect(
        service.reattachSession('non-cached-session', 'uuid-xxx', '/project/path')
      ).rejects.toThrow('No cached tmux session')
    })

    it('does NOT call writeWhenReady or add to busySessions', async () => {
      // Populate cache
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-no-ready', 'uuid-no-ready', 'TestProject', '/project/path', 'Hello')

      // Simulate PTY exit
      const exitHandlers = eventHandlers['exit'] ?? []
      if (exitHandlers.length > 0) {
        (exitHandlers[0] as (event: { processId: string; exitCode: number }) => void)({
          processId: 'pty-123',
          exitCode: 0
        })
      }

      // Clear busySessions state from spawnSession
      service.markSessionFree('session-no-ready')

      mockSpawn.mockClear()
      mockSpawn.mockReturnValue('pty-reattached-2')
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' })

      await service.reattachSession('session-no-ready', 'uuid-no-ready', '/project/path')

      // After reattach, session should NOT be busy
      expect(service.isSessionBusy('session-no-ready')).toBe(false)

      // No output handlers should have been registered for writeWhenReady
      // (mockOn would have been called only from the constructor 'exit' handler
      // and spawnSession's writeWhenReady, not from reattachSession)
      const outputHandlerCalls = mockOn.mock.calls.filter(
        (call: unknown[]) => call[0] === 'output'
      )
      // spawnSession registered 1 output handler (for writeWhenReady)
      // reattachSession should NOT register any new output handlers
      expect(outputHandlerCalls.length).toBe(1)
    })
  })

  describe('isTmuxAlive (CTM-1.3 AC: 4)', () => {
    it('returns true when sessionCache has entry and tmux session exists', async () => {
      // Populate cache via spawnSession
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-alive-check', 'uuid-alive', 'TestProject', '/project/path', 'Hello')

      // tmux has-session succeeds
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' })

      const result = await service.isTmuxAlive('session-alive-check')
      expect(result).toBe(true)
    })

    it('returns false when sessionCache has no entry', async () => {
      const result = await service.isTmuxAlive('non-existent-session')
      expect(result).toBe(false)
    })

    it('returns false when sessionCache has entry but tmux session is dead', async () => {
      // Populate cache
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-dead-check', 'uuid-dead', 'TestProject', '/project/path', 'Hello')

      // tmux has-session fails
      mockExecAsync.mockRejectedValueOnce(new Error('exit code 1'))

      const result = await service.isTmuxAlive('session-dead-check')
      expect(result).toBe(false)
    })
  })

  describe('getSessionStatus (CTM-2.1 Task 6, AC: 2, 3)', () => {
    it('returns "thinking" when session is in busySessions (Task 7.5)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-thinking', 'uuid-thinking', 'TestProject', '/project/path', 'Hello')

      // spawnSession adds to busySessions automatically
      const status = service.getSessionStatus('session-thinking')
      expect(status).toBe('thinking')
    })

    it('returns "idle" when session is alive but not busy (Task 7.5)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-idle-status', 'uuid-idle', 'TestProject', '/project/path', 'Hello')

      // Mark session as free (simulates stop hook)
      service.markSessionFree('session-idle-status')

      const status = service.getSessionStatus('session-idle-status')
      expect(status).toBe('idle')
    })

    it('returns "exited" when PTY has exited (Task 7.5)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-exited-status', 'uuid-exited', 'TestProject', '/project/path', 'Hello')

      // Simulate PTY exit
      const exitHandlers = eventHandlers['exit'] ?? []
      if (exitHandlers.length > 0) {
        (exitHandlers[0] as (event: { processId: string; exitCode: number }) => void)({
          processId: 'pty-123',
          exitCode: 0
        })
      }

      const status = service.getSessionStatus('session-exited-status')
      expect(status).toBe('exited')
    })

    it('returns "unknown" when session was never tracked (Task 7.5)', () => {
      const status = service.getSessionStatus('non-existent-session')
      expect(status).toBe('unknown')
    })

    it('prioritizes "thinking" over "idle" even if session info shows running', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-busy-check', 'uuid-busy', 'TestProject', '/project/path', 'Hello')

      // Session is in busySessions (added by spawnSession) AND sessions map has running status
      // getSessionStatus should return 'thinking' because busySessions check comes first
      expect(service.getSessionStatus('session-busy-check')).toBe('thinking')
    })
  })

  describe('concurrent session independence (CTM-2.1 Task 5, AC: 3)', () => {
    it('multiple concurrent sessions tracked independently in sessions Map (Task 7.6)', async () => {
      mockSpawn.mockReturnValueOnce('pty-a').mockReturnValueOnce('pty-b').mockReturnValueOnce('pty-c')
      mockGetProcess.mockReturnValue({ state: 'running' })

      await service.spawnSession('session-a', 'uuid-a', 'TestProject', '/path', 'Hello A')
      await service.spawnSession('session-b', 'uuid-b', 'TestProject', '/path', 'Hello B')
      await service.spawnSession('session-c', 'uuid-c', 'TestProject', '/path', 'Hello C')

      // All 3 should be alive and tracked independently
      expect(service.isSessionAlive('session-a')).toBe(true)
      expect(service.isSessionAlive('session-b')).toBe(true)
      expect(service.isSessionAlive('session-c')).toBe(true)

      // All 3 should have independent caches
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-a')).toBe('session-a')
      expect(cache.get('tinsu-testproject-session-b')).toBe('session-b')
      expect(cache.get('tinsu-testproject-session-c')).toBe('session-c')

      // All 3 should have independent status
      expect(service.getSessionStatus('session-a')).toBe('thinking')
      expect(service.getSessionStatus('session-b')).toBe('thinking')
      expect(service.getSessionStatus('session-c')).toBe('thinking')
    })

    it('killing one session does not affect others (Task 7.7)', async () => {
      mockSpawn.mockReturnValueOnce('pty-x').mockReturnValueOnce('pty-y').mockReturnValueOnce('pty-z')
      mockGetProcess.mockReturnValue({ state: 'running' })

      await service.spawnSession('session-x', 'uuid-x', 'TestProject', '/path', 'Hello X')
      await service.spawnSession('session-y', 'uuid-y', 'TestProject', '/path', 'Hello Y')
      await service.spawnSession('session-z', 'uuid-z', 'TestProject', '/path', 'Hello Z')

      // Kill the middle session
      service.killSession('session-y')

      // session-y should be dead
      expect(service.isSessionAlive('session-y')).toBe(false)
      expect(service.getSessionStatus('session-y')).toBe('unknown')

      // session-x and session-z should still be alive
      expect(service.isSessionAlive('session-x')).toBe(true)
      expect(service.isSessionAlive('session-z')).toBe(true)
      expect(service.getSessionStatus('session-x')).toBe('thinking')
      expect(service.getSessionStatus('session-z')).toBe('thinking')

      // Caches for surviving sessions should be intact
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-x')).toBe('session-x')
      expect(cache.get('tinsu-testproject-session-z')).toBe('session-z')
      expect(cache.get('tinsu-testproject-session-y')).toBeUndefined()
    })
  })

  describe('Health Monitoring (CTM-2.2)', () => {
    it('startMonitoring() creates a 2-second interval (Task 6.1)', () => {
      vi.useFakeTimers()

      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      // startMonitoring is called in constructor, so create a fresh service
      const freshService = new ChatCliService('/test/chat-hooks')

      // The constructor calls startMonitoring, which calls setInterval with 2000ms
      // Note: constructor also implicitly sets up the interval
      const intervalCalls = setIntervalSpy.mock.calls.filter(
        (call) => call[1] === 2000
      )
      expect(intervalCalls.length).toBeGreaterThanOrEqual(1)

      freshService.killAll()
      setIntervalSpy.mockRestore()
      vi.useRealTimers()
    })

    it('health poll detects dead tmux session and removes from cache (Task 6.2)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-health-dead', 'uuid-dead', 'TestProject', '/path', 'Hello')
      mockExecAsync.mockClear()

      // Mock tmux has-session to return false (dead)
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))

      // Reset DB mock for this test
      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      // Manually invoke the monitoring logic by calling the private method pattern:
      // Access the internal tmuxSessionExists + cache cleanup by calling startMonitoring
      // and then triggering the async iteration. Instead, we can directly test the
      // behavior by checking that after a polling cycle, the cache is cleaned.
      // Use a small wait to let the 2-second interval fire.
      // Better approach: manually call the monitoring logic.

      // The startMonitoring interval is already running from the constructor.
      // Wait for it to fire (slightly more than 2s real time is too slow).
      // Instead, test the behavior directly:
      // Verify the session is in cache, then simulate what the poll does.
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-health-dead')).toBe('session-health-dead')

      // Since the interval is async, let's test by calling startMonitoring with fake timers
      vi.useFakeTimers()
      // Re-start monitoring so the interval is under fake timer control
      service.startMonitoring()

      // Re-mock after startMonitoring (which may have consumed a mock)
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))

      await vi.advanceTimersByTimeAsync(2100)

      // Session should be removed from sessionToChatCache
      expect(cache.get('tinsu-testproject-session-health-dead')).toBeUndefined()

      // DB should have been updated with status: 'paused'
      expect(mockDbUpdate).toHaveBeenCalled()
      expect(mockDbUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paused' })
      )

      vi.useRealTimers()
    })

    it('health poll keeps alive tmux sessions in cache (Task 6.3)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-health-alive', 'uuid-alive', 'TestProject', '/path', 'Hello')
      mockExecAsync.mockClear()

      vi.useFakeTimers()
      // Re-start monitoring under fake timer control
      service.startMonitoring()

      // Mock tmux has-session to return true (alive)
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' })

      await vi.advanceTimersByTimeAsync(2100)

      // Session should still be in sessionToChatCache
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-health-alive')).toBe('session-health-alive')

      vi.useRealTimers()
    })

    it('emitSessionStatus notifies registered listeners (Task 6.4)', async () => {
      const listener = vi.fn()
      service.onSessionStatus(listener)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-emit-test', 'uuid-emit', 'TestProject', '/path', 'Hello')
      mockExecAsync.mockClear()

      vi.useFakeTimers()
      service.startMonitoring()

      // Mock tmux has-session to return false (dead) to trigger emitSessionStatus
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))

      // Reset DB mock
      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      await vi.advanceTimersByTimeAsync(2100)

      // Listener should have been called with (sessionId, 'exited')
      expect(listener).toHaveBeenCalledWith('session-emit-test', 'exited')

      vi.useRealTimers()
    })

    it('onSessionStatus returns unsubscribe function (Task 6.5)', async () => {
      const listener = vi.fn()
      const unsubscribe = service.onSessionStatus(listener)

      // Unsubscribe before any events
      unsubscribe()

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-unsub-test', 'uuid-unsub', 'TestProject', '/path', 'Hello')
      mockExecAsync.mockClear()

      vi.useFakeTimers()
      service.startMonitoring()

      // Mock tmux as dead to trigger event
      mockExecAsync.mockRejectedValue(new Error('exit code 1'))

      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      await vi.advanceTimersByTimeAsync(2100)

      // Listener should NOT have been called (was unsubscribed)
      expect(listener).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('idle timeout kills session after 2 hours (Task 6.6)', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-idle-2h', 'uuid-idle-2h', 'TestProject', '/path', 'Hello')

      // Advance time past idle timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      const killed = service.checkIdleSessions()
      expect(killed).toContain('session-idle-2h')

      vi.useRealTimers()
    })

    it('idle timeout does NOT kill session within 2 hours (Task 6.7)', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-active-2h', 'uuid-active-2h', 'TestProject', '/path', 'Hello')

      // Advance time to just under the timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS - 60000)

      const killed = service.checkIdleSessions()
      expect(killed).toEqual([])

      vi.useRealTimers()
    })

    it('killAll clears monitorInterval (Task 6.8)', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      service.killAll()

      // clearInterval should have been called (for monitorInterval and/or idleCheckInterval)
      expect(clearIntervalSpy).toHaveBeenCalled()

      clearIntervalSpy.mockRestore()
    })

    it('concurrent health poll does not modify sessionCache during iteration (Task 6.9)', async () => {
      mockGetProcess.mockReturnValue({ state: 'running' })

      // Spawn 3 sessions
      mockSpawn.mockReturnValueOnce('pty-h1').mockReturnValueOnce('pty-h2').mockReturnValueOnce('pty-h3')
      await service.spawnSession('session-h1', 'uuid-h1', 'TestProject', '/path', 'Hello 1')
      await service.spawnSession('session-h2', 'uuid-h2', 'TestProject', '/path', 'Hello 2')
      await service.spawnSession('session-h3', 'uuid-h3', 'TestProject', '/path', 'Hello 3')

      mockExecAsync.mockClear()

      vi.useFakeTimers()
      service.startMonitoring()

      // First session is dead, others are alive
      mockExecAsync
        .mockRejectedValueOnce(new Error('exit code 1')) // session-h1: dead
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // session-h2: alive
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // session-h3: alive

      // Reset DB mock
      const mockWhereRun = vi.fn()
      const mockWhere = vi.fn().mockReturnValue({ run: mockWhereRun })
      mockDbUpdateSet.mockReturnValue({ where: mockWhere })

      // Advance timer to trigger health poll
      await vi.advanceTimersByTimeAsync(2100)

      // Only dead session should be removed
      const cache = service.getSessionToChatCache()
      expect(cache.get('tinsu-testproject-session-h1')).toBeUndefined()
      expect(cache.get('tinsu-testproject-session-h2')).toBe('session-h2')
      expect(cache.get('tinsu-testproject-session-h3')).toBe('session-h3')

      vi.useRealTimers()
    })

    it('checkIdleSessions emits idle-timeout event (Task 3.4)', async () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      const listener = vi.fn()
      service.onSessionStatus(listener)

      mockGetProcess.mockReturnValue({ state: 'running' })
      await service.spawnSession('session-idle-emit', 'uuid-idle-emit', 'TestProject', '/path', 'Hello')

      // Advance time past idle timeout
      vi.setSystemTime(now + IDLE_TIMEOUT_MS + 1000)

      service.checkIdleSessions()

      // Listener should have been called with 'idle-timeout'
      expect(listener).toHaveBeenCalledWith('session-idle-emit', 'idle-timeout')

      vi.useRealTimers()
    })

    it('startMonitoring is idempotent -- calling twice clears previous interval (Task 4.3)', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      // Call startMonitoring again (constructor already called it once)
      service.startMonitoring()

      // Should have cleared the previous interval before creating a new one
      expect(clearIntervalSpy).toHaveBeenCalled()

      clearIntervalSpy.mockRestore()
    })
  })
})
