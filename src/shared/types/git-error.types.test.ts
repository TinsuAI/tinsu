/**
 * Git Error Types Tests - Story 8.10
 *
 * Tests for the categorizeGitError function.
 *
 * @see Story 8.10: Task 10.1 - Test categorizeGitError maps errors correctly
 */

import { describe, it, expect } from 'vitest'
import { categorizeGitError, createRecoverableErrorFromGeneric } from './git-error.types'
import { GitError } from '../../main/services/git.service'

describe('categorizeGitError', () => {
  describe('disk_full category', () => {
    it('should categorize "disk full" errors', () => {
      const error = new GitError('fatal: unable to write sha1 file: disk full', 'git add', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('disk_full')
      expect(result.message).toContain('disk space')
      expect(result.canRetry).toBe(true)
      expect(result.canSkip).toBe(false)
    })

    it('should categorize "ENOSPC" errors', () => {
      const error = new GitError('ENOSPC: no space left on device', 'git commit', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('disk_full')
    })

    it('should categorize "no space left" errors', () => {
      const error = new GitError('error: no space left on device', 'git merge', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('disk_full')
    })
  })

  describe('permission_denied category', () => {
    it('should categorize "permission denied" errors', () => {
      const error = new GitError('error: permission denied', 'git worktree add', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('permission_denied')
      expect(result.message).toContain('Permission denied')
      expect(result.canRetry).toBe(true)
    })

    it('should categorize "EACCES" errors', () => {
      const error = new GitError('EACCES: permission denied', 'git checkout', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('permission_denied')
    })
  })

  describe('branch_conflict category', () => {
    it('should categorize "already exists" errors', () => {
      const error = new GitError("fatal: branch 'feature' already exists", 'git branch', 128)
      const result = categorizeGitError(error)

      expect(result.category).toBe('branch_conflict')
      expect(result.message).toContain('already exists')
      expect(result.canRetry).toBe(true)
      expect(result.canSkip).toBe(true)
    })

    it('should categorize "is already checked out" errors', () => {
      const error = new GitError(
        'fatal: \'feature\' is already checked out at \'/path/to/worktree\'',
        'git worktree add',
        128
      )
      const result = categorizeGitError(error)

      expect(result.category).toBe('branch_conflict')
    })

    it('should categorize "could not resolve ref" errors', () => {
      const error = new GitError("fatal: could not resolve ref 'refs/heads/missing'", 'git checkout', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('branch_conflict')
      expect(result.message).toContain('reference not found')
    })

    it('should categorize "unknown revision" errors', () => {
      const error = new GitError("fatal: unknown revision 'nonexistent-branch'", 'git log', 128)
      const result = categorizeGitError(error)

      expect(result.category).toBe('branch_conflict')
    })
  })

  describe('not_repository category', () => {
    it('should categorize "not a git repository" errors', () => {
      const error = new GitError(
        'fatal: not a git repository (or any of the parent directories): .git',
        'git status',
        128
      )
      const result = categorizeGitError(error)

      expect(result.category).toBe('not_repository')
      expect(result.message).toContain('Not a git repository')
      expect(result.canRetry).toBe(false)
      expect(result.canSkip).toBe(false)
    })
  })

  describe('merge_failed category', () => {
    it('should categorize "merge conflict" errors', () => {
      const error = new GitError('Automatic merge failed; fix conflicts and then commit the result.', 'git merge', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('merge_failed')
      expect(result.message).toContain('Merge conflict')
      expect(result.canRetry).toBe(false)
    })

    it('should categorize "automatic merge failed" errors', () => {
      const error = new GitError('CONFLICT (content): Merge conflict in src/main.ts', 'git merge', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('merge_failed')
    })
  })

  describe('network category', () => {
    it('should categorize "network" errors', () => {
      const error = new GitError('network error', 'git fetch', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('network')
      expect(result.message).toContain('Network error')
      expect(result.canRetry).toBe(true)
    })

    it('should categorize "ETIMEDOUT" errors', () => {
      const error = new GitError('ETIMEDOUT: connection timed out', 'git push', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('network')
    })

    it('should categorize "unable to access" errors', () => {
      const error = new GitError("fatal: unable to access 'https://github.com/repo.git/'", 'git clone', 128)
      const result = categorizeGitError(error)

      expect(result.category).toBe('network')
    })
  })

  describe('not_installed category', () => {
    it('should categorize "git not found" errors', () => {
      const error = new GitError('Git not found. Please install git.', 'git --version', 127)
      const result = categorizeGitError(error)

      expect(result.category).toBe('not_installed')
      expect(result.message).toContain('Git not found')
      expect(result.canRetry).toBe(false)
    })

    it('should categorize "command not found" errors', () => {
      const error = new GitError('command not found: git', 'git --version', 127)
      const result = categorizeGitError(error)

      expect(result.category).toBe('not_installed')
    })
  })

  describe('worktree_removal category', () => {
    it('should categorize "worktree locked" errors', () => {
      const error = new GitError("fatal: worktree '/path' is locked", 'git worktree remove', 128)
      const result = categorizeGitError(error)

      expect(result.category).toBe('worktree_removal')
      expect(result.canRetry).toBe(true)
      expect(result.canSkip).toBe(true)
    })
  })

  describe('unknown category', () => {
    it('should categorize unrecognized errors as unknown', () => {
      const error = new GitError('some random error message', 'git something', 1)
      const result = categorizeGitError(error)

      expect(result.category).toBe('unknown')
      expect(result.message).toContain('unexpected git error')
      expect(result.canRetry).toBe(true)
    })
  })

  describe('technicalDetails', () => {
    it('should include command, exit code, and stderr in technical details', () => {
      const error = new GitError('Error message', 'git status', 1, 'stderr output')
      const result = categorizeGitError(error)

      expect(result.technicalDetails).toContain('git status')
      expect(result.technicalDetails).toContain('Exit code: 1')
      expect(result.technicalDetails).toContain('stderr output')
    })
  })
})

describe('createRecoverableErrorFromGeneric', () => {
  it('should handle GitError instances', () => {
    const gitError = new GitError('fatal: not a git repository', 'git status', 128)
    const result = createRecoverableErrorFromGeneric(gitError, 'test')

    expect(result.category).toBe('not_repository')
  })

  it('should handle generic Error instances', () => {
    const genericError = new Error('disk full')
    const result = createRecoverableErrorFromGeneric(genericError, 'test operation')

    expect(result.category).toBe('disk_full')
    expect(result.technicalDetails).toContain('test operation')
  })

  it('should handle errors with unknown messages', () => {
    const genericError = new Error('something went wrong')
    const result = createRecoverableErrorFromGeneric(genericError, 'test')

    expect(result.category).toBe('unknown')
  })
})
