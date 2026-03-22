import { create } from 'zustand'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'

/**
 * BMAD Planning Workspace phases.
 *
 * Story 9.1: Planning Workspace Route & Navigation
 */
export type PlanningPhase = 'analysis' | 'planning' | 'solutioning'

interface PlanningWorkspaceState {
  /** Whether the planning workspace is open */
  isOpen: boolean
  /** Currently active phase tab */
  activePhase: PlanningPhase
  /** Currently selected workflow key in the sidebar */
  selectedWorkflowKey: string | null
  /** Whether the chat panel is open (Story 10.2) */
  isChatOpen: boolean
  /** Target chat session ID for cross-component navigation (Story 10.7) */
  targetChatSessionId: string | null
}

interface PlanningWorkspaceActions {
  /** Open the planning workspace, optionally jumping to a specific phase */
  openWorkspace: (phase?: PlanningPhase) => void
  /** Close the workspace and return to the board */
  closeWorkspace: () => void
  /** Switch the active phase tab */
  setActivePhase: (phase: PlanningPhase) => void
  /** Select a workflow in the sidebar */
  setSelectedWorkflow: (key: string | null) => void
  /** Open workspace directly to a specific artifact (Story 9.3) */
  openWorkspaceToArtifact: (workflowKey: string) => void
  /** Toggle the chat panel open/closed (Story 10.2) */
  toggleChat: () => void
  /** Open the chat panel (Story 10.2) */
  openChat: () => void
  /** Close the chat panel (Story 10.2) */
  closeChat: () => void
  /** Open chat panel and navigate to a specific session (Story 10.7, AC: 2) */
  openChatToSession: (sessionId: string) => void
  /** Clear the target chat session ID after ChatPanel processes it (Story 10.7) */
  clearTargetChatSession: () => void
}

export const usePlanningWorkspaceStore = create<
  PlanningWorkspaceState & PlanningWorkspaceActions
>()((set) => ({
  // Initial state
  isOpen: false,
  activePhase: 'analysis',
  selectedWorkflowKey: null,
  isChatOpen: false,
  targetChatSessionId: null,

  // Actions
  openWorkspace: (phase) =>
    set({
      isOpen: true,
      activePhase: phase ?? 'analysis',
      selectedWorkflowKey: null
    }),

  closeWorkspace: () =>
    set({
      isOpen: false,
      selectedWorkflowKey: null
    }),

  setActivePhase: (phase) =>
    set({
      activePhase: phase,
      selectedWorkflowKey: null
    }),

  setSelectedWorkflow: (key) =>
    set({
      selectedWorkflowKey: key
    }),

  openWorkspaceToArtifact: (workflowKey) => {
    const workflow = BMAD_WORKFLOWS.find((w) => w.key === workflowKey)
    set({
      isOpen: true,
      activePhase: workflow?.phase ?? 'analysis',
      selectedWorkflowKey: workflowKey
    })
  },

  // Story 10.2: Chat panel actions
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),

  // Story 10.7: Cross-component chat session navigation
  openChatToSession: (sessionId) => set({ isChatOpen: true, targetChatSessionId: sessionId }),
  clearTargetChatSession: () => set({ targetChatSessionId: null })
}))
