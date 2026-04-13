import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores/project.store'
import { toast } from 'sonner'

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

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
 * Switch to a remote project: find-or-create local record, then start SSH tunnel.
 */
export function useOpenRemoteProject() {
  const queryClient = useQueryClient()
  const setProject = useProjectStore((s) => s.setProject)

  return useMutation({
    mutationFn: async ({
      remoteProjectId,
      connectionId,
    }: {
      remoteProjectId: string
      connectionId: string
    }) => {
      // 1. Find or create local project record linked to remote project
      const projectResult = await commands.openRemoteProject(remoteProjectId)
      if (projectResult.status === 'error')
        throw new Error(JSON.stringify(projectResult.error))
      const project = projectResult.data

      // 2. Start SSH hook forwarder (idempotent — no-op if already running)
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
