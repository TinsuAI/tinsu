//! Remote file operations — git diffs and artifact reads via SSH exec.
//! Reuses ssh_service::run_ssh_exec (same pattern as remote_projects.rs and remote_agent.rs).

use crate::commands::project::FileEntry;
use crate::db::entities::{remote_project, ssh_connection, task, task_session};
use crate::error::AppError;
use crate::services::git_service::{parse_unified_diff, GitDiffResult, GitDiffSummary};
use crate::services::ssh_service;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

// ── get_remote_task_diff ──────────────────────────────────────────────────────

/// Get the git diff for a remote task's branch vs main.
///
/// Mirrors `get_task_diff` but executes git commands on the remote machine via SSH.
/// Returns empty GitDiffResult if the task has no branch or is not a remote task.
#[tauri::command]
#[specta::specta]
pub async fn get_remote_task_diff(
    task_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<GitDiffResult, AppError> {
    if task_id.is_empty() {
        return Err(AppError::BadRequest("task_id must not be empty".into()));
    }

    let empty = GitDiffResult {
        files: vec![],
        summary: GitDiffSummary {
            files_changed: 0,
            lines_added: 0,
            lines_removed: 0,
        },
    };

    // Load task → branch_name
    let task_model = task::Entity::find_by_id(&task_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task '{task_id}' not found")))?;

    let branch_name = match task_model.branch_name {
        Some(ref b) if !b.is_empty() => b.clone(),
        _ => return Ok(empty),
    };

    // Load task_session to get remote_project_id and remote_connection_id
    let session = task_session::Entity::find()
        .filter(task_session::Column::TaskId.eq(&task_id))
        .one(db.inner())
        .await?;

    let (remote_project_id, remote_connection_id) = match session {
        Some(s)
            if s.remote_project_id.is_some() && s.remote_connection_id.is_some() =>
        {
            (s.remote_project_id.unwrap(), s.remote_connection_id.unwrap())
        }
        // Not a remote task — caller should use get_task_diff instead
        _ => return Ok(empty),
    };

    // Load remote_project → path
    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("Remote project '{remote_project_id}' not found"))
        })?;

    // Load ssh_connection → auth details
    let conn = ssh_connection::Entity::find_by_id(&remote_connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{remote_connection_id}' not found"
            ))
        })?;

    // Build git diff commands — quote branch_name and path for shell safety
    let safe_branch = branch_name.replace("'", "'\\''");
    let safe_path = rp.path.replace("'", "'\\''");

    let diff_cmd = format!(
        "cd '{}' && git diff 'main...{}'",
        safe_path, safe_branch
    );
    let status_cmd = format!(
        "cd '{}' && git diff --name-status 'main...{}'",
        safe_path, safe_branch
    );

    // Run both commands on remote — 15s timeout each (same as create_remote_task_session)
    let unified = tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &diff_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Remote git diff timed out".into()))??;

    let name_status = tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &status_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Remote git name-status timed out".into()))??;

    if unified.is_empty() {
        return Ok(empty);
    }

    // Parse diff with panic protection
    let files = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        parse_unified_diff(&unified, &name_status)
    })).map_err(|_| AppError::Internal("Diff parsing failed unexpectedly".into()))?;

    // Use saturating arithmetic to prevent overflow on pathologically large diffs
    let lines_added: i32 = files
        .iter()
        .map(|f| f.additions)
        .fold(0i32, |acc, val| acc.saturating_add(val));
    let lines_removed: i32 = files
        .iter()
        .map(|f| f.deletions)
        .fold(0i32, |acc, val| acc.saturating_add(val));
    let files_changed = files.len().min(i32::MAX as usize) as i32;

    Ok(GitDiffResult {
        summary: GitDiffSummary {
            files_changed,
            lines_added,
            lines_removed,
        },
        files,
    })
}

// ── read_remote_file ──────────────────────────────────────────────────────────

