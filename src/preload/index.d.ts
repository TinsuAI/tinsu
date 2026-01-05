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

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    // trpc-electron exposes this via exposeElectronTRPC()
    electronTRPC: RendererGlobalElectronTRPC
  }
}
