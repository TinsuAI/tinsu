import { useState, useEffect } from 'react'
import { useQuadPaneStore, type LayoutMode } from '@renderer/stores/quad-pane.store'

/**
 * Breakpoints for layout modes.
 * - 1024px matches the lg breakpoint in Tailwind CSS (desktop)
 * - 768px matches the md breakpoint in Tailwind CSS (tablet)
 */
const DESKTOP_BREAKPOINT = 1024
const TABLET_BREAKPOINT = 768

/**
 * Custom hook for detecting viewport width and determining layout mode.
 *
 * Uses window.matchMedia for efficient, performance-friendly detection
 * that doesn't cause layout thrashing on every resize event.
 *
 * Returns:
 * - 'quad' when viewport width >= 1024px (desktop 3-column)
 * - 'tablet' when viewport width >= 768px and < 1024px (tablet 2-column)
 * - 'tabbed' when viewport width < 768px (mobile tabbed interface)
 *
 * Also syncs the detected mode to the quad-pane store.
 *
 * Story TES-3.2: Quad-Pane Layout
 * Story t3-4: Tablet 2-column layout
 */
export function useQuadPaneLayout(): LayoutMode {
  const { setLayoutMode } = useQuadPaneStore()

  // Initialize with current viewport state
  const [layoutMode, setLocalLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'tabbed'
    const width = window.innerWidth
    if (width >= DESKTOP_BREAKPOINT) return 'quad'
    if (width >= TABLET_BREAKPOINT) return 'tablet'
    return 'tabbed'
  })

  useEffect(() => {
    // Create media queries for both breakpoints
    const desktopQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_BREAKPOINT}px)`)

    // Handler for media query changes
    const handleChange = () => {
      let mode: LayoutMode
      if (desktopQuery.matches) {
        mode = 'quad'
      } else if (tabletQuery.matches) {
        mode = 'tablet'
      } else {
        mode = 'tabbed'
      }
      setLocalLayoutMode(mode)
      setLayoutMode(mode)
    }

    // Initial check
    handleChange()

    // Listen for viewport changes
    desktopQuery.addEventListener('change', handleChange)
    tabletQuery.addEventListener('change', handleChange)

    return () => {
      desktopQuery.removeEventListener('change', handleChange)
      tabletQuery.removeEventListener('change', handleChange)
    }
  }, [setLayoutMode])

  return layoutMode
}
