import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '@renderer/lib/utils'
import { PhaseBadge } from '@renderer/components/task/PhaseBadge'
import { AgentStatusBadge, type AgentStatus } from '@renderer/components/ui/AgentStatusBadge'
import { Badge } from '@renderer/components/ui/badge'
import { PHASE_DESCRIPTIONS } from '@renderer/constants/planning-phases'
import { BMAD_WORKFLOWS, phaseNumberToBmadPhase, getAgentPersona } from '@renderer/constants/planning-workspace'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { CheckCircle2, FileText, Download, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { PlanningTask } from '@shared/types/task.types'

export interface PlanningTaskCardProps {
  task: PlanningTask
  /** Agent status for the status badge (defaults to 'idle') */
  agentStatus?: AgentStatus
  /** Whether this is the recommended starting point */
  isStartHere?: boolean
  /** Whether the task is completed (in Done column) */
  isCompleted?: boolean
  /** Path to the artifact file (for completed tasks) */
  artifactPath?: string | null
  /** Callback for keyboard navigation - called with direction */
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Callback when artifact file should be opened */
  onOpenArtifact?: () => void
  /** Story 3.7: Callback when Import Stories button is clicked (phase 5 only) */
  onImportStories?: () => void
  /** Callback when delete button is clicked */
  onDelete?: () => void
  className?: string
}

export function PlanningTaskCard({
  task,
  agentStatus = 'idle',
  isStartHere = false,
  isCompleted = false,
  artifactPath,
  onNavigate,
  onOpenArtifact,
  onImportStories,
  onDelete,
  className
}: PlanningTaskCardProps) {
  const handleDeleteClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onDelete?.()
    },
    [onDelete]
  )

  // Keyboard navigation handler (same pattern as TaskCard)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!onNavigate) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          onNavigate('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          onNavigate('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          onNavigate('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          onNavigate('right')
          break
      }
    },
    [onNavigate]
  )

  // Story 9.1: Navigate to planning workspace on click
  const openPlanningWorkspace = usePlanningWorkspaceStore((s) => s.openWorkspace)
  // Story 9.3: Navigate directly to artifact viewer for completed tasks
  const openWorkspaceToArtifact = usePlanningWorkspaceStore((s) => s.openWorkspaceToArtifact)

  const handleClick = useCallback(() => {
    if (isCompleted && artifactPath) {
      // Story 9.3 AC4: Map artifact path to workflow key and open viewer directly
      const filename = artifactPath.split('/').filter(Boolean).pop()
      const workflow = BMAD_WORKFLOWS.find((w) => w.outputFilename === filename)
      if (workflow) {
        openWorkspaceToArtifact(workflow.key)
        return
      }
      // Fallback to onOpenArtifact callback if no workflow match
      if (onOpenArtifact) {
        onOpenArtifact()
        return
      }
    }
    // Story 9.1 AC5: Open planning workspace with mapped phase
    const phase = phaseNumberToBmadPhase(task.phase_number)
    openPlanningWorkspace(phase)
  }, [isCompleted, artifactPath, onOpenArtifact, task.phase_number, openPlanningWorkspace, openWorkspaceToArtifact])

  // Story 3.7: Handler for Import Stories button (phase 5 only)
  const handleImportStoriesClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation() // Prevent card click (opening artifact)
      onImportStories?.()
    },
    [onImportStories]
  )

  // Story 3.7: Show Import Stories button only on phase 5 when completed
  const showImportStoriesButton = task.phase_number === 5 && isCompleted

  // Story 9.8: Look up agent persona for colored badge
  const persona = task.bmad_agent ? getAgentPersona(task.bmad_agent) : null

  const description = PHASE_DESCRIPTIONS[task.phase_number]

  // Only show glow when isStartHere is true AND not completed
  const showStartHereGlow = isStartHere && !isCompleted

  return (
    <div
      role="option"
      tabIndex={0}
      aria-label={`Planning phase ${task.phase_number} of 5: ${task.phase_name}`}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      className={cn(
        // Base card styling with depth
        'kanban-card kanban-card-planning group rounded-xl p-3.5',
        // Focus states for keyboard navigation
        'focus-visible:outline-none',
        // Start Here glow effect
        showStartHereGlow && 'start-here',
        // Completed styling
        isCompleted && 'kanban-card-completed',
        // Story 9.1: All planning cards are clickable (open workspace or artifact)
        'cursor-pointer',
        className
      )}
      data-testid={`planning-task-card-${task.id}`}
    >
      {/* Header: Phase name + Phase badge + Status + Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle2 className="size-4 text-green-500" aria-hidden="true" />}
          <h3 className="text-sm font-medium text-foreground">{task.phase_name}</h3>
        </div>
        <div className="flex items-center gap-1">
          {/* Delete button - visible on hover */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete planning task: ${task.phase_name}`}
              data-testid="planning-delete-button"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <PhaseBadge phaseNumber={task.phase_number} />
          {/* Story 9.8: Persona badge when agent is running */}
          {agentStatus === 'running' && persona && (
            <Badge
              variant="outline"
              className={cn(
                'px-1 py-0 text-[10px] font-medium leading-tight',
                persona.bg,
                persona.text,
                persona.border
              )}
              data-testid="agent-persona-badge"
            >
              {persona.displayName}
            </Badge>
          )}
          <AgentStatusBadge status={agentStatus} />
        </div>
      </div>

      {/* Description */}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {/* Artifact path for completed tasks */}
      {isCompleted && artifactPath && (
        <div className="mt-2 flex items-center gap-1 text-xs text-cyan-400">
          <FileText className="size-3" aria-hidden="true" />
          <span className="truncate" title={artifactPath}>
            {artifactPath}
          </span>
        </div>
      )}

      {/* Story 3.7: Import Stories button (phase 5 only) */}
      {showImportStoriesButton && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={handleImportStoriesClick}
          data-testid="import-stories-button"
        >
          <Download className="mr-1 size-3" aria-hidden="true" />
          Import Stories
        </Button>
      )}

      {/* Start Here indicator */}
      {showStartHereGlow && (
        <div
          className="mt-2 text-xs font-medium text-cyan-400"
          title="Recommended next step in planning workflow"
        >
          Start here
        </div>
      )}
    </div>
  )
}
