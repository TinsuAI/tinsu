use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, serde::Serialize, serde::Deserialize, specta::Type)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub sort_order: i32,
    pub epic_id: Option<String>,
    pub sprint_id: Option<String>,
    pub task_type: String,
    pub phase_number: Option<i32>,
    pub phase_name: Option<String>,
    pub bmad_agent: Option<String>,
    pub bmad_workflow: Option<String>,
    pub is_start_here: i32,
    pub artifact_path: Option<String>,
    pub story_number: Option<String>,
    pub story_file_path: Option<String>,
    pub full_content: Option<String>,
    pub story_file_status: Option<String>,
    pub context_notes: Option<String>,
    pub project_id: String,
    pub worktree_path: Option<String>,
    pub branch_name: Option<String>,
    pub merge_commit_sha: Option<String>,
    pub has_merge_conflict: i32,
    pub conflict_files: Option<String>,
    pub worktree_skipped: i32,
    pub rejection_feedback: Option<String>,
    pub rejected_agent_run_id: Option<String>,
    pub inline_comments: Option<String>,
    pub rejection_count: i32,
    pub last_review_commit: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
