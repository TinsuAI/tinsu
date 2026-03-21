import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  Clock,
  ExternalLink,
  Terminal,
  AlertTriangle,
  Check,
  X,
  Ban,
  Bot,
  FileCode2
} from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { useTaskWorkspaceStore } from '@renderer/stores/task-workspace.store'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'

/**
 * Status configuration for visual indicators.
 */
const STATUS_CONFIG = {
  running: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    ring: 'ring-cyan-500/20',
    glow: 'bg-cyan-500/5',
    label: 'Running',
    Icon: Activity
  },
  'needs-input': {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    ring: 'ring-yellow-500/20',
    glow: 'bg-yellow-500/5',
    label: 'Needs Input',
    Icon: AlertTriangle
  },
  succeeded: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/20',
    glow: 'bg-emerald-500/5',
    label: 'Succeeded',
    Icon: Check
  },
  failed: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    ring: 'ring-red-500/20',
    glow: 'bg-red-500/5',
    label: 'Failed',
    Icon: X
  },
  cancelled: {
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-400',
    border: 'border-zinc-500/30',
    ring: 'ring-zinc-500/20',
    glow: 'bg-zinc-500/5',
    label: 'Cancelled',
    Icon: Ban
  }
} as const

type RunStatus = keyof typeof STATUS_CONFIG

/**
 * Format elapsed time from milliseconds into a human-readable string.
 */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Workflow Run Panel — Story 9.5
 *
 * Displays an active workflow run banner when a BMAD planning agent is executing.
 * Polls every 3 seconds for active run status.
 * Renders nothing when no run is active.
 */
export function WorkflowRunPanel() {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const { data: activeRun } = trpc.planning.getActiveWorkflowRun.useQuery(
    { projectId },
    { enabled: !!projectId, refetchInterval: 3000 }
  )

  const closeWorkspace = usePlanningWorkspaceStore((s) => s.closeWorkspace)
  const openWorkspaceToArtifact = usePlanningWorkspaceStore((s) => s.openWorkspaceToArtifact)
  const openTaskWorkspace = useTaskWorkspaceStore((s) => s.openWorkspace)

  // Elapsed time ticker
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!activeRun || (activeRun.status !== 'running' && activeRun.status !== 'needs-input')) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeRun])

  const elapsed = useMemo(() => {
    if (!activeRun) return 0
    const sa = activeRun.started_at
    const startMs = typeof sa === 'number'
      ? sa * 1000
      : typeof sa === 'string'
        ? new Date(sa).getTime()
        : typeof sa === 'object' && sa !== null
          ? (sa as Date).getTime()
          : 0
    return now - startMs
  }, [activeRun, now])

  // Map workflowKey to workflow name
  const workflowName = useMemo(() => {
    if (!activeRun) return ''
    const wf = BMAD_WORKFLOWS.find((w) => w.key === activeRun.workflow_key)
    return wf?.name ?? activeRun.workflow_key
  }, [activeRun])

  const handleViewTerminal = useCallback(() => {
    if (!activeRun?.task_id) return
    closeWorkspace()
    openTaskWorkspace(activeRun.task_id)
  }, [activeRun, closeWorkspace, openTaskWorkspace])

  const handleViewArtifact = useCallback(
    (workflowKey: string) => {
      openWorkspaceToArtifact(workflowKey)
    },
    [openWorkspaceToArtifact]
  )

  if (!activeRun) return null

  const status = (activeRun.status as RunStatus) ?? 'running'
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.running
  const StatusIcon = config.Icon
  const isRunning = status === 'running'
  const isSucceeded = status === 'succeeded'
  const inputArtifacts = (activeRun.input_artifacts ?? []) as string[]
  const outputArtifacts = (activeRun.output_artifacts ?? []) as string[]

  return (
    <div className="px-6 pt-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card/50 p-4',
          config.border,
          'ring-1',
          config.ring
        )}
      >
        {/* Subtle glow backdrop */}
        <div className={cn('absolute -left-8 -top-8 h-32 w-32 rounded-full blur-2xl', config.glow)} />

        <div className="relative flex items-start gap-4">
          {/* Status icon block */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
              config.bg,
              config.ring
            )}
          >
            {isRunning ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute h-3 w-3 animate-pulse rounded-full bg-cyan-400/40" />
                <span className="relative h-2 w-2 rounded-full bg-cyan-400" />
              </div>
            ) : (
              <StatusIcon className={cn('h-5 w-5', config.text)} />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-foreground">
                {workflowName}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'px-1.5 py-0 text-[10px] font-normal capitalize',
                  config.border,
                  config.bg,
                  config.text
                )}
              >
                {config.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-muted/50 px-1.5 py-0 text-[10px] font-normal capitalize text-muted-foreground"
              >
                {activeRun.phase}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {activeRun.agent_name && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  <span className="font-mono text-[11px]">{activeRun.agent_name}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="tabular-nums">{formatElapsed(elapsed)}</span>
              </span>
              {inputArtifacts.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileCode2 className="h-3 w-3 text-muted-foreground/60" />
                  {inputArtifacts.map((artifact) => (
                    <span
                      key={artifact}
                      className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70"
                    >
                      {artifact}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {/* Output artifacts (on success) */}
            {isSucceeded && outputArtifacts.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-emerald-500/70">Output:</span>
                {outputArtifacts.map((filename) => (
                  <button
                    key={filename}
                    type="button"
                    onClick={() => handleViewArtifact(activeRun.workflow_key)}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    {filename}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {activeRun.task_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewTerminal}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Terminal className="h-3.5 w-3.5" />
                View Terminal
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
