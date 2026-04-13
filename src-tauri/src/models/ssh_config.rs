use serde::{Deserialize, Serialize};
use specta::Type;

/// Keychain service name prefix — keeps all TinSu keys grouped
pub const KEYCHAIN_SERVICE: &str = "tinsu_ssh";

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
