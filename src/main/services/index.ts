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

// Tool verification service (onboarding wizard)
export { ToolVerificationService } from './tool-verification.service'

// Per-task terminal session management (TES-1.3)
export { TaskTerminalService } from './task-terminal.service'

// Stall detection service (TES-1.11)
export { StallDetectorService } from './stall-detector.service'

// Activity log service (TES-2.2)
import { db } from '../db'
import { ActivityLogService, setActivityLogServiceInstance } from './activity-log.service'

// Hook listener service (TES-2.3)
import { HookListenerService } from './hook-listener.service'

// Automation service (TES-2.9)
export { AutomationService } from './automation.service'

// Git service (TES-4.1)
export {
  GitService,
  type GitDiffResult,
  type GitDiffFile,
  type GitDiffHunk,
  type GitDiffLine
} from './git.service'

// Git error recovery service (Story 8.10)
export { GitErrorRecoveryService, type GitOperationState } from './git-error-recovery.service'

// Git log service (Story 8.10)
export { GitLogService, type GitLogEntry } from './git-log.service'

// Activity event emitter (TES-2.13)
export { activityEmitter, ACTIVITY_EVENT_CHANNEL } from './activity-emitter'
export type { ActivityEventPayload } from '../../shared/types/activity.types'

/** Singleton activity log service instance for database persistence */
export const activityLogService = new ActivityLogService(db as unknown as import('drizzle-orm/better-sqlite3').BetterSQLite3Database)

// Set the singleton instance for backward-compatible static methods
setActivityLogServiceInstance(activityLogService)

/** Singleton hook listener service instance for HTTP hook reception */
export const hookListenerService = new HookListenerService()

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

export {
  HookListenerService,
  StopHookPayloadSchema,
  ToolUseHookPayloadSchema,
  type StopHookPayload,
  type ToolUseHookPayload,
  type HealthResponse,
  type ChatSessionStatusData
} from './hook-listener.service'

// Persona context service for BMAD agent persona injection (Story 10.4)
export { PersonaContextService, type BmadProjectConfig } from './persona-context.service'

// Chat CLI service for managing Claude Code chat sessions (Story 10.3)
import { join } from 'path'
import { app } from 'electron'
import { chat_sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { ChatCliService } from './chat-cli.service'

/**
 * Resolve chat hooks directory path.
 * - Development: relative to project root (process.cwd()/src/main/resources/chat-hooks)
 * - Production (packaged): relative to process.resourcesPath (unpacked via extraResources)
 */
function getChatHooksDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'chat-hooks')
  }
  return join(process.cwd(), 'src', 'main', 'resources', 'chat-hooks')
}

const chatHooksDir = getChatHooksDir()

/** Singleton chat CLI service instance for managing chat PTY processes */
export const chatCliService = new ChatCliService(chatHooksDir)

// Wire up chatCliService reference for chat orphan UUID registration
hookListenerService.setChatCliService(chatCliService)

// Story 10.6 AC: 5 — Set idle callback to update DB status to 'paused' when sessions are auto-killed
chatCliService.setOnIdleCallback((sessionId: string) => {
  try {
    db.update(chat_sessions)
      .set({
        status: 'paused',
        updated_at: new Date()
      })
      .where(eq(chat_sessions.id, sessionId))
      .run()
    console.log(`[ChatCliService] Updated idle session ${sessionId} status to 'paused' in DB`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ChatCliService] Failed to update idle session ${sessionId} status: ${msg}`)
  }
  // Clean up any pending permission requests for the killed session
  hookListenerService.cleanupPendingPermissions(sessionId)
})

// CTM-1.1: Removed setOnResumeFailedCallback -- orphan/resume logic superseded by tmux persistence

/**
 * CTM-1.3: Initialize chat sessions by validating tmux session state on startup.
 *
 * Calls chatCliService.validateSessionsOnStartup() to detect alive/dead tmux sessions,
 * rebuild caches for alive ones, and mark dead ones as 'paused' in the DB.
 *
 * This call is async and non-blocking -- startup continues even if validation fails.
 * Same pattern as TaskTerminalService.validateSessionsOnStartup().
 *
 * @see CTM-1.3 AC 1: Startup validation
 * @see CTM-1.3 Task 5
 */
export function initializeChatSessions(): void {
  chatCliService.validateSessionsOnStartup().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[initializeChatSessions] Startup validation failed: ${msg}`)
  })
}

// CTM-1.3: Run startup validation immediately after chatCliService is wired up
initializeChatSessions()

export {
  ChatCliService,
  type ChatCliSessionInfo,
  type ChatCliSessionStatus
} from './chat-cli.service'
