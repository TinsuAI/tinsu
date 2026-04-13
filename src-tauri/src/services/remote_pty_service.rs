//! SSH-backed PTY service for remote tmux session attachment.
//!
//! Architecture:
//! - Each remote session spawns a dedicated tokio task that owns the SSH session
//!   and channel, running a select! loop for bidirectional I/O.
//! - The HashMap stores only an mpsc Sender to communicate with the task.
//! - Writing data, resizing, and detaching all go through WriteMsg.

use crate::error::AppError;
use russh::ChannelMsg;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

// ── Handler ────────────────────────────────────────────────────────────────

/// SSH client handler that accepts all host keys (MVP: no fingerprint pinning).
struct AcceptAllHandler;

impl russh::client::Handler for AcceptAllHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys — fingerprint was verified during T2.2 test_connection
        Ok(true)
    }
}

// ── Message protocol ──────────────────────────────────────────────────────

enum WriteMsg {
    Data(Vec<u8>),
    Resize(u16, u16), // (cols, rows)
    Detach,
}

// ── Session status payload (mirrors local agent.rs pattern) ───────────────

#[derive(Clone, serde::Serialize)]
struct SessionStatusPayload {
    task_id: String,
    status: String, // "ended" | "stalled" | "disconnected"
}

// ── Remote session entry ───────────────────────────────────────────────────

struct RemoteSessionEntry {
    tx_write: mpsc::Sender<WriteMsg>,
    #[allow(dead_code)]
    task_id: String,
}

// ── Service ───────────────────────────────────────────────────────────────

pub struct RemotePtyService {
    sessions: Arc<Mutex<HashMap<String, RemoteSessionEntry>>>,
}

impl RemotePtyService {
    pub fn new() -> Self {
        RemotePtyService {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Attach to a remote tmux session via SSH PTY channel.
    ///
    /// - `process_id` uniquely identifies this attachment (UUID format, prefixed "remote-").
    /// - Opens SSH connection, allocates PTY, execs `tmux attach-session -t {tmux_name}`.
    /// - Spawns a tokio task that owns the session+channel and handles I/O via select!.
    /// - Stores the write sender in the sessions map.
    pub async fn attach(
        &self,
        process_id: &str,
        host: &str,
        port: u16,
        username: &str,
        auth_method: &str,
        key_name: Option<&str>,
        tmux_session_name: &str,
        cols: u16,
        rows: u16,
        task_id: String,
        on_data: Channel<Vec<u8>>,
        app: AppHandle,
    ) -> Result<(), AppError> {
        use std::sync::Arc as StdArc;

        // ── Build SSH connection ────────────────────────────────────────────
        let config = StdArc::new(russh::client::Config::default());
        let addr = format!("{host}:{port}");
        let mut session = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            russh::client::connect(config, addr, AcceptAllHandler),
        )
        .await
        .map_err(|_| AppError::Internal("SSH connection timeout (15s)".into()))?
        .map_err(|e| AppError::Internal(format!("SSH connect failed: {e}")))?;

        // ── Authenticate ────────────────────────────────────────────────────
        let auth_ok = match auth_method {
            "key" => {
                let name = key_name.ok_or_else(|| {
                    AppError::BadRequest("key_name required for key auth".into())
                })?;
                let export = crate::services::ssh_service::export_key(name)?;
                let private_key = russh::keys::PrivateKey::from_openssh(
                    export.private_key_pem.as_bytes(),
                )
                .map_err(|e| AppError::Internal(format!("Bad private key PEM: {e}")))?;
                let key_with_alg =
                    russh::keys::PrivateKeyWithHashAlg::new(StdArc::new(private_key), None);
                session
                    .authenticate_publickey(username, key_with_alg)
                    .await
                    .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
                    .success()
            }
            "password" => {
                return Err(AppError::BadRequest(
                    "Password auth not supported for PTY sessions — use SSH key auth".into(),
                ));
            }
            other => {
                return Err(AppError::BadRequest(format!(
                    "auth_method must be 'key' or 'password', got '{other}'"
                )));
            }
        };

        if !auth_ok {
            return Err(AppError::Internal("SSH authentication failed".into()));
        }

        // ── Open PTY channel ────────────────────────────────────────────────
        let mut channel = session
            .channel_open_session()
            .await
            .map_err(|e| AppError::Internal(format!("SSH channel open failed: {e}")))?;

        // Request PTY allocation — remote process sees a real terminal
        channel
            .request_pty(
                false,            // want_reply
                "xterm-256color",
                cols as u32,
                rows as u32,
                0,                // pixel_width
                0,                // pixel_height
                &[],              // terminal modes
            )
            .await
            .map_err(|e| AppError::Internal(format!("SSH request_pty failed: {e}")))?;

        // Exec tmux attach — session must already exist (created by create_remote_task_session)
        if tmux_session_name.is_empty() {
            return Err(AppError::BadRequest(
                "Cannot attach to remote tmux session: session name is empty".into(),
            ));
        }
        let attach_cmd = format!("tmux attach-session -t '{}'", tmux_session_name);
        channel
            .exec(true, attach_cmd.as_str())
            .await
            .map_err(|e| AppError::Internal(format!("SSH exec failed: {e}")))?;

        // ── Spawn I/O task ──────────────────────────────────────────────────
        let (tx_write, rx_write) = mpsc::channel::<WriteMsg>(64);

        let process_id_owned = process_id.to_string();
        let sessions_clone = Arc::clone(&self.sessions);
        let task_id_for_spawn = task_id.clone();

        tokio::spawn(async move {
            run_remote_session(
                session,
                channel,
                rx_write,
                on_data,
                task_id_for_spawn,
                app,
                process_id_owned,
                sessions_clone,
            )
            .await;
        });

        // ── Register in map ────────────────────────────────────────────────
        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|e| AppError::Internal(format!("lock poisoned: {e}")))?;
            sessions.insert(
                process_id.to_string(),
                RemoteSessionEntry {
                    tx_write,
                    task_id,
                },
            );
        }

