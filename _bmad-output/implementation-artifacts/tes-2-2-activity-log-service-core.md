# Story TES-2.2: Activity Log Service (Core)

Status: done

---

## Story

As a system,
I want an ActivityLogService to write and read activity events,
So that all task events are captured reliably.

## Acceptance Criteria

1. **Given** an event occurs on a task, **When** logActivity(taskId, eventType, payload) is called, **Then** a new record is inserted into task_activities, **And** the write is atomic (no partial writes), **And** the function returns the created Activity object

2. **Given** a user requests activity history, **When** getActivities(taskId, options) is called, **Then** activities are returned sorted by created_at descending, **And** optional filters (eventTypes, limit, offset, since) are applied

3. **Given** multiple events occur simultaneously, **When** they are logged, **Then** each event gets a unique id and accurate timestamp, **And** no events are lost

## Tasks / Subtasks

- [x] Task 1: Refactor ActivityLogService to persist events to database (AC: #1)
  - [x] 1.1: Add database instance injection to ActivityLogService (migrate from static class to instance-based)
  - [x] 1.2: Implement `logActivity(taskId, eventType, payload)` to insert into task_activities table
  - [x] 1.3: Generate unique ID using nanoid for each activity record
  - [x] 1.4: Use `Date.now()` for created_at timestamp (matches INTEGER column type)
  - [x] 1.5: Serialize payload to JSON string before insert
  - [x] 1.6: Return the created TaskActivity object after insert
  - [x] 1.7: Keep existing console.log for debugging visibility

- [x] Task 2: Implement getActivities query method with filtering (AC: #2)
  - [x] 2.1: Add `getActivities(taskId, options)` method to ActivityLogService
  - [x] 2.2: Implement options interface: `{ eventTypes?: string[], limit?: number, offset?: number, since?: number }`
  - [x] 2.3: Build dynamic query with Drizzle ORM using provided filters
  - [x] 2.4: Sort results by created_at DESC (newest first)
  - [x] 2.5: Apply eventTypes filter using `inArray()` when provided
  - [x] 2.6: Apply limit and offset for pagination
  - [x] 2.7: Apply since filter using `gt()` when provided

- [x] Task 3: Add activity tRPC router procedures (AC: #1, #2)
  - [x] 3.1: Create `src/main/trpc/routers/activity.router.ts`
  - [x] 3.2: Add `logActivity` mutation procedure with Zod validation
  - [x] 3.3: Add `listActivities` query procedure with filter options
  - [x] 3.4: Register activity router in main tRPC root router
  - [x] 3.5: Inject ActivityLogService into tRPC context

- [x] Task 4: Write comprehensive unit tests (AC: #1, #2, #3)
  - [x] 4.1: Test logActivity creates record with correct columns
  - [x] 4.2: Test logActivity generates unique IDs for concurrent calls
  - [x] 4.3: Test logActivity serializes payload to JSON correctly
  - [x] 4.4: Test getActivities returns records sorted by created_at DESC
  - [x] 4.5: Test getActivities filters by eventTypes correctly
  - [x] 4.6: Test getActivities applies limit and offset pagination
  - [x] 4.7: Test getActivities filters by since timestamp
  - [x] 4.8: Test concurrent writes don't lose events (AC: #3)

- [x] Task 5: Update service instantiation and exports (AC: #1)
  - [x] 5.1: Export ActivityLogService instance from services index
  - [x] 5.2: Backward compatibility layer for static method usage (TaskTerminalService and StallDetectorService)
  - [x] 5.3: Add ActivityLogService to tRPC context type

## Dev Notes

### Architecture Compliance

This story implements **AR3** and **AR4** from the Task Execution Sandbox Architecture extension:

> AR3: New services: TaskTerminalService, HookListenerService, **ActivityLogService**, AutomationService, ScrollbackBackupService

> AR4: New tRPC router: `activity.router.ts` with queries, subscriptions, and retention settings

And directly supports **FR10-FR16**:

> FR10: System can capture status change events for each task
> FR11: System can capture agent start events
> FR12: System can capture agent complete events
> FR13: System can capture tool usage events
> FR14: System can capture user command events
> FR15: System can capture automation trigger events
> FR16: System can capture error events

[Source: _bmad-output/planning-artifacts/architecture.md#task-execution-sandbox-architecture-feature-extension]

### Previous Story Learnings (TES-2.1)

**From TES-2.1 (task_activities schema):**
- `taskActivities` table is already created in schema.ts with all required columns
- `ACTIVITY_EVENT_TYPE` enum already exported with 10 event types
- Foreign key with CASCADE DELETE already configured
- 4 indexes exist: task_id, event_type, created_at, composite (task_id, created_at)
- Type exports: `TaskActivity` and `NewTaskActivity` available for type-safe operations
- Manual migration already added to db/index.ts

**From TES-1.11 (Current ActivityLogService stub):**
- Static class implementation with console.log only
- Already defines `ActivityEventType`, `SessionEndedPayload`, `StallDetectedPayload`, `StallRecoveredPayload` types
- `logActivity` method signature: `(taskId: string, eventType: ActivityEventType, payload: ActivityPayload)`
- Used by TaskTerminalService and StallDetectorService for session lifecycle events
- TODO comments indicate where to add DB persistence and real-time streaming

**Key Files:**
- `src/main/services/activity-log.service.ts` - Transform from stub to full implementation
- `src/main/db/schema.ts` - taskActivities table already exists (TES-2.1)
- `src/main/trpc/routers/` - Add activity.router.ts
- `src/main/trpc/index.ts` - Register activity router

### Technical Implementation Guidance

**ActivityLogService Interface (from Architecture):**

```typescript
interface ActivityLogService {
  // Write
  logActivity(taskId: string, eventType: EventType, payload?: object): Promise<TaskActivity>

  // Read
  getActivities(taskId: string, options?: ActivityQueryOptions): Promise<TaskActivity[]>

  // Stream (TES-2.13, not this story)
  // subscribeToTask(taskId: string): Observable<Activity>

  // Retention (TES-2.12, not this story)
  // cleanupOldActivities(retentionDays: number): Promise<number>
}

interface ActivityQueryOptions {
  eventTypes?: ActivityEventType[]
  limit?: number
  offset?: number
  since?: number  // Unix timestamp (ms)
}
```

[Source: _bmad-output/planning-artifacts/architecture.md#activitylogservice]

**Drizzle Query Pattern:**

```typescript
import { db } from '../db'
import { taskActivities, NewTaskActivity, TaskActivity, ACTIVITY_EVENT_TYPE } from '../db/schema'
import { eq, desc, inArray, gt, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// Insert activity
async logActivity(taskId: string, eventType: ActivityEventType, payload?: object): Promise<TaskActivity> {
  const newActivity: NewTaskActivity = {
    id: nanoid(),
    task_id: taskId,
    event_type: eventType,
    payload: payload ? JSON.stringify(payload) : null,
    created_at: Date.now()
  }

  const [created] = await db.insert(taskActivities)
    .values(newActivity)
    .returning()

  return created
}

// Query with filters
async getActivities(taskId: string, options?: ActivityQueryOptions): Promise<TaskActivity[]> {
  const conditions = [eq(taskActivities.task_id, taskId)]

  if (options?.eventTypes?.length) {
    conditions.push(inArray(taskActivities.event_type, options.eventTypes))
  }
  if (options?.since) {
    conditions.push(gt(taskActivities.created_at, options.since))
  }

  return db.select()
    .from(taskActivities)
    .where(and(...conditions))
    .orderBy(desc(taskActivities.created_at))
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0)
}
```

**tRPC Router Pattern (from Architecture):**

```typescript
// src/main/trpc/routers/activity.router.ts
import { z } from 'zod'
import { router, t } from '../trpc'
import { ACTIVITY_EVENT_TYPE } from '../../db/schema'

export const activityRouter = router({
  listActivities: t.procedure
    .input(z.object({
      taskId: z.string(),
      eventTypes: z.array(z.enum(ACTIVITY_EVENT_TYPE)).optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
      since: z.number().optional()
    }))
    .query(({ input, ctx }) => {
      return ctx.activityLogService.getActivities(input.taskId, input)
    }),

  logActivity: t.procedure
    .input(z.object({
      taskId: z.string(),
      eventType: z.enum(ACTIVITY_EVENT_TYPE),
      payload: z.record(z.unknown()).optional()
    }))
    .mutation(({ input, ctx }) => {
      return ctx.activityLogService.logActivity(input.taskId, input.eventType, input.payload)
    })
})
```

[Source: _bmad-output/planning-artifacts/architecture.md#new-trpc-router]

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Service class | PascalCase | `ActivityLogService` |
| Service file | kebab-case | `activity-log.service.ts` |
| Router file | kebab-case | `activity.router.ts` |
| tRPC queries | camelCase, get/list | `listActivities` |
| tRPC mutations | camelCase, verb | `logActivity` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Error Handling:**
```typescript
import { TRPCError } from '@trpc/server'

// Service layer - throw TRPCError for known errors
if (!taskExists) {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
}
```

**Service Instantiation Pattern:**
```typescript
// src/main/services/index.ts
import { ActivityLogService } from './activity-log.service'
import { db } from '../db'

export const activityLogService = new ActivityLogService(db)
```

### Project Structure Notes

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/activity-log.service.ts` | MODIFY | Refactor stub to full implementation with DB persistence |
| `src/main/trpc/routers/activity.router.ts` | CREATE | New tRPC router for activity operations |
| `src/main/trpc/index.ts` | MODIFY | Register activity router |
| `src/main/trpc/context.ts` | MODIFY | Add activityLogService to context |
| `src/main/services/activity-log.service.test.ts` | CREATE | Unit tests for service |

### References

- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [Architecture: activity.router.ts](/_bmad-output/planning-artifacts/architecture.md#new-trpc-router)
- [PRD: FR10-FR16 Activity Logging](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.2](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-22-activity-log-service-core)
- [Project Context: tRPC Patterns](/_bmad-output/planning-artifacts/project-context.md#trpc-patterns)
- [TES-2.1: task_activities schema](/_bmad-output/implementation-artifacts/tes-2-1-task-activities-database-schema.md)
- [TES-1.11: ActivityLogService stub](/_bmad-output/implementation-artifacts/tes-1-11-session-end-and-unresponsive-detection.md)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/activity-log.service.test.ts
```

Test scenarios:
1. **logActivity:** Insert returns TaskActivity with all fields populated
2. **logActivity:** Concurrent calls generate unique IDs
3. **logActivity:** JSON payload serialized correctly
4. **logActivity:** Null payload handled correctly
5. **getActivities:** Returns sorted by created_at DESC
6. **getActivities:** Filters by eventTypes array
7. **getActivities:** Applies limit and offset pagination
8. **getActivities:** Filters by since timestamp
9. **getActivities:** Empty result when no matching activities

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Activity log event latency | <1s | Events appear in UI within 1 second (NFR1) |
| Activity log filter/search | <1s | Filter results return within 1 second (NFR2) |
| Activity log integrity | Zero loss | No activity events lost during normal operation (NFR11) |
| Activity write atomicity | 100% | No partial writes (NFR23) |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With task_activities table (TES-2.1):**
- Uses schema and types from `src/main/db/schema.ts`
- Respects index structure for query performance
- Cascade delete handled automatically by foreign key

**With TaskTerminalService and StallDetectorService (TES-1.11):**
- Currently uses static ActivityLogService.logActivity()
- Update to use injected instance for consistency

**With Hook Listener Service (TES-2.3):**
- Will call logActivity() when hook events received
- Uses same event types and payload structures

**With Activity UI (TES-2.11-13):**
- tRPC router provides query interface
- Subscription for real-time streaming added in TES-2.13

### Edge Cases to Handle

1. **Invalid taskId:** Verify task exists before insert, or let FK constraint fail gracefully
2. **Large payloads:** Consider truncating very large payloads (>64KB) with warning
3. **Concurrent writes:** SQLite WAL mode handles, but verify in tests
4. **Invalid eventType:** Zod validation at router level, runtime check in service
5. **Missing payload:** Handle both undefined and null correctly

### Scope Notes

**In Scope (This Story):**
- Database persistence for activities (logActivity)
- Query with filtering (getActivities)
- tRPC router for external access
- Unit tests

**Out of Scope (Future Stories):**
- Real-time subscription streaming (TES-2.13)
- Activity retention/cleanup (TES-2.12)
- UI display components (TES-2.11)
- Hook event integration (TES-2.3-2.10)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **ActivityLogService refactored** from static class to instance-based with database injection
2. **Static compatibility layer** maintained for backward compatibility with TES-1.11 code (TaskTerminalService and StallDetectorService use static methods)
3. **All 25 unit tests pass** covering logActivity, getActivities, concurrent writes, edge cases
4. **tRPC activity router** created with listActivities query and logActivity mutation
5. **Context updated** to inject activityLogService for tRPC procedures

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-14
**Outcome:** ✅ APPROVED (with fixes applied)

**Issues Found & Fixed:**

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| M1 | MEDIUM | Missing task existence validation before insert | Added TRPCError NOT_FOUND check in logActivity |
| M2 | MEDIUM | Router missing TRPCError wrapping | Service now throws TRPCError, propagates correctly |
| M3 | MEDIUM | getInstance() used require() with eslint-disable | Removed require(), now throws if not initialized |
| M4 | MEDIUM | Test file had awkward double TypeScript casting | Cleaned up to single proper cast |

**Tests:** 26 passing (25 original + 1 new validation test)

**Notes:**
- All Acceptance Criteria verified as implemented
- All Tasks marked [x] confirmed as actually done
- No git vs story File List discrepancies
- Code follows project patterns (TRPCError, naming conventions)

### Change Log

| Change | Description |
|--------|-------------|
| ActivityLogService refactored | Migrated from static class to instance-based with DB injection |
| Static compatibility layer | Added namespace with lazy-loaded singleton for backward compatibility |
| getActivities implemented | Query method with eventTypes, limit, offset, since filtering |
| activity.router.ts created | tRPC router with listActivities and logActivity procedures |
| Context updated | Added activityLogService to tRPC context |
| Comprehensive tests | 25 unit tests covering all acceptance criteria |
| Code review fixes (M1-M4) | Task validation, error handling, getInstance cleanup, test cleanup |

### File List

| File | Action | Description |
|------|--------|-------------|
| `src/main/services/activity-log.service.ts` | MODIFIED | Refactored from static stub to full instance-based service with DB persistence |
| `src/main/services/activity-log.service.test.ts` | MODIFIED | Comprehensive unit tests (25 tests) |
| `src/main/services/index.ts` | MODIFIED | Export activityLogService instance and set singleton |
| `src/main/trpc/routers/activity.router.ts` | CREATED | New tRPC router for activity operations |
| `src/main/trpc/index.ts` | MODIFIED | Register activity router |
| `src/main/trpc/context.ts` | MODIFIED | Add activityLogService to context |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | MODIFIED | Story status: ready-for-dev → in-progress → review |
