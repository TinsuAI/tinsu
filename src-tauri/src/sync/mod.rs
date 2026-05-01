//! Sync engine for per-project remote SQLite DBs.
// Phase 2a — public API not yet called by Phase 2b handlers; silence dead_code lints.
#![allow(dead_code)]
//!
//! ## Phase 2a — Internal API only (no Tauri command handlers).
//!
//! ### Submodules
//! - `pull`      — Download remote DB to local cache via SSH exec + base64.
//! - `push`      — Upload local cache to remote host; `PushDebouncer` batches writes.
//! - `lease`     — Claim/check/heartbeat lease stored in `_meta` table.
//! - `heartbeat` — Background task that calls `lease::heartbeat` every 15 s.
//!
//! ### Open/close flow (public API of this module)
//! ```ignore
//! // Open:
//! let project_db = sync::open_remote_project(connection_id, remote_project_id, &app_handle).await?;
//!
//! // After each write:
//! sync::schedule_push_after_write(remote_project_id, connection_id, &app_handle);
//!
//! // Close:
//! sync::close_remote_project(remote_project_id, connection_id, &app_handle).await?;
//! ```

pub mod heartbeat;
pub mod lease;
pub mod pull;
pub mod push;

use crate::db::{ProjectDb, ProjectDbRegistry};
use crate::error::AppError;
use heartbeat::HeartbeatRegistry;
use push::PushDebouncer;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement};
use std::sync::Arc;
use tauri::{AppHandle, Manager};

// ---------------------------------------------------------------------------
// open_remote_project
// ---------------------------------------------------------------------------

/// Full open flow for a remote project:
///
/// 1. Pull the remote DB (or bootstrap if missing).
/// 2. Register the `ProjectDb` in `ProjectDbRegistry`.
/// 3. Read `device_id` from local `settings` table.
/// 4. Claim the lease in the project DB.
/// 5. Push (so the remote sees the lease claim).
/// 6. Spawn a heartbeat task.
///
/// Returns the `ProjectDb` handle ready for use by command handlers.
pub async fn open_remote_project(
    connection_id: &str,
    remote_project_id: &str,
    app_handle: &AppHandle,
) -> Result<ProjectDb, AppError> {
    // 1. Pull remote → local cache.
    let _cache_path =
        pull::pull_remote_db(connection_id, remote_project_id, app_handle).await?;

    // 2. Open / register in ProjectDbRegistry.
    let registry = app_handle.state::<Arc<ProjectDbRegistry>>();
    let project_db = registry
        .get_or_open_remote(remote_project_id, connection_id)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 3. Read device_id from local settings.
    let local_db = app_handle.state::<DatabaseConnection>();
    let device_id = read_device_id(local_db.inner()).await?;

    // 4. Claim the lease.
    lease::claim_lease(&project_db, &device_id).await?;

    // 5. Push (remote sees the new lease_device_id).
    push::push_remote_db(connection_id, remote_project_id, app_handle).await?;

    // 6. Spawn heartbeat.
    heartbeat::spawn_heartbeat_task(
        remote_project_id.to_owned(),
        connection_id.to_owned(),
        device_id,
        project_db.clone(),
        app_handle.clone(),
    );

    tracing::info!(
        "open_remote_project: opened '{}' via connection '{}'",
        remote_project_id,
        connection_id
    );

    Ok(project_db)
}

// ---------------------------------------------------------------------------
// close_remote_project
// ---------------------------------------------------------------------------

/// Full close flow for a remote project:
///
/// 1. Flush any pending debounced push (write in-flight changes).
/// 2. Stop the heartbeat task.
/// 3. Drop from `ProjectDbRegistry` (not yet implemented in registry — left as no-op
///    until Phase 2b adds `remove` to the registry).
pub async fn close_remote_project(
    remote_project_id: &str,
    connection_id: &str,
    app_handle: &AppHandle,
) -> Result<(), AppError> {
    // 1. Flush pending push.
    let debouncer = app_handle.state::<Arc<PushDebouncer>>();
    debouncer
        .flush(remote_project_id, connection_id, app_handle)
        .await?;

    // 2. Stop heartbeat.
    let heartbeat_registry = app_handle.state::<Arc<HeartbeatRegistry>>();
    heartbeat_registry.stop(remote_project_id);

    // 3. NOTE: ProjectDbRegistry has no `remove` in Phase 1 — connection stays
    //    open but is harmless.  Phase 2b can add `remove()` when needed.

    tracing::info!("close_remote_project: closed '{}'", remote_project_id);
    Ok(())
}

// ---------------------------------------------------------------------------
// schedule_push_after_write
// ---------------------------------------------------------------------------

/// Schedule a debounced push 500 ms after a write to a remote project DB.
///
/// Call this after any command that mutates a remote project's `ProjectDb`.
/// Multiple rapid calls are coalesced — only one push fires 500 ms after the
/// *last* `schedule_push_after_write` call for a given project.
pub fn schedule_push_after_write(
    remote_project_id: &str,
    connection_id: &str,
    app_handle: &AppHandle,
) {
    let debouncer = app_handle.state::<Arc<PushDebouncer>>();
    debouncer.schedule(
        remote_project_id.to_owned(),
        connection_id.to_owned(),
        app_handle.clone(),
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read the stable `device_id` from the local `settings` table.
async fn read_device_id(local_db: &DatabaseConnection) -> Result<String, AppError> {
    let row = local_db
        .query_one(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT value FROM settings WHERE key = 'device_id' LIMIT 1".to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    row.as_ref()
        .and_then(|r| r.try_get_by_index::<String>(0).ok())
        .ok_or_else(|| AppError::Internal("device_id not found in settings".into()))
}