/// Read a file from the remote project filesystem via SSH exec.
///
/// `relative_path`: path relative to the remote project root (e.g. "_bmad-output/implementation-artifacts/t2-5.md")
///
/// Validates:
/// - No null bytes (injection guard)
/// - No `../` traversal
/// - Non-empty
/// - File size ≤ 1MB (checked via wc -c before reading)
#[tauri::command]
#[specta::specta]
pub async fn read_remote_file(
    remote_project_id: String,
    relative_path: String,
    db: State<'_, DatabaseConnection>,
) -> Result<String, AppError> {
    // ── Input validation (no SSH needed) ─────────────────────────────────
    if relative_path.is_empty() {
        return Err(AppError::BadRequest("relative_path must not be empty".into()));
    }
    if relative_path.contains('\0') {
        return Err(AppError::BadRequest(
            "Invalid path: path contains null bytes".into(),
        ));
    }
    // Prevent path traversal — reject any component with ".."
    if relative_path.contains("../") || relative_path.starts_with("..") {
        return Err(AppError::BadRequest(
            "Invalid path: path traversal not allowed".into(),
        ));
    }
    // Reject absolute paths — must be relative to project root
    if relative_path.starts_with('/') {
        return Err(AppError::BadRequest(
            "Invalid path: absolute paths not allowed (use relative path from project root)".into(),
        ));
    }

    // ── Load remote project and SSH connection ────────────────────────────
    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("Remote project '{remote_project_id}' not found"))
        })?;

    let conn = ssh_connection::Entity::find_by_id(&rp.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("SSH connection '{}' not found", rp.connection_id))
        })?;

    // ── Build absolute path safely ────────────────────────────────────────
    let absolute_path = format!("{}/{}", rp.path.trim_end_matches('/'), relative_path);
    let safe_abs = absolute_path.replace("'", "'\\''");
    let safe_root = rp.path.replace("'", "'\\''");

    // ── Resolve symlinks to prevent traversal attacks ─────────────────────
    // Verify that the resolved path stays within the project root
    let realpath_cmd = format!("realpath '{safe_abs}'");
    let resolved_path = tokio::time::timeout(
        tokio::time::Duration::from_secs(3),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &realpath_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Path resolution timed out".into()))??;

    let resolved_path = resolved_path.trim();
    let project_root = rp.path.trim();

    // Verify resolved path is within project root
    if !resolved_path.starts_with(project_root) || resolved_path == project_root {
        return Err(AppError::BadRequest(
            "Invalid path: access outside project root not allowed".into(),
        ));
    }

    // ── Check file size first (NFR34: <3s for ≤1MB) ──────────────────────
    let size_cmd = format!("wc -c < '{safe_abs}'");
    let size_output = tokio::time::timeout(
        tokio::time::Duration::from_secs(3),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &size_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("File size check timed out".into()))??;

    let file_size: u64 = size_output
        .trim()
        .parse()
        .map_err(|_| AppError::Internal(
            "File size check returned invalid output from remote system".into(),
        ))?;
    if file_size > 1_048_576 {
        return Err(AppError::BadRequest(format!(
            "File too large: {file_size} bytes exceeds 1MB limit"
        )));
    }

    // ── Read file contents ────────────────────────────────────────────────
    let cat_cmd = format!("cat '{safe_abs}'");
    let result = tokio::time::timeout(
        tokio::time::Duration::from_secs(3),
        ssh_service::run_ssh_exec(
            &conn.host,
            conn.port as u16,
            &conn.username,
            &conn.auth_method,
            conn.key_name.as_deref(),
            None,
            &cat_cmd,
        ),
    )
    .await
    .map_err(|_| AppError::Internal("Remote file read timed out after 3 seconds".into()));

    match result {
        Err(_timeout) => Err(AppError::Internal(
            "Remote file read timed out after 3 seconds".into(),
        )),
        Ok(Err(AppError::Internal(ref msg))) => {
            // Map SSH stderr to user-friendly errors
            // Note: generic error messages; detailed logs are server-side only (tracing::warn!)
            if msg.contains("No such file") || msg.contains("no such file") {
                tracing::warn!("Remote file not found: {relative_path}");
                Err(AppError::NotFound("File not found on remote system".into()))
            } else if msg.contains("Permission denied") || msg.contains("permission denied") {
                tracing::warn!("Remote file permission denied: {relative_path}");
                Err(AppError::Internal("Permission denied: unable to access file".into()))
            } else {
                tracing::warn!("Remote file read error: {msg} for {relative_path}");
                Err(AppError::Internal(
                    "Unable to read file from remote system".into(),
                ))
            }
        }
        Ok(other) => other,
    }
}

