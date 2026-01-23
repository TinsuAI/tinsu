/**
 * FeedbackHistory Component - Story 7.7
 *
 * Lists all rejection feedback entries chronologically with version links.
 *
 * @see Story 7.7: Review History & Comparison
 * AC 4: Show all rejection/comment feedback chronologically with version links
 */

import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import {
  MessageSquare,
  XCircle,
  MessageSquareWarning,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCode,
  Hash
} from 'lucide-react'
import type { VersionStatusOutcome } from '@shared/types/task.types'

export interface FeedbackHistoryProps {
  /** Task ID to fetch feedback history */
  taskId: string
  /** Callback when user wants to navigate to a specific version */
  onVersionNavigate: (version: number) => void
  /** Optional className for styling */
  className?: string
}

/** Inline comment structure from database */
interface InlineComment {
  id: string
  filePath: string
  lineNumber: number
  content: string
  createdAt: number
}

/** Format timestamp to readable date */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

/** Feedback entry for a rejected version */
function RejectionEntry({
  version,
  feedback,
  timestamp,
  onNavigate
}: {
  version: number
  feedback: string
  timestamp: Date
  onNavigate: () => void
}) {
  return (
    <div className="group relative rounded-lg border border-red-500/20 bg-red-500/5 p-4 transition-colors hover:border-red-500/30 hover:bg-red-500/10">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-400" />
          <span className="font-mono text-sm font-semibold text-foreground">v{version}</span>
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300">
            Rejected
          </span>
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          View diff
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Timestamp */}
      <p className="mb-2 text-xs text-muted-foreground">{formatDate(timestamp)}</p>

      {/* Feedback content */}
      <div className="rounded-md bg-red-500/5 p-3 border border-red-500/10">
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{feedback}</p>
      </div>
    </div>
  )
}

/** Feedback entry for changes requested with inline comments */
function ChangesRequestedEntry({
  version,
  inlineComments,
  timestamp,
  onNavigate
}: {
  version: number
  inlineComments: InlineComment[]
  timestamp: Date
  onNavigate: () => void
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div className="group relative rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 transition-colors hover:border-amber-500/30 hover:bg-amber-500/10">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-sm font-semibold text-foreground">v{version}</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            Changes Requested
          </span>
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          View diff
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Timestamp */}
      <p className="mb-2 text-xs text-muted-foreground">{formatDate(timestamp)}</p>

      {/* Comments summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-md bg-amber-500/5 p-3 border border-amber-500/10 hover:bg-amber-500/10 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm text-foreground/90">
          <MessageSquare className="h-4 w-4 text-amber-400" />
          {inlineComments.length} inline comment{inlineComments.length !== 1 ? 's' : ''}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded inline comments */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {inlineComments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-md bg-secondary/30 p-3 border border-secondary"
            >
              {/* File info */}
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <FileCode className="h-3.5 w-3.5" />
                <span className="font-mono truncate">{comment.filePath}</span>
                <span className="flex items-center gap-0.5">
                  <Hash className="h-3 w-3" />
                  {comment.lineNumber}
                </span>
              </div>
              {/* Comment content */}
              <p className="text-sm text-foreground/90">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * FeedbackHistory displays all feedback entries chronologically.
 */
export function FeedbackHistory({
  taskId,
  onVersionNavigate,
  className
}: FeedbackHistoryProps): React.JSX.Element {
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
        <p className="text-sm text-red-400">Failed to load feedback history</p>
        <p className="text-xs text-muted-foreground/70">{error.message}</p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-secondary/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-secondary/50" />
              <div className="h-4 w-12 rounded bg-secondary/50" />
            </div>
            <div className="h-3 w-24 rounded bg-secondary/30" />
            <div className="mt-2 h-16 rounded-md bg-secondary/20" />
          </div>
        ))}
      </div>
    )
  }

  // Filter versions that have feedback (rejected or changes_requested)
  const feedbackVersions = versions?.filter(
    (v) =>
      (v.status_outcome === 'rejected' && v.rejection_feedback) ||
      (v.status_outcome === 'changes_requested' && v.inline_comments)
  )

  // Empty state - no feedback yet
  if (!feedbackVersions || feedbackVersions.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-secondary p-6 text-center',
          className
        )}
      >
        <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No feedback yet</p>
        <p className="text-xs text-muted-foreground/70">
          Feedback will appear here after review decisions
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Feedback History</span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5">
          {feedbackVersions.length} entr{feedbackVersions.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Feedback entries - sorted by version number (chronological) */}
      <div className="space-y-3">
        {feedbackVersions.map((version) => {
          const status = version.status_outcome as VersionStatusOutcome

          if (status === 'rejected' && version.rejection_feedback) {
            return (
              <RejectionEntry
                key={version.id}
                version={version.version_number}
                feedback={version.rejection_feedback}
                timestamp={new Date(version.created_at)}
                onNavigate={() => onVersionNavigate(version.version_number)}
              />
            )
          }

          if (status === 'changes_requested' && version.inline_comments) {
            // Note: inline_comments is already parsed by trpc.task.getTaskVersions
            // This defensive check ensures type safety in case of direct DB access
            const comments = Array.isArray(version.inline_comments)
              ? (version.inline_comments as InlineComment[])
              : []

            return (
              <ChangesRequestedEntry
                key={version.id}
                version={version.version_number}
                inlineComments={comments}
                timestamp={new Date(version.created_at)}
                onNavigate={() => onVersionNavigate(version.version_number)}
              />
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
