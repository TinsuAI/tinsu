import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTaskDetailPanelStore } from './task-detail-panel.store'

describe('task-detail-panel.store', () => {
  // Reset store state before each test
  beforeEach(() => {
    const store = useTaskDetailPanelStore.getState()
    // Reset to initial state
    useTaskDetailPanelStore.setState({
      isOpen: false,
      activeTaskId: null,
      previousFocusElement: null
    })
  })

  describe('initial state', () => {
    it('should have isOpen as false initially', () => {
      const { isOpen } = useTaskDetailPanelStore.getState()
      expect(isOpen).toBe(false)
    })

    it('should have activeTaskId as null initially', () => {
      const { activeTaskId } = useTaskDetailPanelStore.getState()
      expect(activeTaskId).toBeNull()
    })

    it('should have previousFocusElement as null initially', () => {
      const { previousFocusElement } = useTaskDetailPanelStore.getState()
      expect(previousFocusElement).toBeNull()
    })
  })

  describe('openPanel', () => {
    it('should set isOpen to true', () => {
      const { openPanel } = useTaskDetailPanelStore.getState()

      openPanel('task-123')

      const { isOpen } = useTaskDetailPanelStore.getState()
      expect(isOpen).toBe(true)
    })

    it('should set activeTaskId to the provided taskId', () => {
      const { openPanel } = useTaskDetailPanelStore.getState()

      openPanel('task-456')

      const { activeTaskId } = useTaskDetailPanelStore.getState()
      expect(activeTaskId).toBe('task-456')
    })

    it('should capture the current document.activeElement', () => {
      // Create a mock element to be the active element
      const mockElement = document.createElement('button')
      mockElement.id = 'test-button'
      document.body.appendChild(mockElement)
      mockElement.focus()

      const { openPanel } = useTaskDetailPanelStore.getState()
      openPanel('task-789')

      const { previousFocusElement } = useTaskDetailPanelStore.getState()
      expect(previousFocusElement).toBe(mockElement)

      // Cleanup
      document.body.removeChild(mockElement)
    })
  })

  describe('closePanel', () => {
    it('should set isOpen to false', () => {
      // First open the panel
      useTaskDetailPanelStore.setState({ isOpen: true, activeTaskId: 'task-123' })

      const { closePanel } = useTaskDetailPanelStore.getState()
      closePanel()

      const { isOpen } = useTaskDetailPanelStore.getState()
      expect(isOpen).toBe(false)
    })

    it('should set activeTaskId to null', () => {
      // First open the panel
      useTaskDetailPanelStore.setState({ isOpen: true, activeTaskId: 'task-123' })

      const { closePanel } = useTaskDetailPanelStore.getState()
      closePanel()

      const { activeTaskId } = useTaskDetailPanelStore.getState()
      expect(activeTaskId).toBeNull()
    })

    it('should restore focus to the previous element after a delay', async () => {
      vi.useFakeTimers()

      // Create and focus a mock element
      const mockElement = document.createElement('button')
      mockElement.id = 'previous-focus'
      document.body.appendChild(mockElement)
      const focusSpy = vi.spyOn(mockElement, 'focus')

      // Set up the store with the mock element as previousFocusElement
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123',
        previousFocusElement: mockElement
      })

      const { closePanel } = useTaskDetailPanelStore.getState()
      closePanel()

      // Focus should not be called immediately
      expect(focusSpy).not.toHaveBeenCalled()

      // Advance timers by 100ms
      vi.advanceTimersByTime(100)

      // Now focus should have been called
      expect(focusSpy).toHaveBeenCalled()

      // Cleanup
      document.body.removeChild(mockElement)
      vi.useRealTimers()
    })
  })

  describe('switchTask', () => {
    it('should update activeTaskId without changing isOpen', () => {
      // First open the panel with a task
      useTaskDetailPanelStore.setState({ isOpen: true, activeTaskId: 'task-123' })

      const { switchTask } = useTaskDetailPanelStore.getState()
      switchTask('task-456')

      const { isOpen, activeTaskId } = useTaskDetailPanelStore.getState()
      expect(isOpen).toBe(true)
      expect(activeTaskId).toBe('task-456')
    })

    it('should not modify previousFocusElement', () => {
      const mockElement = document.createElement('button')

      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123',
        previousFocusElement: mockElement
      })

      const { switchTask } = useTaskDetailPanelStore.getState()
      switchTask('task-456')

      const { previousFocusElement } = useTaskDetailPanelStore.getState()
      expect(previousFocusElement).toBe(mockElement)
    })
  })
})
