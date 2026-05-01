pub mod entities;
pub mod migrate_remote_data;
pub mod project_schema;

use sea_orm::{ColumnTrait, Database, DatabaseConnection, DbErr, EntityTrait, QueryFilter, Statement};
use sea_orm::DbBackend;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::error::AppError;

// ---------------------------------------------------------------------------
// Local DB connection
// ---------------------------------------------------------------------------

pub async fn connect(data_dir: &std::path::Path) -> Result<DatabaseConnection, DbErr> {
    std::fs::create_dir_all(data_dir).expect("Failed to create data directory");
    let db_path = data_dir.join("tinsu.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
    Database::connect(db_url).await
}

// ---------------------------------------------------------------------------
// Per-project DB abstraction
// ---------------------------------------------------------------------------

/// A handle to either the local tinsu.db (for local projects) or a per-project
/// SQLite cache file (for remote projects).
///
/// Phase 2 will plumb this into command handlers; Phase 1 only defines the
/// types and registry so the codebase compiles and the abstraction is available.
#[derive(Clone)]
pub enum ProjectDb {
    /// A project whose data lives in the shared local `tinsu.db`.
    Local(Arc<DatabaseConnection>),
    /// A project whose authoritative data lives on a remote host; locally we
    /// operate against a cached SQLite file.
    Remote {
        conn: Arc<DatabaseConnection>,
        remote_project_id: String,
        /// SSH connection ID used to route push/pull to the correct remote host.
        connection_id: String,
        cache_path: PathBuf,
    },
}

impl ProjectDb {
    /// Return a reference to the underlying sea-orm connection.
    pub fn connection(&self) -> &DatabaseConnection {
        match self {
            ProjectDb::Local(c) => c.as_ref(),
            ProjectDb::Remote { conn, .. } => conn.as_ref(),
        }
    }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/// Holds open per-project database connections, keyed by project_id (local
/// UUID) for Local entries or remote_project_id for Remote entries.
///
/// Backed by a plain `HashMap` under a `Mutex` — connections are opened once
/// and cached for the lifetime of the app.  A `DashMap` would be ideal for
/// lock-free reads but adds a dependency; `Mutex<HashMap>` is sufficient for
/// Phase 1 and avoids pulling in a new crate.
pub struct ProjectDbRegistry {
    inner: Mutex<HashMap<String, ProjectDb>>,
    /// App data directory, used to compute cache file paths for remote DBs.
    app_data_dir: PathBuf,
}

impl ProjectDbRegistry {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            app_data_dir,
        }
    }

    /// Return the cache directory for remote project DB files.
    fn remote_cache_dir(&self) -> PathBuf {
        self.app_data_dir.join("remote-cache")
    }

    /// Resolve a `ProjectDb` for a local project.
    ///
    /// The registry stores a shared `Arc<DatabaseConnection>` for the local
    /// pool.  Callers that only need the local connection should continue
    /// using the `DatabaseConnection` managed in `AppState` directly; this
    /// method exists for uniformity with Phase 2 lookups.
    pub fn get_local(&self, project_id: &str, local_conn: Arc<DatabaseConnection>) -> ProjectDb {
        let mut map = self.inner.lock().expect("ProjectDbRegistry mutex poisoned");
        map.entry(project_id.to_owned())
            .or_insert_with(|| ProjectDb::Local(local_conn))
            .clone()
    }

    /// Return a cached `ProjectDb` for a remote project (read-only — does NOT open connections).
    ///
    /// Returns `Err` if the connection is not already open.  Opening is handled
    /// by Phase 2a's `open_remote_project` lifecycle command.
    pub fn get_remote(&self, remote_project_id: &str) -> Result<ProjectDb, AppError> {
        let map = self.inner.lock().expect("ProjectDbRegistry mutex poisoned");
        map.get(remote_project_id)
            .cloned()
            .ok_or_else(|| AppError::Internal(format!(
                "remote project not open: {remote_project_id}"
            )))
    }

    /// Open (or return a cached) `ProjectDb` for a remote project.
    ///
    /// On first call for a given `remote_project_id`:
    ///   1. Derives the local cache path as `<app_data>/remote-cache/<id>.db`.
    ///   2. Creates the directory if needed.
    ///   3. Opens a WAL-mode SQLite connection.
    ///   4. Runs `init_project_schema` to create tables if the file is new.
    ///   5. Stores the connection in the registry.
    ///
    /// Returns an error if the DB cannot be opened or schema init fails.
    pub async fn get_or_open_remote(
        &self,
        remote_project_id: &str,
        connection_id: &str,
    ) -> Result<ProjectDb, DbErr> {
        // Fast path: already open.
        {
            let map = self.inner.lock().expect("ProjectDbRegistry mutex poisoned");
            if let Some(existing) = map.get(remote_project_id) {
                return Ok(existing.clone());
            }
        }

        // Slow path: open the cache file.
        let cache_dir = self.remote_cache_dir();
        std::fs::create_dir_all(&cache_dir).map_err(|e| {
            DbErr::Custom(format!(
                "Failed to create remote-cache directory {}: {}",
                cache_dir.display(),
                e
            ))
        })?;

        let cache_path = cache_dir.join(format!("{}.db", remote_project_id));
        let db_url = format!(
            "sqlite://{}?mode=rwc",
            cache_path.display()
        );

        let conn = Database::connect(db_url).await?;

        // Initialise schema (idempotent — uses CREATE IF NOT EXISTS).
        project_schema::init_project_schema(&conn).await?;

        let entry = ProjectDb::Remote {
            conn: Arc::new(conn),
            remote_project_id: remote_project_id.to_owned(),
            connection_id: connection_id.to_owned(),
            cache_path: cache_path.clone(),
        };

        {
            let mut map = self.inner.lock().expect("ProjectDbRegistry mutex poisoned");
            // Another task may have raced us; prefer the winner's entry.
            map.entry(remote_project_id.to_owned())
                .or_insert(entry.clone());
        }

        Ok(entry)
    }
}

