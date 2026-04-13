import { useEffect, useRef, type RefObject } from 'react'
import type { PlanningPhase } from '@renderer/stores/planning-workspace.store'

export interface PlanningKeyboardShortcutCallbacks {
  onPhaseChange: (phase: PlanningPhase) => void
  onFocusWhatNext: () => void
  onFocusRecentRuns: () => void
  onFocusReadinessGate: () => void
  onToggleHelp: () => void
}

/**
 * Keyboard shortcut hook for the Planning Workspace.
 *
 * Story 9.9: Planning Workspace Keyboard Navigation
 *
 * Registers shortcuts on the workspace container ref (not document)
 * so they only fire when the planning workspace is mounted.
 *
 * Key mappings:
 * - 1/2/3 → Phase navigation (Analysis/Planning/Solutioning)
 * - N → Focus What Next panel
 * - R → Focus Recent Runs table
 * - G → Focus Readiness Gate panel
 * - ? → Toggle keyboard shortcuts help overlay
 */
export function usePlanningKeyboardShortcuts(
  containerRef: RefObject<HTMLDivElement | null>,
  callbacks: PlanningKeyboardShortcutCallbacks
): void {
  // Store callbacks in a ref so the event listener doesn't need to re-register on every render.
  // Always up-to-date because this assignment runs synchronously during render.
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Skip when modifier keys are held
      if (event.metaKey || event.ctrlKey || event.altKey) return

      // Skip when target is an input-like element
      const target = event.target as HTMLElement
      const tagName = target.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return
      // Skip when inside Monaco editor
      if (target.closest('[class*="monaco-"]')) return

      const key = event.key.toLowerCase()

      switch (key) {
        case '1':
          event.preventDefault()
          callbacksRef.current.onPhaseChange('analysis')
          break
        case '2':
          event.preventDefault()
          callbacksRef.current.onPhaseChange('planning')
          break
        case '3':
          event.preventDefault()
          callbacksRef.current.onPhaseChange('solutioning')
          break
        case 'n':
          event.preventDefault()
          callbacksRef.current.onFocusWhatNext()
          break
        case 'r':
          event.preventDefault()
          callbacksRef.current.onFocusRecentRuns()
          break
        case 'g':
          event.preventDefault()
          callbacksRef.current.onFocusReadinessGate()
          break
        case '?':
          event.preventDefault()
          callbacksRef.current.onToggleHelp()
          break
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef]) // containerRef is the only real dep; callbacks are read via ref
}
