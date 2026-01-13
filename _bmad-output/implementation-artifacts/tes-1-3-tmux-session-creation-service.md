# Story TES-1.3: tmux Session Creation Service

Status: done

---

## Story

As a user,
I want a tmux session created automatically when I move a task to In Progress,
So that the agent has an isolated terminal environment to work in.

## Acceptance Criteria

1. **Given** a task exists in Backlog or any non-In Progress status, **When** the user drags the task to In Progress, **Then** TaskTerminalService creates a new tmux session, **And** the session is named `tinsu-{projectName}-{taskId}`, **And** a task_sessions record is created linking the task to the tmux session

2. **Given** a tmux session already exists for the task, **When** the task moves to In Progress again, **Then** the existing session is reused (not duplicated)

3. **Given** tmux session creation fails, **When** the error is caught, **Then** an error toast displays "Failed to create terminal session", **And** the error is logged with details

## Tasks / Subtasks

- [x] Task 1: Create TaskTerminalService class (AC: #1, #2, #3)
  - [x] 1.1: Create `src/main/services/task-terminal.service.ts` file
  - [x] 1.2: Implement `createSession(taskId: string, projectName: string): Promise<string>` method
  - [x] 1.3: Implement `hasSession(taskId: string): Promise<boolean>` method
  - [x] 1.4: Implement `killSession(taskId: string): Promise<void>` method (for cleanup)
  - [x] 1.5: Add session caching with in-memory Map for performance
  - [x] 1.6: Export service instance for use in routers

- [x] Task 2: Implement tmux session lifecycle (AC: #1, #2)
  - [x] 2.1: Use `tmux new-session -d -s {sessionName}` for detached session creation
  - [x] 2.2: Use `tmux has-session -t {sessionName}` for existence check
  - [x] 2.3: Use `tmux kill-session -t {sessionName}` for session cleanup
  - [x] 2.4: Handle name conflicts with existing sessions
  - [x] 2.5: Add 5-second timeout to all tmux commands (matching TmuxService pattern)

- [x] Task 3: Add database integration (AC: #1)
  - [x] 3.1: Create task_sessions record when session is created
  - [x] 3.2: Generate UUID for session record id
  - [x] 3.3: Store tmux_session name in record
  - [x] 3.4: Query existing session before creating new one
  - [x] 3.5: Return existing session if already exists (AC: #2)

- [x] Task 4: Integrate with status change flow (AC: #1, #3)
  - [x] 4.1: Modify `task.router.ts` updateStatus mutation
  - [x] 4.2: Call TaskTerminalService.createSession when status changes to 'in_progress'
  - [x] 4.3: Pass project name from ConfigService or project context
  - [x] 4.4: Handle errors with TRPCError for proper frontend propagation
  - [x] 4.5: Log session creation for debugging

- [x] Task 5: Write unit tests (AC: #1, #2, #3)
  - [x] 5.1: Create `src/main/services/task-terminal.service.test.ts`
  - [x] 5.2: Test successful session creation
  - [x] 5.3: Test session reuse when already exists
  - [x] 5.4: Test error handling when tmux fails
  - [x] 5.5: Test session naming convention
  - [x] 5.6: Test database record creation

- [x] Task 6: Export and integrate service (AC: #1)
  - [x] 6.1: Add TaskTerminalService to `src/main/services/index.ts`
  - [x] 6.2: Add service to tRPC context if needed
  - [x] 6.3: Verify integration works end-to-end

## Dev Notes

### Architecture Compliance

This story creates the core tmux session management for the Task Execution Sandbox feature. The TaskTerminalService is **CRITICAL** because:

- **Per-task terminal isolation:** Each task gets its own tmux session for command execution
- **Session persistence:** tmux sessions survive app navigation and restarts
- **Command automation:** Future stories will send commands to sessions via `tmux send-keys`
- **Foundation for Epic 1:** This service enables stories 1.4-1.11 (terminal attachment, user input, persistence, etc.)

[Source: _bmad-output/planning-artifacts/architecture.md#Task-Execution-Sandbox-Architecture]

### Technical Requirements

**Service Location:** `src/main/services/task-terminal.service.ts`
- Follow existing service patterns from `tmux.service.ts` and `pty.service.ts`
- Main process only (Node.js `child_process` required)
- NEVER import in renderer process

**tmux Session Naming Convention:**
```
tinsu-{projectName}-{taskId}
```
- Multi-project safe (different projects have different prefixes)
- Task ID ensures uniqueness within project
- Easy to identify in `tmux list-sessions`

Example: `tinsu-myapp-abc123def456`

**tmux Commands Used:**
```bash
# Create new detached session
tmux new-session -d -s tinsu-myapp-task123

# Check if session exists (returns exit 0 if exists, 1 if not)
tmux has-session -t tinsu-myapp-task123

# Kill session
tmux kill-session -t tinsu-myapp-task123

# List all sessions (for debugging)
tmux list-sessions
```

[Source: _bmad-output/planning-artifacts/architecture.md#tmux-Session-Pattern]

### Database Integration

Use the `task_sessions` table created in TES-1.2:

```typescript
// Insert new session record
await db.insert(task_sessions).values({
  id: generateUUID(),
  task_id: taskId,
  tmux_session: sessionName,
  session_id: null,      // Set later when Claude Code starts
  current_phase: null,   // Set when workflow begins
  created_at: new Date()
})

// Check for existing session
const existing = await db.query.task_sessions.findFirst({
  where: eq(task_sessions.task_id, taskId)
})
```

[Source: _bmad-output/planning-artifacts/architecture.md#New-Database-Schema]

### Previous Story Learnings (TES-1.1 & TES-1.2)

**From TES-1.1 (tmux dependency check):**
- Use promisified `exec` with 5-second timeout for all tmux commands
- Use `ExecError` interface for proper error typing
- Exit code 127 means command not found; other errors should be thrown
- Cache results where appropriate to avoid repeated shell calls
- Follow exact naming: `task-terminal.service.ts` (kebab-case with suffix)

**From TES-1.2 (database schema):**
- `task_sessions` table is ready with all columns
- Use `eq()` from drizzle-orm for WHERE clauses
- Foreign key to `tasks.id` with CASCADE delete handles cleanup
- `session_id` column is nullable (set when Claude Code session starts, not now)
- `current_phase` is nullable (set when workflow starts, not during session creation)

### Service Interface Design

```typescript
/**
 * Service for managing per-task tmux sessions.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class TaskTerminalService {
  /**
   * Creates a new tmux session for a task.
   * Returns existing session name if one already exists.
   *
   * @param taskId - The task's unique identifier
   * @param projectName - Project name for session naming
   * @returns The tmux session name (e.g., "tinsu-myapp-task123")
   * @throws Error if tmux command fails
   */
  static async createSession(taskId: string, projectName: string): Promise<string>

  /**
   * Checks if a tmux session exists for the given task.
   *
   * @param taskId - The task's unique identifier
   * @returns true if session exists, false otherwise
   */
  static async hasSession(taskId: string): Promise<boolean>

  /**
   * Kills the tmux session for a task and removes the database record.
   *
   * @param taskId - The task's unique identifier
   */
  static async killSession(taskId: string): Promise<void>

  /**
   * Gets the tmux session name for a task from the database.
   *
   * @param taskId - The task's unique identifier
   * @returns The session name or null if not found
   */
  static async getSessionName(taskId: string): Promise<string | null>
}
```

### Error Handling Pattern

```typescript
import { TRPCError } from '@trpc/server'

// In the router, catch service errors and wrap in TRPCError
try {
  const sessionName = await TaskTerminalService.createSession(taskId, projectName)
  // ...
} catch (error) {
  console.error('Failed to create terminal session:', error)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to create terminal session',
    cause: error
  })
}
```

### Integration with Status Change

The session should be created when task status changes to `in_progress`. This should be done in the `updateStatus` mutation in `task.router.ts`:

```typescript
// In task.router.ts updateStatus mutation
if (input.status === 'in_progress') {
  // Get project name from context or config
  const projectName = await ctx.configService.getProjectName() // or similar

  // Create tmux session (reuses existing if present)
  await TaskTerminalService.createSession(input.id, projectName)
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/task-terminal.service.ts` | CREATE | TaskTerminalService implementation |
| `src/main/services/task-terminal.service.test.ts` | CREATE | Unit tests |
| `src/main/services/index.ts` | MODIFY | Add TaskTerminalService export |
| `src/main/trpc/routers/task.router.ts` | MODIFY | Integrate session creation on status change |

### Project Structure Notes

- Follows existing service patterns (static methods, promisified exec)
- Uses same timeout constant (5000ms) as TmuxService
- Database operations use existing Drizzle patterns
- Error handling follows TRPCError conventions

### References

- [Architecture: Task Execution Sandbox - TaskTerminalService](../_bmad-output/planning-artifacts/architecture.md#taskTerminalService)
- [Architecture: tmux Session Pattern](../_bmad-output/planning-artifacts/architecture.md#tmux-session-pattern)
- [PRD: FR5 - Terminal session creation](../_bmad-output/planning-artifacts/prd-task-execution-sandbox.md)
- [Epics: Story 1.3](../_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-13-tmux-session-creation-service)
- [Project Context: tmux Session Pattern](../_bmad-output/planning-artifacts/project-context.md#tmux-session-pattern)

### Code Patterns to Follow

**Naming Conventions:**
- Service: `TaskTerminalService` (PascalCase class)
- Methods: `createSession()`, `hasSession()`, `killSession()` (camelCase)
- File: `task-terminal.service.ts` (kebab-case with suffix)
- Test: `task-terminal.service.test.ts` (co-located)

**tmux Command Execution:**
```typescript
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const TMUX_COMMAND_TIMEOUT = 5000

// Create detached session
await execAsync(`tmux new-session -d -s ${sessionName}`, { timeout: TMUX_COMMAND_TIMEOUT })

// Check if session exists
try {
  await execAsync(`tmux has-session -t ${sessionName}`, { timeout: TMUX_COMMAND_TIMEOUT })
  return true  // Session exists
} catch {
  return false // Session doesn't exist
}
```

**Database Pattern:**
```typescript
import { db } from '../db'
import { task_sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

// Insert
await db.insert(task_sessions).values({
  id: uuid(),
  task_id: taskId,
  tmux_session: sessionName,
  created_at: new Date()
})

// Query
const existing = await db.query.task_sessions.findFirst({
  where: eq(task_sessions.task_id, taskId)
})
```

### Testing Notes

Run tests with:
```bash
npm test src/main/services/task-terminal.service.test.ts
```

Test scenarios:
1. **Session creation:** New session created, database record inserted
2. **Session reuse:** Existing session returned, no duplicate created
3. **tmux failure:** Error propagated correctly
4. **Session naming:** Correct format `tinsu-{project}-{taskId}`
5. **Session cleanup:** Kill session removes tmux session and database record

Remember native module rebuild:
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Git Intelligence

Recent commits show:
- `67dff0c tes1-1-2 done` - Previous stories completed
- `739798e tes-1-1 done` - TmuxService pattern established

Files modified in last commit (tes-1-2):
- `src/main/db/schema.ts` - task_sessions table added
- `src/main/db/task-sessions.test.ts` - Test patterns established
- `src/shared/types/task.types.ts` - SessionPhase type exported

### Dependencies

This story depends on:
- TES-1.1 (TmuxService for dependency check) - DONE
- TES-1.2 (task_sessions database schema) - DONE

This story enables:
- TES-1.4 (xterm.js terminal attachment)
- TES-1.5 (user command input)
- TES-1.6 (terminal persistence across navigation)
- TES-1.7 (session-task mapping for event routing)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- **2026-01-13**: Implemented TaskTerminalService with full tmux session lifecycle management
  - Created service class with static methods: createSession, hasSession, killSession, getSessionName
  - Session naming convention: `tinsu-{projectName}-{taskId}` with sanitization (lowercase, dash-separated, alphanumeric only)
  - Added in-memory session cache (Map<taskId, sessionName>) for performance optimization
  - Database integration using task_sessions table from TES-1.2
  - 5-second timeout on all tmux commands (matching TmuxService pattern)
  - Integrated with task.router.ts updateStatus mutation to create session when task moves to 'in_progress'
  - Error handling follows TRPCError pattern for proper frontend propagation
  - Written 21 unit tests covering all acceptance criteria: session creation, reuse, error handling, naming convention
  - All tests pass successfully

### Change Log

- 2026-01-13: Implemented TES-1.3 - TaskTerminalService with tmux session creation, database integration, and status change flow integration
- 2026-01-13: Code Review - Fixed 6 issues (3 HIGH, 3 MEDIUM)

### Senior Developer Review (AI)

**Review Date:** 2026-01-13
**Reviewer Model:** Claude Opus 4.5

**Issues Found and Fixed:**

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | HIGH | Command injection - taskId not sanitized for shell commands | Added `SAFE_SHELL_ARG_REGEX` validation rejecting special chars |
| 2 | HIGH | Cache inconsistency - cache cleared after DB delete could leave stale data | Moved cache clear before DB delete |
| 3 | HIGH | Race condition - concurrent createSession calls could violate unique constraint | Added try/catch for UNIQUE constraint with fallback to existing session |
| 4 | MEDIUM | No tmux availability check before use | Added TmuxService.checkTmuxInstalled() check with helpful error message |
| 5 | MEDIUM | Generic TRPCError message unhelpful to users | Extracted specific error messages for tmux not installed, invalid taskId |
| 6 | MEDIUM | No security/edge case tests | Added 5 new tests for security validation and race condition |

**Tests Added:**
- `throws error when tmux is not installed`
- `rejects invalid taskId with special characters (security)`
- `rejects taskId with spaces (security)`
- `accepts valid UUID-style taskId`
- `handles race condition with unique constraint violation`

**Final Test Count:** 26 tests (all passing)

### File List

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/task-terminal.service.ts` | CREATE | TaskTerminalService implementation with createSession, hasSession, killSession, getSessionName |
| `src/main/services/task-terminal.service.test.ts` | CREATE | 21 unit tests covering all acceptance criteria |
| `src/main/services/index.ts` | MODIFY | Added TaskTerminalService export |
| `src/main/trpc/routers/task.router.ts` | MODIFY | Integrated session creation on status change to in_progress |
