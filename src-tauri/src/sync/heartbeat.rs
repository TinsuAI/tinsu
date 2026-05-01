//! Background heartbeat task for per-project remote DB lease management.
#![allow(dead_code)]
//!
//! `spawn_heartbeat_task` starts a tokio task that calls `lease::heartbeat` every 15 s.
//! On `LeaseStatus::Lost` it emits a Tauri event `lease-lost` and stops.
//!
//! A `HeartbeatRegistry` (managed as Tauri state) tracks active tasks so they
//! can be cancelled when a project is closed.

use crate::db::ProjectDb;
use crate::sync::lease::{self, LeaseStatus};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{interval, Duration};

const HEARTBEAT_INTERVAL_SECS: u64 = 15;

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/// Payload emitted with the `lease-lost` Tauri event.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct LeaseLostPayload {
    pub remote_project_id: String,
    pub holder_device_id: String,
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

struct HeartbeatEntry {
    /// Drop or send on this to cancel the task.
    abort_handle: tokio::task::AbortHandle,
}

/// Tracks one heartbeat task per `remote_project_id`.
/// Stored as Tauri managed state.
pub struct HeartbeatRegistry {
    tasks: Mutex<HashMap<String, HeartbeatEntry>>,
}

impl HeartbeatRegistry {
    pub fn new() -> Self {
        Self {
            tasks: Mutex::new(HashMap::new()),
        }
    }

    fn insert(&self, remote_project_id: String, entry: HeartbeatEntry) {
        let mut map = self.tasks.lock().unwrap_or_else(|p| p.into_inner());
        // Cancel any existing task before replacing.
        if let Some(old) = map.remove(&remote_project_id) {
            old.abort_handle.abort();
        }
        map.insert(remote_project_id, entry);
    }

    /// Cancel and remove the heartbeat task for `remote_project_id`.
    pub fn stop(&self, remote_project_id: &str) {
        let mut map = self.tasks.lock().unwrap_or_else(|p| p.into_inner());
        if let Some(entry) = map.remove(remote_project_id) {
            entry.abort_handle.abort();
        }
    }
}

// ---------------------------------------------------------------------------
// spawn_heartbeat_task
// ---------------------------------------------------------------------------

/// Spawn a background heartbeat task for the given project.
///
/// The task:
///   - Calls `lease::heartbeat` every 15 s.
///   - On `LeaseStatus::Lost`: emits `lease-lost` Tauri event, removes itself
///     from the registry, and exits.
///   - On error: logs a warning and continues (transient SSH errors are expected).
pub fn spawn_heartbeat_task(
    remote_project_id: String,
    connection_id: String,
    device_id: String,
    project_db: ProjectDb,
    app_handle: AppHandle,
) {
    let registry = app_handle.state::<Arc<HeartbeatRegistry>>();

    let proj_id = remote_project_id.clone();
    let conn_id = connection_id.clone();
    let dev_id = device_id.clone();
    let db = project_db.clone();
    let handle = app_handle.clone();
    let registry_arc = Arc::clone(&registry);

    let join = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            ticker.tick().await;

            match lease::heartbeat(&db, &dev_id, &conn_id, &proj_id, &handle).await {
                Ok(LeaseStatus::Held) => {
                    tracing::debug!("heartbeat: lease held for {}", proj_id);
                }
                Ok(LeaseStatus::Lost { holder }) => {
                    tracing::warn!(
                        "heartbeat: lease lost for {} — held by '{}'",
                        proj_id,
                        holder
                    );
                    // Emit lease-lost Tauri event.
                    let payload = LeaseLostPayload {
                        remote_project_id: proj_id.clone(),
                        holder_device_id: holder,
                    };
                    if let Err(e) = handle.emit("lease-lost", &payload) {
                        tracing::warn!("heartbeat: failed to emit lease-lost event: {}", e);
                    }
                    // Also update sync-status so the status indicator reflects lease-lost.
                    crate::commands::sync::emit_sync_status(&handle, &proj_id, "lease-lost", None);
                    // Remove self from registry and stop.
                    let mut map = registry_arc.tasks.lock().unwrap_or_else(|p| p.into_inner());
                    map.remove(&proj_id);
                    break;
                }
                Err(e) => {
                    // Transient error (SSH hiccup, etc.) — log and keep trying.
                    tracing::warn!(
                        "heartbeat: error for {} — will retry: {}",
                        proj_id,
                        e
                    );
                }
            }
        }
    });

    let entry = HeartbeatEntry {
        abort_handle: join.abort_handle(),
    };
    registry.insert(remote_project_id, entry);
}
