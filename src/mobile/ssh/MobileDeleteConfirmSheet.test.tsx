/**
 * MobileDeleteConfirmSheet tests — AC 14
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileDeleteConfirmSheet } from './MobileDeleteConfirmSheet'
import type { SshConnectionProfile } from '@renderer/lib/rspc'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockDeleteMutateAsync = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useDeleteSshConnection: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
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

/* ─── Mock: hapticFeedback ───────────────────────────────────────────── */

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

/* ─── Mock: sonner ───────────────────────────────────────────────────── */

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: mockToast }))

/* ─── Fixture ────────────────────────────────────────────────────────── */

const CONN: SshConnectionProfile = {
  id: 'conn-del-1',
  host: 'delete.me.com',
  port: 22,
  username: 'root',
  auth_method: 'key',
  key_name: 'del-key',
  created_at: 1700000000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileDeleteConfirmSheet', () => {
  const defaultProps = {
    open: true,
    connection: CONN,
    onOpenChange: vi.fn(),
    onConfirmed: vi.fn(),
  }

  it('renders delete confirm sheet with correct testid', () => {
    render(<MobileDeleteConfirmSheet {...defaultProps} />)
    expect(screen.getByTestId('mobile-connection-delete-sheet')).toBeInTheDocument()
  })

  it('renders host in description', () => {
    render(<MobileDeleteConfirmSheet {...defaultProps} />)
    expect(
      screen.getByText('This will permanently remove the connection to delete.me.com.'),
    ).toBeInTheDocument()
  })

  it('Cancel button closes only this sheet without calling mutation', () => {
    render(<MobileDeleteConfirmSheet {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled()
    expect(defaultProps.onConfirmed).not.toHaveBeenCalled()
  })

  it('Delete confirm calls useDeleteSshConnection + closes sheet + fires toast on success', async () => {
    mockDeleteMutateAsync.mockResolvedValueOnce(undefined)
    render(<MobileDeleteConfirmSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-delete-confirm-btn'))
    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('conn-del-1')
    })
    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
      expect(defaultProps.onConfirmed).toHaveBeenCalledTimes(1)
      expect(mockToast.success).toHaveBeenCalledWith('Connection deleted')
    })
  })

  it('Delete error closes only this sheet, shows error toast, does NOT call onConfirmed', async () => {
    mockDeleteMutateAsync.mockRejectedValueOnce(new Error('Permission denied'))
    render(<MobileDeleteConfirmSheet {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-delete-confirm-btn'))
    await waitFor(() => {
      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
    })
    expect(defaultProps.onConfirmed).not.toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalledWith('Failed to delete', {
      description: 'Permission denied',
    })
  })
})
