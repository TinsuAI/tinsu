import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ActivitiesTab } from './ActivitiesTab'

// Mock tauri-specta commands (replaces tRPC)
const mockListActivitiesForTask = vi.fn()
vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listActivitiesForTask: (...args: unknown[]) => mockListActivitiesForTask(...args),
  },
}))

// Mock @tauri-apps/api/event for real-time subscription
const mockUnlisten = vi.fn()
let capturedListener: ((event: { payload: { task_id: string; activity: object } }) => void) | null =
  null

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_eventName: string, handler: (event: unknown) => void) => {
    capturedListener = handler as typeof capturedListener
    return Promise.resolve(mockUnlisten)
  }),
}))

/**
 * Helper to render component with QueryClient provider
 */
function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/**
 * Helper: make listActivitiesForTask resolve with given activities
 */
function mockActivitiesSuccess(activities: object[]) {
  mockListActivitiesForTask.mockResolvedValue({
    status: 'ok',
    data: activities,
  })
}

/**
 * Helper: make listActivitiesForTask resolve with an error
 */
function mockActivitiesError() {
  mockListActivitiesForTask.mockResolvedValue({
    status: 'error',
    error: { message: 'Network error' },
  })
}

/**
 * Unit tests for ActivitiesTab component (T1.7 migration).
 *
 * @see T1.7: Migrate Hook Listener HTTP Server to Rust (AC: #12)
 */
