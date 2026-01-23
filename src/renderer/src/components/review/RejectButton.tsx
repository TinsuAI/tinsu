import { useState, useCallback, KeyboardEvent, forwardRef, useImperativeHandle } from 'react'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/lib/utils'

/**
 * RejectButton component for the 60-Second Velocity Loop (Story 7.4).
 *
 * Opens a dialog to collect optional feedback before rejecting.
 * Styled with red/destructive color per UX pattern. Shows keyboard shortcut "R".
 *
 * AC 1: Component exists and displays correctly with red/destructive styling
 * AC 4: Dialog opens with optional feedback textarea
 * AC 5: Empty feedback shows warning but allows proceeding
 *
 * @example
 * ```tsx
 * <RejectButton
 *   onReject={(feedback) => handleReject(feedback)}
 *   isPending={isRejecting}
 *   disabled={task.status !== 'review'}
 * />
 * ```
 */
export interface RejectButtonHandle {
  /** Programmatically open the reject dialog (for keyboard shortcut) */
  openDialog: () => void
}

export interface RejectButtonProps {
  /** Click handler for the reject action with optional feedback */
  onReject: (feedback: string | null) => void
  /** Whether the rejection is in progress */
  isPending?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export const RejectButton = forwardRef<RejectButtonHandle, RejectButtonProps>(
  ({ onReject, isPending = false, disabled = false, className }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [feedback, setFeedback] = useState('')
    const [showWarning, setShowWarning] = useState(false)

    // Expose openDialog method to parent via ref (for keyboard shortcut)
    useImperativeHandle(ref, () => ({
      openDialog: () => {
        if (!disabled && !isPending) {
          setIsOpen(true)
        }
      }
    }))

    const handleReject = useCallback(() => {
      const feedbackValue = feedback.trim()

      // AC 5: Show warning if feedback is empty
      if (!feedbackValue && !showWarning) {
        setShowWarning(true)
        return
      }

      // Proceed with rejection (empty feedback stored as null)
      onReject(feedbackValue || null)
      // Don't close dialog here - let the parent close via success callback
    }, [feedback, showWarning, onReject])

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!isPending) {
          setIsOpen(open)
          if (!open) {
            // Clear feedback and warning when dialog closes
            setFeedback('')
            setShowWarning(false)
          }
        }
      },
      [isPending]
    )

    // Clear warning when user starts typing
    const handleFeedbackChange = useCallback((value: string) => {
      setFeedback(value)
      if (showWarning && value.trim()) {
        setShowWarning(false)
      }
    }, [showWarning])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Cmd/Ctrl+Enter to submit
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          handleReject()
        }
        // Escape to close (let the dialog handle this)
      },
      [handleReject]
    )

    return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled || isPending}
          className={cn(
            'gap-2 text-white',
            'bg-red-600 hover:bg-red-700',
            disabled && 'bg-red-600/50 text-white/70',
            className
          )}
          size="sm"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Reject
          <kbd className="ml-1 rounded bg-red-700/50 px-1.5 py-0.5 text-[10px] font-medium">
            R
          </kbd>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reject Changes</DialogTitle>
          <DialogDescription>
            Provide feedback to help the agent improve the implementation.
            This task will return to In Progress status.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="What needs to be changed? (optional)"
            value={feedback}
            onChange={(e) => handleFeedbackChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[120px] resize-none"
            disabled={isPending}
            autoFocus
          />

          {/* Story 7.4 AC 5: Warning when feedback is empty */}
          {showWarning && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>Feedback helps the agent improve. Continue anyway?</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Cmd</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> to submit
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            disabled={isPending}
            className="gap-2 bg-red-600 text-white hover:bg-red-700"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {showWarning ? 'Reject Anyway' : 'Reject & Return to In Progress'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    )
  }
)

RejectButton.displayName = 'RejectButton'
