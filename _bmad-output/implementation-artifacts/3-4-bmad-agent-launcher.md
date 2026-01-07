# Story 3.4: BMAD Agent Launcher

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want TinSu to spawn the correct BMAD agent when I drag a planning task to In Progress,
So that I can create planning artifacts without leaving TinSu.

## Acceptance Criteria

1. **Given** I drag "Product Brief" to In Progress
   **When** the drop completes
   **Then** TinSu spawns Claude Code CLI with the Analyst agent
   **And** the terminal dock expands to show output
   **And** the working directory is the project root

2. **Given** I drag "PRD" to In Progress
   **When** the drop completes
   **Then** TinSu spawns Claude Code CLI with the PM agent and PRD workflow
   **And** the context includes the Product Brief if it exists

3. **Given** I drag "Architecture" to In Progress
   **When** the drop completes
   **Then** TinSu spawns Claude Code CLI with the Architect agent
   **And** the context includes PRD and Product Brief

4. **Given** I drag "UX Design" to In Progress
   **When** the drop completes
   **Then** TinSu spawns Claude Code CLI with the UX Designer agent
   **And** the context includes PRD and Architecture

5. **Given** I drag "Epics & Stories" to In Progress
   **When** the drop completes
   **Then** TinSu spawns Claude Code CLI with the PM agent and epics workflow
   **And** the context includes PRD, Architecture, and UX Design

6. **Given** Claude Code CLI is not installed
   **When** I try to start a planning phase
   **Then** TinSu shows a clear error message (NFR17)
   **And** provides instructions to install Claude Code

## Tasks / Subtasks

- [x] Task 1: Create BmadAgentLauncherService (AC: 1, 2, 3, 4, 5)
  - [x] Create `src/main/services/bmad-agent-launcher.service.ts`
  - [x] Define `BmadAgentLaunchResult` interface
  - [x] Implement `launchPlanningAgent(task: PlanningTask, projectPath: string)` method
  - [x] Build Claude Code CLI command using task's `bmad_agent`
  - [x] Use existing `ptyService.spawn()` for process creation
  - [x] Return the process ID for tracking
  - [x] Write tests in `src/main/services/bmad-agent-launcher.service.test.ts` (10 tests)

- [x] Task 2: Create ClaudeCliDetectorService (AC: 6)
  - [x] Create `src/main/services/claude-cli-detector.service.ts`
  - [x] Implement `isClaudeCodeInstalled(): Promise<boolean>` using `which claude`
  - [x] Implement `getClaudeCodePath(): Promise<string | null>` for path resolution
  - [x] Add result caching for performance
  - [x] Write tests with mocked child_process (7 tests)

