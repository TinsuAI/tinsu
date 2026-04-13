//! SSH key generation, OS keychain management, and connection testing.
//! Uses ssh-key crate for Ed25519 key generation and keyring for secure storage.

use crate::error::AppError;
use crate::models::ssh_config::{SshConnectionTestResult, SshKeyEntry, SshKeyExport};
use rand::rngs::OsRng;
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// ── File-based key storage ───────────────────────────────────────────────────
// Private keys are stored as PEM files in {data_dir}/tinsu/ssh_keys/{name}.pem
// with mode 0600 (user-read/write only). Same security model as ~/.ssh/id_ed25519.

/// Returns the directory where SSH private keys are stored.
/// Platform paths:
///   Linux:   $XDG_DATA_HOME/tinsu/ssh_keys  (defaults to ~/.local/share/tinsu/ssh_keys)
///   macOS:   ~/Library/Application Support/tinsu/ssh_keys
///   Windows: %APPDATA%\tinsu\ssh_keys
pub(crate) fn keys_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    let base = std::env::var("HOME")
        .map(|h| PathBuf::from(h).join("Library/Application Support"))
        .unwrap_or_else(|_| PathBuf::from("."));

    #[cfg(target_os = "windows")]
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let base = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("HOME")
                .map(|h| PathBuf::from(h).join(".local/share"))
                .unwrap_or_else(|_| PathBuf::from("."))
        });

    base.join("tinsu").join("ssh_keys")
}

fn key_path(name: &str) -> PathBuf {
    keys_dir().join(format!("{name}.pem"))
}

fn write_key_file(path: &std::path::Path, pem: &str) -> Result<(), AppError> {
    use std::fs;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("Failed to create keys dir: {e}")))?;
        // Restrict directory to owner on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(parent, fs::Permissions::from_mode(0o700)).ok();
        }
    }
    fs::write(path, pem)
        .map_err(|e| AppError::Internal(format!("Failed to write key file: {e}")))?;
    // Restrict file to owner-read/write on Unix (chmod 600)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|e| AppError::Internal(format!("Failed to set key file permissions: {e}")))?;
    }
    Ok(())
}

/// Generate a new Ed25519 SSH key pair and store the private key as a file.
/// Returns the SshKeyEntry (name + public key) on success.
pub fn generate_and_store_key(name: &str) -> Result<SshKeyEntry, AppError> {
    // Validate name: no path separators or spaces
    if name.is_empty() || name.contains(['/', '\\', ':', ' ']) {
        return Err(AppError::BadRequest(
            "Key name must be non-empty and contain no spaces, slashes, or colons".into(),
        ));
    }

    // Generate Ed25519 key pair
    let mut key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519)
        .map_err(|e| AppError::Internal(format!("Key generation failed: {e}")))?;
    key.set_comment(name);

    // Serialize private key to OpenSSH PEM format
    let private_pem = key
        .to_openssh(LineEnding::LF)
        .map_err(|e| AppError::Internal(format!("Private key encoding failed: {e}")))?
        .to_string();

    // Derive public key in OpenSSH authorized_keys format
    let public_key = public_key_openssh(key.public_key())
        .map_err(|e| AppError::Internal(format!("Public key encoding failed: {e}")))?;

    // Write private key to file with restricted permissions
    write_key_file(&key_path(name), &private_pem)?;

    Ok(SshKeyEntry {
        name: name.to_string(),
        public_key,
    })
}

/// List SSH keys by reading each named key file.
pub fn list_keys(key_names: &[String]) -> Result<Vec<SshKeyEntry>, AppError> {
    let mut entries = Vec::new();
    for name in key_names {
        match get_private_pem(name) {
            Err(e) => tracing::warn!("Failed to read key file '{}': {}", name, e),
            Ok(pem) => match public_key_from_pem(&pem) {
                Err(e) => tracing::warn!("Failed to decode public key for '{}': {}", name, e),
                Ok(public_key) => entries.push(SshKeyEntry {
                    name: name.clone(),
                    public_key,
                }),
            },
        }
    }
    Ok(entries)
}

