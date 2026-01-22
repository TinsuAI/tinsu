/**
 * Git Error Recovery Service - Story 8.10
 *
 * Service for centralized git error handling and crash recovery.
 * Tracks git operation state to detect incomplete operations after app crashes
 * and provides recovery options.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * @see Story 8.10: AC 1, 2, 3, 4 - Error handling and crash recovery
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Represents the state of a git operation for crash recovery.
 *
 * @see Story 8.10: Task 1.2
 */
export interface GitOperationState {
  /** Type of git operation (e.g., 'createWorktree', 'merge', 'removeWorktree') */
  operationType: string
  /** Associated task ID, if any */
  taskId?: string
  /** Path to the worktree being operated on */
  worktreePath?: string
  /** Branch name being operated on */
  branchName?: string
  /** Unix timestamp when operation started */
  startedAt: number
  /** Unix timestamp when operation completed (null if pending/failed) */
  completedAt?: number
  /** Current status of the operation */
  status: 'pending' | 'completed' | 'failed'
  /** Error message if operation failed */
  error?: string
}

/**
 * Structure of the operations file stored on disk.
 */
interface OperationsFile {
  operations: GitOperationState[]
}

/**
 * Service for tracking git operations and supporting crash recovery.
 *
 * Stores operation state in `.tinsu/git-operations.json` which:
 * - Survives database corruption
 * - Is readable during crash recovery before DB init
 * - Uses simple atomic writes
 *
 * @see Story 8.10: AC 4 - Crash recovery detection
 */
export class GitErrorRecoveryService {
  /**
   * Gets the path to the operations file for a project.
   *
   * @param projectPath - Path to the project root
   * @returns Path to the git-operations.json file
   */
  static getOperationsFilePath(projectPath: string): string {
    return join(projectPath, '.tinsu', 'git-operations.json')
  }

  /**
   * Ensures the .tinsu directory exists.
   *
   * @param projectPath - Path to the project root
   */
  private static ensureTinsuDir(projectPath: string): void {
    const tinsuDir = join(projectPath, '.tinsu')
    if (!existsSync(tinsuDir)) {
      mkdirSync(tinsuDir, { recursive: true })
    }
  }

