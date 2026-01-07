# Schema Gap: Multi-Project Support

**Date:** 2026-01-05
**Identified By:** Winston (Architect Agent) + Tinxu
**Status:** Needs Story Creation
**Priority:** High (Blocks Story 3.2 correctness)

---

## Problem Statement

The current database schema does not support multiple projects. All data tables (`tasks`, `epics`, `sprints`, `agent_runs`) lack a `project_id` column, meaning all records are stored globally without project scoping.

This contradicts the application's design which clearly intends multi-project support:
- `ProjectService.openProject(projectPath)` allows opening different project directories
- Config is stored per-project at `.tinsu/config.yaml`
- Story 3.2 creates planning tasks "when I start a new project"
- Artifact detection looks in project-specific `_bmad-output/` folders

---

## Impact

### On Story 3.2 (Currently In Progress)
- Planning tasks are created **globally**, not per-project
- Opening Project A, then Project B would show Project A's tasks in Project B
- The `planningTasksInitialized` flag is per-project (in config), but tasks aren't scoped
- This creates data integrity issues and confusing UX

### On Future Development
- Cannot support multi-project workflows
- Cannot show cross-project metrics or views
- Data from different projects would be mixed

---

## Recommended Solution: Add project_id to All Tables

### New Table: projects

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,    -- Absolute path to project directory
  name TEXT NOT NULL,           -- Display name (from .tinsu/config.yaml)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_opened_at INTEGER        -- Track recent projects
);

CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_projects_last_opened ON projects(last_opened_at);
```

### Schema Modifications

**tasks table:**
```sql
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
```

**epics table:**
```sql
ALTER TABLE epics ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_epics_project_id ON epics(project_id);
```

**sprints table:**
```sql
ALTER TABLE sprints ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_sprints_project_id ON sprints(project_id);
```

**agent_runs table:**
- No change needed (already references tasks, which will have project_id)

**settings table:**
- Consider if settings should be global or per-project
- Recommendation: Keep global for app settings, use `.tinsu/config.yaml` for project settings

---

## Implementation Requirements

### 1. Database Schema Changes
- Create `projects` table
- Add `project_id` column to `tasks`, `epics`, `sprints` (nullable initially for migration)
- Add foreign key constraints with ON DELETE CASCADE
- Add indexes for project_id queries

### 2. Project Registration Flow
- When `ProjectService.openProject(path)` is called:
  - Check if project exists in `projects` table by path
  - If not, create new project record
  - Update `last_opened_at` timestamp
  - Store current project_id in app state

### 3. Query Modifications
- All task queries must filter by `project_id`
- All epic queries must filter by `project_id`
- All sprint queries must filter by `project_id`
- tRPC context should include current `project_id`

### 4. Service Updates
- `PlanningInitService.initializePlanningTasks()` must accept and use `project_id`
- `ArtifactDetectorService` already uses project path (no change needed)
- All routers need project_id context

---

## Acceptance Criteria for New Story

1. **Given** a new database migration
   **When** applied
   **Then** `projects` table exists with id, path, name, created_at, last_opened_at columns

2. **Given** existing tables (tasks, epics, sprints)
   **When** migration is applied
   **Then** each has a `project_id` column with foreign key to projects.id

3. **Given** I open a project directory for the first time
   **When** the project loads
   **Then** a new record is created in `projects` table with the path and name

4. **Given** I open a previously opened project
   **When** the project loads
   **Then** the existing project record is found by path and `last_opened_at` is updated

5. **Given** I create a task in Project A
   **When** I open Project B
   **Then** Project A's tasks do not appear in Project B's board

6. **Given** all task/epic/sprint queries
   **When** executed
   **Then** they filter by the current project_id

---

## Dependencies

- **Blocks:** Story 3.2 (Initialize Planning Tasks) - current implementation creates unscoped tasks
- **Blocked By:** None

---

## Migration Strategy

1. Create `projects` table
2. Add `project_id` columns as **nullable** (for existing data)
3. Run data migration to assign existing records to a default project (or prompt user)
4. Make `project_id` NOT NULL after migration
5. Add foreign key constraints

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/main/db/schema.ts` | Add `projects` table, add `project_id` to tasks/epics/sprints |
| `src/main/services/project.service.ts` | Register/lookup project on open |
| `src/main/trpc/context.ts` | Include current `project_id` in tRPC context |
| `src/main/trpc/routers/task.router.ts` | Filter all queries by project_id |
| `src/main/trpc/routers/*.router.ts` | Filter queries by project_id |
| `src/main/services/planning-init.service.ts` | Use project_id when creating tasks |
| `src/shared/types/task.types.ts` | Add project_id to Task interface |

---

## Estimated Scope

- **Schema changes:** ~2 hours
- **Project registration service:** ~2 hours
- **Query modifications:** ~3 hours
- **Tests:** ~3 hours
- **Total:** ~10 hours (1 story)

---

## Recommendation

Create this as a **blocking story before Story 3.2 can be considered complete**. The current 3.2 implementation will create incorrectly scoped data.

Options:
1. **Revert 3.2**, implement this story, then redo 3.2
2. **Keep 3.2 code**, implement this story, then add project_id to planning init
3. **Mark 3.2 as blocked**, implement this story first

Recommended: Option 2 - The 3.2 code is correct in logic, just needs project_id integration.