// ---------------------------------------------------------------------------
// Project DB resolution helper
// ---------------------------------------------------------------------------

/// Resolve the right `ProjectDb` for a given `project_id`.
///
/// - Looks up the `projects` row in the local DB.
/// - If `remote_project_id IS NULL` → returns `ProjectDb::Local` wrapping the local pool.
/// - If `remote_project_id IS NOT NULL` → calls `registry.get_remote(...)`.  The
///   connection must already be open (opened by Phase 2a's lifecycle command); if it
///   is not, an error is returned.
///
/// Local-scoped tables (`projects`, `remote_projects`, `ssh_connections`, `settings`,
/// `remote_project_cache`) should always be queried directly against `local_db`.
pub async fn resolve_project_db(
    local_db: &DatabaseConnection,
    registry: &ProjectDbRegistry,
    project_id: &str,
) -> Result<ProjectDb, AppError> {
    use entities::project;

    let row = project::Entity::find_by_id(project_id)
        .one(local_db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {project_id}")))?;

    match row.remote_project_id {
        None => {
            // Local project — share the existing pool handle via Arc.
            Ok(ProjectDb::Local(Arc::new(local_db.clone())))
        }
        Some(ref rp_id) => {
            // Remote project — must already be open.
            // First try the cache (fast path); if not yet open, return error
            // (open_remote_project lifecycle command must be called first).
            registry.get_remote(rp_id)
        }
    }
}

/// Like `resolve_project_db` but also fetches `connection_id` from `remote_projects`
/// when the project is remote. Used by migration code that needs to open fresh
/// connections without requiring a prior `open_remote_project` call.
pub async fn resolve_project_db_with_connection_id(
    local_db: &DatabaseConnection,
    registry: &ProjectDbRegistry,
    project_id: &str,
) -> Result<(ProjectDb, Option<String>), AppError> {
    use entities::{project, remote_project};

    let row = project::Entity::find_by_id(project_id)
        .one(local_db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {project_id}")))?;

    match row.remote_project_id {
        None => Ok((ProjectDb::Local(Arc::new(local_db.clone())), None)),
        Some(ref rp_id) => {
            // Fetch connection_id from remote_projects table.
            let rp = remote_project::Entity::find_by_id(rp_id.as_str())
                .one(local_db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound(format!("remote_project not found: {rp_id}")))?;
            let connection_id = rp.connection_id.clone();
            let project_db = registry.get_remote(rp_id)?;
            Ok((project_db, Some(connection_id)))
        }
    }
}

/// Fetch the `connection_id` for an already-resolved `ProjectDb::Remote`.
/// Returns `None` for `ProjectDb::Local`.
pub fn project_db_connection_id(project_db: &ProjectDb) -> Option<&str> {
    match project_db {
        ProjectDb::Remote { connection_id, .. } => Some(connection_id.as_str()),
        ProjectDb::Local(_) => None,
    }
}

/// Fetch the `remote_project_id` for an already-resolved `ProjectDb::Remote`.
/// Returns `None` for `ProjectDb::Local`.
pub fn project_db_remote_id(project_db: &ProjectDb) -> Option<&str> {
    match project_db {
        ProjectDb::Remote { remote_project_id, .. } => Some(remote_project_id.as_str()),
        ProjectDb::Local(_) => None,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use crate::migration::Migrator;
    use sea_orm_migration::MigratorTrait;
    use sea_orm::{ConnectionTrait, Database, DbBackend, Statement};

    #[tokio::test]
    async fn test_migrations_create_all_tables() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        Migrator::up(&db, None).await.unwrap();

        let expected_tables = vec![
            "projects",
            "settings",
            "sprints",
            "epics",
            "tasks",
            "agent_runs",
            "planning_artifact_statuses",
            "task_artifacts",
            "task_sessions",
            "session_history",
            "task_activities",
            "task_versions",
            "workflow_runs",
            "gate_decisions",
            "chat_sessions",
            "chat_messages",
            "chat_message_attachments",
            "ssh_connections",
            "remote_projects",
            "remote_project_cache",
        ];

        for table in expected_tables {
            let result = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [table.into()],
                ))
                .await
                .unwrap();
            assert!(result.is_some(), "Table '{}' should exist", table);
        }
    }

    #[tokio::test]
    async fn test_project_schema_init() {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        super::project_schema::init_project_schema(&db).await.unwrap();

        let expected_tables = vec![
            "_meta",
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

        for table in expected_tables {
            let result = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [table.into()],
                ))
                .await
                .unwrap();
            assert!(result.is_some(), "Per-project table '{}' should exist", table);
        }
    }
}