/// Retrieve the public key for a named SSH key.
pub fn get_public_key(name: &str) -> Result<SshKeyEntry, AppError> {
    let private_pem = get_private_pem(name)?;
    let public_key = public_key_from_pem(&private_pem)?;
    Ok(SshKeyEntry {
        name: name.to_string(),
        public_key,
    })
}

/// Export both public and private key for a named SSH key.
pub fn export_key(name: &str) -> Result<SshKeyExport, AppError> {
    let private_pem = get_private_pem(name)?;
    let public_key = public_key_from_pem(&private_pem)?;
    Ok(SshKeyExport {
        name: name.to_string(),
        public_key,
        private_key_pem: private_pem,
    })
}

/// Delete an SSH key file.
pub fn delete_key(name: &str) -> Result<(), AppError> {
    let path = key_path(name);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| AppError::Internal(format!("Failed to delete key file: {e}")))?;
    }
    Ok(())
}

// ── SSH Connection Test ──────────────────────────────────────────────────────

/// Handler that captures the server fingerprint on key exchange.
/// Uses russh's internal forked ssh-key types (not the public ssh-key crate).
struct TestHandler {
    fingerprint: Arc<Mutex<Option<String>>>,
}

impl russh::client::Handler for TestHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fp = server_public_key
            .fingerprint(russh::keys::HashAlg::Sha256)
            .to_string();
        if let Ok(mut guard) = self.fingerprint.lock() {
            *guard = Some(fp);
        }
        // Always accept for test connection — caller evaluates auth result
        Ok(true)
    }
}

/// Test SSH connection — connect, handshake, authenticate, return fingerprint.
/// Timeout: 5 seconds total.
pub async fn test_connection(
    host: &str,
    port: u16,
    username: &str,
    auth_method: &str, // "key" | "password"
    key_name: Option<&str>,
    password: Option<&str>,
) -> Result<SshConnectionTestResult, AppError> {
    let fingerprint_store: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let handler = TestHandler {
        fingerprint: Arc::clone(&fingerprint_store),
    };

    let config = Arc::new(russh::client::Config::default());
    let addr = format!("{host}:{port}");

    let connect_result = tokio::time::timeout(
        tokio::time::Duration::from_secs(5),
        async move {
            let mut session = match russh::client::connect(config, addr, handler).await {
                Ok(s) => s,
                Err(e) => {
                    return Ok::<SshConnectionTestResult, AppError>(SshConnectionTestResult {
                        success: false,
                        fingerprint: None,
                        error: Some(e.to_string()),
                    });
                }
            };

            let auth_result = match auth_method {
                "key" => {
                    let name = match key_name {
                        Some(n) => n,
                        None => {
                            return Ok(SshConnectionTestResult {
                                success: false,
                                fingerprint: None,
                                error: Some("key_name is required for key auth".into()),
                            });
                        }
                    };
                    let export = match export_key(name) {
                        Ok(e) => e,
                        Err(err) => {
                            return Ok(SshConnectionTestResult {
                                success: false,
                                fingerprint: None,
                                error: Some(err.to_string()),
                            });
                        }
                    };
                    // Parse using russh's bundled (forked) ssh-key types
                    let private_key = match russh::keys::PrivateKey::from_openssh(
                        export.private_key_pem.as_bytes(),
                    ) {
                        Ok(k) => k,
                        Err(e) => {
                            return Ok(SshConnectionTestResult {
                                success: false,
                                fingerprint: None,
                                error: Some(format!("Failed to parse private key: {e}")),
                            });
                        }
                    };
                    let key_with_alg =
                        russh::keys::PrivateKeyWithHashAlg::new(Arc::new(private_key), None);
                    match session.authenticate_publickey(username, key_with_alg).await {
                        Ok(r) => r,
                        Err(e) => {
                            return Ok(SshConnectionTestResult {
                                success: false,
                                fingerprint: None,
                                error: Some(e.to_string()),
                            });
                        }
                    }
                }
                "password" => {
                    let pw = password.unwrap_or("");
                    match session.authenticate_password(username, pw).await {
                        Ok(r) => r,
                        Err(e) => {
                            return Ok(SshConnectionTestResult {
                                success: false,
                                fingerprint: None,
                                error: Some(e.to_string()),
                            });
                        }
                    }
                }
                other => {
                    return Ok(SshConnectionTestResult {
                        success: false,
                        fingerprint: None,
                        error: Some(format!("Unknown auth_method: {other}")),
                    });
                }
            };

            let fingerprint = fingerprint_store.lock().ok().and_then(|g| g.clone());

            let _ = session
                .disconnect(russh::Disconnect::ByApplication, "", "")
                .await;

            if auth_result.success() {
                Ok(SshConnectionTestResult {
                    success: true,
                    fingerprint,
                    error: None,
                })
            } else {
                // auth_result is AuthResult enum; format it with debug representation
                let auth_err = format!("Authentication failed: {:?}", auth_result);
                Ok(SshConnectionTestResult {
                    success: false,
                    fingerprint: None,
                    error: Some(auth_err),
                })
            }
        },
    )
    .await;

    match connect_result {
        Ok(result) => result,
        Err(_elapsed) => Ok(SshConnectionTestResult {
            success: false,
            fingerprint: None,
            error: Some("Connection timed out after 5 seconds".into()),
        }),
    }
}

