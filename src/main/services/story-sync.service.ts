import { readFile, writeFile, stat } from 'fs/promises'
import { existsSync, constants } from 'fs'
import { access } from 'fs/promises'

/**
 * Custom error class for sync operations.
 * Story 3.9: Edge case handling (Task 13)
 */
export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: 'FILE_NOT_FOUND' | 'PERMISSION_DENIED' | 'FILE_LOCKED' | 'PARSE_ERROR'
  ) {
    super(message)
    this.name = 'SyncError'
  }
}

/**
 * Content parsed from a story markdown file.
 */
export interface StoryFileContent {
  /** Story status (e.g., 'ready-for-dev', 'in-progress', 'review', 'done') */
  status: string
  /** Story title extracted from the markdown header */
  title: string
  /** Full markdown content of the file */
  fullContent: string
  /** File modification timestamp in milliseconds */
  mtime: number
}

/**
 * Service for synchronizing story content between the database and markdown files.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 *
 * Story files are located in implementation-artifacts/ and follow this format:
 * ```markdown
 * # Story X.Y: Title
 *
 * Status: ready-for-dev
 *
 * ## Story
 * ...
 * ```
 */
export class StorySyncService {
  /**
   * Update the Status: line in a story markdown file.
   *
   * @param filePath - Absolute path to the story file
   * @param newStatus - New status value (e.g., 'in-progress', 'review', 'done')
   * @throws Error if file does not exist
   *
   * @example
   * ```typescript
   * await StorySyncService.updateStoryFileStatus(
   *   '/path/to/3-9-bidirectional-sync.md',
   *   'in-progress'
   * )
   * ```
   */
  static async updateStoryFileStatus(filePath: string, newStatus: string): Promise<void> {
    // Story 3.9 Task 13: Check file exists
    if (!existsSync(filePath)) {
      console.warn(`[StorySyncService] File not found: ${filePath}`)
      throw new SyncError(`Story file not found: ${filePath}`, 'FILE_NOT_FOUND')
    }

    // Story 3.9 Task 13: Check file is writable
    try {
      await access(filePath, constants.W_OK)
    } catch {
      console.warn(`[StorySyncService] No write permission: ${filePath}`)
      throw new SyncError(`Cannot write to story file (permission denied): ${filePath}`, 'PERMISSION_DENIED')
    }

    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
      console.log(`[StorySyncService] Read file for status update: ${filePath}`)
    } catch (error) {
      // Story 3.9 Task 13: Handle file locked / busy
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'EBUSY' || nodeError.code === 'ENOENT') {
        console.warn(`[StorySyncService] File locked or deleted: ${filePath}`, nodeError.code)
        throw new SyncError(`File is locked or was deleted: ${filePath}`, 'FILE_LOCKED')
      }
      throw error
    }

    // Match "Status: <value>" pattern (case insensitive)
    const statusRegex = /^(Status:\s*)(.+)$/im

    if (statusRegex.test(content)) {
      content = content.replace(statusRegex, `$1${newStatus}`)
    } else {
      // Insert Status after title if not found
      const titleRegex = /^(# .+\n)/m
      if (titleRegex.test(content)) {
        content = content.replace(titleRegex, `$1\nStatus: ${newStatus}\n`)
      } else {
        // If no title found, add at the beginning
        content = `Status: ${newStatus}\n\n${content}`
      }
    }

    try {
      await writeFile(filePath, content, 'utf-8')
      console.log(`[StorySyncService] Updated status to '${newStatus}' in: ${filePath}`)
    } catch (error) {
      // Story 3.9 Task 13: Handle write errors
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'EBUSY') {
        console.warn(`[StorySyncService] File locked during write: ${filePath}`)
        throw new SyncError(`File is locked and cannot be written: ${filePath}`, 'FILE_LOCKED')
      }
      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        console.warn(`[StorySyncService] Permission denied during write: ${filePath}`)
        throw new SyncError(`Cannot write to story file (permission denied): ${filePath}`, 'PERMISSION_DENIED')
      }
      throw error
    }
  }

  /**
   * Read and parse a story file.
   *
   * @param filePath - Absolute path to the story file
   * @returns Parsed story content including status, title, full content, and mtime
   * @throws Error if file does not exist
   *
   * @example
   * ```typescript
   * const content = await StorySyncService.readStoryFileContent(
   *   '/path/to/3-9-bidirectional-sync.md'
   * )
   * console.log(content.status) // 'ready-for-dev'
   * console.log(content.title)  // 'Bidirectional Sync'
   * ```
   */
  static async readStoryFileContent(filePath: string): Promise<StoryFileContent> {
    // Story 3.9 Task 13: Check file exists
    if (!existsSync(filePath)) {
      console.warn(`[StorySyncService] File not found for read: ${filePath}`)
      throw new SyncError(`Story file not found: ${filePath}`, 'FILE_NOT_FOUND')
    }

    let content: string
    let stats: Awaited<ReturnType<typeof stat>>

    try {
      content = await readFile(filePath, 'utf-8')
      stats = await stat(filePath)
      console.log(`[StorySyncService] Read file content: ${filePath}`)
    } catch (error) {
      // Story 3.9 Task 13: Handle read errors
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'EBUSY') {
        console.warn(`[StorySyncService] File locked during read: ${filePath}`)
        throw new SyncError(`File is locked: ${filePath}`, 'FILE_LOCKED')
      }
      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        console.warn(`[StorySyncService] Permission denied during read: ${filePath}`)
        throw new SyncError(`Cannot read story file (permission denied): ${filePath}`, 'PERMISSION_DENIED')
      }
      if (nodeError.code === 'ENOENT') {
        console.warn(`[StorySyncService] File was deleted during read: ${filePath}`)
        throw new SyncError(`Story file not found: ${filePath}`, 'FILE_NOT_FOUND')
      }
      throw error
    }

    // Extract status (case insensitive)
    const statusMatch = content.match(/^Status:\s*(.+)$/im)
    const status = statusMatch ? statusMatch[1].trim() : 'backlog'

    // Extract title from "# Story X.Y: Title" pattern
    const titleMatch = content.match(/^# Story \d+\.\d+: (.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Story 3.9 Task 13: Log parsed content for debugging
    console.log(`[StorySyncService] Parsed status='${status}', title='${title}' from: ${filePath}`)

    return {
      status,
      title,
      fullContent: content,
      mtime: stats.mtimeMs
    }
  }

  /**
   * Check if file has changed since a known modification time.
   * Uses mtime comparison for quick change detection.
   *
   * @param filePath - Absolute path to the story file
   * @param knownMtime - Previously known modification time in milliseconds
   * @returns true if file has been modified since knownMtime, false otherwise
   *
   * @example
   * ```typescript
   * const content = await StorySyncService.readStoryFileContent(filePath)
   * // Later...
   * const hasChanged = await StorySyncService.hasFileChanged(filePath, content.mtime)
   * ```
   */
  static async hasFileChanged(filePath: string, knownMtime: number): Promise<boolean> {
    if (!existsSync(filePath)) {
      // File deleted is not considered a "change" for sync purposes
      return false
    }

    const stats = await stat(filePath)
    return stats.mtimeMs > knownMtime
  }

  /**
   * Detect if file content differs from known content.
   * Use this when you need content comparison rather than just mtime check.
   *
   * @param filePath - Absolute path to the story file
   * @param knownContent - Previously known file content
   * @returns true if file content differs from knownContent, false otherwise
   *
   * @example
   * ```typescript
   * const task = await getTask(taskId)
   * const hasChanges = await StorySyncService.detectFileChanges(
   *   task.story_file_path,
   *   task.full_content
   * )
   * ```
   */
  static async detectFileChanges(filePath: string, knownContent: string): Promise<boolean> {
    if (!existsSync(filePath)) {
      // File doesn't exist, no changes to detect
      return false
    }

    try {
      const currentContent = await readFile(filePath, 'utf-8')
      return currentContent !== knownContent
    } catch {
      return false
    }
  }
}
