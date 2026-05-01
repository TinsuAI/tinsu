import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { invoke } from '@tauri-apps/api/core'
import { useProjectStore } from '@renderer/stores/project.store'
import { useSyncStore } from '@renderer/stores/sync.store'
import { toast } from 'sonner'
import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

/**
 * Hook to subscribe to real-time SSH status changes.
 */
export function useSshStatusSubscription(onStatusChange: (payload: { connection_id: string; is_active: boolean }) => void) {
  const callbackRef = useRef(onStatusChange)
  callbackRef.current = onStatusChange

  useEffect(() => {
    let cancelled = false
    let unlisten: UnlistenFn | undefined

    listen<{ connection_id: string; is_active: boolean }>('ssh:status-changed', (event) => {
      callbackRef.current(event.payload)
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => {})

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])
}

/**
 * Poll hook forwarder status for a specific connection_id.
 * Only runs when enabled (popover open).
 */
export function useRemoteConnectionStatus(connectionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['remoteHookStatus', connectionId],
    queryFn: async () => {
      const result = await commands.getRemoteHookStatus(connectionId!)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: enabled && !!connectionId,
    refetchInterval: 5000, // Poll every 5 seconds while open
    staleTime: 4000,
  })
}

/**
 * Switch to a remote project: pull+claim lease (sync open), find-or-create local record,
 * then start SSH tunnel.
 *
 * Phase 4: `open_remote_project_sync` is called BEFORE any data fetch hooks fire,
 * so the local cache DB is fresh before the UI reads task/sprint/epic data.
 */
export function useOpenRemoteProject() {
  const queryClient = useQueryClient()
  const setProject = useProjectStore((s) => s.setProject)
  const { clearProject: clearSyncProject } = useSyncStore()

  return useMutation({
    mutationFn: async ({
      remoteProjectId,
      connectionId,
    }: {
      remoteProjectId: string
      connectionId: string
    }) => {
      // 0. Close any previously active remote project sync (best-effort).
      const prevRemoteProjectId = useProjectStore.getState().remoteProjectId
      if (prevRemoteProjectId && prevRemoteProjectId !== remoteProjectId) {
        try {
          await invoke('close_remote_project_sync', { remoteProjectId: prevRemoteProjectId })
        } catch {
          // Non-fatal — previous project may already be closed.
        }
        clearSyncProject(prevRemoteProjectId)
      }

      // 1. Open sync for the new project: pull + claim lease + start heartbeat.
      //    This MUST happen before data fetch so UI reads fresh cache.
      const syncResult = await invoke<null | { status: string; error?: unknown }>(
        'open_remote_project_sync',
        { connectionId, remoteProjectId }
      )
      // Tauri commands return null on success in some configurations; treat non-error as ok.
      if (syncResult && typeof syncResult === 'object' && (syncResult as { status?: string }).status === 'error') {
        throw new Error(
          JSON.stringify((syncResult as { error?: unknown }).error ?? 'sync open failed')
        )
      }

      // 2. Find or create local project record linked to remote project.
      const projectResult = await commands.openRemoteProject(remoteProjectId)
      if (projectResult.status === 'error')
        throw new Error(JSON.stringify(projectResult.error))
      const project = projectResult.data

      // 3. Start SSH hook forwarder (idempotent — no-op if already running).
      const forwarderResult = await commands.startRemoteHookForwarder(connectionId)
      if (forwarderResult.status === 'error')
        throw new Error(JSON.stringify(forwarderResult.error))

      return { project, connectionId }
    },
    onSuccess: ({ project, connectionId }) => {
      setProject(
        project.id,
        project.path,
        project.name,
        project.remote_project_id ?? null,
        connectionId
      )
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] })
      toast.success(`Switched to ${project.name}`)
    },
    onError: (err: Error) => {
      toast.error(`Failed to switch project: ${err.message}`)
    },
  })
}

/**
 * Reconnect SSH for the currently active remote project.
 */
export function useReconnectRemoteProject() {
  const remoteConnectionId = useProjectStore((s) => s.remoteConnectionId)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!remoteConnectionId) throw new Error('No remote connection active')
      const result = await commands.startRemoteHookForwarder(remoteConnectionId)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remoteHookStatus', remoteConnectionId] })
      toast.success('Reconnecting...')
    },
    onError: (err: Error) => {
      toast.error(`Reconnect failed: ${err.message}`)
    },
  })
}
