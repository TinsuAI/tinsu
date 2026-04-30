/**
 * Mobile Primitives Library — canonical entry point for T3.5-2.
 *
 * Feature stories (T3.5-3 through T3.5-8) import from '@renderer/mobile/primitives'.
 * Existing MobileApp.tsx imports remain direct (./primitives/MobileScreen etc.) —
 * no migration required for T3.5-1 call sites.
 *
 * All 14 primitives are exported here by their canonical names (architecture doc wins
 * over design plan on naming: MobileFab not MobileFAB, MobileSearchBar not
 * MobileSearchField, MobileLoadingSkeleton not MobileLoadingState).
 */

// Hardened T3.5-1 primitives
export { MobileScreen } from './MobileScreen'
export { MobileTopAppBar } from './MobileTopAppBar'
export { MobileTabBar } from './MobileTabBar'
export { MobileEmptyState } from './MobileEmptyState'

// New T3.5-2 primitives
export { MobileSheet } from './MobileSheet'
export { MobileSegmentedTabs } from './MobileSegmentedTabs'
export { MobileColumnPager } from './MobileColumnPager'
export { MobileBottomActionBar } from './MobileBottomActionBar'
export { MobileListItem } from './MobileListItem'
export { MobileChip } from './MobileChip'
export { MobileFab } from './MobileFab'
export { MobileSearchBar } from './MobileSearchBar'
export { MobileLoadingSkeleton } from './MobileLoadingSkeleton'
export { MobilePullToRefresh } from './MobilePullToRefresh'
