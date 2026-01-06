import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'

// Mock tRPC for FilterPanel
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    epics: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } },
    sprints: { getAll: { useQuery: vi.fn(() => ({ data: [] })) } }
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

  it('should render Open Project button when onOpenProject is provided', () => {
    const onOpenProject = vi.fn()

    render(<Header onOpenProject={onOpenProject} />)

    const button = screen.getByText('Open Project...')
    expect(button).toBeInTheDocument()
  })

  it('should call onOpenProject when button is clicked', () => {
    const onOpenProject = vi.fn()

    render(<Header onOpenProject={onOpenProject} />)

    const button = screen.getByText('Open Project...')
    fireEvent.click(button)

    expect(onOpenProject).toHaveBeenCalled()
  })

  it('should not render Open Project button when onOpenProject is not provided', () => {
    render(<Header />)

    expect(screen.queryByText('Open Project...')).not.toBeInTheDocument()
  })

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
})
