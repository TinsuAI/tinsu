import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterSummary } from './FilterSummary'

// Mock UIStore
const mockSetSelectedSprint = vi.fn()
const mockSetSelectedEpics = vi.fn()
const mockSetSelectedStatuses = vi.fn()
const mockHasActiveFilters = vi.fn()

vi.mock('@renderer/stores/ui.store', () => ({
  useUIStore: vi.fn(() => ({
    selectedSprintId: null,
    selectedEpicIds: [],
    selectedStatuses: [],
    setSelectedSprint: mockSetSelectedSprint,
    setSelectedEpics: mockSetSelectedEpics,
    setSelectedStatuses: mockSetSelectedStatuses,
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

describe('FilterSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasActiveFilters.mockReturnValue(false)
  })

  it('renders nothing when no filters are active', () => {
    mockHasActiveFilters.mockReturnValue(false)
    render(<FilterSummary />)

    expect(screen.queryByTestId('filter-summary')).not.toBeInTheDocument()
  })

  it('renders filter summary when filters are active', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    expect(screen.getByTestId('filter-summary')).toBeInTheDocument()
    expect(screen.getByText('Filtered by:')).toBeInTheDocument()
  })

  it('displays sprint filter chip', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    expect(screen.getByTestId('filter-chip-sprint')).toBeInTheDocument()
    expect(screen.getByText('Sprint: Sprint 1')).toBeInTheDocument()
  })

  it('displays epic filter chips', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    expect(screen.getByText('Epic: Auth')).toBeInTheDocument()
    expect(screen.getByText('Epic: Dashboard')).toBeInTheDocument()
  })

  it('displays status filter chips', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress'],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    expect(screen.getByText('Status: Backlog')).toBeInTheDocument()
    expect(screen.getByText('Status: In Progress')).toBeInTheDocument()
  })

  it('removes sprint filter when chip X is clicked', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    const chip = screen.getByTestId('filter-chip-sprint')
    const removeButton = chip.querySelector('button')!
    fireEvent.click(removeButton)

    expect(mockSetSelectedSprint).toHaveBeenCalledWith(null)
  })

  it('removes epic filter when chip X is clicked', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    // Epic chips now use epic ID in test ID
    const chip = screen.getByTestId('filter-chip-epic-epic-1')
    const removeButton = chip.querySelector('button')!
    fireEvent.click(removeButton)

    // Should call setSelectedEpics with epic-1 removed
    expect(mockSetSelectedEpics).toHaveBeenCalledWith(['epic-2'])
  })

  it('removes status filter when chip X is clicked', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress'],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    // Status chips now use status key in test ID
    const chip = screen.getByTestId('filter-chip-status-backlog')
    const removeButton = chip.querySelector('button')!
    fireEvent.click(removeButton)

    // Should call setSelectedStatuses with backlog removed
    expect(mockSetSelectedStatuses).toHaveBeenCalledWith(['in_progress'])
  })

  it('displays all filter types together', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: ['epic-1'],
      selectedStatuses: ['backlog'],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary />)

    expect(screen.getByText('Sprint: Sprint 1')).toBeInTheDocument()
    expect(screen.getByText('Epic: Auth')).toBeInTheDocument()
    expect(screen.getByText('Status: Backlog')).toBeInTheDocument()
  })

  it('applies custom className', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: [],
      setSelectedSprint: mockSetSelectedSprint,
      setSelectedEpics: mockSetSelectedEpics,
      setSelectedStatuses: mockSetSelectedStatuses,
      hasActiveFilters: () => true
    })

    render(<FilterSummary className="custom-class" />)

    expect(screen.getByTestId('filter-summary')).toHaveClass('custom-class')
  })
})
