import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// Projects table (Story 3.1.5 - Multi-project support)
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull().unique(),
    name: text('name').notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    last_opened_at: integer('last_opened_at', { mode: 'timestamp' })
  },
  (table) => [
    index('idx_projects_path').on(table.path),
    index('idx_projects_last_opened').on(table.last_opened_at)
  ]
)

// Settings table (from Story 1.3)
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

// Task status enum values
// Story 5.2b: Added 'create_story' column between backlog and in_progress
export const TASK_STATUS = ['backlog', 'create_story', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

// Task type enum values (Story 3.1 - AC1)
export const TASK_TYPE = ['planning', 'story'] as const
export type TaskType = (typeof TASK_TYPE)[number]

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

// Epics table (Story 2.5 - AC1, Story 3.1.5 - project_id, Story 3.7 - epic_number, goal, Architecture Addendum: sprint_id)
export const epics = sqliteTable(
  'epics',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    color: text('color').notNull().default('blue'),
    // Story 3.7: Epic number and goal for imported epics from epics.md
    epic_number: integer('epic_number'), // 1, 2, 3... from epics.md
    goal: text('goal'), // Goal description from epics.md
    // Architecture Addendum: Sprint assignment (epic belongs to exactly 1 sprint)
    sprint_id: text('sprint_id'),
    // Story 3.1.5: Project scoping (nullable for migration safety)
    project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_epics_project_id').on(table.project_id),
    index('idx_epics_sprint_id').on(table.sprint_id)
  ]
)

// Sprint status enum values (Architecture Addendum: Sprint Management)
export const SPRINT_STATUS = ['planning', 'active', 'completed'] as const
export type SprintStatus = (typeof SPRINT_STATUS)[number]

// Sprints table (Story 2.5 - AC1, Story 3.1.5 - project_id, Architecture Addendum: Sprint Management)
export const sprints = sqliteTable(
  'sprints',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    start_date: integer('start_date', { mode: 'timestamp' }),
    end_date: integer('end_date', { mode: 'timestamp' }),
    // Architecture Addendum: Replace is_active with status enum
    status: text('status').notNull().default('planning'), // 'planning' | 'active' | 'completed'
    // Architecture Addendum: Sprint goal, velocity, capacity
    goal: text('goal'), // Optional sprint goal
    velocity: integer('velocity'), // Story points completed
    capacity: integer('capacity'), // Team capacity
    // Story 3.1.5: Project scoping (nullable for migration safety)
    project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_sprints_project_id').on(table.project_id),
    index('idx_sprints_status').on(table.status)
  ]
)

// Tasks table (Story 1.4 - AC1, Story 3.1 - planning task fields, Story 3.2 - is_start_here, Story 3.1.5 - project_id, Story 3.7 - story_number)
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('backlog'),
    sort_order: integer('sort_order').notNull().default(0),
    epic_id: text('epic_id'),
    sprint_id: text('sprint_id'),
    // Story 3.1: Task type and planning-specific fields
    task_type: text('task_type').notNull().default('story'), // 'planning' | 'story'
    phase_number: integer('phase_number'), // 1-5 for planning tasks, null for story
    phase_name: text('phase_name'), // Human-readable phase name
    bmad_agent: text('bmad_agent'), // BMAD agent identifier
    bmad_workflow: text('bmad_workflow'), // Path to workflow.yaml
    // Story 3.2: Start Here indicator for first planning task
    is_start_here: integer('is_start_here', { mode: 'boolean' }), // true only for phase 1, null for others
    // Story 3.3: Artifact path for completed planning tasks
    artifact_path: text('artifact_path'), // Path to generated artifact file
    // Story 3.7: Story number for imported stories from epics.md
    story_number: text('story_number'), // "1", "2", "2b", "3b"... within each epic
    // Story 3.7: Full content from detailed story file in implementation-artifacts
    story_file_path: text('story_file_path'), // Path to detailed story .md file
    full_content: text('full_content'), // Full markdown content from detailed story file
    // Story 5.2b: Story file status for create_story phase
    story_file_status: text('story_file_status'), // 'summary_only' | 'story_ready' | null
    // Story 5.5: Context notes for DEV agent (Story 5.11 adds UI for editing)
    context_notes: text('context_notes'), // Optional notes to provide additional context to DEV agent
    // Story 3.1.5: Project scoping (nullable for migration safety)
    project_id: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_epic_id').on(table.epic_id),
    index('idx_tasks_sprint_id').on(table.sprint_id),
    index('idx_tasks_sort_order').on(table.sort_order),
    index('idx_tasks_task_type').on(table.task_type), // Story 3.1: Index for filtered queries
    index('idx_tasks_project_id').on(table.project_id) // Story 3.1.5: Index for project filtering
  ]
)

// Exit status enum values
export const EXIT_STATUS = ['success', 'error', 'cancelled', 'timeout'] as const
export type ExitStatus = (typeof EXIT_STATUS)[number]

// Agent runs table (Story 1.4 - AC2)
export const agent_runs = sqliteTable(
  'agent_runs',
  {
    id: text('id').primaryKey(),
    task_id: text('task_id')
      .notNull()
      .references(() => tasks.id),
    start_time: integer('start_time', { mode: 'timestamp' }).notNull(),
    end_time: integer('end_time', { mode: 'timestamp' }),
    duration_ms: integer('duration_ms'),
    token_usage: integer('token_usage'),
    exit_status: text('exit_status'),
    log_path: text('log_path')
  },
  (table) => [index('idx_agent_runs_task_id').on(table.task_id)]
)

// Type exports (Story 1.4 - AC1, AC2)
// Note: Renderer process should import from 'src/shared/types/task.types.ts' instead
export type Task = InferSelectModel<typeof tasks>
export type NewTask = InferInsertModel<typeof tasks>
export type AgentRun = InferSelectModel<typeof agent_runs>
export type NewAgentRun = InferInsertModel<typeof agent_runs>

// Epic and Sprint type exports (Story 2.5)
export type Epic = InferSelectModel<typeof epics>
export type NewEpic = InferInsertModel<typeof epics>
export type Sprint = InferSelectModel<typeof sprints>
export type NewSprint = InferInsertModel<typeof sprints>

// Project type exports (Story 3.1.5)
export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>

// Story 3.10: Artifact type enum for artifact linking
export const ARTIFACT_TYPE = ['prd', 'architecture', 'ux_design', 'epics', 'custom'] as const
export type ArtifactType = (typeof ARTIFACT_TYPE)[number]

// Story 3.10: Task artifacts table for linking artifacts to tasks
export const task_artifacts = sqliteTable(
  'task_artifacts',
  {
    id: text('id').primaryKey(),
    task_id: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    artifact_type: text('artifact_type').notNull(), // 'prd' | 'architecture' | 'ux_design' | 'epics' | 'custom'
    artifact_path: text('artifact_path').notNull(), // Absolute or relative path to artifact file
    section_ref: text('section_ref'), // Optional: reference to section (e.g., "Story 3.10" or line number)
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [index('idx_task_artifacts_task_id').on(table.task_id)]
)

// Story 3.10: Task artifact type exports
export type TaskArtifact = InferSelectModel<typeof task_artifacts>
export type NewTaskArtifact = InferInsertModel<typeof task_artifacts>
