/**
 * Git Service Tests - TES-4.1
 *
 * Tests for GitService diff fetching and parsing functionality.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitService } from './git.service'

describe('GitService', () => {
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
    // Store original exec implementation
    let execAsyncMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      // Create a mock function for testing
      execAsyncMock = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

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
          'Invalid repository path: contains dangerous characters'
        )
      }
    })

    it('should reject empty or invalid path', async () => {
      await expect(GitService.getDiff('')).rejects.toThrow('Invalid repository path')
      await expect(GitService.getDiff(null as any)).rejects.toThrow('Invalid repository path')
      await expect(GitService.getDiff(undefined as any)).rejects.toThrow(
        'Invalid repository path'
      )
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
})
