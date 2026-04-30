/**
 * MobileConnectionsListScreen tests — AC 1, 3, 4, 5, 6
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileConnectionsListScreen } from './MobileConnectionsListScreen'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockUseListSshConnections = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useListSshConnections: () => mockUseListSshConnections(),
  useListSshKeys: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useTestSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCreateSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useInstallSshKey: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

/* ─── Mock: mobile-nav.store ─────────────────────────────────────────── */

const mockPushRoute = vi.fn()

vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = { activeTab: 'settings', pushRoute: mockPushRoute, popRoute: vi.fn() }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({
          activeTab: 'settings',
          pushRoute: mockPushRoute,
          popRoute: vi.fn(),
        })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
  }
})

/* ─── Mock: @tanstack/react-query ────────────────────────────────────── */

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  }
})

/* ─── Mock: Radix Dialog Portal ──────────────────────────────────────── */

vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

/* ─── Mock: useReducedMotion ─────────────────────────────────────────── */

vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

/* ─── Mock: hapticFeedback / utils ───────────────────────────────────── */

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

/* ─── Mock: sonner ───────────────────────────────────────────────────── */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

/* ─── Fixtures ───────────────────────────────────────────────────────── */

const MOCK_CONNECTIONS = [
  {
    id: 'conn-1',
    host: 'example.com',
    port: 22,
    username: 'alice',
    auth_method: 'key',
    key_name: 'my-key',
    created_at: 1700000000,
  },
  {
    id: 'conn-2',
    host: '192.168.1.10',
    port: 2222,
    username: 'bob',
    auth_method: 'key',
    key_name: 'server-key',
    created_at: 1700000100,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileConnectionsListScreen', () => {
  it('renders screen root with correct testid', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByTestId('mobile-connections-screen')).toBeInTheDocument()
  })

  it('renders loading skeletons while loading', () => {
    mockUseListSshConnections.mockReturnValue({ data: [], isLoading: true, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getAllByTestId('mobile-loading-skeleton-list-row').length).toBeGreaterThanOrEqual(4)
  })

  it('renders error empty state on error', () => {
    mockUseListSshConnections.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Network error'),
    })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByTestId('mobile-empty-state')).toBeInTheDocument()
    expect(screen.getByText("Couldn't load connections")).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders empty state with Add Connection CTA when no data', () => {
    mockUseListSshConnections.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByTestId('mobile-empty-state')).toBeInTheDocument()
    expect(screen.getByText('No connections yet')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-connections-empty-cta')).toBeInTheDocument()
  })

  it('FAB is NOT shown in empty state', () => {
    mockUseListSshConnections.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.queryByTestId('mobile-fab')).not.toBeInTheDocument()
  })

  it('renders FAB when data is present', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByTestId('mobile-fab')).toBeInTheDocument()
  })

  it('FAB press pushes connection-form:new', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    fireEvent.click(screen.getByTestId('mobile-fab'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'connection-form:new')
  })

  it('empty state CTA press pushes connection-form:new', () => {
    mockUseListSshConnections.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    fireEvent.click(screen.getByTestId('mobile-connections-empty-cta'))
    expect(mockPushRoute).toHaveBeenCalledWith('settings', 'connection-form:new')
  })

  it('renders rows for each connection', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByTestId('mobile-connection-row-conn-1')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-connection-row-conn-2')).toBeInTheDocument()
  })

  it('renders connection host as row title', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.10')).toBeInTheDocument()
  })

  it('renders mono subtitle with username@host:port format', () => {
    mockUseListSshConnections.mockReturnValue({ data: MOCK_CONNECTIONS, isLoading: false, error: null })
    render(<MobileConnectionsListScreen />)
    expect(screen.getByText('alice@example.com:22')).toBeInTheDocument()
    expect(screen.getByText('bob@192.168.1.10:2222')).toBeInTheDocument()
  })
})
