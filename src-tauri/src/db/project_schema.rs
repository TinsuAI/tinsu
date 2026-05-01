/// Schema initialiser for per-remote-project SQLite databases.
///
/// Each remote project gets its own SQLite file (cached locally at
/// `<app_data>/remote-cache/<remote_project_id>.db`).  This module creates
/// the project-scoped tables and the `_meta` housekeeping table in a fresh DB.
///
/// This is intentionally NOT wired into the main `Migrator` — it runs against
/// per-project connections, not the local `tinsu.db`.
use sea_orm::{ConnectionTrait, DatabaseConnection, DbErr, Statement};
use sea_orm::DbBackend;

/// Run all DDL needed to initialise a brand-new per-project database.
///
/// Safe to call on an existing DB — every statement uses `CREATE TABLE IF NOT EXISTS`.
pub async fn init_project_schema(db: &DatabaseConnection) -> Result<(), DbErr> {
    // Enable WAL mode for better concurrent read performance.
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "PRAGMA journal_mode=WAL".to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // _meta — lease tracking and schema versioning
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS _meta (
            id                INTEGER PRIMARY KEY NOT NULL DEFAULT 1,
            schema_version    INTEGER NOT NULL DEFAULT 1,
            lease_device_id   TEXT,
            lease_claimed_at  INTEGER,
            lease_heartbeat_at INTEGER,
            created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
            CHECK (id = 1)
        )"
        .to_owned(),
    ))
    .await?;

    // Seed the single _meta row if the table was just created.
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "INSERT OR IGNORE INTO _meta (id, schema_version, created_at)
         VALUES (1, 1, unixepoch())"
            .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // sprints
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS sprints (
            id              TEXT PRIMARY KEY NOT NULL,
            name            TEXT NOT NULL,
            start_date      TEXT,
            end_date        TEXT,
            status          TEXT NOT NULL DEFAULT 'active',
            goal            TEXT,
            velocity        INTEGER,
            capacity        INTEGER,
            project_id      TEXT NOT NULL,
            story_prefix    TEXT,
            epics_file_path TEXT,
            created_at      INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints (project_id)".to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // epics
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS epics (
            id           TEXT PRIMARY KEY NOT NULL,
            title        TEXT NOT NULL,
            description  TEXT,
            color        TEXT,
            epic_number  INTEGER,
            goal         TEXT,
            sprint_id    TEXT,
            project_id   TEXT NOT NULL,
            created_at   INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics (project_id)".to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_epics_sprint_id ON epics (sprint_id)".to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // tasks
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS tasks (
            id                    TEXT PRIMARY KEY NOT NULL,
            title                 TEXT NOT NULL,
            description           TEXT,
            status                TEXT NOT NULL DEFAULT 'backlog',
            sort_order            INTEGER NOT NULL DEFAULT 0,
            epic_id               TEXT,
            sprint_id             TEXT,
            task_type             TEXT NOT NULL DEFAULT 'basic',
            phase_number          INTEGER,
            phase_name            TEXT,
            bmad_agent            TEXT,
            bmad_workflow         TEXT,
            is_start_here         INTEGER NOT NULL DEFAULT 0,
            artifact_path         TEXT,
            story_number          TEXT,
            story_file_path       TEXT,
            full_content          TEXT,
            story_file_status     TEXT,
            context_notes         TEXT,
            project_id            TEXT NOT NULL,
            worktree_path         TEXT,
            branch_name           TEXT,
            merge_commit_sha      TEXT,
            has_merge_conflict    INTEGER NOT NULL DEFAULT 0,
            conflict_files        TEXT,
            worktree_skipped      INTEGER NOT NULL DEFAULT 0,
            rejection_feedback    TEXT,
            rejected_agent_run_id TEXT,
            inline_comments       TEXT,
            rejection_count       INTEGER NOT NULL DEFAULT 0,
            last_review_commit    TEXT,
            created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    for idx in &[
        "CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks (status)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks (sprint_id)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_epic_id   ON tasks (epic_id)",
    ] {
        db.execute(Statement::from_string(DbBackend::Sqlite, idx.to_string()))
            .await?;
    }

    // -----------------------------------------------------------------------
    // planning_artifact_statuses
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS planning_artifact_statuses (
            id           TEXT PRIMARY KEY NOT NULL,
            project_id   TEXT NOT NULL,
            artifact_key TEXT NOT NULL,
            status       TEXT NOT NULL,
            updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pas_project_artifact \
         ON planning_artifact_statuses (project_id, artifact_key)"
            .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // task_artifacts
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS task_artifacts (
            id            TEXT PRIMARY KEY NOT NULL,
            task_id       TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            artifact_path TEXT NOT NULL,
            section_ref   TEXT,
            created_at    INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts (task_id)"
            .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // task_sessions
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS task_sessions (
            id                    TEXT PRIMARY KEY NOT NULL,
            task_id               TEXT NOT NULL UNIQUE,
            session_id            TEXT,
            tmux_session          TEXT,
            current_phase         TEXT,
            remote_connection_id  TEXT,
            remote_project_id     TEXT,
            created_at            INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // task_activities
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS task_activities (
            id         TEXT PRIMARY KEY NOT NULL,
            task_id    TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload    TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    for idx in &[
        "CREATE INDEX IF NOT EXISTS idx_task_activities_task_id    ON task_activities (task_id)",
        "CREATE INDEX IF NOT EXISTS idx_task_activities_event_type ON task_activities (event_type)",
    ] {
        db.execute(Statement::from_string(DbBackend::Sqlite, idx.to_string()))
            .await?;
    }

    // -----------------------------------------------------------------------
    // task_versions
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS task_versions (
            id                 TEXT PRIMARY KEY NOT NULL,
            task_id            TEXT NOT NULL,
            version_number     INTEGER NOT NULL,
            commit_sha         TEXT,
            rejection_feedback TEXT,
            inline_comments    TEXT,
            status_outcome     TEXT,
            created_at         INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_task_versions_task_id ON task_versions (task_id)"
            .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // workflow_runs
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS workflow_runs (
            id               TEXT PRIMARY KEY NOT NULL,
            project_id       TEXT NOT NULL,
            workflow_key     TEXT NOT NULL,
            phase            TEXT,
            status           TEXT NOT NULL DEFAULT 'pending',
            started_at       INTEGER,
            finished_at      INTEGER,
            input_artifacts  TEXT,
            output_artifacts TEXT,
            agent_name       TEXT,
            task_id          TEXT
        )"
        .to_owned(),
    ))
    .await?;

    for idx in &[
        "CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_id ON workflow_runs (project_id)",
        "CREATE INDEX IF NOT EXISTS idx_workflow_runs_task_id    ON workflow_runs (task_id)",
    ] {
        db.execute(Statement::from_string(DbBackend::Sqlite, idx.to_string()))
            .await?;
    }

    // -----------------------------------------------------------------------
    // gate_decisions
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS gate_decisions (
            id              TEXT PRIMARY KEY NOT NULL,
            project_id      TEXT NOT NULL,
            decision        TEXT NOT NULL,
            rationale       TEXT,
            issues          TEXT,
            created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
            workflow_run_id TEXT
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_gate_decisions_project_id ON gate_decisions (project_id)"
            .to_owned(),
    ))
    .await?;

    // -----------------------------------------------------------------------
    // chat_sessions
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id               TEXT PRIMARY KEY NOT NULL,
            session_uuid     TEXT NOT NULL UNIQUE,
            agent_persona    TEXT,
            workflow_phase   TEXT,
            project_id       TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'active',
            created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
            last_message_at  INTEGER,
            workflow_key     TEXT,
            skip_permissions INTEGER NOT NULL DEFAULT 0,
            tmux_session     TEXT
        )"
        .to_owned(),
    ))
    .await?;

    for idx in &[
        "CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions (project_id)",
        "CREATE INDEX IF NOT EXISTS idx_chat_sessions_uuid       ON chat_sessions (session_uuid)",
    ] {
        db.execute(Statement::from_string(DbBackend::Sqlite, idx.to_string()))
            .await?;
    }

    // -----------------------------------------------------------------------
    // chat_messages
    // -----------------------------------------------------------------------
    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id         TEXT PRIMARY KEY NOT NULL,
            session_id TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            tool_name  TEXT,
            tool_input TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )"
        .to_owned(),
    ))
    .await?;

    db.execute(Statement::from_string(
        DbBackend::Sqlite,
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id)"
            .to_owned(),
    ))
    .await?;

    Ok(())
}
