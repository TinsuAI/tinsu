import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileAbout } from './MobileAbout'

/* ── Mocks ─────────────────────────────────────────────────────── */

const mockPopRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = { popRoute: mockPopRoute }
    return selector ? selector(state) : state
  },
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: () => Promise.resolve('1.0.0'),
}))

const mockToast = vi.fn()
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}))

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileAbout', () => {
  it('renders TinSu app title', () => {
    render(<MobileAbout />)
    expect(screen.getByText('TinSu')).toBeTruthy()
  })

  it('renders back button that calls popRoute', () => {
    render(<MobileAbout />)
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledWith('settings')
  })

  it('stub rows have "Coming soon" subtitle', () => {
    render(<MobileAbout />)
    const comingSoons = screen.getAllByText('Coming soon')
    expect(comingSoons.length).toBeGreaterThanOrEqual(3)
  })

  it('tapping stub row shows toast', () => {
    render(<MobileAbout />)
    fireEvent.click(screen.getByTestId('about-row-website'))
    expect(mockToast).toHaveBeenCalled()
  })
})
