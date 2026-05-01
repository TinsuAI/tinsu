/**
 * MobileRejectionSheet — bottom sheet for the "Reject task" flow.
 *
 * Opened when the user taps "Reject" in MobileReviewActionBar. Optionally
 * collects rejection feedback. If the user submits with an empty textarea,
 * a warning appears (mirrors desktop MobileReviewActionBar.tsx lines 60–71).
 *
 * UX states:
 *   1. Empty textarea + first Submit press → showWarning=true, label flips to
 *      "Reject without feedback". Haptic: hapticFeedback([50, 50]) for warning.
 *   2. Empty textarea + second Submit press (warning visible) → onSubmit(null).
 *   3. Non-empty textarea → onSubmit(feedback.trim()). Warning resets on typing.
 *
 * Focus: textarea focused after 350 ms on open (or immediate if reduced-motion),
 * matching desktop MobileReviewActionBar.tsx useEffect pattern (lines 81–88).
 *
 * AC-21 token-discipline exception (documented here):
 *   The warning block uses amber Tailwind classes (border-amber-500/40,
 *   bg-amber-500/10, text-amber-400) for the UX-DR4 warning state. This is
 *   the second AC-21 exception for this story. All other surfaces use tokens.
 *
 * Cross-tree imports: none. Plain HTML <textarea> — no @renderer/components/ui/textarea.
 *
 * @see Story T3.5-6 — AC 11, Task 5
 */

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface MobileRejectionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (feedback: string | null) => void
  isSubmitting: boolean
}

export function MobileRejectionSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: MobileRejectionSheetProps) {
  const [feedback, setFeedback] = useState('')
  const [showWarning, setShowWarning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const reduced = useReducedMotion()
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setFeedback('')
      setShowWarning(false)
    }
  }, [open])

  // Focus textarea on open — 350 ms delay for slide animation (AC 11)
  useEffect(() => {
    if (open) {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
      if (reduced) {
        textareaRef.current?.focus()
      } else {
        focusTimerRef.current = setTimeout(() => {
          textareaRef.current?.focus()
        }, 350)
      }
    }
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
    }
  }, [open, reduced])

  const handleTextChange = (value: string) => {
    setFeedback(value)
    // Reset warning when user starts typing (AC 11)
    if (showWarning && value.trim()) {
      setShowWarning(false)
    }
  }

  const handleSubmit = () => {
    if (isSubmitting) return
    const trimmed = feedback.trim()

    if (!trimmed) {
      if (!showWarning) {
        // First submit with empty — show warning (AC 11 state 1)
        setShowWarning(true)
        hapticFeedback([50, 50])
        return
      }
      // Second submit with empty + warning visible — reject without feedback (AC 11 state 2)
      onSubmit(null)
      return
    }

    // Non-empty — submit normally (AC 11 state 3)
    onSubmit(trimmed)
  }

  const isEmpty = !feedback.trim()

  // Button label flips when warning is showing and textarea is still empty (AC 11)
  const submitLabel = showWarning && isEmpty
    ? 'Reject without feedback'
    : 'Submit & reject'

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="half"
      title="Reject task"
      description="Reject these changes and return to In Progress."
    >
      <div data-testid="mobile-review-rejection-sheet" className="flex flex-col gap-3 pb-2">
        {/* Feedback textarea */}
        <textarea
          ref={textareaRef}
          rows={4}
          placeholder="Why are you rejecting?"
          aria-label="Rejection feedback for agent"
          value={feedback}
          onChange={(e) => handleTextChange(e.target.value)}
          className={cn(
            'w-full min-h-[8rem] resize-none',
            'bg-card/30 border border-border/40 rounded-xl',
            'p-3 text-sm text-foreground',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-1 focus:ring-primary/50',
            'transition-colors duration-150',
          )}
        />

        {/* Warning block — AC-21 amber exception (UX-DR4 warning state) */}
        {showWarning && (
          <div
            data-testid="mobile-review-rejection-warning"
            className="border border-amber-500/40 bg-amber-500/10 text-amber-400 rounded-lg p-3 flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-sm">Feedback is recommended. Reject anyway?</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {/* Cancel */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className={cn(
              'flex-1 min-h-[2.75rem] rounded-xl',
              'flex items-center justify-center',
              'text-sm font-semibold',
              'bg-muted/50 text-foreground border border-border/40',
              'transition-opacity duration-150',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            Cancel
          </button>

          {/* Submit / Reject */}
          <button
            type="button"
            data-testid="mobile-review-rejection-submit-btn"
            aria-label={submitLabel}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              'flex-1 min-h-[2.75rem] rounded-xl',
              'flex items-center justify-center',
              'text-sm font-semibold',
              // Use destructive token when warning is showing to signal severity
              showWarning && isEmpty
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-primary text-primary-foreground',
              'transition-opacity duration-150',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isSubmitting ? 'Submitting…' : submitLabel}
          </button>
        </div>
      </div>
    </MobileSheet>
  )
}
