import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectState {
  // Current project path (null if no project loaded)
  projectPath: string | null

  // Project name from config (for display)
  projectName: string | null

  // Current project ID from DB (null until project is opened via Rust command)
  activeProjectId: string | null

  // Remote project context (null for local projects)
  remoteProjectId: string | null
  remoteConnectionId: string | null

  // Actions
  setProject: (
    id: string,
    path: string,
    name: string,
    remoteProjectId?: string | null,
    remoteConnectionId?: string | null
  ) => void
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
      remoteProjectId: null,
      remoteConnectionId: null,

      setProject: (id, path, name, remoteProjectId = null, remoteConnectionId = null) =>
        set({
          activeProjectId: id,
          projectPath: path,
          projectName: name,
          remoteProjectId,
          remoteConnectionId,
        }),

      setProjectId: (id) => set({ activeProjectId: id }),

      clearProject: () =>
        set({
          projectPath: null,
          projectName: null,
          activeProjectId: null,
          remoteProjectId: null,
          remoteConnectionId: null,
        }),
    }),
    {
      name: 'tinsu-project-storage',
      // Persist path and remote context — id and name are resolved fresh from DB on open
      partialize: (state) => ({
        projectPath: state.projectPath,
        remoteProjectId: state.remoteProjectId,
        remoteConnectionId: state.remoteConnectionId,
      }),
    }
  )
)
