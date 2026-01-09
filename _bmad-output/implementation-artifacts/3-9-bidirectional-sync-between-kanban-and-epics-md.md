# Story 3.9: Bidirectional Sync Between Kanban and Detail Story Files

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want changes in the Kanban board and detail story files to stay synchronized,
So that I can edit in either place without conflicts.

**Note:** Story 3.7 imports stories with `story_file_path` (path to detail file in `implementation-artifacts/`) and `full_content` (full story content). This story syncs with those detail files, NOT the epics.md summary.

## Acceptance Criteria

1. **Given** I move a story task to a different column
   **When** the status changes
   **Then** the corresponding detail story file (at task.story_file_path) is updated with the new status in frontmatter
   **And** the `Status:` field changes to match (e.g., "in-progress", "review", "done")
   **And** the file write completes within 1 second

2. **Given** I edit a detail story file externally (e.g., in VS Code)
   **When** I return to TinSu
   **Then** it detects file changes via file watcher on the task's `story_file_path`
   **And** a notification appears: "Story file changed. Sync now?"

3. **Given** I click "Sync now"
   **When** sync runs
   **Then** updated content (acceptance criteria, tasks, dev notes) is reflected in task.full_content
   **And** status changes in the file are reflected on the Kanban board
   **And** the task detail panel shows the updated content

4. **Given** both Kanban and file changed the same story
   **When** conflict is detected
   **Then** TinSu shows a diff view
   **And** I choose which version to keep

5. **Given** sync is in progress
   **When** I try to edit a task
   **Then** editing is blocked with "Syncing..." indicator
   **And** editing resumes after sync completes

6. **Given** a story task has no `story_file_path` (manually created task)
   **When** I try to sync
   **Then** the sync is skipped for that task
   **And** no error occurs

## Tasks / Subtasks

- [x] Task 1: Create StorySyncService for file operations (AC: 1, 2, 3, 6)
  - [x] Create `src/main/services/story-sync.service.ts`
  - [x] Implement `updateStoryFileStatus(filePath: string, newStatus: string): Promise<void>`
  - [x] Parse markdown file, find `Status:` line or YAML frontmatter status
  - [x] Update status value, preserve rest of file content
  - [x] Implement `readStoryFileContent(filePath: string): Promise<StoryFileContent>`
  - [x] Parse full_content, status, title from file
  - [x] Implement `detectFileChanges(filePath: string, knownContent: string): Promise<boolean>`
  - [x] Use fs.stat mtime comparison for quick change detection
  - [x] Handle missing files gracefully (task.story_file_path is null)
  - [x] Write tests in `src/main/services/story-sync.service.test.ts`

- [x] Task 2: Create FileWatcherService for monitoring story files (AC: 2)
  - [x] Create `src/main/services/file-watcher.service.ts`
  - [x] Use chokidar for cross-platform file watching (or native fs.watch)
  - [x] Implement `watchStoryFiles(projectPath: string, onChange: (filePath: string) => void): void`
  - [x] Watch `{implementation_artifacts}/*.md` pattern
  - [x] Debounce rapid changes (300ms) to avoid excessive notifications
  - [x] Implement `stopWatching(): void` for cleanup
  - [x] Handle watcher errors gracefully (file deleted, permissions)
  - [x] Write tests in `src/main/services/file-watcher.service.test.ts`

- [x] Task 3: Create sync.router for bidirectional sync operations (AC: 1, 2, 3)
  - [x] Create `src/main/trpc/routers/sync.router.ts`
  - [x] Implement `syncStoryStatus` mutation
    - Input: `{ taskId: string, newStatus: string }`
    - Update task in DB
    - Call StorySyncService to update file
    - Return updated task
  - [x] Implement `syncStoryFromFile` mutation
    - Input: `{ taskId: string }`
    - Read file content via StorySyncService
    - Update task.full_content and task.status in DB
    - Return updated task
  - [x] Implement `getFileChanges` query
    - Input: `{ taskId: string }`
    - Compare file mtime/content with DB
    - Return `{ hasChanges: boolean, fileContent?: string }`
  - [x] Implement `startFileWatching` mutation (start watcher for project)
  - [x] Implement `onFileChange` subscription (emit when file changes)
  - [x] Add error handling with TRPCError
  - [x] Write tests in `src/main/trpc/routers/sync.router.test.ts`

- [x] Task 4: Update root tRPC router to include sync.router
  - [x] Modify `src/main/trpc/index.ts`
  - [x] Import and add `syncRouter` to the merged router
  - [x] Verify type inference works correctly

