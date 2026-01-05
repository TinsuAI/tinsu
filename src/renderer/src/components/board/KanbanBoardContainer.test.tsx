import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanbanBoardContainer } from './KanbanBoardContainer'

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

// Mock task data
const mockTasks = [
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
      }
    }
  }
}))

describe('KanbanBoardContainer', () => {
  beforeEach(() => {
    mockData = undefined
    mockIsLoading = false
    mockIsError = false
    mockError = null
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
