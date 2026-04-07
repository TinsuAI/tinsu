# Story 1.3: Set Up SQLDelight Local Cache Schema

Status: review

## Story

As a developer,
I want the complete SQLDelight database schema with mirrored desktop tables and mobile-only tables,
So that the app can cache remote data and store local preferences with type-safe queries.

## Acceptance Criteria

1. **Given** SQLDelight 2.2.1 is configured in the KMP shared module
   **When** the database schema files are created
   **Then** mirrored desktop tables exist: tasks, sprints, epics, agent_runs, task_sessions, task_activities — with snake_case naming matching desktop conventions

2. **And** mobile-only tables exist: connections, document_cache, chat_cache, app_preferences

3. **And** all tables use snake_case for table names and column names

4. **And** foreign keys follow `{referenced_table_singular}_id` convention

5. **And** date/time columns store INTEGER (Unix timestamp seconds)

6. **And** the database compiles and SQLDelight generates type-safe Kotlin query classes

7. **And** a basic integration test verifies insert and query operations on at least one table

## Tasks / Subtasks

- [x] Task 1: Configure SQLDelight Gradle plugin (AC: 1, 6)
  - [x] 1.1 Add `alias(libs.plugins.sqldelight)` to `mobile/shared/build.gradle.kts` plugins block
  - [x] 1.2 Add `sqldelight { databases { create("TinsuMobile") { packageName.set("com.tinsu.mobile.db") } } }` block to `mobile/shared/build.gradle.kts`
  - [x] 1.3 Verify the plugin resolves correctly — `sqldelight` plugin ID is already defined in `mobile/gradle/libs.versions.toml` as `app.cash.sqldelight` version `2.2.1`

- [x] Task 2: Create mirrored desktop table .sq files (AC: 1, 3, 4, 5)
  - [x] 2.1 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Tasks.sq` — see schema below
  - [x] 2.2 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Sprints.sq`
  - [x] 2.3 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Epics.sq`
  - [x] 2.4 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/AgentRuns.sq`
  - [x] 2.5 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/TaskSessions.sq`
  - [x] 2.6 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/TaskActivities.sq`

