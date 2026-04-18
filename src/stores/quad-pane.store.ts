import { create } from 'zustand'

/**
 * Section identifiers for the quad-pane layout.
 */
export type SectionId = 'terminal' | 'activities' | 'diff' | 'content'

/**
 * Layout mode for the task detail panel.
 * - 'quad': 2x2 grid layout for large screens (1024px+)
 * - 'tablet': 2-column layout for tablets (768-1023px)
 * - 'tabbed': Traditional tab interface for mobile (<768px)
 */
export type LayoutMode = 'quad' | 'tablet' | 'tabbed'

/**
 * State for the quad-pane layout.
 */
interface QuadPaneState {
  /** Currently expanded section (null if none expanded) */
  expandedSection: SectionId | null
  /** Current layout mode based on viewport width */
  layoutMode: LayoutMode
}

/**
 * Actions for the quad-pane layout.
 */
interface QuadPaneActions {
  /** Expand a specific section to full view */
  expandSection: (section: SectionId) => void
  /** Collapse back to quad-pane view */
  collapseSection: () => void
  /** Set the layout mode (called by responsive hook) */
  setLayoutMode: (mode: LayoutMode) => void
}

/**
 * Zustand store for managing quad-pane layout state.
 *
 * Handles:
 * - Section expansion state (which section is expanded, if any)
 * - Layout mode (quad vs tabbed based on viewport)
 *
 * Note: Actual expand/collapse UI will be implemented in Story 3.3.
 * This store prepares the state management foundation.
 *
 * Story TES-3.2: Quad-Pane Layout
 */
export const useQuadPaneStore = create<QuadPaneState & QuadPaneActions>()((set) => ({
  // Initial state
  expandedSection: null,
  layoutMode: 'quad',

  // Actions
  expandSection: (section: SectionId) => {
    set({ expandedSection: section })
  },

  collapseSection: () => {
    set({ expandedSection: null })
  },

  setLayoutMode: (mode: LayoutMode) => {
    set({ layoutMode: mode })
  }
}))
