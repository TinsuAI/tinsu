import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectState {
  // Current project path (null if no project loaded)
  projectPath: string | null

  // Project name from config (for display)
  projectName: string | null

  // Actions
  setProject: (path: string, name: string) => void
  clearProject: () => void
}

/**
 * Project state store.
 * Tracks the currently open project and persists the last opened project path.
 */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectPath: null,
      projectName: null,

      setProject: (path, name) =>
        set({
          projectPath: path,
          projectName: name
        }),

      clearProject: () =>
        set({
          projectPath: null,
          projectName: null
        })
    }),
    {
      name: 'tinsu-project-storage',
      // Only persist the path, not the name (name comes from config)
      partialize: (state) => ({ projectPath: state.projectPath })
    }
  )
)
