import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import { mkdirSync, existsSync } from 'fs'

function getDbPath(): string {
  // In development, use project root data/
  // In production, use app.getPath('userData')
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(process.cwd(), 'data', 'tinsu.db')
  }
  return path.join(app.getPath('userData'), 'tinsu.db')
}

function ensureDbDirectory(dbPath: string): void {
  const dir = path.dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Apply incremental schema migrations to ensure database is up-to-date.
 * This handles adding new columns that may be missing in older databases.
 */
function applyIncrementalMigrations(sqlite: Database.Database): void {
  // First, ensure all base tables exist (for fresh databases)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      epic_number INTEGER,
      goal TEXT,
      sprint_id TEXT,
      project_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date INTEGER,
      end_date INTEGER,
      status TEXT NOT NULL DEFAULT 'planning',
      goal TEXT,
      velocity INTEGER,
      capacity INTEGER,
      project_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      sort_order INTEGER NOT NULL DEFAULT 0,
      epic_id TEXT,
      sprint_id TEXT,
      task_type TEXT NOT NULL DEFAULT 'story',
      phase_number INTEGER,
      phase_name TEXT,
      bmad_agent TEXT,
      bmad_workflow TEXT,
      is_start_here INTEGER,
      artifact_path TEXT,
      story_number TEXT,
      story_file_path TEXT,
      full_content TEXT,
      story_file_status TEXT,
      context_notes TEXT,
      project_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_ms INTEGER,
      token_usage INTEGER,
      exit_status TEXT,
      log_path TEXT
    )
  `)

  // TES-1.2: Task sessions table for terminal session tracking
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      session_id TEXT,
      tmux_session TEXT NOT NULL,
      current_phase TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_task_sessions_session_id ON task_sessions(session_id)')
  sqlite.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sessions_task_id_unique ON task_sessions(task_id)')

  // Session history table for tracking all Claude Code session_ids per task
  // This preserves the mapping for traceability after workflows complete
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS session_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      workflow_type TEXT,
      started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      ended_at INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_session_history_task_id ON session_history(task_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id)')

  // Story 3.10: Task artifacts table for linking artifacts to tasks
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      section_ref TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id)')

  // Create indexes
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON agent_runs(task_id)')

  // Get existing columns in tasks table for incremental migrations
  const columns = sqlite
    .prepare("PRAGMA table_info(tasks)")
    .all() as Array<{ name: string }>
  const existingColumns = new Set(columns.map((c) => c.name))

  // Migration: Add task_type column (Story 3.1)
  if (!existingColumns.has('task_type')) {
    sqlite.exec("ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'story'")
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type)')
  }

  // Migration: Add planning-specific columns (Story 3.1)
  if (!existingColumns.has('phase_number')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN phase_number INTEGER')
  }
  if (!existingColumns.has('phase_name')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN phase_name TEXT')
  }
  if (!existingColumns.has('bmad_agent')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN bmad_agent TEXT')
  }
  if (!existingColumns.has('bmad_workflow')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN bmad_workflow TEXT')
  }

  // Migration: Add is_start_here column (Story 3.2)
  if (!existingColumns.has('is_start_here')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN is_start_here INTEGER')
  }

  // Migration: Add artifact_path column (Story 3.3)
  if (!existingColumns.has('artifact_path')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN artifact_path TEXT')
  }

  // Migration: Add project_id column (Story 3.1.5)
  if (!existingColumns.has('project_id')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id)')
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)')
  }

  // Ensure any existing tasks with NULL task_type get the default 'story' value
  sqlite.exec("UPDATE tasks SET task_type = 'story' WHERE task_type IS NULL")

  // Ensure projects table exists (Story 3.1.5)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      last_opened_at INTEGER
    )
  `)
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at)')

  // Ensure epics table has project_id (Story 3.1.5)
  const epicColumns = sqlite
    .prepare("PRAGMA table_info(epics)")
    .all() as Array<{ name: string }>
  if (epicColumns.length > 0 && !epicColumns.some((c) => c.name === 'project_id')) {
    sqlite.exec('ALTER TABLE epics ADD COLUMN project_id TEXT REFERENCES projects(id)')
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id)')
  }

  // Ensure sprints table has project_id (Story 3.1.5)
  const sprintColumns = sqlite
    .prepare("PRAGMA table_info(sprints)")
    .all() as Array<{ name: string }>
  if (sprintColumns.length > 0 && !sprintColumns.some((c) => c.name === 'project_id')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN project_id TEXT REFERENCES projects(id)')
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id)')
  }

  // Migration: Add story_number column to tasks (Story 3.7)
  // Note: Changed to TEXT type to support "2b", "3", etc. suffixes
  if (!existingColumns.has('story_number')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN story_number TEXT')
  }

  // Migration: Add story_file_path and full_content columns to tasks (Story 3.7)
  if (!existingColumns.has('story_file_path')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN story_file_path TEXT')
  }
  if (!existingColumns.has('full_content')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN full_content TEXT')
  }

  // Migration: Add story_file_status column to tasks (Story 5.2c)
  if (!existingColumns.has('story_file_status')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN story_file_status TEXT')
  }

  // Migration: Add context_notes column to tasks (Story 5.5)
  if (!existingColumns.has('context_notes')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN context_notes TEXT')
  }

  // Migration: Add worktree_path column to tasks (Story 8.2)
  if (!existingColumns.has('worktree_path')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN worktree_path TEXT')
  }

  // Migration: Add branch_name column to tasks (Story 8.3)
  if (!existingColumns.has('branch_name')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN branch_name TEXT')
  }

  // Migration: Add merge_commit_sha column to tasks (Story 8.5)
  if (!existingColumns.has('merge_commit_sha')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN merge_commit_sha TEXT')
  }

  // Migration: Add has_merge_conflict and conflict_files columns to tasks (Story 8.7)
  if (!existingColumns.has('has_merge_conflict')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN has_merge_conflict INTEGER DEFAULT 0')
  }
  if (!existingColumns.has('conflict_files')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN conflict_files TEXT')
  }

  // Migration: Add worktree_skipped column to tasks (Story 8.10)
  if (!existingColumns.has('worktree_skipped')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN worktree_skipped INTEGER DEFAULT 0')
  }

  // Migration: Add rejection_feedback column to tasks (Story 7.4)
  if (!existingColumns.has('rejection_feedback')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN rejection_feedback TEXT')
  }

  // Migration: Add rejected_agent_run_id column to tasks (Story 7.4 AC 3)
  if (!existingColumns.has('rejected_agent_run_id')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN rejected_agent_run_id TEXT REFERENCES agent_runs(id)')
  }

  // Migration: Add inline_comments column to tasks (Story 7.5)
  if (!existingColumns.has('inline_comments')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN inline_comments TEXT')
  }

  // Migration: Add rejection_count column to tasks (Story 7.6)
  if (!existingColumns.has('rejection_count')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN rejection_count INTEGER DEFAULT 0 NOT NULL')
  }

  // Migration: Add last_review_commit column to tasks (Story 7.6)
  if (!existingColumns.has('last_review_commit')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN last_review_commit TEXT')
  }

  // Migration: Add epic_number and goal columns to epics (Story 3.7)
  const epicColumnsCheck = sqlite
    .prepare("PRAGMA table_info(epics)")
    .all() as Array<{ name: string }>
  const epicColNames = new Set(epicColumnsCheck.map((c) => c.name))
  if (epicColumnsCheck.length > 0 && !epicColNames.has('epic_number')) {
    sqlite.exec('ALTER TABLE epics ADD COLUMN epic_number INTEGER')
  }
  if (epicColumnsCheck.length > 0 && !epicColNames.has('goal')) {
    sqlite.exec('ALTER TABLE epics ADD COLUMN goal TEXT')
  }

  // === Architecture Addendum: Sprint Management Migrations ===

  // Migration: Add sprint_id column to epics
  if (epicColumnsCheck.length > 0 && !epicColNames.has('sprint_id')) {
    sqlite.exec('ALTER TABLE epics ADD COLUMN sprint_id TEXT')
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_epics_sprint_id ON epics(sprint_id)')
  }

  // Migration: Add new sprint columns and migrate is_active to status
  const sprintColumnsCheck = sqlite
    .prepare("PRAGMA table_info(sprints)")
    .all() as Array<{ name: string }>
  const sprintColNames = new Set(sprintColumnsCheck.map((c) => c.name))

  // Add status column if missing (replacing is_active)
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('status')) {
    sqlite.exec("ALTER TABLE sprints ADD COLUMN status TEXT NOT NULL DEFAULT 'planning'")
    // Migrate is_active = 1 to status = 'active'
    if (sprintColNames.has('is_active')) {
      sqlite.exec("UPDATE sprints SET status = 'active' WHERE is_active = 1")
    }
    sqlite.exec('CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status)')
  }

  // Add goal column to sprints
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('goal')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN goal TEXT')
  }

  // Add velocity column to sprints
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('velocity')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN velocity INTEGER')
  }

  // Add capacity column to sprints
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('capacity')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN capacity INTEGER')
  }

  // Migration: Add story_prefix column to sprints (for multi-epics-file support)
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('story_prefix')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN story_prefix TEXT')
  }

  // Migration: Add epics_file_path column to sprints (tracks source epics file)
  if (sprintColumnsCheck.length > 0 && !sprintColNames.has('epics_file_path')) {
    sqlite.exec('ALTER TABLE sprints ADD COLUMN epics_file_path TEXT')
  }

  // TES-2.1: Task activities table for event/activity logging
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_task_activities_event_type ON task_activities(event_type)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_task_activities_created_at ON task_activities(created_at)')
  sqlite.exec(
    'CREATE INDEX IF NOT EXISTS idx_task_activities_task_id_created_at ON task_activities(task_id, created_at)'
  )

  // === Migration: Create default sprints for projects without any sprints ===
  // This ensures every project has at least one sprint (Backlog)

  // Get all projects that have no sprints
  const projectsWithoutSprints = sqlite
    .prepare(`
      SELECT p.id FROM projects p
      LEFT JOIN sprints s ON s.project_id = p.id
      WHERE s.id IS NULL
    `)
    .all() as Array<{ id: string }>

  // Create default Backlog sprint for each project without sprints
  for (const project of projectsWithoutSprints) {
    const sprintId = crypto.randomUUID()
    sqlite
      .prepare(`
        INSERT INTO sprints (id, name, status, goal, project_id, created_at)
        VALUES (?, 'Backlog', 'active', 'Default sprint for organizing unscheduled work', ?, unixepoch())
      `)
      .run(sprintId, project.id)
  }

  // === Migration: Assign orphaned epics to their project's first sprint ===
  // Get all orphaned epics (those with project_id but no sprint_id)
  const orphanedEpics = sqlite
    .prepare(`
      SELECT e.id, e.project_id FROM epics e
      WHERE e.sprint_id IS NULL AND e.project_id IS NOT NULL
    `)
    .all() as Array<{ id: string; project_id: string }>

  // For each orphaned epic, assign it to the first sprint of its project
  for (const epic of orphanedEpics) {
    const firstSprint = sqlite
      .prepare(`
        SELECT id FROM sprints WHERE project_id = ? ORDER BY created_at ASC LIMIT 1
      `)
      .get(epic.project_id) as { id: string } | undefined

    if (firstSprint) {
      sqlite
        .prepare('UPDATE epics SET sprint_id = ? WHERE id = ?')
        .run(firstSprint.id, epic.id)
    }
  }
}

const dbPath = getDbPath()
ensureDbDirectory(dbPath)

const sqlite = new Database(dbPath)

// Enable WAL mode for better crash resilience (NFR15, NFR16)
sqlite.pragma('journal_mode = WAL')

// Apply incremental migrations for backwards compatibility
applyIncrementalMigrations(sqlite)

export const db = drizzle({ client: sqlite, schema })
