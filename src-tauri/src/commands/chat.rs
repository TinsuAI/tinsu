use crate::db::entities::{chat_message, chat_session, project};
use crate::error::AppError;
use crate::services::chat_cli::ChatCliService;
use crate::services::pty_service::PtyService;
use crate::services::tmux_service::TmuxService;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri::ipc::Channel;
use uuid::Uuid;

// Re-use AttachResult from agent module
pub use super::agent::AttachResult;

// ─── Helpers ───────────────────────────────────────────────────────────────

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// ─── DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChatSessionModel {
    pub id: String,
    pub session_uuid: String,
    pub agent_persona: Option<String>,
    pub workflow_phase: Option<String>,
    pub project_id: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_message_at: Option<i64>,
    pub workflow_key: Option<String>,
    pub skip_permissions: i32,
    pub tmux_session: Option<String>,
}

impl From<chat_session::Model> for ChatSessionModel {
    fn from(m: chat_session::Model) -> Self {
        ChatSessionModel {
            id: m.id,
            session_uuid: m.session_uuid,
            agent_persona: m.agent_persona,
            workflow_phase: m.workflow_phase,
            project_id: m.project_id,
            status: m.status,
            created_at: m.created_at,
            updated_at: m.updated_at,
            last_message_at: m.last_message_at,
            workflow_key: m.workflow_key,
            skip_permissions: m.skip_permissions,
            tmux_session: m.tmux_session,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChatMessageModel {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>,
    pub created_at: i64,
}

impl From<chat_message::Model> for ChatMessageModel {
    fn from(m: chat_message::Model) -> Self {
        ChatMessageModel {
            id: m.id,
            session_id: m.session_id,
            role: m.role,
            content: m.content,
            tool_name: m.tool_name,
            tool_input: m.tool_input,
            created_at: m.created_at,
        }
    }
}

/// Flattened session preview — all session fields + last_message_preview.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ChatSessionPreview {
    pub id: String,
    pub session_uuid: String,
    pub agent_persona: Option<String>,
    pub workflow_phase: Option<String>,
    pub project_id: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_message_at: Option<i64>,
    pub workflow_key: Option<String>,
    pub skip_permissions: i32,
    pub tmux_session: Option<String>,
    pub last_message_preview: Option<String>,
}

// ─── Commands ──────────────────────────────────────────────────────────────

/// Create a new chat session, spin up the tmux session, and return the session model.
#[tauri::command]
#[specta::specta]
pub async fn create_chat_session(
    project_id: String,
    agent_persona: Option<String>,
    workflow_key: Option<String>,
    db: State<'_, DatabaseConnection>,
    tmux: State<'_, Arc<TmuxService>>,
    app: AppHandle,
) -> Result<ChatSessionModel, AppError> {
    // Look up project path from DB
    let project = project::Entity::find_by_id(&project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {}", project_id)))?;

    let now = now_unix_secs();
    let id = Uuid::new_v4().to_string();
    let session_uuid = Uuid::new_v4().to_string();

    // Insert chat_sessions row
    let new_session = chat_session::ActiveModel {
        id: Set(id.clone()),
        session_uuid: Set(session_uuid.clone()),
        agent_persona: Set(agent_persona.clone()),
        workflow_phase: Set(None),
        project_id: Set(project_id.clone()),
        status: Set("idle".to_string()),
        created_at: Set(now),
        updated_at: Set(now),
        last_message_at: Set(None),
        workflow_key: Set(workflow_key.clone()),
        skip_permissions: Set(1), // default to skip_permissions=true
        tmux_session: Set(None),
    };
    let session = new_session.insert(db.inner()).await?;

    // Get hooks resource dir
    let hooks_resource_dir = app
        .path()
        .resource_dir()
        .map(|d: std::path::PathBuf| d.join("hooks").to_string_lossy().to_string())
        .unwrap_or_else(|_| {
            tracing::warn!("create_chat_session: could not resolve resource dir");
            String::from("/tmp/tinsu-hooks")
        });

    // Spawn the tmux session (non-fatal on failure)
    let chat_cli = ChatCliService;
    let tmux_ref = tmux.inner().clone();
    let spawn_result = chat_cli
        .spawn_session(
            &session_uuid,
            &project.path,
            agent_persona.as_deref(),
            session.skip_permissions != 0,
            &hooks_resource_dir,
            &tmux_ref,
        )
        .await;

    let tmux_session_name = match spawn_result {
        Ok(name) => Some(name),
        Err(e) => {
            tracing::warn!("create_chat_session: spawn_session failed (non-fatal): {}", e);
            None
        }
    };

    // Update chat_sessions.tmux_session
    let updated = chat_session::ActiveModel {
        id: Set(session.id.clone()),
        tmux_session: Set(tmux_session_name),
        updated_at: Set(now_unix_secs()),
        ..Default::default()
    };
    let final_session = updated.update(db.inner()).await?;

    Ok(ChatSessionModel::from(final_session))
}

/// List all chat sessions for a project with last message preview, sorted by activity.
#[tauri::command]
#[specta::specta]
pub async fn list_chat_sessions_with_preview(
    project_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<ChatSessionPreview>, AppError> {
    use sea_orm::{ConnectionTrait, Statement};

    let sql = r#"
        SELECT
            cs.id, cs.session_uuid, cs.agent_persona, cs.workflow_phase,
            cs.project_id, cs.status, cs.created_at, cs.updated_at,
            cs.last_message_at, cs.workflow_key, cs.skip_permissions, cs.tmux_session,
            (SELECT content FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
        FROM chat_sessions cs
        WHERE cs.project_id = ?
        ORDER BY COALESCE(cs.last_message_at, 0) DESC, cs.created_at DESC
    "#;

    let rows = db
        .inner()
        .query_all(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Sqlite,
            sql,
            [project_id.into()],
        ))
        .await?;

    let mut previews = Vec::with_capacity(rows.len());
    for row in rows {
        let preview = ChatSessionPreview {
            id: row.try_get_by_index::<String>(0).unwrap_or_default(),
            session_uuid: row.try_get_by_index::<String>(1).unwrap_or_default(),
            agent_persona: row.try_get_by_index::<Option<String>>(2).ok().flatten(),
            workflow_phase: row.try_get_by_index::<Option<String>>(3).ok().flatten(),
            project_id: row.try_get_by_index::<String>(4).unwrap_or_default(),
            status: row.try_get_by_index::<String>(5).unwrap_or_default(),
            created_at: row.try_get_by_index::<i64>(6).unwrap_or(0),
            updated_at: row.try_get_by_index::<i64>(7).unwrap_or(0),
            last_message_at: row.try_get_by_index::<Option<i64>>(8).ok().flatten(),
            workflow_key: row.try_get_by_index::<Option<String>>(9).ok().flatten(),
            skip_permissions: row.try_get_by_index::<i32>(10).unwrap_or(0),
            tmux_session: row.try_get_by_index::<Option<String>>(11).ok().flatten(),
            last_message_preview: row.try_get_by_index::<Option<String>>(12).ok().flatten(),
        };
        previews.push(preview);
    }

    Ok(previews)
}

/// Get messages for a chat session, sorted by created_at ASC.
#[tauri::command]
#[specta::specta]
pub async fn get_chat_messages(
    session_id: String,
    limit: Option<u64>,
    offset: Option<u64>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<ChatMessageModel>, AppError> {
    let mut query = chat_message::Entity::find()
        .filter(chat_message::Column::SessionId.eq(&session_id))
        .order_by_asc(chat_message::Column::CreatedAt);

    if let Some(limit_val) = limit {
        query = query.limit(limit_val.min(500));
    } else {
        query = query.limit(100);
    }
    if let Some(offset_val) = offset {
        query = query.offset(offset_val);
    }

    let messages = query.all(db.inner()).await?;
    Ok(messages.into_iter().map(ChatMessageModel::from).collect())
}

/// Send a message to the active chat session's tmux session.
#[tauri::command]
#[specta::specta]
pub async fn send_chat_message(
    session_id: String,
    content: String,
    db: State<'_, DatabaseConnection>,
    tmux: State<'_, Arc<TmuxService>>,
    app: AppHandle,
) -> Result<ChatMessageModel, AppError> {
    // Load session
    let session = chat_session::Entity::find_by_id(&session_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("chat session not found: {}", session_id)))?;

    let tmux_session = session.tmux_session.as_deref().unwrap_or("");

    // Send to tmux (if tmux_session is available)
    if !tmux_session.is_empty() {
        let chat_cli = ChatCliService;
        if let Err(e) = chat_cli
            .send_message(tmux_session, &content, tmux.inner())
            .await
        {
            tracing::warn!("send_chat_message: tmux send failed: {}", e);
        }
    }

    let now = now_unix_secs();

    // Insert user message
    let msg_id = Uuid::new_v4().to_string();
    let new_msg = chat_message::ActiveModel {
        id: Set(msg_id),
        session_id: Set(session_id.clone()),
        role: Set("user".to_string()),
        content: Set(content.clone()),
        tool_name: Set(None),
        tool_input: Set(None),
        created_at: Set(now),
    };
    let saved_msg = new_msg.insert(db.inner()).await?;

    // Update session: last_message_at=now, status=thinking
    let updated = chat_session::ActiveModel {
        id: Set(session_id.clone()),
        last_message_at: Set(Some(now)),
        status: Set("thinking".to_string()),
        updated_at: Set(now),
        ..Default::default()
    };
    updated.update(db.inner()).await?;

    // Emit event
    let msg_model = ChatMessageModel::from(saved_msg);
    if let Err(e) = app.emit(
        "chat:message-sent",
        serde_json::json!({ "session_id": session_id, "message": msg_model }),
    ) {
        tracing::warn!("send_chat_message: failed to emit event: {}", e);
    }

    Ok(msg_model)
}

/// Update a chat session's status.
#[tauri::command]
#[specta::specta]
pub async fn update_session_status(
    session_id: String,
    status: String,
    db: State<'_, DatabaseConnection>,
    app: AppHandle,
) -> Result<(), AppError> {
    let now = now_unix_secs();
    let updated = chat_session::ActiveModel {
        id: Set(session_id.clone()),
        status: Set(status.clone()),
        updated_at: Set(now),
        ..Default::default()
    };
    updated.update(db.inner()).await?;

    if let Err(e) = app.emit(
        "chat:session-status-changed",
        serde_json::json!({ "session_id": session_id, "status": status }),
    ) {
        tracing::warn!("update_session_status: failed to emit event: {}", e);
    }

    Ok(())
}

/// Delete a chat session (kills tmux session, cascades messages).
#[tauri::command]
#[specta::specta]
pub async fn delete_chat_session(
    session_id: String,
    db: State<'_, DatabaseConnection>,
    tmux: State<'_, Arc<TmuxService>>,
) -> Result<(), AppError> {
    // Load session to get tmux_session name
    let session = chat_session::Entity::find_by_id(&session_id)
        .one(db.inner())
        .await?;

    // Kill tmux session (best-effort)
    if let Some(ref s) = session {
        if let Some(ref tmux_name) = s.tmux_session {
            let chat_cli = ChatCliService;
            if let Err(e) = chat_cli.kill_session(tmux_name, tmux.inner()).await {
                tracing::warn!("delete_chat_session: kill tmux failed (non-fatal): {}", e);
            }
        }
    }

    // Delete messages first (explicit cascade)
    chat_message::Entity::delete_many()
        .filter(chat_message::Column::SessionId.eq(&session_id))
        .exec(db.inner())
        .await?;

    // Delete session
    chat_session::Entity::delete_by_id(&session_id)
        .exec(db.inner())
        .await?;

    Ok(())
}

/// Delete a single chat message.
#[tauri::command]
#[specta::specta]
pub async fn delete_chat_message(
    message_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    chat_message::Entity::delete_by_id(&message_id)
        .exec(db.inner())
        .await?;
    Ok(())
}

/// Clear all messages for a session and reset last_message_at.
#[tauri::command]
#[specta::specta]
pub async fn clear_session_messages(
    session_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    chat_message::Entity::delete_many()
        .filter(chat_message::Column::SessionId.eq(&session_id))
        .exec(db.inner())
        .await?;

    let now = now_unix_secs();
    let updated = chat_session::ActiveModel {
        id: Set(session_id.clone()),
        last_message_at: Set(None),
        updated_at: Set(now),
        ..Default::default()
    };
    updated.update(db.inner()).await?;

    Ok(())
}

/// Update the skip_permissions flag for a session.
#[tauri::command]
#[specta::specta]
pub async fn update_skip_permissions(
    session_id: String,
    skip_permissions: bool,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    let now = now_unix_secs();
    let updated = chat_session::ActiveModel {
        id: Set(session_id),
        skip_permissions: Set(if skip_permissions { 1 } else { 0 }),
        updated_at: Set(now),
        ..Default::default()
    };
    updated.update(db.inner()).await?;
    Ok(())
}

/// Get a chat session by its workflow key.
#[tauri::command]
#[specta::specta]
pub async fn get_chat_session_by_workflow_key(
    project_id: String,
    workflow_key: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Option<ChatSessionModel>, AppError> {
    let session = chat_session::Entity::find()
        .filter(chat_session::Column::ProjectId.eq(&project_id))
        .filter(chat_session::Column::WorkflowKey.eq(&workflow_key))
        .one(db.inner())
        .await?;

    Ok(session.map(ChatSessionModel::from))
}

/// Attach a PTY to the chat session's tmux session (mirrors attach_task_terminal).
#[tauri::command]
#[specta::specta]
pub async fn attach_chat_terminal(
    session_id: String,
    cols: Option<u16>,
    rows: Option<u16>,
    on_data: Channel<Vec<u8>>,
    db: State<'_, DatabaseConnection>,
    tmux: State<'_, Arc<TmuxService>>,
    pty: State<'_, Arc<PtyService>>,
    app: AppHandle,
) -> Result<AttachResult, AppError> {
    // Load chat session to get tmux_session name
    let session = chat_session::Entity::find_by_id(&session_id)
        .one(db.inner())
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

    // Verify tmux session still exists
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
        "/",
        cols,
        rows,
        None, // no task_id association for chat terminals
        &app,
        on_data,
    )
    .await?;

    Ok(AttachResult {
        process_id,
        attached: true,
    })
}

/// Detach a PTY from a chat session (leaves tmux running).
#[tauri::command]
#[specta::specta]
pub async fn detach_chat_terminal(
    process_id: String,
    pty: State<'_, Arc<PtyService>>,
) -> Result<(), AppError> {
    pty.kill(&process_id)
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_session_model_from_entity() {
        let model = chat_session::Model {
            id: "sess-1".to_string(),
            session_uuid: "uuid-1".to_string(),
            agent_persona: Some("pm".to_string()),
            workflow_phase: None,
            project_id: "proj-1".to_string(),
            status: "idle".to_string(),
            created_at: 1000,
            updated_at: 2000,
            last_message_at: Some(1500),
            workflow_key: Some("prd".to_string()),
            skip_permissions: 1,
            tmux_session: Some("tinsu-chat-uuid-1".to_string()),
        };

        let dto = ChatSessionModel::from(model);
        assert_eq!(dto.id, "sess-1");
        assert_eq!(dto.agent_persona, Some("pm".to_string()));
        assert_eq!(dto.status, "idle");
        assert_eq!(dto.skip_permissions, 1);
    }

    #[test]
    fn test_chat_message_model_from_entity() {
        let model = chat_message::Model {
            id: "msg-1".to_string(),
            session_id: "sess-1".to_string(),
            role: "user".to_string(),
            content: "Hello".to_string(),
            tool_name: None,
            tool_input: None,
            created_at: 1000,
        };

        let dto = ChatMessageModel::from(model);
        assert_eq!(dto.id, "msg-1");
        assert_eq!(dto.role, "user");
        assert_eq!(dto.content, "Hello");
    }

    #[test]
    fn test_chat_session_preview_serializes() {
        let preview = ChatSessionPreview {
            id: "s1".to_string(),
            session_uuid: "u1".to_string(),
            agent_persona: Some("bmad:bmm:agents:pm".to_string()),
            workflow_phase: None,
            project_id: "p1".to_string(),
            status: "idle".to_string(),
            created_at: 1000,
            updated_at: 1000,
            last_message_at: None,
            workflow_key: None,
            skip_permissions: 1,
            tmux_session: None,
            last_message_preview: Some("Hello world".to_string()),
        };

        let json = serde_json::to_string(&preview).unwrap();
        assert!(json.contains("\"last_message_preview\""));
        assert!(json.contains("Hello world"));
    }

    #[test]
    fn test_now_unix_secs_returns_positive() {
        let ts = now_unix_secs();
        assert!(ts > 0, "unix timestamp should be positive");
    }

    #[test]
    fn test_chat_session_model_serializes_to_json() {
        let model = ChatSessionModel {
            id: "s1".to_string(),
            session_uuid: "u1".to_string(),
            agent_persona: None,
            workflow_phase: None,
            project_id: "p1".to_string(),
            status: "idle".to_string(),
            created_at: 1000,
            updated_at: 1000,
            last_message_at: None,
            workflow_key: None,
            skip_permissions: 0,
            tmux_session: None,
        };
        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("\"status\":\"idle\""));
    }
}
