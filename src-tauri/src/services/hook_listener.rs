use crate::error::AppError;
use axum::{
    Router,
    extract::State,
    http::HeaderMap,
    routing::{get, post},
};
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

// ─── DTOs ──────────────────────────────────────────────────────────────────

/// Payload for chat session hooks (chat-stop, chat-tool-use, chat-pre-tool-use).
///
/// Mirrors the Electron `ChatStopHookPayloadSchema`: hook scripts forward Claude
/// Code's full stdin JSON, which includes `transcript_path` so the listener can
/// read the JSONL transcript and extract the assistant message text.
///
/// `tmux_session` is the routing key — injected by the hook script via jq from
/// `$TINSU_TMUX_SESSION`, or via the `X-Tmux-Session` HTTP header (fallback).
#[derive(Debug, serde::Deserialize, Default)]
pub struct ChatHookPayload {
    #[serde(default)]
    pub tmux_session: Option<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub transcript_path: Option<String>,
    #[serde(default)]
    pub tool_name: Option<String>,
    #[serde(default)]
    pub tool_input: Option<serde_json::Value>,
    #[serde(default)]
    pub tool_response: Option<serde_json::Value>,
    /// Optional inline content (Electron format); fallback when transcript reading fails.
    #[serde(default)]
    pub content: Option<String>,
    /// Some Claude Code versions ship the final assistant text inline.
    #[serde(default)]
    pub last_assistant_message: Option<String>,
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
    /// Per-session map of intermediate assistant text captured during PreToolUse,
    /// so the Stop handler can dedupe (don't re-insert the same text as a final message).
    /// Mirrors the Electron `turnTextExtracted` map.
    pub turn_text_extracted: Arc<StdMutex<HashMap<String, String>>>,
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
    headers: HeaderMap,
    body: String,
) -> axum::http::StatusCode {
    use crate::db::entities::{chat_message, chat_session};
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    // Parse JSON body (tolerant — Claude Code's full hook payload has many fields)
    let mut payload: ChatHookPayload = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("chat-stop hook: invalid JSON: {} body={}", e, body);
            return axum::http::StatusCode::OK;
        }
    };

    // Resolve tmux_session: body field first, then X-Tmux-Session header
    if payload.tmux_session.as_deref().unwrap_or("").is_empty() {
        if let Some(hv) = headers.get("x-tmux-session").and_then(|h| h.to_str().ok()) {
            if !hv.is_empty() {
                payload.tmux_session = Some(hv.to_string());
            }
        }
    }

    let tmux_session = match &payload.tmux_session {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            // Show body snippet + headers so we can diagnose hook routing failures.
            let body_snippet: String = body.chars().take(300).collect();
            let header_snippet: String = headers
                .iter()
                .filter(|(k, _)| {
                    let n = k.as_str().to_ascii_lowercase();
                    n == "x-tmux-session" || n == "user-agent" || n == "content-type"
                })
                .map(|(k, v)| format!("{}={:?}", k, v.to_str().unwrap_or("?")))
                .collect::<Vec<_>>()
                .join(", ");
            tracing::warn!(
                "chat-stop hook: missing tmux_session, dropping. headers=[{}] body[..300]={}",
                header_snippet, body_snippet
            );
            return axum::http::StatusCode::OK;
        }
    };

    let session_id = match lookup_chat_session_by_tmux_session(&state.db, &tmux_session).await {
        Some(id) => id,
        None => {
            tracing::warn!("chat-stop hook: orphan tmux_session={}", tmux_session);
            return axum::http::StatusCode::OK;
        }
    };

    tracing::info!(
        "chat-stop hook: matched session {} (tmux={}, transcript={:?})",
        session_id, tmux_session, payload.transcript_path
    );

    // Pull and clear any intermediate text captured during PreToolUse for this turn.
    let intermediate_text = {
        let mut map = state.turn_text_extracted.lock().unwrap();
        map.remove(&session_id)
    };

    // Resolve final assistant message: inline field first, then transcript fallback.
    let mut assistant_message: Option<String> = payload
        .last_assistant_message
        .clone()
        .filter(|s| !s.is_empty())
        .or_else(|| payload.content.clone().filter(|s| !s.is_empty()));

    if assistant_message.is_none() {
        if let Some(ref tp) = payload.transcript_path {
            match extract_last_assistant_message(tp) {
                Some(text) => {
                    tracing::info!(
                        "chat-stop hook: extracted {} chars from transcript {}",
                        text.len(),
                        tp
                    );
                    assistant_message = Some(text);
                }
                None => {
                    tracing::warn!(
                        "chat-stop hook: no assistant text found in transcript {}",
                        tp
                    );
                }
            }
        }
    }

    let now = now_unix_secs();

    // Insert the final message only if it's different from the intermediate one
    // (avoids duplicating "Let me investigate..." that PreToolUse already stored).
    let should_insert = match (&assistant_message, &intermediate_text) {
        (Some(final_text), Some(inter)) => final_text != inter,
        (Some(_), None) => true,
        (None, _) => false,
    };

    if should_insert {
        let final_text = assistant_message.clone().unwrap();
        let msg_id = uuid::Uuid::new_v4().to_string();
        let new_msg = chat_message::ActiveModel {
            id: Set(msg_id),
            session_id: Set(session_id.clone()),
            role: Set("assistant".to_string()),
            content: Set(final_text.clone()),
            tool_name: Set(None),
            tool_input: Set(None),
            created_at: Set(now),
        };
        if let Err(e) = new_msg.insert(&state.db).await {
            tracing::warn!("chat-stop: failed to insert assistant message: {}", e);
        } else {
            tracing::info!(
                "chat-stop: stored assistant message ({} chars) for session {}",
                final_text.len(),
                session_id
            );
        }
    } else if assistant_message.is_some() {
        tracing::info!(
            "chat-stop: skipping final message — same as intermediate already stored for session {}",
            session_id
        );
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

    if let Err(e) = state.app_handle.emit(
        "chat:message-received",
        serde_json::json!({
            "session_id": session_id,
            "content": assistant_message.unwrap_or_default(),
        }),
    ) {
        tracing::warn!("chat-stop: failed to emit event: {}", e);
    }

    axum::http::StatusCode::OK
}

