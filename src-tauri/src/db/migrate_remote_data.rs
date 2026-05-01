//! Phase 3 one-shot migration: move project-scoped rows from the shared local
//! `tinsu.db` into per-project SQLite cache files for remote projects.
//!
//! ## Idempotency
//! - Per-project: checks `_meta.data_migration_done`. If 1, skips the project.
//! - Global: after all reachable remote projects have been migrated, sets
//!   `settings.remote_data_migrated = 'true'`. On the next launch this function
//!   returns immediately.
//!
//! ## Failure handling
//! - Any per-project error (open, copy, delete) → skip project with warning, continue.
//! - If at least one project fails → do NOT set global flag (retries on next launch).
//!
//! ## Tables migrated
//! tasks, sprints, epics, chat_sessions, chat_messages, planning_artifact_statuses,
//! task_artifacts, workflow_runs, gate_decisions, task_versions, task_activities,
//! task_sessions.

use crate::db::ProjectDbRegistry;
use crate::error::AppError;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// Names of all project-scoped tables that must be migrated.
/// Order: parents before children to respect implicit FK ordering.
const PROJECT_TABLES: &[&str] = &[
    "sprints",
    "epics",
    "tasks",
    "planning_artifact_statuses",
    "task_artifacts",
    "task_sessions",
    "task_activities",
    "task_versions",
    "workflow_runs",
    "gate_decisions",
    "chat_sessions",
    "chat_messages",
];

/// Entry point called from `lib.rs` inside `tokio::spawn`.
/// Non-fatal: all errors are logged as warnings.
pub async fn run_remote_data_migration_if_needed(app_handle: AppHandle) {
    tracing::info!("remote_data_migration: starting scan");
    if let Err(e) = run_inner(&app_handle).await {
        tracing::warn!("remote_data_migration: top-level error: {}", e);
    } else {
        tracing::info!("remote_data_migration: scan complete");
    }
}

