import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { exposeElectronTRPC } from 'trpc-electron/main'
import type { ActivityEventPayload } from '../shared/types/activity.types'

// Story 3.9: File change event types
interface FileChangeEvent {
  taskId: string
  taskTitle: string
  filePath: string
}

// Custom APIs for renderer
const api = {
  // Story 3.9: Subscribe to file change events
  onFileChange: (callback: (event: FileChangeEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FileChangeEvent) => {
      callback(data)
    }
    ipcRenderer.on('file-change', handler)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('file-change', handler)
    }
  },

  // TES-2.13: Subscribe to activity events for real-time streaming
  onActivityCreated: (callback: (event: ActivityEventPayload) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ActivityEventPayload) => {
      callback(data)
    }
    ipcRenderer.on('activity-created', handler)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('activity-created', handler)
    }
  }
}

// Expose tRPC IPC bridge to renderer
// Must be called before context isolation check
exposeElectronTRPC()

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
