import { useEffect, useCallback, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import { useTaskDetailPanelStore } from '@renderer/stores/task-detail-panel.store'
import { TaskDetailContent } from './TaskDetailContent'

/**
 * Task Detail Panel - A cinematic slide-over panel for viewing task details.
 *
 * Design: Editorial Command Center
 * - Slides in from the right with smooth animation
 * - Semi-transparent backdrop overlay (click to close)
 * - 60-70% viewport width on desktop, full-width on mobile
 * - Glass morphism header with depth
 * - Keyboard accessible (Escape to close)
 *
 * Story TES-3.1: Task Detail Panel Container
 */
export function TaskDetailPanel() {
  const { isOpen, activeTaskId, closePanel } = useTaskDetailPanelStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // Don't close if user is in an input or textarea
        const activeElement = document.activeElement
        const isInEditor =
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.closest('[contenteditable="true"]')
        if (!isInEditor) {
          e.preventDefault()
          closePanel()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closePanel])

  // Focus trap and body scroll lock when panel is open
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'

      // Focus the panel for keyboard navigation
      setTimeout(() => {
        panelRef.current?.focus()
      }, 100)
    } else {
      // Restore body scroll
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the backdrop itself, not its children
      if (e.target === e.currentTarget) {
        closePanel()
      }
    },
    [closePanel]
  )

  // Don't render anything if no task is selected
  if (!activeTaskId) return null

  return (
    <>
      {/* Backdrop overlay with blur */}
      <div
        className={cn(
          'task-detail-backdrop fixed inset-0 z-40 transition-all duration-300',
          isOpen
            ? 'bg-black/60 backdrop-blur-sm opacity-100'
            : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
        data-testid="task-detail-backdrop"
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className={cn(
          'task-detail-panel fixed right-0 top-0 z-50 h-full',
          // Responsive width: 65% desktop, 75% tablet, full-width mobile
          'w-full sm:w-[75vw] lg:w-[65vw] lg:max-w-[70vw]',
          // Panel styling with depth
          'bg-background/95 backdrop-blur-xl',
          'border-l border-border/40',
          // Layered shadows for cinematic depth
          'shadow-[-8px_0_40px_-10px_rgba(0,0,0,0.5),_-2px_0_8px_-2px_rgba(0,0,0,0.3)]',
          // Slide animation
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        tabIndex={-1}
        data-testid="task-detail-panel"
      >
        {/* Decorative top gradient accent */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        {/* Subtle inner glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.02] via-transparent to-violet-500/[0.02]" />

        {/* Content wrapper */}
        <div className="relative flex h-full flex-col">
          <TaskDetailContent taskId={activeTaskId} onClose={closePanel} />
        </div>
      </div>
    </>
  )
}
