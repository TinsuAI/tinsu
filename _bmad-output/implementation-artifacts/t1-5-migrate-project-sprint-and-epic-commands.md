# Story T1.5: Migrate Project, Sprint, and Epic Commands

Status: review

## Story

As a founder,
I want to organize tasks into sprints and epics, switch between projects, and view velocity metrics — all powered by the Rust backend,
So that the full project/sprint/epic hierarchy works in the Tauri app.

## Acceptance Criteria

1. Sprint CRUD commands (`list_sprints`, `create_sprint`, `update_sprint`, `update_sprint_status`, `delete_sprint`, `get_active_sprint`) exist in Rust and are registered via tauri-specta.
2. Epic mutation commands (`create_epic`, `update_epic`, `delete_epic`) exist in Rust alongside the existing `list_epics`.
3. Project commands (`list_recent_projects`, `validate_project_path`, `open_project_by_path`, `remove_project`, `open_project_dialog`, `select_parent_directory`, `create_project`) exist in Rust using `tauri-plugin-dialog` for native file pickers.
4. A `get_weekly_velocity` command returns tasks completed per week (last N weeks) for the velocity widget.
5. `src/hooks/useSprintCommands.ts` provides TanStack Query hooks wrapping all sprint commands.
6. `src/hooks/useEpicCommands.ts` is extended with hooks for `createEpic`, `updateEpic`, `deleteEpic`.
7. `src/hooks/useProjectCommands.ts` provides TanStack Query hooks wrapping all project commands.
8. `SprintList.tsx`, `SprintForm.tsx`, `SprintSelect.tsx` are migrated from `trpc.sprints.*` to tauri-specta hooks. No `trpc` import remains in these files.
9. `ProjectSwitcher.tsx` and `ProjectSetupDialog.tsx` are migrated from `trpc.project.*` to tauri-specta hooks. No `trpc` import remains in these files.
10. `FilterPanel.tsx` is migrated from `trpc.epics.getAll` / `trpc.sprints.getAll` to tauri-specta hooks.
11. `VelocityWidget.tsx` and `VelocityDetailPanel.tsx` are migrated from `trpc.velocity.getWeeklyVelocity` to the new `get_weekly_velocity` command.
12. `useProjectStore` gains `activeProjectId: string | null` and `setProjectId(id: string | null)`, set when a project is opened.
13. `KanbanBoardContainer.tsx` uses the real `activeProjectId` from `useProjectStore` (resolves the T1.4 deferred item — no more hardcoded `''`).
14. `cargo test` passes with unit tests for all new Rust command modules.
15. `npm run typecheck` passes with 0 new errors.
16. `src/bindings.ts` is regenerated via `cargo test generate_bindings -- --ignored` after all commands are registered.

## Tasks / Subtasks

- [x] Task 1: Add `tauri-plugin-dialog` dependency for native file pickers (AC: 3)
  - [x] 1.1: Add `tauri-plugin-dialog = "2"` to `[dependencies]` in `src-tauri/Cargo.toml`
  - [x] 1.2: Add `tauri-plugin-dialog` to `.plugins` in `src-tauri/src/lib.rs` `tauri::Builder`:
    ```rust
    .plugin(tauri_plugin_dialog::init())
    ```
  - [x] 1.3: Add `"dialog"` plugin to `tauri.conf.json` under `plugins` if required by plugin version (check docs)
  - [x] 1.4: Add `"dialog:open"` and `"dialog:default"` permissions to `capabilities` config if needed
  - [x] 1.5: `npm add @tauri-apps/plugin-dialog` to add TypeScript bindings for the dialog plugin

- [x] Task 2: Implement Sprint Rust commands in `src-tauri/src/commands/sprint.rs` (AC: 1, 14)
  - [x] 2.1: Define `SprintModel` DTO (avoids specta name collision with `sprint::Model`):
    ```rust
    #[derive(Debug, Serialize, Deserialize, Type)]
    pub struct SprintModel {
        pub id: String,
        pub name: String,
        pub start_date: Option<String>,
        pub end_date: Option<String>,
        pub status: String,
        pub goal: Option<String>,
        pub velocity: Option<i32>,
        pub capacity: Option<i32>,
        pub project_id: String,
        pub story_prefix: Option<String>,
        pub epics_file_path: Option<String>,
        pub created_at: i64,
    }
    ```
  - [x] 2.2: Define `From<sprint::Model> for SprintModel` conversion
  - [x] 2.3: Define valid sprint status constant:
    ```rust
    const VALID_SPRINT_STATUSES: &[&str] = &["planning", "active", "completed"];
    ```
  - [x] 2.4: Implement `list_sprints(project_id: String)` — returns all sprints for project, ordered by `created_at ASC`; if project_id empty, returns all
  - [x] 2.5: Implement `create_sprint(name, goal?, status, start_date?, end_date?, project_id)` — validates name non-empty, status valid, project_id non-empty; generates UUID id, sets created_at
  - [x] 2.6: Implement `update_sprint(id, name, goal?, start_date?, end_date?)` — find-then-update pattern; validates id and name non-empty
  - [x] 2.7: Implement `update_sprint_status(id, status)` — validates status in VALID_SPRINT_STATUSES
  - [x] 2.8: Implement `delete_sprint(id)` — find-then-delete; validates id non-empty
  - [x] 2.9: Implement `get_active_sprint(project_id: String)` — returns `Option<SprintModel>` for first sprint with status "active" in project
  - [x] 2.10: Write unit tests (≥5): input struct serialization, From conversion, status validation constant

