import { Play } from 'lucide-react'
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
 * Props for BasicTaskConfirmDialog component.
 */
interface BasicTaskConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The task to execute */
  task: Task
  /** Callback when user confirms starting the basic task */
  onConfirm: () => void
}

/**
 * Confirmation dialog for starting a basic task directly.
 *
 * Shows the task title and description before spawning Claude Code
 * directly with the task as prompt (no BMAD workflow).
 *
 * Story 5.3b - AC: 1
 *
 * @example
 * ```tsx
 * <BasicTaskConfirmDialog
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   task={selectedTask}
 *   onConfirm={() => startBasicTask(selectedTask.id)}
 * />
 * ```
 */
export function BasicTaskConfirmDialog({
  open,
  onOpenChange,
  task,
  onConfirm
}: BasicTaskConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Start Task
          </DialogTitle>
          <DialogDescription>Execute "{task.title}" directly with Claude Code?</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {task.description && (
            <div className="mb-4 border-l-2 border-muted-foreground/30 pl-3">
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            This will spawn Claude Code with the task description. No BMAD workflow will be used.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="cancel-basic-task"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="confirm-basic-task">
            Start Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
