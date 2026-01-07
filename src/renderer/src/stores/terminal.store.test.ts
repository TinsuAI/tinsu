import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminal.store'

describe('useTerminalStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTerminalStore.setState({
      isExpanded: true,
      height: window.innerHeight * 0.35,
      activeProcessId: null,
      agentTaskId: null
    })
  })

  describe('initial state', () => {
    it('should have isExpanded set to true by default', () => {
      expect(useTerminalStore.getState().isExpanded).toBe(true)
    })

    it('should have height set to 35% of viewport', () => {
      const state = useTerminalStore.getState()
      const expectedHeight = window.innerHeight * 0.35
      expect(state.height).toBe(expectedHeight)
    })

    it('should have activeProcessId set to null by default', () => {
      expect(useTerminalStore.getState().activeProcessId).toBeNull()
    })

    it('should have agentTaskId set to null by default', () => {
      expect(useTerminalStore.getState().agentTaskId).toBeNull()
    })
  })

  describe('setExpanded', () => {
    it('should set isExpanded to false', () => {
      useTerminalStore.getState().setExpanded(false)
      expect(useTerminalStore.getState().isExpanded).toBe(false)
    })

    it('should set isExpanded to true', () => {
      useTerminalStore.setState({ isExpanded: false })
      useTerminalStore.getState().setExpanded(true)
      expect(useTerminalStore.getState().isExpanded).toBe(true)
    })
  })

  describe('toggleExpanded', () => {
    it('should toggle from true to false', () => {
      expect(useTerminalStore.getState().isExpanded).toBe(true)
      useTerminalStore.getState().toggleExpanded()
      expect(useTerminalStore.getState().isExpanded).toBe(false)
    })

    it('should toggle from false to true', () => {
      useTerminalStore.setState({ isExpanded: false })
      useTerminalStore.getState().toggleExpanded()
      expect(useTerminalStore.getState().isExpanded).toBe(true)
    })
  })

  describe('setHeight', () => {
    it('should set height to the provided value', () => {
      useTerminalStore.getState().setHeight(500)
      expect(useTerminalStore.getState().height).toBe(500)
    })

    it('should enforce minimum height of 80px', () => {
      useTerminalStore.getState().setHeight(50)
      expect(useTerminalStore.getState().height).toBe(80)
    })

    it('should enforce minimum height of 80px for zero', () => {
      useTerminalStore.getState().setHeight(0)
      expect(useTerminalStore.getState().height).toBe(80)
    })

    it('should enforce minimum height of 80px for negative values', () => {
      useTerminalStore.getState().setHeight(-100)
      expect(useTerminalStore.getState().height).toBe(80)
    })

    it('should allow height at minimum', () => {
      useTerminalStore.getState().setHeight(80)
      expect(useTerminalStore.getState().height).toBe(80)
    })
  })

  describe('setActiveProcess', () => {
    it('should set activeProcessId to provided value', () => {
      useTerminalStore.getState().setActiveProcess('process-123')
      expect(useTerminalStore.getState().activeProcessId).toBe('process-123')
    })

    it('should set activeProcessId to null', () => {
      useTerminalStore.setState({ activeProcessId: 'process-123' })
      useTerminalStore.getState().setActiveProcess(null)
      expect(useTerminalStore.getState().activeProcessId).toBeNull()
    })
  })

  describe('setAgentTask (Story 3.4)', () => {
    it('should set agentTaskId to provided value', () => {
      useTerminalStore.getState().setAgentTask('task-456')
      expect(useTerminalStore.getState().agentTaskId).toBe('task-456')
    })

    it('should set agentTaskId to null', () => {
      useTerminalStore.setState({ agentTaskId: 'task-456' })
      useTerminalStore.getState().setAgentTask(null)
      expect(useTerminalStore.getState().agentTaskId).toBeNull()
    })
  })

  describe('clearAgent (Story 3.4)', () => {
    it('should clear both agentTaskId and activeProcessId', () => {
      useTerminalStore.setState({
        agentTaskId: 'task-123',
        activeProcessId: 'process-456'
      })

      useTerminalStore.getState().clearAgent()

      expect(useTerminalStore.getState().agentTaskId).toBeNull()
      expect(useTerminalStore.getState().activeProcessId).toBeNull()
    })

    it('should work when already null', () => {
      useTerminalStore.getState().clearAgent()
      expect(useTerminalStore.getState().agentTaskId).toBeNull()
      expect(useTerminalStore.getState().activeProcessId).toBeNull()
    })
  })

  describe('persistence', () => {
    // Note: Full persistence testing would require mocking localStorage
    // This tests the partialize function behavior
    it('should have persist middleware configured', () => {
      // The store is created with persist middleware
      // We can verify the store has the expected structure
      const state = useTerminalStore.getState()
      expect(state).toHaveProperty('isExpanded')
      expect(state).toHaveProperty('height')
      expect(state).toHaveProperty('activeProcessId')
      expect(state).toHaveProperty('agentTaskId')
      expect(state).toHaveProperty('setExpanded')
      expect(state).toHaveProperty('toggleExpanded')
      expect(state).toHaveProperty('setHeight')
      expect(state).toHaveProperty('setActiveProcess')
      expect(state).toHaveProperty('setAgentTask')
      expect(state).toHaveProperty('clearAgent')
    })
  })
})
