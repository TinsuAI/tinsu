# Story 3.1.5: Multi-Project Database Support

Status: completed

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want tasks, epics, and sprints scoped to individual projects,
so that I can work on multiple projects without data mixing between them.

## Acceptance Criteria

1. **AC1: Projects Table Creation**
   **Given** a new database migration
   **When** applied
   **Then** a `projects` table exists with columns: id (TEXT PK), path (TEXT UNIQUE), name (TEXT), created_at (INTEGER), last_opened_at (INTEGER)
   **And** indexes exist on `path` and `last_opened_at`

2. **AC2: Project ID Foreign Keys**
   **Given** existing tables (tasks, epics, sprints)
   **When** migration is applied
   **Then** each has a `project_id` column (TEXT) with foreign key to projects(id) ON DELETE CASCADE
   **And** indexes exist on each `project_id` column

3. **AC3: Project Registration on First Open**
   **Given** I open a project directory for the first time
   **When** the project loads via `ProjectService.openProject(path)`
   **Then** a new record is created in `projects` table with the path and name
   **And** the project's `id` is stored in app state as `currentProjectId`

4. **AC4: Project Lookup on Subsequent Opens**
   **Given** I open a previously opened project
   **When** the project loads
   **Then** the existing project record is found by `path` and `last_opened_at` is updated
   **And** the project's `id` is stored in app state

5. **AC5: Task Isolation Between Projects**
   **Given** I create a task in Project A
   **When** I open Project B
   **Then** Project A's tasks do not appear on Project B's board

6. **AC6: Epic Isolation Between Projects**
   **Given** I create an epic in Project A
   **When** I open Project B
   **Then** Project A's epics do not appear in Project B's epic list

7. **AC7: Sprint Isolation Between Projects**
   **Given** I create a sprint in Project A
   **When** I open Project B
   **Then** Project A's sprints do not appear in Project B's sprint list

8. **AC8: tRPC Context Includes Project ID**
   **Given** any tRPC procedure that queries tasks, epics, or sprints
   **When** the procedure executes
   **Then** it receives `project_id` from tRPC context and filters by that ID

9. **AC9: Create Operations Include Project ID**
   **Given** I create a new task, epic, or sprint
   **When** the record is inserted
   **Then** `project_id` is set to the current project's ID

10. **AC10: Migration Handles Existing Data**
    **Given** existing records in tasks, epics, sprints tables
    **When** migration runs
    **Then** existing data is preserved
    **And** `project_id` column is added as nullable
    **And** orphan records remain with NULL until claimed by a project

11. **AC11: Error Handling for Invalid Paths**
    **Given** I call `ProjectService.openProject()` with an invalid path
    **When** the path does not exist
    **Then** an error is thrown with message "Invalid project path: {path}"
    **And** no project record is created

12. **AC12: No Project Open State**
    **Given** no project has been opened (currentProjectId is null)
    **When** a tRPC query for tasks/epics/sprints is executed
    **Then** the query returns an empty array
    **And** create operations throw "No project open"

## Tasks / Subtasks

- [x] Task 1: Create projects table schema and migration (AC: 1)
  - [x] Add `projects` table to `src/main/db/schema.ts` with id, path, name, created_at, last_opened_at
  - [x] Add indexes on `path` (unique) and `last_opened_at`
  - [x] Generate Drizzle migration with `npm run db:generate`
  - [x] Verify migration SQL is correct

- [x] Task 2: Add project_id column to existing tables (AC: 2, 10)
  - [x] Add `project_id` TEXT column to `tasks` table (nullable for migration safety)
  - [x] Add `project_id` TEXT column to `epics` table (nullable for migration safety)
  - [x] Add `project_id` TEXT column to `sprints` table (nullable for migration safety)
  - [x] Add foreign key references to `projects(id)` with ON DELETE CASCADE
  - [x] Add indexes on all `project_id` columns
  - [x] Run `npm run db:push` to apply migration
  - [x] Run `npm run rebuild:electron` after DB changes

- [x] Task 3: Update ProjectService for project registration (AC: 3, 4, 11)
  - [x] Add `currentProjectId` static field to ProjectService
  - [x] Modify `openProject()` to register project in DB if not exists
  - [x] Use `nanoid` for project ID generation (consistent with codebase)
  - [x] Lookup existing project by path and update `last_opened_at`
  - [x] Store project ID in static state and return in ProjectInfo
  - [x] Add `getCurrentProjectId()` method for tRPC context
  - [x] Handle error cases (invalid path, DB errors)

