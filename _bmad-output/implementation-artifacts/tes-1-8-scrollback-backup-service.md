# Story TES-1.8: Scrollback Backup Service

Status: done

---

## Story

As a user,
I want my terminal history backed up automatically,
So that I don't lose important output if something goes wrong.

## Acceptance Criteria

1. **Given** a task has an active tmux session, **When** the task status changes (e.g., In Progress → Review), **Then** ScrollbackBackupService captures scrollback via `tmux capture-pane -p -S -50000`, **And** saves it to `{userData}/terminal-history/{taskId}/scrollback.txt.gz`, **And** updates metadata.json with line count and timestamp

2. **Given** a task is active (In Progress status), **When** 5 minutes have passed since last backup, **Then** a periodic backup is triggered automatically

3. **Given** the app is shutting down, **When** there are active tmux sessions, **Then** all sessions have their scrollback backed up before exit

## Tasks / Subtasks

- [x] Task 1: Create ScrollbackBackupService with core backup methods (AC: #1)
  - [x] 1.1: Create `src/main/services/scrollback-backup.service.ts` with `backupScrollback(taskId)` method
  - [x] 1.2: Implement `captureScrollback(taskId)` using `tmux capture-pane -p -S -50000 -t {sessionName}`
  - [x] 1.3: Implement gzip compression of scrollback content using Node.js `zlib.gzip()`
  - [x] 1.4: Create backup directory structure: `{userData}/terminal-history/{taskId}/`
  - [x] 1.5: Save compressed scrollback to `scrollback.txt.gz` using atomic write (temp file + rename)
  - [x] 1.6: Update/create `metadata.json` with `{ lines, lastBackup, tmuxSession, bytes }`
  - [x] 1.7: Write unit tests for core backup functionality in `scrollback-backup.service.test.ts`

- [x] Task 2: Implement status change backup trigger (AC: #1)
  - [x] 2.1: Add `backupOnStatusChange(taskId)` public method that calls `backupScrollback()`
  - [x] 2.2: Add error handling - log warning on backup failure but don't block status change
  - [x] 2.3: Only backup if task has an active tmux session (check via TaskTerminalService)
  - [ ] 2.4: Wire into task status update flow (agent.router or task.router mutation) - **DEFERRED: Integration story**
  - [x] 2.5: Write tests for status change trigger

- [x] Task 3: Implement periodic backup mechanism (AC: #2)
  - [x] 3.1: Add `startPeriodicBackup(taskId, intervalMs = 300000)` method (5 min default)
  - [x] 3.2: Use `setInterval` with tracking in `activeTimers: Map<string, NodeJS.Timeout>`
  - [x] 3.3: Add `stopPeriodicBackup(taskId)` method to clear interval
  - [x] 3.4: Prevent duplicate timers for same taskId
  - [ ] 3.5: Auto-start periodic backup when session created (integrate with TaskTerminalService) - **DEFERRED: Integration story**
  - [ ] 3.6: Auto-stop periodic backup when session killed - **DEFERRED: Integration story**
  - [x] 3.7: Write tests for periodic backup start/stop

- [x] Task 4: Implement app shutdown backup (AC: #3)
  - [x] 4.1: Add `backupAllActiveSessions()` method that iterates all task_sessions records
  - [x] 4.2: Export `backupOnShutdown()` hook for main process to call during app quit
  - [x] 4.3: Use `Promise.allSettled()` to backup all sessions concurrently
  - [x] 4.4: Log any backup failures but don't block shutdown
  - [x] 4.5: Clear all periodic backup timers on shutdown
  - [ ] 4.6: Register shutdown handler in main/index.ts `app.on('before-quit')` - **DEFERRED: Integration story**
  - [x] 4.7: Write tests for shutdown backup flow

- [x] Task 5: Add restore method for TES-1.9 preparation (AC: related to future story)
  - [x] 5.1: Add `restoreScrollback(taskId): Promise<string | null>` method
  - [x] 5.2: Read and decompress `scrollback.txt.gz` using `zlib.gunzip()`
  - [x] 5.3: Return null if no backup exists
  - [x] 5.4: Add `getBackupMetadata(taskId)` method to read metadata.json
  - [x] 5.5: Write tests for restore functionality

- [x] Task 6: Add cleanup and utility methods (AC: maintenance)
  - [x] 6.1: Add `deleteBackup(taskId)` method to remove backup directory
  - [x] 6.2: Add `getBackupPath(taskId)` helper method for consistent path generation
  - [x] 6.3: Add `listBackups()` method for debugging/admin purposes
  - [x] 6.4: Ensure ON DELETE CASCADE cleans up timers (call stopPeriodicBackup) - In deleteBackup
  - [x] 6.5: Write tests for cleanup methods

## Dev Notes

### Architecture Compliance

This story implements **FR39, FR41-FR43** (Scrollback Persistence) from the Task Execution Sandbox PRD:

- **FR39:** System can backup terminal scrollback to filesystem
- **FR41:** System can backup scrollback on status change
- **FR42:** System can backup scrollback periodically (every 5 minutes while active)
- **FR43:** System can backup scrollback on app shutdown

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#scrollback-persistence]

### Technical Requirements

**Service Interface (from Architecture):**

```typescript
interface ScrollbackBackupService {
  // Backup triggers
  backupOnStatusChange(taskId: string): Promise<void>
  startPeriodicBackup(taskId: string, intervalMs?: number): void
  stopPeriodicBackup(taskId: string): void
  backupOnShutdown(): Promise<void>  // ✅ Matches architecture spec

  // Restore (for TES-1.9)
  restoreScrollback(taskId: string): Promise<string | null>

  // Cleanup
  deleteBackup(taskId: string): Promise<void>
}
```

[Source: _bmad-output/planning-artifacts/architecture.md#scrollbackbackupservice]

**Storage Location:**

```
{app.getPath('userData')}/terminal-history/
└── {taskId}/
    ├── scrollback.txt.gz     # Compressed scrollback
    ├── metadata.json         # { lines: 5000, lastBackup: '...', tmuxSession: '...' }
    └── transcript.json       # Claude Code transcript (from hook) - future TES-2.x
```

[Source: _bmad-output/planning-artifacts/architecture.md#storage-location]

**tmux Capture Command:**

```bash
# Capture last 50000 lines of scrollback
tmux capture-pane -p -S -50000 -t tinsu-{projectName}-{taskId}
```

- `-p` outputs to stdout (not tmux buffer)
- `-S -50000` starts capture 50000 lines back
- `-t` specifies target session

### Code Patterns (Following TaskTerminalService)

**Service Structure:**

```typescript
// src/main/services/scrollback-backup.service.ts
import { promisify } from 'util'
import { exec } from 'child_process'
import { app } from 'electron'
import { gzip, gunzip } from 'zlib'
import { mkdir, writeFile, readFile, rm, rename } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { TaskTerminalService } from './task-terminal.service'
import { db } from '../db'
import { task_sessions } from '../db/schema'

const execAsync = promisify(exec)
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/** Timeout for tmux capture command */
const TMUX_CAPTURE_TIMEOUT = 10000

/** Default periodic backup interval (5 minutes) */
const DEFAULT_BACKUP_INTERVAL = 300000

/** Maximum lines to capture from scrollback */
const MAX_SCROLLBACK_LINES = 50000

/**
 * Metadata stored with each backup
 */
interface BackupMetadata {
  lines: number
  bytes: number
  lastBackup: string // ISO 8601
  tmuxSession: string
}

/**
 * Service for backing up and restoring terminal scrollback.
 *
 * Scrollback is captured from tmux sessions and stored compressed
 * on the filesystem for persistence across app restarts and reboots.
 *
 * CRITICAL: This service runs in the main process only.
 *
 * @see TES-1.8: Scrollback Backup Service
 */
export class ScrollbackBackupService {
  /** Active periodic backup timers: taskId -> timer */
  private static activeTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Gets the base path for terminal history storage.
   * Uses Electron's userData path for cross-platform compatibility.
   */
  static getBasePath(): string {
    return path.join(app.getPath('userData'), 'terminal-history')
  }

  /**
   * Gets the backup directory path for a specific task.
   */
  static getBackupPath(taskId: string): string {
    return path.join(this.getBasePath(), taskId)
  }

  /**
   * Captures scrollback from a task's tmux session.
   *
   * @param taskId - The task's unique identifier
   * @returns The captured scrollback text, or null if no session
   */
  static async captureScrollback(taskId: string): Promise<string | null> {
    const sessionName = await TaskTerminalService.getSessionName(taskId)
    if (!sessionName) {
      return null
    }

    // Verify session exists
    const hasSession = await TaskTerminalService.hasSession(taskId)
    if (!hasSession) {
      return null
    }

    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -p -S -${MAX_SCROLLBACK_LINES} -t ${sessionName}`,
        { timeout: TMUX_CAPTURE_TIMEOUT, maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
      )
      return stdout
    } catch (error) {
      console.warn(`[ScrollbackBackupService] Failed to capture scrollback for ${taskId}:`, error)
      return null
    }
  }

  /**
   * Backs up scrollback for a task to the filesystem.
   *
   * @param taskId - The task's unique identifier
   * @returns true if backup succeeded, false otherwise
   */
  static async backupScrollback(taskId: string): Promise<boolean> {
    const scrollback = await this.captureScrollback(taskId)
    if (!scrollback) {
      return false
    }

    const backupDir = this.getBackupPath(taskId)
    const scrollbackPath = path.join(backupDir, 'scrollback.txt.gz')
    const metadataPath = path.join(backupDir, 'metadata.json')
    const tempPath = path.join(backupDir, `scrollback.txt.gz.tmp.${Date.now()}`)

    try {
      // Ensure directory exists
      await mkdir(backupDir, { recursive: true })

      // Compress scrollback
      const compressed = await gzipAsync(Buffer.from(scrollback, 'utf-8'))

      // Atomic write: temp file + rename
      await writeFile(tempPath, compressed)
      await rename(tempPath, scrollbackPath)

      // Update metadata
      const sessionName = await TaskTerminalService.getSessionName(taskId)
      const metadata: BackupMetadata = {
        lines: scrollback.split('\n').length,
        bytes: compressed.length,
        lastBackup: new Date().toISOString(),
        tmuxSession: sessionName || ''
      }
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2))

      return true
    } catch (error) {
      console.warn(`[ScrollbackBackupService] Failed to backup ${taskId}:`, error)
      // Clean up temp file if it exists
      try {
        if (existsSync(tempPath)) {
          await rm(tempPath)
        }
      } catch { /* ignore cleanup errors */ }
      return false
    }
  }

  /**
   * Triggers backup when task status changes.
   * Logs warning on failure but does not throw.
   */
  static async backupOnStatusChange(taskId: string): Promise<void> {
    const hasSession = await TaskTerminalService.hasSession(taskId)
    if (!hasSession) {
      return // No session to backup
    }

    const success = await this.backupScrollback(taskId)
    if (!success) {
      console.warn(`[ScrollbackBackupService] Status change backup failed for ${taskId}`)
    }
  }

  /**
   * Starts periodic backup for a task.
   *
   * @param taskId - The task's unique identifier
   * @param intervalMs - Backup interval in milliseconds (default 5 min)
   */
  static startPeriodicBackup(taskId: string, intervalMs = DEFAULT_BACKUP_INTERVAL): void {
    // Prevent duplicate timers
    if (this.activeTimers.has(taskId)) {
      return
    }

    const timer = setInterval(async () => {
      const hasSession = await TaskTerminalService.hasSession(taskId)
      if (!hasSession) {
        // Session gone, stop periodic backup
        this.stopPeriodicBackup(taskId)
        return
      }
      await this.backupScrollback(taskId)
    }, intervalMs)

    this.activeTimers.set(taskId, timer)
  }

  /**
   * Stops periodic backup for a task.
   */
  static stopPeriodicBackup(taskId: string): void {
    const timer = this.activeTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.activeTimers.delete(taskId)
    }
  }

  /**
   * Backs up all active sessions. Call on app shutdown.
   */
  static async backupAllActiveSessions(): Promise<void> {
    // Get all task sessions from database
    const sessions = await db.query.task_sessions.findMany()

    // Backup all concurrently
    const results = await Promise.allSettled(
      sessions.map(session => this.backupScrollback(session.task_id))
    )

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(
          `[ScrollbackBackupService] Shutdown backup failed for ${sessions[index].task_id}:`,
          result.reason
        )
      }
    })
  }

  /**
   * App shutdown hook. Backups all sessions and clears timers.
   */
  static async backupOnShutdown(): Promise<void> {
    // Stop all periodic backups
    for (const taskId of this.activeTimers.keys()) {
      this.stopPeriodicBackup(taskId)
    }

    // Backup all active sessions
    await this.backupAllActiveSessions()
  }

  /**
   * Restores scrollback from backup.
   *
   * @param taskId - The task's unique identifier
   * @returns Decompressed scrollback text, or null if no backup
   */
  static async restoreScrollback(taskId: string): Promise<string | null> {
    const scrollbackPath = path.join(this.getBackupPath(taskId), 'scrollback.txt.gz')

    if (!existsSync(scrollbackPath)) {
      return null
    }

    try {
      const compressed = await readFile(scrollbackPath)
      const decompressed = await gunzipAsync(compressed)
      return decompressed.toString('utf-8')
    } catch (error) {
      console.warn(`[ScrollbackBackupService] Failed to restore ${taskId}:`, error)
      return null
    }
  }

  /**
   * Gets backup metadata for a task.
   */
  static async getBackupMetadata(taskId: string): Promise<BackupMetadata | null> {
    const metadataPath = path.join(this.getBackupPath(taskId), 'metadata.json')

    if (!existsSync(metadataPath)) {
      return null
    }

    try {
      const content = await readFile(metadataPath, 'utf-8')
      return JSON.parse(content) as BackupMetadata
    } catch (error) {
      console.warn(`[ScrollbackBackupService] Failed to read metadata for ${taskId}:`, error)
      return null
    }
  }

  /**
   * Deletes backup for a task.
   */
  static async deleteBackup(taskId: string): Promise<void> {
    const backupDir = this.getBackupPath(taskId)
    if (existsSync(backupDir)) {
      await rm(backupDir, { recursive: true })
    }
  }

  /**
   * Lists all backup directories (for debugging/admin).
   */
  static async listBackups(): Promise<string[]> {
    const basePath = this.getBasePath()
    if (!existsSync(basePath)) {
      return []
    }

    const { readdir } = await import('fs/promises')
    return readdir(basePath)
  }

  /** Clears all timers. For testing. */
  static clearTimers(): void {
    for (const timer of this.activeTimers.values()) {
      clearInterval(timer)
    }
    this.activeTimers.clear()
  }
}
```

### Previous Story Learnings (TES-1.7)

**From TES-1.7 Implementation:**
- Static service methods with in-memory state (Map) for tracking
- `clearCache()` / `clearTimers()` method for test isolation
- Use `console.warn` for non-critical failures (don't block main flow)
- Cache invalidation important for test isolation
- Integration tests verify full flow end-to-end

**From TaskTerminalService Pattern:**
- Use `promisify(exec)` for tmux commands
- Timeout of 5-10 seconds for tmux operations
- Check session exists before operations
- Atomic writes using temp file + rename pattern
- Graceful error handling - log and continue

**Existing Infrastructure:**
- `TaskTerminalService.getSessionName(taskId)` - get tmux session name
- `TaskTerminalService.hasSession(taskId)` - check if session exists
- `task_sessions` table tracks active sessions
- `app.getPath('userData')` for cross-platform storage path

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/scrollback-backup.service.ts` | CREATE | Scrollback backup service |
| `src/main/services/scrollback-backup.service.test.ts` | CREATE | Service unit tests |
| `src/main/index.ts` | MODIFY | Register shutdown handler |

