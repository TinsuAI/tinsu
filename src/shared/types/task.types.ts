// Task status enum values (shared between main and renderer)
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

// Exit status enum values for agent runs
export const EXIT_STATUS = ['success', 'error', 'cancelled', 'timeout'] as const
export type ExitStatus = (typeof EXIT_STATUS)[number]

// Task entity type (matches Drizzle schema)
export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  epic_id: string | null
  sprint_id: string | null
  created_at: Date
  updated_at: Date
}

// Input type for creating a new task
export interface NewTask {
  id: string
  title: string
  description?: string | null
  status?: string
  epic_id?: string | null
  sprint_id?: string | null
  created_at?: Date
  updated_at?: Date
}

// Agent run entity type (matches Drizzle schema)
export interface AgentRun {
  id: string
  task_id: string
  start_time: Date
  end_time: Date | null
  duration_ms: number | null
  token_usage: number | null
  exit_status: string | null
  log_path: string | null
}

// Input type for creating a new agent run
export interface NewAgentRun {
  id: string
  task_id: string
  start_time: Date
  end_time?: Date | null
  duration_ms?: number | null
  token_usage?: number | null
  exit_status?: string | null
  log_path?: string | null
}
