/**
 * MobileFab — floating action button (FAB) for primary screen actions.
 *
 * Token contract: bg-primary text-primary-foreground surface.
 * No inline color classes.
 *
 * Touch targets: icon-only FAB is h-14 w-14 (56 px — exceeds 44 px minimum, UX-DR7).
 * Extended FAB is min-h-14 px-5 w-auto with label and leading icon.
 *
 * Position: 'bottom-right' (default) → right-4, bottom clears 56 px tab bar + 16 px breath.
 *           'bottom-center' → left-1/2 -translate-x-1/2.
 *
 * Animation: scale 0→1 on mount via CSS animation (instant under reduced-motion).
 * Haptic: hapticFeedback(10) on press unless reduced-motion (calm design intent).
 *
 * Accessibility: `ariaLabel` is REQUIRED (not optional) — icon-only FAB must be accessible.
 *
 * @param icon      Icon node rendered inside the FAB.
 * @param label     When provided, FAB renders in extended form with this label.
 * @param onPress   Required press handler.
 * @param disabled  Blocks interaction and dims button.
 * @param ariaLabel REQUIRED. Accessible label for screen readers.
 * @param position  'bottom-right' | 'bottom-center'. Default: 'bottom-right'.
 *
 * @example
 * <MobileFab
 *   icon={<Plus className="h-6 w-6" />}
 *   ariaLabel="Create new task"
 *   onPress={openCreateDialog}
 * />
 * <MobileFab
 *   icon={<Plus className="h-6 w-6" />}
 *   label="New Task"
 *   ariaLabel="Create new task"
 *   onPress={openCreateDialog}
 * />
 */

import { cn, hapticFeedback } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type FabPosition = 'bottom-right' | 'bottom-center'

interface MobileFabProps {
  icon: React.ReactNode
  label?: string
  onPress: () => void
  disabled?: boolean
  ariaLabel: string
  position?: FabPosition
}

export function MobileFab({
  icon,
  label,
  onPress,
  disabled = false,
  ariaLabel,
  position = 'bottom-right',
}: MobileFabProps) {
  const reduced = useReducedMotion()

  const handlePress = () => {
    if (disabled) return
    if (!reduced) hapticFeedback(10)
    onPress()
  }

  const positionClasses: Record<FabPosition, string> = {
    'bottom-right': 'right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)]',
  }

  const isExtended = !!label

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid="mobile-fab"
      onClick={handlePress}
      disabled={disabled}
      className={cn(
        'fixed z-40 flex items-center justify-center',
        'bg-primary text-primary-foreground',
        'shadow-xl rounded-full',
        'transition-opacity duration-150',
        // Size — icon-only is 56×56; extended is 56 px tall, width-auto
        isExtended
          ? 'min-h-14 px-5 gap-2 w-auto'
          : 'h-14 w-14',
        // Position
        positionClasses[position],
        // Mount animation — scale-in
        reduced
          ? 'scale-100'
          : 'animate-[fab-scale-in_200ms_cubic-bezier(0.34,1.56,0.64,1)_both]',
        disabled ? 'opacity-50 pointer-events-none' : '',
      )}
    >
      {icon}
      {label && (
        <span className="text-sm font-semibold whitespace-nowrap">{label}</span>
      )}
    </button>
  )
}
