/**
 * WorkflowRunPanel — T1.10 implementation.
 * Shows the currently active workflow run with status, elapsed time, and details.
 *
 * Story T1.10 AC: 12
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Tag, User, Clock, Terminal } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'

type ActiveRun = {
  id: string
  project_id: string
  workflow_key: string
  phase: string | null
  status: string
  started_at: number | null
  finished_at: number | null
  input_artifacts: string[] | null
  output_artifacts: string[] | null
  agent_name: string | null
  task_id: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string; pulse: boolean }> = {
  running: { label: 'Running', color: 'text-cyan-400', dotColor: 'bg-cyan-400', pulse: true },
  'needs-input': { label: 'Needs Input', color: 'text-yellow-400', dotColor: 'bg-yellow-400', pulse: false },
  succeeded: { label: 'Succeeded', color: 'text-emerald-400', dotColor: 'bg-emerald-400', pulse: false },
  failed: { label: 'Failed', color: 'text-red-400', dotColor: 'bg-red-400', pulse: false },
  cancelled: { label: 'Cancelled', color: 'text-muted-foreground', dotColor: 'bg-muted-foreground', pulse: false },
}

function formatElapsed(startedAtMs: number): string {
  const elapsed = Math.floor((Date.now() - startedAtMs) / 1000)
  if (elapsed < 60) return `${elapsed}s`
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function WorkflowRunPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const [, forceUpdate] = useState(0)

  const { data: activeRun } = useQuery({
    queryKey: ['active-workflow-run', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null
      const r = await commands.getActiveWorkflowRun(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as ActiveRun | null
    },
    enabled: !!activeProjectId,
    refetchInterval: 3000,
  })

  // Update elapsed time every second when running
  useEffect(() => {
    if (!activeRun || activeRun.status !== 'running') return
    const id = setInterval(() => forceUpdate((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [activeRun])

  if (!activeProjectId) return null

  if (!activeRun) {
    return (
      <div data-testid="workflow-run-panel" className="flex flex-col items-center gap-2 py-6 text-center">
        <Activity className="h-6 w-6 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No active workflow run</p>
      </div>
    )
  }

  const workflow = BMAD_WORKFLOWS.find((w) => w.key === activeRun.workflow_key)
  const statusCfg = STATUS_CONFIG[activeRun.status] ?? {
    label: activeRun.status,
    color: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    pulse: false,
  }

  return (
    <div data-testid="workflow-run-panel" className="rounded-md border border-border/40 bg-card/20 p-4">
      {/* Status header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {workflow?.name ?? activeRun.workflow_key}
          </p>
          {activeRun.phase && (
            <span className="rounded border border-border/30 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
              {activeRun.phase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              statusCfg.dotColor,
              statusCfg.pulse && 'animate-pulse'
            )}
          />
          <span className={cn('text-xs font-medium', statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {activeRun.agent_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span>{activeRun.agent_name}</span>
          </div>
        )}
        {activeRun.started_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatElapsed(activeRun.started_at)}</span>
          </div>
        )}
        {activeRun.input_artifacts && activeRun.input_artifacts.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Tag className="h-3 w-3 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {activeRun.input_artifacts.map((art) => (
                <code
                  key={art}
                  className="rounded border border-border/30 bg-muted/20 px-1.5 py-0.5 font-mono text-[10px]"
                >
                  {art}
                </code>
              ))}
            </div>
          </div>
        )}
        {activeRun.task_id && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-3 w-3 shrink-0" />
            <span className="text-muted-foreground/60">View Terminal (task: {activeRun.task_id.slice(0, 8)}…)</span>
          </div>
        )}
      </div>
    </div>
  )
}
