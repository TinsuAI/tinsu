use crate::db::entities::{gate_decision, planning_artifact_status, project, workflow_run};
use crate::error::AppError;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use sea_orm::sea_query::OnConflict;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;

// ─── Helpers ───────────────────────────────────────────────────────────────

fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ─── Artifact Pattern Lookup ───────────────────────────────────────────────

/// Artifact file lookup result: (prefix, suffix, is_glob, subdir)
/// For exact files: prefix = filename, suffix = "", is_glob = false
/// For glob patterns: prefix = start pattern, suffix = end pattern, is_glob = true
struct ArtifactPattern {
    prefix: &'static str,
    suffix: &'static str,
    is_glob: bool,
    /// subdirectory within planning-artifacts (empty string = root)
    subdir: &'static str,
}

fn get_artifact_pattern(workflow_key: &str) -> Option<ArtifactPattern> {
    match workflow_key {
        "brainstorming" => Some(ArtifactPattern {
            prefix: "brainstorming-session-",
            suffix: ".md",
            is_glob: true,
            subdir: "brainstorming",
        }),
        "market-research" => Some(ArtifactPattern {
            prefix: "market-",
            suffix: ".md",
            is_glob: true,
            subdir: "research",
        }),
        "domain-research" => Some(ArtifactPattern {
            prefix: "domain-",
            suffix: ".md",
            is_glob: true,
            subdir: "research",
        }),
        "product-brief" => Some(ArtifactPattern {
            prefix: "product-brief-",
            suffix: ".md",
            is_glob: true,
            subdir: "",
        }),
        "prd" => Some(ArtifactPattern {
            prefix: "prd.md",
            suffix: "",
            is_glob: false,
            subdir: "",
        }),
        "growth-review" => Some(ArtifactPattern {
            prefix: "growth-hacking-review.md",
            suffix: "",
            is_glob: false,
            subdir: "",
        }),
        "ux-design" => Some(ArtifactPattern {
            prefix: "ux-design-specification.md",
            suffix: "",
            is_glob: false,
            subdir: "",
        }),
        "architecture" => Some(ArtifactPattern {
            prefix: "architecture.md",
            suffix: "",
            is_glob: false,
            subdir: "",
        }),
        "epics-stories" => Some(ArtifactPattern {
            prefix: "epics.md",
            suffix: "",
            is_glob: false,
            subdir: "",
        }),
        "readiness-check" => Some(ArtifactPattern {
            prefix: "implementation-readiness-report-",
            suffix: ".md",
            is_glob: true,
            subdir: "",
        }),
        _ => None,
    }
}

/// All known workflow keys (used for approve_for_implementation)
static KNOWN_WORKFLOW_KEYS: &[&str] = &[
    "brainstorming",
    "market-research",
    "domain-research",
    "product-brief",
    "prd",
    "growth-review",
    "ux-design",
    "architecture",
    "epics-stories",
    "readiness-check",
];

