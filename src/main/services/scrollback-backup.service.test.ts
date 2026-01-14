import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { TaskTerminalService } from './task-terminal.service'
import { db } from '../db'
import { app } from 'electron'
import * as fsPromises from 'fs/promises'
import * as fs from 'fs'
import path from 'path'

// Mock dependencies
vi.mock('./task-terminal.service')
vi.mock('../db', () => ({
  db: {
    query: {
      task_sessions: {
        findMany: vi.fn()
      }
    }
  }
}))
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn()
  }
}))
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  rename: vi.fn(),
  readdir: vi.fn()
}))
vi.mock('fs', () => ({
  existsSync: vi.fn()
}))
vi.mock('child_process', () => ({
  exec: vi.fn()
}))
vi.mock('zlib', () => ({
  gzip: vi.fn(),
  gunzip: vi.fn()
}))

// Import service after mocks are set up
import { ScrollbackBackupService, type BackupMetadata } from './scrollback-backup.service'

describe('ScrollbackBackupService', () => {
  const mockUserDataPath = '/mock/user/data'
  const mockTaskId = 'task-123'
  const mockSessionName = 'tinsu-project-task-123'
  const mockScrollback = 'line1\nline2\nline3\n'
  const mockCompressedData = Buffer.from('compressed-data')

  beforeEach(() => {
    vi.clearAllMocks()
    ScrollbackBackupService.clearTimers()

    // Default mock setup
    vi.mocked(app.getPath).mockReturnValue(mockUserDataPath)
    vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(mockSessionName)
    vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(true)
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined)
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined)
    vi.mocked(fsPromises.rename).mockResolvedValue(undefined)
    vi.mocked(fsPromises.rm).mockResolvedValue(undefined)
  })

  afterEach(() => {
    ScrollbackBackupService.clearTimers()
  })

  describe('getBasePath', () => {
    it('returns path under userData/terminal-history', () => {
      const result = ScrollbackBackupService.getBasePath()
      expect(result).toBe(path.join(mockUserDataPath, 'terminal-history'))
      expect(app.getPath).toHaveBeenCalledWith('userData')
    })
  })

  describe('getBackupPath', () => {
    it('returns path for specific task under base path', () => {
      const result = ScrollbackBackupService.getBackupPath(mockTaskId)
      expect(result).toBe(path.join(mockUserDataPath, 'terminal-history', mockTaskId))
    })
  })

  describe('captureScrollback', () => {
    it('returns null when no session name', async () => {
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)

      const result = await ScrollbackBackupService.captureScrollback(mockTaskId)

      expect(result).toBeNull()
    })

    it('returns null when session does not exist', async () => {
      vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(false)

      const result = await ScrollbackBackupService.captureScrollback(mockTaskId)

      expect(result).toBeNull()
    })

    // Note: Testing actual tmux capture requires complex promisify mocking
    // The control flow is validated by the above tests
  })

  describe('backupScrollback', () => {
    it('returns false when no scrollback captured (no session)', async () => {
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)

      const result = await ScrollbackBackupService.backupScrollback(mockTaskId)

      expect(result).toBe(false)
    })

    it('returns false when no scrollback captured (session gone)', async () => {
      vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(false)

      const result = await ScrollbackBackupService.backupScrollback(mockTaskId)

      expect(result).toBe(false)
    })
  })

  describe('backupOnStatusChange', () => {
    it('does nothing when no session exists', async () => {
      vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(false)

      await ScrollbackBackupService.backupOnStatusChange(mockTaskId)

      // No backup should have been attempted - mkdir not called
      expect(fsPromises.mkdir).not.toHaveBeenCalled()
    })

    it('logs warning on backup failure but does not throw', async () => {
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)
      vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(true)
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Should not throw
      await ScrollbackBackupService.backupOnStatusChange(mockTaskId)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status change backup failed')
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe('startPeriodicBackup', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('creates interval timer for task', () => {
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)

      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(true)
    })

    it('prevents duplicate timers for same task', () => {
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)

      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(1)
    })

    it('uses default 5 minute interval', () => {
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)

      vi.advanceTimersByTime(300000)

      // Backup should have been attempted (hasSession is called in the interval)
      expect(TaskTerminalService.hasSession).toHaveBeenCalled()
    })

    it('uses custom interval when specified', () => {
      const customInterval = 60000 // 1 minute
      ScrollbackBackupService.startPeriodicBackup(mockTaskId, customInterval)

      vi.advanceTimersByTime(60000)

      expect(TaskTerminalService.hasSession).toHaveBeenCalled()
    })

    it('stops timer when session no longer exists', async () => {
      vi.mocked(TaskTerminalService.hasSession).mockResolvedValue(false)

      ScrollbackBackupService.startPeriodicBackup(mockTaskId)
      await vi.advanceTimersByTimeAsync(300000)

      // Timer should be stopped after discovering no session
      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(false)
    })
  })

  describe('stopPeriodicBackup', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears interval and removes from map', () => {
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)
      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(true)

      ScrollbackBackupService.stopPeriodicBackup(mockTaskId)

      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(false)
    })

    it('does nothing if no timer exists', () => {
      // Should not throw
      ScrollbackBackupService.stopPeriodicBackup('nonexistent-task')

      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(0)
    })
  })

  describe('backupAllActiveSessions', () => {
    it('attempts backup for all sessions from database', async () => {
      const mockSessions = [{ task_id: 'task-1' }, { task_id: 'task-2' }, { task_id: 'task-3' }]
      vi.mocked(db.query.task_sessions.findMany).mockResolvedValue(mockSessions as unknown[])
      // Make all sessions fail early (no session name) to avoid exec calls
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)

      await ScrollbackBackupService.backupAllActiveSessions()

      // Each session should be checked for backup
      expect(TaskTerminalService.getSessionName).toHaveBeenCalledTimes(3)
    })

    it('continues with other sessions on individual failures', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockSessions = [{ task_id: 'task-1' }, { task_id: 'task-2' }]
      vi.mocked(db.query.task_sessions.findMany).mockResolvedValue(mockSessions as unknown[])

      // Make all tasks fail (no session name) to avoid exec calls but still test iteration
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)

      await ScrollbackBackupService.backupAllActiveSessions()

      // Both should be attempted
      expect(TaskTerminalService.getSessionName).toHaveBeenCalledTimes(2)
      consoleWarnSpy.mockRestore()
    })
  })

  describe('backupOnShutdown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('stops all periodic backups', async () => {
      ScrollbackBackupService.startPeriodicBackup('task-1')
      ScrollbackBackupService.startPeriodicBackup('task-2')
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(2)

      vi.mocked(db.query.task_sessions.findMany).mockResolvedValue([])

      await ScrollbackBackupService.backupOnShutdown()

      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(0)
    })

    it('attempts backup for all active sessions', async () => {
      const mockSessions = [{ task_id: 'task-1' }]
      vi.mocked(db.query.task_sessions.findMany).mockResolvedValue(mockSessions as unknown[])
      // Make session fail early (no session name) to avoid exec calls
      vi.mocked(TaskTerminalService.getSessionName).mockResolvedValue(null)

      await ScrollbackBackupService.backupOnShutdown()

      expect(TaskTerminalService.getSessionName).toHaveBeenCalledWith('task-1')
    })
  })

  describe('restoreScrollback', () => {
    it('returns null when backup file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await ScrollbackBackupService.restoreScrollback(mockTaskId)

      expect(result).toBeNull()
    })

    // Note: Full decompression tests require promisify mocking
    // The file existence check validates the control flow
  })

  describe('getBackupMetadata', () => {
    it('returns null when metadata file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await ScrollbackBackupService.getBackupMetadata(mockTaskId)

      expect(result).toBeNull()
    })

    it('parses and returns metadata', async () => {
      const mockMetadata: BackupMetadata = {
        lines: 100,
        bytes: 500,
        lastBackup: '2026-01-14T12:00:00.000Z',
        tmuxSession: mockSessionName
      }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(mockMetadata))

      const result = await ScrollbackBackupService.getBackupMetadata(mockTaskId)

      expect(result).toEqual(mockMetadata)
    })

    it('returns null and logs warning on parse error', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fsPromises.readFile).mockResolvedValue('invalid json')

      const result = await ScrollbackBackupService.getBackupMetadata(mockTaskId)

      expect(result).toBeNull()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read metadata'),
        expect.any(Error)
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe('deleteBackup', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes backup directory when it exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      await ScrollbackBackupService.deleteBackup(mockTaskId)

      expect(fsPromises.rm).toHaveBeenCalledWith(
        path.join(mockUserDataPath, 'terminal-history', mockTaskId),
        { recursive: true }
      )
    })

    it('does nothing when backup directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      await ScrollbackBackupService.deleteBackup(mockTaskId)

      expect(fsPromises.rm).not.toHaveBeenCalled()
    })

    it('stops periodic backup timer for the task', async () => {
      ScrollbackBackupService.startPeriodicBackup(mockTaskId)
      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(true)

      vi.mocked(fs.existsSync).mockReturnValue(true)

      await ScrollbackBackupService.deleteBackup(mockTaskId)

      expect(ScrollbackBackupService.hasActiveTimer(mockTaskId)).toBe(false)
    })
  })

  describe('listBackups', () => {
    it('returns empty array when base path does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await ScrollbackBackupService.listBackups()

      expect(result).toEqual([])
    })

    it('returns list of backup directories', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fsPromises.readdir).mockResolvedValue([
        'task-1',
        'task-2',
        'task-3'
      ] as unknown as Awaited<ReturnType<typeof fsPromises.readdir>>)

      const result = await ScrollbackBackupService.listBackups()

      expect(result).toEqual(['task-1', 'task-2', 'task-3'])
    })
  })

  describe('clearTimers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('clears all active timers', () => {
      ScrollbackBackupService.startPeriodicBackup('task-1')
      ScrollbackBackupService.startPeriodicBackup('task-2')
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(2)

      ScrollbackBackupService.clearTimers()

      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(0)
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('hasActiveTimer returns false for non-existent task', () => {
      expect(ScrollbackBackupService.hasActiveTimer('nonexistent')).toBe(false)
    })

    it('getActiveTimerCount returns correct count', () => {
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(0)

      ScrollbackBackupService.startPeriodicBackup('task-1')
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(1)

      ScrollbackBackupService.startPeriodicBackup('task-2')
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(2)

      ScrollbackBackupService.stopPeriodicBackup('task-1')
      expect(ScrollbackBackupService.getActiveTimerCount()).toBe(1)
    })
  })
})
