use crate::error::AppError;
use crate::services::tmux_service::TmuxService;
use sea_orm::DatabaseConnection;
use std::sync::Arc;

// ─── ChatCliService ────────────────────────────────────────────────────────

/// Stateless service for managing Claude Code CLI chat sessions via tmux.
pub struct ChatCliService;

fn build_persona_context(agent_persona: Option<&str>) -> String {
    match agent_persona {
        Some("pm") => "You are acting as a Product Manager using the BMAD Method. Focus on requirements, user stories, and product vision.".to_string(),
        Some("architect") => "You are acting as a System Architect using the BMAD Method. Focus on technical design, system architecture, and technology decisions.".to_string(),
        Some("ux") => "You are acting as a UX Designer using the BMAD Method. Focus on user experience, interface design, and usability.".to_string(),
        Some("dev") => "You are acting as a Senior Developer using the BMAD Method. Focus on implementation, code quality, and technical execution.".to_string(),
        Some("qa") => "You are acting as a QA Engineer using the BMAD Method. Focus on test strategies, quality assurance, and defect prevention.".to_string(),
        Some(custom) => custom.to_string(),
        None => String::new(),
    }
}

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

impl ChatCliService {
    /// Create a new tmux session for a chat session.
    /// Returns the tmux session name. Idempotent if session already exists.
    pub async fn spawn_session(
        &self,
        session_uuid: &str,
        project_path: &str,
        agent_persona: Option<&str>,
        skip_permissions: bool,
        hooks_resource_dir: &str,
        tmux_service: &Arc<TmuxService>,
    ) -> Result<String, AppError> {
        let tmux_session_name = format!("tinsu-chat-{}", session_uuid);

        // Idempotent: return early if session already exists
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session_name.clone();
        let exists =
            tokio::task::spawn_blocking(move || tmux_ref.has_session(&tsn))
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;

        if exists {
            return Ok(tmux_session_name);
        }

        // Create tmux session
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session_name.clone();
        let cwd = project_path.to_string();
        tokio::task::spawn_blocking(move || tmux_ref.create_session(&tsn, &cwd))
            .await
            .map_err(|e| AppError::Internal(e.to_string()))??;

        // Set TINSU_TMUX_SESSION env var on the tmux session so child Claude Code
        // hook scripts can read it via $TINSU_TMUX_SESSION (mirrors Electron CTM-1.1).
        // tmux set-environment only affects new windows, so we ALSO inline the env var
        // in the claude launch command below.
        let set_env_cmd = format!(
            "tmux set-environment -t '{}' TINSU_TMUX_SESSION '{}'",
            tmux_session_name, tmux_session_name
        );
        if let Err(e) = tokio::process::Command::new("bash")
            .arg("-c")
            .arg(&set_env_cmd)
            .output()
            .await
        {
            tracing::warn!(
                "spawn_session: failed to set TINSU_TMUX_SESSION on {}: {}",
                tmux_session_name, e
            );
        }

        // Build claude command — prefix with TINSU_TMUX_SESSION inline so the
        // already-running shell inherits it (set-environment only hits new windows).
        let env_prefix = format!("TINSU_TMUX_SESSION='{}' ", tmux_session_name);
        let claude_cmd = if skip_permissions {
            format!("{}claude --dangerously-skip-permissions", env_prefix)
        } else {
            format!("{}claude", env_prefix)
        };

        // Send the claude launch command to tmux
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session_name.clone();
        let cmd = claude_cmd.clone();
        tokio::task::spawn_blocking(move || tmux_ref.send_keys(&tsn, &cmd))
            .await
            .map_err(|e| AppError::Internal(e.to_string()))??;

        // Inject persona context if non-empty
        let persona_context = build_persona_context(agent_persona);
        if !persona_context.is_empty() {
            // Wait 2s for claude to start before sending persona context
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            let tmux_ref = tmux_service.clone();
            let tsn = tmux_session_name.clone();
            let ctx = persona_context.clone();
            if let Err(e) =
                tokio::task::spawn_blocking(move || tmux_ref.send_keys(&tsn, &ctx))
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?
            {
                tracing::warn!("Failed to inject persona context into chat session {}: {}", session_uuid, e);
            }
        }

        // Write session hooks to project's .claude/settings.json
        self.write_session_hooks(project_path, hooks_resource_dir).await?;

        Ok(tmux_session_name)
    }

