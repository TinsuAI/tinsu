export { useUIStore } from './ui.store'
export { useTerminalStore, type DockPosition } from './terminal.store'
export { useStoryViewStore } from './story-view.store'
export { useThemeStore, type Theme } from './theme.store'
// Deprecated: Replaced by useTaskWorkspaceStore in TES-3.1
// export { useTaskDetailPanelStore } from './task-detail-panel.store'
export { useTaskWorkspaceStore } from './task-workspace.store'
export {
  usePlanningWorkspaceStore,
  type PlanningPhase
} from './planning-workspace.store'
