//! Push local cache DB to remote host via SSH exec + base64 transfer.
#![allow(dead_code)]
//!
//! Upload path: read local file → base64 encode → pipe through SSH exec into
//! `base64 -d > <remote>.tmp` → SSH exec `mv <remote>.tmp <remote>` (atomic).
//!
//! Also provides `PushDebouncer` — a per-project timer that coalesces rapid writes
//! into a single push 500 ms after the last `schedule()` call.

use crate::error::AppError;
use crate::sync::pull::{
    load_ssh_params, now_unix_secs, remote_db_path, remote_db_tmp_path, update_cache_row,
};
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokio::time::{sleep, Duration};

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/// Upload the local cache DB for `remote_project_id` to the remote host atomically.
///
/// Steps:
///   1. Resolve cache path from `ProjectDbRegistry`.
///   2. Read file, base64-encode.
///   3. SSH exec: `mkdir -p <dir> && base64 -d > <remote>.tmp << 'ENDOFFILE'\n<b64>\nENDOFFILE`
///      — uses heredoc so the payload is stdin, avoiding ARG_MAX limits.
///   4. SSH exec: `mv <remote>.tmp <remote>` — atomic rename.
///   5. Update `remote_project_cache.last_push_at`.
pub async fn push_remote_db(
    connection_id: &str,
    remote_project_id: &str,
    app_handle: &AppHandle,
) -> Result<(), AppError> {
    let local_db = app_handle.state::<DatabaseConnection>();
    let ssh = load_ssh_params(connection_id, local_db.inner()).await?;

    // Resolve local cache path.
    let cache_path = resolve_cache_path(remote_project_id, app_handle)?;

    // Read the local DB file.
    let db_bytes = std::fs::read(&cache_path).map_err(|e| {
        AppError::Internal(format!(
            "Failed to read cache DB at {}: {}",
            cache_path.display(),
            e
        ))
    })?;

    // Base64-encode.
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&db_bytes);

    // Signal that a push is starting.
    crate::commands::sync::emit_sync_status(app_handle, remote_project_id, "pushing", None);

    // Ensure remote directory exists.
    let remote_path = remote_db_path(remote_project_id);
    let remote_tmp = remote_db_tmp_path(remote_project_id);
    let remote_dir = format!("~/.tinsu/projects/{}", remote_project_id);

    let mkdir_cmd = format!("mkdir -p {remote_dir}");
    tokio::time::timeout(
        Duration::from_secs(10),
        crate::services::ssh_service::run_ssh_exec(
            &ssh.host,
            ssh.port,
            &ssh.username,
            "key",
            Some(&ssh.key_name),
            None,
            &mkdir_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("SSH mkdir timed out".into()))??;

    // Upload via base64 pipe.
    // We write the b64 data and pipe it through `base64 -d` to the tmp file.
    // The heredoc avoids shell argument length limits for large DBs.
    let upload_cmd = format!(
        "printf '%s' '{b64}' | base64 -d > {remote_tmp}"
    );
    tokio::time::timeout(
        Duration::from_secs(60),
        crate::services::ssh_service::run_ssh_exec(
            &ssh.host,
            ssh.port,
            &ssh.username,
            "key",
            Some(&ssh.key_name),
            None,
            &upload_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("SSH upload timed out".into()))??;

    // Atomic rename.
    let mv_cmd = format!("mv {remote_tmp} {remote_path}");
    tokio::time::timeout(
        Duration::from_secs(10),
        crate::services::ssh_service::run_ssh_exec(
            &ssh.host,
            ssh.port,
            &ssh.username,
            "key",
            Some(&ssh.key_name),
            None,
            &mv_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("SSH rename timed out".into()))??;

    // Update local metadata.
    let now = now_unix_secs();
    update_cache_row(
        local_db.inner(),
        remote_project_id,
        &cache_path.to_string_lossy(),
        None,
        Some(now),
    )
    .await?;

    // Signal idle after a successful push.
    crate::commands::sync::emit_sync_status(app_handle, remote_project_id, "idle", None);

    tracing::info!(
        "push_remote_db: pushed {} ({} bytes) to {}:{}",
        remote_project_id,
        db_bytes.len(),
        ssh.host,
        remote_path,
    );

    Ok(())
}

/// Resolve the local cache path for a remote project without opening a new connection.
pub(crate) fn resolve_cache_path(
    remote_project_id: &str,
    app_handle: &AppHandle,
) -> Result<PathBuf, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to resolve app_data_dir: {e}")))?;
    Ok(app_data_dir
        .join("remote-cache")
        .join(format!("{}.db", remote_project_id)))
}

// ---------------------------------------------------------------------------
// PushDebouncer
// ---------------------------------------------------------------------------

/// State for a single pending push timer.
struct PendingPush {
    /// Cancellation handle for the in-flight sleep task.
    cancel_tx: tokio::sync::oneshot::Sender<()>,
}

/// Coalesces rapid writes into a single push fired 500 ms after the last `schedule()`.
///
/// Internally holds a map of `remote_project_id → pending timer`.  When `schedule()`
/// is called for a project that already has a pending timer, the old timer is cancelled
/// and a fresh 500 ms sleep is started.
pub struct PushDebouncer {
    pending: Arc<Mutex<HashMap<String, PendingPush>>>,
}

impl PushDebouncer {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Schedule a push for `remote_project_id` in 500 ms.
    ///
    /// If a push is already pending for this project, the timer is reset.
    pub fn schedule(
        &self,
        remote_project_id: String,
        connection_id: String,
        app_handle: AppHandle,
    ) {
        let pending_arc = Arc::clone(&self.pending);

        // Cancel any existing pending push for this project.
        {
            let mut map = pending_arc.lock().unwrap_or_else(|p| p.into_inner());
            // Dropping the old PendingPush sends on the cancel_tx channel.
            map.remove(&remote_project_id);
        }

        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();
        let project_id_clone = remote_project_id.clone();

        {
            let mut map = pending_arc.lock().unwrap_or_else(|p| p.into_inner());
            map.insert(remote_project_id.clone(), PendingPush { cancel_tx });
        }

        tokio::spawn(async move {
            tokio::select! {
                _ = cancel_rx => {
                    // Cancelled by a newer schedule() call — do nothing.
                }
                _ = sleep(Duration::from_millis(500)) => {
                    // Timer fired — perform the push.
                    {
                        let mut map = pending_arc.lock().unwrap_or_else(|p| p.into_inner());
                        map.remove(&project_id_clone);
                    }
                    if let Err(e) = push_remote_db(&connection_id, &project_id_clone, &app_handle).await {
                        tracing::warn!(
                            "PushDebouncer: push failed for {}: {}",
                            project_id_clone,
                            e
                        );
                    }
                }
            }
        });
    }

    /// Cancel any pending push for `remote_project_id` without performing it.
    pub fn cancel(&self, remote_project_id: &str) {
        let mut map = self.pending.lock().unwrap_or_else(|p| p.into_inner());
        map.remove(remote_project_id);
    }

    /// Flush: wait for any pending push to fire immediately (by draining the debounce timer).
    /// Used during `close_remote_project` to ensure in-flight changes are persisted.
    ///
    /// Internally calls `push_remote_db` directly and then cancels the pending timer.
    pub async fn flush(
        &self,
        remote_project_id: &str,
        connection_id: &str,
        app_handle: &AppHandle,
    ) -> Result<(), AppError> {
        // Cancel the pending debounce timer (we'll push immediately below).
        self.cancel(remote_project_id);

        push_remote_db(connection_id, remote_project_id, app_handle).await
    }
}
