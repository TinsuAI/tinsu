# Story TES-2.7: Tool Usage Event Capture

Status: done

---

## Story

As a user,
I want to see what tools the agent used,
So that I can understand what actions were taken.

## Acceptance Criteria

1. **Given** a PostToolUse hook fires, **When** the hook event is received by HookListenerService, **Then** an activity event is logged with event_type: "tool_used", **And** payload contains { tool: "Edit" | "Bash" | "Read" | etc., file?: string, summary?: string }

2. **Given** the agent edits a file, **When** the tool_used event is logged, **Then** the payload includes the file path and change summary (e.g., "+45 -12")

3. **Given** the agent runs a bash command, **When** the tool_used event is logged, **Then** the payload includes the command (truncated if long)

## Tasks / Subtasks

- [x] Task 1: Implement session_id to task_id lookup for tool-use events (AC: #1)
  - [x] 1.1: Reuse the session lookup pattern from onStopHook (lines 370-388 in hook-listener.service.ts)
  - [x] 1.2: Handle orphan session_id gracefully (log warning, return early, don't throw)
  - [x] 1.3: Return early if no task found for session_id

- [x] Task 2: Implement tool_used activity logging (AC: #1)
  - [x] 2.1: In HookListenerService.onToolUseHook, look up task_id from session_id via task_sessions table
  - [x] 2.2: Extract tool_name from payload (already validated by Zod)
  - [x] 2.3: Call ActivityLogService.logActivity with event_type: "tool_used" and constructed payload
  - [x] 2.4: Wrap in try/catch to prevent tool logging failures from breaking hook handling

- [x] Task 3: Extract file path from tool_input for file operations (AC: #2)
  - [x] 3.1: For Edit/Read/Write tools, extract file_path from tool_input
  - [x] 3.2: For Glob/Grep tools, extract pattern or path from tool_input
  - [x] 3.3: Store as `file` field in payload (null if not a file operation)

- [x] Task 4: Generate change summary for Edit tool (AC: #2)
  - [x] 4.1: For Edit tool, extract old_string and new_string from tool_input
  - [x] 4.2: Calculate approximate line change (+N -M) if both old/new provided
  - [x] 4.3: If calculation not possible, use descriptive summary like "file edited"

- [x] Task 5: Extract and truncate command for Bash tool (AC: #3)
  - [x] 5.1: For Bash tool, extract command from tool_input
  - [x] 5.2: Truncate command to max 100 characters if longer
  - [x] 5.3: Store as `command` field in payload for Bash tools

- [x] Task 6: Write unit tests
  - [x] 6.1: Test tool_used event logged when PostToolUse hook fires with valid session
  - [x] 6.2: Test payload contains tool name from hook payload
  - [x] 6.3: Test file path extracted for Read/Edit/Write tools
  - [x] 6.4: Test change summary generated for Edit tool
  - [x] 6.5: Test command extracted and truncated for Bash tool
  - [x] 6.6: Test orphan session handling (session_id not mapped to task)
  - [x] 6.7: Test graceful handling when activity logging fails

- [x] Task 7: Verify integration with existing services
  - [x] 7.1: Verify ActivityLogService accepts "tool_used" event type
  - [x] 7.2: Verify ToolUseHookPayloadSchema is correctly defined
  - [x] 7.3: Run existing tests to ensure no regressions

## Dev Notes

### Architecture Compliance

This story implements **FR13** from the Task Execution Sandbox PRD:

> FR13: System can capture tool usage events (file edits, bash commands, git operations)

And extends the HookListenerService infrastructure from **TES-2.3** and the session-to-task mapping pattern from **TES-2.6**.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]

### Previous Story Learnings

**From TES-2.6 (Agent Start/Complete Event Capture) - CRITICAL REFERENCE:**
- Session-to-task lookup pattern already implemented at lines 370-388 in hook-listener.service.ts
- Use `db.select().from(task_sessions).where(eq(task_sessions.session_id, payload.session_id)).get()`
- Orphan handling: log warning, return early, don't throw
- Activity logging wrapped in try/catch to prevent failures from breaking main flow
- ActivityLogService.logActivity(taskId, eventType, payload) is the standard call

**From TES-2.5 (Status Change Event Capture):**
- Activity logging should not fail the main operation (wrap in try/catch if needed)
- Only log events that actually occurred (guard conditions)

**From TES-2.3 (Hook Listener HTTP Server):**
- HookListenerService.onToolUseHook receives ToolUseHookPayload with session_id, tool_name, tool_input
- TODO comment at lines 446-448 marks exactly where tool_used logging should go
- Hook payloads are already validated via Zod schemas

[Source: _bmad-output/implementation-artifacts/tes-2-6-agent-start-complete-event-capture.md]

### Technical Implementation Guidance

**Existing Code Location:**

The TODO at lines 444-448 in hook-listener.service.ts marks the integration point:

```typescript
// Current implementation (line 444-448):
async onToolUseHook(payload: ToolUseHookPayload): Promise<void> {
  console.log('[HookListener] Tool use hook received:', JSON.stringify(payload, null, 2))
  // Future integration point (TES-2.7):
  // - Call ActivityLogService to log tool_used event
}
```

**Implementation Pattern (following TES-2.6):**

```typescript
async onToolUseHook(payload: ToolUseHookPayload): Promise<void> {
  console.log('[HookListener] Tool use hook received:', JSON.stringify(payload, null, 2))

  // TES-2.7: Look up task_id from session_id (same pattern as onStopHook)
  const session = db
    .select()
    .from(task_sessions)
    .where(eq(task_sessions.session_id, payload.session_id))
    .get()

  if (!session) {
    console.warn(
      `[HookListener] Orphan tool-use event - session_id not found:`,
      payload.session_id
    )
    return
  }

  const taskId = session.task_id

  // TES-2.7: Build payload based on tool type
  const activityPayload: ToolUsedPayload = {
    tool: payload.tool_name
  }

  // Extract file path for file operations
  if (['Read', 'Edit', 'Write', 'Glob', 'Grep'].includes(payload.tool_name)) {
    const filePath = payload.tool_input.file_path ?? payload.tool_input.path ?? payload.tool_input.pattern
    if (filePath && typeof filePath === 'string') {
      activityPayload.file = filePath
    }
  }

  // Extract command for Bash tool (truncated to 100 chars)
  if (payload.tool_name === 'Bash') {
    const command = payload.tool_input.command
    if (command && typeof command === 'string') {
      activityPayload.command = command.length > 100 ? command.substring(0, 100) + '...' : command
    }
  }

  // Generate summary for Edit tool
  if (payload.tool_name === 'Edit') {
    activityPayload.summary = this.generateEditSummary(payload.tool_input)
  }

  // TES-2.7: Log tool_used activity
  try {
    await ActivityLogService.logActivity(taskId, 'tool_used', activityPayload)
  } catch (error) {
    console.error('[HookListener] Failed to log tool_used activity:', error)
  }
}

/**
 * Generate a summary for Edit tool usage.
 * Format: "+N -M" for line changes, or "file edited" if calculation not possible.
 */
private generateEditSummary(toolInput: Record<string, unknown>): string {
  const oldString = toolInput.old_string
  const newString = toolInput.new_string

  if (typeof oldString !== 'string' || typeof newString !== 'string') {
    return 'file edited'
  }

  const oldLines = oldString.split('\n').length
  const newLines = newString.split('\n').length
  const added = Math.max(0, newLines - oldLines)
  const removed = Math.max(0, oldLines - newLines)

  if (added === 0 && removed === 0) {
    // Same line count but content changed
    return `${newLines} lines modified`
  }

  return `+${added} -${removed}`
}
```

**Payload Type:**

```typescript
interface ToolUsedPayload {
  tool: string                    // e.g., "Edit", "Bash", "Read"
  file?: string                   // File path for file operations
  command?: string                // Command for Bash tool (truncated)
  summary?: string                // Change summary for Edit tool
}
```

**Event Type Verification:**

The `ACTIVITY_EVENT_TYPE` enum in `src/main/db/schema.ts:261-272` already includes `tool_used`:

```typescript
export const ACTIVITY_EVENT_TYPE = {
  status_change: 'status_change',
  agent_start: 'agent_start',
  agent_complete: 'agent_complete',
  tool_used: 'tool_used',        // ← Already defined
  user_command: 'user_command',
  automation_trigger: 'automation_trigger',
  error: 'error',
  session_ended: 'session_ended'
} as const
```

[Source: src/main/db/schema.ts]

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Event types | snake_case | `tool_used` |
| Payload keys | snake_case | `file`, `command`, `summary` |
| Service methods | camelCase | `onToolUseHook`, `generateEditSummary` |
| Private methods | camelCase with `this.` | `this.generateEditSummary()` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Error Handling Pattern:**
```typescript
// Wrap activity logging in try/catch - don't let logging failures break hook handling
try {
  await ActivityLogService.logActivity(taskId, 'tool_used', activityPayload)
} catch (error) {
  console.error('[HookListener] Failed to log tool_used activity:', error)
  // Continue - hook handling should not fail due to logging issues
}
```

### Testing Pattern

```typescript
// Test file: src/main/services/hook-listener.service.test.ts

describe('onToolUseHook tool_used logging (TES-2.7)', () => {
  it('logs tool_used activity when PostToolUse hook fires with mapped session', async () => {
    // Arrange: Mock session lookup
    mockDbSelectGet.mockReturnValueOnce({
      id: 'session-1',
      task_id: 'task-123',
      session_id: 'test-session-abc'
    })

    const payload: ToolUseHookPayload = {
      session_id: 'test-session-abc',
      tool_name: 'Edit',
      tool_input: { file_path: '/src/test.ts', old_string: 'old', new_string: 'new' },
      hook_event_name: 'PostToolUse'
    }

    // Act
    await service.onToolUseHook(payload)

    // Assert
    expect(mockLogActivity).toHaveBeenCalledWith(
      'task-123',
      'tool_used',
      expect.objectContaining({
        tool: 'Edit',
        file: '/src/test.ts'
      })
    )
  })

  it('extracts and truncates command for Bash tool', async () => {
    mockDbSelectGet.mockReturnValueOnce({
      id: 'session-1',
      task_id: 'task-bash',
      session_id: 'bash-session'
    })

    const longCommand = 'npm run build && npm run test && npm run lint && npm run format && npm run check && npm run deploy'

    const payload: ToolUseHookPayload = {
      session_id: 'bash-session',
      tool_name: 'Bash',
      tool_input: { command: longCommand },
      hook_event_name: 'PostToolUse'
    }

    await service.onToolUseHook(payload)

    expect(mockLogActivity).toHaveBeenCalledWith(
      'task-bash',
      'tool_used',
      expect.objectContaining({
        tool: 'Bash',
        command: expect.stringMatching(/^.{100}\.\.\.$/),  // Truncated to 100 + "..."
      })
    )
  })

  it('handles orphan session_id gracefully', async () => {
    mockDbSelectGet.mockReturnValueOnce(undefined)

    const consoleSpy = vi.spyOn(console, 'warn')

    const payload: ToolUseHookPayload = {
      session_id: 'orphan-session',
      tool_name: 'Read',
      tool_input: { file_path: '/src/file.ts' },
      hook_event_name: 'PostToolUse'
    }

    await service.onToolUseHook(payload)

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Orphan tool-use event'),
      'orphan-session'
    )
    expect(mockLogActivity).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
```

### Project Structure Notes

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/hook-listener.service.ts` | MODIFY | Implement tool_used logging in onToolUseHook (lines 444-448) |
| `src/main/services/hook-listener.service.test.ts` | MODIFY | Add TES-2.7 tests for tool_used logging |

**Key Integration Points:**
- `src/main/services/activity-log.service.ts` - Already exports `ActivityLogService` with static `logActivity` method
- `src/main/db/schema.ts` - Already has `ACTIVITY_EVENT_TYPE` with `tool_used`
- `src/main/services/hook-listener.service.ts` - Has TODO marker at lines 446-448 for TES-2.7 integration

### Database Access Pattern

The HookListenerService already has database access via imports at top of file:
```typescript
import { db } from '../db'
import { task_sessions, taskActivities } from '../db/schema'
```

Same pattern used for session lookup in TES-2.6 (onStopHook).

### Tool Types Expected from Claude Code

Common tools that may appear in PostToolUse hooks:

| Tool Name | Key Input Fields | Activity Payload |
|-----------|------------------|------------------|
| `Read` | `file_path` | `{ tool: "Read", file: string }` |
| `Write` | `file_path`, `content` | `{ tool: "Write", file: string }` |
| `Edit` | `file_path`, `old_string`, `new_string` | `{ tool: "Edit", file: string, summary: "+N -M" }` |
| `Bash` | `command` | `{ tool: "Bash", command: string (truncated) }` |
| `Glob` | `pattern`, `path` | `{ tool: "Glob", file: string }` |
| `Grep` | `pattern`, `path` | `{ tool: "Grep", file: string }` |
| `Task` | `prompt`, `subagent_type` | `{ tool: "Task" }` |
| `WebFetch` | `url` | `{ tool: "WebFetch" }` |

### References

- [Architecture: HookListenerService](/_bmad-output/planning-artifacts/architecture.md#hooklistenerservice)
- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [PRD: FR13 Tool Usage Events](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.7](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-27-tool-usage-event-capture)
- [Project Context: Activity Log Event Types](/_bmad-output/planning-artifacts/project-context.md#activity-log-event-types)
- [TES-2.6: Agent Start/Complete Event Capture](/_bmad-output/implementation-artifacts/tes-2-6-agent-start-complete-event-capture.md)
- [TES-2.3: Hook Listener HTTP Server](/_bmad-output/implementation-artifacts/tes-2-3-hook-listener-http-server.md)

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
- onToolUseHook receives ToolUseHookPayload with session_id, tool_name, tool_input
- Existing validation via Zod schema (ToolUseHookPayloadSchema)
- TODO marker at lines 446-448 indicates integration point

**With Session Mapping (TES-2.6):**
- Reuse same session lookup pattern from onStopHook
- Query task_sessions by session_id to get task_id

**With ActivityLogService (TES-2.2):**
- Direct call to logActivity() with event_type "tool_used"
- Uses existing database persistence

**With Activity UI (TES-2.11-2.13):**
- Tool events will be visible in activity log UI
- Can be filtered using "Agent" filter chip (includes tool_used events)
- Real-time streaming will show events immediately (TES-2.13)

### Edge Cases to Handle

1. **Orphan session_id:** Log warning, don't throw error, return early
2. **Unknown tool types:** Log anyway with just tool name, no file/command extraction
3. **Missing file_path in tool_input:** Set file field to null
4. **Very long commands:** Truncate to 100 characters with "..." suffix
5. **Empty tool_input:** Log tool name only, no additional fields
6. **Activity logging failure:** Catch error, log warning, continue (don't fail hook handling)

### Scope Notes

**In Scope (This Story):**
- Log tool_used activity when PostToolUse hook fires
- Extract file path for file operation tools
- Generate change summary for Edit tool
- Extract and truncate command for Bash tool
- Session-to-task mapping for event routing

**Out of Scope (Future Stories):**
- User command events (TES-2.8)
- Automation trigger events (TES-2.9)
- Error events (TES-2.10)
- Activity log UI display (TES-2.11)
- Activity log filtering (TES-2.12)
- Real-time activity streaming (TES-2.13)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Implemented tool_used activity logging in HookListenerService.onToolUseHook
- Added session-to-task lookup using the same pattern as TES-2.6's onStopHook
- Implemented file path extraction for Read, Edit, Write, Glob, and Grep tools
- Added generateEditSummary() private method for computing line change summary (+N -M format)
- Implemented Bash command extraction with truncation to 100 characters
- All activity logging wrapped in try/catch to prevent failures from breaking hook handling
- Added 14 comprehensive unit tests covering all acceptance criteria and edge cases
- Verified tool_used event type exists in ACTIVITY_EVENT_TYPE enum (schema.ts line 265)
- All 46 hook-listener.service.test.ts tests pass

**Code Review Fixes Applied (2026-01-17):**
- Fixed generateEditSummary to show git-style output (+newLines -oldLines) instead of delta
- Added MAX_COMMAND_LENGTH constant (100) to replace magic number
- Added documentation comment explaining file path extraction precedence (file_path → path → pattern)
- Added 3 new tests: Grep tool pattern extraction, Task tool type handling, 100-char boundary test
- Updated Edit summary test expectation to match git-style format (+5 -3)
- All 49 tests now pass

### File List

- src/main/services/hook-listener.service.ts (MODIFIED)
- src/main/services/hook-listener.service.test.ts (MODIFIED)
- _bmad-output/implementation-artifacts/sprint-status.yaml (MODIFIED - status update)

### Change Log

- 2026-01-17: Implemented TES-2.7 Tool Usage Event Capture - added tool_used activity logging with file path extraction, Edit tool change summary generation, and Bash command truncation
- 2026-01-17: Code review fixes - corrected Edit summary format to git-style, added MAX_COMMAND_LENGTH constant, added 3 new tests (49 total)

