use crate::db::entities::{task, task_session};
use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::sync;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::services::pty_service::PtyService;
use crate::services::scrollback_backup::{ScrollbackBackup, ScrollbackResult};
use crate::services::tmux_service::TmuxService;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri::ipc::Channel;
use uuid::Uuid;

// ─── DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct TaskSessionModel {
    pub id: String,
    pub task_id: String,
    pub session_id: Option<String>,
    pub tmux_session: Option<String>,
    pub current_phase: Option<String>,
    pub created_at: i64,
    pub remote_connection_id: Option<String>,
    pub remote_project_id: Option<String>,
}

impl From<task_session::Model> for TaskSessionModel {
    fn from(m: task_session::Model) -> Self {
        TaskSessionModel {
            id: m.id,
            task_id: m.task_id,
            session_id: m.session_id,
            tmux_session: m.tmux_session,
            current_phase: m.current_phase,
            created_at: m.created_at,
            remote_connection_id: m.remote_connection_id,
            remote_project_id: m.remote_project_id,
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct AttachResult {
    pub process_id: String,
    pub attached: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CreateSessionInput {
    pub task_id: String,
    pub project_id: String,
    pub project_path: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct SessionStatusPayload {
    pub task_id: String,
    pub status: String, // "ended" | "stalled" | "recovered"
}

// ─── Helper ────────────────────────────────────────────────────────────────

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("Clock error computing unix epoch: {}", e);
            0
        })
}

// ─── Commands ──────────────────────────────────────────────────────────────

/// Create a tmux session for a task and upsert a `task_sessions` record.
/// If the task has a worktree_path, the session is created in that directory
/// so the agent operates in the isolated branch.
///
/// `project_id` is required to resolve the right DB for `task_sessions` writes.
#[tauri::command]
#[specta::specta]
pub async fn create_task_session(
    input: CreateSessionInput,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    tmux: State<'_, Arc<TmuxService>>,
    app: AppHandle,
) -> Result<TaskSessionModel, AppError> {
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let session_name = format!("tinsu-task-{}", input.task_id);

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    // Use worktree_path as cwd if available; fall back to project_path
    let cwd = {
        let task_row = task::Entity::find_by_id(&input.task_id)
            .one(pdb_conn)
            .await
            .ok()
            .flatten();
        task_row
            .and_then(|t| t.worktree_path)
            .unwrap_or_else(|| input.project_path.clone())
    };

    // Create tmux session (idempotent via TmuxService)
    let tmux_ref = tmux.inner().clone();
    let session_name_clone = session_name.clone();
    let cwd_clone = cwd.clone();
    tokio::task::spawn_blocking(move || {
        tmux_ref.create_session(&session_name_clone, &cwd_clone)
    })
    .await
    .map_err(|e| AppError::Internal(e.to_string()))??;

    // Upsert task_sessions record
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
                remote_connection_id: Set(None),
                remote_project_id: Set(None),
            };
            new.insert(pdb_conn).await?
        }
    };

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(TaskSessionModel::from(model))
}

/// Attach a PTY process to an existing tmux session for a task.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn attach_task_terminal(
    task_id: String,
    project_id: String,
    cols: Option<u16>,
    rows: Option<u16>,
    on_data: Channel<Vec<u8>>,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    tmux: State<'_, Arc<TmuxService>>,
    pty: State<'_, Arc<PtyService>>,
    app: AppHandle,
) -> Result<AttachResult, AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;

    // Look up session in DB
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(project_db.connection())
        .await?;

    let tmux_session_name = match session.and_then(|s| s.tmux_session) {
        Some(name) => name,
        None => {
            return Ok(AttachResult {
                process_id: String::new(),
                attached: false,
            })
        }
    };

    // Verify tmux session still exists (spawn_blocking for blocking CLI call)
    let tmux_ref = tmux.inner().clone();
    let tsn = tmux_session_name.clone();
    let session_exists = tokio::task::spawn_blocking(move || tmux_ref.has_session(&tsn))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !session_exists {
        return Ok(AttachResult {
            process_id: String::new(),
            attached: false,
        });
    }

    let process_id = Uuid::new_v4().to_string();
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    pty.spawn(
        &process_id,
        "tmux",
        &["attach-session", "-t", &tmux_session_name],
        "/", // cwd doesn't matter for attach
        cols,
        rows,
        Some(task_id.clone()),
        &app,
        on_data,
    )
    .await?;

    Ok(AttachResult {
        process_id,
        attached: true,
    })
}

/// Detach PTY from tmux session (kills the PTY process, leaves tmux running).
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn detach_task_terminal(
    process_id: String,
    pty: State<'_, Arc<PtyService>>,
) -> Result<(), AppError> {
    pty.kill(&process_id)
}