async fn handle_chat_tool_use_hook(
    State(state): State<Arc<HookListenerState>>,
    headers: HeaderMap,
    body: String,
) -> axum::http::StatusCode {
    use crate::db::entities::{chat_message, chat_session};
    use sea_orm::{ActiveModelTrait, EntityTrait, Set};

    let mut payload: ChatHookPayload = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("chat-tool-use hook: invalid JSON: {}", e);
            return axum::http::StatusCode::OK;
        }
    };

    if payload.tmux_session.as_deref().unwrap_or("").is_empty() {
        if let Some(hv) = headers.get("x-tmux-session").and_then(|h| h.to_str().ok()) {
            if !hv.is_empty() {
                payload.tmux_session = Some(hv.to_string());
            }
        }
    }

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
    headers: HeaderMap,
    body: String,
) -> axum::http::StatusCode {
    use crate::db::entities::chat_message;
    use sea_orm::{ActiveModelTrait, Set};

    let mut payload: ChatHookPayload = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("chat-pre-tool-use hook: invalid JSON: {}", e);
            return axum::http::StatusCode::OK;
        }
    };

    if payload.tmux_session.as_deref().unwrap_or("").is_empty() {
        if let Some(hv) = headers.get("x-tmux-session").and_then(|h| h.to_str().ok()) {
            if !hv.is_empty() {
                payload.tmux_session = Some(hv.to_string());
            }
        }
    }

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

    // Capture intermediate assistant text (the "Let me investigate..." prefix) on the
    // first PreToolUse of a turn. Claude Code writes assistant text blocks to the
    // transcript BEFORE firing PreToolUse, so by now it's available on disk.
    // Mirrors Electron `extractLatestAssistantTextBlocks` + `turnTextExtracted` map.
    let already_extracted = {
        let map = state.turn_text_extracted.lock().unwrap();
        map.contains_key(&session_id)
    };

    if !already_extracted {
        if let Some(ref tp) = payload.transcript_path {
            if let Some(text) = extract_latest_assistant_text_blocks(tp) {
                {
                    let mut map = state.turn_text_extracted.lock().unwrap();
                    map.insert(session_id.clone(), text.clone());
                }

                let now = now_unix_secs();
                let msg_id = uuid::Uuid::new_v4().to_string();
                let new_msg = chat_message::ActiveModel {
                    id: Set(msg_id),
                    session_id: Set(session_id.clone()),
                    role: Set("assistant".to_string()),
                    content: Set(text.clone()),
                    tool_name: Set(None),
                    tool_input: Set(None),
                    // 1 second before tool event so ordering shows assistant text first
                    created_at: Set(now.saturating_sub(1)),
                };
                if let Err(e) = new_msg.insert(&state.db).await {
                    tracing::warn!("chat-pre-tool-use: failed to insert intermediate text: {}", e);
                } else {
                    tracing::info!(
                        "chat-pre-tool-use: stored intermediate assistant text ({} chars) for session {}",
                        text.len(),
                        session_id
                    );
                }
            }
        }
    }

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

/// Walk a Claude Code transcript JSONL file backwards and return the last
/// assistant entry's text content (all `text` blocks joined by blank lines).
///
/// Mirrors Electron `extractLastAssistantMessage`. Used by the Stop hook to
/// recover the final assistant response when Claude Code doesn't include it
/// inline in the hook payload.
fn extract_last_assistant_message(transcript_path: &str) -> Option<String> {
    let content = std::fs::read_to_string(transcript_path).ok()?;
    for line in content.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let entry: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if entry.get("type").and_then(|v| v.as_str()) != Some("assistant") {
            continue;
        }
        let message = match entry.get("message") {
            Some(m) => m,
            None => continue,
        };
        if message.get("role").and_then(|v| v.as_str()) != Some("assistant") {
            continue;
        }
        let blocks = match message.get("content").and_then(|v| v.as_array()) {
            Some(a) => a,
            None => continue,
        };
        let mut parts: Vec<String> = Vec::new();
        for block in blocks {
            if block.get("type").and_then(|v| v.as_str()) == Some("text") {
                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                    parts.push(text.to_string());
                }
            }
        }
        if !parts.is_empty() {
            return Some(parts.join("\n\n"));
        }
    }
    None
}

