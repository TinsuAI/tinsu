# Story T1.2: Set Up Rust SQLite Database with SeaORM Migrations

Status: done

## Story

As a founder,
I want all my project data persisted in a Rust-managed SQLite database with SeaORM,
so that the Tauri app has the same data layer as the Electron version without any Node.js dependency.

## Acceptance Criteria

1. `src-tauri/Cargo.toml` includes `sea-orm` (with `sqlx-sqlite`, `runtime-tokio-native-tls`, `macros` features), `sea-orm-migration`, `tokio`, and `thiserror` dependencies.
2. `src-tauri/src/db/mod.rs` sets up a SeaORM `DatabaseConnection` using `Database::connect()` with SQLite at `data/tinsu.db` (path relative to app working directory; created if absent).
3. Migrator is invoked on startup via `Migrator::up(&db, None)` inside `lib.rs`'s `run()` function, before the Tauri builder starts.
4. A single migration file `src-tauri/src/migration/m20260412_000001_initial_schema.rs` creates all 17 tables faithfully matching the Drizzle schema (identical column names, types, indexes, foreign keys).
5. All 17 SeaORM entity files exist in `src-tauri/src/db/entities/` (one file per table): `project.rs`, `settings.rs`, `epic.rs`, `sprint.rs`, `task.rs`, `agent_run.rs`, `planning_artifact_status.rs`, `task_artifact.rs`, `task_session.rs`, `session_history.rs`, `task_activity.rs`, `task_version.rs`, `workflow_run.rs`, `gate_decision.rs`, `chat_session.rs`, `chat_message.rs`, `chat_message_attachment.rs`.
6. `src-tauri/src/db/entities/prelude.rs` re-exports all entity `Entity` types for convenience.
7. `src-tauri/src/db/entities/mod.rs` declares all entity modules and re-exports `prelude`.
8. `src-tauri/src/migration/mod.rs` declares the `Migrator` struct that `impl MigratorTrait` with the migration list.
9. `src-tauri/src/models/` contains shared Rust enums: `task_status.rs` (TaskStatus), `event_types.rs` (ActivityEventType), `agent_state.rs` (AgentState).
10. `cargo test` runs a test in `src-tauri/src/db/mod.rs` that creates an in-memory SQLite DB, runs migrations, and asserts all 17 tables exist.
11. `cargo build` succeeds (no compile errors); the app starts and `data/tinsu.db` is created on first run.

## Tasks / Subtasks

- [x] Task 1: Add SeaORM and related Cargo dependencies (AC: 1)
  - [x] 1.1: Add to `[dependencies]` in `src-tauri/Cargo.toml`:
    - `sea-orm = { version = "1", features = ["sqlx-sqlite", "runtime-tokio-native-tls", "macros"] }`
    - `sea-orm-migration = { version = "1", features = ["sqlx-sqlite"] }`
    - `tokio = { version = "1", features = ["full"] }`
    - `thiserror = "1"`
    - `uuid = { version = "1", features = ["v4"] }`
  - [x] 1.2: Verify `Cargo.lock` is updated and `cargo check` passes

- [x] Task 2: Create database connection module (AC: 2)
  - [x] 2.1: Create `src-tauri/src/db/mod.rs` — `pub async fn connect() -> Result<DatabaseConnection, DbErr>` using `Database::connect("sqlite://./data/tinsu.db?mode=rwc")` (the `?mode=rwc` creates the file if absent)
  - [x] 2.2: Ensure `data/` directory is created if absent before calling `connect()` (use `std::fs::create_dir_all("data")`)
  - [x] 2.3: Create `src-tauri/src/db/entities/mod.rs` declaring all entity modules

- [x] Task 3: Create migration infrastructure (AC: 4, 8)
  - [x] 3.1: Create `src-tauri/src/migration/mod.rs` with `pub struct Migrator` implementing `MigratorTrait` listing `m20260412_000001_initial_schema::Migration` in `migrations()`
  - [x] 3.2: Create `src-tauri/src/migration/m20260412_000001_initial_schema.rs` — implements `MigrationTrait` with `up()` creating all 17 tables (see Dev Notes for exact DDL)

