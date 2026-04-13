//! Remote task session management commands.
//! These mirror the local agent commands but operate over SSH.

use crate::db::entities::{remote_project, ssh_connection, task_session};
use crate::error::AppError;
use crate::models::ssh_config::RemoteCreateSessionInput;
use crate::services::remote_pty_service::RemotePtyService;
use crate::services::ssh_service;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;
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
                    tracing::error!("Clock error persists: {}; using 0 as fallback", e2);
                    0
                })
        })
}

/// Create a tmux session on the remote machine for a task.
///
/// Steps:
/// 1. Load remote_project → ssh_connection from DB
/// 2. SSH exec `tmux new-session -d -s 'tinsu-task-{id}' -c '{path}' 2>/dev/null; true`
/// 3. Upsert task_sessions with remote_connection_id + remote_project_id
#[tauri::command]
#[specta::specta]
pub async fn create_remote_task_session(
    input: RemoteCreateSessionInput,
    db: State<'_, DatabaseConnection>,
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

    // Upsert task_sessions record
    let existing = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&input.task_id))
        .one(db.inner())
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
            updated.update(db.inner()).await?
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
            new.insert(db.inner()).await?
        }
    };

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
    cols: Option<u16>,
    rows: Option<u16>,
    on_data: Channel<Vec<u8>>,
    db: State<'_, DatabaseConnection>,
    remote_pty: State<'_, Arc<RemotePtyService>>,
    app: tauri::AppHandle,
) -> Result<AttachResult, AppError> {
    // Load session from DB
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(db.inner())
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