describe('ActivitiesTab', () => {
  const mockRefetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedListener = null
    mockListActivitiesForTask.mockResolvedValue({ status: 'ok', data: [] })
  })

  describe('Loading State', () => {
    it('displays skeleton loader while loading', async () => {
      // Never resolves to keep loading state
      mockListActivitiesForTask.mockReturnValue(new Promise(() => {}))

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Should show Activities header
      expect(screen.getByText('Activities')).toBeInTheDocument()

      // Should show skeleton items (via animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State', () => {
    it('displays "No activity yet" when no activities', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await act(async () => {
        await Promise.resolve()
      })

      expect(await screen.findByText('No activity yet')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message and retry button on error', async () => {
      mockActivitiesError()

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(await screen.findByText('Failed to load activities')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls refetch when retry button is clicked', async () => {
      const user = userEvent.setup()
      mockActivitiesError()

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      const retryButton = await screen.findByRole('button', { name: /retry/i })

      // Re-mock to success after retry
      mockActivitiesSuccess([])
      await user.click(retryButton)

      // Retry triggers a refetch
      expect(mockListActivitiesForTask).toHaveBeenCalledTimes(2)
    })
  })

  describe('Activity Display', () => {
    it('displays activities in reverse chronological order', async () => {
      const mockActivities = [
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'agent_complete',
          payload: JSON.stringify({ duration_ms: 120000 }),
          created_at: 1705678340000, // Later timestamp
        },
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'agent_start',
          payload: JSON.stringify({ phase: 'dev-story' }),
          created_at: 1705678338000, // Earlier timestamp
        },
      ]

      mockActivitiesSuccess(mockActivities)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(await screen.findByText('Agent Completed')).toBeInTheDocument()
      expect(screen.getByText('Agent Started')).toBeInTheDocument()

      // Check order - agent_complete should come before agent_start
      const items = screen.getAllByText(/Agent (Completed|Started)/)
      expect(items[0]).toHaveTextContent('Agent Completed')
      expect(items[1]).toHaveTextContent('Agent Started')
    })

    it('displays event count in header', async () => {
      mockActivitiesSuccess([
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'status_change',
          payload: null,
          created_at: Date.now(),
        },
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'agent_start',
          payload: null,
          created_at: Date.now(),
        },
        {
          id: 'act-3',
          task_id: 'task-123',
          event_type: 'agent_complete',
          payload: null,
          created_at: Date.now(),
        },
      ])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(await screen.findByText('3 events')).toBeInTheDocument()
    })

    it('displays all event types correctly', async () => {
      mockActivitiesSuccess([
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'status_change',
          payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
          created_at: Date.now(),
        },
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'error',
          payload: JSON.stringify({ message: 'Something went wrong' }),
          created_at: Date.now() - 1000,
        },
        {
          id: 'act-3',
          task_id: 'task-123',
          event_type: 'user_command',
          payload: JSON.stringify({ command: 'npm run build' }),
          created_at: Date.now() - 2000,
        },
      ])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(await screen.findByText('Status Changed')).toBeInTheDocument()
      const errorTexts = screen.getAllByText('Error')
      expect(errorTexts.some((el) => el.classList.contains('font-medium'))).toBe(true)
      expect(screen.getByText('User Command')).toBeInTheDocument()
    })
  })

  describe('Query Parameters', () => {
    it('passes correct taskId and no eventTypes when "all" filter active', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-abc-123" />)

      await act(async () => {
        await Promise.resolve()
      })

      // Default filter is "all" — eventTypes should be null
      expect(mockListActivitiesForTask).toHaveBeenCalledWith(
        'task-abc-123',
        100,
        null,
        null
      )
    })
  })

  describe('Filter Integration', () => {
    it('renders filter chips above activity list', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await act(async () => {
        await Promise.resolve()
      })

      // All filter chips should be present
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /error/i })).toBeInTheDocument()
    })

    it('passes status_change eventType when Status filter clicked', async () => {
      const user = userEvent.setup()
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Wait for initial render
      await screen.findByText('No activity yet')

      // Click Status filter
      await user.click(screen.getByText('Status'))

      // Should call with status_change event types
      expect(mockListActivitiesForTask).toHaveBeenLastCalledWith(
        'task-123',
        100,
        null,
        ['status_change']
      )
    })

    it('shows "No matching events" when filter returns empty result', async () => {
      const user = userEvent.setup()
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await screen.findByText('No activity yet')

      // Click Status filter (will have empty results based on mock)
      await user.click(screen.getByText('Status'))

      // Should show "No matching events" instead of "No activity yet"
      expect(await screen.findByText('No matching events')).toBeInTheDocument()
    })

    it('shows "No activity yet" when All filter and empty result', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Default is "all" filter
      expect(await screen.findByText('No activity yet')).toBeInTheDocument()
    })
  })

  describe('Real-Time Streaming', () => {
    it('calls listen("activity:created") on mount', async () => {
      const { listen } = await import('@tauri-apps/api/event')
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await act(async () => {
        await Promise.resolve()
      })

      expect(listen).toHaveBeenCalledWith('activity:created', expect.any(Function))
    })

    it('displays new activity from subscription immediately', async () => {
      mockActivitiesSuccess([
        {
          id: 'existing-1',
          task_id: 'task-123',
          event_type: 'agent_start',
          payload: null,
          created_at: Date.now() - 5000,
        },
      ])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await screen.findByText('Agent Started')
      expect(screen.getByText('1 events')).toBeInTheDocument()

      // Simulate Tauri event arriving
      await act(async () => {
        await Promise.resolve()
        capturedListener?.({
          payload: {
            task_id: 'task-123',
            activity: {
              id: 'new-1',
              task_id: 'task-123',
              event_type: 'agent_complete',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      expect(screen.getByText('2 events')).toBeInTheDocument()
      expect(screen.getByText('Agent Completed')).toBeInTheDocument()
    })

    it('does not add duplicate activities', async () => {
      mockActivitiesSuccess([
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'status_change',
          payload: null,
          created_at: Date.now(),
        },
      ])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await screen.findByText('1 events')

      await act(async () => {
        await Promise.resolve()
        // Send same activity again
        capturedListener?.({
          payload: {
            task_id: 'task-123',
            activity: {
              id: 'act-1',
              task_id: 'task-123',
              event_type: 'status_change',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      // Still 1 event
      expect(screen.getByText('1 events')).toBeInTheDocument()
    })

    it('ignores activities for different taskId', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await screen.findByText('No activity yet')

      await act(async () => {
        await Promise.resolve()
        capturedListener?.({
          payload: {
            task_id: 'task-456',
            activity: {
              id: 'other-1',
              task_id: 'task-456',
              event_type: 'agent_start',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      // Still no activity shown
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })

    it('applies animation class to new activities', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Wait for effects and async listen setup
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      await act(async () => {
        capturedListener?.({
          payload: {
            task_id: 'task-123',
            activity: {
              id: 'new-1',
              task_id: 'task-123',
              event_type: 'status_change',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
        await Promise.resolve()
      })

      const animatedElement = document.querySelector('.animate-activity-slide-in')
      expect(animatedElement).toBeInTheDocument()
    })

    it('does not use polling (no refetchInterval)', async () => {
      mockActivitiesSuccess([])

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      await act(async () => {
        await Promise.resolve()
      })

      // Commands are called once on mount, not repeatedly
      expect(mockListActivitiesForTask).toHaveBeenCalledTimes(1)
    })
  })
})
