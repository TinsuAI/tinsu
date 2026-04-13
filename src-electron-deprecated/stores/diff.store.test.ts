import { describe, it, expect, beforeEach } from 'vitest'
import { useDiffStore } from './diff.store'

describe('useDiffStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useDiffStore.setState({
      viewMode: 'split'
    })
  })

  describe('initial state', () => {
    it('should have split viewMode as default', () => {
      const { viewMode } = useDiffStore.getState()
      expect(viewMode).toBe('split')
    })
  })

  describe('setViewMode', () => {
    it('should set viewMode to unified', () => {
      const { setViewMode } = useDiffStore.getState()

      setViewMode('unified')

      const { viewMode } = useDiffStore.getState()
      expect(viewMode).toBe('unified')
    })

    it('should set viewMode to split', () => {
      const { setViewMode } = useDiffStore.getState()

      setViewMode('unified')
      setViewMode('split')

      const { viewMode } = useDiffStore.getState()
      expect(viewMode).toBe('split')
    })
  })

  describe('toggleViewMode', () => {
    it('should toggle from split to unified', () => {
      const { toggleViewMode } = useDiffStore.getState()

      toggleViewMode()

      const { viewMode } = useDiffStore.getState()
      expect(viewMode).toBe('unified')
    })

    it('should toggle from unified to split', () => {
      const { setViewMode, toggleViewMode } = useDiffStore.getState()

      setViewMode('unified')
      toggleViewMode()

      const { viewMode } = useDiffStore.getState()
      expect(viewMode).toBe('split')
    })

    it('should cycle between modes on multiple toggles', () => {
      const { toggleViewMode } = useDiffStore.getState()

      // split -> unified -> split
      toggleViewMode()
      expect(useDiffStore.getState().viewMode).toBe('unified')

      toggleViewMode()
      expect(useDiffStore.getState().viewMode).toBe('split')

      toggleViewMode()
      expect(useDiffStore.getState().viewMode).toBe('unified')
    })
  })

  describe('persistence', () => {
    it('should only persist viewMode in partialize', () => {
      // The persist middleware should only save viewMode
      // We can verify this by checking the store's persist configuration
      const persistedState = useDiffStore.persist.getOptions().partialize?.({
        viewMode: 'unified',
        setViewMode: () => {},
        toggleViewMode: () => {}
      } as ReturnType<typeof useDiffStore.getState>)

      expect(persistedState).toEqual({ viewMode: 'unified' })
    })

    it('should use correct localStorage key', () => {
      const storageKey = useDiffStore.persist.getOptions().name
      expect(storageKey).toBe('tinsu-diff-preferences')
    })
  })
})
