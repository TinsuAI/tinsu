import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import ignore from 'ignore'
import { dialog, BrowserWindow } from 'electron'
import { desc, eq } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ProjectService, ProjectError, ProjectInfo } from '../../services/project.service'
import { db } from '../../db'
import { projects } from '../../db/schema'

/**
 * Dialog result type matching Electron's showOpenDialog return type.
 */
export interface DialogResult {
  canceled: boolean
  filePaths: string[]
}

/**
 * Dialog handler function type.
 * Allows injecting a mock dialog for testing.
 */
export type DialogHandler = () => Promise<DialogResult>

// Default dialog handler using Electron's dialog API
let dialogHandler: DialogHandler | null = null

/**
 * Sets a custom dialog handler for testing.
 * Pass null to restore the default Electron dialog behavior.
 */
export function setDialogHandler(handler: DialogHandler | null): void {
  dialogHandler = handler
}

/**
 * Opens the system file dialog to select a directory.
 * Uses the injected handler if available (for testing),
 * otherwise uses Electron's native dialog API.
 */
async function openDirectoryDialog(): Promise<DialogResult> {
  if (dialogHandler) {
    return dialogHandler()
  }

  // Use Electron's native dialog
  const window = BrowserWindow.getFocusedWindow()
  return dialog.showOpenDialog(window!, {
    properties: ['openDirectory'],
    title: 'Select Project Directory'
  })
}

/**
 * Converts ProjectError to TRPCError with appropriate code.
 */
function projectErrorToTRPCError(error: ProjectError): TRPCError {
  switch (error.code) {
    case 'NOT_GIT_REPO':
      return new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message,
        cause: error
      })
    case 'NOT_FOUND':
      return new TRPCError({
        code: 'NOT_FOUND',
        message: error.message,
        cause: error
      })
    case 'ALREADY_EXISTS':
    case 'GIT_INIT_FAILED':
      return new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message,
        cause: error
      })
    case 'ALREADY_OPEN':
    case 'INIT_ERROR':
    default:
      return new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message,
        cause: error
      })
  }
}

/** Always-ignored directories regardless of .gitignore */
const ALWAYS_IGNORED = ['node_modules', '.git', '.tinsu', '.DS_Store']

const MAX_FILE_RESULTS = 50

/**
 * List files/directories at a given prefix path within a project root.
 * Respects .gitignore and hardcoded ignores. Returns at most MAX_FILE_RESULTS entries.
 */
export function listProjectFiles(
  projectRoot: string,
  prefix: string
): Array<{ name: string; relativePath: string; isDirectory: boolean }> {
  try {
    // Build gitignore filter
    const ig = ignore()
    ig.add(ALWAYS_IGNORED)
    const gitignorePath = path.join(projectRoot, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      ig.add(content)
    }

    // Split prefix: "src/comp" → dir="src", filter="comp"
    // "src/" → dir="src", filter=""
    // "" → dir="", filter=""
    const normalized = prefix.replace(/\\/g, '/')
    const segments = normalized.split('/').filter((s) => s !== '')
    const hasTrailingSlash = normalized.endsWith('/')

    let dirSegments: string[]
    let filterStr: string

    if (hasTrailingSlash || segments.length === 0) {
      dirSegments = segments
      filterStr = ''
    } else {
      dirSegments = segments.slice(0, -1)
      filterStr = segments[segments.length - 1].toLowerCase()
    }

    const targetDir = path.join(projectRoot, ...dirSegments)
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return []
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
    const results: Array<{ name: string; relativePath: string; isDirectory: boolean }> = []

    for (const entry of entries) {
      if (results.length >= MAX_FILE_RESULTS) break

      // Filter by prefix
      if (filterStr && !entry.name.toLowerCase().startsWith(filterStr)) continue

      // Build relative path for gitignore check
      const relPath = path.join(...dirSegments, entry.name)
      const isDir = entry.isDirectory()

      // Check gitignore (add trailing slash for dirs per gitignore spec)
      if (ig.ignores(isDir ? relPath + '/' : relPath)) continue

      results.push({
        name: entry.name,
        relativePath: relPath,
        isDirectory: isDir
      })
    }

    // Sort: directories first, then alphabetical
    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return results
  } catch {
    return []
  }
}

