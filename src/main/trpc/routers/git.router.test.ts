/**
 * Git Router Tests - TES-4.1, Story 8.2
 *
 * Tests for the git tRPC router.
 * - Unit tests with mocking for getDiff (TES-4.1)
 * - Integration tests for worktree procedures (Story 8.2)
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.2: Task 5.3 - Integration tests for tRPC procedures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { gitRouter } from './git.router'
import { TRPCError } from '../trpc'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

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
    })
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

      expect(result.worktreePath).toBe(`${testDir}/.tinsu/worktrees/${taskId}`)
      expect(existsSync(result.worktreePath)).toBe(true)

      // Should contain a working copy
      expect(existsSync(`${result.worktreePath}/README.md`)).toBe(true)
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
