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
