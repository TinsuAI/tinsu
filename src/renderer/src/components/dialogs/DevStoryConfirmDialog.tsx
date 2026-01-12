import { Code } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import type { Task } from '@shared/types/task.types'

/**
 * Props for DevStoryConfirmDialog component.
 */
interface DevStoryConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The task to start development for */
  task: Task
  /** Callback when user confirms starting the dev-story workflow */
  onConfirm: () => void
}

/**
 * Confirmation dialog for starting the dev-story workflow.
 *
 * Shows the task title and explains what the workflow will do before
 * the user confirms spawning Claude Code with the BMAD dev-story workflow.
 *
 * Story 5.3 - AC: 3
 *
 * @example
 * ```tsx
 * <DevStoryConfirmDialog
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   task={selectedTask}
 *   onConfirm={() => startDevStoryWorkflow(selectedTask.id)}
 * />
 * ```
 */
export function DevStoryConfirmDialog({
  open,
  onOpenChange,
  task,
  onConfirm
}: DevStoryConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Start Development
          </DialogTitle>
          <DialogDescription>
            Start implementing "{task.title}" using BMAD dev-story workflow?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Story 5.3 - AC 3: Show story file path per mockup */}
          {task.story_file_path && (
            <div className="mb-4 rounded-md bg-muted/50 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Story file:</p>
              <p className="font-mono text-sm text-foreground">
                {task.story_file_path.split('/').pop()}
              </p>
            </div>
          )}
          <p className="mb-3 text-sm text-muted-foreground">This will:</p>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Spawn Claude Code with BMAD</li>
            <li>Read story requirements</li>
            <li>Implement tasks and subtasks</li>
            <li>Update story status on completion</li>
          </ol>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="cancel-dev-story"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="confirm-dev-story">
            Start Dev Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
