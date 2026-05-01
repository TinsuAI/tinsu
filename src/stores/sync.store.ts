/**
 * sync.store.ts — Zustand store for remote sync status.
 *
 * Listens to `sync-status` and `lease-lost` Tauri events and maintains
 * a per-project status map. Components subscribe to this store to render
 * the appropriate sync UI (SyncStatusIndicator, RemoteSyncBanner).
 *
 * Phase 4: Multi-device remote project sync.
 */

import { create } from 'zustand'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'lease-lost' | 'error'

export interface SyncProjectState {
  status: SyncStatus
  error?: string
  /** Unix seconds — last time a successful pull completed */
  lastPullAt?: number
  /** Unix seconds — last time a successful push completed */
  lastPushAt?: number
  /** Device ID of the current lease holder (when status is 'lease-lost') */
  holderDeviceId?: string
  /** Whether the user has dismissed the lease-lost banner */
  bannerDismissed: boolean
}

interface SyncStoreState {
  /** Per-project status map keyed by remote_project_id */
  projects: Record<string, SyncProjectState>

  /** True once Tauri event listeners are set up */
  listening: boolean

  // Actions
  startListening: () => Promise<void>
  stopListening: () => void
  setStatus: (remoteProjectId: string, status: SyncStatus, error?: string) => void
  recordPull: (remoteProjectId: string) => void
  recordPush: (remoteProjectId: string) => void
  setLeaseLost: (remoteProjectId: string, holderDeviceId: string) => void
  dismissBanner: (remoteProjectId: string) => void
  clearProject: (remoteProjectId: string) => void
}

// ---------------------------------------------------------------------------
// Payloads that match Rust emit shapes
// ---------------------------------------------------------------------------

interface SyncStatusPayload {
  remote_project_id: string
  status: 'pulling' | 'pushing' | 'idle' | 'error' | 'lease-lost'
  error?: string
}

interface LeaseLostPayload {
  remote_project_id: string
  holder_device_id: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let unlistenSyncStatus: UnlistenFn | null = null
let unlistenLeaseLost: UnlistenFn | null = null

const defaultProjectState = (): SyncProjectState => ({
  status: 'idle',
  bannerDismissed: false,
})

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  projects: {},
  listening: false,

  startListening: async () => {
    if (get().listening) return

    // Listen for sync-status events from Rust
    unlistenSyncStatus = await listen<SyncStatusPayload>('sync-status', (event) => {
      const { remote_project_id, status, error } = event.payload
      const store = get()

      if (status === 'idle') {
        // Idle after a successful operation — record timestamps contextually
        const existing = store.projects[remote_project_id]
        const prevStatus = existing?.status
        set((state) => ({
          projects: {
            ...state.projects,
            [remote_project_id]: {
              ...(state.projects[remote_project_id] ?? defaultProjectState()),
              status: 'idle',
              error: undefined,
              // Reset bannerDismissed when returning to idle (lease reclaimed clears banner)
              bannerDismissed: prevStatus === 'lease-lost'
                ? false
                : (state.projects[remote_project_id]?.bannerDismissed ?? false),
            },
          },
        }))
      } else {
        set((state) => ({
          projects: {
            ...state.projects,
            [remote_project_id]: {
              ...(state.projects[remote_project_id] ?? defaultProjectState()),
              status: status as SyncStatus,
              error: error,
            },
          },
        }))
      }

      // Record timestamps when transitioning out of a push/pull
      if (status === 'idle') {
        const prev = get().projects[remote_project_id]?.status
        if (prev === 'pulling') {
          get().recordPull(remote_project_id)
        } else if (prev === 'pushing') {
          get().recordPush(remote_project_id)
        }
      }
    })

    // Listen for lease-lost events from Rust heartbeat
    unlistenLeaseLost = await listen<LeaseLostPayload>('lease-lost', (event) => {
      const { remote_project_id, holder_device_id } = event.payload
      get().setLeaseLost(remote_project_id, holder_device_id)
    })

    set({ listening: true })
  },

  stopListening: () => {
    unlistenSyncStatus?.()
    unlistenLeaseLost?.()
    unlistenSyncStatus = null
    unlistenLeaseLost = null
    set({ listening: false })
  },

  setStatus: (remoteProjectId, status, error) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [remoteProjectId]: {
          ...(state.projects[remoteProjectId] ?? defaultProjectState()),
          status,
          error,
        },
      },
    }))
  },

  recordPull: (remoteProjectId) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [remoteProjectId]: {
          ...(state.projects[remoteProjectId] ?? defaultProjectState()),
          lastPullAt: Math.floor(Date.now() / 1000),
        },
      },
    }))
  },

  recordPush: (remoteProjectId) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [remoteProjectId]: {
          ...(state.projects[remoteProjectId] ?? defaultProjectState()),
          lastPushAt: Math.floor(Date.now() / 1000),
        },
      },
    }))
  },

  setLeaseLost: (remoteProjectId, holderDeviceId) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [remoteProjectId]: {
          ...(state.projects[remoteProjectId] ?? defaultProjectState()),
          status: 'lease-lost',
          holderDeviceId,
          bannerDismissed: false,
        },
      },
    }))
  },

  dismissBanner: (remoteProjectId) => {
    set((state) => ({
      projects: {
        ...state.projects,
        [remoteProjectId]: {
          ...(state.projects[remoteProjectId] ?? defaultProjectState()),
          bannerDismissed: true,
        },
      },
    }))
  },

  clearProject: (remoteProjectId) => {
    set((state) => {
      const next = { ...state.projects }
      delete next[remoteProjectId]
      return { projects: next }
    })
  },
}))

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const selectProjectSyncState = (remoteProjectId: string | null) =>
  (state: SyncStoreState): SyncProjectState | null =>
    remoteProjectId ? (state.projects[remoteProjectId] ?? null) : null