- [x] Task 3: Extend Epic commands in `src-tauri/src/commands/epic.rs` (AC: 2, 14)
  - [x] 3.1: Define `CreateEpicInput` struct with fields: `title: String`, `description: Option<String>`, `color: Option<String>`, `epic_number: Option<i32>`, `goal: Option<String>`, `sprint_id: Option<String>`, `project_id: String`
  - [x] 3.2: Implement `create_epic(input: CreateEpicInput)` — validates title non-empty, project_id non-empty; generates UUID id, sets created_at; returns `EpicModel`
  - [x] 3.3: Define `UpdateEpicInput` struct with fields: `id: String`, `title: String`, `description: Option<String>`, `color: Option<String>`, `goal: Option<String>`, `sprint_id: Option<String>`
  - [x] 3.4: Implement `update_epic(input: UpdateEpicInput)` — find-then-update pattern; validates id non-empty, title non-empty; returns `EpicModel`
  - [x] 3.5: Define `DeleteEpicInput { id: String }`
  - [x] 3.6: Implement `delete_epic(input: DeleteEpicInput)` — find-then-delete; validates id non-empty
  - [x] 3.7: Write unit tests (≥3) for new input structs

- [x] Task 4: Implement Project Rust commands in `src-tauri/src/commands/project.rs` (AC: 3, 14)
  - [x] 4.1: Create `src-tauri/src/commands/project.rs`
  - [x] 4.2: Define `ProjectModel` DTO:
    ```rust
    #[derive(Debug, Serialize, Deserialize, Type)]
    pub struct ProjectModel {
        pub id: String,
        pub path: String,
        pub name: String,
        pub created_at: i64,
        pub last_opened_at: Option<i64>,
    }
    ```
  - [x] 4.3: Implement `list_recent_projects(limit: u64)` — returns projects ordered by `last_opened_at DESC NULLS LAST, created_at DESC`, capped at limit
  - [x] 4.4: Implement `validate_project_path(path: String)` — returns `bool`: checks `std::path::Path::new(&path).is_dir()` and `.tinsu/config.yaml` exists
  - [x] 4.5: Implement `open_project_by_path(path: String)` — reads `.tinsu/config.yaml` to get project name, upserts project record in DB, updates `last_opened_at`, returns `ProjectModel`
  - [x] 4.6: Implement `remove_project(id: String)` — deletes project from DB (does NOT delete files)
  - [x] 4.7: Implement `open_project_dialog()` — uses `tauri_plugin_dialog::DialogExt` to show folder picker:
    ```rust
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().pick_folder().blocking_pick();
    ```
    Returns `Option<ProjectModel>` (None if dialog cancelled); if folder selected, calls `open_project_by_path` logic internally.
  - [x] 4.8: Implement `select_parent_directory()` — shows folder picker, returns `Option<String>` (the selected path or None if cancelled)
  - [x] 4.9: Implement `create_project(parent_dir: String, project_name: String)` — creates `{parent_dir}/{project_name}` directory, runs `git init`, writes `.tinsu/config.yaml` with project name + methodology "bmad", creates project record in DB, returns `ProjectModel`
    ```yaml
    # .tinsu/config.yaml format:
    projectName: "{project_name}"
    methodology: "bmad"
    ```
  - [x] 4.10: Write unit tests (≥3) for input struct serialization and ProjectModel From conversion

