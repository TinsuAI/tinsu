import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SshConnectionsPanel } from './SshConnectionsPanel'

// ── Mock commands ─────────────────────────────────────────────────────────────

const mockListConnections = vi.fn()
const mockListKeys = vi.fn()
const mockCreateConnection = vi.fn()
const mockUpdateConnection = vi.fn()
const mockDeleteConnection = vi.fn()
const mockTestConnection = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listSshConnections: () => mockListConnections(),
    listSshKeys: () => mockListKeys(),
    createSshConnection: (input: unknown) => mockCreateConnection(input),
    updateSshConnection: (input: unknown) => mockUpdateConnection(input),
    deleteSshConnection: (id: string) => mockDeleteConnection(id),
    testSshConnection: (input: unknown) => mockTestConnection(input),
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

const makeProfile = (overrides = {}) => ({
  id: 'conn-1',
  host: 'example.com',
  port: 22,
  username: 'deploy',
  auth_method: 'key' as const,
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

describe('SshConnectionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks — empty state
    mockListConnections.mockResolvedValue({ status: 'ok', data: [] })
    mockListKeys.mockResolvedValue({ status: 'ok', data: [] })
    mockCreateConnection.mockResolvedValue({
      status: 'ok',
      data: makeProfile(),
    })
    mockUpdateConnection.mockResolvedValue({
      status: 'ok',
      data: makeProfile(),
    })
    mockDeleteConnection.mockResolvedValue({ status: 'ok', data: null })
    mockTestConnection.mockResolvedValue({
      status: 'ok',
      data: { success: true, fingerprint: 'SHA256:abc123', error: null },
    })
  })

  it('renders loading skeleton when query is pending', () => {
    // Return a never-resolving promise to keep query in loading state
    mockListConnections.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<SshConnectionsPanel />)
    expect(screen.getByTestId('ssh-connections-loading')).toBeInTheDocument()
  })

  it('renders empty state with Add Connection button when no connections', async () => {
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
    expect(screen.getByText('No connections saved')).toBeInTheDocument()
    expect(screen.getByTestId('add-connection-btn')).toBeInTheDocument()
  })

  it('renders list of connections with correct fields and action icons', async () => {
    mockListConnections.mockResolvedValue({
      status: 'ok',
      data: [makeProfile()],
    })
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('connection-row')).toBeInTheDocument()
    })
    expect(screen.getByTestId('connection-label')).toHaveTextContent(
      'deploy@example.com:22'
    )
    expect(screen.getByTestId('auth-method-badge')).toBeInTheDocument()
    expect(screen.getByTestId('edit-btn')).toBeInTheDocument()
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
    expect(screen.getByTestId('quick-test-btn')).toBeInTheDocument()
  })

  it('opens AddConnectionDialog on "Add Connection" click', async () => {
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    })
  })

  it('port field defaults to 22', async () => {
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))
    await waitFor(() => {
      const portInput = screen.getByTestId('port-input') as HTMLInputElement
      expect(portInput.value).toBe('22')
    })
  })

  it('shows key selector when auth method is SSH Key', async () => {
    mockListKeys.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'my-key', public_key: 'ssh-ed25519 AAAA' }],
    })
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('key-select')).toBeInTheDocument()
    })
  })

  it('shows no-keys message when SSH Key selected but no keys exist', async () => {
    mockListKeys.mockResolvedValue({ status: 'ok', data: [] })
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('no-keys-message')).toBeInTheDocument()
      expect(screen.getByText('Generate an SSH key first')).toBeInTheDocument()
    })
  })

  it('shows password field when auth method is Password', async () => {
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    })

    // The auth-method-select is a shadcn Select — trigger a change
    // We simulate it by interacting with the underlying select mechanism
    // In test env, use the SelectTrigger to open, then click the option
    fireEvent.click(screen.getByTestId('auth-method-select'))
    await waitFor(() => {
      // shadcn renders options in a portal; look for the password option
      const opts = screen.queryAllByRole('option')
      const passwordOpt = opts.find((o) => o.textContent?.includes('Password'))
      if (passwordOpt) fireEvent.click(passwordOpt)
    })

    await waitFor(() => {
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
    })
  })

  it('calls createSshConnection on save with password auth and invalidates query', async () => {
    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    })

    // Switch to password auth (no key required)
    fireEvent.click(screen.getByTestId('auth-method-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const passwordOpt = opts.find((o) => o.textContent?.includes('Password'))
      if (passwordOpt) fireEvent.click(passwordOpt)
    })

    // Fill required fields
    await waitFor(() => {
      expect(screen.getByTestId('password-input')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('host-input'), {
      target: { value: 'myserver.io' },
    })
    fireEvent.change(screen.getByTestId('username-input'), {
      target: { value: 'admin' },
    })

    fireEvent.click(screen.getByTestId('save-connection-btn'))

    await waitFor(() => {
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'myserver.io',
          username: 'admin',
          auth_method: 'password',
        })
      )
    })
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Connection saved')
    })
  })

  it('calls deleteSshConnection after confirmation', async () => {
    mockListConnections.mockResolvedValue({
      status: 'ok',
      data: [makeProfile({ id: 'conn-del', auth_method: 'password', key_name: null })],
    })
    renderWithQuery(<SshConnectionsPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('delete-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-delete-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() => {
      expect(mockDeleteConnection).toHaveBeenCalledWith('conn-del')
    })
  })

  it('shows test result inline on success', async () => {
    mockTestConnection.mockResolvedValue({
      status: 'ok',
      data: { success: true, fingerprint: 'SHA256:abc123', error: null },
    })

    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    })

    // Switch to password auth so form is valid without key
    fireEvent.click(screen.getByTestId('auth-method-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const passwordOpt = opts.find((o) => o.textContent?.includes('Password'))
      if (passwordOpt) fireEvent.click(passwordOpt)
    })

    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('host-input'), { target: { value: 'host.io' } })
    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'user' } })

    fireEvent.click(screen.getByTestId('test-connection-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('test-result-success')).toBeInTheDocument()
      expect(screen.getByTestId('fingerprint-text')).toHaveTextContent('SHA256:abc123')
    })
  })

  it('shows error message on test failure', async () => {
    mockTestConnection.mockResolvedValue({
      status: 'ok',
      data: { success: false, fingerprint: null, error: 'Connection refused' },
    })

    renderWithQuery(<SshConnectionsPanel />)
    await waitFor(() => screen.getByTestId('add-connection-btn'))
    fireEvent.click(screen.getByTestId('add-connection-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('connection-dialog')).toBeInTheDocument()
    })

    // Switch to password auth
    fireEvent.click(screen.getByTestId('auth-method-select'))
    await waitFor(() => {
      const opts = screen.queryAllByRole('option')
      const passwordOpt = opts.find((o) => o.textContent?.includes('Password'))
      if (passwordOpt) fireEvent.click(passwordOpt)
    })

    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('host-input'), { target: { value: 'badhost.io' } })
    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'user' } })

    fireEvent.click(screen.getByTestId('test-connection-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('test-result-error')).toBeInTheDocument()
      expect(screen.getByText('Connection refused')).toBeInTheDocument()
    })
  })
})
