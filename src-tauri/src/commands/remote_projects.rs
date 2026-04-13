//! Remote project discovery and management Tauri commands.

use crate::db::entities::{remote_project, ssh_connection};
use crate::error::AppError;
use crate::models::ssh_config::{
    DiscoverProjectsInput, DiscoveredProject, ListRemoteDirInput, RemoteDirEntry,
    RemoteProjectProfile, SaveRemoteProjectInput,
};
use crate::services::ssh_service;
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, QueryOrder, QuerySelect, Set};
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

fn model_to_profile(model: remote_project::Model) -> RemoteProjectProfile {
    RemoteProjectProfile {
        id: model.id,
        connection_id: model.connection_id,
        name: model.name,
        path: model.path,
        created_at: model.created_at,
    }
}

/// Discover git repositories on a remote machine via SSH.
/// Runs `find <path> -name .git -maxdepth 5 -type d 2>/dev/null` over SSH.
#[tauri::command]
#[specta::specta]
pub async fn discover_remote_projects(
    input: DiscoverProjectsInput,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<DiscoveredProject>, AppError> {
    // Load the SSH connection profile
    let conn = ssh_connection::Entity::find_by_id(&input.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{}' not found",
                input.connection_id
            ))
        })?;

    let search_path = input.search_path.as_deref().unwrap_or("~");

    // Password auth does not store the password in DB (T2.2 design decision).
    // Discovery requires executing remote commands, which requires an active session.
    // Only key-based connections can be used for discovery.
    if conn.auth_method == "password" {
        return Err(AppError::BadRequest(
            "Remote project discovery requires key-based SSH authentication. \
             Password authentication is not supported for discovery — \
             re-save the connection using an SSH key."
                .into(),
        ));
    }

    ssh_service::discover_projects(
        &conn.host,
        conn.port as u16,
        &conn.username,
        &conn.auth_method,
        conn.key_name.as_deref(),
        None,
        search_path,
    )
    .await
}

/// List subdirectories at a path on a remote machine via SSH.
/// Uses `ls -1p` and filters for entries ending with `/`.
#[tauri::command]
#[specta::specta]
pub async fn list_remote_dir(
    input: ListRemoteDirInput,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<RemoteDirEntry>, AppError> {
    let conn = ssh_connection::Entity::find_by_id(&input.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{}' not found",
                input.connection_id
            ))
        })?;

    if conn.auth_method == "password" {
        return Err(AppError::BadRequest(
            "Directory listing requires key-based SSH authentication.".into(),
        ));
    }

    let path = input.path.as_deref().unwrap_or("~");

    // Build shell-safe cd target.
    // IMPORTANT: ~ must NOT be single-quoted — the shell only expands ~ when unquoted.
    // ~/sub/path: keep ~ unquoted, quote the rest.
    // Absolute /paths: single-quote entirely.
    let cd_target = if path == "~" || path == "~/" {
        "~".to_string()
    } else if let Some(rest) = path.strip_prefix("~/") {
        format!("~/'{}'", rest.replace('\'', "'\\''"))
    } else {
        format!("'{}'", path.replace('\'', "'\\''"))
    };

    // ls -1ap: 1=one per line, a=include hidden, p=append / to dirs
    // LC_ALL=C disables color escape codes that would break grep
    // grep -v filters out . and .. entries
    let cmd = format!(
        "cd {cd_target} 2>/dev/null && pwd && LC_ALL=C ls -1ap 2>/dev/null | grep '/$' | grep -Ev '^\\./$$|^\\.\\./$$' | sed 's|/$||' | sort"
    );

    let output = tokio::time::timeout(
        tokio::time::Duration::from_secs(10),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Directory listing timed out".into()))??;

    // First line is the resolved absolute path (from `pwd`), rest are dir names
    let mut lines = output.lines();
    let resolved_path = lines.next().unwrap_or(path).trim().to_string();

    let entries = lines
        .map(|name| {
            let name = name.trim().to_string();
            let full_path = format!("{}/{}", resolved_path.trim_end_matches('/'), name);
            RemoteDirEntry { name, path: full_path }
        })
        .filter(|e| !e.name.is_empty())
        .collect();

    Ok(entries)
}

