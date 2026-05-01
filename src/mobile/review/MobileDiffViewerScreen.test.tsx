/**
 * MobileDiffViewerScreen tests — AC 1, 3, 4, 5, 6, 7, 8, 9, 12, 13, 15, 16, 20
 * Story T3.5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MobileDiffViewerScreen } from './MobileDiffViewerScreen'

/* ─── Mock: mobile-nav.store ─────────────────────────────────────────── */

const mockPopRoute = vi.fn()
const mockPushRoute = vi.fn()

vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = { activeTab: 'tasks', popRoute: mockPopRoute, pushRoute: mockPushRoute }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({ activeTab: 'tasks', popRoute: mockPopRoute, pushRoute: mockPushRoute })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
  }
})

/* ─── Mock: trpc ─────────────────────────────────────────────────────── */

const mockGetByIdQuery = vi.fn()
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getById: {
        useQuery: (...args: unknown[]) => mockGetByIdQuery(...args),
      },
    },
  },
}))

/* ─── Mock: useApprovalMutation ──────────────────────────────────────── */

const mockApprove = vi.fn()
const mockApprovalMutation = vi.fn(() => ({
  approve: mockApprove,
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
}))

vi.mock('@renderer/hooks/useApprovalMutation', () => ({
  useApprovalMutation: (...args: unknown[]) => mockApprovalMutation(...args),
}))

/* ─── Mock: useRejectionMutation ─────────────────────────────────────── */

const mockReject = vi.fn()
const mockRejectionMutation = vi.fn(() => ({
  reject: mockReject,
  isPending: false,
  isSuccess: false,
  isError: false,
  error: null,
}))

vi.mock('@renderer/hooks/useRejectionMutation', () => ({
  useRejectionMutation: (...args: unknown[]) => mockRejectionMutation(...args),
}))

/* ─── Mock: useDiff ──────────────────────────────────────────────────── */

const mockUseDiff = vi.fn()
vi.mock('@renderer/hooks/useDiff', () => ({
  useDiff: (...args: unknown[]) => mockUseDiff(...args),
}))

/* ─── Mock: useReducedMotion ─────────────────────────────────────────── */

const mockUseReducedMotion = vi.fn(() => false)
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

/* ─── Mock: hapticFeedback ───────────────────────────────────────────── */

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual, hapticFeedback: vi.fn() }
})

/* ─── Mock: Radix Dialog Portal ──────────────────────────────────────── */

vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

/* ─── Fixtures ───────────────────────────────────────────────────────── */

const REVIEW_TASK = {
  id: 'task-abc',
  title: 'Add user authentication',
  status: 'review',
  story_number: '3',
  project_id: 'proj-1',
  worktree_path: '/tmp/worktree',
  merge_commit_sha: null,
  last_review_commit: null,
}

const SMALL_DIFF = {
  files: [
    {
      path: 'src/auth.ts',
      status: 'modified' as const,
      additions: 10,
      deletions: 3,
      hunks: [
        {
          header: '@@ -1,5 +1,12 @@',
          oldStart: 1,
          oldLines: 5,
          newStart: 1,
          newLines: 12,
          lines: [
            { type: 'context' as const, content: 'import React from "react"', oldLineNo: 1, newLineNo: 1 },
            { type: 'add' as const, content: 'import { auth } from "./auth"', newLineNo: 2 },
            { type: 'remove' as const, content: 'import { old } from "./old"', oldLineNo: 2 },
          ],
        },
      ],
    },
  ],
  summary: { filesChanged: 1, linesAdded: 10, linesRemoved: 3 },
}

function makeLargeDiff(lineCount: number) {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    type: 'context' as const,
    content: `line ${i + 1} content here`,
    oldLineNo: i + 1,
    newLineNo: i + 1,
  }))
  return {
    files: [
      {
        path: 'src/large.ts',
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
        hunks: [
          {
            header: `@@ -1,${lineCount} +1,${lineCount} @@`,
            oldStart: 1,
            oldLines: lineCount,
            newStart: 1,
            newLines: lineCount,
            lines,
          },
        ],
      },
    ],
    summary: { filesChanged: 1, linesAdded: 0, linesRemoved: 0 },
  }
}

/* ─── Setup ──────────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()

  // Default task — in review status
  mockGetByIdQuery.mockReturnValue({
    data: REVIEW_TASK,
    isLoading: false,
    error: null,
  })

  // Default diff — small diff
  mockUseDiff.mockReturnValue({
    diff: SMALL_DIFF,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    isRefreshing: false,
    hasChanges: true,
    summary: SMALL_DIFF.summary,
    isBaselineDiff: false,
    isVersionComparison: false,
    versionComparisonInfo: null,
  })
})

/* ─── Tests ──────────────────────────────────────────────────────────── */

