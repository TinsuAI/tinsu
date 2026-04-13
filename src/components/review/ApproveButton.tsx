import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

/**
 * ApproveButton component for the 60-Second Velocity Loop (Story 7.3).
 *
 * Styled with emerald/green color per UX spec. Shows keyboard shortcut "A".
 * Displays loading spinner during approval mutation.
 *
 * @example
 * ```tsx
 * <ApproveButton
 *   onClick={handleApprove}
 *   isPending={isApproving}
 *   disabled={task.status !== 'review'}
 * />
 * ```
 */
export interface ApproveButtonProps {
  /** Click handler for the approve action */
  onClick: () => void
  /** Whether the approval is in progress */
  isPending?: boolean
  /** Whether the button is disabled (e.g., task not in review or has merge conflicts) */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether disabled due to merge conflict (shows amber warning styling) */
  hasConflict?: boolean
}

export function ApproveButton({
  onClick,
  isPending = false,
  disabled = false,
  hasConflict = false,
  className
}: ApproveButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isPending}
      className={cn(
        'gap-2 text-white',
        // Normal state: emerald green
        !hasConflict && 'bg-emerald-600 hover:bg-emerald-700',
        // Conflict state: amber warning with border
        hasConflict && 'bg-amber-600/20 border-2 border-amber-500/50 text-amber-300 cursor-not-allowed',
        // Disabled state (non-conflict): muted green
        disabled && !hasConflict && 'bg-emerald-600/50 text-white/70',
        className
      )}
      size="sm"
      title={hasConflict ? 'Resolve merge conflicts before approving' : undefined}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      Approve
      <kbd className={cn(
        'ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
        hasConflict ? 'bg-amber-700/30' : 'bg-emerald-700/50'
      )}>
        A
      </kbd>
    </Button>
  )
}
