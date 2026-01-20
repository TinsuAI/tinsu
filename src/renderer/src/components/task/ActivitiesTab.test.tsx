import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ActivitiesTab } from './ActivitiesTab'
import { trpc } from '@renderer/lib/trpc'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    activity: {
      listActivities: {
        useQuery: vi.fn()
      }
    }
  }
}))

/**
 * Helper to render component with QueryClient provider
 */
function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

/**
 * Unit tests for ActivitiesTab component.
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #3)
 */
describe('ActivitiesTab', () => {
  const mockRefetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State (AC: #2.5)', () => {
    it('displays skeleton loader while loading', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: mockRefetch
      } as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Should show Activities header
      expect(screen.getByText('Activities')).toBeInTheDocument()

      // Should show skeleton items (via animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State (AC: #3)', () => {
    it('displays "No activity yet" when no activities', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })

    it('displays "No activity yet" when activities is undefined', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })

  describe('Error State (AC: #2.6)', () => {
    it('displays error message and retry button on error', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(screen.getByText('Failed to load activities')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls refetch when retry button is clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Activity Display (AC: #1)', () => {
    it('displays activities in reverse chronological order', () => {
      const mockActivities = [
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'agent_complete',
          payload: JSON.stringify({ duration_ms: 120000 }),
          created_at: 1705678340000 // Later timestamp
        },
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'agent_start',
          payload: JSON.stringify({ phase: 'dev-story' }),
          created_at: 1705678338000 // Earlier timestamp
        }
      ]

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: mockActivities,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Both should be displayed
      expect(screen.getByText('Agent Completed')).toBeInTheDocument()
      expect(screen.getByText('Agent Started')).toBeInTheDocument()

      // Check order - agent_complete should come before agent_start
      const items = screen.getAllByText(/Agent (Completed|Started)/)
      expect(items[0]).toHaveTextContent('Agent Completed')
      expect(items[1]).toHaveTextContent('Agent Started')
    })

    it('displays event count in header', () => {
      const mockActivities = [
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'status_change',
          payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
          created_at: Date.now()
        },
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'agent_start',
          payload: null,
          created_at: Date.now()
        },
        {
          id: 'act-3',
          task_id: 'task-123',
          event_type: 'agent_complete',
          payload: null,
          created_at: Date.now()
        }
      ]

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: mockActivities,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(screen.getByText('3 events')).toBeInTheDocument()
    })

    it('displays all event types correctly', () => {
      const mockActivities = [
        {
          id: 'act-1',
          task_id: 'task-123',
          event_type: 'status_change',
          payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
          created_at: Date.now()
        },
        {
          id: 'act-2',
          task_id: 'task-123',
          event_type: 'error',
          payload: JSON.stringify({ message: 'Something went wrong' }),
          created_at: Date.now() - 1000
        },
        {
          id: 'act-3',
          task_id: 'task-123',
          event_type: 'user_command',
          payload: JSON.stringify({ command: 'npm run build' }),
          created_at: Date.now() - 2000
        }
      ]

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: mockActivities,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      expect(screen.getByText('Status Changed')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('User Command')).toBeInTheDocument()
    })
  })

  describe('Query Parameters', () => {
    it('passes correct taskId to query', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-abc-123" />)

      expect(trpc.activity.listActivities.useQuery).toHaveBeenCalledWith(
        { taskId: 'task-abc-123', limit: 100 },
        expect.any(Object)
      )
    })
  })
})
