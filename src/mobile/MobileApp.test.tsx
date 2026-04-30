import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders placeholder for unimplemented route chat:*', () => {
    useMobileNavStore.getState().pushRoute('planning', 'chat:session-1')
    useMobileNavStore.setState({ activeTab: 'planning' })
    renderMobileApp()
    expect(screen.getByText('Planning Chat')).toBeInTheDocument()
  })

  it('renders placeholder for unimplemented route diff', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'diff')
    useMobileNavStore.setState({ activeTab: 'tasks' })
    renderMobileApp()
    expect(screen.getByText('Code Diff')).toBeInTheDocument()
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

  it('returns false for chat: routes (placeholder for T3.5-5)', () => {
    expect(isFullScreenRoute('chat:session-1')).toBe(false)
  })

  it('returns false for diff route', () => {
    expect(isFullScreenRoute('diff')).toBe(false)
  })
})
