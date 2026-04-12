/**
 * ReviewTimeline Component Tests - Story 7.7
 *
 * Tests for the review history timeline visualization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewTimeline } from './ReviewTimeline'

// Mock trpc
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getTaskVersions: {
        useQuery: vi.fn()
      }
    }
  }
}))

import { trpc } from '@renderer/lib/trpc'

const mockVersions = [
  {
    id: 'v1-id',
    task_id: 'task-1',
    version_number: 1,
    commit_sha: 'abc123',
    rejection_feedback: 'Missing test coverage for auth module',
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
      { id: 'c1', filePath: 'src/auth.ts', lineNumber: 42, content: 'Add null check' }
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

describe('ReviewTimeline', () => {
  const defaultProps = {
    taskId: 'task-1',
    selectedVersion: null,
    onVersionClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows skeleton loaders when loading', () => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)

      render(<ReviewTimeline {...defaultProps} />)

      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('empty state', () => {
    it('shows empty state message when no versions exist', () => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: [],
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)

      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('No review history yet')).toBeTruthy()
    })
  })

  describe('timeline display (AC: 3)', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('renders all version nodes', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('v1')).toBeTruthy()
      expect(screen.getByText('v2')).toBeTruthy()
      expect(screen.getByText('v3')).toBeTruthy()
    })

    it('shows version count in header', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('3 versions')).toBeTruthy()
    })

    it('shows "Current" badge on latest version', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('Current')).toBeTruthy()
    })

    it('displays status labels for each version', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('Rejected')).toBeTruthy()
      expect(screen.getByText('Changes Requested')).toBeTruthy()
      expect(screen.getByText('Pending Review')).toBeTruthy()
    })

    it('shows rejection feedback preview (AC: 3)', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText(/"Missing test coverage for auth module"/)).toBeTruthy()
    })

    it('shows inline comment count for changes_requested', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText(/1 inline comment/)).toBeTruthy()
    })
  })

  describe('version selection', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('highlights selected version', () => {
      render(<ReviewTimeline {...defaultProps} selectedVersion={2} />)

      // Find the v2 button and check it has the selected styles
      const v2Button = screen.getByRole('button', { name: /v2/i })
      expect(v2Button.className).toContain('bg-secondary')
    })

    it('calls onVersionClick when version node is clicked', async () => {
      const onVersionClick = vi.fn()
      const user = userEvent.setup()

      render(<ReviewTimeline {...defaultProps} onVersionClick={onVersionClick} />)

      const v1Button = screen.getByRole('button', { name: /v1.*Rejected/i })
      await user.click(v1Button)

      expect(onVersionClick).toHaveBeenCalledWith(1)
    })
  })

  describe('timeline flow visualization', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('renders transition arrows between versions', () => {
      render(<ReviewTimeline {...defaultProps} />)

      // There should be 2 arrows for 3 versions (between v1-v2 and v2-v3)
      // Each arrow contains an ArrowDown icon
      const arrows = document.querySelectorAll('[class*="h-8"]')
      expect(arrows.length).toBe(2)
    })
  })

  describe('timestamp formatting', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: [
          {
            ...mockVersions[0],
            created_at: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          }
        ],
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('shows relative time for recent versions', () => {
      render(<ReviewTimeline {...defaultProps} />)

      expect(screen.getByText('30m ago')).toBeTruthy()
    })
  })
})
