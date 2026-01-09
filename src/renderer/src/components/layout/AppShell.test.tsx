import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './AppShell'
import { useUIStore } from '@renderer/stores/ui.store'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// Mock ResponsiveContainer to avoid dimension warnings in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 64, height: 24 }}>{children}</div>
    )
  }
})

// Mock the TerminalDock to avoid xterm.js and tRPC dependencies
vi.mock('@renderer/components/terminal', () => ({
  TerminalDock: () => <div data-testid="terminal-dock">Mock TerminalDock</div>
}))

// Mock tRPC for SprintList in Sidebar, FilterPanel in Header (Story 2.6), VelocityWidget (Story 2.7), and ImportStoriesDialog (Story 3.7)
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      tasks: { getAllWithEpics: { invalidate: vi.fn() } },
      epics: { getAll: { invalidate: vi.fn() } }
    }),
    sprints: {
      getAll: {
        useQuery: () => ({
          data: [],
          isLoading: false
        })
      }
    },
    epics: {
      getAll: {
        useQuery: () => ({
          data: [],
          isLoading: false
        })
      }
    },
    velocity: {
      getWeeklyVelocity: {
        useQuery: () => ({
          data: {
            weeks: [
              { week: '2026-02', count: 5, startDate: new Date(), endDate: new Date() },
              { week: '2026-01', count: 3, startDate: new Date(), endDate: new Date() }
            ],
            totalCompleted: 8,
            avgVelocity: 4
          },
          isLoading: false
        })
      },
      getDailyVelocity: {
        useQuery: () => ({
          data: { days: [], totalCompleted: 0 },
          isLoading: false
        })
      }
    },
    // Story 3.7: Mock import router for ImportStoriesDialog
    import: {
      importStoriesFromEpics: {
        useMutation: () => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn().mockResolvedValue({
            epicsCreated: 0,
            epicsUpdated: 0,
            storiesCreated: 0,
            storiesUpdated: 0,
            epicIds: [],
            storyIds: []
          }),
          isPending: false,
          reset: vi.fn(),
          data: null,
          error: null
        })
      }
    },
    config: {
      showOpenDialog: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false
        })
      }
    }
  }
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('AppShell', () => {
  beforeEach(() => {
    // Story 2.6: Reset all UI store state including filters
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null
    })
    useTerminalStore.setState({
      isExpanded: true,
      height: 300,
      activeProcessId: null
    })
  })

  it('should render header with TinSu title', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render sidebar', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toBeInTheDocument()
  })

  it('should render main content area', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
  })

  it('should display default placeholder text', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    expect(screen.getByText('Ready for development')).toBeInTheDocument()
  })

  it('should render children in main content', () => {
    render(
      <AppShell>
        <div data-testid="child">Custom content</div>
      </AppShell>,
      { wrapper: createWrapper() }
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('Ready for development')).not.toBeInTheDocument()
  })

  it('should have min-width of 1024px', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    // The container is 2 levels up from the header (header > wrapper div > container)
    const container = screen.getByRole('banner').parentElement?.parentElement
    expect(container).toHaveClass('min-w-[1024px]')
  })

  it('should have min-h-screen for full viewport height', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    // The container is 2 levels up from the header (header > wrapper div > container)
    const container = screen.getByRole('banner').parentElement?.parentElement
    expect(container).toHaveClass('min-h-screen')
  })

  it('should have correct layout structure', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    const header = screen.getByRole('banner')
    const sidebar = screen.getByRole('complementary')
    const main = screen.getByRole('main')

    // All elements should be in the document
    expect(header).toBeInTheDocument()
    expect(sidebar).toBeInTheDocument()
    expect(main).toBeInTheDocument()
  })

  it('should render terminal dock', () => {
    render(<AppShell />, { wrapper: createWrapper() })
    expect(screen.getByTestId('terminal-dock')).toBeInTheDocument()
  })

  it('should apply bottom padding based on terminal height', () => {
    useTerminalStore.setState({ isExpanded: true, height: 350 })
    render(<AppShell />, { wrapper: createWrapper() })
    // The flex container should have padding-bottom equal to terminal height
    const flexContainer = screen.getByRole('complementary').parentElement
    expect(flexContainer).toHaveStyle({ paddingBottom: '350px' })
  })

  it('should apply minimum padding when terminal is collapsed', () => {
    useTerminalStore.setState({ isExpanded: false, height: 350 })
    render(<AppShell />, { wrapper: createWrapper() })
    // When collapsed, minimum height is 80px
    const flexContainer = screen.getByRole('complementary').parentElement
    expect(flexContainer).toHaveStyle({ paddingBottom: '80px' })
  })
})
