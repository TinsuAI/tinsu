import { promisify } from 'util'
import { exec } from 'child_process'
import { app } from 'electron'
import { gzip, gunzip } from 'zlib'
import { mkdir, writeFile, readFile, rm, rename, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { TaskTerminalService } from './task-terminal.service'
import { db } from '../db'

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
 * Zod schema for backup metadata validation
 */
const BackupMetadataSchema = z.object({
  lines: z.number(),
  bytes: z.number(),
  lastBackup: z.string(), // ISO 8601
  tmuxSession: z.string()
})

/**
 * Metadata stored with each backup
 */
export type BackupMetadata = z.infer<typeof BackupMetadataSchema>

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
      } catch {
        /* ignore cleanup errors */
      }
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
      try {
        const hasSession = await TaskTerminalService.hasSession(taskId)
        if (!hasSession) {
          // Session gone, stop periodic backup
          this.stopPeriodicBackup(taskId)
          return
        }
        await this.backupScrollback(taskId)
      } catch (error) {
        console.warn(`[ScrollbackBackupService] Periodic backup error for ${taskId}:`, error)
        // Continue running - don't stop timer on transient errors
      }
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
      sessions.map((session) => this.backupScrollback(session.task_id))
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
   * Named to match architecture spec: backupOnShutdown()
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
      const parsed = JSON.parse(content)
      return BackupMetadataSchema.parse(parsed)
    } catch (error) {
      console.warn(`[ScrollbackBackupService] Failed to read metadata for ${taskId}:`, error)
      return null
    }
  }

  /**
   * Deletes backup for a task.
   */
  static async deleteBackup(taskId: string): Promise<void> {
    // Stop any active periodic backup for this task
    this.stopPeriodicBackup(taskId)

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

    return readdir(basePath)
  }

  /** Clears all timers. For testing. */
  static clearTimers(): void {
    for (const timer of this.activeTimers.values()) {
      clearInterval(timer)
    }
    this.activeTimers.clear()
  }

  /** Gets active timer count. For testing. */
  static getActiveTimerCount(): number {
    return this.activeTimers.size
  }

  /** Checks if a task has an active periodic backup timer. For testing. */
  static hasActiveTimer(taskId: string): boolean {
    return this.activeTimers.has(taskId)
  }
}