    /// Send a message to a chat session's tmux session.
    pub async fn send_message(
        &self,
        tmux_session: &str,
        content: &str,
        tmux_service: &Arc<TmuxService>,
    ) -> Result<(), AppError> {
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session.to_string();
        let msg = content.to_string();
        tokio::task::spawn_blocking(move || tmux_ref.send_keys(&tsn, &msg))
            .await
            .map_err(|e| AppError::Internal(e.to_string()))??;
        Ok(())
    }

    /// Kill a chat session's tmux session (best-effort, warn on failure).
    pub async fn kill_session(
        &self,
        tmux_session: &str,
        tmux_service: &Arc<TmuxService>,
    ) -> Result<(), AppError> {
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session.to_string();
        if let Err(e) = tokio::task::spawn_blocking(move || tmux_ref.kill_session(&tsn))
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
        {
            tracing::warn!("Failed to kill chat tmux session {}: {}", tmux_session, e);
        }
        Ok(())
    }

    /// Check if a tmux session exists (used for startup validation and health monitoring).
    pub async fn get_session_status(
        &self,
        tmux_session: &str,
        tmux_service: &Arc<TmuxService>,
    ) -> bool {
        let tmux_ref = tmux_service.clone();
        let tsn = tmux_session.to_string();
        tokio::task::spawn_blocking(move || tmux_ref.has_session(&tsn))
            .await
            .unwrap_or(false)
    }

