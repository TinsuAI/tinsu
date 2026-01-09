# Story 3.7: Story Import After Epics Phase

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want stories from epics.md to appear as task cards after the Epics & Stories phase completes,
So that I can start implementation immediately.

## Acceptance Criteria

1. **Given** the Epics & Stories phase completes
   **When** TinSu detects epics.md
   **Then** it parses the file to extract all epics and stories
   **And** each story becomes a task card in Backlog

2. **Given** stories are imported
   **When** I view the Kanban board
   **Then** story cards show their epic badge (e.g., "Epic 1")
   **And** story cards show their number (e.g., "1.3")
   **And** cards are ordered by epic then story number

3. **Given** an epic has 7 stories
   **When** they are imported
   **Then** all 7 appear with correct parent epic reference
   **And** the epic itself is created in the epics table

4. **Given** stories are imported
   **When** I view a story card
   **Then** it shows the story title and truncated description
   **And** clicking opens a detail panel with full acceptance criteria

5. **Given** the import completes
   **When** I check the planning phase card
   **Then** it shows "Imported X stories from Y epics"
   **And** the planning phase moves to Done

6. **Given** I have an epics.md file in my project
   **When** I click the "Import Stories" button on the Epics & Stories planning card
   **Then** a file picker dialog opens pre-filled with the default epics.md path
   **And** I can confirm or select a different file
   **And** the import runs and shows results

7. **Given** I want to re-import after editing epics.md
   **When** I click "Import Stories" again
   **Then** TinSu detects existing stories and asks: "Update existing or import as new?"
   **And** I can choose to update, skip duplicates, or cancel

## Tasks / Subtasks

- [ ] Task 1: Create EpicsParserService (AC: 1, 3)
  - [ ] Create `src/main/services/epics-parser.service.ts`
  - [ ] Define `ParsedEpic` interface: `{ epicNumber: number, title: string, goal: string, stories: ParsedStory[] }`
  - [ ] Define `ParsedStory` interface: `{ epicNumber: number, storyNumber: number, title: string, userStory: string, acceptanceCriteria: string[] }`
  - [ ] Implement `parseEpicsFile(filePath: string): Promise<ParsedEpic[]>`
  - [ ] Parse markdown headings: `### Story X.Y: Title` pattern
  - [ ] Extract user story: `As a... I want... So that...` pattern
  - [ ] Extract acceptance criteria in Given/When/Then format
  - [ ] Handle edge cases: missing sections, malformed markdown
  - [ ] Write tests in `src/main/services/epics-parser.service.test.ts`

- [ ] Task 2: Create StoryImportService (AC: 1, 3, 5)
  - [ ] Create `src/main/services/story-import.service.ts`
  - [ ] Implement `importFromEpicsFile(projectId: string, epicsPath: string): Promise<ImportResult>`
  - [ ] Create epics in database using `epicsService.create()` (or direct Drizzle insert)
  - [ ] Create story tasks with `task_type: 'story'`, linked to epic via `epic_id`
  - [ ] Set story fields: `title`, `description` (user story), `status: 'backlog'`
  - [ ] Store acceptance criteria in task `description` or new column
  - [ ] Return `ImportResult`: `{ epicsCreated: number, storiesCreated: number }`
  - [ ] Write tests in `src/main/services/story-import.service.test.ts`

- [ ] Task 3: Add import.router with importStoriesFromEpics procedure (AC: 1, 5)
  - [ ] Create `src/main/trpc/routers/import.router.ts`
  - [ ] Implement `importStoriesFromEpics` mutation
  - [ ] Input: `{ projectId: string, epicsFilePath: string }`
  - [ ] Validate epics file exists before parsing
  - [ ] Call StoryImportService
  - [ ] Return import result with counts
  - [ ] Add error handling with TRPCError for parse failures
  - [ ] Write tests in `src/main/trpc/routers/import.router.test.ts`

- [ ] Task 4: Update root tRPC router to include import.router
  - [ ] Modify `src/main/trpc/index.ts`
  - [ ] Import and add `importRouter` to the merged router
  - [ ] Verify type inference works correctly

