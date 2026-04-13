import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineCommentInput } from './InlineCommentInput'

describe('InlineCommentInput', () => {
  const defaultProps = {
    lineNumber: 42,
    filePath: 'src/App.tsx',
    onSubmit: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders with test id', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-input')).toBeInTheDocument()
    })

    it('displays line number context', () => {
      render(<InlineCommentInput {...defaultProps} lineNumber={99} />)
      expect(screen.getByText(/line 99/i)).toBeInTheDocument()
    })

    it('renders textarea for comment input', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-textarea')).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-cancel')).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-submit')).toBeInTheDocument()
    })

    it('shows keyboard hints', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByText(/Enter/)).toBeInTheDocument()
      expect(screen.getByText(/Esc/)).toBeInTheDocument()
    })
  })

  describe('auto-focus', () => {
    it('focuses the textarea on mount', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-textarea')).toHaveFocus()
    })
  })

  describe('submit behavior', () => {
    it('calls onSubmit with trimmed content when submit button clicked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<InlineCommentInput {...defaultProps} onSubmit={onSubmit} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, '  This needs refactoring  ')
      await user.click(screen.getByTestId('inline-comment-submit'))

      expect(onSubmit).toHaveBeenCalledWith('This needs refactoring')
    })

    it('calls onSubmit on Enter key', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<InlineCommentInput {...defaultProps} onSubmit={onSubmit} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, 'Comment text{enter}')

      expect(onSubmit).toHaveBeenCalledWith('Comment text')
    })

    it('does not submit on Shift+Enter (allows multiline)', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<InlineCommentInput {...defaultProps} onSubmit={onSubmit} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, 'Line 1{shift>}{enter}{/shift}Line 2')

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('disables submit button when content is empty', () => {
      render(<InlineCommentInput {...defaultProps} />)
      expect(screen.getByTestId('inline-comment-submit')).toBeDisabled()
    })

    it('disables submit button when content is only whitespace', async () => {
      const user = userEvent.setup()
      render(<InlineCommentInput {...defaultProps} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, '   ')

      expect(screen.getByTestId('inline-comment-submit')).toBeDisabled()
    })

    it('enables submit button when content has non-whitespace', async () => {
      const user = userEvent.setup()
      render(<InlineCommentInput {...defaultProps} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, 'Valid content')

      expect(screen.getByTestId('inline-comment-submit')).not.toBeDisabled()
    })

    it('does not call onSubmit if content is empty', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<InlineCommentInput {...defaultProps} onSubmit={onSubmit} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, '{enter}')

      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('cancel behavior', () => {
    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<InlineCommentInput {...defaultProps} onCancel={onCancel} />)

      await user.click(screen.getByTestId('inline-comment-cancel'))

      expect(onCancel).toHaveBeenCalled()
    })

    it('calls onCancel on Escape key', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()
      render(<InlineCommentInput {...defaultProps} onCancel={onCancel} />)

      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, '{escape}')

      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(<InlineCommentInput {...defaultProps} className="custom-class" />)
      expect(screen.getByTestId('inline-comment-input')).toHaveClass('custom-class')
    })

    it('has amber/yellow themed styling', () => {
      render(<InlineCommentInput {...defaultProps} />)
      const container = screen.getByTestId('inline-comment-input')
      // Check for amber border class
      expect(container.className).toMatch(/border-amber/)
    })
  })
})
