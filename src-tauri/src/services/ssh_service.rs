//! SSH key generation and OS keychain management.
//! Uses ssh-key crate for Ed25519 key generation and keyring for secure storage.

use crate::error::AppError;
use crate::models::ssh_config::{SshKeyEntry, SshKeyExport, KEYCHAIN_SERVICE};
use keyring::Entry;
use rand::rngs::OsRng;
use ssh_key::{Algorithm, LineEnding, PrivateKey};

/// Generate a new Ed25519 SSH key pair and store the private key in the OS keychain.
/// Returns the SshKeyEntry (name + public key) on success.
pub fn generate_and_store_key(name: &str) -> Result<SshKeyEntry, AppError> {
    // Validate name: no slashes, colons, or spaces (keychain constraints)
    if name.is_empty() || name.contains(['/', ':', ' ']) {
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

    // Store private key in OS keychain
    let entry = Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
    entry
        .set_password(&private_pem)
        .map_err(|e| AppError::Internal(format!("Keychain storage failed: {e}")))?;

    Ok(SshKeyEntry {
        name: name.to_string(),
        public_key,
    })
}

/// List all SSH key names stored in the OS keychain.
/// Reads from a metadata store (app data dir) since keyring has no enumerate API.
pub fn list_keys(key_names: &[String]) -> Result<Vec<SshKeyEntry>, AppError> {
    let mut entries = Vec::new();
    for name in key_names {
        match Entry::new(KEYCHAIN_SERVICE, name) {
            Err(e) => tracing::warn!("Failed to access keychain entry '{}': {}", name, e),
            Ok(entry) => match entry.get_password() {
                Err(e) => tracing::warn!(
                    "Failed to retrieve keychain password for '{}': {}",
                    name, e
                ),
                Ok(pem) => match public_key_from_pem(&pem) {
                    Err(e) => {
                        tracing::warn!("Failed to decode public key for '{}': {}", name, e)
                    }
                    Ok(public_key) => entries.push(SshKeyEntry {
                        name: name.clone(),
                        public_key,
                    }),
                },
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

/// Delete an SSH key from the OS keychain.
pub fn delete_key(name: &str) -> Result<(), AppError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
    entry
        .delete_credential()
        .map_err(|e| AppError::Internal(format!("Keychain deletion failed: {e}")))?;
    Ok(())
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn get_private_pem(name: &str) -> Result<String, AppError> {
    let entry = Entry::new(KEYCHAIN_SERVICE, name)
        .map_err(|e| AppError::Internal(format!("Keychain entry creation failed: {e}")))?;
    entry
        .get_password()
        .map_err(|_| AppError::NotFound(format!("SSH key '{name}' not found in keychain")))
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
