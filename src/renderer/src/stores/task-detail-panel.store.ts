import { create } from 'zustand'

/**
 * Store for managing the task detail panel slide-over state.
 *
 * Controls the panel visibility, active task selection, and focus restoration.
 * Supports instant task switching (no animation) when panel is already open.
 *
 * Story TES-3.1: Task Detail Panel Container
 */
interface TaskDetailPanelState {
  /** Whether the panel is open/visible */
  isOpen: boolean
  /** ID of the task currently displayed in the panel */
  activeTaskId: string | null
  /** Previously focused element for focus restoration on close */
  previousFocusElement: HTMLElement | null
}

interface TaskDetailPanelActions {
  /** Open the panel with the specified task (triggers slide-in animation) */
  openPanel: (taskId: string) => void
  /** Close the panel (triggers slide-out animation and restores focus) */
  closePanel: () => void
  /** Switch to a different task without animation (panel already open) */
  switchTask: (taskId: string) => void
}

export const useTaskDetailPanelStore = create<TaskDetailPanelState & TaskDetailPanelActions>()(
  (set, get) => ({
    // Initial state
    isOpen: false,
    activeTaskId: null,
    previousFocusElement: null,

    // Actions
    openPanel: (taskId: string) => {
      // Capture current focus before opening
      const currentFocus = document.activeElement as HTMLElement | null
      set({
        isOpen: true,
        activeTaskId: taskId,
        previousFocusElement: currentFocus
      })
    },

    closePanel: () => {
      const { previousFocusElement } = get()
      set({
        isOpen: false,
        activeTaskId: null
      })
      // Restore focus after a brief delay to allow animation to start
      if (previousFocusElement) {
        setTimeout(() => {
          previousFocusElement.focus()
        }, 100)
      }
    },

    switchTask: (taskId: string) => {
      // Only update taskId - no animation, instant switch
      set({ activeTaskId: taskId })
    }
  })
)
