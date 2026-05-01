/**
 * useRemoteSyncLifecycle — hooks for wiring sync commands into project open/close.
 *
 * Phase 4: Multi-device remote project sync.
 *
 * Usage:
 *   const { openSync, closeSync } = useRemoteSyncLifecycle()
 *   await openSync(connectionId, remoteProjectId)
 *   await closeSync(remoteProjectId)
 */

import { useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { useSyncStore } from '@renderer/stores/sync.store'

// ---------------------------------------------------------------------------
// Types matching Rust command signatures (until Specta regenerates bindings)
// ---------------------------------------------------------------------------

interface InvokeResult {
  status: 'ok' | 'error'
  error?: { message?: string; [k: string]: unknown }
}

async function invokeSync(cmd: string, args: Record<string, string>): Promise<void> {
  const result = (await invoke(cmd, args)) as InvokeResult | null
  if (result && result.status === 'error') {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : (result.error as { message?: string })?.message ?? 'Unknown sync error'
    )
  }
}

// ---------------------------------------------------------------------------
// useRemoteSyncLifecycle
// ---------------------------------------------------------------------------

export function useRemoteSyncLifecycle() {
  const { startListening, stopListening } = useSyncStore()

  // Set up Tauri event listeners once on mount.
  useEffect(() => {
    void startListening()
    return () => stopListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openSync = useCallback(
    async (connectionId: string, remoteProjectId: string): Promise<void> => {
      await invokeSync('open_remote_project_sync', {
        connectionId,
        remoteProjectId,
      })
    },
    []
  )

  const closeSync = useCallback(async (remoteProjectId: string): Promise<void> => {
    await invokeSync('close_remote_project_sync', { remoteProjectId })
  }, [])

  const forcePush = useCallback(async (remoteProjectId: string): Promise<void> => {
    await invokeSync('force_push_remote_db', { remoteProjectId })
  }, [])

  const claimLease = useCallback(async (remoteProjectId: string): Promise<void> => {
    await invokeSync('claim_remote_lease', { remoteProjectId })
  }, [])

  return { openSync, closeSync, forcePush, claimLease }
}

// ---------------------------------------------------------------------------
// useOpenRemoteProjectSync
// ---------------------------------------------------------------------------

/**
 * Returns a function that opens sync for a remote project and shows
 * appropriate loading/error toasts.
 */
export function useOpenRemoteProjectSync() {
  const { openSync } = useRemoteSyncLifecycle()

  return useCallback(
    async (
      connectionId: string,
      remoteProjectId: string,
      hostLabel?: string
    ): Promise<boolean> => {
      const toastId = toast.loading(
        `Syncing project from ${hostLabel ?? 'remote'}…`,
        { duration: Infinity }
      )

      try {
        await openSync(connectionId, remoteProjectId)
        toast.dismiss(toastId)
        return true
      } catch (err) {
        toast.dismiss(toastId)
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Sync failed', { description: msg })
        return false
      }
    },
    [openSync]
  )
}

// ---------------------------------------------------------------------------
// useClaimRemoteLease
// ---------------------------------------------------------------------------

/**
 * Returns a function that claims the remote lease ("Take Over" action).
 * Shows loading/error toasts and dismisses the banner on success.
 */
export function useClaimRemoteLease() {
  const { claimLease } = useRemoteSyncLifecycle()
  const { dismissBanner } = useSyncStore()

  return useCallback(
    async (remoteProjectId: string): Promise<boolean> => {
      const toastId = toast.loading('Claiming project control…', { duration: Infinity })

      try {
        await claimLease(remoteProjectId)
        toast.dismiss(toastId)
        toast.success('You now control this project')
        dismissBanner(remoteProjectId)
        return true
      } catch (err) {
        toast.dismiss(toastId)
        const msg = err instanceof Error ? err.message : String(err)
        toast.error('Failed to claim project', { description: msg })
        return false
      }
    },
    [claimLease, dismissBanner]
  )
}
