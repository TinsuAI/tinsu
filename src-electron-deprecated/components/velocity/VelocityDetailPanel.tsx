import { useQuery } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface VelocityDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VelocityDetailPanel({ open, onOpenChange }: VelocityDetailPanelProps) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId) ?? ''

  const { data: weeklyData } = useQuery({
    queryKey: ['velocity', 'weekly', 8, activeProjectId],
    queryFn: async () => {
      const result = await commands.getWeeklyVelocity({ weeks: 8, project_id: activeProjectId })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: open,
  })

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

  // Calculate avg velocity based on current 4 weeks
  const avgVelocity4Week = Math.round(current4Week / 4)

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
                      : 'text-muted-foreground'
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

          {/* Weekly breakdown */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Weekly Completions</h4>
            {weeklyData && weeklyData.weeks.length > 0 ? (
              <div className="space-y-1" data-testid="velocity-detail-weekly">
                {weeklyData.weeks.map((week) => (
                  <div key={week.week_label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{week.week_label}</span>
                    <span className="font-medium">{week.count} tasks</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex h-20 items-center justify-center rounded bg-muted/50 text-sm text-muted-foreground"
                data-testid="velocity-detail-empty"
              >
                No completion data available
              </div>
            )}
          </div>

          {/* Empty state message when no data */}
          {weeklyData?.total_completed === 0 && (
            <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Start completing tasks to see your velocity metrics here. Move tasks to the
              &quot;Done&quot; column to track your progress over time.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
