# Story 3.10: Link Artifacts to Tasks

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want each task linked to its relevant BMAD artifacts,
So that context injection knows which documents apply.

## Acceptance Criteria

1. **Given** a story task is imported from epics.md
   **When** it is created
   **Then** it automatically links to: PRD, Architecture, UX Design (if they exist)
   **And** it stores a reference to its section in epics.md

2. **Given** the database schema
   **When** I define artifact linking
   **Then** a task_artifacts table stores: task_id, artifact_type, artifact_path, section_ref

3. **Given** a task has linked artifacts
   **When** I view the task detail panel
   **Then** I see a list of linked artifacts with file icons
   **And** clicking opens the file in the system editor

4. **Given** I want to customize links
   **When** I edit a task
   **Then** I can add or remove artifact links
   **And** changes persist to the database

5. **Given** an artifact file is deleted
   **When** I view a task that referenced it
   **Then** the link shows as "missing" with a warning icon
   **And** context injection skips the missing file gracefully

## Tasks / Subtasks

- [x] Task 1: Create task_artifacts database table and schema (AC: 2)
  - [x] Add `task_artifacts` table to `src/main/db/schema.ts`
  - [x] Define columns: id (TEXT PK), task_id (TEXT FK), artifact_type (TEXT), artifact_path (TEXT), section_ref (TEXT nullable)
  - [x] Create index on task_id for efficient joins
  - [x] Add ArtifactType enum: 'prd' | 'architecture' | 'ux_design' | 'epics' | 'custom'
  - [x] Export TaskArtifact and NewTaskArtifact types
  - [x] Generate Drizzle migration with `npm run db:generate`
  - [x] Run `npm run rebuild:electron` after schema change
  - [x] Write tests in `src/main/db/schema.test.ts`

- [ ] Task 2: Create ArtifactLinkingService for managing artifact links (AC: 1, 5)
  - [ ] Create `src/main/services/artifact-linking.service.ts`
  - [ ] Implement `linkArtifactToTask(taskId: string, artifactType: ArtifactType, artifactPath: string, sectionRef?: string): Promise<TaskArtifact>`
  - [ ] Implement `unlinkArtifactFromTask(taskArtifactId: string): Promise<void>`
  - [ ] Implement `getArtifactsForTask(taskId: string): Promise<TaskArtifact[]>`
  - [ ] Implement `checkArtifactExists(artifactPath: string): boolean` using fs.existsSync
  - [ ] Implement `getArtifactsWithStatus(taskId: string): Promise<ArtifactWithStatus[]>` that includes `exists: boolean` flag
  - [ ] Write tests in `src/main/services/artifact-linking.service.test.ts`

- [ ] Task 3: Create artifacts.router for tRPC artifact operations (AC: 3, 4)
  - [ ] Create `src/main/trpc/routers/artifacts.router.ts`
  - [ ] Implement `getArtifactsForTask` query
    - Input: `{ taskId: string }`
    - Returns list of artifacts with existence status
  - [ ] Implement `linkArtifact` mutation
    - Input: `{ taskId: string, artifactType: ArtifactType, artifactPath: string, sectionRef?: string }`
    - Returns created TaskArtifact
  - [ ] Implement `unlinkArtifact` mutation
    - Input: `{ taskArtifactId: string }`
    - Returns success boolean
  - [ ] Implement `openArtifactInEditor` mutation
    - Input: `{ artifactPath: string }`
    - Uses `shell.openPath()` to open in system editor
    - Returns success boolean
  - [ ] Add TRPCError handling for NOT_FOUND and INTERNAL_SERVER_ERROR
  - [ ] Write tests in `src/main/trpc/routers/artifacts.router.test.ts`

- [ ] Task 4: Update root tRPC router to include artifacts.router
  - [ ] Modify `src/main/trpc/index.ts`
  - [ ] Import and add `artifactsRouter` to the merged router
  - [ ] Verify type inference works correctly

- [ ] Task 5: Modify story-import.service to auto-link artifacts on import (AC: 1)
  - [ ] Modify `src/main/services/story-import.service.ts`
  - [ ] After creating story task, call ArtifactLinkingService to link:
    - PRD artifact (pattern: `*prd*.md`)
    - Architecture artifact (pattern: `*architecture*.md`)
    - UX Design artifact (pattern: `*ux*.md`)
    - Epics section reference (store line number or heading)
  - [ ] Use ArtifactDetectorService patterns for detection
  - [ ] Store section_ref as `epics.md#Story-X.Y` format for epic reference
  - [ ] Update tests in `src/main/services/story-import.service.test.ts`

