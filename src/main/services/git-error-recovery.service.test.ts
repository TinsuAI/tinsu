/**
 * Git Error Recovery Service Tests - Story 8.10
 *
 * Tests for the GitErrorRecoveryService class.
 *
 * @see Story 8.10: Task 10.2 - Test GitErrorRecoveryService records and reads operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { GitErrorRecoveryService, type GitOperationState } from './git-error-recovery.service'

describe('GitErrorRecoveryService', () => {
  let testProjectPath: string

  beforeEach(() => {
    // Create a unique temp directory for each test
    testProjectPath = join(tmpdir(), `tinsu-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testProjectPath, { recursive: true })
  })

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true, force: true })
    }
  })

  describe('recordOperationStart', () => {
    it('should create .tinsu directory if it does not exist', () => {
      const tinsuDir = join(testProjectPath, '.tinsu')
      expect(existsSync(tinsuDir)).toBe(false)

      const op: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-123',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op)

      expect(existsSync(tinsuDir)).toBe(true)
    })

    it('should write operation to git-operations.json', () => {
      const op: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-123',
        worktreePath: '/path/to/worktree',
        branchName: 'tinsu/story-task-123-feature',
        startedAt: 1704067200000,
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op)

      const filePath = GitErrorRecoveryService.getOperationsFilePath(testProjectPath)
      expect(existsSync(filePath)).toBe(true)

      const content = JSON.parse(readFileSync(filePath, 'utf-8'))
      expect(content.operations).toHaveLength(1)
      expect(content.operations[0]).toMatchObject({
        operationType: 'createWorktree',
        taskId: 'task-123',
        worktreePath: '/path/to/worktree',
        branchName: 'tinsu/story-task-123-feature',
        status: 'pending'
      })
    })

    it('should append multiple operations', () => {
      const op1: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testProjectPath)
      expect(incomplete).toHaveLength(2)
    })
  })

  describe('recordOperationComplete', () => {
    it('should remove completed operation from the file', () => {
      const op: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-123',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op)
      expect(GitErrorRecoveryService.getIncompleteOperations(testProjectPath)).toHaveLength(1)

      GitErrorRecoveryService.recordOperationComplete(testProjectPath, 'createWorktree', 'task-123')
      expect(GitErrorRecoveryService.getIncompleteOperations(testProjectPath)).toHaveLength(0)
    })

    it('should only remove matching operation', () => {
      const op1: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      GitErrorRecoveryService.recordOperationComplete(testProjectPath, 'createWorktree', 'task-1')

      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testProjectPath)
      expect(incomplete).toHaveLength(1)
      expect(incomplete[0].taskId).toBe('task-2')
    })
  })

  describe('recordOperationFailed', () => {
    it('should update operation status to failed with error message', () => {
      const op: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-123',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op)
      GitErrorRecoveryService.recordOperationFailed(
        testProjectPath,
        'merge',
        'task-123',
        'Merge conflict detected'
      )

      const filePath = GitErrorRecoveryService.getOperationsFilePath(testProjectPath)
      const content = JSON.parse(readFileSync(filePath, 'utf-8'))

      expect(content.operations[0].status).toBe('failed')
      expect(content.operations[0].error).toBe('Merge conflict detected')
      expect(content.operations[0].completedAt).toBeDefined()
    })

    it('should not modify operations with different taskId', () => {
      const op1: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      GitErrorRecoveryService.recordOperationFailed(testProjectPath, 'merge', 'task-1', 'Error')

      const filePath = GitErrorRecoveryService.getOperationsFilePath(testProjectPath)
      const content = JSON.parse(readFileSync(filePath, 'utf-8'))

      expect(content.operations[0].status).toBe('failed')
      expect(content.operations[1].status).toBe('pending')
    })
  })

  describe('getIncompleteOperations', () => {
    it('should return empty array when no operations file exists', () => {
      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testProjectPath)
      expect(incomplete).toEqual([])
    })

    it('should only return pending operations', () => {
      const op1: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      // Complete one operation
      GitErrorRecoveryService.recordOperationComplete(testProjectPath, 'createWorktree', 'task-1')

      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testProjectPath)
      expect(incomplete).toHaveLength(1)
      expect(incomplete[0].operationType).toBe('merge')
    })

    it('should return empty array when file is corrupted', () => {
      // Create corrupted file
      const tinsuDir = join(testProjectPath, '.tinsu')
      mkdirSync(tinsuDir, { recursive: true })

      const filePath = GitErrorRecoveryService.getOperationsFilePath(testProjectPath)
      require('fs').writeFileSync(filePath, 'not valid json{{{', 'utf-8')

      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testProjectPath)
      expect(incomplete).toEqual([])
    })
  })

  describe('getFailedOperations', () => {
    it('should only return failed operations', () => {
      const op1: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      // Fail one operation
      GitErrorRecoveryService.recordOperationFailed(testProjectPath, 'merge', 'task-2', 'Merge failed')

      const failed = GitErrorRecoveryService.getFailedOperations(testProjectPath)
      expect(failed).toHaveLength(1)
      expect(failed[0].operationType).toBe('merge')
      expect(failed[0].error).toBe('Merge failed')
    })
  })

  describe('removeOperation', () => {
    it('should remove specific operation by type and taskId', () => {
      const op1: GitOperationState = {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      }

      const op2: GitOperationState = {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'failed',
        error: 'Some error'
      }

      GitErrorRecoveryService.recordOperationStart(testProjectPath, op1)
      GitErrorRecoveryService.recordOperationStart(testProjectPath, op2)

      GitErrorRecoveryService.removeOperation(testProjectPath, 'merge', 'task-2')

      const filePath = GitErrorRecoveryService.getOperationsFilePath(testProjectPath)
      const content = JSON.parse(readFileSync(filePath, 'utf-8'))

      expect(content.operations).toHaveLength(1)
      expect(content.operations[0].taskId).toBe('task-1')
    })
  })

  describe('clearAllOperations', () => {
    it('should remove all operations', () => {
      GitErrorRecoveryService.recordOperationStart(testProjectPath, {
        operationType: 'createWorktree',
        taskId: 'task-1',
        startedAt: Date.now(),
        status: 'pending'
      })

      GitErrorRecoveryService.recordOperationStart(testProjectPath, {
        operationType: 'merge',
        taskId: 'task-2',
        startedAt: Date.now(),
        status: 'pending'
      })

      expect(GitErrorRecoveryService.getIncompleteOperations(testProjectPath)).toHaveLength(2)

      GitErrorRecoveryService.clearAllOperations(testProjectPath)

      expect(GitErrorRecoveryService.getIncompleteOperations(testProjectPath)).toHaveLength(0)
    })
  })
})
