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
      // Use getAllByText for 'Error' since there's also an Error filter chip
      // The activity item has text-sm font-medium class for the title
      const errorTexts = screen.getAllByText('Error')
      expect(errorTexts.some(el => el.classList.contains('font-medium'))).toBe(true)
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

      // eventTypes is undefined when 'all' filter is selected (default)
      expect(trpc.activity.listActivities.useQuery).toHaveBeenCalledWith(
        { taskId: 'task-abc-123', limit: 100, eventTypes: undefined },
        expect.any(Object)
      )
    })
  })

  /**
   * Integration tests for activity log filtering.
   *
   * @see TES-2.12: Activity Log Filtering
   */
  describe('Filter Integration (TES-2.12)', () => {
    it('renders filter chips above activity list', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // All filter chips should be present
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Agent')).toBeInTheDocument()
      expect(screen.getByText('User')).toBeInTheDocument()
      // Use getByRole to avoid conflict with "Error" activity title
      expect(screen.getByRole('button', { name: /error/i })).toBeInTheDocument()
    })

    it('passes status_change eventType when Status filter clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Click Status filter
      await user.click(screen.getByText('Status'))

      // Verify query was called with status_change eventType
      expect(trpc.activity.listActivities.useQuery).toHaveBeenLastCalledWith(
        { taskId: 'task-123', limit: 100, eventTypes: ['status_change'] },
        expect.any(Object)
      )
    })

    it('passes agent-related eventTypes when Agent filter clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Click Agent filter
      await user.click(screen.getByText('Agent'))

      // Verify query was called with agent-related eventTypes
      const lastCall = vi.mocked(trpc.activity.listActivities.useQuery).mock.calls.at(-1)
      const eventTypes = lastCall?.[0]?.eventTypes as string[]

      expect(eventTypes).toContain('agent_start')
      expect(eventTypes).toContain('agent_complete')
      expect(eventTypes).toContain('tool_used')
      expect(eventTypes).toContain('automation_trigger')
      expect(eventTypes).toContain('stall_recovered')
    })

    it('passes combined eventTypes when multiple filters selected (OR logic)', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Click Status filter first
      await user.click(screen.getByText('Status'))
      // Then click User filter
      await user.click(screen.getByText('User'))

      // Verify query includes eventTypes from both categories (OR logic)
      const lastCall = vi.mocked(trpc.activity.listActivities.useQuery).mock.calls.at(-1)
      const eventTypes = lastCall?.[0]?.eventTypes as string[]

      expect(eventTypes).toContain('status_change')
      expect(eventTypes).toContain('user_command')
    })

    it('resets to undefined eventTypes when All filter clicked', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Click Status filter first
      await user.click(screen.getByText('Status'))
      // Then click All to reset
      await user.click(screen.getByText('All'))

      // Verify query was called with undefined eventTypes (no filter)
      expect(trpc.activity.listActivities.useQuery).toHaveBeenLastCalledWith(
        { taskId: 'task-123', limit: 100, eventTypes: undefined },
        expect.any(Object)
      )
    })

    it('shows "No matching events" when filter returns empty result', async () => {
      const user = userEvent.setup()

      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Click Status filter (will have empty results based on mock)
      await user.click(screen.getByText('Status'))

      // Should show "No matching events" instead of "No activity yet"
      expect(screen.getByText('No matching events')).toBeInTheDocument()
    })

    it('shows "No activity yet" when All filter and empty result', () => {
      vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      } as unknown as ReturnType<typeof trpc.activity.listActivities.useQuery>)

      renderWithProviders(<ActivitiesTab taskId="task-123" />)

      // Should show "No activity yet" when All filter is selected (default)
      expect(screen.getByText('No activity yet')).toBeInTheDocument()
    })
  })
})
