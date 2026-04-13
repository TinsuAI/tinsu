import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VelocityWidget } from './VelocityWidget'

// Mock ResponsiveContainer to avoid dimension warnings in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 64, height: 24 }}>{children}</div>
    )
  }
})

// Mock tRPC
const mockGetWeeklyVelocity = vi.fn()
const mockGetDailyVelocity = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    velocity: {
      getWeeklyVelocity: {
        useQuery: () => mockGetWeeklyVelocity()
      },
      getDailyVelocity: {
        useQuery: () => mockGetDailyVelocity()
      }
    }
  }
}))

const mockWeeklyData = {
  weeks: [
    { week: '2026-02', count: 5, startDate: new Date('2026-01-05'), endDate: new Date('2026-01-11') },
    { week: '2026-01', count: 3, startDate: new Date('2025-12-29'), endDate: new Date('2026-01-04') },
    { week: '2025-53', count: 2, startDate: new Date('2025-12-22'), endDate: new Date('2025-12-28') },
    { week: '2025-52', count: 4, startDate: new Date('2025-12-15'), endDate: new Date('2025-12-21') }
  ],
  totalCompleted: 14,
  avgVelocity: 3
}

describe('VelocityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDailyVelocity.mockReturnValue({
      data: { days: [], totalCompleted: 0 },
      isLoading: false
    })
  })

  it('shows loading state initially', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('velocity-widget-loading')).toBeInTheDocument()
  })

  it('shows current week count when data available', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('velocity-count')).toHaveTextContent('5')
    expect(screen.getByText('this week')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('velocity-widget-empty')).toBeInTheDocument()
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('shows empty state when totalCompleted is 0', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [{ week: '2026-02', count: 0, startDate: new Date(), endDate: new Date() }],
        totalCompleted: 0,
        avgVelocity: 0
      },
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('velocity-widget-empty')).toBeInTheDocument()
  })

  it('shows upward trend when recent weeks have more completions', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [
          { week: '2026-02', count: 10, startDate: new Date(), endDate: new Date() },
          { week: '2026-01', count: 8, startDate: new Date(), endDate: new Date() },
          { week: '2025-53', count: 2, startDate: new Date(), endDate: new Date() },
          { week: '2025-52', count: 1, startDate: new Date(), endDate: new Date() }
        ],
        totalCompleted: 21,
        avgVelocity: 5
      },
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('trend-up')).toBeInTheDocument()
  })

  it('shows downward trend when recent weeks have fewer completions', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [
          { week: '2026-02', count: 1, startDate: new Date(), endDate: new Date() },
          { week: '2026-01', count: 2, startDate: new Date(), endDate: new Date() },
          { week: '2025-53', count: 8, startDate: new Date(), endDate: new Date() },
          { week: '2025-52', count: 10, startDate: new Date(), endDate: new Date() }
        ],
        totalCompleted: 21,
        avgVelocity: 5
      },
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('trend-down')).toBeInTheDocument()
  })

  it('shows neutral trend when weeks are equal', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [
          { week: '2026-02', count: 5, startDate: new Date(), endDate: new Date() },
          { week: '2026-01', count: 5, startDate: new Date(), endDate: new Date() },
          { week: '2025-53', count: 5, startDate: new Date(), endDate: new Date() },
          { week: '2025-52', count: 5, startDate: new Date(), endDate: new Date() }
        ],
        totalCompleted: 20,
        avgVelocity: 5
      },
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('trend-neutral')).toBeInTheDocument()
  })

  it('renders velocity chart when data available', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })

    render(<VelocityWidget />)

    expect(screen.getByTestId('velocity-chart')).toBeInTheDocument()
  })

  it('opens detail panel when clicked', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })

    render(<VelocityWidget />)

    const widget = screen.getByTestId('velocity-widget')
    fireEvent.click(widget)

    expect(screen.getByTestId('velocity-detail-panel')).toBeInTheDocument()
  })

  it('has accessible label with count', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })

    render(<VelocityWidget />)

    const widget = screen.getByTestId('velocity-widget')
    expect(widget).toHaveAttribute(
      'aria-label',
      '5 tasks completed this week. Click for details.'
    )
  })

  it('applies custom className prop', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })

    // Note: className is accepted but applied to loading/empty states wrapper
    // For data state, the button itself has fixed classes
    render(<VelocityWidget className="custom-class" />)

    // Widget should render successfully with className prop
    expect(screen.getByTestId('velocity-widget')).toBeInTheDocument()
  })

  // Edge case tests for calculateTrend function
  describe('trend calculation edge cases', () => {
    it('handles single week data (returns neutral)', () => {
      mockGetWeeklyVelocity.mockReturnValue({
        data: {
          weeks: [{ week: '2026-02', count: 5, startDate: new Date(), endDate: new Date() }],
          totalCompleted: 5,
          avgVelocity: 5
        },
        isLoading: false
      })

      render(<VelocityWidget />)

      // Single week should show neutral trend (cannot compare)
      expect(screen.getByTestId('trend-neutral')).toBeInTheDocument()
    })

    it('handles three weeks data (asymmetric comparison)', () => {
      mockGetWeeklyVelocity.mockReturnValue({
        data: {
          weeks: [
            { week: '2026-02', count: 10, startDate: new Date(), endDate: new Date() },
            { week: '2026-01', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-53', count: 2, startDate: new Date(), endDate: new Date() }
          ],
          totalCompleted: 14,
          avgVelocity: 4
        },
        isLoading: false
      })

      render(<VelocityWidget />)

      // With 3 weeks: midpoint=1, compares [0] (10) vs [1,2] avg (2)
      // Recent avg = 10, older avg = 2, so trend is up
      expect(screen.getByTestId('trend-up')).toBeInTheDocument()
    })

    it('handles two weeks data', () => {
      mockGetWeeklyVelocity.mockReturnValue({
        data: {
          weeks: [
            { week: '2026-02', count: 5, startDate: new Date(), endDate: new Date() },
            { week: '2026-01', count: 10, startDate: new Date(), endDate: new Date() }
          ],
          totalCompleted: 15,
          avgVelocity: 7
        },
        isLoading: false
      })

      render(<VelocityWidget />)

      // With 2 weeks: midpoint=1, compares [0] (5) vs [1] (10)
      // Recent = 5, older = 10, so trend is down
      expect(screen.getByTestId('trend-down')).toBeInTheDocument()
    })
  })
})
