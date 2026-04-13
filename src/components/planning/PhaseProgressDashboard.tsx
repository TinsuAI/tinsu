/**
 * PhaseProgressDashboard — T1.10 implementation.
 * Shows all BMAD planning artifacts grouped by phase with status badges and health checklist.
 *
 * Story T1.10 AC: 8
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, MapPin } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore, usePlanningWorkspaceStore } from '@renderer/stores'
import {
  BMAD_PHASES,
  BMAD_WORKFLOWS,
} from '@renderer/constants/planning-workspace'
import { WhatNextPanel } from './WhatNextPanel'

type ArtifactStatus = 'approved' | 'draft' | 'in-review' | 'missing'

const STATUS_BADGE: Record<ArtifactStatus, { label: string; className: string }> = {
  approved: {
    label: '✓',
    className: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
  },
  draft: {
    label: 'Draft',
    className: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
  },
  'in-review': {
    label: 'In Review',
    className: 'text-blue-400 border-blue-500/30 bg-blue-950/20',
  },
  missing: {
    label: 'Missing',
    className: 'text-muted-foreground/40 border-border/20 bg-transparent',
  },
}

// Health checklist items: key → label, optional flag
const HEALTH_ITEMS: Array<{ key: string; label: string; optional?: boolean }> = [
  { key: 'product-brief', label: 'Product Brief' },
  { key: 'prd', label: 'PRD' },
  { key: 'ux-design', label: 'UX Spec', optional: true },
  { key: 'architecture', label: 'Architecture' },
  { key: 'epics-stories', label: 'Epics & Stories' },
  { key: 'readiness-check', label: 'Readiness Gate' },
]

export function PhaseProgressDashboard() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)
  const queryClient = useQueryClient()

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['scan-artifacts', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return []
      const r = await commands.scanArtifacts(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!activeProjectId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const statusMutation = useMutation({
    mutationFn: async ({ artifactKey, status }: { artifactKey: string; status: string }) => {
      if (!activeProjectId) throw new Error('No project')
      const r = await commands.updateArtifactStatus(activeProjectId, artifactKey, status)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-artifacts', activeProjectId] })
    },
  })

  if (!activeProjectId) return null

  // Build lookup map
  const artifactMap = new Map<string, ArtifactStatus>()
  for (const a of artifacts ?? []) {
    artifactMap.set(a.workflow_key, a.status as ArtifactStatus)
  }

  const allMissing =
    !isLoading && (artifacts?.every((a) => !a.exists) ?? true)

  return (
    <div data-testid="phase-progress-dashboard" className="flex flex-col gap-6">
      {/* WhatNext panel at top */}
      <WhatNextPanel />

      {/* Empty state */}
      {allMissing && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-border/30 bg-card/20 py-8 px-4 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No artifacts yet. Start with brainstorming or create a product brief.
          </p>
          <button
            onClick={() => setSelectedWorkflow('product-brief')}
            className="mt-1 rounded border border-cyan-500/30 bg-cyan-950/20 px-4 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-950/40 transition-colors"
          >
            Start Planning
          </button>
        </div>
      )}

      {/* Phase cards */}
      {!allMissing && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {BMAD_PHASES.map((phase) => {
            const phaseWorkflows = BMAD_WORKFLOWS.filter((w) => w.phase === phase.key)
            const completed = phaseWorkflows.filter(
              (w) => artifactMap.get(w.key) === 'approved'
            ).length

            return (
              <div
                key={phase.key}
                className="rounded-md border border-border/40 bg-card/20"
              >
                {/* Phase header */}
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{phase.label}</p>
                    <p className="text-[11px] text-muted-foreground/60">{phase.description}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {completed}/{phaseWorkflows.length}
                  </span>
                </div>

                {/* Workflow list */}
                <div className="p-3 space-y-1.5">
                  {isLoading
                    ? [...Array(phaseWorkflows.length)].map((_, i) => (
                        <div key={i} className="h-8 animate-pulse rounded bg-muted/30" />
                      ))
                    : phaseWorkflows.map((workflow) => {
                        const status: ArtifactStatus =
                          artifactMap.get(workflow.key) ?? 'missing'
                        const badge = STATUS_BADGE[status]
                        return (
                          <div
                            key={workflow.key}
                            className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted/10 transition-colors group"
                          >
                            <span className="text-xs text-foreground/80">{workflow.name}</span>
                            {status !== 'missing' ? (
                              <button
                                onClick={() =>
                                  statusMutation.mutate({
                                    artifactKey: workflow.key,
                                    status: 'approved',
                                  })
                                }
                                disabled={status === 'approved' || statusMutation.isPending}
                                className={cn(
                                  'rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                                  badge.className,
                                  status !== 'approved' &&
                                    'hover:border-emerald-500/40 hover:bg-emerald-950/20 hover:text-emerald-400 cursor-pointer',
                                  'disabled:cursor-default'
                                )}
                                title={status !== 'approved' ? 'Click to mark approved' : undefined}
                              >
                                {badge.label}
                              </button>
                            ) : (
                              <span className={cn('rounded border px-1.5 py-0.5 text-[10px]', badge.className)}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Project Health checklist */}
      {!allMissing && !isLoading && (
        <div className="rounded-md border border-border/40 bg-card/20">
          <div className="border-b border-border/30 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Project Health</p>
          </div>
          <div className="grid grid-cols-2 gap-0 p-2 sm:grid-cols-3">
            {HEALTH_ITEMS.map((item) => {
              const exists = artifactMap.get(item.key) !== 'missing' &&
                artifactMap.get(item.key) !== undefined &&
                (artifacts?.find((a) => a.workflow_key === item.key)?.exists ?? false)
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 rounded px-2 py-1.5"
                >
                  {exists ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                  )}
                  <span
                    className={cn(
                      'text-xs',
                      exists ? 'text-foreground/80' : 'text-muted-foreground/50'
                    )}
                  >
                    {item.label}
                    {item.optional && (
                      <span className="ml-1 text-[10px] text-muted-foreground/40">(opt)</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
