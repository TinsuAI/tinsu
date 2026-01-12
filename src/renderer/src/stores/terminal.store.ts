import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.35 : 300
const DEFAULT_WIDTH = typeof window !== 'undefined' ? window.innerWidth * 0.35 : 400
const MIN_SIZE = 80

/** Terminal dock position options */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/** Story 5.3: Workflow type for completion handling
 * Story 5.3b: Added 'basic_task' for direct execution without BMAD workflow */
export type AgentWorkflowType = 'planning' | 'create_story' | 'dev_story' | 'basic_task' | null

interface TerminalState {
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
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      isExpanded: true,
      height: DEFAULT_HEIGHT,
      width: DEFAULT_WIDTH,
      dockPosition: 'bottom',
      activeProcessId: null,
      agentTaskId: null,
      agentWorkflowType: null,

      setExpanded: (isExpanded) => set({ isExpanded }),
      toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setHeight: (height) => set({ height: Math.max(MIN_SIZE, height) }),
      setWidth: (width) => set({ width: Math.max(MIN_SIZE, width) }),
      setDockPosition: (dockPosition) => set({ dockPosition }),
      setActiveProcess: (activeProcessId) => set({ activeProcessId }),
      setAgentTask: (agentTaskId) => set({ agentTaskId }),
      setAgentWorkflowType: (agentWorkflowType) => set({ agentWorkflowType }),
      clearAgent: () => set({ agentTaskId: null, activeProcessId: null, agentWorkflowType: null })
    }),
    {
      name: 'terminal-storage',
      // Persist height, width, isExpanded, and dockPosition, not activeProcessId (transient state)
      partialize: (state) => ({
        height: state.height,
        width: state.width,
        isExpanded: state.isExpanded,
        dockPosition: state.dockPosition
      })
    }
  )
)
