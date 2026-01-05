import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './ui.store'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({ sidebarCollapsed: false })
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
})
