/**
 * MobileFeedbackSheet — bottom sheet for the "Request Changes" flow.
 *
 * Opened when the user taps "Request changes" in MobileReviewActionBar.
 * Collects free-text feedback; submits via useRejectionMutation (the backend
 * uses the same commands.rejectTask() for both Request Changes and Reject —
 * only the UX label differs; see useRejectionMutation.ts lines 27–30).
 *
 * Implementation notes:
 *   - Plain HTML <textarea> — no @renderer/components/ui/textarea import (AC 18).
 *   - Focus is set on open after 350 ms (or immediately if reduced-motion) to
 *     allow the sheet slide-in animation to complete before keyboard opens.
 *   - Submit disabled when textarea is empty/whitespace-only (AC 10).
 *   - No Radix AlertDialog — MobileSheet is the confirmation pattern (AC 9 precedent).
 *   - Token contract: bg-card/30 textarea, bg-muted/50 cancel, bg-primary submit.
 *     No inline hex or named color classes.
 *
 * @see Story T3.5-6 — AC 10, Task 4
 */

import { useState, useEffect, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface MobileFeedbackSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (feedback: string) => void
  isSubmitting: boolean
}

export function MobileFeedbackSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: MobileFeedbackSheetProps) {
  const [feedback, setFeedback] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const reduced = useReducedMotion()
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset feedback when sheet closes (Task 4.3)
  useEffect(() => {
    if (!open) {
      setFeedback('')
    }
  }, [open])

  // Focus textarea when sheet opens (Task 4.6)
  // Delay 350 ms for sheet animation; immediate when reduced-motion (AC 11 mirror)
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

  const handleSubmit = () => {
    if (!feedback.trim() || isSubmitting) return
    onSubmit(feedback.trim())
  }

  const isEmpty = !feedback.trim()

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="half"
      title="Request changes"
      description="Provide feedback. The task will return to In Progress."
    >
      <div data-testid="mobile-review-feedback-sheet" className="flex flex-col gap-4 pb-2">
        {/* Feedback textarea (plain HTML — AC 18 forbids @renderer/components/ui/textarea) */}
        <textarea
          ref={textareaRef}
          rows={4}
          placeholder="What needs to be fixed?"
          aria-label="Feedback for agent"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className={cn(
            'w-full min-h-[8rem] resize-none',
            'bg-card/30 border border-border/40 rounded-xl',
            'p-3 text-sm text-foreground',
            'placeholder:text-muted-foreground/60',
            'focus:outline-none focus:ring-1 focus:ring-primary/50',
            'transition-colors duration-150',
          )}
        />

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

          {/* Submit */}
          <button
            type="button"
            data-testid="mobile-review-feedback-submit-btn"
            aria-label="Submit feedback"
            onClick={handleSubmit}
            disabled={isEmpty || isSubmitting}
            className={cn(
              'flex-1 min-h-[2.75rem] rounded-xl',
              'flex items-center justify-center',
              'text-sm font-semibold',
              'bg-primary text-primary-foreground',
              'transition-opacity duration-150',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isSubmitting ? 'Submitting…' : 'Submit feedback'}
          </button>
        </div>
      </div>
    </MobileSheet>
  )
}