async fn run_inner(app_handle: &AppHandle) -> Result<(), AppError> {
    let local_db = app_handle.state::<DatabaseConnection>();
    let local_db: &DatabaseConnection = local_db.inner();

    // No global guard — rely on per-project `_meta.data_migration_done` so projects
    // added later are still picked up. Per-project check is cheap.

    // ── Find all remote projects (join projects → remote_projects) ───────────
    let remote_rows = local_db
        .query_all(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT p.id, p.remote_project_id, rp.connection_id \
             FROM projects p \
             JOIN remote_projects rp ON rp.id = p.remote_project_id \
             WHERE p.remote_project_id IS NOT NULL"
                .to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    if remote_rows.is_empty() {
        tracing::info!("remote_data_migration: no remote projects yet, nothing to do");
        return Ok(());
    }

    tracing::info!(
        "remote_data_migration: found {} remote project(s) to check",
        remote_rows.len()
    );

    let registry = app_handle.state::<Arc<ProjectDbRegistry>>();
    let mut all_ok = true;

    for row in &remote_rows {
        let local_project_id: String = match row.try_get_by_index::<String>(0) {
            Ok(v) if !v.is_empty() => v,
            _ => continue,
        };
        let remote_project_id: String = match row.try_get_by_index::<String>(1) {
            Ok(v) if !v.is_empty() => v,
            _ => continue,
        };
        let connection_id: String = match row.try_get_by_index::<String>(2) {
            Ok(v) if !v.is_empty() => v,
            _ => continue,
        };

        tracing::info!(
            "remote_data_migration: processing project '{}' → remote '{}'",
            local_project_id,
            remote_project_id
        );

        match migrate_one_project(
            local_db,
            &registry,
            &local_project_id,
            &remote_project_id,
            &connection_id,
            app_handle,
        )
        .await
        {
            Ok(()) => {
                tracing::info!(
                    "remote_data_migration: project '{}' done",
                    local_project_id
                );
            }
            Err(e) => {
                tracing::warn!(
                    "remote_data_migration: project '{}' skipped — {}",
                    local_project_id,
                    e
                );
                all_ok = false;
            }
        }
    }

    if !all_ok {
        tracing::warn!(
            "remote_data_migration: one or more projects skipped — will retry on next launch"
        );
    }

    Ok(())
}

/// Migrate a single remote project: copy rows local→cache, delete local rows, push.
async fn migrate_one_project(
    local_db: &DatabaseConnection,
    registry: &Arc<ProjectDbRegistry>,
    local_project_id: &str,
    remote_project_id: &str,
    connection_id: &str,
    app_handle: &AppHandle,
) -> Result<(), AppError> {
    // Open / get the per-project DB (creates the cache file + schema if new).
    // We intentionally do NOT pull from remote first — we want to write local data
    // into the cache, then push.  Pulling first would lose local rows not yet on remote.
    let project_db = registry
        .get_or_open_remote(remote_project_id, connection_id)
        .await
        .map_err(|e| AppError::Database(format!("open per-project DB: {}", e)))?;

    let project_conn = project_db.connection();

    // ── Per-project idempotency guard ────────────────────────────────────────
    // Ensure the _meta column exists (added by this migration; older schema lacks it).
    let _ = project_conn
        .execute(Statement::from_string(
            DbBackend::Sqlite,
            "ALTER TABLE _meta ADD COLUMN data_migration_done INTEGER NOT NULL DEFAULT 0"
                .to_owned(),
        ))
        .await; // ignore if column already exists

    let already_migrated = project_conn
        .query_one(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT data_migration_done FROM _meta WHERE id = 1 LIMIT 1".to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .and_then(|r| r.try_get_by_index::<i64>(0).ok())
        .map(|v| v == 1)
        .unwrap_or(false);

    if already_migrated {
        tracing::info!(
            "remote_data_migration: project '{}' already migrated (_meta flag set), skipping",
            local_project_id
        );
        return Ok(());
    }

    tracing::info!(
        "remote_data_migration: project '{}' not yet migrated — copying rows",
        local_project_id
    );

    // ── Copy rows table by table ─────────────────────────────────────────────
    for &table in PROJECT_TABLES {
        if let Err(e) = migrate_table(local_db, project_conn, table, local_project_id).await {
            return Err(AppError::Internal(format!(
                "table '{}' copy failed: {}",
                table, e
            )));
        }
    }

    // ── Delete rows from local DB for this project ───────────────────────────
    // Only delete after all inserts succeed, so a failed copy leaves local rows intact.
    for &table in PROJECT_TABLES {
        if let Err(e) = delete_local_rows(local_db, table, local_project_id).await {
            // Non-fatal: local rows remain; per-project DB has the data.
            tracing::warn!(
                "remote_data_migration: could not delete local rows from '{}': {}",
                table,
                e
            );
        }
    }

    // ── Mark per-project done ────────────────────────────────────────────────
    project_conn
        .execute(Statement::from_string(
            DbBackend::Sqlite,
            "UPDATE _meta SET data_migration_done = 1 WHERE id = 1".to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // ── Schedule a push so the remote host receives the migrated data ─────────
    crate::sync::schedule_push_after_write(remote_project_id, connection_id, app_handle);

    Ok(())
}

/// Copy rows for `table` from local DB → per-project DB for the given `project_id`.
///
/// Skips the entire table if the per-project DB already has any rows for this
/// project (idempotency: assumes a previous partial run already wrote them).
async fn migrate_table(
    local_db: &DatabaseConnection,
    project_conn: &DatabaseConnection,
    table: &str,
    local_project_id: &str,
) -> Result<(), AppError> {
    let project_filter = project_column_filter(table);

    // Check existing rows in per-project DB.
    let count_sql = match project_filter {
        Some(col) => format!(
            "SELECT COUNT(*) FROM {} WHERE {} = '{}'",
            table, col, local_project_id
        ),
        None => table_count_via_subquery(table, local_project_id),
    };

    let existing: i64 = project_conn
        .query_one(Statement::from_string(DbBackend::Sqlite, count_sql))
        .await
        .map_err(|e| AppError::Database(format!("count {}: {}", table, e)))?
        .and_then(|r| r.try_get_by_index::<i64>(0).ok())
        .unwrap_or(0);

    if existing > 0 {
        tracing::debug!(
            "remote_data_migration: '{}' already has {} rows in per-project DB, skipping",
            table,
            existing
        );
        return Ok(());
    }

    // Discover columns from local DB schema.
    let col_rows = local_db
        .query_all(Statement::from_string(
            DbBackend::Sqlite,
            format!("PRAGMA table_info({})", table),
        ))
        .await
        .map_err(|e| AppError::Database(format!("PRAGMA table_info {}: {}", table, e)))?;

    if col_rows.is_empty() {
        tracing::warn!(
            "remote_data_migration: table '{}' not found in local DB, skipping",
            table
        );
        return Ok(());
    }

    let columns: Vec<String> = col_rows
        .iter()
        .filter_map(|r| r.try_get_by_index::<String>(1).ok())
        .collect();

    if columns.is_empty() {
        return Ok(());
    }

    let col_list = columns.join(", ");

    // SELECT from local DB.
    let select_sql = match project_filter {
        Some(col) => format!(
            "SELECT {} FROM {} WHERE {} = '{}'",
            col_list, table, col, local_project_id
        ),
        None => table_select_via_subquery(table, &col_list, local_project_id),
    };

    let source_rows = local_db
        .query_all(Statement::from_string(DbBackend::Sqlite, select_sql))
        .await
        .map_err(|e| AppError::Database(format!("SELECT from {}: {}", table, e)))?;

    if source_rows.is_empty() {
        tracing::debug!(
            "remote_data_migration: '{}' has no local rows for project '{}', skipping",
            table,
            local_project_id
        );
        return Ok(());
    }

    tracing::info!(
        "remote_data_migration: copying {} rows from '{}' for project '{}'",
        source_rows.len(),
        table,
        local_project_id
    );

    // Insert each row individually using INSERT OR IGNORE (safe on re-runs).
    let placeholders = vec!["?"; columns.len()].join(", ");
    let insert_sql = format!(
        "INSERT OR IGNORE INTO {} ({}) VALUES ({})",
        table, col_list, placeholders
    );

    for source_row in source_rows {
        let mut values: Vec<sea_orm::Value> = Vec::with_capacity(columns.len());
        for i in 0..columns.len() {
            let val: sea_orm::Value = if let Ok(v) = source_row.try_get_by_index::<String>(i) {
                sea_orm::Value::String(Some(Box::new(v)))
            } else if let Ok(v) = source_row.try_get_by_index::<i64>(i) {
                sea_orm::Value::BigInt(Some(v))
            } else {
                sea_orm::Value::String(None)
            };
            values.push(val);
        }

        project_conn
            .execute(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                &insert_sql,
                values,
            ))
            .await
            .map_err(|e| AppError::Database(format!("INSERT into {}: {}", table, e)))?;
    }

    Ok(())
}

/// Delete local rows for `table` that belong to `local_project_id`.
async fn delete_local_rows(
    local_db: &DatabaseConnection,
    table: &str,
    local_project_id: &str,
) -> Result<(), AppError> {
    let filter = project_column_filter(table);
    let sql = match filter {
        Some(col) => format!(
            "DELETE FROM {} WHERE {} = '{}'",
            table, col, local_project_id
        ),
        None => subquery_delete_sql(table, local_project_id),
    };

    local_db
        .execute(Statement::from_string(DbBackend::Sqlite, sql))
        .await
        .map_err(|e| AppError::Database(format!("DELETE from {}: {}", table, e)))?;

    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Tables that have a direct `project_id` column → return that column name.
/// Tables without one (task_artifacts, task_sessions, …) → return None.
fn project_column_filter(table: &str) -> Option<&'static str> {
    match table {
        "sprints"
        | "epics"
        | "tasks"
        | "planning_artifact_statuses"
        | "workflow_runs"
        | "gate_decisions"
        | "chat_sessions" => Some("project_id"),
        _ => None,
    }
}

/// COUNT SQL for tables that reach project via a join.
fn table_count_via_subquery(table: &str, project_id: &str) -> String {
    match table {
        "task_artifacts" | "task_sessions" | "task_activities" | "task_versions" => format!(
            "SELECT COUNT(*) FROM {} WHERE task_id IN \
             (SELECT id FROM tasks WHERE project_id = '{}')",
            table, project_id
        ),
        "chat_messages" => format!(
            "SELECT COUNT(*) FROM chat_messages WHERE session_id IN \
             (SELECT id FROM chat_sessions WHERE project_id = '{}')",
            project_id
        ),
        other => format!("SELECT COUNT(*) FROM {} /* fallback */", other),
    }
}

/// SELECT SQL for tables that reach project via a join.
fn table_select_via_subquery(table: &str, col_list: &str, project_id: &str) -> String {
    match table {
        "task_artifacts" | "task_sessions" | "task_activities" | "task_versions" => format!(
            "SELECT {} FROM {} WHERE task_id IN \
             (SELECT id FROM tasks WHERE project_id = '{}')",
            col_list, table, project_id
        ),
        "chat_messages" => format!(
            "SELECT {} FROM chat_messages WHERE session_id IN \
             (SELECT id FROM chat_sessions WHERE project_id = '{}')",
            col_list, project_id
        ),
        other => format!("SELECT {} FROM {} /* fallback */", col_list, other),
    }
}

/// DELETE SQL for tables that reach project via a join.
fn subquery_delete_sql(table: &str, project_id: &str) -> String {
    match table {
        "task_artifacts" | "task_sessions" | "task_activities" | "task_versions" => format!(
            "DELETE FROM {} WHERE task_id IN \
             (SELECT id FROM tasks WHERE project_id = '{}')",
            table, project_id
        ),
        "chat_messages" => format!(
            "DELETE FROM chat_messages WHERE session_id IN \
             (SELECT id FROM chat_sessions WHERE project_id = '{}')",
            project_id
        ),
        other => {
            tracing::warn!(
                "remote_data_migration: no delete strategy for '{}', skipping",
                other
            );
            format!("SELECT 1 /* no-op: unknown table {} */", other)
        }
    }
}

