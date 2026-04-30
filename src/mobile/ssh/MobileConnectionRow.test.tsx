/**
 * MobileConnectionRow tests — AC 5, 7
 * Story T3.5-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileConnectionRow } from './MobileConnectionRow'
import type { SshConnectionProfile } from '@renderer/lib/rspc'

/* ─── Mock: useReducedMotion ─────────────────────────────────────────── */

vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

/* ─── Mock: utils ────────────────────────────────────────────────────── */

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

/* ─── Fixture ────────────────────────────────────────────────────────── */

const CONN: SshConnectionProfile = {
  id: 'conn-abc',
  host: 'test.example.com',
  port: 22,
  username: 'deploy',
  auth_method: 'key',
  key_name: 'deploy-key',
  created_at: 1700000000,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileConnectionRow', () => {
  const defaultProps = {
    connection: CONN,
    status: 'idle' as const,
    isSwiped: false,
    onSwipeChange: vi.fn(),
    onPress: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }

  it('renders row with correct testid and aria-label', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    const row = screen.getByTestId('mobile-connection-row-conn-abc')
    expect(row).toBeInTheDocument()
    expect(row).toHaveAttribute('aria-label', 'SSH connection test.example.com')
  })

  it('renders host as row title', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    expect(screen.getByText('test.example.com')).toBeInTheDocument()
  })

  it('renders mono subtitle with username@host:port', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    expect(screen.getByText('deploy@test.example.com:22')).toBeInTheDocument()
  })

  it('renders Edit and Delete action buttons with correct testids', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    expect(screen.getByTestId('mobile-connection-row-edit-conn-abc')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-connection-row-delete-conn-abc')).toBeInTheDocument()
  })

  it('tap on Edit button calls onEdit', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-row-edit-conn-abc'))
    expect(defaultProps.onEdit).toHaveBeenCalledTimes(1)
  })

  it('tap on Delete button calls onDelete', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    fireEvent.click(screen.getByTestId('mobile-connection-row-delete-conn-abc'))
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1)
  })

  it('tap on row (when not swiped) calls onPress', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    const rowContent = screen.getByTestId('mobile-connection-row-conn-abc').querySelector('[style]')
    if (rowContent) {
      fireEvent.pointerDown(rowContent, { clientX: 100 })
      fireEvent.pointerUp(rowContent, { clientX: 100 })
    }
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1)
  })

  it('swipe-left beyond threshold calls onSwipeChange with row id', () => {
    render(<MobileConnectionRow {...defaultProps} />)
    const rowContent = screen.getByTestId('mobile-connection-row-conn-abc').querySelector('[style]')
    if (rowContent) {
      fireEvent.pointerDown(rowContent, { clientX: 200, pointerId: 1 })
      fireEvent.pointerMove(rowContent, { clientX: 110, pointerId: 1 })  // delta = -90
      fireEvent.pointerUp(rowContent, { clientX: 110, pointerId: 1 })
    }
    expect(defaultProps.onSwipeChange).toHaveBeenCalledWith('conn-abc')
  })
})
