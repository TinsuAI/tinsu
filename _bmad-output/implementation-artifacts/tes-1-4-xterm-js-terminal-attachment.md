# Story TES-1.4: xterm.js Terminal Attachment

Status: done

---

## Story

As a user,
I want to see real-time terminal output when viewing a task,
So that I can watch the agent work and see command results.

## Acceptance Criteria

1. **Given** a task has an active tmux session, **When** the user opens the task detail view, **Then** xterm.js attaches to the tmux session via node-pty, **And** existing terminal content (scrollback) is displayed, **And** new output streams in real-time with <500ms latency

2. **Given** the terminal is displaying output, **When** the user scrolls up in the terminal, **Then** they can view the complete scrollback history, **And** new output continues appending at the bottom

3. **Given** no tmux session exists for the task, **When** the user views the task detail, **Then** an empty terminal state displays "No active session"

## Tasks / Subtasks

- [x] Task 1: Extend TaskTerminalService with tmux attachment capabilities (AC: #1)
  - [x] 1.1: Add `getAttachCommand(taskId: string): Promise<string | null>` method that returns `tmux attach-session -t {sessionName}`
  - [x] 1.2: Add `sendCommand(taskId: string, command: string): Promise<void>` method using `tmux send-keys`
  - [x] 1.3: Add tests for new methods
  - [x] 1.4: Export updated service

- [x] Task 2: Create agent.router tRPC procedures for task terminal (AC: #1, #3)
  - [x] 2.1: Add `getTaskSession(taskId)` query to return task_sessions record
  - [x] 2.2: Add `attachTaskTerminal(taskId)` mutation that spawns PTY attached to tmux
  - [x] 2.3: Add `detachTaskTerminal(taskId)` mutation to clean up PTY
  - [x] 2.4: Reuse existing `pty.onOutput` subscription for streaming (already exists)
  - [x] 2.5: Add tests for new procedures

- [x] Task 3: Create TaskTerminal React component (AC: #1, #2, #3)
  - [x] 3.1: Create `src/renderer/src/components/task/TaskTerminal.tsx`
  - [x] 3.2: Use existing XTerminal component for rendering
  - [x] 3.3: Implement terminal attachment on mount when session exists
  - [x] 3.4: Implement detachment on unmount to clean up PTY
  - [x] 3.5: Handle empty state "No active session" when no tmux session
  - [x] 3.6: Stream output via `pty.onOutput` subscription
  - [x] 3.7: Forward terminal resize events via `pty.resize`

- [x] Task 4: Create useTaskTerminal hook (AC: #1, #2)
  - [x] 4.1: Create `src/renderer/src/hooks/useTaskTerminal.ts`
  - [x] 4.2: Manage PTY lifecycle (attach on mount, detach on unmount)
  - [x] 4.3: Subscribe to output events and write to terminal
  - [x] 4.4: Handle resize events
  - [x] 4.5: Expose isAttached, isLoading, error states

- [x] Task 5: Integration with task detail view (AC: #1, #3)
  - [x] 5.1: Add TaskTerminal to TaskPanel or task detail component
  - [x] 5.2: Pass taskId prop to TaskTerminal
  - [x] 5.3: Handle task switching (detach old, attach new)

- [x] Task 6: Write integration tests (AC: #1, #2, #3)
  - [x] 6.1: Test terminal attachment when session exists
  - [x] 6.2: Test empty state when no session
  - [x] 6.3: Test real-time output streaming
  - [x] 6.4: Test scrollback preservation

## Dev Notes

### Architecture Compliance

This story implements FR1 (User can view a dedicated terminal session for each task) and FR4 (User can scroll through complete terminal history) from the Task Execution Sandbox PRD.

**Key Design Pattern:**
- tmux session is already created (TES-1.3)
- xterm.js attaches to tmux via node-pty PTY subprocess
- PTY runs `tmux attach-session -t {sessionName}`
- Output streams via tRPC subscription to renderer

[Source: _bmad-output/planning-artifacts/architecture.md#Terminal-Attachment-xterm-js-to-tmux]

### Technical Requirements

**Terminal Attachment Flow:**
```
TaskTerminal.tsx (renderer)
  → trpc.agent.attachTaskTerminal.mutate({ taskId })
  → agent.router (main process)
    → TaskTerminalService.getAttachCommand(taskId)
    → ptyService.spawn('bash', ['-c', `tmux attach-session -t ${session}`])
    → returns processId
  → trpc.pty.onOutput.subscribe({ processId })
    → streams output to XTerminal.write()
```

**Why bash -c wrapper:**
- tmux attach requires a TTY, which node-pty provides
- The bash wrapper ensures proper shell environment
- Allows seamless integration with existing ptyService

### Code Patterns

**Extending TaskTerminalService:**
```typescript
// Add to task-terminal.service.ts

/**
 * Gets the tmux attach command for a task's terminal session.
 *
 * @param taskId - The task's unique identifier
 * @returns The attach command, or null if no session exists
 */
static async getAttachCommand(taskId: string): Promise<string | null> {
  const sessionName = await this.getSessionName(taskId)
  if (!sessionName) return null

  // Verify tmux session exists
  const exists = await this.tmuxSessionExists(sessionName)
  if (!exists) return null

  return `tmux attach-session -t ${sessionName}`
}

/**
 * Sends a command to a task's tmux session.
 *
 * @param taskId - The task's unique identifier
 * @param command - The command to send
 * @throws Error if session doesn't exist
 */
static async sendCommand(taskId: string, command: string): Promise<void> {
  const sessionName = await this.getSessionName(taskId)
  if (!sessionName) {
    throw new Error(`No terminal session for task ${taskId}`)
  }

  // Use tmux send-keys with Enter
  await execAsync(
    `tmux send-keys -t ${sessionName} ${JSON.stringify(command)} Enter`,
    { timeout: TMUX_COMMAND_TIMEOUT }
  )
}
```

**Agent Router Procedures:**
```typescript
// Add to agent.router.ts or create task-terminal.router.ts

attachTaskTerminal: publicProcedure
  .input(z.object({ taskId: z.string() }))
  .mutation(async ({ input }) => {
    const attachCmd = await TaskTerminalService.getAttachCommand(input.taskId)
    if (!attachCmd) {
      return { attached: false, processId: null }
    }

    // Spawn PTY that attaches to tmux
    const processId = ptyService.spawn('bash', ['-c', attachCmd], {
      cols: 80,
      rows: 24
    })

    return { attached: true, processId }
  }),

detachTaskTerminal: publicProcedure
  .input(z.object({ processId: z.string() }))
  .mutation(({ input }) => {
    ptyService.kill(input.processId)
  })
```

**TaskTerminal Component Pattern:**
```typescript
// src/renderer/src/components/task/TaskTerminal.tsx
import { useTaskTerminal } from '@renderer/hooks/useTaskTerminal'
import { XTerminal, type XTerminalRef } from '../terminal/XTerminal'

interface TaskTerminalProps {
  taskId: string
}

export function TaskTerminal({ taskId }: TaskTerminalProps) {
  const terminalRef = useRef<XTerminalRef>(null)
  const { isAttached, isLoading, error, attach, detach, write, resize } =
    useTaskTerminal({ taskId, terminalRef })

  // Show empty state if no session
  if (!isLoading && !isAttached && !error) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No active session
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Connecting to terminal...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to connect: {error}
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <XTerminal
        ref={terminalRef}
        onData={write}
        onResize={resize}
      />
    </div>
  )
}
```

**useTaskTerminal Hook Pattern:**
```typescript
// src/renderer/src/hooks/useTaskTerminal.ts
import { useEffect, useRef, useState, useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import type { XTerminalRef } from '../components/terminal/XTerminal'

interface UseTaskTerminalOptions {
  taskId: string
  terminalRef: React.RefObject<XTerminalRef>
}

export function useTaskTerminal({ taskId, terminalRef }: UseTaskTerminalOptions) {
  const [isAttached, setIsAttached] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const processIdRef = useRef<string | null>(null)

  const attachMutation = trpc.agent.attachTaskTerminal.useMutation()
  const detachMutation = trpc.agent.detachTaskTerminal.useMutation()

  // Attach on mount
  useEffect(() => {
    let cancelled = false

    async function attach() {
      try {
        setIsLoading(true)
        setError(null)

        const result = await attachMutation.mutateAsync({ taskId })
        if (cancelled) {
          // Component unmounted, clean up
          if (result.processId) {
            detachMutation.mutate({ processId: result.processId })
          }
          return
        }

        if (!result.attached || !result.processId) {
          setIsAttached(false)
          setIsLoading(false)
          return
        }

        processIdRef.current = result.processId
        setIsAttached(true)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setIsLoading(false)
        }
      }
    }

    attach()

    return () => {
      cancelled = true
      // Detach on unmount
      if (processIdRef.current) {
        detachMutation.mutate({ processId: processIdRef.current })
        processIdRef.current = null
      }
    }
  }, [taskId])

  // Subscribe to output when attached
  trpc.pty.onOutput.useSubscription(
    { processId: processIdRef.current ?? '' },
    {
      enabled: isAttached && !!processIdRef.current,
      onData: (event) => {
        terminalRef.current?.write(event.data)
      }
    }
  )

  // Write to PTY
  const write = useCallback((data: string) => {
    if (!processIdRef.current) return
    trpc.pty.write.mutate({ processId: processIdRef.current, data })
  }, [])

  // Resize PTY
  const resize = useCallback((cols: number, rows: number) => {
    if (!processIdRef.current) return
    trpc.pty.resize.mutate({ processId: processIdRef.current, cols, rows })
  }, [])

  return {
    isAttached,
    isLoading,
    error,
    write,
    resize
  }
}
```

### Previous Story Learnings (TES-1.3)

**From TES-1.3 (TaskTerminalService):**
- Use SAFE_SHELL_ARG_REGEX for taskId validation (security)
- Use TMUX_COMMAND_TIMEOUT (5000ms) for all tmux commands
- Check TmuxService.checkTmuxInstalled() before tmux operations
- Session cache (sessionCache Map) for performance
- Handle race conditions with try/catch for UNIQUE constraint

**From existing PTY infrastructure:**
- ptyService singleton is already created and exported
- ptyRouter has spawn, write, kill, resize, onOutput, onExit procedures
- XTerminal component handles xterm.js lifecycle with FitAddon
- useTerminal hook pattern exists for PTY connection

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/task-terminal.service.ts` | MODIFY | Add getAttachCommand, sendCommand methods |
| `src/main/services/task-terminal.service.test.ts` | MODIFY | Add tests for new methods |
| `src/main/trpc/routers/agent.router.ts` | MODIFY | Add attachTaskTerminal, detachTaskTerminal procedures |
| `src/renderer/src/components/task/TaskTerminal.tsx` | CREATE | Task-specific terminal component |
| `src/renderer/src/hooks/useTaskTerminal.ts` | CREATE | Hook for task terminal management |

### Project Structure Notes

- Reuse existing XTerminal component (no duplication)
- Reuse existing ptyService and ptyRouter infrastructure
- Follow existing component patterns from terminal/ directory
- Tests co-located with source files

### References

- [Architecture: Terminal Attachment (xterm.js to tmux)](_bmad-output/planning-artifacts/architecture.md#Integration-Patterns)
- [PRD: FR1 - Dedicated terminal session](_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#functional-requirements)
- [Epics: Story 1.4](_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-14-xtermjs-terminal-attachment)
- [Project Context: PTY/Terminal Pattern](_bmad-output/planning-artifacts/project-context.md#pty-terminal-pattern)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/task-terminal.service.test.ts
npm test src/renderer/src/hooks/useTaskTerminal.test.ts
```

Test scenarios:
1. **Terminal attachment:** PTY spawns with tmux attach command when session exists
2. **Empty state:** "No active session" shown when no tmux session
3. **Output streaming:** Data from PTY appears in terminal with <500ms latency
4. **Scrollback:** Can scroll up to view history while new output appends
5. **Task switching:** Old PTY killed when switching tasks

Remember native module rebuild:
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Dependencies

This story depends on:
- TES-1.3 (TaskTerminalService) - DONE
- Existing ptyService and ptyRouter - DONE
- Existing XTerminal component - DONE

This story enables:
- TES-1.5 (user command input)
- TES-1.6 (terminal persistence across navigation)
- TES-2.x (activity logging with tool_used events)

### Git Intelligence

Recent commits show:
- `632735a tes-1-3 done` - TaskTerminalService with createSession, hasSession, killSession
- Files: task-terminal.service.ts, task.router.ts modified

Files to modify:
- `src/main/services/task-terminal.service.ts` - Add getAttachCommand, sendCommand
- `src/main/trpc/routers/agent.router.ts` - Add terminal attachment procedures
- Create new React components and hooks

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Output streaming latency | <500ms | Per PRD NFR3 |
| Scrollback preservation | 10,000 lines | XTerminal already configured |
| Tab switching | <200ms | Per PRD NFR6 |

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 60 TES-1.4 related tests pass (pre-review)
- 71 TES-1.4 related tests pass (post-review with new test coverage)

### Code Review (Post-Implementation)

**Review Date:** 2026-01-13
**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

**Issues Found and Fixed:**

1. **[MEDIUM] useTaskTerminal subscription stale processId** - Fixed by converting `processIdRef` to state (`processId`) so subscriptions properly re-subscribe when processId changes. Added `processIdForCleanupRef` for cleanup function.

2. **[MEDIUM] Missing test for unmount cleanup** - Added 3 new tests for cleanup behavior: normal unmount with active attachment, unmount without attachment, and unmount during in-flight attachment.

3. **[MEDIUM] StoryDetailDialog terminal tab only shown for in_progress** - Fixed query to be enabled for any task with an id, not just in_progress tasks. Sessions may persist after task status changes.

4. **[MEDIUM] No test for terminal tab switching** - Added 7 comprehensive tests for tab functionality: tab visibility, default tab, switching, taskId prop passing, and status-agnostic session queries.

### Completion Notes List

1. **TaskTerminalService extended** with `getAttachCommand()` and `sendCommand()` methods
2. **Agent router procedures added** for `getTaskSession`, `attachTaskTerminal`, `detachTaskTerminal`
3. **TaskTerminal React component created** with loading, error, no-session, and attached states
4. **useTaskTerminal hook created** to manage PTY lifecycle and subscriptions
5. **StoryDetailDialog integrated** with terminal tab when task has active session
6. **Integration tests written** covering all acceptance criteria scenarios

### Change Log

- Modified: `src/main/services/task-terminal.service.ts` - Added getAttachCommand, sendCommand methods
- Modified: `src/main/services/task-terminal.service.test.ts` - Added tests for new methods
- Modified: `src/main/trpc/routers/agent.router.ts` - Added terminal attachment procedures
- Modified: `src/main/trpc/routers/agent.router.test.ts` - Added tests for new procedures
- Created: `src/renderer/src/components/task/TaskTerminal.tsx` - Task terminal component
- Created: `src/renderer/src/components/task/TaskTerminal.test.tsx` - Component tests
- Created: `src/renderer/src/components/task/index.ts` - Component exports
- Created: `src/renderer/src/hooks/useTaskTerminal.ts` - Task terminal hook
- Created: `src/renderer/src/hooks/useTaskTerminal.test.ts` - Hook tests
- Modified: `src/renderer/src/components/dialogs/StoryDetailDialog.tsx` - Added terminal tab
- Modified: `src/renderer/src/components/dialogs/StoryDetailDialog.test.tsx` - Updated with tRPC mock

### File List

| File | Action |
|------|--------|
| `src/main/services/task-terminal.service.ts` | MODIFIED |
| `src/main/services/task-terminal.service.test.ts` | MODIFIED |
| `src/main/trpc/routers/agent.router.ts` | MODIFIED |
| `src/main/trpc/routers/agent.router.test.ts` | MODIFIED |
| `src/renderer/src/components/task/TaskTerminal.tsx` | CREATED |
| `src/renderer/src/components/task/TaskTerminal.test.tsx` | CREATED |
| `src/renderer/src/components/task/index.ts` | CREATED |
| `src/renderer/src/hooks/useTaskTerminal.ts` | CREATED |
| `src/renderer/src/hooks/useTaskTerminal.test.ts` | CREATED |
| `src/renderer/src/components/dialogs/StoryDetailDialog.tsx` | MODIFIED |
| `src/renderer/src/components/dialogs/StoryDetailDialog.test.tsx` | MODIFIED |