- [x] Task 4: Create all 17 SeaORM entity files (AC: 5, 6, 7)
  - [x] 4.1: `project.rs` — `projects` table entity
  - [x] 4.2: `settings.rs` — `settings` table entity
  - [x] 4.3: `epic.rs` — `epics` table entity
  - [x] 4.4: `sprint.rs` — `sprints` table entity
  - [x] 4.5: `task.rs` — `tasks` table entity (largest — many columns)
  - [x] 4.6: `agent_run.rs` — `agent_runs` table entity
  - [x] 4.7: `planning_artifact_status.rs` — `planning_artifact_statuses` table entity
  - [x] 4.8: `task_artifact.rs` — `task_artifacts` table entity
  - [x] 4.9: `task_session.rs` — `task_sessions` table entity
  - [x] 4.10: `session_history.rs` — `session_history` table entity
  - [x] 4.11: `task_activity.rs` — `task_activities` table entity
  - [x] 4.12: `task_version.rs` — `task_versions` table entity
  - [x] 4.13: `workflow_run.rs` — `workflow_runs` table entity
  - [x] 4.14: `gate_decision.rs` — `gate_decisions` table entity
  - [x] 4.15: `chat_session.rs` — `chat_sessions` table entity
  - [x] 4.16: `chat_message.rs` — `chat_messages` table entity
  - [x] 4.17: `chat_message_attachment.rs` — `chat_message_attachments` table entity
  - [x] 4.18: `prelude.rs` — re-exports all `Entity` types

- [x] Task 5: Create shared model enums (AC: 9)
  - [x] 5.1: Create `src-tauri/src/models/mod.rs` declaring `task_status`, `event_types`, `agent_state` modules
  - [x] 5.2: Create `src-tauri/src/models/task_status.rs` — `TaskStatus` enum (Backlog, CreateStory, InProgress, Review, Done) with `serde` derives
  - [x] 5.3: Create `src-tauri/src/models/event_types.rs` — `ActivityEventType` enum with all 12 variants from Drizzle schema
  - [x] 5.4: Create `src-tauri/src/models/agent_state.rs` — `AgentState` enum (Idle, Starting, Running, Stalled, Paused, Completing, Review)

- [x] Task 6: Wire DB initialization into Tauri startup (AC: 3, 11)
  - [x] 6.1: Declare `mod db`, `mod migration`, `mod models` in `src-tauri/src/lib.rs`
  - [x] 6.2: In `run()`, call `db::connect()` and `Migrator::up(&db, None)` via `tauri::async_runtime::block_on` inside `.setup()` (avoids tokio runtime conflict)
  - [x] 6.3: Pass `DatabaseConnection` into Tauri's `manage()` state for future use by routers
  - [x] 6.4: Verify `cargo build` succeeds

- [x] Task 7: Write tests (AC: 10)
  - [x] 7.1: Add `#[cfg(test)] mod tests` in `src-tauri/src/db/mod.rs` with `test_migrations_create_all_tables()` that: connects to `:memory:`, runs `Migrator::up`, queries `sqlite_master` for all 17 table names, asserts each exists
  - [x] 7.2: Run `cargo test` — all tests pass (1 test: `db::tests::test_migrations_create_all_tables`)

## Dev Notes

### Critical: Directory Structure to Create

```
src-tauri/src/
├── main.rs          ← Unchanged from T1.1
├── lib.rs           ← MODIFY: add mod declarations, db init in run()
├── error.rs         ← NEW: AppError enum (needed by future stories, stub OK for now)
├── db/
│   ├── mod.rs       ← NEW: connect() function
│   └── entities/
│       ├── mod.rs           ← NEW: all entity module declarations
│       ├── prelude.rs       ← NEW: re-exports
│       ├── project.rs
│       ├── settings.rs
│       ├── epic.rs
│       ├── sprint.rs
│       ├── task.rs
│       ├── agent_run.rs
│       ├── planning_artifact_status.rs
│       ├── task_artifact.rs
│       ├── task_session.rs
│       ├── session_history.rs
│       ├── task_activity.rs
│       ├── task_version.rs
│       ├── workflow_run.rs
│       ├── gate_decision.rs
│       ├── chat_session.rs
│       ├── chat_message.rs
│       └── chat_message_attachment.rs
├── migration/
│   ├── mod.rs       ← NEW: Migrator struct
│   └── m20260412_000001_initial_schema.rs  ← NEW: all 17 tables
└── models/
    ├── mod.rs
    ├── task_status.rs
    ├── event_types.rs
    └── agent_state.rs
```

