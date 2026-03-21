import { useMemo, useCallback } from 'react'
import {
  Check,
  Circle,
  FileText,
  Sparkles,
  Shield,
  AlertTriangle,
  ChevronRight
} from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import {
  BMAD_PHASES,
  BMAD_WORKFLOWS,
  type BmadWorkflowDefinition
} from '@renderer/constants/planning-workspace'

/**
 * Artifact scan result from the planning.scanArtifacts tRPC query.
 */
interface ArtifactScanResult {
  workflowKey: string
  filename: string
  exists: boolean
  lastModified: number | null
  sizeBytes: number | null
  status: 'draft' | 'approved' | 'missing'
}

/**
 * Health checklist item definition.
 */
const HEALTH_ITEMS: Array<{
  label: string
  workflowKey: string
  optional?: boolean
}> = [
  { label: 'Product Brief', workflowKey: 'product-brief' },
  { label: 'PRD', workflowKey: 'prd' },
  { label: 'UX Spec', workflowKey: 'ux-design', optional: true },
  { label: 'Architecture', workflowKey: 'architecture' },
  { label: 'Epics & Stories', workflowKey: 'epics-stories' },
  { label: 'Readiness Gate', workflowKey: 'readiness-check' }
]

/**
 * Phase Progress Dashboard — Story 9.2
 *
 * Shows progress across all 3 BMAD planning phases at a glance,
 * with a project health checklist and per-workflow artifact status badges.
 */
export function PhaseProgressDashboard() {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const { data: artifacts, refetch, isError } = trpc.planning.scanArtifacts.useQuery(
    { projectId },
    { enabled: !!projectId, refetchOnWindowFocus: true }
  )

  const updateStatus = trpc.planning.updateArtifactStatus.useMutation({
    onSuccess: () => refetch()
  })

  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)

  // Build a lookup map from workflowKey → scan result
  const artifactMap = useMemo(() => {
    const map = new Map<string, ArtifactScanResult>()
    if (artifacts) {
      for (const a of artifacts) {
        map.set(a.workflowKey, a)
      }
    }
    return map
  }, [artifacts])

  // Determine if ALL artifacts are missing (empty state)
  const allMissing = useMemo(() => {
    if (!artifacts || artifacts.length === 0) return true
    return artifacts.every((a) => !a.exists)
  }, [artifacts])

  const handleToggleStatus = useCallback(
    (workflowKey: string, currentStatus: 'draft' | 'approved' | 'missing') => {
      if (currentStatus === 'missing' || !projectId) return
      const newStatus = currentStatus === 'draft' ? 'approved' : 'draft'
      updateStatus.mutate({ projectId, artifactKey: workflowKey, status: newStatus })
    },
    [projectId, updateStatus]
  )

  // Error state
  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Unable to scan artifacts. Check project settings.</span>
        </div>
      </div>
    )
  }

  // Loading state
  if (!project || !artifacts) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-cyan-500" />
          <span className="text-xs text-muted-foreground">Scanning artifacts...</span>
        </div>
      </div>
    )
  }

  // Empty state — new project with no artifacts
  if (allMissing) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-cyan-500/5 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 ring-1 ring-cyan-500/20">
              <Sparkles className="h-7 w-7 text-cyan-500" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              No artifacts yet. Start with brainstorming or create a product brief.
            </p>
          </div>
          <Button
            onClick={() => setSelectedWorkflow('product-brief')}
            className="gap-2 bg-cyan-600 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start Planning
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Calculate health score
  const healthCount = HEALTH_ITEMS.filter((item) => {
    const a = artifactMap.get(item.workflowKey)
    return a?.exists
  }).length
  const requiredCount = HEALTH_ITEMS.filter((i) => !i.optional).length
  const requiredDone = HEALTH_ITEMS.filter((i) => !i.optional && artifactMap.get(i.workflowKey)?.exists).length

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* ── Project Health Panel ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-cyan-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Project Health
            </h2>
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {healthCount}/{HEALTH_ITEMS.length} artifacts
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4">
            {/* Progress bar */}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  requiredDone === requiredCount
                    ? 'bg-emerald-500'
                    : requiredDone > 0
                      ? 'bg-cyan-500'
                      : 'bg-muted-foreground/20'
                )}
                style={{ width: `${(healthCount / HEALTH_ITEMS.length) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {HEALTH_ITEMS.map((item) => {
                const artifact = artifactMap.get(item.workflowKey)
                const exists = artifact?.exists ?? false

                return (
                  <div
                    key={item.workflowKey}
                    className="flex items-center gap-2"
                  >
                    {exists ? (
                      <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </div>
                    ) : (
                      <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                      </div>
                    )}
                    <span
                      className={cn(
                        'text-xs',
                        exists ? 'text-foreground' : 'text-muted-foreground/60'
                      )}
                    >
                      {item.label}
                      {item.optional && (
                        <span className="ml-1 text-[10px] text-muted-foreground/40">(optional)</span>
                      )}
                    </span>
                    {!exists && (
                      <Badge
                        variant="outline"
                        className="ml-auto border-border bg-muted/50 px-1.5 py-0 text-[10px] text-muted-foreground/40"
                      >
                        Missing
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Phase Cards Grid ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Planning Phases
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {BMAD_PHASES.map((phase, phaseIndex) => {
              const phaseWorkflows = BMAD_WORKFLOWS.filter((w) => w.phase === phase.key)
              const completedInPhase = phaseWorkflows.filter(
                (w) => artifactMap.get(w.key)?.exists
              ).length

              return (
                <div
                  key={phase.key}
                  className="group rounded-xl border border-border bg-card/50 transition-colors hover:border-border/80"
                >
                  {/* Phase header */}
                  <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold tabular-nums text-muted-foreground">
                      {phaseIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground">
                        {phase.label}
                      </h3>
                      <p className="truncate text-[11px] text-muted-foreground/60">
                        {phase.description}
                      </p>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {completedInPhase}/{phaseWorkflows.length}
                    </span>
                  </div>

                  {/* Workflow list */}
                  <div className="divide-y divide-border/30 px-1 py-1">
                    {phaseWorkflows.map((wf) => (
                      <WorkflowRow
                        key={wf.key}
                        workflow={wf}
                        artifact={artifactMap.get(wf.key)}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── Workflow row within a phase card ── */

function WorkflowRow({
  workflow,
  artifact,
  onToggleStatus
}: {
  workflow: BmadWorkflowDefinition
  artifact: ArtifactScanResult | undefined
  onToggleStatus: (key: string, status: 'draft' | 'approved' | 'missing') => void
}) {
  const status = artifact?.status ?? 'missing'

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent/30">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground">
          {workflow.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/50">
          {workflow.outputFilename}
        </div>
      </div>

      <StatusBadge
        status={status}
        onClick={() => onToggleStatus(workflow.key, status)}
      />
    </div>
  )
}

/* ── Status badge with toggle interaction ── */

function StatusBadge({
  status,
  onClick
}: {
  status: 'draft' | 'approved' | 'missing'
  onClick: () => void
}) {
  if (status === 'missing') {
    return (
      <Badge
        variant="outline"
        className="cursor-default border-border bg-muted/50 px-2 py-0.5 text-[10px] font-normal text-muted-foreground/40"
      >
        <AlertTriangle className="mr-1 h-2.5 w-2.5" />
        Missing
      </Badge>
    )
  }

  if (status === 'approved') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
      >
        <Check className="h-2.5 w-2.5" />
        Approved
      </button>
    )
  }

  // draft
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/20"
    >
      <FileText className="h-2.5 w-2.5" />
      Draft
    </button>
  )
}
