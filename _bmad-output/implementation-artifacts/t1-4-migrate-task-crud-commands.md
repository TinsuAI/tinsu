# Story T1.4: Migrate Task CRUD Commands

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement the UI portions of this story (task status badge variants and task-type visual differentiation if any visual changes are needed).

## Story

As a founder,
I want to create, view, drag, and manage tasks on my Kanban board powered by the Rust backend,
So that the core Kanban workflow works in the Tauri app.

## Acceptance Criteria

1. All 5 Kanban columns render (Backlog, Create Story, In Progress, Review, Done) with tasks loaded from the Rust SQLite backend via tauri-specta commands.
2. Drag-and-drop between columns updates task status immediately (optimistic UI, <100ms response) via `update_task_status` command.
3. Tasks can be reordered within a column via `reorder_tasks` command.
4. New tasks can be created via `create_task` command; title is validated (non-empty) and `project_id` is validated (non-empty).
5. Tasks can be deleted via `delete_task` command.
6. Epic list loads from Rust backend via `list_epics` command (used for epic badges on task cards and the epic selector in CreateTaskDialog).
7. All existing tRPC hooks for task operations (`tasks.getAll`, `tasks.updateStatus`, `tasks.reorder`, `tasks.delete`, `tasks.create`, `epics.getAll`) are replaced with tauri-specta command invocations wrapped in TanStack Query hooks.
8. Task status badges show correct agent state (Idle, Running, Stalled, Review, Done) — existing `AgentStatusBadge` component must render correctly.
9. Task-type visual differentiation works — Story vs Basic badge rendering must be verified with Rust backend data.
10. `cargo test` passes with unit tests for all new Rust commands.
11. `npm run typecheck` passes with 0 new errors.
12. Deferred items from T1.3 code review are resolved: input validation on title/id/project_id, and replace magic string constants in `create_task`.

## Tasks / Subtasks

- [x] Task 1: Add `specta::Type` to epic entity and implement `list_epics` command (AC: 6)
  - [x] 1.1: Used DTO pattern — `EpicModel` struct in `commands/epic.rs` with `specta::Type` (avoid specta name collision with `task::Model` which is already "Model")
  - [x] 1.2: Created `src-tauri/src/commands/epic.rs` — `list_epics` returns `Vec<EpicModel>`, filters by project_id if non-empty
  - [x] 1.3: Declared `pub mod epic;` in `src-tauri/src/commands/mod.rs`
  - [x] 1.4: Registered `commands::epic::list_epics` in `build_specta_builder()` in `src-tauri/src/lib.rs`
  - [x] 1.5: 3 unit tests in `epic.rs` for serialization/deserialization/From

- [x] Task 2: Expand task commands with full CRUD + input validation (AC: 1–5, 12)
  - [x] 2.1: Added `list_tasks` command (filters by project_id if non-empty, orders by sort_order ASC)
  - [x] 2.2: Added `update_task_status` command (validates status in VALID_TASK_STATUSES)
  - [x] 2.3: Added `reorder_tasks` command (transaction-based batch sort_order updates)
  - [x] 2.4: Added `delete_task` command (find-then-delete pattern)
  - [x] 2.5: Added input validation on `get_task` (id non-empty), `create_task` (title non-empty, project_id non-empty)
  - [x] 2.6: Added `DEFAULT_TASK_STATUS` and `DEFAULT_TASK_TYPE` named constants
  - [x] 2.7: Registered all new commands in `build_specta_builder()`
  - [x] 2.8: Regenerated `src/bindings.ts` via `cargo test generate_bindings -- --ignored`
  - [x] 2.9: 9 unit tests covering all input structs and validation constants

- [x] Task 3: Create TanStack Query wrapper hooks for tauri-specta commands (AC: 7)
  - [x] 3.1: Created `src/hooks/useTaskCommands.ts` with all 5 hooks (list, create, updateStatus, reorder, delete) with optimistic updates
  - [x] 3.2: Created `src/hooks/useEpicCommands.ts` with `useListEpics`
  - [x] 3.3: Updated `src/lib/rspc.ts` to export all new types
  - [x] 3.4: All hooks check `result.status === 'error'` and throw