- [x] Task 3: Create mobile-only table .sq files (AC: 2, 3, 4, 5)
  - [x] 3.1 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Connections.sq`
  - [x] 3.2 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/DocumentCache.sq`
  - [x] 3.3 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/ChatCache.sq`
  - [x] 3.4 Create `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/AppPreferences.sq`

- [x] Task 4: Register SqlDriver in Koin DI modules (AC: 6)
  - [x] 4.1 Update `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt` — register `single<SqlDriver> { AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db") }`
  - [x] 4.2 Update `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/IosModule.kt` — register `single<SqlDriver> { NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db") }`
  - [x] 4.3 Update `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt` — register `single { TinsuMobile(get()) }` (creates the database instance from the driver)

- [x] Task 5: Write integration test (AC: 7)
  - [x] 5.1 Add `implementation(libs.sqldelight.sqlite.driver)` as `testImplementation` dependency in `mobile/shared/build.gradle.kts` (JVM-only driver for in-memory tests)
  - [x] 5.2 Create `mobile/shared/src/androidUnitTest/kotlin/com/tinsu/mobile/db/ConnectionsTableTest.kt` — test insert and query on the `connections` table using JdbcSqliteDriver in-memory
  - [x] 5.3 Test: insert a connection record, query it back, verify all fields match
  - [x] 5.4 Test: selectAll returns multiple inserted connections, deleteById removes connection, selectById returns null for nonexistent

- [x] Task 6: Validate build (AC: all)
  - [x] 6.1 Run `./gradlew :shared:generateSqlDelightInterface` from `mobile/` — SQLDelight generates Kotlin query classes without errors
  - [x] 6.2 Run `./gradlew :shared:testDebugUnitTest` from `mobile/` — all 20 tests pass (16 existing ResultTest + 4 new ConnectionsTableTest)
  - [x] 6.3 Run `./gradlew :androidApp:assembleDebug` from `mobile/` — Android app compiles with SqlDriver Koin binding (56 tasks BUILD SUCCESSFUL)
  - [x] 6.4 Verify no unresolved dependency warnings — clean build with no errors

### Review Findings

- [ ] [Review][Patch] KoinHelper.initKoin() catches bare Exception — silently swallows non-initialization errors [mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt]
- [x] [Review][Defer] agent_runs and task_activities missing ON DELETE CASCADE — deferred, pre-existing design choice not required by spec
- [x] [Review][Defer] document_cache.project_id has no FK to projects — deferred, mobile-only table design not constrained by spec
- [x] [Review][Defer] tasks.rejected_agent_run_id references agent_runs without FK constraint — deferred, mirrors desktop schema as-is, FK not in spec
- [x] [Review][Defer] SQLite FK enforcement requires PRAGMA foreign_keys = ON at driver setup — deferred, pre-existing SQLite behavior

## Dev Notes

### Project Location

All work is in `mobile/` at the repo root. This is the KMP project created in Story 1.1. **DO NOT** modify any desktop app files (`src/`, `package.json`, etc.).

### SQLDelight .sq File Location — CRITICAL

SQLDelight 2.x reads `.sq` files from the `sqldelight/` source set, **NOT** from the `kotlin/` source set. The correct path is:

```
mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/*.sq
```

The architecture document shows `.sq` files under both `kotlin/com/tinsu/mobile/db/` and `sqldelight/com/tinsu/mobile/db/` — this is a documentation discrepancy. The `sqldelight/` directory is the one the Gradle plugin processes. The `kotlin/com/tinsu/mobile/db/` directory currently contains only `.gitkeep` and should NOT contain `.sq` files. Future Kotlin source files for the `db` package (e.g., custom adapters, repository helpers) can go in the `kotlin/` directory, but the `.sq` files must go in `sqldelight/`.

### SQLDelight Gradle Plugin Configuration

The plugin ID and version are already in `mobile/gradle/libs.versions.toml`:
```toml
sqldelight = { id = "app.cash.sqldelight", version.ref = "sqldelight" }  # 2.2.1
```

The runtime and driver dependencies are already in `mobile/shared/build.gradle.kts`:
```kotlin
// commonMain
implementation(libs.sqldelight.runtime)
implementation(libs.sqldelight.coroutines)
// androidMain
implementation(libs.sqldelight.android.driver)
// iosMain
implementation(libs.sqldelight.native.driver)
```

What is MISSING and must be added:

1. The plugin application in the `plugins {}` block:
```kotlin
plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.sqldelight)  // ADD THIS
}
```

2. The database configuration block (add at the end of the file, after the `android {}` block):
```kotlin
sqldelight {
    databases {
        create("TinsuMobile") {
            packageName.set("com.tinsu.mobile.db")
        }
    }
}
```

This generates a `TinsuMobile` class with a `Schema` companion that the drivers use for table creation.

### Mirrored Desktop Table Schemas

The following schemas are derived from the desktop Drizzle ORM definitions in `src/main/db/schema.ts`. Mirror the column names exactly (snake_case) for compatibility when downloading the desktop DB via SFTP.

**tasks table** (the largest table — mirror all columns used by mobile features):
```sql
CREATE TABLE tasks (
    id TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog',
    sort_order INTEGER NOT NULL DEFAULT 0,
    epic_id TEXT,
    sprint_id TEXT,
    task_type TEXT NOT NULL DEFAULT 'story',
    phase_number INTEGER,
    phase_name TEXT,
    bmad_agent TEXT,
    bmad_workflow TEXT,
    is_start_here INTEGER,
    artifact_path TEXT,
    story_number TEXT,
    story_file_path TEXT,
    full_content TEXT,
    story_file_status TEXT,
    context_notes TEXT,
    project_id TEXT,
    worktree_path TEXT,
    branch_name TEXT,
    merge_commit_sha TEXT,
    has_merge_conflict INTEGER NOT NULL DEFAULT 0,
    conflict_files TEXT,
    worktree_skipped INTEGER NOT NULL DEFAULT 0,
    rejection_feedback TEXT,
    rejected_agent_run_id TEXT,
    inline_comments TEXT,
    rejection_count INTEGER NOT NULL DEFAULT 0,
    last_review_commit TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (epic_id) REFERENCES epics(id),
    FOREIGN KEY (sprint_id) REFERENCES sprints(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX tasks_status ON tasks(status);
CREATE INDEX tasks_epic_id ON tasks(epic_id);
CREATE INDEX tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX tasks_project_id ON tasks(project_id);
CREATE INDEX tasks_task_type ON tasks(task_type);
```

**sprints table:**
```sql
CREATE TABLE sprints (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    start_date INTEGER,
    end_date INTEGER,
    status TEXT NOT NULL DEFAULT 'planning',
    goal TEXT,
    velocity INTEGER,
    capacity INTEGER,
    project_id TEXT,
    story_prefix TEXT,
    epics_file_path TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX sprints_project_id ON sprints(project_id);
CREATE INDEX sprints_status ON sprints(status);
```

**epics table:**
```sql
CREATE TABLE epics (
    id TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    epic_number INTEGER,
    goal TEXT,
    sprint_id TEXT,
    project_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (sprint_id) REFERENCES sprints(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX epics_project_id ON epics(project_id);
CREATE INDEX epics_sprint_id ON epics(sprint_id);
```

**agent_runs table:**
```sql
CREATE TABLE agent_runs (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_ms INTEGER,
    token_usage INTEGER,
    exit_status TEXT,
    log_path TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX agent_runs_task_id ON agent_runs(task_id);
```

**task_sessions table:**
```sql
CREATE TABLE task_sessions (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    session_id TEXT,
    tmux_session TEXT NOT NULL,
    current_phase TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX task_sessions_session_id ON task_sessions(session_id);
CREATE UNIQUE INDEX task_sessions_task_id ON task_sessions(task_id);
```

**task_activities table:**
```sql
CREATE TABLE task_activities (
    id TEXT NOT NULL PRIMARY KEY,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX task_activities_task_id ON task_activities(task_id);
CREATE INDEX task_activities_event_type ON task_activities(event_type);
CREATE INDEX task_activities_created_at ON task_activities(created_at);
CREATE INDEX task_activities_task_created ON task_activities(task_id, created_at);
```

### Mobile-Only Table Schemas

**connections table** (FR1, FR5-FR7, FR45):
```sql
CREATE TABLE connections (
    id TEXT NOT NULL PRIMARY KEY,
    display_name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    transport TEXT NOT NULL DEFAULT 'ssh',
    sort_order INTEGER NOT NULL DEFAULT 0,
    last_connected_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

**document_cache table** (FR26, NFR14):
```sql
CREATE TABLE document_cache (
    id TEXT NOT NULL PRIMARY KEY,
    project_id TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    content TEXT NOT NULL,
    remote_modified_at INTEGER,
    cached_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX document_cache_project_path ON document_cache(project_id, remote_path);
```

**chat_cache table** (FR17, FR21):
```sql
CREATE TABLE chat_cache (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX chat_cache_session_id ON chat_cache(session_id);
CREATE INDEX chat_cache_session_created ON chat_cache(session_id, created_at);
```

**app_preferences table** (FR45-FR48):
```sql
CREATE TABLE app_preferences (
    key TEXT NOT NULL PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### Basic Queries Per .sq File

Each `.sq` file should contain the `CREATE TABLE` statement, indexes, and a minimal set of queries that SQLDelight requires to generate the typed API. Add at least these per file:

- **selectAll** — `SELECT * FROM {table};`
- **selectById** — `SELECT * FROM {table} WHERE id = ?;` (or `WHERE key = ?` for app_preferences)
- **insert** — `INSERT INTO {table} (...) VALUES (...);`
- **deleteById** — `DELETE FROM {table} WHERE id = ?;`

Future stories will add more specialized queries as features are built.

### SqlDriver Registration in Koin

Update the existing (currently empty) Koin modules from Story 1.2:

**AndroidModule.kt:**
```kotlin
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.tinsu.mobile.db.TinsuMobile
import app.cash.sqldelight.db.SqlDriver

val androidModule = module {
    single<SqlDriver> {
        AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db")
    }
}
```

**IosModule.kt:**
```kotlin
import app.cash.sqldelight.driver.native.NativeSqliteDriver
import com.tinsu.mobile.db.TinsuMobile
import app.cash.sqldelight.db.SqlDriver

val iosModule = module {
    single<SqlDriver> {
        NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db")
    }
}
```

**SharedModule.kt:**
```kotlin
import com.tinsu.mobile.db.TinsuMobile

val sharedModule = module {
    single { TinsuMobile(get()) }
}
```

### Integration Test Strategy

For the commonTest integration test, use an in-memory SQLite driver. Since `commonTest` doesn't have access to platform drivers, either:

**Option A (Recommended):** Create the test in `androidUnitTest` or `commonTest` and use the JVM SQLite driver for testing. Add to `commonTest` dependencies:
```kotlin
commonTest.dependencies {
    implementation(libs.kotlin.test)
    implementation(libs.sqldelight.runtime)  // if not transitively available
}
```

For the in-memory driver in tests, you can use SQLDelight's `JdbcSqliteDriver` (for JVM/Android unit tests). Add to `libs.versions.toml`:
```toml
sqldelight-sqlite-driver = { module = "app.cash.sqldelight:sqlite-driver", version.ref = "sqldelight" }
```

And in `build.gradle.kts`:
```kotlin
commonTest.dependencies {
    implementation(libs.kotlin.test)
    implementation(libs.sqldelight.sqlite.driver)  // In-memory JVM driver for tests
}
```

Then in the test:
```kotlin
val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
TinsuMobile.Schema.create(driver)
val db = TinsuMobile(driver)
```

**Important:** The `JdbcSqliteDriver` is JVM-only. If tests need to run on iOS too, create the test under `androidUnitTest`. For this story, JVM-only test coverage is acceptable — the AC says "a basic integration test" (singular).

### Existing Codebase State (from Story 1.2)

Story 1.2 established:
- Koin DI modules: `SharedModule` (empty), `AndroidModule` (empty), `IosModule` (empty) — ready for SqlDriver registration
- `TinsuApplication.kt` with Koin initialization on Android
- `KoinHelper.kt` for iOS Koin initialization
- `Result<T>` sealed interface and `AppError` types in `util/`
- Platform `Logger` with expect/actual pattern
- Feature package directories with `.gitkeep` files including `db/`
- Build verified: 209+ Gradle tasks, BUILD SUCCESSFUL

**Key files to modify:**
- `mobile/shared/build.gradle.kts` — add SQLDelight plugin + config block
- `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt` — add SqlDriver
- `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/IosModule.kt` — add SqlDriver
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt` — add TinsuMobile DB instance

**Key files to create:**
- 10 `.sq` files under `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/`
- 1 test file under `mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/db/`

### Previous Story Intelligence (Story 1.2)

Key learnings from Story 1.2:
- Gradle version catalog works correctly for dependency resolution
- Koin modules are scaffold (empty `module {}` blocks) — register real bindings now
- `TinsuApplication` handles Android Koin init, `KoinHelper.initKoin()` handles iOS
- iOS tests skip on non-macOS — expected and acceptable
- Build validation from `mobile/` directory: `./gradlew clean build`
- Code review found: Android Logger double-tag issue (fixed), initKoin double-init guard (fixed), iOS Logger error stackTrace (fixed)

### Git Intelligence

Recent commits:
- `97988ee` — Story 1.2: shared infrastructure (Koin DI, Result types, logging)
- `2b4c219` — Story 1.1: KMP project scaffold

Pattern: commits reference story number in message, e.g., `feat: ... (mobile-1-2)`.

### Naming Conventions

From architecture — strictly enforce:
- **Table names:** snake_case plural (`tasks`, `agent_runs`, `task_sessions`)
- **Column names:** snake_case (`created_at`, `task_id`, `display_name`)
- **Foreign keys:** `{referenced_table_singular}_id` (`epic_id`, `sprint_id`, `task_id`)
- **SQLDelight .sq files:** PascalCase (`Tasks.sq`, `AgentRuns.sq`, `DocumentCache.sq`)
- **Kotlin classes:** PascalCase (`TinsuMobile`)
- **No I prefix** on interfaces

[Source: architecture-mobile.md — Naming Patterns]
[Source: architecture-mobile.md — Database Naming (SQLDelight)]

### What NOT to Do

- Do NOT put `.sq` files in `kotlin/com/tinsu/mobile/db/` — they MUST go in `sqldelight/com/tinsu/mobile/db/`
- Do NOT create repositories, ViewModels, or data access layers (future stories)
- Do NOT create SSH/SFTP connection code (Story 2.x)
- Do NOT create sync logic or cache invalidation (Story 7.x)
- Do NOT add complex queries — only basic CRUD for now (selectAll, selectById, insert, deleteById)
- Do NOT modify the desktop Electron app
- Do NOT use `kotlin.Result` — the custom `Result<T>` from Story 1.2 is the domain standard
- Do NOT use raw SQL strings in Kotlin code — all queries go in `.sq` files
- Do NOT use `DEFAULT unixepoch()` in SQLDelight — SQLite's `unixepoch()` function is only available in SQLite 3.38+ and may not be available on all Android API levels. Instead, pass timestamps explicitly from Kotlin code

### Project Structure Notes

- `.sq` files: `mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/`
- Generated Kotlin: auto-generated by SQLDelight into build output — do not manually create
- `db/.gitkeep` in `kotlin/` dir can remain — future Kotlin source for db package (adapters, helpers) will go there
- Test file: `mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/db/ConnectionsTableTest.kt`

### References

- [Source: _bmad-output/planning-artifacts/epics-mobile.md — Epic 1, Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Data Architecture > Local Cache Schema]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Naming Patterns > Database Naming]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Anti-Patterns to Avoid (Raw SQL strings)]
- [Source: src/main/db/schema.ts — Desktop Drizzle ORM table definitions (column reference)]
- [Source: _bmad-output/implementation-artifacts/mobile-1-2-implement-shared-infrastructure-di-error-types-and-logging.md — Previous story context]
- [SQLDelight 2.2.1 KMP documentation: https://cashapp.github.io/sqldelight/2.0/multiplatform_sqlite/]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- sqlite-driver is JVM-only; moved test from commonTest to androidUnitTest source set to avoid iOS compilation failure
- Added Projects.sq to satisfy foreign key references from tasks, sprints, and epics tables (desktop projects table mirrored)
- SQLDelight task name is `generateSqlDelightInterface` (not `generateCommonMainTinsuMobileDatabaseInterface` as story suggested)

### Completion Notes List

- Configured SQLDelight 2.2.1 plugin with TinsuMobile database generating to `com.tinsu.mobile.db` package
- Created 11 .sq files (6 mirrored desktop + 4 mobile-only + 1 projects table for FK references)
- All tables use snake_case naming, foreign keys follow `{table_singular}_id` convention, timestamps are INTEGER
- Each .sq file has CREATE TABLE + indexes + basic CRUD queries (selectAll, selectById, insert, deleteById)
- Registered SqlDriver in Koin: AndroidSqliteDriver (Android), NativeSqliteDriver (iOS), TinsuMobile instance (shared)
- 4 integration tests verify insert/query/delete/selectAll on connections table using JdbcSqliteDriver in-memory
- All 20 tests pass (16 existing + 4 new), Android APK builds successfully

### Change Log

- 2026-04-07: Implemented SQLDelight local cache schema with 11 tables, Koin DI registration, and integration tests

### File List

- mobile/shared/build.gradle.kts (modified — added sqldelight plugin, database config block, test dependency)
- mobile/gradle/libs.versions.toml (modified — added sqldelight-sqlite-driver library entry)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Tasks.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Sprints.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Epics.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/AgentRuns.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/TaskSessions.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/TaskActivities.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Connections.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/DocumentCache.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/ChatCache.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/AppPreferences.sq (new)
- mobile/shared/src/commonMain/sqldelight/com/tinsu/mobile/db/Projects.sq (new — required for FK references)
- mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt (modified — added SqlDriver registration)
- mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/IosModule.kt (modified — added SqlDriver registration)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt (modified — added TinsuMobile DB instance)
- mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/db/ConnectionsTableTest.kt (new)
- mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt (modified — replaced GlobalContext.getOrNull() with try/catch for iOS KMP compatibility)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified — status update to review)
- _bmad-output/implementation-artifacts/mobile-1-3-set-up-sqldelight-local-cache-schema.md (modified — task completion)