- [ ] Task 5: Extend tasks schema for story-specific fields (AC: 2, 4)
  - [ ] Modify `src/main/db/schema.ts` if needed
  - [ ] Ensure `epic_id` foreign key exists on tasks table
  - [ ] Ensure `story_number` column exists (INTEGER)
  - [ ] Run `npm run db:generate` to create migration
  - [ ] Run `npm run rebuild:electron` after schema changes

- [ ] Task 6: Create useStoryImport hook (AC: 1, 5)
  - [ ] Create `src/renderer/src/hooks/useStoryImport.ts`
  - [ ] Use tRPC `import.importStoriesFromEpics.useMutation`
  - [ ] Handle success: show toast with import counts, invalidate task queries
  - [ ] Handle error: show toast with error message
  - [ ] Export `importStories(projectId, epicsPath)` function
  - [ ] Write tests in `src/renderer/src/hooks/useStoryImport.test.ts`

- [ ] Task 7: Trigger import on Epics & Stories phase completion (AC: 1, 5)
  - [ ] Modify task status change handler (in KanbanBoard or agent exit handler)
  - [ ] Detect when phase 5 (Epics & Stories) moves to 'done'
  - [ ] Auto-detect epics.md path: `{planningArtifacts}/epics.md`
  - [ ] Call `importStories` automatically
  - [ ] Update planning task with import result message

- [ ] Task 8: Add "Import Stories" button to PlanningTaskCard (AC: 6)
  - [ ] Modify `src/renderer/src/components/board/PlanningTaskCard.tsx`
  - [ ] Add "Import Stories" button visible only on phase 5 (Epics & Stories) card
  - [ ] Button appears when phase is 'done' OR as secondary action anytime
  - [ ] Style with shadcn/ui Button, small variant, outline style
  - [ ] Wire to ImportStoriesDialog trigger
  - [ ] Write tests

- [ ] Task 9: Create ImportStoriesDialog component (AC: 6)
  - [ ] Create `src/renderer/src/components/dialogs/ImportStoriesDialog.tsx`
  - [ ] Use shadcn/ui Dialog with form
  - [ ] File path input pre-filled with `{planningArtifacts}/epics.md`
  - [ ] "Browse" button to open native file picker via tRPC
  - [ ] "Import" and "Cancel" buttons
  - [ ] Show loading state during import
  - [ ] Display result summary on success
  - [ ] Write tests in `src/renderer/src/components/dialogs/ImportStoriesDialog.test.tsx`

- [ ] Task 10: Add file picker tRPC procedure (AC: 6)
  - [ ] Add `dialog.showOpenDialog` procedure to config.router or new dialog.router
  - [ ] Filter for .md files
  - [ ] Return selected file path or null if cancelled
  - [ ] Write tests

- [ ] Task 11: Handle re-import with duplicate detection (AC: 7)
  - [ ] Modify StoryImportService to detect existing epics/stories
  - [ ] Add `checkExistingImport(projectId): Promise<ExistingImportInfo>`
  - [ ] Add import mode: 'update' | 'skip_duplicates' | 'replace_all'
  - [ ] Update import.router to accept mode parameter
  - [ ] Show confirmation dialog when duplicates detected
  - [ ] Write tests for each import mode

- [ ] Task 12: Create StoryTaskCard component (AC: 2, 4)
  - [ ] Create `src/renderer/src/components/board/StoryTaskCard.tsx`
  - [ ] Display epic badge (e.g., "Epic 1") using existing badge pattern
  - [ ] Display story number (e.g., "1.3")
  - [ ] Show title and truncated description
  - [ ] Style consistent with PlanningTaskCard dark theme
  - [ ] Write tests in `src/renderer/src/components/board/StoryTaskCard.test.tsx`

- [ ] Task 13: Create SortableStoryTaskCard wrapper (AC: 2)
  - [ ] Create `src/renderer/src/components/board/SortableStoryTaskCard.tsx`
  - [ ] Follow SortablePlanningTaskCard pattern for drag-and-drop
  - [ ] Use @dnd-kit useSortable hook
  - [ ] Write tests

- [ ] Task 14: Update KanbanBoard to render story cards (AC: 2, 4)
  - [ ] Modify `src/renderer/src/components/board/KanbanBoard.tsx`
  - [ ] Add type guard `isStoryTask(task): task is StoryTask`
  - [ ] Conditionally render `SortableStoryTaskCard` for story tasks
  - [ ] Ensure cards ordered by epic_id, then story_number
  - [ ] Update tests

