import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from './FilterPanel'

// Mock UIStore
const mockClearAllFilters = vi.fn()
const mockSetSelectedSprint = vi.fn()
const mockToggleEpicFilter = vi.fn()
const mockToggleStatusFilter = vi.fn()
const mockHasActiveFilters = vi.fn()

vi.mock('@renderer/stores/ui.store', () => ({
  useUIStore: vi.fn(() => ({
    selectedSprintId: null,
    selectedEpicIds: [],
    selectedStatuses: [],
    setSelectedSprint: mockSetSelectedSprint,
    toggleEpicFilter: mockToggleEpicFilter,
    toggleStatusFilter: mockToggleStatusFilter,
    clearAllFilters: mockClearAllFilters,
    hasActiveFilters: mockHasActiveFilters
  }))
}))

// Mock tRPC
const mockEpics = [
  { id: 'epic-1', title: 'Auth', color: 'blue', description: null, created_at: new Date() },
  { id: 'epic-2', title: 'Dashboard', color: 'green', description: null, created_at: new Date() }
]

const mockSprints = [
  {
    id: 'sprint-1',
    name: 'Sprint 1',
    is_active: true,
    start_date: null,
    end_date: null,
    created_at: new Date()
  },
  {
    id: 'sprint-2',
    name: 'Sprint 2',
    is_active: false,
    start_date: null,
    end_date: null,
    created_at: new Date()
  }
]

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    epics: { getAll: { useQuery: vi.fn(() => ({ data: mockEpics })) } },
    sprints: { getAll: { useQuery: vi.fn(() => ({ data: mockSprints })) } }
  }
}))

describe('FilterPanel', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    trigger: <button>Filter</button>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasActiveFilters.mockReturnValue(false)
  })

  it('renders filter panel with sections', () => {
    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Sprint')).toBeInTheDocument()
    expect(screen.getByText('Epic')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('displays sprints from tRPC query', () => {
    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('Sprint 2')).toBeInTheDocument()
    expect(screen.getByText('(Active)')).toBeInTheDocument()
  })

  it('displays epics from tRPC query', () => {
    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Auth')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('displays all status options', () => {
    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('calls toggleEpicFilter when clicking epic checkbox', () => {
    render(<FilterPanel {...defaultProps} />)

    const epicLabel = screen.getByTestId('filter-epic-epic-1')
    fireEvent.click(epicLabel.querySelector('button')!)

    expect(mockToggleEpicFilter).toHaveBeenCalledWith('epic-1')
  })

  it('calls toggleStatusFilter when clicking status checkbox', () => {
    render(<FilterPanel {...defaultProps} />)

    const statusLabel = screen.getByTestId('filter-status-backlog')
    fireEvent.click(statusLabel.querySelector('button')!)

    expect(mockToggleStatusFilter).toHaveBeenCalledWith('backlog')
  })

  it('calls setSelectedSprint when clicking sprint radio', () => {
    render(<FilterPanel {...defaultProps} />)

    const sprintLabel = screen.getByTestId('filter-sprint-sprint-1')
    fireEvent.click(sprintLabel.querySelector('button')!)

    expect(mockSetSelectedSprint).toHaveBeenCalledWith('sprint-1')
  })

  it('clears sprint filter when clicking All Sprints radio', async () => {
    // First mock a sprint being selected
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1', // Sprint already selected
      selectedEpicIds: [],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      toggleEpicFilter: mockToggleEpicFilter,
      toggleStatusFilter: mockToggleStatusFilter,
      clearAllFilters: mockClearAllFilters,
      hasActiveFilters: mockHasActiveFilters
    })

    render(<FilterPanel {...defaultProps} />)

    const allSprintsLabel = screen.getByTestId('filter-sprint-all')
    fireEvent.click(allSprintsLabel.querySelector('button')!)

    expect(mockSetSelectedSprint).toHaveBeenCalledWith(null)
  })

  it('shows clear all button when filters are active', () => {
    mockHasActiveFilters.mockReturnValue(true)
    render(<FilterPanel {...defaultProps} />)

    const clearButton = screen.getByTestId('clear-all-filters')
    expect(clearButton).toBeInTheDocument()
  })

  it('hides clear all button when no filters are active', () => {
    mockHasActiveFilters.mockReturnValue(false)
    render(<FilterPanel {...defaultProps} />)

    expect(screen.queryByTestId('clear-all-filters')).not.toBeInTheDocument()
  })

  it('calls clearAllFilters when clicking clear all', () => {
    mockHasActiveFilters.mockReturnValue(true)
    render(<FilterPanel {...defaultProps} />)

    const clearButton = screen.getByTestId('clear-all-filters')
    fireEvent.click(clearButton)

    expect(mockClearAllFilters).toHaveBeenCalled()
  })

  it('shows selected count for epics', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      toggleEpicFilter: mockToggleEpicFilter,
      toggleStatusFilter: mockToggleStatusFilter,
      clearAllFilters: mockClearAllFilters,
      hasActiveFilters: mockHasActiveFilters
    })

    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Epic (2)')).toBeInTheDocument()
  })

  it('shows selected count for statuses', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress', 'review'],
      setSelectedSprint: mockSetSelectedSprint,
      toggleEpicFilter: mockToggleEpicFilter,
      toggleStatusFilter: mockToggleStatusFilter,
      clearAllFilters: mockClearAllFilters,
      hasActiveFilters: mockHasActiveFilters
    })

    render(<FilterPanel {...defaultProps} />)

    expect(screen.getByText('Status (3)')).toBeInTheDocument()
  })
})
