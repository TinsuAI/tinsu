import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { join } from 'path'
import * as schema from '../db/schema'
import { DetailedStoryParserService } from './detailed-story-parser.service'

/**
 * Result returned when handling create-story workflow completion.
 */
export interface CreateStoryCompletionResult {
  /** Whether a story file was found and task was updated */
  success: boolean
  /** Path to the discovered story file, if found */
  storyFilePath: string | null
  /** Error message if operation failed */
  error?: string
}

/**
 * Service for handling workflow completion and updating task status.
 *
 * Story 5.3 - AC: 2: When create-story workflow completes, update task's
 * story_file_status to 'story_ready' and set story_file_path.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class StoryCompletionService {
  /**
   * Handles create-story workflow completion.
   *
   * Scans the implementation-artifacts directory for a newly created story file
   * matching the task's epic and story number, then updates the task with:
   * - story_file_status: 'story_ready'
   * - story_file_path: path to the discovered story file
   * - full_content: content of the story file
   *
   * @param db - Drizzle database instance
   * @param taskId - ID of the task that was being processed
   * @param projectRoot - Root path of the project
   * @returns Result indicating success or failure with details
   *
   * @example
   * ```typescript
   * const result = await StoryCompletionService.handleCreateStoryComplete(
   *   db,
   *   'task-123',
   *   '/path/to/project'
   * )
   * if (result.success) {
   *   console.log(`Story file created: ${result.storyFilePath}`)
   * }
   * ```
   */
  static async handleCreateStoryComplete(
    db: BetterSQLite3Database<typeof schema>,
    taskId: string,
    projectRoot: string
  ): Promise<CreateStoryCompletionResult> {
    // Get the task from database
    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get()

    if (!task) {
      return {
        success: false,
        storyFilePath: null,
        error: 'Task not found'
      }
    }

    // Validate task is a story task
    if (task.task_type !== 'story') {
      return {
        success: false,
        storyFilePath: null,
        error: 'Task is not a story task'
      }
    }

    // Get the epic to determine the epic number
    if (!task.epic_id) {
      return {
        success: false,
        storyFilePath: null,
        error: 'Task has no associated epic'
      }
    }

    const epic = db.select().from(schema.epics).where(eq(schema.epics.id, task.epic_id)).get()

    if (!epic || !epic.epic_number) {
      return {
        success: false,
        storyFilePath: null,
        error: 'Epic not found or has no epic number'
      }
    }

    // Get the story number
    if (!task.story_number) {
      return {
        success: false,
        storyFilePath: null,
        error: 'Task has no story number'
      }
    }

    // Scan implementation-artifacts for the story file
    // Expected path: {projectRoot}/_bmad-output/implementation-artifacts/
    const implementationArtifactsDir = join(projectRoot, '_bmad-output', 'implementation-artifacts')

    const storyFile = await DetailedStoryParserService.findStoryFile(
      implementationArtifactsDir,
      epic.epic_number,
      task.story_number.toString()
    )

    if (!storyFile) {
      // No story file found yet - this might be normal if the workflow is still running
      // or if the file hasn't been created yet
      return {
        success: false,
        storyFilePath: null,
        error: 'Story file not found in implementation-artifacts'
      }
    }

    // Update the task with the story file information
    db.update(schema.tasks)
      .set({
        story_file_status: 'story_ready',
        story_file_path: storyFile.filePath,
        full_content: storyFile.fullContent,
        updated_at: new Date()
      })
      .where(eq(schema.tasks.id, taskId))
      .run()

    return {
      success: true,
      storyFilePath: storyFile.filePath
    }
  }

  /**
   * Rescans for story file and updates task if found.
   *
   * This is a more aggressive scan that can be called after workflow
   * completion to ensure the task is updated even if the file was
   * created while the workflow was still running.
   *
   * @param db - Drizzle database instance
   * @param taskId - ID of the task to rescan
   * @param projectRoot - Root path of the project
   * @returns Result indicating success or failure
   */
  static async rescanAndUpdateTask(
    db: BetterSQLite3Database<typeof schema>,
    taskId: string,
    projectRoot: string
  ): Promise<CreateStoryCompletionResult> {
    return this.handleCreateStoryComplete(db, taskId, projectRoot)
  }
}
