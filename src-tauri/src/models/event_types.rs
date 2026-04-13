use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ActivityEventType {
    AgentStart,
    AgentComplete,
    AgentError,
    StatusChange,
    ToolUse,
    UserCommand,
    AutomationTrigger,
    ReviewRequest,
    ReviewComplete,
    WorkflowStep,
    SystemEvent,
    Error,
}
