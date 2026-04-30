/**
 * MobileReviewActionBar tests — AC 8, 13, Story T3.5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileReviewActionBar } from './MobileReviewActionBar'

// Mock hapticFeedback
vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return {
    ...actual,
    hapticFeedback: vi.fn(),
  }
})

// Mock useReducedMotion (used by MobileBottomActionBar)
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

const defaultProps = {
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onRequestChanges: vi.fn(),
  isApproving: false,
  isRejecting: false,
  hasConflict: false,
}

function renderBar(overrides = {}) {
  return render(<MobileReviewActionBar {...defaultProps} {...overrides} />)
}

describe('MobileReviewActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all three buttons with correct test IDs', () => {
    renderBar()
    expect(screen.getByTestId('mobile-review-reject-btn')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-review-request-btn')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-review-approve-btn')).toBeInTheDocument()
  })

  it('renders buttons in correct left-to-right order: Reject | Request changes | Approve', () => {
    renderBar()
    const toolbar = screen.getByRole('toolbar')
    const buttons = toolbar.querySelectorAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveAttribute('data-testid', 'mobile-review-reject-btn')
    expect(buttons[1]).toHaveAttribute('data-testid', 'mobile-review-request-btn')
    expect(buttons[2]).toHaveAttribute('data-testid', 'mobile-review-approve-btn')
  })

  it('wraps buttons in role="toolbar" with aria-label="Review actions"', () => {
    renderBar()
    const toolbar = screen.getByRole('toolbar')
    expect(toolbar).toHaveAttribute('aria-label', 'Review actions')
  })

  it('calls onApprove callback when Approve is pressed', () => {
    const onApprove = vi.fn()
    renderBar({ onApprove })
    fireEvent.click(screen.getByTestId('mobile-review-approve-btn'))
    expect(onApprove).toHaveBeenCalledOnce()
  })

  it('calls onReject callback when Reject is pressed', () => {
    const onReject = vi.fn()
    renderBar({ onReject })
    fireEvent.click(screen.getByTestId('mobile-review-reject-btn'))
    expect(onReject).toHaveBeenCalledOnce()
  })

  it('calls onRequestChanges callback when Request changes is pressed', () => {
    const onRequestChanges = vi.fn()
    renderBar({ onRequestChanges })
    fireEvent.click(screen.getByTestId('mobile-review-request-btn'))
    expect(onRequestChanges).toHaveBeenCalledOnce()
  })

  it('Approve button is disabled when hasConflict is true (AC 8, 13)', () => {
    renderBar({ hasConflict: true })
    expect(screen.getByTestId('mobile-review-approve-btn')).toBeDisabled()
  })

  it('Approve button is disabled when isApproving is true', () => {
    renderBar({ isApproving: true })
    expect(screen.getByTestId('mobile-review-approve-btn')).toBeDisabled()
  })

  it('Reject and Request Changes are disabled when isApproving is true', () => {
    renderBar({ isApproving: true })
    expect(screen.getByTestId('mobile-review-reject-btn')).toBeDisabled()
    expect(screen.getByTestId('mobile-review-request-btn')).toBeDisabled()
  })

  it('Reject and Request Changes are disabled when isRejecting is true', () => {
    renderBar({ isRejecting: true })
    expect(screen.getByTestId('mobile-review-reject-btn')).toBeDisabled()
    expect(screen.getByTestId('mobile-review-request-btn')).toBeDisabled()
  })

  it('buttons are enabled when no pending operations and no conflict', () => {
    renderBar()
    expect(screen.getByTestId('mobile-review-approve-btn')).not.toBeDisabled()
    expect(screen.getByTestId('mobile-review-reject-btn')).not.toBeDisabled()
    expect(screen.getByTestId('mobile-review-request-btn')).not.toBeDisabled()
  })

  it('buttons have correct aria-labels', () => {
    renderBar()
    expect(screen.getByTestId('mobile-review-approve-btn')).toHaveAttribute('aria-label', 'Approve and merge')
    expect(screen.getByTestId('mobile-review-reject-btn')).toHaveAttribute('aria-label', 'Reject changes')
    expect(screen.getByTestId('mobile-review-request-btn')).toHaveAttribute('aria-label', 'Request changes')
  })
})
