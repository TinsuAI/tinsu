import { create } from 'zustand'

/**
 * Store for managing the full-screen task workspace navigation.
 *
 * Controls navigation between the Kanban board and task workspace,
 * with support for scroll restoration when returning to the board.
 *
 * Story TES-3.1: Task Workspace Navigation
 *
 * Replaces: useTaskDetailPanelStore (slide-over panel approach)
 */
interface TaskWorkspaceState {
  /** ID of the task currently being viewed in the workspace */
  activeTaskId: string | null
  /** Task ID to scroll to when returning to the board (for scroll restoration) */
  returnTaskId: string | null
}

interface TaskWorkspaceActions {
  /** Open the full-screen workspace for a task */
  openWorkspace: (taskId: string) => void
  /** Close the workspace and return to the board (triggers scroll restoration) */
  closeWorkspace: () => void
  /** Clear the returnTaskId after scroll restoration is complete */
  clearReturnTaskId: () => void
}

export const useTaskWorkspaceStore = create<TaskWorkspaceState & TaskWorkspaceActions>()(
  (set, get) => ({
    // Initial state
    activeTaskId: null,
    returnTaskId: null,

    // Actions
    openWorkspace: (taskId: string) => {
      set({ activeTaskId: taskId, returnTaskId: null })
    },

    closeWorkspace: () => {
      const { activeTaskId } = get()
      // Set returnTaskId for scroll restoration
      set({
        activeTaskId: null,
        returnTaskId: activeTaskId
      })
    },

    clearReturnTaskId: () => {
      set({ returnTaskId: null })
    }
  })
)
