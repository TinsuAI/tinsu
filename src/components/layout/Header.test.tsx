import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'

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

// Mock remote project hooks to avoid QueryClient requirement
vi.mock('@renderer/hooks/useRemoteProjectSwitcher', () => ({
  useRemoteConnectionStatus: () => ({ data: undefined, isPending: false }),
  useReconnectRemoteProject: () => ({ mutate: vi.fn(), isPending: false }),
}))

// Mock ProjectSwitcher to avoid QueryClient requirement (it uses useQuery internally)
vi.mock('@renderer/components/project', () => ({
  ProjectSwitcher: () => <span data-testid="project-switcher-mock" />,
}))

// Mock tRPC for FilterPanel and VelocityWidget
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    epics: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } },
    sprints: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } },
    velocity: {
      getWeeklyVelocity: {
        useQuery: vi.fn(() => ({
          data: {
            weeks: [
              { week: '2026-02', count: 5, startDate: new Date(), endDate: new Date() },
              { week: '2026-01', count: 3, startDate: new Date(), endDate: new Date() }
            ],
            totalCompleted: 8,
            avgVelocity: 4
          },
          isLoading: false
        }))
      },
      getDailyVelocity: {
        useQuery: vi.fn(() => ({
          data: { days: [], totalCompleted: 0 },
          isLoading: false
        }))
      }
    }
  }
}))

describe('Header', () => {
  beforeEach(() => {
    // Reset project store before each test
    useProjectStore.setState({
      projectPath: null,
      projectName: null
    })
    // Reset UI store before each test
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null
    })
  })

  it('should render with TinSu title', () => {
    render(<Header />)
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render as a header element', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('should have sticky positioning classes', () => {
    render(<Header />)
    // The sticky classes are now on the wrapper div, not the header element directly
    const wrapper = screen.getByRole('banner').parentElement!
    expect(wrapper).toHaveClass('sticky', 'top-0')
  })

  it('should have 48px height (h-12)', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('h-12')
  })

  it('should accept custom className', () => {
    render(<Header className="custom-class" />)
    // Custom class is now on the wrapper div
    const wrapper = screen.getByRole('banner').parentElement!
    expect(wrapper).toHaveClass('custom-class')
  })

  it('should display project name when loaded', () => {
    useProjectStore.setState({ projectName: 'MyProject' })

    render(<Header />)

    expect(screen.getByText('TinSu')).toBeInTheDocument()
    expect(screen.getByText('- MyProject')).toBeInTheDocument()
  })

  it('should not display project name when no project loaded', () => {
    render(<Header />)

    expect(screen.getByText('TinSu')).toBeInTheDocument()
    expect(screen.queryByText(/-/)).not.toBeInTheDocument()
  })

  // Note: "Open Project" functionality has moved to ProjectSwitcher component

  // Story 2.6: Filter button tests
  describe('filter controls (Story 2.6)', () => {
    it('should render filter button', () => {
      render(<Header />)

      const filterButton = screen.getByTestId('filter-button')
      expect(filterButton).toBeInTheDocument()
    })

    it('should not show clear filters button when no filters active', () => {
      render(<Header />)

      expect(screen.queryByTestId('header-clear-filters')).not.toBeInTheDocument()
    })

    it('should show clear filters button when filters are active', () => {
      useUIStore.setState({
        sidebarCollapsed: false,
        selectedSprintId: 'sprint-1',
        selectedEpicIds: [],
        selectedStatuses: [],
        lastProjectPath: null
      })

      render(<Header />)

      const clearButton = screen.getByTestId('header-clear-filters')
      expect(clearButton).toBeInTheDocument()
    })

    it('should clear all filters when clear button clicked', () => {
      useUIStore.setState({
        sidebarCollapsed: false,
        selectedSprintId: 'sprint-1',
        selectedEpicIds: ['epic-1'],
        selectedStatuses: ['backlog'],
        lastProjectPath: null
      })

      render(<Header />)

      const clearButton = screen.getByTestId('header-clear-filters')
      fireEvent.click(clearButton)

      const state = useUIStore.getState()
      expect(state.selectedSprintId).toBeNull()
      expect(state.selectedEpicIds).toEqual([])
      expect(state.selectedStatuses).toEqual([])
    })

    it('should open filter panel when filter button clicked', () => {
      render(<Header />)

      const filterButton = screen.getByTestId('filter-button')
      fireEvent.click(filterButton)

      // Filter panel should be open
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
    })
  })

  // Story 2.7: Velocity widget tests
  describe('velocity widget (Story 2.7)', () => {
    it('should render velocity widget in header', () => {
      render(<Header />)

      const velocityWidget = screen.getByTestId('velocity-widget')
      expect(velocityWidget).toBeInTheDocument()
    })

    it('should show current week count', () => {
      render(<Header />)

      // The mock data has count: 5 for the current week
      expect(screen.getByTestId('velocity-count')).toHaveTextContent('5')
      expect(screen.getByText('this week')).toBeInTheDocument()
    })

    it('should show velocity chart', () => {
      render(<Header />)

      expect(screen.getByTestId('velocity-chart')).toBeInTheDocument()
    })
  })
})
