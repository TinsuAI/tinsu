import { db } from '../db'
import { ProjectService } from '../services/project.service'
import { activityLogService, hookListenerService } from '../services'
import type { CreateContextOptions } from 'trpc-electron/main'
import type { ActivityLogService } from '../services/activity-log.service'
import type { HookListenerService } from '../services/hook-listener.service'

export interface Context {
  db: typeof db
  projectRoot: string
  projectId: string | null
  /** TES-2.2: Activity log service instance */
  activityLogService: ActivityLogService
  /** TES-2.3: Hook listener service instance */
  hookListenerService: HookListenerService
}

export const createContext = async (_opts: CreateContextOptions): Promise<Context> => ({
  db,
  // Get projectRoot from currently open project (updated when switching projects)
  // Falls back to TINSU_PROJECT_ROOT env for testing, then process.cwd()
  projectRoot: ProjectService.getCurrentProject() || process.env.TINSU_PROJECT_ROOT || process.cwd(),
  // Story 3.1.5: Include projectId from ProjectService for project-scoped queries
  projectId: ProjectService.getCurrentProjectId(),
  // TES-2.2: Activity log service for activity operations
  activityLogService,
  // TES-2.3: Hook listener service for hook event reception
  hookListenerService
})
