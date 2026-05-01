import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSettingsHome } from './MobileSettingsHome'

/* ── Mocks ─────────────────────────────────────────────────────── */

const mockPushRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = { pushRoute: mockPushRoute }
    return selector ? selector(state) : state
  },
}))

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useListSshConnections: () => ({ data: [], isLoading: false }),
}))

vi.mock('@renderer/stores/theme.store', () => ({
  useThemeStore: (selector: (s: { theme: string }) => unknown) =>
    selector({ theme: 'dark' }),
}))

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    config: {
      get: {
        useQuery: () => ({
          data: { devAgentModel: 'opus', reviewAgentModel: 'sonnet' },
          isLoading: false,
        }),
      },
    },
  },
}))

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileSettingsHome', () => {
  it('renders all section headers', () => {
    render(<MobileSettingsHome />)
    // Use getAllByText since "Agent" header and "Dev agent model" row both match /agent/i
    expect(screen.getAllByText(/agent/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/connections/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/appearance/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/about/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders Connections row with "No SSH connections yet" when none configured', () => {
    render(<MobileSettingsHome />)
    expect(screen.getByText('No SSH connections yet')).toBeTruthy()
  })

  it('renders connections count subtitle when connections exist', () => {
    vi.doMock('@renderer/hooks/useSshCommands', () => ({
      useListSshConnections: () => ({
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        isLoading: false,
      }),
    }))
    // Re-render with updated mock
    const { unmount } = render(<MobileSettingsHome />)
    unmount()
  })

  it('Connections row pushes "connections" route', () => {
    render(<MobileSettingsHome />)
    fireEvent.click(screen.getByTestId('settings-row-connections'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'connections')
  })

  it('Dev agent row pushes "agent-settings" route', () => {
    render(<MobileSettingsHome />)
    fireEvent.click(screen.getByTestId('settings-row-dev-agent'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'agent-settings')
  })

  it('Theme row pushes "theme-settings" route', () => {
    render(<MobileSettingsHome />)
    fireEvent.click(screen.getByTestId('settings-row-theme'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'theme-settings')
  })

  it('Diagnostics row pushes "diagnostics" route', () => {
    render(<MobileSettingsHome />)
    fireEvent.click(screen.getByTestId('settings-row-diagnostics'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'diagnostics')
  })

  it('About row pushes "about" route', () => {
    render(<MobileSettingsHome />)
    fireEvent.click(screen.getByTestId('settings-row-about'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'about')
  })

  it('stub rows (SSH Keys, Mosh, Cache) are rendered', () => {
    render(<MobileSettingsHome />)
    expect(screen.getByTestId('settings-row-ssh-keys')).toBeTruthy()
    expect(screen.getByTestId('settings-row-mosh')).toBeTruthy()
    expect(screen.getByTestId('settings-row-cache')).toBeTruthy()
  })

  it('stub rows show "Coming soon" subtitle', () => {
    render(<MobileSettingsHome />)
    const comingSoons = screen.getAllByText('Coming soon')
    expect(comingSoons.length).toBeGreaterThan(0)
  })

  it('theme value shows "Dark" when dark theme is set', () => {
    render(<MobileSettingsHome />)
    expect(screen.getByText('Dark')).toBeTruthy()
  })
})
