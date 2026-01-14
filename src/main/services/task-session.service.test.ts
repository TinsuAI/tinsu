import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskSessionService } from './task-session.service'

// Mock the database
const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateSet = vi.fn(() => ({
  where: vi.fn()
}))

vi.mock('../db', () => ({
  db: {
    update: () => mockUpdate(),
    query: {
      task_sessions: {
        findFirst: () => mockFindFirst()
      }
    }
  }
}))

// Make mockUpdate return the set method
mockUpdate.mockReturnValue({
  set: mockUpdateSet
})

describe('TaskSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test for isolation
    TaskSessionService.clearCache()
    mockFindFirst.mockReset()
    mockUpdate.mockReset()
    mockUpdateSet.mockReset()
    mockUpdate.mockReturnValue({
      set: mockUpdateSet
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('updateSessionId', () => {
    it('updates session_id in database and populates cache (AC: #3)', async () => {
      const taskId = 'task-123'
      const sessionId = 'claude-session-abc'

      await TaskSessionService.updateSessionId(taskId, sessionId)

      // Should have called update on database
      expect(mockUpdate).toHaveBeenCalled()
      expect(mockUpdateSet).toHaveBeenCalledWith({ session_id: sessionId })

      // Cache should now contain the mapping
      expect(TaskSessionService.getCacheSize()).toBe(1)
    })

    it('updates cache for fast subsequent lookups', async () => {
      const taskId = 'task-456'
      const sessionId = 'claude-session-def'

      await TaskSessionService.updateSessionId(taskId, sessionId)

      // Should be able to get taskId from cache without DB query
      const result = await TaskSessionService.getTaskBySessionId(sessionId)

      expect(result).toBe(taskId)
      // Database should not have been queried (cache hit)
      expect(mockFindFirst).not.toHaveBeenCalled()
    })
  })

  describe('getTaskBySessionId', () => {
    it('returns taskId from cache when available (hot path)', async () => {
      const taskId = 'task-cached'
      const sessionId = 'session-cached'

      // Populate cache
      await TaskSessionService.updateSessionId(taskId, sessionId)

      // Reset mock to track new calls
      mockFindFirst.mockReset()

      // Should return from cache
      const result = await TaskSessionService.getTaskBySessionId(sessionId)

      expect(result).toBe(taskId)
      // No database query needed
      expect(mockFindFirst).not.toHaveBeenCalled()
    })

    it('falls back to database when not in cache', async () => {
      const sessionId = 'session-db'
      const taskId = 'task-from-db'

      mockFindFirst.mockResolvedValue({
        id: 'record-id',
        task_id: taskId,
        session_id: sessionId,
        tmux_session: 'tinsu-project-task-from-db',
        current_phase: null,
        created_at: new Date()
      })

      const result = await TaskSessionService.getTaskBySessionId(sessionId)

      expect(result).toBe(taskId)
      expect(mockFindFirst).toHaveBeenCalled()
    })

    it('populates cache after database lookup', async () => {
      const sessionId = 'session-populate'
      const taskId = 'task-populate'

      mockFindFirst.mockResolvedValue({
        id: 'record-id',
        task_id: taskId,
        session_id: sessionId,
        tmux_session: 'tinsu-project-task-populate',
        current_phase: null,
        created_at: new Date()
      })

      // First call - database lookup
      await TaskSessionService.getTaskBySessionId(sessionId)
      expect(mockFindFirst).toHaveBeenCalledTimes(1)

      // Reset mock
      mockFindFirst.mockReset()

      // Second call - should use cache
      const result = await TaskSessionService.getTaskBySessionId(sessionId)

      expect(result).toBe(taskId)
      expect(mockFindFirst).not.toHaveBeenCalled() // No new DB call
    })

    it('returns null when session not found in cache or database (AC: #2)', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await TaskSessionService.getTaskBySessionId('unknown-session')

      expect(result).toBeNull()
    })
  })

  describe('routeHookEvent', () => {
    it('returns taskId when session is found (AC: #1)', async () => {
      const taskId = 'task-route'
      const sessionId = 'session-route'

      // Populate cache
      await TaskSessionService.updateSessionId(taskId, sessionId)

      const result = await TaskSessionService.routeHookEvent(
        sessionId,
        'PostToolUse',
        { session_id: sessionId, tool: 'Read' }
      )

      expect(result).toBe(taskId)
    })

    it('returns null for orphan event (session not found) (AC: #2)', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await TaskSessionService.routeHookEvent(
        'orphan-session',
        'Stop',
        { session_id: 'orphan-session' }
      )

      expect(result).toBeNull()
    })

    it('logs warning for orphan events but does not throw (AC: #2)', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const payload = { session_id: 'orphan', some_data: 'test' }

      // Should not throw
      await expect(
        TaskSessionService.routeHookEvent('orphan', 'PostToolUse', payload)
      ).resolves.not.toThrow()

      // Should have logged warning
      expect(warnSpy).toHaveBeenCalledWith(
        '[TaskSessionService] Orphan hook event received:',
        expect.objectContaining({
          sessionId: 'orphan',
          eventType: 'PostToolUse',
          payload
        })
      )

      warnSpy.mockRestore()
    })

    it('does not throw error for unknown sessions', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Should NOT throw - just return null
      const result = await TaskSessionService.routeHookEvent(
        'unknown-session-123',
        'Stop',
        { arbitrary: 'data' }
      )

      expect(result).toBeNull()
      warnSpy.mockRestore()
    })
  })

  describe('clearSession', () => {
    it('removes session from cache by taskId', async () => {
      const taskId = 'task-clear'
      const sessionId = 'session-clear'

      // Populate cache
      await TaskSessionService.updateSessionId(taskId, sessionId)
      expect(TaskSessionService.getCacheSize()).toBe(1)

      // Clear session
      TaskSessionService.clearSession(taskId)

      // Cache should be empty
      expect(TaskSessionService.getCacheSize()).toBe(0)
    })

    it('does nothing when taskId not in cache', () => {
      // Should not throw
      expect(() => TaskSessionService.clearSession('non-existent-task')).not.toThrow()
    })

    it('only removes the specific task session from cache', async () => {
      // Populate multiple sessions
      await TaskSessionService.updateSessionId('task-1', 'session-1')
      await TaskSessionService.updateSessionId('task-2', 'session-2')
      await TaskSessionService.updateSessionId('task-3', 'session-3')
      expect(TaskSessionService.getCacheSize()).toBe(3)

      // Clear only task-2
      TaskSessionService.clearSession('task-2')

      expect(TaskSessionService.getCacheSize()).toBe(2)

      // task-1 and task-3 should still be accessible
      const result1 = await TaskSessionService.getTaskBySessionId('session-1')
      const result3 = await TaskSessionService.getTaskBySessionId('session-3')

      expect(result1).toBe('task-1')
      expect(result3).toBe('task-3')
    })
  })

  describe('clearCache', () => {
    it('clears all cached mappings', async () => {
      // Populate cache
      await TaskSessionService.updateSessionId('task-a', 'session-a')
      await TaskSessionService.updateSessionId('task-b', 'session-b')
      expect(TaskSessionService.getCacheSize()).toBe(2)

      // Clear all
      TaskSessionService.clearCache()

      expect(TaskSessionService.getCacheSize()).toBe(0)
    })
  })

  describe('getCacheSize', () => {
    it('returns current cache size', async () => {
      expect(TaskSessionService.getCacheSize()).toBe(0)

      await TaskSessionService.updateSessionId('task-x', 'session-x')
      expect(TaskSessionService.getCacheSize()).toBe(1)

      await TaskSessionService.updateSessionId('task-y', 'session-y')
      expect(TaskSessionService.getCacheSize()).toBe(2)
    })
  })

  describe('cache isolation between tests', () => {
    it('starts with empty cache (test 1)', async () => {
      expect(TaskSessionService.getCacheSize()).toBe(0)

      await TaskSessionService.updateSessionId('task-iso-1', 'session-iso-1')
      expect(TaskSessionService.getCacheSize()).toBe(1)
    })

    it('starts with empty cache (test 2 - verifies isolation)', () => {
      // This test verifies that beforeEach cleared the cache
      expect(TaskSessionService.getCacheSize()).toBe(0)
    })
  })

  // Task 5.2: Integration flow test for session-task mapping
  describe('integration flow: registerSessionId → getTaskBySessionId → routeHookEvent', () => {
    it('full session registration and lookup flow (Task 5.2)', async () => {
      const taskId = 'task-integration-flow'
      const sessionId = 'session-integration-abc'

      // Step 1: Register session ID (simulates TaskTerminalService.createSession followed by registerSessionId)
      await TaskSessionService.updateSessionId(taskId, sessionId)

      // Step 2: Verify lookup returns correct task
      const lookedUpTaskId = await TaskSessionService.getTaskBySessionId(sessionId)
      expect(lookedUpTaskId).toBe(taskId)

      // Step 3: Verify routing works for hook events
      const routedTaskId = await TaskSessionService.routeHookEvent(
        sessionId,
        'PostToolUse',
        {
          session_id: sessionId,
          transcript_path: '/tmp/transcript.json',
          cwd: '/home/user/project',
          hook_event_name: 'PostToolUse',
          tool_name: 'Read'
        }
      )
      expect(routedTaskId).toBe(taskId)

      // Step 4: Verify cache was populated
      expect(TaskSessionService.getCacheSize()).toBe(1)
    })

    it('multiple sessions can be tracked independently', async () => {
      // Register multiple task sessions
      await TaskSessionService.updateSessionId('task-a', 'session-aaa')
      await TaskSessionService.updateSessionId('task-b', 'session-bbb')
      await TaskSessionService.updateSessionId('task-c', 'session-ccc')

      // Verify each session routes to correct task
      expect(await TaskSessionService.getTaskBySessionId('session-aaa')).toBe('task-a')
      expect(await TaskSessionService.getTaskBySessionId('session-bbb')).toBe('task-b')
      expect(await TaskSessionService.getTaskBySessionId('session-ccc')).toBe('task-c')

      // Verify cache has all three
      expect(TaskSessionService.getCacheSize()).toBe(3)

      // Clear one session and verify others remain
      TaskSessionService.clearSession('task-b')
      expect(TaskSessionService.getCacheSize()).toBe(2)
      expect(await TaskSessionService.getTaskBySessionId('session-aaa')).toBe('task-a')
      expect(await TaskSessionService.getTaskBySessionId('session-ccc')).toBe('task-c')
    })
  })
})
