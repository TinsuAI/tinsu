use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize)]
#[sea_orm(table_name = "workflow_runs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub project_id: String,
    pub workflow_key: String,
    pub phase: Option<String>,
    pub status: String,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub input_artifacts: Option<String>,
    pub output_artifacts: Option<String>,
    pub agent_name: Option<String>,
    pub task_id: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
