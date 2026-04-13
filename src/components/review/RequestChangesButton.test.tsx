import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestChangesButton } from './RequestChangesButton'
import { TooltipProvider } from '@renderer/components/ui/tooltip'

// Wrapper with TooltipProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
)

describe('RequestChangesButton', () => {
  const defaultProps = {
    onClick: vi.fn(),
    commentCount: 3
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with test id', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).toBeInTheDocument()
    })

    it('renders "Request Changes" text', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} />
        </TestWrapper>
      )
      expect(screen.getByText('Request Changes')).toBeInTheDocument()
    })

    it('renders keyboard shortcut hint "C"', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} />
        </TestWrapper>
      )
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })

  describe('comment count badge', () => {
    it('shows comment count badge when comments exist', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} commentCount={5} />
        </TestWrapper>
      )
      expect(screen.getByTestId('comment-count')).toHaveTextContent('5')
    })

    it('does not show badge when comment count is 0', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} commentCount={0} />
        </TestWrapper>
      )
      expect(screen.queryByTestId('comment-count')).not.toBeInTheDocument()
    })
  })

  describe('disabled states', () => {
    it('is disabled when commentCount is 0', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} commentCount={0} />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).toBeDisabled()
    })

    it('is disabled when disabled prop is true', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} disabled={true} />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).toBeDisabled()
    })

    it('is disabled when isPending is true', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} isPending={true} />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).toBeDisabled()
    })

    it('is enabled when has comments and not disabled', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} commentCount={2} />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).not.toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('shows spinner when isPending is true', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} isPending={true} />
        </TestWrapper>
      )
      // The Loader2 component renders with animate-spin class
      const button = screen.getByTestId('request-changes-button')
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows MessageSquare icon when not pending', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} isPending={false} />
        </TestWrapper>
      )
      const button = screen.getByTestId('request-changes-button')
      expect(button.querySelector('.animate-spin')).not.toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('calls onClick when clicked with comments', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} onClick={onClick} />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('request-changes-button'))

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} onClick={onClick} disabled={true} />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('request-changes-button'))

      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when no comments', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} onClick={onClick} commentCount={0} />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('request-changes-button'))

      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} className="custom-class" />
        </TestWrapper>
      )
      expect(screen.getByTestId('request-changes-button')).toHaveClass(
        'custom-class'
      )
    })

    it('has amber themed background when comments exist', () => {
      render(
        <TestWrapper>
          <RequestChangesButton {...defaultProps} commentCount={2} />
        </TestWrapper>
      )
      const button = screen.getByTestId('request-changes-button')
      expect(button.className).toMatch(/bg-amber-600/)
    })
  })
})
