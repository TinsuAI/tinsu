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
  // Get existing columns in tasks table
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
}

const dbPath = getDbPath()
ensureDbDirectory(dbPath)

const sqlite = new Database(dbPath)

// Enable WAL mode for better crash resilience (NFR15, NFR16)
sqlite.pragma('journal_mode = WAL')

// Apply incremental migrations for backwards compatibility
applyIncrementalMigrations(sqlite)

export const db = drizzle({ client: sqlite, schema })
