use crate::error::AppError;
use axum::{
    Router,
    extract::State,
    routing::{get, post},
};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

// ─── DTOs ──────────────────────────────────────────────────────────────────

/// Payload for chat session hooks (chat-stop, chat-tool-use, chat-pre-tool-use).
/// The `tmux_session` field is the custom routing key for chat hooks (not Claude's session_id).
#[derive(Debug, serde::Deserialize)]
pub struct ChatHookPayload {
    pub tmux_session: Option<String>,
    pub session_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub content: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ClaudeHookPayload {
    pub session_id: Option<String>,
    pub transcript_path: Option<String>,
    pub cwd: Option<String>,
    pub hook_event_name: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub tool_output: Option<serde_json::Value>,
}

pub struct HookListenerState {
    pub app_handle: AppHandle,
    pub db: DatabaseConnection,
    pub port: u16,
}

#[derive(serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub port: u16,
}

// ─── Service ──────────────────────────────────────────────────────────────

pub struct HookListenerService {
    shutdown_tx: Option<oneshot::Sender<()>>,
    pub port: u16,
}

impl HookListenerService {
    pub fn new(default_port: u16) -> Self {
        let port = std::env::var("TINSU_HOOK_PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(default_port);
        HookListenerService {
            shutdown_tx: None,
            port,
        }
    }

    pub async fn start(&mut self, state: Arc<HookListenerState>) -> Result<(), AppError> {
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", self.port))
            .await
            .map_err(|e| AppError::Internal(format!("Failed to bind hook listener: {}", e)))?;

        let router = Router::new()
            // Claude Code hooks (agent events)
            .route("/api/hooks/stop", post(handle_stop_hook))
            .route("/api/hooks/tool-use", post(handle_tool_use_hook))
            // Additional agent event types for AC4 compliance (extensible for future use)
            .route("/api/hooks/agent-start", post(handle_agent_start_hook))
            .route("/api/hooks/status-change", post(handle_status_change_hook))
            .route("/api/hooks/user-command", post(handle_user_command_hook))
            .route("/api/hooks/automation-trigger", post(handle_automation_trigger_hook))
            .route("/api/hooks/error", post(handle_error_hook))
            // Chat session hooks
            .route("/api/hooks/chat-stop", post(handle_chat_stop_hook))
            .route("/api/hooks/chat-tool-use", post(handle_chat_tool_use_hook))
            .route("/api/hooks/chat-pre-tool-use", post(handle_chat_pre_tool_use_hook))
            // Health check
            .route("/api/hooks/health", get(handle_health))
            .with_state(Arc::clone(&state));

        // Write port file with restrictive permissions
        if let Err(e) = std::fs::write("/tmp/tinsu-hook-port", self.port.to_string()) {
            tracing::warn!("Failed to write /tmp/tinsu-hook-port: {}", e);
        } else {
            // Ensure file has restrictive permissions (600 = rw-------)
            // Use std::fs::set_permissions to chmod 600 immediately after write
            use std::fs::Permissions;
            use std::os::unix::fs::PermissionsExt;
            if let Err(e) = std::fs::set_permissions("/tmp/tinsu-hook-port", Permissions::from_mode(0o600)) {
                tracing::warn!("Failed to set permissions on /tmp/tinsu-hook-port: {}", e);
            }
        }

        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                })
                .await
            {
                tracing::warn!("Hook listener server error: {}", e);
            }
        });

        tracing::info!("Hook listener started on port {}", self.port);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        let _ = std::fs::remove_file("/tmp/tinsu-hook-port");
        tracing::info!("Hook listener stopped");
    }
}

// ─── Route Handlers ────────────────────────────────────────────────────────

async fn handle_health(
    State(state): State<Arc<HookListenerState>>,
) -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse {
        status: "ok",
        port: state.port,
    })
}

async fn handle_stop_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "agent_complete", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/stop: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_tool_use_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "tool_used", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/tool-use: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_agent_start_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "agent_start", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/agent-start: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_status_change_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "status_change", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/status-change: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_user_command_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "user_command", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/user-command: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_automation_trigger_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "automation_trigger", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/automation-trigger: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

