use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, ModelTrait, QueryFilter,
    QueryOrder, Set,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::db::entities::sprint;
use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::sync;

const VALID_SPRINT_STATUSES: &[&str] = &["planning", "active", "completed"];

/// DTO for sprint data exposed via tauri-specta.
/// Mirrors sprint::Model but with a unique specta type name to avoid collision.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct SprintModel {
    pub id: String,
    pub name: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: String,
    pub goal: Option<String>,
    pub velocity: Option<i32>,
    pub capacity: Option<i32>,
    pub project_id: String,
    pub story_prefix: Option<String>,
    pub epics_file_path: Option<String>,
    pub created_at: i64,
}

impl From<sprint::Model> for SprintModel {
    fn from(m: sprint::Model) -> Self {
        SprintModel {
            id: m.id,
            name: m.name,
            start_date: m.start_date,
            end_date: m.end_date,
            status: m.status,
            goal: m.goal,
            velocity: m.velocity,
            capacity: m.capacity,
            project_id: m.project_id,
            story_prefix: m.story_prefix,
            epics_file_path: m.epics_file_path,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListSprintsInput {
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateSprintInput {
    pub name: String,
    pub goal: Option<String>,
    pub status: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateSprintInput {
    pub id: String,
    pub name: String,
    pub goal: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateSprintStatusInput {
    pub id: String,
    pub status: String,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct DeleteSprintInput {
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

/// Returns all sprints for a project ordered by created_at ASC.
/// If project_id is empty, returns all sprints.
#[tauri::command]
#[specta::specta]
pub async fn list_sprints(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: ListSprintsInput,
) -> Result<Vec<SprintModel>, AppError> {
    if input.project_id.is_empty() {
        let sprints = sprint::Entity::find()
            .order_by_asc(sprint::Column::CreatedAt)
            .all(db.inner())
            .await?;
        return Ok(sprints.into_iter().map(SprintModel::from).collect());
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let sprints = sprint::Entity::find()
        .filter(sprint::Column::ProjectId.eq(&input.project_id))
        .order_by_asc(sprint::Column::CreatedAt)
        .all(project_db.connection())
        .await?;
    Ok(sprints.into_iter().map(SprintModel::from).collect())
}

/// Creates a new sprint.
#[tauri::command]
#[specta::specta]
pub async fn create_sprint(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: CreateSprintInput,
) -> Result<SprintModel, AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("name must not be empty".to_string()));
    }
    if !VALID_SPRINT_STATUSES.contains(&input.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status: {}",
            input.status
        )));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest(
            "project_id must not be empty".to_string(),
        ));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;

    let now = now_unix_secs();
    let new_sprint = sprint::ActiveModel {
        id: Set(uuid::Uuid::new_v4().to_string()),
        name: Set(input.name),
        goal: Set(input.goal),
        status: Set(input.status),
        start_date: Set(input.start_date),
        end_date: Set(input.end_date),
        project_id: Set(input.project_id),
        velocity: Set(None),
        capacity: Set(None),
        story_prefix: Set(None),
        epics_file_path: Set(None),
        created_at: Set(now),
    };
    let result = new_sprint.insert(project_db.connection()).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(SprintModel::from(result))
}

/// Updates an existing sprint's details.
#[tauri::command]
#[specta::specta]
pub async fn update_sprint(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: UpdateSprintInput,
) -> Result<SprintModel, AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("name must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = sprint::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Sprint {} not found", input.id)))?;

    let updated = sprint::ActiveModel {
        id: Set(existing.id),
        name: Set(input.name),
        goal: Set(input.goal),
        start_date: Set(input.start_date),
        end_date: Set(input.end_date),
        ..Default::default()
    };
    let result = updated.update(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(SprintModel::from(result))
}

/// Updates only the status of an existing sprint.
#[tauri::command]
#[specta::specta]
pub async fn update_sprint_status(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: UpdateSprintStatusInput,
) -> Result<SprintModel, AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if !VALID_SPRINT_STATUSES.contains(&input.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status: {}",
            input.status
        )));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = sprint::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Sprint {} not found", input.id)))?;

    let updated = sprint::ActiveModel {
        id: Set(existing.id),
        status: Set(input.status),
        ..Default::default()
    };
    let result = updated.update(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(SprintModel::from(result))
}

