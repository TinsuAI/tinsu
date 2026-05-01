import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileAgentSettings } from './MobileAgentSettings'

/* ── Mocks ─────────────────────────────────────────────────────── */

const mockPopRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = { popRoute: mockPopRoute }
    return selector ? selector(state) : state
  },
}))

const mockMutate = vi.fn()
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    config: {
      get: {
        useQuery: () => ({
          data: { devAgentModel: 'opus', reviewAgentModel: 'sonnet' },
          isLoading: false,
        }),
      },
      update: {
        useMutation: () => ({
          mutate: mockMutate,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      config: {
        get: { invalidate: vi.fn() },
      },
    }),
  },
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileAgentSettings', () => {
  it('renders current dev agent model value', () => {
    render(<MobileAgentSettings />)
    expect(screen.getByText('Claude Opus')).toBeTruthy()
  })

  it('renders current review agent model value', () => {
    render(<MobileAgentSettings />)
    expect(screen.getByText('Claude Sonnet')).toBeTruthy()
  })

  it('opens picker sheet when dev agent row is tapped', async () => {
    render(<MobileAgentSettings />)
    fireEvent.click(screen.getByTestId('agent-row-dev'))
    await waitFor(() => {
      expect(screen.getByTestId('mobile-sheet-content')).toBeTruthy()
    })
  })

  it('calls updateConfig when model is selected from picker', async () => {
    render(<MobileAgentSettings />)
    fireEvent.click(screen.getByTestId('agent-row-dev'))
    await waitFor(() => {
      expect(screen.getByTestId('model-option-haiku')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('model-option-haiku'))
    expect(mockMutate).toHaveBeenCalledWith({ devAgentModel: 'haiku' })
  })

  it('back button calls popRoute("settings")', () => {
    render(<MobileAgentSettings />)
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledWith('settings')
  })
})