### Project Structure Notes

- Service follows existing pattern from `task-terminal.service.ts`
- Static methods with internal state (activeTimers Map)
- Uses Electron's `app.getPath('userData')` for storage path
- Tests co-located with source files
- Integrates with TaskTerminalService for session info

### References

- [Architecture: ScrollbackBackupService](_bmad-output/planning-artifacts/architecture.md#scrollbackbackupservice)
- [PRD: FR39, FR41-FR43](_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#scrollback-persistence)
- [Epics: Story 1.8](_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-18-scrollback-backup-service)
- [Project Context: Service Patterns](_bmad-output/planning-artifacts/project-context.md#critical-implementation-rules)
- [TES-1.7 Implementation](_bmad-output/implementation-artifacts/tes-1-7-session-task-mapping-and-event-routing.md)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/scrollback-backup.service.test.ts
```

Test scenarios:
1. **captureScrollback:** Verify tmux capture-pane command executed correctly
2. **backupScrollback:** Verify gzip compression and atomic file write
3. **backupOnStatusChange:** Verify backup triggered, warning logged on failure
4. **startPeriodicBackup:** Verify interval created, no duplicates
5. **stopPeriodicBackup:** Verify interval cleared
6. **backupAllActiveSessions:** Verify all sessions backed up concurrently
7. **backupOnShutdown:** Verify timers cleared and all sessions backed up
8. **restoreScrollback:** Verify gunzip decompression and file read
9. **getBackupMetadata:** Verify JSON parsing
10. **deleteBackup:** Verify directory removal
11. **No session case:** Verify graceful handling when no tmux session

**Mocking Strategy:**
- Mock `child_process.exec` for tmux commands
- Mock `fs/promises` for file operations
- Mock `zlib` for compression/decompression
- Mock `TaskTerminalService` for session lookups
- Mock `db.query.task_sessions` for database queries
- Use `vi.useFakeTimers()` for periodic backup tests

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Scrollback capture | <5 seconds | 50000 lines max, 10s timeout |
| Backup write | <2 seconds | Gzip compression + atomic write |
| Periodic interval | 5 minutes | Configurable via parameter |
| Storage efficiency | ~90% compression | Gzip text compression ratio |
| Shutdown backup | <30 seconds | Concurrent backup of all sessions |
| Restore load | <2 seconds | Per NFR4 from PRD |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With TaskTerminalService:**
- Start periodic backup when session created (`createSession`)
- Stop periodic backup when session killed (`killSession`)
- Get session name for tmux commands

**With Status Change Flow:**
- Call `backupOnStatusChange()` when task status updates
- Wire into existing `updateStatus` mutation in task/agent router

**With App Lifecycle:**
- Register `backupOnShutdown()` in main process `app.on('before-quit')`

### Edge Cases to Handle

1. **No tmux session:** Return gracefully without error
2. **tmux capture fails:** Log warning, return null
3. **File write fails:** Log warning, clean up temp file
4. **Duplicate periodic backup:** Prevent via Map.has() check
5. **Session deleted during backup:** Check session exists before operations
6. **Large scrollback:** Use 50MB maxBuffer, gzip compression
7. **Concurrent backups:** Safe - each task has own directory

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tests passing: 31/31 in scrollback-backup.service.test.ts
- Integration verified with task-terminal.service.test.ts: 33/33 tests passing

### Completion Notes List

1. **Service Implementation Complete** - Created ScrollbackBackupService with all core methods following TaskTerminalService patterns
2. **Atomic File Writes** - Implemented temp file + rename pattern for safe backup writes
3. **Compression** - Gzip compression working via `zlib.gzip()` and `zlib.gunzip()`
4. **Timer Management** - activeTimers Map tracks periodic backups, with clearTimers() for test isolation
5. **Test Strategy** - Due to promisify mocking complexity, tests focus on control flow validation through dependency mocking (TaskTerminalService, fs/promises, etc.)
6. **Integration Points Prepared** - backupOnStatusChange, startPeriodicBackup, backupOnShutdown ready for integration in future stories

### File List

| File | Action | Status |
|------|--------|--------|
| `src/main/services/scrollback-backup.service.ts` | CREATE | ✅ Complete |
| `src/main/services/scrollback-backup.service.test.ts` | CREATE | ✅ 31 tests passing |

### Implementation Notes

- Service uses static methods with internal state (Map for timer tracking)
- Follows patterns from existing TaskTerminalService
- Export `BackupMetadata` type (via Zod inference) for consumers
- `clearTimers()` and `hasActiveTimer()` exposed for testing
- Ready for integration with TaskTerminalService (session create/kill hooks) and main/index.ts (shutdown handler)

### Code Review Fixes Applied (2026-01-13)

| Issue | Severity | Fix |
|-------|----------|-----|
| Unused `task_sessions` import | HIGH | Removed |
| Method name `onAppShutdown` didn't match architecture | HIGH | Renamed to `backupOnShutdown()` |
| Tasks 2.4, 3.5, 3.6, 4.6 marked [x] but deferred | HIGH | Unmarked, added **DEFERRED** label |
| No try/catch in periodic backup interval | MEDIUM | Added error handling |
| Unsafe `JSON.parse as` without validation | MEDIUM | Added Zod schema validation |