/// Spawn a generic PTY process (for the terminal dock).
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn spawn_pty(
    command: Option<String>,
    args: Vec<String>,
    cwd: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    on_data: Channel<Vec<u8>>,
    pty: State<'_, Arc<PtyService>>,
    app: AppHandle,
) -> Result<String, AppError> {
    let process_id = Uuid::new_v4().to_string();
    let cmd = command.as_deref().unwrap_or("bash");
    let cwd = cwd.as_deref().unwrap_or("/");
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    pty.spawn(
        &process_id,
        cmd,
        &arg_refs,
        cwd,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
        None,
        &app,
        on_data,
    )
    .await?;

    Ok(process_id)
}

/// Write data to a PTY process.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn write_pty(
    process_id: String,
    data: String,
    pty: State<'_, Arc<PtyService>>,
) -> Result<(), AppError> {
    pty.write(&process_id, data.as_bytes())
}

/// Resize a PTY process.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn resize_pty(
    process_id: String,
    cols: u16,
    rows: u16,
    pty: State<'_, Arc<PtyService>>,
) -> Result<(), AppError> {
    pty.resize(&process_id, cols, rows)
}

/// Kill a generic PTY process. Exit event is emitted by the reader thread.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn kill_pty(
    process_id: String,
    pty: State<'_, Arc<PtyService>>,
) -> Result<(), AppError> {
    pty.kill(&process_id)
}

/// Kill the tmux session for a task, remove DB record, kill any active PTY.
///
/// `project_id` is required to resolve the right DB for `task_sessions` reads/deletes.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
#[specta::specta]
pub async fn kill_task_session(
    task_id: String,
    project_id: String,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    tmux: State<'_, Arc<TmuxService>>,
    pty: State<'_, Arc<PtyService>>,
    app: AppHandle,
) -> Result<(), AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    let pdb_conn = project_db.connection();

    // Find task_session row
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(pdb_conn)
        .await?;

    // Kill tmux session if exists
    if let Some(ref s) = session {
        if let Some(ref tmux_name) = s.tmux_session {
            let tmux_ref = tmux.inner().clone();
            let name = tmux_name.clone();
            if let Err(e) = tokio::task::spawn_blocking(move || tmux_ref.kill_session(&name))
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?
            {
                tracing::warn!("Failed to kill tmux session for task {}: {}", task_id, e);
            }
        }
    }

    // Kill any PTY processes associated with this task
    let process_ids = pty.list_by_task_id(&task_id);
    for pid in process_ids {
        if let Err(e) = pty.kill(&pid) {
            tracing::warn!("Failed to kill PTY {} for task {}: {}", pid, task_id, e);
        }
    }

    // Delete DB record
    if let Some(s) = session {
        task_session::Entity::delete_by_id(s.id)
            .exec(pdb_conn)
            .await?;
    }

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(())
}

/// Kill the tmux session for a task, remove DB record (mobile — no local PTY).
#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
#[specta::specta]
pub async fn kill_task_session(
    task_id: String,
    project_id: String,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    tmux: State<'_, Arc<TmuxService>>,
) -> Result<(), AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    let pdb_conn = project_db.connection();

    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(pdb_conn)
        .await?;

    if let Some(ref s) = session {
        if let Some(ref tmux_name) = s.tmux_session {
            let tmux_ref = tmux.inner().clone();
            let name = tmux_name.clone();
            if let Err(e) = tokio::task::spawn_blocking(move || tmux_ref.kill_session(&name))
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?
            {
                tracing::warn!("Failed to kill tmux session for task {}: {}", task_id, e);
            }
        }
    }

    if let Some(s) = session {
        task_session::Entity::delete_by_id(s.id)
            .exec(pdb_conn)
            .await?;
    }

    Ok(())
}

/// Get the task session record from DB.
///
/// `project_id` is required to resolve the right DB for `task_sessions` reads.
#[tauri::command]
#[specta::specta]
pub async fn get_task_session(
    task_id: String,
    project_id: String,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
) -> Result<Option<TaskSessionModel>, AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(project_db.connection())
        .await?;

    Ok(session.map(TaskSessionModel::from))
}

/// Get scrollback backup for a task.
#[tauri::command]
#[specta::specta]
pub async fn get_scrollback_backup(
    task_id: String,
    backup: State<'_, Arc<ScrollbackBackup>>,
) -> Result<ScrollbackResult, AppError> {
    backup.load(&task_id)
}

/// Save scrollback backup for a task.
#[tauri::command]
#[specta::specta]
pub async fn save_scrollback_backup(
    task_id: String,
    content: String,
    backup: State<'_, Arc<ScrollbackBackup>>,
) -> Result<(), AppError> {
    backup.save(&task_id, &content)
}