- [ ] Task 6: Create useTaskArtifacts hook for React (AC: 3, 4)
  - [ ] Create `src/renderer/src/hooks/useTaskArtifacts.ts`
  - [ ] Use tRPC to fetch artifacts with `artifacts.getArtifactsForTask`
  - [ ] Expose `artifacts: ArtifactWithStatus[]`
  - [ ] Expose `linkArtifact(type, path, sectionRef?)` function
  - [ ] Expose `unlinkArtifact(artifactId)` function
  - [ ] Expose `openArtifact(path)` function
  - [ ] Expose `isLoading` and `error` states
  - [ ] Write tests in `src/renderer/src/hooks/useTaskArtifacts.test.ts`

- [ ] Task 7: Create ArtifactList component for displaying linked artifacts (AC: 3, 5)
  - [ ] Create `src/renderer/src/components/artifacts/ArtifactList.tsx`
  - [ ] Display list of artifacts with appropriate file icons:
    - PRD: FileText icon (lucide-react)
    - Architecture: Building icon
    - UX Design: Palette icon
    - Epics: Book icon
    - Custom: File icon
  - [ ] Show artifact file name (extracted from path)
  - [ ] Show warning icon (AlertTriangle) for missing artifacts
  - [ ] Add click handler to open artifact in system editor
  - [ ] Add hover tooltip showing full path
  - [ ] Use shadcn/ui Badge for artifact type
  - [ ] Write tests in `src/renderer/src/components/artifacts/ArtifactList.test.tsx`

- [ ] Task 8: Create ArtifactLinkDialog for adding/removing artifact links (AC: 4)
  - [ ] Create `src/renderer/src/components/dialogs/ArtifactLinkDialog.tsx`
  - [ ] Use shadcn/ui Dialog component
  - [ ] Show current linked artifacts with remove button
  - [ ] Provide dropdown to add new artifact link:
    - Select artifact type from dropdown
    - File picker or path input for artifact path
    - Optional section reference input
  - [ ] Validate artifact path exists before linking
  - [ ] Show toast on successful link/unlink
  - [ ] Write tests in `src/renderer/src/components/dialogs/ArtifactLinkDialog.test.tsx`

- [ ] Task 9: Integrate ArtifactList into task detail view (AC: 3)
  - [ ] Find existing task detail component (likely StoryTaskCard or StoryFullView)
  - [ ] Add ArtifactList component in appropriate section
  - [ ] Only show for story tasks (use isStoryTask guard)
  - [ ] Add "Manage Artifacts" button that opens ArtifactLinkDialog
  - [ ] Update existing component tests

- [ ] Task 10: Update shared types for artifacts (AC: 2)
  - [ ] Create `src/shared/types/artifact.types.ts`
  - [ ] Define ArtifactType enum
  - [ ] Define TaskArtifact interface
  - [ ] Define NewTaskArtifact interface
  - [ ] Define ArtifactWithStatus interface (includes exists: boolean)
  - [ ] Write tests in `src/shared/types/artifact.types.test.ts`

- [ ] Task 11: Handle missing artifact gracefully in context injection (AC: 5)
  - [ ] Locate context builder service (check `src/main/services/context-builder.service.ts` if exists, or note for Story 3.11)
  - [ ] Add check for artifact file existence before including in context
  - [ ] Log warning for missing artifacts
  - [ ] Skip missing artifacts without throwing error
  - [ ] This may be deferred to Story 3.11 if context builder doesn't exist yet

- [ ] Task 12: Write comprehensive integration tests (AC: all)
  - [ ] Test full import → auto-link flow
  - [ ] Test manual link/unlink flow
  - [ ] Test opening artifact in editor
  - [ ] Test missing artifact detection
  - [ ] Test artifact list rendering
  - [ ] Ensure all existing tests pass

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All file system operations (reading, writing, checking existence) happen in the main process. The renderer NEVER directly accesses the file system.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.9)

