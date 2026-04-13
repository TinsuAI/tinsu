//! SSH connection profile management Tauri commands.

use crate::db::entities::ssh_connection;
use crate::error::AppError;
use crate::models::ssh_config::{
    CreateSshConnectionInput, SshConnectionProfile, SshConnectionTestResult,
    TestSshConnectionInput, UpdateSshConnectionInput,
};
use crate::services::ssh_service;
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};
use tauri::State;

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("System clock before UNIX_EPOCH: {}; using 0", e);
            0
        })
}

fn validate_connection_input(
    host: &str,
    port: u16,
    username: &str,
    auth_method: &str,
    key_name: Option<&str>,
) -> Result<(), AppError> {
    if host.is_empty() {
        return Err(AppError::BadRequest("host must not be empty".into()));
    }
    // Port is already u16, so range is [0, 65535]; just ensure non-zero
    if port == 0 {
        return Err(AppError::BadRequest("port must be between 1 and 65535".into()));
    }
    if username.is_empty() {
        return Err(AppError::BadRequest("username must not be empty".into()));
    }
    match auth_method {
        "key" => {
            if key_name.is_none() || key_name.map(|n| n.trim().is_empty()).unwrap_or(true) {
                return Err(AppError::BadRequest(
                    "key_name is required when auth_method is 'key'".into(),
                ));
            }
        }
        "password" => {}
        other => {
            return Err(AppError::BadRequest(format!(
                "auth_method must be 'key' or 'password', got '{other}'"
            )));
        }
    }
    Ok(())
}

fn model_to_profile(model: ssh_connection::Model) -> SshConnectionProfile {
    SshConnectionProfile {
        id: model.id,
        host: model.host,
        port: model.port as u16,
        username: model.username,
        auth_method: model.auth_method,
        key_name: model.key_name,
        created_at: model.created_at,
    }
}