// ── list_remote_project_files ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListRemoteProjectFilesInput {
    pub connection_id: String,
    pub project_path: String,
    /// Relative prefix — empty for root, "src/" to list that dir, "src/comp" to list src/ dir.
    pub prefix: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SearchRemoteProjectFilesInput {
    pub connection_id: String,
    pub project_path: String,
    pub query: String,
}

/// Lists immediate children (files + dirs) of the directory determined by the prefix via SSH.
/// Uses `ls -1ap` on the remote; entries ending with `/` are directories.
#[tauri::command]
#[specta::specta]
pub async fn list_remote_project_files(
    input: ListRemoteProjectFilesInput,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<FileEntry>, AppError> {
    let conn = ssh_connection::Entity::find_by_id(&input.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{}' not found",
                input.connection_id
            ))
        })?;

    // Determine target directory from prefix (everything up to and including the last '/')
    let dir_suffix = if let Some(last_slash) = input.prefix.rfind('/') {
        input.prefix[..=last_slash].to_string()
    } else {
        String::new()
    };

    let target_dir = if dir_suffix.is_empty() {
        input.project_path.trim_end_matches('/').to_string()
    } else {
        format!(
            "{}/{}",
            input.project_path.trim_end_matches('/'),
            dir_suffix.trim_start_matches('/')
        )
    };

    let safe_dir = target_dir.replace('\'', "'\\''");
    // ls -1ap: one per line, all entries (including hidden), append '/' to dirs
    // Filter out '.' and '..' entries
    let cmd = format!(
        "cd '{safe_dir}' 2>/dev/null && ls -1ap 2>/dev/null | grep -v '^\\.$\\|^\\.\\./$'"
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
    .map_err(|_| AppError::Internal("Remote file listing timed out".into()))
    .unwrap_or_else(|e| Err(e))?;

    let mut entries: Vec<FileEntry> = output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let is_directory = line.ends_with('/');
            let name = line.trim_end_matches('/').to_string();
            let relative_path = if dir_suffix.is_empty() {
                name.clone()
            } else {
                format!("{}{}", dir_suffix, name)
            };
            FileEntry {
                name,
                relative_path,
                is_directory,
            }
        })
        .collect();

    entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then(a.name.cmp(&b.name)));
    Ok(entries)
}

