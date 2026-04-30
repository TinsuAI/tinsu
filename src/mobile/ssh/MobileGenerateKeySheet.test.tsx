/**
 * MobileGenerateKeySheet tests — AC 12
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileGenerateKeySheet } from './MobileGenerateKeySheet'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockInstallMutateAsync = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useInstallSshKey: vi.fn(() => ({
    mutateAsync: mockInstallMutateAsync,
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileGenerateKeySheet', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    host: 'prod.server.com',
    port: 22,
    username: 'deploy',
    onSuccess: vi.fn(),
  }

  it('renders generate key sheet with correct testid', () => {
    render(<MobileGenerateKeySheet {...defaultProps} />)
    expect(screen.getByTestId('mobile-generate-key-sheet')).toBeInTheDocument()
  })

  it('displays target server host/port/username read-only', () => {
    render(<MobileGenerateKeySheet {...defaultProps} />)
    expect(screen.getByText('prod.server.com')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
    expect(screen.getByText('deploy')).toBeInTheDocument()
  })

  it('Generate button is disabled when host is blank', () => {
    render(
      <MobileGenerateKeySheet
        {...defaultProps}
        host=""
        username="deploy"
      />,
    )
    expect(screen.getByTestId('mobile-generate-key-btn')).toBeDisabled()
    expect(screen.getByText('Fill in host, port, and username first.')).toBeInTheDocument()
  })

  it('Generate button is disabled when username is blank', () => {
    render(
      <MobileGenerateKeySheet
        {...defaultProps}
        host="server.com"
        username=""
      />,
    )
    expect(screen.getByTestId('mobile-generate-key-btn')).toBeDisabled()
  })

  it('Generate button is disabled when password is empty', () => {
    render(<MobileGenerateKeySheet {...defaultProps} />)
    // Don't fill password — button should be disabled
    expect(screen.getByTestId('mobile-generate-key-btn')).toBeDisabled()
  })

  it('Generate success calls useInstallSshKey and fires onSuccess', async () => {
    const mockEntry = { name: 'deploy-tinsu', public_key: 'ssh-ed25519 AAAA...' }
    mockInstallMutateAsync.mockResolvedValueOnce(mockEntry)
    render(<MobileGenerateKeySheet {...defaultProps} />)

    // Fill password to enable button
    const passwordInput = screen.getByLabelText('Server password for SSH key installation')
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } })

    fireEvent.click(screen.getByTestId('mobile-generate-key-btn'))

    await waitFor(() => {
      expect(mockInstallMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'prod.server.com',
          port: 22,
          username: 'deploy',
          password: 'mypassword123',
        }),
      )
    })
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith('deploy-tinsu')
      expect(mockToast.success).toHaveBeenCalledWith('Key generated and installed')
    })
  })

  it('Generate failure renders error banner with Retry button', async () => {
    mockInstallMutateAsync.mockRejectedValueOnce(new Error('Auth failed'))
    render(<MobileGenerateKeySheet {...defaultProps} />)

    const passwordInput = screen.getByLabelText('Server password for SSH key installation')
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })

    fireEvent.click(screen.getByTestId('mobile-generate-key-btn'))

    await waitFor(() => {
      expect(screen.getByText('Installation failed')).toBeInTheDocument()
      expect(screen.getByText('Auth failed')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })
})
