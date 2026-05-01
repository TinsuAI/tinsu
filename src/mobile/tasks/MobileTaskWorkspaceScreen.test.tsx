import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  type Mock,
} from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MobileTaskWorkspaceScreen } from './MobileTaskWorkspaceScreen'
import { useMobileNavStore } from '../shell/mobile-nav.store'

/* ── Module mocks ──────────────────────────────────────────────────── */

const mockPopRoute = vi.fn()
const mockPushRoute = vi.fn()

vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = {
          activeTab: 'board',
          popRoute: mockPopRoute,
          pushRoute: mockPushRoute,
        }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({
          activeTab: 'board',
          popRoute: mockPopRoute,
          pushRoute: mockPushRoute,
        })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
  }
})

// Mock trpc — wire task data via per-test overrides
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

// Mock useReducedMotion — default to false (smooth scroll)
const mockUseReducedMotion = vi.fn(() => false)
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// Mock cross-tree components (AC 16)
vi.mock('@renderer/components/task/TaskTerminal', () => ({
  TaskTerminal: vi.fn().mockImplementation(({ taskId }: { taskId: string }) => (
    <div data-testid="task-terminal-mock" data-task-id={taskId} />
  )),
}))

vi.mock('@renderer/components/terminal/TerminalAccessoryBar', () => ({
  TerminalAccessoryBar: ({ onKeyPress }: { onKeyPress: (k: string) => void }) => (
    <div data-testid="terminal-accessory-bar" onClick={() => onKeyPress('\t')} />
  ),
}))

vi.mock('@renderer/components/task/ActivitiesTab', () => ({
  ActivitiesTab: ({ taskId }: { taskId: string }) => (
    <div data-testid="activities-tab-mock" data-task-id={taskId} />
  ),
}))

vi.mock('@renderer/components/review/MobileDiffViewer', () => ({
  MobileDiffViewer: ({ taskId }: { taskId: string }) => (
    <div data-testid="mobile-diff-viewer-mock" data-task-id={taskId} />
  ),
}))

vi.mock('@renderer/components/task/MarkdownComponents', () => ({
  markdownComponents: {},
}))

vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  ),
}))

vi.mock('remark-gfm', () => ({ default: () => {} }))

/* ── navigator.vibrate stub ─────────────────────────────────────────── */

beforeAll(() => {
  if (!('vibrate' in navigator)) {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      writable: true,
      configurable: true,
    })
  }
})

/* ── Helpers ─────────────────────────────────────────────────────────── */

function makeTask(overrides = {}) {
  return {
    id: 'task-abc123',
    title: 'My Awesome Task',
    description: 'Task description',
    status: 'in_progress',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    task_type: 'story',
    phase_number: null,
    phase_name: null,
    bmad_agent: null,
    bmad_workflow: null,
    is_start_here: null,
    artifact_path: null,
    story_number: null,
    story_file_path: null,
    full_content: null,
    story_file_status: null,
    context_notes: null,
    project_id: 'proj-1',
    worktree_path: null,
    branch_name: null,
    merge_commit_sha: null,
    has_merge_conflict: null,
    conflict_files: null,
    rejection_feedback: null,
    rejected_agent_run_id: null,
    inline_comments: null,
    rejection_count: null,
    last_review_commit: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetByIdQuery.mockReturnValue({
    data: makeTask(),
    isLoading: false,
    error: null,
  })
  mockUseReducedMotion.mockReturnValue(false)
  ;(useMobileNavStore.getState as Mock).mockReturnValue({
    activeTab: 'board',
    popRoute: mockPopRoute,
    pushRoute: mockPushRoute,
  })
})

function renderWorkspace(taskId = 'task-abc123') {
  return render(<MobileTaskWorkspaceScreen taskId={taskId} />)
}

/* ── Tests ─────────────────────────────────────────────────────────── */

