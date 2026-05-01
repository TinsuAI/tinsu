//! Pull remote per-project SQLite DB to local cache via SSH exec + base64 transfer.
#![allow(dead_code)]
//!
//! Since russh-sftp is not in Cargo.toml, we implement "SFTP-equivalent" operations
//! using SSH exec:
//!   - stat:    `test -f <path> && echo EXISTS || echo MISSING`
//!   - download: `base64 < <path>` → decode locally
//!   - upload:   `base64 -d > <path>.tmp && mv <path>.tmp <path>` (push.rs)

use crate::db::entities::ssh_connection;
use crate::db::{ProjectDb, ProjectDbRegistry};
use crate::error::AppError;
use crate::services::ssh_service;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, EntityTrait, Statement};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

/// SSH parameters bundled for convenience.
pub(crate) struct SshParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub key_name: String,
}

/// Load the SSH connection record for `connection_id` from the local DB.
pub(crate) async fn load_ssh_params(
    connection_id: &str,
    local_db: &DatabaseConnection,
) -> Result<SshParams, AppError> {
    let conn = ssh_connection::Entity::find_by_id(connection_id)
        .one(local_db)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("SSH connection '{}' not found", connection_id))
        })?;

    let key_name = conn.key_name.ok_or_else(|| {
        AppError::BadRequest(format!(
            "SSH connection '{}' uses password auth; key auth required for sync",
            connection_id
        ))
    })?;

    Ok(SshParams {
        host: conn.host,
        port: conn.port as u16,
        username: conn.username,
        key_name,
    })
}

/// Remote path for a project's DB file.
pub(crate) fn remote_db_path(remote_project_id: &str) -> String {
    format!("~/.tinsu/projects/{}/tinsu.db", remote_project_id)
}

/// Remote tmp path used during upload.
pub(crate) fn remote_db_tmp_path(remote_project_id: &str) -> String {
    format!("~/.tinsu/projects/{}/tinsu.db.tmp", remote_project_id)
}

/// Pull the remote project DB to local cache.
///
/// Behaviour:
/// - If the remote file is missing: create an empty local cache, run `init_project_schema`,
///   push it to the remote, and return the cache path.
/// - If the remote file exists: download it via SSH (base64), write atomically to
///   `<cache>.db.tmp`, rename to `<cache>.db`, update `remote_project_cache.last_pull_at`.
pub async fn pull_remote_db(
    connection_id: &str,
    remote_project_id: &str,
    app_handle: &AppHandle,
) -> Result<PathBuf, AppError> {
    let local_db = app_handle.state::<DatabaseConnection>();
    let registry = app_handle.state::<Arc<ProjectDbRegistry>>();

    let ssh = load_ssh_params(connection_id, local_db.inner()).await?;

    // Derive local cache paths.
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app_data_dir: {e}")))?;
    let cache_dir = app_data_dir.join("remote-cache");
    std::fs::create_dir_all(&cache_dir)?;
    let cache_path = cache_dir.join(format!("{}.db", remote_project_id));
    let cache_tmp = cache_dir.join(format!("{}.db.tmp", remote_project_id));

    // Check whether the remote file exists.
    let remote_path = remote_db_path(remote_project_id);
    let check_cmd = format!(
        "test -f {remote_path} && echo EXISTS || echo MISSING"
    );
    let check_out = tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        ssh_service::run_ssh_exec(
            &ssh.host,
            ssh.port,
            &ssh.username,
            "key",
            Some(&ssh.key_name),
            None,
            &check_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("SSH stat timed out".into()))??;

    let remote_exists = check_out.trim() == "EXISTS";

    if !remote_exists {
        // Remote DB doesn't exist yet — bootstrap:
        // 1. Open/create local cache (registry does this + runs schema init).
        crate::commands::sync::emit_sync_status(app_handle, remote_project_id, "pulling", None);
        let project_db = registry
            .get_or_open_remote(remote_project_id, connection_id)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // 2. Push empty DB to remote so other devices can pull.
        crate::sync::push::push_remote_db(connection_id, remote_project_id, app_handle).await?;

        let path = match &project_db {
            ProjectDb::Remote { cache_path, .. } => cache_path.clone(),
            _ => unreachable!("get_or_open_remote always returns Remote variant"),
        };
        return Ok(path);
    }

    // Remote exists — download it.
    crate::commands::sync::emit_sync_status(app_handle, remote_project_id, "pulling", None);
    let download_cmd = format!("base64 {remote_path}");
    let b64_data = tokio::time::timeout(
        tokio::time::Duration::from_secs(60),
        ssh_service::run_ssh_exec(
            &ssh.host,
            ssh.port,
            &ssh.username,
            "key",
            Some(&ssh.key_name),
            None,
            &download_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("SSH download timed out".into()))??;

    // Decode base64. `base64` CLI wraps at 76 cols by default — strip ALL whitespace.
    let b64_clean: String = b64_data.chars().filter(|c| !c.is_whitespace()).collect();
    let db_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        b64_clean.as_bytes(),
    )
    .map_err(|e| AppError::Internal(format!("base64 decode failed: {e}")))?;

    // Atomic write: tmp → rename.
    std::fs::write(&cache_tmp, &db_bytes)?;
    std::fs::rename(&cache_tmp, &cache_path)?;

    // Update `remote_project_cache.last_pull_at` in the local DB.
    let now = now_unix_secs();
    update_cache_row(
        local_db.inner(),
        remote_project_id,
        &cache_path.to_string_lossy(),
        Some(now),
        None,
    )
    .await?;

    // Signal idle after a successful pull.
    crate::commands::sync::emit_sync_status(app_handle, remote_project_id, "idle", None);

    Ok(cache_path)
}

// ---------------------------------------------------------------------------
// Helpers shared by other sync submodules
// ---------------------------------------------------------------------------

pub(crate) fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Upsert a row in `remote_project_cache`.
pub(crate) async fn update_cache_row(
    local_db: &DatabaseConnection,
    remote_project_id: &str,
    local_db_path: &str,
    last_pull_at: Option<i64>,
    last_push_at: Option<i64>,
) -> Result<(), AppError> {
    // Build SET clause dynamically.
    let pull_clause = last_pull_at
        .map(|v| format!(", last_pull_at = {v}"))
        .unwrap_or_default();
    let push_clause = last_push_at
        .map(|v| format!(", last_push_at = {v}"))
        .unwrap_or_default();

    let sql = format!(
        "INSERT INTO remote_project_cache (remote_project_id, local_db_path, last_pull_at, last_push_at)
         VALUES ('{remote_project_id}', '{local_db_path}',
                 {pull_v}, {push_v})
         ON CONFLICT(remote_project_id) DO UPDATE SET
             local_db_path = excluded.local_db_path
             {pull_clause}
             {push_clause}",
        pull_v = last_pull_at.map(|v| v.to_string()).unwrap_or("NULL".to_string()),
        push_v = last_push_at.map(|v| v.to_string()).unwrap_or("NULL".to_string()),
    );

    local_db
        .execute(Statement::from_string(DbBackend::Sqlite, sql))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}