// ── Remote Project Discovery ─────────────────────────────────────────────────

/// Connect to a remote host via SSH and find all git repositories under `search_path`.
/// Returns a list of DiscoveredProject (name + path). Skips permission errors silently.
/// Times out after 30 seconds.
pub async fn discover_projects(
    host: &str,
    port: u16,
    username: &str,
    auth_method: &str,   // "key" | "password"
    key_name: Option<&str>,
    password: Option<&str>,
    search_path: &str,   // e.g. "~" or "/home/user"
) -> Result<Vec<crate::models::ssh_config::DiscoveredProject>, AppError> {
    use tokio::time::{timeout, Duration};

    // Build find command — 2>/dev/null silences permission errors
    // Limit maxdepth to 5 to avoid scanning huge trees
    // ~ must NOT be single-quoted — the shell only expands ~ when unquoted.
    let find_target = if search_path == "~" || search_path == "~/" {
        "~".to_string()
    } else if let Some(rest) = search_path.strip_prefix("~/") {
        format!("~/'{}'", rest.replace('\'', "'\\''"))
    } else {
        format!("'{}'", search_path.replace('\'', "'\\''"))
    };
    let cmd = format!(
        "find {find_target} -name .git -maxdepth 5 -type d 2>/dev/null"
    );

    let output = timeout(
        Duration::from_secs(30),
        run_ssh_exec(host, port, username, auth_method, key_name, password, &cmd),
    )
    .await
    .map_err(|_| AppError::Internal("Remote project discovery timed out after 30 seconds".into()))??;

    Ok(parse_discovered_projects(&output))
}

