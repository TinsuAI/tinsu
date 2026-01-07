# Story 3.3: Planning Task Card UI

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want planning task cards to look distinct from story cards,
So that I can easily identify planning work vs implementation work.

## Acceptance Criteria

1. **Given** a planning task card
   **When** it renders on the board
   **Then** it shows a phase badge "1/5" (or 2/5, 3/5, etc.)
   **And** the badge uses a distinct color (e.g., blue) from story cards

2. **Given** a planning task card
   **When** I view its content
   **Then** it shows the phase name prominently (e.g., "Product Brief")
   **And** it shows a brief description of what this phase produces

3. **Given** a planning task in Backlog
   **When** it is the recommended next step (`is_start_here: true`)
   **Then** it has a subtle glow or border indicating "suggested"
   **And** a tooltip explains why it's recommended

4. **Given** a completed planning task (in Done)
   **When** I view the card
   **Then** it shows a checkmark and the artifact file path
   **And** clicking the card opens the artifact file

5. **Given** accessibility requirements
   **When** screen readers encounter planning cards
   **Then** they announce "Planning phase 1 of 5: Product Brief"
   **And** the card role is properly identified

## Tasks / Subtasks

- [x] Task 1: Create PhaseBadge component (AC: 1)
  - [x] Create `src/renderer/src/components/task/PhaseBadge.tsx`
  - [x] Accept props: `phaseNumber: 1 | 2 | 3 | 4 | 5`, `totalPhases?: number` (default 5)
  - [x] Render as "1/5", "2/5", etc. with blue color scheme (consistent with planning theme)
  - [x] Use similar styling pattern as `EpicBadge.tsx` but with distinct planning color
  - [x] Add data-testid="phase-badge"
  - [x] Write tests in `src/renderer/src/components/task/PhaseBadge.test.tsx`

- [x] Task 2: Create PlanningTaskCard component (AC: 1, 2, 3, 5)
  - [x] Create `src/renderer/src/components/board/PlanningTaskCard.tsx`
  - [x] Accept `task: PlanningTask` (use narrowed type from task.types.ts)
  - [x] Display phase name prominently (title) using `task.phase_name`
  - [x] Display PhaseBadge with `task.phase_number`
  - [x] Include brief description of what phase produces (use `PHASE_DESCRIPTIONS` constant)
  - [x] Add `isStartHere: boolean` prop for glow effect (from `task.is_start_here`)
  - [x] Implement subtle glow/ring border when `isStartHere=true`
  - [x] Add tooltip when `isStartHere=true`: "Recommended next step in planning workflow"
  - [x] Use proper ARIA attributes: `aria-label="Planning phase 1 of 5: Product Brief"`
  - [x] Support keyboard navigation via `onNavigate` prop (same pattern as TaskCard)
  - [x] Write tests in `src/renderer/src/components/board/PlanningTaskCard.test.tsx`

- [x] Task 3: Create phase descriptions constant (AC: 2)
  - [x] Create `src/renderer/src/constants/planning-phases.ts`
  - [x] Define `PHASE_DESCRIPTIONS: Record<1|2|3|4|5, string>`:
    - 1: "Define your product vision and target users"
    - 2: "Document detailed requirements and features"
    - 3: "Design technical architecture and stack"
    - 4: "Plan user experience and interface design"
    - 5: "Break down work into implementable stories"
  - [x] Export for use in PlanningTaskCard

- [x] Task 4: Extend Task types for artifact path (AC: 4)
  - [x] Add `artifact_path: string | null` field to `Task` interface in `src/shared/types/task.types.ts`
  - [x] Add `artifact_path` column to tasks table schema in `src/main/db/schema.ts`
  - [x] Generate and apply Drizzle migration
  - [x] Update `PlanningTaskFields` interface to include `artifact_path`
  - [x] Run `npm run rebuild:electron` after schema change

