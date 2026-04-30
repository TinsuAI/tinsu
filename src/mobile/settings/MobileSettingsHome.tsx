import { Settings } from 'lucide-react'
import { MobileEmptyState } from '../primitives/MobileEmptyState'

/**
 * Placeholder for the mobile Settings screen.
 * Full implementation lands in T3.5-8.
 */
export function MobileSettingsHome() {
  return (
    <MobileEmptyState
      icon={<Settings className="h-10 w-10" />}
      title="Settings"
      subtitle="Coming in T3.5-8 — app settings and configuration."
    />
  )
}