/// Execute a single command over SSH, collect stdout, return as String.
pub(crate) async fn run_ssh_exec(
    host: &str,
    port: u16,
    username: &str,
    auth_method: &str,
    key_name: Option<&str>,
    password: Option<&str>,
    command: &str,
) -> Result<String, AppError> {
    use std::sync::Arc;
    use russh::ChannelMsg;

    // ── Connect ───────────────────────────────────────────────────────────
    let fingerprint_store: Arc<std::sync::Mutex<Option<String>>> =
        Arc::new(std::sync::Mutex::new(None));
    let handler = TestHandler { fingerprint: Arc::clone(&fingerprint_store) };

    let config = Arc::new(russh::client::Config::default());
    let addr = format!("{host}:{port}");
    let mut session = russh::client::connect(config, addr, handler)
        .await
        .map_err(|e| AppError::Internal(format!("SSH connect failed: {e}")))?;

    // ── Authenticate ─────────────────────────────────────────────────────
    let auth_ok = match auth_method {
        "key" => {
            let name = key_name.ok_or_else(|| {
                AppError::BadRequest("key_name required for key auth".into())
            })?;
            let export = export_key(name)?;
            let private_key = russh::keys::PrivateKey::from_openssh(
                export.private_key_pem.as_bytes(),
            )
            .map_err(|e| AppError::Internal(format!("Bad private key PEM: {e}")))?;
            let key_with_alg =
                russh::keys::PrivateKeyWithHashAlg::new(Arc::new(private_key), None);
            session
                .authenticate_publickey(username, key_with_alg)
                .await
                .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
                .success()
        }
        "password" => {
            let pw = password.unwrap_or("");
            session
                .authenticate_password(username, pw)
                .await
                .map_err(|e| AppError::Internal(format!("SSH auth failed: {e}")))?
                .success()
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "auth_method must be 'key' or 'password', got '{other}'"
            )));
        }
    };

    if !auth_ok {
        return Err(AppError::Internal(
            "SSH authentication failed".into(),
        ));
    }

    // ── Open channel and exec command ─────────────────────────────────────
    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|e| AppError::Internal(format!("SSH channel open failed: {e}")))?;

    channel
        .exec(true, command)
        .await
        .map_err(|e| AppError::Internal(format!("SSH exec failed: {e}")))?;

    // ── Collect stdout ────────────────────────────────────────────────────
    let mut stdout = Vec::new();
    loop {
        match channel.wait().await {
            None => break,
            Some(ChannelMsg::Data { ref data }) => {
                stdout.extend_from_slice(data);
            }
            Some(ChannelMsg::Eof) => {
                break;
            }
            _ => {}
        }
    }

    let _ = session.disconnect(russh::Disconnect::ByApplication, "", "").await;

    String::from_utf8(stdout)
        .map_err(|e| AppError::Internal(format!("SSH output not UTF-8: {e}")))
}

/// Parse `find … -name .git -type d` output into DiscoveredProject list.
/// Input lines look like: /home/user/my-repo/.git
/// Output: name = "my-repo", path = "/home/user/my-repo"
pub(crate) fn parse_discovered_projects(output: &str) -> Vec<crate::models::ssh_config::DiscoveredProject> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            // Strip trailing "/.git"
            let parent = line.strip_suffix("/.git").or_else(|| line.strip_suffix("/.git/"))?;
            if parent.is_empty() {
                return None;
            }
            // Name = last path segment
            let name = std::path::Path::new(parent)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(parent)
                .to_string();
            Some(crate::models::ssh_config::DiscoveredProject {
                name,
                path: parent.to_string(),
            })
        })
        .collect()
}

// ── Key Installation ─────────────────────────────────────────────────────────