/// Start a background session monitor for a task. Fire-and-forget.
#[tauri::command]
#[specta::specta]
pub async fn start_session_monitor(
    task_id: String,
    app: AppHandle,
) -> Result<(), AppError> {
    let task_id_clone = task_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let session_name = format!("tinsu-task-{}", task_id_clone);
        let mut last_capture = String::new();
        let mut stall_ticks: u32 = 0;
        const STALL_THRESHOLD_TICKS: u32 = 10; // 10 × 30s = 5 minutes

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;

            // Check if session exists (blocking CLI call offloaded to spawn_blocking)
            let sn = session_name.clone();
            let alive = tokio::task::spawn_blocking(move || {
                std::process::Command::new("tmux")
                    .args(["has-session", "-t", &sn])
                    .output()
                    .map(|o| o.status.success())
                    .unwrap_or(false)
            })
            .await
            .unwrap_or(false);

            if !alive {
                let _ = app_clone.emit(
                    "pty:session-status",
                    SessionStatusPayload {
                        task_id: task_id_clone.clone(),
                        status: "ended".to_string(),
                    },
                );
                break;
            }

            // Capture pane for stall detection
            let sn2 = session_name.clone();
            let current_capture = tokio::task::spawn_blocking(move || {
                std::process::Command::new("tmux")
                    .args(["capture-pane", "-p", "-t", &sn2])
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
                    .unwrap_or_default()
            })
            .await
            .unwrap_or_default();

            if current_capture == last_capture {
                stall_ticks += 1;
                if stall_ticks == STALL_THRESHOLD_TICKS {
                    // Emit stalled only on first threshold crossing (not on every tick after)
                    let _ = app_clone.emit(
                        "pty:session-status",
                        SessionStatusPayload {
                            task_id: task_id_clone.clone(),
                            status: "stalled".to_string(),
                        },
                    );
                }
            } else {
                if stall_ticks >= STALL_THRESHOLD_TICKS {
                    // Was stalled, now recovered
                    let _ = app_clone.emit(
                        "pty:session-status",
                        SessionStatusPayload {
                            task_id: task_id_clone.clone(),
                            status: "recovered".to_string(),
                        },
                    );
                }
                stall_ticks = 0;
                last_capture = current_capture;
            }
        }
    });

    Ok(())
}

/// Update session_id for a task when Claude Code CLI starts.
///
/// `project_id` is required to resolve the right DB for `task_sessions` writes.
#[tauri::command]
#[specta::specta]
pub async fn register_session_id(
    task_id: String,
    project_id: String,
    session_id: String,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
) -> Result<(), AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(pdb_conn)
        .await?;

    if let Some(record) = existing {
        let updated = task_session::ActiveModel {
            id: Set(record.id),
            session_id: Set(Some(session_id)),
            ..Default::default()
        };
        updated.update(pdb_conn).await?;

        if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
            sync::schedule_push_after_write(remote_project_id, connection_id, &app);
        }

        Ok(())
    } else {
        Err(AppError::NotFound(format!(
            "task_session not found for task_id: {}",
            task_id
        )))
    }
}

/// Called from lib.rs setup — iterates all task_sessions and checks tmux has-session.
/// Sessions where tmux is gone have their `tmux_session` cleared in DB.
/// NOTE: This startup helper queries the local DB directly (all sessions were in local DB
/// before Phase 3 migration). Remote project sessions may not appear here until Phase 3.
pub async fn restore_sessions_on_startup(
    db: &DatabaseConnection,
    tmux: &Arc<TmuxService>,
) {
    let all_sessions = match task_session::Entity::find().all(db).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("restore_sessions_on_startup: DB query failed: {}", e);
            return;
        }
    };

    for session in all_sessions {
        if let Some(ref tmux_name) = session.tmux_session {
            let tmux_ref = tmux.clone();
            let name = tmux_name.clone();
            let alive = tokio::task::spawn_blocking(move || tmux_ref.has_session(&name))
                .await
                .unwrap_or(false);

            if !alive {
                tracing::info!(
                    "restore_sessions_on_startup: session {} tmux gone, clearing DB record",
                    session.task_id
                );
                let updated = task_session::ActiveModel {
                    id: Set(session.id.clone()),
                    tmux_session: Set(None),
                    ..Default::default()
                };
                if let Err(e) = updated.update(db).await {
                    tracing::warn!(
                        "restore_sessions_on_startup: failed to update session {}: {}",
                        session.task_id,
                        e
                    );
                }
            } else {
                tracing::info!(
                    "restore_sessions_on_startup: session {} tmux alive ({})",
                    session.task_id,
                    tmux_name
                );
            }
        }
    }
}