- [x] Task 3: Create agent.router with launchPlanningAgent procedure (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `src/main/trpc/routers/agent.router.ts`
  - [x] Implement `launchPlanningAgent` mutation with input: `{ taskId: string }`
  - [x] Verify task is a planning task using type guard
  - [x] Check Claude CLI is installed before spawning (throw TRPCError if not)
  - [x] Call BmadAgentLauncherService to spawn process
  - [x] Return process ID for client tracking
  - [x] Add `checkClaudeCliInstalled` query for preflight check
  - [x] Write tests for agent.router (7 tests)

- [x] Task 4: Update root tRPC router to include agent.router
  - [x] Modify `src/main/trpc/index.ts`
  - [x] Import and add `agentRouter` to the merged router
  - [x] Verify type inference works correctly

- [x] Task 5: Create useAgentLauncher hook (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `src/renderer/src/hooks/useAgentLauncher.ts`
  - [x] Use tRPC `agent.launchPlanningAgent.useMutation`
  - [x] Handle success: store process ID, expand terminal dock, set agent task ID
  - [x] Handle error: show toast with error message
  - [x] Export `launchPlanningAgent(taskId: string)` function
  - [x] Write tests (8 tests)

- [x] Task 6: Extend terminal store for agent process tracking
  - [x] Modify `src/renderer/src/stores/terminal.store.ts`
  - [x] Add `agentTaskId: string | null` to track which task spawned current process
  - [x] Add `setAgentTask(taskId: string | null)` action
  - [x] Add `clearAgent()` action to clear both when process exits
  - [x] Update tests (5 new tests)

- [x] Task 7: Update KanbanBoard to trigger agent launch on planning task drag to In Progress (AC: 1, 2, 3, 4, 5)
  - [x] Modify `src/renderer/src/components/board/KanbanBoard.tsx`
  - [x] Add `onPlanningTaskStart?: (taskId: string) => void` prop
  - [x] In `handleDragEnd`, after status change to 'in_progress' for planning tasks:
    - Check if task is planning type using `isPlanningTask()`
    - Call `onPlanningTaskStart` callback
  - [x] Add test for accepting callback

- [x] Task 8: Update App/main board container to wire up agent launcher (AC: 1, 2, 3, 4, 5)
  - [x] Modify `src/renderer/src/components/board/KanbanBoardContainer.tsx`
  - [x] Use `useAgentLauncher` hook
  - [x] Pass `onPlanningTaskStart` callback that calls `launchPlanningAgent`
  - [x] Update mocks in tests for agent router

- [x] Task 9: Create error toast for CLI not installed (AC: 6)
  - [x] Using sonner toast (already available)
  - [x] Clear error message: "Claude Code CLI is not installed..."
  - [x] Description: "Please install Claude Code CLI to continue."
  - [x] Duration: 10 seconds (persistent for visibility)

- [x] Task 10: Write comprehensive tests (AC: all)
  - [x] Test BmadAgentLauncherService builds correct command for all 5 phases
  - [x] Test ClaudeCliDetectorService detects installed/not-installed correctly
  - [x] Test agent.router validates planning task type
  - [x] Test agent.router throws TRPCError when CLI not installed
  - [x] Test KanbanBoard accepts onPlanningTaskStart callback
  - [x] Test useAgentLauncher hook expands terminal on success
  - [x] Test error toast appears on error
  - [x] All 714 tests pass

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database operations happen in the main process via Drizzle ORM. The renderer NEVER directly accesses the database or spawns processes.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.3)

**Key Learnings from 3.3:**
1. Tests must pass before completion (currently 676 tests)
2. Use existing patterns from services for consistency
3. Commit message format: `3.4 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Planning task fields (`phase_number`, `phase_name`, `bmad_agent`, `bmad_workflow`, `is_start_here`, `artifact_path`) already exist in tasks table
6. `isPlanningTask()` type guard already exists for narrowing task types
7. `SortablePlanningTaskCard` and `PlanningTaskCard` components handle planning task rendering
8. `config.router.openArtifactFile` pattern shows how to add new router procedures

**Files Created in 3.3:**
- `src/renderer/src/components/task/PhaseBadge.tsx` - Phase badge component
- `src/renderer/src/components/board/PlanningTaskCard.tsx` - Planning task card UI
- `src/renderer/src/components/board/SortablePlanningTaskCard.tsx` - Drag wrapper
- `src/renderer/src/constants/planning-phases.ts` - Phase descriptions

**Files Modified in 3.3:**
- `src/shared/types/task.types.ts` - Has `artifact_path` field
- `src/main/db/schema.ts` - Has `artifact_path` column
- `src/main/trpc/routers/task.router.ts` - Has `updateArtifactPath` mutation
- `src/main/trpc/routers/config.router.ts` - Has `openArtifactFile` procedure
- `src/renderer/src/components/board/KanbanBoard.tsx` - Conditionally renders PlanningTaskCard

### Existing Infrastructure to Use

**Planning Phases Configuration (from `src/main/db/planning-phases.ts`):**
```typescript
export const BMAD_PLANNING_PHASES = {
  1: { name: 'Product Brief', agent: 'bmad:bmm:agents:pm', workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml' },
  2: { name: 'PRD', agent: 'bmad:bmm:agents:pm', workflow: '_bmad/bmm/workflows/2-discovery/create-prd/workflow.yaml' },
  3: { name: 'Architecture', agent: 'bmad:bmm:agents:architect', workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml' },
  4: { name: 'UX Design', agent: 'bmad:bmm:agents:ux-designer', workflow: '_bmad/bmm/workflows/3-solutioning/create-ux-design/workflow.yaml' },
  5: { name: 'Epics & Stories', agent: 'bmad:bmm:agents:pm', workflow: '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.yaml' }
} as const
```

**Type Guard (from `src/shared/types/task.types.ts`):**
```typescript
export function isPlanningTask(task: Task): task is PlanningTask {
  return (
    task.task_type === 'planning' &&
    task.phase_number !== null &&
    task.phase_name !== null &&
    task.bmad_agent !== null &&
    task.bmad_workflow !== null
  )
}
```

**PTY Service (from `src/main/services/pty.service.ts`):**
```typescript
// Singleton instance for app-wide usage
export const ptyService = new PtyService()

// Key methods:
ptyService.spawn(command, args, options) // Returns process ID
ptyService.write(processId, data)
ptyService.kill(processId)
ptyService.on('output', handler)  // PtyOutputEvent
ptyService.on('exit', handler)    // PtyExitEvent
```

**PTY Router Pattern (from `src/main/trpc/routers/pty.router.ts`):**
```typescript
export const ptyRouter = router({
  spawn: publicProcedure
    .input(z.object({
      command: z.string().optional().default('/bin/bash'),
      args: z.array(z.string()).optional().default([]),
      cwd: z.string().optional(),
      cols: z.number().int().positive().optional(),
      rows: z.number().int().positive().optional()
    }))
    .mutation(({ input }) => {
      return ptyService.spawn(input.command, input.args, {...})
    }),
  // onOutput and onExit subscriptions for streaming
})
```

**Terminal Store (from `src/renderer/src/stores/terminal.store.ts`):**
```typescript
interface TerminalState {
  isExpanded: boolean
  height: number
  activeProcessId: string | null
  setExpanded: (expanded: boolean) => void
  setActiveProcess: (processId: string | null) => void
}
```

**useTerminal Hook Pattern (from `src/renderer/src/hooks/useTerminal.ts`):**
```typescript
const { spawn, write, kill, resize, isRunning, processId } = useTerminal({
  terminalRef,
  onExit: (exitCode) => { ... }
})

// spawn() returns processId and sets activeProcess in store
await spawn({ command: 'claude', args: ['...'], cwd: projectPath })
```

### Claude Code CLI Command Format

**Based on BMAD workflow structure, the command should be:**
```bash
# Basic format using skill invocation
claude --skill bmad:bmm:workflows:create-product-brief

# With project directory context
cd /path/to/project && claude --skill bmad:bmm:workflows:create-product-brief
```

**Alternative approach using workflow path:**
```bash
claude /path/to/workflow.yaml
```

**Recommended approach - use the bmad_workflow path stored in task:**
```typescript
// task.bmad_workflow = "_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml"
const command = 'claude'
const args = ['--skill', task.bmad_agent]  // e.g., 'bmad:bmm:agents:pm'
const cwd = projectPath
```

### Component Patterns to Follow

**BmadAgentLauncherService:**
```typescript
// src/main/services/bmad-agent-launcher.service.ts
import { ptyService, PtySpawnOptions } from './pty.service'
import { PlanningTask, isPlanningTask } from '@shared/types/task.types'

export interface BmadAgentLaunchResult {
  processId: string
  command: string
  args: string[]
}

export class BmadAgentLauncherService {
  /**
   * Launches the appropriate BMAD agent for a planning task.
   *
   * @param task - The planning task to launch agent for
   * @param projectPath - Root path of the project
   * @returns Process ID and command details
   * @throws Error if task is not a valid planning task
   */
  static launchPlanningAgent(task: PlanningTask, projectPath: string): BmadAgentLaunchResult {
    // Build command using the skill syntax
    const command = 'claude'
    const args = ['--skill', task.bmad_agent]

    const processId = ptyService.spawn(command, args, {
      cwd: projectPath
    })

    return { processId, command, args }
  }
}
```

**ClaudeCliDetectorService:**
```typescript
// src/main/services/claude-cli-detector.service.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class ClaudeCliDetectorService {
  /**
   * Checks if Claude Code CLI is installed and available in PATH.
   */
  static async isClaudeCodeInstalled(): Promise<boolean> {
    try {
      await execAsync('which claude')
      return true
    } catch {
      return false
    }
  }

  /**
   * Gets the full path to the Claude Code CLI executable.
   */
  static async getClaudeCodePath(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('which claude')
      return stdout.trim()
    } catch {
      return null
    }
  }
}
```

**agent.router:**
```typescript
// src/main/trpc/routers/agent.router.ts
import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { isPlanningTask } from '../../../shared/types/task.types'

export const agentRouter = router({
  // Check if Claude CLI is installed
  checkClaudeCliInstalled: publicProcedure.query(async () => {
    return ClaudeCliDetectorService.isClaudeCodeInstalled()
  }),

  // Launch a BMAD planning agent for a task
  launchPlanningAgent: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check CLI is installed
      const isInstalled = await ClaudeCliDetectorService.isClaudeCodeInstalled()
      if (!isInstalled) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Claude Code CLI is not installed. Run: npm install -g @anthropic-ai/claude-code'
        })
      }

      // Get task and verify it's a planning task
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }
      if (!isPlanningTask(task)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Task is not a planning task' })
      }

      // Launch the agent
      const result = BmadAgentLauncherService.launchPlanningAgent(task, ctx.projectRoot)
      return result
    })
})
```

**useAgentLauncher hook:**
```typescript
// src/renderer/src/hooks/useAgentLauncher.ts
import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { useTerminalStore } from '@renderer/stores'
import { toast } from 'sonner'  // or shadcn toast