- [x] Task 5: Modify task.router to trigger file sync on status change (AC: 1)
  - [x] Modify `src/main/trpc/routers/task.router.ts`
  - [x] In `updateStatus` mutation:
    - After DB update, check if task.story_file_path exists
    - If exists, call StorySyncService.updateStoryFileStatus()
    - Log sync success/failure
  - [x] Update tests

- [x] Task 6: Create useStorySync hook for React (AC: 2, 3, 5)
  - [x] Create `src/renderer/src/hooks/useStorySync.ts`
  - [x] Subscribe to `sync.onFileChange` subscription
  - [x] Track pending sync notifications per task
  - [x] Expose `syncFromFile(taskId)` function
  - [x] Expose `isSyncing` state for UI blocking
  - [x] Show toast when file changes detected
  - [x] Write tests in `src/renderer/src/hooks/useStorySync.test.ts`

- [x] Task 7: Create FileSyncNotification component (AC: 2, 3)
  - [x] Create `src/renderer/src/components/sync/FileSyncNotification.tsx`
  - [x] Display "Story file changed. Sync now?" with Sync and Dismiss buttons
  - [x] Show file path and task title
  - [x] Style as non-intrusive banner or toast
  - [x] Wire to useStorySync hook
  - [x] Write tests in `src/renderer/src/components/sync/FileSyncNotification.test.tsx`

- [x] Task 8: Create ConflictResolutionDialog component (AC: 4)
  - [x] Create `src/renderer/src/components/dialogs/ConflictResolutionDialog.tsx`
  - [x] Use shadcn/ui Dialog
  - [x] Show side-by-side diff using Monaco Editor or simple text comparison
  - [x] Display "Kanban version" vs "File version" labels
  - [x] Buttons: "Keep Kanban", "Keep File", "Cancel"
  - [x] On selection, call appropriate sync mutation
  - [x] Write tests in `src/renderer/src/components/dialogs/ConflictResolutionDialog.test.tsx`

- [x] Task 9: Add sync state to Zustand UI store (AC: 5)
  - [x] Modify `src/renderer/src/stores/ui.store.ts`
  - [x] Add `syncingTaskIds: Set<string>` state
  - [x] Add `addSyncingTask(taskId)` and `removeSyncingTask(taskId)` actions
  - [x] Add `isTaskSyncing(taskId): boolean` selector
  - [x] Update tests

- [x] Task 10: Update KanbanBoard to show sync status (AC: 5)
  - [x] Modify `src/renderer/src/components/board/KanbanBoard.tsx`
  - [x] Check `isTaskSyncing(taskId)` before allowing drag
  - [x] Show sync indicator overlay on cards being synced
  - [x] Disable card interactions during sync
  - [x] Update tests

- [x] Task 11: Update StoryTaskCard to show sync indicator (AC: 5)
  - [x] Modify `src/renderer/src/components/board/StoryTaskCard.tsx`
  - [x] Accept `isSyncing?: boolean` prop
  - [x] Show spinning sync icon when syncing
  - [x] Dim card and show "Syncing..." tooltip when syncing
  - [x] Update tests

- [x] Task 12: Initialize file watcher on project open (AC: 2)
  - [x] Modify project open handler (in App.tsx or project context)
  - [x] Call `sync.startFileWatching` when project is opened
  - [x] Stop watcher when project is closed
  - [x] Handle watcher initialization errors gracefully
  - [x] Update tests

- [x] Task 13: Handle edge cases and error scenarios (AC: 6)
  - [x] Skip sync for tasks without story_file_path
  - [x] Handle file deleted during sync (recreate or mark task)
  - [x] Handle file permissions errors
  - [x] Handle concurrent edits (file locked)
  - [x] Log all sync operations for debugging
  - [x] Update tests

- [x] Task 14: Write comprehensive integration tests (AC: all)
  - [x] Test full Kanban → File sync flow
  - [x] Test full File → Kanban sync flow
  - [x] Test conflict detection and resolution
  - [x] Test file watcher notifications
  - [x] Test sync blocking during operations
  - [x] Test edge cases (no file path, deleted files)
  - [x] Ensure all existing tests pass

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All file system operations (reading, writing, watching) happen in the main process. The renderer NEVER directly accesses the file system.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.7)

**Key Infrastructure from 3.7:**
1. Tasks table already has `story_file_path` and `full_content` columns
2. Story tasks are imported with file paths pointing to `implementation-artifacts/` directory
3. `StoryTaskCard` component exists and displays story information
4. `EpicsParserService` and `StoryImportService` establish file parsing patterns
5. Toast notifications use `sonner` library
6. Type guard `isStoryTask()` exists in `src/shared/types/task.types.ts`

