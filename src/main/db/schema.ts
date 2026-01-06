import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

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
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]

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

// Epics table (Story 2.5 - AC1)
export const epics = sqliteTable('epics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  color: text('color').notNull().default('blue'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

// Sprints table (Story 2.5 - AC1)
export const sprints = sqliteTable('sprints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  start_date: integer('start_date', { mode: 'timestamp' }),
  end_date: integer('end_date', { mode: 'timestamp' }),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

// Tasks table (Story 1.4 - AC1)
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
    index('idx_tasks_sort_order').on(table.sort_order)
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
