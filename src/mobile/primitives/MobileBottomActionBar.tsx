/**
 * MobileBottomActionBar — sticky bottom contextual action bar.
 *
 * Renders one or two action buttons above the safe-area inset. Primary button
 * is thumb-dominant (right side); secondary is on the left. Each button is
 * min-h-[2.75rem] flex-1 (≥44 px height UX-DR7).
 *
 * Token contract: bg-card/95 frosted-glass surface, backdrop-blur-xl,
 * border-border/40 top separator. Button variants:
 *   primary   → bg-primary text-primary-foreground
 *   destructive → bg-destructive text-destructive-foreground
 *   success   → bg-primary text-primary-foreground (no separate --success token)
 *
 * Haptic: primary button fires hapticFeedback(10) on press unless reduced-motion.
 * Secondary button does NOT vibrate.
 *
 * Escape hatch: when `children` is provided, renders children instead of
 * the primary/secondary button layout.
 *
 * @param primary    Primary action descriptor (right side, haptic on press).
 * @param secondary  Secondary action descriptor (left side, no haptic).
 * @param children   Escape hatch — custom content instead of default button layout.
 *
 * @example
 * <MobileBottomActionBar
 *   primary={{ label: 'Approve', onPress: handleApprove }}
 *   secondary={{ label: 'Reject', onPress: handleReject }}
 * />
 */

import { cn, hapticFeedback } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type ButtonVariant = 'primary' | 'destructive' | 'success'

interface ActionButton {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: ButtonVariant
  /** Optional override aria-label for the button (e.g. "Edit (Coming soon)"). Defaults to label. */
  ariaLabel?: string
}

interface MobileBottomActionBarProps {
  primary?: ActionButton
  secondary?: ActionButton
  children?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-primary text-primary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  success:     'bg-primary text-primary-foreground', // No separate --success token
}

export function MobileBottomActionBar({
  primary,
  secondary,
  children,
}: MobileBottomActionBarProps) {
  const reduced = useReducedMotion()

  const handlePrimaryPress = () => {
    if (primary?.disabled) return
    if (!reduced) hapticFeedback(10)
    primary?.onPress()
  }

  return (
    <div
      data-testid="mobile-bottom-action-bar"
      className="sticky bottom-0 w-full bg-card/95 backdrop-blur-xl border-t border-border/40 shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {children ?? (
          <>
            {/* Secondary action — left side, no haptic */}
            {secondary && (
              <button
                type="button"
                data-testid="mobile-bottom-action-secondary"
                aria-label={secondary.ariaLabel ?? secondary.label}
                onClick={secondary.onPress}
                disabled={secondary.disabled}
                className={cn(
                  'flex-1 min-h-[2.75rem] rounded-xl',
                  'flex items-center justify-center',
                  'text-sm font-medium',
                  'bg-muted/50 text-foreground',
                  'border border-border/40',
                  'transition-opacity duration-150',
                  'disabled:opacity-50 disabled:pointer-events-none',
                )}
              >
                {secondary.label}
              </button>
            )}

            {/* Primary action — right side, haptic on press */}
            {primary && (
              <button
                type="button"
                data-testid="mobile-bottom-action-primary"
                aria-label={primary.ariaLabel ?? primary.label}
                onClick={handlePrimaryPress}
                disabled={primary.disabled}
                className={cn(
                  'flex-1 min-h-[2.75rem] rounded-xl',
                  'flex items-center justify-center',
                  'text-sm font-semibold',
                  variantClasses[primary.variant ?? 'primary'],
                  'transition-opacity duration-150',
                  'disabled:opacity-50 disabled:pointer-events-none',
                )}
              >
                {primary.label}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
