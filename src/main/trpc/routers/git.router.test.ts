/**
 * Git Router Tests - TES-4.1, Story 8.2, Story 8.10
 *
 * Tests for the git tRPC router.
 * - Unit tests with mocking for getDiff (TES-4.1)
 * - Integration tests for worktree procedures (Story 8.2)
 * - Error recovery tests (Story 8.10)
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.2: Task 5.3 - Integration tests for tRPC procedures
 * @see Story 8.10: Task 10.3, 10.4 - Error recovery tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { gitRouter } from './git.router'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { GitErrorRecoveryService } from '../../services/git-error-recovery.service'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../../db/schema'

/**
 * Integration Tests for Git Worktree Procedures (Story 8.2)
 *
 * These tests use real git commands against a temporary repository.
 */
describe('gitRouter - Worktree Integration Tests (Story 8.2)', () => {
  const testDir = '/tmp/tinsu-git-router-integration-' + Date.now()
  let caller: ReturnType<typeof gitRouter.createCaller>

  beforeEach(() => {

    // Clean up and create fresh test directory
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }

    mkdirSync(testDir, { recursive: true })

    // Initialize git repository
    execSync('git init', { cwd: testDir })
    execSync('git config user.email "test@test.com"', { cwd: testDir })
    execSync('git config user.name "Test User"', { cwd: testDir })

    // Create initial commit
    writeFileSync(`${testDir}/README.md`, '# Test Project\n')
    execSync('git add README.md', { cwd: testDir })
    execSync('git commit -m "Initial commit"', { cwd: testDir })

    // Create router caller with test directory
    caller = gitRouter.createCaller({
      db: {} as never,
      projectRoot: testDir,
      projectId: null
    } as any)
  })

  afterEach(() => {
    // Clean up worktrees
    try {
      execSync('git worktree prune', { cwd: testDir })
    } catch {
      // Ignore errors
    }

    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore errors
    }
  })

  describe('createWorktree', () => {
    it('should create a worktree at expected path (AC: 4, 5)', async () => {
      const taskId = 'test-task-123'
      const result = await caller.createWorktree({ taskId })

      expect(result.success).toBe(true)
      const successResult = result as { success: true; worktreePath: string; branchName: string }
      expect(successResult.worktreePath).toBe(`${testDir}/.tinsu/worktrees/${taskId}`)
      expect(existsSync(successResult.worktreePath)).toBe(true)

      // Should contain a working copy
      expect(existsSync(`${successResult.worktreePath}/README.md`)).toBe(true)
    })

    it('should create branch named task/{task-id} (AC: 4)', async () => {
      const taskId = 'branch-test'
      await caller.createWorktree({ taskId })

      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(`task/${taskId}`)
    })

    it('should add .tinsu/worktrees/ to .gitignore (AC: 6)', async () => {
      const taskId = 'gitignore-test'
      await caller.createWorktree({ taskId })

      const { readFileSync } = await import('fs')
      const gitignore = readFileSync(`${testDir}/.gitignore`, 'utf-8')
      expect(gitignore).toContain('.tinsu/worktrees/')
    })

    it('should throw TRPCError for invalid taskId', async () => {
      await expect(caller.createWorktree({ taskId: '' })).rejects.toThrow('taskId is required')
    })
  })

  describe('hasWorktree', () => {
    it('should return false when worktree does not exist (AC: 3)', async () => {
      const result = await caller.hasWorktree({ taskId: 'nonexistent' })
      expect(result).toBe(false)
    })

    it('should return true when worktree exists (AC: 3)', async () => {
      const taskId = 'exists-test'
      await caller.createWorktree({ taskId })

      const result = await caller.hasWorktree({ taskId })
      expect(result).toBe(true)
    })
  })

  describe('getWorktreePath', () => {
    it('should return null when worktree does not exist', async () => {
      const result = await caller.getWorktreePath({ taskId: 'nonexistent' })
      expect(result.worktreePath).toBeNull()
    })

    it('should return correct path when worktree exists', async () => {
      const taskId = 'path-test'
      await caller.createWorktree({ taskId })

      const result = await caller.getWorktreePath({ taskId })
      expect(result.worktreePath).toBe(`${testDir}/.tinsu/worktrees/${taskId}`)
    })
  })
})

/**
 * Story 8.10 Error Recovery Tests
 *
 * Tests for worktree creation error handling, retry, and skip functionality.
 *
 * @see Story 8.10: Task 10.3 - Test worktree creation errors wrapped correctly
 * @see Story 8.10: Task 10.4 - Test retry and skip mutations
 */
