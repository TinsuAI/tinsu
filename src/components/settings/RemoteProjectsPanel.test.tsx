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
const mockListRemoteDir = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listRemoteProjects: () => mockListRemoteProjects(),
    listSshConnections: () => mockListSshConnections(),
    saveRemoteProject: (input: unknown) => mockSaveRemoteProject(input),
    deleteRemoteProject: (id: string) => mockDeleteRemoteProject(id),
    discoverRemoteProjects: (input: unknown) => mockDiscoverRemoteProjects(input),
    listRemoteDir: (input: unknown) => mockListRemoteDir(input),
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
    mockListRemoteDir.mockResolvedValue({ status: 'ok', data: [] })
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

  it('can open a remote folder as a project', async () => {
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

    // Select a connection
    fireEvent.click(screen.getByTestId('connection-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const opt = opts.find((o) => o.textContent?.includes('deploy@example.com:22'))
      if (opt) fireEvent.click(opt)
    })

    // Click "Open this folder" (default is ~)
    await waitFor(() => screen.getByTestId('open-here-btn'))
    fireEvent.click(screen.getByTestId('open-here-btn'))

    await waitFor(() => {
      expect(mockSaveRemoteProject).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_id: 'conn-1',
          path: '~',
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
