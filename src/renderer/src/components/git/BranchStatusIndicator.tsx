import { GitBranch, Check, ArrowDown, ArrowUp, Circle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'

/**
 * Props for BranchStatusIndicator component.
 * Story 8.9: Branch Status Indicators (AC: 1, 2, 4)
 */
export interface BranchStatusIndicatorProps {
  /** Branch name, null if no branch associated */
  branchName: string | null
  /** Whether the branch has been merged (done tasks with merge_commit_sha) */
  isMerged: boolean
  /** Number of commits ahead of main */
  commitsAhead?: number
  /** Number of commits behind main */
  commitsBehind?: number
  /** Whether there are uncommitted changes in the worktree */
  hasUncommittedChanges?: boolean
  /** Optional additional CSS classes */
  className?: string
}

/**
 * Truncate branch name to max length with ellipsis.
 */
function truncateBranchName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) {
    return name
  }
  return `${name.substring(0, maxLength - 3)}...`
}

/**
 * Displays git branch status on task cards.
 *
 * Story 8.9: Branch Status Indicators
 *
 * Visual states:
 * - Active branch: GitBranch icon + truncated name (muted color)
 * - Behind main: Amber warning badge with down arrow
 * - Ahead of main: Muted badge with up arrow
 * - Has uncommitted: Dot indicator
 * - Merged: Check icon + "Merged" text (green)
 *
 * @example
 * ```tsx
 * <BranchStatusIndicator
 *   branchName="tinsu/story-123-user-auth"
 *   isMerged={false}
 *   commitsAhead={3}
 *   commitsBehind={1}
 * />
 * ```
 */
export function BranchStatusIndicator({
  branchName,
  isMerged,
  commitsAhead = 0,
  commitsBehind = 0,
  hasUncommittedChanges = false,
  className
}: BranchStatusIndicatorProps): React.JSX.Element | null {
  // Don't render if no branch associated
  if (!branchName) {
    return null
  }

  // Merged state: show green check with "Merged" text
  if (isMerged) {
    return (
      <div
        className={cn('flex items-center gap-1.5', className)}
        data-testid="branch-status-merged"
      >
        <div className="inline-flex items-center gap-1 text-green-500">
          <Check className="size-3.5" />
          <span className="text-xs font-medium">Merged</span>
        </div>
      </div>
    )
  }

  // Active branch state
  const truncatedName = truncateBranchName(branchName)
  const showFullName = branchName.length > 20

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      data-testid="branch-status-indicator"
    >
      {/* Branch name with icon */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <GitBranch className="size-3.5" />
              <span className="text-xs font-mono">{truncatedName}</span>
              {/* Uncommitted changes indicator */}
              {hasUncommittedChanges && (
                <Circle
                  className="size-2 fill-amber-500 text-amber-500"
                  data-testid="uncommitted-indicator"
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-1">
              {showFullName && <p className="font-mono text-xs">{branchName}</p>}
              {hasUncommittedChanges && (
                <p className="text-amber-400">Has uncommitted changes</p>
              )}
              {!showFullName && !hasUncommittedChanges && (
                <p>{branchName}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Behind main warning badge */}
      {commitsBehind > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-600/30 px-1.5 py-0.5 text-xs font-medium text-amber-400"
                data-testid="commits-behind-badge"
              >
                <ArrowDown className="size-3" />
                <span>{commitsBehind} behind</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                This branch is {commitsBehind} commit{commitsBehind !== 1 ? 's' : ''} behind main.
              </p>
              <p className="text-muted-foreground">
                Consider rebasing to avoid merge conflicts.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Ahead of main badge (subtle, not a warning) */}
      {commitsAhead > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
                data-testid="commits-ahead-badge"
              >
                <ArrowUp className="size-3" />
                <span>{commitsAhead} ahead</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {commitsAhead} commit{commitsAhead !== 1 ? 's' : ''} ahead of main
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
