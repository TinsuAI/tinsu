# Story 5.2b: Add "Create Story" Column to Kanban Board

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a "Create Story" column between Backlog and In Progress,
So that Story Tasks have a dedicated phase for full story file generation before development.

## Acceptance Criteria

1. **Given** the existing 4-column Kanban board
   **When** Epic 5 is implemented
   **Then** a new "Create Story" column appears between "Backlog" and "In Progress"
   **And** the board now has 5 columns: Backlog → Create Story → In Progress → Review → Done

2. **Given** the "Create Story" column header
   **When** I view it
   **Then** it displays the column name and task count
   **And** a tooltip explains: "Story Tasks generate full story files here before development"
   **And** an optional icon distinguishes it from other columns

3. **Given** the 5-column layout
   **When** I view the board on desktop (1024px+)
   **Then** all 5 columns fit with equal width and 16px padding
   **And** horizontal scrolling is available if viewport is narrower

4. **Given** the database schema
   **When** Epic 5 is implemented
   **Then** columns added:
   - `task_type`: enum ('story_task', 'basic_task'), default 'basic_task'
   - `story_file_status`: enum ('summary_only', 'story_ready') | null
   - `story_file_path`: string | null (path to implementation-artifacts file)
   **And** existing tasks default to 'basic_task' (safe migration)

## Tasks / Subtasks

- [x] Task 1: Add "create_story" to TASK_STATUS enum (AC: 1)
  - [x] Modify `src/shared/types/task.types.ts` to add 'create_story' to TASK_STATUS array after 'backlog'
  - [x] Update TaskStatus type to include 'create_story'
  - [x] Add tests in `src/shared/types/task.types.test.ts` for new status
  - [x] Run `npm run rebuild:electron` after changes

- [x] Task 2: Update COLUMN_CONFIG with Create Story column (AC: 1, 2)
  - [x] Modify `src/renderer/src/components/board/KanbanColumn.tsx`
  - [x] Add `create_story` entry to COLUMN_CONFIG with title "Create Story" and order 2
  - [x] Shift existing orders: in_progress → 3, review → 4, done → 5
  - [x] Update tests in `KanbanColumn.test.tsx`

- [x] Task 3: Update KanbanBoard grid layout for 5 columns (AC: 3)
  - [x] Modify `src/renderer/src/components/board/KanbanBoard.tsx`
  - [x] Change `grid-cols-4` to `grid-cols-5` in the board container
  - [x] Ensure responsive behavior with horizontal scroll on narrower viewports
  - [x] Update tests in `KanbanBoard.test.tsx` to expect 5 columns

- [x] Task 4: Add tooltip to Create Story column header (AC: 2)
  - [x] Modify `KanbanColumn.tsx` to accept optional tooltip prop
  - [x] Add Tooltip component from shadcn/ui wrapping the column title when tooltip is provided
  - [x] Add tooltip text: "Story Tasks generate full story files here before development"
  - [x] Add optional FileText icon (from lucide-react) next to the title for Create Story column
  - [x] Write tests for tooltip display

- [x] Task 5: Extend task schema with new fields (AC: 4)
  - [x] Note: Schema changes go in `src/main/db/schema.ts`
  - [x] The story references 'story_task' vs 'basic_task' enum - this differs from existing 'planning' | 'story' enum
  - [x] **Decision Required:** Clarify with user if we should:
    - Option A: Add new fields `story_file_status` ('summary_only' | 'story_ready' | null) to existing schema
    - Option B: Change task_type enum from 'planning' | 'story' to 'planning' | 'story_task' | 'basic_task'
  - [x] For now: Add `story_file_status` column (text, nullable) to tasks table
  - [x] Generate migration with `npm run db:generate`
  - [x] Run `npm run rebuild:electron` after schema change
  - [x] Write tests in `src/main/db/schema.test.ts`

- [x] Task 6: Update drag-drop logic for Create Story column (AC: 1)
  - [x] Modify `KanbanBoard.tsx` handleDragEnd to handle 'create_story' status (works automatically via TaskStatus type)
  - [x] Ensure tasks can be dragged to/from Create Story column
  - [x] Add appropriate callbacks for story creation workflow
  - [x] Write tests for drag-drop to/from Create Story column

