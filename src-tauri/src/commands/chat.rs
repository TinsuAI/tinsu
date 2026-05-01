use crate::db::entities::{chat_message, chat_session, project, remote_project, ssh_connection};
use crate::error::AppError;
use crate::services::chat_cli::ChatCliService;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use crate::services::pty_service::PtyService;
use crate::services::remote_pty_service::RemotePtyService;
use crate::services::ssh_service;
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

/// Build a `.claude/settings.json` for a remote chat session.
///
/// Each hook is an inline bash one-liner that:
///   1. Reads the Claude Code hook payload from stdin (`INPUT=$(cat)`)
///   2. POSTs it back to `http://127.0.0.1:<port>` (reaches local Tinsu via SSH reverse tunnel)
///   3. Sets `X-Tmux-Session` header from `$TINSU_TMUX_SESSION` so the Rust handler
///      can route to the correct chat session — no jq dependency required.
///
/// The bash command is written into JSON, so internal double quotes are escaped as `\"`.
fn build_remote_chat_settings_json(port: u16) -> String {
    let make_cmd = |endpoint: &str, max_time: u32| -> String {
        format!(
            "INPUT=$(cat); curl -s -X POST 'http://127.0.0.1:{port}/api/hooks/{endpoint}' \
             -H 'Content-Type: application/json' \
             -H \"X-Tmux-Session: $TINSU_TMUX_SESSION\" \
             --connect-timeout 2 --max-time {max_time} \
             -d \"$INPUT\" >/dev/null 2>&1 || true"
        )
    };

    let stop_cmd = make_cmd("chat-stop", 5);
    let post_cmd = make_cmd("chat-tool-use", 5);
    let pre_cmd = make_cmd("chat-pre-tool-use", 300);
    // statusLine fires frequently; keep timeout short so it doesn't block Claude Code.
    let status_cmd = make_cmd("chat-status", 2);

    let v = serde_json::json!({
        "hooks": {
            "Stop": [
                { "matcher": "", "hooks": [{ "type": "command", "command": stop_cmd }] }
            ],
            "PostToolUse": [
                { "matcher": "", "hooks": [{ "type": "command", "command": post_cmd }] }
            ],
            "PreToolUse": [
                { "matcher": "", "hooks": [{ "type": "command", "command": pre_cmd }] }
            ]
        },
        "statusLine": {
            "type": "command",
            "command": status_cmd
        }
    });
    serde_json::to_string_pretty(&v).unwrap_or_else(|_| "{}".to_string())
}

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
    hook_forwarder: State<'_, crate::services::remote_hook_forwarder::RemoteHookForwarderManager>,
    hook_listener: State<'_, std::sync::Mutex<crate::services::hook_listener::HookListenerService>>,
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

    // Determine if this is a remote project and spawn tmux accordingly
    let remote_project_id = project.remote_project_id.clone();

    let tmux_session_name: Option<String> = if let Some(rp_id) = remote_project_id {
        // ── Remote project: create tmux + launch claude via SSH ─────────────
        tracing::info!(
            "create_chat_session [{}]: remote project detected (remote_project_id={}), creating remote tmux session",
            session_uuid, rp_id
        );

        let rp_opt = remote_project::Entity::find_by_id(&rp_id)
            .one(db.inner())
            .await?;

        if let Some(rp) = rp_opt {
            let conn_opt = ssh_connection::Entity::find_by_id(&rp.connection_id)
                .one(db.inner())
                .await?;

            if let Some(conn) = conn_opt {
                let remote_session_name = format!("tinsu-chat-{}", session_uuid);
                let safe_path = rp.path.replace('\'', "'\\''");
                let create_cmd = format!(
                    "tmux new-session -d -s '{}' -c '{}' 2>/dev/null; true",
                    remote_session_name, safe_path
                );

                tracing::info!(
                    "create_chat_session [{}]: SSH exec on {}:{} — {}",
                    session_uuid, conn.host, conn.port, create_cmd
                );

                let create_result = tokio::time::timeout(
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
                .await;

                match create_result {
                    Ok(Ok(_)) => {
                        tracing::info!(
                            "create_chat_session [{}]: remote tmux session '{}' created, launching claude",
                            session_uuid, remote_session_name
                        );

                        // Write .claude/settings.json on the remote with inline curl
                        // hooks so the remote Claude Code POSTs back through the SSH
                        // reverse tunnel. Using inline curl avoids needing to copy hook
                        // scripts to the remote and dodges the jq dependency by passing
                        // tmux_session via X-Tmux-Session header.
                        let local_port = hook_listener
                            .lock()
                            .map(|g| g.port)
                            .unwrap_or(3847);
                        let safe_path_for_settings = rp.path.replace('\'', "'\\''");
                        let settings_json = build_remote_chat_settings_json(local_port);
                        // base64-encode settings JSON to avoid quoting nightmares over SSH
                        use base64::{Engine as _, engine::general_purpose};
                        let settings_b64 = general_purpose::STANDARD.encode(settings_json.as_bytes());
                        let write_settings_cmd = format!(
                            "mkdir -p '{path}/.claude' && echo '{b64}' | base64 -d > '{path}/.claude/settings.json'",
                            path = safe_path_for_settings,
                            b64 = settings_b64
                        );
                        if let Err(e) = ssh_service::run_ssh_exec(
                            &conn.host,
                            conn.port as u16,
                            &conn.username,
                            &conn.auth_method,
                            conn.key_name.as_deref(),
                            None,
                            &write_settings_cmd,
                        )
                        .await
                        {
                            tracing::warn!(
                                "create_chat_session [{}]: failed to write remote .claude/settings.json: {}",
                                session_uuid, e
                            );
                        } else {
                            tracing::info!(
                                "create_chat_session [{}]: wrote remote .claude/settings.json with chat hooks",
                                session_uuid
                            );
                        }

                        // Start the SSH reverse tunnel so remote curl POSTs to
                        // 127.0.0.1:3847 reach the local hook listener (idempotent).
                        if conn.auth_method == "key" {
                            if let Some(ref kname) = conn.key_name {
                                if let Err(e) = hook_forwarder.start(
                                    rp.connection_id.clone(),
                                    conn.host.clone(),
                                    conn.port as u16,
                                    conn.username.clone(),
                                    kname.clone(),
                                    local_port,
                                ) {
                                    tracing::warn!(
                                        "create_chat_session [{}]: hook forwarder start failed: {}",
                                        session_uuid, e
                                    );
                                } else {
                                    tracing::info!(
                                        "create_chat_session [{}]: hook forwarder started for connection {}",
                                        session_uuid, rp.connection_id
                                    );
                                }
                            }
                        } else {
                            tracing::warn!(
                                "create_chat_session [{}]: connection is password-auth; hook forwarder requires key auth, chat panel responses will not work",
                                session_uuid
                            );
                        }

                        // Set TINSU_TMUX_SESSION env var on the remote tmux session so
                        // hook scripts running on the remote can read $TINSU_TMUX_SESSION.
                        let set_env_cmd = format!(
                            "tmux set-environment -t '{}' TINSU_TMUX_SESSION '{}'",
                            remote_session_name, remote_session_name
                        );
                        if let Err(e) = ssh_service::run_ssh_exec(
                            &conn.host,
                            conn.port as u16,
                            &conn.username,
                            &conn.auth_method,
                            conn.key_name.as_deref(),
                            None,
                            &set_env_cmd,
                        )
                        .await
                        {
                            tracing::warn!(
                                "create_chat_session [{}]: remote set-environment failed: {}",
                                session_uuid, e
                            );
                        }

                        // Launch claude on the remote tmux session, prefixed with the
                        // env var inline (set-environment only affects new windows).
                        let claude_flag = if session.skip_permissions != 0 {
                            " --dangerously-skip-permissions"
                        } else {
                            ""
                        };
                        let launch_cmd = format!(
                            "tmux send-keys -t '{}' \"TINSU_TMUX_SESSION='{}' claude{}\" Enter",
                            remote_session_name, remote_session_name, claude_flag
                        );
                        if let Err(e) = ssh_service::run_ssh_exec(
                            &conn.host,
                            conn.port as u16,
                            &conn.username,
                            &conn.auth_method,
                            conn.key_name.as_deref(),
                            None,
                            &launch_cmd,
                        )
                        .await
                        {
                            tracing::warn!(
                                "create_chat_session [{}]: remote claude launch failed (non-fatal): {}",
                                session_uuid, e
                            );
                        }

                        // Inject persona context if applicable (wait 2s for claude to start)
                        if let Some(ref persona) = agent_persona {
                            if !persona.is_empty() {
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                                let escaped_ctx = persona.replace('\'', "'\\''");
                                let ctx_cmd = format!(
                                    "tmux send-keys -t '{}' '{}' Enter",
                                    remote_session_name, escaped_ctx
                                );
                                if let Err(e) = ssh_service::run_ssh_exec(
                                    &conn.host,
                                    conn.port as u16,
                                    &conn.username,
                                    &conn.auth_method,
                                    conn.key_name.as_deref(),
                                    None,
                                    &ctx_cmd,
                                )
                                .await
                                {
                                    tracing::warn!(
                                        "create_chat_session [{}]: remote persona inject failed (non-fatal): {}",
                                        session_uuid, e
                                    );
                                }
                            }
                        }

                        Some(remote_session_name)
                    }
                    Ok(Err(e)) => {
                        tracing::warn!(
                            "create_chat_session [{}]: remote tmux session creation failed (non-fatal): {}",
                            session_uuid, e
                        );
                        None
                    }
                    Err(_) => {
                        tracing::warn!(
                            "create_chat_session [{}]: remote tmux session creation timed out after 15s",
                            session_uuid
                        );
                        None
                    }
                }
            } else {
                tracing::warn!(
                    "create_chat_session [{}]: SSH connection not found for remote project '{}' (connection_id={})",
                    session_uuid, rp_id, rp.connection_id
                );
                None
            }
        } else {
            return Err(AppError::NotFound(
                "Chat is unavailable — the remote project link is stale. \
                 Please close and re-open the project to refresh the connection."
                    .to_string(),
            ));
        }
    } else {
        // ── Local project: existing behavior ────────────────────────────────
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

        match spawn_result {
            Ok(name) => {
                tracing::info!(
                    "create_chat_session [{}]: local tmux session '{}' created",
                    session_uuid, name
                );
                Some(name)
            }
            Err(e) => {
                tracing::warn!(
                    "create_chat_session [{}]: spawn_session failed (non-fatal): {}",
                    session_uuid, e
                );
                None
            }
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
/// When no offset is provided, returns the *latest* `limit` messages so long
/// sessions always show recent messages rather than the oldest ones.
#[tauri::command]
#[specta::specta]
pub async fn get_chat_messages(
    session_id: String,
    limit: Option<u64>,
    offset: Option<u64>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<ChatMessageModel>, AppError> {
    let effective_limit = limit.map(|l| l.min(2000)).unwrap_or(2000);

    if let Some(offset_val) = offset {
        // Explicit offset: return a specific page in ASC order
        let messages = chat_message::Entity::find()
            .filter(chat_message::Column::SessionId.eq(&session_id))
            .order_by_asc(chat_message::Column::CreatedAt)
            .limit(effective_limit)
            .offset(offset_val)
            .all(db.inner())
            .await?;
        Ok(messages.into_iter().map(ChatMessageModel::from).collect())
    } else {
        // No offset: fetch the latest N messages (DESC) then reverse to ASC for the UI
        let mut messages = chat_message::Entity::find()
            .filter(chat_message::Column::SessionId.eq(&session_id))
            .order_by_desc(chat_message::Column::CreatedAt)
            .limit(effective_limit)
            .all(db.inner())
            .await?;
        messages.reverse();
        Ok(messages.into_iter().map(ChatMessageModel::from).collect())
    }
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

    let tmux_session = session.tmux_session.as_deref().unwrap_or("").to_string();

    // Send to tmux (if tmux_session is available)
    if tmux_session.is_empty() {
        tracing::warn!(
            "send_chat_message: session {} has no tmux_session — message stored but NOT executed in any terminal",
            session_id
        );
    } else {
        // Determine whether this is a remote project to route via SSH
        let proj = project::Entity::find_by_id(&session.project_id)
            .one(db.inner())
            .await?;

        let remote_project_id = proj.as_ref().and_then(|p| p.remote_project_id.clone());

        if let Some(rp_id) = remote_project_id {
            // Remote project: send via SSH tmux send-keys on the remote host
            let rp = remote_project::Entity::find_by_id(&rp_id)
                .one(db.inner())
                .await?;

            if let Some(rp) = rp {
                let ssh_conn = ssh_connection::Entity::find_by_id(&rp.connection_id)
                    .one(db.inner())
                    .await?;

                if let Some(ssh_conn) = ssh_conn {
                    // Shell-escape content: replace ' with '\''
                    let escaped = content.replace('\'', "'\\''");
                    let cmd = format!("tmux send-keys -t '{}' '{}' Enter", tmux_session, escaped);

                    tracing::info!(
                        "send_chat_message: SSH exec on {}:{} — tmux send-keys to session '{}'",
                        ssh_conn.host, ssh_conn.port, tmux_session
                    );

                    ssh_service::run_ssh_exec(
                        &ssh_conn.host,
                        ssh_conn.port as u16,
                        &ssh_conn.username,
                        &ssh_conn.auth_method,
                        ssh_conn.key_name.as_deref(),
                        None,
                        &cmd,
                    )
                    .await
                    .map_err(|e| {
                        tracing::warn!("send_chat_message: remote tmux send failed: {}", e);
                        e
                    })?;
                    tracing::info!("send_chat_message: remote tmux send succeeded");
                } else {
                    tracing::warn!("send_chat_message: SSH connection not found for remote project");
                }
            } else {
                return Err(AppError::NotFound(
                    "Chat is unavailable — the remote project link is stale. \
                     Please close and re-open the project to refresh the connection."
                        .to_string(),
                ));
            }
        } else {
            // Local project: send via local tmux
            let chat_cli = ChatCliService;
            if let Err(e) = chat_cli
                .send_message(&tmux_session, &content, tmux.inner())
                .await
            {
                tracing::warn!("send_chat_message: tmux send failed: {}", e);
            }
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
/// Desktop-only: mobile uses remote_agent commands for terminal access.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
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
    remote_pty: State<'_, Arc<RemotePtyService>>,
    app: AppHandle,
) -> Result<AttachResult, AppError> {
    // Load chat session to get tmux_session name and project_id
    let session = chat_session::Entity::find_by_id(&session_id)
        .one(db.inner())
        .await?;

    let session = match session {
        Some(s) => s,
        None => {
            tracing::warn!("attach_chat_terminal: session {} not found", session_id);
            return Ok(AttachResult { process_id: String::new(), attached: false });
        }
    };

    let tmux_session_name = match session.tmux_session.clone() {
        Some(name) => name,
        None => {
            tracing::warn!(
                "attach_chat_terminal: session {} has no tmux_session — terminal cannot attach",
                session_id
            );
            return Ok(AttachResult { process_id: String::new(), attached: false });
        }
    };

    // Determine if this is a remote project
    let proj = project::Entity::find_by_id(&session.project_id)
        .one(db.inner())
        .await?;
    let remote_project_id = proj.as_ref().and_then(|p| p.remote_project_id.clone());

    if let Some(rp_id) = remote_project_id {
        // ── Remote project: attach via SSH PTY ──────────────────────────────
        tracing::info!(
            "attach_chat_terminal: remote project detected, attaching via SSH PTY to session '{}'",
            tmux_session_name
        );

        let rp_opt = remote_project::Entity::find_by_id(&rp_id)
            .one(db.inner())
            .await?;

        let rp = match rp_opt {
            Some(r) => r,
            None => {
                return Err(AppError::NotFound(
                    "Chat is unavailable — the remote project link is stale. \
                     Please close and re-open the project to refresh the connection."
                        .to_string(),
                ));
            }
        };

        let conn_opt = ssh_connection::Entity::find_by_id(&rp.connection_id)
            .one(db.inner())
            .await?;

        let conn = match conn_opt {
            Some(c) => c,
            None => {
                tracing::warn!(
                    "attach_chat_terminal: SSH connection not found for remote project '{}'",
                    rp_id
                );
                return Ok(AttachResult { process_id: String::new(), attached: false });
            }
        };

        let process_id = format!("remote-{}", Uuid::new_v4());
        let cols = cols.unwrap_or(80);
        let rows = rows.unwrap_or(24);

        tracing::info!(
            "attach_chat_terminal: SSH PTY attach on {}:{} for session '{}'",
            conn.host, conn.port, tmux_session_name
        );

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
                session_id.clone(),
                on_data,
                app,
            )
            .await?;

        return Ok(AttachResult { process_id, attached: true });
    }

    // ── Local project: existing behavior ────────────────────────────────────
    // Verify tmux session still exists
    let tmux_ref = tmux.inner().clone();
    let tsn = tmux_session_name.clone();
    let session_exists = tokio::task::spawn_blocking(move || tmux_ref.has_session(&tsn))
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !session_exists {
        tracing::warn!(
            "attach_chat_terminal: local tmux session '{}' not found",
            tmux_session_name
        );
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
/// Desktop-only: mobile uses remote_agent commands for terminal access.
#[cfg(not(any(target_os = "android", target_os = "ios")))]
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
            agent_persona: Some("bmad-agent-pm".to_string()),
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
