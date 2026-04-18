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

    // Detect WiFi ↔ cellular transitions (fires even without full offline/online cycle)
    const handleConnectionChange = () => {
      // Network type changed (WiFi ↔ cellular) — trigger reconnect if we have an active connection
      if (remoteConnectionId) {
        toast.info('Network type changed, reconnecting SSH...')
        reconnectMutation.mutate()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Add Network Information API listener for connection type changes
    const connection = (navigator as Navigator & {
      connection?: {
        addEventListener: (event: string, handler: () => void) => void
        removeEventListener: (event: string, handler: () => void) => void
        type?: string
        effectiveType?: string
      }
    }).connection

    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [remoteConnectionId, reconnectMutation])
}
