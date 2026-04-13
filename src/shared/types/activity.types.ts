// Activity event type enum values
// Story TES-2.1: Activity event type enum for task event tracking
// Story 8.9: Added auto_commit event type
// Story 7.4: Added rejection event for tracking task rejections with feedback
export const ACTIVITY_EVENT_TYPE = [
  'status_change',
  'agent_start',
  'agent_complete',
  'tool_used',
  'user_command',
  'automation_trigger',
  'error',
  'session_ended',
  'stall_detected',
  'stall_recovered',
  'auto_commit', // Story 8.9: AC 3 - Auto-commit on agent completion
  'rejection' // Story 7.4: Task rejection with feedback
] as const
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPE)[number]

// Activity entity type (matches Drizzle schema TaskActivity)
export interface Activity {
  id: string
  task_id: string
  event_type: ActivityEventType
  payload: string | null // JSON string
  created_at: number // Unix timestamp ms
}

// Activity event payload for real-time streaming (IPC)
// Story TES-2.13: Payload structure for activity-created event
export interface ActivityEventPayload {
  taskId: string
  activity: Activity
}
