import { useCallback, type KeyboardEvent } from 'react'
import { cn } from '@renderer/lib/utils'
import { PhaseBadge } from '@renderer/components/task/PhaseBadge'
import { AgentStatusBadge, type AgentStatus } from '@renderer/components/ui/AgentStatusBadge'
import { PHASE_DESCRIPTIONS } from '@renderer/constants/planning-phases'
import { CheckCircle2, FileText } from 'lucide-react'
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
  className
}: PlanningTaskCardProps) {
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

  const handleClick = useCallback(() => {
    if (isCompleted && artifactPath && onOpenArtifact) {
      onOpenArtifact()
    }
  }, [isCompleted, artifactPath, onOpenArtifact])

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
        // Base card styling
        'rounded-lg border border-border bg-card p-3',
        // Hover states
        'hover:border-primary/50 hover:bg-card/80',
        // Focus states for keyboard navigation
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Start Here glow effect - cyan ring with soft shadow
        showStartHereGlow && 'ring-2 ring-cyan-500/50 shadow-[0_0_15px_-3px] shadow-cyan-500/30',
        // Completed + clickable cursor
        isCompleted && artifactPath && 'cursor-pointer',
        // Transition for smooth hover effect
        'transition-colors',
        className
      )}
      data-testid={`planning-task-card-${task.id}`}
    >
      {/* Header: Phase name + Phase badge + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle2 className="size-4 text-green-500" aria-hidden="true" />}
          <h3 className="text-sm font-medium text-foreground">{task.phase_name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <PhaseBadge phaseNumber={task.phase_number} />
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
