import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from '../Header'
import { useProjectStore } from '@renderer/stores/project.store'

// ── Mock commands ─────────────────────────────────────────────────────────────

const mockGetRemoteHookStatus = vi.fn()
const mockStartRemoteHookForwarder = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getRemoteHookStatus: (id: string) => mockGetRemoteHookStatus(id),
    startRemoteHookForwarder: (id: string) => mockStartRemoteHookForwarder(id),
  },
}))

// ── Mock recharts ─────────────────────────────────────────────────────────────

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 64, height: 24 }}>{children}</div>
    ),
  }
})

// ── Mock ProjectSwitcher ──────────────────────────────────────────────────────

vi.mock('@renderer/components/project', () => ({
  ProjectSwitcher: () => <span data-testid="project-switcher-mock" />,
}))

// ── Mock legacy tRPC (VelocityWidget, FilterPanel) ────────────────────────────

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    epics: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } },
    sprints: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } },
    velocity: {
      getWeeklyVelocity: {
        useQuery: vi.fn(() => ({
          data: { weeks: [], totalCompleted: 0, avgVelocity: 0 },
          isLoading: false,
        })),
      },
      getDailyVelocity: {
        useQuery: vi.fn(() => ({
          data: { days: [], totalCompleted: 0 },
          isLoading: false,
        })),
      },
    },
  },
}))

// ── Mock sonner ───────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Header — Reconnect Remote Button (AC9, T2.8 Task 5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: false, remote_port: null },
    })
    mockStartRemoteHookForwarder.mockResolvedValue({
      status: 'ok',
      data: { is_active: true, remote_port: 3847 },
    })

    // Default: no remote project active
    useProjectStore.setState({
      projectPath: '/home/user/local',
      projectName: 'TestProject',
      activeProjectId: 'p1',
      remoteProjectId: null,
      remoteConnectionId: null,
    })
  })

  it('renders Reconnect button when remote project is active and hook is inactive', async () => {
    useProjectStore.setState({
      projectPath: '/home/user/local',
      projectName: 'remote-repo',
      activeProjectId: 'p1',
      remoteProjectId: 'rp1',
      remoteConnectionId: 'conn1',
    })

    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: false, remote_port: null },
    })

    renderWithQuery(<Header />)

    await waitFor(() => {
      expect(screen.getByTestId('reconnect-remote-button')).toBeInTheDocument()
    })
  })

  it('hides Reconnect button when no remote project is active', async () => {
    // remoteProjectId = null (default state)
    renderWithQuery(<Header />)

    // Give React Query a chance to settle
    await waitFor(() => {
      expect(screen.queryByTestId('reconnect-remote-button')).not.toBeInTheDocument()
    })
  })

  it('hides Reconnect button when hook is active', async () => {
    useProjectStore.setState({
      projectPath: '/home/user/local',
      projectName: 'remote-repo',
      activeProjectId: 'p1',
      remoteProjectId: 'rp1',
      remoteConnectionId: 'conn1',
    })

    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: true, remote_port: 3847 },
    })

    renderWithQuery(<Header />)

    // Wait for query to resolve then verify button is absent
    await waitFor(() => {
      expect(screen.queryByTestId('reconnect-remote-button')).not.toBeInTheDocument()
    })
  })

  it('calls startRemoteHookForwarder when Reconnect button is clicked', async () => {
    useProjectStore.setState({
      projectPath: '/home/user/local',
      projectName: 'remote-repo',
      activeProjectId: 'p1',
      remoteProjectId: 'rp1',
      remoteConnectionId: 'conn1',
    })

    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: false, remote_port: null },
    })

    renderWithQuery(<Header />)

    await waitFor(() => {
      expect(screen.getByTestId('reconnect-remote-button')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('reconnect-remote-button'))

    await waitFor(() => {
      expect(mockStartRemoteHookForwarder).toHaveBeenCalledWith('conn1')
    })
  })
})
