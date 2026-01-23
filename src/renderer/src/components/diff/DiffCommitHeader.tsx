/**
 * DiffCommitHeader - Story 8.11 Task 3
 *
 * Displays commit metadata above the diff view for historical (done) tasks.
 * Shows commit SHA, message, author, and date with copy functionality.
 * Includes "Compare with current" button to see what changed since completion.
 *
 * @see Story 8.11: Historical Diff View for Completed Tasks
 */

import { useState, useCallback } from 'react'
import { GitCommit, GitBranch, Copy, Check, Clock, User, GitCompareArrows } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { toast } from 'sonner'
import { CompareWithHeadDialog } from '@renderer/components/dialogs/CompareWithHeadDialog'

export interface CommitInfo {
  /** Full commit SHA */
  sha: string
  /** Commit message (first line) */
  message?: string
  /** Commit author name */
  author?: string
  /** Commit date (ISO string or Date) */
  date?: string | Date
}

export interface DiffCommitHeaderProps {
  /** Commit information to display */
  commit: CommitInfo
  /** Optional branch name to display (Story 8.11 AC4) */
  branchName?: string | null
  /** Optional className for customization */
  className?: string
  /** Whether to show the "Compare with current" button (default: true) */
  showCompareButton?: boolean
}

/**
 * Format a date for display.
 * Shows relative time for recent dates, full date for older ones.
 */
function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  }

  // For older dates, show full date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * DiffCommitHeader - Displays commit info for historical diffs.
 *
 * Appears above the diff summary bar when viewing a completed task.
 * Shows the merge commit SHA (with copy button), message, author, and date.
 * Includes "Compare with current" button to view changes since completion.
 *
 * Story 8.11 Task 3: Commit info header component
 * Story 8.11 Task 4.3: Compare with current button
 */
export function DiffCommitHeader({ commit, branchName, className, showCompareButton = true }: DiffCommitHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [showCompareDialog, setShowCompareDialog] = useState(false)

  // Story 8.11 Task 3.3: Copy SHA to clipboard
  const handleCopySha = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(commit.sha)
      setCopied(true)
      toast.success('Commit SHA copied', {
        description: commit.sha.substring(0, 7),
        duration: 2000
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy SHA')
    }
  }, [commit.sha])

  // Short SHA for display (first 7 characters, like GitHub)
  const shortSha = commit.sha.substring(0, 7)

  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-border/10 bg-muted/5 px-5 py-3',
        className
      )}
      data-testid="diff-commit-header"
    >
      {/* Commit icon */}
      <GitCommit className="h-4 w-4 shrink-0 text-orange-400/70" />

      {/* Commit SHA with copy button */}
      <div className="flex items-center gap-1.5">
        <code
          className="rounded bg-orange-500/10 px-2 py-0.5 font-mono text-xs text-orange-300/90"
          title={commit.sha}
        >
          {shortSha}
        </code>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopySha}
          className="h-6 w-6 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400"
          aria-label="Copy commit SHA"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Story 8.11 AC4: Branch name display */}
      {branchName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{branchName}</span>
        </div>
      )}

      {/* Commit message - truncated */}
      {commit.message && (
        <span
          className="min-w-0 flex-1 truncate text-sm text-foreground/80"
          title={commit.message}
        >
          {commit.message}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Author and date on the right */}
      <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground/60">
        {commit.author && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3" />
            <span>{commit.author}</span>
          </div>
        )}
        {commit.date && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span title={new Date(commit.date).toLocaleString()}>{formatDate(commit.date)}</span>
          </div>
        )}
      </div>

      {/* Story 8.11 Task 4.3: Compare with current button */}
      {showCompareButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompareDialog(true)}
          className="ml-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          Compare with current
        </Button>
      )}

      {/* Story 8.11 Task 4.4: Compare dialog */}
      <CompareWithHeadDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        commitSha={commit.sha}
      />
    </div>
  )
}
