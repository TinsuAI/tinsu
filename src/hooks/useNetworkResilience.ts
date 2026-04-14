import { useEffect } from 'react'
import { useProjectStore } from '@renderer/stores/project.store'
import { useReconnectRemoteProject } from './useRemoteProjectSwitcher'
import { toast } from 'sonner'

/**
 * Story 3.4 AC: Mobile SSH Connection Flow - Network Resilience
 * Monitors online/offline events and triggers SSH reconnection when network is restored.
 */
export function useNetworkResilience() {
  const remoteConnectionId = useProjectStore((s) => s.remoteConnectionId)
  const reconnectMutation = useReconnectRemoteProject()

  useEffect(() => {
    const handleOnline = () => {
      if (remoteConnectionId) {
        toast.info('Network restored, reconnecting SSH...')
        reconnectMutation.mutate()
      }
    }

    const handleOffline = () => {
      if (remoteConnectionId) {
        toast.warning('Network connection lost')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [remoteConnectionId, reconnectMutation])
}
