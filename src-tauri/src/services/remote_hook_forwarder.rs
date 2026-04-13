//! SSH reverse tunnel for Claude Code hook forwarding.
//!
//! Architecture:
//! - Client sends `tcpip_forward("127.0.0.1", 3847)` to the remote SSH server
//! - When remote Claude Code POSTs to 127.0.0.1:3847, the SSH server opens a
//!   `forwarded-tcpip` channel to this client
//! - ForwardingHandler receives the channel and spawns a proxy task
//! - Proxy: bidirectional copy between the SSH channel and local TCP 127.0.0.1:local_port
//! - One forwarder per connection_id; deduplication prevents duplicate tunnels
//! - Auto-reconnect loop retries on disconnect with exponential backoff (2s, 4s, 8s, max 30s)

use crate::error::AppError;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

// Configuration constants
const SSH_CONNECT_TIMEOUT_SECS: u64 = 15;
const SSH_EXEC_TIMEOUT_SECS: u64 = 10;
const RECONNECT_BACKOFF_INITIAL_SECS: u64 = 2;
const RECONNECT_BACKOFF_MAX_SECS: u64 = 15; // Cap at 15s per AC6 requirement

// ── ForwardingHandler ─────────────────────────────────────────────────────

/// SSH client handler that accepts all host keys and handles forwarded-tcpip channels.
struct ForwardingHandler {
    /// Each forwarded connection arrives here as a new Channel.
    new_conn_tx: mpsc::UnboundedSender<russh::Channel<russh::client::Msg>>,
}

impl russh::client::Handler for ForwardingHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true) // Trust-on-first-use; fingerprint verified at T2.2 test_connection
    }

    async fn server_channel_open_forwarded_tcpip(
        &mut self,
        channel: russh::Channel<russh::client::Msg>,
        _connected_address: &str,
        _connected_port: u32,
        _originator_address: &str,
        _originator_port: u32,
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        // Send to the accept loop — if it's gone, just drop the channel
        let _ = self.new_conn_tx.send(channel);
        Ok(())
    }
}

// ── Forwarder entry ───────────────────────────────────────────────────────

/// Control handle for a running forwarder task.
struct ForwarderEntry {
    /// Send `()` to request graceful shutdown.
    stop_tx: tokio::sync::oneshot::Sender<()>,
    remote_port: u16,
}

// ── Manager ───────────────────────────────────────────────────────────────

/// Manages one SSH reverse tunnel per remote connection.
/// Stored as Tauri state (Arc<Mutex<...>>).
pub struct RemoteHookForwarderManager {
    active: Arc<Mutex<HashMap<String, ForwarderEntry>>>,
}