- [x] Task 5: Implement Velocity command in `src-tauri/src/commands/task.rs` (AC: 4, 14)
  - [x] 5.1: Define `GetWeeklyVelocityInput { weeks: u32, project_id: String }` in `task.rs`
  - [x] 5.2: Define `WeeklyVelocityData { total_completed: u32, weeks: Vec<WeekBucket> }` and `WeekBucket { week_label: String, count: u32 }` (both with `Type`)
  - [x] 5.3: Implement `get_weekly_velocity(input)` — queries tasks where `status = 'done'` and `updated_at >= (now - weeks*7 days as unix seconds)`, groups by ISO week (STRFTIME('%Y-W%W', datetime(updated_at, 'unixepoch'))), returns `WeeklyVelocityData`
  - [x] 5.4: Write unit tests (≥2) for input/output struct serialization

- [x] Task 6: Register all new commands in `src-tauri/src/lib.rs` + regenerate bindings (AC: 16)
  - [x] 6.1: Add `pub mod project;` to `src-tauri/src/commands/mod.rs`
  - [x] 6.2: Register all new commands in `build_specta_builder()`:
    ```rust
    collect_commands![
        // existing
        commands::task::get_task,
        commands::task::create_task,
        commands::task::list_tasks,
        commands::task::update_task_status,
        commands::task::reorder_tasks,
        commands::task::delete_task,
        commands::task::get_weekly_velocity,
        commands::epic::list_epics,
        commands::epic::create_epic,
        commands::epic::update_epic,
        commands::epic::delete_epic,
        commands::sprint::list_sprints,
        commands::sprint::create_sprint,
        commands::sprint::update_sprint,
        commands::sprint::update_sprint_status,
        commands::sprint::delete_sprint,
        commands::sprint::get_active_sprint,
        commands::project::list_recent_projects,
        commands::project::validate_project_path,
        commands::project::open_project_by_path,
        commands::project::remove_project,
        commands::project::open_project_dialog,
        commands::project::select_parent_directory,
        commands::project::create_project,
    ]
    ```
  - [x] 6.3: Add `.plugin(tauri_plugin_dialog::init())` to `tauri::Builder` chain in `lib.rs`
  - [x] 6.4: Regenerate `src/bindings.ts`:
    ```bash
    cargo test generate_bindings -- --ignored
    ```

- [x] Task 7: Create `src/hooks/useSprintCommands.ts` (AC: 5)
  - [x] 7.1: Implement `useListSprints(projectId: string)` — TanStack Query, key `['sprints', 'list', projectId]`, transforms `created_at` (seconds → `new Date(created_at * 1000)`)
  - [x] 7.2: Implement `useCreateSprint(projectId)` — mutation, invalidates `['sprints', 'list']`
  - [x] 7.3: Implement `useUpdateSprint()` — mutation, invalidates `['sprints', 'list']`
  - [x] 7.4: Implement `useUpdateSprintStatus()` — mutation, invalidates `['sprints', 'list']`
  - [x] 7.5: Implement `useDeleteSprint()` — mutation, invalidates `['sprints', 'list']`
  - [x] 7.6: Implement `useGetActiveSprint(projectId)` — TanStack Query, key `['sprints', 'active', projectId]`
  - [x] 7.7: All hooks check `result.status === 'error'` and throw (same pattern as `useTaskCommands.ts`)

- [x] Task 8: Extend `src/hooks/useEpicCommands.ts` (AC: 6)
  - [x] 8.1: Add `useCreateEpic(projectId)` — mutation, invalidates `['epics', 'list']`
  - [x] 8.2: Add `useUpdateEpic()` — mutation, invalidates `['epics', 'list']`
  - [x] 8.3: Add `useDeleteEpic()` — mutation, invalidates `['epics', 'list']`
  - [x] 8.4: Update exports in `src/lib/rspc.ts`

- [x] Task 9: Create `src/hooks/useProjectCommands.ts` (AC: 7)
  - [x] 9.1: Implement `useListRecentProjects(limit?, enabled?)` — TanStack Query, key `['projects', 'recent']`
  - [x] 9.2: Implement `useValidateProjectPath(path)` — TanStack Query, key `['projects', 'validate', path]`, staleTime 60000ms; only runs when path is non-empty
  - [x] 9.3: Implement `useOpenProjectByPath()` — mutation
  - [x] 9.4: Implement `useRemoveProject()` — mutation, invalidates `['projects', 'recent']`
  - [x] 9.5: Implement `useOpenProjectDialog()` — mutation (returns `ProjectModel | null`)
  - [x] 9.6: Implement `useSelectParentDirectory()` — mutation (returns `string | null`)
  - [x] 9.7: Implement `useCreateProject()` — mutation

- [x] Task 10: Update `src/stores/project.store.ts` (AC: 12)
  - [x] 10.1: Add `activeProjectId: string | null` to `ProjectState` interface
  - [x] 10.2: Add `setProjectId: (id: string | null) => void` action
  - [x] 10.3: Initialize `activeProjectId: null` in store state
  - [x] 10.4: Update `setProject` to also accept `id` parameter: `setProject: (id: string, path: string, name: string) => void`
  - [x] 10.5: Update `clearProject` to also reset `activeProjectId: null`
  - [x] 10.6: Keep `partialize` persisting only `projectPath` (not id — id is resolved fresh from DB on open)

