//! Commands for managing SSH reverse tunnel hook event forwarding.
//! One forwarder per connection_id. Auto-started via create_remote_task_session.

use crate::db::entities::ssh_connection;
use crate::error::AppError;
use crate::services::hook_listener::HookListenerService;
use crate::services::remote_hook_forwarder::{RemoteHookForwarderManager, RemoteHookStatus};
use sea_orm::{DatabaseConnection, EntityTrait};
use std::sync::Mutex;
use tauri::State;

/// Start SSH reverse tunnel for hook forwarding (idempotent — no-op if already running).
///
/// Loads SSH connection from DB by `connection_id` and starts the forwarder.
/// Returns the remote port (3847) once the tunnel is established.
#[tauri::command]
#[specta::specta]
pub async fn start_remote_hook_forwarder(
    connection_id: String,
    db: State<'_, DatabaseConnection>,
    manager: State<'_, RemoteHookForwarderManager>,
    hook_listener: State<'_, Mutex<HookListenerService>>,
) -> Result<RemoteHookStatus, AppError> {
    if connection_id.is_empty() {
        return Err(AppError::BadRequest("connection_id must not be empty".into()));
    }

    let conn = ssh_connection::Entity::find_by_id(&connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("SSH connection '{connection_id}' not found"))
        })?;

    if conn.auth_method != "key" {
        return Err(AppError::BadRequest(
            "Remote hook forwarding requires key-based SSH authentication".into(),
        ));
    }

    let key_name = conn.key_name.ok_or_else(|| {
        AppError::BadRequest("SSH connection has no key_name set".into())
    })?;

    let local_hook_port = hook_listener
        .lock()
        .map_err(|e| AppError::Internal(format!("Hook listener service unavailable: {}", e)))?
        .port;

    manager.start(
        connection_id.clone(),
        conn.host,
        conn.port as u16,
        conn.username,
        key_name,
        local_hook_port,
    )?;

    manager.status(&connection_id)
}

/// Stop SSH reverse tunnel for hook forwarding (no-op if not running).
#[tauri::command]
#[specta::specta]
pub async fn stop_remote_hook_forwarder(
    connection_id: String,
    manager: State<'_, RemoteHookForwarderManager>,
) -> Result<(), AppError> {
    if connection_id.is_empty() {
        return Err(AppError::BadRequest("connection_id must not be empty".into()));
    }
    manager.stop(&connection_id)
}

/// Get hook forwarder status for a connection.
#[tauri::command]
#[specta::specta]
pub async fn get_remote_hook_status(
    connection_id: String,
    manager: State<'_, RemoteHookForwarderManager>,
) -> Result<RemoteHookStatus, AppError> {
    if connection_id.is_empty() {
        return Err(AppError::BadRequest("connection_id must not be empty".into()));
    }
    manager.status(&connection_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_forwarder_rejects_empty_connection_id() {
        // Command guard: empty connection_id → AppError::BadRequest before any DB/SSH call
        // Verify via the manager-level guard (same logic, no Tauri State needed)
        let manager = RemoteHookForwarderManager::new();
        let result = manager.start(
            "".to_string(),
            "host.example.com".to_string(),
            22,
            "user".to_string(),
            "my-key".to_string(),
            3847,
        );
        assert!(result.is_err(), "Manager.start must reject empty connection_id");
        let err = result.unwrap_err();
        assert!(
            err.to_string().contains("connection_id"),
            "Error message must mention connection_id, got: {err}"
        );
    }

    #[test]
    fn test_forwarder_status_returns_inactive_for_unknown() {
        // Unknown connection_id → is_active: false (not an error)
        let manager = RemoteHookForwarderManager::new();
        let status = manager.status("unknown-connection-id").unwrap();
        assert!(!status.is_active, "Unknown connection_id → is_active must be false");
        assert!(
            status.remote_port.is_none(),
            "Unknown connection_id → remote_port must be None"
        );
    }
}
