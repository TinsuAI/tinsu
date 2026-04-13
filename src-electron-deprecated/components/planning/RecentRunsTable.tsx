/**
 * RecentRunsTable — T1.10 implementation.
 * Shows a table of recent workflow runs for the current project.
 *
 * Story T1.10 AC: 12
 */

import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'
import { format } from 'date-fns'
import type { WorkflowRunModel } from '@renderer/bindings'

const STATUS_COLORS: Record<string, string> = {
  running: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20',
  'needs-input': 'text-yellow-400 border-yellow-500/30 bg-yellow-950/20',
  succeeded: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
  failed: 'text-red-400 border-red-500/30 bg-red-950/20',
  cancelled: 'text-muted-foreground border-border/30 bg-muted/10',
}

function formatDuration(run: WorkflowRunModel): string {
  if (!run.started_at) return '—'
  const endMs = run.finished_at ?? Date.now()
  const secs = Math.floor((endMs - run.started_at) / 1000)
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function RecentRunsTable() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const { data: runs, isLoading } = useQuery({
    queryKey: ['workflow-runs', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return []
      const r = await commands.listWorkflowRuns(activeProjectId, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!activeProjectId,
    refetchOnWindowFocus: true,
  })

  if (!activeProjectId) return null

  if (isLoading) {
    return (
      <div data-testid="recent-runs-table" className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-muted/30" />
        ))}
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <div
        data-testid="recent-runs-table"
        className="flex flex-col items-center gap-2 py-6 text-center"
      >
        <History className="h-6 w-6 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No workflow runs yet</p>
      </div>
    )
  }

  return (
    <div data-testid="recent-runs-table" className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30">
            {['Workflow', 'Phase', 'Status', 'Started', 'Duration'].map((col) => (
              <th
                key={col}
                className="pb-2 pr-3 text-left font-medium text-muted-foreground/60 uppercase tracking-wider text-[10px]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const workflow = BMAD_WORKFLOWS.find((w) => w.key === run.workflow_key)
            const statusClass = STATUS_COLORS[run.status] ?? STATUS_COLORS.cancelled
            return (
              <tr
                key={run.id}
                className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
              >
                <td className="py-2 pr-3 font-medium text-foreground/90">
                  {workflow?.name ?? run.workflow_key}
                </td>
                <td className="py-2 pr-3 text-muted-foreground font-mono">
                  {run.phase ?? '—'}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium',
                      statusClass
                    )}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted-foreground font-mono">
                  {run.started_at
                    ? format(new Date(run.started_at), 'MMM d HH:mm')
                    : '—'}
                </td>
                <td className="py-2 font-mono text-muted-foreground">
                  {formatDuration(run)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
