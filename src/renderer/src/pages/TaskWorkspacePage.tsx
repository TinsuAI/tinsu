import { useEffect, useCallback, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { TaskDetailContent } from '@renderer/components/task/TaskDetailContent'
import { useTaskWorkspaceStore } from '@renderer/stores/task-workspace.store'
import { trpc } from '@renderer/lib/trpc'

/**
 * Full-screen task workspace page component.
 *
 * Story TES-3.1: Task Workspace Navigation
 *
 * This component provides:
 * - Full-screen workspace for viewing and working on tasks
 * - Back button navigation to return to the Kanban board
 * - Escape key navigation (when not in input fields)
 * - Loading and error states
 */
export function TaskWorkspacePage() {
  const { activeTaskId, closeWorkspace } = useTaskWorkspaceStore()
  const workspaceRef = useRef<HTMLDivElement>(null)

  // Fetch task data to validate the task exists
  const { data: task, isLoading, error } = trpc.tasks.getById.useQuery(
    { id: activeTaskId! },
    { enabled: !!activeTaskId }
  )

  // Handle back navigation
  const handleBack = useCallback(() => {
    closeWorkspace()
  }, [closeWorkspace])

  // Escape key handler - navigate back when not in an input field
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement
        const isInEditor =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.closest('[contenteditable="true"]')

        if (!isInEditor) {
          e.preventDefault()
          handleBack()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleBack])

  // Lock body scroll when workspace is open
  useEffect(() => {
    if (activeTaskId) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [activeTaskId])

  // Focus trap - prevent tabbing out of workspace
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = workspace.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    workspace.addEventListener('keydown', handleKeyDown)
    return () => workspace.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Don't render if no task is active
  if (!activeTaskId) return null

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading task...</span>
        </div>
      </div>
    )
  }

  // Error state (task not found)
  if (error || !task) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">Task not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The task you're looking for doesn't exist or has been deleted.
          </p>
          <Button variant="ghost" onClick={handleBack} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={workspaceRef} className="fixed inset-0 z-50 flex h-screen flex-col bg-background">
      {/* Decorative gradient overlay for visual depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cyan-500/[0.02] via-transparent to-transparent" />

      {/* Task detail content with back button in header */}
      <div className="relative flex h-full flex-col">
        <TaskDetailContent taskId={activeTaskId} task={task} onClose={handleBack} />
      </div>
    </div>
  )
}
