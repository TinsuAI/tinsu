/**
 * MobileListItem — standard list row for settings, task lists, menus, etc.
 *
 * When `onPress` is provided, renders as a full-width `<button>` (≥44 px height UX-DR7).
 * When `onPress` is absent, renders as a `<div role="listitem">`.
 *
 * Token contract: text-foreground (title), text-muted-foreground (subtitle/icon),
 * text-destructive (destructive title), border-border/30 row separator.
 * No inline color classes.
 *
 * Touch targets: full-width button is min-h-[3.25rem] (≥52 px);
 * toggle switch hit area is handled by the toggle element.
 *
 * Trailing variants:
 *   'chevron' → lucide ChevronRight 16 px
 *   'toggle'  → inline token-driven toggle switch (no desktop shadcn import)
 *   ReactNode → rendered as-is
 *
 * @param title           Row title (text-sm, text-foreground; text-destructive if destructive).
 * @param leadingIcon     Optional icon node on the left.
 * @param subtitle        Optional supporting text below title (text-xs, text-muted-foreground).
 * @param trailing        Trailing element: 'chevron' | 'toggle' | ReactNode.
 * @param toggleValue     Current toggle state (used when trailing='toggle').
 * @param onToggleChange  Fires with new value when toggle is clicked.
 * @param onPress         When provided, makes the row a tappable button.
 * @param destructive     When true, renders title in text-destructive color.
 * @param disabled        When true, dims the row and blocks all interactions.
 *
 * @example
 * <MobileListItem
 *   leadingIcon={<Bell className="h-4 w-4" />}
 *   title="Notifications"
 *   trailing="toggle"
 *   toggleValue={enabled}
 *   onToggleChange={setEnabled}
 * />
 */

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MobileListItemProps {
  leadingIcon?: React.ReactNode
  title: string
  subtitle?: string
  trailing?: 'chevron' | 'toggle' | React.ReactNode
  toggleValue?: boolean
  onToggleChange?: (value: boolean) => void
  onPress?: () => void
  destructive?: boolean
  disabled?: boolean
}

export function MobileListItem({
  leadingIcon,
  title,
  subtitle,
  trailing,
  toggleValue,
  onToggleChange,
  onPress,
  destructive = false,
  disabled = false,
}: MobileListItemProps) {
  const inner = (
    <>
      {/* Leading icon */}
      {leadingIcon && (
        <span
          className="text-muted-foreground shrink-0 flex items-center justify-center"
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}

      {/* Text block */}
      <span className="flex-1 flex flex-col min-w-0">
        <span
          className={cn(
            'text-sm leading-snug',
            destructive ? 'text-destructive' : 'text-foreground',
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground mt-0.5 leading-snug truncate">
            {subtitle}
          </span>
        )}
      </span>

      {/* Trailing slot */}
      {trailing === 'chevron' && (
        <ChevronRight
          className="h-4 w-4 text-muted-foreground shrink-0"
          aria-hidden
        />
      )}
      {trailing === 'toggle' && (
        <InlineToggle
          value={toggleValue ?? false}
          onChange={onToggleChange ?? (() => {})}
          disabled={disabled}
        />
      )}
      {trailing !== 'chevron' && trailing !== 'toggle' && trailing != null && (
        <span className="shrink-0">{trailing}</span>
      )}
    </>
  )

  const commonClasses = cn(
    'w-full flex items-center gap-3',
    'min-h-[3.25rem] px-4 py-3',
    'border-b border-border/30',
    'text-left',
    disabled ? 'opacity-50 pointer-events-none' : '',
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        data-testid="mobile-list-item"
        className={cn(commonClasses, 'transition-colors duration-100 active:bg-muted/20')}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      role="listitem"
      data-testid="mobile-list-item"
      className={commonClasses}
    >
      {inner}
    </div>
  )
}

/* ─── Inline Toggle ─────────────────────────────────────────────── */
// Minimal token-driven toggle — does NOT import from src/components/ui/

interface InlineToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function InlineToggle({ value, onChange, disabled }: InlineToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      data-testid="mobile-list-item-toggle"
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        value ? 'bg-primary' : 'bg-muted/50 border border-border/40',
        disabled ? 'opacity-50 pointer-events-none' : '',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow-sm',
          'transition-transform duration-200',
          value ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}
