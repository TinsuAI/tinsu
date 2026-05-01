/**
 * MobileRejectionSheet tests — AC 11, Story T3.5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileRejectionSheet } from './MobileRejectionSheet'

vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => true), // reduced to skip animation timers
}))

function renderSheet(overrides = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
  }
  return render(<MobileRejectionSheet {...defaults} {...overrides} />)
}

describe('MobileRejectionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows warning when first submit attempt with empty textarea (AC 11)', () => {
    renderSheet()

    const submitBtn = screen.getByTestId('mobile-review-rejection-submit-btn')
    fireEvent.click(submitBtn)

    expect(screen.getByTestId('mobile-review-rejection-warning')).toBeInTheDocument()
    expect(screen.getByText(/Feedback is recommended/)).toBeInTheDocument()
  })

  it('button label flips to "Reject without feedback" when warning is showing (AC 11)', () => {
    renderSheet()

    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))

    // After warning appears, button label should change
    expect(screen.getByTestId('mobile-review-rejection-submit-btn')).toHaveTextContent('Reject without feedback')
  })

  it('second submit with empty textarea calls onSubmit(null) (AC 11)', () => {
    const onSubmit = vi.fn()
    renderSheet({ onSubmit })

    // First click — shows warning
    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))
    expect(onSubmit).not.toHaveBeenCalled()

    // Second click — submits null
    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))
    expect(onSubmit).toHaveBeenCalledWith(null)
  })

  it('submit with non-empty textarea calls onSubmit(text) without showing warning', () => {
    const onSubmit = vi.fn()
    renderSheet({ onSubmit })

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'The implementation is wrong' } })
    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))

    expect(onSubmit).toHaveBeenCalledWith('The implementation is wrong')
    expect(screen.queryByTestId('mobile-review-rejection-warning')).not.toBeInTheDocument()
  })

  it('warning disappears when user types into textarea (AC 11)', () => {
    renderSheet()

    // Show warning
    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))
    expect(screen.getByTestId('mobile-review-rejection-warning')).toBeInTheDocument()

    // User starts typing — warning should clear
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Some feedback' } })
    expect(screen.queryByTestId('mobile-review-rejection-warning')).not.toBeInTheDocument()
  })

  it('cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    fireEvent.click(screen.getByText('Cancel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('button label is "Submit & reject" when textarea has content', () => {
    renderSheet()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'some content' } })

    expect(screen.getByTestId('mobile-review-rejection-submit-btn')).toHaveTextContent('Submit & reject')
  })

  it('warning block has role="alert" for screen-reader announcement', () => {
    renderSheet()

    fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))

    const warning = screen.getByTestId('mobile-review-rejection-warning')
    expect(warning).toHaveAttribute('role', 'alert')
  })
})