    /// Write (or merge) three chat hook entries into `.claude/settings.json` inside the project dir.
    pub async fn write_session_hooks(
        &self,
        project_path: &str,
        hooks_resource_dir: &str,
    ) -> Result<(), AppError> {
        let claude_dir = std::path::PathBuf::from(project_path).join(".claude");
        tokio::fs::create_dir_all(&claude_dir).await.map_err(|e| {
            AppError::Internal(format!("Failed to create .claude dir: {}", e))
        })?;

        let settings_path = claude_dir.join("settings.json");

        // Read existing settings or create empty JSON object
        let mut settings: serde_json::Value = if settings_path.exists() {
            let content =
                tokio::fs::read_to_string(&settings_path).await.map_err(|e| {
                    AppError::Internal(format!("Failed to read settings.json: {}", e))
                })?;
            serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        // Build hook script paths from the bundled resource directory
        let hooks_dir = std::path::PathBuf::from(hooks_resource_dir);
        let chat_stop_path = hooks_dir
            .join("chat-stop.sh")
            .to_string_lossy()
            .to_string();
        let chat_tool_use_path = hooks_dir
            .join("chat-tool-use.sh")
            .to_string_lossy()
            .to_string();
        let chat_pre_tool_use_path = hooks_dir
            .join("chat-pre-tool-use.sh")
            .to_string_lossy()
            .to_string();

        // Ensure top-level "hooks" key exists as an object
        if settings.get("hooks").is_none() {
            settings["hooks"] = serde_json::json!({});
        }

        let hooks = settings["hooks"]
            .as_object_mut()
            .ok_or_else(|| AppError::Internal("hooks field is not an object".to_string()))?;

        // Helper: check if a hook entry with the exact command already exists in the array.
        // Prevents duplicate entries when spawn_session is called multiple times for the same project.
        let command_exists = |arr: &[serde_json::Value], cmd: &str| -> bool {
            arr.iter().any(|entry| {
                entry
                    .get("hooks")
                    .and_then(|h| h.as_array())
                    .map(|inner| {
                        inner.iter().any(|h| {
                            h.get("command")
                                .and_then(|c| c.as_str())
                                .map(|c| c == cmd)
                                .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false)
            })
        };

        // Append Stop hook entry (skip if already present)
        let stop_cmd = format!("bash {}", chat_stop_path);
        let stop_entry = serde_json::json!({
            "matcher": "",
            "hooks": [{"type": "command", "command": stop_cmd.clone()}]
        });
        hooks
            .entry("Stop")
            .or_insert_with(|| serde_json::json!([]))
            .as_array_mut()
            .map(|arr| {
                if !command_exists(arr, &stop_cmd) {
                    arr.push(stop_entry);
                }
            });

        // Append PostToolUse hook entry (skip if already present)
        let post_tool_cmd = format!("bash {}", chat_tool_use_path);
        let post_tool_entry = serde_json::json!({
            "matcher": "",
            "hooks": [{"type": "command", "command": post_tool_cmd.clone()}]
        });
        hooks
            .entry("PostToolUse")
            .or_insert_with(|| serde_json::json!([]))
            .as_array_mut()
            .map(|arr| {
                if !command_exists(arr, &post_tool_cmd) {
                    arr.push(post_tool_entry);
                }
            });

        // Append PreToolUse hook entry (skip if already present)
        let pre_tool_cmd = format!("bash {}", chat_pre_tool_use_path);
        let pre_tool_entry = serde_json::json!({
            "matcher": "",
            "hooks": [{"type": "command", "command": pre_tool_cmd.clone()}]
        });
        hooks
            .entry("PreToolUse")
            .or_insert_with(|| serde_json::json!([]))
            .as_array_mut()
            .map(|arr| {
                if !command_exists(arr, &pre_tool_cmd) {
                    arr.push(pre_tool_entry);
                }
            });

        // Write back atomically
        let json_str = serde_json::to_string_pretty(&settings).map_err(|e| {
            AppError::Internal(format!("Failed to serialize settings.json: {}", e))
        })?;
        tokio::fs::write(&settings_path, json_str).await.map_err(|e| {
            AppError::Internal(format!("Failed to write settings.json: {}", e))
        })?;

        Ok(())
    }
}

// ─── Stale Session Monitor ────────────────────────────────────────────────

/// Periodic health check: mark sessions as "exited" if their tmux session has disappeared.
/// Called every 30 seconds from the background task spawned in lib.rs.
pub async fn check_and_update_stale_sessions(
    db: &DatabaseConnection,
    tmux_service: &Arc<TmuxService>,
    app_handle: &tauri::AppHandle,
) {
    use crate::db::entities::chat_session;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
    use tauri::Emitter;

    let sessions = match chat_session::Entity::find()
        .filter(
            chat_session::Column::Status
                .ne("exited")
                .and(chat_session::Column::Status.ne("deleted")),
        )
        .all(db)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("check_and_update_stale_sessions: DB query failed: {}", e);
            return;
        }
    };

    let chat_cli = ChatCliService;
    for session in sessions {
        if let Some(ref tmux_name) = session.tmux_session {
            let alive = chat_cli.get_session_status(tmux_name, tmux_service).await;
            if !alive {
                tracing::info!(
                    "check_and_update_stale_sessions: session {} tmux gone, marking exited",
                    session.id
                );
                let now = now_unix_secs();
                let updated = chat_session::ActiveModel {
                    id: Set(session.id.clone()),
                    status: Set("exited".to_string()),
                    updated_at: Set(now),
                    ..Default::default()
                };
                if let Err(e) = updated.update(db).await {
                    tracing::warn!(
                        "check_and_update_stale_sessions: failed to update session {}: {}",
                        session.id,
                        e
                    );
                    continue;
                }
                if let Err(e) = app_handle.emit(
                    "chat:session-status-changed",
                    serde_json::json!({ "session_id": session.id, "status": "exited" }),
                ) {
                    tracing::warn!(
                        "check_and_update_stale_sessions: failed to emit event: {}",
                        e
                    );
                }
            }
        }
    }
}

// ─── Startup Validator ─────────────────────────────────────────────────────

/// Check all chat sessions on startup. Mark sessions as "exited" if their tmux session is gone.
pub async fn validate_chat_sessions_on_startup(
    db: &DatabaseConnection,
    tmux_service: &Arc<TmuxService>,
) {
    use crate::db::entities::chat_session;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    let sessions = match chat_session::Entity::find()
        .filter(
            chat_session::Column::Status
                .ne("exited")
                .and(chat_session::Column::Status.ne("deleted")),
        )
        .all(db)
        .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("validate_chat_sessions_on_startup: DB query failed: {}", e);
            return;
        }
    };

