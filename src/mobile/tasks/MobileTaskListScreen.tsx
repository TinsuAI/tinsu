import { CheckSquare } from 'lucide-react'
import { MobileEmptyState } from '../primitives/MobileEmptyState'

/**
 * Placeholder for the mobile Task list screen.
 * Full implementation lands in T3.5-4.
 */
export function MobileTaskListScreen() {
  return (
    <MobileEmptyState
      icon={<CheckSquare className="h-10 w-10" />}
      title="Tasks"
      subtitle="Coming in T3.5-4 — task workspace with terminal and diff viewer."
    />
  )
}
