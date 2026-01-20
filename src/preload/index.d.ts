import { ElectronAPI } from '@electron-toolkit/preload'
import type { Operation } from '@trpc/client'
import type { TRPCResponseMessage } from '@trpc/server/rpc'
import type { ActivityEventPayload } from '../shared/types/activity.types'

// Type from trpc-electron for the exposed IPC bridge
interface RendererGlobalElectronTRPC {
  sendMessage: (
    args: { method: 'request'; operation: Operation } | { method: 'subscription.stop'; id: number }
  ) => void
  onMessage: (callback: (args: TRPCResponseMessage) => void) => void
}

// Story 3.9: File change event types
interface FileChangeEvent {
  taskId: string
  taskTitle: string
  filePath: string
}

// Custom API types
interface CustomAPI {
  /** Story 3.9: Subscribe to file change events */
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void
  /** TES-2.13: Subscribe to activity events for real-time streaming */
  onActivityCreated: (callback: (event: ActivityEventPayload) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
    // trpc-electron exposes this via exposeElectronTRPC()
    electronTRPC: RendererGlobalElectronTRPC
  }
}