- [ ] Task 15: Create story detail panel or extend TaskPanel (AC: 4)
  - [ ] Show full acceptance criteria when story card is clicked
  - [ ] Display in Given/When/Then format
  - [ ] Include epic context and story metadata
  - [ ] Write tests

- [ ] Task 16: Write comprehensive integration tests (AC: all)
  - [ ] Test full import flow from epics.md parsing to task creation
  - [ ] Test epic creation with correct story count
  - [ ] Test story card rendering with correct badges
  - [ ] Test ordering by epic then story number
  - [ ] Test manual import button and dialog flow
  - [ ] Test re-import duplicate handling
  - [ ] Ensure all existing tests pass (currently 714)

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database operations happen in the main process via Drizzle ORM. The renderer NEVER directly accesses the database or spawns processes.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.4)

**Key Learnings from 3.4:**
1. Tests must pass before completion (currently 714 tests)
2. Use existing patterns from services for consistency
3. Commit message format: `3.7 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Planning task fields already exist - reuse patterns for story task fields
6. `isPlanningTask()` type guard exists - create similar `isStoryTask()` guard
7. `SortablePlanningTaskCard` pattern shows how to create sortable card wrappers
8. Toast notifications use `sonner` library

**Files Created in 3.4:**
- `src/main/services/bmad-agent-launcher.service.ts` - Service pattern to follow
- `src/main/services/claude-cli-detector.service.ts` - Async service pattern
- `src/main/trpc/routers/agent.router.ts` - Router pattern to follow
- `src/renderer/src/hooks/useAgentLauncher.ts` - Hook pattern with mutation

**Files Modified in 3.4:**
- `src/main/trpc/index.ts` - Adding new routers
- `src/renderer/src/components/board/KanbanBoard.tsx` - Conditional card rendering
- `src/renderer/src/stores/terminal.store.ts` - State management pattern

### Existing Infrastructure to Use

**Epics Table (from `src/main/db/schema.ts`):**
```typescript
export const epics = sqliteTable('epics', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id),
  epic_number: integer('epic_number').notNull(),
  title: text('title').notNull(),
  goal: text('goal'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})
```

**Tasks Table Relevant Fields:**
```typescript
export const tasks = sqliteTable('tasks', {
  // ... existing fields
  task_type: text('task_type').notNull().default('story'), // 'planning' | 'story'
  epic_id: text('epic_id').references(() => epics.id),
  sprint_id: text('sprint_id').references(() => sprints.id),
  // Add story_number if not present
})
```

**Type Guard Pattern (from `src/shared/types/task.types.ts`):**
```typescript
export function isPlanningTask(task: Task): task is PlanningTask {
  return (
    task.task_type === 'planning' &&
    task.phase_number !== null &&
    task.phase_name !== null &&
    task.bmad_agent !== null &&
    task.bmad_workflow !== null
  )
}

// Create similar for stories:
export interface StoryTask extends Task {
  task_type: 'story'
  epic_id: string
  story_number: number
}

export function isStoryTask(task: Task): task is StoryTask {
  return (
    task.task_type === 'story' &&
    task.epic_id !== null
  )
}
```

**Planning Artifacts Path (from config):**
```typescript
// From project config: planningArtifacts = "{project-root}/_bmad-output/planning-artifacts"
// Expected epics file: {planningArtifacts}/epics.md
```

### Epics.md File Format

**Expected Structure:**
```markdown
## Epic 1: [Title]

**Goal:** [Epic goal description]

### Story 1.1: [Story Title]

As a [role],
I want [action],
So that [benefit].

**Acceptance Criteria:**

**Given** [precondition]
**When** [action]
**Then** [expected result]
**And** [additional result]

---

### Story 1.2: [Next Story Title]
...
```

**Parsing Strategy:**
1. Split by `## Epic X:` to get epic sections
2. Within each epic, split by `### Story X.Y:` to get stories
3. Parse user story pattern with regex
4. Parse acceptance criteria by finding `**Given**` blocks
5. Handle variations: some stories may have numbered ACs, some have free-form