**Files Created in 3.7 (Patterns to Follow):**
- `src/main/services/epics-parser.service.ts` - File parsing pattern
- `src/main/services/story-import.service.ts` - Service with DB operations
- `src/main/services/detailed-story-parser.service.ts` - Markdown parsing
- `src/renderer/src/components/board/StoryTaskCard.tsx` - Card component
- `src/renderer/src/components/board/SortableStoryTaskCard.tsx` - DnD wrapper

**Database Schema (from `src/main/db/schema.ts`):**
```typescript
export const tasks = sqliteTable('tasks', {
  // ... existing fields
  story_file_path: text('story_file_path'), // Path to detailed story .md file
  full_content: text('full_content'),       // Full markdown content from file
  // ...
})
```

### Story File Format (in implementation-artifacts/)

```markdown
# Story X.Y: Title

Status: ready-for-dev

## Story

As a [role],
I want [action],
So that [benefit].

## Acceptance Criteria

1. **Given** ...
   **When** ...
   **Then** ...

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
- [ ] Task 2 (AC: #)

## Dev Notes

...
```

**Key Fields to Sync:**
- `Status:` line - maps to task.status
- Full file content - maps to task.full_content

### Sync Service Pattern

```typescript
// src/main/services/story-sync.service.ts
import { readFile, writeFile, stat } from 'fs/promises'
import { existsSync } from 'fs'

export interface StoryFileContent {
  status: string
  title: string
  fullContent: string
  mtime: number
}

export class StorySyncService {
  /**
   * Update the Status: line in a story markdown file
   */
  static async updateStoryFileStatus(
    filePath: string,
    newStatus: string
  ): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Story file not found: ${filePath}`)
    }

    let content = await readFile(filePath, 'utf-8')

    // Match "Status: <value>" pattern (case insensitive)
    const statusRegex = /^(Status:\s*)(.+)$/mi

    if (statusRegex.test(content)) {
      content = content.replace(statusRegex, `$1${newStatus}`)
    } else {
      // Insert Status after title if not found
      const titleRegex = /^(# .+\n)/m
      content = content.replace(titleRegex, `$1\nStatus: ${newStatus}\n`)
    }

    await writeFile(filePath, content, 'utf-8')
  }

  /**
   * Read and parse a story file
   */
  static async readStoryFileContent(
    filePath: string
  ): Promise<StoryFileContent> {
    if (!existsSync(filePath)) {
      throw new Error(`Story file not found: ${filePath}`)
    }

    const content = await readFile(filePath, 'utf-8')
    const stats = await stat(filePath)

    // Extract status
    const statusMatch = content.match(/^Status:\s*(.+)$/mi)
    const status = statusMatch ? statusMatch[1].trim() : 'backlog'

    // Extract title
    const titleMatch = content.match(/^# Story \d+\.\d+: (.+)$/m)
    const title = titleMatch ? titleMatch[1].trim() : ''

    return {
      status,
      title,
      fullContent: content,
      mtime: stats.mtimeMs
    }
  }

  /**
   * Check if file has changed since last sync
   */
  static async hasFileChanged(
    filePath: string,
    knownMtime: number
  ): Promise<boolean> {
    if (!existsSync(filePath)) {
      return false // File deleted is not a "change" for sync purposes
    }

    const stats = await stat(filePath)
    return stats.mtimeMs > knownMtime
  }
}
```

### File Watcher Service Pattern

```typescript
// src/main/services/file-watcher.service.ts
import chokidar, { FSWatcher } from 'chokidar'
import { debounce } from 'lodash-es' // or implement simple debounce

export class FileWatcherService {
  private watcher: FSWatcher | null = null
  private callbacks: Map<string, (filePath: string) => void> = new Map()

  /**
   * Start watching story files in a directory
   */
  startWatching(
    watchPath: string,
    onChange: (filePath: string) => void
  ): void {
    if (this.watcher) {
      this.stopWatching()
    }

    // Debounce to handle rapid saves
    const debouncedOnChange = debounce(onChange, 300)

    this.watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    })

    this.watcher.on('change', (filePath) => {
      if (filePath.endsWith('.md')) {
        debouncedOnChange(filePath)
      }
    })

    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error)
    })
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }
}
```

### Sync Router Pattern

```typescript
// src/main/trpc/routers/sync.router.ts
import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { StorySyncService } from '../../services/story-sync.service'
import { db } from '../../db'
import { tasks } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { observable } from '@trpc/server/observable'
import { EventEmitter } from 'events'

// Event emitter for file changes
const fileChangeEmitter = new EventEmitter()

