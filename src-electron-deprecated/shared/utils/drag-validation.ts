import type { Task, TaskStatus } from '../types/task.types'
import { isImportedStoryTask } from '../types/task.types'

/**
 * Story 5.2c: Validate drag moves for story file requirements
 * Returns error message if blocked, undefined if allowed
 *
 * Validation rules:
 * - AC6: Imported story tasks with summary_only cannot go to in_progress/review/done
 * - AC8: Basic tasks (story tasks without story_number) cannot go to create_story
 */
export function validateDragMove(task: Task, targetStatus: TaskStatus): string | undefined {
  // AC8: Basic tasks (story tasks without story_number) cannot go to create_story
  // Story 5.3b AC4: Updated message to guide users to In Progress
  if (task.task_type === 'story' && !isImportedStoryTask(task) && targetStatus === 'create_story') {
    return 'Basic Tasks execute directly. Drag to In Progress instead.'
  }

  // AC6: Imported story tasks with summary_only cannot go to in_progress/review/done
  if (isImportedStoryTask(task) && task.story_file_status === 'summary_only') {
    const requiresStoryReady: TaskStatus[] = ['in_progress', 'review', 'done']
    if (requiresStoryReady.includes(targetStatus)) {
      return "Story file required. Move to 'Create Story' first."
    }
  }

  return undefined // Allow move
}
