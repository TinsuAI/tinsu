# Story TES-1.2: Task Session Database Schema

Status: done

---

## Story

As a developer,
I want a task_sessions table to store terminal session mappings,
So that the system can track which tmux session belongs to which task.

## Acceptance Criteria

1. **Given** the database schema needs to support terminal sessions, **When** the migration runs, **Then** a `task_sessions` table is created with columns: id (TEXT PK), task_id (TEXT NOT NULL UNIQUE), session_id (TEXT), tmux_session (TEXT NOT NULL), current_phase (TEXT), created_at (INTEGER NOT NULL), **And** a foreign key references tasks(id) with ON DELETE CASCADE, **And** an index exists on session_id for fast lookups

2. **Given** a task is deleted, **When** the deletion cascades, **Then** the associated task_session record is also deleted

## Tasks / Subtasks

- [x] Task 1: Add task_sessions table to Drizzle schema (AC: #1)
  - [x] 1.1: Add task_sessions table definition to `src/main/db/schema.ts`
  - [x] 1.2: Create columns: id (TEXT PK), task_id (TEXT NOT NULL UNIQUE), session_id (TEXT nullable), tmux_session (TEXT NOT NULL), current_phase (TEXT nullable), created_at (INTEGER NOT NULL with default)
  - [x] 1.3: Add foreign key reference to tasks(id) with ON DELETE CASCADE
  - [x] 1.4: Add index on session_id column for fast lookups by Claude Code session
  - [x] 1.5: Add index on task_id column for fast lookups by task
  - [x] 1.6: Export TaskSession and NewTaskSession types

- [x] Task 2: Generate and apply database migration (AC: #1)
  - [x] 2.1: Run `npm run db:generate` to generate migration files
  - [x] 2.2: Review generated migration SQL for correctness
  - [x] 2.3: Apply migration with `npm run rebuild:electron` (includes db push)

- [x] Task 3: Write unit tests for schema (AC: #1, #2)
  - [x] 3.1: Create `src/main/db/task-sessions.test.ts`
  - [x] 3.2: Test task_sessions table creation with all columns
  - [x] 3.3: Test session_id index exists and works
  - [x] 3.4: Test foreign key constraint (insert with valid task_id)
  - [x] 3.5: Test ON DELETE CASCADE (delete task → session deleted)
  - [x] 3.6: Test unique constraint on task_id (only one session per task)

- [x] Task 4: Add shared types for renderer (AC: #1)
  - [x] 4.1: Add TaskSession type to `src/shared/types/task.types.ts`
  - [x] 4.2: Export SESSION_PHASE enum for type-safe phase tracking

## Dev Notes

### Architecture Compliance

This story creates the database foundation for the Task Execution Sandbox feature. The `task_sessions` table is **CRITICAL** because:

- **tmux Session Tracking:** Maps each task to its persistent tmux session (`tinsu-{projectName}-{taskId}`)
- **Claude Code Session Routing:** The `session_id` column maps Claude Code sessions (from hooks) to tasks for event routing
- **Workflow Phase Tracking:** The `current_phase` column tracks dev-story → code-review → user-feedback progression
- **Cascade Cleanup:** When tasks are deleted, their associated sessions are automatically cleaned up

[Source: _bmad-output/planning-artifacts/architecture.md#Task-Execution-Sandbox-Architecture]

### Technical Requirements

**Schema Location:** `src/main/db/schema.ts`

**Table Definition (per Architecture):**
```sql
CREATE TABLE task_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  session_id TEXT,                 -- Claude Code session ID (from hooks)
  tmux_session TEXT NOT NULL,      -- tinsu-{projectName}-{taskId}
  current_phase TEXT,              -- dev-story | code-review | user-feedback
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_sessions_session_id ON task_sessions(session_id);
```

[Source: _bmad-output/planning-artifacts/architecture.md#New-Database-Schema]

### Drizzle Schema Pattern

Follow existing patterns from the codebase:

```typescript
// From schema.ts - follow this exact pattern
export const task_sessions = sqliteTable(
  'task_sessions',
  {
    id: text('id').primaryKey(),
    task_id: text('task_id')
      .notNull()
      .unique()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    session_id: text('session_id'), // Nullable - set when Claude Code session starts
    tmux_session: text('tmux_session').notNull(),
    current_phase: text('current_phase'), // Nullable - set when workflow starts
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_task_sessions_session_id').on(table.session_id),
    index('idx_task_sessions_task_id').on(table.task_id)
  ]
)

export type TaskSession = InferSelectModel<typeof task_sessions>
export type NewTaskSession = InferInsertModel<typeof task_sessions>
```

### Column Details

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | TEXT | PRIMARY KEY | UUID for the session record |
| `task_id` | TEXT | NOT NULL, UNIQUE, FK | Links to tasks table (one session per task) |
| `session_id` | TEXT | nullable | Claude Code session ID from hooks (set when agent starts) |
| `tmux_session` | TEXT | NOT NULL | tmux session name: `tinsu-{projectName}-{taskId}` |
| `current_phase` | TEXT | nullable | Workflow phase: 'dev-story' \| 'code-review' \| 'user-feedback' |
| `created_at` | INTEGER | NOT NULL | Unix timestamp of creation |

### Session Phase Values

Define as a const enum for type safety:

```typescript
// In shared/types/task.types.ts
export const SESSION_PHASE = ['dev-story', 'code-review', 'user-feedback'] as const
export type SessionPhase = (typeof SESSION_PHASE)[number]
```

### Previous Story Learnings (TES-1.1)

From the completed tmux dependency check story:
- **Testing Pattern:** Use `npm run rebuild:node` before tests, `npm run rebuild:electron` after (handled by pre/post test scripts)
- **Naming Convention:** kebab-case for filenames (`task-sessions.test.ts`), PascalCase for types (`TaskSession`)
- **Error Handling:** Drizzle schema errors should throw descriptive errors with constraint details

### Project Structure Notes

- Schema file: `src/main/db/schema.ts` (existing file, add table definition)
- Test file: `src/main/db/task-sessions.test.ts` (NEW - co-located test)
- Shared types: `src/shared/types/task.types.ts` (existing file, add types)
- Migration: Auto-generated by `npm run db:generate`

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/main/db/schema.ts` | MODIFY | Add task_sessions table definition |
| `src/main/db/task-sessions.test.ts` | CREATE | Unit tests for task_sessions |
| `src/shared/types/task.types.ts` | MODIFY | Add TaskSession type and SESSION_PHASE |
| `drizzle/migrations/*.sql` | AUTO-GENERATED | Migration files |

### References

- [Architecture: Task Execution Sandbox - New Database Schema](../_bmad-output/planning-artifacts/architecture.md#new-database-schema)
- [PRD: Task Execution Sandbox - FR45](../_bmad-output/planning-artifacts/prd-task-execution-sandbox.md)
- [Epics: Story 1.2](../_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-12-task-session-database-schema)
- [Project Context: Database Patterns](../_bmad-output/planning-artifacts/project-context.md#naming-conventions)

### Code Patterns to Follow

**Naming Conventions:**
- Table: `task_sessions` (snake_case plural)
- Columns: `task_id`, `session_id`, `tmux_session`, `current_phase`, `created_at` (snake_case)
- Types: `TaskSession`, `NewTaskSession` (PascalCase, no I prefix)
- Test file: `task-sessions.test.ts` (kebab-case, co-located)
- Index: `idx_task_sessions_session_id` (idx_table_column pattern)

**Schema Pattern:**
```typescript
// Follow existing patterns exactly
export const task_sessions = sqliteTable(
  'task_sessions',
  {
    // column definitions
  },
  (table) => [
    // index definitions
  ]
)
```

**Type Export Pattern:**
```typescript
export type TaskSession = InferSelectModel<typeof task_sessions>
export type NewTaskSession = InferInsertModel<typeof task_sessions>
```

### Testing Notes

Run tests with:
```bash
npm test src/main/db/task-sessions.test.ts
```

Test scenarios:
1. **Table structure:** Verify all columns exist with correct types
2. **FK constraint:** Insert session with valid task_id succeeds, invalid fails
3. **Cascade delete:** Delete task → verify session deleted automatically
4. **Unique constraint:** Second session for same task_id fails
5. **Index performance:** Lookup by session_id uses index (optional query plan test)

### Git Intelligence

Recent commits show:
- `739798e tes-1-1 done` - Previous story completed, foundation ready
- Schema changes require `npm run rebuild:electron` after migration

### Migration Workflow

1. Modify `src/main/db/schema.ts` with new table
2. Run `npm run db:generate` to generate migration
3. Review migration SQL in `drizzle/migrations/`
4. Run `npm run rebuild:electron` (includes db:push)
5. Verify table exists with correct structure

**IMPORTANT:** After schema changes, run `npm run rebuild:electron` to ensure the app works correctly.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - implementation was straightforward.

### Completion Notes List

- Added `task_sessions` table with all required columns (id, task_id, session_id, tmux_session, current_phase, created_at)
- Configured foreign key constraint to tasks(id) with ON DELETE CASCADE for automatic cleanup
- Added index on session_id for fast Claude Code session lookups
- Added unique index on task_id to enforce one-session-per-task constraint
- Exported SESSION_PHASE constant array and SessionPhase type for type-safe workflow phase tracking
- Added TaskSession and NewTaskSession interfaces to shared types for renderer access
- Created comprehensive test suite with 11 tests covering:
  - Table structure and all columns
  - Nullable fields (session_id, current_phase)
  - All valid phase values (dev-story, code-review, user-feedback)
  - Foreign key constraint enforcement
  - ON DELETE CASCADE behavior
  - Unique constraint on task_id
  - Session_id index for fast lookups
  - Type exports verification
- Fixed pre-existing test issue in schema.test.ts (missing context_notes column)
- All 30 database tests pass

### File List

**Created:**
- `src/main/db/task-sessions.test.ts` - Unit tests for task_sessions schema (11 tests)
- `drizzle/20260113083019_far_spectrum/migration.sql` - Migration for task_sessions table (also includes context_notes from Story 5.5)

**Modified:**
- `src/main/db/schema.ts` - Added task_sessions table, SESSION_PHASE const, TaskSession/NewTaskSession types, imported uniqueIndex
- `src/shared/types/task.types.ts` - Added SESSION_PHASE const, SessionPhase type, TaskSession/NewTaskSession interfaces
- `src/main/db/schema.test.ts` - Fixed missing context_notes column in test database setup
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated tes-1-2 status to review

### Change Log

- 2026-01-13: Implemented TES-1.2 task_sessions database schema with full test coverage
- 2026-01-13: Code review fixes - Added UNIQUE constraint to migration SQL, updated File List documentation, fixed test command