- [x] Task 4: Migrate KanbanBoardContainer from tRPC to tauri-specta hooks (AC: 1–5, 7–9)
  - [x] 4.1–4.6: All tRPC calls replaced; `trpc` import removed
  - [x] 4.7: Git stubs replaced with `console.warn('Git commands deferred to T1.8')`
  - [x] 4.8: Uses `activeProjectId = ''` fallback (backend returns all tasks/epics when empty)

- [x] Task 5: Migrate CreateTaskDialog from tRPC to tauri-specta hooks (AC: 3–4, 7)
  - [x] 5.1: Replaced `trpc.tasks.create.useMutation()` → `useCreateTask(projectId)`
  - [x] 5.2: Migrated `EpicSelect.tsx` from `trpc.epics.getAll.useQuery()` → `useListEpics(projectId)`
  - [x] 5.3: Removed `trpc` import from `CreateTaskDialog.tsx` and `EpicSelect.tsx`
  - [x] 5.4: Cache key is `['tasks', 'list', projectId]` via `useCreateTask` hook

- [x] Task 6: Fix date serialization in frontend (AC: 1, 11)
  - [x] 6.1–6.3: `transformTask` and `transformEpic` in hooks multiply Unix seconds by 1000

- [x] Task 7: Verify task status badges and type differentiation (AC: 8–9)
  - [x] 7.1–7.4: `transformTask` handles `is_start_here` i32→boolean, `has_merge_conflict` stays as number, `task_type` string cast works with type guards

- [x] Task 8: Write frontend tests (AC: 11)
  - [x] 8.2: Updated `CreateTaskDialog.test.tsx` — mocks `useCreateTask` and `useListEpics` instead of tRPC
  - Note: `KanbanBoardContainer.test.tsx` left for DEV 2 review pass (Task 8.1)

## Dev Notes

### Critical: tauri-specta Result Wrapper Pattern

Every `commands.*` call returns `Promise<{ status: "ok"; data: T } | { status: "error"; error: AppError }>` (see `src/bindings.ts`). Never use the result directly — always check status:

```typescript
const result = await commands.listTasks({ project_id: projectId })
if (result.status === 'error') {
  throw new Error(JSON.stringify(result.error))  // or handle specific error types
}
return result.data  // type-safe T
```

**Not** `const data = await commands.listTasks(...)` — this would assign the wrapper object.

### Critical: Project ID for Task Queries

`list_tasks` requires a `project_id`. In the existing Electron app, tasks were loaded without explicit project scoping in some components. For T1.4:

1. Check if `useProjectStore` (from `src/stores/`) already provides an `activeProjectId` or `selectedProjectId` — grep for `useProjectStore` in the codebase.
2. If yes, use it: `const { activeProjectId } = useProjectStore()`
3. If no active project selector exists yet: use empty string `""` for now which will return all tasks (since the DB may not have project scoping enforced at query level), and track this as a deferred item.

**Do NOT break the existing UX** by requiring project selection before the board loads — if no `activeProjectId` is available, list without filtering (pass a fallback).

### Critical: SeaORM Query Patterns

```rust
// list_tasks — all tasks for a project, sorted
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
let tasks = task::Entity::find()
    .filter(task::Column::ProjectId.eq(&input.project_id))
    .order_by_asc(task::Column::SortOrder)
    .all(db.inner())
    .await?;
Ok(tasks)

// update_task_status — find then update
let existing = task::Entity::find_by_id(&input.id)
    .one(db.inner())
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", input.id)))?;

let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs() as i64)
    .unwrap_or_else(|e| { tracing::warn!("System clock before UNIX_EPOCH: {}", e); 0 });

let updated = task::ActiveModel {
    id: sea_orm::Set(existing.id),
    status: sea_orm::Set(input.status.clone()),
    updated_at: sea_orm::Set(now),
    ..Default::default()
};
Ok(updated.update(db.inner()).await?)

// reorder_tasks — transaction with batch updates
use sea_orm::TransactionTrait;
let txn = db.inner().begin().await?;
for (index, task_id) in input.task_ids.iter().enumerate() {
    let model = task::ActiveModel {
        id: sea_orm::Set(task_id.clone()),
        sort_order: sea_orm::Set(index as i32),
        updated_at: sea_orm::Set(now),
        ..Default::default()
    };
    model.update(&txn).await?;
}
txn.commit().await?;
Ok(())

// delete_task
let existing = task::Entity::find_by_id(&input.id)
    .one(db.inner())
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", input.id)))?;
existing.delete(db.inner()).await?;
Ok(())
```

