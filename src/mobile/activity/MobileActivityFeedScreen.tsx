import { Activity } from 'lucide-react'
import { MobileEmptyState } from '../primitives/MobileEmptyState'

/**
 * Placeholder for the mobile Activity feed screen.
 * Full implementation lands in T3.5-8.
 */
export function MobileActivityFeedScreen() {
  return (
    <MobileEmptyState
      icon={<Activity className="h-10 w-10" />}
      title="Activity"
      subtitle="Coming in T3.5-8 — live activity feed and settings."
    />
  )
}
