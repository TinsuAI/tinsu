import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// ── Module mocks ──────────────────────────────────────────────────────

// Mock viewport class hook — we control the return value per test
vi.mock('./hooks/useViewportClass', () => ({
  useViewportClass: vi.fn(),
}))

// MobileApp placeholder
vi.mock('./mobile/MobileApp', () => ({
  MobileApp: () => <div data-testid="mobile-app">MobileApp</div>,
}))

// DesktopApp sub-components — stub everything out to avoid deep dep trees
vi.mock('./components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}))
vi.mock('./components/Welcome', () => ({
  Welcome: () => <div data-testid="welcome">Welcome</div>,
}))
vi.mock('./components/board', () => ({
  KanbanBoardContainer: () => <div data-testid="kanban">Kanban</div>,
}))
vi.mock('./components/story', () => ({
  StoryFullView: () => <div data-testid="story-full-view">StoryFullView</div>,
}))
vi.mock('./pages/TaskWorkspacePage', () => ({
  TaskWorkspacePage: () => <div data-testid="task-workspace">TaskWorkspace</div>,
}))
vi.mock('./pages/PlanningWorkspacePage', () => ({
  PlanningWorkspacePage: () => <div data-testid="planning-workspace">PlanningWorkspace</div>,
}))
vi.mock('./components/dialogs/CrashRecoveryDialog', () => ({
  CrashRecoveryDialog: () => null,
}))
vi.mock('./components/ui/sonner', () => ({
  Toaster: () => null,
}))
vi.mock('./components/ProjectSetupDialog', () => ({
  ProjectSetupDialog: () => null,
}))
vi.mock('./lib/trpc', () => ({
  trpc: {
    git: { checkCrashRecovery: { useQuery: () => ({ refetch: vi.fn() }) } },
    project: { checkToolHealth: { useQuery: () => ({ refetch: vi.fn() }) } },
  },
}))
const mockProjectState = {
  projectPath: null,    // No project loaded — shows Welcome, no reopen effect
  projectName: null,
  setProject: vi.fn(),
  clearProject: vi.fn(),
  activeProjectId: null,
}

vi.mock('./stores/project.store', () => ({
  useProjectStore: vi.fn((selector?: (s: any) => any) =>
    selector ? selector(mockProjectState) : mockProjectState
  ),
}))
vi.mock('./stores', () => ({
  useStoryViewStore: vi.fn((selector: (s: any) => any) => selector({ activeStoryId: null })),
  useTaskWorkspaceStore: vi.fn((selector: (s: any) => any) => selector({ activeTaskId: null })),
  usePlanningWorkspaceStore: vi.fn((selector: (s: any) => any) => selector({ isOpen: false })),
}))
vi.mock('./hooks/useFileWatcher', () => ({ useFileWatcher: vi.fn() }))
vi.mock('./hooks/useProjectCommands', () => ({
  useOpenProjectByPath: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'p1', path: '/p', name: 'Test' }) }),
}))
vi.mock('./hooks/useNetworkResilience', () => ({ useNetworkResilience: vi.fn() }))

// ── Tests ─────────────────────────────────────────────────────────────

describe('App viewport router', () => {
  it('renders MobileApp when viewport is "mobile"', async () => {
    const { useViewportClass } = await import('./hooks/useViewportClass')
    vi.mocked(useViewportClass).mockReturnValue('mobile')

    render(<App />)
    expect(screen.getByTestId('mobile-app')).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
  })

  it('renders desktop tree (Welcome) when viewport is "desktop" and no project loaded', async () => {
    const { useViewportClass } = await import('./hooks/useViewportClass')
    vi.mocked(useViewportClass).mockReturnValue('desktop')

    render(<App />)
    expect(screen.queryByTestId('mobile-app')).not.toBeInTheDocument()
    // No project loaded → DesktopApp renders <Welcome>
    expect(screen.getByTestId('welcome')).toBeInTheDocument()
  })

  it('renders desktop tree (Welcome) when viewport is "desktop" (second assertion)', async () => {
    const { useViewportClass } = await import('./hooks/useViewportClass')
    vi.mocked(useViewportClass).mockReturnValue('desktop')

    render(<App />)
    expect(screen.queryByTestId('mobile-app')).not.toBeInTheDocument()
    expect(screen.getByTestId('welcome')).toBeInTheDocument()
  })
})
