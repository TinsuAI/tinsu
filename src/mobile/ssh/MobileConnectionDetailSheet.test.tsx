/**
 * MobileConnectionDetailSheet tests — AC 8, 14
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileConnectionDetailSheet } from './MobileConnectionDetailSheet'
import type { SshConnectionProfile } from '@renderer/lib/rspc'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockTestMutateAsync = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useTestSshConnection: vi.fn(() => ({
    mutateAsync: mockTestMutateAsync,
    isPending: false,
  })),
  useListSshConnections: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useDeleteSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

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

/* ─── Fixture ────────────────────────────────────────────────────────── */

const CONN: SshConnectionProfile = {
  id: 'conn-xyz',
  host: 'prod.server.com',
  port: 22,
  username: 'admin',
  auth_method: 'key',
  key_name: 'prod-key',
  created_at: 1700000000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileConnectionDetailSheet', () => {
  const defaultProps = {
    open: true,
    connection: CONN,
    onOpenChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onTestStatusChange: vi.fn(),
  }

  it('renders connection metadata', () => {
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    // host appears in both sheet title + metadata row — use getAllByText
    expect(screen.getAllByText('prod.server.com').length).toBeGreaterThanOrEqual(1)
    // admin appears in both description + metadata row
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('SSH Key')).toBeInTheDocument()
    expect(screen.getByText('prod-key')).toBeInTheDocument()
  })

  it('renders Test Connection button', () => {
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    expect(screen.getByTestId('mobile-connection-test-btn')).toBeInTheDocument()
  })

  it('Test Connection fires useTestSshConnection and renders success banner', async () => {
    mockTestMutateAsync.mockResolvedValueOnce({ success: true, fingerprint: 'SHA256:abcdef', error: null })
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-test-btn'))
    await waitFor(() => {
      expect(mockTestMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'prod.server.com', username: 'admin' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Connection successful')).toBeInTheDocument()
    })
    expect(defaultProps.onTestStatusChange).toHaveBeenCalledWith('conn-xyz', 'connected')
  })

  it('Test Connection failure renders error banner', async () => {
    mockTestMutateAsync.mockRejectedValueOnce(new Error('Connection refused'))
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-test-btn'))
    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })
    expect(defaultProps.onTestStatusChange).toHaveBeenCalledWith('conn-xyz', 'error')
  })

  it('Edit button calls onEdit and closes sheet', () => {
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-edit-btn'))
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1)
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Delete button calls onDelete', () => {
    render(<MobileConnectionDetailSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-delete-btn'))
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1)
  })
})
