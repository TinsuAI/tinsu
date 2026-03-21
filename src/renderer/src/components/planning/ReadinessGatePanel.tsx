import { useState, useMemo, useCallback } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Clock,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  ExternalLink,
  History,
  Sparkles
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { formatDistanceToNow } from 'date-fns'

/**
 * Gate decision configuration for visual mapping.
 */
const DECISION_CONFIG = {
  pass: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/20',
    glow: 'bg-emerald-500/8',
    label: 'PASS',
    Icon: CheckCircle2
  },
  concerns: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    ring: 'ring-yellow-500/20',
    glow: 'bg-yellow-500/8',
    label: 'CONCERNS',
    Icon: AlertTriangle
  },
  fail: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    ring: 'ring-red-500/20',
    glow: 'bg-red-500/8',
    label: 'FAIL',
    Icon: XCircle
  }
} as const

type GateDecision = keyof typeof DECISION_CONFIG

/**
 * Severity badge configuration for issue display.
 */
const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    label: 'Critical'
  },
  major: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    label: 'Major'
  },
  minor: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    label: 'Minor'
  }
} as const

interface GateIssue {
  severity: 'critical' | 'major' | 'minor'
  description: string
  artifactKey?: string
  sectionRef?: string
}

/**
 * Safely convert a gate decision timestamp to a Date for formatDistanceToNow.
 */
function toDate(val: Date | number | string | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') return new Date(val * 1000)
  if (typeof val === 'string') return new Date(val)
  return null
}

/**
 * ReadinessGatePanel — Story 9.6
 *
 * Displays the readiness gate check results: status badge, issues, rationale,
 * re-run navigation, gate history, and approve-for-implementation action.
 */
export function ReadinessGatePanel() {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const { data: latestGate } = trpc.planning.getLatestGateDecision.useQuery(
    { projectId },
    { enabled: !!projectId, refetchOnWindowFocus: true }
  )

  const trpcUtils = trpc.useUtils()

  const approveMutation = trpc.planning.approveForImplementation.useMutation({
    onSuccess: () => {
      trpcUtils.planning.scanArtifacts.invalidate()
      setApproved(true)
    }
  })

  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)
  const openWorkspaceToArtifact = usePlanningWorkspaceStore((s) => s.openWorkspaceToArtifact)

  const [showHistory, setShowHistory] = useState(false)
  const [approved, setApproved] = useState(false)

  const handleRerunGate = useCallback(() => {
    setSelectedWorkflow('readiness-check')
  }, [setSelectedWorkflow])

  const handleApprove = useCallback(() => {
    if (!projectId) return
    approveMutation.mutate({ projectId })
  }, [projectId, approveMutation])

  const handleViewArtifact = useCallback(
    (artifactKey: string) => {
      openWorkspaceToArtifact(artifactKey)
    },
    [openWorkspaceToArtifact]
  )

  // Empty state — no gate result
  if (!latestGate) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-6">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
            <Shield className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              No readiness gate results yet
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Run the implementation readiness check to assess your planning artifacts.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleRerunGate}
            className="gap-1.5 bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Run Readiness Check
          </Button>
        </div>
      </div>
    )
  }

  const decision = (latestGate.decision as GateDecision) ?? 'concerns'
  const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.concerns
  const DecisionIcon = config.Icon
  const issues = (latestGate.issues ?? []) as GateIssue[]
  const timestamp = toDate(latestGate.created_at)
  const isPass = decision === 'pass'

  return (
    <div className="space-y-3">
      {/* Main gate result card */}
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

        <div className="relative space-y-4">
          {/* Header: badge + actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Status icon block */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1',
                  config.bg,
                  config.ring
                )}
              >
                <DecisionIcon className={cn('h-5 w-5', config.text)} />
              </div>

              {/* Decision label + timestamp */}
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold tracking-wide', config.text)}>
                    {config.label}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-medium',
                      config.bg,
                      config.text
                    )}
                  >
                    Readiness Gate
                  </span>
                </div>
                {timestamp && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(timestamp, { addSuffix: true })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRerunGate}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Re-run Gate
              </Button>

              {isPass && !approved && (
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="gap-1.5 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {approveMutation.isPending ? 'Approving...' : 'Approve for Implementation'}
                </Button>
              )}

              {isPass && approved && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approved
                </span>
              )}

              {!isPass && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground/50"
                  title="Gate must pass before approving for implementation"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </span>
              )}
            </div>
          </div>

          {/* Rationale */}
          {latestGate.rationale && (
            <div className="rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {latestGate.rationale}
              </p>
            </div>
          )}

          {/* Issues list */}
          {issues.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Issues ({issues.length})</span>
              </div>
              <div className="space-y-1">
                {issues.map((issue, i) => (
                  <IssueRow
                    key={i}
                    issue={issue}
                    onViewArtifact={handleViewArtifact}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History toggle */}
      <button
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
        <span>Gate History</span>
        {showHistory ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        )}
      </button>

      {/* History section */}
      {showHistory && (
        <GateHistorySection projectId={projectId} onViewArtifact={handleViewArtifact} />
      )}
    </div>
  )
}

/* ── Issue row ── */

function IssueRow({
  issue,
  onViewArtifact
}: {
  issue: GateIssue
  onViewArtifact: (key: string) => void
}) {
  const severity = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.minor

  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-muted/20">
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
          severity.bg,
          severity.text
        )}
      >
        {severity.label}
      </span>
      <span className="min-w-0 flex-1 text-xs text-foreground/90">
        {issue.description}
      </span>
      {issue.artifactKey && (
        <button
          type="button"
          onClick={() => onViewArtifact(issue.artifactKey!)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400 transition-colors hover:bg-cyan-500/20"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          View
        </button>
      )}
    </div>
  )
}

/* ── Gate History Section ── */

function GateHistorySection({
  projectId,
  onViewArtifact
}: {
  projectId: string
  onViewArtifact: (key: string) => void
}) {
  const { data: decisions } = trpc.planning.listGateDecisions.useQuery(
    { projectId },
    { enabled: !!projectId }
  )

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Skip the first one (it's the latest, already shown above)
  const historicalDecisions = useMemo(
    () => (decisions ?? []).slice(1),
    [decisions]
  )

  if (historicalDecisions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/50 px-4 py-3">
        <p className="text-center text-xs text-muted-foreground/60">
          No previous gate results
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card/50">
      {historicalDecisions.map((gate) => {
        const decision = (gate.decision as GateDecision) ?? 'concerns'
        const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.concerns
        const DecisionIcon = config.Icon
        const issues = (gate.issues ?? []) as GateIssue[]
        const timestamp = toDate(gate.created_at)
        const isExpanded = expandedId === gate.id

        return (
          <div
            key={gate.id}
            className="border-b border-border/50 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : gate.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/20"
            >
              <DecisionIcon className={cn('h-4 w-4 shrink-0', config.text)} />
              <span className={cn('text-xs font-semibold', config.text)}>
                {config.label}
              </span>
              {timestamp && (
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </span>
              )}
              {issues.length > 0 && (
                <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {issues.length} issue{issues.length !== 1 ? 's' : ''}
                </span>
              )}
              <span className="ml-auto">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-2 border-t border-border/30 px-4 py-3">
                {gate.rationale && (
                  <div className="rounded-lg bg-muted/30 px-3 py-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {gate.rationale}
                    </p>
                  </div>
                )}
                {issues.length > 0 && (
                  <div className="space-y-1">
                    {issues.map((issue: GateIssue, i: number) => (
                      <IssueRow key={i} issue={issue} onViewArtifact={onViewArtifact} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
