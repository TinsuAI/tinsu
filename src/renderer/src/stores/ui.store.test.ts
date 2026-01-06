import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './ui.store'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({ sidebarCollapsed: false, selectedSprintId: null })
  })

  it('should have initial state with sidebar expanded', () => {
    const state = useUIStore.getState()
    expect(state.sidebarCollapsed).toBe(false)
  })

  it('should set sidebar collapsed state', () => {
    const { setSidebarCollapsed } = useUIStore.getState()

    setSidebarCollapsed(true)
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)

    setSidebarCollapsed(false)
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should toggle sidebar state', () => {
    const { toggleSidebar } = useUIStore.getState()

    expect(useUIStore.getState().sidebarCollapsed).toBe(false)

    toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)

    toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  // Story 2.5: Sprint filter tests
  it('should have initial state with no sprint selected', () => {
    const state = useUIStore.getState()
    expect(state.selectedSprintId).toBeNull()
  })

  it('should set selected sprint', () => {
    const { setSelectedSprint } = useUIStore.getState()

    setSelectedSprint('sprint-1')
    expect(useUIStore.getState().selectedSprintId).toBe('sprint-1')

    setSelectedSprint('sprint-2')
    expect(useUIStore.getState().selectedSprintId).toBe('sprint-2')

    setSelectedSprint(null)
    expect(useUIStore.getState().selectedSprintId).toBeNull()
  })

  it('should clear sprint filter', () => {
    const { setSelectedSprint, clearSprintFilter } = useUIStore.getState()

    setSelectedSprint('sprint-1')
    expect(useUIStore.getState().selectedSprintId).toBe('sprint-1')

    clearSprintFilter()
    expect(useUIStore.getState().selectedSprintId).toBeNull()
  })
})
