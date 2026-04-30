/**
 * MobileFeedbackSheet tests — AC 10, Story T3.5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileFeedbackSheet } from './MobileFeedbackSheet'

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

describe('MobileFeedbackSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submit button is disabled when textarea is empty', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    expect(screen.getByTestId('mobile-review-feedback-submit-btn')).toBeDisabled()
  })

  it('submit button is disabled when textarea is whitespace-only', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(screen.getByTestId('mobile-review-feedback-submit-btn')).toBeDisabled()
  })

  it('submit button enabled when textarea has non-whitespace content', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Fix the button' } })
    expect(screen.getByTestId('mobile-review-feedback-submit-btn')).not.toBeDisabled()
  })

  it('calls onSubmit with trimmed feedback text when Submit is clicked', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '  Fix the button  ' } })
    fireEvent.click(screen.getByTestId('mobile-review-feedback-submit-btn'))

    expect(onSubmit).toHaveBeenCalledWith('Fix the button')
  })

  it('cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={false}
      />,
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('submit button is disabled when isSubmitting is true', () => {
    const onOpenChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <MobileFeedbackSheet
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        isSubmitting={true}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'some feedback' } })
    expect(screen.getByTestId('mobile-review-feedback-submit-btn')).toBeDisabled()
  })
})
