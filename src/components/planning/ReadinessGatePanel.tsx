/**
 * ReadinessGatePanel — T1.10 implementation.
 * Shows the implementation readiness gate result with PASS/CONCERNS/FAIL status,
 * issues list, and approve-for-implementation action.
 *
 * Story T1.10 AC: 11
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores'
import { format } from 'date-fns'

type GateDecision = {
  id: string
  project_id: string
  decision: string
  rationale: string | null
  issues: Array<{
    severity: string
    description: string
    artifact_key: string | null
    section_ref: string | null
  }> | null
  created_at: number
  workflow_run_id: string | null
}

const DECISION_CONFIG = {
  pass: {
    label: 'PASS',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-500/30',
  },
  concerns: {
    label: 'CONCERNS',
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/20',
    border: 'border-yellow-500/30',
  },
  fail: {
    label: 'FAIL',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-950/20',
    border: 'border-red-500/30',
  },
} as const

const SEVERITY_CHIP: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  major: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  minor: 'bg-muted/30 text-muted-foreground border-border/30',
}

function DecisionBadge({ decision }: { decision: string }) {
  const cfg = DECISION_CONFIG[decision as keyof typeof DECISION_CONFIG]
  if (!cfg) return <span className="text-muted-foreground">{decision}</span>
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono font-semibold',
        cfg.color,
        cfg.border,
        cfg.bg
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

export function ReadinessGatePanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const queryClient = useQueryClient()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)

  const latestQuery = useQuery({
    queryKey: ['gate-decision-latest', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null
      const r = await commands.getLatestGateDecision(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as GateDecision | null
    },
    enabled: !!activeProjectId,
    refetchOnWindowFocus: true,
  })

  const historyQuery = useQuery({
    queryKey: ['gate-decisions', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return []
      const r = await commands.listGateDecisions(activeProjectId, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as GateDecision[]
    },
    enabled: !!activeProjectId && historyOpen,
  })

  const rerunMutation = useMutation({
    mutationFn: async () => {
      if (!activeProjectId) throw new Error('No project')
      const r = await commands.parseAndSaveGateResult(activeProjectId, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-decision-latest', activeProjectId] })
      queryClient.invalidateQueries({ queryKey: ['gate-decisions', activeProjectId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!activeProjectId) throw new Error('No project')
      const r = await commands.approveForImplementation(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    onSuccess: () => {
      setConfirmApprove(false)
      queryClient.invalidateQueries({ queryKey: ['scan-artifacts', activeProjectId] })
    },
  })

  if (!activeProjectId) return null

  const gate = latestQuery.data

  return (
    <div data-testid="readiness-gate-panel" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Implementation Readiness</h3>
        <button
          onClick={() => rerunMutation.mutate()}
          disabled={rerunMutation.isPending}
          className="flex items-center gap-1.5 rounded border border-border/40 bg-card/30 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', rerunMutation.isPending && 'animate-spin')} />
          Re-run Gate
        </button>
      </div>

      {/* Empty state */}
      {!latestQuery.isLoading && !gate && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border/30 bg-card/20 py-8 px-4 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No readiness check results yet.</p>
          <p className="text-xs text-muted-foreground/60">
            Run the Implementation Readiness workflow first.
          </p>
        </div>
      )}

      {/* Gate result */}
      {gate && (() => {
        const cfg = DECISION_CONFIG[gate.decision as keyof typeof DECISION_CONFIG]
        const Icon = cfg?.icon ?? AlertTriangle
        return (
          <div className={cn('rounded-md border p-4', cfg?.bg, cfg?.border)}>
            {/* Status header */}
            <div className="flex items-center gap-3 mb-3">
              <Icon className={cn('h-8 w-8', cfg?.color)} />
              <div>
                <p className={cn('text-lg font-bold font-mono tracking-wider', cfg?.color)}>
                  {cfg?.label ?? gate.decision.toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(gate.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>

            {/* Rationale */}
            {gate.rationale && (
              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{gate.rationale}</p>
            )}

            {/* Issues */}
            {gate.issues && gate.issues.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
                  Issues ({gate.issues.length})
                </p>
                {gate.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase',
                        SEVERITY_CHIP[issue.severity] ?? SEVERITY_CHIP.minor
                      )}
                    >
                      {issue.severity}
                    </span>
                    <p className="text-xs text-foreground/80">{issue.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Approve for implementation (PASS only) */}
            {gate.decision === 'pass' && (
              <div className="mt-4 pt-3 border-t border-emerald-500/20">
                {!confirmApprove ? (
                  <button
                    onClick={() => setConfirmApprove(true)}
                    className="flex w-full items-center justify-center gap-2 rounded border border-emerald-500/40 bg-emerald-950/40 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950/60 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Approve for Implementation
                  </button>
                ) : (
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/30 p-3">
                    <p className="text-xs text-emerald-400/80 mb-3">
                      This will mark all artifacts as "approved". Continue?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveMutation.mutate()}
                        disabled={approveMutation.isPending}
                        className="flex-1 rounded bg-emerald-600/30 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/50 transition-colors disabled:opacity-50"
                      >
                        {approveMutation.isPending ? 'Approving...' : 'Confirm Approve'}
                      </button>
                      <button
                        onClick={() => setConfirmApprove(false)}
                        className="flex-1 rounded border border-border/40 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* History section */}
      <div className="rounded-md border border-border/30">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">History</span>
          {historyOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        {historyOpen && (
          <div className="border-t border-border/30 px-3 pb-2">
            {historyQuery.isLoading && (
              <p className="py-3 text-center text-xs text-muted-foreground">Loading...</p>
            )}
            {historyQuery.data && historyQuery.data.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">No history yet</p>
            )}
            {historyQuery.data?.map((gd) => (
              <div
                key={gd.id}
                className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0"
              >
                <span className="text-xs text-muted-foreground">
                  {format(new Date(gd.created_at), 'MMM d h:mm a')}
                </span>
                <DecisionBadge decision={gd.decision} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
