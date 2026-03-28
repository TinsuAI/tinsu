import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import ignore from 'ignore'
import { dialog, BrowserWindow } from 'electron'
import { desc, eq } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ProjectService, ProjectError, ProjectInfo } from '../../services/project.service'
import { ToolVerificationService } from '../../services/tool-verification.service'
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

// --- Fuzzy file search ---

/** In-memory cache for git file list */
let fileListCache: { files: string[]; timestamp: number; projectRoot: string } | null = null
const FILE_LIST_CACHE_TTL = 30_000

function getProjectFileList(projectRoot: string): string[] {
  const now = Date.now()
  if (
    fileListCache &&
    fileListCache.projectRoot === projectRoot &&
    now - fileListCache.timestamp < FILE_LIST_CACHE_TTL
  ) {
    return fileListCache.files
  }

  try {
    const tracked = execSync('git ls-files', {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    })
      .trim()
      .split('\n')
      .filter(Boolean)

    const untracked = execSync('git ls-files --others --exclude-standard', {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024
    })
      .trim()
      .split('\n')
      .filter(Boolean)

    const allFiles = [...new Set([...tracked, ...untracked])]
    fileListCache = { files: allFiles, timestamp: now, projectRoot }
    return allFiles
  } catch {
    return []
  }
}

/**
 * Fuzzy match score. Returns null if no match, or a numeric score (higher = better).
 * Prefers: basename matches, word-boundary hits, consecutive chars, shorter paths.
 */
function fuzzyScore(query: string, filePath: string): number | null {
  const q = query.toLowerCase()
  const fullLower = filePath.toLowerCase()

  // Quick reject: all query chars must appear in order in the full path
  let qi = 0
  for (let i = 0; i < fullLower.length && qi < q.length; i++) {
    if (fullLower[i] === q[qi]) qi++
  }
  if (qi < q.length) return null

  const basename = path.basename(filePath)
  const basenameLower = basename.toLowerCase()
  let score = 0

  // Score against basename (most important)
  qi = 0
  let consecutive = 0
  let prevIdx = -2
  for (let i = 0; i < basenameLower.length && qi < q.length; i++) {
    if (basenameLower[i] === q[qi]) {
      qi++
      if (i === prevIdx + 1) {
        consecutive++
        score += 3 + consecutive
      } else {
        consecutive = 0
      }
      // Start of basename
      if (i === 0) score += 15
      // After separator: -, _, .
      else if ('-_.' .includes(basenameLower[i - 1])) score += 10
      // CamelCase boundary
      else if (
        basename[i] >= 'A' &&
        basename[i] <= 'Z' &&
        basename[i - 1] >= 'a' &&
        basename[i - 1] <= 'z'
      ) {
        score += 8
      }
      score += 1
      prevIdx = i
    }
  }

  // All query chars matched in basename → strong bonus
  if (qi === q.length) score += 25

  // Shorter paths preferred
  score -= filePath.split('/').length * 0.5

  return score
}

export function searchProjectFiles(
  projectRoot: string,
  query: string
): Array<{ name: string; relativePath: string; isDirectory: boolean }> {
  if (!query.trim()) return []

  const files = getProjectFileList(projectRoot)
  const scored: Array<{ file: string; score: number }> = []

  for (const file of files) {
    const s = fuzzyScore(query, file)
    if (s !== null) {
      scored.push({ file, score: s })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, MAX_FILE_RESULTS)

  return top.map((m) => ({
    name: path.basename(m.file),
    relativePath: m.file,
    isDirectory: false
  }))
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
    }),

  /** Fuzzy search across all project files (git-tracked + untracked non-ignored). */
  searchFiles: publicProcedure
    .input(z.object({ query: z.string().max(500).default('') }))
    .query(({ ctx, input }) => {
      return searchProjectFiles(ctx.projectRoot, input.query)
    }),

  /**
   * Verifies all required tools for project setup.
   * Returns status for git, tmux, Node.js, Claude CLI, and BMAD.
   */
  verifyTools: publicProcedure
    .input(z.object({ projectPath: z.string().min(1) }))
    .query(async ({ input }) => {
      return ToolVerificationService.verifyAllTools(input.projectPath)
    }),

  /**
   * Lightweight health check for critical tools only.
   * Used for background monitoring — does not check BMAD.
   */
  checkToolHealth: publicProcedure.query(async () => {
    return ToolVerificationService.verifyHealthTools()
  })
})
