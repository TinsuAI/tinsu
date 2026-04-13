import { FileText } from 'lucide-react'
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
 * Props for CreateStoryConfirmDialog component.
 */
interface CreateStoryConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The task to create a story file for */
  task: Task
  /** Callback when user confirms starting the create-story workflow */
  onConfirm: () => void
}

/**
 * Confirmation dialog for starting the create-story workflow.
 *
 * Shows the task title and explains what the workflow will do before
 * the user confirms spawning Claude Code with the BMAD create-story workflow.
 *
 * Story 5.3 - AC: 1
 *
 * @example
 * ```tsx
 * <CreateStoryConfirmDialog
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   task={selectedTask}
 *   onConfirm={() => startCreateStoryWorkflow(selectedTask.id)}
 * />
 * ```
 */
export function CreateStoryConfirmDialog({
  open,
  onOpenChange,
  task,
  onConfirm
}: CreateStoryConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Create Story File
          </DialogTitle>
          <DialogDescription>
            Generate full story file for "{task.title}" using BMAD workflow?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="mb-3 text-sm text-muted-foreground">This will:</p>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Spawn Claude Code with BMAD</li>
            <li>Analyze requirements from epics</li>
            <li>Create detailed story file</li>
            <li>Mark task as "Story Ready"</li>
          </ol>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="cancel-create-story"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="confirm-create-story">
            Start Create Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
