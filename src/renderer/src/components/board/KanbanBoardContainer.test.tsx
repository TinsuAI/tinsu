import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanbanBoardContainer } from './KanbanBoardContainer'
import { useUIStore } from '@renderer/stores/ui.store'

// Create a QueryClient wrapper for tests
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

// Mock task data type for proper TypeScript inference
interface MockTask {
  id: string
  title: string
  description: string | null
  status: string
  sort_order: number
  epic_id: string | null
  sprint_id: string | null
  created_at: Date
  updated_at: Date
}

const mockTasks: MockTask[] = [
  {
    id: '1',
    title: 'Task 1',
    description: 'Description 1',
    status: 'backlog',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01')
  },
  {
    id: '2',
    title: 'Task 2',
    description: null,
    status: 'in_progress',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-02')
  }
]

// Mock tRPC
let mockData: typeof mockTasks | undefined = undefined
let mockIsLoading = false
let mockIsError = false
let mockError: { message: string } | null = null
const mockCreateMutate = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getAll: {
        useQuery: () => ({
          data: mockData,
          isLoading: mockIsLoading,
          isError: mockIsError,
          error: mockError
        })
      },
      updateStatus: {
        useMutation: () => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn()
        })
      },
      reorder: {
        useMutation: () => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn()
        })
      },
      create: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => ({
          mutate: (data: { title: string; description?: string; status: string }) => {
            mockCreateMutate(data)
            if (options?.onSuccess) {
              setTimeout(() => options.onSuccess?.(), 0)
            }
          },
          isPending: false
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
    sprints: {
      getAll: {
        useQuery: () => ({
          data: [],
          isLoading: false
        })
      }
    },
    useUtils: () => ({
      tasks: {
        getAll: {
          invalidate: mockInvalidate
        }
      }
    })
  }
}))

describe('KanbanBoardContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData = undefined
    mockIsLoading = false
    mockIsError = false
    mockError = null
    // Reset store state before each test (Story 2.6: added epic and status filters)
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null
    })
  })

  it('should render loading state when isLoading is true', () => {
    mockIsLoading = true

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('should render error state when isError is true', () => {
    mockIsError = true
    mockError = { message: 'Database connection failed' }

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument()
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()
  })

  it('should render error state with default message when error has no message', () => {
    mockIsError = true
    mockError = null

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Failed to load tasks')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })

  it('should render KanbanBoard with tasks when data is loaded', () => {
    mockData = mockTasks

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // Should render the board with 4 columns
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    expect(screen.getByTestId('column-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-review')).toBeInTheDocument()
    expect(screen.getByTestId('column-done')).toBeInTheDocument()
  })

  it('should display correct task counts when data is loaded', () => {
    mockData = mockTasks

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // backlog: 1 task, in_progress: 1 task, review: 0, done: 0
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })

  it('should render empty board when there are no tasks', () => {
    mockData = []

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    // All columns should show 0 count
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('0')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('0')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })
})

describe('KanbanBoardContainer dialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData = mockTasks
    mockIsLoading = false
    mockIsError = false
    mockError = null
    // Reset store state before each test (Story 2.6: added epic and status filters)
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null
    })
  })

  it('should render add task buttons in all columns', () => {
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('add-task-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('add-task-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('add-task-review')).toBeInTheDocument()
    expect(screen.getByTestId('add-task-done')).toBeInTheDocument()
  })

  it('should open dialog when + button is clicked', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('add-task-backlog'))

    expect(screen.getByText('Create New Task')).toBeInTheDocument()
  })

  it('should open dialog when N key is pressed', async () => {
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    fireEvent.keyDown(window, { key: 'n' })

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeInTheDocument()
    })
  })

  it('should not open dialog when N is pressed with modifier keys', async () => {
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })

    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
  })

  it('should not open dialog when typing N in input field', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // Open the dialog first
    await user.click(screen.getByTestId('add-task-backlog'))
    expect(screen.getByText('Create New Task')).toBeInTheDocument()

    // Now close it
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
    })
  })

  it('should close dialog on Escape key', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('add-task-backlog'))
    expect(screen.getByText('Create New Task')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
    })
  })

  it('should close dialog when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('add-task-backlog'))
    expect(screen.getByText('Create New Task')).toBeInTheDocument()

    await user.click(screen.getByTestId('cancel-button'))

    await waitFor(() => {
      expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
    })
  })

  it('should create task when form is submitted', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('add-task-in_progress'))
    await user.type(screen.getByTestId('task-title-input'), 'New Task')
    await user.click(screen.getByTestId('create-button'))

    expect(mockCreateMutate).toHaveBeenCalledWith({
      title: 'New Task',
      description: undefined,
      status: 'in_progress'
    })
  })

  it('should use correct status based on which column button was clicked', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('add-task-review'))
    await user.type(screen.getByTestId('task-title-input'), 'Review Task')
    await user.click(screen.getByTestId('create-button'))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'review'
      })
    )
  })

  it('should use backlog status when dialog opened via N key', async () => {
    const user = userEvent.setup()
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    fireEvent.keyDown(window, { key: 'n' })

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeInTheDocument()
    })

    await user.type(screen.getByTestId('task-title-input'), 'Backlog Task')
    await user.click(screen.getByTestId('create-button'))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'backlog'
      })
    )
  })
})