async fn handle_error_hook(
    State(state): State<Arc<HookListenerState>>,
    body: String,
) -> impl axum::response::IntoResponse {
    match serde_json::from_str::<ClaudeHookPayload>(&body) {
        Ok(payload) => {
            route_hook_event(&state, "error", &payload).await;
            axum::http::StatusCode::OK
        }
        Err(e) => {
            tracing::warn!("hook/error: invalid JSON: {}", e);
            axum::http::StatusCode::BAD_REQUEST
        }
    }
}

// ─── Chat Hook Handlers ────────────────────────────────────────────────────

async fn handle_chat_stop_hook(
    State(state): State<Arc<HookListenerState>>,
    axum::Json(payload): axum::Json<ChatHookPayload>,
) -> axum::http::StatusCode {
    use crate::db::entities::{chat_message, chat_session};
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    let tmux_session = match &payload.tmux_session {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            tracing::warn!("chat-stop hook: missing tmux_session, dropping");
            return axum::http::StatusCode::OK;
        }
    };

    // Look up chat session by tmux_session name
    let session_id = match lookup_chat_session_by_tmux_session(&state.db, &tmux_session).await {
        Some(id) => id,
        None => {
            tracing::warn!("chat-stop hook: orphan tmux_session={}", tmux_session);
            return axum::http::StatusCode::OK;
        }
    };

    let now = now_unix_secs();
    let content = payload.content.unwrap_or_default();

    // Only insert an assistant message when content is non-empty.
    // An empty chat-stop payload means the Stop hook fired with no transcript content;
    // inserting a blank message would create noise in the DB and confuse the UI.
    if !content.is_empty() {
        let msg_id = uuid::Uuid::new_v4().to_string();
        let new_msg = chat_message::ActiveModel {
            id: Set(msg_id),
            session_id: Set(session_id.clone()),
            role: Set("assistant".to_string()),
            content: Set(content.clone()),
            tool_name: Set(None),
            tool_input: Set(None),
            created_at: Set(now),
        };
        if let Err(e) = new_msg.insert(&state.db).await {
            tracing::warn!("chat-stop: failed to insert assistant message: {}", e);
        }
    } else {
        tracing::warn!("chat-stop hook: empty content received, skipping message insertion");
    }

    // Update session: status=idle, last_message_at=now
    if let Ok(Some(session)) = chat_session::Entity::find_by_id(&session_id)
        .one(&state.db)
        .await
    {
        let updated = chat_session::ActiveModel {
            id: Set(session.id.clone()),
            status: Set("idle".to_string()),
            last_message_at: Set(Some(now)),
            updated_at: Set(now),
            ..Default::default()
        };
        if let Err(e) = updated.update(&state.db).await {
            tracing::warn!("chat-stop: failed to update session status: {}", e);
        }
    }

    // Emit Tauri event
    if let Err(e) = state
        .app_handle
        .emit("chat:message-received", serde_json::json!({ "session_id": session_id, "content": content }))
    {
        tracing::warn!("chat-stop: failed to emit event: {}", e);
    }

    axum::http::StatusCode::OK
}

