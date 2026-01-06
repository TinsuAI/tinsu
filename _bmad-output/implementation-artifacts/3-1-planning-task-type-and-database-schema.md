# Story 3.1: Planning Task Type & Database Schema

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a task_type field to distinguish planning tasks from story tasks,
So that TinSu can handle them differently in the UI and execution.

## Acceptance Criteria

1. **Given** the tasks table schema
   **When** I add the task_type field
   **Then** it is an enum: 'planning' | 'story'
   **And** existing tasks default to 'story'

2. **Given** a planning task
   **When** I query for it
   **Then** it includes: phase_number (1-5), phase_name, bmad_agent, bmad_workflow
   **And** these fields are null for story tasks

3. **Given** the database schema
   **When** I define the planning phases
   **Then** the phases are: 1=Product Brief, 2=PRD, 3=Architecture, 4=UX Design, 5=Epics & Stories
   **And** each phase maps to a specific BMAD agent and workflow path

4. **Given** migrations run
   **When** the schema updates
   **Then** existing data is preserved
   **And** new fields have appropriate defaults

## Tasks / Subtasks

- [x] Task 1: Add task_type enum and field to schema (AC: 1)
  - [x] Add `TASK_TYPE = ['planning', 'story']` const to `src/main/db/schema.ts`
  - [x] Add `TaskType` type export
  - [x] Add `task_type` column to tasks table with default 'story'
  - [x] Ensure backward compatibility: existing tasks become 'story' type

- [x] Task 2: Add planning-specific fields to schema (AC: 2)
  - [x] Add `phase_number` integer column (nullable, 1-5)
  - [x] Add `phase_name` text column (nullable)
  - [x] Add `bmad_agent` text column (nullable) - agent identifier for this phase
  - [x] Add `bmad_workflow` text column (nullable) - workflow path for this phase
  - [x] Add index on `task_type` column for filtered queries

- [x] Task 3: Create BMAD planning phases constant map (AC: 3)
  - [x] Create `src/main/db/planning-phases.ts` with phase definitions
  - [x] Define phase mapping: phase_number → { name, agent, workflow }
  - [x] Export `BMAD_PLANNING_PHASES` constant
  - [x] Export TypeScript types for phase configuration

- [x] Task 4: Generate and apply Drizzle migration (AC: 4)
  - [x] Run `npm run db:generate` to create migration
  - [x] Review generated migration SQL for correctness
  - [x] Run `npm run db:push` to apply migration
  - [x] Verify existing tasks retain their data with task_type='story'

- [x] Task 5: Update shared types for renderer (AC: 1, 2)
  - [x] Update `src/shared/types/task.types.ts` with new TaskType and planning fields
  - [x] Ensure types are properly exported for renderer consumption
  - [x] Add type guard function `isPlanningTask(task)` for type narrowing

- [x] Task 6: Write tests for schema changes (AC: all)
  - [x] Test task creation with default task_type='story'
  - [x] Test planning task creation with all phase fields
  - [x] Test querying tasks by task_type
  - [x] Test that phase fields are null for story tasks
  - [x] Test migration preserves existing data

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database operations happen in the main process via Drizzle ORM. The renderer NEVER directly accesses the database.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Current Schema Analysis

The existing `tasks` table in `src/main/db/schema.ts` has:
- `id` (text, primary key)
- `title` (text, required)
- `description` (text, nullable)
- `status` (text, default 'backlog') - values: 'backlog', 'in_progress', 'review', 'done'
- `sort_order` (integer, default 0)
- `epic_id` (text, nullable)
- `sprint_id` (text, nullable)
- `created_at` (timestamp, auto-set)
- `updated_at` (timestamp, auto-set)

Indexes exist on: status, epic_id, sprint_id, sort_order

### Schema Extension Pattern

Follow the existing pattern in schema.ts for enum definitions:
```typescript
// Follow existing pattern from schema.ts
export const TASK_TYPE = ['planning', 'story'] as const
export type TaskType = (typeof TASK_TYPE)[number]
```

### BMAD Planning Phases Definition

