/**
 * Git Error Dialog - Story 8.10
 *
 * Dialog for displaying git operation errors with recovery options.
 * Shows user-friendly error messages with suggested actions.
 *
 * @see Story 8.10: AC 1, 2, Task 7.1, 7.2, 7.3
 */

import { AlertTriangle, RefreshCw, SkipForward, ChevronDown, ChevronUp } from 'lucide-react'
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
import type { GitRecoverableError } from '@shared/types/git-error.types'

/**
 * Props for GitErrorDialog component.
 */
interface GitErrorDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The error to display */
  error: GitRecoverableError
  /** Title for the dialog */
  title?: string
  /** Callback when user clicks Retry */
  onRetry?: () => void
  /** Callback when user clicks Skip */
  onSkip?: () => void
  /** Callback when user clicks Dismiss */
  onDismiss?: () => void
  /** Whether a retry is in progress */
  isRetrying?: boolean
}

/**
 * Dialog for displaying git operation errors with recovery options.
 *
 * Shows:
 * - User-friendly error message
 * - Suggested recovery actions
 * - Retry/Skip/Dismiss buttons based on error category
 * - Expandable technical details for debugging
 *
 * @see Story 8.10: Task 7.1, 7.2
 *
 * @example
 * ```tsx
 * <GitErrorDialog
 *   open={showError}
 *   onOpenChange={setShowError}
 *   error={gitError}
 *   title="Worktree Creation Failed"
 *   onRetry={handleRetry}
 *   onSkip={handleSkip}
 *   onDismiss={() => setShowError(false)}
 * />
 * ```
 */
export function GitErrorDialog({
  open,
  onOpenChange,
  error,
  title = 'Git Operation Failed',
  onRetry,
  onSkip,
  onDismiss,
  isRetrying = false
}: GitErrorDialogProps) {
  const [showDetails, setShowDetails] = useState(false)

  const handleDismiss = () => {
    onDismiss?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left pt-2">
            {error.message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested Actions */}
          {error.suggestedActions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Suggested actions:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {error.suggestedActions.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Details (Expandable) */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Technical details
            </button>

            {showDetails && (
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {error.technicalDetails}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {/* Dismiss button (always shown) */}
          <Button variant="outline" onClick={handleDismiss} disabled={isRetrying}>
            Dismiss
          </Button>

          {/* Skip button (if skippable) */}
          {error.canSkip && onSkip && (
            <Button variant="secondary" onClick={onSkip} disabled={isRetrying}>
              <SkipForward className="h-4 w-4 mr-2" />
              Skip
            </Button>
          )}

          {/* Retry button (if retryable) */}
          {error.canRetry && onRetry && (
            <Button onClick={onRetry} disabled={isRetrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
