/**
 * Git Service - TES-4.1
 *
 * Service for fetching and parsing git diff data.
 * Runs git commands and parses unified diff format into structured TypeScript objects.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve, isAbsolute } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

/** Timeout for git commands in milliseconds */
const GIT_COMMAND_TIMEOUT = 10000

/**
 * Represents a single line in a diff hunk.
 */
export interface GitDiffLine {
  /** Type of the line change */
  type: 'add' | 'remove' | 'context'
  /** Content of the line (without the prefix character) */
  content: string
  /** Line number in the old file (undefined for added lines) */
  oldLineNo?: number
  /** Line number in the new file (undefined for removed lines) */
  newLineNo?: number
}

/**
 * Represents a diff hunk (a contiguous block of changes).
 */
export interface GitDiffHunk {
  /** Starting line number in the old file */
  oldStart: number
  /** Number of lines from the old file */
  oldLines: number
  /** Starting line number in the new file */
  newStart: number
  /** Number of lines in the new file */
  newLines: number
  /** Context header text (function name, etc.) */
  header: string
  /** Individual lines in this hunk */
  lines: GitDiffLine[]
}

/**
 * Represents a single file in the diff.
 */
export interface GitDiffFile {
  /** File path (new path for renames) */
  path: string
  /** Original file path for renames */
  oldPath?: string
  /** Change status */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** Array of diff hunks */
  hunks: GitDiffHunk[]
}

/**
 * Complete diff result with files and summary.
 */
export interface GitDiffResult {
  /** Array of changed files */
  files: GitDiffFile[]
  /** Summary statistics */
  summary: {
    /** Total number of files changed */
    filesChanged: number
    /** Total lines added across all files */
    linesAdded: number
    /** Total lines removed across all files */
    linesRemoved: number
  }
}

/**
 * Service for git diff operations.
 *
 * Provides methods to fetch and parse git diffs for displaying
 * code changes in the UI.
 */
