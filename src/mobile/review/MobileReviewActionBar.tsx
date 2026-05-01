/**
 * MobileReviewActionBar — 3-button sticky review action bar.
 *
 * Uses MobileBottomActionBar's `children` escape hatch because the primitive's
 * default primary/secondary contract supports only 2 slots. This story requires
 * 3 buttons (Reject / Request Changes / Approve), so we render children directly.
 *
 * Button order (left → right): Reject | Request Changes | Approve
 * Approve is thumb-dominant (right side) per UX-DR7 and AC 8.
 *
 * Token contract: all surfaces use Calm Command tokens only — no inline hex,
 * no named color classes except those mandated by the token system.
 *   Reject        → bg-destructive/15 text-destructive border-destructive/40
 *   Request Chg   → bg-muted/50 text-foreground border-border/40
 *   Approve       → bg-primary text-primary-foreground
 *
 * Haptic: each button fires hapticFeedback(20) on press before the callback (AC 8).
 *
 * @see Story T3.5-6 — AC 8, 13
 * @see MobileBottomActionBar children escape hatch (lines 47-48 of MobileBottomActionBar.tsx)
 */

import { cn, hapticFeedback } from '@renderer/lib/utils'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'

interface MobileReviewActionBarProps {
  onApprove: () => void
  onReject: () => void
  onRequestChanges: () => void
  isApproving: boolean
  isRejecting: boolean
  hasConflict: boolean
}

export function MobileReviewActionBar({
  onApprove,
  onReject,
  onRequestChanges,
  isApproving,
  isRejecting,
  hasConflict,
}: MobileReviewActionBarProps) {
  const handleApprove = () => {
    hapticFeedback(20)
    onApprove()
  }

  const handleReject = () => {
    hapticFeedback(20)
    onReject()
  }

  const handleRequestChanges = () => {
    hapticFeedback(20)
    onRequestChanges()
  }

  return (
    <MobileBottomActionBar>
      {/* role="toolbar" groups the 3 review actions for screen-readers (AC 8, 12.5) */}
      <div role="toolbar" aria-label="Review actions" className="flex items-center gap-3 w-full">
        {/* ── Reject (left) ─────────────────────────────────────────── */}
        <button
          type="button"
          data-testid="mobile-review-reject-btn"
          aria-label="Reject changes"
          onClick={handleReject}
          disabled={isApproving || isRejecting}
          className={cn(
            'flex-1 min-h-[2.75rem] rounded-xl',
            'flex items-center justify-center',
            'text-sm font-semibold',
            'bg-destructive/15 text-destructive border border-destructive/40',
            'transition-opacity duration-150',
            'active:opacity-70',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          Reject
        </button>

        {/* ── Request Changes (middle) ───────────────────────────────── */}
        <button
          type="button"
          data-testid="mobile-review-request-btn"
          aria-label="Request changes"
          onClick={handleRequestChanges}
          disabled={isApproving || isRejecting}
          className={cn(
            'flex-1 min-h-[2.75rem] rounded-xl',
            'flex items-center justify-center',
            'text-sm font-semibold',
            'bg-muted/50 text-foreground border border-border/40',
            'transition-opacity duration-150',
            'active:opacity-70',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          Request changes
        </button>

        {/* ── Approve (right, thumb-dominant) ───────────────────────── */}
        <button
          type="button"
          data-testid="mobile-review-approve-btn"
          aria-label="Approve and merge"
          onClick={handleApprove}
          disabled={isApproving || hasConflict || isRejecting}
          className={cn(
            'flex-1 min-h-[2.75rem] rounded-xl',
            'flex items-center justify-center',
            'text-sm font-semibold',
            'bg-primary text-primary-foreground',
            'transition-opacity duration-150',
            'active:opacity-80',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          {isApproving ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </MobileBottomActionBar>
  )
}