// ─── DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ArtifactScanResult {
    pub workflow_key: String,
    pub exists: bool,
    pub filename: Option<String>,
    pub last_modified: Option<i64>,
    pub size_bytes: Option<i64>,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ArtifactContentResult {
    pub content: String,
    pub file_path: String,
    pub last_modified: i64,
    pub size_bytes: i64,
    pub word_count: i64,
    pub workflow_key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct WorkflowRunModel {
    pub id: String,
    pub project_id: String,
    pub workflow_key: String,
    pub phase: Option<String>,
    pub status: String,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub input_artifacts: Option<Vec<String>>,
    pub output_artifacts: Option<Vec<String>>,
    pub agent_name: Option<String>,
    pub task_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GateIssue {
    pub severity: String,
    pub description: String,
    pub artifact_key: Option<String>,
    pub section_ref: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct GateDecisionModel {
    pub id: String,
    pub project_id: String,
    pub decision: String,
    pub rationale: Option<String>,
    pub issues: Option<Vec<GateIssue>>,
    pub created_at: i64,
    pub workflow_run_id: Option<String>,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/// Find a file in `dir` where the filename contains both `prefix` at start and `suffix` somewhere.
/// Returns the most recently modified matching path.
async fn find_file_with_prefix_suffix(dir: &Path, prefix: &str, suffix: &str) -> Option<PathBuf> {
    let mut entries = tokio::fs::read_dir(dir).await.ok()?;
    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        let matches = if suffix.is_empty() {
            name.starts_with(prefix)
        } else {
            name.starts_with(prefix) && name.ends_with(suffix)
        };
        if matches {
            if let Ok(meta) = entry.metadata().await {
                let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                if best.as_ref().map_or(true, |(_, t)| &modified > t) {
                    best = Some((entry.path(), modified));
                }
            }
        }
    }
    best.map(|(p, _)| p)
}

/// Resolve actual path of artifact for a project.
pub async fn resolve_artifact_path(project_path: &str, workflow_key: &str) -> Option<PathBuf> {
    let pattern = get_artifact_pattern(workflow_key)?;
    let base = PathBuf::from(project_path)
        .join("_bmad-output")
        .join("planning-artifacts");
    let dir = if pattern.subdir.is_empty() {
        base.clone()
    } else {
        base.join(pattern.subdir)
    };

    if pattern.is_glob {
        find_file_with_prefix_suffix(&dir, pattern.prefix, pattern.suffix).await
    } else {
        let path = dir.join(pattern.prefix);
        if path.exists() { Some(path) } else { None }
    }
}

fn model_to_workflow_run(m: workflow_run::Model) -> WorkflowRunModel {
    let input_artifacts = m.input_artifacts.as_deref()
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());
    let output_artifacts = m.output_artifacts.as_deref()
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok());

    WorkflowRunModel {
        id: m.id,
        project_id: m.project_id,
        workflow_key: m.workflow_key,
        phase: m.phase,
        status: m.status,
        started_at: m.started_at,
        finished_at: m.finished_at,
        input_artifacts,
        output_artifacts,
        agent_name: m.agent_name,
        task_id: m.task_id,
    }
}

fn model_to_gate_decision(m: gate_decision::Model) -> GateDecisionModel {
    let issues = m.issues.as_deref()
        .and_then(|s| serde_json::from_str::<Vec<GateIssue>>(s).ok());

    GateDecisionModel {
        id: m.id,
        project_id: m.project_id,
        decision: m.decision,
        rationale: m.rationale,
        issues,
        created_at: m.created_at,
        workflow_run_id: m.workflow_run_id,
    }
}

// ─── Commands ──────────────────────────────────────────────────────────────

/// Scan all known BMAD planning artifacts for a project.
#[tauri::command]
#[specta::specta]
pub async fn scan_artifacts(
    project_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<ArtifactScanResult>, AppError> {
    let project = project::Entity::find_by_id(&project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {}", project_id)))?;

    // Load all stored statuses for this project
    let stored_statuses = planning_artifact_status::Entity::find()
        .filter(planning_artifact_status::Column::ProjectId.eq(&project_id))
        .all(db.inner())
        .await?;
    let status_map: HashMap<String, String> = stored_statuses
        .into_iter()
        .map(|s| (s.artifact_key, s.status))
        .collect();

    let mut results = Vec::with_capacity(KNOWN_WORKFLOW_KEYS.len());

    for &key in KNOWN_WORKFLOW_KEYS {
        let resolved = resolve_artifact_path(&project.path, key).await;

        let (exists, filename, last_modified, size_bytes) = if let Some(ref path) = resolved {
            let meta = tokio::fs::metadata(path).await.ok();
            let lm = meta.as_ref().and_then(|m| {
                m.modified().ok().map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0)
                })
            });
            let sz = meta.as_ref().map(|m| m.len() as i64);
            let fname = path.file_name().map(|n| n.to_string_lossy().to_string());
            (true, fname, lm, sz)
        } else {
            (false, None, None, None)
        };

        let status = if !exists {
            "missing".to_string()
        } else {
            status_map.get(key).cloned().unwrap_or_else(|| "draft".to_string())
        };

        results.push(ArtifactScanResult {
            workflow_key: key.to_string(),
            exists,
            filename,
            last_modified,
            size_bytes,
            status,
        });
    }

    Ok(results)
}

