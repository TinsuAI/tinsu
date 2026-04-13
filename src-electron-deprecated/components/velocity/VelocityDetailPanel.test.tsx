import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VelocityDetailPanel } from './VelocityDetailPanel'

// Mock ResponsiveContainer to avoid dimension warnings in tests
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 160 }}>{children}</div>
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
    { week: '2025-52', count: 4, startDate: new Date('2025-12-15'), endDate: new Date('2025-12-21') },
    { week: '2025-51', count: 3, startDate: new Date('2025-12-08'), endDate: new Date('2025-12-14') },
    { week: '2025-50', count: 2, startDate: new Date('2025-12-01'), endDate: new Date('2025-12-07') },
    { week: '2025-49', count: 1, startDate: new Date('2025-11-24'), endDate: new Date('2025-11-30') },
    { week: '2025-48', count: 2, startDate: new Date('2025-11-17'), endDate: new Date('2025-11-23') }
  ],
  totalCompleted: 22,
  avgVelocity: 2
}

const mockDailyData = {
  days: Array.from({ length: 28 }, (_, i) => ({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    count: Math.floor(Math.random() * 3)
  })),
  totalCompleted: 15
}

describe('VelocityDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWeeklyVelocity.mockReturnValue({
      data: mockWeeklyData,
      isLoading: false
    })
    mockGetDailyVelocity.mockReturnValue({
      data: mockDailyData,
      isLoading: false
    })
  })

  it('does not render when closed', () => {
    render(<VelocityDetailPanel open={false} onOpenChange={() => {}} />)

    expect(screen.queryByTestId('velocity-detail-panel')).not.toBeInTheDocument()
  })

  it('renders when open', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('velocity-detail-panel')).toBeInTheDocument()
  })

  it('shows dialog title', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    expect(screen.getByText('Velocity Details')).toBeInTheDocument()
  })

  it('shows last 4 weeks total', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    // Current 4-week total: 5 + 3 + 2 + 4 = 14
    expect(screen.getByTestId('detail-current-4week')).toHaveTextContent('14')
    expect(screen.getByText('Last 4 weeks')).toBeInTheDocument()
  })

  it('shows average velocity calculated from current 4 weeks', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    // Current 4 weeks: 5 + 3 + 2 + 4 = 14
    // avgVelocity4Week = Math.round(14/4) = Math.round(3.5) = 4
    expect(screen.getByTestId('detail-avg-velocity')).toHaveTextContent('4')
    expect(screen.getByText('Avg/week')).toBeInTheDocument()
  })

  it('shows percent change vs previous period', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    // Current 4 weeks: 5+3+2+4 = 14
    // Previous 4 weeks: 3+2+1+2 = 8
    // Change: (14-8)/8 * 100 = 75%
    expect(screen.getByTestId('detail-percent-change')).toHaveTextContent('+75%')
    expect(screen.getByText('vs prev 4 weeks')).toBeInTheDocument()
  })

  it('shows daily chart section', () => {
    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    expect(screen.getByText('Daily Completions (28 days)')).toBeInTheDocument()
    expect(screen.getByTestId('velocity-detail-chart')).toBeInTheDocument()
  })

  it('shows empty message when no data', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [],
        totalCompleted: 0,
        avgVelocity: 0
      },
      isLoading: false
    })
    mockGetDailyVelocity.mockReturnValue({
      data: { days: [], totalCompleted: 0 },
      isLoading: false
    })

    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('velocity-detail-empty')).toBeInTheDocument()
  })

  it('shows helpful text when totalCompleted is 0', () => {
    mockGetWeeklyVelocity.mockReturnValue({
      data: {
        weeks: [{ week: '2026-02', count: 0, startDate: new Date(), endDate: new Date() }],
        totalCompleted: 0,
        avgVelocity: 0
      },
      isLoading: false
    })

    render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

    expect(screen.getByText(/Start completing tasks/)).toBeInTheDocument()
  })

  describe('trend indicators', () => {
    it('shows positive trend when current > previous', () => {
      render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

      const changeElement = screen.getByTestId('detail-percent-change')
      expect(changeElement).toHaveClass('text-green-500')
    })

    it('shows negative trend when current < previous', () => {
      mockGetWeeklyVelocity.mockReturnValue({
        data: {
          weeks: [
            { week: '2026-02', count: 1, startDate: new Date(), endDate: new Date() },
            { week: '2026-01', count: 1, startDate: new Date(), endDate: new Date() },
            { week: '2025-53', count: 1, startDate: new Date(), endDate: new Date() },
            { week: '2025-52', count: 1, startDate: new Date(), endDate: new Date() },
            { week: '2025-51', count: 5, startDate: new Date(), endDate: new Date() },
            { week: '2025-50', count: 5, startDate: new Date(), endDate: new Date() },
            { week: '2025-49', count: 5, startDate: new Date(), endDate: new Date() },
            { week: '2025-48', count: 5, startDate: new Date(), endDate: new Date() }
          ],
          totalCompleted: 24,
          avgVelocity: 3
        },
        isLoading: false
      })

      render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

      const changeElement = screen.getByTestId('detail-percent-change')
      expect(changeElement).toHaveClass('text-red-500')
    })

    it('shows neutral when current equals previous', () => {
      mockGetWeeklyVelocity.mockReturnValue({
        data: {
          weeks: [
            { week: '2026-02', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2026-01', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-53', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-52', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-51', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-50', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-49', count: 2, startDate: new Date(), endDate: new Date() },
            { week: '2025-48', count: 2, startDate: new Date(), endDate: new Date() }
          ],
          totalCompleted: 16,
          avgVelocity: 2
        },
        isLoading: false
      })

      render(<VelocityDetailPanel open={true} onOpenChange={() => {}} />)

      const changeElement = screen.getByTestId('detail-percent-change')
      expect(changeElement).toHaveClass('text-zinc-500')
    })
  })
})
