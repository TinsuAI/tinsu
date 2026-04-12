import { useState, useEffect } from 'react'
import { useQuadPaneStore, type LayoutMode } from '@renderer/stores/quad-pane.store'

/**
 * Breakpoint for switching between quad-pane and tabbed layouts.
 * 1024px matches the lg breakpoint in Tailwind CSS.
 */
const QUAD_PANE_BREAKPOINT = 1024

/**
 * Custom hook for detecting viewport width and determining layout mode.
 *
 * Uses window.matchMedia for efficient, performance-friendly detection
 * that doesn't cause layout thrashing on every resize event.
 *
 * Returns:
 * - 'quad' when viewport width >= 1024px
 * - 'tabbed' when viewport width < 1024px
 *
 * Also syncs the detected mode to the quad-pane store.
 *
 * Story TES-3.2: Quad-Pane Layout
 */
export function useQuadPaneLayout(): LayoutMode {
  const { setLayoutMode } = useQuadPaneStore()

  // Initialize with current viewport state
  const [layoutMode, setLocalLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'tabbed'
    return window.innerWidth >= QUAD_PANE_BREAKPOINT ? 'quad' : 'tabbed'
  })

  useEffect(() => {
    // Create media query for the breakpoint
    const mediaQuery = window.matchMedia(`(min-width: ${QUAD_PANE_BREAKPOINT}px)`)

    // Handler for media query changes
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const mode: LayoutMode = e.matches ? 'quad' : 'tabbed'
      setLocalLayoutMode(mode)
      setLayoutMode(mode)
    }

    // Initial check
    handleChange(mediaQuery)

    // Listen for viewport changes
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [setLayoutMode])

  return layoutMode
}
