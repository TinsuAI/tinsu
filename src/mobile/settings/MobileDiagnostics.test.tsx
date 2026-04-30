import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileDiagnostics } from './MobileDiagnostics'

/* ── Mocks ─────────────────────────────────────────────────────── */

const mockPopRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = { popRoute: mockPopRoute }
    return selector ? selector(state) : state
  },
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
})

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/api/app', () => ({
  getVersion: () => Promise.resolve('1.2.3'),
  getTauriVersion: () => Promise.resolve('2.0.0'),
}))
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => Promise.resolve('android'),
}))

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileDiagnostics', () => {
  it('renders diagnostic field rows', () => {
    render(<MobileDiagnostics />)
    expect(screen.getByTestId('diag-app-version')).toBeTruthy()
    expect(screen.getByTestId('diag-tauri-version')).toBeTruthy()
    expect(screen.getByTestId('diag-platform')).toBeTruthy()
    expect(screen.getByTestId('diag-db-path')).toBeTruthy()
  })

  it('loads app version from Tauri API', async () => {
    render(<MobileDiagnostics />)
    await waitFor(() => {
      expect(screen.getByText('1.2.3')).toBeTruthy()
    })
  })

  it('"Copy Diagnostics" button copies JSON to clipboard', async () => {
    render(<MobileDiagnostics />)
    await waitFor(() => {
      expect(screen.getByText('Copy Diagnostics')).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Copy Diagnostics'))
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled()
    })
    // Verify JSON was passed to clipboard
    const calledWith = mockWriteText.mock.calls[0][0] as string
    expect(() => JSON.parse(calledWith)).not.toThrow()
  })

  it('back button calls popRoute("settings")', () => {
    render(<MobileDiagnostics />)
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledWith('settings')
  })
})