```typescript
// src/main/db/planning-phases.ts
export const BMAD_PLANNING_PHASES = {
  1: {
    name: 'Product Brief',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
  },
  2: {
    name: 'PRD',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/2-discovery/create-prd/workflow.yaml'
  },
  3: {
    name: 'Architecture',
    agent: 'bmad:bmm:agents:architect',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
  },
  4: {
    name: 'UX Design',
    agent: 'bmad:bmm:agents:ux-designer',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-ux-design/workflow.yaml'
  },
  5: {
    name: 'Epics & Stories',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.yaml'
  }
} as const

export type PhaseNumber = keyof typeof BMAD_PLANNING_PHASES
export type PlanningPhase = (typeof BMAD_PLANNING_PHASES)[PhaseNumber]
```

### Migration Strategy

**Drizzle Migration Commands:**
```bash
# Generate migration from schema changes
npm run db:generate

# Apply migration to database
npm run db:push

# After DB changes, rebuild for Electron
npm run rebuild:electron
```

**SQLite Migration Considerations:**
- SQLite supports adding columns with DEFAULT values
- Cannot add NOT NULL columns without defaults to existing tables
- New columns with defaults will automatically populate existing rows

**Expected Generated SQL (approximate):**
```sql
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'story' NOT NULL;
ALTER TABLE tasks ADD COLUMN phase_number INTEGER;
ALTER TABLE tasks ADD COLUMN phase_name TEXT;
ALTER TABLE tasks ADD COLUMN bmad_agent TEXT;
ALTER TABLE tasks ADD COLUMN bmad_workflow TEXT;
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
```

### Updated Schema Definition

```typescript
// Updated tasks table definition in src/main/db/schema.ts
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('backlog'),
    sort_order: integer('sort_order').notNull().default(0),
    epic_id: text('epic_id'),
    sprint_id: text('sprint_id'),
    // New fields for Epic 3
    task_type: text('task_type').notNull().default('story'), // 'planning' | 'story'
    phase_number: integer('phase_number'), // 1-5 for planning tasks, null for story
    phase_name: text('phase_name'), // Human-readable phase name
    bmad_agent: text('bmad_agent'), // BMAD agent identifier
    bmad_workflow: text('bmad_workflow'), // Path to workflow.yaml
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_epic_id').on(table.epic_id),
    index('idx_tasks_sprint_id').on(table.sprint_id),
    index('idx_tasks_sort_order').on(table.sort_order),
    index('idx_tasks_task_type').on(table.task_type) // New index
  ]
)
```

### Shared Types Update

```typescript
// src/shared/types/task.types.ts - Add these types
export type TaskType = 'planning' | 'story'

export interface PlanningTaskFields {
  task_type: 'planning'
  phase_number: 1 | 2 | 3 | 4 | 5
  phase_name: string
  bmad_agent: string
  bmad_workflow: string
}

export interface StoryTaskFields {
  task_type: 'story'
  phase_number: null
  phase_name: null
  bmad_agent: null
  bmad_workflow: null
}

// Type guard for narrowing
export function isPlanningTask(task: Task): task is Task & PlanningTaskFields {
  return task.task_type === 'planning'
}
```

### Testing Strategy

**Test File Location:** `src/main/db/schema.test.ts` (co-located with source)

```typescript
// Test cases to implement
describe('Task Schema', () => {
  describe('task_type field', () => {
    it('defaults new tasks to story type', async () => {
      const task = await createTask({ title: 'Test' })
      expect(task.task_type).toBe('story')
    })

    it('allows creating planning tasks with phase fields', async () => {
      const task = await createTask({
        title: 'Product Brief',
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad:bmm:agents:pm',
        bmad_workflow: '_bmad/bmm/workflows/...'
      })
      expect(task.task_type).toBe('planning')
      expect(task.phase_number).toBe(1)
    })

    it('has null phase fields for story tasks', async () => {
      const task = await createTask({ title: 'Story', task_type: 'story' })
      expect(task.phase_number).toBeNull()
      expect(task.phase_name).toBeNull()
      expect(task.bmad_agent).toBeNull()
      expect(task.bmad_workflow).toBeNull()
    })
  })

  describe('querying by task_type', () => {
    it('filters planning tasks only', async () => {
      // Create mixed tasks, query by task_type
    })

    it('filters story tasks only', async () => {
      // Create mixed tasks, query by task_type
    })
  })
})
```

### Project Structure Notes

