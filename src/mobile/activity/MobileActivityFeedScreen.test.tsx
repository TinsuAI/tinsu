import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MobileActivityFeedScreen } from './MobileActivityFeedScreen'
import type { Activity } from '@shared/types/activity.types'

/* ── Mocks ─────────────────────────────────────────────────────── */

// Mock project store
vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'project-1' }),
}))

// Mock mobile nav store
const mockPendingActivityForTask: string | null = null
const mockSetPendingActivityForTask = vi.fn()
const mockPushRoute = vi.fn()
const mockSwitchTab = vi.fn()
vi.mock('../shell/mobile-nav.store', () => ({
  useMobileNavStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      pendingActivityForTask: mockPendingActivityForTask,
      setPendingActivityForTask: mockSetPendingActivityForTask,
      pushRoute: mockPushRoute,
      switchTab: mockSwitchTab,
    }
    return selector ? selector(state) : state
  },
}))

// Mock commands
const mockListTasks = vi.fn()
const mockListActivitiesForTask = vi.fn()
vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listTasks: (...args: unknown[]) => mockListTasks(...args),
    listActivitiesForTask: (...args: unknown[]) => mockListActivitiesForTask(...args),
  },
}))

// Mock global activity subscription
const mockUseGlobalActivitySubscription = vi.fn()
vi.mock('@renderer/hooks/useGlobalActivitySubscription', () => ({
  useGlobalActivitySubscription: (opts: { onActivity: (a: Activity) => void; enabled?: boolean }) =>
    mockUseGlobalActivitySubscription(opts),
}))

// Mock reduced motion
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

/* ── Helpers ────────────────────────────────────────────────────── */

const makeTask = (id: string) => ({ id, title: `Task ${id}`, status: 'in-progress' })

const makeActivity = (id: string, task_id = 'task-1', created_at = Date.now()): Activity => ({
  id,
  task_id,
  event_type: 'agent_start',
  payload: JSON.stringify({ tool: 'bash' }),
  created_at,
})

function setupSuccessfulFetch(activities: Activity[] = []) {
  mockListTasks.mockResolvedValue({
    status: 'ok',
    data: [makeTask('task-1'), makeTask('task-2')],
  })
  mockListActivitiesForTask.mockResolvedValue({
    status: 'ok',
    data: activities,
  })
  mockUseGlobalActivitySubscription.mockImplementation(() => {})
}

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
  mockUseGlobalActivitySubscription.mockImplementation(() => {})
  // clearAllMocks resets mockPushRoute and mockSwitchTab too
})

describe('MobileActivityFeedScreen', () => {
  it('renders loading skeleton on first fetch', () => {
    mockListTasks.mockReturnValue(new Promise(() => {})) // never resolves
    mockListActivitiesForTask.mockReturnValue(new Promise(() => {}))
    render(<MobileActivityFeedScreen />)
    expect(screen.getAllByTestId('mobile-loading-skeleton-list-row').length).toBeGreaterThan(0)
  })

  it('renders empty state after fetch with no activities', async () => {
    setupSuccessfulFetch([])
    render(<MobileActivityFeedScreen />)
    await waitFor(() => {
      expect(screen.getByTestId('mobile-empty-state')).toBeTruthy()
    })
    expect(screen.getByText('No activity yet')).toBeTruthy()
  })

  it('renders activity rows after fetch', async () => {
    setupSuccessfulFetch([
      makeActivity('act-1', 'task-1', Date.now() - 60_000),
      makeActivity('act-2', 'task-2', Date.now() - 120_000),
    ])
    render(<MobileActivityFeedScreen />)
    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(2)
    })
  })

  it('applies chip filter to hide non-matching rows', async () => {
    setupSuccessfulFetch([
      { ...makeActivity('act-1'), event_type: 'agent_start' },
      { ...makeActivity('act-2'), event_type: 'error' },
    ])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(2)
    })

    // Click the "Errors" chip
    const chips = screen.getAllByTestId('mobile-chip')
    const errorsChip = chips.find((c) => c.textContent?.includes('Errors'))
    expect(errorsChip).toBeTruthy()
    fireEvent.click(errorsChip!)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })
  })

  it('shows filtered empty state when filter yields no results', async () => {
    setupSuccessfulFetch([
      { ...makeActivity('act-1'), event_type: 'agent_start' },
    ])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })

    // Click "Errors" — no error events
    const chips = screen.getAllByTestId('mobile-chip')
    const errorsChip = chips.find((c) => c.textContent?.includes('Errors'))
    fireEvent.click(errorsChip!)

    await waitFor(() => {
      expect(screen.getByText('No events match this filter — try All.')).toBeTruthy()
    })
  })

  it('tapping a row opens the detail sheet', async () => {
    setupSuccessfulFetch([makeActivity('act-1')])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })

    fireEvent.click(screen.getByTestId('mobile-activity-row'))

    await waitFor(() => {
      // The sheet content should be visible
      expect(screen.getByTestId('mobile-sheet-content')).toBeTruthy()
    })
  })

  it('"Open task" in detail sheet navigates with correct route', async () => {
    setupSuccessfulFetch([{ ...makeActivity('act-1'), event_type: 'tool_used' }])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })

    fireEvent.click(screen.getByTestId('mobile-activity-row'))

    await waitFor(() => {
      expect(screen.getByText('Open task')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Open task'))

    expect(mockPushRoute).toHaveBeenCalledWith('tasks', 'workspace:task-1')
    expect(mockSwitchTab).toHaveBeenCalledWith('tasks')
  })

  it('deduplicates activities by id when subscription emits duplicate', async () => {
    let subscriptionCallback: ((a: Activity) => void) | null = null
    mockUseGlobalActivitySubscription.mockImplementation((opts: { onActivity: (a: Activity) => void }) => {
      subscriptionCallback = opts.onActivity
    })

    setupSuccessfulFetch([makeActivity('act-1')])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })

    // Emit the same activity again
    await act(async () => {
      subscriptionCallback?.(makeActivity('act-1'))
    })

    // Should still be 1 (deduplicated)
    expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
  })

  it('prepends new activity from subscription', async () => {
    // Capture via the mock's call history after render
    setupSuccessfulFetch([makeActivity('act-1')])
    render(<MobileActivityFeedScreen />)

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-activity-row').length).toBe(1)
    })

    // Retrieve the onActivity callback from the last mock call
    const calls = mockUseGlobalActivitySubscription.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const lastCall = calls[calls.length - 1][0] as { onActivity: (a: Activity) => void }
    const onActivity = lastCall.onActivity

    // Emit a new activity
    await act(async () => {
      onActivity(makeActivity('act-2', 'task-2', Date.now()))
    })

    // Should have 2 rows now
    expect(screen.getAllByTestId('mobile-activity-row').length).toBe(2)
  })
})
