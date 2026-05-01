/**
 * RemoteSyncBanner — full-width status banner for remote sync events.
 *
 * Variants:
 *   lease-lost  Amber — "Another device is now controlling this project. You're in
 *               view-only mode." + "Take Over" button + dismiss.
 *   error       Red   — "Failed to sync — last updated X ago." + "Retry" button.
 *
 * Reads from useSyncStore; actions call Tauri commands via hooks.
 *
 * Desktop only — mobile has its own variant in src/mobile/components/sync/.
 * Do NOT add useIsMobile() branches here.
 *
 * Phase 4: Multi-device remote project sync.
 */

import { useState } from 'react'
import { X, AlertTriangle, CloudOff, RefreshCw, ShieldCheck } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
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
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
  return `${Math.floor(diffSecs / 86400)}d ago`
}

// ---------------------------------------------------------------------------
// RemoteSyncBanner
// ---------------------------------------------------------------------------

interface RemoteSyncBannerProps {
  className?: string
}

/**
 * Renders a full-width banner when the active remote project has a sync
 * warning (lease-lost or error). Returns null when status is idle/pulling/pushing.
 */
export function RemoteSyncBanner({ className }: RemoteSyncBannerProps) {
  const remoteProjectId = useProjectStore((s) => s.remoteProjectId)
  const syncState = useSyncStore(
    (s) => (remoteProjectId ? s.projects[remoteProjectId] : null) ?? null
  )

  if (!remoteProjectId || !syncState) return null
  if (syncState.status !== 'lease-lost' && syncState.status !== 'error') return null
  if (syncState.bannerDismissed) return null

  if (syncState.status === 'lease-lost') {
    return (
      <LeaseLostBanner
        remoteProjectId={remoteProjectId}
        className={className}
      />
    )
  }

  return (
    <ErrorBanner
      remoteProjectId={remoteProjectId}
      lastPullAt={syncState.lastPullAt}
      errorMessage={syncState.error}
      className={className}
    />
  )
}

// ---------------------------------------------------------------------------
// LeaseLostBanner
// ---------------------------------------------------------------------------

function LeaseLostBanner({
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
      data-testid="remote-sync-banner-lease-lost"
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        'bg-amber-50 dark:bg-amber-950/40',
        'border-b border-amber-200 dark:border-amber-800/60',
        'text-amber-900 dark:text-amber-200',
        className
      )}
    >
      {/* Icon */}
      <AlertTriangle
        className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400"
        aria-hidden="true"
      />

      {/* Message */}
      <p className="flex-1 text-sm font-medium leading-snug">
        Another device is now controlling this project.{' '}
        <span className="font-normal opacity-80">You&apos;re in view-only mode.</span>
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleTakeOver}
          disabled={isClaiming}
          data-testid="remote-sync-banner-take-over"
          className={cn(
            'h-7 px-3 text-xs font-semibold border-amber-300 dark:border-amber-700',
            'bg-amber-100 dark:bg-amber-900/40',
            'text-amber-900 dark:text-amber-200',
            'hover:bg-amber-200 dark:hover:bg-amber-900/60',
            'disabled:opacity-50'
          )}
        >
          {isClaiming ? (
            <>
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              Claiming…
            </>
          ) : (
            <>
              <ShieldCheck className="mr-1.5 h-3 w-3" />
              Take Over
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => dismissBanner(remoteProjectId)}
          aria-label="Dismiss banner"
          data-testid="remote-sync-banner-dismiss"
          className={cn(
            'flex items-center justify-center rounded-md p-1',
            'text-amber-600 dark:text-amber-400',
            'hover:bg-amber-100 dark:hover:bg-amber-900/40',
            'transition-colors duration-150'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------

function ErrorBanner({
  remoteProjectId,
  lastPullAt,
  errorMessage,
  className,
}: {
  remoteProjectId: string
  lastPullAt?: number
  errorMessage?: string
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

  const lastUpdatedLabel = lastPullAt ? `last updated ${timeAgo(lastPullAt)}` : 'sync unavailable'

  return (
    <div
      role="alert"
      data-testid="remote-sync-banner-error"
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        'bg-destructive/8 dark:bg-destructive/15',
        'border-b border-destructive/30',
        'text-destructive dark:text-red-300',
        className
      )}
    >
      {/* Icon */}
      <CloudOff
        className="h-4 w-4 shrink-0 text-destructive dark:text-red-400"
        aria-hidden="true"
      />

      {/* Message */}
      <p className="flex-1 text-sm font-medium leading-snug">
        Failed to sync —{' '}
        <span className="font-normal opacity-80">{lastUpdatedLabel}.</span>
        {errorMessage && (
          <span className="ml-1 font-normal opacity-60 text-xs">({errorMessage})</span>
        )}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRetry}
          disabled={isRetrying}
          data-testid="remote-sync-banner-retry"
          className={cn(
            'h-7 px-3 text-xs font-semibold',
            'border-destructive/40',
            'bg-destructive/8 dark:bg-destructive/20',
            'text-destructive dark:text-red-300',
            'hover:bg-destructive/15 dark:hover:bg-destructive/30',
            'disabled:opacity-50'
          )}
        >
          {isRetrying ? (
            <>
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              Retrying…
            </>
          ) : (
            'Retry'
          )}
        </Button>

        <button
          type="button"
          onClick={() => dismissBanner(remoteProjectId)}
          aria-label="Dismiss banner"
          data-testid="remote-sync-banner-dismiss"
          className={cn(
            'flex items-center justify-center rounded-md p-1',
            'text-destructive/70 dark:text-red-400',
            'hover:bg-destructive/10 dark:hover:bg-destructive/20',
            'transition-colors duration-150'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