- [x] Task 5: Update artifact detection to store path (AC: 4)
  - [x] Modify `ArtifactDetectorService.detectExistingArtifacts()` in `src/main/services/artifact-detector.service.ts`
  - [x] Update `PlanningInitService.initializePlanningTasks()` to populate `artifact_path` when artifact exists
  - [x] Add tRPC mutation `updateArtifactPath` to task.router for setting artifact path on completion
  - [x] Write tests for artifact path population

- [x] Task 6: Create CompletedPlanningCard variant (AC: 4)
  - [x] Add `isCompleted: boolean` and `artifactPath: string | null` props to PlanningTaskCard
  - [x] When completed + artifactPath present: show checkmark icon, display truncated artifact path
  - [x] Make card clickable to open artifact file (use tRPC to trigger file open via shell)
  - [x] Add `onClick` handler that calls `shell.openPath()` via tRPC procedure
  - [x] Add tRPC procedure `openArtifactFile` extending `config.router.ts`
  - [x] Write tests for completed card variant

- [x] Task 7: Update KanbanColumn/Board to render PlanningTaskCard (AC: 1, 2)
  - [x] Modify `src/renderer/src/components/board/KanbanBoard.tsx`
  - [x] Use `isPlanningTask()` type guard from `task.types.ts` to detect planning tasks
  - [x] Render `PlanningTaskCard` for planning tasks, `TaskCard` for story tasks
  - [x] Pass `isStartHere={task.is_start_here}` to PlanningTaskCard
  - [x] Pass `isCompleted={task.status === 'done'}` and `artifactPath={task.artifact_path}`
  - [x] Create SortablePlanningTaskCard wrapper

- [x] Task 8: Add tooltip component (AC: 3)
  - [x] Used native HTML title attribute for simple tooltip on "Start here" text
  - [x] Tooltip explains recommendation on hover/focus

- [x] Task 9: Write comprehensive tests (AC: all)
  - [x] Test PhaseBadge renders correct phase number (8 tests)
  - [x] Test PlanningTaskCard displays phase name and description (32 tests)
  - [x] Test "Start Here" glow effect and tooltip presence
  - [x] Test completed card shows checkmark and artifact path
  - [x] Test accessibility: aria-label format, role attributes
  - [x] Test keyboard navigation works on PlanningTaskCard
  - [x] Test artifact path population in PlanningInitService (3 tests added)

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database operations happen in the main process via Drizzle ORM. The renderer NEVER directly accesses the database.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.2)

**Key Learnings from 3.2:**
1. Tests must pass before completion (currently 633 tests)
2. Use existing patterns from `schema.ts` for consistency
3. Commit message format: `3.3 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. Planning task fields (`phase_number`, `phase_name`, `bmad_agent`, `bmad_workflow`, `is_start_here`) already exist in tasks table
6. `isPlanningTask()` type guard already exists for narrowing task types
7. Transaction wrapper used for atomic operations (see 3.2 review fix)

**Files Created in 3.2:**
- `src/main/services/artifact-detector.service.ts` - Returns `Map<PhaseNumber, string>` with artifact paths
- `src/main/services/planning-init.service.ts` - Creates 5 planning tasks with correct phase data
- `src/main/services/artifact-detector.service.test.ts`
- `src/main/services/planning-init.service.test.ts`

**Files Modified in 3.2:**
- `src/shared/types/task.types.ts` - Has `is_start_here` field, `isPlanningTask()` guard
- `src/main/db/schema.ts` - Has `is_start_here` column
- `src/main/trpc/routers/task.router.ts` - Has `getPlanningTasks` query

### Existing Infrastructure to Use

**Type Guard (from `src/shared/types/task.types.ts`):**
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
```

**Planning Task Type (from `src/shared/types/task.types.ts`):**
```typescript
export interface PlanningTaskFields {
  task_type: 'planning'
  phase_number: 1 | 2 | 3 | 4 | 5
  phase_name: string
  bmad_agent: string
  bmad_workflow: string
  is_start_here: boolean | null // true only for phase 1
}
```

