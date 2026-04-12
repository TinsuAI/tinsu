import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskWorkspaceStore } from './task-workspace.store'

describe('useTaskWorkspaceStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTaskWorkspaceStore.setState({
      activeTaskId: null,
      returnTaskId: null
    })
  })

  describe('initial state', () => {
    it('should have null activeTaskId', () => {
      const state = useTaskWorkspaceStore.getState()
      expect(state.activeTaskId).toBeNull()
    })

    it('should have null returnTaskId', () => {
      const state = useTaskWorkspaceStore.getState()
      expect(state.returnTaskId).toBeNull()
    })
  })

  describe('openWorkspace', () => {
    it('should set activeTaskId to the provided task ID', () => {
      const { openWorkspace } = useTaskWorkspaceStore.getState()
      openWorkspace('task-123')

      const { activeTaskId } = useTaskWorkspaceStore.getState()
      expect(activeTaskId).toBe('task-123')
    })

    it('should clear returnTaskId when opening a workspace', () => {
      // First set a returnTaskId
      useTaskWorkspaceStore.setState({ returnTaskId: 'task-previous' })

      const { openWorkspace } = useTaskWorkspaceStore.getState()
      openWorkspace('task-123')

      const { returnTaskId } = useTaskWorkspaceStore.getState()
      expect(returnTaskId).toBeNull()
    })
  })

  describe('closeWorkspace', () => {
    it('should clear activeTaskId', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-123' })

      const { closeWorkspace } = useTaskWorkspaceStore.getState()
      closeWorkspace()

      const { activeTaskId } = useTaskWorkspaceStore.getState()
      expect(activeTaskId).toBeNull()
    })

    it('should set returnTaskId to the previously active task ID for scroll restoration', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-123' })

      const { closeWorkspace } = useTaskWorkspaceStore.getState()
      closeWorkspace()

      const { returnTaskId } = useTaskWorkspaceStore.getState()
      expect(returnTaskId).toBe('task-123')
    })
  })

  describe('clearReturnTaskId', () => {
    it('should clear the returnTaskId', () => {
      useTaskWorkspaceStore.setState({ returnTaskId: 'task-123' })

      const { clearReturnTaskId } = useTaskWorkspaceStore.getState()
      clearReturnTaskId()

      const { returnTaskId } = useTaskWorkspaceStore.getState()
      expect(returnTaskId).toBeNull()
    })
  })

  describe('full navigation flow', () => {
    it('should support complete navigation cycle: open -> close -> scroll restore', () => {
      const store = useTaskWorkspaceStore.getState()

      // Step 1: Open workspace for task
      store.openWorkspace('task-abc')
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-abc')
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBeNull()

      // Step 2: Close workspace
      useTaskWorkspaceStore.getState().closeWorkspace()
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBeNull()
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBe('task-abc')

      // Step 3: Clear return task ID after scroll restoration
      useTaskWorkspaceStore.getState().clearReturnTaskId()
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBeNull()
    })

    it('should replace active task when opening new workspace', () => {
      const store = useTaskWorkspaceStore.getState()

      // Open first task
      store.openWorkspace('task-1')
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-1')

      // Open second task (should replace)
      useTaskWorkspaceStore.getState().openWorkspace('task-2')
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-2')
      // returnTaskId should be null since we didn't close, just switched
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBeNull()
    })
  })
})
