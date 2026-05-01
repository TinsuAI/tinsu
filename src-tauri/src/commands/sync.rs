//! Sync lifecycle Tauri commands — thin wrappers over `crate::sync` API.
//!
//! These commands are called by the frontend at project open/close time and
//! by the "Take Over" / "Force Push" recovery buttons.
//!
//! Phase 3 owns push-hook wiring inside command handlers — this file does NOT
//! touch those call sites.

use crate::db::entities::remote_project;
use crate::error::AppError;
use sea_orm::{DatabaseConnection, EntityTrait};
use std::sync::Arc;
use tauri::{AppHandle, State};

// ---------------------------------------------------------------------------
// open_remote_project_sync
// ---------------------------------------------------------------------------

/// Open a remote project for sync: pull, claim lease, start heartbeat.
///
/// Must be called BEFORE any data fetch hooks fire for the project.
/// Emits `sync-status` events with `{ remote_project_id, status }` payloads.
#[tauri::command]
#[specta::specta]
pub async fn open_remote_project_sync(
    connection_id: String,
    remote_project_id: String,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    if connection_id.is_empty() {
        return Err(AppError::BadRequest("connection_id must not be empty".into()));
    }
    if remote_project_id.is_empty() {
        return Err(AppError::BadRequest(
            "remote_project_id must not be empty".into(),
        ));
    }

    // Emit pulling status before starting.
    emit_sync_status(&app_handle, &remote_project_id, "pulling", None);

    match crate::sync::open_remote_project(&connection_id, &remote_project_id, &app_handle).await {
        Ok(_project_db) => {
            emit_sync_status(&app_handle, &remote_project_id, "idle", None);
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            emit_sync_status(&app_handle, &remote_project_id, "error", Some(&msg));
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// close_remote_project_sync
// ---------------------------------------------------------------------------

/// Close a remote project: flush pending push, stop heartbeat.
///
/// Looks up the `connection_id` from the `remote_projects` table so the
/// caller only needs to supply `remote_project_id`.
#[tauri::command]
#[specta::specta]
pub async fn close_remote_project_sync(
    remote_project_id: String,
    db: State<'_, DatabaseConnection>,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    if remote_project_id.is_empty() {
        return Err(AppError::BadRequest(
            "remote_project_id must not be empty".into(),
        ));
    }

    // Look up connection_id from the local DB.
    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Remote project '{}' not found",
                remote_project_id
            ))
        })?;

    crate::sync::close_remote_project(&remote_project_id, &rp.connection_id, &app_handle).await?;

    // Clear status for this project.
    emit_sync_status(&app_handle, &remote_project_id, "idle", None);
    Ok(())
}

// ---------------------------------------------------------------------------
// force_push_remote_db
// ---------------------------------------------------------------------------

/// Force-push the local cache DB to remote immediately (debug / recovery).
///
/// Looks up connection_id from the local DB just like `close_remote_project_sync`.
#[tauri::command]
#[specta::specta]
pub async fn force_push_remote_db(
    remote_project_id: String,
    db: State<'_, DatabaseConnection>,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    if remote_project_id.is_empty() {
        return Err(AppError::BadRequest(
            "remote_project_id must not be empty".into(),
        ));
    }

    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Remote project '{}' not found",
                remote_project_id
            ))
        })?;

    emit_sync_status(&app_handle, &remote_project_id, "pushing", None);

    match crate::sync::push::push_remote_db(&rp.connection_id, &remote_project_id, &app_handle)
        .await
    {
        Ok(()) => {
            emit_sync_status(&app_handle, &remote_project_id, "idle", None);
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            emit_sync_status(&app_handle, &remote_project_id, "error", Some(&msg));
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// claim_remote_lease
// ---------------------------------------------------------------------------

/// Forcibly claim the remote lease for this device (called by "Take Over" button).
///
/// Flow:
/// 1. Look up connection from DB.
/// 2. Pull latest remote DB (so we overwrite the freshest state).
/// 3. Claim lease locally.
/// 4. Push (remote sees new lease holder).
///
/// After this succeeds the heartbeat task (already running) will maintain the lease.
#[tauri::command]
#[specta::specta]
pub async fn claim_remote_lease(
    remote_project_id: String,
    db: State<'_, DatabaseConnection>,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    use crate::db::{ProjectDbRegistry};
    use sea_orm::{ConnectionTrait, DatabaseConnection as Conn, DbBackend, Statement};
    use tauri::Manager;

    if remote_project_id.is_empty() {
        return Err(AppError::BadRequest(
            "remote_project_id must not be empty".into(),
        ));
    }

    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Remote project '{}' not found",
                remote_project_id
            ))
        })?;

    emit_sync_status(&app_handle, &remote_project_id, "pulling", None);

    // Pull latest from remote.
    crate::sync::pull::pull_remote_db(&rp.connection_id, &remote_project_id, &app_handle).await?;

    // Open project DB from registry.
    let registry = app_handle.state::<Arc<ProjectDbRegistry>>();
    let project_db = registry
        .get_or_open_remote(&remote_project_id, &rp.connection_id)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Read device_id.
    let local_db = app_handle.state::<Conn>();
    let row = local_db
        .query_one(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT value FROM settings WHERE key = 'device_id' LIMIT 1".to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let device_id = row
        .as_ref()
        .and_then(|r| r.try_get_by_index::<String>(0).ok())
        .ok_or_else(|| AppError::Internal("device_id not found in settings".into()))?;

    emit_sync_status(&app_handle, &remote_project_id, "pushing", None);

    // Claim the lease.
    crate::sync::lease::claim_lease(&project_db, &device_id).await?;

    // Push so remote sees new lease holder.
    match crate::sync::push::push_remote_db(&rp.connection_id, &remote_project_id, &app_handle)
        .await
    {
        Ok(()) => {
            emit_sync_status(&app_handle, &remote_project_id, "idle", None);
            tracing::info!(
                "claim_remote_lease: device '{}' claimed lease for '{}'",
                device_id,
                remote_project_id
            );
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            emit_sync_status(&app_handle, &remote_project_id, "error", Some(&msg));
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Emit a `sync-status` event to all frontend listeners.
///
/// Payload matches the TypeScript `SyncStatusPayload` type:
/// ```json
/// { "remote_project_id": "...", "status": "idle|pulling|pushing|error", "error": "..." }
/// ```
pub(crate) fn emit_sync_status(
    app_handle: &AppHandle,
    remote_project_id: &str,
    status: &str,
    error: Option<&str>,
) {
    use tauri::Emitter;
    use serde_json::json;

    let mut payload = json!({
        "remote_project_id": remote_project_id,
        "status": status,
    });
    if let Some(err) = error {
        payload["error"] = json!(err);
    }

    if let Err(e) = app_handle.emit("sync-status", payload) {
        tracing::warn!("Failed to emit sync-status event: {}", e);
    }
}