describe('gitRouter - Error Recovery Tests (Story 8.10)', () => {
  const testDir = '/tmp/tinsu-git-error-recovery-' + Date.now()
  let caller: ReturnType<typeof gitRouter.createCaller>
  let testDb: ReturnType<typeof drizzle>
  let sqlite: Database.Database

  beforeEach(() => {
    // Clean up and create fresh test directory
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }

    mkdirSync(testDir, { recursive: true })

    // Initialize git repository
    execSync('git init', { cwd: testDir })
    execSync('git config user.email "test@test.com"', { cwd: testDir })
    execSync('git config user.name "Test User"', { cwd: testDir })

    // Create initial commit
    writeFileSync(`${testDir}/README.md`, '# Test Project\n')
    execSync('git add README.md', { cwd: testDir })
    execSync('git commit -m "Initial commit"', { cwd: testDir })

    // Create in-memory database for testing
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'backlog',
        worktree_skipped INTEGER DEFAULT 0,
        worktree_path TEXT,
        branch_name TEXT,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
    testDb = drizzle({ client: sqlite, schema })

    // Create router caller with test directory
    caller = gitRouter.createCaller({
      db: testDb as never,
      projectRoot: testDir,
      projectId: null
    } as any)
  })

  afterEach(() => {
    // Clean up worktrees
    try {
      execSync('git worktree prune', { cwd: testDir })
    } catch {
      // Ignore errors
    }

    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore errors
    }

    // Clean up database
    sqlite.close()
  })

  describe('createWorktree error handling', () => {
    it('should return success with worktree path on success (Task 3.1)', async () => {
      const result = await caller.createWorktree({ taskId: 'success-test' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.worktreePath).toContain('success-test')
        expect(result.branchName).toBeDefined()
      }
    })

    it('should record operation start and completion (Task 1.3, 1.4)', async () => {
      // Clear any existing operations
      GitErrorRecoveryService.clearAllOperations(testDir)

      await caller.createWorktree({ taskId: 'tracking-test' })

      // After success, the operation should be removed from incomplete
      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testDir)
      const tracked = incomplete.find((op) => op.taskId === 'tracking-test')
      expect(tracked).toBeUndefined()
    })

    it('should return error with recovery options when worktree exists (Task 3.2)', async () => {
      // Create a worktree first
      await caller.createWorktree({ taskId: 'duplicate-test' })

      // Try to create again
      const result = await caller.createWorktree({ taskId: 'duplicate-test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error.category).toBeDefined()
        expect(result.error.message).toBeDefined()
        expect(result.error.suggestedActions).toBeInstanceOf(Array)
        expect(result.error.technicalDetails).toBeDefined()
      }
    })
  })

  describe('retryWorktreeCreation', () => {
    it('should clean up and retry successfully (Task 3.3)', async () => {
      // Create partial state without creating a full worktree
      // This simulates a failed worktree creation
      const taskId = 'retry-fresh-task'
      const worktreePath = join(testDir, '.tinsu', 'worktrees', taskId)
      mkdirSync(worktreePath, { recursive: true })
      writeFileSync(join(worktreePath, 'partial.txt'), 'partial content')

      // Record a fake incomplete operation
      GitErrorRecoveryService.recordOperationStart(testDir, {
        operationType: 'createWorktree',
        taskId,
        startedAt: Date.now(),
        status: 'pending'
      })

      // Retry should clean up partial state and create fresh
      const result = await caller.retryWorktreeCreation({ taskId })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(existsSync(result.worktreePath)).toBe(true)
        expect(existsSync(join(result.worktreePath, 'README.md'))).toBe(true)
      }
    })

    it('should clear incomplete operation records on retry', async () => {
      // Record an incomplete operation
      GitErrorRecoveryService.recordOperationStart(testDir, {
        operationType: 'createWorktree',
        taskId: 'clear-test',
        startedAt: Date.now(),
        status: 'pending'
      })

      // Retry
      await caller.retryWorktreeCreation({ taskId: 'clear-test' })

      // Should clear the operation record
      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testDir)
      expect(incomplete.find((op) => op.taskId === 'clear-test')).toBeUndefined()
    })
  })

  describe('skipWorktreeCreation', () => {
    it('should set worktree_skipped flag in database (Task 3.4)', async () => {
      const taskId = 'skip-test-task'

      // Insert a task
      sqlite.exec(`INSERT INTO tasks (id, title, status) VALUES ('${taskId}', 'Test Task', 'in_progress')`)

      await caller.skipWorktreeCreation({ taskId })

      // Check database
      const task = sqlite.prepare('SELECT worktree_skipped FROM tasks WHERE id = ?').get(taskId) as {
        worktree_skipped: number
      }
      expect(task.worktree_skipped).toBe(1)
    })

    it('should clean up partial worktree state on skip (Task 3.4)', async () => {
      const taskId = 'cleanup-skip-test'

      // Create partial state
      const worktreePath = join(testDir, '.tinsu', 'worktrees', taskId)
      mkdirSync(worktreePath, { recursive: true })
      writeFileSync(join(worktreePath, 'partial.txt'), 'partial state')

      // Insert a task
      sqlite.exec(`INSERT INTO tasks (id, title, status) VALUES ('${taskId}', 'Test Task', 'in_progress')`)

      // Record incomplete operation
      GitErrorRecoveryService.recordOperationStart(testDir, {
        operationType: 'createWorktree',
        taskId,
        startedAt: Date.now(),
        status: 'pending'
      })

      await caller.skipWorktreeCreation({ taskId })

      // Partial state should be cleaned up
      expect(existsSync(worktreePath)).toBe(false)

      // Operation record should be cleared
      const incomplete = GitErrorRecoveryService.getIncompleteOperations(testDir)
      expect(incomplete.find((op) => op.taskId === taskId)).toBeUndefined()
    })
  })
})
