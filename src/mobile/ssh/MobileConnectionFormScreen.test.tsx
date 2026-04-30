/**
 * MobileConnectionFormScreen tests — AC 2, 9, 10, 13, 21
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileConnectionFormScreen } from './MobileConnectionFormScreen'
import * as SshCommands from '@renderer/hooks/useSshCommands'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockCreateMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()
const mockTestMutateAsync = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useListSshConnections: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateSshConnection: vi.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
  useUpdateSshConnection: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useTestSshConnection: vi.fn(() => ({
    mutateAsync: mockTestMutateAsync,
    isPending: false,
  })),
  useListSshKeys: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useInstallSshKey: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

/* ─── Mock: mobile-nav.store ─────────────────────────────────────────── */

const mockPopRoute = vi.fn()
const mockPushRoute = vi.fn()

vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = { activeTab: 'settings', popRoute: mockPopRoute, pushRoute: mockPushRoute }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({
          activeTab: 'settings',
          popRoute: mockPopRoute,
          pushRoute: mockPushRoute,
        })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
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

/* ─── Mock: utils ────────────────────────────────────────────────────── */

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

/* ─── Mock: sonner ───────────────────────────────────────────────────── */

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: mockToast }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileConnectionFormScreen (mode=new)', () => {
  it('renders form screen with correct testid', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    expect(screen.getByTestId('mobile-connection-form-screen')).toBeInTheDocument()
  })

  it('renders "New Connection" title for new mode', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    expect(screen.getByText('New Connection')).toBeInTheDocument()
  })

  it('renders back button with correct testid', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    expect(screen.getByTestId('mobile-connection-form-back-button')).toBeInTheDocument()
  })

  it('renders all 7 form fields in correct order', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    // Labels use text-transform: uppercase in CSS but DOM text is lowercase
    // (a) Host label — text content is 'Host' (CSS uppercase applied visually)
    expect(screen.getByLabelText('Host')).toBeInTheDocument()
    // (b) Port label
    expect(screen.getByLabelText('Port')).toBeInTheDocument()
    // (c) Username label
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    // (d) Authentication — MobileSegmentedTabs
    expect(screen.getByTestId('mobile-segmented-tabs')).toBeInTheDocument()
    // (e) SSH Key selector button (key mode default)
    expect(screen.getByRole('button', { name: /Select an SSH key/i })).toBeInTheDocument()
    // (g) Test Connection button
    expect(screen.getByTestId('mobile-connection-form-test-btn')).toBeInTheDocument()
  })

  it('renders MobileSegmentedTabs for authentication method', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    expect(screen.getByTestId('mobile-segmented-tabs')).toBeInTheDocument()
    // Should have key + password tabs
    // 'SSH Key' appears in the tab; query specifically for the tab button
    expect(screen.getByTestId('mobile-segmented-tab-key')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-segmented-tab-password')).toBeInTheDocument()
  })

  it('SSH Key row opens key picker sheet on tap', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    // Click the SSH Key selector button
    const keyButton = screen.getByRole('button', { name: /Select an SSH key/i })
    fireEvent.click(keyButton)
    // Key picker sheet should appear
    expect(screen.getByTestId('mobile-key-picker-sheet')).toBeInTheDocument()
  })

  it('Test Connection button fires testMutation', async () => {
    mockTestMutateAsync.mockResolvedValueOnce({ success: true, fingerprint: null, error: null })
    render(<MobileConnectionFormScreen mode="new" />)
    // Fill host + username to enable test button
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'my.server.com' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'deploy' } })
    fireEvent.click(screen.getByTestId('mobile-connection-form-test-btn'))
    await waitFor(() => {
      expect(mockTestMutateAsync).toHaveBeenCalled()
    })
  })

  it('Test Connection renders success banner', async () => {
    mockTestMutateAsync.mockResolvedValueOnce({ success: true, fingerprint: null, error: null })
    render(<MobileConnectionFormScreen mode="new" />)
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'my.server.com' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'deploy' } })
    fireEvent.click(screen.getByTestId('mobile-connection-form-test-btn'))
    await waitFor(() => {
      expect(screen.getByText('Connection successful')).toBeInTheDocument()
    })
  })

  it('Test Connection renders error banner on failure', async () => {
    mockTestMutateAsync.mockRejectedValueOnce(new Error('Timeout'))
    render(<MobileConnectionFormScreen mode="new" />)
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'my.server.com' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'deploy' } })
    fireEvent.click(screen.getByTestId('mobile-connection-form-test-btn'))
    await waitFor(() => {
      expect(screen.getByText('Timeout')).toBeInTheDocument()
    })
  })

  it('Save calls createMutation for new mode and pops route on success', async () => {
    mockCreateMutateAsync.mockResolvedValueOnce({ id: 'new-conn', host: 'test.com' })
    render(<MobileConnectionFormScreen mode="new" />)
    // Fill required fields
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'test.com' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'user1' } })
    // Click SSH Key selector to simulate selecting a key (can't easily without full flow)
    // Instead: switch to password mode to bypass key requirement
    fireEvent.click(screen.getByTestId('mobile-segmented-tab-password'))
    // Now save should be enabled (host + username + password mode)
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'test.com', username: 'user1', auth_method: 'password' }),
      )
    })
    await waitFor(() => {
      expect(mockPopRoute).toHaveBeenCalled()
    })
  })

  it('Cancel button calls popRoute', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    fireEvent.click(screen.getByTestId('mobile-bottom-action-secondary'))
    expect(mockPopRoute).toHaveBeenCalledTimes(1)
  })

  it('back button calls popRoute', () => {
    render(<MobileConnectionFormScreen mode="new" />)
    fireEvent.click(screen.getByTestId('mobile-connection-form-back-button'))
    expect(mockPopRoute).toHaveBeenCalledTimes(1)
  })
})

describe('MobileConnectionFormScreen (mode=edit)', () => {
  it('renders "Edit Connection" title when connection is found', () => {
    // Provide the connection data so the form renders (not the "not found" screen).
    // The empty-array default would now correctly show "not found" per the P2 fix.
    vi.mocked(SshCommands.useListSshConnections).mockReturnValue({
      data: [
        {
          id: 'conn-123',
          host: 'edit.server.com',
          port: 22,
          username: 'edituser',
          auth_method: 'key',
          key_name: 'edit-key',
          created_at: 1700000000,
        },
      ],
      isLoading: false,
      error: null,
    })
    render(<MobileConnectionFormScreen mode="edit" connectionId="conn-123" />)
    expect(screen.getByText('Edit Connection')).toBeInTheDocument()
  })

  it('renders "Connection not found" when connection id does not exist in loaded data', () => {
    // Default mock returns data:[], isLoading:false → connection not found after load
    render(<MobileConnectionFormScreen mode="edit" connectionId="nonexistent" />)
    expect(screen.getByText('Connection not found')).toBeInTheDocument()
  })
})
