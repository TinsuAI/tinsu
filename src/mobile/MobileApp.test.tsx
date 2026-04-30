import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MobileApp, isFullScreenRoute } from './MobileApp'
import { useMobileNavStore } from './shell/mobile-nav.store'

// ── Module mocks ─────────────────────────────────────────────────────

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: (selector: (s: { projectName: string | null; activeProjectId: string | null }) => unknown) =>
    selector({ projectName: 'TestProject', activeProjectId: 'proj-1' }),
}))

// Mock deep-link plugin — not available in test env
vi.mock('@tauri-apps/plugin-deep-link', () => ({
  onOpenUrl: vi.fn().mockResolvedValue(vi.fn()),   // returns unlisten fn
  getCurrent: vi.fn().mockResolvedValue(null),
}))

// Mock task commands — MobileBoardScreen (the real board) uses these hooks.
// Without this, React Query throws "No QueryClient set" when board tab renders.
vi.mock('@renderer/hooks/useTaskCommands', () => ({
  useListTasks: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useUpdateTaskStatus: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useReorderTasks: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useCreateTask: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

// Mock MobileTaskWorkspaceScreen so MobileApp.test.tsx doesn't need full
// workspace dependencies (TaskTerminal, ActivitiesTab, etc.)
vi.mock('./tasks/MobileTaskWorkspaceScreen', () => ({
  MobileTaskWorkspaceScreen: ({ taskId }: { taskId: string }) => (
    <div data-testid="mobile-task-workspace" data-task-id={taskId}>
      Workspace for {taskId}
    </div>
  ),
}))

// Mock MobileChatScreen — T3.5-5 (keeps MobileApp.test.tsx free of chat deps)
vi.mock('./planning/MobileChatScreen', () => ({
  MobileChatScreen: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="mobile-chat-screen" data-session-id={sessionId}>
      Chat for {sessionId}
    </div>
  ),
}))

// Mock MobileDiffViewerScreen — T3.5-6
vi.mock('./review/MobileDiffViewerScreen', () => ({
  MobileDiffViewerScreen: ({ taskId }: { taskId: string }) => (
    <div data-testid="mobile-review-screen" data-task-id={taskId}>
      Review for {taskId}
    </div>
  ),
}))

// Mock MobilePlanningHome — T3.5-5 (now uses useQuery; mock to avoid QueryClient requirement)
vi.mock('./planning/MobilePlanningHome', () => ({
  MobilePlanningHome: () => (
    <div>
      <h2>Planning</h2>
    </div>
  ),
}))

// Mock trpc for workspace routes (used by MobileTaskWorkspaceScreen mock)
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getById: {
        useQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
      },
    },
  },
}))

// ── Reset store before each test ─────────────────────────────────────

beforeEach(() => {
  useMobileNavStore.setState({
    activeTab: 'board',
    tabStacks: {
      board:    ['board'],
      planning: ['sessions'],
      tasks:    ['list'],
      activity: ['feed'],
      settings: ['home'],
    },
    sheetState: null,
  })
})

// ── Helpers ──────────────────────────────────────────────────────────