describe('MobileTaskWorkspaceScreen', () => {
  // AC 18(a): workspace root testid
  it('renders mobile-task-workspace root', () => {
    renderWorkspace()
    expect(screen.getByTestId('mobile-task-workspace')).toBeInTheDocument()
  })

  // AC 18(b): top app bar + back button
  it('renders back button in top app bar', () => {
    renderWorkspace()
    expect(screen.getByTestId('mobile-top-bar-back-button')).toBeInTheDocument()
  })

  it('back button calls popRoute when clicked', () => {
    renderWorkspace()
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledTimes(1)
  })

  it('renders task title truncated to 32 chars in the workspace title bar', () => {
    const longTitle = 'A'.repeat(40)
    mockGetByIdQuery.mockReturnValue({
      data: makeTask({ title: longTitle }),
      isLoading: false,
      error: null,
    })
    renderWorkspace()
    // Title shown in center title element in workspace top bar
    const topBarTitle = screen.getByTestId('mobile-workspace-title')
    expect(topBarTitle).toHaveTextContent(longTitle.slice(0, 32) + '…')
  })

  it('renders Task #<short-id> when title is empty', () => {
    mockGetByIdQuery.mockReturnValue({
      data: makeTask({ title: '', id: 'abcdef999' }),
      isLoading: false,
      error: null,
    })
    renderWorkspace()
    expect(screen.getByTestId('mobile-workspace-title')).toHaveTextContent('Task #abcde')
  })

  // AC 18(c): overflow menu
  it('renders overflow menu button', () => {
    renderWorkspace()
    expect(screen.getByTestId('mobile-task-workspace-menu')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-task-workspace-menu')).toHaveAttribute('aria-label', 'Task menu')
  })

  it('overflow menu opens MobileSheet with 6 disabled rows', async () => {
    renderWorkspace()
    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-task-workspace-menu'))
    })
    // The sheet renders inside a portal — check for Coming soon hints
    const comingSoon = screen.getAllByText('Coming soon')
    expect(comingSoon).toHaveLength(6)
    // Each row should be disabled
    const disabledRows = screen.getAllByRole('button', { name: /View reasoning log|Pause|Run history|Edit|Archive|Delete/i })
    disabledRows.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  // AC 18(d): segmented tabs — 4 sub-tabs in canonical order
  it('renders exactly 4 segmented tabs in canonical order', () => {
    renderWorkspace()
    const tabs = screen.getAllByRole('tab')
    const labels = tabs.map((t) => t.textContent)
    expect(labels).toEqual(['Content', 'Terminal', 'Activities', 'Diff'])
  })

  it('Content tab is selected by default', () => {
    renderWorkspace()
    const contentTab = screen.getByTestId('mobile-segmented-tab-content')
    expect(contentTab).toHaveAttribute('aria-selected', 'true')
  })

  it('segmented tabs container has correct ariaLabel', () => {
    renderWorkspace()
    const tablist = screen.getByRole('tablist')
    expect(tablist).toHaveAttribute('aria-label', 'Task workspace sub-tabs')
  })

  // AC 18(e): clicking segmented tab calls scrollTo on pager ref
  it('clicking a segmented tab invokes scrollTo on pager', () => {
    const scrollToMock = vi.fn()
    renderWorkspace()

    const pager = screen.getByTestId('mobile-task-workspace').querySelector(
      'div[class*="snap-x"]',
    ) as HTMLDivElement

    if (pager) {
      Object.defineProperty(pager, 'scrollTo', {
        value: scrollToMock,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(pager, 'clientWidth', {
        get: () => 375,
        configurable: true,
      })
    }

    fireEvent.click(screen.getByTestId('mobile-segmented-tab-terminal'))
    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ left: 375, behavior: 'smooth' }),
    )
  })

  // AC 18(f): horizontal scroll past 50% updates activeSubTab
  it('horizontal scroll updates activeSubTab when scroll passes 50%', () => {
    renderWorkspace()

    const pager = screen.getByTestId('mobile-task-workspace').querySelector(
      'div[class*="snap-x"]',
    ) as HTMLDivElement

    expect(pager).toBeTruthy()

    // Simulate scrolling to Activities tab (index 2, clientWidth=375)
    Object.defineProperty(pager, 'scrollLeft', {
      get: () => 750, // 2 * 375
      configurable: true,
    })
    Object.defineProperty(pager, 'clientWidth', {
      get: () => 375,
      configurable: true,
    })

    fireEvent.scroll(pager)

    // Activities tab should now be selected
    expect(screen.getByTestId('mobile-segmented-tab-activities')).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  // AC 18(g): Content sub-tab renders task title and status badge
  it('Content tab renders task title and status badge', () => {
    renderWorkspace()
    // Task title rendered in content tab
    expect(screen.getByTestId('mobile-content-tab')).toBeInTheDocument()
    // Status badge present
    expect(screen.getByTestId('mobile-content-tab-status')).toBeInTheDocument()
  })

  // AC 18(h): Terminal sub-tab mounts TaskTerminal
  it('Terminal sub-tab mounts TaskTerminal mock', () => {
    renderWorkspace()
    // TaskTerminal is always mounted (all slides stay mounted)
    expect(screen.getByTestId('task-terminal-mock')).toBeInTheDocument()
  })

  // AC 18(i): Activities sub-tab mounts ActivitiesTab
  it('Activities sub-tab mounts ActivitiesTab mock', () => {
    renderWorkspace()
    expect(screen.getByTestId('activities-tab-mock')).toBeInTheDocument()
  })

  // AC 18(j): Diff sub-tab mounts MobileDiffViewer for review status
  it('Diff sub-tab mounts MobileDiffViewer for review task', () => {
    mockGetByIdQuery.mockReturnValue({
      data: makeTask({ status: 'review' }),
      isLoading: false,
      error: null,
    })
    renderWorkspace()
    expect(screen.getByTestId('mobile-diff-viewer-mock')).toBeInTheDocument()
  })

  // AC 18(k): Diff sub-tab shows empty state for backlog with no worktree
  it('Diff sub-tab shows empty state for backlog task with no worktree', () => {
    mockGetByIdQuery.mockReturnValue({
      data: makeTask({ status: 'backlog', worktree_path: null }),
      isLoading: false,
      error: null,
    })
    renderWorkspace()
    expect(screen.getByText('No changes yet')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-diff-viewer-mock')).not.toBeInTheDocument()
  })

  // AC 18(l): action bar per-sub-tab
  it('action bar shows Edit (disabled) on Content tab', () => {
    renderWorkspace()
    // Content is default — Edit button should be present and disabled
    const primary = screen.getByTestId('mobile-bottom-action-primary')
    expect(primary).toHaveTextContent('Edit')
    expect(primary).toBeDisabled()
  })

  it('action bar shows "Focus terminal" on Terminal tab', async () => {
    renderWorkspace()
    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-segmented-tab-terminal'))
    })
    // After clicking Terminal tab — but we check the action bar via scrollTo.
    // The state update from the click sets activeSubTab to 'terminal' immediately.
    const primary = screen.getByTestId('mobile-bottom-action-primary')
    expect(primary).toHaveTextContent('Focus terminal')
  })

  it('action bar is null (absent) on Activities tab', async () => {
    renderWorkspace()
    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-segmented-tab-activities'))
    })
    expect(screen.queryByTestId('mobile-bottom-action-bar')).not.toBeInTheDocument()
  })

  it('action bar shows Approve + Request changes on Diff tab for review task', async () => {
    mockGetByIdQuery.mockReturnValue({
      data: makeTask({ status: 'review' }),
      isLoading: false,
      error: null,
    })
    renderWorkspace()
    await act(async () => {
      fireEvent.click(screen.getByTestId('mobile-segmented-tab-diff'))
    })
    expect(screen.getByTestId('mobile-bottom-action-primary')).toHaveTextContent('Approve')
    expect(screen.getByTestId('mobile-bottom-action-secondary')).toHaveTextContent('Request changes')
  })

  // AC 18(m): reduced-motion mock causes scrollTo to be called with behavior: 'auto'
  it('uses behavior:"auto" for scrollTo when reduced-motion is active', () => {
    mockUseReducedMotion.mockReturnValue(true)
    const scrollToMock = vi.fn()
    renderWorkspace()

    const pager = screen.getByTestId('mobile-task-workspace').querySelector(
      'div[class*="snap-x"]',
    ) as HTMLDivElement

    if (pager) {
      Object.defineProperty(pager, 'scrollTo', {
        value: scrollToMock,
        writable: true,
        configurable: true,
      })
      Object.defineProperty(pager, 'clientWidth', {
        get: () => 375,
        configurable: true,
      })
    }

    fireEvent.click(screen.getByTestId('mobile-segmented-tab-diff'))
    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    )
  })

  // Loading state
  it('renders loading skeleton when isLoading is true', () => {
    mockGetByIdQuery.mockReturnValue({ data: undefined, isLoading: true, error: null })
    renderWorkspace()
    expect(screen.getAllByTestId('mobile-loading-skeleton-card').length).toBeGreaterThanOrEqual(1)
  })

  // Error state
  it('renders error empty state when task fetch fails', () => {
    mockGetByIdQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    })
    renderWorkspace()
    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })

  // Back-press / navigation (AC 14)
  it('back button invokes popRoute without tab arg', () => {
    renderWorkspace()
    fireEvent.click(screen.getByTestId('mobile-top-bar-back-button'))
    expect(mockPopRoute).toHaveBeenCalledWith()
  })
})
