import { ElectronAPI } from '@electron-toolkit/preload'
import type { Operation } from '@trpc/client'
import type { TRPCResponseMessage } from '@trpc/server/rpc'

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

// Story 3.9: Custom API types
interface CustomAPI {
  onFileChange: (callback: (event: FileChangeEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
    // trpc-electron exposes this via exposeElectronTRPC()
    electronTRPC: RendererGlobalElectronTRPC
  }
}
