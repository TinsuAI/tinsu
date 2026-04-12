import { Loader2, GitCompare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { useStorySync, type ConflictInfo } from '@renderer/hooks/useStorySync'

/**
 * Props for ConflictResolutionDialog component.
 */
interface ConflictResolutionDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** Task ID for the conflicting story */
  taskId: string
  /** Task title for display */
  taskTitle: string
  /** Conflict information from detectConflict */
  conflictInfo: ConflictInfo
  /** Callback when conflict is resolved */
  onResolved?: () => void
}

/**
 * Dialog for resolving conflicts between Kanban task and story file.
 *
 * Shows a side-by-side comparison of the Kanban (database) version and
 * the File version, allowing the user to choose which to keep.
 *
 * Story 3.9: Bidirectional Sync (AC: 4)
 *
 * @example
 * ```tsx
 * <ConflictResolutionDialog
 *   open={showConflict}
 *   onOpenChange={setShowConflict}
 *   taskId="task-123"
 *   taskTitle="My Story Task"
 *   conflictInfo={{
 *     hasConflict: true,
 *     hasStatusConflict: true,
 *     kanbanStatus: 'in_progress',
 *     fileStatus: 'done'
 *   }}
 *   onResolved={() => console.log('Conflict resolved')}
 * />
 * ```
 */
export function ConflictResolutionDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  conflictInfo,
  onResolved
}: ConflictResolutionDialogProps) {
  const { resolveConflict, isTaskSyncing } = useStorySync()
  const isResolving = isTaskSyncing(taskId)

  const handleKeepKanban = async () => {
    await resolveConflict(taskId, true)
    onResolved?.()
    onOpenChange(false)
  }

  const handleKeepFile = async () => {
    await resolveConflict(taskId, false)
    onResolved?.()
    onOpenChange(false)
  }

  const formatStatus = (status: string) => {
    const statusLabels: Record<string, string> = {
      backlog: 'Backlog',
      in_progress: 'In Progress',
      'in-progress': 'In Progress',
      review: 'Review',
      done: 'Done',
      'ready-for-dev': 'Ready for Dev'
    }
    return statusLabels[status] || status
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-yellow-500" />
            Resolve Conflict: {taskTitle}
          </DialogTitle>
          <DialogDescription>
            The Kanban board and story file have different versions. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Kanban Version */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 font-semibold text-sm text-foreground">Kanban Version</h4>
            {conflictInfo.hasStatusConflict && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">Status: </span>
                <span className="text-sm font-medium text-blue-400">
                  {formatStatus(conflictInfo.kanbanStatus || '')}
                </span>
              </div>
            )}
            {conflictInfo.hasContentConflict && conflictInfo.kanbanContent && (
              <div className="max-h-48 overflow-auto rounded bg-muted p-2">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {conflictInfo.kanbanContent.slice(0, 500)}
                  {conflictInfo.kanbanContent.length > 500 && '...'}
                </pre>
              </div>
            )}
          </div>

          {/* File Version */}
          <div className="rounded-lg border border-border p-4">
            <h4 className="mb-2 font-semibold text-sm text-foreground">File Version</h4>
            {conflictInfo.hasStatusConflict && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground">Status: </span>
                <span className="text-sm font-medium text-green-400">
                  {formatStatus(conflictInfo.fileStatus || '')}
                </span>
              </div>
            )}
            {conflictInfo.hasContentConflict && conflictInfo.fileContent && (
              <div className="max-h-48 overflow-auto rounded bg-muted p-2">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {conflictInfo.fileContent.slice(0, 500)}
                  {conflictInfo.fileContent.length > 500 && '...'}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-4">
          {conflictInfo.hasStatusConflict && conflictInfo.hasContentConflict ? (
            <p>Both status and content differ between versions.</p>
          ) : conflictInfo.hasStatusConflict ? (
            <p>The status differs between versions.</p>
          ) : conflictInfo.hasContentConflict ? (
            <p>The content differs between versions.</p>
          ) : null}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isResolving}
            data-testid="cancel-conflict"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleKeepKanban}
              disabled={isResolving}
              data-testid="keep-kanban"
            >
              {isResolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keep Kanban
            </Button>
            <Button onClick={handleKeepFile} disabled={isResolving} data-testid="keep-file">
              {isResolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keep File
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
