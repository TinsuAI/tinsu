/**
 * Main process services barrel export.
 * All services in this directory are main-process only.
 * NEVER import these directly in the renderer process.
 */

// Configuration service
export { ConfigService } from './config.service'
export type { ProjectConfig } from '../../shared/types/config.types'

// Project management service
export { ProjectService, ProjectError } from './project.service'
export type { ProjectInfo } from './project.service'

// PTY (pseudo-terminal) service for process management
export {
  PtyService,
  PtyError,
  ptyService,
  type PtySpawnOptions,
  type PtyProcess,
  type PtyOutputEvent,
  type PtyExitEvent,
  type PtyErrorEvent
} from './pty.service'

// tmux dependency detection service
export { TmuxService } from './tmux.service'

// Per-task terminal session management (TES-1.3)
export { TaskTerminalService } from './task-terminal.service'

// Stall detection service (TES-1.11)
export { StallDetectorService } from './stall-detector.service'

// Activity log service (TES-2.2)
import { db } from '../db'
import { ActivityLogService, setActivityLogServiceInstance } from './activity-log.service'

/** Singleton activity log service instance for database persistence */
export const activityLogService = new ActivityLogService(db)

// Set the singleton instance for backward-compatible static methods
setActivityLogServiceInstance(activityLogService)

export {
  ActivityLogService,
  setActivityLogServiceInstance,
  type ActivityEventType,
  type ActivityQueryOptions,
  type ActivityPayload,
  type SessionEndedPayload,
  type StallDetectedPayload,
  type StallRecoveredPayload
} from './activity-log.service'
