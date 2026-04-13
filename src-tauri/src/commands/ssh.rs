//! SSH key management Tauri commands.
//! Key names are persisted in app_settings table under key "ssh_key_names" as JSON array.

use crate::db::entities::settings;
use crate::error::AppError;
use crate::models::ssh_config::{GenerateSshKeyInput, SshKeyEntry, SshKeyExport};
use crate::services::ssh_service;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use tauri::State;

// Key used in app_settings to persist SSH key names (since keyring has no list API)
const SSH_KEY_NAMES_SETTING: &str = "ssh_key_names";

/// Generate a new Ed25519 key pair, store in OS keychain, persist name in DB.
#[tauri::command]
#[specta::specta]
pub async fn generate_ssh_key(
    input: GenerateSshKeyInput,
    db: State<'_, DatabaseConnection>,
) -> Result<SshKeyEntry, AppError> {
    let entry = ssh_service::generate_and_store_key(&input.name)?;
    // Persist the name to the settings table so we can enumerate later
    if let Err(db_err) = append_key_name(&db, &input.name).await {
        // Rollback: remove keychain entry to avoid orphaning a key that can never be listed/deleted
        if let Err(cleanup_err) = ssh_service::delete_key(&input.name) {
            tracing::warn!(
                "Failed to clean up keychain entry '{}' after DB failure: {}",
                input.name,
                cleanup_err
            );
        }
        return Err(db_err);
    }
    Ok(entry)
}

/// List all SSH keys stored in the OS keychain (names from DB, public keys from keychain).
#[tauri::command]
#[specta::specta]
pub async fn list_ssh_keys(
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<SshKeyEntry>, AppError> {
    let names = get_key_names(&db).await?;
    ssh_service::list_keys(&names)
}

/// Get the public key for a named SSH key.
#[tauri::command]
#[specta::specta]
pub async fn get_ssh_public_key(
    name: String,
    _db: State<'_, DatabaseConnection>,
) -> Result<SshKeyEntry, AppError> {
    ssh_service::get_public_key(&name)
}

/// Export both public and private key for a named SSH key.
/// WARNING: Private key is returned in plaintext — use only for one-time export.
#[tauri::command]
#[specta::specta]
pub async fn export_ssh_key(
    name: String,
    _db: State<'_, DatabaseConnection>,
) -> Result<SshKeyExport, AppError> {
    ssh_service::export_key(&name)
}

/// Delete a named SSH key from the OS keychain and remove from DB name list.
#[tauri::command]
#[specta::specta]
pub async fn delete_ssh_key(
    name: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    ssh_service::delete_key(&name)?;
    remove_key_name(&db, &name).await?;
    Ok(())
}

// ── DB Helpers ───────────────────────────────────────────────────────────────

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("System clock before UNIX_EPOCH: {}; using 0", e);
            0
        })
}

async fn get_key_names(db: &DatabaseConnection) -> Result<Vec<String>, AppError> {
    use crate::db::entities::settings::Column;
    let row = settings::Entity::find()
        .filter(Column::Key.eq(SSH_KEY_NAMES_SETTING))
        .one(db)
        .await?;
    Ok(row
        .and_then(|r| serde_json::from_str::<Vec<String>>(&r.value).ok())
        .unwrap_or_default())
}

async fn append_key_name(db: &DatabaseConnection, name: &str) -> Result<(), AppError> {
    let mut names = get_key_names(db).await?;
    if !names.contains(&name.to_string()) {
        names.push(name.to_string());
        upsert_key_names(db, &names).await?;
    }
    Ok(())
}

async fn remove_key_name(db: &DatabaseConnection, name: &str) -> Result<(), AppError> {
    let mut names = get_key_names(db).await?;
    names.retain(|n| n != name);
    upsert_key_names(db, &names).await?;
    Ok(())
}

async fn upsert_key_names(db: &DatabaseConnection, names: &[String]) -> Result<(), AppError> {
    use crate::db::entities::settings::Column;
    let json = serde_json::to_string(names).map_err(|e| AppError::Internal(e.to_string()))?;
    // Check existing row first
    let existing = settings::Entity::find()
        .filter(Column::Key.eq(SSH_KEY_NAMES_SETTING))
        .one(db)
        .await?;
    match existing {
        Some(row) => {
            let mut active: settings::ActiveModel = row.into();
            active.value = Set(json);
            active.update(db).await?;
        }
        None => {
            let active = settings::ActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                key: Set(SSH_KEY_NAMES_SETTING.to_string()),
                value: Set(json),
                created_at: Set(now_unix_secs()),
            };
            active.insert(db).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test key name validation via ssh_service directly (no DB needed)
    #[test]
    fn test_invalid_key_names_rejected() {
        for bad in &["", "bad name", "bad/key", "bad:key"] {
            assert!(crate::services::ssh_service::generate_and_store_key(bad).is_err());
        }
    }
}
