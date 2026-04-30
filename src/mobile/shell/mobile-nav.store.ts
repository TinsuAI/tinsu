import { create } from 'zustand'
import { parseDeepLink } from './deeplinks'

/**
 * Tab identifiers — maps to the 5 bottom-tab slots.
 */
export type MobileTabId = 'board' | 'planning' | 'tasks' | 'activity' | 'settings'

/**
 * Navigation entry — a string-keyed route.
 * Examples: 'board', 'sessions', 'chat:abc', 'list', 'workspace:xyz', 'diff'
 *
 * Kept flat (string) for the placeholder tree.  T3.5+ feature stories may
 * extend to a discriminated union if typed params are needed.
 */
export type NavEntry = string

/** Per-tab root routes — used to seed stacks and reset via clearStack */
const TAB_ROOTS: Record<MobileTabId, NavEntry> = {
  board:    'board',
  planning: 'sessions',
  tasks:    'list',
  activity: 'feed',
  settings: 'home',
}

/** Initial stack state — one root entry per tab */
function initialTabStacks(): Record<MobileTabId, NavEntry[]> {
  return {
    board:    ['board'],
    planning: ['sessions'],
    tasks:    ['list'],
    activity: ['feed'],
    settings: ['home'],
  }
}

/* ── Store state ─────────────────────────────────────────────────── */

interface MobileNavState {
  activeTab: MobileTabId
  tabStacks: Record<MobileTabId, NavEntry[]>
  /**
   * Active sheet overlay.  Named `openSheet` in the AC3 spec.
   * Stored separately from the `openSheet` action by using the internal
   * field name `sheetState` to avoid a Zustand flat-object naming clash.
   */
  sheetState: { type: string; props?: unknown } | null
}

interface MobileNavActions {
  /** Switch active tab without mutating any stack */
  switchTab: (tab: MobileTabId) => void
  /** Push a new route onto the given tab's stack */
  pushRoute: (tab: MobileTabId, route: NavEntry) => void
  /**
   * Pop the top route from the given tab's stack (defaults to activeTab).
   * No-op when the stack is already at depth 1 (root).
   */
  popRoute: (tab?: MobileTabId) => void
  /** Reset the given tab's stack to its single root entry */
  clearStack: (tab: MobileTabId) => void
  /** Open a sheet overlay by type + optional props */
  openSheet: (type: string, props?: unknown) => void
  /** Close the current sheet overlay */
  closeSheet: () => void
  /**
   * Navigate via a tinsu:// deep-link URI.
   * Replaces the target tab's stack with the parsed root-to-leaf path.
   * Silently ignores malformed / unknown URIs.
   */
  navigateToDeepLink: (uri: string) => void
  /**
   * Handle Android system back-press.
   *
   * Returns:
   *   true  — press was consumed (caller should NOT exit the app)
   *   false — press was NOT consumed (caller should exit the app)
   *
   * Logic:
   *   1. Current tab stack depth > 1  → pop route, return true
   *   2. Stack depth = 1 and not on 'board' → switch to 'board', return true
   *   3. Stack depth = 1 on 'board'   → return false (signal exit)
   */
  handleBackPress: () => boolean
}

/* ── Store ───────────────────────────────────────────────────────── */

/**
 * Mobile navigation Zustand store.
 *
 * Manages tab switching and per-tab route stacks.  NO localStorage persistence —
 * restart returns to root state (matches useTaskWorkspaceStore precedent).
 *
 * Story T3.5-1 — Mobile Shell Foundation.
 */
export const useMobileNavStore = create<MobileNavState & MobileNavActions>()((set, get) => ({
  /* ── Initial state ── */
  activeTab: 'board',
  tabStacks: initialTabStacks(),
  sheetState: null,

  /* ── Actions ── */

  switchTab: (tab) => {
    set({ activeTab: tab })
  },

  pushRoute: (tab, route) => {
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [tab]: [...state.tabStacks[tab], route],
      },
    }))
  },

  popRoute: (tab) => {
    const { activeTab, tabStacks } = get()
    const target = tab ?? activeTab
    const stack = tabStacks[target]
    if (stack.length <= 1) return   // no-op at root
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [target]: state.tabStacks[target].slice(0, -1),
      },
    }))
  },

  clearStack: (tab) => {
    set((state) => ({
      tabStacks: {
        ...state.tabStacks,
        [tab]: [TAB_ROOTS[tab]],
      },
    }))
  },

  openSheet: (type, props) => {
    set({ sheetState: { type, props } })
  },

  closeSheet: () => {
    set({ sheetState: null })
  },

  navigateToDeepLink: (uri) => {
    const target = parseDeepLink(uri)
    if (!target) return
    set((state) => ({
      activeTab: target.tab,
      tabStacks: {
        ...state.tabStacks,
        [target.tab]: target.stack,
      },
    }))
  },

  handleBackPress: () => {
    const { activeTab, tabStacks, switchTab } = get()
    const stack = tabStacks[activeTab]

    if (stack.length > 1) {
      // Pop current route
      set((state) => ({
        tabStacks: {
          ...state.tabStacks,
          [activeTab]: state.tabStacks[activeTab].slice(0, -1),
        },
      }))
      return true
    }

    if (activeTab !== 'board') {
      // Go back to board tab
      switchTab('board')
      return true
    }

    // Already at root of board — let the OS handle exit
    return false
  },
}))