- [x] Task 11: Migrate sprint components from tRPC to hooks (AC: 8)
  - [x] 11.1: `SprintList.tsx` — replace `trpc.sprints.getAll.useQuery()` → `useListSprints(activeProjectId ?? '')` (import from `useSprintCommands`); replace `trpc.sprints.delete.useMutation()` → `useDeleteSprint()`; remove `trpc.useUtils()` and `utils.sprints.getAll.invalidate()` (TanStack Query invalidation is in the hook); remove `trpc` import
  - [x] 11.2: `SprintForm.tsx` — replace `trpc.sprints.create`, `trpc.sprints.update`, `trpc.sprints.updateStatus` → `useCreateSprint`, `useUpdateSprint`, `useUpdateSprintStatus`; remove `trpc.useUtils()` and manual invalidation; remove `trpc` import; update date types: `start_date`/`end_date` stay as `string | null` (stored as ISO strings in DB, no `Date` transformation needed)
  - [x] 11.3: `SprintSelect.tsx` — replace `trpc.sprints.getAll.useQuery()` → `useListSprints(activeProjectId ?? '')`; remove `trpc` import

- [x] Task 12: Migrate project components from tRPC to hooks (AC: 9)
  - [x] 12.1: `ProjectSwitcher.tsx` — replace all `trpc.project.*` calls:
    - `trpc.project.getRecent.useQuery` → `useListRecentProjects(10, open)`
    - `trpc.useQueries` (validatePath) → `useValidateProjectPath` per path (or a single batch command)
    - `trpc.project.openPath.useMutation` → `useOpenProjectByPath()`; on success: `setProject(result.id, result.path, result.name)`
    - `trpc.project.remove.useMutation` → `useRemoveProject()`
    - `trpc.project.open.useMutation` → `useOpenProjectDialog()`; on success: `setProject(result.id, result.path, result.name)` if result non-null
    - Remove `trpc` import; remove `utils.invalidate()` (hooks invalidate automatically)
  - [x] 12.2: `ProjectSetupDialog.tsx` — replace:
    - `trpc.project.selectParentDirectory.useMutation` → `useSelectParentDirectory()`
    - `trpc.project.create.useMutation` → `useCreateProject()`; on success: `setCreatedProjectPath(result.path)` and `setCreatedProjectId(result.id)`; remove `trpc` import
  - [x] 12.3: Note: `ToolVerificationStep.tsx` uses `trpc.project.verifyTools` and `trpc.bmad.*` — these are NOT in scope for T1.5 (defer to T1.9/config story). Leave `trpc` import in `ToolVerificationStep.tsx` intact.

- [x] Task 13: Migrate FilterPanel, VelocityWidget from tRPC to hooks (AC: 10, 11)
  - [x] 13.1: `FilterPanel.tsx` — replace `trpc.epics.getAll.useQuery()` → `useListEpics(activeProjectId ?? '')`; replace `trpc.sprints.getAll.useQuery()` → `useListSprints(activeProjectId ?? '')`; remove `trpc` import
  - [x] 13.2: `VelocityWidget.tsx` — replace `trpc.velocity.getWeeklyVelocity.useQuery({ weeks: 4 })` → TanStack `useQuery` calling `commands.getWeeklyVelocity({ weeks: 4, project_id: '' })`; adapt result shape to match existing UI (`totalCompleted`, `weeks` with `count`)
  - [x] 13.3: `VelocityDetailPanel.tsx` — same migration as above with `weeks: 8`
  - [x] 13.4: Remove `trpc` import from both velocity components

- [x] Task 14: Fix `activeProjectId` in KanbanBoardContainer (AC: 13)
  - [x] 14.1: Import `useProjectStore` in `KanbanBoardContainer.tsx`
  - [x] 14.2: Replace hardcoded `const activeProjectId = ''` with:
    ```typescript
    const activeProjectId = useProjectStore((state) => state.activeProjectId) ?? ''
    ```
  - [x] 14.3: Pass `activeProjectId` to `useListTasks(activeProjectId)` and `useListEpics(activeProjectId)` hooks

- [x] Task 15: Update `src/lib/rspc.ts` exports (AC: 6, 16)
  - [x] 15.1: Export all new input types from bindings: `SprintModel`, `ListSprintsInput`, `CreateSprintInput`, `UpdateSprintInput`, `UpdateSprintStatusInput`, `DeleteSprintInput`, `CreateEpicInput`, `UpdateEpicInput`, `DeleteEpicInput`, `ProjectModel`, `ListRecentProjectsInput`, `WeeklyVelocityData`, etc.