// Story 2.6: Filtering tests
describe('KanbanBoardContainer filtering (Story 2.6)', () => {
  const mockTasksWithFilters: typeof mockTasks = [
    {
      id: '1',
      title: 'Task 1',
      description: 'Description 1',
      status: 'backlog',
      sort_order: 0,
      epic_id: 'epic-1',
      sprint_id: 'sprint-1',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01')
    },
    {
      id: '2',
      title: 'Task 2',
      description: null,
      status: 'in_progress',
      sort_order: 0,
      epic_id: 'epic-2',
      sprint_id: 'sprint-1',
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02')
    },
    {
      id: '3',
      title: 'Task 3',
      description: null,
      status: 'review',
      sort_order: 0,
      epic_id: 'epic-1',
      sprint_id: 'sprint-2',
      created_at: new Date('2024-01-03'),
      updated_at: new Date('2024-01-03')
    },
    {
      id: '4',
      title: 'Task 4',
      description: null,
      status: 'done',
      sort_order: 0,
      epic_id: null,
      sprint_id: null,
      created_at: new Date('2024-01-04'),
      updated_at: new Date('2024-01-04')
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockData = mockTasksWithFilters
    mockIsLoading = false
    mockIsError = false
    mockError = null
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: []
    })
  })

  it('should show all tasks when no filters are active', () => {
    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('1')
    expect(screen.getByTestId('count-done')).toHaveTextContent('1')
  })

  it('should filter by sprint', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: 'sprint-1',
      selectedEpicIds: [],
      selectedStatuses: []
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // sprint-1 has tasks 1 (backlog) and 2 (in_progress)
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })

  it('should filter by single epic', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: ['epic-1'],
      selectedStatuses: []
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // epic-1 has tasks 1 (backlog) and 3 (review)
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('0')
    expect(screen.getByTestId('count-review')).toHaveTextContent('1')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })

  it('should filter by multiple epics (OR logic)', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: []
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // epic-1 has tasks 1, 3; epic-2 has task 2
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('1')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0') // Task 4 has no epic
  })

  it('should filter by single status', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog']
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('0')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })

  it('should filter by multiple statuses (OR logic)', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'done']
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('0')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('1')
  })

  it('should not filter when all 4 statuses are selected', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: ['backlog', 'in_progress', 'review', 'done']
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // All 4 statuses selected = no filter applied
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('1')
    expect(screen.getByTestId('count-done')).toHaveTextContent('1')
  })

  it('should combine sprint and epic filters with AND logic', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: 'sprint-1',
      selectedEpicIds: ['epic-1'],
      selectedStatuses: []
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // sprint-1 AND epic-1 = only task 1 (backlog)
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('0')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })

  it('should combine all filter types with AND logic', () => {
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: 'sprint-1',
      selectedEpicIds: ['epic-1', 'epic-2'],
      selectedStatuses: ['backlog', 'in_progress']
    })

    render(<KanbanBoardContainer />, { wrapper: createWrapper() })

    // sprint-1 AND (epic-1 OR epic-2) AND (backlog OR in_progress)
    // = task 1 (backlog, epic-1, sprint-1) + task 2 (in_progress, epic-2, sprint-1)
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('1')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('0')
    expect(screen.getByTestId('count-done')).toHaveTextContent('0')
  })
})
