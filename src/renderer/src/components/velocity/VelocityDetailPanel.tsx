import { trpc } from '@renderer/lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface VelocityDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Custom tooltip for detail chart
function DetailTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: Array<{ payload: { date: Date; count: number } }>
}) {
  if (!active || !payload?.[0]) return null

  const item = payload[0].payload
  return (
    <div className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs shadow-lg">
      <div className="font-medium">{item.count} tasks</div>
      <div className="text-zinc-400">{format(new Date(item.date), 'EEE, MMM d')}</div>
    </div>
  )
}

export function VelocityDetailPanel({ open, onOpenChange }: VelocityDetailPanelProps) {
  const { data: weeklyData } = trpc.velocity.getWeeklyVelocity.useQuery(
    { weeks: 8 },
    { enabled: open }
  )
  const { data: dailyData } = trpc.velocity.getDailyVelocity.useQuery(
    { days: 28 },
    { enabled: open }
  )

  // Calculate comparison: current 4-week vs previous 4-week
  const current4Week =
    weeklyData?.weeks.slice(0, 4).reduce((sum, w) => sum + w.count, 0) ?? 0
  const previous4Week =
    weeklyData?.weeks.slice(4, 8).reduce((sum, w) => sum + w.count, 0) ?? 0
  const percentChange =
    previous4Week > 0
      ? Math.round(((current4Week - previous4Week) / previous4Week) * 100)
      : current4Week > 0
        ? 100
        : 0

  // Calculate avg velocity based on current 4 weeks (not 8-week query)
  // This ensures the "Avg/week" label accurately reflects the "Last 4 weeks" period
  const avgVelocity4Week = Math.round(current4Week / 4)

  // Prepare daily chart data (reverse for chronological order)
  const dailyChartData = dailyData?.days
    ? [...dailyData.days].reverse().map((d) => ({
        date: d.date,
        count: d.count,
        label: format(new Date(d.date), 'M/d')
      }))
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="velocity-detail-panel">
        <DialogHeader>
          <DialogTitle>Velocity Details</DialogTitle>
          <DialogDescription>Tasks completed over time</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" data-testid="detail-current-4week">
                {current4Week}
              </div>
              <div className="text-xs text-muted-foreground">Last 4 weeks</div>
            </div>
            <div>
              <div className="text-2xl font-bold" data-testid="detail-avg-velocity">
                {avgVelocity4Week}
              </div>
              <div className="text-xs text-muted-foreground">Avg/week</div>
            </div>
            <div>
              <div
                className={`flex items-center justify-center gap-1 text-2xl font-bold ${
                  percentChange > 0
                    ? 'text-green-500'
                    : percentChange < 0
                      ? 'text-red-500'
                      : 'text-zinc-500'
                }`}
                data-testid="detail-percent-change"
              >
                {percentChange > 0 && <TrendingUp className="h-5 w-5" />}
                {percentChange < 0 && <TrendingDown className="h-5 w-5" />}
                {percentChange === 0 && <Minus className="h-5 w-5" />}
                {percentChange > 0 ? '+' : ''}
                {percentChange}%
              </div>
              <div className="text-xs text-muted-foreground">vs prev 4 weeks</div>
            </div>
          </div>

          {/* Daily chart */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Daily Completions (28 days)</h4>
            {dailyChartData.length > 0 ? (
              <div className="h-40" data-testid="velocity-detail-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#71717a' }}
                      tickLine={false}
                      axisLine={false}
                      width={20}
                    />
                    <Tooltip content={<DetailTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} animationDuration={300}>
                      {dailyChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#52525b' : '#27272a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div
                className="flex h-40 items-center justify-center rounded bg-zinc-800/50 text-sm text-muted-foreground"
                data-testid="velocity-detail-empty"
              >
                No completion data available
              </div>
            )}
          </div>

          {/* Empty state message when no data */}
          {weeklyData?.totalCompleted === 0 && (
            <div className="rounded-lg bg-zinc-800/50 p-4 text-center text-sm text-muted-foreground">
              Start completing tasks to see your velocity metrics here. Move tasks to the
              &quot;Done&quot; column to track your progress over time.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
