use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::services::activity_log::{list_activities, log_activity_internal, ActivityModel};
use crate::sync;
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Log an activity event for a task. Returns the created ActivityModel.
///
/// `project_id` is required so the handler can resolve the right DB for
/// project-scoped `task_activities` writes.
#[tauri::command]
#[specta::specta]
pub async fn log_activity(
    task_id: String,
    project_id: String,
    event_type: String,
    payload: Option<String>,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
) -> Result<ActivityModel, AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    let result = log_activity_internal(project_db.connection(), &app, &task_id, &event_type, payload).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(result)
}

/// List activities for a task with optional filtering and pagination.
///
/// `project_id` is required so the handler can resolve the right DB for
/// project-scoped `task_activities` reads.
#[tauri::command]
#[specta::specta]
pub async fn list_activities_for_task(
    task_id: String,
    project_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
    event_types: Option<Vec<String>>,
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
) -> Result<Vec<ActivityModel>, AppError> {
    if project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }
    let limit = limit.unwrap_or(100).min(500);
    let offset = offset.unwrap_or(0).max(0);
    let project_db = resolve_project_db(db.inner(), &registry, &project_id).await?;
    list_activities(project_db.connection(), &task_id, limit, offset, event_types.as_deref()).await
}
