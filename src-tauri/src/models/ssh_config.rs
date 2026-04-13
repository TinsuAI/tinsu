use serde::{Deserialize, Serialize};
use specta::Type;

/// Keychain service name prefix — keeps all TinSu keys grouped
pub const KEYCHAIN_SERVICE: &str = "tinsu_ssh";

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
