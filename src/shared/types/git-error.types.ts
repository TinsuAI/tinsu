/**
 * Git Error Types - Story 8.10
 *
 * Type definitions for user-friendly git error handling.
 * Provides categorized errors with recovery options.
 *
 * @see Story 8.10: AC 1 - Clear error messages with recovery steps
 * @see Story 8.10: Task 2.1, 2.2, 2.3, 2.4
 */

import { GitError } from '../../main/services/git.service'

/**
 * Categories of git errors for user-friendly messaging.
 *
 * @see Story 8.10: Task 2.1
 */
export type GitErrorCategory =
  | 'not_installed'
  | 'not_repository'
  | 'worktree_creation'
  | 'worktree_removal'
  | 'merge_failed'
  | 'branch_conflict'
  | 'disk_full'
  | 'permission_denied'
  | 'network'
  | 'unknown'

/**
 * User-friendly recoverable error with suggested actions.
 *
 * @see Story 8.10: Task 2.2
 */
export interface GitRecoverableError {
  /** Category of the error for UI handling */
  category: GitErrorCategory
  /** User-friendly error message */
  message: string
  /** Technical details (command, stderr) for debugging */
  technicalDetails: string
  /** List of suggested recovery actions */
  suggestedActions: string[]
  /** Whether the operation can be retried */
  canRetry: boolean
  /** Whether the operation can be skipped */
  canSkip: boolean
}

/**
 * Maps common git error patterns to user-friendly messages and recovery options.
 *
 * @see Story 8.10: Task 2.4
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp | string
  category: GitErrorCategory
  message: string
  suggestedActions: string[]
  canRetry: boolean
  canSkip: boolean
}> = [
  // Disk full errors
  {
    pattern: /disk full|enospc|no space left|out of disk space/i,
    category: 'disk_full',
    message: 'Not enough disk space. Free up space and retry.',
    suggestedActions: [
      'Free up disk space by deleting unused files',
      'Empty your trash/recycle bin',
      'Clear temporary files',
      'Retry the operation after freeing space'
    ],
    canRetry: true,
    canSkip: false
  },
  // Permission denied errors
  {
    pattern: /permission denied|eacces|access denied/i,
    category: 'permission_denied',
    message: 'Permission denied. Check file permissions.',
    suggestedActions: [
      'Check that you have write access to the project folder',
      'Verify no other application has the files open',
      'On macOS/Linux: Check folder permissions with ls -la',
      'Retry after resolving permission issues'
    ],
    canRetry: true,
    canSkip: false
  },
  // Branch/worktree already exists
  {
    pattern: /already exists|is already checked out|fatal:.*already/i,
    category: 'branch_conflict',
    message: 'Branch or worktree already exists. Choose a different name.',
    suggestedActions: [
      'Delete the existing branch/worktree if not needed',
      'Use a different task name',
      'Clean up orphaned worktrees in settings'
    ],
    canRetry: true,
    canSkip: true
  },
  // Not a git repository
  {
    pattern: /not a git repository|fatal: not a git/i,
    category: 'not_repository',
    message: 'Not a git repository. Initialize git first.',
    suggestedActions: [
      "Run 'git init' in your project folder",
      'Ensure you opened the correct project',
      'Check if .git folder exists in project root'
    ],
    canRetry: false,
    canSkip: false
  },
  // Branch reference not found
  {
    pattern: /could not resolve ref|pathspec.*did not match|unknown revision/i,
    category: 'branch_conflict',
    message: 'Branch reference not found. Check branch name.',
    suggestedActions: [
      'Verify the branch name is correct',
      "List available branches with 'git branch -a'",
      'The branch may have been deleted'
    ],
    canRetry: true,
    canSkip: true
  },
  // Merge conflict
  {
    pattern: /merge conflict|automatic merge failed|fix conflicts/i,
    category: 'merge_failed',
    message: 'Merge conflict detected. Resolve conflicts manually.',
    suggestedActions: [
      'Use the conflict resolution UI to resolve conflicts',
      'Review conflicting files and choose which changes to keep',
      'After resolving, mark files as resolved'
    ],
    canRetry: false,
    canSkip: false
  },
  // Network errors
  {
    pattern: /network|etimedout|econnrefused|unable to access|could not read from remote/i,
    category: 'network',
    message: 'Network error. Check your internet connection.',
    suggestedActions: [
      'Check your internet connection',
      'Verify remote repository is accessible',
      'Try again later if the remote is temporarily down',
      'Check firewall/proxy settings if on corporate network'
    ],
    canRetry: true,
    canSkip: false
  },
  // Git not installed
  {
    pattern: /git not found|command not found.*git|git is not recognized/i,
    category: 'not_installed',
    message: 'Git not found. Please install git.',
    suggestedActions: ['Install git from https://git-scm.com/', 'Restart the application after installing git'],
    canRetry: false,
    canSkip: false
  },
  // Worktree removal errors
  {
    pattern: /worktree.*locked|cannot remove worktree|worktree.*not empty/i,
    category: 'worktree_removal',
    message: 'Cannot remove worktree. It may be locked or in use.',
    suggestedActions: [
      'Close any editors or terminals using the worktree',
      'Try removing manually if safe to do so',
      'Check for locked files in the worktree directory'
    ],
    canRetry: true,
    canSkip: true
  }
]

/**
 * Categorizes a GitError into a user-friendly GitRecoverableError.
 *
 * Matches error messages against known patterns to provide
 * appropriate user messaging and recovery options.
 *
 * @param error - The GitError from git.service.ts
 * @returns A user-friendly GitRecoverableError
 *
 * @see Story 8.10: Task 2.3
 *
 * @example
 * ```typescript
 * try {
 *   await GitService.createWorktree(...)
 * } catch (error) {
 *   if (error instanceof GitError) {
 *     const recoverable = categorizeGitError(error)
 *     // Show user-friendly dialog with recoverable.message
 *   }
 * }
 * ```
 */