### Component Patterns to Follow

**EpicsParserService:**
```typescript
// src/main/services/epics-parser.service.ts
export interface ParsedStory {
  epicNumber: number
  storyNumber: number
  title: string
  userStory: {
    role: string
    action: string
    benefit: string
  }
  acceptanceCriteria: string // Full AC text for storage
}

export interface ParsedEpic {
  epicNumber: number
  title: string
  goal: string
  stories: ParsedStory[]
}

export class EpicsParserService {
  static async parseEpicsFile(filePath: string): Promise<ParsedEpic[]> {
    const content = await fs.readFile(filePath, 'utf-8')
    // Parse markdown structure
    // Return parsed epics with stories
  }
}
```

**StoryImportService:**
```typescript
// src/main/services/story-import.service.ts
import { db } from '../db'
import { epics, tasks } from '../db/schema'
import { EpicsParserService } from './epics-parser.service'
import { nanoid } from 'nanoid'

export interface ImportResult {
  epicsCreated: number
  storiesCreated: number
  epicIds: string[]
  storyIds: string[]
}

export class StoryImportService {
  static async importFromEpicsFile(
    projectId: string,
    epicsPath: string
  ): Promise<ImportResult> {
    const parsedEpics = await EpicsParserService.parseEpicsFile(epicsPath)

    const epicIds: string[] = []
    const storyIds: string[] = []

    for (const epic of parsedEpics) {
      // Create epic record
      const epicId = nanoid()
      await db.insert(epics).values({
        id: epicId,
        project_id: projectId,
        epic_number: epic.epicNumber,
        title: epic.title,
        goal: epic.goal
      })
      epicIds.push(epicId)

      // Create story tasks
      for (const story of epic.stories) {
        const storyId = nanoid()
        await db.insert(tasks).values({
          id: storyId,
          project_id: projectId,
          task_type: 'story',
          epic_id: epicId,
          story_number: story.storyNumber,
          title: `${story.epicNumber}.${story.storyNumber}: ${story.title}`,
          description: formatStoryDescription(story),
          status: 'backlog'
        })
        storyIds.push(storyId)
      }
    }

    return {
      epicsCreated: epicIds.length,
      storiesCreated: storyIds.length,
      epicIds,
      storyIds
    }
  }
}

function formatStoryDescription(story: ParsedStory): string {
  return `As a ${story.userStory.role},
I want ${story.userStory.action},
So that ${story.userStory.benefit}.

## Acceptance Criteria

${story.acceptanceCriteria}`
}
```