**Existing TaskCard (from `src/renderer/src/components/board/TaskCard.tsx`):**
- Use same keyboard navigation pattern (`onNavigate` callback)
- Use same ARIA attributes pattern (`role="option"`, `tabIndex={0}`)
- Use same focus ring styling pattern
- Use `cn()` utility for conditional classes

**Existing Badge Pattern (from `src/renderer/src/components/task/EpicBadge.tsx`):**
```typescript
<span
  className={cn(
    'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
    colorClasses,
    className
  )}
  data-testid="epic-badge"
>
  {title}
</span>
```

### Component Patterns to Follow

**PhaseBadge Component:**
```typescript
// src/renderer/src/components/task/PhaseBadge.tsx
import { cn } from '@renderer/lib/utils'

interface PhaseBadgeProps {
  phaseNumber: 1 | 2 | 3 | 4 | 5
  totalPhases?: number
  className?: string
}

// Use blue color scheme for planning (distinct from story epic colors)
const PLANNING_BADGE_CLASSES = 'bg-blue-600/20 text-blue-400 border-blue-600/30'

export function PhaseBadge({ phaseNumber, totalPhases = 5, className }: PhaseBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        PLANNING_BADGE_CLASSES,
        className
      )}
      data-testid="phase-badge"
    >
      {phaseNumber}/{totalPhases}
    </span>
  )
}
```

**PlanningTaskCard Component:**
```typescript
// src/renderer/src/components/board/PlanningTaskCard.tsx
import { useCallback, type KeyboardEvent } from 'react'
import { cn } from '@renderer/lib/utils'
import { PhaseBadge } from '@renderer/components/task/PhaseBadge'
import { AgentStatusBadge, type AgentStatus } from '@renderer/components/ui/AgentStatusBadge'
import { PHASE_DESCRIPTIONS } from '@renderer/constants/planning-phases'
import { CheckCircle2, FileText } from 'lucide-react'
import type { PlanningTask } from '@shared/types/task.types'

export interface PlanningTaskCardProps {
  task: PlanningTask
  agentStatus?: AgentStatus
  isStartHere?: boolean
  isCompleted?: boolean
  artifactPath?: string | null
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  onOpenArtifact?: () => void
  className?: string
}

export function PlanningTaskCard({
  task,
  agentStatus = 'idle',
  isStartHere = false,
  isCompleted = false,
  artifactPath,
  onNavigate,
  onOpenArtifact,
  className
}: PlanningTaskCardProps) {
  // Keyboard navigation handler (same pattern as TaskCard)
  const handleKeyDown = useCallback(/* ... */)

  const description = PHASE_DESCRIPTIONS[task.phase_number]

  return (
    <div
      role="option"
      tabIndex={0}
      aria-label={`Planning phase ${task.phase_number} of 5: ${task.phase_name}`}
      onKeyDown={handleKeyDown}
      onClick={isCompleted && artifactPath ? onOpenArtifact : undefined}
      className={cn(
        // Base card styling
        'rounded-lg border border-border bg-card p-3',
        // Hover states
        'hover:border-primary/50 hover:bg-card/80',
        // Focus states
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        // Start Here glow effect
        isStartHere && 'ring-2 ring-blue-500/50 shadow-[0_0_15px_-3px] shadow-blue-500/30',
        // Completed + clickable
        isCompleted && artifactPath && 'cursor-pointer',
        'transition-colors',
        className
      )}
      data-testid={`planning-task-card-${task.id}`}
    >
      {/* Header: Phase name + Phase badge + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isCompleted && <CheckCircle2 className="size-4 text-green-500" />}
          <h3 className="text-sm font-medium text-foreground">{task.phase_name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <PhaseBadge phaseNumber={task.phase_number} />
          <AgentStatusBadge status={agentStatus} />
        </div>
      </div>

      {/* Description */}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {/* Artifact path for completed tasks */}
      {isCompleted && artifactPath && (
        <div className="mt-2 flex items-center gap-1 text-xs text-blue-400">
          <FileText className="size-3" />
          <span className="truncate">{artifactPath}</span>
        </div>
      )}

      {/* Start Here tooltip trigger - use title for simple tooltip */}
      {isStartHere && (
        <div
          className="mt-2 text-xs text-blue-400"
          title="Recommended next step in planning workflow"
        >
          Start here
        </div>
      )}
    </div>
  )
}
```