**Key Infrastructure from 3.9:**
1. `StorySyncService` in `src/main/services/story-sync.service.ts` - file operations pattern
2. `sync.router.ts` - tRPC router pattern with proper error handling
3. File watching and sync patterns already established
4. Toast notifications use `sonner` library

**Files Created in 3.9 (Patterns to Follow):**
- `src/main/services/story-sync.service.ts` - File operations pattern
- `src/main/services/file-watcher.service.ts` - File system watcher
- `src/main/trpc/routers/sync.router.ts` - Router with subscriptions
- `src/renderer/src/hooks/useStorySync.ts` - React hook pattern
- `src/renderer/src/components/dialogs/ConflictResolutionDialog.tsx` - Dialog pattern

### Existing Artifact Detection Pattern

**From `src/main/services/artifact-detector.service.ts`:**
```typescript
// Patterns to match artifact files for each planning phase
const ARTIFACT_PATTERNS: Record<PhaseNumber, RegExp> = {
  1: /^product-brief.*\.md$/i,
  2: /^prd.*\.md$/i,
  3: /^architecture.*\.md$/i,
  4: /^(ux-design.*|.*ux.*)\.md$/i,
  5: /^epics.*\.md$/i
}
```

Reuse these patterns for automatic artifact detection when linking.

### Database Schema Pattern

**Current Schema (from `src/main/db/schema.ts`):**
```typescript
// Add this table for Story 3.10
export const ARTIFACT_TYPE = ['prd', 'architecture', 'ux_design', 'epics', 'custom'] as const
export type ArtifactType = (typeof ARTIFACT_TYPE)[number]

export const task_artifacts = sqliteTable(
  'task_artifacts',
  {
    id: text('id').primaryKey(),
    task_id: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    artifact_type: text('artifact_type').notNull(), // 'prd' | 'architecture' | 'ux_design' | 'epics' | 'custom'
    artifact_path: text('artifact_path').notNull(), // Absolute or relative path to artifact file
    section_ref: text('section_ref'), // Optional: reference to section (e.g., "Story 3.10" or line number)
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
  },
  (table) => [
    index('idx_task_artifacts_task_id').on(table.task_id)
  ]
)

export type TaskArtifact = InferSelectModel<typeof task_artifacts>
export type NewTaskArtifact = InferInsertModel<typeof task_artifacts>
```

### ArtifactLinkingService Pattern

```typescript
// src/main/services/artifact-linking.service.ts
import { existsSync } from 'fs'
import { db } from '../db'
import { task_artifacts, TaskArtifact, NewTaskArtifact, ArtifactType } from '../db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export interface ArtifactWithStatus extends TaskArtifact {
  exists: boolean
  fileName: string
}

export class ArtifactLinkingService {
  /**
   * Link an artifact to a task
   */
  static async linkArtifactToTask(
    taskId: string,
    artifactType: ArtifactType,
    artifactPath: string,
    sectionRef?: string
  ): Promise<TaskArtifact> {
    const newArtifact: NewTaskArtifact = {
      id: uuidv4(),
      task_id: taskId,
      artifact_type: artifactType,
      artifact_path: artifactPath,
      section_ref: sectionRef || null
    }

    const [created] = await db
      .insert(task_artifacts)
      .values(newArtifact)
      .returning()

    return created
  }

  /**
   * Remove an artifact link
   */
  static async unlinkArtifactFromTask(taskArtifactId: string): Promise<void> {
    await db
      .delete(task_artifacts)
      .where(eq(task_artifacts.id, taskArtifactId))
  }

  /**
   * Get all artifacts for a task with existence status
   */
  static async getArtifactsWithStatus(taskId: string): Promise<ArtifactWithStatus[]> {
    const artifacts = await db.query.task_artifacts.findMany({
      where: eq(task_artifacts.task_id, taskId)
    })

    return artifacts.map(artifact => ({
      ...artifact,
      exists: existsSync(artifact.artifact_path),
      fileName: artifact.artifact_path.split('/').pop() || artifact.artifact_path
    }))
  }

  /**
   * Check if an artifact file exists
   */
  static checkArtifactExists(artifactPath: string): boolean {
    return existsSync(artifactPath)
  }
}
```

### Artifacts Router Pattern

