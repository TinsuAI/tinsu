import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
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
 */
export function StoryDetailDialog({
  open,
  onOpenChange,
  task,
  epicName,
  epicColor = 'blue'
}: StoryDetailDialogProps) {
  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="pr-8">{task.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2">
              {epicName && <EpicBadge title={epicName} color={epicColor} />}
              <span className="text-sm text-muted-foreground">Story #{task.story_number}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Story description (includes user story + acceptance criteria) */}
          {task.description ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm text-foreground">{task.description}</div>
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
      </DialogContent>
    </Dialog>
  )
}
