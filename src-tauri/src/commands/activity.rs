use crate::error::AppError;
use crate::services::activity_log::{list_activities, log_activity_internal, ActivityModel};
use sea_orm::DatabaseConnection;
use tauri::{AppHandle, State};

/// Log an activity event for a task. Returns the created ActivityModel.
#[tauri::command]
#[specta::specta]
pub async fn log_activity(
    task_id: String,
    event_type: String,
    payload: Option<String>,
    db: State<'_, DatabaseConnection>,
    app: AppHandle,
) -> Result<ActivityModel, AppError> {
    log_activity_internal(db.inner(), &app, &task_id, &event_type, payload).await
}

/// List activities for a task with optional filtering and pagination.
#[tauri::command]
#[specta::specta]
pub async fn list_activities_for_task(
    task_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
    event_types: Option<Vec<String>>,
    db: State<'_, DatabaseConnection>,
) -> Result<Vec<ActivityModel>, AppError> {
    let limit = limit.unwrap_or(100).min(500);
    let offset = offset.unwrap_or(0).max(0);
    list_activities(db.inner(), &task_id, limit, offset, event_types.as_deref()).await
}