### Critical: Cargo.toml Complete Dependencies

```toml
[package]
name = "tinsu"
version = "0.1.0"
edition = "2021"

[lib]
name = "tinsu_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sea-orm = { version = "1", features = ["sqlx-sqlite", "runtime-tokio-native-tls", "macros"] }
sea-orm-migration = { version = "1", features = ["sqlx-sqlite"] }
tokio = { version = "1", features = ["full"] }
thiserror = "1"
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
```

**Note:** `specta` is NOT added in T1.2 — it's added in T1.3 when rspc is set up. For now, model enums only need `serde::Serialize`, `serde::Deserialize`, `Debug`, `Clone`, `PartialEq`.

### Critical: lib.rs DB Initialization Pattern

The Tauri `run()` function isn't async by default. Use a tokio runtime to run async DB setup synchronously before starting Tauri:

```rust
// src-tauri/src/lib.rs
mod db;
mod migration;
mod models;

use migration::{Migrator, MigratorTrait};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database synchronously before Tauri starts
    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    let db = rt.block_on(async {
        db::connect().await.expect("Failed to connect to database")
    });
    rt.block_on(async {
        Migrator::up(&db, None).await.expect("Failed to run migrations")
    });

    tauri::Builder::default()
        .manage(db)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Alternative (if tokio runtime conflict):** Use `tauri::async_runtime::block_on` which uses Tauri's built-in tokio runtime:

```rust
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let db = db::connect().await.expect("Failed to connect");
                Migrator::up(&db, None).await.expect("Migrations failed");
                app_handle.manage(db);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Recommendation:** Use the `.setup()` pattern with `tauri::async_runtime::block_on` — this avoids creating a second tokio runtime that could conflict with Tauri's internal runtime.

### Critical: Database File Path

The connection URL: `"sqlite://./data/tinsu.db?mode=rwc"`

- `./` = relative to the process working directory (which is the project root during dev)
- `?mode=rwc` = open for read/write, create if absent
- The `data/` directory must exist — create it before connecting:

```rust
// src-tauri/src/db/mod.rs
use sea_orm::{Database, DatabaseConnection, DbErr};

pub async fn connect() -> Result<DatabaseConnection, DbErr> {
    std::fs::create_dir_all("data").expect("Failed to create data directory");
    Database::connect("sqlite://./data/tinsu.db?mode=rwc").await
}
```

### Critical: SeaORM Entity Pattern

Each entity file follows this standard structure. Example for `project.rs`:

```rust
// src-tauri/src/db/entities/project.rs
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[sea_orm(unique)]
    pub path: String,
    pub name: String,
    pub created_at: Option<i64>,
    pub last_opened_at: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::sprint::Entity")]
    Sprint,
    #[sea_orm(has_many = "super::epic::Entity")]
    Epic,
    #[sea_orm(has_many = "super::task::Entity")]
    Task,
    #[sea_orm(has_many = "super::chat_session::Entity")]
    ChatSession,
    #[sea_orm(has_many = "super::workflow_run::Entity")]
    WorkflowRun,
    #[sea_orm(has_many = "super::gate_decision::Entity")]
    GateDecision,
    #[sea_orm(has_many = "super::planning_artifact_status::Entity")]
    PlanningArtifactStatus,
}

impl ActiveModelBehavior for ActiveModel {}
```

**Key rules for entities:**
- All timestamps are `Option<i64>` (Unix seconds as INTEGER in SQLite)
- `created_at`/`updated_at` that are NOT NULL in DB should be `i64` (non-optional)
- `INTEGER` columns that store booleans (e.g., `has_merge_conflict`) → `Option<i32>` or `i32`
- Primary keys: always `String` (UUID), `auto_increment = false`
- `text` columns with `.notNull()` in Drizzle → `String` in Rust
- `text` columns without `.notNull()` → `Option<String>`
- Foreign keys: declare relations using `DeriveRelation` but relations are OPTIONAL in T1.2 — if complex, use `DeriveRelation` with empty variants and add FK constraints only in migration DDL

