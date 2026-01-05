import { z } from 'zod'
import { dialog, BrowserWindow } from 'electron'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ProjectService, ProjectError, ProjectInfo } from '../../services/project.service'

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
  })
})
