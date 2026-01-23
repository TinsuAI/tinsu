/**
 * Git Service - TES-4.1, Story 8.1
 *
 * Service for git operations including diff fetching/parsing and foundation methods.
 * Runs git commands via child_process and provides consistent error handling.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.1: Git Service Foundation
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve, join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync } from 'fs'

const execAsync = promisify(exec)

/** Timeout for git commands in milliseconds (default for most operations) */
const GIT_COMMAND_TIMEOUT = 10000

/** Timeout for branch operations - faster operations (AC: 5 - 5 seconds) */
const GIT_BRANCH_TIMEOUT = 5000

/** Timeout for large operations (AC: 5 - 30 seconds) */
const GIT_LARGE_OP_TIMEOUT = 30000

/** Max buffer for large repos (AC: 5 - 10MB) */
const GIT_MAX_BUFFER = 10 * 1024 * 1024

/** Pattern for dangerous shell metacharacters */
const DANGEROUS_CHARS = /[;&|`$()<>]/

/** Pattern for invalid git branch name characters (NFR23) */
const INVALID_BRANCH_CHARS = /[~^:\\\?\*\[\]@{}|'"`!#$%&()+,;=<>]/g

/** Maximum length for the slug portion of branch names */
const MAX_SLUG_LENGTH = 50

/** Error type returned by promisified exec */
interface ExecError extends Error {
  code?: number
  stderr?: string
  cmd?: string
}

/**
 * Custom error class for Git operations with command context.
 * Provides detailed error information for debugging and logging.
 *
 * @see Story 8.1: AC 2 - Clear error messages with command context
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message)
    this.name = 'GitError'
  }
}

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
 * Result of merging a worktree branch to main.
 *
 * @see Story 8.5: AC 2
 */
export interface MergeResult {
  /** Whether the merge succeeded */
  success: boolean
  /** The SHA of the merge commit (or FF result commit) */
  commitSha: string
  /** The branch that was merged */
  branchName: string
  /** Type of merge performed */
  mergeType: 'fast-forward' | 'merge-commit'
  /** Conflict files if merge failed due to conflicts */
  conflictFiles?: string[]
}

/**
 * Result of removing a worktree and its branch.
 *
 * @see Story 8.6: AC 1, 2
 */
export interface RemoveWorktreeResult {
  /** Whether the overall operation succeeded */
  success: boolean
  /** Whether the worktree was removed */
  worktreeRemoved: boolean
  /** Whether the branch was deleted */
  branchDeleted: boolean
  /** Error message if success=false or partial failure */
  error?: string
}

/**
 * Information about an orphaned worktree.
 *
 * @see Story 8.6: AC 5
 */
export interface OrphanedWorktree {
  /** Path to the worktree directory */
  path: string
  /** Branch name associated with the worktree */
  branchName: string
  /** Whether the worktree is locked */
  isLocked: boolean
}

/**
 * Result of detecting merge conflicts before actual merge.
 *
 * @see Story 8.7: AC 2
 */
export interface ConflictDetectionResult {
  /** Whether merge conflicts were detected */
  hasConflicts: boolean
  /** List of files with conflicts (empty if no conflicts) */
  conflictFiles: string[]
  /** Error message if detection failed for other reasons */
  error?: string
}

/**
 * Service for git operations.
 *
 * Provides methods for:
 * - Git diff fetching and parsing (TES-4.1)
 * - Git installation detection (Story 8.1)
 * - Repository verification (Story 8.1)
 * - Worktree gitignore management (Story 8.1)
 */
export class GitService {
  /**
   * Validates a path for security, checking for dangerous shell metacharacters.
   *
   * @param path - The path to validate
   * @param operationName - Name of the operation for error context
   * @throws GitError if path contains dangerous characters
   */
  private static validatePath(path: string, operationName: string): void {
    if (!path || typeof path !== 'string') {
      throw new GitError(
        'Invalid path: path must be a non-empty string',
        operationName
      )
    }

    if (DANGEROUS_CHARS.test(path)) {
      throw new GitError(
        'Invalid path: contains dangerous characters',
        operationName
      )
    }
  }

  /**
   * Executes a git command with proper error handling and timeout.
   *
   * @param args - Array of git command arguments
   * @param cwd - Working directory for the command
   * @param timeout - Timeout in milliseconds (default: GIT_COMMAND_TIMEOUT)
   * @returns Promise with stdout and stderr
   * @throws GitError on command failure
   */
  private static async execGit(
    args: string[],
    cwd: string,
    timeout: number = GIT_COMMAND_TIMEOUT
  ): Promise<{ stdout: string; stderr: string }> {
    const command = `git ${args.join(' ')}`

    try {
      const result = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: GIT_MAX_BUFFER
      })
      return { stdout: result.stdout, stderr: result.stderr }
    } catch (error) {
      const execError = error as ExecError
      throw new GitError(
        execError.message || 'Git command failed',
        command,
        execError.code,
        execError.stderr
      )
    }
  }

  /**
   * Checks if git is installed and available in PATH.
   *
   * @returns true if git is installed, false if not found
   * @throws Error for other failures (permission denied, timeout, etc.)
   *
   * @see Story 8.1: AC 3 - Detect missing git dependency
   *
   * @example
   * ```typescript
   * const installed = await GitService.checkGitInstalled()
   * if (!installed) {
   *   throw new Error('Git not found. Please install git.')
   * }
   * ```
   */
  static async checkGitInstalled(): Promise<boolean> {
    try {
      await execAsync('git --version', { timeout: GIT_BRANCH_TIMEOUT })
      return true
    } catch (error) {
      const execError = error as ExecError
      // Exit code 127 = command not found (shell)
      if (execError.code === 127) {
        return false
      }
      // For other errors (permission denied, timeout, etc.), throw
      throw error
    }
  }

  /**
   * Ensures git is installed, throwing a standard error if not.
   *
   * This is a convenience wrapper around checkGitInstalled() that throws
   * the standard error message specified in AC 3.
   *
   * @throws GitError if git is not installed
   *
   * @see Story 8.1: AC 3 - Detect missing git dependency
   *
   * @example
   * ```typescript
   * await GitService.ensureGitInstalled()
   * // Now safe to use git operations
   * ```
   */
  static async ensureGitInstalled(): Promise<void> {
    const installed = await this.checkGitInstalled()
    if (!installed) {
      throw new GitError(
        'Git not found. Please install git.',
        'git --version'
      )
    }
  }

  /**
   * Checks if a path is a valid git repository.
   *
   * @param path - Path to check
   * @returns true if path is a git repository, false otherwise
   * @throws GitError if path is invalid or does not exist
   *
   * @see Story 8.1: AC 4 - Detect missing .git folder
   *
   * @example
   * ```typescript
   * const isRepo = await GitService.isGitRepository('/path/to/project')
   * if (!isRepo) {
   *   throw new Error('Not a git repository')
   * }
   * ```
   */
  static async isGitRepository(path: string): Promise<boolean> {
    this.validatePath(path, 'isGitRepository')

    const normalizedPath = resolve(path)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Path does not exist: ${normalizedPath}`,
        'isGitRepository'
      )
    }

    try {
      // Use git rev-parse to check if we're in a git repo
      await this.execGit(['rev-parse', '--is-inside-work-tree'], normalizedPath, GIT_BRANCH_TIMEOUT)
      return true
    } catch {
      // If git rev-parse fails, it's not a git repository
      return false
    }
  }

  /**
   * Ensures a path is a git repository, throwing a standard error if not.
   *
   * This is a convenience wrapper around isGitRepository() that throws
   * the standard error message specified in AC 4.
   *
   * @param path - Path to check
   * @throws GitError if path is not a git repository, invalid, or does not exist
   *
   * @see Story 8.1: AC 4 - Detect missing .git folder
   *
   * @example
   * ```typescript
   * await GitService.ensureGitRepository('/path/to/project')
   * // Now safe to perform git operations
   * ```
   */
  static async ensureGitRepository(path: string): Promise<void> {
    const isRepo = await this.isGitRepository(path)
    if (!isRepo) {
      throw new GitError(
        'Not a git repository',
        'git rev-parse --is-inside-work-tree'
      )
    }
  }

  /**
   * Ensures .tinsu/worktrees/ is added to .gitignore for the project.
   *
   * This must be called before any worktree operations to prevent
   * tracking worktree contents in git.
   *
   * @param projectPath - Path to the project root
   * @throws GitError if path is invalid or does not exist
   *
   * @see Story 8.1: AC 6 - Add worktrees to gitignore
   *
   * @example
   * ```typescript
   * await GitService.ensureWorktreesIgnored('/path/to/project')
   * // Now safe to create worktrees in .tinsu/worktrees/
   * ```
   */
  static async ensureWorktreesIgnored(projectPath: string): Promise<void> {
    this.validatePath(projectPath, 'ensureWorktreesIgnored')

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Project path does not exist: ${normalizedPath}`,
        'ensureWorktreesIgnored'
      )
    }

    // AC 6: Only proceed if .tinsu/ folder exists
    const tinsuPath = join(normalizedPath, '.tinsu')
    if (!existsSync(tinsuPath)) {
      // .tinsu/ doesn't exist yet, nothing to ignore
      return
    }

    const gitignorePath = join(normalizedPath, '.gitignore')
    const worktreePattern = '.tinsu/worktrees/'

    if (existsSync(gitignorePath)) {
      // Read existing .gitignore
      const content = readFileSync(gitignorePath, 'utf-8')

      // Check if pattern already exists
      if (content.includes(worktreePattern)) {
        return // Already present, nothing to do
      }

      // Append pattern with proper formatting
      const newContent = content.endsWith('\n')
        ? `\n# TinSu worktrees (auto-generated)\n${worktreePattern}\n`
        : `\n\n# TinSu worktrees (auto-generated)\n${worktreePattern}\n`

      appendFileSync(gitignorePath, newContent)
    } else {
      // Create new .gitignore with the pattern
      writeFileSync(
        gitignorePath,
        `# TinSu worktrees (auto-generated)\n${worktreePattern}\n`
      )
    }
  }
  /**
   * Gets the diff for a repository, including both staged and unstaged changes.
   *
   * @param repoPath - Path to the git repository
   * @returns Parsed diff result with files and summary
   * @throws GitError if git command fails (e.g., not a git repository)
   *
   * @example
   * ```typescript
   * const diff = await GitService.getDiff('/path/to/repo')
   * console.log(`${diff.summary.filesChanged} files changed`)
   * ```
   */
  static async getDiff(repoPath: string): Promise<GitDiffResult> {
    // Validate path using shared validation logic
    this.validatePath(repoPath, 'getDiff')

    // Resolve to absolute path and normalize
    const normalizedPath = resolve(repoPath)

    // Verify path exists
    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Repository path does not exist: ${normalizedPath}`,
        'getDiff'
      )
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
      const err = error as ExecError
      // Re-throw as GitError with command context
      throw new GitError(
        err.stderr || err.message || 'Failed to get git diff',
        'git diff HEAD',
        err.code,
        err.stderr
      )
    }
  }

  /**
   * Result of creating a worktree, including both path and branch name.
   *
   * @see Story 8.3: Updated createWorktree signature
   */
  // Note: WorktreeResult interface is defined inline to avoid export issues

  /**
   * Creates a git worktree for isolated task execution.
   *
   * @param projectPath - Path to the main git repository
   * @param taskId - Unique task identifier
   * @param taskTitle - Optional task title for descriptive branch naming (Story 8.3)
   * @returns Object containing worktreePath and branchName
   * @throws GitError if worktree creation fails
   *
   * @see Story 8.2: AC 1, 2, 4, 5, 6
   * @see Story 8.3: AC 1, 2, 3, 4 - Descriptive branch naming
   *
   * @example
   * ```typescript
   * const result = await GitService.createWorktree('/path/to/project', 'task-123', 'Add User Auth')
   * // Returns: { worktreePath: '/path/to/project/.tinsu/worktrees/task-123', branchName: 'tinsu/story-task-123-add-user-auth' }
   * ```
   */
  static async createWorktree(
    projectPath: string,
    taskId: string,
    taskTitle?: string
  ): Promise<{ worktreePath: string; branchName: string }> {
    this.validatePath(projectPath, 'createWorktree')

    // Validate taskId - should not contain dangerous characters
    if (!taskId || typeof taskId !== 'string') {
      throw new GitError('Invalid taskId: taskId must be a non-empty string', 'createWorktree')
    }

    if (DANGEROUS_CHARS.test(taskId)) {
      throw new GitError('Invalid taskId: contains dangerous characters', 'createWorktree')
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'createWorktree')
    }

    // Story 8.2 AC 5: Worktree path convention: .tinsu/worktrees/{task-id}/
    const worktreePath = join(normalizedPath, '.tinsu', 'worktrees', taskId)

    try {
      // Create worktree directory structure if it doesn't exist
      const worktreesDir = dirname(worktreePath)
      if (!existsSync(worktreesDir)) {
        mkdirSync(worktreesDir, { recursive: true })
      }

      // Ensure .tinsu/worktrees/ is gitignored (Story 8.1 AC 6)
      // Note: Must be called AFTER creating .tinsu/ directory so ensureWorktreesIgnored can detect it
      await this.ensureWorktreesIgnored(normalizedPath)

      // Story 8.3: Generate descriptive branch name using task title
      // Falls back to simple task/{taskId} if no title provided (backward compatibility)
      let branchName: string
      if (taskTitle) {
        const baseBranchName = this.generateBranchName(taskId, taskTitle)
        // Ensure branch name is unique (Story 8.3 AC 4)
        branchName = await this.getUniqueBranchName(normalizedPath, baseBranchName)
      } else {
        // Backward compatibility: use simple naming if no title
        branchName = `task/${taskId}`
      }

      // Story 8.2 AC 4: Create git worktree with a new branch based on HEAD
      await this.execGit(
        ['worktree', 'add', worktreePath, '-b', branchName, 'HEAD'],
        normalizedPath,
        GIT_LARGE_OP_TIMEOUT
      )

      return { worktreePath, branchName }
    } catch (error) {
      // Story 8.2 AC 6: Cleanup on failure - remove partial worktree (NFR12)
      if (existsSync(worktreePath)) {
        try {
          rmSync(worktreePath, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors - best effort
        }
      }

      // Try to prune stale worktree references
      try {
        await this.execGit(['worktree', 'prune'], normalizedPath, GIT_BRANCH_TIMEOUT)
      } catch {
        // Ignore prune errors - best effort
      }

      // Re-throw the original error
      if (error instanceof GitError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(
        `Failed to create worktree: ${errorMessage}`,
        'git worktree add',
        undefined,
        errorMessage
      )
    }
  }

  /**
   * Checks if a worktree exists for a given task.
   *
   * @param projectPath - Path to the main git repository
   * @param taskId - Unique task identifier
   * @returns true if worktree exists, false otherwise
   * @throws GitError if path is invalid
   *
   * @see Story 8.2: AC 3
   *
   * @example
   * ```typescript
   * const exists = await GitService.hasWorktree('/path/to/project', 'task-123')
   * if (exists) {
   *   console.log('Worktree already exists, reusing')
   * }
   * ```
   */
  static async hasWorktree(projectPath: string, taskId: string): Promise<boolean> {
    this.validatePath(projectPath, 'hasWorktree')

    if (!taskId || typeof taskId !== 'string') {
      throw new GitError('Invalid taskId: taskId must be a non-empty string', 'hasWorktree')
    }

    const normalizedPath = resolve(projectPath)
    const worktreePath = join(normalizedPath, '.tinsu', 'worktrees', taskId)

    // First check if directory exists on filesystem
    if (!existsSync(worktreePath)) {
      return false
    }

    // Verify it's a valid git worktree by checking with git worktree list
    try {
      const { stdout } = await this.execGit(['worktree', 'list'], normalizedPath, GIT_BRANCH_TIMEOUT)
      // Check if our worktree path appears in the list
      return stdout.includes(worktreePath)
    } catch {
      // If git command fails, fall back to filesystem check only
      return existsSync(worktreePath)
    }
  }

  /**
   * Gets the path to an existing worktree for a task.
   *
   * @param projectPath - Path to the main git repository
   * @param taskId - Unique task identifier
   * @returns Worktree path if it exists, null otherwise
   * @throws GitError if path is invalid
   *
   * @example
   * ```typescript
   * const path = await GitService.getWorktreePath('/path/to/project', 'task-123')
   * if (path) {
   *   // Use existing worktree
   * }
   * ```
   */
  static async getWorktreePath(projectPath: string, taskId: string): Promise<string | null> {
    this.validatePath(projectPath, 'getWorktreePath')

    if (!taskId || typeof taskId !== 'string') {
      throw new GitError('Invalid taskId: taskId must be a non-empty string', 'getWorktreePath')
    }

    const normalizedPath = resolve(projectPath)
    const worktreePath = join(normalizedPath, '.tinsu', 'worktrees', taskId)

    const exists = await this.hasWorktree(projectPath, taskId)
    return exists ? worktreePath : null
  }

  /**
   * Gets the current branch name from a worktree directory.
   *
   * @param worktreePath - Path to the git worktree
   * @returns Branch name if worktree exists and has a branch, null otherwise
   * @throws GitError if path is invalid
   *
   * @see Story 8.3: AC 5 - Retrieve branch name for display in task details
   *
   * @example
   * ```typescript
   * const branchName = await GitService.getBranchNameFromWorktree('/path/to/.tinsu/worktrees/task-123')
   * // Returns: 'tinsu/story-task-123-add-user-auth'
   * ```
   */
  static async getBranchNameFromWorktree(worktreePath: string): Promise<string | null> {
    this.validatePath(worktreePath, 'getBranchNameFromWorktree')

    const normalizedPath = resolve(worktreePath)

    if (!existsSync(normalizedPath)) {
      return null
    }

    try {
      // Get the current branch name from the worktree
      const { stdout } = await this.execGit(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        normalizedPath,
        GIT_BRANCH_TIMEOUT
      )
      const branchName = stdout.trim()

      // HEAD means detached state, no branch name
      if (branchName === 'HEAD') {
        return null
      }

      return branchName
    } catch {
      // If git command fails, return null (worktree may be invalid)
      return null
    }
  }

  /**
   * Generates a URL-safe slug from a title string.
   *
   * @param title - The title to convert to a slug
   * @returns A lowercase, hyphen-separated slug suitable for git branch names
   *
   * @see Story 8.3: AC 2, 3 - Slug generation rules
   *
   * @example
   * ```typescript
   * GitService.generateSlug('Add User Authentication') // 'add-user-authentication'
   * GitService.generateSlug("Fix the 'Login' Bug!") // 'fix-the-login-bug'
   * ```
   */
  static generateSlug(title: string): string {
    if (!title || typeof title !== 'string') {
      return 'untitled'
    }

    let slug = title
      // Convert to lowercase
      .toLowerCase()
      // Remove invalid git branch characters
      .replace(INVALID_BRANCH_CHARS, '')
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove any remaining non-alphanumeric characters except hyphens
      .replace(/[^a-z0-9-]/g, '')
      // Collapse multiple consecutive hyphens into one
      .replace(/-+/g, '-')
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, '')

    // Handle empty result (title was only special characters)
    if (!slug) {
      return 'untitled'
    }

    // Truncate to max length at word boundary when possible
    if (slug.length > MAX_SLUG_LENGTH) {
      // Find the last hyphen within the max length
      const truncated = slug.substring(0, MAX_SLUG_LENGTH)
      const lastHyphen = truncated.lastIndexOf('-')

      // If there's a hyphen in a reasonable position (at least half the length), use it
      if (lastHyphen > MAX_SLUG_LENGTH / 2) {
        slug = truncated.substring(0, lastHyphen)
      } else {
        // Otherwise just truncate at max length
        slug = truncated
      }

      // Remove trailing hyphen if present
      slug = slug.replace(/-+$/, '')
    }

    return slug
  }

  /**
   * Generates a branch name following the convention: tinsu/story-{taskId}-{slug}
   *
   * @param taskId - The unique task identifier
   * @param taskTitle - The task title to generate slug from
   * @returns A valid git branch name
   *
   * @see Story 8.3: AC 1, 2 - Branch naming pattern
   *
   * @example
   * ```typescript
   * GitService.generateBranchName('abc123', 'Add User Authentication')
   * // Returns: 'tinsu/story-abc123-add-user-authentication'
   * ```
   */
  static generateBranchName(taskId: string, taskTitle: string): string {
    if (!taskId || typeof taskId !== 'string') {
      throw new GitError(
        'Invalid taskId: taskId must be a non-empty string',
        'generateBranchName'
      )
    }

    const slug = this.generateSlug(taskTitle)
    return `tinsu/story-${taskId}-${slug}`
  }

  /**
   * Checks if a branch exists in the repository.
   *
   * @param projectPath - Path to the git repository
   * @param branchName - The branch name to check
   * @returns true if branch exists, false otherwise
   *
   * @see Story 8.3: AC 4 - Branch uniqueness check
   *
   * @example
   * ```typescript
   * const exists = await GitService.branchExists('/path/to/project', 'tinsu/story-abc123-add-user-auth')
   * ```
   */
  static async branchExists(projectPath: string, branchName: string): Promise<boolean> {
    this.validatePath(projectPath, 'branchExists')

    if (!branchName || typeof branchName !== 'string') {
      throw new GitError(
        'Invalid branchName: branchName must be a non-empty string',
        'branchExists'
      )
    }

    const normalizedPath = resolve(projectPath)

    try {
      // Use git show-ref --verify to check if branch exists
      await this.execGit(
        ['show-ref', '--verify', `refs/heads/${branchName}`],
        normalizedPath,
        GIT_BRANCH_TIMEOUT
      )
      return true
    } catch {
      // Branch doesn't exist (git show-ref exits with non-zero when ref not found)
      return false
    }
  }

  /**
   * Gets a unique branch name by appending a suffix if the base name already exists.
   *
   * @param projectPath - Path to the git repository
   * @param baseName - The base branch name to check
   * @returns A unique branch name (original or with -2, -3, etc. suffix)
   *
   * @see Story 8.3: AC 4 - Branch uniqueness guarantee
   *
   * @example
   * ```typescript
   * // If 'tinsu/story-abc123-add-auth' exists:
   * const unique = await GitService.getUniqueBranchName('/path', 'tinsu/story-abc123-add-auth')
   * // Returns: 'tinsu/story-abc123-add-auth-2'
   * ```
   */
  static async getUniqueBranchName(projectPath: string, baseName: string): Promise<string> {
    this.validatePath(projectPath, 'getUniqueBranchName')

    if (!baseName || typeof baseName !== 'string') {
      throw new GitError(
        'Invalid baseName: baseName must be a non-empty string',
        'getUniqueBranchName'
      )
    }

    let candidate = baseName
    let suffix = 1

    while (await this.branchExists(projectPath, candidate)) {
      suffix++
      candidate = `${baseName}-${suffix}`
    }

    return candidate
  }

/**
   * Gets the diff for a specific commit (historical diff for completed tasks).
   *
   * This is used to view what changed in a completed task after its worktree
   * has been cleaned up. The diff is retrieved from the merge commit SHA.
   *
   * @param projectPath - Path to the git repository
   * @param commitSha - The commit SHA to get the diff for
   * @returns Parsed diff result with files and summary
   * @throws GitError if commit doesn't exist or git command fails
   *
   * @see Story 8.5: AC 6 - Historical diff for done tasks
   *
   * @example
   * ```typescript
   * const diff = await GitService.getHistoricalDiff('/path/to/repo', 'abc123def')
   * console.log(`Task changed ${diff.summary.filesChanged} files`)
   * ```
   */
  static async getHistoricalDiff(projectPath: string, commitSha: string): Promise<GitDiffResult> {
    this.validatePath(projectPath, 'getHistoricalDiff')

    if (!commitSha || typeof commitSha !== 'string') {
      throw new GitError('Invalid commitSha: commitSha must be a non-empty string', 'getHistoricalDiff')
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Repository path does not exist: ${normalizedPath}`,
        'getHistoricalDiff'
      )
    }

    try {
      // Story 8.5 AC 6: Get the diff that was introduced by a specific commit
      // Using --format='' to suppress commit metadata, only show the patch
      const { stdout: diffOutput } = await this.execGit(
        ['show', commitSha, '--format=', '--patch'],
        normalizedPath,
        GIT_LARGE_OP_TIMEOUT
      )

      // Story 8.5 Task 4.3: Parse using existing parseDiff() method
      return this.parseDiff(diffOutput)
    } catch (error) {
      const err = error as ExecError
      throw new GitError(
        err.stderr || err.message || `Failed to get diff for commit ${commitSha}`,
        `git show ${commitSha}`,
        err.code,
        err.stderr
      )
    }
  }

  /**
   * Compares a commit with the current HEAD to see what changed since then.
   *
   * This is useful for viewing what happened to a task's changes after completion.
   * Shows files that were modified between the task's merge commit and current HEAD.
   *
   * @param projectPath - Path to the git repository
   * @param commitSha - The commit SHA to compare against HEAD
   * @returns Parsed diff result with files and summary, plus metadata about ancestor status
   * @throws GitError if commit doesn't exist or git command fails
   *
   * @see Story 8.11: AC 5 - Compare with current feature
   *
   * @example
   * ```typescript
   * const result = await GitService.compareWithHead('/path/to/repo', 'abc123def')
   * if (result.isAncestor && result.files.length === 0) {
   *   console.log('No changes since this commit')
   * } else {
   *   console.log(`${result.summary.filesChanged} files changed since this commit`)
   * }
   * ```
   */
  static async compareWithHead(
    projectPath: string,
    commitSha: string
  ): Promise<GitDiffResult & { isAncestor: boolean }> {
    this.validatePath(projectPath, 'compareWithHead')

    if (!commitSha || typeof commitSha !== 'string') {
      throw new GitError('Invalid commitSha: commitSha must be a non-empty string', 'compareWithHead')
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Repository path does not exist: ${normalizedPath}`,
        'compareWithHead'
      )
    }

    try {
      // Story 8.11 Task 4.5: Check if commit is ancestor of HEAD
      let isAncestor = false
      try {
        await this.execGit(
          ['merge-base', '--is-ancestor', commitSha, 'HEAD'],
          normalizedPath,
          GIT_BRANCH_TIMEOUT
        )
        isAncestor = true
      } catch {
        // Not an ancestor - commit may have been rebased or on different branch
        isAncestor = false
      }

      // Story 8.11 Task 4.2: Get diff between commit and HEAD
      const { stdout: diffOutput } = await this.execGit(
        ['diff', `${commitSha}..HEAD`, '--unified=3'],
        normalizedPath,
        GIT_LARGE_OP_TIMEOUT
      )

      // Parse the diff
      const diffResult = this.parseDiff(diffOutput)

      return {
        ...diffResult,
        isAncestor
      }
    } catch (error) {
      const err = error as ExecError
      throw new GitError(
        err.stderr || err.message || `Failed to compare ${commitSha} with HEAD`,
        `git diff ${commitSha}..HEAD`,
        err.code,
        err.stderr
      )
    }
  }

  /**
   * Get commit information for a specific commit SHA.
   *
   * Returns metadata about a commit including SHA, message, author, and date.
   * Used by historical diff views to display commit context.
   *
   * @param projectPath - Path to the git repository
   * @param commitSha - The commit SHA to get info for
   * @returns Commit information object
   * @throws GitError if commit not found or git operation fails
   *
   * @see Story 8.11: Historical Diff View - AC 4 (commit header)
   *
   * @example
   * ```typescript
   * const info = await GitService.getCommitInfo('/path/to/project', 'abc123def')
   * console.log(`${info.author}: ${info.message}`)
   * ```
   */
  static async getCommitInfo(
    projectPath: string,
    commitSha: string
  ): Promise<{
    sha: string
    message?: string
    author?: string
    date?: string
  }> {
    this.validatePath(projectPath, 'getCommitInfo')

    if (!commitSha || typeof commitSha !== 'string') {
      throw new GitError('Invalid commitSha: commitSha must be a non-empty string', 'getCommitInfo')
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Repository path does not exist: ${normalizedPath}`,
        'getCommitInfo'
      )
    }

    try {
      // Story 8.11: Get commit info using git show
      // Format: %H|%s|%an|%aI (full sha, subject, author name, author date ISO)
      const { stdout: output } = await this.execGit(
        ['show', '-s', '--format=%H|%s|%an|%aI', commitSha],
        normalizedPath,
        GIT_COMMAND_TIMEOUT
      )

      const trimmedOutput = output.trim()
      const [sha, message, author, date] = trimmedOutput.split('|')

      // Validate we got expected output structure
      if (!sha) {
        throw new GitError(
          `Invalid git show output format for commit ${commitSha}`,
          `git show -s --format=%H|%s|%an|%aI ${commitSha}`
        )
      }

      return {
        sha: sha.trim(),
        message: message?.trim() || undefined,
        author: author?.trim() || undefined,
        date: date?.trim() || undefined
      }
    } catch (error) {
      const err = error as ExecError

      // Handle unknown commit SHA
      if (err.stderr?.includes('unknown revision') || err.stderr?.includes('bad object')) {
        throw new GitError(
          `Commit not found: ${commitSha}`,
          `git show -s ${commitSha}`,
          err.code,
          err.stderr
        )
      }

      throw new GitError(
        err.stderr || err.message || `Failed to get commit info for ${commitSha}`,
        `git show -s ${commitSha}`,
        err.code,
        err.stderr
      )
    }
  }

  /**
   * Merges a worktree branch to main when a task is approved.
   *
   * @param projectPath - Path to the main git repository
   * @param branchName - The branch name to merge
   * @param taskId - Unique task identifier for commit message
   * @param taskTitle - Task title for commit message
   * @returns MergeResult with merge status and commit SHA
   * @throws GitError if merge fails for non-conflict reasons
   *
   * @see Story 8.5: AC 1, 2, 3, 4, 5
   *
   * @example
   * ```typescript
   * const result = await GitService.mergeWorktree('/path/to/project', 'tinsu/story-123-auth', '123', 'Add Auth')
   * if (result.success) {
   *   console.log(`Merged with commit: ${result.commitSha}`)
   * } else {
   *   console.log(`Conflicts in: ${result.conflictFiles}`)
   * }
   * ```
   */
  static async mergeWorktree(
    projectPath: string,
    branchName: string,
    taskId: string,
    taskTitle: string
  ): Promise<MergeResult> {
    this.validatePath(projectPath, 'mergeWorktree')

    if (!branchName || typeof branchName !== 'string') {
      throw new GitError('Invalid branchName: branchName must be a non-empty string', 'mergeWorktree')
    }

    if (!taskId || typeof taskId !== 'string') {
      throw new GitError('Invalid taskId: taskId must be a non-empty string', 'mergeWorktree')
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'mergeWorktree')
    }

    try {
      // Story 8.5 AC 4: Checkout main branch first
      // We need to ensure we're on main to perform the merge
      await this.execGit(['checkout', 'main'], normalizedPath, GIT_COMMAND_TIMEOUT)

      // Pull latest changes (handle no remote gracefully - Story 8.5 Task 2.2)
      try {
        await this.execGit(['pull', '--ff-only'], normalizedPath, GIT_LARGE_OP_TIMEOUT)
      } catch (pullError) {
        // No remote or pull failed - continue with local main
        // This is expected for local-only repos
        console.log('[Story 8.5] Pull from remote skipped (no remote or pull failed) - merging onto local main')
      }

      // Story 8.5 AC 2: Attempt fast-forward merge first
      try {
        const ffResult = await this.execGit(
          ['merge', '--ff-only', branchName],
          normalizedPath,
          GIT_LARGE_OP_TIMEOUT
        )

        // Fast-forward succeeded - get the resulting commit SHA
        const { stdout: commitSha } = await this.execGit(
          ['rev-parse', 'HEAD'],
          normalizedPath,
          GIT_BRANCH_TIMEOUT
        )

        // Story 8.5 AC 5, 7: Fast-forward preserves all original commit attribution
        return {
          success: true,
          commitSha: commitSha.trim(),
          branchName,
          mergeType: 'fast-forward'
        }
      } catch (ffError) {
        // Fast-forward failed - try regular merge with commit message
        // This happens when main has advanced since worktree creation (AC 4)
      }

      // Story 8.5 AC 3, 4: Perform regular merge with commit message
      // AC 3 requires two-line format with task reference
      // Single quotes for shell escaping - no special chars to escape
      const commitMessage = `'Merge story ${taskId}: ${taskTitle}'`

      try {
        await this.execGit(
          ['merge', branchName, '-m', commitMessage],
          normalizedPath,
          GIT_LARGE_OP_TIMEOUT
        )

        // Merge succeeded - get the merge commit SHA
        const { stdout: commitSha } = await this.execGit(
          ['rev-parse', 'HEAD'],
          normalizedPath,
          GIT_BRANCH_TIMEOUT
        )

        return {
          success: true,
          commitSha: commitSha.trim(),
          branchName,
          mergeType: 'merge-commit'
        }
      } catch (mergeError) {
        // Story 8.5 AC 6: Handle merge conflicts by aborting and returning conflict info
        // Check if this is a merge conflict
        const err = mergeError as GitError

        // Try to get list of conflicted files
        try {
          const { stdout: conflictOutput } = await this.execGit(
            ['diff', '--name-only', '--diff-filter=U'],
            normalizedPath,
            GIT_BRANCH_TIMEOUT
          )

          const conflictFiles = conflictOutput.trim().split('\n').filter(Boolean)

          // Abort the merge to restore clean state
          try {
            await this.execGit(['merge', '--abort'], normalizedPath, GIT_BRANCH_TIMEOUT)
          } catch {
            // Abort failed - might not be in merge state
          }

          if (conflictFiles.length > 0) {
            return {
              success: false,
              commitSha: '',
              branchName,
              mergeType: 'merge-commit',
              conflictFiles
            }
          }
        } catch {
          // Couldn't get conflict list - abort and re-throw
          try {
            await this.execGit(['merge', '--abort'], normalizedPath, GIT_BRANCH_TIMEOUT)
          } catch {
            // Ignore abort errors
          }
        }

        // Re-throw non-conflict merge errors
        throw err
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(
        `Failed to merge worktree: ${errorMessage}`,
        'git merge',
        undefined,
        errorMessage
      )
    }
  }

  /**
   * Removes a worktree and deletes its associated branch.
   *
   * This is called after a successful merge to clean up resources.
   * The operation is best-effort: if worktree removal fails, it logs a warning
   * but still returns success. If branch deletion fails because it's not
   * fully merged, it logs a warning but still returns success.
   *
   * @param projectPath - Path to the main git repository
   * @param worktreePath - Path to the worktree to remove
   * @param branchName - Name of the branch to delete
   * @returns RemoveWorktreeResult with success status and details
   *
   * @see Story 8.6: AC 1, 2
   *
   * @example
   * ```typescript
   * const result = await GitService.removeWorktree(
   *   '/path/to/project',
   *   '/path/to/project/.tinsu/worktrees/task-123',
   *   'tinsu/story-task-123-feature'
   * )
   * if (result.success) {
   *   console.log('Worktree cleaned up successfully')
   * }
   * ```
   */
  static async removeWorktree(
    projectPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<RemoveWorktreeResult> {
    this.validatePath(projectPath, 'removeWorktree')
    this.validatePath(worktreePath, 'removeWorktree')

    if (!branchName || typeof branchName !== 'string') {
      throw new GitError(
        'Invalid branchName: branchName must be a non-empty string',
        'removeWorktree'
      )
    }

    const normalizedPath = resolve(projectPath)
    const normalizedWorktreePath = resolve(worktreePath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'removeWorktree')
    }

    let worktreeRemoved = false
    let branchDeleted = false
    const errors: string[] = []

    // Story 8.6 Task 1.5: Handle case where worktree doesn't exist gracefully
    if (!existsSync(normalizedWorktreePath)) {
      worktreeRemoved = true // Consider it already removed
    } else {
      // Story 8.6 Task 1.2: Remove worktree with --force to handle uncommitted changes
      try {
        await this.execGit(
          ['worktree', 'remove', normalizedWorktreePath, '--force'],
          normalizedPath,
          GIT_LARGE_OP_TIMEOUT
        )
        worktreeRemoved = true
      } catch (error) {
        // Try pruning stale worktree references first, then try again
        try {
          await this.execGit(['worktree', 'prune'], normalizedPath, GIT_BRANCH_TIMEOUT)
          // Check if worktree is actually gone now
          if (!existsSync(normalizedWorktreePath)) {
            worktreeRemoved = true
          } else {
            // Try one more time after prune
            try {
              await this.execGit(
                ['worktree', 'remove', normalizedWorktreePath, '--force'],
                normalizedPath,
                GIT_LARGE_OP_TIMEOUT
              )
              worktreeRemoved = true
            } catch (retryError) {
              const msg = retryError instanceof Error ? retryError.message : 'Unknown error'
              errors.push(`Failed to remove worktree: ${msg}`)
              // Best effort: try to remove the directory manually
              try {
                rmSync(normalizedWorktreePath, { recursive: true, force: true })
                await this.execGit(['worktree', 'prune'], normalizedPath, GIT_BRANCH_TIMEOUT)
                worktreeRemoved = true
              } catch {
                // Couldn't remove manually either
              }
            }
          }
        } catch {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to remove worktree: ${msg}`)
        }
      }
    }

    // Story 8.6 Task 1.3: Delete the merged branch with -d (not -D)
    // Using -d will fail if branch is not fully merged - that's expected behavior
    try {
      await this.execGit(
        ['branch', '-d', branchName],
        normalizedPath,
        GIT_BRANCH_TIMEOUT
      )
      branchDeleted = true
    } catch (error) {
      // Story 8.6 Task 1.6: Handle case where branch is not fully merged
      const msg = error instanceof Error ? error.message : 'Unknown error'
      if (msg.includes('not fully merged')) {
        // This is expected for unmerged branches - log warning but succeed
        console.warn(`[Story 8.6] Branch ${branchName} not fully merged, skipping deletion`)
      } else if (msg.includes('not found') || msg.includes('error: branch')) {
        // Branch doesn't exist - consider it already deleted
        branchDeleted = true
      } else {
        errors.push(`Failed to delete branch: ${msg}`)
      }
    }

    // Story 8.6: Return success if at least worktree was removed (best-effort cleanup)
    const success = worktreeRemoved
    return {
      success,
      worktreeRemoved,
      branchDeleted,
      error: errors.length > 0 ? errors.join('; ') : undefined
    }
  }

  /**
   * Lists orphaned worktrees - worktrees that exist on filesystem but have no
   * corresponding task in the database.
   *
   * @param projectPath - Path to the main git repository
   * @param activeWorktreePaths - Array of worktree paths that are still active (from tasks table)
   * @returns Array of OrphanedWorktree objects
   *
   * @see Story 8.6: AC 5
   *
   * @example
   * ```typescript
   * const orphaned = await GitService.listOrphanedWorktrees(
   *   '/path/to/project',
   *   ['/path/to/project/.tinsu/worktrees/task-123'] // Active worktree paths from DB
   * )
   * console.log(`Found ${orphaned.length} orphaned worktrees`)
   * ```
   */
  static async listOrphanedWorktrees(
    projectPath: string,
    activeWorktreePaths: string[]
  ): Promise<OrphanedWorktree[]> {
    this.validatePath(projectPath, 'listOrphanedWorktrees')

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'listOrphanedWorktrees')
    }

    const orphaned: OrphanedWorktree[] = []

    // Story 8.6 Task 4.2: Execute git worktree list --porcelain
    try {
      const { stdout } = await this.execGit(
        ['worktree', 'list', '--porcelain'],
        normalizedPath,
        GIT_COMMAND_TIMEOUT
      )

      // Parse porcelain output
      // Format:
      // worktree /path/to/worktree
      // HEAD abc123
      // branch refs/heads/branch-name
      // (blank line between entries)
      // OR "locked" if worktree is locked

      const entries = stdout.split('\n\n').filter(Boolean)
      const tinsuWorktreesDir = join(normalizedPath, '.tinsu', 'worktrees')

      for (const entry of entries) {
        const lines = entry.trim().split('\n')
        let worktreePath = ''
        let branchName = ''
        let isLocked = false

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            worktreePath = line.replace('worktree ', '')
          } else if (line.startsWith('branch ')) {
            // Format: branch refs/heads/branch-name
            branchName = line.replace('branch refs/heads/', '')
          } else if (line === 'locked') {
            isLocked = true
          }
        }

        // Story 8.6 Task 4.3, 4.4: Only consider worktrees in .tinsu/worktrees/ directory
        if (worktreePath && worktreePath.startsWith(tinsuWorktreesDir)) {
          // Check if this worktree is NOT in the active list
          const isActive = activeWorktreePaths.some(
            activePath => resolve(activePath) === resolve(worktreePath)
          )

          if (!isActive) {
            orphaned.push({
              path: worktreePath,
              branchName: branchName || 'unknown',
              isLocked
            })
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(`Failed to list worktrees: ${msg}`, 'git worktree list')
    }

    return orphaned
  }

  /**
   * Detects merge conflicts before attempting actual merge.
   *
   * Uses `git merge --no-commit --no-ff` to test if a merge would succeed,
   * then immediately aborts to restore clean state. This allows checking
   * for conflicts without affecting the repository.
   *
   * @param projectPath - Path to the main git repository
   * @param branchName - The branch name to test merging
   * @returns ConflictDetectionResult with conflict status and file list
   * @throws GitError if branch doesn't exist or path is invalid
   *
   * @see Story 8.7: AC 1, 2, 4
   *
   * @example
   * ```typescript
   * const result = await GitService.detectMergeConflicts('/path/to/project', 'feature-branch')
   * if (result.hasConflicts) {
   *   console.log(`Conflicts in: ${result.conflictFiles.join(', ')}`)
   * }
   * ```
   */
  static async detectMergeConflicts(
    projectPath: string,
    branchName: string
  ): Promise<ConflictDetectionResult> {
    this.validatePath(projectPath, 'detectMergeConflicts')

    if (!branchName || typeof branchName !== 'string') {
      throw new GitError(
        'Invalid branchName: branchName must be a non-empty string',
        'detectMergeConflicts'
      )
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'detectMergeConflicts')
    }

    // Story 8.7 Task 1.7: Check if branch exists first
    const branchExistsCheck = await this.branchExists(projectPath, branchName)
    if (!branchExistsCheck) {
      throw new GitError(
        `Branch '${branchName}' does not exist`,
        `git show-ref --verify refs/heads/${branchName}`
      )
    }

    try {
      // Ensure we're on main branch before testing merge
      await this.execGit(['checkout', 'main'], normalizedPath, GIT_COMMAND_TIMEOUT)

      // Story 8.7 AC 4, Task 1.2: Test merge with --no-commit --no-ff
      try {
        await this.execGit(
          ['merge', '--no-commit', '--no-ff', branchName],
          normalizedPath,
          GIT_LARGE_OP_TIMEOUT
        )

        // Story 8.7 Task 1.3: Merge succeeded (no conflicts) - abort to restore clean state
        try {
          await this.execGit(['merge', '--abort'], normalizedPath, GIT_BRANCH_TIMEOUT)
        } catch {
          // If abort fails, try reset to restore state
          try {
            await this.execGit(['reset', '--hard', 'HEAD'], normalizedPath, GIT_COMMAND_TIMEOUT)
          } catch {
            // Ignore reset errors
          }
        }

        // Story 8.7 Task 1.6: Return no conflicts
        return {
          hasConflicts: false,
          conflictFiles: []
        }
      } catch (mergeError) {
        // Merge failed - likely conflicts
        // Story 8.7 Task 1.4: Get list of conflicting files
        let conflictFiles: string[] = []
        try {
          const { stdout } = await this.execGit(
            ['diff', '--name-only', '--diff-filter=U'],
            normalizedPath,
            GIT_BRANCH_TIMEOUT
          )
          conflictFiles = stdout.trim().split('\n').filter(Boolean)
        } catch {
          // Couldn't get conflict list - continue with empty list
        }

        // Story 8.7 Task 1.5: Always abort to restore clean state
        try {
          await this.execGit(['merge', '--abort'], normalizedPath, GIT_BRANCH_TIMEOUT)
        } catch {
          // If abort fails, try reset
          try {
            await this.execGit(['reset', '--hard', 'HEAD'], normalizedPath, GIT_COMMAND_TIMEOUT)
          } catch {
            // Ignore reset errors
          }
        }

        // Story 8.7 Task 1.6: Return conflict result if we found conflict files
        if (conflictFiles.length > 0) {
          return {
            hasConflicts: true,
            conflictFiles
          }
        }

        // If merge failed but no conflicts detected, it's a different error
        const err = mergeError as GitError
        throw new GitError(
          `Merge test failed: ${err.message}`,
          'git merge --no-commit --no-ff',
          err.exitCode,
          err.stderr
        )
      }
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(
        `Failed to detect merge conflicts: ${errorMessage}`,
        'detectMergeConflicts',
        undefined,
        errorMessage
      )
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

  /**
   * Stage a file for commit.
   *
   * Runs `git add <filePath>` in the specified repository/worktree.
   *
   * @param repoPath - Path to the repository or worktree
   * @param filePath - Relative path to the file to stage
   * @throws GitError if staging fails
   *
   * @see Story 8.8: AC 4 - Stage resolved files
   *
   * @example
   * ```typescript
   * await GitService.stageFile('/path/to/worktree', 'src/main.ts')
   * ```
   */
  static async stageFile(repoPath: string, filePath: string): Promise<void> {
    this.validatePath(repoPath, 'stageFile')

    if (!filePath || typeof filePath !== 'string') {
      throw new GitError('Invalid filePath: filePath must be a non-empty string', 'stageFile')
    }

    // Validate filePath doesn't contain dangerous characters
    if (/[;&|`$<>]/.test(filePath)) {
      throw new GitError('Invalid filePath: contains dangerous characters', 'stageFile')
    }

    const normalizedPath = resolve(repoPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Repository path does not exist: ${normalizedPath}`, 'stageFile')
    }

    try {
      await this.execGit(['add', filePath], normalizedPath, GIT_COMMAND_TIMEOUT)
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(`Failed to stage file: ${errorMessage}`, 'git add', undefined, errorMessage)
    }
  }

  /**
   * Complete a merge commit after resolving conflicts.
   *
   * Runs `git commit --no-edit` to finish a merge that was started
   * with `git merge --no-commit`. Git auto-generates the merge message.
   *
   * @param repoPath - Path to the repository or worktree
   * @throws GitError if commit fails
   *
   * @see Story 8.8: AC 4 - Complete merge after resolution
   *
   * @example
   * ```typescript
   * await GitService.completeMergeCommit('/path/to/worktree')
   * ```
   */
  static async completeMergeCommit(repoPath: string): Promise<void> {
    this.validatePath(repoPath, 'completeMergeCommit')

    const normalizedPath = resolve(repoPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(
        `Repository path does not exist: ${normalizedPath}`,
        'completeMergeCommit'
      )
    }

    try {
      // Stage all changes (in case any were missed)
      await this.execGit(['add', '.'], normalizedPath, GIT_COMMAND_TIMEOUT)

      // Complete the merge commit - Git auto-generates merge message
      await this.execGit(['commit', '--no-edit'], normalizedPath, GIT_LARGE_OP_TIMEOUT)
    } catch (error) {
      if (error instanceof GitError) {
        // Check if it's "nothing to commit" which can happen if already committed
        if (error.stderr?.includes('nothing to commit')) {
          // Not an error - merge was already completed
          return
        }
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(
        `Failed to complete merge commit: ${errorMessage}`,
        'git commit',
        undefined,
        errorMessage
      )
    }
  }

  /**
   * Result of getting branch status for a worktree.
   *
   * @see Story 8.9: AC 2, 3
   */
  // Interface is inline with the return type to avoid export complexity

  /**
   * Gets the status of a branch compared to main.
   *
   * Compares a branch to main to determine:
   * - How many commits the branch is ahead of main
   * - How many commits the branch is behind main
   * - Whether there are uncommitted changes in the worktree
   *
   * @param projectPath - Path to the main git repository
   * @param branchName - The branch name to compare
   * @param worktreePath - Optional path to the worktree (for uncommitted changes check)
   * @returns BranchStatus with commitsAhead, commitsBehind, hasUncommittedChanges
   * @throws GitError if branch doesn't exist or path is invalid
   *
   * @see Story 8.9: AC 2, 3 - Branch comparison for status indicators
   *
   * @example
   * ```typescript
   * const status = await GitService.getBranchStatus('/path/to/project', 'feature-branch', '/path/to/worktree')
   * if (status.commitsBehind > 0) {
   *   console.log(`Branch is ${status.commitsBehind} commits behind main`)
   * }
   * ```
   */
  static async getBranchStatus(
    projectPath: string,
    branchName: string,
    worktreePath?: string
  ): Promise<{ commitsAhead: number; commitsBehind: number; hasUncommittedChanges: boolean }> {
    this.validatePath(projectPath, 'getBranchStatus')

    if (!branchName || typeof branchName !== 'string') {
      throw new GitError(
        'Invalid branchName: branchName must be a non-empty string',
        'getBranchStatus'
      )
    }

    const normalizedPath = resolve(projectPath)

    if (!existsSync(normalizedPath)) {
      throw new GitError(`Project path does not exist: ${normalizedPath}`, 'getBranchStatus')
    }

    let commitsAhead = 0
    let commitsBehind = 0
    let hasUncommittedChanges = false

    try {
      // Story 8.9 Task 3.2: Get commits ahead (commits on branch not on main)
      // git rev-list --count main..{branch}
      // TODO: Detect default branch instead of hardcoding "main" (Code Review 2026-01-22)
      // Repos with master/develop/trunk will silently fail and return 0
      try {
        const { stdout: aheadOutput } = await this.execGit(
          ['rev-list', '--count', `main..${branchName}`],
          normalizedPath,
          GIT_BRANCH_TIMEOUT
        )
        commitsAhead = parseInt(aheadOutput.trim(), 10) || 0
      } catch (error) {
        // Branch may not exist or no common ancestor - default to 0
        console.warn(
          `[GitService] Failed to get commits ahead for branch ${branchName}:`,
          error instanceof Error ? error.message : error
        )
        commitsAhead = 0
      }

      // Story 8.9 Task 3.3: Get commits behind (commits on main not on branch)
      // git rev-list --count {branch}..main
      try {
        const { stdout: behindOutput } = await this.execGit(
          ['rev-list', '--count', `${branchName}..main`],
          normalizedPath,
          GIT_BRANCH_TIMEOUT
        )
        commitsBehind = parseInt(behindOutput.trim(), 10) || 0
      } catch (error) {
        // Default to 0 on error
        console.warn(
          `[GitService] Failed to get commits behind for branch ${branchName}:`,
          error instanceof Error ? error.message : error
        )
        commitsBehind = 0
      }

      // Story 8.9 Task 3.4: Check for uncommitted changes in worktree
      if (worktreePath) {
        const normalizedWorktreePath = resolve(worktreePath)
        if (existsSync(normalizedWorktreePath)) {
          try {
            // git status --porcelain returns empty if clean
            const { stdout: statusOutput } = await this.execGit(
              ['status', '--porcelain'],
              normalizedWorktreePath,
              GIT_BRANCH_TIMEOUT
            )
            hasUncommittedChanges = statusOutput.trim().length > 0
          } catch {
            // Default to false on error
            hasUncommittedChanges = false
          }
        }
      }

      // Story 8.9 Task 3.5: Return BranchStatus
      return {
        commitsAhead,
        commitsBehind,
        hasUncommittedChanges
      }
    } catch (error) {
      // Story 8.9 Task 3.6: Handle case where worktree doesn't exist - return defaults
      if (error instanceof GitError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new GitError(
        `Failed to get branch status: ${errorMessage}`,
        'getBranchStatus',
        undefined,
        errorMessage
      )
    }
  }

  /**
   * Auto-commits uncommitted changes in a worktree with a WIP message.
   *
   * This is called when an agent finishes to preserve its work.
   * If there are uncommitted changes, they are staged and committed
   * with the message "WIP: Agent changes".
   *
   * @param worktreePath - Path to the worktree directory
   * @returns Object with committed flag and optional commitSha
   * @throws GitError if worktree is invalid
   *
   * @see Story 8.9: AC 3 - Auto-commit when agent finishes
   *
   * @example
   * ```typescript
   * const result = await GitService.autoCommitWorktreeChanges('/path/to/worktree')
   * if (result.committed) {
   *   console.log(`Auto-committed changes: ${result.commitSha}`)
   * }
   * ```
   */
  static async autoCommitWorktreeChanges(
    worktreePath: string
  ): Promise<{ committed: boolean; commitSha?: string }> {
    this.validatePath(worktreePath, 'autoCommitWorktreeChanges')

    const normalizedPath = resolve(worktreePath)

    if (!existsSync(normalizedPath)) {
      // Story 8.9 Task 4.5: Handle case where nothing to commit
      return { committed: false }
    }

    try {
      // Story 8.9 Task 4.2: Check for uncommitted changes
      const { stdout: statusOutput } = await this.execGit(
        ['status', '--porcelain'],
        normalizedPath,
        GIT_BRANCH_TIMEOUT
      )

      // Story 8.9 Task 4.5: If no changes, return committed: false
      if (!statusOutput.trim()) {
        return { committed: false }
      }

      // Story 8.9 Task 4.3: Stage all changes and commit with WIP message
      // Using -A to include all changes (new, modified, deleted)
      await this.execGit(['add', '-A'], normalizedPath, GIT_COMMAND_TIMEOUT)

      // Note: Single quotes are shell escaping - the actual commit message will be "WIP: Agent changes"
      await this.execGit(
        ['commit', '-m', "'WIP: Agent changes'"],
        normalizedPath,
        GIT_LARGE_OP_TIMEOUT
      )

      // Story 8.9 Task 4.4: Get the commit SHA
      const { stdout: commitSha } = await this.execGit(
        ['rev-parse', 'HEAD'],
        normalizedPath,
        GIT_BRANCH_TIMEOUT
      )

      return {
        committed: true,
        commitSha: commitSha.trim()
      }
    } catch (error) {
      // If commit failed (e.g., nothing to commit after all), return false
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's a "nothing to commit" error
      if (errorMessage.includes('nothing to commit')) {
        return { committed: false }
      }

      throw new GitError(
        `Failed to auto-commit changes: ${errorMessage}`,
        'autoCommitWorktreeChanges',
        undefined,
        errorMessage
      )
    }
  }
}
