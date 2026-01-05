/**
 * Import BMAD stories from sprint-status.yaml into the SQLite database
 *
 * Run with: npx tsx scripts/import-bmad-stories.ts
 */

import Database from 'better-sqlite3'
import * as yaml from 'js-yaml'
import { readFileSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// Paths
const projectRoot = path.resolve(__dirname, '..')
const dbPath = path.join(projectRoot, 'data', 'tinsu.db')
const sprintStatusPath = path.join(
  projectRoot,
  '_bmad-output/implementation-artifacts/sprint-status.yaml'
)

// Status mapping: BMAD status -> Task status
const statusMap: Record<string, string> = {
  backlog: 'backlog',
  'ready-for-dev': 'backlog',
  'in-progress': 'in_progress',
  review: 'review',
  done: 'done',
  optional: 'backlog', // retrospectives marked optional go to backlog
  deferred: 'backlog' // deferred items go to backlog
}

// Parse story key into title (e.g., "1-1-initialize-electron-project" -> "Initialize Electron Project")
function storyKeyToTitle(key: string): string {
  // Remove story number prefix (e.g., "1-1-" or "2-1-")
  const withoutPrefix = key.replace(/^\d+-\d+-/, '')
  // Convert kebab-case to Title Case
  return withoutPrefix
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Extract epic number from story key
function extractEpicNumber(key: string): string | null {
  const match = key.match(/^(\d+)-\d+/)
  return match ? match[1] : null
}

// Check if key is an epic (not a story)
function isEpicKey(key: string): boolean {
  return key.startsWith('epic-') || key.endsWith('-retrospective')
}

interface SprintStatus {
  development_status: Record<string, string>
}

async function main() {
  console.log('Reading sprint status from:', sprintStatusPath)

  // Read and parse YAML
  const yamlContent = readFileSync(sprintStatusPath, 'utf-8')
  const sprintStatus = yaml.load(yamlContent) as SprintStatus

  if (!sprintStatus?.development_status) {
    console.error('Invalid sprint-status.yaml: missing development_status')
    process.exit(1)
  }

  // Connect to database
  console.log('Connecting to database:', dbPath)
  const db = new Database(dbPath)

  // Check current task count
  const countBefore = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
  console.log(`Current tasks in database: ${countBefore.count}`)

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO tasks (id, title, description, status, epic_id, sprint_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Process stories
  let imported = 0
  let skipped = 0
  const epicIds: Record<string, string> = {}
  const now = new Date().toISOString()

  // First pass: create epic IDs
  for (const [key] of Object.entries(sprintStatus.development_status)) {
    if (key.startsWith('epic-') && !key.includes('-retrospective')) {
      const epicNum = key.replace('epic-', '')
      epicIds[epicNum] = `epic-${epicNum}`
    }
  }

  // Second pass: import stories
  for (const [key, bmadStatus] of Object.entries(sprintStatus.development_status)) {
    // Skip epic entries and retrospectives
    if (isEpicKey(key)) {
      console.log(`  Skipping epic/retro: ${key}`)
      skipped++
      continue
    }

    // Skip comments (lines starting with #)
    if (key.startsWith('#')) {
      continue
    }

    const title = storyKeyToTitle(key)
    const taskStatus = statusMap[bmadStatus] || 'backlog'
    const epicNum = extractEpicNumber(key)
    const epicId = epicNum ? epicIds[epicNum] || null : null
    const description = `Imported from BMAD: ${key}`

    try {
      insert.run(randomUUID(), title, description, taskStatus, epicId, null, now, now)
      console.log(`  Imported: ${title} (${taskStatus})`)
      imported++
    } catch (err: unknown) {
      const error = err as Error
      console.error(`  Failed to import ${key}: ${error.message}`)
    }
  }

  // Check final count
  const countAfter = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }

  console.log('\n--- Import Summary ---')
  console.log(`Stories imported: ${imported}`)
  console.log(`Entries skipped: ${skipped}`)
  console.log(`Total tasks in database: ${countAfter.count}`)

  db.close()
}

main().catch(console.error)
