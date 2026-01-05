import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.35 : 300
const MIN_HEIGHT = 80

interface TerminalState {
  /** Whether the terminal dock is expanded */
  isExpanded: boolean
  /** Height of the terminal dock in pixels */
  height: number
  /** ID of the currently active PTY process */
  activeProcessId: string | null

  /** Set the expanded state */
  setExpanded: (expanded: boolean) => void
  /** Toggle expanded state */
  toggleExpanded: () => void
  /** Set the terminal dock height */
  setHeight: (height: number) => void
  /** Set the active process ID */
  setActiveProcess: (processId: string | null) => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      isExpanded: true,
      height: DEFAULT_HEIGHT,
      activeProcessId: null,

      setExpanded: (isExpanded) => set({ isExpanded }),
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setHeight: (height) => set({ height: Math.max(MIN_HEIGHT, height) }),
      setActiveProcess: (activeProcessId) => set({ activeProcessId })
    }),
    {
      name: 'terminal-storage',
      // Only persist height and isExpanded, not activeProcessId (transient state)
      partialize: (state) => ({
        height: state.height,
        isExpanded: state.isExpanded
      })
    }
  )
)
