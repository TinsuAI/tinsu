/**
 * SyncStatusIndicator — compact sync status icon for the desktop header.
 *
 * States:
 *   idle        Cloud icon, muted — "Synced"
 *   pulling     Spinning RefreshCw — "Syncing…"
 *   pushing     Upload animation — "Uploading…"
 *   lease-lost  Amber AlertTriangle — "View-only mode"
 *   error       Red CloudOff — "Sync error"
 *
 * A tooltip shows last pull/push timestamps for the active project.
 *
 * Desktop only — see src/mobile/components/sync/ for mobile variant.
 * Do NOT add useIsMobile() branches here.
 *
 * Phase 4: Multi-device remote project sync.
 */

import { Cloud, CloudOff, RefreshCw, AlertTriangle, Upload } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSyncStore } from '@renderer/stores/sync.store'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip'
import type { SyncStatus } from '@renderer/stores/sync.store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(unixSecs: number): string {
  const date = new Date(unixSecs * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function timeAgo(unixSecs: number): string {
  const diffSecs = Math.floor(Date.now() / 1000) - unixSecs
  if (diffSecs < 5) return 'just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  return `${Math.floor(diffSecs / 3600)}h ago`
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

interface StatusConfig {
  icon: React.ReactNode
  label: string
  iconClass: string
}

function getStatusConfig(status: SyncStatus): StatusConfig {
  switch (status) {
    case 'pulling':
      return {
        icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />,
        label: 'Syncing…',
        iconClass: 'text-muted-foreground',
      }
    case 'pushing':
      return {
        icon: <Upload className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />,
        label: 'Uploading…',
        iconClass: 'text-muted-foreground',
      }
    case 'lease-lost':
      return {
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
        label: 'View-only',
        iconClass: 'text-amber-500 dark:text-amber-400',
      }
    case 'error':
      return {
        icon: <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />,
        label: 'Sync error',
        iconClass: 'text-destructive dark:text-red-400',
      }
    case 'idle':
    default:
      return {
        icon: <Cloud className="h-3.5 w-3.5" aria-hidden="true" />,
        label: 'Synced',
        iconClass: 'text-muted-foreground',
      }
  }
}

// ---------------------------------------------------------------------------
// SyncStatusIndicator
// ---------------------------------------------------------------------------

interface SyncStatusIndicatorProps {
  className?: string
  /** Show the text label alongside the icon (default: false for compact mode) */
  showLabel?: boolean
}

/**
 * Small sync status badge for the desktop header. Returns null if no remote
 * project is active.
 */
export function SyncStatusIndicator({ className, showLabel = false }: SyncStatusIndicatorProps) {
  const remoteProjectId = useProjectStore((s) => s.remoteProjectId)
  const syncState = useSyncStore(
    (s) => (remoteProjectId ? s.projects[remoteProjectId] : null) ?? null
  )

  // Only render for remote projects
  if (!remoteProjectId) return null

  const status = syncState?.status ?? 'idle'
  const config = getStatusConfig(status)

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="status"
            aria-label={`Sync status: ${config.label}`}
            data-testid="sync-status-indicator"
            data-status={status}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-1.5 py-1',
              'text-xs font-medium transition-colors duration-200',
              config.iconClass,
              className
            )}
          >
            {config.icon}
            {showLabel && (
              <span className="hidden sm:inline leading-none">{config.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          <SyncTooltipContent
            status={status}
            lastPullAt={syncState?.lastPullAt}
            lastPushAt={syncState?.lastPushAt}
            error={syncState?.error}
            holderDeviceId={syncState?.holderDeviceId}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Tooltip content
// ---------------------------------------------------------------------------

function SyncTooltipContent({
  status,
  lastPullAt,
  lastPushAt,
  error,
  holderDeviceId,
}: {
  status: SyncStatus
  lastPullAt?: number
  lastPushAt?: number
  error?: string
  holderDeviceId?: string
}) {
  return (
    <div className="space-y-1">
      <p className="font-semibold">
        {status === 'idle' && 'Sync up to date'}
        {status === 'pulling' && 'Pulling from remote…'}
        {status === 'pushing' && 'Pushing to remote…'}
        {status === 'lease-lost' && 'View-only mode'}
        {status === 'error' && 'Sync error'}
      </p>

      {status === 'lease-lost' && holderDeviceId && (
        <p className="text-muted-foreground">
          Controlled by device{' '}
          <span className="font-mono text-[11px]">{holderDeviceId.slice(0, 8)}…</span>
        </p>
      )}

      {status === 'error' && error && (
        <p className="text-muted-foreground break-words">{error}</p>
      )}

      {lastPullAt && (
        <p className="text-muted-foreground">
          Last pull: {formatTimestamp(lastPullAt)}{' '}
          <span className="opacity-60">({timeAgo(lastPullAt)})</span>
        </p>
      )}

      {lastPushAt && (
        <p className="text-muted-foreground">
          Last push: {formatTimestamp(lastPushAt)}{' '}
          <span className="opacity-60">({timeAgo(lastPushAt)})</span>
        </p>
      )}

      {!lastPullAt && !lastPushAt && status === 'idle' && (
        <p className="text-muted-foreground">No sync activity yet this session.</p>
      )}
    </div>
  )
}
