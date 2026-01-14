import { z } from 'zod'
import { BrowserWindow } from 'electron'
import path from 'path'
import { existsSync } from 'fs'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, epics } from '../../db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { StorySyncService } from '../../services/story-sync.service'
import { FileWatcherService } from '../../services/file-watcher.service'
import { DetailedStoryParserService } from '../../services/detailed-story-parser.service'

// Singleton file watcher instance
const fileWatcher = new FileWatcherService()

/**
 * Map file status strings to database status values.
 * File uses kebab-case (ready-for-dev), DB uses snake_case (backlog) or plain (done).
 */
function mapFileStatusToDbStatus(fileStatus: string): string {
  const statusMap: Record<string, string> = {
    'ready-for-dev': 'create_story',
    'in-progress': 'in_progress',
    review: 'review',
    done: 'done',
    // Handle DB status values that might appear in files
    backlog: 'backlog',
    create_story: 'create_story',
    in_progress: 'in_progress'
  }
  return statusMap[fileStatus.toLowerCase()] || 'backlog'
}

/**
 * Map database status values to file status strings.
 */
function mapDbStatusToFileStatus(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    backlog: 'ready-for-dev',
    create_story: 'ready-for-dev',
    in_progress: 'in-progress',
    review: 'review',
    done: 'done'
  }
  return statusMap[dbStatus] || 'ready-for-dev'
}