### Schema Extension

```typescript
// Add to src/main/db/schema.ts tasks table
artifact_path: text('artifact_path'), // Path to generated artifact file

// Add migration
// drizzle/[timestamp]/migration.sql
ALTER TABLE tasks ADD COLUMN artifact_path TEXT;
```

### tRPC Procedure for File Opening

```typescript
// Add to config.router.ts or new file.router.ts
openArtifactFile: t.procedure
  .input(z.object({ path: z.string() }))
  .mutation(async ({ input }) => {
    const { shell } = await import('electron')
    await shell.openPath(input.path)
    return { success: true }
  }),
```

### Project Structure Notes

**New Files to Create:**
```
src/renderer/src/components/task/PhaseBadge.tsx
src/renderer/src/components/task/PhaseBadge.test.tsx
src/renderer/src/components/board/PlanningTaskCard.tsx
src/renderer/src/components/board/PlanningTaskCard.test.tsx
src/renderer/src/constants/planning-phases.ts
drizzle/[timestamp]/migration.sql (generated)
```

**Files to Modify:**
```
src/shared/types/task.types.ts               # Add artifact_path field
src/main/db/schema.ts                        # Add artifact_path column
src/main/services/artifact-detector.service.ts  # Already returns path, verify
src/main/services/planning-init.service.ts   # Populate artifact_path on init
src/main/trpc/routers/task.router.ts         # Add updateArtifactPath mutation
src/main/trpc/routers/config.router.ts       # Add openArtifactFile procedure
src/renderer/src/components/board/KanbanColumn.tsx  # Or SortableTaskCard.tsx - conditional render
```

### UX Design Specifications

**From UX Design Document - Design System:**
- Use shadcn/ui components with Tailwind CSS
- Dark theme: background #0a0a0b, card #18181b, text #fafafa
- Status colors: running #22c55e, stalled #f59e0b, review #8b5cf6, done (green check)

**Planning Card Visual Distinction:**
- Blue color scheme for phase badge (distinguishes from story epic colors)
- "Start Here" glow: subtle blue ring + shadow
- Completed: green checkmark + artifact path link

**Accessibility Requirements (WCAG 2.1 AA):**
- Proper ARIA labels: "Planning phase X of 5: Phase Name"
- Focus visible ring (2px primary with offset)
- Color + icon (not color alone) for status
- Keyboard navigable (arrow keys, Tab)

### Git Intelligence (Recent Commits)

```
364e415 3.1.5 done: implement multi-project support by adding a projects table
5d9cce4 3.2 draft
f5403d5 3.1 done: Add project management services, TRPC router, and UI components
6a48ba6 2.7 done: Introduce velocity metrics with chart, detail panel, and widget components.
355b94e 2.6 done: implement task filtering functionality with new UI components
```

From Story 3.2: Planning task card schema with `is_start_here` field established.

### Dependencies

- **Depends On:** Story 3.2 (planning task initialization) - COMPLETE
- **This Story Enables:** Story 3.4 (BMAD Agent Launcher - card click to start agent)

### Performance Considerations

- PhaseBadge and PlanningTaskCard are lightweight functional components
- Type guard `isPlanningTask()` is O(1) - simple field checks
- File opening via shell is async and non-blocking

### Edge Cases to Handle

