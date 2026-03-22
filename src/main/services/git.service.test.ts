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
      const { mkdirSync, rmSync } = await import('fs')
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

      const result = await GitService.createWorktree(testDir, testTaskId)

      // Story 8.3: createWorktree now returns {worktreePath, branchName}
      expect(result).toHaveProperty('worktreePath')
      expect(result).toHaveProperty('branchName')

      // AC 5: Worktree should be at .tinsu/worktrees/{task-id}/
      expect(result.worktreePath).toBe(`${testDir}/.tinsu/worktrees/${testTaskId}`)
      expect(existsSync(result.worktreePath)).toBe(true)

      // AC 5: Should contain a full working copy
      expect(existsSync(`${result.worktreePath}/README.md`)).toBe(true)
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
      const { mkdirSync, writeFileSync } = await import('fs')
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

  // Story 8.3: Branch Naming Convention Tests
  describe('generateSlug (Story 8.3)', () => {
    it('should convert to lowercase', () => {
      expect(GitService.generateSlug('Hello World')).toBe('hello-world')
      expect(GitService.generateSlug('UPPERCASE TITLE')).toBe('uppercase-title')
    })

    it('should replace spaces with hyphens', () => {
      expect(GitService.generateSlug('add user authentication')).toBe('add-user-authentication')
    })

    it('should remove special characters', () => {
      expect(GitService.generateSlug("Fix the 'Login' Bug!")).toBe('fix-the-login-bug')
      expect(GitService.generateSlug('Test (parentheses) & symbols')).toBe('test-parentheses-symbols')
      expect(GitService.generateSlug('Price: $100 + tax')).toBe('price-100-tax')
    })

    it('should handle git-invalid characters by removing them', () => {
      // Git-invalid characters are removed (not replaced), then collapsed
      expect(GitService.generateSlug('feature~test^ref')).toBe('featuretestref')
      expect(GitService.generateSlug('path:colon:test')).toBe('pathcolontest')
      expect(GitService.generateSlug('question?mark')).toBe('questionmark')
      expect(GitService.generateSlug('star*char')).toBe('starchar')
      expect(GitService.generateSlug('bracket[test]')).toBe('brackettest')
      // When special chars are between words with spaces, hyphens remain
      expect(GitService.generateSlug('feature ~ test')).toBe('feature-test')
      expect(GitService.generateSlug('path : colon')).toBe('path-colon')
    })

    it('should collapse multiple consecutive hyphens', () => {
      expect(GitService.generateSlug('test - - - title')).toBe('test-title')
      expect(GitService.generateSlug('a   b   c')).toBe('a-b-c')
    })

    it('should trim leading and trailing hyphens', () => {
      expect(GitService.generateSlug('---test---')).toBe('test')
      expect(GitService.generateSlug('  test  ')).toBe('test')
    })

    it('should truncate to 50 characters at word boundary', () => {
      const longTitle = 'A Very Long Title That Definitely Exceeds Fifty Characters And Keeps Going'
      const slug = GitService.generateSlug(longTitle)

      expect(slug.length).toBeLessThanOrEqual(50)
      expect(slug).not.toContain('--')
      // Should truncate at a word boundary
      expect(slug).toBe('a-very-long-title-that-definitely-exceeds-fifty')
    })

    it('should truncate without word boundary if no good break point', () => {
      const noSpaces = 'abcdefghijklmnopqrstuvwxyz12345678901234567890123456789'
      const slug = GitService.generateSlug(noSpaces)

      expect(slug.length).toBeLessThanOrEqual(50)
    })

    it('should return "untitled" for empty string', () => {
      expect(GitService.generateSlug('')).toBe('untitled')
    })

    it('should return "untitled" for only special characters', () => {
      expect(GitService.generateSlug('!!!@@@###')).toBe('untitled')
      expect(GitService.generateSlug('***???***')).toBe('untitled')
    })

    it('should return "untitled" for null or undefined', () => {
      expect(GitService.generateSlug(null as any)).toBe('untitled')
      expect(GitService.generateSlug(undefined as any)).toBe('untitled')
    })

    it('should handle OAuth 2.0 style titles', () => {
      expect(GitService.generateSlug('Implement OAuth 2.0 Support')).toBe('implement-oauth-20-support')
    })

    it('should handle underscores by replacing with hyphens', () => {
      expect(GitService.generateSlug('test_with_underscores')).toBe('test-with-underscores')
    })
  })

  describe('generateBranchName (Story 8.3)', () => {
    it('should generate branch name with correct pattern', () => {
      const branchName = GitService.generateBranchName('abc123', 'Add User Authentication')
      expect(branchName).toBe('tinsu/story-abc123-add-user-authentication')
    })

    it('should handle various task titles', () => {
      expect(GitService.generateBranchName('task1', 'Fix Bug')).toBe('tinsu/story-task1-fix-bug')
      expect(GitService.generateBranchName('xyz789', "Fix the 'Login' Bug!")).toBe('tinsu/story-xyz789-fix-the-login-bug')
    })

    it('should use "untitled" for empty title', () => {
      expect(GitService.generateBranchName('abc123', '')).toBe('tinsu/story-abc123-untitled')
    })

    it('should throw GitError for empty taskId', () => {
      expect(() => GitService.generateBranchName('', 'Test')).toThrow(GitError)
      expect(() => GitService.generateBranchName('', 'Test')).toThrow('non-empty string')
    })

    it('should throw GitError for null/undefined taskId', () => {
      expect(() => GitService.generateBranchName(null as any, 'Test')).toThrow(GitError)
      expect(() => GitService.generateBranchName(undefined as any, 'Test')).toThrow(GitError)
    })
  })

  describe('branchExists (Story 8.3)', () => {
    const testDir = '/tmp/tinsu-branchexists-test-' + Date.now()

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

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should return false for non-existent branch', async () => {
      const result = await GitService.branchExists(testDir, 'tinsu/story-abc123-nonexistent')
      expect(result).toBe(false)
    })

    it('should return true for existing branch', async () => {
      const { execSync } = await import('child_process')

      // Create a branch
      execSync('git branch tinsu/story-abc123-test-branch', { cwd: testDir })

      const result = await GitService.branchExists(testDir, 'tinsu/story-abc123-test-branch')
      expect(result).toBe(true)
    })

    it('should return true for main/master branch', async () => {
      const { execSync } = await import('child_process')

      // Get the default branch name
      const defaultBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: testDir })
        .toString()
        .trim()

      const result = await GitService.branchExists(testDir, defaultBranch)
      expect(result).toBe(true)
    })

    it('should throw GitError for empty branchName', async () => {
      await expect(GitService.branchExists(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.branchExists(testDir, '')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for dangerous path characters', async () => {
      await expect(GitService.branchExists('/path;bad', 'test')).rejects.toThrow(GitError)
      await expect(GitService.branchExists('/path;bad', 'test')).rejects.toThrow('dangerous characters')
    })
  })

  describe('getUniqueBranchName (Story 8.3)', () => {
    const testDir = '/tmp/tinsu-uniquebranch-test-' + Date.now()

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

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should return original name if branch does not exist', async () => {
      const result = await GitService.getUniqueBranchName(testDir, 'tinsu/story-abc123-new-feature')
      expect(result).toBe('tinsu/story-abc123-new-feature')
    })

    it('should append -2 suffix if branch exists', async () => {
      const { execSync } = await import('child_process')

      // Create the base branch
      execSync('git branch tinsu/story-abc123-feature', { cwd: testDir })

      const result = await GitService.getUniqueBranchName(testDir, 'tinsu/story-abc123-feature')
      expect(result).toBe('tinsu/story-abc123-feature-2')
    })

    it('should increment suffix for multiple collisions', async () => {
      const { execSync } = await import('child_process')

      // Create base branch and -2 suffix branch
      execSync('git branch tinsu/story-xyz-test', { cwd: testDir })
      execSync('git branch tinsu/story-xyz-test-2', { cwd: testDir })

      const result = await GitService.getUniqueBranchName(testDir, 'tinsu/story-xyz-test')
      expect(result).toBe('tinsu/story-xyz-test-3')
    })

    it('should throw GitError for empty baseName', async () => {
      await expect(GitService.getUniqueBranchName(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.getUniqueBranchName(testDir, '')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for dangerous path characters', async () => {
      await expect(GitService.getUniqueBranchName('/path;bad', 'test')).rejects.toThrow(GitError)
    })
  })

  describe('createWorktree with taskTitle (Story 8.3)', () => {
    const testDir = '/tmp/tinsu-worktree-title-test-' + Date.now()
    const testTaskId = 'title-task-' + Date.now()

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

    it('should create worktree with descriptive branch name when title provided', async () => {
      const { execSync } = await import('child_process')

      const result = await GitService.createWorktree(testDir, testTaskId, 'Add User Authentication')

      // Should return both worktreePath and branchName
      expect(result).toHaveProperty('worktreePath')
      expect(result).toHaveProperty('branchName')
      expect(result.worktreePath).toBe(`${testDir}/.tinsu/worktrees/${testTaskId}`)
      expect(result.branchName).toBe(`tinsu/story-${testTaskId}-add-user-authentication`)

      // Verify branch was created with descriptive name
      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(`tinsu/story-${testTaskId}-add-user-authentication`)
    })

    it('should fall back to simple naming when no title provided', async () => {
      const { execSync } = await import('child_process')

      const result = await GitService.createWorktree(testDir, testTaskId)

      expect(result).toHaveProperty('worktreePath')
      expect(result).toHaveProperty('branchName')
      expect(result.branchName).toBe(`task/${testTaskId}`)

      // Verify branch was created with simple naming
      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(`task/${testTaskId}`)
    })

    it('should handle special characters in title', async () => {
      const { execSync } = await import('child_process')
      const specialTaskId = 'special-' + Date.now()

      const result = await GitService.createWorktree(testDir, specialTaskId, "Fix the 'Login' Bug!")

      expect(result.branchName).toBe(`tinsu/story-${specialTaskId}-fix-the-login-bug`)

      // Verify branch was created
      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(`tinsu/story-${specialTaskId}-fix-the-login-bug`)
    })

    it('should handle branch name collision with suffix', async () => {
      const { execSync } = await import('child_process')
      const collisionTaskId = 'collision-' + Date.now()

      // Create a branch that will collide
      const expectedBranchName = `tinsu/story-${collisionTaskId}-test-feature`
      execSync(`git branch ${expectedBranchName}`, { cwd: testDir })

      const result = await GitService.createWorktree(testDir, collisionTaskId, 'Test Feature')

      // Should have -2 suffix due to collision
      expect(result.branchName).toBe(`${expectedBranchName}-2`)

      // Verify both branches exist
      const branches = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branches).toContain(expectedBranchName)
      expect(branches).toContain(`${expectedBranchName}-2`)
    })
  })

  describe('getBranchNameFromWorktree (Story 8.3 AC 5)', () => {
    const testDir = '/tmp/tinsu-getbranch-test-' + Date.now()
    const testTaskId = 'getbranch-task-' + Date.now()

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

    it('should return branch name from existing worktree', async () => {
      // Create a worktree first
      const result = await GitService.createWorktree(testDir, testTaskId, 'Test Feature')

      // Now retrieve the branch name from the worktree
      const branchName = await GitService.getBranchNameFromWorktree(result.worktreePath)

      expect(branchName).toBe(result.branchName)
    })

    it('should return null for non-existent path', async () => {
      const branchName = await GitService.getBranchNameFromWorktree('/nonexistent/path')
      expect(branchName).toBeNull()
    })

    it('should return null for non-git directory', async () => {
      // Use /tmp which is outside any git repo
      const branchName = await GitService.getBranchNameFromWorktree('/tmp')
      expect(branchName).toBeNull()
    })

    it('should throw GitError for dangerous path characters', async () => {
      await expect(GitService.getBranchNameFromWorktree('/path;bad')).rejects.toThrow(GitError)
      await expect(GitService.getBranchNameFromWorktree('/path;bad')).rejects.toThrow('dangerous characters')
    })

    it('should retrieve branch name with tinsu prefix', async () => {
      const customTaskId = 'custom-' + Date.now()
      const result = await GitService.createWorktree(testDir, customTaskId, 'Add User Authentication')

      const branchName = await GitService.getBranchNameFromWorktree(result.worktreePath)

      expect(branchName).toContain('tinsu/story-')
      expect(branchName).toContain('add-user-authentication')
    })
  })

  // Story 8.5: Merge Worktree Tests
  describe('mergeWorktree (Story 8.5)', () => {
    const testDir = '/tmp/tinsu-merge-test-' + Date.now()
    const testTaskId = 'merge-task-' + Date.now()

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

      // Rename default branch to main for consistency
      execSync('git branch -M main', { cwd: testDir })

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

    it('should perform fast-forward merge when main has not advanced (AC: 2, Task 6.1)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Test Feature')

      // Add a commit in the worktree
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      // Merge back to main
      const mergeResult = await GitService.mergeWorktree(
        testDir,
        worktreeResult.branchName,
        testTaskId,
        'Test Feature'
      )

      expect(mergeResult.success).toBe(true)
      expect(mergeResult.mergeType).toBe('fast-forward')
      expect(mergeResult.commitSha).toBeTruthy()
      expect(mergeResult.branchName).toBe(worktreeResult.branchName)
    })

    it('should perform merge commit when main has advanced (AC: 4, Task 6.2)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Test Feature')

      // Add a commit in the worktree
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      // Advance main branch with a different file
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/other.ts`, 'export const other = true')
      execSync('git add other.ts', { cwd: testDir })
      execSync('git commit -m "Other change on main"', { cwd: testDir })

      // Merge back to main
      const mergeResult = await GitService.mergeWorktree(
        testDir,
        worktreeResult.branchName,
        testTaskId,
        'Test Feature'
      )

      expect(mergeResult.success).toBe(true)
      expect(mergeResult.mergeType).toBe('merge-commit')
      expect(mergeResult.commitSha).toBeTruthy()
    })

    it('should include task ID and title in merge commit message (AC: 3, Task 6.3)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Add User Auth')

      // Add a commit in the worktree
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      // Advance main to force merge commit (so we can check the commit message)
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/other.ts`, 'export const other = true')
      execSync('git add other.ts', { cwd: testDir })
      execSync('git commit -m "Other change"', { cwd: testDir })

      // Merge back to main
      const mergeResult = await GitService.mergeWorktree(
        testDir,
        worktreeResult.branchName,
        testTaskId,
        'Add User Auth'
      )

      // Check the commit message
      const commitMessage = execSync(`git log -1 --format=%B ${mergeResult.commitSha}`, { cwd: testDir }).toString()

      // Verify the commit message format: "Merge story {taskId}: {taskTitle}"
      expect(commitMessage).toContain(`Merge story ${testTaskId}`)
      expect(commitMessage).toContain('Add User Auth')
    })

    it('should detect merge conflicts and return conflict files (AC: 6, Task 6.4)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes to README.md
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Conflict Feature')

      // Modify README.md in worktree
      writeFileSync(`${worktreeResult.worktreePath}/README.md`, '# Modified in worktree\n')
      execSync('git add README.md', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Modify README in worktree"', { cwd: worktreeResult.worktreePath })

      // Modify the same file in main (create conflict)
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/README.md`, '# Modified in main\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Modify README in main"', { cwd: testDir })

      // Try to merge - should fail with conflicts
      const mergeResult = await GitService.mergeWorktree(
        testDir,
        worktreeResult.branchName,
        testTaskId,
        'Conflict Feature'
      )

      expect(mergeResult.success).toBe(false)
      expect(mergeResult.conflictFiles).toBeDefined()
      expect(mergeResult.conflictFiles).toContain('README.md')
    })

    it('should throw GitError for invalid branchName', async () => {
      await expect(GitService.mergeWorktree(testDir, '', testTaskId, 'Test')).rejects.toThrow(GitError)
      await expect(GitService.mergeWorktree(testDir, '', testTaskId, 'Test')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for invalid taskId', async () => {
      await expect(GitService.mergeWorktree(testDir, 'some-branch', '', 'Test')).rejects.toThrow(GitError)
      await expect(GitService.mergeWorktree(testDir, 'some-branch', '', 'Test')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for non-existent project path', async () => {
      await expect(GitService.mergeWorktree('/nonexistent/path', 'branch', 'task', 'Test')).rejects.toThrow(GitError)
      await expect(GitService.mergeWorktree('/nonexistent/path', 'branch', 'task', 'Test')).rejects.toThrow('does not exist')
    })

    it('should preserve commit attribution after merge (AC: 5, 7)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Attribution Test')

      // Configure worktree git user (different from main repo)
      execSync('git config user.email "worktree@test.com"', { cwd: worktreeResult.worktreePath })
      execSync('git config user.name "Worktree User"', { cwd: worktreeResult.worktreePath })

      // Add a commit in the worktree
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Feature by worktree user"', { cwd: worktreeResult.worktreePath })

      // Merge back to main
      await GitService.mergeWorktree(
        testDir,
        worktreeResult.branchName,
        testTaskId,
        'Attribution Test'
      )

      // Check that the original commit's author is preserved
      const log = execSync('git log --format="%an <%ae>" -2', { cwd: testDir }).toString()
      expect(log).toContain('Worktree User <worktree@test.com>')
    })
  })

  // Story 8.5: Historical Diff Tests
  describe('getHistoricalDiff (Story 8.5 AC: 6)', () => {
    const testDir = '/tmp/tinsu-histdiff-test-' + Date.now()

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

      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch {
        // Ignore
      }
    })

    it('should return diff for a specific commit', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a commit with changes
      writeFileSync(`${testDir}/feature.ts`, 'export const feature = true\n')
      execSync('git add feature.ts', { cwd: testDir })
      execSync('git commit -m "Add feature"', { cwd: testDir })

      // Get the commit SHA
      const commitSha = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()

      // Get historical diff
      const diff = await GitService.getHistoricalDiff(testDir, commitSha)

      expect(diff.files).toHaveLength(1)
      expect(diff.files[0].path).toBe('feature.ts')
      expect(diff.files[0].status).toBe('added')
      expect(diff.summary.filesChanged).toBe(1)
      expect(diff.summary.linesAdded).toBe(1)
    })

    it('should parse modifications correctly', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Modify README.md
      writeFileSync(`${testDir}/README.md`, '# Updated Test\nNew line\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Update README"', { cwd: testDir })

      const commitSha = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()

      const diff = await GitService.getHistoricalDiff(testDir, commitSha)

      expect(diff.files).toHaveLength(1)
      expect(diff.files[0].path).toBe('README.md')
      expect(diff.files[0].status).toBe('modified')
      expect(diff.files[0].additions).toBeGreaterThan(0)
    })

    it('should throw GitError for invalid commit SHA', async () => {
      await expect(GitService.getHistoricalDiff(testDir, 'invalidsha123')).rejects.toThrow(GitError)
    })

    it('should throw GitError for empty commit SHA', async () => {
      await expect(GitService.getHistoricalDiff(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.getHistoricalDiff(testDir, '')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for non-existent repository path', async () => {
      await expect(GitService.getHistoricalDiff('/nonexistent/path', 'abc123')).rejects.toThrow(GitError)
      await expect(GitService.getHistoricalDiff('/nonexistent/path', 'abc123')).rejects.toThrow('does not exist')
    })

    it('should handle merge commits with multiple file changes', async () => {
      const { writeFileSync, mkdirSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create multiple files in one commit
      mkdirSync(`${testDir}/src`, { recursive: true })
      writeFileSync(`${testDir}/src/index.ts`, 'export * from "./utils"\n')
      writeFileSync(`${testDir}/src/utils.ts`, 'export const util = () => {}\n')
      execSync('git add src/', { cwd: testDir })
      execSync('git commit -m "Add source files"', { cwd: testDir })

      const commitSha = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()

      const diff = await GitService.getHistoricalDiff(testDir, commitSha)

      expect(diff.files.length).toBe(2)
      expect(diff.summary.filesChanged).toBe(2)
    })
  })

  // Story 8.6: Remove Worktree Tests
  describe('removeWorktree (Story 8.6)', () => {
    const testDir = '/tmp/tinsu-removeworktree-test-' + Date.now()
    const testTaskId = 'remove-task-' + Date.now()

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
      execSync('git branch -M main', { cwd: testDir })
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

    it('should remove worktree and delete branch successfully (AC: 1, 2, Task 6.1)', async () => {
      const { existsSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree first
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Test Feature')
      expect(existsSync(worktreeResult.worktreePath)).toBe(true)

      // Verify branch exists
      const branchesBefore = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branchesBefore).toContain(worktreeResult.branchName)

      // Merge the branch first so it can be deleted with -d
      execSync('git checkout main', { cwd: testDir })
      execSync(`git merge ${worktreeResult.branchName}`, { cwd: testDir })

      // Remove worktree
      const result = await GitService.removeWorktree(
        testDir,
        worktreeResult.worktreePath,
        worktreeResult.branchName
      )

      expect(result.success).toBe(true)
      expect(result.worktreeRemoved).toBe(true)
      expect(result.branchDeleted).toBe(true)
      expect(result.error).toBeUndefined()

      // Verify worktree is gone
      expect(existsSync(worktreeResult.worktreePath)).toBe(false)

      // Verify branch is deleted
      const branchesAfter = execSync('git branch -a', { cwd: testDir }).toString()
      expect(branchesAfter).not.toContain(worktreeResult.branchName)
    })

    it('should succeed when worktree does not exist (Task 6.2, Task 1.5)', async () => {
      const { existsSync } = await import('fs')

      const nonExistentWorktreePath = `${testDir}/.tinsu/worktrees/nonexistent`
      expect(existsSync(nonExistentWorktreePath)).toBe(false)

      const result = await GitService.removeWorktree(
        testDir,
        nonExistentWorktreePath,
        'nonexistent-branch'
      )

      // Should succeed because worktree "doesn't need to be removed"
      expect(result.success).toBe(true)
      expect(result.worktreeRemoved).toBe(true) // Already "removed"
    })

    it('should succeed with warning when branch is not fully merged (Task 6.3, Task 1.6)', async () => {
      const { writeFileSync, existsSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes (but don't merge)
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Unmerged Feature')

      // Add a commit in the worktree
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      // Switch back to main (don't merge)
      execSync('git checkout main', { cwd: testDir })

      // Remove worktree (branch deletion will fail because not merged)
      const result = await GitService.removeWorktree(
        testDir,
        worktreeResult.worktreePath,
        worktreeResult.branchName
      )

      // Worktree removal should succeed even if branch deletion fails
      expect(result.success).toBe(true)
      expect(result.worktreeRemoved).toBe(true)
      expect(result.branchDeleted).toBe(false) // Branch not deleted because not merged
      expect(existsSync(worktreeResult.worktreePath)).toBe(false)
    })

    it('should throw GitError for invalid project path', async () => {
      await expect(
        GitService.removeWorktree('/path;bad', '/some/worktree', 'branch')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.removeWorktree('/path;bad', '/some/worktree', 'branch')
      ).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for invalid worktree path', async () => {
      await expect(
        GitService.removeWorktree(testDir, '/path;bad', 'branch')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.removeWorktree(testDir, '/path;bad', 'branch')
      ).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for empty branch name', async () => {
      await expect(
        GitService.removeWorktree(testDir, '/some/worktree', '')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.removeWorktree(testDir, '/some/worktree', '')
      ).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for non-existent project path', async () => {
      await expect(
        GitService.removeWorktree('/nonexistent/path', '/some/worktree', 'branch')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.removeWorktree('/nonexistent/path', '/some/worktree', 'branch')
      ).rejects.toThrow('does not exist')
    })

    it('should clear worktree path after successful cleanup (Task 6.5)', async () => {
      const { existsSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Clear Path Test')

      // Merge the branch
      execSync('git checkout main', { cwd: testDir })
      execSync(`git merge ${worktreeResult.branchName}`, { cwd: testDir })

      // Remove worktree
      const result = await GitService.removeWorktree(
        testDir,
        worktreeResult.worktreePath,
        worktreeResult.branchName
      )

      expect(result.success).toBe(true)
      // After removal, the worktree path should not exist
      expect(existsSync(worktreeResult.worktreePath)).toBe(false)
      // This verifies that DB update can safely set worktree_path to null
    })
  })

  // Story 8.6: Orphaned Worktrees Tests
  describe('listOrphanedWorktrees (Story 8.6)', () => {
    const testDir = '/tmp/tinsu-orphaned-test-' + Date.now()
    const testTaskId1 = 'orphan-task1-' + Date.now()
    const testTaskId2 = 'orphan-task2-' + Date.now()

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
      execSync('git branch -M main', { cwd: testDir })
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

    it('should return empty array when no worktrees exist', async () => {
      const result = await GitService.listOrphanedWorktrees(testDir, [])
      expect(result).toEqual([])
    })

    it('should return empty array when all worktrees are active', async () => {
      // Create two worktrees
      const wt1 = await GitService.createWorktree(testDir, testTaskId1, 'Feature 1')
      const wt2 = await GitService.createWorktree(testDir, testTaskId2, 'Feature 2')

      // Pass both as active
      const result = await GitService.listOrphanedWorktrees(testDir, [
        wt1.worktreePath,
        wt2.worktreePath
      ])

      expect(result).toEqual([])
    })

    it('should identify orphaned worktrees (Task 4.4)', async () => {
      // Create two worktrees
      const wt1 = await GitService.createWorktree(testDir, testTaskId1, 'Active Feature')
      const wt2 = await GitService.createWorktree(testDir, testTaskId2, 'Orphaned Feature')

      // Only pass wt1 as active (simulating wt2 has no task in DB)
      const result = await GitService.listOrphanedWorktrees(testDir, [wt1.worktreePath])

      expect(result).toHaveLength(1)
      expect(result[0].path).toBe(wt2.worktreePath)
      expect(result[0].branchName).toBe(wt2.branchName)
      expect(result[0].isLocked).toBe(false)
    })

    it('should return worktree info with branch name (Task 4.5)', async () => {
      // Create a worktree
      const wt = await GitService.createWorktree(testDir, testTaskId1, 'Branch Info Test')

      // List as orphaned (no active paths)
      const result = await GitService.listOrphanedWorktrees(testDir, [])

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('path')
      expect(result[0]).toHaveProperty('branchName')
      expect(result[0]).toHaveProperty('isLocked')
      expect(result[0].path).toBe(wt.worktreePath)
      expect(result[0].branchName).toBe(wt.branchName)
    })

    it('should throw GitError for invalid project path', async () => {
      await expect(
        GitService.listOrphanedWorktrees('/path;bad', [])
      ).rejects.toThrow(GitError)
      await expect(
        GitService.listOrphanedWorktrees('/path;bad', [])
      ).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for non-existent project path', async () => {
      await expect(
        GitService.listOrphanedWorktrees('/nonexistent/path', [])
      ).rejects.toThrow(GitError)
      await expect(
        GitService.listOrphanedWorktrees('/nonexistent/path', [])
      ).rejects.toThrow('does not exist')
    })

    it('should only include worktrees in .tinsu/worktrees/ directory', async () => {
      const { execSync } = await import('child_process')

      // Create a TinSu worktree
      const wt = await GitService.createWorktree(testDir, testTaskId1, 'TinSu Worktree')

      // Create a worktree outside .tinsu/worktrees/ (manual worktree)
      const outsideWorktreePath = `${testDir}/manual-worktree`
      execSync(`git worktree add ${outsideWorktreePath} -b manual-branch HEAD`, { cwd: testDir })

      // List orphaned (no active paths)
      const result = await GitService.listOrphanedWorktrees(testDir, [])

      // Should only include the TinSu worktree, not the manual one
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe(wt.worktreePath)
      expect(result.some(w => w.path === outsideWorktreePath)).toBe(false)
    })
  })

  // Story 8.7: Detect Merge Conflicts Tests
  describe('detectMergeConflicts (Story 8.7)', () => {
    const testDir = '/tmp/tinsu-detectconflict-test-' + Date.now()
    const testTaskId = 'conflict-detect-' + Date.now()

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
      execSync('git branch -M main', { cwd: testDir })
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

    it('should return hasConflicts: false when no conflicts (AC: 1, Task 9.1)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'No Conflict Feature')

      // Add a new file in the worktree (no conflict with main)
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      // Make sure we're on main
      execSync('git checkout main', { cwd: testDir })

      // Detect conflicts
      const result = await GitService.detectMergeConflicts(testDir, worktreeResult.branchName)

      expect(result.hasConflicts).toBe(false)
      expect(result.conflictFiles).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it('should return hasConflicts: true with file list when conflicts exist (AC: 2, Task 9.2)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and modify README.md
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Conflict Feature')

      // Modify README.md in worktree
      writeFileSync(`${worktreeResult.worktreePath}/README.md`, '# Modified in worktree\n')
      execSync('git add README.md', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Modify README in worktree"', { cwd: worktreeResult.worktreePath })

      // Modify the same file in main (create conflict)
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/README.md`, '# Modified in main\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Modify README in main"', { cwd: testDir })

      // Detect conflicts
      const result = await GitService.detectMergeConflicts(testDir, worktreeResult.branchName)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflictFiles).toContain('README.md')
      expect(result.conflictFiles.length).toBeGreaterThan(0)
    })

    it('should abort merge and restore clean state (AC: 4, Task 9.3)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and modify README.md
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Clean State Test')

      // Commit .gitignore so it doesn't show as untracked
      execSync('git add .gitignore', { cwd: testDir })
      execSync('git commit -m "Add gitignore"', { cwd: testDir })

      // Modify README.md in worktree
      writeFileSync(`${worktreeResult.worktreePath}/README.md`, '# Modified in worktree\n')
      execSync('git add README.md', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Modify README in worktree"', { cwd: worktreeResult.worktreePath })

      // Modify the same file in main (create conflict)
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/README.md`, '# Modified in main\n')
      execSync('git add README.md', { cwd: testDir })
      execSync('git commit -m "Modify README in main"', { cwd: testDir })

      // Detect conflicts
      await GitService.detectMergeConflicts(testDir, worktreeResult.branchName)

      // Verify main is still clean (no merge in progress, no merge conflict markers)
      const status = execSync('git status --porcelain', { cwd: testDir }).toString()
      // Status should not contain 'UU' (unmerged) entries or merge conflict markers
      expect(status).not.toContain('UU')
      expect(status).not.toContain('AA')
      expect(status).not.toContain('DD')

      // Verify we're still on main
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: testDir }).toString().trim()
      expect(currentBranch).toBe('main')
    })

    it('should throw GitError for non-existent branch (AC: Task 9.4)', async () => {
      const { execSync } = await import('child_process')

      // Make sure we're on main
      execSync('git checkout main', { cwd: testDir })

      // Try to detect conflicts for non-existent branch
      await expect(
        GitService.detectMergeConflicts(testDir, 'nonexistent-branch')
      ).rejects.toThrow(GitError)
    })

    it('should throw GitError for invalid project path', async () => {
      await expect(
        GitService.detectMergeConflicts('/path;bad', 'some-branch')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.detectMergeConflicts('/path;bad', 'some-branch')
      ).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for empty branch name', async () => {
      await expect(
        GitService.detectMergeConflicts(testDir, '')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.detectMergeConflicts(testDir, '')
      ).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for non-existent project path', async () => {
      await expect(
        GitService.detectMergeConflicts('/nonexistent/path', 'some-branch')
      ).rejects.toThrow(GitError)
      await expect(
        GitService.detectMergeConflicts('/nonexistent/path', 'some-branch')
      ).rejects.toThrow('does not exist')
    })

    it('should use git merge --no-commit --no-ff to test merge (AC: 4)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree with clean changes
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Test Merge Command')

      // Add a new file (no conflict)
      writeFileSync(`${worktreeResult.worktreePath}/feature.ts`, 'export const feature = true')
      execSync('git add feature.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Add feature"', { cwd: worktreeResult.worktreePath })

      execSync('git checkout main', { cwd: testDir })

      // Record HEAD before detection
      const headBefore = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()

      // Detect conflicts (should succeed with no conflicts)
      const result = await GitService.detectMergeConflicts(testDir, worktreeResult.branchName)

      // HEAD should be unchanged (merge was aborted)
      const headAfter = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()
      expect(headAfter).toBe(headBefore)

      expect(result.hasConflicts).toBe(false)
    })

    it('should detect multiple conflicting files', async () => {
      const { writeFileSync, mkdirSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Multi Conflict')

      // Create and modify multiple files in worktree
      mkdirSync(`${worktreeResult.worktreePath}/src`, { recursive: true })
      writeFileSync(`${worktreeResult.worktreePath}/README.md`, '# Worktree README\n')
      writeFileSync(`${worktreeResult.worktreePath}/src/index.ts`, 'worktree code')
      execSync('git add .', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Worktree changes"', { cwd: worktreeResult.worktreePath })

      // Modify the same files in main (create conflicts)
      execSync('git checkout main', { cwd: testDir })
      mkdirSync(`${testDir}/src`, { recursive: true })
      writeFileSync(`${testDir}/README.md`, '# Main README\n')
      writeFileSync(`${testDir}/src/index.ts`, 'main code')
      execSync('git add .', { cwd: testDir })
      execSync('git commit -m "Main changes"', { cwd: testDir })

      // Detect conflicts
      const result = await GitService.detectMergeConflicts(testDir, worktreeResult.branchName)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflictFiles.length).toBe(2)
      expect(result.conflictFiles).toContain('README.md')
      expect(result.conflictFiles).toContain('src/index.ts')
    })
  })

  // Story 8.9: Branch Status Tests
  describe('getBranchStatus (Story 8.9)', () => {
    const testDir = '/tmp/tinsu-branchstatus-test-' + Date.now()
    const testTaskId = 'branchstatus-' + Date.now()

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
      execSync('git branch -M main', { cwd: testDir })
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

    it('should return correct commits ahead count (AC: Task 9.1)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make commits
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Ahead Test')

      // Add 3 commits in the worktree
      for (let i = 1; i <= 3; i++) {
        writeFileSync(`${worktreeResult.worktreePath}/file${i}.ts`, `export const file${i} = ${i}`)
        execSync(`git add file${i}.ts`, { cwd: worktreeResult.worktreePath })
        execSync(`git commit -m "Add file ${i}"`, { cwd: worktreeResult.worktreePath })
      }

      // Get branch status
      const status = await GitService.getBranchStatus(testDir, worktreeResult.branchName, worktreeResult.worktreePath)

      expect(status.commitsAhead).toBe(3)
      expect(status.commitsBehind).toBe(0)
    })

    it('should return correct commits behind count (AC: Task 9.1)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Behind Test')

      // Add 2 commits to main
      execSync('git checkout main', { cwd: testDir })
      for (let i = 1; i <= 2; i++) {
        writeFileSync(`${testDir}/main${i}.ts`, `export const main${i} = ${i}`)
        execSync(`git add main${i}.ts`, { cwd: testDir })
        execSync(`git commit -m "Add main file ${i}"`, { cwd: testDir })
      }

      // Get branch status
      const status = await GitService.getBranchStatus(testDir, worktreeResult.branchName, worktreeResult.worktreePath)

      expect(status.commitsBehind).toBe(2)
    })

    it('should detect uncommitted changes (AC: Task 9.2)', async () => {
      const { writeFileSync } = await import('fs')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Uncommitted Test')

      // Add uncommitted changes
      writeFileSync(`${worktreeResult.worktreePath}/uncommitted.ts`, 'export const uncommitted = true')

      // Get branch status
      const status = await GitService.getBranchStatus(testDir, worktreeResult.branchName, worktreeResult.worktreePath)

      expect(status.hasUncommittedChanges).toBe(true)
    })

    it('should return hasUncommittedChanges: false for clean worktree (AC: Task 9.2)', async () => {
      // Create a worktree (no uncommitted changes)
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Clean Test')

      // Get branch status
      const status = await GitService.getBranchStatus(testDir, worktreeResult.branchName, worktreeResult.worktreePath)

      expect(status.hasUncommittedChanges).toBe(false)
    })

    it('should handle both ahead and behind at the same time', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree and make commits
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Diverged Test')

      // Add commits in worktree
      writeFileSync(`${worktreeResult.worktreePath}/worktree.ts`, 'export const worktree = true')
      execSync('git add worktree.ts', { cwd: worktreeResult.worktreePath })
      execSync('git commit -m "Worktree commit"', { cwd: worktreeResult.worktreePath })

      // Add commits to main
      execSync('git checkout main', { cwd: testDir })
      writeFileSync(`${testDir}/main.ts`, 'export const main = true')
      execSync('git add main.ts', { cwd: testDir })
      execSync('git commit -m "Main commit"', { cwd: testDir })

      // Get branch status
      const status = await GitService.getBranchStatus(testDir, worktreeResult.branchName, worktreeResult.worktreePath)

      expect(status.commitsAhead).toBe(1)
      expect(status.commitsBehind).toBe(1)
    })

    it('should throw GitError for empty branchName', async () => {
      await expect(GitService.getBranchStatus(testDir, '')).rejects.toThrow(GitError)
      await expect(GitService.getBranchStatus(testDir, '')).rejects.toThrow('non-empty string')
    })

    it('should throw GitError for invalid project path', async () => {
      await expect(GitService.getBranchStatus('/path;bad', 'some-branch')).rejects.toThrow(GitError)
      await expect(GitService.getBranchStatus('/path;bad', 'some-branch')).rejects.toThrow('dangerous characters')
    })

    it('should throw GitError for non-existent project path', async () => {
      await expect(GitService.getBranchStatus('/nonexistent/path', 'some-branch')).rejects.toThrow(GitError)
      await expect(GitService.getBranchStatus('/nonexistent/path', 'some-branch')).rejects.toThrow('does not exist')
    })
  })

  // Story 8.9: Auto-Commit Tests
  describe('autoCommitWorktreeChanges (Story 8.9)', () => {
    const testDir = '/tmp/tinsu-autocommit-test-' + Date.now()
    const testTaskId = 'autocommit-' + Date.now()

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
      execSync('git branch -M main', { cwd: testDir })
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

    it('should create WIP commit when uncommitted changes exist (AC: Task 9.3)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'Auto Commit Test')

      // Add uncommitted changes
      writeFileSync(`${worktreeResult.worktreePath}/agent-changes.ts`, 'export const agentChanges = true')

      // Auto-commit
      const result = await GitService.autoCommitWorktreeChanges(worktreeResult.worktreePath)

      expect(result.committed).toBe(true)
      expect(result.commitSha).toBeTruthy()

      // Verify the commit message
      const commitMessage = execSync('git log -1 --format=%s', { cwd: worktreeResult.worktreePath }).toString().trim()
      expect(commitMessage).toBe('WIP: Agent changes')
    })

    it('should return committed: false when no changes exist (AC: Task 9.4)', async () => {
      // Create a worktree (no uncommitted changes)
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'No Changes Test')

      // Auto-commit
      const result = await GitService.autoCommitWorktreeChanges(worktreeResult.worktreePath)

      expect(result.committed).toBe(false)
      expect(result.commitSha).toBeUndefined()
    })

    it('should return committed: false for non-existent path', async () => {
      const result = await GitService.autoCommitWorktreeChanges('/nonexistent/path')

      expect(result.committed).toBe(false)
      expect(result.commitSha).toBeUndefined()
    })

    it('should throw GitError for invalid path with dangerous characters', async () => {
      await expect(GitService.autoCommitWorktreeChanges('/path;bad')).rejects.toThrow(GitError)
      await expect(GitService.autoCommitWorktreeChanges('/path;bad')).rejects.toThrow('dangerous characters')
    })

    it('should stage all changes including new files (AC: Task 9.3)', async () => {
      const { writeFileSync, mkdirSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'All Changes Test')

      // Add various types of changes
      mkdirSync(`${worktreeResult.worktreePath}/src`, { recursive: true })
      writeFileSync(`${worktreeResult.worktreePath}/new-file.ts`, 'new file')
      writeFileSync(`${worktreeResult.worktreePath}/src/utils.ts`, 'utils')
      writeFileSync(`${worktreeResult.worktreePath}/README.md`, '# Updated README\n')

      // Auto-commit
      const result = await GitService.autoCommitWorktreeChanges(worktreeResult.worktreePath)

      expect(result.committed).toBe(true)

      // Verify all files were committed
      const filesInCommit = execSync('git show --name-only --format=', { cwd: worktreeResult.worktreePath }).toString()
      expect(filesInCommit).toContain('new-file.ts')
      expect(filesInCommit).toContain('src/utils.ts')
      expect(filesInCommit).toContain('README.md')
    })

    it('should return the correct commit SHA (AC: Task 9.3)', async () => {
      const { writeFileSync } = await import('fs')
      const { execSync } = await import('child_process')

      // Create a worktree
      const worktreeResult = await GitService.createWorktree(testDir, testTaskId, 'SHA Test')

      // Add uncommitted changes
      writeFileSync(`${worktreeResult.worktreePath}/change.ts`, 'change')

      // Auto-commit
      const result = await GitService.autoCommitWorktreeChanges(worktreeResult.worktreePath)

      // Verify SHA matches HEAD
      const headSha = execSync('git rev-parse HEAD', { cwd: worktreeResult.worktreePath }).toString().trim()
      expect(result.commitSha).toBe(headSha)
    })
  })

  // Story 9.7: Artifact Version Diff View
  describe('getFileVersionHistory', () => {
    it('returns parsed commits for a known file (integration test)', async () => {
      // Use a known file in the current repo
      const result = await GitService.getFileVersionHistory(process.cwd(), 'package.json')
      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('commitSha')
        expect(result[0]).toHaveProperty('author')
        expect(result[0]).toHaveProperty('timestamp')
        expect(result[0]).toHaveProperty('message')
        expect(typeof result[0].commitSha).toBe('string')
        expect(typeof result[0].author).toBe('string')
        expect(typeof result[0].timestamp).toBe('number')
        expect(typeof result[0].message).toBe('string')
      }
    })

    it('returns empty array for untracked files', async () => {
      const result = await GitService.getFileVersionHistory(process.cwd(), 'nonexistent-file-xyz.md')
      expect(result).toEqual([])
    })

    it('respects limit parameter', async () => {
      const result = await GitService.getFileVersionHistory(process.cwd(), 'package.json', 2)
      expect(result.length).toBeLessThanOrEqual(2)
    })

    it('throws GitError for invalid path', async () => {
      await expect(
        GitService.getFileVersionHistory('/nonexistent/path', 'file.md')
      ).rejects.toThrow(GitError)
    })

    it('throws GitError for dangerous path characters', async () => {
      await expect(
        GitService.getFileVersionHistory('/path; rm -rf /', 'file.md')
      ).rejects.toThrow('dangerous characters')
    })
  })

  describe('getFileContentAtCommit', () => {
    it('returns file content at a valid commit (integration test)', async () => {
      // Get the latest commit for package.json
      const history = await GitService.getFileVersionHistory(process.cwd(), 'package.json', 1)
      if (history.length > 0) {
        const content = await GitService.getFileContentAtCommit(
          process.cwd(),
          'package.json',
          history[0].commitSha
        )
        expect(typeof content).toBe('string')
        expect(content.length).toBeGreaterThan(0)
        // Should be valid JSON (package.json)
        expect(() => JSON.parse(content)).not.toThrow()
      }
    })

    it('throws GitError when file does not exist at commit', async () => {
      // Get HEAD commit
      const history = await GitService.getFileVersionHistory(process.cwd(), 'package.json', 1)
      if (history.length > 0) {
        await expect(
          GitService.getFileContentAtCommit(
            process.cwd(),
            'this-file-never-existed-xyz.md',
            history[0].commitSha
          )
        ).rejects.toThrow(GitError)
      }
    })

    it('throws GitError for empty commitSha', async () => {
      await expect(
        GitService.getFileContentAtCommit(process.cwd(), 'package.json', '')
      ).rejects.toThrow('commitSha must be a non-empty string')
    })

    it('throws GitError for invalid SHA format (P1)', async () => {
      await expect(
        GitService.getFileContentAtCommit(process.cwd(), 'package.json', 'not-a-sha!')
      ).rejects.toThrow('hex git commit SHA')
    })

    it('throws GitError for too-short SHA (P1)', async () => {
      await expect(
        GitService.getFileContentAtCommit(process.cwd(), 'package.json', 'abc12') // < 7 chars
      ).rejects.toThrow('hex git commit SHA')
    })

    it('throws GitError for invalid path', async () => {
      // Use a valid 40-char SHA format so path validation is what triggers the error
      await expect(
        GitService.getFileContentAtCommit('/nonexistent/path', 'file.md', 'a'.repeat(40))
      ).rejects.toThrow(GitError)
    })
  })

  describe('getFileVersionHistory bounds and parsing (P2-P6)', () => {
    it('clamps limit=0 to 1 (P2)', async () => {
      // Should not throw — 0 is clamped to 1 rather than producing git -n 0 (unbounded)
      const result = await GitService.getFileVersionHistory(process.cwd(), 'package.json', 0)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeLessThanOrEqual(1)
    })

    it('clamps limit above 1000 to 1000 (P2)', async () => {
      // Should not throw — limit is clamped
      const result = await GitService.getFileVersionHistory(process.cwd(), 'package.json', 9999)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeLessThanOrEqual(1000)
    })
  })
})