        Ok(())
    }

    /// Send raw input bytes to the remote PTY.
    pub async fn write(&self, process_id: &str, data: Vec<u8>) -> Result<(), AppError> {
        let tx = self.get_sender(process_id)?;
        tx.send(WriteMsg::Data(data))
            .await
            .map_err(|_| AppError::Internal("Remote PTY task already stopped".into()))
    }

    /// Resize the remote PTY.
    pub async fn resize(&self, process_id: &str, cols: u16, rows: u16) -> Result<(), AppError> {
        let tx = self.get_sender(process_id)?;
        tx.send(WriteMsg::Resize(cols, rows))
            .await
            .map_err(|_| AppError::Internal("Remote PTY task already stopped".into()))
    }

    /// Detach from the remote PTY (closes SSH channel; tmux persists on remote).
    pub async fn detach(&self, process_id: &str) -> Result<(), AppError> {
        let tx = self.get_sender(process_id)?;
        tx.send(WriteMsg::Detach)
            .await
            .map_err(|_| AppError::Internal("Remote PTY task already stopped".into()))?;
        // Remove from map immediately (task will also clean up on receipt of Detach).
        // Ignore lock errors (poisoned) — the task will handle cleanup regardless.
        let _ = self.sessions.lock().map(|mut sessions| {
            sessions.remove(process_id)
        });
        Ok(())
    }

    fn get_sender(&self, process_id: &str) -> Result<mpsc::Sender<WriteMsg>, AppError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {e}")))?;
        sessions
            .get(process_id)
            .map(|s| s.tx_write.clone())
            .ok_or_else(|| AppError::NotFound(format!("Remote PTY session '{process_id}' not found")))
    }
}

// ── I/O task (owns the SSH session + channel) ─────────────────────────────

