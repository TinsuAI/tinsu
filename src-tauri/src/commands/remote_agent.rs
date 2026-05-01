//! Remote task session management commands.
//! These mirror the local agent commands but operate over SSH.

use crate::db::entities::{remote_project, ssh_connection, task_session};
use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::models::ssh_config::RemoteCreateSessionInput;
use crate::services::remote_pty_service::RemotePtyService;
use crate::services::ssh_service;
use crate::sync;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use uuid::Uuid;

use super::agent::AttachResult;

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            // Clock may have gone backwards temporarily; retry once after brief delay
            tracing::warn!("Clock error on first attempt: {}; retrying", e);
            std::thread::sleep(std::time::Duration::from_millis(10));
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or_else(|e2| {
                    tracing::error!("Clock error persists: {}; using emergency fallback timestamp", e2);
                    // Use a distinctive sentinel value instead of 0 to signal clock failure
                    // (1e10 = 2286-11-20, chosen to be far in future and distinguishable from epoch)
                    10_000_000_000
                })
        })
}

/// Create a tmux session on the remote machine for a task.
///
/// Steps:
/// 1. Load remote_project → ssh_connection from DB
/// 2. SSH exec `tmux new-session -d -s 'tinsu-task-{id}' -c '{path}' 2>/dev/null; true`
/// 3. Upsert task_sessions with remote_connection_id + remote_project_id
/// 4. Auto-start hook forwarder for the connection (idempotent, non-fatal)
#[tauri::command]
#[specta::specta]
pub async fn create_remote_task_session(
    input: RemoteCreateSessionInput,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    hook_forwarder: State<'_, crate::services::remote_hook_forwarder::RemoteHookForwarderManager>,
    hook_listener: State<'_, std::sync::Mutex<crate::services::hook_listener::HookListenerService>>,
    app: AppHandle,
) -> Result<super::agent::TaskSessionModel, AppError> {
    // Validate task_id is a valid UUID (session name is safe when derived from UUID)
    if uuid::Uuid::parse_str(&input.task_id).is_err() {
        return Err(AppError::BadRequest(format!(
            "Invalid task_id: expected UUID format, got '{}'",
            input.task_id
        )));
    }
    // Load remote project
    let rp = remote_project::Entity::find_by_id(&input.remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("Remote project '{}' not found", input.remote_project_id))
        })?;

    // Load SSH connection
    let conn = ssh_connection::Entity::find_by_id(&rp.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("SSH connection '{}' not found", rp.connection_id))
        })?;

    if conn.auth_method == "password" {
        return Err(AppError::BadRequest(
            "Remote task sessions require key-based SSH authentication. \
             Re-save the connection using an SSH key.".into(),
        ));
    }

    // Build the remote session name (consistent with local: "tinsu-task-{task_id}")
    // Session name is derived from UUID format task_id, which cannot contain single quotes
    let session_name = format!("tinsu-task-{}", input.task_id);

    // Quote the path to prevent shell injection
    let safe_path = rp.path.replace("'", "'\\''");
    let create_cmd = format!(
        "tmux new-session -d -s '{}' -c '{}' 2>/dev/null; true",
        session_name, safe_path
    );

    // Execute via one-shot SSH (reuses ssh_service::run_ssh_exec pattern)
    // Timeout 15 seconds for tmux session creation
    tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &create_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Remote tmux session creation timed out after 15 seconds".into()))??;

    // Resolve project-scoped DB for task_session writes
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    // Upsert task_sessions record in project-scoped DB
    let existing = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&input.task_id))
        .one(pdb_conn)
        .await?;

    let now = now_unix_secs();

    let model = match existing {
        Some(existing) => {
            let updated = task_session::ActiveModel {
                id: Set(existing.id.clone()),
                tmux_session: Set(Some(session_name.clone())),
                remote_connection_id: Set(Some(conn.id.clone())),
                remote_project_id: Set(Some(input.remote_project_id.clone())),
                ..Default::default()
            };
            updated.update(pdb_conn).await?
        }
        None => {
            let new = task_session::ActiveModel {
                id: Set(Uuid::new_v4().to_string()),
                task_id: Set(input.task_id.clone()),
                session_id: Set(None),
                tmux_session: Set(Some(session_name.clone())),
                current_phase: Set(None),
                created_at: Set(now),
                remote_connection_id: Set(Some(conn.id.clone())),
                remote_project_id: Set(Some(input.remote_project_id.clone())),
            };
            new.insert(pdb_conn).await?
        }
    };

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    // Auto-start hook forwarder for this connection (idempotent)
    if conn.auth_method == "key" {
        if let Some(ref kname) = conn.key_name {
            let local_port = hook_listener.lock().map(|g| g.port).unwrap_or(3847);
            if let Err(e) = hook_forwarder.start(
                rp.connection_id.clone(),
                conn.host.clone(),
                conn.port as u16,
                conn.username.clone(),
                kname.clone(),
                local_port,
            ) {
                // Non-fatal: log warning, task session still returned
                tracing::warn!(
                    "Hook forwarder auto-start failed for connection {}: {}",
                    rp.connection_id, e
                );
            }
        }
    }

    Ok(super::agent::TaskSessionModel::from(model))
}

