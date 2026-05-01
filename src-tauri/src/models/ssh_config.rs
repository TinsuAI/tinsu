use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub enum AuthMethod {
    Key,
    Password,
}

impl AuthMethod {
    pub fn as_str(&self) -> &str {
        match self {
            AuthMethod::Key => "key",
            AuthMethod::Password => "password",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "key" => Some(AuthMethod::Key),
            "password" => Some(AuthMethod::Password),
            _ => None,
        }
    }
}

/// A saved SSH connection profile (password never stored).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SshConnectionProfile {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String, // "key" | "password"
    pub key_name: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreateSshConnectionInput {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String, // "key" | "password"
    pub key_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSshConnectionInput {
    pub id: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub key_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TestSshConnectionInput {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String, // "key" | "password"
    pub key_name: Option<String>,
    /// Only present for password auth (never stored in DB)
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SshConnectionTestResult {
    pub success: bool,
    /// SHA256 host fingerprint — present on success
    pub fingerprint: Option<String>,
    /// Error description — present on failure
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SshKeyEntry {
    /// User-provided name, also used as keychain account identifier
    pub name: String,
    /// OpenSSH-format public key (safe to display)
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GenerateSshKeyInput {
    /// Name to identify this key pair (e.g. "macbook-tinsu")
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SshKeyExport {
    pub name: String,
    pub public_key: String,
    /// PEM-encoded private key — only returned for export operations
    pub private_key_pem: String,
}

/// A discovered git repository on the remote machine (not yet saved).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DiscoveredProject {
    /// Display name — last path segment of the repo parent dir (e.g., "my-repo")
    pub name: String,
    /// Absolute path on the remote machine (e.g., "/home/user/my-repo")
    pub path: String,
}

/// A saved remote project profile.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RemoteProjectProfile {
    pub id: String,
    pub connection_id: String,
    pub name: String,
    pub path: String,
    pub created_at: i64,
}

/// Input for the SSH project discovery command.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DiscoverProjectsInput {
    /// ID of the saved SSH connection to use
    pub connection_id: String,
    /// Root path to search from (e.g., "~" or "/home/user"). Defaults to "~".
    pub search_path: Option<String>,
}

/// Input for listing subdirectories on a remote machine.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ListRemoteDirInput {
    pub connection_id: String,
    /// Absolute path or `~` to list. Defaults to `~`.
    pub path: Option<String>,
}

/// A single entry returned by list_remote_dir.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RemoteDirEntry {
    /// Directory name (not full path)
    pub name: String,
    /// Full absolute path on the remote machine
    pub path: String,
}

/// Input to save a discovered (or manually entered) remote project.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SaveRemoteProjectInput {
    pub connection_id: String,
    pub name: String,
    pub path: String,
}

/// Input for generating a new SSH key and installing it on a remote server via password auth.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct InstallSshKeyInput {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// One-time password used only to install the key — never stored.
    pub password: String,
    /// Name to give the generated key (e.g. "myserver-tinsu").
    pub key_name: String,
}

/// Input for creating a remote tmux task session.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RemoteCreateSessionInput {
    /// The task ID for which to create the remote session.
    pub task_id: String,
    /// ID of the saved remote project profile (from `remote_projects` table).
    pub remote_project_id: String,
    /// The local project_id (from `projects` table) — used to resolve the right project DB.
    pub project_id: String,
}
