/**
 * Activity Event Emitter - TES-2.13
 *
 * Provides real-time activity event broadcasting to renderer process
 * via Electron IPC. Since trpc-electron doesn't support subscriptions,
 * this module bridges the gap using Electron's native IPC mechanism.
 *
 * @see TES-2.13: Real-Time Activity Streaming (AC: #4)
 * @see Architecture: EventEmitter pattern for activity broadcasts
 */

import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import type { TaskActivity } from '../db/schema'
import type { ActivityEventPayload } from '../../shared/types/activity.types'

/**
 * IPC channel name for activity events.
 * Must match the channel used in preload/index.ts and renderer hooks.
 */
export const ACTIVITY_EVENT_CHANNEL = 'activity-created'

/**
 * ActivityEventEmitter - broadcasts new activities to the renderer process.
 *
 * Uses both Node.js EventEmitter (for internal main process subscribers)
 * and Electron IPC (for renderer process subscribers).
 */
class ActivityEventEmitter extends EventEmitter {
  /**
   * Emit a new activity event.
   *
   * Broadcasts to both:
   * 1. Internal EventEmitter listeners (main process)
   * 2. All BrowserWindow webContents via IPC (renderer process)
   *
   * @param activity - The activity record that was just created
   */
  emitActivity(activity: TaskActivity): void {
    const payload: ActivityEventPayload = {
      taskId: activity.task_id,
      // Cast required because Drizzle schema defines event_type as generic string
      activity: activity as unknown as ActivityEventPayload['activity']
    }

    // Emit to internal listeners (EventEmitter pattern for main process)
    this.emit(`activity:${activity.task_id}`, activity)

    // Emit to all renderer windows via IPC
    const windows = BrowserWindow.getAllWindows()
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(ACTIVITY_EVENT_CHANNEL, payload)
      }
    }
  }
}

/**
 * Singleton instance of the activity event emitter.
 * Used by ActivityLogService to broadcast new activities.
 */
export const activityEmitter = new ActivityEventEmitter()
