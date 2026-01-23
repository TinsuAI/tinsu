/**
 * ReviewTimeline Component - Story 7.7
 *
 * Renders a vertical timeline showing the review history flow:
 * "v1 -> Rejected -> v2 -> Changes Requested -> v3"
 *
 * @see Story 7.7: Review History & Comparison
 * AC 3: Timeline shows version flow with status transitions
 */

import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import {
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  Clock,
  ArrowDown,
  GitBranch
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import type { VersionStatusOutcome } from '@shared/types/task.types'

export interface ReviewTimelineProps {
  /** Task ID to fetch version history */
  taskId: string
  /** Currently selected version number (highlighted in timeline) */
  selectedVersion: number | null
  /** Callback when a version node is clicked */
  onVersionClick: (version: number) => void
  /** Optional className for styling */
  className?: string
}

/** Status configuration for timeline nodes */
const STATUS_CONFIG: Record<
  VersionStatusOutcome,
  {
    label: string
    icon: React.ElementType
    nodeClass: string
    lineClass: string
    bgClass: string
  }
> = {
  pending: {
    label: 'Pending Review',
    icon: Clock,
    nodeClass: 'border-slate-400 bg-slate-500/20 text-slate-300',
    lineClass: 'bg-gradient-to-b from-slate-500/50 to-slate-500/20',
    bgClass: 'bg-slate-500/5'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    nodeClass: 'border-red-400 bg-red-500/20 text-red-300',
    lineClass: 'bg-gradient-to-b from-red-500/50 to-red-500/20',
    bgClass: 'bg-red-500/5'
  },
  changes_requested: {
    label: 'Changes Requested',
    icon: MessageSquareWarning,
    nodeClass: 'border-amber-400 bg-amber-500/20 text-amber-300',
    lineClass: 'bg-gradient-to-b from-amber-500/50 to-amber-500/20',
    bgClass: 'bg-amber-500/5'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    nodeClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-300',
    lineClass: 'bg-gradient-to-b from-emerald-500/50 to-emerald-500/20',
    bgClass: 'bg-emerald-500/5'
  }
}

/** Format timestamp to relative time or date */
function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Timeline node component */
function TimelineNode({
  version,
  status,
  isSelected,
  isLatest,
  feedbackPreview,
  timestamp,
  onClick
}: {
  version: number
  status: VersionStatusOutcome
  isSelected: boolean
  isLatest: boolean
  feedbackPreview: string | null
  timestamp: Date
  onClick: () => void
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all',
        'hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isSelected && 'bg-secondary/70 ring-1 ring-violet-500/30',
        config.bgClass
      )}
    >
      {/* Version node circle */}
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-transform',
          'group-hover:scale-110',
          config.nodeClass,
          isSelected && 'scale-110 ring-2 ring-violet-500/50'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Version details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">v{version}</span>
          {isLatest && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-300 border border-violet-500/30">
              Current
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('font-medium', config.nodeClass.split(' ')[2])}>
            {config.label}
          </span>
          <span>·</span>
          <span>{formatTimestamp(timestamp)}</span>
        </div>

        {/* Feedback preview for rejected/changes_requested */}
        {feedbackPreview && (
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/80 italic cursor-help">
                "{feedbackPreview}"
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md">
              <p className="text-xs whitespace-pre-wrap">"{feedbackPreview}"</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </button>
  )
}

/** Transition arrow between versions */
function TransitionArrow({ status }: { status: VersionStatusOutcome }) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="relative flex h-8 items-center justify-center">
      {/* Vertical connecting line */}
      <div className={cn('absolute h-full w-0.5 rounded-full', config.lineClass)} />

      {/* Arrow icon */}
      <div
        className={cn(
          'relative z-10 flex h-5 w-5 items-center justify-center rounded-full',
          'bg-background border',
          config.nodeClass.split(' ')[0] // Just the border color
        )}
      >
        <ArrowDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  )
}

/**
 * ReviewTimeline displays the complete review history as a vertical timeline.
 */
export function ReviewTimeline({
  taskId,
  selectedVersion,
  onVersionClick,
  className
}: ReviewTimelineProps): React.JSX.Element {
  // Fetch version history
  const { data: versions, isLoading, error } = trpc.task.getTaskVersions.useQuery(
    { taskId },
    { enabled: !!taskId }
  )

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-500/30 bg-red-500/5 p-6 text-center',
          className
        )}
      >
        <XCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-400">Failed to load review history</p>
        <p className="text-xs text-muted-foreground/70">{error.message}</p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-secondary/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-secondary/50" />
              <div className="h-3 w-32 animate-pulse rounded bg-secondary/30" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // No versions yet
  if (!versions || versions.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-secondary p-6 text-center',
          className
        )}
      >
        <GitBranch className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No review history yet</p>
        <p className="text-xs text-muted-foreground/70">
          Version history will appear when the task enters review
        </p>
      </div>
    )
  }

  const latestVersionNumber = Math.max(...versions.map((v) => v.version_number))
  const effectiveSelected = selectedVersion ?? latestVersionNumber

  return (
    <div className={cn('space-y-1', className)}>
      {/* Timeline header */}
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" />
        <span>Review History</span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline nodes */}
      <div className="relative">
        {versions.map((version, index) => {
          const isLatest = version.version_number === latestVersionNumber
          const isSelected = version.version_number === effectiveSelected

          // Get feedback preview (rejection feedback or inline comment count)
          let feedbackPreview: string | null = null
          if (version.rejection_feedback) {
            feedbackPreview = version.rejection_feedback
          } else if (version.inline_comments && Array.isArray(version.inline_comments)) {
            feedbackPreview = `${version.inline_comments.length} inline comment${
              version.inline_comments.length !== 1 ? 's' : ''
            }`
          }

          return (
            <React.Fragment key={version.id}>
              <TimelineNode
                version={version.version_number}
                status={version.status_outcome as VersionStatusOutcome}
                isSelected={isSelected}
                isLatest={isLatest}
                feedbackPreview={feedbackPreview}
                timestamp={new Date(version.created_at)}
                onClick={() => onVersionClick(version.version_number)}
              />

              {/* Show transition arrow if not the last item */}
              {index < versions.length - 1 && (
                <TransitionArrow status={version.status_outcome as VersionStatusOutcome} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
