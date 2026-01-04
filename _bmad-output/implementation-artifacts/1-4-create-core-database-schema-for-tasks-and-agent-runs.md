# Story 1.4: Create Core Database Schema for Tasks and Agent Runs

Status: done

---

## Story

As a developer,
I want the core database schema for tasks and agent_runs tables,
So that task state and agent execution history can be persisted (FR32, FR33).

---

## Acceptance Criteria

### AC1: Tasks Table Schema
**Given** Drizzle ORM is configured from Story 1.3
**When** I define the tasks table schema
**Then** the table includes: id (text PK), title (text), description (text), status (text), epic_id (text nullable), sprint_id (text nullable), created_at (integer), updated_at (integer)
**And** snake_case naming convention is used per architecture

### AC2: Agent Runs Table Schema
**Given** the tasks table exists
**When** I define the agent_runs table schema
**Then** the table includes: id (text PK), task_id (text FK), start_time (integer), end_time (integer nullable), duration_ms (integer nullable), token_usage (integer nullable), exit_status (text nullable), log_path (text nullable)
**And** a foreign key relationship links agent_runs to tasks

### AC3: Migration Success
**Given** both schemas are defined
**When** I run migrations
**Then** both tables are created in tinsu.db
**And** I can insert and query records using Drizzle's type-safe API

### AC4: Query Performance
**Given** records exist in the database
**When** I query task list views
**Then** queries complete in <200ms (NFR6)

---

## Tasks / Subtasks

