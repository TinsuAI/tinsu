/**
 * MobileSettingsRow — settings list row primitive for the mobile UI tree.
 *
 * Story T3.5-8: 16th mobile primitive (per UX redesign §7.2).
 *
 * Renders a tactile list row used in all settings screens. Supports:
 *   - Leading icon slot
 *   - Title + optional value (right-aligned, muted)
 *   - Optional subtitle below title
 *   - Trailing: 'chevron' | 'switch' | 'check' | ReactNode
 *   - Disabled state (dims + blocks interaction)
 *
 * Token contract: all colors via Calm Command tokens only.
 * No inline color classes (text-red-500, bg-blue-600, etc.).
 * Touch target: min-h-11 (44 px) — AC-18 non-negotiable.
 * Accessibility: role="listitem", aria-label derived from title + value.
 *
 * @param icon      Optional leading icon node (text-muted-foreground by default).
 * @param title     Row title.
 * @param value     Optional current-value text shown right-aligned (text-muted-foreground).
 * @param subtitle  Optional supporting text below title.
 * @param trailing  Trailing slot: 'chevron' | 'switch' | 'check' | ReactNode.
 * @param onPress   Makes the row a tappable button.
 * @param disabled  Dims and blocks interaction.
 */

import React from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MobileSettingsRowProps {
  icon?: React.ReactNode
  title: string
  value?: string
  subtitle?: string
  trailing?: 'chevron' | 'switch' | 'check' | React.ReactNode
  switchValue?: boolean
  onSwitchChange?: (value: boolean) => void
  onPress?: () => void
  disabled?: boolean
  'data-testid'?: string
}

export function MobileSettingsRow({
  icon,
  title,
  value,
  subtitle,
  trailing,
  switchValue,
  onSwitchChange,
  onPress,
  disabled = false,
  'data-testid': testId,
}: MobileSettingsRowProps) {
  const inner = (
    <>
      {/* Leading icon */}
      {icon && (
        <span
          className="text-muted-foreground shrink-0 flex items-center justify-center w-8 h-8"
          aria-hidden
        >
          {icon}
        </span>
      )}

      {/* Text block */}
      <span className="flex-1 flex flex-col min-w-0 gap-0.5">
        <span className="text-sm font-medium text-foreground leading-snug">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground leading-snug">
            {subtitle}
          </span>
        )}
      </span>

      {/* Value text (right-aligned, before trailing) */}
      {value && (
        <span className="text-sm text-muted-foreground shrink-0 ml-2 max-w-[40%] truncate text-right">
          {value}
        </span>
      )}

      {/* Trailing slot */}
      {trailing === 'chevron' && (
        <ChevronRight
          className="h-4 w-4 text-muted-foreground shrink-0 ml-1"
          aria-hidden
        />
      )}
      {trailing === 'check' && (
        <Check
          className="h-4 w-4 text-primary shrink-0 ml-1"
          aria-hidden
          data-testid="settings-row-check"
        />
      )}
      {trailing === 'switch' && (
        <SettingsToggle
          value={switchValue ?? false}
          onChange={onSwitchChange ?? (() => {})}
          disabled={disabled}
        />
      )}
      {trailing !== 'chevron' && trailing !== 'check' && trailing !== 'switch' && trailing != null && (
        <span className="shrink-0 ml-1">{trailing}</span>
      )}
    </>
  )

  const baseClasses = cn(
    'w-full flex items-center gap-3',
    'min-h-11 px-4 py-2.5',
    'border-b border-border/20',
    'text-left',
    disabled ? 'opacity-40 pointer-events-none' : '',
  )

  if (onPress) {
    return (
      <button
        type="button"
        role="listitem"
        onClick={onPress}
        disabled={disabled}
        aria-label={value ? `${title}: ${value}` : title}
        data-testid={testId ?? 'mobile-settings-row'}
        className={cn(
          baseClasses,
          'transition-colors duration-100',
          'active:bg-muted/30',
          'cursor-pointer',
        )}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      role="listitem"
      aria-label={title}
      data-testid={testId ?? 'mobile-settings-row'}
      className={baseClasses}
    >
      {inner}
    </div>
  )
}

/* ─── Inline Toggle ─────────────────────────────────────────────── */
// Token-driven toggle switch — NO import from src/components/ui/

interface SettingsToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function SettingsToggle({ value, onChange, disabled }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      data-testid="settings-row-switch"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!value)
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full',
        'transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        value ? 'bg-primary' : 'bg-muted/60 border border-border/40',
        disabled ? 'opacity-40 pointer-events-none' : '',
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
