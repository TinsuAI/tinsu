import { db } from '../db'
import { ProjectService } from '../services/project.service'
import type { CreateContextOptions } from 'trpc-electron/main'

export interface Context {
  db: typeof db
  projectRoot: string
  projectId: string | null
}

export const createContext = async (_opts: CreateContextOptions): Promise<Context> => ({
  db,
  // Use TINSU_PROJECT_ROOT env for testing, otherwise use app's current working directory
  // TODO: In packaged Electron app, process.cwd() may return unpredictable paths.
  // Future: Derive projectRoot from opened project folder or use app.getPath('userData')
  projectRoot: process.env.TINSU_PROJECT_ROOT || process.cwd(),
  // Story 3.1.5: Include projectId from ProjectService for project-scoped queries
  projectId: ProjectService.getCurrentProjectId()
})