/// List all saved SSH connection profiles.
#[tauri::command]
#[specta::specta]
pub async fn list_ssh_connections(
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<SshConnectionProfile>, AppError> {
    let rows = ssh_connection::Entity::find().all(db.inner()).await?;
    Ok(rows.into_iter().map(model_to_profile).collect())
}

/// Create a new SSH connection profile.
#[tauri::command]
#[specta::specta]
pub async fn create_ssh_connection(
    input: CreateSshConnectionInput,
    db: State<'_, DatabaseConnection>,
) -> Result<SshConnectionProfile, AppError> {
    validate_connection_input(
        &input.host,
        input.port,
        &input.username,
        &input.auth_method,
        input.key_name.as_deref(),
    )?;

    let id = uuid::Uuid::new_v4().to_string();
    let active = ssh_connection::ActiveModel {
        id: Set(id),
        host: Set(input.host),
        port: Set(input.port as i32),
        username: Set(input.username),
        auth_method: Set(input.auth_method),
        key_name: Set(input.key_name),
        created_at: Set(now_unix_secs()),
    };
    let model = active.insert(db.inner()).await?;
    Ok(model_to_profile(model))
}

/// Update an existing SSH connection profile.
#[tauri::command]
#[specta::specta]
pub async fn update_ssh_connection(
    input: UpdateSshConnectionInput,
    db: State<'_, DatabaseConnection>,
) -> Result<SshConnectionProfile, AppError> {
    validate_connection_input(
        &input.host,
        input.port,
        &input.username,
        &input.auth_method,
        input.key_name.as_deref(),
    )?;

    let existing = ssh_connection::Entity::find_by_id(&input.id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SSH connection '{}' not found", input.id)))?;

    let mut active: ssh_connection::ActiveModel = existing.into();
    active.host = Set(input.host);
    active.port = Set(input.port as i32);
    active.username = Set(input.username);
    active.auth_method = Set(input.auth_method);
    active.key_name = Set(input.key_name);
    let model = active.update(db.inner()).await?;
    Ok(model_to_profile(model))
}

/// Delete an SSH connection profile by id.
#[tauri::command]
#[specta::specta]
pub async fn delete_ssh_connection(
    id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    let existing = ssh_connection::Entity::find_by_id(&id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("SSH connection '{id}' not found")))?;

    let active: ssh_connection::ActiveModel = existing.into();
    active.delete(db.inner()).await?;
    Ok(())
}

/// Test an SSH connection — connect, authenticate, return fingerprint on success.
#[tauri::command]
#[specta::specta]
pub async fn test_ssh_connection(
    input: TestSshConnectionInput,
    _db: State<'_, DatabaseConnection>,
) -> Result<SshConnectionTestResult, AppError> {
    ssh_service::test_connection(
        &input.host,
        input.port,
        &input.username,
        &input.auth_method,
        input.key_name.as_deref(),
        input.password.as_deref(),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ssh_connection_profile_round_trip() {
        use crate::migration::Migrator;
        use sea_orm::Database;
        use sea_orm_migration::MigratorTrait;

        let db = Database::connect("sqlite::memory:").await.unwrap();
        Migrator::up(&db, None).await.unwrap();

        // Insert profile
        let id = uuid::Uuid::new_v4().to_string();
        let active = ssh_connection::ActiveModel {
            id: Set(id.clone()),
            host: Set("test.example.com".to_string()),
            port: Set(22),
            username: Set("testuser".to_string()),
            auth_method: Set("password".to_string()),
            key_name: Set(None),
            created_at: Set(now_unix_secs()),
        };
        let inserted = active.insert(&db).await.unwrap();
        assert_eq!(inserted.host, "test.example.com");

        // List it
        let rows = ssh_connection::Entity::find().all(&db).await.unwrap();
        assert_eq!(rows.len(), 1, "Should find 1 profile after insert");
        assert_eq!(rows[0].id, id, "Listed profile id must match inserted id");

        // Delete it
        let to_delete: ssh_connection::ActiveModel = inserted.into();
        to_delete.delete(&db).await.unwrap();

        // Verify gone
        let rows_after = ssh_connection::Entity::find().all(&db).await.unwrap();
        assert!(rows_after.is_empty(), "Profile list must be empty after deletion");
    }

    #[test]
    fn test_validate_rejects_empty_host() {
        let result = validate_connection_input("", 22, "user", "password", None);
        assert!(result.is_err(), "Should reject empty host");
        assert!(result.unwrap_err().to_string().contains("host"));
    }

    #[test]
    fn test_validate_rejects_port_zero() {
        let result = validate_connection_input("example.com", 0, "user", "password", None);
        assert!(result.is_err(), "Should reject port 0");
    }

    #[test]
    fn test_validate_rejects_empty_username() {
        let result = validate_connection_input("example.com", 22, "", "password", None);
        assert!(result.is_err(), "Should reject empty username");
        assert!(result.unwrap_err().to_string().contains("username"));
    }

    #[test]
    fn test_validate_rejects_key_auth_without_key_name() {
        let result = validate_connection_input("example.com", 22, "user", "key", None);
        assert!(result.is_err(), "Should reject key auth without key_name");
        assert!(result.unwrap_err().to_string().contains("key_name"));
    }

    #[test]
    fn test_validate_rejects_unknown_auth_method() {
        let result =
            validate_connection_input("example.com", 22, "user", "certificate", None);
        assert!(result.is_err(), "Should reject unknown auth_method");
        assert!(result.unwrap_err().to_string().contains("auth_method"));
    }

    #[test]
    fn test_validate_accepts_valid_key_auth() {
        let result =
            validate_connection_input("example.com", 22, "user", "key", Some("my-key"));
        assert!(result.is_ok(), "Should accept valid key auth with key_name");
    }

    #[test]
    fn test_validate_accepts_valid_password_auth() {
        let result = validate_connection_input("example.com", 22, "user", "password", None);
        assert!(result.is_ok(), "Should accept valid password auth");
    }
}