/// Get the markdown content of an artifact.
#[tauri::command]
#[specta::specta]
pub async fn get_artifact_content(
    project_id: String,
    workflow_key: String,
    db: State<'_, DatabaseConnection>,
) -> Result<ArtifactContentResult, AppError> {
    let project = project::Entity::find_by_id(&project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {}", project_id)))?;

    let path = resolve_artifact_path(&project.path, &workflow_key)
        .await
        .ok_or_else(|| AppError::NotFound(format!("artifact not found: {}", workflow_key)))?;

    let content = tokio::fs::read_to_string(&path).await?;
    let meta = tokio::fs::metadata(&path).await?;

    let last_modified = meta.modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);
    let size_bytes = meta.len() as i64;
    let word_count = content.split_whitespace().count() as i64;
    let file_path = path.to_string_lossy().to_string();

    Ok(ArtifactContentResult {
        content,
        file_path,
        last_modified,
        size_bytes,
        word_count,
        workflow_key,
    })
}

/// Update the stored status for an artifact.
#[tauri::command]
#[specta::specta]
pub async fn update_artifact_status(
    project_id: String,
    artifact_key: String,
    status: String,
    db: State<'_, DatabaseConnection>,
) -> Result<(), AppError> {
    // Validate status
    match status.as_str() {
        "draft" | "in-review" | "approved" => {}
        _ => {
            return Err(AppError::BadRequest(format!(
                "invalid status '{}': must be draft, in-review, or approved",
                status
            )))
        }
    }

    let now = now_unix_ms();
    let new_row = planning_artifact_status::ActiveModel {
        id: Set(Uuid::new_v4().to_string()),
        project_id: Set(project_id.clone()),
        artifact_key: Set(artifact_key.clone()),
        status: Set(status.clone()),
        updated_at: Set(now),
    };

    planning_artifact_status::Entity::insert(new_row)
        .on_conflict(
            OnConflict::columns([
                planning_artifact_status::Column::ProjectId,
                planning_artifact_status::Column::ArtifactKey,
            ])
            .update_columns([
                planning_artifact_status::Column::Status,
                planning_artifact_status::Column::UpdatedAt,
            ])
            .to_owned(),
        )
        .exec(db.inner())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

/// Create a new workflow run record.
#[tauri::command]
#[specta::specta]
pub async fn create_workflow_run(
    project_id: String,
    workflow_key: String,
    phase: Option<String>,
    agent_name: Option<String>,
    task_id: Option<String>,
    input_artifacts: Option<Vec<String>>,
    db: State<'_, DatabaseConnection>,
) -> Result<WorkflowRunModel, AppError> {
    if !KNOWN_WORKFLOW_KEYS.contains(&workflow_key.as_str()) {
        return Err(AppError::BadRequest(format!("unknown workflow_key: {}", workflow_key)));
    }

    let now = now_unix_ms();
    let id = Uuid::new_v4().to_string();
    let input_json = input_artifacts
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    let new_row = workflow_run::ActiveModel {
        id: Set(id.clone()),
        project_id: Set(project_id.clone()),
        workflow_key: Set(workflow_key),
        phase: Set(phase),
        status: Set("running".to_string()),
        started_at: Set(Some(now)),
        finished_at: Set(None),
        input_artifacts: Set(input_json),
        output_artifacts: Set(None),
        agent_name: Set(agent_name),
        task_id: Set(task_id),
    };

    let row = new_row.insert(db.inner()).await?;
    Ok(model_to_workflow_run(row))
}

/// Update a workflow run's status (and optionally output artifacts).
#[tauri::command]
#[specta::specta]
pub async fn update_workflow_run(
    run_id: String,
    status: String,
    output_artifacts: Option<Vec<String>>,
    db: State<'_, DatabaseConnection>,
) -> Result<WorkflowRunModel, AppError> {
    let terminal_statuses = ["succeeded", "failed", "cancelled"];
    let finished_at = if terminal_statuses.contains(&status.as_str()) {
        Some(now_unix_ms())
    } else {
        None
    };

    let output_json = output_artifacts
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    let updated = workflow_run::ActiveModel {
        id: Set(run_id),
        status: Set(status),
        finished_at: Set(finished_at),
        output_artifacts: Set(output_json),
        ..Default::default()
    };

    let row = updated.update(db.inner()).await?;
    Ok(model_to_workflow_run(row))
}

/// List workflow runs for a project (ordered by started_at DESC).
#[tauri::command]
#[specta::specta]
pub async fn list_workflow_runs(
    project_id: String,
    limit: Option<u64>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<WorkflowRunModel>, AppError> {
    let limit = limit.unwrap_or(20).min(100);

    let rows = workflow_run::Entity::find()
        .filter(workflow_run::Column::ProjectId.eq(&project_id))
        .order_by_desc(workflow_run::Column::StartedAt)
        .limit(limit)
        .all(db.inner())
        .await?;

    Ok(rows.into_iter().map(model_to_workflow_run).collect())
}

/// Get the currently active workflow run for a project (status running or needs-input).
#[tauri::command]
#[specta::specta]
pub async fn get_active_workflow_run(
    project_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Option<WorkflowRunModel>, AppError> {
    let row = workflow_run::Entity::find()
        .filter(workflow_run::Column::ProjectId.eq(&project_id))
        .filter(
            workflow_run::Column::Status.is_in(["running".to_string(), "needs-input".to_string()]),
        )
        .order_by_desc(workflow_run::Column::StartedAt)
        .limit(1)
        .one(db.inner())
        .await?;

    Ok(row.map(model_to_workflow_run))
}

/// Parse a readiness report file and save as a gate_decision record.
#[tauri::command]
#[specta::specta]
pub async fn parse_and_save_gate_result(
    project_id: String,
    workflow_run_id: Option<String>,
    db: State<'_, DatabaseConnection>,
) -> Result<GateDecisionModel, AppError> {
    let project = project::Entity::find_by_id(&project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("project not found: {}", project_id)))?;

    let base = PathBuf::from(&project.path)
        .join("_bmad-output")
        .join("planning-artifacts");

    // Try exact path first, then glob
    let exact = base.join("readiness-check.md");
    let report_path = if exact.exists() {
        exact
    } else {
        find_file_with_prefix_suffix(
            &base,
            "implementation-readiness-report-",
            ".md",
        )
        .await
        .ok_or_else(|| AppError::NotFound("No readiness report found".to_string()))?
    };

    let content = tokio::fs::read_to_string(&report_path).await?;
    let (decision, rationale, issues) = parse_gate_result_from_content(&content);

    let now = now_unix_ms();
    let id = Uuid::new_v4().to_string();
    let issues_json = serde_json::to_string(&issues).ok();

    let new_row = gate_decision::ActiveModel {
        id: Set(id.clone()),
        project_id: Set(project_id.clone()),
        decision: Set(decision),
        rationale: Set(rationale),
        issues: Set(issues_json),
        created_at: Set(now),
        workflow_run_id: Set(workflow_run_id),
    };

    let row = new_row.insert(db.inner()).await?;
    Ok(model_to_gate_decision(row))
}

/// Parse gate result from markdown content (extracted for unit testing).
pub fn parse_gate_result_from_content(content: &str) -> (String, Option<String>, Vec<GateIssue>) {
    let search_area = &content[..content.len().min(2000)];
    let lower = search_area.to_lowercase();

    let decision = if lower.contains("not ready") {
        "fail".to_string()
    } else if lower.contains("needs work") {
        "concerns".to_string()
    } else if lower.contains("ready") {
        "pass".to_string()
    } else {
        "concerns".to_string()
    };

    // Extract rationale from "Summary and Recommendations" section
    let rationale = extract_section(content, "Summary and Recommendations", 500);

    // Extract issues from emoji markers
    let mut issues = Vec::new();
    for line in content.lines() {
        let severity = if line.contains('🔴') {
            Some("critical")
        } else if line.contains('🟠') {
            Some("major")
        } else if line.contains('🟡') {
            Some("minor")
        } else {
            None
        };

        if let Some(sev) = severity {
            let description = line
                .trim_start_matches(|c: char| !c.is_alphanumeric() && c != '-')
                .trim()
                .to_string();
            if !description.is_empty() {
                issues.push(GateIssue {
                    severity: sev.to_string(),
                    description,
                    artifact_key: None,
                    section_ref: None,
                });
            }
        }
    }

    (decision, rationale, issues)
}

fn extract_section(content: &str, heading: &str, max_chars: usize) -> Option<String> {
    let lower = content.to_lowercase();
    let heading_lower = heading.to_lowercase();
    let pos = lower.find(&heading_lower)?;
    let after = &content[pos..];
    // Find end of section (next heading or EOF)
    let text = after.lines().skip(1)
        .take_while(|line| !line.starts_with('#'))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    if text.is_empty() {
        None
    } else {
        Some(text[..text.len().min(max_chars)].to_string())
    }
}

/// Get the most recent gate decision for a project.
#[tauri::command]
#[specta::specta]
pub async fn get_latest_gate_decision(
    project_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<Option<GateDecisionModel>, AppError> {
    let row = gate_decision::Entity::find()
        .filter(gate_decision::Column::ProjectId.eq(&project_id))
        .order_by_desc(gate_decision::Column::CreatedAt)
        .limit(1)
        .one(db.inner())
        .await?;

    Ok(row.map(model_to_gate_decision))
}

/// List gate decisions for a project (ordered by created_at DESC).
#[tauri::command]
#[specta::specta]
pub async fn list_gate_decisions(
    project_id: String,
    limit: Option<u64>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<GateDecisionModel>, AppError> {
    let limit = limit.unwrap_or(10).min(50);

    let rows = gate_decision::Entity::find()
        .filter(gate_decision::Column::ProjectId.eq(&project_id))
        .order_by_desc(gate_decision::Column::CreatedAt)
        .limit(limit)
        .all(db.inner())
        .await?;

    Ok(rows.into_iter().map(model_to_gate_decision).collect())
}

/// Approve all artifacts for implementation (requires latest gate decision = pass).
#[tauri::command]
#[specta::specta]
pub async fn approve_for_implementation(
    project_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<i64, AppError> {
    // Check latest gate decision is pass
    let latest = gate_decision::Entity::find()
        .filter(gate_decision::Column::ProjectId.eq(&project_id))
        .order_by_desc(gate_decision::Column::CreatedAt)
        .limit(1)
        .one(db.inner())
        .await?;

    match latest {
        Some(gd) if gd.decision == "pass" => {}
        Some(_) => {
            return Err(AppError::BadRequest(
                "No passing gate decision found".to_string(),
            ))
        }
        None => {
            return Err(AppError::BadRequest(
                "No passing gate decision found".to_string(),
            ))
        }
    }

    let now = now_unix_ms();
    let mut count = 0i64;

    for &key in KNOWN_WORKFLOW_KEYS {
        let new_row = planning_artifact_status::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            project_id: Set(project_id.clone()),
            artifact_key: Set(key.to_string()),
            status: Set("approved".to_string()),
            updated_at: Set(now),
        };

        planning_artifact_status::Entity::insert(new_row)
            .on_conflict(
                OnConflict::columns([
                    planning_artifact_status::Column::ProjectId,
                    planning_artifact_status::Column::ArtifactKey,
                ])
                .update_columns([
                    planning_artifact_status::Column::Status,
                    planning_artifact_status::Column::UpdatedAt,
                ])
                .to_owned(),
            )
            .exec(db.inner())
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        count += 1;
    }

    Ok(count)
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── resolve_artifact_path tests ──────────────────────────────────────

    #[tokio::test]
    async fn test_resolve_artifact_path_exact_finds_file() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("_bmad-output").join("planning-artifacts");
        std::fs::create_dir_all(&base).unwrap();
        std::fs::write(base.join("prd.md"), "content").unwrap();

        let result = resolve_artifact_path(dir.path().to_str().unwrap(), "prd").await;
        assert!(result.is_some());
        assert_eq!(result.unwrap().file_name().unwrap(), "prd.md");
    }

    #[tokio::test]
    async fn test_resolve_artifact_path_returns_none_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("_bmad-output").join("planning-artifacts");
        std::fs::create_dir_all(&base).unwrap();

        let result = resolve_artifact_path(dir.path().to_str().unwrap(), "prd").await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_resolve_artifact_path_glob_finds_file() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().join("_bmad-output").join("planning-artifacts");
        std::fs::create_dir_all(&base).unwrap();
        std::fs::write(
            base.join("implementation-readiness-report-2024-01-01.md"),
            "READY",
        )
        .unwrap();

        let result = resolve_artifact_path(dir.path().to_str().unwrap(), "readiness-check").await;
        assert!(result.is_some());
    }

    // ── parse_gate_result_from_content tests ───────────────────────────

    #[test]
    fn test_parse_gate_result_parses_ready_as_pass() {
        let content = "## Overall Readiness Status\nREADY for implementation.\n";
        let (decision, _, _) = parse_gate_result_from_content(content);
        assert_eq!(decision, "pass");
    }

    #[test]
    fn test_parse_gate_result_parses_not_ready_as_fail() {
        let content = "## Overall Readiness Status\nNOT READY - critical issues found.\n";
        let (decision, _, _) = parse_gate_result_from_content(content);
        assert_eq!(decision, "fail");
    }

    #[test]
    fn test_parse_gate_result_parses_needs_work_as_concerns() {
        let content = "## Overall Readiness Status\nNEEDS WORK before proceeding.\n";
        let (decision, _, _) = parse_gate_result_from_content(content);
        assert_eq!(decision, "concerns");
    }

    #[test]
    fn test_parse_gate_result_extracts_critical_issues() {
        let content = "## Issues\n🔴 Missing authentication module\n🟡 Minor formatting issue\n";
        let (_, _, issues) = parse_gate_result_from_content(content);
        let criticals: Vec<_> = issues.iter().filter(|i| i.severity == "critical").collect();
        assert!(!criticals.is_empty());
        assert!(criticals[0].description.contains("Missing authentication"));
    }

    #[test]
    fn test_parse_gate_result_extracts_minor_issues() {
        let content = "## Issues\n🟡 Minor formatting inconsistency\n";
        let (_, _, issues) = parse_gate_result_from_content(content);
        let minors: Vec<_> = issues.iter().filter(|i| i.severity == "minor").collect();
        assert!(!minors.is_empty());
    }

    // ── scan_artifacts workflow key coverage ────────────────────────────

    #[test]
    fn test_known_workflow_keys_contains_all_10() {
        assert_eq!(KNOWN_WORKFLOW_KEYS.len(), 10);
        assert!(KNOWN_WORKFLOW_KEYS.contains(&"brainstorming"));
        assert!(KNOWN_WORKFLOW_KEYS.contains(&"prd"));
        assert!(KNOWN_WORKFLOW_KEYS.contains(&"readiness-check"));
    }

    // ── DTO serialization tests ─────────────────────────────────────────

    #[test]
    fn test_artifact_scan_result_serializes() {
        let r = ArtifactScanResult {
            workflow_key: "prd".to_string(),
            exists: true,
            filename: Some("prd.md".to_string()),
            last_modified: Some(1000),
            size_bytes: Some(500),
            status: "approved".to_string(),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"workflow_key\":\"prd\""));
        assert!(json.contains("\"status\":\"approved\""));
    }

    #[test]
    fn test_gate_issue_serializes() {
        let issue = GateIssue {
            severity: "critical".to_string(),
            description: "Missing auth".to_string(),
            artifact_key: None,
            section_ref: None,
        };
        let json = serde_json::to_string(&issue).unwrap();
        assert!(json.contains("\"severity\":\"critical\""));
    }

    #[test]
    fn test_workflow_run_model_parses_artifacts() {
        let m = workflow_run::Model {
            id: "run-1".to_string(),
            project_id: "proj-1".to_string(),
            workflow_key: "prd".to_string(),
            phase: Some("planning".to_string()),
            status: "succeeded".to_string(),
            started_at: Some(1000),
            finished_at: Some(2000),
            input_artifacts: Some(r#"["prd.md"]"#.to_string()),
            output_artifacts: Some(r#"["arch.md"]"#.to_string()),
            agent_name: None,
            task_id: None,
        };
        let dto = model_to_workflow_run(m);
        assert_eq!(dto.input_artifacts, Some(vec!["prd.md".to_string()]));
        assert_eq!(dto.output_artifacts, Some(vec!["arch.md".to_string()]));
    }
}