function renderMobileApp() {
  return render(<MobileApp />)
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('MobileApp', () => {
  it('renders all 5 tab buttons with correct test IDs', () => {
    renderMobileApp()
    expect(screen.getByTestId('mobile-tab-board')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-planning')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-tasks')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-activity')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-tab-settings')).toBeInTheDocument()
  })

  it('renders tab labels', () => {
    renderMobileApp()
    // Use getAllByText since tab label + empty state h2 may share the same text
    expect(screen.getAllByText('Board').length).toBeGreaterThanOrEqual(1)
    // Use testid for definitive tab label assertions
    expect(screen.getByTestId('mobile-tab-planning')).toHaveTextContent('Planning')
    expect(screen.getByTestId('mobile-tab-tasks')).toHaveTextContent('Tasks')
    expect(screen.getByTestId('mobile-tab-activity')).toHaveTextContent('Activity')
    expect(screen.getByTestId('mobile-tab-settings')).toHaveTextContent('Settings')
  })

  it('shows project name in top bar', () => {
    renderMobileApp()
    expect(screen.getByTestId('mobile-top-bar-project-name')).toHaveTextContent('TestProject')
  })

  it('starts on board tab and shows Board screen', () => {
    renderMobileApp()
    expect(screen.getByTestId('mobile-tab-board').getAttribute('aria-selected')).toBe('true')
    // MobileBoardScreen (real board) renders — verify it mounts without error
    expect(screen.getByTestId('mobile-board-screen')).toBeInTheDocument()
  })

  function tapTab(testId: string): void {
    const btn = screen.getByTestId(testId)
    // Tab uses pointerDown+Up for long-press detection — simulate a short tap
    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
  }

  it('tapping a tab switches activeTab in store', () => {
    renderMobileApp()
    tapTab('mobile-tab-planning')
    expect(useMobileNavStore.getState().activeTab).toBe('planning')
  })

  it('tapping planning tab shows Planning placeholder', () => {
    renderMobileApp()
    tapTab('mobile-tab-planning')
    // MobileEmptyState h2 should contain "Planning"
    const headings = screen.getAllByText('Planning')
    expect(headings.some((el) => el.tagName === 'H2')).toBe(true)
  })

  it('tapping tasks tab shows Tasks placeholder', () => {
    renderMobileApp()
    tapTab('mobile-tab-tasks')
    const headings = screen.getAllByText('Tasks')
    expect(headings.some((el) => el.tagName === 'H2')).toBe(true)
  })

  it('tapping activity tab shows Activity placeholder', () => {
    renderMobileApp()
    tapTab('mobile-tab-activity')
    const headings = screen.getAllByText('Activity')
    expect(headings.some((el) => el.tagName === 'H2')).toBe(true)
  })

  it('tapping settings tab shows Settings placeholder', () => {
    renderMobileApp()
    tapTab('mobile-tab-settings')
    const headings = screen.getAllByText('Settings')
    expect(headings.some((el) => el.tagName === 'H2')).toBe(true)
  })

  it('renders MobileTaskWorkspaceScreen for workspace:* route on tasks tab', () => {
    // Push a workspace route onto tasks stack
    useMobileNavStore.getState().pushRoute('tasks', 'workspace:task-123')
    useMobileNavStore.setState({ activeTab: 'tasks' })
    renderMobileApp()
    expect(screen.getByTestId('mobile-task-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-task-workspace')).toHaveAttribute('data-task-id', 'task-123')
  })

  it('renders MobileTaskWorkspaceScreen for workspace:* route on board tab', () => {
    // Push a workspace route onto board stack (T3.5-3 tap-to-push path)
    useMobileNavStore.getState().pushRoute('board', 'workspace:board-task-456')
    useMobileNavStore.setState({ activeTab: 'board' })
    renderMobileApp()
    expect(screen.getByTestId('mobile-task-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-task-workspace')).toHaveAttribute('data-task-id', 'board-task-456')
  })

  it('workspace route bypasses root MobileScreen (no tab bar rendered)', () => {
    useMobileNavStore.getState().pushRoute('board', 'workspace:task-abc')
    useMobileNavStore.setState({ activeTab: 'board' })
    renderMobileApp()
    // Full-screen route: no mobile-screen wrapper with tab bar
    expect(screen.queryByTestId('mobile-screen')).not.toBeInTheDocument()
    // The workspace component IS rendered
    expect(screen.getByTestId('mobile-task-workspace')).toBeInTheDocument()
  })

  it('renders MobileChatScreen for chat:* route (T3.5-5)', () => {
    useMobileNavStore.getState().pushRoute('planning', 'chat:session-1')
    useMobileNavStore.setState({ activeTab: 'planning' })
    renderMobileApp()
    expect(screen.getByTestId('mobile-chat-screen')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-chat-screen')).toHaveAttribute('data-session-id', 'session-1')
  })

  it('renders MobileDiffViewerScreen for review:* route (T3.5-6)', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'review:task-rev-1')
    useMobileNavStore.setState({ activeTab: 'tasks' })
    renderMobileApp()
    expect(screen.getByTestId('mobile-review-screen')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-review-screen')).toHaveAttribute('data-task-id', 'task-rev-1')
  })

  it('review route bypasses root MobileScreen (no tab bar)', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'review:task-rev-2')
    useMobileNavStore.setState({ activeTab: 'tasks' })
    renderMobileApp()
    expect(screen.queryByTestId('mobile-screen')).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-review-screen')).toBeInTheDocument()
  })

  it('MobileScreen wraps content in data-testid="mobile-screen"', () => {
    renderMobileApp()
    expect(screen.getByTestId('mobile-screen')).toBeInTheDocument()
  })
})

