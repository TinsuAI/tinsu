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
}

export const usePlanningWorkspaceStore = create<
  PlanningWorkspaceState & PlanningWorkspaceActions
>()((set) => ({
  // Initial state
  isOpen: false,
  activePhase: 'analysis',
  selectedWorkflowKey: null,

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
  }
}))