```typescript
// src/main/trpc/routers/artifacts.router.ts
import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ArtifactLinkingService } from '../../services/artifact-linking.service'
import { ARTIFACT_TYPE, ArtifactType } from '../../db/schema'
import { shell } from 'electron'

export const artifactsRouter = router({
  /**
   * Get all artifacts linked to a task
   */
  getArtifactsForTask: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      return ArtifactLinkingService.getArtifactsWithStatus(input.taskId)
    }),

  /**
   * Link an artifact to a task
   */
  linkArtifact: publicProcedure
    .input(z.object({
      taskId: z.string(),
      artifactType: z.enum(ARTIFACT_TYPE),
      artifactPath: z.string(),
      sectionRef: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      // Validate artifact exists
      if (!ArtifactLinkingService.checkArtifactExists(input.artifactPath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Artifact file not found: ${input.artifactPath}`
        })
      }

      return ArtifactLinkingService.linkArtifactToTask(
        input.taskId,
        input.artifactType as ArtifactType,
        input.artifactPath,
        input.sectionRef
      )
    }),

  /**
   * Unlink an artifact from a task
   */
  unlinkArtifact: publicProcedure
    .input(z.object({ taskArtifactId: z.string() }))
    .mutation(async ({ input }) => {
      await ArtifactLinkingService.unlinkArtifactFromTask(input.taskArtifactId)
      return { success: true }
    }),

  /**
   * Open an artifact in the system editor
   */
  openArtifactInEditor: publicProcedure
    .input(z.object({ artifactPath: z.string() }))
    .mutation(async ({ input }) => {
      if (!ArtifactLinkingService.checkArtifactExists(input.artifactPath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Artifact file not found: ${input.artifactPath}`
        })
      }

      try {
        await shell.openPath(input.artifactPath)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to open artifact: ${error.message}`
        })
      }
    })
})
```

### ArtifactList Component Pattern

```typescript
// src/renderer/src/components/artifacts/ArtifactList.tsx
import { FileText, Building, Palette, Book, File, AlertTriangle, ExternalLink } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { cn } from '@renderer/lib/utils'
import type { ArtifactWithStatus } from '@shared/types/artifact.types'

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  prd: FileText,
  architecture: Building,
  ux_design: Palette,
  epics: Book,
  custom: File
}

const ARTIFACT_LABELS: Record<string, string> = {
  prd: 'PRD',
  architecture: 'Architecture',
  ux_design: 'UX Design',
  epics: 'Epics',
  custom: 'Custom'
}

interface ArtifactListProps {
  artifacts: ArtifactWithStatus[]
  onOpenArtifact: (path: string) => void
  isLoading?: boolean
}