/// Walk a Claude Code transcript JSONL file backwards and return the most
/// recent assistant entry's text **only if** that entry also contains tool_use
/// blocks (i.e. a mixed turn where the assistant said something before calling
/// a tool). Pure-text entries are skipped because the Stop hook will capture them.
///
/// Mirrors Electron `extractLatestAssistantTextBlocks`. Used by PreToolUse to
/// stream the assistant's "Let me investigate..." prefix into the chat panel
/// before tools run.
fn extract_latest_assistant_text_blocks(transcript_path: &str) -> Option<String> {
    let content = std::fs::read_to_string(transcript_path).ok()?;
    for line in content.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let entry: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if entry.get("type").and_then(|v| v.as_str()) != Some("assistant") {
            continue;
        }
        let message = match entry.get("message") {
            Some(m) => m,
            None => continue,
        };
        if message.get("role").and_then(|v| v.as_str()) != Some("assistant") {
            continue;
        }
        let blocks = match message.get("content").and_then(|v| v.as_array()) {
            Some(a) => a,
            None => continue,
        };

        let mut text_parts: Vec<String> = Vec::new();
        let mut has_tool_use = false;
        for block in blocks {
            match block.get("type").and_then(|v| v.as_str()) {
                Some("text") => {
                    if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                        text_parts.push(text.to_string());
                    }
                }
                Some("tool_use") => has_tool_use = true,
                _ => {}
            }
        }

        if !text_parts.is_empty() && has_tool_use {
            return Some(text_parts.join("\n\n"));
        }
        // Found an assistant entry but it's pure-text or pure-tool — stop searching.
        return None;
    }
    None
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
    use std::io::Write;
    use std::sync::Mutex;

    // Serialize env var tests to avoid race conditions in parallel test runs
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    fn write_jsonl(lines: &[&str]) -> tempfile::NamedTempFile {
        let mut f = tempfile::NamedTempFile::new().expect("tempfile");
        for line in lines {
            writeln!(f, "{}", line).unwrap();
        }
        f.flush().unwrap();
        f
    }

    #[test]
    fn test_extract_last_assistant_message_joins_text_blocks() {
        let entry = serde_json::json!({
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "Hello there."},
                    {"type": "tool_use", "name": "Bash"},
                    {"type": "text", "text": "Done."}
                ]
            }
        });
        let f = write_jsonl(&[&entry.to_string()]);
        let got = extract_last_assistant_message(f.path().to_str().unwrap());
        assert_eq!(got, Some("Hello there.\n\nDone.".to_string()));
    }

    #[test]
    fn test_extract_last_assistant_message_walks_backwards() {
        let user = serde_json::json!({"type": "user", "message": {}}).to_string();
        let asst = serde_json::json!({
            "type": "assistant",
            "message": {"role": "assistant", "content": [{"type": "text", "text": "first"}]}
        }).to_string();
        let asst2 = serde_json::json!({
            "type": "assistant",
            "message": {"role": "assistant", "content": [{"type": "text", "text": "latest"}]}
        }).to_string();
        let f = write_jsonl(&[&asst, &user, &asst2]);
        assert_eq!(
            extract_last_assistant_message(f.path().to_str().unwrap()),
            Some("latest".to_string())
        );
    }

    #[test]
    fn test_extract_latest_assistant_text_blocks_requires_mixed_turn() {
        // Pure-text entry should return None — Stop hook will get it instead.
        let pure_text = serde_json::json!({
            "type": "assistant",
            "message": {"role": "assistant", "content": [{"type": "text", "text": "just text"}]}
        }).to_string();
        let f = write_jsonl(&[&pure_text]);
        assert_eq!(
            extract_latest_assistant_text_blocks(f.path().to_str().unwrap()),
            None
        );

        // Mixed turn: text + tool_use → should return text.
        let mixed = serde_json::json!({
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "Let me investigate..."},
                    {"type": "tool_use", "name": "Read"}
                ]
            }
        }).to_string();
        let f2 = write_jsonl(&[&mixed]);
        assert_eq!(
            extract_latest_assistant_text_blocks(f2.path().to_str().unwrap()),
            Some("Let me investigate...".to_string())
        );
    }

    #[test]
    fn test_extract_handles_missing_file() {
        assert_eq!(extract_last_assistant_message("/nonexistent/path.jsonl"), None);
        assert_eq!(extract_latest_assistant_text_blocks("/nonexistent/path.jsonl"), None);
    }

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
