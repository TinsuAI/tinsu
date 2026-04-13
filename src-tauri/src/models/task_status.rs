use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Backlog,
    CreateStory,
    InProgress,
    Review,
    Done,
}
