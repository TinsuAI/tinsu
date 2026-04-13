import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectSwitcher } from '../ProjectSwitcher'
import { useProjectStore } from '@renderer/stores/project.store'

// ── Mock @renderer/lib/rspc ───────────────────────────────────────────────────

const mockListRecentProjects = vi.fn()
const mockListRemoteProjects = vi.fn()
const mockGetRemoteHookStatus = vi.fn()
const mockOpenRemoteProject = vi.fn()
const mockStartRemoteHookForwarder = vi.fn()
const mockOpenProjectByPath = vi.fn()
const mockRemoveProject = vi.fn()
const mockOpenProjectDialog = vi.fn()
const mockListSshConnections = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listRecentProjects: (input: unknown) => mockListRecentProjects(input),
    listRemoteProjects: () => mockListRemoteProjects(),
    getRemoteHookStatus: (id: string) => mockGetRemoteHookStatus(id),
    openRemoteProject: (id: string) => mockOpenRemoteProject(id),
    startRemoteHookForwarder: (id: string) => mockStartRemoteHookForwarder(id),
    openProjectByPath: (path: string) => mockOpenProjectByPath(path),
    removeProject: (id: string) => mockRemoveProject(id),
    openProjectDialog: () => mockOpenProjectDialog(),
    listSshConnections: () => mockListSshConnections(),
  },
}))

// ── Mock sonner ───────────────────────────────────────────────────────────────

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

// ── Mock ProjectSetupDialog ───────────────────────────────────────────────────

vi.mock('@renderer/components/ProjectSetupDialog', () => ({
  ProjectSetupDialog: () => null,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeRemoteProject = (overrides = {}) => ({
  id: 'rp-1',
  connection_id: 'conn-1',
  name: 'remote-repo',
  path: '/home/user/remote-repo',
  created_at: 1000,
  ...overrides,
})

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

function openPopover() {
  const trigger = screen.getByTestId('project-switcher-trigger')
  fireEvent.click(trigger)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectSwitcher — Remote Projects (AC: 1, 2, 3, 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    mockListRecentProjects.mockResolvedValue({ status: 'ok', data: [] })
    mockListRemoteProjects.mockResolvedValue({ status: 'ok', data: [] })
    mockGetRemoteHookStatus.mockResolvedValue({ status: 'ok', data: { is_active: false, remote_port: null } })
    mockOpenRemoteProject.mockResolvedValue({
      status: 'ok',
      data: {
        id: 'p1',
        name: 'remote-repo',
        path: '/home/user/remote-repo',
        created_at: 1000,
        last_opened_at: null,
        remote_project_id: 'rp-1',
      },
    })
    mockStartRemoteHookForwarder.mockResolvedValue({ status: 'ok', data: { is_active: true, remote_port: 3847 } })
    mockListSshConnections.mockResolvedValue({ status: 'ok', data: [] })

    // Reset project store
    useProjectStore.setState({
      projectPath: null,
      projectName: 'TestProject',
      activeProjectId: null,
      remoteProjectId: null,
      remoteConnectionId: null,
    })
  })

  // AC1: Remote projects section renders when listRemoteProjects returns data
  it('renders remote projects section when data is available', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeRemoteProject()],
    })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    // Wait for the remote project row to appear (data loaded)
    await waitFor(() => {
      expect(screen.getByTestId('remote-project-rp-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('project-switcher-remote-section')).toBeInTheDocument()
    expect(screen.getByText('remote-repo')).toBeInTheDocument()
  })

  // AC1: Empty state when no remote projects
  it('shows "No remote projects" when listRemoteProjects returns empty array', async () => {
    mockListRemoteProjects.mockResolvedValue({ status: 'ok', data: [] })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    await waitFor(() => {
      expect(screen.getByText('No remote projects')).toBeInTheDocument()
    })

    expect(screen.getByTestId('project-switcher-remote-section')).toBeInTheDocument()
  })

  // AC2: Connection badge shows "Disconnected" when is_active = false
  it('shows Disconnected badge when getRemoteHookStatus.is_active is false', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeRemoteProject()],
    })
    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: false, remote_port: null },
    })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    // Wait for the badge to resolve from "Connecting" (pending) to "Disconnected"
    await waitFor(() => {
      const badge = screen.getByTestId('connection-badge-conn-1')
      expect(badge).toHaveTextContent('Disconnected')
    })
  })

  // AC2: Connection badge shows "Connected" when is_active = true
  it('shows Connected badge when getRemoteHookStatus.is_active is true', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeRemoteProject()],
    })
    mockGetRemoteHookStatus.mockResolvedValue({
      status: 'ok',
      data: { is_active: true, remote_port: 3847 },
    })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    // Wait for the badge to resolve from "Connecting" (pending) to "Connected"
    await waitFor(() => {
      const badge = screen.getByTestId('connection-badge-conn-1')
      expect(badge).toHaveTextContent('Connected')
    })
  })

  // AC3: Clicking remote project calls openRemoteProject then startRemoteHookForwarder
  it('calls openRemoteProject and startRemoteHookForwarder when clicking a remote project', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeRemoteProject()],
    })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    await waitFor(() => {
      expect(screen.getByTestId('remote-project-rp-1')).toBeInTheDocument()
    })

    const row = screen.getByTestId('remote-project-rp-1')
    const button = row.querySelector('button')!
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockOpenRemoteProject).toHaveBeenCalledWith('rp-1')
    })

    await waitFor(() => {
      expect(mockStartRemoteHookForwarder).toHaveBeenCalledWith('conn-1')
    })
  })

  // AC5: (current) indicator for active remote project
  it('shows (current) indicator when the remote project matches store remoteProjectId', async () => {
    useProjectStore.setState({
      projectPath: null,
      projectName: 'remote-repo',
      activeProjectId: 'p1',
      remoteProjectId: 'rp-1',
      remoteConnectionId: 'conn-1',
    })

    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeRemoteProject({ id: 'rp-1' })],
    })

    renderWithQuery(<ProjectSwitcher />)
    openPopover()

    await waitFor(() => {
      expect(screen.getByTestId('remote-project-rp-1')).toBeInTheDocument()
    })

    expect(screen.getByText('(current)')).toBeInTheDocument()
  })
})

// ── Header reconnect button (AC4) ─────────────────────────────────────────────
// Reconnect button tests live in Header.test.tsx since they test the Header component