**New Files to Create:**
```
src/main/db/planning-phases.ts         # Phase definitions constant
src/main/db/schema.test.ts             # Tests for schema AND phase definitions (combined)
```

**Files to Modify:**
```
src/main/db/schema.ts                  # Add task_type and phase fields
src/shared/types/task.types.ts         # Add TaskType and planning types
```

**No Router Changes Needed:**
The existing task.router.ts will work with the new fields since Drizzle types are inferred from schema.

### Previous Story Intelligence (Story 2.7)

**Key Learnings:**
1. Tests must pass before completion (currently 527 tests)
2. Use existing patterns from schema.ts for consistency
3. Commit message format: `3.1 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Test coverage is critical for DB schema changes

### Git Intelligence (Recent Commits)

```
6a48ba6 2.7 done: Introduce velocity metrics with chart, detail panel, and widget components.
355b94e 2.6 done: implement task filtering functionality
296428c 2.5 done: Implement epic and sprint data models, tRPC routers, and UI components
```

From Story 2.5 commit: Epic/Sprint schema pattern was established, follow same approach for planning fields.

### Dependencies (from Epic 3 Header)

- **Depends On:** Epic 1 (database, PTY, terminal), Epic 2 (Kanban board) - COMPLETE
- **This Story Enables:** Story 3.2 (Initialize Planning Tasks), Story 3.3 (Planning Task Card UI)

### Performance Considerations

- Index on `task_type` enables efficient filtered queries
- Planning tasks are typically few (5 per project) vs many story tasks
- Nullable phase fields don't impact storage for story tasks

### Future Improvements (Code Review Notes)

- **DB Constraint on phase_number**: Consider adding a CHECK constraint to enforce phase_number BETWEEN 1 AND 5 at the database level. Currently validated only at application level via `isValidPhaseNumber()` helper. Would require a migration: `ALTER TABLE tasks ADD CHECK (phase_number BETWEEN 1 AND 5 OR phase_number IS NULL)`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] - Database patterns
- [Source: src/main/db/schema.ts] - Current schema to extend
- [Source: _bmad-output/implementation-artifacts/2-7-add-velocity-metrics-widget.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 553 tests passed (15 schema tests + 11 shared type tests after code review fixes)
- Migration `20260106050833_brave_vin_gonzales` generated and applied successfully
- Rebuilt Electron modules after DB changes
- Code review: Fixed vitest config to actually run shared type tests (were silently skipped)

### Completion Notes List

1. Added `TASK_TYPE` enum to schema.ts with 'planning' and 'story' values
2. Extended tasks table with 5 new columns: task_type, phase_number, phase_name, bmad_agent, bmad_workflow
3. Created planning-phases.ts with BMAD_PLANNING_PHASES constant mapping all 5 planning phases to their agents and workflows
4. Generated and applied Drizzle migration with proper defaults for backward compatibility
5. Updated shared types with TaskType, PlanningTask, StoryTask types and isPlanningTask/isStoryTask type guards
6. Updated existing test files (task.router.test.ts, velocity.router.test.ts) to include new schema columns
7. Created comprehensive schema tests covering all acceptance criteria

### File List

**New Files:**
- src/main/db/planning-phases.ts
- src/main/db/schema.test.ts
- src/shared/types/task.types.test.ts
- drizzle/20260106050833_brave_vin_gonzales/migration.sql
- drizzle/20260106050833_brave_vin_gonzales/meta.json

**Modified Files:**
- src/main/db/schema.ts
- src/shared/types/task.types.ts
- src/main/trpc/routers/task.router.test.ts
- src/main/trpc/routers/velocity.router.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- vitest.config.ts (code review fix: include shared tests)

## Change Log

- 2026-01-06: Story 3.1 implementation complete - Added task_type field and planning-specific columns to tasks table, created BMAD planning phases constant, updated shared types with type guards
- 2026-01-06: Code review fixes - Added sprint-status.yaml to File List, enhanced isPlanningTask type guard with runtime null validation, added 4 edge case tests for malformed data, updated Dev Notes test file location, added Future Improvements section noting DB constraint opportunity
- 2026-01-06: **CRITICAL FIX** - Updated vitest.config.ts to include src/shared/**/*.test.ts in main project. Original shared type tests were NOT running (discovered during adversarial review). Test count: 542 → 553
