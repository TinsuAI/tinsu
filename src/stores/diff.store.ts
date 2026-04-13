import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * View mode for the diff editor.
 * - 'unified': Changes shown interleaved (removed then added) in single column
 * - 'split': Original on left, modified on right in two columns
 */
export type DiffViewMode = 'unified' | 'split'

interface DiffState {
  /** Current view mode for the diff editor */
  viewMode: DiffViewMode

  /** Actions */
  setViewMode: (mode: DiffViewMode) => void
  toggleViewMode: () => void
}

/**
 * Diff preferences store.
 * Manages diff viewer settings and persists to localStorage.
 *
 * Story TES-4.5: Unified vs Split View Toggle
 */
export const useDiffStore = create<DiffState>()(
  persist(
    (set) => ({
      viewMode: 'split', // Default to split (matches current Monaco behavior)

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === 'split' ? 'unified' : 'split'
        }))
    }),
    {
      name: 'tinsu-diff-preferences',
      // Only persist viewMode
      partialize: (state) => ({ viewMode: state.viewMode })
    }
  )
)
