import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineCommentThread } from './InlineCommentThread'
import type { InlineComment } from '@shared/types/task.types'

describe('InlineCommentThread', () => {
  const mockComments: InlineComment[] = [
    {
      id: 'comment-1',
      filePath: 'src/App.tsx',
      lineNumber: 42,
      content: 'First comment content',
      createdAt: Date.now() - 1000 * 60 * 5 // 5 minutes ago
    },
    {
      id: 'comment-2',
      filePath: 'src/App.tsx',
      lineNumber: 42,
      content: 'Second comment content',
      createdAt: Date.now() - 1000 * 60 * 2 // 2 minutes ago
    }
  ]

  const defaultProps = {
    comments: mockComments,
    lineNumber: 42,
    filePath: 'src/App.tsx',
    onAddComment: vi.fn(),
    onDeleteComment: vi.fn(),
    isExpanded: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders thread when expanded', () => {
      render(<InlineCommentThread {...defaultProps} isExpanded={true} />)
      expect(screen.getByTestId('inline-comment-thread')).toBeInTheDocument()
    })

    it('does not render when collapsed', () => {
      render(<InlineCommentThread {...defaultProps} isExpanded={false} />)
      expect(screen.queryByTestId('inline-comment-thread')).not.toBeInTheDocument()
    })

    it('displays comment count in header', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByText(/2 comments/)).toBeInTheDocument()
    })

    it('displays singular "comment" for single comment', () => {
      render(
        <InlineCommentThread
          {...defaultProps}
          comments={[mockComments[0]]}
        />
      )
      expect(screen.getByText(/1 comment on line/)).toBeInTheDocument()
    })

    it('displays line number in header', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByText(/line 42/)).toBeInTheDocument()
    })
  })

  describe('comment display', () => {
    it('renders all comments', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByText('First comment content')).toBeInTheDocument()
      expect(screen.getByText('Second comment content')).toBeInTheDocument()
    })

    it('renders comment items with test ids', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByTestId('comment-item-comment-1')).toBeInTheDocument()
      expect(screen.getByTestId('comment-item-comment-2')).toBeInTheDocument()
    })

    it('displays relative time for comments', () => {
      render(<InlineCommentThread {...defaultProps} />)
      // Should show "5m ago" and "2m ago" for the two comments
      const timeElements = screen.getAllByText(/\d+m ago/)
      expect(timeElements).toHaveLength(2)
    })
  })

  describe('delete comment', () => {
    it('renders delete button for each comment', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByTestId('delete-comment-comment-1')).toBeInTheDocument()
      expect(screen.getByTestId('delete-comment-comment-2')).toBeInTheDocument()
    })

    it('calls onDeleteComment when delete button clicked', async () => {
      const user = userEvent.setup()
      const onDeleteComment = vi.fn()
      render(
        <InlineCommentThread
          {...defaultProps}
          onDeleteComment={onDeleteComment}
        />
      )

      await user.click(screen.getByTestId('delete-comment-comment-1'))

      expect(onDeleteComment).toHaveBeenCalledWith('comment-1')
    })
  })

  describe('add reply', () => {
    it('renders add reply button initially', () => {
      render(<InlineCommentThread {...defaultProps} />)
      expect(screen.getByTestId('add-reply-button')).toBeInTheDocument()
    })

    it('shows comment input when add reply is clicked', async () => {
      const user = userEvent.setup()
      render(<InlineCommentThread {...defaultProps} />)

      await user.click(screen.getByTestId('add-reply-button'))

      expect(screen.getByTestId('inline-comment-input')).toBeInTheDocument()
      expect(screen.queryByTestId('add-reply-button')).not.toBeInTheDocument()
    })

    it('calls onAddComment when new comment is submitted', async () => {
      const user = userEvent.setup()
      const onAddComment = vi.fn()
      render(
        <InlineCommentThread {...defaultProps} onAddComment={onAddComment} />
      )

      await user.click(screen.getByTestId('add-reply-button'))
      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, 'New reply content')
      await user.click(screen.getByTestId('inline-comment-submit'))

      expect(onAddComment).toHaveBeenCalledWith('New reply content')
    })

    it('hides input and shows button again after submitting', async () => {
      const user = userEvent.setup()
      render(<InlineCommentThread {...defaultProps} />)

      await user.click(screen.getByTestId('add-reply-button'))
      const textarea = screen.getByTestId('inline-comment-textarea')
      await user.type(textarea, 'Reply')
      await user.click(screen.getByTestId('inline-comment-submit'))

      expect(screen.queryByTestId('inline-comment-input')).not.toBeInTheDocument()
      expect(screen.getByTestId('add-reply-button')).toBeInTheDocument()
    })

    it('hides input and shows button again after cancelling', async () => {
      const user = userEvent.setup()
      render(<InlineCommentThread {...defaultProps} />)

      await user.click(screen.getByTestId('add-reply-button'))
      await user.click(screen.getByTestId('inline-comment-cancel'))

      expect(screen.queryByTestId('inline-comment-input')).not.toBeInTheDocument()
      expect(screen.getByTestId('add-reply-button')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(<InlineCommentThread {...defaultProps} className="custom-class" />)
      expect(screen.getByTestId('inline-comment-thread')).toHaveClass(
        'custom-class'
      )
    })

    it('has amber themed left border', () => {
      render(<InlineCommentThread {...defaultProps} />)
      const thread = screen.getByTestId('inline-comment-thread')
      expect(thread.className).toMatch(/border-amber/)
    })
  })

  describe('empty state', () => {
    it('renders with no comments', () => {
      render(<InlineCommentThread {...defaultProps} comments={[]} />)
      expect(screen.getByText(/0 comments/)).toBeInTheDocument()
      expect(screen.getByTestId('add-reply-button')).toBeInTheDocument()
    })
  })
})
