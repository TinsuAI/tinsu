/**
 * SyncStatusIndicator (mobile) — 16×16 icon node for MobileTopAppBar statusPill slot.
 *
 * States:
 *   idle        Subtle cloud — invisible unless hover/tap
 *   pulling     Spinning RefreshCw
 *   pushing     Pulsing Upload
 *   lease-lost  Amber AlertTriangle
 *   error       Red CloudOff
 *
 * Tapping shows a bottom sheet / callout with details (not implemented — falls
 * back to no-op interaction; banner handles action prompts).
 *
 * Mobile-only — desktop has its own variant in src/components/sync/.
 * Do NOT add useIsMobile() branches to this file.
 *
 * Phase 4: Multi-device remote project sync.
 */

import { Cloud, CloudOff, RefreshCw, AlertTriangle, Upload } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSyncStore } from '@renderer/stores/sync.store'
import { useProjectStore } from '@renderer/stores/project.store'
import type { SyncStatus } from '@renderer/stores/sync.store'

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

interface MobileStatusConfig {
  icon: React.ReactNode
  ariaLabel: string
}

function getMobileStatusConfig(status: SyncStatus): MobileStatusConfig {
  switch (status) {
    case 'pulling':
      return {
        icon: (
          <RefreshCw
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ),
        ariaLabel: 'Syncing from remote',
      }
    case 'pushing':
      return {
        icon: (
          <Upload
            className="h-4 w-4 animate-pulse text-muted-foreground"
            aria-hidden="true"
          />
        ),
        ariaLabel: 'Uploading to remote',
      }
    case 'lease-lost':
      return {
        icon: (
          <AlertTriangle
            className="h-4 w-4 text-amber-500 dark:text-amber-400"
            aria-hidden="true"
          />
        ),
        ariaLabel: 'View-only mode — another device controls this project',
      }
    case 'error':
      return {
        icon: (
          <CloudOff
            className="h-4 w-4 text-destructive dark:text-red-400"
            aria-hidden="true"
          />
        ),
        ariaLabel: 'Sync error',
      }
    case 'idle':
    default:
      return {
        icon: (
          <Cloud
            className="h-4 w-4 text-muted-foreground/50"
            aria-hidden="true"
          />
        ),
        ariaLabel: 'Synced',
      }
  }
}

// ---------------------------------------------------------------------------
// MobileSyncStatusIndicator
// ---------------------------------------------------------------------------

interface MobileSyncStatusIndicatorProps {
  className?: string
}

/**
 * Icon-only sync status indicator for MobileTopAppBar's statusPill slot.
 * Returns null if no remote project is active.
 *
 * @example
 * <MobileTopAppBar
 *   projectName="My Project"
 *   statusPill={<MobileSyncStatusIndicator />}
 * />
 */
export function MobileSyncStatusIndicator({ className }: MobileSyncStatusIndicatorProps) {
  const remoteProjectId = useProjectStore((s) => s.remoteProjectId)
  const syncState = useSyncStore(
    (s) => (remoteProjectId ? s.projects[remoteProjectId] : null) ?? null
  )

  // Only render for remote projects
  if (!remoteProjectId) return null

  const status = syncState?.status ?? 'idle'

  // Hide idle indicator on mobile to avoid visual clutter (banner handles error states)
  if (status === 'idle') return null

  const config = getMobileStatusConfig(status)

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      data-testid="mobile-sync-status-indicator"
      data-status={status}
      className={cn(
        'flex items-center justify-center',
        'h-[2.75rem] w-[2.75rem]', // 44px touch target
        className
      )}
    >
      {config.icon}
    </span>
  )
}
