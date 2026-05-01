/**
 * MobileDiffTab — Diff sub-tab for the mobile task workspace.
 *
 * Renders MobileDiffViewer for tasks with status 'review' | 'done' or with a
 * worktree path. Otherwise shows an empty state (no changes yet).
 *
 * Cross-tree imports allowed (AC 16):
 *   - @renderer/components/review/MobileDiffViewer
 *
 * Token contract: no inline color classes (AC 20).
 *
 * @see Story T3.5-4, AC 9
 */

import { MobileDiffViewer } from '@renderer/components/review/MobileDiffViewer'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import type { Task } from '@shared/types/task.types'

interface MobileDiffTabProps {
  task: Task | null | undefined
}

/** Statuses that should show the diff viewer */
const DIFF_VISIBLE_STATUSES = new Set<string>(['review', 'done'])

export function MobileDiffTab({ task }: MobileDiffTabProps) {
  if (!task) {
    return (
      <div className="p-4">
        <MobileLoadingSkeleton variant="card" />
      </div>
    )
  }

  const shouldShowDiff =
    DIFF_VISIBLE_STATUSES.has(task.status) || Boolean(task.worktree_path)

  if (!shouldShowDiff) {
    return (
      <MobileEmptyState
        title="No changes yet"
        subtitle="Diffs appear once an agent has produced changes."
      />
    )
  }

  return (
    <div
      className="h-full overflow-hidden"
      data-testid="mobile-diff-tab"
    >
      <MobileDiffViewer taskId={task.id} task={task} />
    </div>
  )
}
