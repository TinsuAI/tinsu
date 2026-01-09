import { useState } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { VelocityChart } from './VelocityChart'
import { VelocityDetailPanel } from './VelocityDetailPanel'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface VelocityWidgetProps {
  className?: string
}

// Calculate trend based on comparing recent weeks to older weeks
function calculateTrend(weeks: Array<{ count: number }>): number {
  if (weeks.length < 2) return 0

  // Compare first half (recent) to second half (older)
  const midpoint = Math.floor(weeks.length / 2)
  const recentAvg = weeks.slice(0, midpoint).reduce((sum, w) => sum + w.count, 0) / midpoint
  const olderAvg = weeks.slice(midpoint).reduce((sum, w) => sum + w.count, 0) / (weeks.length - midpoint)

  if (recentAvg > olderAvg) return 1
  if (recentAvg < olderAvg) return -1
  return 0
}

export function VelocityWidget({ className: _className }: VelocityWidgetProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { data: velocityData, isLoading } = trpc.velocity.getWeeklyVelocity.useQuery({ weeks: 4 })

  if (isLoading) {
    return (
      <div
        className="h-8 w-32 animate-pulse rounded bg-zinc-800"
        data-testid="velocity-widget-loading"
        aria-label="Loading velocity data"
      />
    )
  }

  if (!velocityData || velocityData.totalCompleted === 0) {
    return (
      <>
        <button
          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-zinc-800/50"
          onClick={() => setDetailOpen(true)}
          data-testid="velocity-widget-empty"
          aria-label="No tasks completed yet. Click for details."
        >
          <span>No data yet</span>
        </button>

        <VelocityDetailPanel open={detailOpen} onOpenChange={setDetailOpen} />
      </>
    )
  }

  const currentWeekCount = velocityData.weeks[0]?.count ?? 0
  const trend = calculateTrend(velocityData.weeks)

  return (
    <>
      <button
        className="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800/50"
        onClick={() => setDetailOpen(true)}
        aria-label={`${currentWeekCount} tasks completed this week. Click for details.`}
        data-testid="velocity-widget"
      >
        <span className="text-sm font-medium" data-testid="velocity-count">
          {currentWeekCount}
        </span>
        <span className="text-xs text-muted-foreground">this week</span>
        {trend > 0 && <TrendingUp className="h-3 w-3 text-green-500" data-testid="trend-up" />}
        {trend < 0 && <TrendingDown className="h-3 w-3 text-red-500" data-testid="trend-down" />}
        {trend === 0 && <Minus className="h-3 w-3 text-zinc-500" data-testid="trend-neutral" />}
        <VelocityChart
          data={velocityData.weeks.map((w) => ({
            ...w,
            startDate: new Date(w.startDate),
            endDate: new Date(w.endDate)
          }))}
        />
      </button>

      <VelocityDetailPanel open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  )
}
