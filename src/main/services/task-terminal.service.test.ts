import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskTerminalService } from './task-terminal.service'
import { exec, type ExecException } from 'child_process'

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}))

// Mock TmuxService
const mockCheckTmuxInstalled = vi.fn()
vi.mock('./tmux.service', () => ({
  TmuxService: {
    checkTmuxInstalled: () => mockCheckTmuxInstalled()
  }
}))

// Mock the database with full type support
const mockFindFirst = vi.fn()
const mockInsertValues = vi.fn()
const mockInsert = vi.fn(() => ({
  values: mockInsertValues
}))
const mockDelete = vi.fn(() => ({
  where: vi.fn()
}))

vi.mock('../db', () => ({
  db: {
    insert: () => mockInsert(),
    delete: () => mockDelete(),
    query: {
      task_sessions: {
        findFirst: () => mockFindFirst()
      }
    }
  }
}))

// Type for exec callback to fix TypeScript errors
type ExecCallback = (
  error: ExecException | null,
  stdout: string | Buffer,
  stderr: string | Buffer
) => void

describe('TaskTerminalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test
    TaskTerminalService.clearCache()
    mockFindFirst.mockReset()
    mockInsert.mockReset()
    mockInsertValues.mockReset()
    mockDelete.mockReset()
    mockCheckTmuxInstalled.mockReset()
    // Default: tmux is installed
    mockCheckTmuxInstalled.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createSession', () => {
    it('creates a new tmux session when none exists (AC: 1)', async () => {
      // Mock: no existing session in database
      mockFindFirst.mockResolvedValue(undefined)

      // Mock: tmux commands succeed
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.createSession('task-123', 'MyProject')

      // Should create session with correct naming convention
      expect(result).toBe('tinsu-myproject-task-123')

      // Should have called tmux new-session
      expect(exec).toHaveBeenCalledWith(
        'tmux new-session -d -s tinsu-myproject-task-123',
        { timeout: 5000 },
        expect.any(Function)
      )

      // Should have called insert
      expect(mockInsert).toHaveBeenCalled()
    })

    it('reuses existing session when already exists (AC: 2)', async () => {
      // Mock: existing session in database
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux has-session succeeds (session exists)
      vi.mocked(exec).mockImplementation(
        (cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          if (cmd.includes('has-session')) {
            cb?.(null, '', '')
          }
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.createSession('task-123', 'project')

      // Should return existing session name
      expect(result).toBe('tinsu-project-task-123')

      // Should NOT have created new session
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('recreates tmux session if DB record exists but tmux session is gone', async () => {
      // Mock: existing session in database
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Track which commands were called
      const commandsCalled: string[] = []

      // Mock: tmux has-session fails (session doesn't exist), new-session succeeds
      vi.mocked(exec).mockImplementation(
        (cmd: string, _options: unknown, callback?: ExecCallback) => {
          commandsCalled.push(cmd)
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback

          if (cmd.includes('has-session')) {
            // Session doesn't exist
            const error = new Error('session not found') as ExecException
            error.code = 1
            cb?.(error, '', '')
          } else if (cmd.includes('new-session')) {
            // Create session succeeds
            cb?.(null, '', '')
          }
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.createSession('task-123', 'project')

      // Should return existing session name
      expect(result).toBe('tinsu-project-task-123')

      // Should have called new-session to recreate
      expect(commandsCalled).toContain('tmux new-session -d -s tinsu-project-task-123')

      // Should NOT have created new DB record
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('sanitizes project name for session naming', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.createSession('task-456', 'My Cool Project!')

      // Should sanitize: lowercase, replace spaces with dashes, remove special chars
      expect(result).toBe('tinsu-my-cool-project-task-456')
    })

    it('throws error when tmux command fails (AC: 3)', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      // Mock: tmux command fails
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('tmux server not running') as ExecException
          cb?.(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      await expect(TaskTerminalService.createSession('task-789', 'project')).rejects.toThrow(
        'tmux server not running'
      )
    })

    it('handles duplicate session name gracefully', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      // Mock: new-session fails with duplicate error
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('duplicate session') as ExecException & { stderr?: string }
          error.stderr = 'duplicate session: tinsu-project-task-123'
          cb?.(error, '', 'duplicate session: tinsu-project-task-123')
          return {} as ReturnType<typeof exec>
        }
      )

      // Should not throw - duplicate is handled gracefully
      const result = await TaskTerminalService.createSession('task-123', 'project')
      expect(result).toBe('tinsu-project-task-123')
    })

    it('throws error when tmux is not installed', async () => {
      mockCheckTmuxInstalled.mockResolvedValue(false)

      await expect(TaskTerminalService.createSession('task-123', 'project')).rejects.toThrow(
        'tmux is not installed'
      )
    })

    it('rejects invalid taskId with special characters (security)', async () => {
      // Attempt command injection
      await expect(
        TaskTerminalService.createSession('task; rm -rf /', 'project')
      ).rejects.toThrow('Invalid taskId format')
    })

    it('rejects taskId with spaces (security)', async () => {
      await expect(TaskTerminalService.createSession('task 123', 'project')).rejects.toThrow(
        'Invalid taskId format'
      )
    })

    it('accepts valid UUID-style taskId', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      // UUIDs are alphanumeric with dashes - should be accepted
      const result = await TaskTerminalService.createSession(
        'abc123-def456-789',
        'project'
      )
      expect(result).toBe('tinsu-project-abc123-def456-789')
    })

    it('handles race condition with unique constraint violation', async () => {
      mockFindFirst
        .mockResolvedValueOnce(undefined) // First check - no session
        .mockResolvedValueOnce({
          // After constraint violation - return existing
          id: 'winner-id',
          task_id: 'task-race',
          tmux_session: 'tinsu-project-task-race',
          session_id: null,
          current_phase: null,
          created_at: new Date()
        })

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      // Mock insert to throw unique constraint error
      mockInsertValues.mockImplementation(() => {
        throw new Error('UNIQUE constraint failed: task_sessions.task_id')
      })

      const result = await TaskTerminalService.createSession('task-race', 'project')

      // Should return the existing session from the race winner
      expect(result).toBe('tinsu-project-task-race')
    })
  })

  describe('hasSession', () => {
    it('returns true when session exists in DB and tmux', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.hasSession('task-123')

      expect(result).toBe(true)
    })

    it('returns false when no session in DB', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await TaskTerminalService.hasSession('task-999')

      expect(result).toBe(false)
    })

    it('returns false when DB record exists but tmux session is gone', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux has-session fails (session doesn't exist)
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('session not found') as ExecException
          cb?.(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.hasSession('task-123')

      expect(result).toBe(false)
    })
  })

  describe('killSession', () => {
    it('kills tmux session and deletes database record', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      await TaskTerminalService.killSession('task-123')

      // Should have called tmux kill-session
      expect(exec).toHaveBeenCalledWith(
        'tmux kill-session -t tinsu-project-task-123',
        { timeout: 5000 },
        expect.any(Function)
      )

      // Should have called delete
      expect(mockDelete).toHaveBeenCalled()
    })

    it('does nothing when no session exists', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      await TaskTerminalService.killSession('task-999')

      expect(exec).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('ignores errors when tmux session already gone', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux kill-session fails (session already gone)
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('session not found') as ExecException
          cb?.(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      // Should not throw - just delete DB record
      await expect(TaskTerminalService.killSession('task-123')).resolves.not.toThrow()

      // Should still delete database record
      expect(mockDelete).toHaveBeenCalled()
    })
  })

  describe('getSessionName', () => {
    it('returns session name from database', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      const result = await TaskTerminalService.getSessionName('task-123')

      expect(result).toBe('tinsu-project-task-123')
    })

    it('returns null when no session exists', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await TaskTerminalService.getSessionName('task-999')

      expect(result).toBeNull()
    })

    it('uses cache for repeated lookups', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // First call
      await TaskTerminalService.getSessionName('task-123')
      // Second call should use cache
      await TaskTerminalService.getSessionName('task-123')

      // Database should only be queried once
      expect(mockFindFirst).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearCache', () => {
    it('clears the session cache', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // First call - populates cache
      await TaskTerminalService.getSessionName('task-123')
      expect(mockFindFirst).toHaveBeenCalledTimes(1)

      // Clear cache
      TaskTerminalService.clearCache()

      // Next call should query database again
      await TaskTerminalService.getSessionName('task-123')
      expect(mockFindFirst).toHaveBeenCalledTimes(2)
    })
  })

  describe('getAttachCommand', () => {
    it('returns attach command when session exists in DB and tmux (AC: 1)', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux has-session succeeds (session exists)
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.getAttachCommand('task-123')

      expect(result).toBe('tmux attach-session -t tinsu-project-task-123')
    })

    it('returns null when no session in DB', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      const result = await TaskTerminalService.getAttachCommand('task-999')

      expect(result).toBeNull()
    })

    it('returns null when DB record exists but tmux session is gone', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux has-session fails (session doesn't exist)
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('session not found') as ExecException
          error.code = 1
          cb?.(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await TaskTerminalService.getAttachCommand('task-123')

      expect(result).toBeNull()
    })
  })

  describe('sendCommand', () => {
    it('sends command to tmux session when session exists', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      const commandsCalled: string[] = []

      vi.mocked(exec).mockImplementation(
        (cmd: string, _options: unknown, callback?: ExecCallback) => {
          commandsCalled.push(cmd)
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      await TaskTerminalService.sendCommand('task-123', 'npm run test')

      // Should have called has-session first, then send-keys
      expect(commandsCalled).toContain('tmux has-session -t tinsu-project-task-123')
      expect(commandsCalled.some(cmd => cmd.includes('send-keys'))).toBe(true)
      expect(commandsCalled.some(cmd => cmd.includes('"npm run test"'))).toBe(true)
    })

    it('throws error when no session exists in DB', async () => {
      mockFindFirst.mockResolvedValue(undefined)

      await expect(
        TaskTerminalService.sendCommand('task-999', 'echo hello')
      ).rejects.toThrow('No terminal session for task task-999')
    })

    it('throws error when tmux session is gone', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      // Mock: tmux has-session fails
      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          const error = new Error('session not found') as ExecException
          error.code = 1
          cb?.(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      await expect(
        TaskTerminalService.sendCommand('task-123', 'echo hello')
      ).rejects.toThrow('tmux session tinsu-project-task-123 no longer exists')
    })

    it('escapes special characters in command', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'existing-id',
        task_id: 'task-123',
        tmux_session: 'tinsu-project-task-123',
        session_id: null,
        current_phase: null,
        created_at: new Date()
      })

      const commandsCalled: string[] = []

      vi.mocked(exec).mockImplementation(
        (cmd: string, _options: unknown, callback?: ExecCallback) => {
          commandsCalled.push(cmd)
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      await TaskTerminalService.sendCommand('task-123', 'echo "hello world"')

      // Should have used JSON.stringify to escape the command
      const sendKeysCmd = commandsCalled.find(cmd => cmd.includes('send-keys'))
      expect(sendKeysCmd).toContain('"echo \\"hello world\\""')
    })
  })

  describe('session naming convention', () => {
    beforeEach(() => {
      mockFindFirst.mockResolvedValue(undefined)

      vi.mocked(exec).mockImplementation(
        (_cmd: string, _options: unknown, callback?: ExecCallback) => {
          const cb = typeof _options === 'function' ? (_options as ExecCallback) : callback
          cb?.(null, '', '')
          return {} as ReturnType<typeof exec>
        }
      )
    })

    it('creates session with format tinsu-{project}-{taskId}', async () => {
      const result = await TaskTerminalService.createSession('abc123', 'testproject')

      expect(result).toBe('tinsu-testproject-abc123')
    })

    it('lowercases project name', async () => {
      const result = await TaskTerminalService.createSession('task1', 'TestProject')

      expect(result).toBe('tinsu-testproject-task1')
    })

    it('replaces spaces with dashes', async () => {
      const result = await TaskTerminalService.createSession('task2', 'Test Project Name')

      expect(result).toBe('tinsu-test-project-name-task2')
    })

    it('removes special characters', async () => {
      const result = await TaskTerminalService.createSession('task3', 'Project@Name!123')

      expect(result).toBe('tinsu-projectname123-task3')
    })

    it('handles empty project name', async () => {
      const result = await TaskTerminalService.createSession('task4', '')

      expect(result).toBe('tinsu--task4')
    })
  })
})
