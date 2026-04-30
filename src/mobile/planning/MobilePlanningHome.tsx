import { Compass } from 'lucide-react'
import { MobileEmptyState } from '../primitives/MobileEmptyState'

/**
 * Placeholder for the mobile Planning (chat sessions list) screen.
 * Full implementation lands in T3.5-5.
 */
export function MobilePlanningHome() {
  return (
    <MobileEmptyState
      icon={<Compass className="h-10 w-10" />}
      title="Planning"
      subtitle="Coming in T3.5-5 — BMAD agent chat sessions on mobile."
    />
  )
}