describe('isFullScreenRoute', () => {
  it('returns true for workspace: routes', () => {
    expect(isFullScreenRoute('workspace:abc')).toBe(true)
    expect(isFullScreenRoute('workspace:task-123')).toBe(true)
  })

  it('returns false for tab root routes', () => {
    expect(isFullScreenRoute('board')).toBe(false)
    expect(isFullScreenRoute('sessions')).toBe(false)
    expect(isFullScreenRoute('list')).toBe(false)
    expect(isFullScreenRoute('feed')).toBe(false)
    expect(isFullScreenRoute('home')).toBe(false)
  })

  it('returns true for chat: routes (T3.5-5 — chat is now full-screen)', () => {
    expect(isFullScreenRoute('chat:session-1')).toBe(true)
    expect(isFullScreenRoute('chat:abc')).toBe(true)
    expect(isFullScreenRoute('chat:foo')).toBe(true)
  })

  it('returns false for diff route', () => {
    expect(isFullScreenRoute('diff')).toBe(false)
  })

  it('returns true for review: routes (T3.5-6)', () => {
    expect(isFullScreenRoute('review:task-abc')).toBe(true)
    expect(isFullScreenRoute('review:task-123')).toBe(true)
    expect(isFullScreenRoute('review:foo')).toBe(true)
  })
})

describe('MobileApp — review route integration (T3.5-6 AC 1, 16)', () => {
  it('review:abc route renders MobileDiffViewerScreen with taskId="abc"', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'review:abc')
    useMobileNavStore.setState({ activeTab: 'tasks' })
    renderMobileApp()
    const reviewScreen = screen.getByTestId('mobile-review-screen')
    expect(reviewScreen).toBeInTheDocument()
    expect(reviewScreen).toHaveAttribute('data-task-id', 'abc')
  })

  it('isFullScreenRoute("review:abc") === true (AC 1)', () => {
    expect(isFullScreenRoute('review:abc')).toBe(true)
  })

  it('Android back-press from review:abc returns to workspace screen (AC 16)', () => {
    // Simulate stack: list → workspace:abc → review:abc
    useMobileNavStore.setState({
      activeTab: 'tasks',
      tabStacks: {
        board:    ['board'],
        planning: ['sessions'],
        tasks:    ['list', 'workspace:abc', 'review:abc'],
        activity: ['feed'],
        settings: ['home'],
      },
      sheetState: null,
    })
    renderMobileApp()

    // Currently on review screen
    expect(screen.getByTestId('mobile-review-screen')).toBeInTheDocument()

    // Handle back press — pops review:abc from tasks stack
    act(() => {
      useMobileNavStore.getState().handleBackPress()
    })

    // Now top of stack should be workspace:abc
    const stackAfter = useMobileNavStore.getState().tabStacks.tasks
    expect(stackAfter[stackAfter.length - 1]).toBe('workspace:abc')
  })
})

describe('MobileApp — chat route integration (T3.5-5 AC 14, 19f)', () => {
  it('chat:abc route renders MobileChatScreen with sessionId="abc"', () => {
    useMobileNavStore.getState().pushRoute('planning', 'chat:abc')
    useMobileNavStore.setState({ activeTab: 'planning' })
    renderMobileApp()
    const chatScreen = screen.getByTestId('mobile-chat-screen')
    expect(chatScreen).toBeInTheDocument()
    expect(chatScreen).toHaveAttribute('data-session-id', 'abc')
  })

  it('chat route bypasses root MobileScreen (no tab bar)', () => {
    useMobileNavStore.getState().pushRoute('planning', 'chat:abc')
    useMobileNavStore.setState({ activeTab: 'planning' })
    renderMobileApp()
    expect(screen.queryByTestId('mobile-screen')).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-chat-screen')).toBeInTheDocument()
  })

  it('deep-link integration: tabStacks.planning = ["sessions","chat:abc"] renders chat screen', () => {
    // Simulate navigateToDeepLink result: planning stack has sessions + chat:abc
    useMobileNavStore.setState({
      activeTab: 'planning',
      tabStacks: {
        board: ['board'],
        planning: ['sessions', 'chat:abc'],
        tasks: ['list'],
        activity: ['feed'],
        settings: ['home'],
      },
    })
    renderMobileApp()
    const chatScreen = screen.getByTestId('mobile-chat-screen')
    expect(chatScreen).toBeInTheDocument()
    expect(chatScreen).toHaveAttribute('data-session-id', 'abc')
  })
})