export function ArtifactList({ artifacts, onOpenArtifact, isLoading }: ArtifactListProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading artifacts...</div>
  }

  if (artifacts.length === 0) {
    return <div className="text-sm text-muted-foreground">No linked artifacts</div>
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => {
        const Icon = ARTIFACT_ICONS[artifact.artifact_type] || File
        const label = ARTIFACT_LABELS[artifact.artifact_type] || 'Custom'

        return (
          <Tooltip key={artifact.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start gap-2 h-auto py-2",
                  !artifact.exists && "opacity-60"
                )}
                onClick={() => artifact.exists && onOpenArtifact(artifact.artifact_path)}
                disabled={!artifact.exists}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{artifact.fileName}</span>
                {!artifact.exists && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                )}
                <Badge variant="outline" className="ml-auto text-xs">
                  {label}
                </Badge>
                {artifact.exists && (
                  <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-mono text-xs">{artifact.artifact_path}</p>
              {!artifact.exists && (
                <p className="text-yellow-500 text-xs mt-1">File not found</p>
              )}
              {artifact.section_ref && (
                <p className="text-muted-foreground text-xs mt-1">Section: {artifact.section_ref}</p>
              )}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
```

### Project Structure Notes

**New Files to Create:**
```
src/main/db/schema.ts                                    # Add task_artifacts table
src/main/services/artifact-linking.service.ts
src/main/services/artifact-linking.service.test.ts
src/main/trpc/routers/artifacts.router.ts
src/main/trpc/routers/artifacts.router.test.ts
src/shared/types/artifact.types.ts
src/shared/types/artifact.types.test.ts
src/renderer/src/hooks/useTaskArtifacts.ts
src/renderer/src/hooks/useTaskArtifacts.test.ts
src/renderer/src/components/artifacts/ArtifactList.tsx
src/renderer/src/components/artifacts/ArtifactList.test.tsx
src/renderer/src/components/dialogs/ArtifactLinkDialog.tsx
src/renderer/src/components/dialogs/ArtifactLinkDialog.test.tsx
```

**Files to Modify:**
```
src/main/db/schema.ts                                    # Add task_artifacts table and types
src/main/trpc/index.ts                                   # Add artifactsRouter
src/main/services/story-import.service.ts                # Auto-link artifacts on import
src/renderer/src/components/story/StoryFullView.tsx      # Add ArtifactList display (if exists)
```

### Dependencies

**No new NPM dependencies required.** All needed utilities already exist:
- `uuid` for generating IDs
- `lucide-react` for icons
- `sonner` for toasts
- shadcn/ui components already installed

### Git Intelligence (Recent Commits)

```
d6e30df correct for epic 5
e5ffb42 fix new task shorcut
39c74a6 3.3 done
19bc3e7 fix terminal on right-side
45cb29c fix .npmrc
```

**Commit Message Format:** `3.10 done: <description>`

### Integration with Story 3.11 (Context Builder Service)

This story creates the infrastructure for artifact linking. Story 3.11 will consume this:
- `ArtifactLinkingService.getArtifactsWithStatus(taskId)` returns all linked artifacts
- Context builder will read artifact files and assemble them into agent context
- Missing artifacts (exists: false) should be skipped with a warning log

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/main/services/artifact-linking.service.test.ts
describe('ArtifactLinkingService', () => {
  it('links artifact to task', async () => { /* ... */ })
  it('unlinks artifact from task', async () => { /* ... */ })
  it('returns artifacts with existence status', async () => { /* ... */ })
  it('detects missing artifact files', () => { /* ... */ })
})

// src/main/trpc/routers/artifacts.router.test.ts
describe('artifactsRouter', () => {
  it('returns artifacts for task', async () => { /* ... */ })
  it('links artifact to task', async () => { /* ... */ })
  it('throws BAD_REQUEST for non-existent artifact path', async () => { /* ... */ })
  it('opens artifact in system editor', async () => { /* ... */ })
  it('throws NOT_FOUND when opening missing artifact', async () => { /* ... */ })
})

// src/renderer/src/components/artifacts/ArtifactList.test.tsx
describe('ArtifactList', () => {
  it('renders list of artifacts with correct icons', () => { /* ... */ })
  it('shows warning icon for missing artifacts', () => { /* ... */ })
  it('calls onOpenArtifact when clicking existing artifact', () => { /* ... */ })
  it('disables click for missing artifacts', () => { /* ... */ })
  it('shows tooltip with full path', () => { /* ... */ })
})
```

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Access file system in renderer | Use tRPC to call ArtifactLinkingService |
| Hardcode artifact paths | Use ArtifactDetectorService patterns |
| Throw generic Error in routers | Use TRPCError with proper codes |
| Create separate CSS files | Use Tailwind inline classes |
| Store full artifact content in DB | Store only path, read on demand |
| Ignore missing artifacts silently | Show warning icon and log |

### UX Design Specifications

**Artifact List:**
- Compact list showing artifact type icon, file name, and type badge
- Click to open in system editor (VS Code, etc.)
- Tooltip shows full file path
- Warning icon for missing files with yellow color
- Disabled state for missing artifacts

**Artifact Link Dialog:**
- Modal dialog with current artifacts list
- Remove button (X) next to each linked artifact
- "Add Artifact" section with:
  - Artifact type dropdown (PRD, Architecture, UX Design, Epics, Custom)
  - File path input with validation
  - Optional section reference input
  - "Link" button disabled until valid path entered
- Toast on successful link/unlink

### Relationship to Other Stories

- **Story 3.7 (Story Import):** Import service will call this to auto-link artifacts
- **Story 3.11 (Context Builder):** Will consume artifact links to build agent context
- **Story 3.9 (Bidirectional Sync):** Uses similar file operation patterns

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.10] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] - Database patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] - tRPC patterns
- [Source: src/main/db/schema.ts] - Current database schema
- [Source: src/main/services/artifact-detector.service.ts] - Artifact detection patterns
- [Source: src/shared/types/task.types.ts] - Task type definitions
- [Source: _bmad-output/implementation-artifacts/3-9-bidirectional-sync-between-kanban-and-epics-md.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

