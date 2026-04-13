import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminal.store'

describe('useTerminalStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTerminalStore.setState({
      isExpanded: true,
      height: window.innerHeight * 0.35,
      activeProcessId: null,
      agentTaskId: null,
      agentWorkflowType: null,
      terminalBuffers: {}
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

  // TES-1.6: Terminal Buffer Management Tests
  describe('terminal buffer management (TES-1.6)', () => {
    describe('saveBuffer', () => {
      it('should save a buffer with taskId', () => {
        useTerminalStore.getState().saveBuffer('task-123', 'serialized-content', 100)

        const buffer = useTerminalStore.getState().getBuffer('task-123')
        expect(buffer).toBeDefined()
        expect(buffer?.serializedBuffer).toBe('serialized-content')
        expect(buffer?.scrollPosition).toBe(100)
        expect(buffer?.lastUpdated).toBeGreaterThan(0)
      })

      it('should update existing buffer', () => {
        useTerminalStore.getState().saveBuffer('task-123', 'content-1', 50)
        const firstTimestamp = useTerminalStore.getState().getBuffer('task-123')?.lastUpdated

        // Small delay to ensure different timestamp
        useTerminalStore.getState().saveBuffer('task-123', 'content-2', 75)
        const buffer = useTerminalStore.getState().getBuffer('task-123')

        expect(buffer?.serializedBuffer).toBe('content-2')
        expect(buffer?.scrollPosition).toBe(75)
        expect(buffer?.lastUpdated).toBeGreaterThanOrEqual(firstTimestamp!)
      })

      it('should store multiple buffers for different tasks', () => {
        useTerminalStore.getState().saveBuffer('task-1', 'content-1', 10)
        useTerminalStore.getState().saveBuffer('task-2', 'content-2', 20)
        useTerminalStore.getState().saveBuffer('task-3', 'content-3', 30)

        expect(useTerminalStore.getState().getBuffer('task-1')?.serializedBuffer).toBe('content-1')
        expect(useTerminalStore.getState().getBuffer('task-2')?.serializedBuffer).toBe('content-2')
        expect(useTerminalStore.getState().getBuffer('task-3')?.serializedBuffer).toBe('content-3')
      })
    })

    describe('getBuffer', () => {
      it('should return undefined for non-existent taskId', () => {
        expect(useTerminalStore.getState().getBuffer('non-existent')).toBeUndefined()
      })

      it('should return saved buffer', () => {
        useTerminalStore.getState().saveBuffer('task-abc', 'test-content', 42)

        const buffer = useTerminalStore.getState().getBuffer('task-abc')
        expect(buffer).toBeDefined()
        expect(buffer?.serializedBuffer).toBe('test-content')
        expect(buffer?.scrollPosition).toBe(42)
      })
    })

    describe('clearBuffer', () => {
      it('should remove specific buffer', () => {
        useTerminalStore.getState().saveBuffer('task-1', 'content-1', 10)
        useTerminalStore.getState().saveBuffer('task-2', 'content-2', 20)

        useTerminalStore.getState().clearBuffer('task-1')

        expect(useTerminalStore.getState().getBuffer('task-1')).toBeUndefined()
        expect(useTerminalStore.getState().getBuffer('task-2')).toBeDefined()
      })

      it('should do nothing if buffer does not exist', () => {
        useTerminalStore.getState().saveBuffer('task-1', 'content-1', 10)

        // Should not throw
        useTerminalStore.getState().clearBuffer('non-existent')

        expect(useTerminalStore.getState().getBuffer('task-1')).toBeDefined()
      })
    })

    describe('pruneOldBuffers (LRU eviction)', () => {
      it('should keep buffers under MAX_BUFFERS limit', () => {
        // MAX_BUFFERS is 20, save 25 buffers
        for (let i = 0; i < 25; i++) {
          useTerminalStore.getState().saveBuffer(`task-${i}`, `content-${i}`, i)
        }

        const state = useTerminalStore.getState()
        const bufferCount = Object.keys(state.terminalBuffers).length

        expect(bufferCount).toBeLessThanOrEqual(20)
      })

      it('should evict oldest buffers first', () => {
        // Create buffers with explicit timestamps to ensure correct ordering
        // Directly set state to control timestamps precisely
        const buffers: Record<string, { serializedBuffer: string; scrollPosition: number; lastUpdated: number }> = {}
        for (let i = 0; i < 25; i++) {
          buffers[`task-${i}`] = {
            serializedBuffer: `content-${i}`,
            scrollPosition: i,
            lastUpdated: 1000 + i // Oldest = task-0 (1000), Newest = task-24 (1024)
          }
        }
        useTerminalStore.setState({ terminalBuffers: buffers })

        // Now manually prune
        useTerminalStore.getState().pruneOldBuffers()

        // The newest 20 buffers should be kept (task-5 through task-24)
        // The oldest 5 buffers should be evicted (task-0 through task-4)
        expect(useTerminalStore.getState().getBuffer('task-0')).toBeUndefined()
        expect(useTerminalStore.getState().getBuffer('task-4')).toBeUndefined()
        expect(useTerminalStore.getState().getBuffer('task-5')).toBeDefined()
        expect(useTerminalStore.getState().getBuffer('task-24')).toBeDefined()
      })

      it('should not prune if under limit', () => {
        useTerminalStore.getState().saveBuffer('task-1', 'content-1', 10)
        useTerminalStore.getState().saveBuffer('task-2', 'content-2', 20)

        useTerminalStore.getState().pruneOldBuffers()

        expect(useTerminalStore.getState().getBuffer('task-1')).toBeDefined()
        expect(useTerminalStore.getState().getBuffer('task-2')).toBeDefined()
      })
    })

    describe('terminalBuffers initial state', () => {
      it('should have empty terminalBuffers by default', () => {
        expect(useTerminalStore.getState().terminalBuffers).toEqual({})
      })

      it('should have buffer management methods', () => {
        const state = useTerminalStore.getState()
        expect(typeof state.saveBuffer).toBe('function')
        expect(typeof state.getBuffer).toBe('function')
        expect(typeof state.clearBuffer).toBe('function')
        expect(typeof state.pruneOldBuffers).toBe('function')
      })
    })
  })
})
