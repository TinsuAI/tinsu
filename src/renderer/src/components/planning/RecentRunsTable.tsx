import { useState, useMemo } from 'react'
import {
  History,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Bot,
  Clock,
  ExternalLink,
  Activity,
  AlertTriangle,
  Check,
  X,
  Ban
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'

/**
 * Status visual config — shared palette with WorkflowRunPanel.
 */
const STATUS_STYLES: Record<string, { bg: string; text: string; Icon: typeof Activity }> = {
  running: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', Icon: Activity },
  'needs-input': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', Icon: AlertTriangle },
  succeeded: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', Icon: Check },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', Icon: X },
  cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', Icon: Ban }
}

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  'needs-input': 'Needs Input',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

/**
 * Convert a timestamp value to milliseconds.
 */
function toMs(date: Date | number | string): number {
  if (date instanceof Date) return date.getTime()
  if (typeof date === 'string') return new Date(date).getTime()
  return date * 1000
}

/**
 * Format a timestamp into relative time (e.g., "2m ago", "1h ago").
 */
function formatRelativeTime(date: Date | number | string): string {
  const ms = toMs(date)
  const diff = Date.now() - ms
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Format duration between two timestamps.
 */
function formatDuration(startedAt: Date | number | string, finishedAt: Date | number | string | null): string {
  if (!finishedAt) return '--'
  const startMs = toMs(startedAt)
  const endMs = toMs(finishedAt)
  const diff = endMs - startMs
  if (diff < 0) return '--'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format a timestamp as an absolute datetime string.
 */
function formatTimestamp(date: Date | number | string | null): string {
  if (!date) return '--'
  const d = new Date(toMs(date))
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Recent Runs Table — Story 9.5
 *
 * Displays a history of BMAD workflow runs with expandable detail rows.
 * Refreshes on window focus (no polling).
 */
export function RecentRunsTable() {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const { data: runs, isPending } = trpc.planning.listWorkflowRuns.useQuery(
    { projectId, limit: 10 },
    { enabled: !!projectId, refetchOnWindowFocus: true }
  )

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const openWorkspaceToArtifact = usePlanningWorkspaceStore((s) => s.openWorkspaceToArtifact)

  const toggleRow = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // Loading state
  if (isPending) {
    return (
      <section aria-label="Recent runs loading">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-500/40" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Recent Runs
          </h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card/50">
          <div className="divide-y divide-border/30">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-3 w-12 animate-pulse rounded bg-muted" />
                <div className="h-3 w-14 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Empty state
  if (!runs || runs.length === 0) {
    return (
      <section aria-label="Recent runs empty">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground/40" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Recent Runs
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center">
          <p className="text-xs text-muted-foreground/60">
            No workflow runs yet. Start a planning workflow to see run history here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Recent workflow runs">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-cyan-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Recent Runs
        </h2>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {runs.length} run{runs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card/50">
        {/* Header */}
        <div className="flex items-center border-b border-border/50 bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          <span className="w-5" />
          <span className="flex-1">Workflow</span>
          <span className="w-24 text-center">Phase</span>
          <span className="w-24 text-center">Status</span>
          <span className="w-20 text-right">Started</span>
          <span className="w-20 text-right">Duration</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/20">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              isExpanded={expandedId === run.id}
              onToggle={() => toggleRow(run.id)}
              onViewArtifact={openWorkspaceToArtifact}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Single run row with expandable details ── */

interface RunRowProps {
  run: {
    id: string
    workflow_key: string
    phase: string
    status: string
    started_at: Date | number | string
    finished_at: Date | number | string | null
    input_artifacts: string[]
    output_artifacts: string[]
    agent_name: string | null
  }
  isExpanded: boolean
  onToggle: () => void
  onViewArtifact: (workflowKey: string) => void
}

function RunRow({ run, isExpanded, onToggle, onViewArtifact }: RunRowProps) {
  const workflowName = useMemo(() => {
    const wf = BMAD_WORKFLOWS.find((w) => w.key === run.workflow_key)
    return wf?.name ?? run.workflow_key
  }, [run.workflow_key])

  const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.cancelled
  const StatusIcon = style.Icon

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center px-4 py-2.5 text-left transition-colors',
          'hover:bg-accent/30',
          isExpanded && 'bg-accent/20'
        )}
      >
        {/* Chevron */}
        <span className="flex w-5 shrink-0 items-center">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          )}
        </span>

        {/* Workflow name */}
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {workflowName}
        </span>

        {/* Phase */}
        <span className="flex w-24 justify-center">
          <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
            {run.phase}
          </span>
        </span>

        {/* Status badge */}
        <span className="flex w-24 justify-center">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              style.bg,
              style.text
            )}
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {STATUS_LABELS[run.status] ?? run.status}
          </span>
        </span>

        {/* Started */}
        <span className="w-20 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatRelativeTime(run.started_at)}
        </span>

        {/* Duration */}
        <span className="w-20 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(run.started_at, run.finished_at)}
        </span>
      </button>

      {/* Expanded detail section */}
      {isExpanded && (
        <div className="border-l-2 border-border/40 bg-muted/10 px-4 py-3 pl-9">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            {/* Agent */}
            {run.agent_name && (
              <div className="flex items-center gap-1.5">
                <Bot className="h-3 w-3 text-muted-foreground/50" />
                <span className="text-muted-foreground/60">Agent:</span>
                <span className="font-mono text-[11px] text-foreground">{run.agent_name}</span>
              </div>
            )}

            {/* Exact timestamps */}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-muted-foreground/60">Started:</span>
              <span className="text-[11px] text-foreground">{formatTimestamp(run.started_at)}</span>
            </div>
            {run.finished_at && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground/50" />
                <span className="text-muted-foreground/60">Finished:</span>
                <span className="text-[11px] text-foreground">{formatTimestamp(run.finished_at)}</span>
              </div>
            )}

            {/* Input artifacts */}
            {run.input_artifacts.length > 0 && (
              <div className="col-span-2 flex items-start gap-1.5">
                <FileCode2 className="mt-0.5 h-3 w-3 text-muted-foreground/50" />
                <span className="text-muted-foreground/60">Inputs:</span>
                <div className="flex flex-wrap gap-1">
                  {run.input_artifacts.map((artifact) => (
                    <span
                      key={artifact}
                      className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70"
                    >
                      {artifact}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Output artifacts */}
            {run.output_artifacts.length > 0 && (
              <div className="col-span-2 flex items-start gap-1.5">
                <FileCode2 className="mt-0.5 h-3 w-3 text-emerald-500/50" />
                <span className="text-muted-foreground/60">Outputs:</span>
                <div className="flex flex-wrap gap-1">
                  {run.output_artifacts.map((filename) => (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => onViewArtifact(run.workflow_key)}
                      className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {filename}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
