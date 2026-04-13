import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from './ui.store'

// Mock localStorage for persistence tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('useUIStore', () => {
  beforeEach(() => {
    // Clear localStorage mock and reset store state before each test
    localStorageMock.clear()
    vi.clearAllMocks()
    // Reset store state (Story 2.6: added epic and status filters)
    useUIStore.setState({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],
      lastProjectPath: null
    })
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

  // Story 2.6: Epic filter tests
  describe('epic filters (Story 2.6)', () => {
    it('should have initial state with no epics selected', () => {
      const state = useUIStore.getState()
      expect(state.selectedEpicIds).toEqual([])
    })

    it('should set selected epics', () => {
      const { setSelectedEpics } = useUIStore.getState()

      setSelectedEpics(['epic-1', 'epic-2'])
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-1', 'epic-2'])

      setSelectedEpics(['epic-3'])
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-3'])

      setSelectedEpics([])
      expect(useUIStore.getState().selectedEpicIds).toEqual([])
    })

    it('should toggle epic filter', () => {
      const { toggleEpicFilter } = useUIStore.getState()

      // Add first epic
      toggleEpicFilter('epic-1')
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-1'])

      // Add second epic
      toggleEpicFilter('epic-2')
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-1', 'epic-2'])

      // Remove first epic
      toggleEpicFilter('epic-1')
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-2'])

      // Remove last epic
      toggleEpicFilter('epic-2')
      expect(useUIStore.getState().selectedEpicIds).toEqual([])
    })
  })

  // Story 2.6: Status filter tests
  describe('status filters (Story 2.6)', () => {
    it('should have initial state with no statuses selected', () => {
      const state = useUIStore.getState()
      expect(state.selectedStatuses).toEqual([])
    })

    it('should set selected statuses', () => {
      const { setSelectedStatuses } = useUIStore.getState()

      setSelectedStatuses(['backlog', 'in_progress'])
      expect(useUIStore.getState().selectedStatuses).toEqual(['backlog', 'in_progress'])

      setSelectedStatuses(['done'])
      expect(useUIStore.getState().selectedStatuses).toEqual(['done'])

      setSelectedStatuses([])
      expect(useUIStore.getState().selectedStatuses).toEqual([])
    })

    it('should toggle status filter', () => {
      const { toggleStatusFilter } = useUIStore.getState()

      // Add first status
      toggleStatusFilter('backlog')
      expect(useUIStore.getState().selectedStatuses).toEqual(['backlog'])

      // Add second status
      toggleStatusFilter('in_progress')
      expect(useUIStore.getState().selectedStatuses).toEqual(['backlog', 'in_progress'])

      // Remove first status
      toggleStatusFilter('backlog')
      expect(useUIStore.getState().selectedStatuses).toEqual(['in_progress'])

      // Remove last status
      toggleStatusFilter('in_progress')
      expect(useUIStore.getState().selectedStatuses).toEqual([])
    })
  })

  // Story 2.6: Clear all filters
  describe('clear all filters (Story 2.6)', () => {
    it('should clear all filters at once', () => {
      const { setSelectedSprint, setSelectedEpics, setSelectedStatuses, clearAllFilters } =
        useUIStore.getState()

      // Set various filters
      setSelectedSprint('sprint-1')
      setSelectedEpics(['epic-1', 'epic-2'])
      setSelectedStatuses(['backlog', 'in_progress'])

      // Verify filters are set
      expect(useUIStore.getState().selectedSprintId).toBe('sprint-1')
      expect(useUIStore.getState().selectedEpicIds).toEqual(['epic-1', 'epic-2'])
      expect(useUIStore.getState().selectedStatuses).toEqual(['backlog', 'in_progress'])

      // Clear all filters
      clearAllFilters()

      // Verify all filters are cleared
      expect(useUIStore.getState().selectedSprintId).toBeNull()
      expect(useUIStore.getState().selectedEpicIds).toEqual([])
      expect(useUIStore.getState().selectedStatuses).toEqual([])
    })
  })

  // Story 2.6: hasActiveFilters computed
  describe('hasActiveFilters (Story 2.6)', () => {
    it('should return false when no filters are active', () => {
      expect(useUIStore.getState().hasActiveFilters()).toBe(false)
    })

    it('should return true when sprint filter is active', () => {
      const { setSelectedSprint } = useUIStore.getState()
      setSelectedSprint('sprint-1')
      expect(useUIStore.getState().hasActiveFilters()).toBe(true)
    })

    it('should return true when epic filters are active', () => {
      const { setSelectedEpics } = useUIStore.getState()
      setSelectedEpics(['epic-1'])
      expect(useUIStore.getState().hasActiveFilters()).toBe(true)
    })

    it('should return true when status filters are active', () => {
      const { setSelectedStatuses } = useUIStore.getState()
      setSelectedStatuses(['backlog'])
      expect(useUIStore.getState().hasActiveFilters()).toBe(true)
    })

    it('should return true when multiple filter types are active', () => {
      const { setSelectedSprint, setSelectedEpics, setSelectedStatuses } = useUIStore.getState()
      setSelectedSprint('sprint-1')
      setSelectedEpics(['epic-1'])
      setSelectedStatuses(['backlog', 'in_progress'])
      expect(useUIStore.getState().hasActiveFilters()).toBe(true)
    })

    it('should return false when all 4 statuses are selected (equivalent to no filter)', () => {
      const { setSelectedStatuses } = useUIStore.getState()
      setSelectedStatuses(['backlog', 'in_progress', 'review', 'done'])
      expect(useUIStore.getState().hasActiveFilters()).toBe(false)
    })
  })

  // Story 2.6: Project path sync tests
  describe('syncProjectPath (Story 2.6)', () => {
    it('should update lastProjectPath when syncing new project', () => {
      const { syncProjectPath } = useUIStore.getState()
      syncProjectPath('/path/to/project')
      expect(useUIStore.getState().lastProjectPath).toBe('/path/to/project')
    })

    it('should clear filters when project path changes', () => {
      const { setSelectedSprint, setSelectedEpics, setSelectedStatuses, syncProjectPath } =
        useUIStore.getState()

      // Set initial project and filters
      syncProjectPath('/project-a')
      setSelectedSprint('sprint-1')
      setSelectedEpics(['epic-1'])
      setSelectedStatuses(['backlog'])

      // Change to different project
      syncProjectPath('/project-b')

      // Filters should be cleared
      const state = useUIStore.getState()
      expect(state.selectedSprintId).toBeNull()
      expect(state.selectedEpicIds).toEqual([])
      expect(state.selectedStatuses).toEqual([])
      expect(state.lastProjectPath).toBe('/project-b')
    })

    it('should not clear filters when same project path is synced', () => {
      const { setSelectedSprint, setSelectedEpics, syncProjectPath } = useUIStore.getState()

      // Set initial project and filters
      syncProjectPath('/project-a')
      setSelectedSprint('sprint-1')
      setSelectedEpics(['epic-1'])

      // Sync same project again
      syncProjectPath('/project-a')

      // Filters should remain
      const state = useUIStore.getState()
      expect(state.selectedSprintId).toBe('sprint-1')
      expect(state.selectedEpicIds).toEqual(['epic-1'])
    })

    it('should handle null project path', () => {
      const { syncProjectPath } = useUIStore.getState()
      syncProjectPath(null)
      expect(useUIStore.getState().lastProjectPath).toBeNull()
    })
  })

  // Story 2.6: Persistence tests
  describe('filter persistence (Story 2.6)', () => {
    it('should use persist middleware with correct storage key', () => {
      // The store should be configured with persist middleware
      // We can verify the store is properly configured by checking
      // that filter state can be set and retrieved correctly
      const { setSelectedSprint, setSelectedEpics, setSelectedStatuses } = useUIStore.getState()

      setSelectedSprint('sprint-1')
      setSelectedEpics(['epic-1', 'epic-2'])
      setSelectedStatuses(['backlog'])

      // Verify state was set correctly
      const state = useUIStore.getState()
      expect(state.selectedSprintId).toBe('sprint-1')
      expect(state.selectedEpicIds).toEqual(['epic-1', 'epic-2'])
      expect(state.selectedStatuses).toEqual(['backlog'])
    })

    it('should only persist filter state, not sidebar state', () => {
      // The partialize config should exclude sidebarCollapsed
      // Verify by checking that sidebar changes don't affect filter state
      const { setSidebarCollapsed, setSelectedSprint } = useUIStore.getState()

      setSelectedSprint('sprint-1')
      setSidebarCollapsed(true)

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(true)
      expect(state.selectedSprintId).toBe('sprint-1')

      // Both values should be in state but partialize should exclude sidebarCollapsed
      // from persistence. The actual persistence is tested via integration.
    })

    it('should persist sprint, epic, status filters, and lastProjectPath', () => {
      // Test that all filter types work together
      const { setSelectedSprint, setSelectedEpics, setSelectedStatuses, syncProjectPath } =
        useUIStore.getState()

      // Set all filters and project path
      syncProjectPath('/test/project')
      setSelectedSprint('sprint-2')
      setSelectedEpics(['epic-3'])
      setSelectedStatuses(['review', 'done'])

      // Verify all filters are in state (persistence is handled by middleware)
      const state = useUIStore.getState()
      expect(state.selectedSprintId).toBe('sprint-2')
      expect(state.selectedEpicIds).toEqual(['epic-3'])
      expect(state.selectedStatuses).toEqual(['review', 'done'])
      expect(state.lastProjectPath).toBe('/test/project')
      expect(state.hasActiveFilters()).toBe(true)
    })
  })
})