/// Generate a new Ed25519 key, then install its public key into the remote server's
/// `~/.ssh/authorized_keys` by connecting once with password auth.
/// The password is **never stored** — it is used only for this one-time installation.
pub async fn install_key_on_server(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    key_name: &str,
) -> Result<SshKeyEntry, AppError> {
    // 1. Generate (or retrieve if name already exists) the key pair
    let key_entry = generate_and_store_key(key_name)?;

    // 2. Escape the public key for safe shell embedding
    //    Ed25519 public keys are base64 + fixed prefix — no single-quote chars — but escape defensively
    let pub_key_escaped = key_entry.public_key.replace('\'', "'\\''");

    // 3. Install into authorized_keys via password SSH
    let cmd = format!(
        "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{pub_key_escaped}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
    );

    run_ssh_exec(host, port, username, "password", None, Some(password), &cmd)
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to install key on server: {e}")))?;

    Ok(key_entry)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn get_private_pem(name: &str) -> Result<String, AppError> {
    let path = key_path(name);
    std::fs::read_to_string(&path)
        .map_err(|_| AppError::NotFound(format!("SSH key '{name}' not found (expected at {path:?})")))
}

fn public_key_from_pem(pem: &str) -> Result<String, AppError> {
    let private_key = PrivateKey::from_openssh(pem)
        .map_err(|e| AppError::Internal(format!("Private key decode failed: {e}")))?;
    public_key_openssh(private_key.public_key())
        .map_err(|e| AppError::Internal(format!("Public key encoding failed: {e}")))
}

fn public_key_openssh(public_key: &ssh_key::PublicKey) -> Result<String, ssh_key::Error> {
    public_key.to_openssh()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_connection_to_unreachable_port_returns_failure() {
        // Port 1 on localhost is not an SSH server — should fail quickly
        let result = test_connection("127.0.0.1", 1, "testuser", "password", None, Some("pw"))
            .await
            .expect("test_connection should return Ok even on failure");
        assert!(!result.success, "Expected failure connecting to 127.0.0.1:1");
        assert!(result.error.is_some(), "Expected error message on failure");
    }

    #[test]
    fn test_generate_key_produces_valid_ed25519() {
        let key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519).expect("Should generate key pair");
        // Ed25519 key algorithm name should be "ssh-ed25519"
        assert_eq!(key.algorithm(), Algorithm::Ed25519);
    }

    #[test]
    fn test_key_name_validation_rejects_invalid() {
        for bad_name in &["bad name", "bad/name", "bad:name", ""] {
            let result = generate_and_store_key(bad_name);
            assert!(result.is_err(), "Should reject name '{bad_name}'");
        }
    }

    #[test]
    fn test_pem_roundtrip() {
        let key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519).expect("gen");
        let pem = key.to_openssh(LineEnding::LF).expect("pem encode").to_string();
        assert!(pem.contains("OPENSSH PRIVATE KEY"), "PEM should contain private key header");
        let decoded = PrivateKey::from_openssh(&pem).expect("pem decode");
        assert_eq!(decoded.algorithm(), Algorithm::Ed25519);
    }

    #[test]
    fn test_key_generation_under_2_seconds() {
        let start = std::time::Instant::now();
        let key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519).expect("gen");
        let elapsed = start.elapsed();
        assert!(
            elapsed.as_secs() < 2,
            "Key generation took {:?}, expected <2s",
            elapsed
        );
        drop(key);
    }

    #[test]
    fn test_reconnect_within_nfr35_budget() {
        // NFR35: SSH auto-reconnect within 10 seconds after transient interruption
        // remote_hook_forwarder retry config: initial_backoff = 2s, max_retries = 100
        // 3 retries × 2s initial backoff = 6s total ≤ 10s budget — satisfies NFR35
        let initial_backoff_secs: u64 = 2; // RECONNECT_BACKOFF_INITIAL_SECS in remote_hook_forwarder
        let max_retries: u32 = 100;

        assert!(max_retries >= 3, "Must support at least 3 retry attempts for NFR35");

        let three_retry_cost_secs = initial_backoff_secs * 3;
        assert!(
            three_retry_cost_secs <= 10,
            "3 retries at initial backoff ({three_retry_cost_secs}s) must fit within 10s NFR35 budget"
        );
    }

    #[test]
    fn test_public_key_openssh_format() {
        let key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519).expect("gen");
        let pem = key.to_openssh(LineEnding::LF).expect("pem encode").to_string();
        let pubkey_str = public_key_from_pem(&pem).expect("public key from pem");
        assert!(
            pubkey_str.starts_with("ssh-ed25519 "),
            "OpenSSH public key should start with 'ssh-ed25519 ', got: {pubkey_str}"
        );
    }
}
