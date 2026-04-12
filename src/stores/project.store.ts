import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectState {
  // Current project path (null if no project loaded)
  projectPath: string | null

  // Project name from config (for display)
  projectName: string | null

  // Current project ID from DB (null until project is opened via Rust command)
  activeProjectId: string | null

  // Actions
  setProject: (id: string, path: string, name: string) => void
  setProjectId: (id: string | null) => void
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
      activeProjectId: null,

      setProject: (id, path, name) =>
        set({
          activeProjectId: id,
          projectPath: path,
          projectName: name,
        }),

      setProjectId: (id) => set({ activeProjectId: id }),

      clearProject: () =>
        set({
          projectPath: null,
          projectName: null,
          activeProjectId: null,
        }),
    }),
    {
      name: 'tinsu-project-storage',
      // Only persist the path — id and name are resolved fresh from DB on open
      partialize: (state) => ({ projectPath: state.projectPath }),
    }
  )
)