- [x] Task 4: Update tRPC context with project_id (AC: 8)
  - [x] Modify `src/main/trpc/context.ts` to include `projectId` from ProjectService
  - [x] Update Context interface to include `projectId: string | null`
  - [x] Handle null projectId case (no project open)

- [x] Task 5: Update task.router.ts for project scoping (AC: 5, 8, 9, 12)
  - [x] Modify `listTasks` to filter by `ctx.projectId`
  - [x] Modify `getTask` to verify task belongs to current project
  - [x] Modify `createTask` to set `project_id` from context
  - [x] Add guard: throw TRPCError if no project open on create
  - [x] Return empty array if no project open on list queries

- [x] Task 6: Update epic.router.ts for project scoping (AC: 6, 8, 9, 12)
  - [x] Modify `listEpics` to filter by `ctx.projectId`
  - [x] Modify `getEpic` to verify epic belongs to current project
  - [x] Modify `createEpic` to set `project_id` from context
  - [x] Add guard for no project open

- [x] Task 7: Update sprint.router.ts for project scoping (AC: 7, 8, 9, 12)
  - [x] Modify `listSprints` to filter by `ctx.projectId`
  - [x] Modify `getSprint` to verify sprint belongs to current project
  - [x] Modify `createSprint` to set `project_id` from context
  - [x] Add guard for no project open

- [x] Task 8: Update PlanningInitService for project_id (AC: 9)
  - [x] Modify `initializePlanningTasks()` to accept and use `projectId` parameter
  - [x] Ensure planning tasks are created with correct project_id
  - [x] Update ProjectService to pass projectId to PlanningInitService

- [x] Task 9: Update shared types (AC: 1-9)
  - [x] Add `Project` interface to `src/shared/types/task.types.ts`
  - [x] Add `project_id: string | null` to Task, Epic, Sprint interfaces
  - [x] Update NewTask, NewEpic, NewSprint to accept optional project_id

- [x] Task 10: Write comprehensive tests (AC: all)
  - [x] Test project registration on first open
  - [x] Test project lookup on subsequent opens
  - [x] Test task isolation between projects
  - [x] Test epic isolation between projects
  - [x] Test sprint isolation between projects
  - [x] Test tRPC context includes projectId
  - [x] Test create operations set projectId
  - [x] Test error handling for invalid paths
  - [x] Test no project open state
  - [x] Test migration preserves existing data

- [x] Task 11: Run full test suite and verify (AC: all)
  - [x] Run `npm run test` to verify all tests pass (633 tests passing after review fixes)
  - [x] Verify existing tests still pass with new schema
  - [x] Run `npm run rebuild:electron` after tests

### Review Follow-ups (AI) - Fixed

- [x] [AI-Review][CRITICAL] epic.router.test.ts and sprint.router.test.ts did not exist - Created comprehensive test files with project isolation tests
- [x] [AI-Review][MEDIUM] getById methods fetched then checked ownership - Optimized to single query with AND condition for security/performance
- [x] [AI-Review][MEDIUM] update/delete mutations lacked project ownership checks - Added project_id filter to WHERE clauses

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database operations happen in the main process via Drizzle ORM. The renderer NEVER directly accesses the database.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### ID Generation Strategy

Use `nanoid` for project IDs (consistent with existing codebase patterns):

```typescript
import { nanoid } from 'nanoid'
const projectId = nanoid() // "V1StGXR8_Z5jdHi6B-myT"
```

### Schema Changes

```typescript
// src/main/db/schema.ts - Add projects table

// Projects table (Story 3.1.5)
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull().unique(),
    name: text('name').notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    last_opened_at: integer('last_opened_at', { mode: 'timestamp' })
  },
  (table) => [
    index('idx_projects_path').on(table.path),
    index('idx_projects_last_opened').on(table.last_opened_at)
  ]
)

// Update tasks table - add project_id
export const tasks = sqliteTable(
  'tasks',
  {
    // ... existing fields ...
    project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' })
  },
  (table) => [
    // ... existing indexes ...
    index('idx_tasks_project_id').on(table.project_id)
  ]
)

// Similar changes for epics and sprints tables
```

### Expected Migration SQL

```sql
-- Create projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_opened_at INTEGER
);
CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_projects_last_opened ON projects(last_opened_at);

-- Add project_id to tasks (nullable for existing data)
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

-- Add project_id to epics
ALTER TABLE epics ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_epics_project_id ON epics(project_id);

-- Add project_id to sprints
ALTER TABLE sprints ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_sprints_project_id ON sprints(project_id);
```

### ProjectService Updates