export const syncRouter = router({
  /**
   * Sync task status to story file.
   * Updates the Status: line in the markdown file to match the new status.
   */
  syncStatusToFile: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        newStatus: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Skip if no file path (AC: 6)
      if (!task.story_file_path) {
        return { synced: false, reason: 'no_file_path' }
      }

      try {
        await StorySyncService.updateStoryFileStatus(task.story_file_path, input.newStatus)
        return { synced: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync to file: ${(error as Error).message}`
        })
      }
    }),

  /**
   * Sync task content from story file.
   * Updates the task in the database with the current file content and status.
   */
  syncFromFile: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      if (!task.story_file_path) {
        return { synced: false, reason: 'no_file_path' }
      }

      try {
        const fileContent = await StorySyncService.readStoryFileContent(task.story_file_path)

        // Update task in database
        const updated = ctx.db
          .update(tasks)
          .set({
            status: mapFileStatusToDbStatus(fileContent.status),
            full_content: fileContent.fullContent,
            updated_at: new Date()
          })
          .where(eq(tasks.id, input.taskId))
          .returning()
          .get()

        return { synced: true, task: updated }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync from file: ${(error as Error).message}`
        })
      }
    }),

  /**
   * Check if file has changes compared to database.
   */
  checkFileChanges: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      if (!task.story_file_path) {
        return { hasChanges: false }
      }

      try {
        const hasChanges = await StorySyncService.detectFileChanges(
          task.story_file_path,
          task.full_content || ''
        )

        return { hasChanges }
      } catch {
        return { hasChanges: false }
      }
    }),

  /**
   * Detect conflicts between database and file.
   * Returns detailed information about what conflicts exist.
   */
  detectConflict: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      if (!task.story_file_path) {
        return { hasConflict: false }
      }

      try {
        const fileContent = await StorySyncService.readStoryFileContent(task.story_file_path)

        const fileDbStatus = mapFileStatusToDbStatus(fileContent.status)
        const hasStatusConflict = fileDbStatus !== task.status
        const hasContentConflict = fileContent.fullContent !== (task.full_content || '')
        const hasConflict = hasStatusConflict || hasContentConflict

        return {
          hasConflict,
          hasStatusConflict,
          hasContentConflict,
          kanbanStatus: task.status,
          fileStatus: fileContent.status,
          kanbanContent: task.full_content || '',
          fileContent: fileContent.fullContent
        }
      } catch {
        return { hasConflict: false }
      }
    }),

  /**
   * Resolve a conflict between database and file.
   * keepKanban=true: Update file to match database
   * keepKanban=false: Update database to match file
   */
  resolveConflict: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        keepKanban: z.boolean()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      if (!task.story_file_path) {
        return { resolved: false, reason: 'no_file_path' }
      }

      try {
        if (input.keepKanban) {
          // Update file to match database
          const fileStatus = mapDbStatusToFileStatus(task.status)
          await StorySyncService.updateStoryFileStatus(task.story_file_path, fileStatus)
          return { resolved: true, task }
        } else {
          // Update database to match file
          const fileContent = await StorySyncService.readStoryFileContent(task.story_file_path)
          const updated = ctx.db
            .update(tasks)
            .set({
              status: mapFileStatusToDbStatus(fileContent.status),
              full_content: fileContent.fullContent,
              updated_at: new Date()
            })
            .where(eq(tasks.id, input.taskId))
            .returning()
            .get()

          return { resolved: true, task: updated }
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to resolve conflict: ${(error as Error).message}`
        })
      }
    }),

  /**
   * Start watching story files for changes.
   * When a file changes, sends IPC message to renderer with task info.
   * Story 3.9: Bidirectional Sync (AC: 2)
   */
  startWatching: publicProcedure
    .input(z.object({ projectPath: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Implementation artifacts directory
      const watchPath = path.join(input.projectPath, '_bmad-output', 'implementation-artifacts')

      fileWatcher.startWatching(watchPath, async (filePath: string) => {
        console.log(`[FileWatcher] File changed: ${filePath}`)

        // Find task with this file path
        // Note: Normalize path for comparison (chokidar may emit different formats)
        const normalizedPath = path.normalize(filePath)
        const task = ctx.db
          .select()
          .from(tasks)
          .where(isNotNull(tasks.story_file_path))
          .all()
          .find((t) => t.story_file_path && path.normalize(t.story_file_path) === normalizedPath)

        if (task) {
          console.log(`[FileWatcher] Found task: ${task.id} - ${task.title}`)
          // Send IPC message to renderer
          const windows = BrowserWindow.getAllWindows()
          for (const win of windows) {
            win.webContents.send('file-change', {
              taskId: task.id,
              taskTitle: task.title,
              filePath: task.story_file_path
            })
          }
        } else {
          console.log(`[FileWatcher] No task found for path: ${normalizedPath}`)
        }
      })

      return { watching: true, path: watchPath }
    }),

  /**
   * Stop watching story files.
   * Story 3.9: Bidirectional Sync
   */
  stopWatching: publicProcedure.mutation(async () => {
    await fileWatcher.stopWatching()
    return { watching: false }
  }),

  /**
   * Check if file watcher is active.
   * Story 3.9: Bidirectional Sync
   */
  isWatching: publicProcedure.query(() => {
    return { watching: fileWatcher.isWatching() }
  }),

  /**
   * Sync all story tasks from their files AND import new story files.
   * Story 3.9: Bidirectional Sync - Single "Sync All" button
   *
   * This does two things:
   * 1. Syncs existing stories from their files (update content/status)
   * 2. Imports new story files that don't exist in the database yet
   *
   * When sprintId is provided, only syncs tasks in that sprint and assigns
   * new imported stories to that sprint.
   */
  syncAllFromFiles: publicProcedure
    .input(z.object({
      projectPath: z.string().optional(),
      sprintId: z.string().optional()
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const results: { taskId: string; synced: boolean; error?: string; isNew?: boolean }[] = []

      // Get all story tasks with file paths, optionally filtered by sprint
      let storyTasksQuery = ctx.db
        .select()
        .from(tasks)
        .where(isNotNull(tasks.story_file_path))

      const allStoryTasks = storyTasksQuery.all()

      // Filter by sprint if provided
      const storyTasks = input?.sprintId
        ? allStoryTasks.filter(t => t.sprint_id === input.sprintId)
        : allStoryTasks

      // Build a set of existing file paths for quick lookup
      const existingFilePaths = new Set(
        storyTasks.map((t) => t.story_file_path).filter(Boolean) as string[]
      )

      // 1. Sync existing stories from their files
      for (const task of storyTasks) {
        if (!task.story_file_path) continue

        try {
          const fileContent = await StorySyncService.readStoryFileContent(task.story_file_path)

          ctx.db
            .update(tasks)
            .set({
              status: mapFileStatusToDbStatus(fileContent.status),
              full_content: fileContent.fullContent,
              updated_at: new Date()
            })
            .where(eq(tasks.id, task.id))
            .run()

          results.push({ taskId: task.id, synced: true })
        } catch (error) {
          results.push({ taskId: task.id, synced: false, error: (error as Error).message })
        }
      }

      // 2. Find and import new story files
      console.log(`[SyncAll] Part 2: Looking for new story files to import...`)
      // Determine implementation-artifacts path
      let artifactsDir: string | null = null

      if (input?.projectPath) {
        artifactsDir = path.join(input.projectPath, '_bmad-output', 'implementation-artifacts')
      } else {
        // Try to get from first task's file path
        const firstTaskWithPath = storyTasks.find((t) => t.story_file_path)
        if (firstTaskWithPath?.story_file_path) {
          artifactsDir = path.dirname(firstTaskWithPath.story_file_path)
        }
      }

      if (artifactsDir && existsSync(artifactsDir)) {
        try {
          // Scan for all story files
          const allStoryFiles = await DetailedStoryParserService.scanDetailedStories(artifactsDir)

          console.log(`[SyncAll] Found ${allStoryFiles.size} story files in ${artifactsDir}`)
          console.log(`[SyncAll] Existing file paths in DB: ${existingFilePaths.size}`, [...existingFilePaths])

          // Find new files that aren't in the database yet
          for (const [storyKey, detailedStory] of allStoryFiles) {
            const normalizedFilePath = path.normalize(detailedStory.filePath)

            // Check if this file is already in the database
            const isExisting = [...existingFilePaths].some(
              (existingPath) => path.normalize(existingPath) === normalizedFilePath
            )

            console.log(`[SyncAll] Checking ${storyKey}: ${normalizedFilePath} - isExisting=${isExisting}`)

            if (!isExisting) {
              // This file isn't linked to a task yet - check if task exists by epic+story_number
              try {
                // Parse story key - storyNum may have letters like "3b" so keep as string
                const keyParts = storyKey.split('-')
                const epicNum = parseInt(keyParts[0], 10)
                const storyNum = keyParts.slice(1).join('-') // Keep as string: "3", "3b", "1-5"

                console.log(`[SyncAll] Processing unlinked file: ${storyKey} -> epicNum=${epicNum}, storyNum="${storyNum}"`)

                // Look up epic by epic_number column, optionally filtered by sprint
                const matchingEpics = ctx.db
                  .select()
                  .from(epics)
                  .where(eq(epics.epic_number, epicNum))
                  .all()

                // If sprint is specified, filter to only epics in that sprint
                const existingEpic = input?.sprintId
                  ? matchingEpics.find(e => e.sprint_id === input.sprintId)
                  : matchingEpics[0]

                if (!existingEpic) {
                  const reason = input?.sprintId
                    ? `Epic ${epicNum} not found in selected sprint`
                    : `Epic ${epicNum} not found in database`
                  console.log(`[SyncAll] Skipping story ${storyKey} - ${reason}`)
                  continue
                }

                console.log(`[SyncAll] Found epic: ${existingEpic.id} (${existingEpic.title})`)

                // Parse the story file content
                const fileContent = await StorySyncService.readStoryFileContent(
                  detailedStory.filePath
                )

                // Check if task already exists by epic_id + story_number (may be missing story_file_path)
                const tasksInEpic = ctx.db
                  .select()
                  .from(tasks)
                  .where(eq(tasks.epic_id, existingEpic.id))
                  .all()

                console.log(`[SyncAll] Tasks in epic ${epicNum}:`, tasksInEpic.map(t => ({ id: t.id, story_number: t.story_number, title: t.title?.substring(0, 30) })))

                const existingTask = tasksInEpic.find((t) => t.story_number === storyNum)

                console.log(`[SyncAll] Looking for story_number="${storyNum}", found:`, existingTask ? existingTask.id : 'null')

                if (existingTask) {
                  // Task exists but wasn't linked to file - update it
                  ctx.db
                    .update(tasks)
                    .set({
                      story_file_path: detailedStory.filePath,
                      full_content: detailedStory.fullContent,
                      status: mapFileStatusToDbStatus(fileContent.status),
                      story_file_status: 'story_ready', // Story 5.2c: File exists = story_ready
                      updated_at: new Date()
                    })
                    .where(eq(tasks.id, existingTask.id))
                    .run()

                  results.push({ taskId: existingTask.id, synced: true })
                  console.log(
                    `[SyncAll] Linked existing task ${existingTask.id} to file: ${detailedStory.filePath}`
                  )
                  continue
                }

                // Extract title from "# Story X.Y: Title" pattern
                const titleMatch = detailedStory.fullContent.match(/^# Story \d+\.\d+:\s*(.+)$/m)
                const storyTitle = titleMatch
                  ? titleMatch[1].trim()
                  : `Story ${epicNum}.${storyNum}`

                // Get the next sort order for this status
                const existingTasksInStatus = ctx.db
                  .select()
                  .from(tasks)
                  .where(eq(tasks.status, mapFileStatusToDbStatus(fileContent.status)))
                  .all()
                const maxSortOrder = Math.max(0, ...existingTasksInStatus.map((t) => t.sort_order))

                // Create the new task
                const newTaskId = crypto.randomUUID()
                ctx.db
                  .insert(tasks)
                  .values({
                    id: newTaskId,
                    title: storyTitle,
                    description: null,
                    status: mapFileStatusToDbStatus(fileContent.status),
                    sort_order: maxSortOrder + 1,
                    epic_id: existingEpic.id,
                    sprint_id: input?.sprintId || existingEpic.sprint_id || null,
                    project_id: existingEpic.project_id,
                    task_type: 'story',
                    story_number: storyNum,
                    story_file_path: detailedStory.filePath,
                    full_content: detailedStory.fullContent,
                    story_file_status: 'story_ready', // Story 5.2c: File exists = story_ready
                    created_at: new Date(),
                    updated_at: new Date()
                  })
                  .run()

                results.push({ taskId: newTaskId, synced: true, isNew: true })
                console.log(`[SyncAll] Imported new story: ${storyTitle} (${storyKey})`)
              } catch (error) {
                console.error(`[SyncAll] Failed to import story ${storyKey}:`, error)
                results.push({
                  taskId: storyKey,
                  synced: false,
                  isNew: true,
                  error: (error as Error).message
                })
              }
            }
          }
        } catch (error) {
          console.error('[SyncAll] Failed to scan for new story files:', error)
        }
      }

      const syncedCount = results.filter((r) => r.synced && !r.isNew).length
      const importedCount = results.filter((r) => r.synced && r.isNew).length
      const failedCount = results.filter((r) => !r.synced).length

      return { syncedCount, importedCount, failedCount, results }
    })
})