export const projectRouter = router({
  /**
   * Opens a file dialog to select a project directory.
   * Validates it's a git repository and initializes TinSu if needed.
   *
   * Returns null if the dialog was cancelled.
   * Throws TRPCError if the selected directory is invalid.
   */
  open: publicProcedure.mutation(async (): Promise<ProjectInfo | null> => {
    // Open directory selection dialog
    const result = await openDirectoryDialog()

    // Check if cancelled
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = result.filePaths[0]

    try {
      // Open the project (validates git, initializes or loads existing)
      return await ProjectService.openProject(selectedPath)
    } catch (error) {
      if (error instanceof ProjectError) {
        throw projectErrorToTRPCError(error)
      }
      throw error
    }
  }),

  /**
   * Opens the system file dialog to select a parent directory for new project creation.
   * Returns the selected path or null if cancelled.
   */
  selectParentDirectory: publicProcedure.mutation(async (): Promise<{ canceled: boolean; path: string | null }> => {
    if (dialogHandler) {
      const result = await dialogHandler()
      return {
        canceled: result.canceled,
        path: result.canceled ? null : result.filePaths[0]
      }
    }

    const window = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(window!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Parent Folder'
    })
    return {
      canceled: result.canceled,
      path: result.canceled ? null : result.filePaths[0]
    }
  }),

  /**
   * Creates a new project from scratch.
   * Creates folder, initializes git, and completes TinSu initialization.
   */
  create: publicProcedure
    .input(z.object({
      parentDir: z.string().min(1, 'Parent directory is required'),
      projectName: z.string().min(1, 'Project name is required')
    }))
    .mutation(async ({ input }): Promise<ProjectInfo> => {
      try {
        return await ProjectService.createNewProject(input.parentDir, input.projectName)
      } catch (error) {
        if (error instanceof ProjectError) {
          throw projectErrorToTRPCError(error)
        }
        throw error
      }
    }),

  /**
   * Opens a project at a specific path (without dialog).
   * Useful for re-opening last project or testing.
   */
  openPath: publicProcedure
    .input(
      z.object({
        path: z.string().min(1, 'Path is required')
      })
    )
    .mutation(async ({ input }): Promise<ProjectInfo> => {
      try {
        return await ProjectService.openProject(input.path)
      } catch (error) {
        if (error instanceof ProjectError) {
          throw projectErrorToTRPCError(error)
        }
        throw error
      }
    }),

  /**
   * Gets the currently open project info.
   * Returns null if no project is open.
   */
  getCurrent: publicProcedure.query((): ProjectInfo | null => {
    return ProjectService.getProjectInfo()
  }),

  /**
   * Closes the current project.
   */
  close: publicProcedure.mutation((): void => {
    ProjectService.closeProject()
  }),

  /**
   * Gets recent projects sorted by last opened date.
   * Returns up to 10 most recently opened projects.
   */
  getRecent: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(20).default(10)
        })
        .optional()
    )
    .query(({ input }) => {
      const limit = input?.limit ?? 10
      return db.select().from(projects).orderBy(desc(projects.last_opened_at)).limit(limit).all()
    }),

  /**
   * Removes a project from the recent projects list (database).
   * Does not delete any files - only removes from TinSu's tracking.
   */
  remove: publicProcedure
    .input(
      z.object({
        id: z.string().min(1, 'Project ID is required')
      })
    )
    .mutation(({ input }) => {
      db.delete(projects).where(eq(projects.id, input.id)).run()
      return { success: true }
    }),

  /**
   * Validates if a project path still exists on the filesystem.
   * Used to show warning indicators for moved/deleted projects.
   */
  validatePath: publicProcedure
    .input(
      z.object({
        path: z.string()
      })
    )
    .query(({ input }) => {
      try {
        return fs.existsSync(input.path) && fs.statSync(input.path).isDirectory()
      } catch {
        return false
      }
    }),

  /**
   * List files and directories for chat input autocomplete.
   * Reads one directory level at a time based on the prefix path.
   * Respects .gitignore rules and filters out common non-project directories.
   */
  listFiles: publicProcedure
    .input(z.object({ prefix: z.string().max(500).default('') }))
    .query(({ ctx, input }) => {
      return listProjectFiles(ctx.projectRoot, input.prefix)
    })
})
