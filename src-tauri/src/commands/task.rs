use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, DbBackend, EntityTrait,
    ModelTrait, QueryFilter, QueryOrder, Set, Statement, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::db::entities::{project, task};
use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::services::git_service::GitService;
use crate::sync;

const DEFAULT_TASK_STATUS: &str = "backlog";
const DEFAULT_TASK_TYPE: &str = "basic";

const VALID_TASK_STATUSES: &[&str] = &[
    "backlog",
    "create_story",
    "in_progress",
    "review",
    "done",
];

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GetTaskInput {
    pub id: String,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateTaskInput {
    pub title: String,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListTasksInput {
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateTaskStatusInput {
    pub id: String,
    pub status: String,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ReorderTasksInput {
    pub task_ids: Vec<String>,
    pub status: String,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct DeleteTaskInput {
    pub id: String,
    pub project_id: String,
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

#[tauri::command]
#[specta::specta]
pub async fn get_task(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: GetTaskInput,
) -> Result<task::Model, AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    task::Entity::find_by_id(input.id)
        .one(project_db.connection())
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".to_string()))
}

#[tauri::command]
#[specta::specta]
pub async fn create_task(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: CreateTaskInput,
) -> Result<task::Model, AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::BadRequest(
            "title must not be empty".to_string(),
        ));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest(
            "project_id must not be empty".to_string(),
        ));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_unix_secs();

    let new_task = task::ActiveModel {
        id: Set(id),
        title: Set(input.title),
        project_id: Set(input.project_id),
        status: Set(DEFAULT_TASK_STATUS.to_string()),
        sort_order: Set(0),
        task_type: Set(DEFAULT_TASK_TYPE.to_string()),
        is_start_here: Set(0),
        has_merge_conflict: Set(0),
        worktree_skipped: Set(0),
        rejection_count: Set(0),
        created_at: Set(now),
        updated_at: Set(now),
        ..Default::default()
    };
    let result = new_task.insert(project_db.connection()).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(result)
}

/// Returns all tasks for a project, ordered by sort_order ASC.
/// If project_id is empty, returns all tasks (no project filter).
#[tauri::command]
#[specta::specta]
pub async fn list_tasks(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: ListTasksInput,
) -> Result<Vec<task::Model>, AppError> {
    if input.project_id.is_empty() {
        // No project filter — query local DB directly (dashboard/cross-project views)
        let tasks = task::Entity::find()
            .order_by_asc(task::Column::SortOrder)
            .all(db.inner())
            .await?;
        return Ok(tasks);
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let tasks = task::Entity::find()
        .filter(task::Column::ProjectId.eq(&input.project_id))
        .order_by_asc(task::Column::SortOrder)
        .all(project_db.connection())
        .await?;
    Ok(tasks)
}

#[tauri::command]
#[specta::specta]
pub async fn update_task_status(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: UpdateTaskStatusInput,
) -> Result<task::Model, AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    if !VALID_TASK_STATUSES.contains(&input.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status: {}",
            input.status
        )));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = task::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task {} not found", input.id)))?;

    // When transitioning to in_progress or create_story, create a git worktree (non-fatal).
    // Project path lookup goes to local DB (projects table is local-scoped).
    let (worktree_path_update, branch_name_update) =
        if (input.status == "in_progress" || input.status == "create_story")
            && existing.worktree_path.is_none()
        {
            match project::Entity::find_by_id(&existing.project_id)
                .one(db.inner())
                .await
            {
                Ok(Some(proj)) => {
                    let git = GitService;
                    match git
                        .create_worktree(&proj.path, &existing.id, &existing.title)
                        .await
                    {
                        Ok((wt, branch)) => (Some(wt), Some(branch)),
                        Err(e) => {
                            tracing::warn!(
                                "Failed to create worktree for task {}: {}",
                                existing.id,
                                e
                            );
                            (None, None)
                        }
                    }
                }
                Ok(None) => {
                    tracing::warn!(
                        "Project {} not found; skipping worktree creation for task {}",
                        existing.project_id,
                        existing.id
                    );
                    (None, None)
                }
                Err(e) => {
                    tracing::warn!(
                        "DB error fetching project for task {}: {}",
                        existing.id,
                        e
                    );
                    (None, None)
                }
            }
        } else {
            (None, None)
        };

    let now = now_unix_secs();
    let mut active = task::ActiveModel {
        id: Set(existing.id),
        status: Set(input.status),
        updated_at: Set(now),
        ..Default::default()
    };
    if let Some(wt) = worktree_path_update {
        active.worktree_path = Set(Some(wt));
    }
    if let Some(bn) = branch_name_update {
        active.branch_name = Set(Some(bn));
    }
    let result = active.update(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(result)
}

/// Reorders tasks within a column by setting their sort_order to the given index positions.
/// Uses a transaction for atomicity.
#[tauri::command]
#[specta::specta]
pub async fn reorder_tasks(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: ReorderTasksInput,
) -> Result<(), AppError> {
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let now = now_unix_secs();
    let txn = pdb_conn.begin().await?;
    for (index, task_id) in input.task_ids.iter().enumerate() {
        let model = task::ActiveModel {
            id: Set(task_id.clone()),
            sort_order: Set(index as i32),
            updated_at: Set(now),
            ..Default::default()
        };
        model.update(&txn).await?;
    }
    txn.commit().await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_task(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: DeleteTaskInput,
) -> Result<(), AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = task::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task {} not found", input.id)))?;
    existing.delete(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct GetWeeklyVelocityInput {
    pub weeks: u32,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct WeekBucket {
    pub week_label: String,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct WeeklyVelocityData {
    pub total_completed: u32,
    pub weeks: Vec<WeekBucket>,
}

/// Returns tasks completed per week for the last N weeks.
#[tauri::command]
#[specta::specta]
pub async fn get_weekly_velocity(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: GetWeeklyVelocityInput,
) -> Result<WeeklyVelocityData, AppError> {
    let weeks = input.weeks.max(1) as i64;
    let now = now_unix_secs();
    let weeks_ago_ts = now - (weeks * 7 * 24 * 3600);

    // Resolve the right DatabaseConnection. We keep it as a concrete Arc<DatabaseConnection>
    // so the future is Send (Box<dyn ConnectionTrait> is !Send).
    let conn_arc: std::sync::Arc<DatabaseConnection> = if input.project_id.is_empty() {
        // No project filter — query local DB.
        std::sync::Arc::new(db.inner().clone())
    } else {
        let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
        match project_db {
            crate::db::ProjectDb::Local(arc) => arc,
            crate::db::ProjectDb::Remote { conn, .. } => conn,
        }
    };

    let stmt = if input.project_id.is_empty() {
        Statement::from_sql_and_values(
            DbBackend::Sqlite,
            r#"
            SELECT
                strftime('%Y-W%W', datetime(updated_at, 'unixepoch')) as week_label,
                COUNT(*) as count
            FROM tasks
            WHERE status = 'done'
              AND updated_at >= ?1
            GROUP BY week_label
            ORDER BY week_label ASC
            "#,
            [weeks_ago_ts.into()],
        )
    } else {
        Statement::from_sql_and_values(
            DbBackend::Sqlite,
            r#"
            SELECT
                strftime('%Y-W%W', datetime(updated_at, 'unixepoch')) as week_label,
                COUNT(*) as count
            FROM tasks
            WHERE status = 'done'
              AND updated_at >= ?1
              AND project_id = ?2
            GROUP BY week_label
            ORDER BY week_label ASC
            "#,
            [weeks_ago_ts.into(), input.project_id.clone().into()],
        )
    };
    let rows = conn_arc.query_all(stmt).await?;

    let mut week_buckets: Vec<WeekBucket> = Vec::new();
    let mut total: u32 = 0;

    for row in rows {
        let week_label: String = row.try_get("", "week_label").unwrap_or_default();
        let count: i32 = row.try_get("", "count").unwrap_or(0);
        let count_u32 = count.max(0) as u32;
        total += count_u32;
        week_buckets.push(WeekBucket {
            week_label,
            count: count_u32,
        });
    }

    Ok(WeeklyVelocityData {
        total_completed: total,
        weeks: week_buckets,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_task_input_serializes() {
        let input = GetTaskInput {
            id: "test-id".to_string(),
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("test-id"));
    }

    #[test]
    fn test_create_task_input_serializes() {
        let input = CreateTaskInput {
            title: "Test Task".to_string(),
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("Test Task"));
        assert!(json.contains("proj-1"));
    }

    #[test]
    fn test_list_tasks_input_serializes() {
        let input = ListTasksInput {
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("proj-1"));
    }

    #[test]
    fn test_list_tasks_input_empty_project_id() {
        let input = ListTasksInput {
            project_id: "".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["project_id"], "");
    }

    #[test]
    fn test_update_task_status_input_serializes() {
        let input = UpdateTaskStatusInput {
            id: "task-1".to_string(),
            status: "in_progress".to_string(),
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("task-1"));
        assert!(json.contains("in_progress"));
    }

    #[test]
    fn test_reorder_tasks_input_serializes() {
        let input = ReorderTasksInput {
            task_ids: vec!["id-1".to_string(), "id-2".to_string()],
            status: "backlog".to_string(),
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("id-1"));
        assert!(json.contains("id-2"));
    }

    #[test]
    fn test_delete_task_input_serializes() {
        let input = DeleteTaskInput {
            id: "task-to-delete".to_string(),
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("task-to-delete"));
    }

    #[test]
    fn test_valid_task_statuses_contains_all_expected() {
        assert!(VALID_TASK_STATUSES.contains(&"backlog"));
        assert!(VALID_TASK_STATUSES.contains(&"create_story"));
        assert!(VALID_TASK_STATUSES.contains(&"in_progress"));
        assert!(VALID_TASK_STATUSES.contains(&"review"));
        assert!(VALID_TASK_STATUSES.contains(&"done"));
    }

    #[test]
    fn test_valid_task_statuses_rejects_invalid() {
        assert!(!VALID_TASK_STATUSES.contains(&"inProgress"));
        assert!(!VALID_TASK_STATUSES.contains(&"invalid"));
        assert!(!VALID_TASK_STATUSES.contains(&""));
    }

    #[test]
    fn test_default_constants() {
        assert_eq!(DEFAULT_TASK_STATUS, "backlog");
        assert_eq!(DEFAULT_TASK_TYPE, "basic");
    }

    #[test]
    fn test_get_weekly_velocity_input_serializes() {
        let input = GetWeeklyVelocityInput {
            weeks: 4,
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("4"));
        assert!(json.contains("p1"));
    }

    #[test]
    fn test_weekly_velocity_data_serializes() {
        let data = WeeklyVelocityData {
            total_completed: 10,
            weeks: vec![
                WeekBucket {
                    week_label: "2026-W15".to_string(),
                    count: 5,
                },
                WeekBucket {
                    week_label: "2026-W16".to_string(),
                    count: 5,
                },
            ],
        };
        let json = serde_json::to_string(&data).expect("serialize");
        assert!(json.contains("2026-W15"));
        assert!(json.contains("10"));
    }
}
