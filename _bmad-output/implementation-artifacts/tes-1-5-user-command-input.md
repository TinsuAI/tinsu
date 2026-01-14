# Story TES-1.5: User Command Input

Status: done

---

## Story

As a user,
I want to type commands directly into the task terminal,
So that I can interact with the agent or run manual commands.

## Acceptance Criteria

1. **Given** a task has an active tmux session, **When** the user types in the terminal input field and presses Enter, **Then** the command is sent to tmux via `tmux send-keys -t {session} "{command}" Enter`, **And** the command appears in the terminal output, **And** the input field clears after sending

2. **Given** the terminal input field is focused, **When** the user presses Enter with an empty input, **Then** nothing is sent to tmux

3. **Given** a task terminal is in view, **When** the user presses `/` key (global shortcut), **Then** the terminal input field receives focus

## Tasks / Subtasks

- [x] Task 1: Add terminal input field UI component (AC: #1)
  - [x] 1.1: Create `TerminalInput.tsx` component with input field and submit button
  - [x] 1.2: Style with Tailwind - dark theme, monospace font, matches terminal aesthetic
  - [x] 1.3: Add loading/disabled state while command is being sent
  - [x] 1.4: Clear input on successful send
  - [x] 1.5: Write component tests (20 tests)

- [x] Task 2: Create sendTerminalCommand tRPC procedure (AC: #1)
  - [x] 2.1: Add `sendTerminalCommand` mutation to agent.router.ts
  - [x] 2.2: Input validation: taskId (string, required), command (string, min 1 char)
  - [x] 2.3: Use existing `TaskTerminalService.sendCommand()` from TES-1.4
  - [x] 2.4: Log `user_command` activity event (TODO comment for TES-2.x)
  - [x] 2.5: Write router tests (5 tests)

- [x] Task 3: Integrate TerminalInput with TaskTerminal (AC: #1, #2)
  - [x] 3.1: Add TerminalInput below XTerminal in TaskTerminal component
  - [x] 3.2: Connect to sendTerminalCommand mutation
  - [x] 3.3: Handle empty input - prevent submission (AC: #2)
  - [x] 3.4: Handle error state - show toast on failure
  - [x] 3.5: Write integration tests (7 tests added to TaskTerminal.test.tsx)

- [x] Task 4: Implement `/` keyboard shortcut (AC: #3)
  - [x] 4.1: Add global keydown listener in StoryDetailDialog
  - [x] 4.2: When `/` pressed and terminal tab is active, focus input field
  - [x] 4.3: Prevent default behavior (don't type `/` in input)
  - [x] 4.4: Expose inputRef from TerminalInput via TaskTerminal ref
  - [x] 4.5: Write keyboard shortcut tests (4 tests)

- [x] Task 5: Handle edge cases and UX polish (AC: #1, #2)
  - [x] 5.1: Disable input when no active session (via disabled prop)
  - [x] 5.2: Show placeholder text "Type a command..."
  - [ ] 5.3: Support Ctrl+C / Cmd+C for interrupt (OPTIONAL - not implemented)
  - [x] 5.4: Add aria-label for accessibility
  - [x] 5.5: Ensure input works when xterm.js has focus (via "/" shortcut)

## Dev Notes

### Architecture Compliance

This story implements FR3 (User can type commands directly into a task's terminal) and FR6 (System can send commands to a task's terminal) from the Task Execution Sandbox PRD.

**Key Design Pattern:**
- User types in dedicated input field (NOT directly into xterm.js)
- Command sent via tRPC → TaskTerminalService.sendCommand() → `tmux send-keys`
- xterm.js displays the command as output (echo from tmux)

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-15-user-command-input]

### Technical Requirements

**Command Flow:**
```
TerminalInput (renderer)
  → trpc.agent.sendTerminalCommand.mutate({ taskId, command })
  → agent.router (main process)
    → TaskTerminalService.sendCommand(taskId, command)
      → tmux send-keys -t {session} "{command}" Enter
  → Output appears in tmux session
  → xterm.js (attached) displays the output
```

**Why dedicated input field (not xterm.js keyboard input):**
- xterm.js is attached via PTY to tmux attach-session
- Typing in xterm.js goes to tmux attach, not to the shell inside
- tmux send-keys is the proper way to send input to a tmux session
- This allows logging user commands as activity events
- Cleaner UX with visible input field and submit button

[Source: _bmad-output/planning-artifacts/architecture.md#Integration-Patterns]

### Code Patterns

**TerminalInput Component:**
```typescript
// src/renderer/src/components/task/TerminalInput.tsx
interface TerminalInputProps {
  taskId: string
  disabled?: boolean
  onSubmit?: (command: string) => void
}

export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(
  ({ taskId, disabled, onSubmit }, ref) => {
    const [command, setCommand] = useState('')
    const sendCommand = trpc.agent.sendTerminalCommand.useMutation()
    const inputRef = useRef<HTMLInputElement>(null)

    // Expose ref for focus control
    useImperativeHandle(ref, () => inputRef.current!, [])

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault()
      if (!command.trim() || disabled) return // AC #2

      try {
        await sendCommand.mutateAsync({ taskId, command: command.trim() })
        setCommand('') // AC #1 - clear after send
        onSubmit?.(command)
      } catch (err) {
        toast.error('Failed to send command')
      }
    }

    return (
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-zinc-700">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command..."
          disabled={disabled || sendCommand.isPending}
          className="flex-1 bg-zinc-900 text-zinc-100 font-mono text-sm px-3 py-2 rounded border border-zinc-700 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          aria-label="Terminal command input"
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || !command.trim() || sendCommand.isPending}
        >
          {sendCommand.isPending ? 'Sending...' : 'Send'}
        </Button>
      </form>
    )
  }
)
```

**Agent Router Procedure:**
```typescript
// Add to agent.router.ts
sendTerminalCommand: publicProcedure
  .input(z.object({
    taskId: z.string(),
    command: z.string().min(1)
  }))
  .mutation(async ({ input }) => {
    // Send command to tmux session
    await TaskTerminalService.sendCommand(input.taskId, input.command)

    // TODO: Log activity event (TES-2.x)
    // await activityLogService.logActivity(input.taskId, 'user_command', { command: input.command })

    return { success: true }
  }),
```

**Keyboard Shortcut Handler:**
```typescript
// In TaskTerminal.tsx or StoryDetailDialog.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only when terminal tab is active
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't focus if already in an input
      if (document.activeElement?.tagName === 'INPUT') return

      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [])
```

### Previous Story Learnings (TES-1.4)

**From TES-1.4 Implementation:**
- TaskTerminalService.sendCommand() already exists and is tested
- Uses `tmux send-keys -t ${sessionName} ${JSON.stringify(command)} Enter`
- JSON.stringify handles shell escaping for the command string
- TMUX_COMMAND_TIMEOUT (5000ms) applies to send-keys calls
- Session validation happens inside sendCommand - throws if no session

**From TES-1.4 Code Review:**
- useTaskTerminal hook properly manages PTY lifecycle
- TaskTerminal component handles loading/error/no-session states
- StoryDetailDialog has terminal tab integrated
- Tests use vi.mock for tRPC client mocking pattern

**Existing Infrastructure:**
- `TaskTerminalService.sendCommand(taskId, command)` - READY
- `agent.router.ts` - add new procedure here
- `TaskTerminal.tsx` - add TerminalInput here
- Toast notifications via shadcn/ui

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/task/TerminalInput.tsx` | CREATE | Command input component |
| `src/renderer/src/components/task/TerminalInput.test.tsx` | CREATE | Component tests |
| `src/renderer/src/components/task/TaskTerminal.tsx` | MODIFY | Integrate TerminalInput |
| `src/renderer/src/components/task/TaskTerminal.test.tsx` | MODIFY | Add integration tests |
| `src/main/trpc/routers/agent.router.ts` | MODIFY | Add sendTerminalCommand |
| `src/main/trpc/routers/agent.router.test.ts` | MODIFY | Add procedure tests |
| `src/renderer/src/components/task/index.ts` | MODIFY | Export TerminalInput |

### Project Structure Notes

- Reuse existing TaskTerminalService.sendCommand() - no new service code needed
- TerminalInput is a controlled component with form submission
- Keyboard shortcut lives at the task detail level (StoryDetailDialog or TaskTerminal)
- Tests co-located with source files per project conventions

### References

- [Architecture: Command Execution Pattern](_bmad-output/planning-artifacts/architecture.md#Integration-Patterns)
- [PRD: FR3 - User can type commands](_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#functional-requirements)
- [Epics: Story 1.5](_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-15-user-command-input)
- [Project Context: tRPC Patterns](_bmad-output/planning-artifacts/project-context.md#trpc-patterns)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/components/task/TerminalInput.test.tsx
npm test src/main/trpc/routers/agent.router.test.ts
```

Test scenarios:
1. **Command submission:** Input clears, command sent to tmux
2. **Empty input:** Enter with empty field does nothing
3. **Keyboard shortcut:** `/` key focuses input field
4. **Disabled state:** Input disabled when no active session
5. **Error handling:** Toast shown on send failure

Remember native module rebuild:
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Dependencies

This story depends on:
- TES-1.4 (xterm.js Terminal Attachment) - DONE
- TaskTerminalService.sendCommand() - DONE (from TES-1.4)

This story enables:
- TES-1.6 (terminal persistence across navigation)
- TES-2.8 (user command event capture) - will add activity logging

### Git Intelligence

Recent commits show:
- `dc3093b tes-1-4 done` - TaskTerminal with attachment, useTaskTerminal hook
- `632735a tes-1-3 done` - TaskTerminalService with createSession, sendCommand

Files modified in TES-1.4:
- `src/main/services/task-terminal.service.ts` - sendCommand already implemented
- `src/main/trpc/routers/agent.router.ts` - add sendTerminalCommand procedure
- `src/renderer/src/components/task/TaskTerminal.tsx` - integrate TerminalInput
- `src/renderer/src/hooks/useTaskTerminal.ts` - may need write function exposure

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Command send latency | <500ms | Same as tmux send-keys + network |
| Keyboard shortcut | Instant | Direct DOM event |
| Error feedback | <100ms | Toast appears immediately |

### UX Considerations

**Input Field Placement:**
- Below the xterm.js terminal output
- Always visible when session is active
- Hidden or disabled when no session

**Keyboard Flow:**
1. User presses `/` anywhere in task detail
2. Input field focuses (if terminal tab active)
3. User types command
4. Press Enter to send
5. Input clears, command appears in terminal output

**Accessibility:**
- aria-label on input field
- Submit button has visible text ("Send")
- Form semantics for Enter key submission

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Implementation Summary:** Full implementation of user command input feature for task terminals. Users can now type commands in a dedicated input field below the terminal, which sends commands via tRPC to tmux send-keys.

2. **Key Files Created/Modified:**
   - `src/renderer/src/components/task/TerminalInput.tsx` (NEW) - 92 lines
   - `src/renderer/src/components/task/TerminalInput.test.tsx` (NEW) - 20 tests
   - `src/main/trpc/routers/agent.router.ts` - Added sendTerminalCommand mutation
   - `src/main/trpc/routers/agent.router.test.ts` - Added 5 tests for sendTerminalCommand
   - `src/renderer/src/components/task/TaskTerminal.tsx` - Integrated TerminalInput, added ref forwarding
   - `src/renderer/src/components/task/TaskTerminal.test.tsx` - Added 7 integration tests
   - `src/renderer/src/components/dialogs/StoryDetailDialog.tsx` - Added "/" keyboard shortcut
   - `src/renderer/src/components/dialogs/StoryDetailDialog.test.tsx` - Added 4 keyboard tests
   - `src/renderer/src/components/task/index.ts` - Export TerminalInput

3. **Test Coverage:** 56 total tests passing:
   - TerminalInput.test.tsx: 20 tests (rendering, submission, validation, error handling, ref forwarding)
   - TaskTerminal.test.tsx: 12 tests (7 new for TES-1.5 integration)
   - StoryDetailDialog.test.tsx: 24 tests (4 new for "/" keyboard shortcut)

4. **Technical Decisions:**
   - Used dedicated input field instead of direct xterm.js input to enable command logging for TES-2.x
   - "/" keyboard shortcut only active when terminal tab is visible
   - Keyboard shortcut ignores presses when already in input/textarea fields
   - TaskTerminalRef interface exposes focusInput() method for keyboard shortcut

5. **Optional Feature Not Implemented:** Ctrl+C/Cmd+C interrupt support (Task 5.3) - marked as optional in story, standard OS copy behavior preserved

6. **Future Work:** Activity logging for user commands is prepared with TODO comment, to be implemented in TES-2.8

### File List

| File | Action | Lines |
|------|--------|-------|
| src/renderer/src/components/task/TerminalInput.tsx | CREATE | 92 |
| src/renderer/src/components/task/TerminalInput.test.tsx | CREATE | 270 |
| src/renderer/src/components/task/TaskTerminal.tsx | MODIFY | +28 |
| src/renderer/src/components/task/TaskTerminal.test.tsx | MODIFY | +94 |
| src/renderer/src/components/task/index.ts | MODIFY | +1 |
| src/renderer/src/components/dialogs/StoryDetailDialog.tsx | MODIFY | +23 |
| src/renderer/src/components/dialogs/StoryDetailDialog.test.tsx | MODIFY | +91 |
| src/main/trpc/routers/agent.router.ts | MODIFY | +52 |
| src/main/trpc/routers/agent.router.test.ts | MODIFY | +64 |

### Code Review Fixes (2026-01-13)

Code review performed by Claude Opus 4.5. Fixed:
1. **Improved error handling in TerminalInput** - Now shows specific error message from tRPC (e.g., "No terminal session for task") instead of generic "Failed to send command"
2. **Added TaskTerminalRef export to index.ts** - Barrel file now exports the ref type for consistent API

