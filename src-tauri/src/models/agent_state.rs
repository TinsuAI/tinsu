use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AgentState {
    Idle,
    Starting,
    Running,
    Stalled,
    Paused,
    Completing,
    Review,
}