    let chat_cli = ChatCliService;
    for session in sessions {
        if let Some(ref tmux_name) = session.tmux_session {
            let alive = chat_cli.get_session_status(tmux_name, tmux_service).await;
            if !alive {
                tracing::info!(
                    "validate_chat_sessions: session {} tmux gone, marking exited",
                    session.id
                );
                let updated = chat_session::ActiveModel {
                    id: Set(session.id.clone()),
                    status: Set("exited".to_string()),
                    updated_at: Set(now_unix_secs()),
                    ..Default::default()
                };
                if let Err(e) = updated.update(db).await {
                    tracing::warn!(
                        "validate_chat_sessions: failed to update session {}: {}",
                        session.id,
                        e
                    );
                }
            }
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_persona_context_known_pm() {
        let ctx = build_persona_context(Some("pm"));
        assert!(ctx.contains("Product Manager"));
    }

    #[test]
    fn test_build_persona_context_known_architect() {
        let ctx = build_persona_context(Some("architect"));
        assert!(ctx.contains("System Architect"));
    }

    #[test]
    fn test_build_persona_context_known_ux() {
        let ctx = build_persona_context(Some("ux"));
        assert!(ctx.contains("UX Designer"));
    }

    #[test]
    fn test_build_persona_context_known_dev() {
        let ctx = build_persona_context(Some("dev"));
        assert!(ctx.contains("Senior Developer"));
    }

    #[test]
    fn test_build_persona_context_known_qa() {
        let ctx = build_persona_context(Some("qa"));
        assert!(ctx.contains("QA Engineer"));
    }

    #[test]
    fn test_build_persona_context_custom_passthrough() {
        let custom = "You are a custom AI assistant";
        let ctx = build_persona_context(Some(custom));
        assert_eq!(ctx, custom);
    }

    #[test]
    fn test_build_persona_context_none_returns_empty() {
        let ctx = build_persona_context(None);
        assert!(ctx.is_empty());
    }

    #[tokio::test]
    async fn test_get_session_status_returns_false_for_nonexistent() {
        let svc = ChatCliService;
        let tmux = Arc::new(TmuxService::new());
        let result = svc
            .get_session_status("tinsu-chat-nonexistent-xxxxxxxx-99999", &tmux)
            .await;
        assert!(!result);
    }

    #[tokio::test]
    async fn test_write_session_hooks_creates_valid_json() {
        let svc = ChatCliService;
        let tmpdir = tempfile::tempdir().expect("tempdir");
        let project_path = tmpdir.path().to_str().unwrap();
        let hooks_dir = "/tmp/fake-hooks";

        svc.write_session_hooks(project_path, hooks_dir)
            .await
            .expect("write_session_hooks should succeed");

        let settings_path = tmpdir.path().join(".claude").join("settings.json");
        assert!(settings_path.exists(), "settings.json should be created");

        let content =
            std::fs::read_to_string(&settings_path).expect("read settings.json");
        let val: serde_json::Value = serde_json::from_str(&content).expect("valid JSON");

        assert!(val["hooks"]["Stop"].is_array(), "Stop hooks should be array");
        assert!(
            val["hooks"]["PostToolUse"].is_array(),
            "PostToolUse hooks should be array"
        );
        assert!(
            val["hooks"]["PreToolUse"].is_array(),
            "PreToolUse hooks should be array"
        );
    }

    #[tokio::test]
    async fn test_write_session_hooks_merges_with_existing() {
        let svc = ChatCliService;
        let tmpdir = tempfile::tempdir().expect("tempdir");
        let project_path = tmpdir.path().to_str().unwrap();
        let hooks_dir = "/tmp/fake-hooks";

        // Write existing settings.json with a pre-existing Stop hook
        let claude_dir = tmpdir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let existing = serde_json::json!({
            "hooks": {
                "Stop": [
                    {"matcher": "existing", "hooks": [{"type": "command", "command": "echo existing"}]}
                ]
            }
        });
        std::fs::write(
            claude_dir.join("settings.json"),
            serde_json::to_string(&existing).unwrap(),
        )
        .unwrap();

        svc.write_session_hooks(project_path, hooks_dir)
            .await
            .expect("write_session_hooks should succeed");

        let content =
            std::fs::read_to_string(claude_dir.join("settings.json")).expect("read");
        let val: serde_json::Value = serde_json::from_str(&content).expect("valid JSON");

        // Should have 2 entries in Stop (existing + new chat-stop.sh)
        assert_eq!(
            val["hooks"]["Stop"].as_array().map(|a| a.len()),
            Some(2),
            "Stop hooks should have 2 entries after merge"
        );
    }
}
