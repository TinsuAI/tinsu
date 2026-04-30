import { describe, it, expect, beforeEach } from 'vitest'
import { useMobileNavStore } from './mobile-nav.store'

/** Reset store to initial state before each test */
function resetStore(): void {
  useMobileNavStore.setState({
    activeTab: 'board',
    tabStacks: {
      board:    ['board'],
      planning: ['sessions'],
      tasks:    ['list'],
      activity: ['feed'],
      settings: ['home'],
    },
    sheetState: null,
  })
}

describe('useMobileNavStore', () => {
  beforeEach(resetStore)

  // ── Initial state ──────────────────────────────────────────────────

  it('starts on board tab', () => {
    expect(useMobileNavStore.getState().activeTab).toBe('board')
  })

  it('seeds stacks with correct root routes', () => {
    const { tabStacks } = useMobileNavStore.getState()
    expect(tabStacks.board).toEqual(['board'])
    expect(tabStacks.planning).toEqual(['sessions'])
    expect(tabStacks.tasks).toEqual(['list'])
    expect(tabStacks.activity).toEqual(['feed'])
    expect(tabStacks.settings).toEqual(['home'])
  })

  // ── switchTab ──────────────────────────────────────────────────────

  it('switchTab — changes activeTab', () => {
    useMobileNavStore.getState().switchTab('planning')
    expect(useMobileNavStore.getState().activeTab).toBe('planning')
  })

  it('switchTab — does NOT clear the previous tab stack', () => {
    // Push something onto board stack
    useMobileNavStore.getState().pushRoute('board', 'workspace:task-1')
    // Switch to planning
    useMobileNavStore.getState().switchTab('planning')
    // Board stack must still have the pushed route
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board', 'workspace:task-1'])
  })

  it('switchTab — preserves target tab stack when switching', () => {
    useMobileNavStore.getState().pushRoute('planning', 'chat:session-99')
    useMobileNavStore.getState().switchTab('board')
    useMobileNavStore.getState().switchTab('planning')
    expect(useMobileNavStore.getState().tabStacks.planning).toEqual(['sessions', 'chat:session-99'])
  })

  // ── pushRoute ──────────────────────────────────────────────────────

  it('pushRoute — adds entry to the specified tab stack', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'workspace:task-1')
    expect(useMobileNavStore.getState().tabStacks.tasks).toEqual(['list', 'workspace:task-1'])
  })

  it('pushRoute — does not mutate other tab stacks', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'workspace:task-1')
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
    expect(useMobileNavStore.getState().tabStacks.planning).toEqual(['sessions'])
  })

  // ── popRoute ──────────────────────────────────────────────────────

  it('popRoute — removes top entry from active tab stack', () => {
    useMobileNavStore.getState().pushRoute('board', 'workspace:task-1')
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board', 'workspace:task-1'])
    useMobileNavStore.getState().popRoute()
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
  })

  it('popRoute — no-op when stack depth is 1 (root)', () => {
    // board stack is at depth 1
    useMobileNavStore.getState().popRoute('board')
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
  })

  it('popRoute — no-op does NOT change other state', () => {
    // Confirm state is truly unchanged
    const before = JSON.stringify(useMobileNavStore.getState().tabStacks)
    useMobileNavStore.getState().popRoute()
    const after = JSON.stringify(useMobileNavStore.getState().tabStacks)
    expect(before).toBe(after)
  })

  it('popRoute — accepts explicit tab param', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'workspace:task-1')
    useMobileNavStore.getState().popRoute('tasks')
    expect(useMobileNavStore.getState().tabStacks.tasks).toEqual(['list'])
  })

  // ── clearStack ────────────────────────────────────────────────────

  it('clearStack — resets tab stack to single root entry', () => {
    useMobileNavStore.getState().pushRoute('board', 'workspace:task-1')
    useMobileNavStore.getState().pushRoute('board', 'diff')
    useMobileNavStore.getState().clearStack('board')
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
  })

  it('clearStack — does not affect other tabs', () => {
    useMobileNavStore.getState().pushRoute('tasks', 'workspace:task-1')
    useMobileNavStore.getState().clearStack('board')
    expect(useMobileNavStore.getState().tabStacks.tasks).toEqual(['list', 'workspace:task-1'])
  })

  // ── handleBackPress ───────────────────────────────────────────────

  it('handleBackPress — pops route and returns true when stack depth > 1', () => {
    useMobileNavStore.getState().pushRoute('board', 'workspace:task-1')
    const consumed = useMobileNavStore.getState().handleBackPress()
    expect(consumed).toBe(true)
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
  })

  it('handleBackPress — switches to board and returns true when depth=1 on non-board tab', () => {
    useMobileNavStore.getState().switchTab('planning')
    const consumed = useMobileNavStore.getState().handleBackPress()
    expect(consumed).toBe(true)
    expect(useMobileNavStore.getState().activeTab).toBe('board')
  })

  it('handleBackPress — returns false when depth=1 on board tab', () => {
    // activeTab is 'board', stack depth is 1
    const consumed = useMobileNavStore.getState().handleBackPress()
    expect(consumed).toBe(false)
    // State should be unchanged
    expect(useMobileNavStore.getState().activeTab).toBe('board')
  })

  // ── navigateToDeepLink ────────────────────────────────────────────

  it('navigateToDeepLink — chat URI sets planning tab and correct stack', () => {
    useMobileNavStore.getState().navigateToDeepLink('tinsu://chat/session-abc')
    const state = useMobileNavStore.getState()
    expect(state.activeTab).toBe('planning')
    expect(state.tabStacks.planning).toEqual(['sessions', 'chat:session-abc'])
  })

  it('navigateToDeepLink — task URI sets tasks tab and correct stack', () => {
    useMobileNavStore.getState().navigateToDeepLink('tinsu://task/task-xyz')
    const state = useMobileNavStore.getState()
    expect(state.activeTab).toBe('tasks')
    expect(state.tabStacks.tasks).toEqual(['list', 'workspace:task-xyz'])
  })

  it('navigateToDeepLink — task/diff URI produces three-entry stack', () => {
    useMobileNavStore.getState().navigateToDeepLink('tinsu://task/task-xyz/diff')
    const state = useMobileNavStore.getState()
    expect(state.activeTab).toBe('tasks')
    expect(state.tabStacks.tasks).toEqual(['list', 'workspace:task-xyz', 'diff'])
  })

  it('navigateToDeepLink — replaces stack (not pushes)', () => {
    // Pre-load planning stack with extra items
    useMobileNavStore.getState().pushRoute('planning', 'chat:old-session')
    useMobileNavStore.getState().navigateToDeepLink('tinsu://chat/new-session')
    // Stack should be replaced, not appended
    expect(useMobileNavStore.getState().tabStacks.planning).toEqual(['sessions', 'chat:new-session'])
  })

  it('navigateToDeepLink — malformed URI is silently ignored', () => {
    const before = { ...useMobileNavStore.getState() }
    useMobileNavStore.getState().navigateToDeepLink('not-a-uri')
    expect(useMobileNavStore.getState().activeTab).toBe(before.activeTab)
  })

  it('navigateToDeepLink — unknown host is silently ignored', () => {
    useMobileNavStore.getState().navigateToDeepLink('tinsu://unknown/something')
    // State must be unchanged
    expect(useMobileNavStore.getState().activeTab).toBe('board')
    expect(useMobileNavStore.getState().tabStacks.board).toEqual(['board'])
  })

  // ── openSheet / closeSheet ────────────────────────────────────────

  it('openSheet sets sheet state', () => {
    useMobileNavStore.getState().openSheet('connection-picker', { connectionId: 'c1' })
    expect(useMobileNavStore.getState().sheetState).toEqual({
      type: 'connection-picker',
      props: { connectionId: 'c1' },
    })
  })

  it('closeSheet clears sheet state', () => {
    useMobileNavStore.getState().openSheet('some-sheet')
    useMobileNavStore.getState().closeSheet()
    expect(useMobileNavStore.getState().sheetState).toBeNull()
  })
})
