/**
 * FeedbackHistory Component Tests - Story 7.7
 *
 * Tests for feedback history display with version navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackHistory } from './FeedbackHistory'

// Mock trpc
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    task: {
      getTaskVersions: {
        useQuery: vi.fn()
      }
    }
  }
}))

import { trpc } from '@renderer/lib/trpc'

const mockVersionsWithFeedback = [
  {
    id: 'v1-id',
    task_id: 'task-1',
    version_number: 1,
    commit_sha: 'abc123',
    rejection_feedback: 'Missing test coverage for the authentication module',
    inline_comments: null,
    status_outcome: 'rejected',
    created_at: new Date('2024-01-01T10:00:00')
  },
  {
    id: 'v2-id',
    task_id: 'task-1',
    version_number: 2,
    commit_sha: 'def456',
    rejection_feedback: null,
    inline_comments: [
      { id: 'c1', filePath: 'src/auth.ts', lineNumber: 42, content: 'Add null check here' },
      {
        id: 'c2',
        filePath: 'src/db/queries.ts',
        lineNumber: 15,
        content: 'Use parameterized query'
      }
    ],
    status_outcome: 'changes_requested',
    created_at: new Date('2024-01-02T14:30:00')
  },
  {
    id: 'v3-id',
    task_id: 'task-1',
    version_number: 3,
    commit_sha: 'ghi789',
    rejection_feedback: null,
    inline_comments: null,
    status_outcome: 'pending',
    created_at: new Date('2024-01-03T09:15:00')
  }
]

describe('FeedbackHistory', () => {
  const defaultProps = {
    taskId: 'task-1',
    onVersionNavigate: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows skeleton loaders when loading', () => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)

      render(<FeedbackHistory {...defaultProps} />)

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('empty state (AC: 4 - handle no prior rejections)', () => {
    it('shows empty state when no feedback exists', () => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: [],
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)

      render(<FeedbackHistory {...defaultProps} />)

      expect(screen.getByText('No feedback yet')).toBeTruthy()
    })

    it('shows empty state when versions exist but none have feedback', () => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: [
          {
            ...mockVersionsWithFeedback[2] // pending version with no feedback
          }
        ],
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)

      render(<FeedbackHistory {...defaultProps} />)

      expect(screen.getByText('No feedback yet')).toBeTruthy()
    })
  })

  describe('feedback display (AC: 4)', () => {
    beforeEach(() => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersionsWithFeedback,
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)
    })

    it('shows feedback entry count in header', () => {
      render(<FeedbackHistory {...defaultProps} />)

      // 2 entries: rejected + changes_requested (pending has no feedback)
      expect(screen.getByText('2 entries')).toBeTruthy()
    })

    it('displays rejection feedback with version number', () => {
      render(<FeedbackHistory {...defaultProps} />)

      expect(screen.getByText('v1')).toBeTruthy()
      expect(screen.getByText('Rejected')).toBeTruthy()
      expect(
        screen.getByText('Missing test coverage for the authentication module')
      ).toBeTruthy()
    })

    it('displays changes requested with inline comment count', () => {
      render(<FeedbackHistory {...defaultProps} />)

      expect(screen.getByText('v2')).toBeTruthy()
      expect(screen.getByText('Changes Requested')).toBeTruthy()
      expect(screen.getByText('2 inline comments')).toBeTruthy()
    })

    it('shows timestamps for feedback entries', () => {
      render(<FeedbackHistory {...defaultProps} />)

      // Should show formatted dates
      expect(screen.getByText(/Jan 1, 2024/)).toBeTruthy()
      expect(screen.getByText(/Jan 2, 2024/)).toBeTruthy()
    })
  })

  describe('inline comments expansion (AC: 4)', () => {
    beforeEach(() => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersionsWithFeedback,
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)
    })

    it('expands to show inline comments on click', async () => {
      const user = userEvent.setup()

      render(<FeedbackHistory {...defaultProps} />)

      // Comments should be collapsed initially
      expect(screen.queryByText('Add null check here')).toBeNull()

      // Click to expand
      const expandButton = screen.getByText('2 inline comments')
      await user.click(expandButton)

      // Comments should now be visible
      expect(screen.getByText('Add null check here')).toBeTruthy()
      expect(screen.getByText('Use parameterized query')).toBeTruthy()
    })

    it('shows file path and line number for inline comments', async () => {
      const user = userEvent.setup()

      render(<FeedbackHistory {...defaultProps} />)

      // Expand comments
      const expandButton = screen.getByText('2 inline comments')
      await user.click(expandButton)

      // Should show file paths
      expect(screen.getByText('src/auth.ts')).toBeTruthy()
      expect(screen.getByText('src/db/queries.ts')).toBeTruthy()

      // Should show line numbers
      expect(screen.getByText('42')).toBeTruthy()
      expect(screen.getByText('15')).toBeTruthy()
    })

    it('collapses inline comments on second click', async () => {
      const user = userEvent.setup()

      render(<FeedbackHistory {...defaultProps} />)

      // Expand
      const expandButton = screen.getByText('2 inline comments')
      await user.click(expandButton)
      expect(screen.getByText('Add null check here')).toBeTruthy()

      // Collapse
      await user.click(expandButton)
      expect(screen.queryByText('Add null check here')).toBeNull()
    })
  })

  describe('version navigation (AC: 4)', () => {
    beforeEach(() => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersionsWithFeedback,
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)
    })

    it('calls onVersionNavigate when "View diff" is clicked', async () => {
      const onVersionNavigate = vi.fn()
      const user = userEvent.setup()

      render(<FeedbackHistory {...defaultProps} onVersionNavigate={onVersionNavigate} />)

      // Find and click the first "View diff" button (appears on hover, but accessible)
      const viewDiffButtons = screen.getAllByText('View diff')
      await user.click(viewDiffButtons[0])

      expect(onVersionNavigate).toHaveBeenCalledWith(1)
    })

    it('navigates to correct version for changes_requested entry', async () => {
      const onVersionNavigate = vi.fn()
      const user = userEvent.setup()

      render(<FeedbackHistory {...defaultProps} onVersionNavigate={onVersionNavigate} />)

      const viewDiffButtons = screen.getAllByText('View diff')
      await user.click(viewDiffButtons[1]) // Second entry is v2

      expect(onVersionNavigate).toHaveBeenCalledWith(2)
    })
  })

  describe('chronological ordering', () => {
    it('displays feedback in version order', () => {
      vi.mocked(trpc.task.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersionsWithFeedback,
        isLoading: false
      } as ReturnType<typeof trpc.task.getTaskVersions.useQuery>)

      render(<FeedbackHistory {...defaultProps} />)

      // Get all version labels
      const versionLabels = screen.getAllByText(/^v\d$/)

      // Should be in order: v1, v2 (v3 has no feedback so not shown)
      expect(versionLabels[0].textContent).toBe('v1')
      expect(versionLabels[1].textContent).toBe('v2')
    })
  })
})
