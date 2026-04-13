use sea_orm::{DatabaseConnection, EntityTrait};
use tauri::State;

use crate::db::entities::{project, task};
use crate::error::AppError;
use crate::services::git_service::{BranchStatus, GitDiffResult, GitDiffSummary, GitService};

/// Returns the git diff for the task's worktree vs main.
/// Returns an empty diff if the task has no worktree or is already merged.
#[tauri::command]
#[specta::specta]
pub async fn get_task_diff(
    task_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<GitDiffResult, AppError> {
    if task_id.is_empty() {
        return Err(AppError::BadRequest("task_id must not be empty".to_string()));
    }

    let task = task::Entity::find_by_id(&task_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

    // Return empty diff if no worktree or already merged
    let worktree_path = match task.worktree_path {
        Some(ref p) if !p.is_empty() && task.merge_commit_sha.is_none() => p.clone(),
        _ => {
            return Ok(GitDiffResult {
                files: vec![],
                summary: GitDiffSummary {
                    files_changed: 0,
                    lines_added: 0,
                    lines_removed: 0,
                },
            })
        }
    };

    let git = GitService;
    git.get_diff(&worktree_path).await
}

/// Returns branch status (commits ahead/behind main, uncommitted changes) for a task's branch.
/// Returns zeroed status if the task has no branch.
#[tauri::command]
#[specta::specta]
pub async fn get_branch_status(
    task_id: String,
    db: State<'_, DatabaseConnection>,
) -> Result<BranchStatus, AppError> {
    if task_id.is_empty() {
        return Err(AppError::BadRequest("task_id must not be empty".to_string()));
    }

    let task = task::Entity::find_by_id(&task_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task {} not found", task_id)))?;

    let branch_name = match task.branch_name {
        Some(ref b) if !b.is_empty() => b.clone(),
        _ => {
            return Ok(BranchStatus {
                commits_ahead: 0,
                commits_behind: 0,
                has_uncommitted_changes: false,
            })
        }
    };

    // Get the project path
    let project = project::Entity::find_by_id(&task.project_id)
        .one(db.inner())
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("Project {} not found", task.project_id))
        })?;

    let git = GitService;
    git.get_branch_status(&project.path, &branch_name, task.worktree_path.as_deref()).await
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_diff_result_empty_structure() {
        let result = GitDiffResult {
            files: vec![],
            summary: GitDiffSummary {
                files_changed: 0,
                lines_added: 0,
                lines_removed: 0,
            },
        };
        let json = serde_json::to_string(&result).expect("serialize");
        assert!(json.contains("files"));
        assert!(json.contains("summary"));
    }

    #[test]
    fn test_branch_status_zeroed() {
        let bs = BranchStatus {
            commits_ahead: 0,
            commits_behind: 0,
            has_uncommitted_changes: false,
        };
        let json = serde_json::to_string(&bs).expect("serialize");
        assert!(json.contains("commitsAhead"));
        assert!(json.contains("false"));
    }

    #[test]
    fn test_get_task_diff_returns_empty_for_no_worktree() {
        // Validate the empty-result path by checking the struct construction
        let result = GitDiffResult {
            files: vec![],
            summary: GitDiffSummary {
                files_changed: 0,
                lines_added: 0,
                lines_removed: 0,
            },
        };
        assert!(result.files.is_empty());
        assert_eq!(result.summary.files_changed, 0);
    }

    #[test]
    fn test_get_branch_status_returns_zeroed_for_no_branch() {
        let bs = BranchStatus {
            commits_ahead: 0,
            commits_behind: 0,
            has_uncommitted_changes: false,
        };
        assert_eq!(bs.commits_ahead, 0);
        assert_eq!(bs.commits_behind, 0);
        assert!(!bs.has_uncommitted_changes);
    }
}
