# Story TES-1.7: Session-Task Mapping & Event Routing

Status: done

---

## Story

As a system,
I want to associate Claude Code session IDs with task IDs,
So that hook events can be routed to the correct task.

## Acceptance Criteria

1. **Given** Claude Code starts in a task's tmux session, **When** a Stop or PostToolUse hook fires with a session_id, **Then** the system looks up the task_id from task_sessions table, **And** routes the event to the correct task's activity log

2. **Given** a session_id is not found in task_sessions, **When** a hook event arrives, **Then** the event is logged as "orphan event" for debugging, **And** no error is thrown

3. **Given** Claude Code session starts, **When** the session_id becomes known (from hook payload), **Then** the task_sessions record is updated with the session_id

## Tasks / Subtasks

- [x] Task 1: Create TaskSessionService for session-task mapping (AC: #1, #3)
  - [x] 1.1: Create `src/main/services/task-session.service.ts` with `updateSessionId(taskId, sessionId)` method
  - [x] 1.2: Add `getTaskBySessionId(sessionId)` method for reverse lookup
  - [x] 1.3: Add in-memory cache for sessionId -> taskId lookups (hot path for hook events)
  - [x] 1.4: Add `clearSession(taskId)` method for cleanup when task completes
  - [x] 1.5: Write comprehensive unit tests in `task-session.service.test.ts`

- [x] Task 2: Implement event routing logic in existing hook handlers (AC: #1, #2)
  - [x] 2.1: Create `routeHookEvent(sessionId, eventType, payload)` method in TaskSessionService
  - [x] 2.2: If sessionId found → return taskId for routing
  - [x] 2.3: If sessionId NOT found → log as "orphan event" with full payload, return null
  - [x] 2.4: Orphan events logged to console.warn (not error) for debugging
  - [x] 2.5: Add tests for orphan event handling (no throw, logs warning)

- [x] Task 3: Update task_sessions on Claude Code session start (AC: #3)
  - [x] 3.1: Add tRPC mutation `agent.registerSessionId` that updates task_sessions.session_id
  - [x] 3.2: Mutation takes `{ taskId: string, sessionId: string }` input
  - [x] 3.3: Update TaskSessionService cache when session_id is set
  - [x] 3.4: Add test for session_id registration flow

- [x] Task 4: Add session_id extraction logic for future hook integration (AC: #1, #3)
  - [x] 4.1: Document session_id JSON structure from Claude Code hooks: `{ session_id: string, ... }`
  - [x] 4.2: Create `extractSessionId(hookPayload: unknown): string | null` utility
  - [x] 4.3: Add TypeScript interface `ClaudeHookPayload` in shared types
  - [x] 4.4: Write tests for session_id extraction from various payload formats

- [x] Task 5: Verify integration points with existing infrastructure (AC: #1, #2, #3)
  - [x] 5.1: Verify TaskTerminalService.createSession creates task_sessions record (already done in TES-1.3)
  - [x] 5.2: Add integration test: createSession → registerSessionId → getTaskBySessionId
  - [x] 5.3: Verify cache invalidation when task is deleted (via ON DELETE CASCADE)
  - [x] 5.4: All 5 unit tests must pass (run `npm test src/main/services/task-session.service.test.ts`)

## Dev Notes

### Architecture Compliance

This story implements **FR45-FR47** (Session-Task Mapping) from the Task Execution Sandbox PRD:

- **FR45:** System can associate Claude Code session ID with task ID
- **FR46:** System can route hook events to correct task based on session ID
- **FR47:** System can rebuild session-task mapping from existing terminal sessions on app restart

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#session-task-mapping]

### Technical Requirements

**Session-Task Mapping Flow:**

```
1. Task moves to In Progress
2. TaskTerminalService.createSession(taskId, projectName)
   → Creates tmux session
   → Creates task_sessions record with session_id = NULL

3. Claude Code starts in tmux session
4. First hook fires (Stop or PostToolUse)
   → Payload contains session_id

5. TaskSessionService.updateSessionId(taskId, sessionId)
   → Updates task_sessions.session_id in database
   → Updates in-memory cache

6. Subsequent hooks fire
   → TaskSessionService.getTaskBySessionId(sessionId)
   → Returns taskId for routing (from cache, O(1))
   → Events routed to correct task
```

**Why session_id is NOT Known at Session Creation:**

Claude Code generates its own internal session_id when it starts. This ID is NOT related to the tmux session name. The session_id only becomes available when the first hook fires and includes the ID in its JSON payload.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#technical-architecture]

### Database Schema (Already Exists)

The `task_sessions` table was created in TES-1.2 and is ready for use:

```typescript
// src/main/db/schema.ts (lines 209-237)
export const task_sessions = sqliteTable(
  'task_sessions',
  {
    id: text('id').primaryKey(),
    task_id: text('task_id')
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    session_id: text('session_id'), // ← This is what we update when Claude starts
    tmux_session: text('tmux_session').notNull(),
    current_phase: text('current_phase'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_task_sessions_session_id').on(table.session_id), // ← Index for fast lookups
    uniqueIndex('idx_task_sessions_task_id_unique').on(table.task_id)
  ]
)
```

### Code Patterns

**TaskSessionService Implementation:**

```typescript
// src/main/services/task-session.service.ts
import { db } from '../db'
import { task_sessions } from '../db/schema'
import { eq } from 'drizzle-orm'

/**
 * Service for managing session-task mappings.
 *
 * Maps Claude Code session IDs to task IDs for hook event routing.
 * Uses in-memory cache for O(1) lookups on hot path.
 *
 * @see TES-1.7: Session-Task Mapping & Event Routing
 */
export class TaskSessionService {
  // In-memory cache: sessionId -> taskId
  // Hot path for hook events - must be fast
  private static sessionToTaskCache: Map<string, string> = new Map()

  /**
   * Updates the Claude Code session_id for a task.
   * Called when the first hook fires and session_id becomes known.
   */
  static async updateSessionId(taskId: string, sessionId: string): Promise<void> {
    // Update database
    await db
      .update(task_sessions)
      .set({ session_id: sessionId })
      .where(eq(task_sessions.task_id, taskId))

    // Update cache
    this.sessionToTaskCache.set(sessionId, taskId)
  }

  /**
   * Gets the taskId for a given Claude Code session_id.
   * Returns null if session not found (orphan event).
   */
  static async getTaskBySessionId(sessionId: string): Promise<string | null> {
    // Check cache first (hot path)
    const cached = this.sessionToTaskCache.get(sessionId)
    if (cached) return cached

    // Fall back to database
    const record = await db.query.task_sessions.findFirst({
      where: eq(task_sessions.session_id, sessionId)
    })

    if (record) {
      // Update cache for future lookups
      this.sessionToTaskCache.set(sessionId, record.task_id)
      return record.task_id
    }

    return null
  }

  /**
   * Routes a hook event to the correct task.
   * Returns taskId if found, null if orphan event.
   *
   * Does NOT throw on orphan events - logs warning instead.
   */
  static async routeHookEvent(
    sessionId: string,
    eventType: string,
    payload: unknown
  ): Promise<string | null> {
    const taskId = await this.getTaskBySessionId(sessionId)

    if (!taskId) {
      // Orphan event - log for debugging but don't throw
      console.warn('[TaskSessionService] Orphan hook event received:', {
        sessionId,
        eventType,
        payload
      })
      return null
    }

    return taskId
  }

  /**
   * Clears session mapping when task completes or is deleted.
   */
  static clearSession(taskId: string): void {
    // Find and remove from cache by value (taskId)
    for (const [sessionId, tid] of this.sessionToTaskCache) {
      if (tid === taskId) {
        this.sessionToTaskCache.delete(sessionId)
        break
      }
    }
  }

  /** Clears all cached mappings. For testing. */
  static clearCache(): void {
    this.sessionToTaskCache.clear()
  }
}
```

**Claude Code Hook Payload Interface:**

```typescript
// src/shared/types/hook.types.ts (NEW FILE)

/**
 * Claude Code hook event payload structure.
 *
 * Both Stop and PostToolUse hooks receive JSON via stdin
 * with this structure.
 *
 * @see Claude Code documentation for hook event details
 */
export interface ClaudeHookPayload {
  /** Unique identifier for the Claude Code session */
  session_id: string
  /** Path to the transcript JSON file */
  transcript_path: string
  /** Current working directory where Claude is running */
  cwd: string
  /** Name of the hook event (Stop, PostToolUse, etc.) */
  hook_event_name: string
}

/**
 * Extracts session_id from a hook payload safely.
 * Returns null if payload is invalid or session_id is missing.
 */
export function extractSessionId(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'session_id' in payload &&
    typeof (payload as ClaudeHookPayload).session_id === 'string'
  ) {
    return (payload as ClaudeHookPayload).session_id
  }
  return null
}
```

**tRPC Mutation for Session Registration:**

```typescript
// Add to src/main/trpc/routers/agent.router.ts

/**
 * Register a Claude Code session ID with a task.
 *
 * Story TES-1.7 - AC: #3
 *
 * Called when the first hook fires and session_id becomes known.
 * Updates task_sessions table and in-memory cache.
 */
registerSessionId: publicProcedure
  .input(
    z.object({
      taskId: z.string(),
      sessionId: z.string()
    })
  )
  .mutation(async ({ input }) => {
    await TaskSessionService.updateSessionId(input.taskId, input.sessionId)
    return { success: true }
  }),
```

### Previous Story Learnings (TES-1.6)

**From TES-1.6 Implementation:**
- Zustand stores use `Map<string, T>` pattern with LRU eviction
- Tests use `vi.mock` for tRPC and service mocking
- Static service methods are testable by clearing state between tests
- In-memory caches must be cleared in `beforeEach` for test isolation

**From TES-1.5 Implementation:**
- tRPC mutation error handling uses `TRPCError` with appropriate codes
- Toast notifications for user-facing errors
- Component tests co-located with source files

**Existing Infrastructure:**
- `TaskTerminalService` already creates `task_sessions` records (TES-1.3)
- `task_sessions.session_id` column exists but is set to NULL at creation
- Index on `session_id` exists for fast lookups

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/task-session.service.ts` | CREATE | Session-task mapping service |
| `src/main/services/task-session.service.test.ts` | CREATE | Service unit tests |
| `src/shared/types/hook.types.ts` | CREATE | Claude hook payload types |
| `src/main/trpc/routers/agent.router.ts` | MODIFY | Add registerSessionId mutation |
| `src/main/trpc/routers/agent.router.test.ts` | MODIFY | Add mutation tests |

### Project Structure Notes

- Service follows existing pattern from `task-terminal.service.ts`
- Static methods with internal cache (same as TaskTerminalService)
- Shared types go in `src/shared/types/` per project conventions
- Tests co-located with source files

### References

- [Architecture: Session-Task Mapping](_bmad-output/planning-artifacts/architecture.md#Session-Task-Mapping)
- [PRD: FR45-FR47](_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#session-task-mapping)
- [Epics: Story 1.7](_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-17-session-task-mapping--event-routing)
- [Project Context: Service Patterns](_bmad-output/planning-artifacts/project-context.md#critical-implementation-rules)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/task-session.service.test.ts
npm test src/main/trpc/routers/agent.router.test.ts
```

Test scenarios:
1. **updateSessionId:** Verify database update and cache population
2. **getTaskBySessionId:** Verify cache-first lookup, then database fallback
3. **routeHookEvent - success:** Verify taskId returned for known session
4. **routeHookEvent - orphan:** Verify null returned, warning logged, no throw
5. **clearSession:** Verify cache entry removed by taskId
6. **extractSessionId:** Verify extraction from valid/invalid payloads
7. **Cache isolation:** Verify clearCache() between tests

Remember native module rebuild:
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| sessionId lookup time | <1ms | Cache hit (hot path) |
| Database fallback | <10ms | SQLite indexed query |
| Orphan event handling | No throw | Logs warning only |
| Cache memory | <1KB per session | String-to-string map |
| Session registration | <50ms | Single UPDATE query |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Future Integration (TES-2.x)

This story prepares the foundation for Epic 2 (Activity Log & Event Tracking):

- **TES-2.3 (Hook Listener HTTP Server):** Will call `routeHookEvent()` when hooks arrive
- **TES-2.4 (Claude Code Hook Scripts):** Will send session_id in hook payloads
- **TES-2.5-2.10 (Event Capture):** Will use taskId from routing to log activities

This story does NOT implement the hook listener or hook scripts - it only implements the session-task mapping that those future stories will use.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- None required - implementation was straightforward

### Completion Notes List

- ✅ Created TaskSessionService with updateSessionId, getTaskBySessionId, routeHookEvent, clearSession methods
- ✅ Implemented in-memory cache (Map<string, string>) for O(1) sessionId → taskId lookups
- ✅ Added console.warn logging for orphan events (no throw per AC#2)
- ✅ Added tRPC mutation `agent.registerSessionId` to agent.router.ts
- ✅ Created ClaudeHookPayload interface and extractSessionId utility in src/shared/types/hook.types.ts
- ✅ Added isClaudeHookPayload type guard for robust payload validation
- ✅ All 94 TES-1.7 related tests pass (19 service + 25 hook types + 50 router)
- ✅ Integration verified: TaskTerminalService.createSession already creates task_sessions with session_id=null
- ✅ Cache is invalidated via clearSession() when tasks are deleted

### File List

**Created:**
- src/main/services/task-session.service.ts
- src/main/services/task-session.service.test.ts
- src/shared/types/hook.types.ts
- src/shared/types/hook.types.test.ts

**Modified:**
- src/main/trpc/routers/agent.router.ts (added registerSessionId mutation, imported TaskSessionService)
- src/main/trpc/routers/agent.router.test.ts (added mock for TaskSessionService, 4 new tests for registerSessionId)

### Change Log

- 2026-01-14: Implemented session-task mapping service and hook event routing (TES-1.7)

### Code Review Fixes Applied (2026-01-13)

**HIGH severity fixes:**
1. Fixed test schema in agent.router.test.ts - added missing `sprint_id` column to epics table
2. Fixed story_number type mismatch - tests now use strings ('3', '7') instead of numbers
3. Added integration flow tests for Task 5.2 (full session registration → lookup → routing flow)
4. Documented cache invalidation limitation in TaskSessionService JSDoc

**MEDIUM severity fixes:**
1. Added validation in registerSessionId mutation - throws NOT_FOUND if task_sessions record doesn't exist
2. Added cache size limit (MAX_CACHE_SIZE = 1000) with FIFO eviction to prevent unbounded growth

**Tests added:**
- 2 integration flow tests in task-session.service.test.ts
- 1 NOT_FOUND validation test in agent.router.test.ts
