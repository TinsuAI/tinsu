import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { format } from 'date-fns'

interface WeekData {
  week: string
  count: number
  startDate: Date
  endDate: Date
}

interface VelocityChartProps {
  data: WeekData[]
}

// Custom tooltip component (theme-aware)
function CustomTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: Array<{ payload: WeekData }>
}) {
  if (!active || !payload?.[0]) return null

  const item = payload[0].payload
  return (
    <div
      className="rounded border border-border bg-popover px-2 py-1 text-xs shadow-lg"
      data-testid="velocity-chart-tooltip"
    >
      <div className="font-medium text-foreground">{item.count} tasks</div>
      <div className="text-muted-foreground">
        {format(new Date(item.startDate), 'MMM d')} - {format(new Date(item.endDate), 'MMM d')}
      </div>
    </div>
  )
}

export function VelocityChart({ data }: VelocityChartProps) {
  // Reverse data so oldest is first (left to right chronological order)
  const chartData = [...data].reverse()

  // Get theme-aware colors from CSS custom properties
  const isDark = document.documentElement.classList.contains('dark')
  const barColor = isDark ? '#52525b' : '#94a3b8' // zinc-600 / slate-400
  const activeBarColor = isDark ? '#71717a' : '#64748b' // zinc-500 / slate-500

  return (
    <div className="h-6 w-16" data-testid="velocity-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} animationDuration={300}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === chartData.length - 1 ? activeBarColor : barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
