/**
 * MobileChip — filter chip / tag pill for selection, filtering, and labelling.
 *
 * Token contract:
 *   selected   → bg-primary/15 border-primary/50 text-primary
 *   unselected → bg-muted/40 border-border/40 text-muted-foreground
 *
 * Touch targets: when interactive (onPress or onDismiss set), escalates to
 * min-h-[2.75rem] (44 px). Non-interactive chips keep min-h-[2rem].
 * Dismiss button hit area is padded to satisfy 44×44 requirement.
 *
 * No haptic on chip selection — only primary success actions vibrate.
 *
 * @param label       Chip display text.
 * @param selected    When true, renders in selected visual state.
 * @param leadingIcon Optional icon node before the label.
 * @param onPress     When provided, renders the chip as a button.
 * @param onDismiss   When provided, renders a trailing dismiss (X) button.
 * @param disabled    Dims chip and blocks interaction.
 * @param size        'sm' | 'md' — 'md' is default.
 *
 * @example
 * <MobileChip
 *   label="React"
 *   selected={activeFilter === 'react'}
 *   onPress={() => setFilter('react')}
 *   leadingIcon={<Tag className="h-3 w-3" />}
 * />
 * <MobileChip label="JavaScript" onDismiss={() => removeTag('js')} />
 */

import React from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MobileChipProps {
  label: string
  selected?: boolean
  leadingIcon?: React.ReactNode
  onPress?: () => void
  onDismiss?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function MobileChip({
  label,
  selected = false,
  leadingIcon,
  onPress,
  onDismiss,
  disabled = false,
  size = 'md',
}: MobileChipProps) {
  const isInteractive = !!onPress || !!onDismiss

  const chipClasses = cn(
    'inline-flex items-center gap-1.5 px-3 rounded-full',
    'text-xs font-medium border whitespace-nowrap',
    // Height — escalate to 44 px touch target when interactive
    isInteractive ? 'min-h-[2.75rem]' : (size === 'sm' ? 'min-h-[1.75rem]' : 'min-h-[2rem]'),
    // Colors
    selected
      ? 'bg-primary/15 border-primary/50 text-primary'
      : 'bg-muted/40 border-border/40 text-muted-foreground',
    disabled ? 'opacity-50 pointer-events-none' : '',
  )

  const chipContent = (
    <>
      {leadingIcon && (
        <span aria-hidden className="shrink-0">
          {leadingIcon}
        </span>
      )}
      <span>{label}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          data-testid="mobile-chip-dismiss"
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) onDismiss()
          }}
          className={cn(
            // Expand hit area to 44×44 while keeping visual size small
            'flex items-center justify-center shrink-0',
            '-mr-1.5 min-h-[2.75rem] min-w-[2.75rem]',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </>
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        data-testid="mobile-chip"
        className={cn(chipClasses, 'cursor-pointer transition-opacity duration-100 active:opacity-70')}
      >
        {chipContent}
      </button>
    )
  }

  return (
    <span data-testid="mobile-chip" className={chipClasses}>
      {chipContent}
    </span>
  )
}
