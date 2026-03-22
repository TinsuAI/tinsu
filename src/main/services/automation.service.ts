/**
 * Automation Service - TES-2.9, TES-5.x
 *
 * Handles workflow automation triggers for Story and Basic tasks.
 * Logs automation_trigger events when workflows are auto-executed.
 *
 * TES-2.9: Implements automation_trigger event logging
 * TES-5.x: Will implement full automation logic (future)
 *
 * Workflow state machine:
 *   Story Task:
 *     In Progress → createSession → sendCommand(dev-story prompt)
 *     dev-story complete (Stop hook) → updateStatus(review) → sendCommand('/code-review')
 *     code-review complete (Stop hook) → notifyUser('Ready for review')
 *
 *   Basic Task:
 *     In Progress → createSession → sendCommand(task description)
 *     agent complete (Stop hook) → updateStatus(review)
 *
 * @see TES-2.9: Automation Trigger Event Capture
 * @see TES-5.x: Workflow Automation Engine (future)
 */

import { ActivityLogService } from './activity-log.service'
import type { TaskType, SessionPhase } from '../db/schema'

/**
 * Payload for automation_trigger events.
 */
export interface AutomationTriggerPayload {
  /** The command that was auto-triggered */
  command: 'dev-story' | 'code-review'
  /** What caused the trigger */
  trigger: 'status-in-progress' | 'dev-story-complete'
}

/**
 * Automation Service
 *
 * Manages workflow automation triggers and logs automation events.
 *
 * Current implementation (TES-2.9):
 * - Logs automation_trigger events when workflows would be auto-triggered
 *
 * Future implementation (TES-5.x):
 * - Full automation logic for Story/Basic task workflows
 * - Integration with BmadAgentLauncherService
 * - Status transitions
 *
 * @see TES-2.9: Automation Trigger Event Capture
 */
export class AutomationService {
  /**
   * Handle status change to in_progress for Story tasks.
   *
   * TES-2.9: Logs automation_trigger event for dev-story auto-trigger.
   * TES-5.x: Will also trigger dev-story execution.
   *
   * @param taskId - The task ID that changed status
   * @param taskType - Type of task ('story' | 'basic' | 'planning')
   *
   * @example
   * ```typescript
   * // Called when task moves to in_progress
   * await AutomationService.onStatusInProgress(taskId, 'story')
   * ```
   */
  static async onStatusInProgress(taskId: string, taskType: TaskType | string): Promise<void> {
    // Only Story tasks trigger dev-story automation
    if (taskType !== 'story') {
      return
    }

    // TES-2.9: Log automation_trigger event for dev-story
    try {
      await ActivityLogService.logActivity(taskId, 'automation_trigger', {
        command: 'dev-story',
        trigger: 'status-in-progress'
      } as unknown as Record<string, unknown>)
    } catch (error) {
      console.warn('[AutomationService] Failed to log automation_trigger activity:', error)
      // Don't fail the automation - logging is non-critical
    }

    // TES-5.x (future): Actually trigger dev-story execution
    // await BmadAgentLauncherService.launchDevStory(taskId, ...)
  }

  /**
   * Handle agent completion (dev-story phase) for Story tasks.
   *
   * TES-2.9: Logs automation_trigger event for code-review auto-trigger.
   * TES-5.x: Will also transition status and trigger code-review.
   *
   * @param taskId - The task ID whose agent completed
   * @param phase - The workflow phase that completed (e.g., 'dev-story', 'code-review')
   *
   * @example
   * ```typescript
   * // Called when Stop hook fires for dev-story completion
   * await AutomationService.onAgentComplete(taskId, 'dev-story')
   * ```
   */
  static async onAgentComplete(taskId: string, phase: SessionPhase | string): Promise<void> {
    // Only dev-story completion triggers code-review automation
    if (phase !== 'dev-story') {
      return
    }

    // TES-2.9: Log automation_trigger event for code-review
    try {
      await ActivityLogService.logActivity(taskId, 'automation_trigger', {
        command: 'code-review',
        trigger: 'dev-story-complete'
      } as unknown as Record<string, unknown>)
    } catch (error) {
      console.warn('[AutomationService] Failed to log automation_trigger activity:', error)
      // Don't fail the automation - logging is non-critical
    }

    // TES-5.x (future): Actually trigger code-review execution
    // 1. Update task status to 'review'
    // 2. Send /code-review command to tmux session
  }
}