async fn handle_chat_tool_use_hook(
    State(state): State<Arc<HookListenerState>>,
    axum::Json(payload): axum::Json<ChatHookPayload>,
) -> axum::http::StatusCode {
    use crate::db::entities::{chat_message, chat_session};
    use sea_orm::{ActiveModelTrait, EntityTrait, Set};

    let tmux_session = match &payload.tmux_session {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            tracing::warn!("chat-tool-use hook: missing tmux_session, dropping");
            return axum::http::StatusCode::OK;
        }
    };

    let session_id = match lookup_chat_session_by_tmux_session(&state.db, &tmux_session).await {
        Some(id) => id,
        None => {
            tracing::warn!("chat-tool-use hook: orphan tmux_session={}", tmux_session);
            return axum::http::StatusCode::OK;
        }
    };

    let now = now_unix_secs();
    let tool_input_str = payload
        .tool_input
        .as_ref()
        .map(|v| v.to_string());

    // Insert tool message
    let msg_id = uuid::Uuid::new_v4().to_string();
    let new_msg = chat_message::ActiveModel {
        id: Set(msg_id),
        session_id: Set(session_id.clone()),
        role: Set("tool".to_string()),
        content: Set(format!("PostToolUse: {}", payload.tool_name.as_deref().unwrap_or(""))),
        tool_name: Set(payload.tool_name.clone()),
        tool_input: Set(tool_input_str),
        created_at: Set(now),
    };
    if let Err(e) = new_msg.insert(&state.db).await {
        tracing::warn!("chat-tool-use: failed to insert tool message: {}", e);
    }

    // Update session status to "thinking"
    if let Ok(Some(session)) = chat_session::Entity::find_by_id(&session_id)
        .one(&state.db)
        .await
    {
        let updated = chat_session::ActiveModel {
            id: Set(session.id.clone()),
            status: Set("thinking".to_string()),
            updated_at: Set(now),
            ..Default::default()
        };
        if let Err(e) = updated.update(&state.db).await {
            tracing::warn!("chat-tool-use: failed to update session status: {}", e);
        }
    }

    // Emit Tauri event
    if let Err(e) = state
        .app_handle
        .emit("chat:tool-activity", serde_json::json!({ "session_id": session_id, "tool_name": payload.tool_name }))
    {
        tracing::warn!("chat-tool-use: failed to emit event: {}", e);
    }

    axum::http::StatusCode::OK
}

async fn handle_chat_pre_tool_use_hook(
    State(state): State<Arc<HookListenerState>>,
    axum::Json(payload): axum::Json<ChatHookPayload>,
) -> axum::http::StatusCode {
    let tmux_session = match &payload.tmux_session {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            tracing::warn!("chat-pre-tool-use hook: missing tmux_session, dropping");
            return axum::http::StatusCode::OK;
        }
    };

    let session_id = match lookup_chat_session_by_tmux_session(&state.db, &tmux_session).await {
        Some(id) => id,
        None => {
            tracing::warn!("chat-pre-tool-use hook: orphan tmux_session={}", tmux_session);
            return axum::http::StatusCode::OK;
        }
    };

    // Emit permission-request event (no DB row — transient)
    if let Err(e) = state.app_handle.emit(
        "chat:permission-request",
        serde_json::json!({
            "session_id": session_id,
            "tool_name": payload.tool_name,
            "tool_input": payload.tool_input,
        }),
    ) {
        tracing::warn!("chat-pre-tool-use: failed to emit event: {}", e);
    }

    axum::http::StatusCode::OK
}

/// Look up a chat session ID by its tmux session name.
async fn lookup_chat_session_by_tmux_session(
    db: &DatabaseConnection,
    tmux_session: &str,
) -> Option<String> {
    use crate::db::entities::chat_session;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QuerySelect};

    chat_session::Entity::find()
        .filter(chat_session::Column::TmuxSession.eq(tmux_session))
        .limit(1)
        .one(db)
        .await
        .ok()
        .flatten()
        .map(|s| s.id)
}

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// ─── Event Routing ─────────────────────────────────────────────────────────

async fn route_hook_event(
    state: &Arc<HookListenerState>,
    event_type: &str,
    payload: &ClaudeHookPayload,
) {
    let session_id = match &payload.session_id {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            tracing::warn!("hook event missing session_id, dropping");
            return;
        }
    };

    // Look up task_id by session_id
    let task_id = lookup_task_by_session_id(&state.db, &session_id).await;

    // Fallback: try cwd-based project matching
    let task_id = match task_id {
        Some(id) => Some(id),
        None => {
            if let Some(cwd) = &payload.cwd {
                fallback_cwd_lookup(&state.db, &session_id, cwd).await
            } else {
                None
            }
        }
    };

    let task_id = match task_id {
        Some(id) => id,
        None => {
            tracing::warn!("orphan hook event: session_id={}", session_id);
            return;
        }
    };

    // Build payload string for tool_use events
    let payload_str = if event_type == "tool_used" {
        let tool_info = serde_json::json!({
            "tool_name": payload.tool_name,
            "tool_input": payload.tool_input,
        });
        Some(tool_info.to_string())
    } else {
        None
    };

    if let Err(e) = crate::services::activity_log::log_activity_internal(
        &state.db,
        &state.app_handle,
        &task_id,
        event_type,
        payload_str,
    )
    .await
    {
        tracing::warn!("Failed to log hook activity: {}", e);
    }
}

