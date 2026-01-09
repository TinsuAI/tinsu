import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { TaskStatus } from '@shared/types/task.types'

interface UIStore {
  // State
  sidebarCollapsed: boolean
  selectedSprintId: string | null // Story 2.5: Sprint filter
  selectedEpicIds: string[] // Story 2.6: Epic filter (multi-select, OR logic)
  selectedStatuses: TaskStatus[] // Story 2.6: Status filter (multi-select, OR logic)
  lastProjectPath: string | null // Story 2.6: Track project for filter scoping
  syncingTaskIds: string[] // Story 3.9: Track tasks currently syncing (AC: 5)

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setSelectedSprint: (id: string | null) => void // Story 2.5
  clearSprintFilter: () => void // Story 2.5

  // Story 2.6: Filter actions
  setSelectedEpics: (ids: string[]) => void
  setSelectedStatuses: (statuses: TaskStatus[]) => void
  toggleEpicFilter: (id: string) => void
  toggleStatusFilter: (status: TaskStatus) => void
  clearAllFilters: () => void
  hasActiveFilters: () => boolean
  syncProjectPath: (projectPath: string | null) => void // Clear filters if project changed

  // Story 3.9: Sync state actions (AC: 5)
  addSyncingTask: (taskId: string) => void
  removeSyncingTask: (taskId: string) => void
  isTaskSyncing: (taskId: string) => boolean
}

// Story 2.6: Persist filter state to localStorage
export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null,
      syncingTaskIds: [], // Story 3.9

      // Sidebar actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Story 2.5: Sprint filter actions
      setSelectedSprint: (id) => set({ selectedSprintId: id }),
      clearSprintFilter: () => set({ selectedSprintId: null }),

      // Story 2.6: Epic filter actions
      setSelectedEpics: (ids) => set({ selectedEpicIds: ids }),
      toggleEpicFilter: (id) =>
        set((state) => ({
          selectedEpicIds: state.selectedEpicIds.includes(id)
            ? state.selectedEpicIds.filter((epicId) => epicId !== id)
            : [...state.selectedEpicIds, id]
        })),

      // Story 2.6: Status filter actions
      setSelectedStatuses: (statuses) => set({ selectedStatuses: statuses }),
      toggleStatusFilter: (status) =>
        set((state) => ({
          selectedStatuses: state.selectedStatuses.includes(status)
            ? state.selectedStatuses.filter((s) => s !== status)
            : [...state.selectedStatuses, status]
        })),

      // Story 2.6: Clear all filters
      clearAllFilters: () =>
        set({
          selectedSprintId: null,
          selectedEpicIds: [],
          selectedStatuses: []
        }),

      // Story 2.6: Check if any filters are active
      // Note: All 4 statuses selected is equivalent to no filter
      hasActiveFilters: () => {
        const state = get()
        const hasStatusFilter =
          state.selectedStatuses.length > 0 && state.selectedStatuses.length < 4
        return (
          state.selectedSprintId !== null ||
          state.selectedEpicIds.length > 0 ||
          hasStatusFilter
        )
      },

      // Story 2.6: Sync project path and clear filters if project changed
      syncProjectPath: (projectPath) => {
        const state = get()
        if (state.lastProjectPath !== projectPath) {
          // Project changed - clear all filters and update path
          set({
            selectedSprintId: null,
            selectedEpicIds: [],
            selectedStatuses: [],
            lastProjectPath: projectPath
          })
        }
      },

      // Story 3.9: Sync state actions (AC: 5)
      addSyncingTask: (taskId) =>
        set((state) => ({
          syncingTaskIds: state.syncingTaskIds.includes(taskId)
            ? state.syncingTaskIds
            : [...state.syncingTaskIds, taskId]
        })),
      removeSyncingTask: (taskId) =>
        set((state) => ({
          syncingTaskIds: state.syncingTaskIds.filter((id) => id !== taskId)
        })),
      isTaskSyncing: (taskId) => get().syncingTaskIds.includes(taskId)
    }),
    {
      name: 'tinsu-ui-filters',
      storage: createJSONStorage(() => localStorage),
      // Only persist filter-related state, not UI state like sidebar
      partialize: (state) => ({
        selectedSprintId: state.selectedSprintId,
        selectedEpicIds: state.selectedEpicIds,
        selectedStatuses: state.selectedStatuses,
        lastProjectPath: state.lastProjectPath
      })
    }
  )
)
