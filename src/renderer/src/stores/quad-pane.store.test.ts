import { describe, it, expect, beforeEach } from 'vitest'
import { useQuadPaneStore } from './quad-pane.store'

describe('quad-pane.store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useQuadPaneStore.setState({
      expandedSection: null,
      layoutMode: 'quad'
    })
  })

  describe('initial state', () => {
    it('has null expandedSection by default', () => {
      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBeNull()
    })

    it('has quad layoutMode by default', () => {
      const { layoutMode } = useQuadPaneStore.getState()
      expect(layoutMode).toBe('quad')
    })
  })

  describe('expandSection', () => {
    it('sets expandedSection to terminal', () => {
      const { expandSection } = useQuadPaneStore.getState()
      expandSection('terminal')

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('terminal')
    })

    it('sets expandedSection to activities', () => {
      const { expandSection } = useQuadPaneStore.getState()
      expandSection('activities')

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('activities')
    })

    it('sets expandedSection to diff', () => {
      const { expandSection } = useQuadPaneStore.getState()
      expandSection('diff')

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('diff')
    })

    it('sets expandedSection to content', () => {
      const { expandSection } = useQuadPaneStore.getState()
      expandSection('content')

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('content')
    })

    it('replaces previous expandedSection', () => {
      const { expandSection } = useQuadPaneStore.getState()
      expandSection('terminal')
      expandSection('activities')

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('activities')
    })
  })

  describe('collapseSection', () => {
    it('sets expandedSection back to null', () => {
      const store = useQuadPaneStore.getState()
      store.expandSection('terminal')
      store.collapseSection()

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBeNull()
    })

    it('works when already collapsed', () => {
      const { collapseSection } = useQuadPaneStore.getState()
      collapseSection()

      const { expandedSection } = useQuadPaneStore.getState()
      expect(expandedSection).toBeNull()
    })
  })

  describe('setLayoutMode', () => {
    it('sets layoutMode to quad', () => {
      const { setLayoutMode } = useQuadPaneStore.getState()
      setLayoutMode('tabbed')
      setLayoutMode('quad')

      const { layoutMode } = useQuadPaneStore.getState()
      expect(layoutMode).toBe('quad')
    })

    it('sets layoutMode to tabbed', () => {
      const { setLayoutMode } = useQuadPaneStore.getState()
      setLayoutMode('tabbed')

      const { layoutMode } = useQuadPaneStore.getState()
      expect(layoutMode).toBe('tabbed')
    })

    it('preserves expandedSection when changing layoutMode', () => {
      const store = useQuadPaneStore.getState()
      store.expandSection('terminal')
      store.setLayoutMode('tabbed')

      const { expandedSection, layoutMode } = useQuadPaneStore.getState()
      expect(expandedSection).toBe('terminal')
      expect(layoutMode).toBe('tabbed')
    })
  })
})
