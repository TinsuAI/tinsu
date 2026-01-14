import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import type { StoryTask } from '@shared/types/task.types'

interface StoryDetailDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The story task to display */
  task: StoryTask | null
  /** Epic name for display */
  epicName?: string
  /** Epic color for badge styling */
  epicColor?: string
}

/**
 * Dialog for viewing full story details including user story and acceptance criteria.
 *
 * Story 3.7: Story Import After Epics Phase (AC: 4)
 * TES-1.5: Includes "/" keyboard shortcut to focus terminal input
 */
export function StoryDetailDialog({
  open,
  onOpenChange,
  task,
  epicName,
  epicColor = 'blue'
}: StoryDetailDialogProps): React.ReactNode {
  // TES-1.4: Tab state for switching between content and terminal
  const [activeTab, setActiveTab] = useState<'content' | 'terminal'>('content')

  // TES-1.5: Ref for TaskTerminal to enable focus control
  const terminalRef = useRef<TaskTerminalRef>(null)

  // TES-1.4: Check if task has an active terminal session
  // Query for any task with an id - sessions may persist after task status changes
  const { data: taskSession } = trpc.agent.getTaskSession.useQuery(
    { taskId: task?.id ?? '' },
    { enabled: !!task?.id }
  )

  const hasActiveSession = !!taskSession

  // TES-1.5: "/" keyboard shortcut to focus terminal input (AC: #3)
  useEffect(() => {
    if (!open || activeTab !== 'terminal' || !hasActiveSession) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      // "/" key without modifiers
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't trigger if already typing in an input field
        const activeElement = document.activeElement
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
          return
        }

        e.preventDefault()
        terminalRef.current?.focusInput()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, activeTab, hasActiveSession])

  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[85vh] overflow-y-auto',
          activeTab === 'terminal' ? 'sm:max-w-[900px]' : 'sm:max-w-[600px]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="pr-8">{task.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2">
              {epicName && <EpicBadge title={epicName} color={epicColor} />}
              <span className="text-sm text-muted-foreground">Story #{task.story_number}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* TES-1.4: Tab buttons when task has active terminal session */}
        {hasActiveSession && (
          <div className="flex gap-2 border-b pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'content'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
            >
              Content
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('terminal')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'terminal'
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )}
            >
              Terminal
            </button>
          </div>
        )}

        {/* TES-1.4: Content tab */}
        {activeTab === 'content' && (
          <div className="space-y-4 pt-4">
            {/* Story description (includes user story + acceptance criteria) */}
            {task.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm text-foreground">
                  {task.description}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No description available.</p>
            )}

            {/* Status information */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{task.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        )}

        {/* TES-1.4: Terminal tab, TES-1.5: Added ref for "/" shortcut */}
        {activeTab === 'terminal' && hasActiveSession && (
          <div className="h-[500px] pt-4">
            <TaskTerminal ref={terminalRef} taskId={task.id} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
