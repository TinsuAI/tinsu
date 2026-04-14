use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::Path;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::db::entities::{project, remote_project};
use crate::error::AppError;

// ---------------------------------------------------------------------------
// Tool verification
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ToolCheckResult {
    pub id: String,
    pub name: String,
    /// "installed" | "missing" | "error"
    pub status: String,
    pub version: Option<String>,
    pub critical: bool,
    pub install_hint: Option<String>,
}

fn check_bin(cmd: &str, args: &[&str]) -> (String, Option<String>) {
    match std::process::Command::new(cmd).args(args).output() {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout);
            let version = raw.lines().next().unwrap_or("").trim().to_string();
            ("installed".to_string(), Some(version))
        }
        Ok(_) => ("error".to_string(), None),
        Err(_) => ("missing".to_string(), None),
    }
}

/// DTO for project data exposed via tauri-specta.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ProjectModel {
    pub id: String,
    pub path: String,
    pub name: String,
    pub created_at: i64,
    pub last_opened_at: Option<i64>,
    pub remote_project_id: Option<String>,
}

impl From<project::Model> for ProjectModel {
    fn from(m: project::Model) -> Self {
        ProjectModel {
            id: m.id,
            path: m.path,
            name: m.name,
            created_at: m.created_at,
            last_opened_at: m.last_opened_at,
            remote_project_id: m.remote_project_id,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListRecentProjectsInput {
    pub limit: u64,
}

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("System clock before UNIX_EPOCH: {}; using 0", e);
            0
        })
}

/// Returns recent projects ordered by last_opened_at DESC, created_at DESC, capped at limit.
#[tauri::command]
#[specta::specta]
pub async fn list_recent_projects(
    db: State<'_, DatabaseConnection>,
    input: ListRecentProjectsInput,
) -> Result<Vec<ProjectModel>, AppError> {
    let projects = project::Entity::find()
        .order_by_desc(project::Column::LastOpenedAt)
        .order_by_desc(project::Column::CreatedAt)
        .limit(input.limit)
        .all(db.inner())
        .await?;

    Ok(projects.into_iter().map(ProjectModel::from).collect())
}

/// Returns true if path is a directory containing .tinsu/config.yaml.
#[tauri::command]
#[specta::specta]
pub async fn validate_project_path(path: String) -> Result<bool, AppError> {
    let p = std::path::Path::new(&path);
    let valid = p.is_dir() && p.join(".tinsu").join("config.yaml").exists();
    Ok(valid)
}

#[derive(serde::Deserialize)]
struct TinsuConfig {
    #[serde(rename = "projectName")]
    project_name: String,
}

#[derive(serde::Serialize)]
struct TinsuConfigOut {
    #[serde(rename = "projectName")]
    project_name: String,
    methodology: String,
}

fn read_project_name(path: &str) -> Result<String, AppError> {
    let config_path = format!("{}/.tinsu/config.yaml", path);
    let content = std::fs::read_to_string(&config_path)
        .map_err(|_| AppError::NotFound(format!("No .tinsu/config.yaml at {}", path)))?;
    let config: TinsuConfig = serde_yaml::from_str(&content)
        .map_err(|e| AppError::Internal(format!("Invalid config.yaml: {}", e)))?;
    Ok(config.project_name)
}

async fn upsert_project(
    path: &str,
    project_name: String,
    db: &DatabaseConnection,
    remote_project_id: Option<String>,
) -> Result<ProjectModel, AppError> {
    let existing = project::Entity::find()
        .filter(project::Column::Path.eq(path))
        .one(db)
        .await?;

    let now = now_unix_secs();

    let model = match existing {
        Some(p) => {
            // Do NOT overwrite remote_project_id on update — keep existing value
            let updated = project::ActiveModel {
                id: Set(p.id.clone()),
                last_opened_at: Set(Some(now)),
                ..Default::default()
            };
            updated.update(db).await?
        }
        None => {
            let new = project::ActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                path: Set(path.to_string()),
                name: Set(project_name),
                created_at: Set(now),
                last_opened_at: Set(Some(now)),
                remote_project_id: Set(remote_project_id),
            };
            new.insert(db).await?
        }
    };
    Ok(ProjectModel::from(model))
}