export class GitService {
  /**
   * Gets the diff for a repository, including both staged and unstaged changes.
   *
   * @param repoPath - Path to the git repository
   * @returns Parsed diff result with files and summary
   * @throws Error if git command fails (e.g., not a git repository)
   *
   * @example
   * ```typescript
   * const diff = await GitService.getDiff('/path/to/repo')
   * console.log(`${diff.summary.filesChanged} files changed`)
   * ```
   */
  static async getDiff(repoPath: string): Promise<GitDiffResult> {
    // Validate and sanitize input path
    if (!repoPath || typeof repoPath !== 'string') {
      throw new Error('Invalid repository path: path must be a non-empty string')
    }

    // Check for shell metacharacters that could enable command injection
    // Do this BEFORE any filesystem operations to prevent exploitation
    const dangerousChars = /[;&|`$()<>]/
    if (dangerousChars.test(repoPath)) {
      throw new Error('Invalid repository path: contains dangerous characters')
    }

    // Resolve to absolute path and normalize
    const normalizedPath = resolve(repoPath)

    // Verify path exists
    if (!existsSync(normalizedPath)) {
      throw new Error(`Repository path does not exist: ${normalizedPath}`)
    }

    try {
      // Get both staged and unstaged changes relative to HEAD
      const diffPromise = execAsync('git diff HEAD --unified=3', {
        cwd: normalizedPath,
        timeout: GIT_COMMAND_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024 // 10MB for large diffs
      })

      // Get untracked files (not in git index)
      const untrackedPromise = execAsync('git ls-files --others --exclude-standard', {
        cwd: normalizedPath,
        timeout: GIT_COMMAND_TIMEOUT
      })

      const [{ stdout: diffOutput }, { stdout: untrackedOutput }] = await Promise.all([
        diffPromise,
        untrackedPromise
      ])

      // Parse tracked file changes
      const trackedDiff = this.parseDiff(diffOutput)

      // Process untracked files
      if (untrackedOutput.trim()) {
        const untrackedFiles = untrackedOutput.trim().split('\n')

        // For each untracked file, generate a diff showing it as newly added
        for (const filePath of untrackedFiles) {
          try {
            // Generate diff for untracked file by comparing /dev/null to the file
            const { stdout: untrackedDiffOutput } = await execAsync(
              `git diff --no-index /dev/null "${filePath}" || true`,
              {
                cwd: normalizedPath,
                timeout: GIT_COMMAND_TIMEOUT,
                maxBuffer: 10 * 1024 * 1024
              }
            )

            // Parse the untracked file diff
            const untrackedFileDiff = this.parseDiff(untrackedDiffOutput)

            // Add untracked files to the result
            if (untrackedFileDiff.files.length > 0) {
              // Fix the path (git diff --no-index shows /dev/null in the path)
              const file = untrackedFileDiff.files[0]
              file.path = filePath
              file.status = 'added'

              trackedDiff.files.push(file)
            }
          } catch {
            // If we can't diff an untracked file (binary, too large, etc.), skip it
            // This prevents one bad file from breaking the entire diff
            continue
          }
        }

        // Recalculate summary to include untracked files
        trackedDiff.summary = {
          filesChanged: trackedDiff.files.length,
          linesAdded: trackedDiff.files.reduce((sum, f) => sum + f.additions, 0),
          linesRemoved: trackedDiff.files.reduce((sum, f) => sum + f.deletions, 0)
        }
      }

      return trackedDiff
    } catch (error) {
      const err = error as Error & { stderr?: string }
      // Re-throw with meaningful message
      throw new Error(err.stderr || err.message || 'Failed to get git diff')
    }
  }

  /**
   * Parses a unified diff string into structured GitDiffResult.
   *
   * @param diffOutput - Raw unified diff output from git
   * @returns Parsed diff result
   */
  static parseDiff(diffOutput: string): GitDiffResult {
    if (!diffOutput.trim()) {
      return {
        files: [],
        summary: {
          filesChanged: 0,
          linesAdded: 0,
          linesRemoved: 0
        }
      }
    }

    const files: GitDiffFile[] = []
    const lines = diffOutput.split('\n')
    let currentFile: GitDiffFile | null = null
    let currentHunk: GitDiffHunk | null = null
    let oldLineNo = 0
    let newLineNo = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect file boundary
      if (line.startsWith('diff --git')) {
        // Save previous file if exists
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk)
          }
          files.push(currentFile)
        }

        // Extract file path from "diff --git a/path b/path"
        const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
        const newPath = match ? match[2] : ''

        currentFile = {
          path: newPath,
          status: 'modified', // Default, may be overwritten
          additions: 0,
          deletions: 0,
          hunks: []
        }
        currentHunk = null
        continue
      }

      if (!currentFile) continue

      // Detect new file
      if (line.startsWith('new file mode')) {
        currentFile.status = 'added'
        continue
      }

      // Detect deleted file
      if (line.startsWith('deleted file mode')) {
        currentFile.status = 'deleted'
        continue
      }

      // Detect renamed file
      if (line.startsWith('rename from ')) {
        currentFile.oldPath = line.replace('rename from ', '')
        currentFile.status = 'renamed'
        continue
      }

      if (line.startsWith('rename to ')) {
        currentFile.path = line.replace('rename to ', '')
        continue
      }

      // Skip index, --- and +++ lines (metadata)
      if (
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('similarity index')
      ) {
        continue
      }

      // Detect hunk header
      if (line.startsWith('@@')) {
        // Save previous hunk
        if (currentHunk) {
          currentFile.hunks.push(currentHunk)
        }

        // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@ context
        const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/)
        if (hunkMatch) {
          oldLineNo = parseInt(hunkMatch[1], 10)
          const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1
          newLineNo = parseInt(hunkMatch[3], 10)
          const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1
          const header = hunkMatch[5].trim()

          currentHunk = {
            oldStart: oldLineNo,
            oldLines,
            newStart: newLineNo,
            newLines,
            header,
            lines: []
          }
        }
        continue
      }

      // Parse diff content lines
      if (currentHunk) {
        if (line.startsWith('+')) {
          // Added line
          const diffLine: GitDiffLine = {
            type: 'add',
            content: line.substring(1),
            newLineNo: newLineNo
          }
          currentHunk.lines.push(diffLine)
          currentFile.additions++
          newLineNo++
        } else if (line.startsWith('-')) {
          // Removed line
          const diffLine: GitDiffLine = {
            type: 'remove',
            content: line.substring(1),
            oldLineNo: oldLineNo
          }
          currentHunk.lines.push(diffLine)
          currentFile.deletions++
          oldLineNo++
        } else if (line.startsWith(' ')) {
          // Context line
          const diffLine: GitDiffLine = {
            type: 'context',
            content: line.substring(1),
            oldLineNo: oldLineNo,
            newLineNo: newLineNo
          }
          currentHunk.lines.push(diffLine)
          oldLineNo++
          newLineNo++
        }
        // Skip lines that don't match (like "\ No newline at end of file")
      }
    }

    // Save last file and hunk
    if (currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk)
      }
      files.push(currentFile)
    }

    // Calculate summary
    const summary = {
      filesChanged: files.length,
      linesAdded: files.reduce((sum, f) => sum + f.additions, 0),
      linesRemoved: files.reduce((sum, f) => sum + f.deletions, 0)
    }

    return { files, summary }
  }
}
