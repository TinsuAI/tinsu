/**
 * RemoteSyncBanner (mobile) — slim notification strip below MobileTopAppBar.
 *
 * Variants:
 *   lease-lost  Amber — compact warning with "Take Over" action.
 *   error       Red   — compact error with "Retry" action.
 *
 * Renders inside MobileScreen, below the top app bar, above main content.
 * Uses bg-card surface and safe-area-aware padding matching Calm Command tokens.
 *
 * Mobile-only — desktop has its own variant in src/components/sync/.
 * Do NOT add useIsMobile() branches to this file.
 *
 * Phase 4: Multi-device remote project sync.
 */

import { useState } from 'react'
import { AlertTriangle, CloudOff, RefreshCw, X, ShieldCheck } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSyncStore } from '@renderer/stores/sync.store'
import { useClaimRemoteLease } from '@renderer/hooks/useRemoteSyncLifecycle'
import { useProjectStore } from '@renderer/stores/project.store'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(unixSecs: number): string {
  const diffSecs = Math.floor(Date.now() / 1000) - unixSecs
  if (diffSecs < 60) return 'just now'
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  return `${Math.floor(diffSecs / 3600)}h ago`
}

// ---------------------------------------------------------------------------
// RemoteSyncBanner (mobile entry point)
// ---------------------------------------------------------------------------

interface MobileRemoteSyncBannerProps {
  className?: string
}

/**
 * Slim banner strip for remote sync warnings on mobile.
 * Returns null when there is no remote project or no active warning.
 */
export function MobileRemoteSyncBanner({ className }: MobileRemoteSyncBannerProps) {
  const remoteProjectId = useProjectStore((s) => s.remoteProjectId)
  const syncState = useSyncStore(
    (s) => (remoteProjectId ? s.projects[remoteProjectId] : null) ?? null
  )

  if (!remoteProjectId || !syncState) return null
  if (syncState.status !== 'lease-lost' && syncState.status !== 'error') return null
  if (syncState.bannerDismissed) return null

  if (syncState.status === 'lease-lost') {
    return (
      <MobileLeaseLostStrip
        remoteProjectId={remoteProjectId}
        className={className}
      />
    )
  }

  return (
    <MobileErrorStrip
      remoteProjectId={remoteProjectId}
      lastPullAt={syncState.lastPullAt}
      className={className}
    />
  )
}

// ---------------------------------------------------------------------------
// MobileLeaseLostStrip
// ---------------------------------------------------------------------------

function MobileLeaseLostStrip({
  remoteProjectId,
  className,
}: {
  remoteProjectId: string
  className?: string
}) {
  const dismissBanner = useSyncStore((s) => s.dismissBanner)
  const claimLease = useClaimRemoteLease()
  const [isClaiming, setIsClaiming] = useState(false)

  const handleTakeOver = async () => {
    setIsClaiming(true)
    await claimLease(remoteProjectId)
    setIsClaiming(false)
  }

  return (
    <div
      role="alert"
      data-testid="mobile-sync-banner-lease-lost"
      className={cn(
        'flex items-center gap-2 px-4 py-2',
        'bg-amber-50 dark:bg-amber-950/40',
        'border-b border-amber-200/70 dark:border-amber-800/50',
        className
      )}
    >
      <AlertTriangle
        className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400"
        aria-hidden="true"
      />

      <p className="flex-1 text-xs font-medium text-amber-900 dark:text-amber-200 leading-snug">
        View-only — another device controls this project
      </p>

      {/* Touch targets: min 44px via padding compensation */}
      <button
        type="button"
        onClick={handleTakeOver}
        disabled={isClaiming}
        aria-label="Take over project control"
        data-testid="mobile-sync-banner-take-over"
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 shrink-0',
          'text-xs font-semibold',
          'bg-amber-100 dark:bg-amber-900/50',
          'text-amber-900 dark:text-amber-200',
          'border border-amber-300 dark:border-amber-700/60',
          'active:opacity-60 transition-opacity duration-150',
          'disabled:opacity-40',
          'min-h-[2rem]'
        )}
      >
        {isClaiming ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <ShieldCheck className="h-3 w-3" />
            <span>Take Over</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => dismissBanner(remoteProjectId)}
        aria-label="Dismiss"
        data-testid="mobile-sync-banner-dismiss"
        className={cn(
          'flex items-center justify-center rounded-md shrink-0',
          'text-amber-600 dark:text-amber-400',
          'min-h-[2.75rem] min-w-[2.75rem] -mr-2',
          'active:opacity-60 transition-opacity duration-150'
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileErrorStrip
// ---------------------------------------------------------------------------

function MobileErrorStrip({
  remoteProjectId,
  lastPullAt,
  className,
}: {
  remoteProjectId: string
  lastPullAt?: number
  className?: string
}) {
  const dismissBanner = useSyncStore((s) => s.dismissBanner)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await invoke('force_push_remote_db', { remoteProjectId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Retry failed', { description: msg })
    } finally {
      setIsRetrying(false)
    }
  }

  const lastUpdatedLabel = lastPullAt ? timeAgo(lastPullAt) : 'unknown'

  return (
    <div
      role="alert"
      data-testid="mobile-sync-banner-error"
      className={cn(
        'flex items-center gap-2 px-4 py-2',
        'bg-destructive/8 dark:bg-destructive/15',
        'border-b border-destructive/25',
        className
      )}
    >
      <CloudOff
        className="h-3.5 w-3.5 shrink-0 text-destructive dark:text-red-400"
        aria-hidden="true"
      />

      <p className="flex-1 text-xs font-medium text-destructive dark:text-red-300 leading-snug">
        Sync error — {lastUpdatedLabel}
      </p>

      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        aria-label="Retry sync"
        data-testid="mobile-sync-banner-retry"
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 shrink-0',
          'text-xs font-semibold',
          'bg-destructive/10 dark:bg-destructive/20',
          'text-destructive dark:text-red-300',
          'border border-destructive/30',
          'active:opacity-60 transition-opacity duration-150',
          'disabled:opacity-40',
          'min-h-[2rem]'
        )}
      >
        {isRetrying ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          'Retry'
        )}
      </button>

      <button
        type="button"
        onClick={() => dismissBanner(remoteProjectId)}
        aria-label="Dismiss"
        data-testid="mobile-sync-banner-dismiss"
        className={cn(
          'flex items-center justify-center rounded-md shrink-0',
          'text-destructive/70 dark:text-red-400',
          'min-h-[2.75rem] min-w-[2.75rem] -mr-2',
          'active:opacity-60 transition-opacity duration-150'
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