/// Deletes a sprint by id.
#[tauri::command]
#[specta::specta]
pub async fn delete_sprint(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: DeleteSprintInput,
) -> Result<(), AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = sprint::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Sprint {} not found", input.id)))?;
    existing.delete(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(())
}

/// Returns the first active sprint for a project, or None if not found.
#[tauri::command]
#[specta::specta]
pub async fn get_active_sprint(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: ListSprintsInput,
) -> Result<Option<SprintModel>, AppError> {
    if input.project_id.is_empty() {
        let sprint = sprint::Entity::find()
            .filter(sprint::Column::Status.eq("active"))
            .one(db.inner())
            .await?;
        return Ok(sprint.map(SprintModel::from));
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let sprint = sprint::Entity::find()
        .filter(sprint::Column::Status.eq("active"))
        .filter(sprint::Column::ProjectId.eq(&input.project_id))
        .one(project_db.connection())
        .await?;
    Ok(sprint.map(SprintModel::from))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sprint_model_serializes() {
        let model = SprintModel {
            id: "s1".to_string(),
            name: "Sprint 1".to_string(),
            start_date: Some("2026-04-01".to_string()),
            end_date: Some("2026-04-14".to_string()),
            status: "active".to_string(),
            goal: Some("Ship T1.5".to_string()),
            velocity: None,
            capacity: None,
            project_id: "p1".to_string(),
            story_prefix: None,
            epics_file_path: None,
            created_at: 1_000_000,
        };
        let json = serde_json::to_string(&model).expect("serialize");
        assert!(json.contains("Sprint 1"));
        assert!(json.contains("active"));
    }

    #[test]
    fn test_sprint_model_from_entity() {
        let entity = sprint::Model {
            id: "s1".to_string(),
            name: "Sprint 1".to_string(),
            start_date: Some("2026-04-01".to_string()),
            end_date: None,
            status: "planning".to_string(),
            goal: None,
            velocity: None,
            capacity: None,
            project_id: "p1".to_string(),
            story_prefix: None,
            epics_file_path: None,
            created_at: 1_000_000,
        };
        let dto = SprintModel::from(entity);
        assert_eq!(dto.id, "s1");
        assert_eq!(dto.name, "Sprint 1");
        assert_eq!(dto.status, "planning");
        assert_eq!(dto.project_id, "p1");
        assert_eq!(dto.created_at, 1_000_000);
    }

    #[test]
    fn test_valid_sprint_statuses() {
        assert!(VALID_SPRINT_STATUSES.contains(&"planning"));
        assert!(VALID_SPRINT_STATUSES.contains(&"active"));
        assert!(VALID_SPRINT_STATUSES.contains(&"completed"));
        assert!(!VALID_SPRINT_STATUSES.contains(&"invalid"));
        assert!(!VALID_SPRINT_STATUSES.contains(&""));
    }

    #[test]
    fn test_create_sprint_input_serializes() {
        let input = CreateSprintInput {
            name: "Sprint 2".to_string(),
            goal: Some("Goal".to_string()),
            status: "planning".to_string(),
            start_date: None,
            end_date: None,
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("Sprint 2"));
        assert!(json.contains("planning"));
    }

    #[test]
    fn test_update_sprint_input_serializes() {
        let input = UpdateSprintInput {
            id: "s1".to_string(),
            name: "Updated".to_string(),
            goal: None,
            start_date: Some("2026-04-01".to_string()),
            end_date: None,
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("Updated"));
    }

    #[test]
    fn test_update_sprint_status_input_serializes() {
        let input = UpdateSprintStatusInput {
            id: "s1".to_string(),
            status: "active".to_string(),
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("active"));
    }

    #[test]
    fn test_delete_sprint_input_serializes() {
        let input = DeleteSprintInput {
            id: "s1".to_string(),
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("s1"));
    }
}
