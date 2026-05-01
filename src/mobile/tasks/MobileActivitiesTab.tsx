/**
 * MobileActivitiesTab — Activities sub-tab for the mobile task workspace.
 *
 * Wraps the existing desktop ActivitiesTab component (allowed cross-tree import,
 * AC 16) in a vertical scroll container with a 12 px top padding. The desktop
 * tab is already filterable, virtualised, and live-streaming via
 * useActivitySubscription — no forking needed.
 *
 * Token contract: no inline color classes on the wrapper div (AC 20).
 * The interior ActivitiesTab uses its own token-consistent styles.
 *
 * If ActivitiesTab depends on a desktop-only context (e.g. TooltipProvider),
 * wrap it here. It does NOT appear to require one based on source inspection.
 *
 * @see Story T3.5-4, AC 8
 */

import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'

interface MobileActivitiesTabProps {
  taskId: string
}

export function MobileActivitiesTab({ taskId }: MobileActivitiesTabProps) {
  return (
    <div
      className="h-full overflow-hidden pt-3"
      data-testid="mobile-activities-tab"
    >
      <ActivitiesTab taskId={taskId} />
    </div>
  )
}