- [x] Task 16: Write frontend tests (AC: 15)
  - [x] 16.1: Update any test files for migrated components that previously mocked `trpc` — mock the new hooks instead (same pattern as `CreateTaskDialog.test.tsx` from T1.4 — mock `useSprintCommands`/`useProjectCommands`/`useEpicCommands`)
  - [x] 16.2: Focus on `SprintList.test.tsx` and `SprintForm.test.tsx` if they exist; if not, create minimal render tests verifying hooks are called

## Dev Notes

### Critical: tauri-specta Result Wrapper Pattern (same as T1.4)

Every `commands.*` call returns `Promise<{ status: "ok"; data: T } | { status: "error"; error: AppError }>`. Always check status before using data:

```typescript
const result = await commands.listSprints({ project_id: projectId })
if (result.status === 'error') {
  throw new Error(JSON.stringify(result.error))
}
return result.data  // SprintModel[]
```

### Critical: SprintModel DTO (avoids specta name collision)

Just like T1.4 used `EpicModel` (not `epic::Model`) to avoid specta generating duplicate "Model" TypeScript type, sprint.rs MUST define `SprintModel` DTO (not use `sprint::Model` directly). The pattern:

```rust
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SprintModel { ... }

impl From<sprint::Model> for SprintModel {
    fn from(m: sprint::Model) -> Self { ... }
}
```

### Critical: Sprint Date Format

Sprint dates (`start_date`, `end_date`) are stored in the DB as `Option<String>` in ISO format "YYYY-MM-DD" (e.g., "2026-04-12"). They are NOT Unix timestamps. No multiplication by 1000 needed. The TypeScript type is `string | null`. The existing `SprintList.tsx` and `SprintForm.tsx` pass them directly to `new Date(sprint.start_date)` — this works fine with ISO strings.

**Do NOT convert sprint dates to i64 — keep as `Option<String>`.**

### Critical: SeaORM Patterns for Sprint CRUD

```rust
// list_sprints
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
let sprints = sprint::Entity::find()
    .filter(sprint::Column::ProjectId.eq(&input.project_id))
    .order_by_asc(sprint::Column::CreatedAt)
    .all(db.inner())
    .await?;

// create_sprint
let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs() as i64)
    .unwrap_or_else(|e| { tracing::warn!("System clock before UNIX_EPOCH: {}", e); 0 });

let sprint = sprint::ActiveModel {
    id: sea_orm::Set(uuid::Uuid::new_v4().to_string()),
    name: sea_orm::Set(input.name.clone()),
    status: sea_orm::Set(input.status.clone()),
    goal: sea_orm::Set(input.goal.clone()),
    start_date: sea_orm::Set(input.start_date.clone()),
    end_date: sea_orm::Set(input.end_date.clone()),
    project_id: sea_orm::Set(input.project_id.clone()),
    velocity: sea_orm::Set(None),
    capacity: sea_orm::Set(None),
    story_prefix: sea_orm::Set(None),
    epics_file_path: sea_orm::Set(None),
    created_at: sea_orm::Set(now),
};
let result = sprint.insert(db.inner()).await?;

// update_sprint — find-then-update
let existing = sprint::Entity::find_by_id(&input.id)
    .one(db.inner())
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Sprint {} not found", input.id)))?;

let updated = sprint::ActiveModel {
    id: sea_orm::Set(existing.id),
    name: sea_orm::Set(input.name.clone()),
    goal: sea_orm::Set(input.goal.clone()),
    start_date: sea_orm::Set(input.start_date.clone()),
    end_date: sea_orm::Set(input.end_date.clone()),
    ..Default::default()  // keep other fields unchanged
};
updated.update(db.inner()).await?;
```

### Critical: `tauri-plugin-dialog` for File Pickers

The `open_project_dialog` and `select_parent_directory` commands need the dialog plugin. In Rust:

```rust
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
#[specta::specta]
pub async fn open_project_dialog(
    app: AppHandle,
    db: State<'_, DatabaseConnection>,
) -> Result<Option<ProjectModel>, AppError> {
    let folder = app.dialog()
        .file()
        .pick_folder()
        .blocking_pick();  // Returns Option<FilePath>

    match folder {
        None => Ok(None),  // User cancelled
        Some(file_path) => {
            let path = file_path.to_string_lossy().to_string();
            // Read config and upsert project — same logic as open_project_by_path
            let model = open_project_by_path_impl(&path, &db).await?;
            Ok(Some(model))
        }
    }
}
```