### Critical: Migration DDL — All 17 Tables

The migration `up()` must create tables in dependency order (parent tables first):

**Dependency order:**
1. `projects` (no FKs)
2. `settings` (no FKs)
3. `sprints` (FK → projects)
4. `epics` (FK → projects)
5. `tasks` (FK → projects, agent_runs via deferred/nullable)
6. `agent_runs` (FK → tasks — circular via nullable; create tasks first, FK added after)
7. `planning_artifact_statuses` (FK → projects)
8. `task_artifacts` (FK → tasks)
9. `task_sessions` (FK → tasks)
10. `session_history` (FK → tasks)
11. `task_activities` (FK → tasks)
12. `task_versions` (FK → tasks)
13. `workflow_runs` (FK → projects, tasks nullable)
14. `gate_decisions` (FK → projects, workflow_runs nullable)
15. `chat_sessions` (FK → projects)
16. `chat_messages` (FK → chat_sessions)
17. `chat_message_attachments` (FK → chat_messages)

**Note on circular FK (tasks ↔ agent_runs):** `tasks.rejected_agent_run_id` references `agent_runs.id`, but `agent_runs.task_id` references `tasks.id`. Solution: create `tasks` first without the `rejected_agent_run_id` column, then create `agent_runs`, then add `rejected_agent_run_id` to `tasks` in a separate ALTER TABLE, OR simply declare `rejected_agent_run_id` as TEXT without a FOREIGN KEY constraint (SQLite doesn't enforce FK by default unless `PRAGMA foreign_keys = ON`).

**Recommended approach for T1.2:** Declare all columns but skip explicit `FOREIGN KEY` constraint for `tasks.rejected_agent_run_id` — use a comment in the migration noting the logical FK. All other FKs are non-circular and can be declared.

```rust
// src-tauri/src/migration/m20260412_000001_initial_schema.rs
use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260412_000001_initial_schema"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Execute raw SQL for full SQLite DDL control
        manager.get_connection()
            .execute_unprepared(include_str!("schema.sql"))
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop tables in reverse dependency order
        let drop_statements = [
            "DROP TABLE IF EXISTS chat_message_attachments",
            "DROP TABLE IF EXISTS chat_messages",
            "DROP TABLE IF EXISTS chat_sessions",
            "DROP TABLE IF EXISTS gate_decisions",
            "DROP TABLE IF EXISTS workflow_runs",
            "DROP TABLE IF EXISTS task_versions",
            "DROP TABLE IF EXISTS task_activities",
            "DROP TABLE IF EXISTS session_history",
            "DROP TABLE IF EXISTS task_sessions",
            "DROP TABLE IF EXISTS task_artifacts",
            "DROP TABLE IF EXISTS planning_artifact_statuses",
            "DROP TABLE IF EXISTS agent_runs",
            "DROP TABLE IF EXISTS tasks",
            "DROP TABLE IF EXISTS epics",
            "DROP TABLE IF EXISTS sprints",
            "DROP TABLE IF EXISTS settings",
            "DROP TABLE IF EXISTS projects",
        ];
        for stmt in &drop_statements {
            manager.get_connection().execute_unprepared(stmt).await?;
        }
        Ok(())
    }
}
```

**Alternative (avoid `include_str!`):** Define the SQL directly in the `up()` method using `execute_unprepared` calls per table. This is more portable and avoids file path issues.

Use `execute_unprepared` per table — example for `projects`:

```rust
manager.get_connection().execute_unprepared(
    "CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_opened_at INTEGER
    )"
).await?;
manager.get_connection().execute_unprepared(
    "CREATE INDEX IF NOT EXISTS idx_projects_path ON projects (path)"
).await?;
manager.get_connection().execute_unprepared(
    "CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects (last_opened_at)"
).await?;
```

Repeat this pattern for all 17 tables. The complete DDL for each table is derived from the Drizzle schema (see complete table list below).

### Complete 17-Table DDL Reference

Based on the Drizzle schema in `git show HEAD~2:src/main/db/schema.ts`:

| # | Table | Columns | FKs |
|---|-------|---------|-----|
| 1 | `projects` | id, path (unique), name, created_at, last_opened_at | none |
| 2 | `settings` | id, key (unique), value, created_at | none |
| 3 | `sprints` | id, name, start_date, end_date, status, goal, velocity, capacity, project_id, story_prefix, epics_file_path, created_at | projects.id |
| 4 | `epics` | id, title, description, color, epic_number, goal, sprint_id, project_id, created_at | projects.id |
| 5 | `tasks` | id, title, description, status, sort_order, epic_id, sprint_id, task_type, phase_number, phase_name, bmad_agent, bmad_workflow, is_start_here, artifact_path, story_number, story_file_path, full_content, story_file_status, context_notes, project_id, worktree_path, branch_name, merge_commit_sha, has_merge_conflict, conflict_files, worktree_skipped, rejection_feedback, rejected_agent_run_id, inline_comments, rejection_count, last_review_commit, created_at, updated_at | projects.id; rejected_agent_run_id→agent_runs.id (no constraint) |
| 6 | `agent_runs` | id, task_id, start_time, end_time, duration_ms, token_usage, exit_status, log_path | tasks.id |
| 7 | `planning_artifact_statuses` | id, project_id, artifact_key, status, updated_at | projects.id (unique idx on project_id+artifact_key) |
| 8 | `task_artifacts` | id, task_id, artifact_type, artifact_path, section_ref, created_at | tasks.id |
| 9 | `task_sessions` | id, task_id (unique), session_id, tmux_session, current_phase, created_at | tasks.id |
| 10 | `session_history` | id, task_id, session_id, workflow_type, started_at, ended_at | tasks.id |
| 11 | `task_activities` | id, task_id, event_type, payload, created_at | tasks.id |
| 12 | `task_versions` | id, task_id, version_number, commit_sha, rejection_feedback, inline_comments, status_outcome, created_at | tasks.id |
| 13 | `workflow_runs` | id, project_id, workflow_key, phase, status, started_at, finished_at, input_artifacts, output_artifacts, agent_name, task_id | projects.id; tasks.id (nullable, SET NULL) |
| 14 | `gate_decisions` | id, project_id, decision, rationale, issues, created_at, workflow_run_id | projects.id; workflow_runs.id (nullable, SET NULL) |
| 15 | `chat_sessions` | id, session_uuid (unique), agent_persona, workflow_phase, project_id, status, created_at, updated_at, last_message_at, workflow_key, skip_permissions, tmux_session | projects.id |
| 16 | `chat_messages` | id, session_id, role, content, tool_name, tool_input, created_at | chat_sessions.id |
| 17 | `chat_message_attachments` | id, message_id, file_name, file_path, mime_type, file_size, created_at | chat_messages.id |

### Critical: Migrator mod.rs Pattern

```rust
// src-tauri/src/migration/mod.rs
use sea_orm_migration::MigratorTrait;

mod m20260412_000001_initial_schema;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn sea_orm_migration::MigrationTrait>> {
        vec![Box::new(m20260412_000001_initial_schema::Migration)]
    }
}
```

The `sea-orm-migration` crate provides `MigratorTrait` and `MigrationTrait`. The `async_trait` crate is a transitive dependency — no need to add it explicitly.

### Critical: Test Pattern for Migration Validation

```rust
// In src-tauri/src/db/mod.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::migration::{Migrator, MigratorTrait};
    use sea_orm::{Database, Statement, DbBackend, ConnectionTrait};

    #[tokio::test]
    async fn test_migrations_create_all_tables() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        Migrator::up(&db, None).await.unwrap();

        let expected_tables = vec![
            "projects", "settings", "sprints", "epics", "tasks",
            "agent_runs", "planning_artifact_statuses", "task_artifacts",
            "task_sessions", "session_history", "task_activities", "task_versions",
            "workflow_runs", "gate_decisions", "chat_sessions", "chat_messages",
            "chat_message_attachments",
        ];

        for table in expected_tables {
            let result = db.query_one(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [table.into()],
            )).await.unwrap();
            assert!(result.is_some(), "Table '{}' should exist", table);
        }
    }
}
```

### Architecture Compliance

- **ORM:** SeaORM (NOT sqlx directly, NOT Diesel) — [Source: architecture.md#Data Architecture]
- **DB file:** `data/tinsu.db` — [Source: architecture.md#Data Architecture]
- **Migration tool:** `sea-orm-migration` compiled into binary, auto-runs on startup — [Source: architecture.md#Data Architecture]
- **Schema:** Port all 17 tables faithfully — no schema changes in Phase 1 — [Source: architecture.md#Data Architecture]
- **Entity naming:** snake_case module files, `Model` struct, `ActiveModel`, `Column` enum (PascalCase variants) — [Source: architecture.md#Naming Patterns — SeaORM Entity Naming]
- **Rust naming:** snake_case functions, PascalCase structs — [Source: architecture.md#Naming Patterns — Rust Code Naming]
- **NO raw Tauri invoke** in this story — DB is internal infrastructure only; rspc commands are T1.3
- **Logging:** Use `tracing::info!` / `tracing::error!` (NOT `println!`) — [Source: architecture.md#Anti-Patterns]

### T1.1 Learnings (From Previous Story)

- `src-tauri/src/` currently has only `main.rs` and `lib.rs` — all directories (`db/`, `migration/`, `models/`) must be created from scratch
- The tokio runtime for Tauri: Tauri v2 sets up its own tokio runtime internally. **Do NOT create a second `tokio::runtime::Runtime::new()`** — use `tauri::async_runtime::block_on` in `.setup()` instead (avoids runtime conflict)
- `Cargo.toml` currently has only minimal deps (`tauri`, `serde`, `serde_json`) — all SeaORM deps are new additions
- `data/tinsu.db` does not exist yet — connection must use `?mode=rwc` and pre-create the directory
- No pre-existing test failures in Rust (T1.1 had no Rust tests) — test baseline is clean

### Known Pitfalls to Avoid

1. **tokio runtime conflict**: Don't use `tokio::runtime::Runtime::new()` — use `tauri::async_runtime::block_on` inside `.setup()`
2. **SQLite file mode**: Use `?mode=rwc` in connection URL, not `?mode=ro` or omitting the mode
3. **Circular FK (tasks ↔ agent_runs)**: `tasks.rejected_agent_run_id` → skip explicit FK constraint; declare as plain TEXT column
4. **Entity column types**: Drizzle's `integer({ mode: 'timestamp' })` → Rust `Option<i64>` (NOT `DateTime`, NOT `chrono::NaiveDateTime` — avoids chrono feature requirement)
5. **SeaORM `macros` feature**: Required for `#[derive(DeriveEntityModel)]` — must be in features list
6. **`sea-orm-migration` binary**: The migration binary approach (via `cargo run --bin migration`) is optional; for T1.2, just invoke `Migrator::up()` as a library call from `lib.rs`
7. **`.gitignore`**: `data/tinsu.db` should be gitignored — check `.gitignore` and add if missing

### Project Structure Notes

- `src-tauri/` is the only location for Rust code — do NOT add Rust files to `src/` (React frontend directory)
- `data/` directory is at project root (same level as `src-tauri/`, `src/`, `package.json`) — runtime data, gitignored
- Architecture shows `data/tinsu.db` as the database path — [Source: architecture.md#Complete Project Directory Structure]
- After T1.2, `src-tauri/src/` will have `db/`, `migration/`, `models/` subdirectories in addition to the existing `main.rs` and `lib.rs`

### References

- [Source: architecture.md#Data Architecture] — SeaORM + SQLite decision, migration strategy
- [Source: architecture.md#Rust Backend Organization] — Complete directory structure for `src-tauri/src/`
- [Source: architecture.md#Naming Patterns — SeaORM Entity Naming] — entity file naming conventions
- [Source: architecture.md#Anti-Patterns] — `unwrap()` → use `?`, `println!` → `tracing::info!`
- [Source: sprint-change-proposal-2026-04-12.md#Technical Impact] — 17 tables, SeaORM replaces Drizzle
- [Source: t1-1-initialize-tauri-v2-project-with-react-frontend.md#Dev Agent Record] — current state of `src-tauri/`: only main.rs + lib.rs exist
- Drizzle schema reference: `git show HEAD~2:src/main/db/schema.ts` — canonical source for all 17 table definitions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed: `MigratorTrait` not in scope in test — used `sea_orm_migration::MigratorTrait` directly instead of `crate::migration::MigratorTrait` (private re-export)
- Fixed: `async_trait` transitive dep not directly usable by attribute name — added `async-trait = "0.1"` as explicit Cargo.toml dependency
- Used `.setup()` pattern with `tauri::async_runtime::block_on` (not `tokio::runtime::Runtime::new()`) to avoid tokio runtime conflict per story pitfall #1

### Completion Notes List

- Implemented all 7 tasks with all 37 subtasks complete
- SeaORM 1.x + sea-orm-migration wired with SQLite backend (`sqlx-sqlite`, `runtime-tokio-native-tls`, `macros`)
- `db::connect()` uses `sqlite://./data/tinsu.db?mode=rwc` with pre-created `data/` directory
- `Migrator::up()` called in Tauri `.setup()` hook via `tauri::async_runtime::block_on`
- All 17 tables created in dependency order; circular FK (tasks↔agent_runs) handled by plain TEXT column on `rejected_agent_run_id`
- All 17 SeaORM entity files use `Option<i64>` for nullable timestamps, `i64` for non-null timestamps
- Model enums use `serde` only (specta deferred to T1.3 per story notes)
- `cargo test`: 1 test passing — `test_migrations_create_all_tables` validates all 17 tables exist in in-memory SQLite
- `cargo build`: succeeds with no errors (only unused-import warnings from prelude.rs — expected until T1.3+ uses entities)

### Review Findings

- [x] [Review][Patch] `use super::*` unused wildcard import in test module [src-tauri/src/db/mod.rs:12] — removed; test module uses only explicit imports
- [x] [Review][Defer] `.expect()` panics in production startup paths (create_dir_all, connect, Migrator::up) [src-tauri/src/db/mod.rs:6, src-tauri/src/lib.rs:17,20] — deferred, accepted Tauri startup pattern for MVP; proper error propagation via AppError in T1.3+
- [x] [Review][Defer] `version_number: i32` minor type inconsistency vs other i64 INTEGER fields [src-tauri/src/db/entities/task_version.rs] — deferred, no overflow risk, no AC violation, no functional impact

### File List

- `src-tauri/Cargo.toml` — added sea-orm, sea-orm-migration, tokio, thiserror, uuid, tracing, async-trait deps
- `src-tauri/src/lib.rs` — mod declarations + DB init in run() via .setup()
- `src-tauri/src/error.rs` — AppError enum stub
- `src-tauri/src/db/mod.rs` — connect() function + migration test
- `src-tauri/src/db/entities/mod.rs` — entity module declarations
- `src-tauri/src/db/entities/prelude.rs` — re-exports all Entity types
- `src-tauri/src/db/entities/project.rs`
- `src-tauri/src/db/entities/settings.rs`
- `src-tauri/src/db/entities/epic.rs`
- `src-tauri/src/db/entities/sprint.rs`
- `src-tauri/src/db/entities/task.rs`
- `src-tauri/src/db/entities/agent_run.rs`
- `src-tauri/src/db/entities/planning_artifact_status.rs`
- `src-tauri/src/db/entities/task_artifact.rs`
- `src-tauri/src/db/entities/task_session.rs`
- `src-tauri/src/db/entities/session_history.rs`
- `src-tauri/src/db/entities/task_activity.rs`
- `src-tauri/src/db/entities/task_version.rs`
- `src-tauri/src/db/entities/workflow_run.rs`
- `src-tauri/src/db/entities/gate_decision.rs`
- `src-tauri/src/db/entities/chat_session.rs`
- `src-tauri/src/db/entities/chat_message.rs`
- `src-tauri/src/db/entities/chat_message_attachment.rs`
- `src-tauri/src/migration/mod.rs` — Migrator struct implementing MigratorTrait
- `src-tauri/src/migration/m20260412_000001_initial_schema.rs` — all 17 tables DDL
- `src-tauri/src/models/mod.rs`
- `src-tauri/src/models/task_status.rs`
- `src-tauri/src/models/event_types.rs`
- `src-tauri/src/models/agent_state.rs`
