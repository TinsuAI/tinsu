import { Moon, Sun } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useThemeStore } from '@renderer/stores'

interface ThemeToggleProps {
  className?: string
}

/**
 * Animated theme toggle switch component.
 * Features a smooth sliding animation between sun (light) and moon (dark) icons.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'group relative flex h-8 w-16 items-center rounded-full p-1 transition-all duration-300',
        'border border-border/50',
        'bg-gradient-to-r',
        isDark
          ? 'from-slate-800 to-slate-900 shadow-inner shadow-slate-950/50'
          : 'from-amber-100 to-orange-100 shadow-md shadow-amber-200/50',
        'hover:scale-105 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Sliding indicator */}
      <span
        className={cn(
          'absolute flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ease-out',
          isDark
            ? 'translate-x-8 bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-violet-500/40'
            : 'translate-x-0 bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg shadow-orange-400/50'
        )}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-white" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-white" />
        )}
      </span>

      {/* Background icons */}
      <span
        className={cn(
          'absolute left-2 transition-opacity duration-300',
          isDark ? 'opacity-30' : 'opacity-0'
        )}
      >
        <Sun className="h-4 w-4 text-amber-400" />
      </span>
      <span
        className={cn(
          'absolute right-2 transition-opacity duration-300',
          isDark ? 'opacity-0' : 'opacity-30'
        )}
      >
        <Moon className="h-4 w-4 text-slate-400" />
      </span>
    </button>
  )
}