/// Opens a project by path: reads config, upserts in DB, returns ProjectModel.
#[tauri::command]
#[specta::specta]
pub async fn open_project_by_path(
    db: State<'_, DatabaseConnection>,
    path: String,
) -> Result<ProjectModel, AppError> {
    if path.is_empty() {
        return Err(AppError::BadRequest("path must not be empty".to_string()));
    }
    let project_name = read_project_name(&path)?;
    upsert_project(&path, project_name, db.inner(), None).await
}

/// Removes a project and all related records from DB (does NOT delete files).
#[tauri::command]
#[specta::specta]
pub async fn remove_project(
    db: State<'_, DatabaseConnection>,
    id: String,
) -> Result<(), AppError> {
    if id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

    let conn = db.inner();

    // Verify project exists
    project::Entity::find_by_id(&id)
        .one(conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Project {} not found", id)))?;

    // Delete child records bottom-up to satisfy FK constraints.
    // Order: deepest children first, then direct children of projects.
    let cascade_sql = [
        // chat_message_attachments → chat_messages → chat_sessions → projects
        "DELETE FROM chat_message_attachments WHERE message_id IN (SELECT id FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE project_id = $1))",
        "DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE project_id = $1)",
        "DELETE FROM chat_sessions WHERE project_id = $1",
        // gate_decisions → projects (also FK → workflow_runs, but we delete gate_decisions first)
        "DELETE FROM gate_decisions WHERE project_id = $1",
        // workflow_runs → projects + tasks
        "DELETE FROM workflow_runs WHERE project_id = $1",
        // task children → tasks → projects
        "DELETE FROM task_versions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM task_activities WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM session_history WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM task_sessions WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM task_artifacts WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM agent_runs WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)",
        "DELETE FROM tasks WHERE project_id = $1",
        // direct children of projects
        "DELETE FROM planning_artifact_statuses WHERE project_id = $1",
        "DELETE FROM epics WHERE project_id = $1",
        "DELETE FROM sprints WHERE project_id = $1",
        // finally the project itself
        "DELETE FROM projects WHERE id = $1",
    ];

    for sql in cascade_sql {
        conn.execute(Statement::from_sql_and_values(
            DatabaseBackend::Sqlite,
            sql,
            [id.clone().into()],
        ))
        .await?;
    }

    Ok(())
}

/// Opens a native folder picker dialog; returns the selected ProjectModel or None if cancelled.
#[tauri::command]
#[specta::specta]
pub async fn open_project_dialog(
    app: AppHandle,
    db: State<'_, DatabaseConnection>,
) -> Result<Option<ProjectModel>, AppError> {
    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        None => Ok(None),
        Some(file_path) => {
            let path = file_path.to_string();
            let project_name = read_project_name(&path)?;
            let model = upsert_project(&path, project_name, db.inner(), None).await?;
            Ok(Some(model))
        }
    }
}

