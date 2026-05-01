import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileThemeSettings } from './MobileThemeSettings'

/* ── Mocks ─────────────────────────────────────────────────────── */

const mockPopRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = { popRoute: mockPopRoute }
    return selector ? selector(state) : state
  },
}))

const mockSetTheme = vi.fn()
vi.mock('@renderer/stores/theme.store', () => ({
  useThemeStore: (selector: (s: { theme: string; setTheme: (t: string) => void }) => unknown) =>
    selector({ theme: 'light', setTheme: mockSetTheme }),
}))

// Mock localStorage
const mockLocalStorage: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockLocalStorage[key] = val },
    removeItem: (key: string) => { delete mockLocalStorage[key] },
  },
  writable: true,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn(() => ({ matches: false })),
  writable: true,
})

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k])
})

describe('MobileThemeSettings', () => {
  it('renders all three theme options', () => {
    render(<MobileThemeSettings />)
    expect(screen.getByTestId('theme-option-light')).toBeTruthy()
    expect(screen.getByTestId('theme-option-dark')).toBeTruthy()
    expect(screen.getByTestId('theme-option-system')).toBeTruthy()
  })

  it('shows check mark on currently active theme (light)', () => {
    render(<MobileThemeSettings />)
    // The light option should have a check trailing
    const lightRow = screen.getByTestId('theme-option-light')
    // check mark is inside the row
    expect(lightRow.querySelector('[data-testid="settings-row-check"]')).toBeTruthy()
  })

  it('calls setTheme when a theme is selected', () => {
    render(<MobileThemeSettings />)
    fireEvent.click(screen.getByTestId('theme-option-dark'))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('persists selection to localStorage', () => {
    render(<MobileThemeSettings />)
    fireEvent.click(screen.getByTestId('theme-option-dark'))
    expect(mockLocalStorage['tinsu.theme.mode']).toBe('dark')
  })

  it('back button calls popRoute("settings")', () => {
    render(<MobileThemeSettings />)
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledWith('settings')
  })
})