  /**
   * Reads operations from the file system.
   *
   * @param projectPath - Path to the project root
   * @returns Array of operation states, empty array if file doesn't exist
   */
  private static readOperations(projectPath: string): GitOperationState[] {
    const filePath = this.getOperationsFilePath(projectPath)

    if (!existsSync(filePath)) {
      return []
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const data: OperationsFile = JSON.parse(content)
      return data.operations || []
    } catch (error) {
      // If file is corrupted, return empty array
      console.warn(
        `[GitErrorRecoveryService] Failed to read operations file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return []
    }
  }

  /**
   * Writes operations to the file system.
   *
   * @param projectPath - Path to the project root
   * @param operations - Array of operation states to write
   */
  private static writeOperations(projectPath: string, operations: GitOperationState[]): void {
    this.ensureTinsuDir(projectPath)
    const filePath = this.getOperationsFilePath(projectPath)

    const data: OperationsFile = { operations }
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Records the start of a git operation.
   *
   * Call this before starting any git operation that could leave
   * the repository in an inconsistent state if interrupted.
   *
   * @param projectPath - Path to the project root
   * @param op - Operation state to record
   *
   * @see Story 8.10: Task 1.3
   *
   * @example
   * ```typescript
   * GitErrorRecoveryService.recordOperationStart('/path/to/project', {
   *   operationType: 'createWorktree',
   *   taskId: 'abc123',
   *   worktreePath: '/path/to/worktree',
   *   branchName: 'tinsu/story-abc123-feature',
   *   startedAt: Date.now(),
   *   status: 'pending'
   * })
   * ```
   */
  static recordOperationStart(projectPath: string, op: GitOperationState): void {
    const operations = this.readOperations(projectPath)

    // Ensure status is 'pending' for new operations
    const newOp: GitOperationState = {
      ...op,
      status: 'pending',
      startedAt: op.startedAt || Date.now()
    }

    operations.push(newOp)
    this.writeOperations(projectPath, operations)
  }

  /**
   * Records the successful completion of a git operation.
   *
   * Call this after a git operation completes successfully.
   * Removes the operation from the pending list.
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of the operation that completed
   * @param taskId - Optional task ID to match specific operation
   *
   * @see Story 8.10: Task 1.4
   *
   * @example
   * ```typescript
   * GitErrorRecoveryService.recordOperationComplete('/path/to/project', 'createWorktree', 'abc123')
   * ```
   */
  static recordOperationComplete(projectPath: string, operationType: string, taskId?: string): void {
    const operations = this.readOperations(projectPath)

    // Find and remove the matching pending operation
    const updatedOperations = operations.filter((op) => {
      // Match by operation type and optionally task ID
      const matches =
        op.operationType === operationType &&
        op.status === 'pending' &&
        (taskId === undefined || op.taskId === taskId)

      return !matches
    })

    this.writeOperations(projectPath, updatedOperations)
  }

  /**
   * Records the failure of a git operation.
   *
   * Call this when a git operation fails. Updates the operation
   * status to 'failed' with the error message.
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of the operation that failed
   * @param taskId - Optional task ID to match specific operation
   * @param error - Error message describing the failure
   *
   * @see Story 8.10: Task 1.5
   *
   * @example
   * ```typescript
   * GitErrorRecoveryService.recordOperationFailed('/path/to/project', 'merge', 'abc123', 'Merge conflict')
   * ```
   */
  static recordOperationFailed(
    projectPath: string,
    operationType: string,
    taskId: string | undefined,
    error: string
  ): void {
    const operations = this.readOperations(projectPath)

    // Find and update the matching pending operation
    const updatedOperations = operations.map((op) => {
      const matches =
        op.operationType === operationType &&
        op.status === 'pending' &&
        (taskId === undefined || op.taskId === taskId)

      if (matches) {
        return {
          ...op,
          status: 'failed' as const,
          completedAt: Date.now(),
          error
        }
      }

      return op
    })

    this.writeOperations(projectPath, updatedOperations)
  }

  /**
   * Gets all incomplete (pending) operations.
   *
   * Call this on app startup to detect operations that were
   * interrupted by a crash.
   *
   * @param projectPath - Path to the project root
   * @returns Array of pending operation states
   *
   * @see Story 8.10: Task 1.6, AC 4
   *
   * @example
   * ```typescript
   * const incompleteOps = GitErrorRecoveryService.getIncompleteOperations('/path/to/project')
   * if (incompleteOps.length > 0) {
   *   // Show recovery dialog
   * }
   * ```
   */
  static getIncompleteOperations(projectPath: string): GitOperationState[] {
    const operations = this.readOperations(projectPath)
    return operations.filter((op) => op.status === 'pending')
  }

  /**
   * Gets all failed operations.
   *
   * @param projectPath - Path to the project root
   * @returns Array of failed operation states
   */
  static getFailedOperations(projectPath: string): GitOperationState[] {
    const operations = this.readOperations(projectPath)
    return operations.filter((op) => op.status === 'failed')
  }

  /**
   * Removes a specific operation from tracking.
   *
   * Call this after user resolves an incomplete operation
   * (either by cleanup or by choosing to ignore).
   *
   * @param projectPath - Path to the project root
   * @param operationType - Type of operation to remove
   * @param taskId - Optional task ID to match specific operation
   *
   * @see Story 8.10: Task 5.5, 5.6
   */
  static removeOperation(projectPath: string, operationType: string, taskId?: string): void {
    const operations = this.readOperations(projectPath)

    const updatedOperations = operations.filter((op) => {
      const matches =
        op.operationType === operationType && (taskId === undefined || op.taskId === taskId)

      return !matches
    })

    this.writeOperations(projectPath, updatedOperations)
  }

  /**
   * Clears all operations (for testing or full reset).
   *
   * @param projectPath - Path to the project root
   */
  static clearAllOperations(projectPath: string): void {
    this.writeOperations(projectPath, [])
  }
}
