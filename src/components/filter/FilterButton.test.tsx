import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterButton } from './FilterButton'

// Mock UIStore
vi.mock('@renderer/stores/ui.store', () => ({
  useUIStore: vi.fn(() => ({
    selectedSprintId: null,
    selectedEpicIds: [],
    selectedStatuses: []
  }))
}))

describe('FilterButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders filter button with icon', () => {
    render(<FilterButton />)

    const button = screen.getByTestId('filter-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Filter tasks')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<FilterButton onClick={handleClick} />)

    fireEvent.click(screen.getByTestId('filter-button'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('shows no badge when no filters active', () => {
    render(<FilterButton />)

    expect(screen.queryByTestId('filter-badge')).not.toBeInTheDocument()
  })

  it('shows badge with sprint count', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: []
    })

    render(<FilterButton />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('1')
  })

  it('shows badge with epic count', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: []
    })

    render(<FilterButton />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('2')
  })

  it('shows badge with status count (less than 4)', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress']
    })

    render(<FilterButton />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('2')
  })

  it('does not count status filter when all 4 statuses selected', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress', 'review', 'done']
    })

    render(<FilterButton />)

    // No badge should show since selecting all 4 statuses is equivalent to no filter
    expect(screen.queryByTestId('filter-badge')).not.toBeInTheDocument()
  })

  it('shows combined count for multiple filter types', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: ['backlog']
    })

    render(<FilterButton />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toBeInTheDocument()
    // 1 (sprint) + 2 (epics) + 1 (status) = 4
    expect(badge).toHaveTextContent('4')
  })

  it('updates aria-label when filters active', async () => {
    const { useUIStore } = await import('@renderer/stores/ui.store')
    vi.mocked(useUIStore).mockReturnValue({
      selectedSprintId: 'sprint-1',
      selectedEpicIds: ['epic-1'],
      selectedStatuses: []
    })

    render(<FilterButton />)

    const button = screen.getByTestId('filter-button')
    expect(button).toHaveAttribute('aria-label', 'Filter tasks, 2 active')
  })

  it('applies custom className', () => {
    render(<FilterButton className="custom-class" />)

    const button = screen.getByTestId('filter-button')
    expect(button).toHaveClass('custom-class')
  })
})
