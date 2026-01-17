# Story TES-2.6: Agent Start/Complete Event Capture

Status: done

---

## Story

As a user,
I want to see when agents start and finish working,
So that I can track execution phases.

## Acceptance Criteria

1. **Given** Claude Code starts working on a task, **When** the agent begins execution, **Then** an activity event is logged with event_type: "agent_start", **And** payload contains { phase: "dev-story" | "code-review" | "manual" }

2. **Given** a Stop hook fires for a task, **When** the hook event is received, **Then** an activity event is logged with event_type: "agent_complete", **And** payload contains { phase, duration_ms, session_id }

3. **Given** agent_start was logged, **When** agent_complete is logged, **Then** duration_ms is calculated from the start event

## Tasks / Subtasks

- [x] Task 1: Implement agent_start event logging (AC: #1)
  - [x] 1.1: Identify where Claude Code execution begins (TaskTerminalService.sendCommand or tmux send-keys trigger)
  - [x] 1.2: Determine current workflow phase from task_sessions.current_phase
  - [x] 1.3: Call ActivityLogService.logActivity with event_type: "agent_start" and phase payload
  - [x] 1.4: Handle case where phase is null (use "manual" as default)

- [x] Task 2: Implement session_id capture for task mapping (AC: #2)
  - [x] 2.1: Update task_sessions table with session_id when Stop hook first fires
  - [x] 2.2: Implement session_id -> task_id lookup in HookListenerService
  - [x] 2.3: Handle orphan events (session_id not found) gracefully with console log warning

- [x] Task 3: Implement agent_complete event logging (AC: #2, #3)
  - [x] 3.1: Modify HookListenerService.onStopHook to look up task_id from session_id
  - [x] 3.2: Calculate duration_ms from agent_start event timestamp
  - [x] 3.3: Call ActivityLogService.logActivity with event_type: "agent_complete" and full payload
  - [x] 3.4: Include session_id in payload for debugging

- [x] Task 4: Duration calculation logic (AC: #3)
  - [x] 4.1: Query most recent agent_start event for the task when logging agent_complete
  - [x] 4.2: Calculate duration_ms = current_time - agent_start.created_at
  - [x] 4.3: Handle edge case: no agent_start found (log warning, set duration_ms to null)

- [x] Task 5: Write unit tests
  - [x] 5.1: Test agent_start event logged when command sent to tmux
  - [x] 5.2: Test agent_start payload contains correct phase
  - [x] 5.3: Test agent_complete event logged when Stop hook fires
  - [x] 5.4: Test agent_complete payload contains duration_ms, phase, session_id
  - [x] 5.5: Test duration_ms is calculated correctly from agent_start timestamp
  - [x] 5.6: Test orphan session handling (session_id not mapped to task)
  - [x] 5.7: Test agent_complete with missing agent_start (edge case)

- [x] Task 6: Verify integration with existing services
  - [x] 6.1: Verify ActivityLogService accepts "agent_start" and "agent_complete" event types
  - [x] 6.2: Verify task_sessions table has session_id column
  - [x] 6.3: Run existing tests to ensure no regressions

## Dev Notes

### Architecture Compliance

This story implements **FR11** and **FR12** from the Task Execution Sandbox PRD:

> FR11: System can capture agent start events when Claude Code begins work
> FR12: System can capture agent complete events when Claude Code finishes responding

And extends the HookListenerService infrastructure from **TES-2.3** and ActivityLogService from **TES-2.2**.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]

### Previous Story Learnings

**From TES-2.5 (Status Change Event Capture):**
- ActivityLogService.logActivity(taskId, eventType, payload) is the standard call pattern
- Activity logging should not fail the main operation (wrap in try/catch if needed)
- Only log events that actually occurred (guard conditions)
- Test coverage should include edge cases

**From TES-2.3 (Hook Listener HTTP Server):**
- HookListenerService.onStopHook receives StopHookPayload with session_id
- TODO comments at lines 362-368 mark exactly where agent_complete logging should go
- TODO comments at lines 379-384 mark where tool_used logging should go (TES-2.7)
- Hook payloads are already validated via Zod schemas

**From TES-2.4 (Claude Code Hook Scripts):**
- Hook scripts POST JSON to /api/hooks/stop with session_id from Claude Code
- Scripts fail silently if TinSu not running (exit 0 pattern)
- Session ID comes from Claude Code's internal session tracking

**From TES-1.2 (Task Session Database Schema):**
- task_sessions table has session_id column (nullable, set when known)
- task_sessions.current_phase tracks workflow phase ("dev-story" | "code-review" | "user-feedback")
- session_id is unique index for fast lookups

[Source: _bmad-output/implementation-artifacts/tes-2-5-status-change-event-capture.md]

### Technical Implementation Guidance

**Agent Start Event - Integration Point:**

The agent_start event should be logged when a Claude Code command is sent to the task's tmux session. The likely integration point is in TaskTerminalService or wherever the dev-story/code-review command is triggered.

```typescript
// In TaskTerminalService.sendCommand() or equivalent
async sendCommand(taskId: string, command: string): Promise<void> {
  // Get current phase from task_sessions
  const session = await db.query.taskSessions.findFirst({
    where: eq(taskSessions.task_id, taskId)
  })

  const phase = session?.current_phase ?? 'manual'

  // Log agent_start before sending command
  await activityLogService.logActivity(taskId, 'agent_start', {
    phase
  })

  // Send command to tmux
  // ... existing tmux send-keys logic
}
```

**Agent Complete Event - Integration Point:**

The agent_complete event should be logged in HookListenerService.onStopHook when the Stop hook fires. The TODO at line 362-368 in hook-listener.service.ts marks this location.

```typescript
// In HookListenerService.onStopHook()
async onStopHook(payload: StopHookPayload): Promise<void> {
  console.log('[HookListener] Stop hook received:', JSON.stringify(payload, null, 2))

  // 1. Look up task_id from session_id
  const session = await db.query.taskSessions.findFirst({
    where: eq(taskSessions.session_id, payload.session_id)
  })

  if (!session) {
    console.warn('[HookListener] Orphan stop event - session_id not found:', payload.session_id)
    return
  }

  const taskId = session.task_id
  const phase = session.current_phase ?? 'manual'

  // 2. Calculate duration from agent_start event
  const startEvent = await activityLogService.getActivities(taskId, {
    eventTypes: ['agent_start'],
    limit: 1
  })

  const startTime = startEvent[0]?.created_at
  const duration_ms = startTime ? Date.now() - startTime : null

  // 3. Log agent_complete activity
  await activityLogService.logActivity(taskId, 'agent_complete', {
    phase,
    duration_ms,
    session_id: payload.session_id
  })

  // Future: Trigger AutomationService.onAgentComplete() for workflow transitions
}
```

**Session ID Capture:**

When the Stop hook fires, we may need to capture/update the session_id in task_sessions if not already set:

```typescript
// Option 1: First hook event updates session_id
if (!session.session_id) {
  await db.update(taskSessions)
    .set({ session_id: payload.session_id })
    .where(eq(taskSessions.task_id, taskId))
}

// Option 2: Session ID is set when Claude Code starts (TES-1.7)
// Check if this is already implemented in TaskTerminalService
```

**Event Type Verification:**

The `ACTIVITY_EVENT_TYPE` enum in `src/main/db/schema.ts:261-272` already includes:
- `agent_start`
- `agent_complete`

[Source: src/main/db/schema.ts]

**Payload Schemas:**

```typescript
interface AgentStartPayload {
  phase: 'dev-story' | 'code-review' | 'manual'
}

interface AgentCompletePayload {
  phase: 'dev-story' | 'code-review' | 'manual'
  duration_ms: number | null
  session_id: string
}
```

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Event types | snake_case | `agent_start`, `agent_complete` |
| Payload keys | snake_case | `duration_ms`, `session_id` |
| Service methods | camelCase | `logActivity`, `onStopHook` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**tRPC Error Handling:**
```typescript
// Use TRPCError for known errors (though hook handlers should be resilient)
throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' })
```

**Testing Pattern:**
```typescript
// Test file: src/main/services/hook-listener.service.test.ts

describe('onStopHook agent_complete logging', () => {
  it('logs agent_complete activity when Stop hook fires', async () => {
    // Arrange: Create a task with session
    const task = await createTestTask({ status: 'in_progress' })
    await createTaskSession(task.id, { session_id: 'test-session-123', current_phase: 'dev-story' })

    // Simulate agent_start was logged earlier
    await activityLogService.logActivity(task.id, 'agent_start', { phase: 'dev-story' })

    // Act: Fire Stop hook
    await hookListener.onStopHook({
      session_id: 'test-session-123',
      transcript_path: '/tmp/transcript',
      cwd: '/home/user/project',
      hook_event_name: 'Stop'
    })

    // Assert: agent_complete was logged
    const activities = await activityLogService.getActivities(task.id, {
      eventTypes: ['agent_complete']
    })
    expect(activities).toHaveLength(1)
    const payload = JSON.parse(activities[0].payload!)
    expect(payload.phase).toBe('dev-story')
    expect(payload.session_id).toBe('test-session-123')
    expect(payload.duration_ms).toBeGreaterThan(0)
  })
})
```

### Project Structure Notes

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/hook-listener.service.ts` | MODIFY | Add agent_complete logging in onStopHook (lines 364-369) |
| `src/main/services/task-terminal.service.ts` | MODIFY | Add agent_start logging when sending commands (if exists) |
| `src/main/services/hook-listener.service.test.ts` | MODIFY or CREATE | Add tests for agent_complete logging |

**Key Integration Points:**
- `src/main/services/activity-log.service.ts` - Already exports `activityLogService` instance
- `src/main/db/schema.ts` - Already has `ACTIVITY_EVENT_TYPE` with `agent_start` and `agent_complete`
- `src/main/services/hook-listener.service.ts` - Has TODO markers for TES-2.6 integration

### Database Access Pattern

The HookListenerService needs database access for:
1. Looking up task_id from session_id in task_sessions table
2. Querying agent_start events for duration calculation

**Option 1: Inject db into HookListenerService**
```typescript
class HookListenerService {
  constructor(private db: BetterSQLite3Database) {}
}
```

**Option 2: Use services from central services/index.ts**
```typescript
import { db } from '../db'
import { activityLogService } from './index'
```

Check how TES-2.3 implemented this - likely db is already available or needs to be injected.

### References

- [Architecture: HookListenerService](/_bmad-output/planning-artifacts/architecture.md#hooklistenerservice)
- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [PRD: FR11 Agent Start Events](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [PRD: FR12 Agent Complete Events](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.6](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-26-agent-startcomplete-event-capture)
- [Project Context: Task Execution Sandbox](/_bmad-output/planning-artifacts/project-context.md#task-execution-sandbox-patterns)
- [TES-2.3: Hook Listener HTTP Server](/_bmad-output/implementation-artifacts/tes-2-3-hook-listener-http-server.md)
- [TES-2.2: Activity Log Service Core](/_bmad-output/implementation-artifacts/tes-2-2-activity-log-service-core.md)
- [TES-1.2: Task Session Database Schema](/_bmad-output/implementation-artifacts/tes-1-2-task-session-database-schema.md)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/hook-listener.service.test.ts
```

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Activity event latency | <1s | Events appear in UI within 1 second (NFR1) |
| Activity log integrity | Zero loss | No activity events lost during normal operation (NFR11) |
| Hook event delivery | 99%+ | Claude Code hook events successfully reach TinSu (NFR13) |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With HookListenerService (TES-2.3):**
- onStopHook receives session_id from Claude Code
- Existing validation via Zod schemas
- TODO markers at lines 362-368 indicate integration point

**With TaskTerminalService (TES-1.x):**
- sendCommand is where agent_start should be logged
- May need to inject activityLogService

**With ActivityLogService (TES-2.2):**
- Direct call to logActivity() with event_type "agent_start" or "agent_complete"
- Uses existing database persistence

**With Activity UI (TES-2.11-2.13):**
- Agent events will be visible in activity log UI
- Can be filtered using "Agent" filter chip
- Real-time streaming will show events immediately (TES-2.13)

### Edge Cases to Handle

1. **Orphan session_id:** Log warning, don't throw error, return early
2. **Missing agent_start:** Set duration_ms to null, log warning
3. **Duplicate Stop hooks:** Should be safe - just logs another agent_complete
4. **Hook delivery failure:** Hook scripts fail silently, TinSu won't receive event
5. **Concurrent sessions:** Each session maps to one task via unique session_id

### Scope Notes

**In Scope (This Story):**
- Log agent_start activity when Claude Code command sent
- Log agent_complete activity when Stop hook fires
- Calculate duration_ms from start to complete
- Session-to-task mapping for event routing

**Out of Scope (Future Stories):**
- Tool usage events (TES-2.7)
- User command events (TES-2.8)
- Automation trigger events (TES-2.9)
- Error events (TES-2.10)
- Activity log UI display (TES-2.11)
- AutomationService.onAgentComplete() workflow transitions (TES-5.x)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Debug Log References

None

### Completion Notes List

- **Task 1**: Implemented agent_start logging in `TaskTerminalService.sendCommand()` at lines 377-387. Queries task_sessions for current_phase and logs agent_start event before sending command to tmux. Handles null phase by defaulting to "manual".

- **Task 2**: Implemented session_id lookup in `HookListenerService.onStopHook()` at lines 370-388. Queries task_sessions by session_id to map back to task_id. Logs warning for orphan sessions and returns early without throwing.

- **Task 3**: Implemented agent_complete logging in `HookListenerService.onStopHook()` at lines 420-429. Logs agent_complete event with phase, duration_ms, and session_id in payload.

- **Task 4**: Implemented duration calculation at lines 393-418. Queries most recent agent_start event, calculates duration_ms from timestamp, handles missing start event gracefully by setting duration_ms to null.

- **Task 5**: Added 10 unit tests covering all acceptance criteria:
  - 3 tests in task-terminal.service.test.ts for agent_start logging
  - 7 tests in hook-listener.service.test.ts for agent_complete logging

- **Task 6**: Verified integration - all TES-2.6 tests pass (10/10), no new regressions introduced.

### File List

| File | Action | Changes |
|------|--------|---------|
| `src/main/services/task-terminal.service.ts` | MODIFIED | Added agent_start logging in sendCommand() (lines 377-387) |
| `src/main/services/task-terminal.service.test.ts` | MODIFIED | Added 3 TES-2.6 tests for agent_start logging |
| `src/main/services/hook-listener.service.ts` | MODIFIED | Added db imports, implemented agent_complete logging in onStopHook() (lines 367-432) |
| `src/main/services/hook-listener.service.test.ts` | MODIFIED | Added 7 TES-2.6 tests for agent_complete logging |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFIED | Updated story status: ready-for-dev → done |
