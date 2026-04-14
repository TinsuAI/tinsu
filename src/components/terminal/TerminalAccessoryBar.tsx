import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Keyboard } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface TerminalAccessoryBarProps {
  onKeyPress: (key: string) => void
  className?: string
}

/**
 * TerminalAccessoryBar component - provides common CLI keys for mobile users.
 * 
 * Features:
 * - Tab, Ctrl, Alt, Esc buttons
 * - Arrow key navigation
 * - Keyboard toggle (optional)
 * - 44x44px touch targets
 */
export function TerminalAccessoryBar({ onKeyPress, className }: TerminalAccessoryBarProps) {
  const buttons = [
    { label: 'Tab', key: '\t' },
    { label: 'Ctrl', key: 'Ctrl' }, // Needs special handling in terminal
    { label: 'Alt', key: 'Alt' },   // Needs special handling in terminal
    { label: 'Esc', key: '\x1b' },
  ]

  const arrows = [
    { icon: ArrowUp, key: '\x1b[A', label: 'Up' },
    { icon: ArrowDown, key: '\x1b[B', label: 'Down' },
    { icon: ArrowLeft, key: '\x1b[D', label: 'Left' },
    { icon: ArrowRight, key: '\x1b[C', label: 'Right' },
  ]

  return (
    <div
      className={cn(
        'flex items-center justify-between h-12 w-full bg-[#18181b] border-t border-zinc-800 px-2 overflow-x-auto no-scrollbar touch-none',
        className
      )}
    >
      <div className="flex gap-1">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => onKeyPress(btn.key)}
            className="flex items-center justify-center min-w-[44px] h-[44px] px-3 rounded bg-zinc-800 text-zinc-300 text-xs font-medium active:bg-zinc-700 transition-colors select-none touch-manipulation"
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 ml-4">
        {arrows.map((arrow) => (
          <button
            key={arrow.label}
            type="button"
            onClick={() => onKeyPress(arrow.key)}
            className="flex items-center justify-center w-[44px] h-[44px] rounded bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-colors select-none touch-manipulation"
            aria-label={arrow.label}
          >
            <arrow.icon size={18} />
          </button>
        ))}
      </div>
    </div>
  )
}