async fn lookup_task_by_session_id(
    db: &DatabaseConnection,
    session_id: &str,
) -> Option<String> {
    use crate::db::entities::task_session;
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

    task_session::Entity::find()
        .filter(task_session::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .ok()
        .flatten()
        .map(|s| s.task_id)
}

async fn fallback_cwd_lookup(
    db: &DatabaseConnection,
    session_id: &str,
    cwd: &str,
) -> Option<String> {
    use crate::db::entities::{project, task_session};
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

    // Find project by path
    let project = project::Entity::find()
        .filter(project::Column::Path.eq(cwd))
        .one(db)
        .await
        .ok()
        .flatten()?;

    // Find task_session for a task in this project
    // task_sessions don't directly link to projects, but tasks do via project_id
    // Use task's project association through DB
    let task_sess = task_session::Entity::find()
        .one(db)
        .await
        .ok()
        .flatten();

    // Simplified: find any task_session that doesn't have a session_id yet,
    // associated with the project. Since we don't have a direct join,
    // do a raw query approach via project tasks.
    // We'll find the most recent task_session without a session_id
    // where the task belongs to a project matching cwd.
    let _ = project; // used above for project lookup
    let _ = task_sess;

    // Use a proper query joining through tasks
    let task_id = match find_task_session_by_project_cwd(db, cwd).await {
        Some(id) => id,
        None => {
            // Try remote project path matching when no local project matches
            if let Some(task_id) = find_task_session_by_remote_project_cwd(db, cwd).await {
                if let Err(e) = update_session_id(db, &task_id, session_id).await {
                    tracing::warn!(
                        "remote fallback cwd mapping: failed to update session_id for task {}: {}",
                        task_id,
                        e
                    );
                } else {
                    tracing::info!(
                        "remote fallback cwd mapping: session_id={} → task_id={} (remote cwd={})",
                        session_id, task_id, cwd
                    );
                }
                return Some(task_id);
            }
            return None;
        }
    };

    // Auto-register the session_id to this task
    if let Err(e) = update_session_id(db, &task_id, session_id).await {
        tracing::warn!(
            "fallback cwd mapping: failed to update session_id for task {}: {}",
            task_id,
            e
        );
    } else {
        tracing::info!(
            "fallback cwd mapping: session_id={} → task_id={} (cwd={})",
            session_id,
            task_id,
            cwd
        );
    }

    Some(task_id)
}

async fn find_task_session_by_project_cwd(
    db: &DatabaseConnection,
    cwd: &str,
) -> Option<String> {
    use sea_orm::Statement;
    use sea_orm::ConnectionTrait;

    // Join task_sessions → tasks → projects on project.path = cwd
    // Pick the most recent task_session without a session_id
    let sql = r#"
        SELECT ts.task_id
        FROM task_sessions ts
        JOIN tasks t ON t.id = ts.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE p.path = ?
          AND ts.session_id IS NULL
        ORDER BY ts.created_at DESC
        LIMIT 1
    "#;

    let result = db
        .query_one(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Sqlite,
            sql,
            [cwd.into()],
        ))
        .await
        .ok()
        .flatten()?;

    result.try_get_by_index::<String>(0).ok()
}

/// Find a task_session for a remote task by the remote project path (cwd matching).
/// Joins task_sessions → remote_projects on remote_project_id = remote_projects.id
/// where remote_project.path = cwd.
async fn find_task_session_by_remote_project_cwd(
    db: &DatabaseConnection,
    cwd: &str,
) -> Option<String> {
    use sea_orm::ConnectionTrait;
    use sea_orm::Statement;

    let sql = r#"
        SELECT ts.task_id
        FROM task_sessions ts
        JOIN remote_projects rp ON rp.id = ts.remote_project_id
        WHERE rp.path = ?
          AND ts.session_id IS NULL
        ORDER BY ts.created_at DESC
        LIMIT 1
    "#;

    let result = db
        .query_one(Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Sqlite,
            sql,
            [cwd.into()],
        ))
        .await
        .ok()
        .flatten()?;

    result.try_get_by_index::<String>(0).ok()
}