```typescript
// src/main/services/project.service.ts - Key changes

import { nanoid } from 'nanoid'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq } from 'drizzle-orm'

export class ProjectService {
  private static currentProjectPath: string | null = null
  private static currentProjectId: string | null = null  // NEW
  private static currentProjectInfo: ProjectInfo | null = null

  // NEW: Get current project ID for tRPC context
  static getCurrentProjectId(): string | null {
    return this.currentProjectId
  }

  // MODIFIED: Register/lookup project in DB
  static async openProject(projectPath: string): Promise<ProjectInfo> {
    // ... validation ...

    // Check if project exists in DB
    const existingProject = await db.query.projects.findFirst({
      where: eq(projects.path, projectPath)
    })

    let projectId: string

    if (existingProject) {
      // Update last_opened_at
      await db.update(projects)
        .set({ last_opened_at: new Date() })
        .where(eq(projects.id, existingProject.id))
      projectId = existingProject.id
    } else {
      // Create new project record
      projectId = nanoid()
      await db.insert(projects).values({
        id: projectId,
        path: projectPath,
        name: path.basename(projectPath), // Or from config
        last_opened_at: new Date()
      })
    }

    this.currentProjectId = projectId
    // ... rest of method ...
  }
}
```

### tRPC Context Updates

```typescript
// src/main/trpc/context.ts

import { ProjectService } from '../services/project.service'

export interface Context {
  db: typeof db
  projectRoot: string
  projectId: string | null  // NEW
}

export const createContext = async (_opts: CreateContextOptions): Promise<Context> => ({
  db,
  projectRoot: process.env.TINSU_PROJECT_ROOT || process.cwd(),
  projectId: ProjectService.getCurrentProjectId()  // NEW
})
```

### Router Query Pattern

```typescript
// src/main/trpc/routers/task.router.ts - Example pattern

listTasks: t.procedure.query(async ({ ctx }) => {
  // Handle no project open
  if (!ctx.projectId) {
    return []
  }

  return await ctx.db.query.tasks.findMany({
    where: eq(tasks.project_id, ctx.projectId),
    orderBy: [asc(tasks.sort_order)]
  })
})

createTask: t.procedure
  .input(createTaskSchema)
  .mutation(async ({ ctx, input }) => {
    // Guard: require project to be open
    if (!ctx.projectId) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No project open'
      })
    }

    return await ctx.db.insert(tasks).values({
      ...input,
      id: nanoid(),
      project_id: ctx.projectId  // Set project_id
    }).returning()
  })
```

### Testing Strategy

**Test File Locations:**
- `src/main/db/schema.test.ts` - Schema tests (extend existing)
- `src/main/services/project.service.test.ts` - Project registration tests (extend existing)
- `src/main/trpc/routers/task.router.test.ts` - Project isolation tests (extend existing)

```typescript
// Example test for project isolation
describe('Task Project Isolation', () => {
  it('filters tasks by current project', async () => {
    // Create two projects
    const projectA = await createProject('/path/a')
    const projectB = await createProject('/path/b')

    // Create task in project A
    ProjectService.setCurrentProjectId(projectA.id)
    await createTask({ title: 'Task A' })

    // Switch to project B and verify task not visible
    ProjectService.setCurrentProjectId(projectB.id)
    const tasks = await listTasks()
    expect(tasks).toHaveLength(0)
  })
})
```

### Project Structure Notes

**New Files to Create:**
```
src/shared/types/project.types.ts  # Project interface (or add to config.types.ts)
```

**Files to Modify:**
```
src/main/db/schema.ts                        # Add projects table, project_id columns
src/main/services/project.service.ts         # Add DB registration, getCurrentProjectId
src/main/services/planning-init.service.ts   # Use projectId parameter
src/main/trpc/context.ts                     # Include projectId
src/main/trpc/routers/task.router.ts         # Filter by projectId
src/main/trpc/routers/epic.router.ts         # Filter by projectId
src/main/trpc/routers/sprint.router.ts       # Filter by projectId
src/shared/types/task.types.ts               # Add project_id to interfaces
src/shared/types/config.types.ts             # Add Project interface (optional)
```

### Previous Story Intelligence (Story 3.1)

