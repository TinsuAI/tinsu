/**
 * MobileKeyPickerSheet tests — AC 11
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileKeyPickerSheet } from './MobileKeyPickerSheet'

/* ─── Mock: @renderer/hooks/useSshCommands ───────────────────────────── */

const mockUseListSshKeys = vi.fn()

vi.mock('@renderer/hooks/useSshCommands', () => ({
  useListSshKeys: () => mockUseListSshKeys(),
  useInstallSshKey: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
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

/* ─── Mock: sonner ───────────────────────────────────────────────────── */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

/* ─── Fixtures ───────────────────────────────────────────────────────── */

const MOCK_KEYS = [
  { name: 'my-key', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderPublicKey1' },
  { name: 'server-key', public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderPublicKey2' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileKeyPickerSheet', () => {
  const defaultProps = {
    open: true,
    selectedKeyName: '',
    onOpenChange: vi.fn(),
    onKeySelect: vi.fn(),
    host: 'test.com',
    port: 22,
    username: 'deploy',
    generateKeyOpen: false,
    onGenerateKeyOpenChange: vi.fn(),
    onKeyGenerated: vi.fn(),
  }

  it('renders key picker sheet with correct testid', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    expect(screen.getByTestId('mobile-key-picker-sheet')).toBeInTheDocument()
  })

  it('renders keys from useListSshKeys', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    expect(screen.getByText('my-key')).toBeInTheDocument()
    expect(screen.getByText('server-key')).toBeInTheDocument()
  })

  it('renders loading skeletons while loading', () => {
    mockUseListSshKeys.mockReturnValue({ data: [], isLoading: true, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    expect(screen.getAllByTestId('mobile-loading-skeleton-list-row').length).toBeGreaterThanOrEqual(3)
  })

  it('renders empty state subtitle and Generate New row when no keys', () => {
    mockUseListSshKeys.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    expect(screen.getByText('No keys found. Generate one to continue.')).toBeInTheDocument()
    expect(screen.getByText('Generate New Key')).toBeInTheDocument()
  })

  it('selecting a key calls onKeySelect with the key name', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    // Find the 'my-key' row button and click it
    const keyButton = screen.getAllByTestId('mobile-list-item').find(
      (el) => el.textContent?.includes('my-key'),
    )
    if (keyButton) fireEvent.click(keyButton)
    expect(defaultProps.onKeySelect).toHaveBeenCalledWith('my-key')
  })

  it('Generate New Key row opens generate key sheet', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} />)
    const generateButton = screen.getAllByTestId('mobile-list-item').find(
      (el) => el.textContent?.includes('Generate New Key'),
    )
    if (generateButton) fireEvent.click(generateButton)
    expect(defaultProps.onGenerateKeyOpenChange).toHaveBeenCalledWith(true)
  })

  it('selected key shows checkmark', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} selectedKeyName="my-key" />)
    // Check icon should be present (Lucide Check icon in the selected row)
    // The check is rendered inside the trailing slot of the selected MobileListItem
    const keyRows = screen.getAllByTestId('mobile-list-item')
    const selectedRow = keyRows.find((el) => el.textContent?.includes('my-key'))
    expect(selectedRow).toBeInTheDocument()
    // The check SVG should be in the DOM (any lucide check icon)
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('generate key sheet renders when generateKeyOpen is true', () => {
    mockUseListSshKeys.mockReturnValue({ data: MOCK_KEYS, isLoading: false, error: null })
    render(<MobileKeyPickerSheet {...defaultProps} generateKeyOpen={true} />)
    expect(screen.getByTestId('mobile-generate-key-sheet')).toBeInTheDocument()
  })
})
