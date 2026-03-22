/**
 * Git Log Service Tests - Story 8.10
 *
 * Tests for the GitLogService class.
 *
 * @see Story 8.10: Task 10.5 - Test error logging writes to file
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, utimesSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { GitLogService, type GitLogEntry } from './git-log.service'

describe('GitLogService', () => {
  let testProjectPath: string

  beforeEach(() => {
    // Create a unique temp directory for each test
    testProjectPath = join(tmpdir(), `tinsu-gitlog-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testProjectPath, { recursive: true })
  })

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  describe('log', () => {
    it('should create git-logs directory if it does not exist', () => {
      const logDir = GitLogService.getLogDir(testProjectPath)
      expect(existsSync(logDir)).toBe(false)

      const entry: GitLogEntry = {
        timestamp: new Date().toISOString(),
        operationType: 'createWorktree',
        taskId: 'task-123',
        status: 'started'
      }

      GitLogService.log(testProjectPath, entry)

      expect(existsSync(logDir)).toBe(true)
    })

    it('should write log entry as JSON line', () => {
      const entry: GitLogEntry = {
        timestamp: '2024-01-15T10:30:00.000Z',
        operationType: 'merge',
        taskId: 'task-456',
        status: 'succeeded',
        durationMs: 1500
      }

      GitLogService.log(testProjectPath, entry)

      const logFiles = require('fs').readdirSync(GitLogService.getLogDir(testProjectPath))
      expect(logFiles.length).toBe(1)

      const logPath = join(GitLogService.getLogDir(testProjectPath), logFiles[0])
      const content = readFileSync(logPath, 'utf-8')

      const parsed = JSON.parse(content.trim())
      expect(parsed.operationType).toBe('merge')
      expect(parsed.taskId).toBe('task-456')
      expect(parsed.status).toBe('succeeded')
    })

    it('should append multiple entries to same log file', () => {
      const entry1: GitLogEntry = {
        timestamp: new Date().toISOString(),
        operationType: 'createWorktree',
        status: 'started'
      }

      const entry2: GitLogEntry = {
        timestamp: new Date().toISOString(),
        operationType: 'createWorktree',
        status: 'succeeded'
      }

      GitLogService.log(testProjectPath, entry1)
      GitLogService.log(testProjectPath, entry2)

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(2)
    })
  })

  describe('logStart / logSuccess / logFailure', () => {
    it('should log start with correct status', () => {
      GitLogService.logStart(testProjectPath, 'createWorktree', 'task-1', 'git worktree add')

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(1)
      expect(logs[0].status).toBe('started')
      expect(logs[0].operationType).toBe('createWorktree')
      expect(logs[0].command).toBe('git worktree add')
    })

    it('should log success with duration', () => {
      GitLogService.logSuccess(testProjectPath, 'merge', 'task-2', 2500, { commitSha: 'abc123' })

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(1)
      expect(logs[0].status).toBe('succeeded')
      expect(logs[0].durationMs).toBe(2500)
      expect(logs[0].details).toEqual({ commitSha: 'abc123' })
    })

    it('should log failure with error and exit code', () => {
      GitLogService.logFailure(testProjectPath, 'merge', 'task-3', 'Merge conflict', 1, 'git merge branch', 1000)

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(1)
      expect(logs[0].status).toBe('failed')
      expect(logs[0].error).toBe('Merge conflict')
      expect(logs[0].exitCode).toBe(1)
      expect(logs[0].command).toBe('git merge branch')
    })
  })

  describe('readLogs', () => {
    it('should return empty array when no logs exist', () => {
      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs).toEqual([])
    })

    it('should parse and return all log entries', () => {
      GitLogService.logStart(testProjectPath, 'op1', 'task-1')
      GitLogService.logSuccess(testProjectPath, 'op1', 'task-1', 100)
      GitLogService.logFailure(testProjectPath, 'op2', 'task-2', 'Error')

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(3)
      expect(logs[0].operationType).toBe('op1')
      expect(logs[1].operationType).toBe('op1')
      expect(logs[2].operationType).toBe('op2')
    })

    it('should skip invalid JSON lines', () => {
      // Create log directory and file with invalid JSON
      const logDir = GitLogService.getLogDir(testProjectPath)
      mkdirSync(logDir, { recursive: true })

      const today = new Date().toISOString().split('T')[0]
      const logPath = join(logDir, `git-${today}.log`)

      const validEntry = JSON.stringify({ timestamp: '2024-01-01', operationType: 'test', status: 'started' })
      writeFileSync(logPath, `${validEntry}\nnot valid json\n${validEntry}\n`, 'utf-8')

      const logs = GitLogService.readLogs(testProjectPath)
      expect(logs.length).toBe(2)
    })
  })

  describe('listLogDates', () => {
    it('should return empty array when no logs directory', () => {
      const dates = GitLogService.listLogDates(testProjectPath)
      expect(dates).toEqual([])
    })

    it('should list available log dates in reverse chronological order', () => {
      const logDir = GitLogService.getLogDir(testProjectPath)
      mkdirSync(logDir, { recursive: true })

      writeFileSync(join(logDir, 'git-2024-01-15.log'), '{}', 'utf-8')
      writeFileSync(join(logDir, 'git-2024-01-10.log'), '{}', 'utf-8')
      writeFileSync(join(logDir, 'git-2024-01-20.log'), '{}', 'utf-8')
      writeFileSync(join(logDir, 'not-a-log.txt'), '{}', 'utf-8')

      const dates = GitLogService.listLogDates(testProjectPath)
      expect(dates).toEqual(['2024-01-20', '2024-01-15', '2024-01-10'])
    })
  })

  describe('cleanupOldLogs', () => {
    it('should remove log files older than 7 days', () => {
      const logDir = GitLogService.getLogDir(testProjectPath)
      mkdirSync(logDir, { recursive: true })

      // Create an old log file
      const oldLogPath = join(logDir, 'git-2024-01-01.log')
      writeFileSync(oldLogPath, '{}', 'utf-8')

      // Set modified time to 10 days ago
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      utimesSync(oldLogPath, tenDaysAgo, tenDaysAgo)

      // Create a recent log file
      const recentLogPath = join(logDir, 'git-2024-01-15.log')
      writeFileSync(recentLogPath, '{}', 'utf-8')

      GitLogService.cleanupOldLogs(testProjectPath)

      expect(existsSync(oldLogPath)).toBe(false)
      expect(existsSync(recentLogPath)).toBe(true)
    })
  })

  describe('getLogsSize', () => {
    it('should return 0 when no logs exist', () => {
      const size = GitLogService.getLogsSize(testProjectPath)
      expect(size).toBe(0)
    })

    it('should return total size of all log files', () => {
      const logDir = GitLogService.getLogDir(testProjectPath)
      mkdirSync(logDir, { recursive: true })

      const content1 = '{"test": "data1"}\n'
      const content2 = '{"test": "data2", "more": "stuff"}\n'

      writeFileSync(join(logDir, 'git-2024-01-15.log'), content1, 'utf-8')
      writeFileSync(join(logDir, 'git-2024-01-16.log'), content2, 'utf-8')

      const size = GitLogService.getLogsSize(testProjectPath)
      expect(size).toBe(content1.length + content2.length)
    })
  })
})
