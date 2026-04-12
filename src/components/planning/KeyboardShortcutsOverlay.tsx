import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUT_SECTIONS = [
  {
    title: 'Phase Navigation',
    shortcuts: [
      { key: '1', label: 'Analysis' },
      { key: '2', label: 'Planning' },
      { key: '3', label: 'Solutioning' }
    ]
  },
  {
    title: 'Panels',
    shortcuts: [
      { key: 'N', label: 'What Next?' },
      { key: 'R', label: 'Recent Runs' },
      { key: 'G', label: 'Readiness Gate' }
    ]
  },
  {
    title: 'General',
    shortcuts: [
      { key: '?', label: 'Toggle this help' },
      { key: 'Esc', label: 'Close workspace' },
      { key: 'Tab', label: 'Cycle focus' }
    ]
  }
] as const

/**
 * Keyboard shortcuts help overlay for the Planning Workspace.
 *
 * Story 9.9: Planning Workspace Keyboard Navigation (AC 8)
 *
 * Displays all available shortcuts in a categorized grid.
 * Dismissed via Escape key, click outside, or close button.
 */
export function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Auto-focus close button when opened; restore focus when closed
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus()
      })
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  // Close on Escape; trap Tab focus within dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        // Stop native event from bubbling to the workspace's window Escape handler
        e.nativeEvent.stopPropagation()
        onClose()
      } else if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose]
  )

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div
      data-testid="keyboard-shortcuts-overlay"
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-lg border border-border/50 bg-popover p-5 shadow-lg"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Keyboard Shortcuts
          </h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Shortcut sections */}
        <div className="space-y-4">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-0.5"
                  >
                    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                      {shortcut.key}
                    </kbd>
                    <span className="text-xs text-muted-foreground">
                      {shortcut.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
