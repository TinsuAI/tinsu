/**
 * Git Log Service - Story 8.10
 *
 * Service for detailed git operation logging.
 * Stores logs in `.tinsu/git-logs/` for debugging.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * @see Story 8.10: AC 1, Task 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Structure of a git log entry.
 *
 * @see Story 8.10: Task 6.1
 */
export interface GitLogEntry {
  /** ISO timestamp */
  timestamp: string
  /** Type of operation */
  operationType: string
  /** Associated task ID */
  taskId?: string
  /** Status: started, succeeded, failed */
  status: 'started' | 'succeeded' | 'failed'
  /** Command that was executed */
  command?: string
  /** Exit code if available */
  exitCode?: number
  /** Duration in milliseconds */
  durationMs?: number
  /** Error message if failed */
  error?: string
  /** Additional details */
  details?: Record<string, unknown>
}

/**
 * Service for logging git operations to files for debugging.
 *
 * Logs are stored in `.tinsu/git-logs/` with daily rotation.
 * Old logs are automatically cleaned up after 7 days.
 *
 * @see Story 8.10: Task 6.2
 */
export class GitLogService {
  private static LOG_DIR_NAME = 'git-logs'
  private static MAX_LOG_AGE_DAYS = 7

  /**
   * Gets the path to the git logs directory for a project.
   *
   * @param projectPath - Path to the project root
   * @returns Path to the git-logs directory
   */
  static getLogDir(projectPath: string): string {
    return join(projectPath, '.tinsu', this.LOG_DIR_NAME)
  }

  /**
   * Gets the path to today's log file.
   *
   * @param projectPath - Path to the project root
   * @returns Path to today's log file
   */
  private static getTodayLogPath(projectPath: string): string {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return join(this.getLogDir(projectPath), `git-${today}.log`)
  }

  /**
   * Ensures the git-logs directory exists.
   *
   * @param projectPath - Path to the project root
   */
  private static ensureLogDir(projectPath: string): void {
    const logDir = this.getLogDir(projectPath)
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
  }

  /**
   * Logs a git operation entry.
   *
   * @param projectPath - Path to the project root
   * @param entry - Log entry to write
   *
   * @see Story 8.10: Task 6.3
   *
   * @example
   * ```typescript
   * GitLogService.log('/project', {
   *   timestamp: new Date().toISOString(),
   *   operationType: 'createWorktree',
   *   taskId: 'abc123',
   *   status: 'started',
   *   command: 'git worktree add ...'
   * })
   * ```
   */
  static log(projectPath: string, entry: GitLogEntry): void {
    try {
      this.ensureLogDir(projectPath)

      const logPath = this.getTodayLogPath(projectPath)
      const logLine = JSON.stringify(entry) + '\n'

      appendFileSync(logPath, logLine, 'utf-8')
    } catch (error) {
      // Log to console if file logging fails
      console.warn(
        `[GitLogService] Failed to write log: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Logs the start of a git operation.
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of operation
   * @param taskId - Optional task ID
   * @param command - Command being executed
   * @param details - Additional details
   */
  static logStart(
    projectPath: string,
    operationType: string,
    taskId?: string,
    command?: string,
    details?: Record<string, unknown>
  ): void {
    this.log(projectPath, {
      timestamp: new Date().toISOString(),
      operationType,
      taskId,
      status: 'started',
      command,
      details
    })
  }

  /**
   * Logs the successful completion of a git operation.
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of operation
   * @param taskId - Optional task ID
   * @param durationMs - Duration in milliseconds
   * @param details - Additional details
   */
  static logSuccess(
    projectPath: string,
    operationType: string,
    taskId?: string,
    durationMs?: number,
    details?: Record<string, unknown>
  ): void {
    this.log(projectPath, {
      timestamp: new Date().toISOString(),
      operationType,
      taskId,
      status: 'succeeded',
      durationMs,
      details
    })
  }

  /**
   * Logs the failure of a git operation.
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of operation
   * @param taskId - Optional task ID
   * @param error - Error message
   * @param exitCode - Exit code if available
   * @param command - Command that failed
   * @param durationMs - Duration in milliseconds
   */
  static logFailure(
    projectPath: string,
    operationType: string,
    taskId: string | undefined,
    error: string,
    exitCode?: number,
    command?: string,
    durationMs?: number
  ): void {
    this.log(projectPath, {
      timestamp: new Date().toISOString(),
      operationType,
      taskId,
      status: 'failed',
      error,
      exitCode,
      command,
      durationMs
    })
  }

  /**
   * Reads log entries from a specific date.
   *
   * @param projectPath - Path to the project root
   * @param date - Date string in YYYY-MM-DD format
   * @returns Array of log entries
   *
   * @see Story 8.10: Task 6.4
   */
  static readLogs(projectPath: string, date?: string): GitLogEntry[] {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const logPath = join(this.getLogDir(projectPath), `git-${targetDate}.log`)

    if (!existsSync(logPath)) {
      return []
    }

    try {
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      return lines.map((line) => {
        try {
          return JSON.parse(line) as GitLogEntry
        } catch {
          return null
        }
      }).filter((entry): entry is GitLogEntry => entry !== null)
    } catch (error) {
      console.warn(
        `[GitLogService] Failed to read logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return []
    }
  }

  /**
   * Lists available log files.
   *
   * @param projectPath - Path to the project root
   * @returns Array of date strings (YYYY-MM-DD) for available logs
   */
  static listLogDates(projectPath: string): string[] {
    const logDir = this.getLogDir(projectPath)

    if (!existsSync(logDir)) {
      return []
    }

    try {
      const files = readdirSync(logDir)
      return files
        .filter((f) => f.startsWith('git-') && f.endsWith('.log'))
        .map((f) => f.replace('git-', '').replace('.log', ''))
        .sort()
        .reverse() // Most recent first
    } catch {
      return []
    }
  }

  /**
   * Cleans up old log files (older than MAX_LOG_AGE_DAYS).
   *
   * @param projectPath - Path to the project root
   *
   * @see Story 8.10: Task 6.5
   */
  static cleanupOldLogs(projectPath: string): void {
    const logDir = this.getLogDir(projectPath)

    if (!existsSync(logDir)) {
      return
    }

    const maxAgeMs = this.MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000
    const now = Date.now()

    try {
      const files = readdirSync(logDir)

      for (const file of files) {
        if (!file.startsWith('git-') || !file.endsWith('.log')) {
          continue
        }

        const filePath = join(logDir, file)
        const stats = statSync(filePath)
        const age = now - stats.mtime.getTime()

        if (age > maxAgeMs) {
          try {
            unlinkSync(filePath)
            console.log(`[GitLogService] Cleaned up old log: ${file}`)
          } catch (error) {
            console.warn(`[GitLogService] Failed to delete old log ${file}: ${error}`)
          }
        }
      }
    } catch (error) {
      console.warn(
        `[GitLogService] Failed to cleanup logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Gets the total size of all log files.
   *
   * @param projectPath - Path to the project root
   * @returns Total size in bytes
   */
  static getLogsSize(projectPath: string): number {
    const logDir = this.getLogDir(projectPath)

    if (!existsSync(logDir)) {
      return 0
    }

    try {
      const files = readdirSync(logDir)
      let totalSize = 0

      for (const file of files) {
        if (file.startsWith('git-') && file.endsWith('.log')) {
          const filePath = join(logDir, file)
          const stats = statSync(filePath)
          totalSize += stats.size
        }
      }

      return totalSize
    } catch {
      return 0
    }
  }
}
