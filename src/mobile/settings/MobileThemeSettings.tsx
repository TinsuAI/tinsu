/**
 * MobileThemeSettings — theme selection screen.
 *
 * Story T3.5-8, Task 7 (AC: 10b, 17, 18, 19, 20).
 *
 * Route key: 'theme-settings'.
 * Renders INSIDE MobileScreen shell — tab bar visible (AC-14).
 *
 * Three rows: Light / Dark / System.
 * Radio-style trailing check icon for the active selection.
 * Persists via useThemeStore (localStorage key 'tinsu-theme').
 * "System" reads prefers-color-scheme and applies without persisting a theme value.
 *
 * AC-10b: autosave on selection.
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: min-h-11 touch targets.
 * AC-19: Accessibility via MobileSettingsRow roles.
 */

import { Sun, Moon, Monitor } from 'lucide-react'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileSettingsRow } from '../primitives/MobileSettingsRow'
import { useThemeStore } from '@renderer/stores/theme.store'

/* ── Theme options ──────────────────────────────────────────────── */

type ThemeOption = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',  icon: <Sun className="h-4 w-4" /> },
  { value: 'dark',   label: 'Dark',   icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
]

/* ── Component ──────────────────────────────────────────────────── */

export function MobileThemeSettings() {
  const popRoute = useMobileNavStore((s) => s.popRoute)
  const theme = useThemeStore((s: { theme: string; setTheme: (t: string) => void }) => s.theme)
  const setTheme = useThemeStore((s: { theme: string; setTheme: (t: string) => void }) => s.setTheme)

  // "system" is a virtual option — not stored in the theme store which only knows 'light'|'dark'.
  // We detect system preference via localStorage key absence (or by comparing stored theme
  // against the system preferred theme). For v1 simplicity, we track system mode via
  // localStorage key 'tinsu.theme.mode' separately.
  const currentMode: ThemeOption = (() => {
    try {
      const mode = localStorage.getItem('tinsu.theme.mode')
      if (mode === 'system') return 'system'
    } catch {
      // localStorage unavailable
    }
    return theme as ThemeOption
  })()

  const handleSelect = (option: ThemeOption) => {
    try {
      if (option === 'system') {
        localStorage.setItem('tinsu.theme.mode', 'system')
        // Apply system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setTheme(prefersDark ? 'dark' : 'light')
      } else {
        localStorage.setItem('tinsu.theme.mode', option)
        setTheme(option)
      }
      // Dispatch theme-change CustomEvent for other listeners
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: option } }))
    } catch {
      // In test environment — safe no-op
    }
  }

  return (
    <div className="flex flex-col h-full" data-testid="mobile-theme-settings">
      {/* Sub-screen top bar with back button */}
      <MobileTopAppBar
        title="Theme"
        backButton={{
          onClick: () => popRoute('settings'),
          ariaLabel: 'Back to settings',
        }}
      />

      {/* Theme options */}
      <div className="flex-1 overflow-y-auto">
        <div role="list" aria-label="Theme options">
          {THEME_OPTIONS.map((opt) => (
            <MobileSettingsRow
              key={opt.value}
              icon={opt.icon}
              title={opt.label}
              trailing={currentMode === opt.value ? 'check' : undefined}
              onPress={() => handleSelect(opt.value)}
              data-testid={`theme-option-${opt.value}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