- [x] Task 7: Update task router to handle new status (AC: 1)
  - [x] Modify `src/main/trpc/routers/task.router.ts`
  - [x] Ensure updateStatus mutation accepts 'create_story' as valid status
  - [x] Update Zod schema validation (automatic via TASK_STATUS import)
  - [x] Write tests in `task.router.test.ts`

- [x] Task 8: Update ARIA announcements for 5 columns (AC: 1)
  - [x] Update announcements object in KanbanBoard.tsx (works automatically via COLUMN_CONFIG)
  - [x] Ensure screen readers properly announce Create Story column
  - [x] Test keyboard navigation between all 5 columns

- [x] Task 9: Write comprehensive tests (AC: all)
  - [x] Test 5-column layout renders correctly
  - [x] Test column order: Backlog(1) → Create Story(2) → In Progress(3) → Review(4) → Done(5)
  - [x] Test tooltip displays on Create Story column
  - [x] Test drag-drop works correctly with new column
  - [x] Test keyboard navigation works with 5 columns
  - [x] Ensure all existing tests pass

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database and config operations happen in the main process via services. The renderer NEVER directly accesses the file system or config files.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 5.1)

**Key Learnings from Story 5.1:**
1. Tests must pass before completion (currently 750+ tests)
2. Use existing patterns from services for consistency
3. Commit message format: `5.2b done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Settings UI uses shadcn/ui Select, Tooltip components
6. ConfigService handles reading/writing `.tinsu/config.yaml`
7. Toast notifications use `sonner` library via `toast.success()` / `toast.error()`

**Files Created/Modified in 5.1:**
- `src/renderer/src/components/settings/AgentSettingsPanel.tsx` - Settings UI pattern
- `src/renderer/src/components/dialogs/SettingsDialog.tsx` - Dialog wrapper pattern
- `src/shared/types/config.types.ts` - Schema extension pattern

### Existing Infrastructure to Use

**Current TASK_STATUS (from `src/shared/types/task.types.ts`):**
```typescript
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]
```

**Current COLUMN_CONFIG (from `src/renderer/src/components/board/KanbanColumn.tsx`):**
```typescript
export const COLUMN_CONFIG: Record<TaskStatus, { title: string; order: number }> = {
  backlog: { title: 'Backlog', order: 1 },
  in_progress: { title: 'In Progress', order: 2 },
  review: { title: 'Review', order: 3 },
  done: { title: 'Done', order: 4 }
}
```

**Target COLUMN_CONFIG after this story:**
```typescript
export const COLUMN_CONFIG: Record<TaskStatus, { title: string; order: number }> = {
  backlog: { title: 'Backlog', order: 1 },
  create_story: { title: 'Create Story', order: 2 },
  in_progress: { title: 'In Progress', order: 3 },
  review: { title: 'Review', order: 4 },
  done: { title: 'Done', order: 5 }
}
```

**Current KanbanBoard grid (from `src/renderer/src/components/board/KanbanBoard.tsx`):**
```typescript
<div className={cn(
  'kanban-board-bg grid h-full min-h-0 flex-1 grid-cols-4 gap-5 overflow-hidden p-5',
  className
)}>
```

**Target grid after this story:**
```typescript
<div className={cn(
  'kanban-board-bg grid h-full min-h-0 flex-1 grid-cols-5 gap-5 overflow-hidden p-5',
  className
)}>
```

### Component Patterns to Follow

**Tooltip Pattern (from shadcn/ui):**
```typescript
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

// In KanbanColumn for Create Story:
<div className="flex items-center gap-2.5">
  <h2 className="text-sm font-semibold">{config.title}</h2>
  {status === 'create_story' && (
    <>
      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
      <Tooltip>
        <TooltipTrigger>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          Story Tasks generate full story files here before development
        </TooltipContent>
      </Tooltip>
    </>
  )}
  <span className="task-count-badge">{taskCount}</span>
