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
  /** Whether the dashboard is explicitly shown (overrides selectedWorkflowKey) */
  showDashboard: boolean
  /** Target chat session ID for cross-component navigation (Story 10.7) */
  targetChatSessionId: string | null
  /** Command to pre-fill in ChatInput when a workflow step is clicked */
  pendingChatPrefill: string | null
  /** Persona to auto-select when a workflow step is clicked */
  pendingPersona: string | null
  /** Active chat session ID — set by ChatPanel so content panel can show session docs */
  activeChatSessionId: string | null
  /** Whether the terminal panel column is visible */
  showTerminal: boolean
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
  /** Show the dashboard panel explicitly */
  setShowDashboard: (show: boolean) => void
  /** Open workspace directly to a specific artifact (Story 9.3) */
  openWorkspaceToArtifact: (workflowKey: string) => void
  /** Navigate to a specific chat session (Story 10.7, AC: 2) */
  openChatToSession: (sessionId: string) => void
  /** Clear the target chat session ID after ChatPanel processes it (Story 10.7) */
  clearTargetChatSession: () => void
  /** Set a command to pre-fill in ChatInput and optionally the persona */
  setPendingChatPrefill: (prefill: string | null, persona?: string | null) => void
  /** Clear the pending chat prefill after it's been consumed */
  clearPendingChatPrefill: () => void
  /** Set active chat session ID (called by ChatPanel when session changes) */
  setActiveChatSessionId: (id: string | null) => void
  /** Toggle terminal panel visibility */
  setShowTerminal: (show: boolean) => void
}

export const usePlanningWorkspaceStore = create<
  PlanningWorkspaceState & PlanningWorkspaceActions
>()((set) => ({
  // Initial state
  isOpen: false,
  activePhase: 'analysis',
  selectedWorkflowKey: null,
  showDashboard: false,
  targetChatSessionId: null,
  pendingChatPrefill: null,
  pendingPersona: null,
  activeChatSessionId: null,
  showTerminal: false,

  // Actions
  openWorkspace: (phase) =>
    set({
      isOpen: true,
      activePhase: phase ?? 'analysis',
      selectedWorkflowKey: null,
      showDashboard: false
    }),

  closeWorkspace: () =>
    set({
      isOpen: false,
      selectedWorkflowKey: null,
      showDashboard: false,
      pendingChatPrefill: null,
      pendingPersona: null,
      targetChatSessionId: null
    }),

  setActivePhase: (phase) =>
    set({
      activePhase: phase,
      selectedWorkflowKey: null,
      showDashboard: false
    }),

  setSelectedWorkflow: (key) =>
    set({
      selectedWorkflowKey: key,
      showDashboard: false
    }),

  setShowDashboard: (show) =>
    set({
      showDashboard: show,
      ...(show ? { selectedWorkflowKey: null } : {})
    }),

  openWorkspaceToArtifact: (workflowKey) => {
    const workflow = BMAD_WORKFLOWS.find((w) => w.key === workflowKey)
    set({
      isOpen: true,
      activePhase: workflow?.phase ?? 'analysis',
      selectedWorkflowKey: workflowKey,
      showDashboard: false
    })
  },

  // Story 10.7: Cross-component chat session navigation
  openChatToSession: (sessionId) => set({ targetChatSessionId: sessionId }),
  clearTargetChatSession: () => set({ targetChatSessionId: null }),

  // Chat-centric layout: Prefill and workflow session state
  setPendingChatPrefill: (prefill, persona) =>
    set({ pendingChatPrefill: prefill, pendingPersona: persona ?? null }),
  clearPendingChatPrefill: () => set({ pendingChatPrefill: null, pendingPersona: null }),

  setActiveChatSessionId: (id) => set({ activeChatSessionId: id }),
  setShowTerminal: (show) => set({ showTerminal: show })
}))