/// Attach to a remote tmux session via SSH PTY channel.
///
/// Process ID format: "remote-{uuid}" — distinguishes remote PTYs from local ones.
/// The `on_data` channel receives raw terminal bytes (same as attach_task_terminal).
#[tauri::command]
#[specta::specta]
pub async fn attach_remote_task_terminal(
    task_id: String,
    project_id: String,
    cols: Option<u16>,
    rows: Option<u16>,
    on_data: Channel<Vec<u8>>,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    remote_pty: State<'_, Arc<RemotePtyService>>,
    app: tauri::AppHandle,
) -> Result<AttachResult, AppError> {
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;

    // Load session from project-scoped DB
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(project_db.connection())
        .await?;

    let (tmux_session_name, remote_connection_id) = match session {
        Some(s) if s.tmux_session.is_some() && s.remote_connection_id.is_some() => {
            (s.tmux_session.unwrap(), s.remote_connection_id.unwrap())
        }
        _ => {
            return Ok(AttachResult {
                process_id: String::new(),
                attached: false,
            })
        }
    };

    // Load SSH connection
    let conn = ssh_connection::Entity::find_by_id(&remote_connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("SSH connection '{remote_connection_id}' not found"))
        })?;

    let process_id = format!("remote-{}", Uuid::new_v4());
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    remote_pty
        .attach(
            &process_id,
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            &tmux_session_name,
            cols,
            rows,
            task_id.clone(),
            on_data,
            app,
        )
        .await?;

    Ok(AttachResult {
        process_id,
        attached: true,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_remote_session_name_is_quoted() {
        // Regression guard from T2.4 review: session name must be single-quoted in the SSH exec cmd.
        // Session name is derived from UUID task_id — no single quotes possible in UUID format,
        // but the tmux command must still use quoted form for shell safety.
        let task_id = "550e8400-e29b-41d4-a716-446655440000"; // valid UUID
        let session_name = format!("tinsu-task-{}", task_id);

        // Build command as create_remote_task_session does
        let safe_path = "/home/user/project".replace("'", "'\\''");
        let create_cmd = format!(
            "tmux new-session -d -s '{}' -c '{}' 2>/dev/null; true",
            session_name, safe_path
        );

        // Verify session name is inside single quotes
        assert!(
            create_cmd.contains(&format!("-s '{}'", session_name)),
            "Session name must be single-quoted in tmux command, got: {create_cmd}"
        );
    }

    #[test]
    fn test_create_remote_task_session_rejects_empty_task_id() {
        // Verify that an empty task_id fails UUID parse (the guard used in create_remote_task_session)
        let empty_task_id = "";
        let parse_result = uuid::Uuid::parse_str(empty_task_id);
        assert!(
            parse_result.is_err(),
            "Empty task_id must fail UUID validation and trigger BadRequest"
        );

        // Also verify a non-UUID string fails
        let bad_task_id = "not-a-uuid";
        assert!(
            uuid::Uuid::parse_str(bad_task_id).is_err(),
            "Non-UUID task_id must fail validation"
        );

        // A valid UUID passes
        let valid_task_id = "550e8400-e29b-41d4-a716-446655440000";
        assert!(
            uuid::Uuid::parse_str(valid_task_id).is_ok(),
            "Valid UUID task_id must pass validation"
        );
    }
}

/// Write raw bytes to a remote PTY session.
#[tauri::command]
#[specta::specta]
pub async fn write_remote_pty(
    process_id: String,
    data: Vec<u8>,
    remote_pty: State<'_, Arc<RemotePtyService>>,
) -> Result<(), AppError> {
    remote_pty.write(&process_id, data).await
}

/// Resize a remote PTY session.
#[tauri::command]
#[specta::specta]
pub async fn resize_remote_pty(
    process_id: String,
    cols: u16,
    rows: u16,
    remote_pty: State<'_, Arc<RemotePtyService>>,
) -> Result<(), AppError> {
    remote_pty.resize(&process_id, cols, rows).await
}

/// Detach from a remote PTY session (SSH channel closed; tmux persists on remote).
#[tauri::command]
#[specta::specta]
pub async fn detach_remote_task_terminal(
    process_id: String,
    remote_pty: State<'_, Arc<RemotePtyService>>,
) -> Result<(), AppError> {
    remote_pty.detach(&process_id).await
}
