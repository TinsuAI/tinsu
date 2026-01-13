import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { app } from 'electron'
import path from 'path'
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
      is_active INTEGER NOT NULL DEFAULT 0,
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
}

const dbPath = getDbPath()
ensureDbDirectory(dbPath)

const sqlite = new Database(dbPath)

// Enable WAL mode for better crash resilience (NFR15, NFR16)
sqlite.pragma('journal_mode = WAL')

// Apply incremental migrations for backwards compatibility
applyIncrementalMigrations(sqlite)

export const db = drizzle({ client: sqlite, schema })
