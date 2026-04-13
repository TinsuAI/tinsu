import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryViewStore } from './story-view.store'

describe('useStoryViewStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useStoryViewStore.setState({
      activeStoryId: null,
      isEditing: false
    })
  })

  describe('initial state', () => {
    it('has null activeStoryId initially', () => {
      const state = useStoryViewStore.getState()
      expect(state.activeStoryId).toBeNull()
    })

    it('has isEditing false initially', () => {
      const state = useStoryViewStore.getState()
      expect(state.isEditing).toBe(false)
    })
  })

  describe('openStory', () => {
    it('sets activeStoryId to the provided id', () => {
      useStoryViewStore.getState().openStory('story-123')

      expect(useStoryViewStore.getState().activeStoryId).toBe('story-123')
    })

    it('resets isEditing to false when opening a story', () => {
      useStoryViewStore.setState({ isEditing: true })
      useStoryViewStore.getState().openStory('story-123')

      expect(useStoryViewStore.getState().isEditing).toBe(false)
    })
  })

  describe('closeStory', () => {
    it('sets activeStoryId to null', () => {
      useStoryViewStore.setState({ activeStoryId: 'story-123' })
      useStoryViewStore.getState().closeStory()

      expect(useStoryViewStore.getState().activeStoryId).toBeNull()
    })

    it('resets isEditing to false when closing', () => {
      useStoryViewStore.setState({ activeStoryId: 'story-123', isEditing: true })
      useStoryViewStore.getState().closeStory()

      expect(useStoryViewStore.getState().isEditing).toBe(false)
    })
  })

  describe('setEditing', () => {
    it('sets isEditing to true', () => {
      useStoryViewStore.getState().setEditing(true)

      expect(useStoryViewStore.getState().isEditing).toBe(true)
    })

    it('sets isEditing to false', () => {
      useStoryViewStore.setState({ isEditing: true })
      useStoryViewStore.getState().setEditing(false)

      expect(useStoryViewStore.getState().isEditing).toBe(false)
    })
  })

  describe('toggleEditing', () => {
    it('toggles isEditing from false to true', () => {
      useStoryViewStore.getState().toggleEditing()

      expect(useStoryViewStore.getState().isEditing).toBe(true)
    })

    it('toggles isEditing from true to false', () => {
      useStoryViewStore.setState({ isEditing: true })
      useStoryViewStore.getState().toggleEditing()

      expect(useStoryViewStore.getState().isEditing).toBe(false)
    })
  })
})
