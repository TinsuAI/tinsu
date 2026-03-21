import { describe, it, expect, beforeEach } from 'vitest'
import { usePlanningWorkspaceStore } from './planning-workspace.store'

describe('usePlanningWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePlanningWorkspaceStore.setState({
      isOpen: false,
      activePhase: 'analysis',
      selectedWorkflowKey: null
    })
  })

  describe('initial state', () => {
    it('starts closed with analysis phase and no workflow selected', () => {
      const state = usePlanningWorkspaceStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.activePhase).toBe('analysis')
      expect(state.selectedWorkflowKey).toBeNull()
    })
  })

  describe('openWorkspace', () => {
    it('opens workspace with default analysis phase', () => {
      usePlanningWorkspaceStore.getState().openWorkspace()

      const state = usePlanningWorkspaceStore.getState()
      expect(state.isOpen).toBe(true)
      expect(state.activePhase).toBe('analysis')
      expect(state.selectedWorkflowKey).toBeNull()
    })

    it('opens workspace with specified phase', () => {
      usePlanningWorkspaceStore.getState().openWorkspace('solutioning')

      const state = usePlanningWorkspaceStore.getState()
      expect(state.isOpen).toBe(true)
      expect(state.activePhase).toBe('solutioning')
    })

    it('clears selected workflow when opening', () => {
      usePlanningWorkspaceStore.setState({ selectedWorkflowKey: 'prd' })
      usePlanningWorkspaceStore.getState().openWorkspace('planning')

      expect(usePlanningWorkspaceStore.getState().selectedWorkflowKey).toBeNull()
    })
  })

  describe('closeWorkspace', () => {
    it('closes workspace and clears workflow selection', () => {
      usePlanningWorkspaceStore.setState({
        isOpen: true,
        activePhase: 'planning',
        selectedWorkflowKey: 'prd'
      })

      usePlanningWorkspaceStore.getState().closeWorkspace()

      const state = usePlanningWorkspaceStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.selectedWorkflowKey).toBeNull()
    })

    it('preserves active phase on close', () => {
      usePlanningWorkspaceStore.setState({
        isOpen: true,
        activePhase: 'solutioning'
      })

      usePlanningWorkspaceStore.getState().closeWorkspace()

      expect(usePlanningWorkspaceStore.getState().activePhase).toBe('solutioning')
    })
  })

  describe('setActivePhase', () => {
    it('switches the active phase', () => {
      usePlanningWorkspaceStore.getState().setActivePhase('planning')
      expect(usePlanningWorkspaceStore.getState().activePhase).toBe('planning')

      usePlanningWorkspaceStore.getState().setActivePhase('solutioning')
      expect(usePlanningWorkspaceStore.getState().activePhase).toBe('solutioning')

      usePlanningWorkspaceStore.getState().setActivePhase('analysis')
      expect(usePlanningWorkspaceStore.getState().activePhase).toBe('analysis')
    })

    it('clears workflow selection on phase switch', () => {
      usePlanningWorkspaceStore.setState({ selectedWorkflowKey: 'prd' })
      usePlanningWorkspaceStore.getState().setActivePhase('solutioning')

      expect(usePlanningWorkspaceStore.getState().selectedWorkflowKey).toBeNull()
    })
  })

  describe('setSelectedWorkflow', () => {
    it('selects a workflow', () => {
      usePlanningWorkspaceStore.getState().setSelectedWorkflow('prd')
      expect(usePlanningWorkspaceStore.getState().selectedWorkflowKey).toBe('prd')
    })

    it('clears selection when null', () => {
      usePlanningWorkspaceStore.setState({ selectedWorkflowKey: 'prd' })
      usePlanningWorkspaceStore.getState().setSelectedWorkflow(null)

      expect(usePlanningWorkspaceStore.getState().selectedWorkflowKey).toBeNull()
    })
  })
})