**import.router:**
```typescript
// src/main/trpc/routers/import.router.ts
import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { StoryImportService } from '../../services/story-import.service'
import { existsSync } from 'fs'

export const importRouter = router({
  importStoriesFromEpics: publicProcedure
    .input(z.object({
      projectId: z.string(),
      epicsFilePath: z.string()
    }))
    .mutation(async ({ input }) => {
      // Validate file exists
      if (!existsSync(input.epicsFilePath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Epics file not found: ${input.epicsFilePath}`
        })
      }

      try {
        return await StoryImportService.importFromEpicsFile(
          input.projectId,
          input.epicsFilePath
        )
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to parse epics file: ${error.message}`,
          cause: error
        })
      }
    })
})
```

**StoryTaskCard:**
```typescript
// src/renderer/src/components/board/StoryTaskCard.tsx
import { Badge } from '@renderer/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'
import type { StoryTask } from '@shared/types/task.types'

interface StoryTaskCardProps {
  task: StoryTask
  onClick?: () => void
}

export function StoryTaskCard({ task, onClick }: StoryTaskCardProps) {
  // Extract epic and story numbers from title or fields
  const epicNumber = task.epic_id ? extractEpicNumber(task) : null

  return (
    <Card
      className={cn(
        'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all',
        'bg-card border-border'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-1">
          {epicNumber && (
            <Badge variant="outline" className="text-xs">
              Epic {epicNumber}
            </Badge>
          )}
          {task.story_number && (
            <Badge variant="secondary" className="text-xs">
              {epicNumber}.{task.story_number}
            </Badge>
          )}
        </div>
        <CardTitle className="text-sm font-medium line-clamp-2">
          {task.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**ImportStoriesDialog:**
```typescript
// src/renderer/src/components/dialogs/ImportStoriesDialog.tsx
import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import { Loader2, FolderOpen } from 'lucide-react'

interface ImportStoriesDialogProps {
  projectId: string
  defaultPath?: string
  trigger?: React.ReactNode
  onSuccess?: (result: { epicsCreated: number; storiesCreated: number }) => void
}

export function ImportStoriesDialog({
  projectId,
  defaultPath = '',
  trigger,
  onSuccess
}: ImportStoriesDialogProps) {
  const [open, setOpen] = useState(false)
  const [filePath, setFilePath] = useState(defaultPath)

  const importMutation = trpc.import.importStoriesFromEpics.useMutation({
    onSuccess: (result) => {
      toast.success(`Imported ${result.storiesCreated} stories from ${result.epicsCreated} epics`)
      onSuccess?.(result)
      setOpen(false)
    },
    onError: (error) => {
      toast.error('Import failed', { description: error.message })
    }
  })

  const openFilePicker = trpc.config.showOpenDialog.useMutation({
    onSuccess: (path) => {
      if (path) setFilePath(path)
    }
  })

  const handleImport = () => {
    if (!filePath.trim()) {
      toast.error('Please select an epics.md file')
      return
    }
    importMutation.mutate({ projectId, epicsFilePath: filePath })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Import Stories</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Stories from epics.md</DialogTitle>
          <DialogDescription>
            Select your epics.md file to import all epics and stories to the Kanban board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="epicsPath">Epics File Path</Label>
            <div className="flex gap-2">
              <Input
                id="epicsPath"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="_bmad-output/planning-artifacts/epics.md"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => openFilePicker.mutate({ filters: [{ name: 'Markdown', extensions: ['md'] }] })}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importMutation.isPending}>
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**File Picker tRPC Procedure:**
```typescript
// Add to src/main/trpc/routers/config.router.ts
import { dialog } from 'electron'

showOpenDialog: publicProcedure
  .input(z.object({
    filters: z.array(z.object({
      name: z.string(),
      extensions: z.array(z.string())
    })).optional(),
    defaultPath: z.string().optional()
  }).optional())
  .mutation(async ({ input }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: input?.filters || [{ name: 'All Files', extensions: ['*'] }],
      defaultPath: input?.defaultPath
    })
    return result.canceled ? null : result.filePaths[0]
  })
```

### Project Structure Notes

**New Files to Create:**
```
src/main/services/epics-parser.service.ts
src/main/services/epics-parser.service.test.ts
src/main/services/story-import.service.ts
src/main/services/story-import.service.test.ts
src/main/trpc/routers/import.router.ts
src/main/trpc/routers/import.router.test.ts
src/renderer/src/hooks/useStoryImport.ts
src/renderer/src/hooks/useStoryImport.test.ts
src/renderer/src/components/board/StoryTaskCard.tsx
src/renderer/src/components/board/StoryTaskCard.test.tsx
src/renderer/src/components/board/SortableStoryTaskCard.tsx
src/renderer/src/components/board/SortableStoryTaskCard.test.tsx
src/renderer/src/components/dialogs/ImportStoriesDialog.tsx
src/renderer/src/components/dialogs/ImportStoriesDialog.test.tsx
```

**Files to Modify:**
```
src/main/db/schema.ts                                  # Add story_number column if needed
src/main/trpc/index.ts                                 # Add importRouter
src/main/trpc/routers/config.router.ts                 # Add showOpenDialog for file picker
src/shared/types/task.types.ts                         # Add StoryTask type and isStoryTask guard
src/renderer/src/components/board/KanbanBoard.tsx      # Render StoryTaskCard
src/renderer/src/components/board/PlanningTaskCard.tsx # Add "Import Stories" button
[Phase completion handler]                              # Trigger auto-import
```

### UX Design Specifications

**From UX Design Document:**
- Story cards should be visually distinct from planning cards
- Use badge styling for epic and story numbers
- Truncate description to 2 lines with ellipsis
- Click to expand full details in side panel

**Card Visual Hierarchy:**
1. Epic badge (primary color, outline variant)
2. Story number badge (secondary variant)
3. Story title (bold, line-clamp-2)
4. Description preview (muted, line-clamp-2)

**Import Feedback:**
- Toast notification on import completion: "Imported X stories from Y epics"
- Error toast if parsing fails with actionable message
- Planning phase card updates to show import count

### Git Intelligence (Recent Commits)

```
3251f5e fix terminal output
f5d5a04 3.4 done: Implement BMAD planning agent launcher with Claude CLI detection and UI integration.
9fa7f5a 3.3 done: Implement planning tasks with distinct UI, phase badges, and artifact path handling on the Kanban board.
364e415 3.1.5 done: implement multi-project support by adding a projects table
```

From Story 3.4: Agent launcher established patterns for services, routers, and hooks. This story follows the same patterns for import functionality.

### Dependencies

- **Depends On:** Story 3.4 (agent launcher) - COMPLETE
- **Skipped:** Story 3.5 (artifact detection), Story 3.6 (next phase suggestion) - User will do at end of epic
- **This Story Enables:** Story 3.8 (BMAD artifact scanner) - builds on parsing foundation

### Performance Considerations

- epics.md parsing should be synchronous and fast (<500ms for typical file)
- Batch database inserts where possible for large epic counts
- Use transactions for atomicity when creating epics and stories
- Cache parsed structure if needed for re-import detection

### Edge Cases to Handle

1. **Empty epics.md:** Return empty result, show info toast
2. **Malformed markdown:** Skip malformed sections, log warnings, continue
3. **Duplicate import:** Check if epics already exist, either skip or update
4. **Missing epic goal:** Use empty string, don't fail
5. **Stories without acceptance criteria:** Store user story only
6. **Non-sequential story numbers:** Preserve original numbering from file
7. **Epic without stories:** Create epic record, log warning
8. **File encoding issues:** Use utf-8, handle BOM if present

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Parse markdown in renderer | Use main process service via tRPC |
| Block UI during import | Show loading state, use async mutation |
| Hard-code file paths | Use config-based planning artifacts path |
| Create tasks one-by-one | Batch inserts for performance |
| Ignore parse errors | Log warnings, skip invalid sections, continue |
| Direct fs access in renderer | Use tRPC to call main process services |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/main/services/epics-parser.service.test.ts
describe('EpicsParserService', () => {
  it('parses epic headers correctly', () => { /* ... */ })
  it('extracts story numbers from title pattern', () => { /* ... */ })
  it('parses user story As/I want/So that format', () => { /* ... */ })
  it('extracts Given/When/Then acceptance criteria', () => { /* ... */ })
  it('handles multiple epics in one file', () => { /* ... */ })
  it('handles empty file gracefully', () => { /* ... */ })
  it('handles malformed markdown without crashing', () => { /* ... */ })
})

// src/main/services/story-import.service.test.ts
describe('StoryImportService', () => {
  it('creates epic records in database', () => { /* ... */ })
  it('creates story tasks linked to epics', () => { /* ... */ })
  it('sets correct task_type as story', () => { /* ... */ })
  it('returns accurate import counts', () => { /* ... */ })
})

// src/main/trpc/routers/import.router.test.ts
describe('importRouter', () => {
  it('throws NOT_FOUND for missing epics file', async () => { /* ... */ })
  it('returns import result on success', async () => { /* ... */ })
  it('handles parse errors with INTERNAL_SERVER_ERROR', async () => { /* ... */ })
})

// src/renderer/src/components/board/StoryTaskCard.test.tsx
describe('StoryTaskCard', () => {
  it('renders epic badge correctly', () => { /* ... */ })
  it('renders story number badge', () => { /* ... */ })
  it('truncates long descriptions', () => { /* ... */ })
  it('calls onClick when clicked', () => { /* ... */ })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] - Database patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] - tRPC patterns
- [Source: src/main/db/schema.ts] - Database schema definitions
- [Source: src/shared/types/task.types.ts] - Task type definitions and guards
- [Source: src/renderer/src/components/board/PlanningTaskCard.tsx] - Card component pattern
- [Source: src/renderer/src/components/board/SortablePlanningTaskCard.tsx] - Sortable wrapper pattern
- [Source: _bmad-output/implementation-artifacts/3-4-bmad-agent-launcher.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