export function categorizeGitError(error: GitError): GitRecoverableError {
  // Combine all error information for pattern matching
  const errorText = [error.message, error.stderr || '', error.command || ''].join(' ').toLowerCase()

  // Try to match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    const regex = pattern.pattern instanceof RegExp ? pattern.pattern : new RegExp(pattern.pattern, 'i')

    if (regex.test(errorText)) {
      return {
        category: pattern.category,
        message: pattern.message,
        technicalDetails: formatTechnicalDetails(error),
        suggestedActions: pattern.suggestedActions,
        canRetry: pattern.canRetry,
        canSkip: pattern.canSkip
      }
    }
  }

  // Unknown error - provide generic handling
  return {
    category: 'unknown',
    message: 'An unexpected git error occurred.',
    technicalDetails: formatTechnicalDetails(error),
    suggestedActions: [
      'Check the technical details below for more information',
      'Try the operation again',
      'If the problem persists, check git logs in settings'
    ],
    canRetry: true,
    canSkip: false
  }
}

/**
 * Formats the technical details from a GitError for display.
 *
 * @param error - The GitError to format
 * @returns Formatted technical details string
 */
function formatTechnicalDetails(error: GitError): string {
  const parts: string[] = []

  if (error.command) {
    parts.push(`Command: ${error.command}`)
  }

  if (error.exitCode !== undefined) {
    parts.push(`Exit code: ${error.exitCode}`)
  }

  if (error.message) {
    parts.push(`Error: ${error.message}`)
  }

  if (error.stderr) {
    parts.push(`Output: ${error.stderr}`)
  }

  return parts.join('\n')
}

/**
 * Creates a GitRecoverableError from a general Error.
 *
 * Use this when you have an error that may not be a GitError
 * but still needs to be displayed to the user.
 *
 * @param error - Any Error object
 * @param operationName - Name of the operation for context
 * @returns A user-friendly GitRecoverableError
 */
export function createRecoverableErrorFromGeneric(error: Error, operationName: string): GitRecoverableError {
  // If it's already a GitError, use categorizeGitError
  if (error instanceof GitError) {
    return categorizeGitError(error)
  }

  // For generic errors, try to match patterns in the message
  const fakeGitError = new GitError(error.message, operationName)
  return categorizeGitError(fakeGitError)
}