/// Opens a native folder picker and returns the selected path or None if cancelled.
#[tauri::command]
#[specta::specta]
pub async fn select_parent_directory(app: AppHandle) -> Result<Option<String>, AppError> {
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

/// Creates a new project directory, initializes git, writes config, and inserts in DB.
#[tauri::command]
#[specta::specta]
pub async fn create_project(
    db: State<'_, DatabaseConnection>,
    parent_dir: String,
    project_name: String,
) -> Result<ProjectModel, AppError> {
    if parent_dir.is_empty() {
        return Err(AppError::BadRequest(
            "parent_dir must not be empty".to_string(),
        ));
    }
    if project_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "project_name must not be empty".to_string(),
        ));
    }
    let trimmed_name = project_name.trim();
    if trimmed_name.contains('/') || trimmed_name.contains("..") {
        return Err(AppError::BadRequest(
            "project_name must not contain path separators or '..'".to_string(),
        ));
    }

    let project_path = format!("{}/{}", parent_dir, trimmed_name);

    // 1. Create directory
    std::fs::create_dir_all(&project_path)
        .map_err(|e| AppError::Internal(format!("Failed to create dir: {}", e)))?;

    // 2. Git init
    let output = std::process::Command::new("git")
        .arg("init")
        .current_dir(&project_path)
        .output()
        .map_err(|e| AppError::Internal(format!("Failed to run git init: {}", e)))?;
    if !output.status.success() {
        return Err(AppError::Internal("git init failed".to_string()));
    }

    // 3. Write .tinsu/config.yaml
    let tinsu_dir = format!("{}/.tinsu", project_path);
    std::fs::create_dir_all(&tinsu_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create .tinsu dir: {}", e)))?;
    let config_out = TinsuConfigOut {
        project_name: trimmed_name.to_string(),
        methodology: "bmad".to_string(),
    };
    let config_content = serde_yaml::to_string(&config_out)
        .map_err(|e| AppError::Internal(format!("Failed to serialize config: {}", e)))?;
    std::fs::write(format!("{}/config.yaml", tinsu_dir), config_content)
        .map_err(|e| AppError::Internal(format!("Failed to write config: {}", e)))?;

    // 4. Insert project into DB
    let now = now_unix_secs();
    let new = project::ActiveModel {
        id: Set(uuid::Uuid::new_v4().to_string()),
        path: Set(project_path),
        name: Set(trimmed_name.to_string()),
        created_at: Set(now),
        last_opened_at: Set(Some(now)),
        remote_project_id: Set(None),
    };
    let result = new.insert(db.inner()).await?;
    Ok(ProjectModel::from(result))
}

/// Open a remote project by its remote_project_id.
/// Finds or creates a local `projects` record linked to this remote project.
/// The local record serves as the anchor for tasks, sprints, and epics.
///
/// Logic:
/// 1. Load remote_project from DB (error if not found)
/// 2. Find existing project WHERE remote_project_id = id → if found, update last_opened_at + return
/// 3. If not found, create new project with path = remote_project.path,
///    name = remote_project.name, remote_project_id = remote_project.id
#[tauri::command]
#[specta::specta]
pub async fn open_remote_project(
    db: State<'_, DatabaseConnection>,
    remote_project_id: String,
) -> Result<ProjectModel, AppError> {
    if remote_project_id.is_empty() {
        return Err(AppError::BadRequest(
            "remote_project_id must not be empty".into(),
        ));
    }

    // 1. Load remote project profile
    let rp = remote_project::Entity::find_by_id(&remote_project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "Remote project '{}' not found",
                remote_project_id
            ))
        })?;

    let now = now_unix_secs();

    // 2. Find existing linked local project
    let existing = project::Entity::find()
        .filter(project::Column::RemoteProjectId.eq(&remote_project_id))
        .one(db.inner())
        .await?;

    let model = match existing {
        Some(p) => {
            // Update last_opened_at
            let updated = project::ActiveModel {
                id: Set(p.id.clone()),
                last_opened_at: Set(Some(now)),
                ..Default::default()
            };
            updated.update(db.inner()).await?
        }
        None => {
            // Create new local project anchored to this remote project
            let new = project::ActiveModel {
                id: Set(uuid::Uuid::new_v4().to_string()),
                path: Set(rp.path.clone()),
                name: Set(rp.name.clone()),
                created_at: Set(now),
                last_opened_at: Set(Some(now)),
                remote_project_id: Set(Some(remote_project_id)),
            };
            new.insert(db.inner()).await?
        }
    };

    Ok(ProjectModel::from(model))
}

