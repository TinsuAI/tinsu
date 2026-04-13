import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.35 : 300
const DEFAULT_WIDTH = typeof window !== 'undefined' ? window.innerWidth * 0.35 : 400
const MIN_SIZE = 80

/** Maximum number of terminal buffers to keep in memory (LRU eviction) */
const MAX_BUFFERS = 20

/** Terminal dock position options */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/** Story 5.3: Workflow type for completion handling
 * Story 5.3b: Added 'basic_task' for direct execution without BMAD workflow */
export type AgentWorkflowType = 'planning' | 'create_story' | 'dev_story' | 'basic_task' | null

/**
 * TES-1.6: Terminal buffer for persistence across navigation.
 * Stores serialized xterm.js buffer content and scroll position.
 */
export interface TerminalBuffer {
  /** Serialized xterm.js buffer from SerializeAddon */
  serializedBuffer: string
  /** Approximate scroll position for restoration */
  scrollPosition: number
  /** Timestamp for LRU eviction */
  lastUpdated: number
}

interface TerminalState {
  /** Whether the terminal dock is visible (shown/hidden) */
  isVisible: boolean
  /** Whether the terminal dock is expanded */
  isExpanded: boolean
  /** Height of the terminal dock in pixels (for top/bottom positions) */
  height: number
  /** Width of the terminal dock in pixels (for left/right positions) */
  width: number
  /** Position of the terminal dock */
  dockPosition: DockPosition
  /** ID of the currently active PTY process */
  activeProcessId: string | null
  /** ID of the task that spawned the current agent process (Story 3.4) */
  agentTaskId: string | null
  /** Story 5.3: Type of workflow running (for completion handling) */
  agentWorkflowType: AgentWorkflowType

  /** TES-1.6: Cached terminal buffers keyed by taskId */
  terminalBuffers: Record<string, TerminalBuffer>

  /** Set the visibility state */
  setVisible: (visible: boolean) => void
  /** Toggle visibility state */
  toggleVisible: () => void
  /** Set the expanded state */
  setExpanded: (expanded: boolean) => void
  /** Toggle expanded state */
  toggleExpanded: () => void
  /** Set the terminal dock height */
  setHeight: (height: number) => void
  /** Set the terminal dock width */
  setWidth: (width: number) => void
  /** Set the dock position */
  setDockPosition: (position: DockPosition) => void
  /** Set the active process ID */
  setActiveProcess: (processId: string | null) => void
  /** Set the task ID that spawned the current agent (Story 3.4) */
  setAgentTask: (taskId: string | null) => void
  /** Story 5.3: Set the workflow type for completion handling */
  setAgentWorkflowType: (workflowType: AgentWorkflowType) => void
  /** Clear agent tracking when process exits (Story 3.4) */
  clearAgent: () => void

  /** TES-1.6: Save terminal buffer for a task */
  saveBuffer: (taskId: string, buffer: string, scrollPos: number) => void
  /** TES-1.6: Get cached buffer for a task */
  getBuffer: (taskId: string) => TerminalBuffer | undefined
  /** TES-1.6: Clear buffer for a specific task (e.g., when task is deleted) */
  clearBuffer: (taskId: string) => void
  /** TES-1.6: Remove oldest buffers to stay within MAX_BUFFERS limit */
  pruneOldBuffers: () => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      isVisible: false,
      isExpanded: true,
      height: DEFAULT_HEIGHT,
      width: DEFAULT_WIDTH,
      dockPosition: 'bottom',
      activeProcessId: null,
      agentTaskId: null,
      agentWorkflowType: null,
      terminalBuffers: {},

      setVisible: (isVisible) => set({ isVisible }),
      toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),
      setExpanded: (isExpanded) => set({ isExpanded }),
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setHeight: (height) => set({ height: Math.max(MIN_SIZE, height) }),
      setWidth: (width) => set({ width: Math.max(MIN_SIZE, width) }),
      setDockPosition: (dockPosition) => set({ dockPosition }),
      setActiveProcess: (activeProcessId) => set({ activeProcessId }),
      setAgentTask: (agentTaskId) => set({ agentTaskId }),
      setAgentWorkflowType: (agentWorkflowType) => set({ agentWorkflowType }),
      clearAgent: () => set({ agentTaskId: null, activeProcessId: null, agentWorkflowType: null }),

      // TES-1.6: Terminal buffer management
      saveBuffer: (taskId, buffer, scrollPos) => {
        set((state) => ({
          terminalBuffers: {
            ...state.terminalBuffers,
            [taskId]: {
              serializedBuffer: buffer,
              scrollPosition: scrollPos,
              lastUpdated: Date.now()
            }
          }
        }))
        // Prune after save to maintain limit
        get().pruneOldBuffers()
      },

      getBuffer: (taskId) => {
        return get().terminalBuffers[taskId]
      },

      clearBuffer: (taskId) => {
        set((state) => {
          const { [taskId]: _, ...rest } = state.terminalBuffers
          return { terminalBuffers: rest }
        })
      },

      pruneOldBuffers: () => {
        set((state) => {
          const entries = Object.entries(state.terminalBuffers)
          if (entries.length <= MAX_BUFFERS) {
            return state
          }

          // Sort by lastUpdated (newest first), keep only MAX_BUFFERS
          const sorted = entries.sort((a, b) => b[1].lastUpdated - a[1].lastUpdated)
          const kept = sorted.slice(0, MAX_BUFFERS)
          return { terminalBuffers: Object.fromEntries(kept) }
        })
      }
    }),
    {
      name: 'terminal-storage',
      // Persist height, width, isExpanded, isVisible, and dockPosition
      // DO NOT persist terminalBuffers (memory/performance concern, transient state)
      partialize: (state) => ({
        height: state.height,
        width: state.width,
        isExpanded: state.isExpanded,
        isVisible: state.isVisible,
        dockPosition: state.dockPosition
      })
    }
  )
)
