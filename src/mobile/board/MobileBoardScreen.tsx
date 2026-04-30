import { LayoutDashboard } from 'lucide-react'
import { MobileEmptyState } from '../primitives/MobileEmptyState'

/**
 * Placeholder for the mobile Kanban board screen.
 * Full implementation lands in T3.5-3.
 */
export function MobileBoardScreen() {
  return (
    <MobileEmptyState
      icon={<LayoutDashboard className="h-10 w-10" />}
      title="Board"
      subtitle="Coming in T3.5-3 — touch-optimised Kanban board with column pager."
    />
  )
}
