import { create } from 'zustand'

interface UIStore {
  // State
  sidebarCollapsed: boolean
  selectedSprintId: string | null // Story 2.5: Sprint filter

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setSelectedSprint: (id: string | null) => void // Story 2.5
  clearSprintFilter: () => void // Story 2.5
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  selectedSprintId: null,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSelectedSprint: (id) => set({ selectedSprintId: id }),
  clearSprintFilter: () => set({ selectedSprintId: null })
}))
