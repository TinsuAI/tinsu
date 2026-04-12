use crate::db::entities::task_activity;
use crate::error::AppError;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ─── DTOs ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct ActivityModel {
    pub id: String,
    pub task_id: String,
    pub event_type: String,
    pub payload: Option<String>,
    pub created_at: i64, // Unix milliseconds
}

impl From<task_activity::Model> for ActivityModel {
    fn from(m: task_activity::Model) -> Self {
        ActivityModel {
            id: m.id,
            task_id: m.task_id,
            event_type: m.event_type,
            payload: m.payload,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActivityCreatedPayload {
    pub task_id: String,
    pub activity: ActivityModel,
}

// ─── Service Functions ─────────────────────────────────────────────────────

/// Insert a task activity record and emit a Tauri event to all listeners.
pub async fn log_activity_internal(
    db: &DatabaseConnection,
    app_handle: &AppHandle,
    task_id: &str,
    event_type: &str,
    payload: Option<String>,
) -> Result<ActivityModel, AppError> {
    let id = Uuid::new_v4().to_string();

    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("Clock error computing unix epoch: {}", e);
            0
        });

    let active = task_activity::ActiveModel {
        id: Set(id),
        task_id: Set(task_id.to_string()),
        event_type: Set(event_type.to_string()),
        payload: Set(payload),
        created_at: Set(created_at),
    };

    let model = active.insert(db).await?;
    let activity = ActivityModel::from(model);

    // Emit real-time event to frontend listeners
    app_handle
        .emit(
            "activity:created",
            ActivityCreatedPayload {
                task_id: task_id.to_string(),
                activity: activity.clone(),
            },
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(activity)
}

/// List activities for a task with optional filtering, pagination, and DESC ordering.
pub async fn list_activities(
    db: &DatabaseConnection,
    task_id: &str,
    limit: i64,
    offset: i64,
    event_types: Option<&[String]>,
) -> Result<Vec<ActivityModel>, AppError> {
    let mut query = task_activity::Entity::find()
        .filter(task_activity::Column::TaskId.eq(task_id));

    if let Some(types) = event_types {
        if !types.is_empty() {
            query = query.filter(task_activity::Column::EventType.is_in(types.to_vec()));
        }
    }

    let models = query
        .order_by_desc(task_activity::Column::CreatedAt)
        .limit(limit as u64)
        .offset(offset as u64)
        .all(db)
        .await?;

    Ok(models.into_iter().map(ActivityModel::from).collect())
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_activity_model_from_conversion() {
        let model = task_activity::Model {
            id: "test-id".to_string(),
            task_id: "task-1".to_string(),
            event_type: "agent_start".to_string(),
            payload: Some(r#"{"tool":"bash"}"#.to_string()),
            created_at: 1705678338000,
        };

        let activity = ActivityModel::from(model);

        assert_eq!(activity.id, "test-id");
        assert_eq!(activity.task_id, "task-1");
        assert_eq!(activity.event_type, "agent_start");
        assert_eq!(activity.payload.as_deref(), Some(r#"{"tool":"bash"}"#));
        assert_eq!(activity.created_at, 1705678338000);
    }

    #[test]
    fn test_activity_model_from_null_payload() {
        let model = task_activity::Model {
            id: "id-2".to_string(),
            task_id: "task-2".to_string(),
            event_type: "status_change".to_string(),
            payload: None,
            created_at: 0,
        };

        let activity = ActivityModel::from(model);
        assert!(activity.payload.is_none());
    }

    #[test]
    fn test_activity_created_payload_serializes() {
        let activity = ActivityModel {
            id: "id-1".to_string(),
            task_id: "task-1".to_string(),
            event_type: "tool_used".to_string(),
            payload: None,
            created_at: 12345,
        };
        let evt = ActivityCreatedPayload {
            task_id: "task-1".to_string(),
            activity: activity.clone(),
        };
        let json = serde_json::to_string(&evt).unwrap();
        assert!(json.contains("\"task_id\":\"task-1\""));
        assert!(json.contains("\"event_type\":\"tool_used\""));
    }
}
