/**
 * MobileSearchBar — full-width search input with leading icon and trailing clear.
 *
 * Token contract: bg-muted/40 pill container, border-border/40 border,
 * text-foreground input text, text-muted-foreground placeholder + icons.
 * No inline color classes.
 *
 * Touch targets: clear button hit area min-h-[2.75rem] min-w-[2.75rem] (44 px UX-DR7).
 * Container height: h-11 (44 px).
 *
 * No haptic on search interactions — neutral text input.
 *
 * @param value       Controlled value string.
 * @param onChange    Fires with new value on every keystroke.
 * @param placeholder Input placeholder text.
 * @param onSubmit    Fires with current value when Enter is pressed.
 * @param onClear     Optional extra callback when clear button is pressed.
 * @param autoFocus   When true, input is focused on mount.
 * @param ariaLabel   Accessible label for the input (default: 'Search').
 *
 * @example
 * <MobileSearchBar
 *   value={query}
 *   onChange={setQuery}
 *   placeholder="Search tasks…"
 *   onSubmit={handleSearch}
 * />
 */

import { Search, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MobileSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSubmit?: (value: string) => void
  onClear?: () => void
  autoFocus?: boolean
  ariaLabel?: string
}

export function MobileSearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  onSubmit,
  onClear,
  autoFocus = false,
  ariaLabel = 'Search',
}: MobileSearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit?.(value)
    }
  }

  const handleClear = () => {
    onChange('')
    onClear?.()
  }

  return (
    <div
      data-testid="mobile-search-bar"
      className={cn(
        'relative w-full h-11 flex items-center gap-2 px-4',
        'rounded-full bg-muted/40 border border-border/40',
      )}
    >
      {/* Leading search icon */}
      <Search
        className="h-4 w-4 text-muted-foreground shrink-0"
        aria-hidden
      />

      {/* Input */}
      <input
        type="search"
        aria-label={ariaLabel}
        data-testid="mobile-search-bar-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'flex-1 bg-transparent outline-none',
          'text-sm text-foreground',
          'placeholder:text-muted-foreground',
          // Remove browser default search input chrome
          '[&::-webkit-search-cancel-button]:hidden',
          '[&::-webkit-search-decoration]:hidden',
        )}
      />

      {/* Trailing clear button — only when value is non-empty */}
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          data-testid="mobile-search-bar-clear"
          onClick={handleClear}
          className={cn(
            'flex items-center justify-center',
            'min-h-[2.75rem] min-w-[2.75rem] -mr-2',
            'text-muted-foreground',
            'transition-opacity duration-100 active:opacity-60',
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