</div>
```

**Schema Extension Pattern:**
```typescript
// src/main/db/schema.ts - Add to tasks table
// Story 5.2b: Story file status for create_story phase
story_file_status: text('story_file_status'), // 'summary_only' | 'story_ready' | null
```

### Schema Clarification Note

The acceptance criteria mention adding these fields:
- `task_type`: enum ('story_task', 'basic_task'), default 'basic_task'
- `story_file_status`: enum ('summary_only', 'story_ready') | null
- `story_file_path`: string | null

**However**, the current schema already has:
- `task_type`: 'planning' | 'story' (different enum values)
- `story_file_path`: already exists

**Recommendation for dev agent:**
1. Do NOT change the existing `task_type` enum values ('planning' | 'story')
2. ADD `story_file_status` column as new field
3. The `story_file_path` already exists - no change needed
4. Future stories (5.2c, 5.3) will handle the story_task vs basic_task logic using a combination of existing fields

### Project Structure Notes

**Files to Modify:**
```
src/shared/types/task.types.ts          # Add 'create_story' to TASK_STATUS
src/renderer/src/components/board/KanbanColumn.tsx    # Add create_story config, tooltip
src/renderer/src/components/board/KanbanBoard.tsx     # Change grid-cols-4 → grid-cols-5
src/main/db/schema.ts                    # Add story_file_status column
src/main/trpc/routers/task.router.ts    # Update status validation
```

**Test Files to Update:**
```
src/shared/types/task.types.test.ts     # New status tests
src/renderer/src/components/board/KanbanColumn.test.tsx
src/renderer/src/components/board/KanbanBoard.test.tsx
src/main/db/schema.test.ts              # Schema tests
src/main/trpc/routers/task.router.test.ts
```

### UX Design Specifications

**From UX Design Document:**
- 5 columns: Backlog → Create Story → In Progress → Review → Done
- Column padding: 16px
- Equal-width columns on desktop (1024px+)
- Horizontal swipe/scroll for tablet (768-1023px)
- ARIA roles: `listbox` for columns, `option` for cards
- Arrow keys: ← → between columns, ↑ ↓ within column

**Z-Index Hierarchy:**
| Layer | Z-Index | Element |
|-------|---------|---------|
| Base | 0 | Board, columns, cards |
| Dropdown | 50 | Context menus, popovers |
| Dock | 100 | Terminal dock |

### Git Intelligence (Recent Commits)

```
ca2bf75 5.1 done
d6e30df correct for epic 5
e5ffb42 fix new task shorcut
39c74a6 3.3 done
19bc3e7 fix terminal on right-side
```

Story 5.1 (Agent Model Configuration) was just completed. This is the next story in Epic 5.

### Dependencies

- **Depends On:** Epic 2 (Kanban Board) - COMPLETE
- **This Story Enables:** Story 5.2c (Task Type and Story File Status), Story 5.3 (Story Task Execution Path)

### Performance Considerations

- Adding one more column has minimal performance impact
- Grid layout uses CSS Grid which is highly performant
- No additional API calls needed for the new column
- Drag-drop performance should be identical

### Edge Cases to Handle

1. **Existing tasks migration:** All existing tasks remain in their current status (no migration needed for status values)
2. **Drag to Create Story column:** Should be allowed for all task types initially (future stories will restrict this)
3. **Empty Create Story column:** Show "No tasks" message like other columns
4. **Narrow viewport:** Ensure horizontal scroll works for all 5 columns
5. **Keyboard navigation:** Ensure arrow key navigation works correctly with 5 columns

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Hard-code column order in multiple places | Use COLUMN_CONFIG for single source of truth |
| Skip tests for new column | Write comprehensive tests for all scenarios |
| Modify database without migration | Use `npm run db:generate` for migrations |
| Break existing drag-drop behavior | Ensure all current drag-drop tests pass |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/shared/types/task.types.test.ts
describe('TASK_STATUS', () => {
  it('includes create_story status', () => {
    expect(TASK_STATUS).toContain('create_story')
  })
  it('has correct order: backlog, create_story, in_progress, review, done', () => {
    expect(TASK_STATUS).toEqual(['backlog', 'create_story', 'in_progress', 'review', 'done'])
  })
})

// src/renderer/src/components/board/KanbanColumn.test.tsx
describe('KanbanColumn - Create Story', () => {
  it('renders Create Story column with correct title', () => { /* ... */ })
  it('displays tooltip on hover', () => { /* ... */ })
  it('shows FileText icon for Create Story column', () => { /* ... */ })
})

// src/renderer/src/components/board/KanbanBoard.test.tsx
describe('KanbanBoard - 5 Columns', () => {
  it('renders 5 columns in correct order', () => { /* ... */ })
  it('uses grid-cols-5 layout', () => { /* ... */ })
  it('allows drag to Create Story column', () => { /* ... */ })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.2b] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Layout-Specifications] - 5-column layout specs
- [Source: src/shared/types/task.types.ts] - Current TASK_STATUS enum
- [Source: src/renderer/src/components/board/KanbanColumn.tsx] - Current COLUMN_CONFIG
- [Source: src/renderer/src/components/board/KanbanBoard.tsx] - Current grid layout
- [Source: src/main/db/schema.ts] - Current database schema
- [Source: _bmad-output/implementation-artifacts/5-1-agent-model-configuration.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Code review performed by Claude Opus 4.5 on 2026-01-11

### Completion Notes List

- All 9 tasks completed successfully
- 5-column Kanban board implemented: Backlog → Create Story → In Progress → Review → Done
- story_file_status column added to database schema with migration
- Tooltip with FileText icon added to Create Story column header
- All 125 Story 5.2b-specific tests pass
- Code review identified and fixed missing story_file_status column in 8 test database schemas:
  - planning-init.service.test.ts
  - story-import.service.test.ts
  - artifact-linking.service.test.ts
  - agent.router.test.ts
  - artifacts.router.test.ts
  - import.router.test.ts
  - sync.router.test.ts
  - velocity.router.test.ts

### File List

**Modified Files:**
- `src/shared/types/task.types.ts` - Added 'create_story' to TASK_STATUS enum
- `src/shared/types/task.types.test.ts` - Tests for new status
- `src/renderer/src/components/board/KanbanColumn.tsx` - Added create_story column config with tooltip
- `src/renderer/src/components/board/KanbanColumn.test.tsx` - Tests for Create Story column
- `src/renderer/src/components/board/KanbanBoard.tsx` - Changed grid-cols-4 to grid-cols-5
- `src/renderer/src/components/board/KanbanBoard.test.tsx` - Tests for 5-column layout
- `src/main/db/schema.ts` - Added story_file_status column
- `src/main/db/schema.test.ts` - Schema tests
- `src/main/trpc/routers/task.router.ts` - Updated to handle create_story status
- `src/main/trpc/routers/task.router.test.ts` - Added create_story status tests + story_file_status column
- `src/main/services/planning-init.service.test.ts` - Added story_file_status column to test schema
- `src/main/services/story-import.service.test.ts` - Added story_file_status column to test schema
- `src/main/services/artifact-linking.service.test.ts` - Added story_file_status column to test schema
- `src/main/trpc/routers/agent.router.test.ts` - Added story_file_status column to test schema
- `src/main/trpc/routers/artifacts.router.test.ts` - Added story_file_status column to test schema
- `src/main/trpc/routers/import.router.test.ts` - Added story_file_status column to test schema
- `src/main/trpc/routers/sync.router.test.ts` - Added story_file_status column to test schema
- `src/main/trpc/routers/velocity.router.test.ts` - Added story_file_status column to test schema
- `package.json` - Added @radix-ui/react-tooltip dependency
- `package-lock.json` - Updated dependencies

**New Files:**
- `drizzle/20260112041036_slippery_havok/migration.sql` - Database migration for story_file_status
- `drizzle/20260112041036_slippery_havok/snapshot.json` - Migration snapshot
- `src/renderer/src/components/ui/tooltip.tsx` - Tooltip component from shadcn/ui