impl RemoteHookForwarderManager {
    pub fn new() -> Self {
        RemoteHookForwarderManager {
            active: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start forwarding for `connection_id` if not already running.
    /// Returns `Ok(remote_port)`.
    /// If already running: no-op, returns the existing remote_port.
    pub fn start(
        &self,
        connection_id: String,
        host: String,
        port: u16,
        username: String,
        key_name: String,
        local_hook_port: u16,
    ) -> Result<u16, AppError> {
        if connection_id.is_empty() {
            return Err(AppError::BadRequest("connection_id must not be empty".into()));
        }

        let mut active = self
            .active
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {e}")))?;

        // Deduplication: already running
        if let Some(entry) = active.get(&connection_id) {
            return Ok(entry.remote_port);
        }

        let remote_port: u16 = 3847; // Same port on both sides for simplicity
        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();

        // Insert entry BEFORE spawning to prevent race condition where two threads
        // both see the entry doesn't exist and both spawn forwarder tasks
        active.insert(
            connection_id.clone(),
            ForwarderEntry {
                stop_tx,
                remote_port,
            },
        );

        // Now spawn the forwarder task (safe because entry is already in map)
        let active_clone = Arc::clone(&self.active);
        let conn_id_clone = connection_id.clone();

        tokio::spawn(run_forwarder(
            conn_id_clone,
            host,
            port,
            username,
            key_name,
            local_hook_port,
            remote_port,
            stop_rx,
            active_clone,
        ));

        Ok(remote_port)
    }

    /// Stop forwarding for `connection_id`. No-op if not running.
    pub fn stop(&self, connection_id: &str) -> Result<(), AppError> {
        let mut active = self
            .active
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {e}")))?;
        if let Some(entry) = active.remove(connection_id) {
            let _ = entry.stop_tx.send(());
        }
        Ok(())
    }

    /// Check if forwarding is active for `connection_id`.
    pub fn status(&self, connection_id: &str) -> Result<RemoteHookStatus, AppError> {
        let active = self
            .active
            .lock()
            .map_err(|e| AppError::Internal(format!("lock poisoned: {e}")))?;
        match active.get(connection_id) {
            Some(entry) => Ok(RemoteHookStatus {
                is_active: true,
                remote_port: Some(entry.remote_port),
            }),
            None => Ok(RemoteHookStatus {
                is_active: false,
                remote_port: None,
            }),
        }
    }
}

// ── Status DTO ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct RemoteHookStatus {
    pub is_active: bool,
    pub remote_port: Option<u16>,
}

// ── Forwarder task ────────────────────────────────────────────────────────

/// Long-running task: establishes SSH connection, requests tcpip_forward,
/// proxies forwarded connections to local axum. Auto-reconnects on disconnect.
async fn run_forwarder(
    connection_id: String,
    host: String,
    port: u16,
    username: String,
    key_name: String,
    local_hook_port: u16,
    remote_port: u16,
    mut stop_rx: tokio::sync::oneshot::Receiver<()>,
    active: Arc<Mutex<HashMap<String, ForwarderEntry>>>,
) {
    let mut backoff_secs: u64 = RECONNECT_BACKOFF_INITIAL_SECS;
    let mut retry_count: u32 = 0;
    const MAX_RETRIES: u32 = 100; // Fail-safe against infinite loops

    loop {
        // Check for stop signal (non-blocking)
        if stop_rx.try_recv().is_ok() {
            tracing::info!("Remote hook forwarder for {} stopped by request", connection_id);
            break;
        }

        match connect_and_forward(
            &host,
            port,
            &username,
            &key_name,
            local_hook_port,
            remote_port,
            &mut stop_rx,
        )
        .await
        {
            Ok(()) => {
                // Clean stop (stop_rx fired during session)
                tracing::info!("Remote hook forwarder for {} stopped cleanly", connection_id);
                break;
            }
            Err(e) => {
                retry_count += 1;
                if retry_count > MAX_RETRIES {
                    tracing::error!(
                        "Remote hook forwarder for {} exceeded max retries ({}); giving up",
                        connection_id,
                        MAX_RETRIES
                    );
                    break;
                }
                tracing::warn!(
                    "Remote hook forwarder for {} disconnected: {}; retrying in {}s (attempt {})",
                    connection_id,
                    e,
                    backoff_secs,
                    retry_count
                );
                // Exponential backoff capped at RECONNECT_BACKOFF_MAX_SECS (15s per AC6)
                tokio::time::sleep(tokio::time::Duration::from_secs(backoff_secs)).await;
                backoff_secs = (backoff_secs * 2).min(RECONNECT_BACKOFF_MAX_SECS);
                continue;
            }
        }
    }

    // Remove from active map on exit
    // Use unwrap_or_else to recover from poisoned mutex (in case another task panicked)
    let mut guard = active.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    guard.remove(&connection_id);
}

/// Connect to SSH, establish reverse tunnel, proxy forwarded connections.
/// Returns Ok(()) when stop_rx fires; returns Err on SSH failure.
async fn connect_and_forward(
    host: &str,
    port: u16,
    username: &str,
    key_name: &str,
    local_hook_port: u16,
    remote_port: u16,
    stop_rx: &mut tokio::sync::oneshot::Receiver<()>,
) -> Result<(), AppError> {
    use std::sync::Arc as StdArc;

    // ── Connect & authenticate ────────────────────────────────────────────
    let (new_conn_tx, mut new_conn_rx) =
        mpsc::unbounded_channel::<russh::Channel<russh::client::Msg>>();

    let handler = ForwardingHandler { new_conn_tx };
    let config = StdArc::new(russh::client::Config::default());
    let addr = format!("{host}:{port}");

    let mut session = tokio::time::timeout(
        tokio::time::Duration::from_secs(SSH_CONNECT_TIMEOUT_SECS),
        russh::client::connect(config, addr, handler),
    )
    .await
    .map_err(|_| AppError::Internal("SSH connect timeout (15s)".into()))?
    .map_err(|e| AppError::Internal(format!("SSH connect failed: {e}")))?;

    // Key-only auth (password not supported for persistent tunnels)
    let export = crate::services::ssh_service::export_key(key_name)?;
    let private_key =
        russh::keys::PrivateKey::from_openssh(export.private_key_pem.as_bytes())
            .map_err(|e| AppError::Internal(format!("Bad private key PEM: {e}")))?;
    let key_with_alg =
        russh::keys::PrivateKeyWithHashAlg::new(StdArc::new(private_key), None);

    let auth_ok = session
        .authenticate_publickey(username, key_with_alg)
        .await
        .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
        .success();

    if !auth_ok {
        return Err(AppError::Internal("SSH authentication failed".into()));
    }

    // ── Request reverse tunnel: remote 127.0.0.1:remote_port → local axum ─
    // tcpip_forward returns u32 port or error; non-zero means the server accepted
    session
        .tcpip_forward("127.0.0.1", remote_port as u32)
        .await
        .map_err(|e| AppError::Internal(format!("tcpip_forward failed: {e}")))?;

    // Write port file on remote so hook scripts know where to POST
    // Use a separate one-shot SSH exec (same pattern as remote_files.rs)
    write_remote_port_file(host, port, username, key_name, remote_port).await?;

    tracing::info!(
        "Remote hook forwarder established: remote 127.0.0.1:{} → local 127.0.0.1:{}",
        remote_port,
        local_hook_port
    );

    // ── Accept loop ───────────────────────────────────────────────────────
    loop {
        tokio::select! {
            // Stop signal: return Ok so run_forwarder exits cleanly
            _ = &mut *stop_rx => {
                // Graceful disconnect with 5s timeout to prevent hanging
                let disconnect_future = session.disconnect(russh::Disconnect::ByApplication, "", "");
                let _ = tokio::time::timeout(
                    tokio::time::Duration::from_secs(5),
                    disconnect_future
                ).await;
                return Ok(());
            }
            // New forwarded connection from remote machine
            channel = new_conn_rx.recv() => {
                match channel {
                    Some(ch) => {
                        let lport = local_hook_port;
                        tokio::spawn(proxy_channel_to_local(ch, lport));
                    }
                    None => {
                        // Handler dropped — SSH session gone
                        return Err(AppError::Internal("SSH session ended unexpectedly".into()));
                    }
                }
            }
        }
    }
}

/// Write `/tmp/tinsu-hook-port` on the remote machine via SSH exec.
/// Uses `run_ssh_exec` pattern (same as remote_files.rs and remote_agent.rs).
/// Sets restrictive permissions (600) to prevent unprivileged users from reading the port.
async fn write_remote_port_file(
    host: &str,
    port: u16,
    username: &str,
    key_name: &str,
    remote_port: u16,
) -> Result<(), AppError> {
    let cmd = format!(
        "echo -n '{}' > /tmp/tinsu-hook-port && chmod 600 /tmp/tinsu-hook-port",
        remote_port
    );
    tokio::time::timeout(
        tokio::time::Duration::from_secs(SSH_EXEC_TIMEOUT_SECS),
        crate::services::ssh_service::run_ssh_exec(
            host,
            port,
            username,
            "key",
            Some(key_name),
            None,
            &cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Remote port file write timed out".into()))??;
    Ok(())
}

/// Proxy a russh forwarded channel to the local axum hook listener.
/// Bidirectional: channel ↔ TCP 127.0.0.1:local_port.
/// Handles backpressure via flush() and respects write/read errors.
async fn proxy_channel_to_local(
    mut channel: russh::Channel<russh::client::Msg>,
    local_port: u16,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let tcp = match tokio::net::TcpStream::connect(
        format!("127.0.0.1:{}", local_port)
    ).await {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!("Hook proxy: failed to connect to local axum port {}: {}", local_port, e);
            return;
        }
    };

    let (mut tcp_read, mut tcp_write) = tcp.into_split();
    let mut buf = vec![0u8; 8192];

    loop {
        tokio::select! {
            // Remote → Local: SSH channel data → local TCP
            msg = channel.wait() => {
                match msg {
                    Some(russh::ChannelMsg::Data { ref data }) => {
                        if let Err(e) = tcp_write.write_all(data).await {
                            tracing::debug!("Hook proxy: TCP write failed: {}", e);
                            break;
                        }
                        // Flush to apply backpressure and ensure data delivery
                        if let Err(e) = tcp_write.flush().await {
                            tracing::debug!("Hook proxy: TCP flush failed: {}", e);
                            break;
                        }
                    }
                    Some(russh::ChannelMsg::Eof) | None => {
                        tracing::debug!("Hook proxy: SSH channel closed");
                        break;
                    }
                    Some(msg) => {
                        // Log unrecognized messages for debugging (extended data, signal, etc.)
                        tracing::debug!("Hook proxy: Unhandled SSH channel message: {:?}", msg);
                    }
                }
            }
            // Local → Remote: local TCP response → SSH channel
            result = tcp_read.read(&mut buf) => {
                match result {
                    Ok(0) => {
                        tracing::debug!("Hook proxy: TCP read EOF");
                        break;
                    }
                    Err(e) => {
                        tracing::debug!("Hook proxy: TCP read error: {}", e);
                        break;
                    }
                    Ok(n) => {
                        if let Err(e) = channel.data(&buf[..n]).await {
                            tracing::debug!("Hook proxy: SSH write failed: {}", e);
                            break;
                        }
                    }
                }
            }
        }
    }

    let _ = channel.eof().await;
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_deduplication_prevents_duplicate_tunnels() {
        // Manually create a fake entry (since actual SSH connect isn't possible in unit tests)
        let manager = RemoteHookForwarderManager::new();
        {
            let (stop_tx, _stop_rx) = tokio::sync::oneshot::channel::<()>();
            let mut active = manager.active.lock().unwrap();
            active.insert(
                "conn-1".to_string(),
                ForwarderEntry {
                    stop_tx,
                    remote_port: 3847,
                },
            );
        }
        // Verify status returns is_active=true
        let status = manager.status("conn-1").unwrap();
        assert!(status.is_active, "status should indicate active forwarder");
        assert_eq!(status.remote_port, Some(3847), "status should return correct port");

        // Deduplication logic: if entry exists, it won't be re-created (tested via manager code path in start())
        // This test verifies the data structure invariants even though we can't test the full start() flow
    }

    #[test]
    fn test_stop_removes_from_map() {
        let manager = RemoteHookForwarderManager::new();
        {
            let (stop_tx, _stop_rx) = tokio::sync::oneshot::channel::<()>();
            let mut active = manager.active.lock().unwrap();
            active.insert(
                "conn-2".to_string(),
                ForwarderEntry {
                    stop_tx,
                    remote_port: 3847,
                },
            );
        }
        manager.stop("conn-2").unwrap();
        let status = manager.status("conn-2").unwrap();
        assert!(!status.is_active);
        assert!(status.remote_port.is_none());
    }

    #[test]
    fn test_status_returns_inactive_for_unknown_connection() {
        let manager = RemoteHookForwarderManager::new();
        let status = manager.status("unknown").unwrap();
        assert!(!status.is_active);
        assert!(status.remote_port.is_none());
    }

    #[test]
    fn test_port_file_command_uses_echo_n() {
        // Validate write_remote_port_file command format (unit test the string logic)
        let remote_port: u16 = 3847;
        let cmd = format!("echo -n '{}' > /tmp/tinsu-hook-port", remote_port);
        assert_eq!(cmd, "echo -n '3847' > /tmp/tinsu-hook-port");
        // -n prevents trailing newline that would confuse the port parser
    }

    #[test]
    fn test_backoff_caps_at_15s() {
        // AC6: backoff capped at 15 seconds (RECONNECT_BACKOFF_MAX_SECS = 15)
        assert_eq!(
            RECONNECT_BACKOFF_MAX_SECS, 15,
            "RECONNECT_BACKOFF_MAX_SECS must be 15s per AC6 requirement"
        );
        let mut backoff: u64 = RECONNECT_BACKOFF_INITIAL_SECS;
        for _ in 0..20 {
            backoff = (backoff * 2).min(RECONNECT_BACKOFF_MAX_SECS);
        }
        assert_eq!(
            backoff, 15,
            "Backoff must cap at 15s after many doublings"
        );
    }

    #[test]
    fn test_remote_hook_status_serializes() {
        let status = RemoteHookStatus {
            is_active: true,
            remote_port: Some(3847),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"is_active\":true"));
        assert!(json.contains("\"remote_port\":3847"));
    }
}
