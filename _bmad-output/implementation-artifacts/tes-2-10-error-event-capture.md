# Story TES-2.10: Error Event Capture

Status: done

---

## Story

As a user,
I want errors logged prominently,
So that I can quickly identify what went wrong.

## Acceptance Criteria

1. **Given** an agent encounters an error, **When** the error is detected (via hook or process exit), **Then** an activity event is logged with event_type: "error", **And** payload contains { message, code?, stack? }

2. **Given** a hook script fails to deliver, **When** the HTTP request fails, **Then** an error event is logged with details about the delivery failure

3. **Given** tmux session creation fails, **When** the error is caught, **Then** an error event is logged for the task

## Tasks / Subtasks

- [x] Task 1: Define error payload structure and update ActivityLogService types (AC: #1)
  - [x] 1.1: Add `ErrorEventPayload` interface to `activity-log.service.ts` with required `message` field and optional `code`, `stack`, `source` fields
  - [x] 1.2: Update `ActivityPayload` union type to include `ErrorEventPayload`
  - [x] 1.3: Add JSDoc documentation for the error payload interface

- [x] Task 2: Capture agent errors in HookListenerService (AC: #1)
  - [x] 2.1: Analyze Stop hook payload to detect error conditions (e.g., exit_code > 0, error field present)
  - [x] 2.2: Add error event logging in `onStopHook()` when agent error detected
  - [x] 2.3: Extract error message, code, and stack from available hook payload data
  - [x] 2.4: Wrap error logging in try/catch to prevent failures from breaking hook processing

- [x] Task 3: Capture hook delivery failures (AC: #2)
  - [x] 3.1: In `onStopHook()` and `onToolUseHook()`, catch ActivityLogService failures
  - [x] 3.2: When logging fails, attempt to log an error event about the delivery failure
  - [x] 3.3: Include original event type and error message in the error payload
  - [x] 3.4: Handle case where task_id lookup fails gracefully (orphan events)

- [x] Task 4: Capture tmux session creation failures (AC: #3)
  - [x] 4.1: Identify location in `task-terminal.service.ts` where sessions are created
  - [x] 4.2: Add error event logging when `createSession()` throws an error
  - [x] 4.3: Include tmux error message and session name in the error payload
  - [x] 4.4: Wrap error logging in try/catch to prevent cascading failures

- [x] Task 5: Write unit tests for error event capture
  - [x] 5.1: Test error event logged when agent exits with error (Stop hook with error condition)
  - [x] 5.2: Test error event logged when hook delivery fails
  - [x] 5.3: Test error event logged when tmux session creation fails
  - [x] 5.4: Test error payload contains correct message, code, stack fields
  - [x] 5.5: Test error logging continues operation (doesn't throw)
  - [x] 5.6: Test error event for orphan hook events (task_id not found)

- [x] Task 6: Verify integration with existing services
  - [x] 6.1: Confirm `error` event type already exists in `ACTIVITY_EVENT_TYPE` schema (line 268)
  - [x] 6.2: Run existing tests to ensure no regressions
  - [x] 6.3: Manual integration test: trigger errors and verify activity appears in database

## Dev Notes

### Architecture Compliance

This story implements **FR16** from the Task Execution Sandbox PRD:

> FR16: System can capture error events when agents or hooks fail

And follows the established activity logging pattern from **TES-2.5** through **TES-2.9**.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]

### Previous Story Learnings

**From TES-2.9 (Automation Trigger Event Capture) - CRITICAL REFERENCE:**
- Created new `AutomationService` with static namespace exports for compatibility
- Activity logging wrapped in try/catch to prevent failures from breaking main flow
- ActivityLogService.logActivity(taskId, eventType, payload) is the standard call pattern
- Use static compatibility method: `ActivityLogService.logActivity()` (namespace export)
- Always wrap in try/catch with console.warn on failure

**From TES-2.8 (User Command Event Capture):**
- Secret masking applied to sensitive data before logging
- Command truncation to MAX_COMMAND_LENGTH (100 chars)

**From TES-2.7 (Tool Usage Event Capture):**
- HookListenerService logs tool_used events in `onToolUseHook()`
- Orphan events (session_id not found) logged as warning and returned early

**From TES-2.6 (Agent Start/Complete Event Capture):**
- agent_complete logged in `onStopHook()` with duration calculation
- Phase extracted from task_sessions.current_phase

[Source: _bmad-output/implementation-artifacts/tes-2-9-automation-trigger-event-capture.md]

### Technical Implementation Guidance

**Error Event Payload Structure:**

```typescript
interface ErrorEventPayload {
  /** Human-readable error message (required) */
  message: string
  /** Error code if available (e.g., 'ECONNREFUSED', 'ENOENT', 'HOOK_FAILED') */
  code?: string
  /** Stack trace if available (truncated for storage) */
  stack?: string
  /** Source of the error for debugging */
  source?: 'agent' | 'hook_delivery' | 'tmux_creation' | 'session_lookup'
}
```

**Integration Points:**

1. **HookListenerService.onStopHook()** (agent errors):
   ```typescript
   // Detect error condition in Stop hook
   // Note: Need to investigate actual Stop hook payload structure for error indicators
   // Possible indicators: exit_code field, error field, or parsing transcript for errors

   // If error detected:
   try {
     await ActivityLogService.logActivity(taskId, 'error', {
       message: 'Agent execution failed',
       code: errorCode, // If available
       stack: errorStack?.substring(0, 1000), // Truncate stack
       source: 'agent'
     })
   } catch (logError) {
     console.warn('[HookListener] Failed to log error activity:', logError)
   }
   ```

2. **HookListenerService.onStopHook() & onToolUseHook()** (hook delivery failures):
   ```typescript
   // Wrap existing logActivity calls with error capture
   try {
     await ActivityLogService.logActivity(taskId, 'agent_complete', payload)
   } catch (error) {
     console.error('[HookListener] Failed to log agent_complete activity:', error)

     // Attempt to log the delivery failure itself
     try {
       await ActivityLogService.logActivity(taskId, 'error', {
         message: `Failed to log ${eventType} event: ${error.message}`,
         code: 'HOOK_FAILED',
         source: 'hook_delivery'
       })
     } catch {
       // Last resort - just log to console
       console.error('[HookListener] Failed to log error event:', error)
     }
   }
   ```

3. **TaskTerminalService.createSession()** (tmux failures):
   ```typescript
   // In createSession method, catch tmux errors
   try {
     // Existing tmux creation logic
   } catch (error) {
     console.error('[TaskTerminalService] Failed to create tmux session:', error)

     // Log error activity
     try {
       await ActivityLogService.logActivity(taskId, 'error', {
         message: `Failed to create terminal session: ${error.message}`,
         code: error.code ?? 'TMUX_CREATE_FAILED',
         source: 'tmux_creation'
       })
     } catch (logError) {
       console.warn('[TaskTerminalService] Failed to log tmux error activity:', logError)
     }

     // Re-throw to inform caller
     throw error
   }
   ```

**Event Type Verification:**

The `error` event type is already defined in `ACTIVITY_EVENT_TYPE` schema at line 268:

```typescript
export const ACTIVITY_EVENT_TYPE = [
  'status_change',
  'agent_start',
  'agent_complete',
  'tool_used',
  'user_command',
  'automation_trigger',
  'error',              // ← Already defined
  'session_ended',
  'stall_detected',
  'stall_recovered'
] as const
```

[Source: src/main/db/schema.ts:261-273]

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Event types | snake_case | `error` |
| Payload keys | snake_case | `message`, `code`, `stack`, `source` |
| Service methods | camelCase | `logActivity`, `createSession` |
| Interfaces | PascalCase | `ErrorEventPayload` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Error Handling Pattern:**
```typescript
// Wrap error activity logging in try/catch - don't let logging failures cascade
try {
  await ActivityLogService.logActivity(taskId, 'error', {
    message: 'Description of what failed',
    code: 'ERROR_CODE',
    source: 'source_location'
  })
} catch (error) {
  console.warn('[ServiceName] Failed to log error activity:', error)
  // Continue - don't let logging failures break the main flow
}
```

**Stack Trace Handling:**
```typescript
// Truncate stack traces to prevent excessively large payloads
const MAX_STACK_LENGTH = 1000

const truncatedStack = error.stack
  ? error.stack.substring(0, MAX_STACK_LENGTH) + (error.stack.length > MAX_STACK_LENGTH ? '...' : '')
  : undefined
```

### Testing Pattern

```typescript
// Test file: src/main/services/hook-listener.service.test.ts (extend existing)

describe('HookListenerService error event capture (TES-2.10)', () => {
  it('logs error event when agent exits with error condition', async () => {
    const mockLogActivity = vi.spyOn(ActivityLogService, 'logActivity').mockResolvedValue({
      id: 'activity-1',
      task_id: 'task-123',
      event_type: 'error',
      payload: '{"message":"Agent failed","source":"agent"}',
      created_at: Date.now()
    })

    // Simulate Stop hook with error condition
    // (Actual implementation depends on Stop hook error detection method)
    await hookListener.onStopHook(errorStopPayload)

    expect(mockLogActivity).toHaveBeenCalledWith(
      'task-123',
      'error',
      expect.objectContaining({
        message: expect.any(String),
        source: 'agent'
      })
    )
  })

  it('logs error event when activity logging fails (hook delivery failure)', async () => {
    // First call fails (agent_complete), second call succeeds (error event)
    const mockLogActivity = vi.spyOn(ActivityLogService, 'logActivity')
      .mockRejectedValueOnce(new Error('DB connection failed'))
      .mockResolvedValueOnce({
        id: 'activity-2',
        task_id: 'task-123',
        event_type: 'error',
        payload: '{"message":"Failed to log agent_complete","code":"HOOK_FAILED","source":"hook_delivery"}',
        created_at: Date.now()
      })

    await hookListener.onStopHook(validStopPayload)

    // Verify error event was logged for the delivery failure
    expect(mockLogActivity).toHaveBeenNthCalledWith(
      2,
      'task-123',
      'error',
      expect.objectContaining({
        code: 'HOOK_FAILED',
        source: 'hook_delivery'
      })
    )
  })

  it('continues processing even when error logging fails', async () => {
    vi.spyOn(ActivityLogService, 'logActivity').mockRejectedValue(new Error('All logging failed'))
    const consoleSpy = vi.spyOn(console, 'warn')

    // Should not throw
    await expect(hookListener.onStopHook(validStopPayload)).resolves.not.toThrow()

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// Test file: src/main/services/task-terminal.service.test.ts (extend existing)

describe('TaskTerminalService error event capture (TES-2.10)', () => {
  it('logs error event when tmux session creation fails', async () => {
    // Mock tmux command to fail
    vi.spyOn(childProcess, 'exec').mockImplementation((_cmd, _opts, callback) => {
      callback(new Error('tmux: command not found'), '', '')
    })

    const mockLogActivity = vi.spyOn(ActivityLogService, 'logActivity').mockResolvedValue({
      id: 'activity-3',
      task_id: 'task-123',
      event_type: 'error',
      payload: '{"message":"Failed to create terminal session","source":"tmux_creation"}',
      created_at: Date.now()
    })

    await expect(taskTerminalService.createSession('task-123', 'project')).rejects.toThrow()

    expect(mockLogActivity).toHaveBeenCalledWith(
      'task-123',
      'error',
      expect.objectContaining({
        source: 'tmux_creation'
      })
    )
  })
})
```

### Project Structure Notes

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/activity-log.service.ts` | MODIFY | Add `ErrorEventPayload` interface to type exports |
| `src/main/services/hook-listener.service.ts` | MODIFY | Add error event logging in `onStopHook()` and `onToolUseHook()` |
| `src/main/services/task-terminal.service.ts` | MODIFY | Add error event logging in `createSession()` |
| `src/main/services/hook-listener.service.test.ts` | MODIFY | Add TES-2.10 tests for error event capture |
| `src/main/services/task-terminal.service.test.ts` | MODIFY | Add TES-2.10 tests for tmux error capture |

**Key Integration Points:**
- `src/main/services/activity-log.service.ts` - Already exports `ActivityLogService` namespace with static `logActivity` method
- `src/main/db/schema.ts` - Already has `ACTIVITY_EVENT_TYPE` with `error` at line 268
- `src/main/services/hook-listener.service.ts` - Main file for hook error capture (lines 371-438 for onStopHook, 450-513 for onToolUseHook)
- `src/main/services/task-terminal.service.ts` - Main file for tmux error capture

### Stop Hook Error Detection

**Investigation Needed:** The current Stop hook payload schema (`StopHookPayloadSchema`) includes:
- `session_id`: string
- `transcript_path`: string
- `cwd`: string
- `hook_event_name`: 'Stop'

Additional fields may be present in the actual Claude Code Stop hook that indicate errors:
- Check if Claude Code adds `exit_code`, `error`, or `status` fields
- May need to parse the transcript file to detect agent errors
- Consult Claude Code hook documentation for error indicators

**Recommendation:** Start by adding a console.log in `onStopHook()` during testing to inspect the full payload structure and identify error indicators.

### Error Source Classification

| Source | Description | When Logged |
|--------|-------------|-------------|
| `agent` | Claude Code agent execution failed | Stop hook with error indicators |
| `hook_delivery` | Failed to log an activity event | ActivityLogService.logActivity() throws |
| `tmux_creation` | Failed to create tmux session | TaskTerminalService.createSession() throws |
| `session_lookup` | Failed to find task for session_id | Orphan hook events (existing behavior) |

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Activity event latency | <1s | Events appear in UI within 1 second (NFR1) |
| Activity log integrity | Zero loss | No activity events lost during normal operation (NFR11) |
| Error payloads | Complete but bounded | Stack traces truncated to 1000 chars to prevent storage bloat |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Scope Notes

**In Scope (This Story):**
- Log error events when agent execution fails (via Stop hook)
- Log error events when hook delivery fails (ActivityLogService throws)
- Log error events when tmux session creation fails
- Error payloads include message, optional code, optional stack, and source

**Out of Scope (Future Stories):**
- Activity log UI display (TES-2.11)
- Activity log filtering for errors (TES-2.12)
- Real-time error notification/alerts (future feature)
- Error recovery/retry mechanisms (future feature)

### Simplicity Assessment

This is a **moderate complexity story** with:
- Three integration points (Stop hook, hook delivery, tmux creation)
- New payload type definition
- Follows established pattern from TES-2.5 through TES-2.9
- Event type already exists in schema
- Requires investigation of Stop hook error detection

**Estimated Tasks:**
1. Add ErrorEventPayload interface to activity-log.service.ts
2. Investigate Stop hook payload for error indicators
3. Add error logging in HookListenerService.onStopHook()
4. Add error logging wrapper for existing logActivity calls
5. Add error logging in TaskTerminalService.createSession()
6. Write unit tests (extend existing test files)

### Important Notes

**CONTEXT BEFORE IMPLEMENTATION:** Before implementing, the dev agent should:
1. Inspect actual Claude Code Stop hook payload during an error scenario (manual test or logs)
2. Read the current `task-terminal.service.ts` to understand session creation flow
3. Verify existing error handling patterns in hook-listener.service.ts

**FRONTEND/UI STORY NOTE:** This is a backend story. The error events will be displayed in the UI by TES-2.11 (Activity Log UI Display).

### References

- [Architecture: ActivityLogService](/bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [PRD: FR16 Error Event Capture](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.10](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-210-error-event-capture)
- [Project Context: Activity Log Event Types](/_bmad-output/planning-artifacts/project-context.md#activity-log-event-types)
- [TES-2.9: Automation Trigger Event Capture](/_bmad-output/implementation-artifacts/tes-2-9-automation-trigger-event-capture.md)
- [TES-2.7: Tool Usage Event Capture](/_bmad-output/implementation-artifacts/tes-2-7-tool-usage-event-capture.md)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/hook-listener.service.test.ts
npm test src/main/services/task-terminal.service.test.ts
```

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Fixed missing stack traces in `HookListenerService` and `TaskTerminalService` error logging (TES-2.10 AC#1).
- Renamed misleading `MAX_STACK_LENGTH` to `MAX_ERROR_LENGTH` in `hook-listener.service.ts`.
- Added true `MAX_STACK_LENGTH` constant for stack truncation.
- Fixed `src/main/services/task-terminal.service.test.ts` mocking to support synchronous database calls (switched `mockResolvedValue` to `mockReturnValue`).
- Verified all 118/119 tests pass (one pre-existing race condition test failure remains but is unrelated to changes).

### File List

- src/main/services/activity-log.service.ts
- src/main/services/hook-listener.service.ts
- src/main/services/task-terminal.service.ts
- src/main/services/hook-listener.service.test.ts
- src/main/services/task-terminal.service.test.ts