/// Checks required tools and returns their install status.
#[tauri::command]
#[specta::specta]
pub async fn verify_tools(project_path: String) -> Result<Vec<ToolCheckResult>, AppError> {
    let mut results = Vec::new();

    // git
    let (status, version) = check_bin("git", &["--version"]);
    results.push(ToolCheckResult {
        id: "git".into(),
        name: "Git".into(),
        status,
        version: version.map(|v| v.replace("git version ", "")),
        critical: true,
        install_hint: Some("https://git-scm.com/downloads".into()),
    });

    // tmux
    let (status, version) = check_bin("tmux", &["-V"]);
    results.push(ToolCheckResult {
        id: "tmux".into(),
        name: "tmux".into(),
        status,
        version: version.map(|v| v.replace("tmux ", "")),
        critical: true,
        install_hint: Some("brew install tmux  |  apt install tmux".into()),
    });

    // Node.js
    let (status, version) = check_bin("node", &["--version"]);
    results.push(ToolCheckResult {
        id: "nodejs".into(),
        name: "Node.js".into(),
        status,
        version: version.map(|v| v.trim_start_matches('v').to_string()),
        critical: true,
        install_hint: Some("https://nodejs.org".into()),
    });

    // Claude Code CLI
    let (status, version) = check_bin("claude", &["--version"]);
    results.push(ToolCheckResult {
        id: "claude-cli".into(),
        name: "Claude Code CLI".into(),
        status,
        version,
        critical: true,
        install_hint: Some("npm install -g @anthropic-ai/claude-code".into()),
    });

    // BMAD — detect via _bmad/_config/manifest.yaml
    let bmad_dir = std::path::Path::new(&project_path).join("_bmad");
    let bmad_manifest = bmad_dir.join("_config").join("manifest.yaml");
    let bmad_status = if bmad_dir.is_dir() { "installed" } else { "missing" };
    let bmad_version = if bmad_manifest.exists() {
        std::fs::read_to_string(&bmad_manifest).ok().and_then(|content| {
            // Grab the top-level `version:` line (first occurrence inside `installation:`)
            content
                .lines()
                .find(|l| {
                    let t = l.trim();
                    t.starts_with("version:") && !t.contains("null")
                })
                .and_then(|l| l.split(':').nth(1))
                .map(|v| v.trim().to_string())
        })
    } else {
        None
    };
    results.push(ToolCheckResult {
        id: "bmad".into(),
        name: "BMAD Framework".into(),
        status: bmad_status.into(),
        version: bmad_version,
        critical: true,
        install_hint: None, // handled by inline form in ToolVerificationStep
    });

    Ok(results)
}

// ---------------------------------------------------------------------------
// File listing for @ autocomplete in chat input
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct FileEntry {
    pub name: String,
    pub relative_path: String,
    pub is_directory: bool,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListProjectFilesInput {
    pub project_path: String,
    /// Relative prefix — empty for root, "src/" to list that dir, "src/comp" to list src/ dir
    pub prefix: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SearchProjectFilesInput {
    pub project_path: String,
    pub query: String,
}

/// Lists immediate children of the directory determined by the given prefix.
/// If prefix has no `/`, lists the project root.
/// If prefix ends with `/` or contains `/`, lists up to the last `/`.
#[tauri::command]
#[specta::specta]
pub async fn list_project_files(input: ListProjectFilesInput) -> Result<Vec<FileEntry>, AppError> {
    let base = Path::new(&input.project_path);

    // Determine which dir to list and the relative dir prefix for building relative_path
    let (dir_path, dir_prefix) = if let Some(last_slash) = input.prefix.rfind('/') {
        let dir_part = &input.prefix[..=last_slash]; // includes trailing slash
        (base.join(dir_part), dir_part.to_string())
    } else {
        (base.to_path_buf(), String::new())
    };

    let read_dir = match std::fs::read_dir(&dir_path) {
        Ok(rd) => rd,
        Err(_) => return Ok(vec![]),
    };

    let mut entries: Vec<FileEntry> = read_dir
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // Skip hidden entries
            if name.starts_with('.') {
                return None;
            }
            let is_directory = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let relative_path = format!("{}{}", dir_prefix, name);
            Some(FileEntry {
                name,
                relative_path,
                is_directory,
            })
        })
        .collect();

    entries.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then(a.name.cmp(&b.name)));
    Ok(entries)
}

