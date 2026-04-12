/**
 * Crash Recovery Dialog - Story 8.10
 *
 * Dialog shown when incomplete git operations are detected from a previous session.
 * Allows users to retry, skip, or cleanup crashed operations.
 *
 * @see Story 8.10: AC 4, Task 7.3, 7.4
 */

import { AlertCircle, RefreshCw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
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

/**
 * Crashed operation from the recovery service.
 */
interface CrashedOperation {
  operationType: string
  taskId?: string
  worktreePath?: string
  branchName?: string
  startedAt: number
  status: string
  error?: string
  hasPartialState: boolean
  suggestedActions: string[]
}

/**
 * Props for CrashRecoveryDialog component.
 */
interface CrashRecoveryDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** Array of crashed operations needing recovery */
  crashedOperations: CrashedOperation[]
  /** Summary message from the recovery check */
  summary?: string | null
  /** Callback when recovery is complete */
  onRecoveryComplete?: () => void
}

/**
 * Formats a timestamp for display.
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

/**
 * Gets a human-readable operation name.
 */
function getOperationLabel(operationType: string): string {
  const labels: Record<string, string> = {
    createWorktree: 'Worktree Creation',
    merge: 'Branch Merge',
    removeWorktree: 'Worktree Removal'
  }
  return labels[operationType] || operationType
}

/**
 * Dialog for recovering from crashed git operations.
 *
 * Shows:
 * - List of crashed operations with timestamps
 * - Recovery options per operation (retry, cleanup, dismiss)
 * - Summary of what was detected
 *
 * @see Story 8.10: Task 7.3, 7.4
 *
 * @example
 * ```tsx
 * <CrashRecoveryDialog
 *   open={showRecovery}
 *   onOpenChange={setShowRecovery}
 *   crashedOperations={recoveryData.crashedOperations}
 *   summary={recoveryData.summary}
 *   onRecoveryComplete={handleRecoveryComplete}
 * />
 * ```
 */
export function CrashRecoveryDialog({
  open,
  onOpenChange,
  crashedOperations,
  summary,
  onRecoveryComplete
}: CrashRecoveryDialogProps) {
  const [processingOps, setProcessingOps] = useState<Set<string>>(new Set())
  const [completedOps, setCompletedOps] = useState<Set<string>>(new Set())

  const cleanupMutation = trpc.git.cleanupPartialWorktree.useMutation()
  const dismissMutation = trpc.git.dismissOperation.useMutation()
  const retryWorktreeMutation = trpc.git.retryWorktreeCreation.useMutation()

  const getOpKey = (op: CrashedOperation) => `${op.operationType}-${op.taskId || 'unknown'}`

  const handleRetry = async (op: CrashedOperation) => {
    if (!op.taskId) return

    const key = getOpKey(op)
    setProcessingOps((prev) => new Set([...prev, key]))

    try {
      if (op.operationType === 'createWorktree') {
        await retryWorktreeMutation.mutateAsync({ taskId: op.taskId })
      }
      // Mark as completed
      setCompletedOps((prev) => new Set([...prev, key]))
    } catch (error) {
      console.error('[CrashRecovery] Retry failed:', error)
    } finally {
      setProcessingOps((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleCleanup = async (op: CrashedOperation) => {
    if (!op.taskId) return

    const key = getOpKey(op)
    setProcessingOps((prev) => new Set([...prev, key]))

    try {
      await cleanupMutation.mutateAsync({ taskId: op.taskId })
      setCompletedOps((prev) => new Set([...prev, key]))
    } catch (error) {
      console.error('[CrashRecovery] Cleanup failed:', error)
    } finally {
      setProcessingOps((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleDismiss = async (op: CrashedOperation) => {
    const key = getOpKey(op)
    setProcessingOps((prev) => new Set([...prev, key]))

    try {
      await dismissMutation.mutateAsync({
        operationType: op.operationType,
        taskId: op.taskId
      })
      setCompletedOps((prev) => new Set([...prev, key]))
    } catch (error) {
      console.error('[CrashRecovery] Dismiss failed:', error)
    } finally {
      setProcessingOps((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleDismissAll = async () => {
    for (const op of crashedOperations) {
      await handleDismiss(op)
    }
    onRecoveryComplete?.()
    onOpenChange(false)
  }

  const handleClose = () => {
    onRecoveryComplete?.()
    onOpenChange(false)
  }

  // Filter out completed operations
  const activeOperations = crashedOperations.filter(
    (op) => !completedOps.has(getOpKey(op))
  )

  // If all operations are resolved, close the dialog
  if (activeOperations.length === 0 && crashedOperations.length > 0) {
    onRecoveryComplete?.()
    onOpenChange(false)
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Interrupted Operations Detected
          </DialogTitle>
          {summary && (
            <DialogDescription className="text-left pt-2">
              {summary}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {activeOperations.map((op) => {
            const key = getOpKey(op)
            const isProcessing = processingOps.has(key)

            return (
              <div
                key={key}
                className="border rounded-lg p-4 space-y-3 bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{getOperationLabel(op.operationType)}</p>
                    {op.taskId && (
                      <p className="text-sm text-muted-foreground">
                        Task: {op.taskId}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Started: {formatTime(op.startedAt)}
                    </p>
                  </div>

                  {op.hasPartialState && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      Partial State
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {op.suggestedActions.includes('retry') && op.taskId && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRetry(op)}
                      disabled={isProcessing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                      Retry
                    </Button>
                  )}

                  {op.suggestedActions.includes('cleanup') && op.taskId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCleanup(op)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Cleanup
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDismiss(op)}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Dismiss
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDismissAll}>
            Dismiss All
          </Button>
          <Button onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
