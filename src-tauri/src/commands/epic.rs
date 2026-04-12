use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::db::entities::epic;
use crate::error::AppError;

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
    input: ListEpicsInput,
) -> Result<Vec<EpicModel>, AppError> {
    let mut query = epic::Entity::find();
    if !input.project_id.is_empty() {
        query = query.filter(epic::Column::ProjectId.eq(&input.project_id));
    }
    let epics = query.all(db.inner()).await?;
    Ok(epics.into_iter().map(EpicModel::from).collect())
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
}