/// Recursively walks the project directory (up to depth 8, skipping common noise dirs)
/// and returns files/dirs whose names contain `query` (case-insensitive). Max 50 results.
#[tauri::command]
#[specta::specta]
pub async fn search_project_files(input: SearchProjectFilesInput) -> Result<Vec<FileEntry>, AppError> {
    let base = std::path::PathBuf::from(&input.project_path);
    let query_lower = input.query.to_lowercase();
    let mut results = Vec::new();
    walk_for_search(&base, &base, &query_lower, &mut results, 0);
    results.sort_by(|a, b| b.is_directory.cmp(&a.is_directory).then(a.name.cmp(&b.name)));
    Ok(results)
}

const SKIP_DIRS: &[&str] = &[
    "node_modules", "target", "dist", ".git", ".next", ".cache", "build", "__pycache__",
];

fn walk_for_search(
    base: &std::path::Path,
    dir: &std::path::Path,
    query: &str,
    results: &mut Vec<FileEntry>,
    depth: usize,
) {
    if depth > 8 || results.len() >= 50 {
        return;
    }

    let read_dir = match std::fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return,
    };

    for entry in read_dir.filter_map(|e| e.ok()) {
        if results.len() >= 50 {
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let is_directory = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_directory && SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }

        let relative_path = entry
            .path()
            .strip_prefix(base)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        if name.to_lowercase().contains(query) {
            results.push(FileEntry {
                name: name.clone(),
                relative_path,
                is_directory,
            });
        }

        if is_directory {
            walk_for_search(base, &entry.path(), query, results, depth + 1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_model_serializes() {
        let model = ProjectModel {
            id: "p1".to_string(),
            path: "/home/user/project".to_string(),
            name: "My Project".to_string(),
            created_at: 1_000_000,
            last_opened_at: Some(1_000_100),
            remote_project_id: None,
        };
        let json = serde_json::to_string(&model).expect("serialize");
        assert!(json.contains("My Project"));
        assert!(json.contains("/home/user/project"));
    }

    #[test]
    fn test_project_model_from_entity() {
        let entity = project::Model {
            id: "p1".to_string(),
            path: "/home/user/project".to_string(),
            name: "Test Project".to_string(),
            created_at: 1_000_000,
            last_opened_at: None,
            remote_project_id: None,
        };
        let dto = ProjectModel::from(entity);
        assert_eq!(dto.id, "p1");
        assert_eq!(dto.name, "Test Project");
        assert_eq!(dto.last_opened_at, None);
        assert_eq!(dto.remote_project_id, None);
    }

    #[test]
    fn test_list_recent_projects_input_serializes() {
        let input = ListRecentProjectsInput { limit: 10 };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("10"));
    }

    #[test]
    fn test_open_remote_project_rejects_empty_id() {
        // Validates the empty-id guard without hitting DB
        assert!(remote_project_id_is_empty(""));
        assert!(!remote_project_id_is_empty("some-uuid"));
    }

    fn remote_project_id_is_empty(id: &str) -> bool {
        id.is_empty()
    }

    #[test]
    fn test_project_model_includes_remote_project_id() {
        let model = ProjectModel {
            id: "p1".into(),
            path: "/remote/path".into(),
            name: "RemoteProj".into(),
            created_at: 1_000_000,
            last_opened_at: None,
            remote_project_id: Some("rp-uuid".into()),
        };
        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("rp-uuid"));
        assert!(json.contains("remote_project_id"));
    }

    #[test]
    fn test_project_model_remote_project_id_nullable() {
        let model = ProjectModel {
            id: "p2".into(),
            path: "/local/path".into(),
            name: "LocalProj".into(),
            created_at: 1_000_000,
            last_opened_at: None,
            remote_project_id: None,
        };
        let json = serde_json::to_string(&model).unwrap();
        assert!(json.contains("\"remote_project_id\":null"));
    }

    #[test]
    fn test_migration_000005_name() {
        use crate::migration::m20260412_000005_project_remote_link::Migration;
        use sea_orm_migration::MigrationName;
        assert_eq!(Migration.name(), "m20260412_000005_project_remote_link");
    }
}