describe('MobileDiffViewerScreen', () => {
  describe('layout and header (AC 1, 3)', () => {
    it('renders root with data-testid="mobile-review-screen"', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      expect(screen.getByTestId('mobile-review-screen')).toBeInTheDocument()
    })

    it('renders back button with correct testid and aria-label', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      const btn = screen.getByTestId('mobile-review-back-button')
      expect(btn).toBeInTheDocument()
      expect(btn).toHaveAttribute('aria-label', 'Back')
    })

    it('back button calls popRoute', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      fireEvent.click(screen.getByTestId('mobile-review-back-button'))
      expect(mockPopRoute).toHaveBeenCalledOnce()
    })

    it('renders task title in header', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      expect(screen.getByTestId('mobile-review-title')).toHaveTextContent('Add user authentication')
    })

    it('renders Files pill with correct file count', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      const pill = screen.getByTestId('mobile-review-files-pill')
      expect(pill).toBeInTheDocument()
      expect(pill).toHaveTextContent('1 file')
    })
  })

  describe('loading state (AC 3)', () => {
    it('renders 3 loading skeletons while task is loading', () => {
      mockGetByIdQuery.mockReturnValue({ data: null, isLoading: true, error: null })
      mockUseDiff.mockReturnValue({ diff: null, isLoading: true, error: null, refresh: vi.fn(), isRefreshing: false, hasChanges: false, summary: null, isBaselineDiff: false, isVersionComparison: false, versionComparisonInfo: null })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      const skeletons = screen.getAllByTestId('mobile-loading-skeleton-card')
      expect(skeletons.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('not-in-review state (AC 4)', () => {
    it('renders "Not in review" empty state when task.status !== review', () => {
      mockGetByIdQuery.mockReturnValue({
        data: { ...REVIEW_TASK, status: 'done' },
        isLoading: false,
        error: null,
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      expect(screen.getByText('Not in review')).toBeInTheDocument()
      expect(screen.getByText(/no longer awaiting review/i)).toBeInTheDocument()
    })

    it('does NOT mount action bar when task.status !== review', () => {
      mockGetByIdQuery.mockReturnValue({
        data: { ...REVIEW_TASK, status: 'done' },
        isLoading: false,
        error: null,
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      expect(screen.queryByTestId('mobile-review-approve-btn')).not.toBeInTheDocument()
    })
  })

  describe('error state (AC 3)', () => {
    it('renders error empty state when task fetch fails', () => {
      mockGetByIdQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      expect(screen.getByText("Couldn't load task")).toBeInTheDocument()
    })
  })

  describe('Files pill — file tree sheet (AC 6)', () => {
    it('tapping Files pill opens file tree sheet', async () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-files-pill'))

      // Sheet content should render
      expect(screen.getByTestId('mobile-sheet-content')).toBeInTheDocument()
    })
  })

  describe('action bar (AC 8)', () => {
    it('renders three action buttons in correct order', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      expect(screen.getByTestId('mobile-review-reject-btn')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-review-request-btn')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-review-approve-btn')).toBeInTheDocument()
    })

    it('Approve button is positioned right (thumb-dominant) of Reject', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      const toolbar = screen.getByRole('toolbar')
      const buttons = toolbar.querySelectorAll('button')
      expect(buttons[0]).toHaveAttribute('data-testid', 'mobile-review-reject-btn')
      expect(buttons[2]).toHaveAttribute('data-testid', 'mobile-review-approve-btn')
    })
  })

  describe('approve flow (AC 9, 12)', () => {
    it('tapping Approve opens confirmation sheet', async () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-approve-btn'))

      expect(screen.getByTestId('mobile-review-approve-confirm-sheet')).toBeInTheDocument()
    })

    it('Confirm Approval button calls approve mock', async () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-approve-btn'))
      fireEvent.click(screen.getByTestId('mobile-review-approve-confirm-btn'))

      expect(mockApprove).toHaveBeenCalledOnce()
    })

    it('onSuccess calls popRoute (AC 12)', async () => {
      // Capture options passed to useApprovalMutation
      let capturedOptions: Record<string, unknown> = {}
      mockApprovalMutation.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts
        return { approve: mockApprove, isPending: false, isSuccess: false, isError: false, error: null }
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      // Simulate the onSuccess callback
      await act(async () => {
        ;(capturedOptions.onSuccess as () => void)?.()
      })

      expect(mockPopRoute).toHaveBeenCalledOnce()
    })

    it('onConflict renders conflict banner and disables Approve (AC 13)', async () => {
      let capturedOptions: Record<string, unknown> = {}
      mockApprovalMutation.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts
        return { approve: mockApprove, isPending: false, isSuccess: false, isError: false, error: null }
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      await act(async () => {
        ;(capturedOptions.onConflict as (msg: string) => void)?.('Conflict in src/auth.ts')
      })

      expect(screen.getByTestId('mobile-review-conflict-banner')).toBeInTheDocument()
      expect(screen.getByText('Conflict in src/auth.ts')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-review-approve-btn')).toBeDisabled()
    })
  })

  describe('request changes flow (AC 10)', () => {
    it('tapping Request Changes opens feedback sheet', async () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-request-btn'))

      expect(screen.getByTestId('mobile-review-feedback-sheet')).toBeInTheDocument()
    })

    it('submitting feedback calls reject with text', async () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-request-btn'))

      const textarea = screen.getByRole('textbox')
      fireEvent.change(textarea, { target: { value: 'Fix the types' } })
      fireEvent.click(screen.getByTestId('mobile-review-feedback-submit-btn'))

      expect(mockReject).toHaveBeenCalledWith('Fix the types')
    })
  })

  describe('reject flow (AC 11)', () => {
    it('tapping Reject opens rejection sheet', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-reject-btn'))

      expect(screen.getByTestId('mobile-review-rejection-sheet')).toBeInTheDocument()
    })

    it('empty submit in rejection sheet shows warning', () => {
      render(<MobileDiffViewerScreen taskId="task-abc" />)

      fireEvent.click(screen.getByTestId('mobile-review-reject-btn'))
      fireEvent.click(screen.getByTestId('mobile-review-rejection-submit-btn'))

      expect(screen.getByTestId('mobile-review-rejection-warning')).toBeInTheDocument()
    })

    it('rejection onSuccess calls popRoute (AC 14)', async () => {
      let capturedOptions: Record<string, unknown> = {}
      mockRejectionMutation.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts
        return { reject: mockReject, isPending: false, isSuccess: false, isError: false, error: null }
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      await act(async () => {
        ;(capturedOptions.onSuccess as () => void)?.()
      })

      expect(mockPopRoute).toHaveBeenCalledOnce()
    })
  })

  describe('windowing (AC 15)', () => {
    it('large diff (700 lines) renders ≤120 diff-line elements in DOM', async () => {
      // Mock ResizeObserver as a proper constructor class
      class MockResizeObserver {
        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
        constructor(callback: ResizeObserverCallback) {
          // Call callback immediately with clientHeight=600 to simulate viewport
          callback(
            [{ contentRect: { height: 600 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          )
        }
      }
      vi.stubGlobal('ResizeObserver', MockResizeObserver)

      const largeDiff = makeLargeDiff(700)
      mockUseDiff.mockReturnValue({
        diff: largeDiff,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        isRefreshing: false,
        hasChanges: true,
        summary: largeDiff.summary,
        isBaselineDiff: false,
        isVersionComparison: false,
        versionComparisonInfo: null,
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      const lines = screen.queryAllByTestId('diff-line')
      // Windowing should limit rendered lines to much less than 700
      // viewport≈30 lines (600px / 20px), visible range ≈ 3*30 = 90 lines max
      expect(lines.length).toBeLessThanOrEqual(120)
      // Should not render all 700 lines
      expect(lines.length).toBeLessThan(700)

      vi.unstubAllGlobals()
    })

    it('small diff (≤500 lines) renders all lines without windowing', () => {
      // Mock ResizeObserver as proper class
      class MockResizeObserver {
        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
        constructor(_: ResizeObserverCallback) {}
      }
      vi.stubGlobal('ResizeObserver', MockResizeObserver)

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      // SMALL_DIFF has 3 lines — all should render
      const lines = screen.getAllByTestId('diff-line')
      expect(lines).toHaveLength(3)

      vi.unstubAllGlobals()
    })
  })

  describe('reduced motion (AC 20s)', () => {
    it('uses useReducedMotion to determine scroll behavior', () => {
      // Both true and false values should be consumed by the component
      mockUseReducedMotion.mockReturnValue(true)
      render(<MobileDiffViewerScreen taskId="task-abc" />)
      // The component renders and uses reduced motion — verify hook was called
      expect(mockUseReducedMotion).toHaveBeenCalled()
    })
  })

  describe('conflict banner (AC 13)', () => {
    it('conflict banner has role="alert"', async () => {
      let capturedOptions: Record<string, unknown> = {}
      mockApprovalMutation.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts
        return { approve: mockApprove, isPending: false, isSuccess: false, isError: false, error: null }
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      await act(async () => {
        ;(capturedOptions.onConflict as (msg: string) => void)?.('conflict!')
      })

      const banner = screen.getByTestId('mobile-review-conflict-banner')
      expect(banner).toHaveAttribute('role', 'alert')
    })

    it('shows static conflict resolution text', async () => {
      let capturedOptions: Record<string, unknown> = {}
      mockApprovalMutation.mockImplementation((opts: Record<string, unknown>) => {
        capturedOptions = opts
        return { approve: mockApprove, isPending: false, isSuccess: false, isError: false, error: null }
      })

      render(<MobileDiffViewerScreen taskId="task-abc" />)

      await act(async () => {
        ;(capturedOptions.onConflict as (msg: string) => void)?.('conflict detected')
      })

      expect(screen.getByText(/Resolve conflicts on desktop to approve/i)).toBeInTheDocument()
    })
  })
})