### Critical: Valid Task Status Values

The DB stores status as raw snake_case strings. The valid values are:

```rust
const VALID_TASK_STATUSES: &[&str] = &[
    "backlog", "create_story", "in_progress", "review", "done"
];

// In update_task_status validation:
if !VALID_TASK_STATUSES.contains(&input.status.as_str()) {
    return Err(AppError::BadRequest(format!("Invalid status: {}", input.status)));
}
```

**⚠️ The `TaskStatus` Rust enum in `src-tauri/src/models/task_status.rs` uses `#[serde(rename_all = "camelCase")]` which would serialize to `"inProgress"` not `"in_progress"`. Do NOT use that enum for DB persistence** — keep raw strings in commands and compare against the constant array above.

### Critical: TanStack Query Cache Key Convention

All task queries use `['tasks', 'list', projectId]` as the query key. All mutations must invalidate or update this key for the optimistic UI to work correctly. Epics use `['epics', 'list', projectId]`.

```typescript
// In useUpdateTaskStatus mutation:
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey: ['tasks', 'list'] })
  const previousTasks = queryClient.getQueryData<task.Model[]>(['tasks', 'list', activeProjectId])
  
  queryClient.setQueryData(['tasks', 'list', activeProjectId], (old: task.Model[] | undefined) => {
    if (!old) return old
    return old.map(t => t.id === input.id ? { ...t, status: input.status } : t)
  })
  return { previousTasks }
},
onError: (err, _vars, context) => {
  if (context?.previousTasks) {
    queryClient.setQueryData(['tasks', 'list', activeProjectId], context.previousTasks)
  }
},
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] })
}
```

### Critical: Date Conversion

The Rust model returns `created_at: i64` (Unix epoch seconds). The TypeScript `Task` type expects `Date`. Apply this transformation in the query hook:

```typescript
const transformTask = (model: Model): Task => ({
  ...model,
  status: model.status as TaskStatus,
  task_type: model.task_type as TaskType,
  is_start_here: model.is_start_here === 1 ? true : model.is_start_here === 0 ? false : null,
  created_at: new Date(model.created_at * 1000),
  updated_at: new Date(model.updated_at * 1000),
  // inline_comments stored as JSON string in DB — parse if non-null:
  inline_comments: model.inline_comments ? JSON.parse(model.inline_comments) : null,
})
```

Apply the same approach for `epic.Model`:

```typescript
const transformEpic = (model: EpicModel): Epic => ({
  ...model,
  color: (model.color ?? 'blue') as EpicColor,
  created_at: new Date(model.created_at * 1000),
})
```

### Critical: lib.rs Registration of New Commands

After adding `list_tasks`, `update_task_status`, `reorder_tasks`, `delete_task`, `list_epics`:

```rust
pub fn build_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::task::get_task,
        commands::task::create_task,
        commands::task::list_tasks,
        commands::task::update_task_status,
        commands::task::reorder_tasks,
        commands::task::delete_task,
        commands::epic::list_epics,
    ])
}
```

Then regenerate `src/bindings.ts` by running:
```bash
cargo test generate_bindings -- --ignored
```

This will add `listTasks`, `updateTaskStatus`, `reorderTasks`, `deleteTask`, `listEpics` to `commands` in `bindings.ts`.

### Critical: tRPC Stubs Remain — Do Not Remove tRPC Packages

Other components still import `trpc` (review, diff, sprint, chat, etc.). **Do NOT remove tRPC packages or the `src/lib/trpc.ts` stub** in T1.4. Only migrate `KanbanBoardContainer.tsx` and `CreateTaskDialog.tsx`. The `trpc` client with `links: []` remains so non-migrated components don't crash (they stay in loading state).

### Architecture Compliance

