//! Lease management for per-project remote SQLite DBs.
#![allow(dead_code)]
//!
//! A lease is a single row in `_meta` (per-project DB) with:
//!   - `lease_device_id`    — device UUID that holds the lease
//!   - `lease_claimed_at`   — Unix timestamp when the lease was first claimed
//!   - `lease_heartbeat_at` — Unix timestamp of last heartbeat; updated every 15s
//!
//! "Newest device wins" is enforced by `claim_lease`: it unconditionally overwrites
//! whatever is in `_meta`, so the caller must have already pulled the latest remote
//! DB (which contains the current lease holder) and decided to proceed.
//!
//! `heartbeat` re-pulls the remote `_meta` cheaply by downloading the full DB
//! (acceptable for SQLite files in the MB range) and checking whether `lease_device_id`
//! still matches `device_id`.  If it does, it stamps `lease_heartbeat_at` in the local
//! cache and pushes.

use crate::db::ProjectDb;
use crate::error::AppError;
use sea_orm::{ConnectionTrait, DbBackend, Statement};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// The result of `check_lease` / `heartbeat`.
#[derive(Debug, Clone, PartialEq)]
pub enum LeaseStatus {
    /// This device currently holds the lease.
    Held,
    /// Another device holds the lease.
    Lost { holder: String },
}

// ---------------------------------------------------------------------------
// claim_lease
// ---------------------------------------------------------------------------

/// Stamp `_meta` to declare this device as the lease holder.
///
/// Unconditionally overwrites `lease_device_id`, `lease_claimed_at`, and
/// `lease_heartbeat_at`.  Caller is responsible for pushing afterwards so
/// the remote sees the new lease.
pub async fn claim_lease(project_db: &ProjectDb, device_id: &str) -> Result<(), AppError> {
    let conn = project_db.connection();
    let now = now_unix_secs();

    conn.execute(Statement::from_sql_and_values(
        DbBackend::Sqlite,
        "UPDATE _meta SET lease_device_id = ?, lease_claimed_at = ?, lease_heartbeat_at = ? \
         WHERE id = 1",
        [device_id.into(), now.into(), now.into()],
    ))
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    tracing::info!("claim_lease: device '{}' claimed lease", device_id);
    Ok(())
}

// ---------------------------------------------------------------------------
// check_lease
// ---------------------------------------------------------------------------

/// Read `_meta.lease_device_id` from the local cache and compare to `device_id`.
pub async fn check_lease(project_db: &ProjectDb, device_id: &str) -> Result<LeaseStatus, AppError> {
    let conn = project_db.connection();

    let row = conn
        .query_one(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT lease_device_id FROM _meta WHERE id = 1".to_owned(),
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let holder: Option<String> = row
        .as_ref()
        .and_then(|r| r.try_get_by_index::<Option<String>>(0).ok().flatten());

    match holder {
        Some(h) if h == device_id => Ok(LeaseStatus::Held),
        Some(h) => Ok(LeaseStatus::Lost { holder: h }),
        // No lease_device_id set — treat as Held (no active holder).
        None => Ok(LeaseStatus::Held),
    }
}

// ---------------------------------------------------------------------------
// heartbeat
// ---------------------------------------------------------------------------

/// Verify that this device still holds the lease and refresh `lease_heartbeat_at`.
///
/// Because we need to see the *remote* state (not just the local cache), this
/// function re-pulls the full DB from the remote before checking.  After confirming
/// ownership it stamps `lease_heartbeat_at` and pushes.
///
/// `connection_id` and `remote_project_id` are needed for pull/push.
pub async fn heartbeat(
    project_db: &ProjectDb,
    device_id: &str,
    connection_id: &str,
    remote_project_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<LeaseStatus, AppError> {
    // Pull latest remote state into the local cache.
    crate::sync::pull::pull_remote_db(connection_id, remote_project_id, app_handle).await?;

    // Re-open / refresh the ProjectDb from the registry so we read the freshly pulled data.
    // The registry's connection is to the same file, so WAL should give us the latest data.
    // We simply read _meta directly via the existing connection.
    let status = check_lease(project_db, device_id).await?;

    if let LeaseStatus::Held = &status {
        // Stamp heartbeat in local cache.
        let conn = project_db.connection();
        let now = now_unix_secs();
        conn.execute(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "UPDATE _meta SET lease_heartbeat_at = ? WHERE id = 1",
            [now.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        // Push updated heartbeat to remote.
        crate::sync::push::push_remote_db(connection_id, remote_project_id, app_handle).await?;
    }

    Ok(status)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub(crate) fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