export function useAgentLauncher() {
  const { setExpanded, setActiveProcess } = useTerminalStore()
  const launchMutation = trpc.agent.launchPlanningAgent.useMutation({
    onSuccess: (result) => {
      setActiveProcess(result.processId)
      setExpanded(true)  // Expand terminal dock
    },
    onError: (error) => {
      toast.error(error.message, {
        description: 'Please install Claude Code CLI to continue.'
      })
    }
  })

  const launchPlanningAgent = useCallback((taskId: string) => {
    launchMutation.mutate({ taskId })
  }, [launchMutation])

  return {
    launchPlanningAgent,
    isLaunching: launchMutation.isPending
  }
}
```

### KanbanBoard Integration

```typescript
// In handleDragEnd, after status change:
if (task.status !== targetStatus && onStatusChange) {
  onStatusChange(taskId, targetStatus)

  // If moving planning task to In Progress, trigger agent launch
  if (targetStatus === 'in_progress' && isPlanningTask(task)) {
    onPlanningTaskStart?.(taskId)
  }
}
```

### Project Structure Notes

**New Files to Create:**
```
src/main/services/bmad-agent-launcher.service.ts
src/main/services/bmad-agent-launcher.service.test.ts
src/main/services/claude-cli-detector.service.ts
src/main/services/claude-cli-detector.service.test.ts
src/main/trpc/routers/agent.router.ts
src/main/trpc/routers/agent.router.test.ts
src/renderer/src/hooks/useAgentLauncher.ts
```

**Files to Modify:**
```
src/main/trpc/index.ts                              # Add agentRouter
src/renderer/src/components/board/KanbanBoard.tsx   # Add onPlanningTaskStart callback
src/renderer/src/stores/terminal.store.ts           # Add agentTaskId tracking (optional)
[Parent of KanbanBoard]                              # Wire up useAgentLauncher
```

### UX Design Specifications

**From UX Design Document - Design System:**
- Use shadcn/ui toast for error notifications
- Dark theme: background #0a0a0b, card #18181b, text #fafafa
- Error colors: red-500 for critical errors

**Terminal Expansion Behavior:**
- When agent starts, terminal dock auto-expands (calls `setExpanded(true)`)
- Terminal shows Claude CLI output in real-time via PTY subscription
- On agent exit, process exit code displayed in terminal

**Error Messaging:**
- Toast notification for "Claude Code CLI not installed"
- Include actionable instruction with installation command
- Duration: persistent until dismissed or 10 seconds

### Git Intelligence (Recent Commits)

```
9fa7f5a 3.3 done: Implement planning tasks with distinct UI, phase badges, and artifact path handling on the Kanban board.
364e415 3.1.5 done: implement multi-project support by adding a projects table
5d9cce4 3.2 draft
f5403d5 3.1 done: Add project management services, TRPC router, and UI components
6a48ba6 2.7 done: Introduce velocity metrics with chart, detail panel, and widget components.
```

From Story 3.3: PlanningTaskCard and artifact_path handling established. This story builds on that foundation by adding agent launch capability.

### Dependencies

- **Depends On:** Story 3.3 (planning task card UI) - COMPLETE (in review)
- **This Story Enables:** Story 3.5 (artifact detection on phase completion)

### Performance Considerations

- Claude CLI detection should be cached after first check (per session)
- PTY spawn is async but fast (<100ms typically)
- Terminal dock expansion uses CSS transition (200ms)
- No blocking operations in renderer process

### Edge Cases to Handle

1. **Claude CLI not in PATH:** Clear error with installation instructions
2. **Task already has running process:** Kill existing before spawning new (pty.spawn handles this)
3. **Project path doesn't exist:** Validate projectRoot before spawn
4. **Drag cancelled mid-flight:** No agent launch (handleDragCancel clears state)
5. **Planning task in wrong status:** Only trigger on drop to 'in_progress'
6. **Terminal already expanded:** Don't trigger expansion animation redundantly
7. **Multiple rapid status changes:** Debounce agent launch if needed

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Spawn processes in renderer | Use tRPC to call main process services |
| Check `task.task_type === 'planning'` directly | Use `isPlanningTask()` type guard |
| Hard-code workflow paths | Use `task.bmad_workflow` from database |
| Block on CLI detection | Cache result, show loading state |
| Direct ipcRenderer calls | Use tRPC procedures exclusively |
| Use `new Error()` in routers | Use `new TRPCError()` with proper codes |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/main/services/bmad-agent-launcher.service.test.ts
describe('BmadAgentLauncherService', () => {
  it('launches agent with correct command for phase 1', () => { /* ... */ })
  it('uses task bmad_agent for skill argument', () => { /* ... */ })
  it('sets working directory to project path', () => { /* ... */ })
  it('returns process ID from ptyService', () => { /* ... */ })
})

// src/main/services/claude-cli-detector.service.test.ts
describe('ClaudeCliDetectorService', () => {
  it('returns true when claude is in PATH', async () => { /* ... */ })
  it('returns false when claude is not installed', async () => { /* ... */ })
  it('returns path when getClaudeCodePath succeeds', async () => { /* ... */ })
})

// src/main/trpc/routers/agent.router.test.ts
describe('agentRouter', () => {
  it('throws PRECONDITION_FAILED when CLI not installed', async () => { /* ... */ })
  it('throws NOT_FOUND for invalid taskId', async () => { /* ... */ })
  it('throws BAD_REQUEST for non-planning task', async () => { /* ... */ })
  it('returns processId on successful launch', async () => { /* ... */ })
})

// src/renderer/src/components/board/KanbanBoard.test.tsx
describe('KanbanBoard - Planning Agent Launch', () => {
  it('calls onPlanningTaskStart when planning task dropped on In Progress', () => { /* ... */ })
  it('does not call onPlanningTaskStart for story tasks', () => { /* ... */ })
  it('does not call onPlanningTaskStart when dropping on other columns', () => { /* ... */ })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] - tRPC patterns
- [Source: src/main/services/pty.service.ts] - PTY service for process spawning
- [Source: src/main/trpc/routers/pty.router.ts] - PTY router pattern to follow
- [Source: src/main/db/planning-phases.ts] - BMAD phase configuration
- [Source: src/shared/types/task.types.ts] - isPlanningTask() type guard
- [Source: src/renderer/src/stores/terminal.store.ts] - Terminal state management
- [Source: src/renderer/src/hooks/useTerminal.ts] - Terminal hook pattern
- [Source: _bmad-output/implementation-artifacts/3-3-planning-task-card-ui.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 10 tasks completed with comprehensive test coverage
- 714 tests passing (37 new tests added for this story)
- Command format updated to use `--skill` flag per Dev Notes specification
- Error handling improved with context-aware toast descriptions
- vitest.config.ts updated with path aliases to support main process tests

### File List

**New Files Created:**
- `src/main/services/bmad-agent-launcher.service.ts` - BmadAgentLauncherService for spawning Claude CLI
- `src/main/services/bmad-agent-launcher.service.test.ts` - 10 tests for launcher service
- `src/main/services/claude-cli-detector.service.ts` - ClaudeCliDetectorService with caching
- `src/main/services/claude-cli-detector.service.test.ts` - 7 tests for CLI detector
- `src/main/trpc/routers/agent.router.ts` - tRPC router with launchPlanningAgent mutation
- `src/main/trpc/routers/agent.router.test.ts` - 7 tests for agent router
- `src/renderer/src/hooks/useAgentLauncher.ts` - React hook for agent launching
- `src/renderer/src/hooks/useAgentLauncher.test.ts` - 8 tests for hook

**Modified Files:**
- `src/main/trpc/index.ts` - Added agentRouter to merged router
- `src/renderer/src/components/board/KanbanBoard.tsx` - Added onPlanningTaskStart callback
- `src/renderer/src/components/board/KanbanBoard.test.tsx` - Added planning agent launch test
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - Wired up useAgentLauncher hook
- `src/renderer/src/components/board/KanbanBoardContainer.test.tsx` - Added agent router mock
- `src/renderer/src/stores/terminal.store.ts` - Added agentTaskId, setAgentTask, clearAgent
- `src/renderer/src/stores/terminal.store.test.ts` - 5 new tests for agent tracking
- `vitest.config.ts` - Added @renderer and @shared aliases for main process tests

