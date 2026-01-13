/**
 * Main process services barrel export.
 * All services in this directory are main-process only.
 * NEVER import these directly in the renderer process.
 */

// Configuration service
export { ConfigService } from './config.service'
export type { ProjectConfig } from '../../shared/types/config.types'

// Project management service
export { ProjectService, ProjectError } from './project.service'
export type { ProjectInfo } from './project.service'

// PTY (pseudo-terminal) service for process management
export {
  PtyService,
  PtyError,
  ptyService,
  type PtySpawnOptions,
  type PtyProcess,
  type PtyOutputEvent,
  type PtyExitEvent,
  type PtyErrorEvent
} from './pty.service'

// tmux dependency detection service
export { TmuxService } from './tmux.service'

// Per-task terminal session management (TES-1.3)
export { TaskTerminalService } from './task-terminal.service'
