import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Props for DeleteAllTasksDialog component.
 */
interface DeleteAllTasksDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** Callback when deletion succeeds */
  onSuccess?: (deletedCount: number) => void
}

/**
 * Confirmation dialog for deleting all tasks in the current project.
 *
 * Shows a warning message and requires explicit confirmation before
 * proceeding with the destructive action.
 *
 * @example
 * ```tsx
 * <DeleteAllTasksDialog
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   onSuccess={(count) => console.log(`Deleted ${count} tasks`)}
 * />
 * ```
 */
export function DeleteAllTasksDialog({
  open,
  onOpenChange,
  onSuccess
}: DeleteAllTasksDialogProps) {
  const utils = trpc.useUtils()

  const deleteAllMutation = trpc.tasks.deleteAll.useMutation({
    onSuccess: (result) => {
      utils.tasks.getAll.invalidate()
      utils.tasks.getPlanningTasks.invalidate()
      utils.tasks.getAllWithEpics.invalidate()
      onSuccess?.(result.deletedCount)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error('Failed to delete tasks', {
        description: error.message
      })
    }
  })

  const handleDelete = () => {
    deleteAllMutation.mutate()
  }

  const isDeleting = deleteAllMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete All Tasks
          </DialogTitle>
          <DialogDescription>
            This will permanently delete all tasks in the current project. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to proceed? All planning tasks and story tasks will be removed.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid="cancel-delete-all"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="confirm-delete-all"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? 'Deleting...' : 'Delete All Tasks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
