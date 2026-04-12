import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineCommentIndicator } from './InlineCommentIndicator'
import { TooltipProvider } from '@renderer/components/ui/tooltip'

// Wrapper with TooltipProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
)

describe('InlineCommentIndicator', () => {
  const defaultProps = {
    commentCount: 1,
    isExpanded: false,
    onClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with test id', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} />
        </TestWrapper>
      )
      expect(screen.getByTestId('inline-comment-indicator')).toBeInTheDocument()
    })

    it('renders with accessible aria-label', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} commentCount={1} />
        </TestWrapper>
      )
      expect(screen.getByLabelText('1 comment on this line')).toBeInTheDocument()
    })

    it('renders plural aria-label for multiple comments', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} commentCount={3} />
        </TestWrapper>
      )
      expect(screen.getByLabelText('3 comments on this line')).toBeInTheDocument()
    })
  })

  describe('comment count badge', () => {
    it('does not show count badge for single comment', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} commentCount={1} />
        </TestWrapper>
      )
      expect(screen.queryByTestId('comment-count-badge')).not.toBeInTheDocument()
    })

    it('shows count badge for multiple comments', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} commentCount={5} />
        </TestWrapper>
      )
      expect(screen.getByTestId('comment-count-badge')).toHaveTextContent('5')
    })
  })

  describe('expand/collapse state', () => {
    it('shows collapsed chevron when not expanded', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} isExpanded={false} />
        </TestWrapper>
      )
      expect(screen.getByTestId('chevron-collapsed')).toBeInTheDocument()
      expect(screen.queryByTestId('chevron-expanded')).not.toBeInTheDocument()
    })

    it('shows expanded chevron when expanded', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} isExpanded={true} />
        </TestWrapper>
      )
      expect(screen.getByTestId('chevron-expanded')).toBeInTheDocument()
      expect(screen.queryByTestId('chevron-collapsed')).not.toBeInTheDocument()
    })

    it('has aria-expanded attribute matching isExpanded prop', () => {
      const { rerender } = render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} isExpanded={false} />
        </TestWrapper>
      )
      expect(screen.getByTestId('inline-comment-indicator')).toHaveAttribute(
        'aria-expanded',
        'false'
      )

      rerender(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} isExpanded={true} />
        </TestWrapper>
      )
      expect(screen.getByTestId('inline-comment-indicator')).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })
  })

  describe('click behavior', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} onClick={onClick} />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('inline-comment-indicator'))

      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} className="custom-class" />
        </TestWrapper>
      )
      expect(screen.getByTestId('inline-comment-indicator')).toHaveClass(
        'custom-class'
      )
    })

    it('has amber themed background', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator {...defaultProps} />
        </TestWrapper>
      )
      const indicator = screen.getByTestId('inline-comment-indicator')
      expect(indicator.className).toMatch(/bg-amber/)
    })
  })

  describe('tooltip preview', () => {
    it('accepts firstCommentPreview prop without error', () => {
      render(
        <TestWrapper>
          <InlineCommentIndicator
            {...defaultProps}
            firstCommentPreview="This is a preview"
          />
        </TestWrapper>
      )
      // Tooltip content is tested via interaction in integration tests
      expect(screen.getByTestId('inline-comment-indicator')).toBeInTheDocument()
    })
  })
})
