import { useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Pause, AlertTriangle, Loader2, MessageSquare } from 'lucide-react'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Textarea } from '@renderer/components/ui/textarea'

export interface MobileReviewActionBarProps {
  onApprove: () => void
  onReject: (feedback: string | null) => void
  isApproving: boolean
  isRejecting: boolean
  hasConflict?: boolean
  className?: string
}

/**
 * MobileReviewActionBar - Sticky bottom action bar for mobile review workspace.
 * AC: 3, 4, 5, 6
 */
export function MobileReviewActionBar({
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  hasConflict = false,
  className
}: MobileReviewActionBarProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectSheet, setShowRejectSheet] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showRejectWarning, setShowRejectWarning] = useState(false)

  const handleApproveClick = useCallback(() => {
    hapticFeedback(20)
    setShowApproveDialog(true)
  }, [])

  const handleConfirmApprove = useCallback(() => {
    hapticFeedback([10, 30, 10])
    setShowApproveDialog(false)
    onApprove()
  }, [onApprove])

  const handleRejectClick = useCallback(() => {
    hapticFeedback(20)
    setShowRejectSheet(true)
  }, [])

  const handleConfirmReject = useCallback(() => {
    const feedbackValue = feedback.trim()
    if (!feedbackValue && !showRejectWarning) {
      setShowRejectWarning(true)
      hapticFeedback([50, 50])
      return
    }
    hapticFeedback([10, 30, 10])
    setShowRejectSheet(false)
    onReject(feedbackValue || null)
    setFeedback('')
    setShowRejectWarning(false)
  }, [feedback, showRejectWarning, onReject])

  const handlePauseClick = useCallback(() => {
    hapticFeedback(10)
    // Pause logic is deferred/optional for now but button is requested by AC3
  }, [])

  return (
    <div
      data-testid="mobile-review-action-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-[#0a0a0b]/95 backdrop-blur-md px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePauseClick}
          className="h-14 flex-1 gap-2 rounded-xl text-muted-foreground active:scale-95"
          disabled={isApproving || isRejecting}
          data-testid="mobile-pause-btn"
        >
          <Pause className="h-5 w-5" />
          <span>Pause</span>
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={handleRejectClick}
          className="h-14 flex-1 gap-2 rounded-xl bg-red-600/20 text-red-500 hover:bg-red-600/30 active:scale-95"
          disabled={isApproving || isRejecting}
          data-testid="mobile-reject-btn"
        >
          <XCircle className="h-5 w-5" />
          <span>Reject</span>
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={handleApproveClick}
          className="h-14 flex-1 gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
          disabled={isApproving || isRejecting || hasConflict}
          data-testid="mobile-approve-btn"
        >
          {isApproving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          <span>Approve</span>
        </Button>
      </div>

      {hasConflict && (
        <div data-testid="mobile-conflict-msg" className="mt-2 text-center text-[10px] text-red-400 font-medium">
          Resolve conflicts on desktop to approve
        </div>
      )}

      {/* Approval Confirmation Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve & Merge</DialogTitle>
            <DialogDescription>
              This will merge the changes into the main branch and complete the task.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApprove}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Feedback Sheet (Mobile Slide-over imitation) */}
      {showRejectSheet && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0b] animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <h3 className="text-lg font-semibold">Rejection Feedback</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowRejectSheet(false)
                setFeedback('')
                setShowRejectWarning(false)
              }}
            >
              <XCircle className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Provide feedback to help the agent improve. This task will return to In Progress.
            </p>
            <Textarea
              placeholder="What needs to be fixed?"
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value)
                if (showRejectWarning && e.target.value.trim()) {
                  setShowRejectWarning(false)
                }
              }}
              className="min-h-[200px] bg-card/30 text-base"
              autoFocus
            />
            {showRejectWarning && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-500">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Feedback is recommended. Reject anyway?</p>
              </div>
            )}
          </div>
          <div className="border-t border-border/40 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              onClick={handleConfirmReject}
              className="w-full gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              <MessageSquare className="h-5 w-5" />
              {showRejectWarning ? 'Reject Without Feedback' : 'Submit Feedback & Reject'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
