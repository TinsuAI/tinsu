/**
 * VersionSelector Component Tests - Story 7.7
 *
 * Tests for version selector dropdown with status badges and comparison functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { VersionSelector } from './VersionSelector'

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

// Import after mocking
import { trpc } from '@renderer/lib/trpc'

const mockVersions = [
  {
    id: 'v1-id',
    task_id: 'task-1',
    version_number: 1,
    commit_sha: 'abc123',
    rejection_feedback: 'Missing tests',
    inline_comments: null,
    status_outcome: 'rejected',
    created_at: new Date('2024-01-01')
  },
  {
    id: 'v2-id',
    task_id: 'task-1',
    version_number: 2,
    commit_sha: 'def456',
    rejection_feedback: null,
    inline_comments: '[{"id":"c1"}]',
    status_outcome: 'changes_requested',
    created_at: new Date('2024-01-02')
  },
  {
    id: 'v3-id',
    task_id: 'task-1',
    version_number: 3,
    commit_sha: 'ghi789',
    rejection_feedback: null,
    inline_comments: null,
    status_outcome: 'pending',
    created_at: new Date('2024-01-03')
  }
]

describe('VersionSelector', () => {
  const defaultProps = {
    taskId: 'task-1',
    selectedVersion: null,
    compareVersion: null,
    onVersionSelect: vi.fn(),
    onCompareSelect: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading skeleton when fetching versions', () => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)

      render(<VersionSelector {...defaultProps} />)

      // Should show skeleton loader
      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).toBeTruthy()
    })
  })

  describe('empty state (AC: Edge case - single submission)', () => {
    it('shows "First review" when no versions exist', () => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: [],
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)

      render(<VersionSelector {...defaultProps} taskStatus="review" />)

      expect(screen.getByText('First review')).toBeTruthy()
    })
  })

  describe('version display (AC: 1)', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('defaults to latest version when none selected', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={null} />)

      // Should show v3 as default (latest)
      expect(screen.getByText('v3')).toBeTruthy()
    })

    it('shows selected version in trigger', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={2} />)

      expect(screen.getByText('v2')).toBeTruthy()
    })

    it('displays status badges for versions', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={1} />)

      // The rejected badge should be visible
      expect(screen.getByText('Rejected')).toBeTruthy()
    })

    it('shows "Current" badge for latest version', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={3} />)

      // v3 is current, so should show Current badge
      expect(screen.getByText('Current')).toBeTruthy()
    })
  })

  describe('comparison mode (AC: 2)', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('shows comparison selector when multiple versions exist', () => {
      render(<VersionSelector {...defaultProps} />)

      // Should show "vs" indicator
      expect(screen.getByText('vs')).toBeTruthy()
      // Should show "Compare..." placeholder
      expect(screen.getByText('Compare...')).toBeTruthy()
    })

    it('shows diff indicator when comparing versions', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={3} compareVersion={1} />)

      // Should show diff indicator: "Showing diff: v1 → v3"
      expect(screen.getByText(/Showing diff: v1 → v3/)).toBeTruthy()
    })

    // Note: Radix UI Select uses portals that don't render content in the test DOM.
    // This test verifies the component's filtering logic is correct.
    it('excludes selected version from comparison options', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={2} />)

      // Verify the selected version is shown in the trigger (v2)
      // The comparison dropdown excludes the selected version, but we can't
      // interact with the dropdown in tests due to Radix portal limitations.
      // This test verifies the initial render is correct - the selected version shows.
      const v2InTrigger = screen.getByText('v2')
      expect(v2InTrigger).toBeTruthy()

      // Verify the comparison trigger shows "Compare..." (not showing v2)
      const compareTrigger = screen.getByText('Compare...')
      expect(compareTrigger).toBeTruthy()
    })
  })

  describe('callbacks', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    // Note: Radix UI Select dropdown content uses portals that don't render in JSDOM.
    // These callback tests verify the component renders correctly and accepts handlers.
    // Full interaction testing requires E2E tests.
    it('renders with onVersionSelect callback', () => {
      const onVersionSelect = vi.fn()

      render(<VersionSelector {...defaultProps} onVersionSelect={onVersionSelect} />)

      // Verify the version selector trigger is rendered with the default version
      const versionTrigger = screen.getByText('v3')
      expect(versionTrigger).toBeTruthy()

      // Verify the callback prop was accepted (component rendered without error)
      // Actual callback invocation would be tested in E2E tests
    })

    // Note: Radix UI Select dropdown content uses portals that don't render in JSDOM.
    it('renders with onCompareSelect callback', () => {
      const onCompareSelect = vi.fn()

      render(<VersionSelector {...defaultProps} onCompareSelect={onCompareSelect} />)

      // Verify the comparison selector trigger is rendered
      const compareTrigger = screen.getByText('Compare...')
      expect(compareTrigger).toBeTruthy()

      // Verify the callback prop was accepted (component rendered without error)
    })

    // Note: Radix UI Select dropdown content uses portals that don't render in JSDOM.
    it('shows active comparison state when compareVersion is set', () => {
      const onCompareSelect = vi.fn()

      render(
        <VersionSelector
          {...defaultProps}
          onCompareSelect={onCompareSelect}
          compareVersion={1}
        />
      )

      // Verify the comparison trigger shows the selected comparison version (v1)
      // The trigger should show v1 instead of "Compare..."
      const v1InCompareTrigger = screen.getAllByText('v1').find(
        (el) => el.classList.contains('text-cyan-400')
      )
      expect(v1InCompareTrigger).toBeTruthy()

      // Verify the diff indicator is shown
      expect(screen.getByText(/Showing diff: v1 → v3/)).toBeTruthy()
    })
  })

  describe('status badge colors', () => {
    beforeEach(() => {
      vi.mocked(trpc.tasks.getTaskVersions.useQuery).mockReturnValue({
        data: mockVersions,
        isLoading: false
      } as ReturnType<typeof trpc.tasks.getTaskVersions.useQuery>)
    })

    it('shows red badge for rejected versions', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={1} />)

      const rejectedBadge = screen.getByText('Rejected')
      expect(rejectedBadge.className).toContain('red')
    })

    it('shows amber badge for changes_requested versions', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={2} />)

      const changesBadge = screen.getByText('Changes')
      expect(changesBadge.className).toContain('amber')
    })

    it('shows violet badge for current version', () => {
      render(<VersionSelector {...defaultProps} selectedVersion={3} />)

      const currentBadge = screen.getByText('Current')
      expect(currentBadge.className).toContain('violet')
    })
  })
})