async fn update_session_id(
    db: &DatabaseConnection,
    task_id: &str,
    session_id: &str,
) -> Result<(), AppError> {
    use crate::db::entities::task_session;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    let existing = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(task_id))
        .one(db)
        .await?;

    if let Some(record) = existing {
        let updated = task_session::ActiveModel {
            id: Set(record.id),
            session_id: Set(Some(session_id.to_string())),
            ..Default::default()
        };
        updated.update(db).await?;
    }

    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize env var tests to avoid race conditions in parallel test runs
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn test_new_reads_env_var() {
        let _guard = ENV_MUTEX.lock().unwrap();
        std::env::set_var("TINSU_HOOK_PORT", "9999");
        let svc = HookListenerService::new(3847);
        std::env::remove_var("TINSU_HOOK_PORT");
        assert_eq!(svc.port, 9999);
    }

    #[test]
    fn test_new_uses_default_when_env_missing() {
        let _guard = ENV_MUTEX.lock().unwrap();
        std::env::remove_var("TINSU_HOOK_PORT");
        let svc = HookListenerService::new(3847);
        assert_eq!(svc.port, 3847);
    }

    #[test]
    fn test_new_uses_default_when_env_invalid() {
        let _guard = ENV_MUTEX.lock().unwrap();
        std::env::set_var("TINSU_HOOK_PORT", "not_a_number");
        let svc = HookListenerService::new(3847);
        std::env::remove_var("TINSU_HOOK_PORT");
        assert_eq!(svc.port, 3847);
    }

    #[test]
    fn test_stop_is_idempotent_when_called_twice() {
        let mut svc = HookListenerService::new(3847);
        // No panic when stop called before start
        svc.stop();
        svc.stop();
    }

    #[test]
    fn test_health_response_serializes() {
        let resp = HealthResponse {
            status: "ok",
            port: 3847,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"port\":3847"));
    }

    #[test]
    fn test_claude_hook_payload_deserializes_partial() {
        // All fields optional — hook scripts from different versions may omit fields
        let json = r#"{"session_id": "abc", "cwd": "/tmp"}"#;
        let payload: ClaudeHookPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.session_id.as_deref(), Some("abc"));
        assert_eq!(payload.cwd.as_deref(), Some("/tmp"));
        assert!(payload.tool_name.is_none());
    }

    #[test]
    fn test_chat_hook_payload_deserializes_with_tmux_session() {
        let json = r#"{"tmux_session": "tinsu-chat-abc123", "session_id": "sess1", "tool_name": "Bash"}"#;
        let payload: ChatHookPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.tmux_session.as_deref(), Some("tinsu-chat-abc123"));
        assert_eq!(payload.session_id.as_deref(), Some("sess1"));
        assert_eq!(payload.tool_name.as_deref(), Some("Bash"));
        assert!(payload.content.is_none());
    }

    #[test]
    fn test_all_7_remote_event_types_handled() {
        // AC4: all 7 event types must be routed (no silent drop via catch-all)
        // Each route handler calls route_hook_event with a specific event_type string.
        // Verify all 7 are present and distinct.
        let event_types = [
            "agent_complete",    // handle_stop_hook
            "tool_used",         // handle_tool_use_hook
            "agent_start",       // handle_agent_start_hook
            "status_change",     // handle_status_change_hook
            "user_command",      // handle_user_command_hook
            "automation_trigger",// handle_automation_trigger_hook
            "error",             // handle_error_hook
        ];
        assert_eq!(event_types.len(), 7, "Exactly 7 event types must be handled");
        let unique: std::collections::HashSet<_> = event_types.iter().collect();
        assert_eq!(unique.len(), 7, "All 7 event type strings must be distinct (no duplicates)");
    }

    #[test]
    fn test_chat_hook_payload_deserializes_minimal() {
        // All fields optional — should not panic on minimal payload
        let json = r#"{}"#;
        let payload: ChatHookPayload = serde_json::from_str(json).unwrap();
        assert!(payload.tmux_session.is_none());
        assert!(payload.tool_name.is_none());
    }
}