- [x] **Task 1: Extend schema.ts with tasks table** (AC: #1)
  - [x] Define tasks table with all required columns
  - [x] Add id as text primary key (use nanoid or uuid pattern)
  - [x] Add title (text, not null), description (text, nullable)
  - [x] Add status with enum-like text: 'backlog' | 'in_progress' | 'review' | 'done'
  - [x] Add epic_id and sprint_id as nullable text foreign keys
  - [x] Add created_at and updated_at as integer timestamps (unix epoch)
  - [x] Add updated_at trigger or application-level update pattern

- [x] **Task 2: Add agent_runs table to schema** (AC: #2)
  - [x] Define agent_runs table with all required columns
  - [x] Add id as text primary key
  - [x] Add task_id as text with foreign key reference to tasks.id
  - [x] Add start_time as integer (unix epoch, not null)
  - [x] Add end_time as integer (nullable - null while running)
  - [x] Add duration_ms as integer (nullable - computed on completion)
  - [x] Add token_usage as integer (nullable)
  - [x] Add exit_status as text (nullable): 'success' | 'error' | 'cancelled' | 'timeout'
  - [x] Add log_path as text (nullable - path to log file)

- [x] **Task 3: Add indexes for query performance** (AC: #4)
  - [x] Add index on tasks.status for filtering by column
  - [x] Add index on tasks.epic_id for filtering by epic
  - [x] Add index on tasks.sprint_id for filtering by sprint
  - [x] Add index on agent_runs.task_id for join queries

- [x] **Task 4: Generate and apply migrations** (AC: #3)
  - [x] Run `npm run db:generate` to create migration
  - [x] Verify migration SQL in drizzle/ directory
  - [x] Run `npm run db:push` or `npm run db:generate && npx drizzle-kit migrate` to apply
  - [x] Verify tables exist in tinsu.db

- [x] **Task 5: Create type exports for shared types** (AC: #1, #2)
  - [x] Export inferred types from schema: `InferSelectModel<typeof tasks>`, `InferInsertModel<typeof tasks>`
  - [x] Create type aliases: `Task`, `NewTask`, `AgentRun`, `NewAgentRun`
  - [x] Optionally create src/shared/types/task.types.ts with status enum

- [x] **Task 6: Add basic CRUD test queries** (AC: #3, #4)
  - [x] Write a temporary test in main process to:
    - Insert a test task
    - Query tasks by status
    - Insert an agent_run linked to task
    - Query agent_runs by task_id
  - [x] Verify queries work correctly
  - [x] Remove test code after verification

- [x] **Task 7: Verify build and typecheck** (AC: #1, #2, #3)
  - [x] Run `npm run typecheck` - must pass
  - [x] Run `npm run build` - must complete without errors
  - [x] Verify app launches with new schema

---

## Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Add test framework (Vitest) and schema validation tests in future story - No testing infrastructure exists yet

---

## Dev Notes

### Critical Architecture Compliance

**MANDATORY: Follow these patterns exactly**

From [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture]:

> **Schema Strategy:**
> - Tasks table: id, title, description, status, sprint_id, epic_id, timestamps
> - Agent runs table: task_id, started_at, ended_at, token_usage, exit_status
> - Logs table: run_id, timestamp, level, message (indexed for search)

From [Source: _bmad-output/planning-artifacts/project-context.md#Naming-Conventions]:

| Element | Convention | Example | Anti-pattern |
|---------|------------|---------|--------------|
| DB tables | snake_case plural | `tasks`, `agent_runs` | `Task`, `agentRuns` |
| DB columns | snake_case | `created_at` | `createdAt` |

### Schema Design Pattern

**Tasks table (src/main/db/schema.ts):**

```typescript
import { sql, relations } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// Task status enum values
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = typeof TASK_STATUS[number];

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('backlog'),
  epic_id: text('epic_id'),
  sprint_id: text('sprint_id'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => [
  index('idx_tasks_status').on(table.status),
  index('idx_tasks_epic_id').on(table.epic_id),
  index('idx_tasks_sprint_id').on(table.sprint_id),
]);
```

**Agent runs table:**

```typescript
// Exit status enum values
export const EXIT_STATUS = ['success', 'error', 'cancelled', 'timeout'] as const;
export type ExitStatus = typeof EXIT_STATUS[number];

export const agent_runs = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id),
  start_time: integer('start_time', { mode: 'timestamp' }).notNull(),
  end_time: integer('end_time', { mode: 'timestamp' }),
  duration_ms: integer('duration_ms'),
  token_usage: integer('token_usage'),
  exit_status: text('exit_status'),
  log_path: text('log_path'),
}, (table) => [
  index('idx_agent_runs_task_id').on(table.task_id),
]);
```

### Drizzle Relations (Optional but Recommended)

```typescript
export const tasksRelations = relations(tasks, ({ many }) => ({
  agent_runs: many(agent_runs),
}));

export const agentRunsRelations = relations(agent_runs, ({ one }) => ({
  task: one(tasks, {
    fields: [agent_runs.task_id],
    references: [tasks.id],
  }),
}));
```

### Type Exports Pattern

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Task types
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

// AgentRun types
export type AgentRun = InferSelectModel<typeof agent_runs>;
export type NewAgentRun = InferInsertModel<typeof agent_runs>;
```

### ID Generation Pattern

Use `nanoid` for generating compact, URL-safe unique IDs:

```bash
npm install nanoid
```

```typescript
import { nanoid } from 'nanoid';

// When inserting:
const newTask: NewTask = {
  id: nanoid(),
  title: 'My Task',
  status: 'backlog',
};
```

**Alternative:** Use `crypto.randomUUID()` for standard UUIDs (no extra dependency).

### Previous Story Learnings

From [Source: _bmad-output/implementation-artifacts/1-3-set-up-sqlite-database-with-drizzle-orm.md]:

1. **Drizzle API change**: Use `drizzle({ client: sqlite, schema })` not the old format
2. **WAL mode enabled**: Database already has crash resilience
3. **Database path**: Development uses `data/tinsu.db`, production uses `app.getPath('userData')`
4. **Native bindings**: Already rebuilt with `electron-rebuild`

### Updated_at Handling

SQLite doesn't have built-in triggers in Drizzle, so handle at application level:

```typescript
// When updating a task:
await db.update(tasks)
  .set({
    status: 'in_progress',
    updated_at: new Date() // or: sql`(unixepoch())`
  })
  .where(eq(tasks.id, taskId));
```

### What NOT To Do

1. **DO NOT** use camelCase for column names (use snake_case)
2. **DO NOT** use `INTEGER` primary keys - use text IDs for distributed-friendly design
3. **DO NOT** forget indexes - they're critical for NFR6 (<200ms queries)
4. **DO NOT** import database types in renderer - use shared types only
5. **DO NOT** use `mode: 'number'` for timestamps - use `mode: 'timestamp'` for Date objects

---

## Technical Requirements

### Database Schema Requirements

From [Source: _bmad-output/planning-artifacts/prd.md#Data-Persistence]:

| FR | Requirement |
|----|-------------|
| FR32 | System persists task state, status, and timestamps in SQLite database |
| FR33 | System stores agent run history (start time, duration, token usage, exit status) |

### Column Specifications

**tasks table:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PRIMARY KEY | nanoid or uuid |
| title | text | NOT NULL | Task title |
| description | text | nullable | Markdown content |
| status | text | NOT NULL, DEFAULT 'backlog' | One of: backlog, in_progress, review, done |
| epic_id | text | nullable | FK to epics (future) |
| sprint_id | text | nullable | FK to sprints (future) |
| created_at | integer | NOT NULL | Unix timestamp |
| updated_at | integer | NOT NULL | Unix timestamp |

**agent_runs table:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PRIMARY KEY | nanoid or uuid |
| task_id | text | NOT NULL, FK → tasks.id | Links run to task |
| start_time | integer | NOT NULL | Unix timestamp when started |
| end_time | integer | nullable | Unix timestamp when completed |
| duration_ms | integer | nullable | Computed: end_time - start_time |
| token_usage | integer | nullable | Tokens consumed (if available) |
| exit_status | text | nullable | success/error/cancelled/timeout |
| log_path | text | nullable | Path to log file |

### Performance Requirements

From [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional-Requirements]:

| NFR | Requirement |
|-----|-------------|
| NFR6 | SQLite queries for task list views complete in <200ms |
| NFR7 | Task state changes persist immediately (no visible delay) |

---

## Testing Requirements

### Manual Verification Checklist

- [x] `npm run db:generate` creates new migration files
- [x] Migration SQL shows CREATE TABLE for both tasks and agent_runs
- [x] Migration SQL includes all indexes
- [x] `npm run db:push` or migrate applies without errors
- [x] `drizzle-kit studio` shows both tables with correct columns
- [x] Insert test task via code works
- [x] Query tasks by status returns correct results
- [x] Insert agent_run with task_id foreign key works
- [x] Query agent_runs by task_id returns correct results
- [x] `npm run typecheck` passes
- [x] `npm run build` completes without errors

### Expected Outcomes

1. **Schema file (`src/main/db/schema.ts`):**
   - Contains tasks table definition
   - Contains agent_runs table definition
   - Contains indexes for performance
   - Exports type aliases

2. **Migration files (`drizzle/`):**
   - New migration directory with SQL file
   - CREATE TABLE statements for tasks and agent_runs
   - CREATE INDEX statements for all indexes

3. **Database (`data/tinsu.db`):**
   - Both tables exist
   - Indexes are created
   - Foreign key constraint on agent_runs.task_id

---

## References

### Architecture & Planning
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md#Naming-Conventions]
- [Source: _bmad-output/planning-artifacts/prd.md#Data-Persistence]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4]

### Previous Story
- [Source: _bmad-output/implementation-artifacts/1-3-set-up-sqlite-database-with-drizzle-orm.md]

### External Documentation
- [Drizzle ORM SQLite Schema](https://orm.drizzle.team/docs/sql-schema-declaration)
- [Drizzle Relations](https://orm.drizzle.team/docs/relations)
- [Drizzle Indexes](https://orm.drizzle.team/docs/indexes-constraints#indexes)
- [nanoid](https://github.com/ai/nanoid)

---

## Project Context Reference

From [Source: _bmad-output/planning-artifacts/project-context.md]:

### Critical Rules
- Database operations happen in **main process ONLY**
- Use tRPC procedures for ALL main↔renderer communication
- Return data directly from tRPC, don't wrap in `{ success: true, data }`
- Use `TRPCError` not generic `Error` for router errors

### File Organization
```
src/main/db/
├── index.ts          # Database connection (exists from 1.3)
├── schema.ts         # Schema definitions (extend this)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Native module rebuild required: `npm rebuild better-sqlite3` for Node.js, `npx electron-rebuild -f -w better-sqlite3` for Electron
- Drizzle-orm beta version (1.0.0-beta.8) has different `relations` API - omitted Drizzle relations (optional per story) as FK constraint via `.references()` satisfies AC2

### Completion Notes List

1. **AC1 Satisfied**: Tasks table schema defined with all columns (id, title, description, status, epic_id, sprint_id, created_at, updated_at), snake_case naming, text PK, proper defaults
2. **AC2 Satisfied**: Agent_runs table with FK constraint to tasks.id via `.references()`, all required columns present
3. **AC3 Satisfied**: Migration generated (`drizzle/20260104175604_parallel_mockingbird/migration.sql`) and applied via `npm run db:push`, both tables created in `data/tinsu.db`
4. **AC4 Satisfied**: Query performance verified at 1.06ms (well under 200ms threshold), indexes created for tasks.status, tasks.epic_id, tasks.sprint_id, agent_runs.task_id
5. Type exports created: `Task`, `NewTask`, `AgentRun`, `NewAgentRun`, `TaskStatus`, `ExitStatus`
6. CRUD verification script created, tested all operations successfully, then removed per story requirements
7. Build and typecheck both pass
8. **Code Review (AI):** Fixed architecture compliance - created shared types, updated documentation

### File List

- `src/main/db/schema.ts` (modified) - Extended with tasks and agent_runs tables, indexes, and type exports
- `src/shared/types/task.types.ts` (new) - Shared type definitions for Task, AgentRun, and status enums
- `drizzle/20260104175604_parallel_mockingbird/migration.sql` (new) - Migration for tasks and agent_runs tables with indexes
- `data/tinsu.db` (modified) - Database with new tables applied
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) - Updated story status to review

