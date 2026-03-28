import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { Group, Panel, Separator, usePanelRef, type Layout } from 'react-resizable-panels'
import {
  ArrowLeft,
  Compass,
  FileCode2,
  Keyboard,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore, type PlanningPhase } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  BMAD_PHASES,
  BMAD_WORKFLOWS,
  getWorkflowsForPhase,
  type BmadWorkflowDefinition
} from '@renderer/constants/planning-workspace'
import { PhaseProgressDashboard } from '@renderer/components/planning/PhaseProgressDashboard'
import { ArtifactViewer } from '@renderer/components/planning/ArtifactViewer'
import { SessionDocumentsBar } from '@renderer/components/planning/SessionDocumentsBar'
import { WorkflowRunPanel } from '@renderer/components/planning/WorkflowRunPanel'
import { ReadinessGatePanel } from '@renderer/components/planning/ReadinessGatePanel'
import { AgentPersonaIndicator } from '@renderer/components/planning/AgentPersonaIndicator'
import { KeyboardShortcutsOverlay } from '@renderer/components/planning/KeyboardShortcutsOverlay'
import { ChatPanel } from '@renderer/components/planning/ChatPanel'
import { ChatTerminal } from '@renderer/components/planning/ChatTerminal'
import { usePlanningKeyboardShortcuts } from '@renderer/hooks/usePlanningKeyboardShortcuts'

// localStorage key for planning workspace layout persistence
const PLANNING_LAYOUT_STORAGE_KEY = 'tinsu-planning-workspace-layout'

// Default panel sizes
const DEFAULT_LAYOUT: Layout = { sidebar: 20, chat: 45, content: 35 }