- **IPC pattern**: tauri-specta `commands.*` ONLY — no raw `invoke()` calls — [Source: architecture.md#API & Communication Patterns]
- **Error type**: `AppError` (not anyhow) in all commands — [Source: architecture.md#Rust Error Handling]
- **Response format**: Direct returns — no `{ success: true, data: ... }` wrapper — [Source: architecture.md#Format Patterns]
- **Naming**: commands = camelCase; DB fields = snake_case; no rename needed since tauri-specta handles this — [Source: architecture.md#rspc Procedure Naming]
- **Tests**: Co-located in `#[cfg(test)]` — [Source: architecture.md#File Co-location Rules]
- **Logging**: `tracing::warn!` not `println!` — [Source: architecture.md#Anti-Patterns]
- **Frontend state**: TanStack Query for server data, Zustand for UI state — [Source: architecture.md#Frontend Architecture]

### T1.3 Learnings (Critical)

- **tauri-specta not rspc**: The project uses `tauri-specta` (from the specta-rs ecosystem) instead of `rspc`, because rspc v1.0.0-rc.5 is incompatible with Tauri v2. The frontend bindings are in `src/bindings.ts` and the client entry point is `src/lib/rspc.ts`.
- **`commands.ts` pattern**: Frontend calls `commands.functionName(input)` from `bindings.ts`. Do NOT use `rspc.useQuery()` hooks — those require the rspc Provider which is not set up.
- **@rspc/react not installed**: `@rspc/react` is deprecated (React 19 peer dep conflict) and not installed. Use raw `@tanstack/react-query` hooks directly.
- **bindings.ts is auto-generated**: Never edit it manually. It's regenerated via `cargo test generate_bindings -- --ignored`.
- **DB timestamps are i64 (seconds)**: Multiply by 1000 to get milliseconds for `new Date()`.
- **epic.rs lacks specta::Type**: The epic entity model has no `specta::Type` derive yet. Must add it for `list_epics` to generate correct TypeScript types.

### T1.3 Deferred Items to Resolve

From `_bmad-output/implementation-artifacts/deferred-work.md`:

1. **No input validation on `CreateTaskInput.title`** — fix in Task 2.5: validate non-empty
2. **No FK existence check for `project_id`** — fix in Task 2.5: validate non-empty string (DB FK constraint handles the rest)
3. **No validation on empty string `id` in `get_task`** — fix in Task 2.5: validate non-empty
4. **Hardcoded magic strings for `status="backlog"` and `task_type="basic"`** — fix in Task 2.6: use named constants

### Project Structure Notes

**Files to create:**
- `src-tauri/src/commands/epic.rs` — new epic command module
- `src/hooks/useTaskCommands.ts` — TanStack Query wrappers for task commands
- `src/hooks/useEpicCommands.ts` — TanStack Query wrapper for epic commands

**Files to modify:**
- `src-tauri/src/db/entities/epic.rs` — add `specta::Type`
- `src-tauri/src/commands/task.rs` — add list_tasks, update_task_status, reorder_tasks, delete_task + input validation
- `src-tauri/src/commands/mod.rs` — add `pub mod epic;`
- `src-tauri/src/lib.rs` — register new commands in builder
- `src/bindings.ts` — regenerated (auto-generated, not manual edit)
- `src/lib/rspc.ts` — export new types
- `src/components/board/KanbanBoardContainer.tsx` — migrate from tRPC
- `src/components/task/CreateTaskDialog.tsx` — migrate from tRPC
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — update t1-4 status
- `_bmad-output/implementation-artifacts/deferred-work.md` — remove resolved items

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story T1.4] — Acceptance criteria and story context
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — tauri-specta command pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] — error handling, response format
- [Source: _bmad-output/implementation-artifacts/t1-3-implement-type-safe-ipc-command-layer.md] — T1.3 implementation decisions, tauri-specta vs rspc choice
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — T1.3 deferred validation items
- [Source: src-tauri/src/commands/task.rs] — existing get_task + create_task to extend
- [Source: src/components/board/KanbanBoardContainer.tsx] — component to migrate
- [Source: src/components/task/CreateTaskDialog.tsx] — component to migrate
- [Source: src/bindings.ts] — current auto-generated types (shows typedError wrapper pattern)

### Review Findings

- [x] [Review][Patch] `inline_comments` JSON.parse without try/catch crashes hook on malformed DB data [`src/hooks/useTaskCommands.ts:18`] — **Fixed**: wrapped in try/catch, returns null on parse failure
- [x] [Review][Patch] `KanbanBoardContainer.test.tsx` still mocked tRPC; tests would fail with new hooks [`src/components/board/KanbanBoardContainer.test.tsx`] — **Fixed**: replaced tRPC mock with `useTaskCommands`/`useEpicCommands` mocks + mocked remaining tRPC-using dialogs; all 25 tests pass
- [x] [Review][Defer] `CreateTaskDialog` silently drops description/status/epicId/sprintId from mutation [`src/components/task/CreateTaskDialog.tsx:65`] — deferred, pre-existing (noted in story completion notes; blocked on future expansion of `CreateTaskInput`)
- [x] [Review][Defer] `activeProjectId = ''` hardcoded — backend returns all tasks, no project scoping [`src/components/board/KanbanBoardContainer.tsx:25`] — deferred, pre-existing (blocked on project UUID resolution, deferred to T1.5 or store migration)
- [x] [Review][Defer] `reorder_tasks` doesn't validate task_ids belong to the project [`src-tauri/src/commands/task.rs:170`] — deferred, security concern out of scope for T1.4; document for T1.8 Git/security hardening story
- [x] [Review][Defer] `now_unix_secs()` returns 0 on system clock before UNIX_EPOCH [`src-tauri/src/commands/task.rs:56`] — deferred, pre-existing acceptable fallback with `tracing::warn!`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- specta name collision "Model": `task::Model` and `epic::Model` both generate TypeScript type "Model". Resolved with DTO pattern — `EpicModel` struct in `commands/epic.rs`, no `specta::Type` on entity.
- `#[specta(rename)]` deprecated in rc.24: Use `#[serde(rename)]` or just rename the struct. Final solution: rename the DTO.
- Empty `project_id` fallback: `useProjectStore` only has `projectPath`, no UUID. Backend returns all tasks/epics when project_id is `""`.

### Completion Notes List

- `create_task` command only accepts `title` + `project_id`. Description, status, epic_id, sprint_id fields in `CreateTaskDialog` remain in UI but are not yet persisted — deferred to a future story that expands `CreateTaskInput`.
- `KanbanBoardContainer.test.tsx` was left un-updated (Task 8.1 not done); it may still mock tRPC. Left for DEV 2 review pass.
- `EpicSelect.tsx` was also migrated (not explicitly listed in story Tasks but required by Task 5.2).

### File List

- `src-tauri/src/commands/epic.rs` — new (EpicModel DTO, list_epics command, 3 unit tests)
- `src-tauri/src/commands/mod.rs` — added `pub mod epic;`
- `src-tauri/src/commands/task.rs` — full rewrite with list_tasks, update_task_status, reorder_tasks, delete_task, input validation, constants, 9 unit tests
- `src-tauri/src/lib.rs` — registered all new commands in build_specta_builder
- `src/bindings.ts` — regenerated (auto-generated by tauri-specta)
- `src/lib/rspc.ts` — exports all new types from bindings
- `src/hooks/useTaskCommands.ts` — new (5 TanStack Query hooks with optimistic updates)
- `src/hooks/useEpicCommands.ts` — new (useListEpics hook)
- `src/components/board/KanbanBoardContainer.tsx` — migrated from tRPC to tauri-specta hooks
- `src/components/task/CreateTaskDialog.tsx` — migrated from tRPC to tauri-specta hooks
- `src/components/task/EpicSelect.tsx` — migrated from tRPC to useListEpics
- `src/components/task/CreateTaskDialog.test.tsx` — updated mocks for new hooks
- `src/components/board/KanbanBoardContainer.test.tsx` — DEV 2: updated mocks (tRPC → useTaskCommands/useEpicCommands hooks + dialog mocks); all 25 tests pass
- `src/hooks/useTaskCommands.ts` — DEV 2: added try/catch around inline_comments JSON.parse
- `_bmad-output/implementation-artifacts/t1-4-migrate-task-crud-commands.md` — this file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — t1-4 status: done
- `_bmad-output/implementation-artifacts/deferred-work.md` — removed resolved T1.3 items
