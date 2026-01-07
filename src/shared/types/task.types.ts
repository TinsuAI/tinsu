// Task status enum values (shared between main and renderer)
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

// Task type enum values (Story 3.1 - AC1)
export const TASK_TYPE = ['planning', 'story'] as const
export type TaskType = (typeof TASK_TYPE)[number]

// Exit status enum values for agent runs
export const EXIT_STATUS = ['success', 'error', 'cancelled', 'timeout'] as const
export type ExitStatus = (typeof EXIT_STATUS)[number]

// Epic colors for consistent badge coloring (Story 2.5)
export const EPIC_COLORS = [
  'blue',
  'green',
  'yellow',
  'red',
  'purple',
  'orange',
  'pink',
  'cyan',
  'indigo',
  'teal'
] as const
export type EpicColor = (typeof EPIC_COLORS)[number]

// Project entity type (Story 3.1.5)
export interface Project {
  id: string
  path: string
  name: string
  created_at: Date
  last_opened_at: Date | null
}

// Input type for creating a new project (Story 3.1.5)
export interface NewProject {
  id: string
  path: string
  name: string
  last_opened_at?: Date | null
}

// Task entity type (matches Drizzle schema)
export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  sort_order: number
  epic_id: string | null
  sprint_id: string | null
  // Story 3.1: Task type and planning-specific fields
  task_type: TaskType
  phase_number: number | null // 1-5 for planning tasks, null for story
  phase_name: string | null // Human-readable phase name
  bmad_agent: string | null // BMAD agent identifier
  bmad_workflow: string | null // Path to workflow.yaml
  // Story 3.2: Start Here indicator
  is_start_here: boolean | null // true only for phase 1 planning task
  // Story 3.1.5: Project scoping
  project_id: string | null
  created_at: Date
  updated_at: Date
}

// Input type for creating a new task
export interface NewTask {
  id: string
  title: string
  description?: string | null
  status?: string
  sort_order?: number
  epic_id?: string | null
  sprint_id?: string | null
  // Story 3.1: Task type and planning-specific fields (optional, defaults to 'story')
  task_type?: TaskType
  phase_number?: number | null
  phase_name?: string | null
  bmad_agent?: string | null
  bmad_workflow?: string | null
  // Story 3.2: Start Here indicator
  is_start_here?: boolean | null
  // Story 3.1.5: Project scoping
  project_id?: string | null
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

// Epic entity type (Story 2.5, Story 3.1.5 - project_id)
export interface Epic {
  id: string
  title: string
  description: string | null
  color: EpicColor
  // Story 3.1.5: Project scoping
  project_id: string | null
  created_at: Date
}

// Input type for creating a new epic (Story 2.5, Story 3.1.5 - project_id)
export interface NewEpic {
  title: string
  description?: string | null
  color?: EpicColor
  // Story 3.1.5: Project scoping
  project_id?: string | null
}

// Sprint entity type (Story 2.5, Story 3.1.5 - project_id)
export interface Sprint {
  id: string
  name: string
  start_date: Date | null
  end_date: Date | null
  is_active: boolean
  // Story 3.1.5: Project scoping
  project_id: string | null
  created_at: Date
}

// Input type for creating a new sprint (Story 2.5, Story 3.1.5 - project_id)
export interface NewSprint {
  name: string
  start_date?: Date | null
  end_date?: Date | null
  is_active?: boolean
  // Story 3.1.5: Project scoping
  project_id?: string | null
}

// Task with related epic and sprint data (Story 2.5)
export interface TaskWithRelations extends Task {
  epic: Epic | null
  sprint: Sprint | null
}

// Story 3.1: Planning task type narrowing interfaces
export interface PlanningTaskFields {
  task_type: 'planning'
  phase_number: 1 | 2 | 3 | 4 | 5
  phase_name: string
  bmad_agent: string
  bmad_workflow: string
  is_start_here: boolean | null // Story 3.2: true only for phase 1
}

export interface StoryTaskFields {
  task_type: 'story'
  phase_number: null
  phase_name: null
  bmad_agent: null
  bmad_workflow: null
  is_start_here: null // Story 3.2: always null for story tasks
}

// Type for a planning task (narrowed)
export type PlanningTask = Omit<
  Task,
  'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow' | 'is_start_here'
> &
  PlanningTaskFields

// Type for a story task (narrowed)
export type StoryTask = Omit<
  Task,
  'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow' | 'is_start_here'
> &
  StoryTaskFields

// Type guard for narrowing task to planning task
// Validates both task_type AND that planning fields are non-null for data integrity
export function isPlanningTask(task: Task): task is PlanningTask {
  return (
    task.task_type === 'planning' &&
    task.phase_number !== null &&
    task.phase_name !== null &&
    task.bmad_agent !== null &&
    task.bmad_workflow !== null
  )
}

// Type guard for narrowing task to story task
export function isStoryTask(task: Task): task is StoryTask {
  return task.task_type === 'story'
}