function loadSavedPlanningLayout(): Layout {
  try {
    const saved = localStorage.getItem(PLANNING_LAYOUT_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_LAYOUT
}

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
    showDashboard,
    closeWorkspace,
    setActivePhase,
    setSelectedWorkflow,
    setShowDashboard,
    setPendingChatPrefill,
    activeChatSessionId,
    showTerminal,
    setShowTerminal
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
  // Active document path for session documents bar
  const [activeDocPath, setActiveDocPath] = useState<string | null>(null)

  // Clear doc viewer when workflow selection changes (user clicked a sidebar step)
  useEffect(() => {
    if (selectedWorkflowKey) setActiveDocPath(null)
  }, [selectedWorkflowKey])

  // Clear doc viewer when navigating to dashboard or switching phase
  useEffect(() => {
    if (showDashboard) setActiveDocPath(null)
  }, [showDashboard])

  useEffect(() => {
    setActiveDocPath(null)
  }, [activePhase])

  // Story 9.9: Keyboard shortcuts help overlay state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  // Story 9.9: Live region announcement text (phase transitions + artifact status changes)
  const [phaseAnnouncement, setPhaseAnnouncement] = useState('')
  // Ref to skip the initial mount announcement (no user action occurred)
  const isInitialPhaseMount = useRef(true)

  // Story 9.9: Announce phase transitions (skip on initial mount)
  useEffect(() => {
    if (isInitialPhaseMount.current) {
      isInitialPhaseMount.current = false
      return
    }
    const label = BMAD_PHASES.find((p) => p.key === activePhase)?.label ?? activePhase
    setPhaseAnnouncement(`Switched to ${label} phase`)
    const timer = setTimeout(() => setPhaseAnnouncement(''), 1000)
    return () => clearTimeout(timer)
  }, [activePhase])

  // Story 9.9: Announce artifact status when a workflow with an artifact is selected (AC7/Task 5.8)
  useEffect(() => {
    if (!selectedWorkflowKey || !artifacts) return
    const artifact = artifacts.find((a) => a.workflowKey === selectedWorkflowKey)
    if (!artifact?.status) return
    const workflow = BMAD_WORKFLOWS.find((w) => w.key === selectedWorkflowKey)
    const name = workflow?.name ?? selectedWorkflowKey
    setPhaseAnnouncement(`${name} - ${artifact.status}`)
    const timer = setTimeout(() => setPhaseAnnouncement(''), 1000)
    return () => clearTimeout(timer)
  }, [selectedWorkflowKey, artifacts])

  // Story 9.9: Keyboard shortcuts hook
  usePlanningKeyboardShortcuts(workspaceRef, {
    onPhaseChange: (phase) => setActivePhase(phase),
    onFocusWhatNext: () => {
      setShowDashboard(true)
      requestAnimationFrame(() => {
        const el = workspaceRef.current?.querySelector<HTMLElement>(
          '[data-testid="what-next-section"]'
        )
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus()
      })
    },
    onFocusRecentRuns: () => {
      setShowDashboard(true)
      requestAnimationFrame(() => {
        const el = workspaceRef.current?.querySelector<HTMLElement>(
          '[data-testid="recent-runs-section"]'
        )
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus()
      })
    },
    onFocusReadinessGate: () => {
      setActivePhase('solutioning')
      setSelectedWorkflow('readiness-check')
    },
    onToggleHelp: () => setShowShortcutsHelp((prev) => !prev)
  })

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
  const { data: latestGate, isLoading: isGateLoading } =
    trpc.planning.getLatestGateDecision.useQuery(
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
    )
      return

    // Auto-parse if no gate decision exists, or if artifact is newer than last decision
    const shouldParse =
      latestGate == null ||
      (readinessArtifactLastModified &&
        latestGate.created_at &&
        readinessArtifactLastModified >
          (typeof latestGate.created_at === 'number'
            ? latestGate.created_at * 1000
            : new Date(latestGate.created_at as string | Date).getTime()))

    if (shouldParse) {
      setAutoParseTriggered(true)
      parseGate({ projectId })
    }
  }, [
    isReadinessCheck,
    artifactExists,
    projectId,
    latestGate,
    readinessArtifactLastModified,
    autoParseTriggered,
    parseGateMutation.isPending,
    isGateLoading,
    parseGate
  ])

  // Reset auto-parse trigger when workflow changes
  useEffect(() => {
    setAutoParseTriggered(false)
  }, [selectedWorkflowKey])

  // Panel refs for collapse/expand
  const sidebarPanelRef = usePanelRef()
  const chatPanelRef = usePanelRef()
  const contentPanelRef = usePanelRef()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [contentCollapsed, setContentCollapsed] = useState(false)

  // Layout persistence for resizable panels
  const savedLayout = useMemo(() => loadSavedPlanningLayout(), [])
  const handleLayoutChanged = useCallback((layout: Layout) => {
    try {
      localStorage.setItem(PLANNING_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Handle workflow selection — set selected workflow + prefill chat input with command
  const handleWorkflowSelect = useCallback(
    (wf: BmadWorkflowDefinition) => {
      if (wf.key === selectedWorkflowKey) return
      setSelectedWorkflow(wf.key)
      setPendingChatPrefill(wf.command, wf.persona)
    },
    [selectedWorkflowKey, setSelectedWorkflow, setPendingChatPrefill]
  )

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
      role="region"
      aria-label="Planning workspace"
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
            <span className="text-sm font-medium text-foreground">{projectName ?? 'Project'}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">Planning Workspace</span>
          </div>

          {/* Right: panel toggles + shortcuts button + agent persona indicator */}
          <div className="flex items-center gap-2">
            {/* Panel toggle buttons */}
            <div className="flex items-center gap-0.5 border-r border-border/30 pr-2 mr-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 w-7 p-0',
                        !sidebarCollapsed && 'bg-accent/30 text-foreground'
                      )}
                      onClick={() =>
                        sidebarCollapsed
                          ? sidebarPanelRef.current?.expand()
                          : sidebarPanelRef.current?.collapse()
                      }
                      aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                      data-testid="toggle-sidebar-panel"
                    >
                      {sidebarCollapsed ? (
                        <PanelLeftOpen className="h-3.5 w-3.5" />
                      ) : (
                        <PanelLeftClose className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 w-7 p-0',
                        !chatCollapsed && 'bg-cyan-500/10 text-cyan-400'
                      )}
                      onClick={() =>
                        chatCollapsed
                          ? chatPanelRef.current?.expand()
                          : chatPanelRef.current?.collapse()
                      }
                      aria-label={chatCollapsed ? 'Show chat' : 'Hide chat'}
                      data-testid="toggle-chat-panel"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {chatCollapsed ? 'Show chat' : 'Hide chat'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 w-7 p-0',
                        !contentCollapsed && 'bg-accent/30 text-foreground'
                      )}
                      onClick={() =>
                        contentCollapsed
                          ? contentPanelRef.current?.expand()
                          : contentPanelRef.current?.collapse()
                      }
                      aria-label={contentCollapsed ? 'Show content' : 'Hide content'}
                      data-testid="toggle-content-panel"
                    >
                      {contentCollapsed ? (
                        <PanelRightOpen className="h-3.5 w-3.5" />
                      ) : (
                        <PanelRightClose className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {contentCollapsed ? 'Show content' : 'Hide content'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowShortcutsHelp(true)}
                    data-testid="keyboard-shortcuts-button"
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Keyboard shortcuts (?)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AgentPersonaIndicator
              agentName={activeRun?.agent_name ?? null}
              workflowKey={activeRun?.workflow_key ?? null}
              isRunning={activeRun?.status === 'running' || activeRun?.status === 'needs-input'}
            />
          </div>
        </header>

        {/* ── Phase tabs + Dashboard button ── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setShowDashboard(true)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
              showDashboard
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
            data-testid="dashboard-button"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <div className="h-5 w-px bg-border/40" />
          <Tabs value={showDashboard ? '' : activePhase} onValueChange={(v) => {
            if (v) setActivePhase(v as PlanningPhase)
          }}>
            <TabsList aria-label="Phase navigation" className="h-9 gap-1 bg-muted/50">
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

        {/* ── Content area: Sidebar | Chat | Content — resizable panels ── */}
        <div className="min-h-0 flex-1">
          <Group
            orientation="horizontal"
            defaultLayout={savedLayout}
            onLayoutChanged={handleLayoutChanged}
          >
            {/* Sidebar panel */}
            <Panel
              id="sidebar"
              defaultSize={20}
              minSize={10}
              collapsible
              panelRef={sidebarPanelRef}
              onResize={() => setSidebarCollapsed(sidebarPanelRef.current?.isCollapsed() ?? false)}
            >
              <aside
                aria-label="Workflow list"
                role="navigation"
                className="flex h-full flex-col bg-card/50"
              >
                <div className="flex items-center justify-between px-4 pb-2 pt-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Workflows
                  </h2>
                  <PanelCollapseButton panelRef={sidebarPanelRef} side="left" label="sidebar" />
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
                  {workflows.map((wf) => (
                    <WorkflowCard
                      key={wf.key}
                      workflow={wf}
                      isSelected={selectedWorkflowKey === wf.key}
                      onSelect={() => handleWorkflowSelect(wf)}
                    />
                  ))}
                </nav>
              </aside>
            </Panel>

            <Separator
              className={cn(
                'mx-1 w-1',
                'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
                'cursor-col-resize transition-colors duration-150 rounded-full'
              )}
            />

            {/* Chat panel (center, always visible) */}
            <Panel
              id="chat"
              defaultSize={45}
              minSize={10}
              collapsible
              panelRef={chatPanelRef}
              onResize={() => setChatCollapsed(chatPanelRef.current?.isCollapsed() ?? false)}
            >
              <ChatPanel onCollapse={() => chatPanelRef.current?.collapse()} />
            </Panel>

            {/* Terminal panel (only when open) */}
            {showTerminal && activeChatSessionId && (
              <>
                <Separator
                  className={cn(
                    'mx-1 w-1',
                    'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
                    'cursor-col-resize transition-colors duration-150 rounded-full'
                  )}
                />
                <Panel
                  id="terminal"
                  defaultSize={20}
                  minSize={10}
                  collapsible
                >
                  <div className="flex h-full flex-col bg-card/20">
                    <ChatTerminal
                      sessionId={activeChatSessionId}
                      onClose={() => setShowTerminal(false)}
                    />
                  </div>
                </Panel>
              </>
            )}

            <Separator
              className={cn(
                'mx-1 w-1',
                'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
                'cursor-col-resize transition-colors duration-150 rounded-full'
              )}
            />

            {/* Content panel (right) */}
            <Panel
              id="content"
              defaultSize={35}
              minSize={10}
              collapsible
              panelRef={contentPanelRef}
              onResize={() => setContentCollapsed(contentPanelRef.current?.isCollapsed() ?? false)}
            >
              <main aria-label="Workspace content" className="flex h-full flex-col">
                {/* Content panel header with collapse button */}
                <div className="flex h-8 shrink-0 items-center justify-end border-b border-border/30 px-2">
                  <PanelCollapseButton panelRef={contentPanelRef} side="right" label="content" />
                </div>
                {/* Story 9.5: Active workflow run banner — always top-aligned */}
                <WorkflowRunPanel />

                {/* Session documents bar — shows all docs from active chat session */}
                {activeChatSessionId && (
                  <SessionDocumentsBar
                    sessionId={activeChatSessionId}
                    activeDocPath={activeDocPath}
                    onSelectDoc={(filePath) => {
                      setActiveDocPath(filePath)
                    }}
                  />
                )}

                <div
                  className={cn(
                    'flex min-h-0 flex-1',
                    !activeDocPath && selectedWorkflow &&
                      !showDashboard &&
                      !artifactExists &&
                      !isReadinessCheck &&
                      'items-center justify-center p-8'
                  )}
                >
                  {activeDocPath ? (
                    <ArtifactViewer
                      workflowKey=""
                      filePath={activeDocPath}
                      onCloseFile={() => setActiveDocPath(null)}
                    />
                  ) : showDashboard || !selectedWorkflow ? (
                    <PhaseProgressDashboard />
                  ) : isReadinessCheck && artifactExists ? (
                    <div className="h-full overflow-y-auto">
                      <div className="space-y-4 p-6">
                        <ReadinessGatePanel />
                        <ArtifactViewer workflowKey={selectedWorkflow.key} />
                      </div>
                    </div>
                  ) : isReadinessCheck && !artifactExists ? (
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
            </Panel>
          </Group>
        </div>
      </div>

      {/* Story 9.9: Live region for phase transition announcements */}
      <div role="status" aria-live="polite" className="sr-only" data-testid="phase-announcer">
        {phaseAnnouncement}
      </div>

      {/* Story 9.9: Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
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
        'flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-accent/60',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isSelected && 'bg-accent ring-1 ring-cyan-500/40'
      )}
    >
      {/* Step number badge */}
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
          isSelected
            ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40'
            : 'bg-muted/50 text-muted-foreground/60'
        )}
      >
        {workflow.stepNumber}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{workflow.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{workflow.purpose}</div>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/60">
          <FileCode2 className="h-3 w-3" />
          <span className="font-mono">{workflow.outputFilename}</span>
        </div>
      </div>
    </button>
  )
}

/* ── Panel collapse button — sits inside each panel's header ── */

function PanelCollapseButton({
  panelRef,
  side,
  label
}: {
  panelRef: React.RefObject<{ collapse: () => void } | null>
  side: 'left' | 'right'
  label: string
}) {
  const Icon = side === 'left' ? PanelLeftClose : PanelRightClose

  return (
    <button
      type="button"
      onClick={() => panelRef.current?.collapse()}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded',
        'text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40',
        'transition-colors'
      )}
      aria-label={`Collapse ${label} panel`}
      data-testid={`collapse-${label}-panel`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

/* ── Selected workflow placeholder (future stories replace this) ── */

function SelectedWorkflowPlaceholder({ workflow }: { workflow: BmadWorkflowDefinition }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
        <FileCode2 className="h-5 w-5 text-cyan-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{workflow.name}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{workflow.purpose}</p>
        <p className="mt-3 text-[11px] text-muted-foreground/50">
          Workflow content coming in a future update
        </p>
      </div>
    </div>
  )
}
