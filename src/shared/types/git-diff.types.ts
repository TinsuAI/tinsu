/**
 * Git Diff Types - Story 8.11
 *
 * Shared type definitions for git diff data structures.
 * These types are used by both main and renderer processes.
 *
 * @see Story 8.11: Historical Diff View for Completed Tasks
 */

/**
 * A single line within a diff hunk.
 */
export interface GitDiffLine {
  /** Line type: context (unchanged), add (new), remove (deleted) */
  type: 'context' | 'add' | 'remove'
  /** The actual content of the line (without the leading +/-/space) */
  content: string
  /** Original file line number (for context and remove lines) */
  oldLineNo?: number
  /** New file line number (for context and add lines) */
  newLineNo?: number
}

/**
 * A diff hunk representing a contiguous block of changes.
 */
export interface GitDiffHunk {
  /** The hunk header (e.g., "@@ -1,5 +1,7 @@") */
  header: string
  /** Starting line number in the original file */
  oldStart: number
  /** Number of lines from the original file */
  oldLines: number
  /** Starting line number in the modified file */
  newStart: number
  /** Number of lines in the modified file */
  newLines: number
  /** The lines within this hunk */
  lines: GitDiffLine[]
}

/**
 * A single file within a diff.
 */
export interface GitDiffFile {
  /** File path (relative to repo root) */
  path: string
  /** Previous path if renamed */
  oldPath?: string
  /** File status: added, modified, deleted, renamed */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Whether the file is binary */
  isBinary?: boolean
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** The diff hunks for this file */
  hunks: GitDiffHunk[]
}

/**
 * Summary statistics for a diff.
 */
export interface GitDiffSummary {
  /** Total number of files changed */
  filesChanged: number
  /** Total lines added across all files */
  linesAdded: number
  /** Total lines removed across all files */
  linesRemoved: number
}

/**
 * Complete diff result from GitService.
 */
export interface GitDiffResult {
  /** Array of changed files */
  files: GitDiffFile[]
  /** Summary statistics */
  summary: GitDiffSummary
}