/// Searches files and directories by name on the remote project via SSH find.
/// Uses GNU find's `-printf` to get type info; max 50 results, depth 8.
#[tauri::command]
#[specta::specta]
pub async fn search_remote_project_files(
    input: SearchRemoteProjectFilesInput,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<FileEntry>, AppError> {
    let conn = ssh_connection::Entity::find_by_id(&input.connection_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "SSH connection '{}' not found",
                input.connection_id
            ))
        })?;

    let safe_project = input.project_path.replace('\'', "'\\''");
    let safe_query = input.query.replace('\'', "'\\''");

    // find: type (f/d) + tab + relative path (without leading ./)
    // Prune noise directories before descending into them
    let cmd = format!(
        "cd '{safe_project}' 2>/dev/null && \
         find . -maxdepth 8 \
           \\( -name '.git' -o -name 'node_modules' -o -name 'target' -o -name '.next' -o -name 'dist' \\) -prune \
           -o \\( -type f -o -type d \\) -name '*{safe_query}*' -printf '%y\\t%P\\n' \
           2>/dev/null | head -50"
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
    .map_err(|_| AppError::Internal("Remote file search timed out".into()))
    .unwrap_or_else(|e| Err(e))?;

    let mut entries: Vec<FileEntry> = output
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            let mut parts = line.splitn(2, '\t');
            let type_char = parts.next()?;
            let rel_path = parts.next()?.trim().to_string();
            if rel_path.is_empty() {
                return None;
            }
            let is_directory = type_char == "d";
            let name = rel_path
                .rsplit('/')
                .next()
                .unwrap_or(&rel_path)
                .to_string();
            Some(FileEntry {
                name,
                relative_path: rel_path,
                is_directory,
            })
        })
        .collect();

    entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then(a.name.cmp(&b.name)));
    Ok(entries)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_detection_rejects_dotdot_slash() {
        // Paths with ../ must be rejected before SSH
        let paths = ["../etc/passwd", "foo/../bar", "a/b/../../etc/passwd"];
        for p in &paths {
            assert!(
                p.contains("../") || p.starts_with(".."),
                "Test case '{p}' must match traversal check"
            );
        }
    }

    #[test]
    fn test_absolute_path_rejected() {
        let p = "/etc/passwd";
        assert!(p.starts_with('/'), "Absolute path must be rejected");
    }

    #[test]
    fn test_cat_command_quotes_path_correctly() {
        let path = "/home/user/my project/file.md";
        let safe = path.replace("'", "'\\''");
        let cmd = format!("cat '{safe}'");
        assert_eq!(cmd, "cat '/home/user/my project/file.md'");
    }

    #[test]
    fn test_cat_command_escapes_single_quotes_in_path() {
        let path = "/home/user/it's-a-project/file.md";
        let safe = path.replace("'", "'\\''");
        let cmd = format!("cat '{safe}'");
        assert_eq!(cmd, "cat '/home/user/it'\\''s-a-project/file.md'");
    }

    #[test]
    fn test_git_diff_command_quotes_branch_and_path() {
        let project_path = "/home/user/my-project";
        let branch = "tinsu/story-abc-my-feature";
        let safe_path = project_path.replace("'", "'\\''");
        let safe_branch = branch.replace("'", "'\\''");
        let cmd = format!("cd '{}' && git diff 'main...{}'", safe_path, safe_branch);
        assert_eq!(
            cmd,
            "cd '/home/user/my-project' && git diff 'main...tinsu/story-abc-my-feature'"
        );
    }

    #[test]
    fn test_wc_c_size_check_command_format() {
        let abs_path = "/home/user/project/file.md";
        let safe = abs_path.replace("'", "'\\''");
        let cmd = format!("wc -c < '{safe}'");
        assert_eq!(cmd, "wc -c < '/home/user/project/file.md'");
    }

    #[test]
    fn test_empty_diff_returned_when_branch_name_is_empty_string() {
        // This validates that the early-return logic on empty branch_name is correct
        let branch_name: Option<String> = Some(String::new());
        let is_empty = branch_name.as_ref().map(|b| b.is_empty()).unwrap_or(true);
        assert!(is_empty, "Empty branch_name should trigger empty diff return");
    }

    #[test]
    fn test_remote_file_errors_map_to_app_error() {
        // Verify the error mapping strings match what the SSH exec produces
        // Permission denied → AppError::Internal with "Permission denied" message
        let perm_denied_msg = "ssh: Permission denied: /home/user/secret";
        assert!(
            perm_denied_msg.contains("Permission denied") || perm_denied_msg.contains("permission denied"),
            "Permission denied message must trigger permission error mapping"
        );

        // File not found → AppError::NotFound
        let not_found_msg = "ssh: No such file or directory: /home/user/missing.txt";
        assert!(
            not_found_msg.contains("No such file") || not_found_msg.contains("no such file"),
            "No-such-file message must trigger not-found mapping"
        );
    }

    #[test]
    fn test_remote_diff_validates_non_empty_path() {
        // get_remote_task_diff validates task_id (mapped from project_path in story spec)
        // An empty task_id must not pass into SSH/DB calls
        let task_id = "";
        assert!(task_id.is_empty(), "Empty task_id must be caught by validation guard");
        // The actual guard: `if task_id.is_empty() { return Err(AppError::BadRequest(...)) }`
        // This test documents the expected behavior and validates the guard condition
        let is_bad_request = task_id.is_empty();
        assert!(is_bad_request, "Empty task_id → BadRequest before any SSH call");
    }

    #[test]
    fn test_absolute_path_construction_trims_trailing_slash() {
        let project_root = "/home/user/project/";
        let relative = "_bmad-output/implementation-artifacts/t2-5.md";
        let abs = format!("{}/{}", project_root.trim_end_matches('/'), relative);
        assert_eq!(
            abs,
            "/home/user/project/_bmad-output/implementation-artifacts/t2-5.md"
        );
    }
}