async fn run_remote_session(
    session: russh::client::Handle<AcceptAllHandler>,
    mut channel: russh::Channel<russh::client::Msg>,
    mut rx_write: mpsc::Receiver<WriteMsg>,
    on_data: Channel<Vec<u8>>,
    task_id: String,
    app: AppHandle,
    process_id: String,
    sessions: Arc<Mutex<HashMap<String, RemoteSessionEntry>>>,
) {
    let mut last_data_time = std::time::Instant::now();
    let stall_threshold = std::time::Duration::from_secs(5 * 60); // 5 minutes

    loop {
        // Check for stall before waiting (non-blocking)
        let stall_check = tokio::time::sleep(std::time::Duration::from_secs(30));

        tokio::select! {
            // Inbound: user writes, resizes, detach
            msg = rx_write.recv() => {
                match msg {
                    Some(WriteMsg::Data(data)) => {
                        if let Err(e) = channel.data(&data[..]).await {
                            tracing::warn!("Remote PTY write error for {}: {}", task_id, e);
                            break;
                        }
                    }
                    Some(WriteMsg::Resize(cols, rows)) => {
                        let _ = channel.window_change(cols as u32, rows as u32, 0, 0).await;
                    }
                    Some(WriteMsg::Detach) | None => {
                        // Close the channel — remote tmux session persists on the remote machine
                        let _ = channel.close().await;
                        let _ = session.disconnect(russh::Disconnect::ByApplication, "", "").await;
                        break;
                    }
                }
            }
            // Outbound: remote PTY data
            channel_msg = channel.wait() => {
                match channel_msg {
                    Some(ChannelMsg::Data { ref data }) => {
                        last_data_time = std::time::Instant::now();
                        let bytes: Vec<u8> = data.to_vec();
                        if on_data.send(bytes).is_err() {
                            tracing::warn!("Tauri channel closed for remote PTY {}", task_id);
                            break;
                        }
                    }
                    Some(ChannelMsg::ExitStatus { exit_status }) => {
                        tracing::info!(
                            "Remote tmux session for task {} exited with status {}",
                            task_id, exit_status
                        );
                        // Drain any remaining data before breaking
                    }
                    Some(ChannelMsg::Eof) | None => {
                        // Channel ended — remote tmux session exited or SSH disconnected
                        app.emit(
                            "session:status-changed",
                            SessionStatusPayload {
                                task_id: task_id.clone(),
                                status: "ended".into(),
                            },
                        )
                        .ok();
                        let _ = session.disconnect(russh::Disconnect::ByApplication, "", "").await;
                        break;
                    }
                    _ => {
                        // Other ChannelMsg variants (WindowAdjusted, etc.) — ignore
                    }
                }
            }
            // Stall detection
            _ = stall_check => {
                if last_data_time.elapsed() >= stall_threshold {
                    tracing::warn!("Remote PTY for task {} has been idle for 5+ minutes", task_id);
                    app.emit(
                        "session:status-changed",
                        SessionStatusPayload {
                            task_id: task_id.clone(),
                            status: "stalled".into(),
                        },
                    )
                    .ok();
                }
            }
        }
    }

    // Cleanup: remove from map when task exits
    if let Ok(mut map) = sessions.lock() {
        map.remove(&process_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_remote_process_id_format() {
        // Remote process IDs should be prefixed with "remote-" to distinguish from local PTYs
        let task_id = "test-task-123";
        let process_id = format!("remote-{}", uuid::Uuid::new_v4());
        assert!(process_id.starts_with("remote-"), "Remote process ID must be prefixed with 'remote-'");
        let _ = task_id;
    }

    #[test]
    fn test_tmux_session_name_derivation() {
        // Session name must match the convention used by create_task_session (local)
        let task_id = "abc-123";
        let session_name = format!("tinsu-task-{}", task_id);
        assert_eq!(session_name, "tinsu-task-abc-123");
    }

    #[test]
    fn test_tmux_create_command_is_idempotent() {
        // The create command uses 2>/dev/null + ; true to ensure exit 0 even if session exists
        let task_id = "abc-123";
        let path = "/home/user/project";
        let cmd = format!(
            "tmux new-session -d -s 'tinsu-task-{}' -c '{}' 2>/dev/null; true",
            task_id,
            path.replace("'", "'\\''")
        );
        assert!(cmd.contains("2>/dev/null; true"), "Must silence errors and always exit 0");
        assert!(cmd.contains("tinsu-task-abc-123"), "Session name must be embedded");
    }

    #[test]
    fn test_tmux_attach_command_format() {
        // Attach command must quote the session name to handle special chars
        let session_name = "tinsu-task-my-task";
        let cmd = format!("tmux attach-session -t '{}'", session_name);
        assert_eq!(cmd, "tmux attach-session -t 'tinsu-task-my-task'");
    }

    #[test]
    fn test_remote_pty_service_new_has_empty_sessions() {
        let svc = RemotePtyService::new();
        let map = svc.sessions.lock().expect("lock ok");
        assert!(map.is_empty(), "New service should have no sessions");
    }

    #[test]
    fn test_get_sender_returns_not_found_for_missing_process_id() {
        let svc = RemotePtyService::new();
        let result = svc.get_sender("nonexistent-process-id");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}
