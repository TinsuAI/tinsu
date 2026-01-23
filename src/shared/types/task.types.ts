// Task status enum values (shared between main and renderer)
// Story 5.2b: Added 'create_story' column between backlog and in_progress
export const TASK_STATUS = ['backlog', 'create_story', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

// Story 7.5: Inline comment type for request changes workflow
export interface InlineComment {
  id: string // UUID
  filePath: string // e.g., "src/components/App.tsx"
  lineNumber: number // 1-indexed line number
  content: string // Comment text
  createdAt: number // Unix timestamp
}

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
  // Story 3.3: Artifact path for completed planning tasks
  artifact_path: string | null
  // Story 3.7: Story number for imported stories from epics.md
  story_number: string | null // "1", "2", "2b", "3b"... within each epic (TEXT in DB)
  // Story 3.7: Full content from detailed story file in implementation-artifacts
  story_file_path: string | null // Path to detailed story .md file
  full_content: string | null // Full markdown content from detailed story file
  // Story 5.2b: Story file status for create_story phase
  story_file_status: string | null // 'summary_only' | 'story_ready' | null
  // Story 5.5: Context notes for DEV agent (Story 5.11 adds UI for editing)
  context_notes: string | null // Optional notes to provide additional context to DEV agent
  // Story 3.1.5: Project scoping
  project_id: string | null
  // Story 8.2: Worktree path for git isolation
  worktree_path: string | null // Path to git worktree (.tinsu/worktrees/{task-id}/)
  // Story 8.3: Branch name for git worktree
  branch_name: string | null // e.g., tinsu/story-abc123-add-user-auth
  // Story 8.5: SHA of merge commit when task is approved
  merge_commit_sha: string | null
  // Story 8.7: Merge conflict tracking
  has_merge_conflict: number | null // 0 = no conflict, 1 = has conflict (SQLite boolean)
  conflict_files: string | null // JSON array of file paths
  // Story 7.4: Rejection feedback for re-execution
  rejection_feedback: string | null // Feedback provided when rejecting task
  // Story 7.4 AC 3: Link rejection to specific agent run
  rejected_agent_run_id: string | null // ID of agent_run that was rejected
  // Story 7.5: Inline comments for request changes workflow
  inline_comments: InlineComment[] | null // Array of inline comments (stored as JSON in DB)
  // Story 7.6: Rejection count for tracking multiple cycles (AC: 4)
  rejection_count: number | null // Number of rejection cycles
  // Story 7.6: Last review commit for diff baseline (AC: 5)
  last_review_commit: string | null // SHA of HEAD when task entered Review status
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
  // Story 3.3: Artifact path for completed planning tasks
  artifact_path?: string | null
  // Story 3.7: Story number for imported stories
  story_number?: string | null
  // Story 3.7: Full content from detailed story file
  story_file_path?: string | null
  full_content?: string | null
  // Story 5.2b: Story file status for create_story phase
  story_file_status?: string | null
  // Story 5.5: Context notes for DEV agent
  context_notes?: string | null
  // Story 3.1.5: Project scoping
  project_id?: string | null
  // Story 8.2: Worktree path for git isolation
  worktree_path?: string | null
  // Story 8.3: Branch name for git worktree
  branch_name?: string | null
  // Story 8.5: SHA of merge commit when task is approved
  merge_commit_sha?: string | null
  // Story 8.7: Merge conflict tracking
  has_merge_conflict?: number | null
  conflict_files?: string | null
  // Story 7.4: Rejection feedback for re-execution
  rejection_feedback?: string | null
  // Story 7.4 AC 3: Link rejection to specific agent run
  rejected_agent_run_id?: string | null
  // Story 7.5: Inline comments for request changes workflow
  inline_comments?: InlineComment[] | null
  // Story 7.6: Rejection count for tracking multiple cycles (AC: 4)
  rejection_count?: number | null
  // Story 7.6: Last review commit for diff baseline (AC: 5)
  last_review_commit?: string | null
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

// Epic entity type (Story 2.5, Story 3.1.5 - project_id, Story 3.7 - epic_number, goal, Architecture Addendum: sprint_id)
export interface Epic {
  id: string
  title: string
  description: string | null
  color: EpicColor
  // Story 3.7: Epic number and goal for imported epics from epics.md
  epic_number: number | null
  goal: string | null
  // Architecture Addendum: Sprint assignment (epic belongs to exactly 1 sprint)
  sprint_id: string | null
  // Story 3.1.5: Project scoping
  project_id: string | null
  created_at: Date
}

// Input type for creating a new epic (Story 2.5, Story 3.1.5 - project_id, Story 3.7 - epic_number, goal, Architecture Addendum: sprint_id)
export interface NewEpic {
  title: string
  description?: string | null
  color?: EpicColor
  // Story 3.7: Epic number and goal for imported epics
  epic_number?: number | null
  goal?: string | null
  // Architecture Addendum: Sprint assignment
  sprint_id?: string | null
  // Story 3.1.5: Project scoping
  project_id?: string | null
}

// Sprint status enum values (Architecture Addendum: Sprint Management)
export const SPRINT_STATUS = ['planning', 'active', 'completed'] as const
export type SprintStatus = (typeof SPRINT_STATUS)[number]

// Sprint entity type (Story 2.5, Story 3.1.5 - project_id, Architecture Addendum: Sprint Management)
export interface Sprint {
  id: string
  name: string
  start_date: Date | null
  end_date: Date | null
  // Architecture Addendum: Status replaces is_active
  status: SprintStatus
  // Architecture Addendum: Sprint goal, velocity, capacity
  goal: string | null
  velocity: number | null
  capacity: number | null
  // Story 3.1.5: Project scoping
  project_id: string | null
  created_at: Date
}

// Input type for creating a new sprint (Story 2.5, Story 3.1.5 - project_id, Architecture Addendum)
export interface NewSprint {
  name: string
  start_date?: Date | null
  end_date?: Date | null
  status?: SprintStatus
  goal?: string | null
  velocity?: number | null
  capacity?: number | null
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
  artifact_path: string | null // Story 3.3: path to completed artifact
}

export interface StoryTaskFields {
  task_type: 'story'
  phase_number: null
  phase_name: null
  bmad_agent: null
  bmad_workflow: null
  is_start_here: null // Story 3.2: always null for story tasks
  artifact_path: null // Story 3.3: always null for story tasks
  // Story 3.7: story_number is set for imported stories, null for manually created
  story_number: string | null
  // Story 3.7: Full content from detailed story file
  story_file_path: string | null
  full_content: string | null
}

// Type for a planning task (narrowed)
export type PlanningTask = Omit<
  Task,
  'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow' | 'is_start_here' | 'artifact_path'
> &
  PlanningTaskFields

// Type for a story task (narrowed)
export type StoryTask = Omit<
  Task,
  'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow' | 'is_start_here' | 'artifact_path' | 'story_number' | 'story_file_path' | 'full_content'
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

// Story 5.2c: Helper to distinguish imported story tasks from basic tasks
// Imported story tasks have story_number (imported from epics.md)
// Basic tasks are manually created (story_number is null)
export function isImportedStoryTask(task: Task): boolean {
  return task.task_type === 'story' && task.story_number !== null
}

// Story 5.3b: Helper to identify basic tasks (manually created, no story_number)
// Basic tasks execute directly without BMAD workflow overhead
export function isBasicTask(task: Task): boolean {
  return task.task_type === 'story' && task.story_number === null
}

// Story TES-1.2: Session phase enum for workflow tracking
export const SESSION_PHASE = ['dev-story', 'code-review', 'user-feedback'] as const
export type SessionPhase = (typeof SESSION_PHASE)[number]

// Story TES-1.2: Task session entity type (matches Drizzle schema)
export interface TaskSession {
  id: string
  task_id: string
  session_id: string | null // Claude Code session ID from hooks (set when agent starts)
  tmux_session: string // tmux session name: tinsu-{projectName}-{taskId}
  current_phase: SessionPhase | null // Workflow phase: 'dev-story' | 'code-review' | 'user-feedback'
  created_at: Date
}

// Story TES-1.2: Input type for creating a new task session
export interface NewTaskSession {
  id: string
  task_id: string
  session_id?: string | null
  tmux_session: string
  current_phase?: SessionPhase | null
  created_at?: Date
}

// Story 7.7: Version status outcome enum values for review history
export const VERSION_STATUS_OUTCOME = ['pending', 'rejected', 'changes_requested', 'approved'] as const
export type VersionStatusOutcome = (typeof VERSION_STATUS_OUTCOME)[number]

// Story 7.7: Task version entity type for review history tracking
// Each version represents a snapshot when task enters 'review' status
export interface TaskVersion {
  id: string
  task_id: string
  version_number: number
  commit_sha: string | null // HEAD SHA when version created
  rejection_feedback: string | null // Feedback if rejected
  inline_comments: string | null // JSON array if changes requested
  status_outcome: VersionStatusOutcome // 'pending' | 'rejected' | 'changes_requested' | 'approved'
  created_at: Date
}

// Story 7.7: Input type for creating a new task version
export interface NewTaskVersion {
  id: string
  task_id: string
  version_number: number
  commit_sha?: string | null
  rejection_feedback?: string | null
  inline_comments?: string | null
  status_outcome?: VersionStatusOutcome
  created_at?: Date
}