/// Save a discovered (or manually entered) remote project profile.
#[tauri::command]
#[specta::specta]
pub async fn save_remote_project(
    input: SaveRemoteProjectInput,
    db: State<'_, DatabaseConnection>,
) -> Result<RemoteProjectProfile, AppError> {
    // Validate
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("name must not be empty".into()));
    }
    let path = input.path.trim();
    if path.is_empty() {
        return Err(AppError::BadRequest("path must not be empty".into()));
    }
    if !path.starts_with('/') && !path.starts_with('~') {
        return Err(AppError::BadRequest(
            "path must be an absolute path (starting with '/' or '~')".into(),
        ));
    }
    // Reject ~user/ expansion syntax (only simple ~ is supported)
    if path.starts_with("~") && !path.starts_with("~/") && path != "~" {
        return Err(AppError::BadRequest(
            "path must use simple ~ (home) or ~/ prefix; ~user expansion not supported".into(),
        ));
    }
    // Verify connection exists
    ssh_connection::Entity::find_by_id(&input.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{}' not found",
                input.connection_id
            ))
        })?;

    let id = uuid::Uuid::new_v4().to_string();
    let active = remote_project::ActiveModel {
        id: Set(id),
        connection_id: Set(input.connection_id),
        name: Set(name.to_string()),
        path: Set(path.to_string()),
        created_at: Set(now_unix_secs()),
    };
    let model = active.insert(db.inner()).await?;
    Ok(model_to_profile(model))
}

/// List all saved remote project profiles.
#[tauri::command]
#[specta::specta]
pub async fn list_remote_projects(
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<RemoteProjectProfile>, AppError> {
    let rows = remote_project::Entity::find()
        .order_by_desc(remote_project::Column::CreatedAt)
        .limit(500)
        .all(db.inner())
        .await?;
    Ok(rows.into_iter().map(model_to_profile).collect())
}

/// Delete a saved remote project profile.
#[tauri::command]
#[specta::specta]
pub async fn delete_remote_project(
    id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    let model = remote_project::Entity::find_by_id(&id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Remote project '{id}' not found")))?;

    let active: remote_project::ActiveModel = model.into();
    active.delete(db.inner()).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_git_dirs_extracts_parent_path() {
        let output = "/home/user/my-repo/.git\n/home/user/another/.git\n";
        let result = crate::services::ssh_service::parse_discovered_projects(output);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].path, "/home/user/my-repo");
        assert_eq!(result[0].name, "my-repo");
        assert_eq!(result[1].path, "/home/user/another");
    }

    #[test]
    fn test_parse_empty_output_returns_empty_vec() {
        let result = crate::services::ssh_service::parse_discovered_projects("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_strips_trailing_slash_from_git_dir() {
        let output = "/home/user/repo/.git/\n";
        let result = crate::services::ssh_service::parse_discovered_projects(output);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "/home/user/repo");
    }

    #[test]
    fn test_parse_skips_malformed_lines() {
        let output = "/.git\n/home/user/good/.git\nnot-absolute\n";
        let result = crate::services::ssh_service::parse_discovered_projects(output);
        // "/.git" → parent = "" → skipped; "not-absolute" → no .git suffix → skipped
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "good");
    }

    #[test]
    fn test_validate_path_requires_leading_slash_or_tilde() {
        let valid_paths = ["/home/user/repo", "~/projects/repo"];
        let invalid_paths = ["relative/path", ""];
        for p in valid_paths {
            assert!(
                p.starts_with('/') || p.starts_with('~'),
                "Expected valid: {p}"
            );
        }
        for p in invalid_paths {
            assert!(
                p.is_empty() || (!p.starts_with('/') && !p.starts_with('~')),
                "Expected invalid: {p}"
            );
        }
    }
}
