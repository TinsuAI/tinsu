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

// Custom tooltip component for dark theme
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
      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs shadow-lg"
      data-testid="velocity-chart-tooltip"
    >
      <div className="font-medium">{item.count} tasks</div>
      <div className="text-zinc-400">
        {format(new Date(item.startDate), 'MMM d')} - {format(new Date(item.endDate), 'MMM d')}
      </div>
    </div>
  )
}

export function VelocityChart({ data }: VelocityChartProps) {
  // Reverse data so oldest is first (left to right chronological order)
  const chartData = [...data].reverse()

  return (
    <div className="h-6 w-16" data-testid="velocity-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} animationDuration={300}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === chartData.length - 1 ? '#71717a' : '#52525b'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
