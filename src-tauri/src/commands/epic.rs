use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, ModelTrait, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::db::entities::epic;
use crate::db::{resolve_project_db, ProjectDbRegistry};
use crate::error::AppError;
use crate::sync;

fn now_unix_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|e| {
            tracing::warn!("System clock before UNIX_EPOCH: {}; using 0", e);
            0
        })
}

/// DTO for epic data exposed via tauri-specta.
/// Mirrors epic::Model but with a unique specta type name to avoid collision with task::Model.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct EpicModel {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub epic_number: Option<i32>,
    pub goal: Option<String>,
    pub sprint_id: Option<String>,
    pub project_id: String,
    pub created_at: i64,
}

impl From<epic::Model> for EpicModel {
    fn from(m: epic::Model) -> Self {
        EpicModel {
            id: m.id,
            title: m.title,
            description: m.description,
            color: m.color,
            epic_number: m.epic_number,
            goal: m.goal,
            sprint_id: m.sprint_id,
            project_id: m.project_id,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ListEpicsInput {
    pub project_id: String,
}

/// Returns all epics for a project. If project_id is empty, returns all epics.
#[tauri::command]
#[specta::specta]
pub async fn list_epics(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    input: ListEpicsInput,
) -> Result<Vec<EpicModel>, AppError> {
    if input.project_id.is_empty() {
        let epics = epic::Entity::find().all(db.inner()).await?;
        return Ok(epics.into_iter().map(EpicModel::from).collect());
    }
    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let epics = epic::Entity::find()
        .filter(epic::Column::ProjectId.eq(&input.project_id))
        .all(project_db.connection())
        .await?;
    Ok(epics.into_iter().map(EpicModel::from).collect())
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CreateEpicInput {
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub epic_number: Option<i32>,
    pub goal: Option<String>,
    pub sprint_id: Option<String>,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct UpdateEpicInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub goal: Option<String>,
    pub sprint_id: Option<String>,
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct DeleteEpicInput {
    pub id: String,
    pub project_id: String,
}

/// Creates a new epic.
#[tauri::command]
#[specta::specta]
pub async fn create_epic(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: CreateEpicInput,
) -> Result<EpicModel, AppError> {
    if input.title.trim().is_empty() {
        return Err(AppError::BadRequest("title must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest(
            "project_id must not be empty".to_string(),
        ));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;

    let now = now_unix_secs();
    let new_epic = epic::ActiveModel {
        id: Set(uuid::Uuid::new_v4().to_string()),
        title: Set(input.title),
        description: Set(input.description),
        color: Set(input.color),
        epic_number: Set(input.epic_number),
        goal: Set(input.goal),
        sprint_id: Set(input.sprint_id),
        project_id: Set(input.project_id),
        created_at: Set(now),
    };
    let result = new_epic.insert(project_db.connection()).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(EpicModel::from(result))
}

/// Updates an existing epic.
#[tauri::command]
#[specta::specta]
pub async fn update_epic(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: UpdateEpicInput,
) -> Result<EpicModel, AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.title.trim().is_empty() {
        return Err(AppError::BadRequest("title must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = epic::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Epic {} not found", input.id)))?;

    let updated = epic::ActiveModel {
        id: Set(existing.id),
        title: Set(input.title),
        description: Set(input.description),
        color: Set(input.color),
        goal: Set(input.goal),
        sprint_id: Set(input.sprint_id),
        ..Default::default()
    };
    let result = updated.update(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(EpicModel::from(result))
}

/// Deletes an epic by id.
#[tauri::command]
#[specta::specta]
pub async fn delete_epic(
    db: State<'_, DatabaseConnection>,
    registry: State<'_, Arc<ProjectDbRegistry>>,
    app: AppHandle,
    input: DeleteEpicInput,
) -> Result<(), AppError> {
    if input.id.is_empty() {
        return Err(AppError::BadRequest("id must not be empty".to_string()));
    }
    if input.project_id.is_empty() {
        return Err(AppError::BadRequest("project_id must not be empty".to_string()));
    }

    let project_db = resolve_project_db(db.inner(), &registry, &input.project_id).await?;
    let pdb_conn = project_db.connection();

    let existing = epic::Entity::find_by_id(&input.id)
        .one(pdb_conn)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Epic {} not found", input.id)))?;
    existing.delete(pdb_conn).await?;

    if let crate::db::ProjectDb::Remote { ref remote_project_id, ref connection_id, .. } = project_db {
        sync::schedule_push_after_write(remote_project_id, connection_id, &app);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_epics_input_serializes() {
        let input = ListEpicsInput {
            project_id: "proj-1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("proj-1"));
    }

    #[test]
    fn test_list_epics_input_deserializes() {
        let json = r#"{"project_id":"test-project"}"#;
        let input: ListEpicsInput = serde_json::from_str(json).expect("deserialize");
        assert_eq!(input.project_id, "test-project");
    }

    #[test]
    fn test_epic_model_from_entity() {
        let entity = epic::Model {
            id: "e1".to_string(),
            title: "Epic One".to_string(),
            description: Some("desc".to_string()),
            color: Some("blue".to_string()),
            epic_number: Some(1),
            goal: Some("goal".to_string()),
            sprint_id: Some("s1".to_string()),
            project_id: "p1".to_string(),
            created_at: 1_000_000,
        };
        let dto = EpicModel::from(entity);
        assert_eq!(dto.id, "e1");
        assert_eq!(dto.title, "Epic One");
        assert_eq!(dto.created_at, 1_000_000);
    }

    #[test]
    fn test_create_epic_input_serializes() {
        let input = CreateEpicInput {
            title: "My Epic".to_string(),
            description: Some("desc".to_string()),
            color: Some("blue".to_string()),
            epic_number: Some(1),
            goal: None,
            sprint_id: None,
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("My Epic"));
        assert!(json.contains("p1"));
    }

    #[test]
    fn test_update_epic_input_serializes() {
        let input = UpdateEpicInput {
            id: "e1".to_string(),
            title: "Updated Epic".to_string(),
            description: None,
            color: Some("red".to_string()),
            goal: Some("new goal".to_string()),
            sprint_id: Some("s1".to_string()),
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("Updated Epic"));
        assert!(json.contains("new goal"));
    }

    #[test]
    fn test_delete_epic_input_serializes() {
        let input = DeleteEpicInput {
            id: "e1".to_string(),
            project_id: "p1".to_string(),
        };
        let json = serde_json::to_string(&input).expect("serialize");
        assert!(json.contains("e1"));
    }
}