export const syncRouter = router({
  /**
   * Sync task status to file
   */
  syncStatusToFile: publicProcedure
    .input(z.object({
      taskId: z.string(),
      newStatus: z.string()
    }))
    .mutation(async ({ input }) => {
      // Get task with file path
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId)
      })

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      // Skip if no file path
      if (!task.story_file_path) {
        return { synced: false, reason: 'no_file_path' }
      }

      try {
        await StorySyncService.updateStoryFileStatus(
          task.story_file_path,
          input.newStatus
        )
        return { synced: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to sync to file: ${error.message}`
        })
      }
    }),

  /**
   * Sync task content from file
   */
  syncFromFile: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId)
      })

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
      }

      if (!task.story_file_path) {
        return { synced: false, reason: 'no_file_path' }
      }

      const fileContent = await StorySyncService.readStoryFileContent(
        task.story_file_path
      )

      // Update task in database
      const [updated] = await db
        .update(tasks)
        .set({
          status: mapFileStatusToDbStatus(fileContent.status),
          full_content: fileContent.fullContent,
          updated_at: new Date()
        })
        .where(eq(tasks.id, input.taskId))
        .returning()

      return { synced: true, task: updated }
    }),

  /**
   * Check if file has changes
   */
  checkFileChanges: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId)
      })

      if (!task?.story_file_path) {
        return { hasChanges: false }
      }

      const fileContent = await StorySyncService.readStoryFileContent(
        task.story_file_path
      )

      // Compare file content with stored content
      const hasChanges = fileContent.fullContent !== task.full_content

      return {
        hasChanges,
        fileStatus: fileContent.status,
        dbStatus: task.status
      }
    }),

  /**
   * Subscribe to file changes
   */
  onFileChange: publicProcedure.subscription(() => {
    return observable<{ filePath: string; taskId?: string }>((emit) => {
      const handler = (data: { filePath: string; taskId?: string }) => {
        emit.next(data)
      }
      fileChangeEmitter.on('fileChange', handler)
      return () => {
        fileChangeEmitter.off('fileChange', handler)
      }
    })
  })
})

// Map file status strings to database status values
function mapFileStatusToDbStatus(fileStatus: string): string {
  const statusMap: Record<string, string> = {
    'ready-for-dev': 'backlog',
    'in-progress': 'in_progress',
    'review': 'review',
    'done': 'done'
  }
  return statusMap[fileStatus.toLowerCase()] || 'backlog'
}

// Export for file watcher to emit events
export function emitFileChange(filePath: string, taskId?: string): void {
  fileChangeEmitter.emit('fileChange', { filePath, taskId })
}
```

### Conflict Detection Pattern

```typescript
interface ConflictInfo {
  taskId: string
  kanbanStatus: string
  fileStatus: string
  kanbanContent: string
  fileContent: string
  hasStatusConflict: boolean
  hasContentConflict: boolean
}

async function detectConflict(taskId: string): Promise<ConflictInfo | null> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId)
  })

  if (!task?.story_file_path) return null

  const fileContent = await StorySyncService.readStoryFileContent(
    task.story_file_path
  )

  const hasStatusConflict =
    mapFileStatusToDbStatus(fileContent.status) !== task.status
  const hasContentConflict =
    fileContent.fullContent !== task.full_content

  if (!hasStatusConflict && !hasContentConflict) return null

  return {
    taskId,
    kanbanStatus: task.status,
    fileStatus: fileContent.status,
    kanbanContent: task.full_content || '',
    fileContent: fileContent.fullContent,
    hasStatusConflict,
    hasContentConflict
  }
}
```

### Project Structure Notes

**New Files to Create:**
```
src/main/services/story-sync.service.ts
src/main/services/story-sync.service.test.ts
src/main/services/file-watcher.service.ts
src/main/services/file-watcher.service.test.ts
src/main/trpc/routers/sync.router.ts
src/main/trpc/routers/sync.router.test.ts
src/renderer/src/hooks/useStorySync.ts
src/renderer/src/hooks/useStorySync.test.ts
src/renderer/src/components/sync/FileSyncNotification.tsx
src/renderer/src/components/sync/FileSyncNotification.test.tsx
src/renderer/src/components/dialogs/ConflictResolutionDialog.tsx
src/renderer/src/components/dialogs/ConflictResolutionDialog.test.tsx
```

**Files to Modify:**
```
src/main/trpc/index.ts                                    # Add syncRouter
src/main/trpc/routers/task.router.ts                      # Trigger file sync on status change
src/renderer/src/stores/ui.store.ts                       # Add sync state
src/renderer/src/components/board/KanbanBoard.tsx         # Show sync status, block during sync
src/renderer/src/components/board/StoryTaskCard.tsx       # Show sync indicator
src/renderer/src/App.tsx (or project context)             # Initialize file watcher
```

### Dependencies

**NPM Dependencies to Add:**
```json
{
  "chokidar": "^4.0.0"  // File watching (or use native fs.watch)
}
```

Note: chokidar may already be installed as a dependency of electron-vite or other packages. Check existing dependencies first.

### Git Intelligence (Recent Commits)

```
e13888c 3.7 done
3251f5e fix terminal output
f5d5a04 3.4 done: Implement BMAD planning agent launcher
9fa7f5a 3.3 done: Implement planning tasks with distinct UI
364e415 3.1.5 done: implement multi-project support
```

**Commit Message Format:** `3.9 done: <description>`

### Performance Considerations

- File watcher should use polling only if native watching fails
- Debounce file change events (300ms) to handle rapid saves
- Use mtime comparison before content comparison for quick change detection
- Sync operations should complete within 1 second (AC: 1)
- Consider batching multiple file syncs if several files change at once

### Edge Cases to Handle

1. **No file path:** Skip sync silently, return `{ synced: false, reason: 'no_file_path' }`
2. **File deleted:** Don't crash, mark task or recreate file
3. **File locked:** Retry with backoff, show error toast after 3 attempts
4. **Concurrent edits:** Use conflict detection before overwriting
5. **Large files:** Stream content if file > 1MB (unlikely for story files)
6. **Invalid status in file:** Map to closest valid status or use 'backlog'
7. **File encoding issues:** Always use UTF-8, handle BOM
8. **Watcher fails to start:** Log error, fall back to manual sync

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Watch files in renderer process | Use main process FileWatcherService via tRPC |
| Read/write files in renderer | Use tRPC to call StorySyncService |
| Sync on every keystroke | Debounce file watches, sync on blur/save |
| Block UI during sync indefinitely | Show timeout after 5 seconds, allow cancel |
| Overwrite without conflict check | Detect conflicts, show resolution dialog |
| Ignore sync errors | Log errors, show toast, allow retry |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/main/services/story-sync.service.test.ts
describe('StorySyncService', () => {
  it('updates status in markdown file', async () => { /* ... */ })
  it('preserves file content when updating status', async () => { /* ... */ })
  it('reads status from file correctly', async () => { /* ... */ })
  it('handles missing file gracefully', async () => { /* ... */ })
  it('detects file changes by mtime', async () => { /* ... */ })
})

// src/main/services/file-watcher.service.test.ts
describe('FileWatcherService', () => {
  it('emits change event when file is modified', async () => { /* ... */ })
  it('debounces rapid changes', async () => { /* ... */ })
  it('ignores non-markdown files', async () => { /* ... */ })
  it('handles watcher errors gracefully', async () => { /* ... */ })
})

// src/main/trpc/routers/sync.router.test.ts
describe('syncRouter', () => {
  it('syncs status to file', async () => { /* ... */ })
  it('syncs content from file', async () => { /* ... */ })
  it('detects file changes correctly', async () => { /* ... */ })
  it('throws NOT_FOUND for missing task', async () => { /* ... */ })
})

// src/renderer/src/components/dialogs/ConflictResolutionDialog.test.tsx
describe('ConflictResolutionDialog', () => {
  it('displays both versions', () => { /* ... */ })
  it('calls onKeepKanban when Kanban version selected', () => { /* ... */ })
  it('calls onKeepFile when File version selected', () => { /* ... */ })
})
```

### UX Design Specifications

**Sync Notification:**
- Non-intrusive toast in bottom-right corner
- Shows task title and "File changed. Sync now?"
- "Sync" button (primary) and "Dismiss" button (ghost)
- Auto-dismiss after 30 seconds if no action

**Conflict Resolution Dialog:**
- Modal dialog with side-by-side comparison
- Left side: "Kanban Version" with current DB content
- Right side: "File Version" with file content
- Highlight differences if possible
- Clear buttons: "Keep Kanban", "Keep File", "Cancel"

**Sync Indicator on Cards:**
- Small spinning sync icon in card corner
- Card slightly dimmed (opacity: 0.7)
- Tooltip: "Syncing with file..."
- Prevent drag during sync

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.9] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] - Database patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] - tRPC patterns
- [Source: src/main/db/schema.ts] - Database schema with story_file_path and full_content
- [Source: src/shared/types/task.types.ts] - Task type definitions
- [Source: src/renderer/src/components/board/StoryTaskCard.tsx] - Card component to modify
- [Source: _bmad-output/implementation-artifacts/3-7-story-import-after-epics-phase.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

