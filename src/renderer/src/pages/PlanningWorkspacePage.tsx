import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Compass,
  FileCode2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore, type PlanningPhase } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  BMAD_PHASES,
  getWorkflowsForPhase,
  type BmadWorkflowDefinition
} from '@renderer/constants/planning-workspace'
import { PhaseProgressDashboard } from '@renderer/components/planning/PhaseProgressDashboard'
import { ArtifactViewer } from '@renderer/components/planning/ArtifactViewer'
import { WorkflowRunPanel } from '@renderer/components/planning/WorkflowRunPanel'
import { ReadinessGatePanel } from '@renderer/components/planning/ReadinessGatePanel'
import { AgentPersonaIndicator } from '@renderer/components/planning/AgentPersonaIndicator'

/**
 * Full-screen BMAD Planning Workspace page.
 *
 * Story 9.1: Planning Workspace Route & Navigation
 *
 * Provides a dedicated environment for BMAD planning phases:
 * - Phase tabs (Analysis, Planning, Solutioning)
 * - Workflow sidebar listing available workflows per phase
 * - Center content area (placeholder for Story 9.2)
 * - Escape key / back button navigation to board
 */
export function PlanningWorkspacePage() {
  const {
    isOpen,
    activePhase,
    selectedWorkflowKey,
    closeWorkspace,
    setActivePhase,
    setSelectedWorkflow
  } = usePlanningWorkspaceStore()
  const projectName = useProjectStore((state) => state.projectName)
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''
  const { data: artifacts } = trpc.planning.scanArtifacts.useQuery(
    { projectId },
    { enabled: !!projectId, refetchOnWindowFocus: true, placeholderData: (prev) => prev }
  )
  // Story 9.8: Query active workflow run for agent persona indicator
  const { data: activeRun } = trpc.planning.getActiveWorkflowRun.useQuery(
    { projectId },
    { enabled: !!projectId, refetchInterval: 3000 }
  )

  const workspaceRef = useRef<HTMLDivElement>(null)

  const workflows = useMemo(() => getWorkflowsForPhase(activePhase), [activePhase])

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.key === selectedWorkflowKey) ?? null,
    [workflows, selectedWorkflowKey]
  )

  // Check if selected workflow's artifact file exists
  const artifactExists = useMemo(() => {
    if (!selectedWorkflow || !artifacts) return false
    const artifact = artifacts.find((a) => a.workflowKey === selectedWorkflow.key)
    return artifact?.exists ?? false
  }, [selectedWorkflow, artifacts])

  // Story 9.6: Detect readiness-check workflow selection
  const isReadinessCheck = selectedWorkflowKey === 'readiness-check'

  // Story 9.6: Auto-parse gate result when readiness-check artifact is viewed
  const { data: latestGate, isLoading: isGateLoading } = trpc.planning.getLatestGateDecision.useQuery(
    { projectId },
    { enabled: !!projectId && isReadinessCheck && artifactExists }
  )
  const trpcUtils = trpc.useUtils()
  const parseGateMutation = trpc.planning.parseAndSaveGateResult.useMutation({
    onSuccess: () => {
      trpcUtils.planning.getLatestGateDecision.invalidate()
    }
  })
  const parseGate = parseGateMutation.mutate
  const [autoParseTriggered, setAutoParseTriggered] = useState(false)

  // Get artifact lastModified for comparison
  const readinessArtifactLastModified = useMemo(() => {
    if (!artifacts) return null
    const artifact = artifacts.find((a) => a.workflowKey === 'readiness-check')
    return artifact?.lastModified ?? null
  }, [artifacts])

  useEffect(() => {
    if (
      !isReadinessCheck ||
      !artifactExists ||
      !projectId ||
      autoParseTriggered ||
      parseGateMutation.isPending ||
      isGateLoading // wait for query to resolve before deciding whether to auto-parse
    ) return

    // Auto-parse if no gate decision exists, or if artifact is newer than last decision
    const shouldParse =
      latestGate === null ||
      (readinessArtifactLastModified && latestGate.created_at &&
        readinessArtifactLastModified > (
          typeof latestGate.created_at === 'number'
            ? latestGate.created_at * 1000
            : new Date(latestGate.created_at as string | Date).getTime()
        ))

    if (shouldParse) {
      setAutoParseTriggered(true)
      parseGate({ projectId })
    }
  }, [isReadinessCheck, artifactExists, projectId, latestGate, readinessArtifactLastModified, autoParseTriggered, parseGateMutation.isPending, isGateLoading, parseGate])

  // Reset auto-parse trigger when workflow changes
  useEffect(() => {
    setAutoParseTriggered(false)
  }, [selectedWorkflowKey])

  // Handle back navigation
  const handleBack = useCallback(() => {
    closeWorkspace()
  }, [closeWorkspace])

  // Escape key handler — navigate back when not in an input/editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement
        const isInEditor =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.closest('[contenteditable="true"]') ||
          activeElement?.closest('.monaco-editor')

        if (!isInEditor) {
          e.preventDefault()
          handleBack()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleBack])

  // Lock body scroll when workspace is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Focus trap — prevent tabbing out of workspace
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = workspace.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    workspace.addEventListener('keydown', handleKeyDown)
    return () => workspace.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isOpen) return null

  return (
    <div
      ref={workspaceRef}
      className="fixed inset-0 z-50 flex h-screen flex-col bg-background"
    >
      {/* Decorative gradient overlay for visual depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cyan-500/[0.02] via-transparent to-transparent" />

      <div className="relative flex h-full flex-col">
        {/* ── Header bar ── */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          {/* Left: back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Board
          </Button>

          {/* Center: project + workspace label */}
          <div className="flex items-center gap-2.5">
            <Compass className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium text-foreground">
              {projectName ?? 'Project'}
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">
              Planning Workspace
            </span>
          </div>

          {/* Right: agent persona indicator (Story 9.8) */}
          <AgentPersonaIndicator
            agentName={activeRun?.agent_name ?? null}
            workflowKey={activeRun?.workflow_key ?? null}
            isRunning={activeRun?.status === 'running' || activeRun?.status === 'needs-input'}
          />
        </header>

        {/* ── Phase tabs ── */}
        <div className="shrink-0 border-b border-border px-4 py-2">
          <Tabs
            value={activePhase}
            onValueChange={(v) => setActivePhase(v as PlanningPhase)}
          >
            <TabsList className="h-9 gap-1 bg-muted/50">
              {BMAD_PHASES.map((phase) => (
                <TabsTrigger
                  key={phase.key}
                  value={phase.key}
                  className="px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {phase.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* ── Content area: sidebar + center ── */}
        <div className="flex min-h-0 flex-1">
          {/* Workflow sidebar */}
          <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/50">
            <div className="px-4 pb-2 pt-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Workflows
              </h2>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {workflows.map((wf) => (
                <WorkflowCard
                  key={wf.key}
                  workflow={wf}
                  isSelected={selectedWorkflowKey === wf.key}
                  onSelect={() => setSelectedWorkflow(wf.key)}
                />
              ))}
            </nav>
          </aside>

          {/* Center content */}
          <main className="flex flex-1 flex-col">
            {/* Story 9.5: Active workflow run banner — always top-aligned */}
            <WorkflowRunPanel />

            <div className={cn(
              "flex min-h-0 flex-1",
              selectedWorkflow && !artifactExists && !isReadinessCheck && "items-center justify-center p-8"
            )}>
              {!selectedWorkflow ? (
                <PhaseProgressDashboard />
              ) : isReadinessCheck && artifactExists ? (
                /* Story 9.6: ReadinessGatePanel above ArtifactViewer for readiness-check */
                <div className="h-full overflow-y-auto">
                  <div className="space-y-4 p-6">
                    <ReadinessGatePanel />
                    <ArtifactViewer workflowKey={selectedWorkflow.key} />
                  </div>
                </div>
              ) : isReadinessCheck && !artifactExists ? (
                /* Story 9.6: ReadinessGatePanel empty state for readiness-check */
                <div className="flex h-full items-center justify-center p-8">
                  <ReadinessGatePanel />
                </div>
              ) : artifactExists ? (
                <ArtifactViewer workflowKey={selectedWorkflow.key} />
              ) : (
                <SelectedWorkflowPlaceholder workflow={selectedWorkflow} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

/* ── Workflow sidebar card ── */

function WorkflowCard({
  workflow,
  isSelected,
  onSelect
}: {
  workflow: BmadWorkflowDefinition
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-accent/60',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isSelected && 'bg-accent ring-1 ring-cyan-500/40'
      )}
    >
      <div className="text-sm font-medium text-foreground">{workflow.name}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {workflow.purpose}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/60">
        <FileCode2 className="h-3 w-3" />
        <span className="font-mono">{workflow.outputFilename}</span>
      </div>
    </button>
  )
}

/* ── Selected workflow placeholder (future stories replace this) ── */

function SelectedWorkflowPlaceholder({
  workflow
}: {
  workflow: BmadWorkflowDefinition
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
        <FileCode2 className="h-5 w-5 text-cyan-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{workflow.name}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {workflow.purpose}
        </p>
        <p className="mt-3 text-[11px] text-muted-foreground/50">
          Workflow content coming in a future update
        </p>
      </div>
    </div>
  )
}
