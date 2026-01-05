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

const dbPath = getDbPath()
ensureDbDirectory(dbPath)

const sqlite = new Database(dbPath)

// Enable WAL mode for better crash resilience (NFR15, NFR16)
sqlite.pragma('journal_mode = WAL')

export const db = drizzle({ client: sqlite, schema })
