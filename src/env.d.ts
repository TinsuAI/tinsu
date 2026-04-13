/// <reference types="vite/client" />

// Stub type for legacy Electron preload API — no longer injected in Tauri.
// Guards in useActivitySubscription, useAgentLauncher, useFileWatcher check
// for api presence before calling. Remove in T1.3 when Tauri IPC is wired.
interface Window {
  api?: {
    onActivityCreated: (
      callback: (event: import('./shared/types/activity.types').ActivityEventPayload) => void
    ) => () => void
    onFileChange: (callback: (event: { taskId: string; taskTitle: string }) => void) => () => void
  }
}
