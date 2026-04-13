import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RemoteProjectsPanel } from './RemoteProjectsPanel'

// ── Mock commands ─────────────────────────────────────────────────────────────

const mockListRemoteProjects = vi.fn()
const mockListSshConnections = vi.fn()
const mockSaveRemoteProject = vi.fn()
const mockDeleteRemoteProject = vi.fn()
const mockDiscoverRemoteProjects = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listRemoteProjects: () => mockListRemoteProjects(),
    listSshConnections: () => mockListSshConnections(),
    saveRemoteProject: (input: unknown) => mockSaveRemoteProject(input),
    deleteRemoteProject: (id: string) => mockDeleteRemoteProject(id),
    discoverRemoteProjects: (input: unknown) => mockDiscoverRemoteProjects(input),
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

// ── Test helpers ──────────────────────────────────────────────────────────────

const makeProject = (overrides = {}) => ({
  id: 'proj-1',
  connection_id: 'conn-1',
  name: 'my-repo',
  path: '/home/user/my-repo',
  created_at: 1000,
  ...overrides,
})

const makeConnection = (overrides = {}) => ({
  id: 'conn-1',
  host: 'example.com',
  port: 22,
  username: 'deploy',
  auth_method: 'key',
  key_name: 'my-key',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RemoteProjectsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks — empty state
    mockListRemoteProjects.mockResolvedValue({ status: 'ok', data: [] })
    mockListSshConnections.mockResolvedValue({ status: 'ok', data: [] })
    mockSaveRemoteProject.mockResolvedValue({ status: 'ok', data: makeProject() })
    mockDeleteRemoteProject.mockResolvedValue({ status: 'ok', data: null })
    mockDiscoverRemoteProjects.mockResolvedValue({ status: 'ok', data: [] })
  })

  it('renders empty state when no remote projects', async () => {
    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-projects-state')).toBeInTheDocument()
    })
    expect(screen.getByText('No remote projects saved')).toBeInTheDocument()
  })

  it('renders list of remote projects with connection label, name, path, and delete icon', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeProject()],
    })
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })
    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('remote-project-row')).toBeInTheDocument()
    })
    expect(screen.getByTestId('project-name')).toHaveTextContent('my-repo')
    expect(screen.getByTestId('project-path')).toHaveTextContent('/home/user/my-repo')
    expect(screen.getByTestId('connection-label-col')).toHaveTextContent(
      'deploy@example.com:22'
    )
    expect(screen.getByTestId('delete-project-btn')).toBeInTheDocument()
  })

  it('opens DiscoverProjectsDialog on "Discover Projects" click', async () => {
    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => screen.getByTestId('discover-btn'))
    fireEvent.click(screen.getByTestId('discover-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('discover-dialog')).toBeInTheDocument()
    })
  })

  it('discovery calls discoverRemoteProjects with connection_id and searchPath', async () => {
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })
    mockDiscoverRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'repo1', path: '/home/user/repo1' }],
    })

    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => screen.getByTestId('discover-btn'))
    fireEvent.click(screen.getByTestId('discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-dialog')).toBeInTheDocument()
    })

    // Select a connection
    fireEvent.click(screen.getByTestId('connection-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const opt = opts.find((o) => o.textContent?.includes('deploy@example.com:22'))
      if (opt) fireEvent.click(opt)
    })

    // Set search path
    fireEvent.change(screen.getByTestId('search-path-input'), {
      target: { value: '/home/user' },
    })

    fireEvent.click(screen.getByTestId('run-discover-btn'))

    await waitFor(() => {
      expect(mockDiscoverRemoteProjects).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: 'conn-1',
          search_path: '/home/user',
        })
      )
    })
  })

  it('saves discovered project when "Save" clicked', async () => {
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })
    mockDiscoverRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'repo1', path: '/home/user/repo1' }],
    })

    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => screen.getByTestId('discover-btn'))
    fireEvent.click(screen.getByTestId('discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-dialog')).toBeInTheDocument()
    })

    // Select a connection
    fireEvent.click(screen.getByTestId('connection-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const opt = opts.find((o) => o.textContent?.includes('deploy@example.com:22'))
      if (opt) fireEvent.click(opt)
    })

    fireEvent.click(screen.getByTestId('run-discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discovered-list')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('save-discovered-btn'))

    await waitFor(() => {
      expect(mockSaveRemoteProject).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: 'conn-1',
          name: 'repo1',
          path: '/home/user/repo1',
        })
      )
    })
  })

  it('shows empty state message when discovery returns empty array', async () => {
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })
    mockDiscoverRemoteProjects.mockResolvedValue({ status: 'ok', data: [] })

    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => screen.getByTestId('discover-btn'))
    fireEvent.click(screen.getByTestId('discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-dialog')).toBeInTheDocument()
    })

    // Select connection
    fireEvent.click(screen.getByTestId('connection-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const opt = opts.find((o) => o.textContent?.includes('deploy@example.com:22'))
      if (opt) fireEvent.click(opt)
    })

    fireEvent.click(screen.getByTestId('run-discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('empty-discover-state')).toBeInTheDocument()
    })
    expect(screen.getByText(/No git repositories found/)).toBeInTheDocument()
  })

  it('"Add Manually" button validates path starts with "/" or "~"', async () => {
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })

    renderWithQuery(<RemoteProjectsPanel />)
    await waitFor(() => screen.getByTestId('discover-btn'))
    fireEvent.click(screen.getByTestId('discover-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('discover-dialog')).toBeInTheDocument()
    })

    // Select connection first
    fireEvent.click(screen.getByTestId('connection-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const opt = opts.find((o) => o.textContent?.includes('deploy@example.com:22'))
      if (opt) fireEvent.click(opt)
    })

    // Enter invalid path
    fireEvent.change(screen.getByTestId('manual-path-input'), {
      target: { value: 'relative/path' },
    })
    fireEvent.click(screen.getByTestId('add-manually-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('manual-path-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('manual-path-error')).toHaveTextContent(
      "Path must start with '/' or '~'"
    )

    // Now enter valid path
    fireEvent.change(screen.getByTestId('manual-path-input'), {
      target: { value: '/home/user/valid-repo' },
    })
    fireEvent.click(screen.getByTestId('add-manually-btn'))

    await waitFor(() => {
      expect(mockSaveRemoteProject).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: 'conn-1',
          path: '/home/user/valid-repo',
        })
      )
    })
  })

  it('delete calls deleteRemoteProject after confirmation', async () => {
    mockListRemoteProjects.mockResolvedValue({
      status: 'ok',
      data: [makeProject({ id: 'proj-del' })],
    })
    mockListSshConnections.mockResolvedValue({
      status: 'ok',
      data: [makeConnection()],
    })

    renderWithQuery(<RemoteProjectsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('delete-project-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('delete-project-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-project-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('confirm-delete-project-btn'))

    await waitFor(() => {
      expect(mockDeleteRemoteProject).toHaveBeenCalledWith('proj-del')
    })
  })
})