**Key Learnings from Story 3.1:**
1. Tests must pass before completion (currently 553 tests)
2. Use existing patterns from schema.ts for consistency
3. Commit message format: `3.1.5 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Test coverage is critical for DB schema changes
6. Vitest config properly includes `src/shared/**/*.test.ts`

### Git Intelligence (Recent Commits)

```
f5403d5 3.1 done: Add project management services, TRPC router, and UI components
6a48ba6 2.7 done: Introduce velocity metrics with chart, detail panel, and widget components.
355b94e 2.6 done: implement task filtering functionality
```

From Story 3.1 commit (f5403d5): ProjectService pattern was established, follow same approach.

### Dependencies

- **Depends On:** Story 3.1 (Planning Task Type & Database Schema) - COMPLETE
- **Blocks:** Story 3.2 (Initialize Planning Tasks on New Project) - Currently in review, needs this for data integrity

### Performance Considerations

- Indexes on `project_id` enable efficient filtered queries
- Projects table will typically have few records (one per opened project)
- Most queries will filter by single project_id - indexed for performance

### Migration Safety

1. Add columns as **nullable** to preserve existing data
2. Foreign keys with ON DELETE CASCADE ensure cleanup when project deleted
3. Existing orphan records (NULL project_id) remain until claimed
4. Future migration can add NOT NULL constraint once all data is scoped

### Edge Cases to Handle

1. **App crashes during project registration:** Transaction rollback
2. **Project path changes:** Update path in DB on next open (future enhancement)
3. **Multiple app instances:** SQLite handles concurrent access
4. **Missing .tinsu/config.yaml:** Use directory basename as project name

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1.5] - Original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/schema-gap-multi-project-support.md] - Gap analysis document
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md] - Database patterns
- [Source: src/main/db/schema.ts] - Current schema to extend
- [Source: src/main/services/project.service.ts] - Current service to enhance
- [Source: _bmad-output/implementation-artifacts/3-1-planning-task-type-and-database-schema.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Resolved NODE_MODULE_VERSION mismatch by running `npm run rebuild:node` followed by `npm run rebuild:electron`
- Fixed db mock in project.service.test.ts and project.router.test.ts to include `select().from().where().get()` pattern

### Completion Notes List

1. All 12 acceptance criteria implemented and tested
2. All 633 tests passing (39 test files) after code review fixes
3. Database migration applied successfully via `npm run db:push`
4. Projects table created with id, path, name, created_at, last_opened_at columns
5. project_id column added to tasks, epics, and sprints tables with cascade delete
6. tRPC context includes projectId for all routers
7. All routers filter queries by project_id and throw PRECONDITION_FAILED when no project open
8. PlanningInitService updated to accept and use projectId parameter
9. Shared types updated with Project interface and project_id fields
10. Node typecheck passes (renderer has pre-existing issues from earlier stories)
11. **[Code Review Fix]** Created missing epic.router.test.ts with 17 comprehensive tests
12. **[Code Review Fix]** Created missing sprint.router.test.ts with 24 comprehensive tests
13. **[Code Review Fix]** Optimized getById methods to use single query with project filter
14. **[Code Review Fix]** Added project ownership checks to update/delete mutations

### File List

**Modified Files:**
- `src/main/db/schema.ts` - Added projects table and project_id columns
- `src/main/db/schema.test.ts` - Updated tests for new schema
- `src/main/services/project.service.ts` - Added registerOrUpdateProject, getCurrentProjectId
- `src/main/services/project.service.test.ts` - Added db mock and projectId tests
- `src/main/services/planning-init.service.ts` - Added projectId parameter
- `src/main/services/planning-init.service.test.ts` - Updated with project_id support
- `src/main/services/config.service.ts` - Added planningTasksInitialized to default config
- `src/main/services/config.service.test.ts` - Added planningTasksInitialized to test configs
- `src/main/services/artifact-detector.service.test.ts` - Fixed Dirent type casts for Node.js 22+
- `src/main/trpc/context.ts` - Added projectId to Context interface
- `src/main/trpc/routers/task.router.ts` - Added project scoping, optimized getById, added ownership checks
- `src/main/trpc/routers/task.router.test.ts` - Comprehensive project isolation tests
- `src/main/trpc/routers/epic.router.ts` - Added project scoping, optimized getById, added ownership checks
- `src/main/trpc/routers/sprint.router.ts` - Added project scoping, optimized getById, added ownership checks
- `src/main/trpc/routers/velocity.router.ts` - Added project scoping
- `src/main/trpc/routers/velocity.router.test.ts` - Added projectId support
- `src/main/trpc/routers/project.router.test.ts` - Added db mock and projectId
- `src/main/trpc/routers/config.router.test.ts` - Added projectId to context
- `src/main/trpc/routers/pty.router.test.ts` - Added projectId to context
- `src/shared/types/task.types.ts` - Added Project, NewProject, project_id fields
- `src/shared/types/task.types.test.ts` - Added is_start_here and project_id to base tasks

**New Files (from code review):**
- `src/main/trpc/routers/epic.router.test.ts` - Created comprehensive epic router tests with project isolation (17 tests)
- `src/main/trpc/routers/sprint.router.test.ts` - Created comprehensive sprint router tests with project isolation (24 tests)