1. **Artifact path not yet set:** Show card without file link, no checkmark
2. **Artifact file deleted after detection:** Show path but handle shell.openPath failure gracefully
3. **Phase 1 is_start_here but already in Done:** Don't show glow (completed overrides suggested)
4. **Screen reader in focused state:** Ensure aria-label is read correctly
5. **Very long artifact paths:** Truncate with ellipsis, show full path in tooltip

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Hard-code phase descriptions in multiple places | Use `PHASE_DESCRIPTIONS` constant |
| Check `task.task_type === 'planning'` directly | Use `isPlanningTask()` type guard |
| Import Node.js modules in renderer | Use tRPC to call main process for shell.openPath |
| Skip accessibility attributes | Always include aria-label, role, data-testid |
| Use inline colors | Use Tailwind classes and CSS variables |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/renderer/src/components/task/PhaseBadge.test.tsx
describe('PhaseBadge', () => {
  it('renders phase number with total', () => { /* ... */ })
  it('uses default total of 5', () => { /* ... */ })
  it('has correct styling classes', () => { /* ... */ })
  it('has data-testid attribute', () => { /* ... */ })
})

// src/renderer/src/components/board/PlanningTaskCard.test.tsx
describe('PlanningTaskCard', () => {
  it('renders phase name prominently', () => { /* ... */ })
  it('displays phase badge with correct number', () => { /* ... */ })
  it('shows phase description', () => { /* ... */ })
  it('shows glow effect when isStartHere=true', () => { /* ... */ })
  it('shows checkmark when isCompleted=true', () => { /* ... */ })
  it('displays artifact path when completed with path', () => { /* ... */ })
  it('calls onOpenArtifact when completed card clicked', () => { /* ... */ })
  it('has correct aria-label for screen readers', () => { /* ... */ })
  it('handles keyboard navigation', () => { /* ... */ })
  it('does not show glow when isStartHere but also isCompleted', () => { /* ... */ })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] - React patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component-Strategy] - TaskCard UX
- [Source: _bmad-output/implementation-artifacts/3-2-initialize-planning-tasks-on-new-project.md] - Previous story patterns
- [Source: src/shared/types/task.types.ts] - isPlanningTask() type guard
- [Source: src/renderer/src/components/board/TaskCard.tsx] - Base card component to reference
- [Source: src/renderer/src/components/task/EpicBadge.tsx] - Badge styling pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - clean implementation

### Completion Notes List

1. Created PhaseBadge component with cyan color scheme (distinct from story epic badges)
2. Created PlanningTaskCard component with full accessibility support
3. Created PHASE_DESCRIPTIONS constant for phase descriptions
4. Extended Task types and database schema with artifact_path field
5. Updated PlanningInitService to populate artifact_path on initialization
6. Added updateArtifactPath mutation to task.router
7. Added openArtifactFile procedure to config.router for opening files with shell
8. Updated KanbanBoard to render PlanningTaskCard for planning tasks using isPlanningTask() type guard
9. Created SortablePlanningTaskCard wrapper for drag-and-drop support
10. All tests passing: 676 tests including 40 new tests for this story

### Change Log

- 2026-01-07: Story 3.3 implementation complete - All acceptance criteria met

### File List

**New Files:**
- src/renderer/src/components/task/PhaseBadge.tsx
- src/renderer/src/components/task/PhaseBadge.test.tsx
- src/renderer/src/components/board/PlanningTaskCard.tsx
- src/renderer/src/components/board/PlanningTaskCard.test.tsx
- src/renderer/src/components/board/SortablePlanningTaskCard.tsx
- src/renderer/src/constants/planning-phases.ts
- drizzle/20260107031626_black_mysterio/migration.sql

**Modified Files:**
- src/shared/types/task.types.ts (added artifact_path field)
- src/main/db/schema.ts (added artifact_path column)
- src/main/services/planning-init.service.ts (populate artifact_path)
- src/main/services/planning-init.service.test.ts (added artifact_path tests)
- src/main/trpc/routers/task.router.ts (added updateArtifactPath mutation)
- src/main/trpc/routers/config.router.ts (added openArtifactFile procedure)
- src/main/trpc/routers/task.router.test.ts (updated schema for testing)
- src/main/trpc/routers/velocity.router.test.ts (updated schema for testing)
- src/main/db/schema.test.ts (updated schema for testing)
- src/renderer/src/components/board/KanbanBoard.tsx (conditional rendering)