**Note:** `AppHandle` must be the first parameter after `app` for tauri-specta commands. Add it before `State<_>` parameters.

### Critical: Reading `.tinsu/config.yaml`

The project config YAML format (used by `open_project_by_path` and `open_project_dialog`):

```yaml
projectName: "MyProject"
methodology: "bmad"
```

Read with Rust's `std::fs::read_to_string` + a minimal YAML parser. Use `serde_yaml` if available, or parse manually:

```rust
// Add serde_yaml to Cargo.toml if not present: serde_yaml = "0.9"
let config_path = format!("{}/.tinsu/config.yaml", path);
let content = std::fs::read_to_string(&config_path)
    .map_err(|_| AppError::NotFound(format!("No .tinsu/config.yaml at {}", path)))?;

#[derive(serde::Deserialize)]
struct TinsuConfig {
    #[serde(rename = "projectName")]
    project_name: String,
}
let config: TinsuConfig = serde_yaml::from_str(&content)
    .map_err(|e| AppError::Internal(format!("Invalid config.yaml: {}", e)))?;
```

If `serde_yaml` is too heavy, use a simple string search for "projectName:" as a fallback.

### Critical: Project Upsert Logic

For `open_project_by_path`, upsert the project in the DB (insert if path doesn't exist, update `last_opened_at` if it does):

```rust
// Check if project exists by path
let existing = project::Entity::find()
    .filter(project::Column::Path.eq(&path))
    .one(db.inner())
    .await?;

let now = now_unix_secs();

let model = match existing {
    Some(p) => {
        // Update last_opened_at
        let updated = project::ActiveModel {
            id: sea_orm::Set(p.id.clone()),
            last_opened_at: sea_orm::Set(Some(now)),
            ..Default::default()
        };
        updated.update(db.inner()).await?
    }
    None => {
        // Insert new project
        let new = project::ActiveModel {
            id: sea_orm::Set(uuid::Uuid::new_v4().to_string()),
            path: sea_orm::Set(path.clone()),
            name: sea_orm::Set(project_name),
            created_at: sea_orm::Set(now),
            last_opened_at: sea_orm::Set(Some(now)),
        };
        new.insert(db.inner()).await?
    }
};
Ok(ProjectModel::from(model))
```

### Critical: `create_project` Rust Implementation

```rust
use std::process::Command;

pub async fn create_project(
    db: State<'_, DatabaseConnection>,
    parent_dir: String,
    project_name: String,
) -> Result<ProjectModel, AppError> {
    // 1. Create directory
    let project_path = format!("{}/{}", parent_dir, project_name);
    std::fs::create_dir_all(&project_path)
        .map_err(|e| AppError::Internal(format!("Failed to create dir: {}", e)))?;

    // 2. Git init
    let output = Command::new("git")
        .arg("init")
        .current_dir(&project_path)
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run git init: {}", e)))?;
    if !output.status.success() {
        return Err(AppError::Internal("git init failed".to_string()));
    }

    // 3. Write .tinsu/config.yaml
    let tinsu_dir = format!("{}/.tinsu", project_path);
    std::fs::create_dir_all(&tinsu_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create .tinsu dir: {}", e)))?;
    let config = format!("projectName: \"{}\"\nmethodology: \"bmad\"\n", project_name);
    std::fs::write(format!("{}/config.yaml", tinsu_dir), config)
        .map_err(|e| AppError::Internal(format!("Failed to write config: {}", e)))?;

    // 4. Insert project into DB
    let now = now_unix_secs();
    let new = project::ActiveModel {
        id: sea_orm::Set(uuid::Uuid::new_v4().to_string()),
        path: sea_orm::Set(project_path),
        name: sea_orm::Set(project_name),
        created_at: sea_orm::Set(now),
        last_opened_at: sea_orm::Set(Some(now)),
    };
    let result = new.insert(db.inner()).await?;
    Ok(ProjectModel::from(result))
}
```

### Critical: Velocity Query (SQLite raw aggregation)

The velocity command needs SQL aggregation by week. SeaORM doesn't have a built-in week grouping, so use a raw SQL query:

```rust
use sea_orm::{Statement, ConnectionTrait, DbBackend};

let weeks_ago_ts = now - (input.weeks as i64 * 7 * 24 * 3600);
let stmt = Statement::from_sql_and_values(
    DbBackend::Sqlite,
    r#"
    SELECT
        strftime('%Y-W%W', datetime(updated_at, 'unixepoch')) as week_label,
        COUNT(*) as count
    FROM tasks
    WHERE status = 'done'
      AND updated_at >= ?1
    GROUP BY week_label
    ORDER BY week_label ASC
    "#,
    [weeks_ago_ts.into()],
);
let rows = db.inner().query_all(stmt).await?;
```

### Critical: TanStack Query Cache Key Convention

```
['sprints', 'list', projectId]   — all sprints for a project
['sprints', 'active', projectId] — active sprint for a project
['epics', 'list', projectId]     — all epics for a project (established in T1.4)
['projects', 'recent']           — recent projects list
['projects', 'validate', path]   — path validation
```

All mutations should invalidate the corresponding list query:
- Sprint mutations → `queryClient.invalidateQueries({ queryKey: ['sprints', 'list'] })`
- Epic mutations → `queryClient.invalidateQueries({ queryKey: ['epics', 'list'] })`
- Project mutations → `queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] })`

### Critical: Architecture Compliance

- **IPC pattern**: `commands.*` (tauri-specta) ONLY — no raw `invoke()` calls [Source: architecture.md#API & Communication Patterns]
- **Error type**: `AppError` (not anyhow) in all commands [Source: architecture.md#Rust Error Handling]
- **Logging**: `tracing::warn!` not `println!` [Source: architecture.md#Anti-Patterns]
- **Frontend state**: TanStack Query for server data, Zustand for UI state [Source: architecture.md#Frontend Architecture]
- **Tests**: Co-located `#[cfg(test)]` modules in Rust [Source: architecture.md#File Co-location Rules]
- **tRPC imports**: Do NOT remove `trpc` from `ToolVerificationStep.tsx` or other components not in this story's scope — many still need it

### Critical: Do NOT Remove tRPC from Non-Migrated Components

Many components still use tRPC (activity, agent, review, git, chat, planning, etc.). Leave all non-targeted components unchanged. Only remove `trpc` from the specifically listed components in Tasks 11-13.

The `trpc` client with `links: []` in `src/lib/trpc.ts` must remain so non-migrated components don't crash.

### Deferred Items to Resolve (from T1.4)

- **`activeProjectId = ''` hardcoded in KanbanBoardContainer**: Fixed in Task 14 of this story
- **CreateTaskDialog silently drops description/status/epicId/sprintId**: Remains deferred (blocked on `CreateTaskInput` expansion — consider in a future story or T1.5 stretch goal)
- **`AppError` missing `From` impls for serde/tokio errors**: Add `From<serde_yaml::Error>` and `From<serde_json::Error>` if using serde_yaml for config parsing [Source: deferred-work.md]

### Project Structure Notes

**Rust files to create:**
- `src-tauri/src/commands/project.rs` — new project command module

**Rust files to modify:**
- `src-tauri/src/commands/sprint.rs` — implement from stub
- `src-tauri/src/commands/epic.rs` — add create_epic, update_epic, delete_epic
- `src-tauri/src/commands/task.rs` — add get_weekly_velocity
- `src-tauri/src/commands/mod.rs` — add `pub mod project;`
- `src-tauri/src/lib.rs` — register all new commands + add dialog plugin
- `src-tauri/Cargo.toml` — add `tauri-plugin-dialog = "2"` and `serde_yaml = "0.9"`

**TypeScript files to create:**
- `src/hooks/useSprintCommands.ts` — TanStack Query hooks for sprint
- `src/hooks/useProjectCommands.ts` — TanStack Query hooks for project

**TypeScript files to modify:**
- `src/hooks/useEpicCommands.ts` — add create/update/delete
- `src/stores/project.store.ts` — add activeProjectId
- `src/lib/rspc.ts` — export new types
- `src/bindings.ts` — auto-regenerated (do not edit manually)
- `src/components/sidebar/SprintList.tsx` — migrate from tRPC
- `src/components/sprint/SprintForm.tsx` — migrate from tRPC
- `src/components/task/SprintSelect.tsx` — migrate from tRPC
- `src/components/project/ProjectSwitcher.tsx` — migrate from tRPC
- `src/components/ProjectSetupDialog.tsx` — migrate from tRPC
- `src/components/filter/FilterPanel.tsx` — migrate from tRPC
- `src/components/velocity/VelocityWidget.tsx` — migrate from tRPC
- `src/components/velocity/VelocityDetailPanel.tsx` — migrate from tRPC
- `src/components/board/KanbanBoardContainer.tsx` — fix activeProjectId
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — update t1-5 status

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story T1.5] — Acceptance criteria and story context
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md#Phase 1] — Tauri migration plan and T1.5 scope
- [Source: _bmad-output/implementation-artifacts/t1-4-migrate-task-crud-commands.md] — T1.4 patterns (DTO, hooks, Result wrapper, cache keys)
- [Source: src-tauri/src/commands/epic.rs] — EpicModel DTO pattern to replicate for SprintModel/ProjectModel
- [Source: src-tauri/src/commands/task.rs] — existing task command patterns (validation, SeaORM queries, now_unix_secs)
- [Source: src-tauri/src/db/entities/sprint.rs] — Sprint entity fields (note: dates are Option<String>)
- [Source: src-tauri/src/db/entities/project.rs] — Project entity fields
- [Source: src-tauri/src/db/entities/epic.rs] — Epic entity fields
- [Source: src/components/sidebar/SprintList.tsx] — component to migrate (identifies tRPC procedure signatures)
- [Source: src/components/sprint/SprintForm.tsx] — component to migrate
- [Source: src/components/project/ProjectSwitcher.tsx] — component to migrate
- [Source: src/stores/project.store.ts] — store to extend with activeProjectId
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — deferred items from T1.3/T1.4 to resolve

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation completed without runtime errors. `cargo test` passed 30/30 tests. `npm run typecheck` introduced 0 new errors (pre-existing tRPC type collision errors remain in non-migrated files).

### Completion Notes List

1. `getActiveSprint` returns an inline type `{...} | null` in `bindings.ts` instead of `SprintModel | null` — cast with `as SprintModel | null` in the hook.
2. `openProjectDialog` similarly returns inline type — cast with `as ProjectModel | null` in the hook.
3. `VelocityWidget.tsx` required a `weekLabelToDateRange()` helper to adapt `WeekBucket` (which only has `week_label` + `count`) to `VelocityChart`'s `WeekData` format (requires `startDate`/`endDate` as `Date`).
4. `VelocityDetailPanel.tsx` removed the `getDailyVelocity` call (no Rust equivalent in T1.5 scope) — replaced daily chart with a simple weekly text breakdown.
5. `Welcome.tsx` uses a two-step open flow: `selectParentDirectory` → `validateProjectPath` → `openProjectByPath`. This correctly handles the "needs onboarding" case when the picked folder has no `.tinsu/config.yaml`.
6. `App.tsx` still uses `trpc.project.checkToolHealth` and `trpc.git.checkCrashRecovery` — these are NOT in T1.5 scope (deferred to T1.8/T1.9).
7. `@tauri-apps/plugin-dialog` npm package installed.
8. `last_opened_at` in `ProjectModel` is a Unix timestamp (seconds) — multiplied by 1000 when constructing `new Date()` in `Welcome.tsx`.

### File List

**Rust (new/modified):**
- `src-tauri/Cargo.toml` — added `tauri-plugin-dialog`, `serde_yaml`
- `src-tauri/capabilities/default.json` — added dialog permissions
- `src-tauri/src/commands/sprint.rs` — full implementation (SprintModel DTO, 6 commands, 7 tests)
- `src-tauri/src/commands/epic.rs` — extended with create/update/delete (3 new commands, 3 tests)
- `src-tauri/src/commands/project.rs` — new file (ProjectModel DTO, 7 commands, 3 tests)
- `src-tauri/src/commands/task.rs` — extended with get_weekly_velocity (2 tests)
- `src-tauri/src/commands/mod.rs` — added `pub mod project;`
- `src-tauri/src/lib.rs` — registered 16 new commands, added dialog plugin

**TypeScript (generated):**
- `src/bindings.ts` — regenerated via `cargo test generate_bindings -- --ignored`

**TypeScript (new):**
- `src/hooks/useSprintCommands.ts`
- `src/hooks/useProjectCommands.ts`

**TypeScript (modified):**
- `src/hooks/useEpicCommands.ts` — added useCreateEpic, useUpdateEpic, useDeleteEpic
- `src/stores/project.store.ts` — added activeProjectId, setProjectId, updated setProject signature
- `src/lib/rspc.ts` — exported new types
- `src/components/sidebar/SprintList.tsx` — migrated from tRPC
- `src/components/sprint/SprintForm.tsx` — migrated from tRPC
- `src/components/task/SprintSelect.tsx` — migrated from tRPC
- `src/components/project/ProjectSwitcher.tsx` — migrated from tRPC
- `src/components/ProjectSetupDialog.tsx` — migrated from tRPC
- `src/components/filter/FilterPanel.tsx` — migrated from tRPC
- `src/components/velocity/VelocityWidget.tsx` — migrated from tRPC
- `src/components/velocity/VelocityDetailPanel.tsx` — migrated from tRPC
- `src/components/board/KanbanBoardContainer.tsx` — fixed activeProjectId (AC: 13)
- `src/components/Welcome.tsx` — migrated from tRPC
- `src/App.tsx` — fixed setProject signature, migrated re-open logic
