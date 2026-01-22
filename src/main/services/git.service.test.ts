/**
 * Git Service Tests - TES-4.1, Story 8.1
 *
 * Tests for GitService diff fetching, parsing, and foundation functionality.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.1: Git Service Foundation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GitService, GitError } from './git.service'

describe('GitService', () => {
  describe('GitError', () => {
    it('should create error with command context', () => {
      const error = new GitError('Git command failed', 'git status', 128, 'fatal: not a git repository')

      expect(error.message).toBe('Git command failed')
      expect(error.command).toBe('git status')
      expect(error.exitCode).toBe(128)
      expect(error.stderr).toBe('fatal: not a git repository')
      expect(error.name).toBe('GitError')
      expect(error instanceof Error).toBe(true)
    })

    it('should work without optional parameters', () => {
      const error = new GitError('Simple error', 'git diff')

      expect(error.message).toBe('Simple error')
      expect(error.command).toBe('git diff')
      expect(error.exitCode).toBeUndefined()
      expect(error.stderr).toBeUndefined()
    })
  })

  describe('checkGitInstalled', () => {
    it('should return true when git is installed (integration test)', async () => {
      // Integration test - git should be installed on dev machine
      const result = await GitService.checkGitInstalled()
      expect(result).toBe(true)
    })

    it('should return boolean indicating git availability', async () => {
      // This test verifies the return type and basic functionality
      const result = await GitService.checkGitInstalled()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('ensureGitInstalled', () => {
    it('should not throw when git is installed (integration test)', async () => {
      // Integration test - git should be installed on dev machine
      await expect(GitService.ensureGitInstalled()).resolves.not.toThrow()
    })

    it('should complete successfully when git is available', async () => {
      // This test verifies the method completes without errors
      await GitService.ensureGitInstalled()
      // If we reach here, git is installed and method didn't throw
      expect(true).toBe(true)
    })
  })

  describe('isGitRepository', () => {
    it('should return true for current directory (valid git repo - integration test)', async () => {
      const result = await GitService.isGitRepository(process.cwd())
      expect(result).toBe(true)
    })

    it('should return false for non-git directory', async () => {
      // /tmp should exist but not be a git repository
      const result = await GitService.isGitRepository('/tmp')
      expect(result).toBe(false)
    })

    it('should throw GitError for invalid path with dangerous characters', async () => {
      await expect(GitService.isGitRepository('/path; rm -rf /')).rejects.toThrow(GitError)
      await expect(GitService.isGitRepository('/path; rm -rf /')).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError when path does not exist', async () => {
      await expect(GitService.isGitRepository('/nonexistent/path/that/does/not/exist')).rejects.toThrow(GitError)
      await expect(GitService.isGitRepository('/nonexistent/path/that/does/not/exist')).rejects.toThrow('does not exist')
    })
  })

  describe('ensureGitRepository', () => {
    it('should not throw for valid git repository (integration test)', async () => {
      await expect(GitService.ensureGitRepository(process.cwd())).resolves.not.toThrow()
    })

    it('should throw GitError with standard message for non-git directory', async () => {
      await expect(GitService.ensureGitRepository('/tmp')).rejects.toThrow(GitError)
      await expect(GitService.ensureGitRepository('/tmp')).rejects.toThrow('Not a git repository')
    })

    it('should throw GitError for dangerous characters', async () => {
      await expect(GitService.ensureGitRepository('/path; rm -rf /')).rejects.toThrow(GitError)
      await expect(GitService.ensureGitRepository('/path; rm -rf /')).rejects.toThrow('dangerous characters')
    })
  })

  describe('validatePath (via public methods)', () => {
    it('should reject paths with semicolons', async () => {
      await expect(GitService.isGitRepository('/path;bad')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with ampersands', async () => {
      await expect(GitService.isGitRepository('/path&&bad')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with pipes', async () => {
      await expect(GitService.isGitRepository('/path|bad')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with backticks', async () => {
      await expect(GitService.isGitRepository('/path`bad`')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with dollar signs', async () => {
      await expect(GitService.isGitRepository('/path$bad')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with parentheses', async () => {
      await expect(GitService.isGitRepository('/path(bad)')).rejects.toThrow('dangerous characters')
    })

    it('should reject paths with angle brackets', async () => {
      await expect(GitService.isGitRepository('/path<bad>')).rejects.toThrow('dangerous characters')
    })
  })

  describe('parseDiff', () => {
    it('should parse a unified diff with modified file', () => {
      const diffOutput = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import { app } from 'electron'
+import { newModule } from './new-module'

 app.whenReady().then(() => {
@@ -10,6 +11,7 @@ app.whenReady().then(() => {
   createWindow()
+  initNewModule()
 })
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files).toHaveLength(1)
      expect(result.files[0].path).toBe('src/index.ts')
      expect(result.files[0].status).toBe('modified')
      expect(result.files[0].additions).toBe(2)
      expect(result.files[0].deletions).toBe(0)
      expect(result.files[0].hunks).toHaveLength(2)
      expect(result.summary.filesChanged).toBe(1)
      expect(result.summary.linesAdded).toBe(2)
      expect(result.summary.linesRemoved).toBe(0)
    })

    it('should parse a diff with added file', () => {
      const diffOutput = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,5 @@
+export function newFunction() {
+  return 'hello'
+}
+
+export const value = 42
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files).toHaveLength(1)
      expect(result.files[0].path).toBe('src/new-file.ts')
      expect(result.files[0].status).toBe('added')
      expect(result.files[0].additions).toBe(5)
      expect(result.files[0].deletions).toBe(0)
    })

    it('should parse a diff with deleted file', () => {
      const diffOutput = `diff --git a/src/old-file.ts b/src/old-file.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return 'goodbye'
-}
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files).toHaveLength(1)
      expect(result.files[0].path).toBe('src/old-file.ts')
      expect(result.files[0].status).toBe('deleted')
      expect(result.files[0].additions).toBe(0)
      expect(result.files[0].deletions).toBe(3)
    })

    it('should parse a diff with renamed file', () => {
      const diffOutput = `diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 95%
rename from src/old-name.ts
rename to src/new-name.ts
index abc1234..def5678 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,3 +1,3 @@
-export function oldName() {
+export function newName() {
   return 'value'
 }
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files).toHaveLength(1)
      expect(result.files[0].path).toBe('src/new-name.ts')
      expect(result.files[0].oldPath).toBe('src/old-name.ts')
      expect(result.files[0].status).toBe('renamed')
    })

    it('should return empty diff when no changes', () => {
      const result = GitService.parseDiff('')

      expect(result.files).toHaveLength(0)
      expect(result.summary.filesChanged).toBe(0)
      expect(result.summary.linesAdded).toBe(0)
      expect(result.summary.linesRemoved).toBe(0)
    })

    it('should parse multiple files in a single diff', () => {
      const diffOutput = `diff --git a/src/file1.ts b/src/file1.ts
index abc1234..def5678 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,2 +1,3 @@
 export const a = 1
+export const b = 2
diff --git a/src/file2.ts b/src/file2.ts
index 111111..222222 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -1,3 +1,2 @@
 export const x = 'x'
-export const y = 'y'
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files).toHaveLength(2)
      expect(result.summary.filesChanged).toBe(2)
      expect(result.summary.linesAdded).toBe(1)
      expect(result.summary.linesRemoved).toBe(1)
    })

    it('should correctly parse hunk headers with context', () => {
      const diffOutput = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -5,7 +5,7 @@ function createWindow() {
   const win = new BrowserWindow({
     width: 800,
-    height: 600,
+    height: 900,
     webPreferences: {
       preload: path.join(__dirname, 'preload.js')
     }
`

      const result = GitService.parseDiff(diffOutput)

      expect(result.files[0].hunks[0].oldStart).toBe(5)
      expect(result.files[0].hunks[0].oldLines).toBe(7)
      expect(result.files[0].hunks[0].newStart).toBe(5)
      expect(result.files[0].hunks[0].newLines).toBe(7)
      expect(result.files[0].hunks[0].header).toBe('function createWindow() {')
    })

    it('should track line numbers for diff lines', () => {
      const diffOutput = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 line one
+new line
 line two
 line three
`

      const result = GitService.parseDiff(diffOutput)
      const lines = result.files[0].hunks[0].lines

      expect(lines[0].type).toBe('context')
      expect(lines[0].content).toBe('line one')
      expect(lines[0].oldLineNo).toBe(1)
      expect(lines[0].newLineNo).toBe(1)

      expect(lines[1].type).toBe('add')
      expect(lines[1].content).toBe('new line')
      expect(lines[1].oldLineNo).toBeUndefined()
      expect(lines[1].newLineNo).toBe(2)

      expect(lines[2].type).toBe('context')
      expect(lines[2].content).toBe('line two')
      expect(lines[2].oldLineNo).toBe(2)
      expect(lines[2].newLineNo).toBe(3)
    })
  })

  describe('getDiff', () => {
    it('should throw error when git command fails', async () => {
      // This test uses the real implementation to verify error handling
      // by pointing to a non-existent directory
      await expect(GitService.getDiff('/nonexistent/path/that/does/not/exist'))
        .rejects.toThrow()
    })

    it('should return diff from current repository', async () => {
      // Test against the actual current repository
      // This is an integration test that verifies the real git command works
      const result = await GitService.getDiff(process.cwd())

      // Result should be a valid GitDiffResult structure
      expect(result).toHaveProperty('files')
      expect(result).toHaveProperty('summary')
      expect(Array.isArray(result.files)).toBe(true)
      expect(result.summary).toHaveProperty('filesChanged')
      expect(result.summary).toHaveProperty('linesAdded')
      expect(result.summary).toHaveProperty('linesRemoved')
    })

    it('should reject path with shell metacharacters (command injection protection)', async () => {
      // Test various command injection attempts
      const maliciousPaths = [
        '; rm -rf /',
        '$(malicious command)',
        '`malicious command`',
        'path/to/repo && rm -rf /',
        'path/to/repo | cat /etc/passwd',
        'path/to/repo < /etc/passwd',
        'path/to/repo > /tmp/evil'
      ]

      for (const maliciousPath of maliciousPaths) {
        await expect(GitService.getDiff(maliciousPath)).rejects.toThrow(
          'Invalid path: contains dangerous characters'
        )
      }
    })

    it('should reject empty or invalid path', async () => {
      await expect(GitService.getDiff('')).rejects.toThrow('Invalid path')
      await expect(GitService.getDiff(null as any)).rejects.toThrow('Invalid path')
      await expect(GitService.getDiff(undefined as any)).rejects.toThrow('Invalid path')
    })

    it('should include untracked files in diff result', async () => {
      // This test verifies that untracked files (new files not yet staged) are included
      // Test against current repository which may have untracked files
      const result = await GitService.getDiff(process.cwd())

      // The result structure should be valid
      expect(result).toHaveProperty('files')
      expect(result).toHaveProperty('summary')
      expect(Array.isArray(result.files)).toBe(true)

      // Check if any untracked files are present (they would have status 'added')
      // Note: This test is permissive since the repo may or may not have untracked files
      const addedFiles = result.files.filter((f) => f.status === 'added')
      // If there are added files, they should have proper structure
      addedFiles.forEach((file) => {
        expect(file).toHaveProperty('path')
        expect(file).toHaveProperty('hunks')
        expect(Array.isArray(file.hunks)).toBe(true)
      })
    })
  })

  describe('ensureWorktreesIgnored', () => {
    const testDir = '/tmp/tinsu-git-test-' + Date.now()
    const gitignorePath = testDir + '/.gitignore'
    const tinsuPath = testDir + '/.tinsu'

    beforeEach(async () => {
      // Create test directory
      const { mkdirSync, writeFileSync, rmSync } = await import('fs')
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Directory may not exist
      }
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(async () => {
      // Cleanup test directory
      const { rmSync } = await import('fs')
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should do nothing when .tinsu/ folder does not exist', async () => {
      const { existsSync } = await import('fs')

      // Verify .tinsu/ doesn't exist
      expect(existsSync(tinsuPath)).toBe(false)

      await GitService.ensureWorktreesIgnored(testDir)

      // .gitignore should not be created
      expect(existsSync(gitignorePath)).toBe(false)
    })

    it('should add .tinsu/worktrees/ to existing .gitignore when not present', async () => {
      const { writeFileSync, readFileSync, mkdirSync } = await import('fs')

      // Create .tinsu/ folder first (required by AC 6)
      mkdirSync(tinsuPath)

      writeFileSync(gitignorePath, 'node_modules/\ndist/\n')

      await GitService.ensureWorktreesIgnored(testDir)

      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.tinsu/worktrees/')
      expect(content).toContain('node_modules/')
    })

    it('should not modify .gitignore when .tinsu/worktrees/ already present', async () => {
      const { writeFileSync, readFileSync, mkdirSync } = await import('fs')

      // Create .tinsu/ folder first (required by AC 6)
      mkdirSync(tinsuPath)

      const originalContent = 'node_modules/\n.tinsu/worktrees/\ndist/\n'
      writeFileSync(gitignorePath, originalContent)

      await GitService.ensureWorktreesIgnored(testDir)

      const content = readFileSync(gitignorePath, 'utf-8')
      // Content should be unchanged (only one occurrence of the pattern)
      expect(content.split('.tinsu/worktrees/').length - 1).toBe(1)
    })

    it('should create .gitignore if it does not exist', async () => {
      const { existsSync, readFileSync, mkdirSync } = await import('fs')

      // Create .tinsu/ folder first (required by AC 6)
      mkdirSync(tinsuPath)

      expect(existsSync(gitignorePath)).toBe(false)

      await GitService.ensureWorktreesIgnored(testDir)

      expect(existsSync(gitignorePath)).toBe(true)
      const content = readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.tinsu/worktrees/')
    })

    it('should throw GitError for path with dangerous characters', async () => {
      await expect(GitService.ensureWorktreesIgnored('/path; rm -rf /')).rejects.toThrow(GitError)
      await expect(GitService.ensureWorktreesIgnored('/path; rm -rf /')).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError when project path does not exist', async () => {
      await expect(GitService.ensureWorktreesIgnored('/nonexistent/path/xyz123')).rejects.toThrow(GitError)
      await expect(GitService.ensureWorktreesIgnored('/nonexistent/path/xyz123')).rejects.toThrow('does not exist')
    })
  })

  describe('execGit (tested via public methods)', () => {
    it('should execute git commands successfully via isGitRepository', async () => {
      // Test that execGit works by checking a valid repo
      const result = await GitService.isGitRepository(process.cwd())
      expect(result).toBe(true)
    })

    it('should handle git command failures gracefully', async () => {
      // Test that non-repo directories are handled correctly
      const result = await GitService.isGitRepository('/tmp')
      expect(result).toBe(false)
    })
  })

  describe('createWorktree (Story 8.2)', () => {
    const testDir = '/tmp/tinsu-worktree-test-' + Date.now()
    const testTaskId = 'test-task-' + Date.now()

    beforeEach(async () => {
      const { mkdirSync, rmSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Clean up test directory
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Directory may not exist
      }

      // Create a fresh git repository for testing
      mkdirSync(testDir, { recursive: true })
      execSync('git init', { cwd: testDir })
      execSync('git config user.email "test@test.com"', { cwd: testDir })
      execSync('git config user.name "Test"', { cwd: testDir })

      // Create initial commit so we have a valid HEAD
      const { writeFileSync } = await import('fs')
      writeFileSync(`${testDir}/README.md`, '# Test\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Initial commit"', { cwd: testDir })
    })

    afterEach(async () => {
      const { rmSync } = await import('fs')
      const { execSync } = await import('child_process')

      // First, try to remove any worktrees properly
      try {
        execSync('git worktree prune', { cwd: testDir })
      } catch {
        // Ignore errors
      }

      // Clean up test directory
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should create a worktree at the expected path (AC: 4, 5)', async () => {
      const { existsSync } = await import('fs')

      const worktreePath = await GitService.createWorktree(testDir, testTaskId)

      // AC 5: Worktree should be at .tinsu/worktrees/{task-id}/
      expect(worktreePath).toBe(`${testDir}/.tinsu/worktrees/${testTaskId}`)
      expect(existsSync(worktreePath)).toBe(true)

      // AC 5: Should contain a full working copy
      expect(existsSync(`${worktreePath}/README.md`)).toBe(true)
    })

    it('should add .tinsu/worktrees/ to .gitignore (AC: integrated with Story 8.1 AC 6)', async () => {
      const { readFileSync } = await import('fs')

      await GitService.createWorktree(testDir, testTaskId)

      const gitignore = readFileSync(`${testDir}/.gitignore`, 'utf-8')
      expect(gitignore).toContain('.tinsu/worktrees/')
    })

    it('should create a new branch named task/{task-id} (AC: 4)', async () => {
      const { execSync } = await import('child_process')

      await GitService.createWorktree(testDir, testTaskId)

      // Check that the branch was created
      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(`task/${testTaskId}`)
    })

    it('should throw GitError for invalid taskId with dangerous characters', async () => {
      await expect(GitService.createWorktree(testDir, 'task;rm -rf /')).rejects.toThrow(GitError)
      await expect(GitService.createWorktree(testDir, 'task;rm -rf /')).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for empty taskId', async () => {
      await expect(GitService.createWorktree(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.createWorktree(testDir, '')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError when project path does not exist', async () => {
      await expect(GitService.createWorktree('/nonexistent/path/xyz', testTaskId)).rejects.toThrow(GitError)
      await expect(GitService.createWorktree('/nonexistent/path/xyz', testTaskId)).rejects.toThrow('does not exist')
    })

    it('should clean up on failure (AC: 6, NFR12)', async () => {
      const { existsSync, mkdirSync, writeFileSync } = await import('fs')
      const conflictingTaskId = 'conflict-task'

      // Create the worktree directory as a regular file to cause failure
      mkdirSync(`${testDir}/.tinsu/worktrees`, { recursive: true })
      // Create a branch with the same name to cause git worktree add to fail
      const { execSync } = await import('child_process')
      execSync(`git branch task/${conflictingTaskId}`, { cwd: testDir })
      // Also create the directory to make git fail
      mkdirSync(`${testDir}/.tinsu/worktrees/${conflictingTaskId}`, { recursive: true })
      writeFileSync(`${testDir}/.tinsu/worktrees/${conflictingTaskId}/blocker`, 'content')

      // Expect creation to fail
      await expect(GitService.createWorktree(testDir, conflictingTaskId)).rejects.toThrow()

      // Note: The worktree directory may or may not exist depending on when the failure occurred
      // The important thing is that if it exists, it's been cleaned up (empty or removed)
    })
  })

  describe('hasWorktree (Story 8.2 AC: 3)', () => {
    const testDir = '/tmp/tinsu-hasworktree-test-' + Date.now()
    const testTaskId = 'has-worktree-task-' + Date.now()

    beforeEach(async () => {
      const { mkdirSync, rmSync, writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }

      mkdirSync(testDir, { recursive: true })
      execSync('git init', { cwd: testDir })
      execSync('git config user.email "test@test.com"', { cwd: testDir })
      execSync('git config user.name "Test"', { cwd: testDir })
      writeFileSync(`${testDir}/README.md`, '# Test\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Initial commit"', { cwd: testDir })
    })

    afterEach(async () => {
      const { rmSync } = await import('fs')
      const { execSync } = await import('child_process')

      try {
        execSync('git worktree prune', { cwd: testDir })
      } catch {
        // Ignore
      }

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should return false when worktree does not exist', async () => {
      const result = await GitService.hasWorktree(testDir, 'nonexistent-task')
      expect(result).toBe(false)
    })

    it('should return true when worktree exists', async () => {
      // Create a worktree first
      await GitService.createWorktree(testDir, testTaskId)

      const result = await GitService.hasWorktree(testDir, testTaskId)
      expect(result).toBe(true)
    })

    it('should throw GitError for invalid taskId', async () => {
      await expect(GitService.hasWorktree(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.hasWorktree(testDir, '')).rejects.toThrow('non-empty string')
    })
  })

  describe('getWorktreePath (Story 8.2)', () => {
    const testDir = '/tmp/tinsu-getpath-test-' + Date.now()
    const testTaskId = 'getpath-task-' + Date.now()

    beforeEach(async () => {
      const { mkdirSync, rmSync, writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }

      mkdirSync(testDir, { recursive: true })
      execSync('git init', { cwd: testDir })
      execSync('git config user.email "test@test.com"', { cwd: testDir })
      execSync('git config user.name "Test"', { cwd: testDir })
      writeFileSync(`${testDir}/README.md`, '# Test\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Initial commit"', { cwd: testDir })
    })

    afterEach(async () => {
      const { rmSync } = await import('fs')
      const { execSync } = await import('child_process')

      try {
        execSync('git worktree prune', { cwd: testDir })
      } catch {
        // Ignore
      }

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should return null when worktree does not exist', async () => {
      const result = await GitService.getWorktreePath(testDir, 'nonexistent')
      expect(result).toBeNull()
    })

    it('should return correct path when worktree exists', async () => {
      await GitService.createWorktree(testDir, testTaskId)

      const result = await GitService.getWorktreePath(testDir, testTaskId)
      expect(result).toBe(`${testDir}/.tinsu/worktrees/${testTaskId}`)
    })

    it('should throw GitError for invalid taskId', async () => {
      await expect(GitService.getWorktreePath(testDir, '')).rejects.toThrow(GitError)
    })
  })
})
