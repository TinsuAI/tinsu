# Story 2.1: Render Kanban Board with 4 Columns

Status: done

## Story

As a founder,
I want to see a Kanban board with four columns (Backlog, In Progress, Review, Done),
So that I can visualize the status of all my tasks at a glance (FR1).

## Acceptance Criteria

1. **Given** the app shell from Epic 1
   **When** I navigate to the main board view
   **Then** I see four columns: "Backlog", "In Progress", "Review", "Done"
   **And** columns have equal width with 16px padding
   **And** column headers display the column name and task count

2. **Given** the board is rendered
   **When** I view the layout
   **Then** columns are arranged left-to-right in status order
   **And** the board fills the main content area
   **And** columns scroll vertically if content overflows

3. **Given** the board uses the dark theme
   **When** I view the columns
   **Then** column backgrounds use the card color (#18181b)
   **And** column headers have subtle borders for separation

## Tasks / Subtasks

- [x] Task 1: Create KanbanBoard component (AC: 1, 2)
  - [x] Create `src/renderer/src/components/board/KanbanBoard.tsx`
  - [x] Implement 4-column grid layout using CSS grid or flex
  - [x] Map TASK_STATUS enum to column configuration
  - [x] Integrate with AppShell via MainContent children
  - [x] Create `KanbanBoard.test.tsx` with render tests

- [x] Task 2: Create KanbanColumn component (AC: 1, 2, 3)
  - [x] Create `src/renderer/src/components/board/KanbanColumn.tsx`
  - [x] Implement column header with title and task count
  - [x] Style with dark theme colors (--card: #18181b)
  - [x] Add vertical scroll for overflow content
  - [x] Create `KanbanColumn.test.tsx` with render tests

- [x] Task 3: Fetch and display tasks from tRPC (AC: 1, 2)
  - [x] Use `trpc.tasks.getAll.useQuery()` in KanbanBoardContainer
  - [x] Group tasks by status using TASK_STATUS enum
  - [x] Pass filtered tasks to each KanbanColumn
  - [x] Handle loading and error states

- [x] Task 4: Wire board into app routing (AC: 1)
  - [x] Update App.tsx to render KanbanBoard when project is open
  - [x] Ensure board respects terminal dock height offset
  - [x] Export board components from index barrel file

## Dev Notes

### Critical Architecture Patterns

**Component Location:**
- Board components go in `src/renderer/src/components/board/`
- Create `index.ts` barrel file for clean exports
- Co-locate tests with components: `KanbanBoard.test.tsx` next to `KanbanBoard.tsx`

**State Management:**
- Use tRPC + TanStack Query for task data (server state)
- NEVER use `useState` for data from main process
- Use Zustand stores ONLY for local UI state (e.g., selected task ID)
- Existing pattern: see `src/renderer/src/stores/ui.store.ts`

**Styling:**
- Use Tailwind classes inline exclusively
- NEVER create separate CSS files
- Use `cn()` utility from `@renderer/lib/utils` for conditional classes
- Dark theme tokens from UX spec:
  - `--background`: #0a0a0b (board background)
  - `--card`: #18181b (column/card surface)
  - `--border`: #27272a (subtle dividers)
  - `--text`: #fafafa (primary text)
  - `--text-muted`: #a1a1aa (secondary text)

**Import Aliases:**
- Use `@renderer/` path alias for renderer imports
- Example: `import { cn } from '@renderer/lib/utils'`
- Example: `import { trpc } from '@renderer/lib/trpc'`

### Existing Code to Reuse

**Task Status Enum:**
```typescript
// Already exists at src/main/db/schema.ts:16-17
export const TASK_STATUS = ['backlog', 'in_progress', 'review', 'done'] as const
export type TaskStatus = (typeof TASK_STATUS)[number]
```

**tRPC Task Router:**
- `trpc.task.getAll.useQuery()` - Returns all tasks
- Already implemented at `src/main/trpc/routers/task.router.ts`
- Tasks have: id, title, description, status, epic_id, sprint_id, created_at, updated_at

**Layout Integration:**
- `MainContent` component accepts children: `src/renderer/src/components/layout/MainContent.tsx`
- `AppShell` wraps everything: `src/renderer/src/components/layout/AppShell.tsx`
- Terminal dock height is managed via `useTerminalStore`

**Shared Types:**
- Import Task type from `src/shared/types/task.types.ts` in renderer
- Do NOT import directly from schema.ts in renderer (main process only)

### Project Structure Notes

**Create these files:**
```
src/renderer/src/components/board/
├── index.ts              # Barrel export
├── KanbanBoard.tsx       # Main board container
├── KanbanBoard.test.tsx  # Board tests
├── KanbanColumn.tsx      # Single column component
└── KanbanColumn.test.tsx # Column tests
```

**Integrate with:**
```
src/renderer/src/App.tsx  # Add board routing/display
```

### Testing Standards

**Use Vitest + Testing Library:**
```typescript
// Test setup already exists at src/renderer/src/test-setup.ts
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
```

**Mock tRPC for renderer tests:**
- Tests run in happy-dom environment
- Mock the trpc hooks rather than actual IPC

**NFR Targets:**
- Board loads in <1 second (NFR2)
- No layout shift during task rendering

### Column Configuration

Map status values to display names:
| Status | Display Name | Order |
|--------|--------------|-------|
| `backlog` | Backlog | 1 |
| `in_progress` | In Progress | 2 |
| `review` | Review | 3 |
| `done` | Done | 4 |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] - Component patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Patterns] - Naming conventions
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component-Strategy] - KanbanBoard/KanbanColumn specs
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual-Design-Foundation] - Color tokens
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

No debug issues encountered during implementation.

### Completion Notes List

1. **KanbanColumn Component** - Created with column header (title + task count), dark theme styling (bg-card, border-border), and vertical scroll support (overflow-y-auto). Exports COLUMN_CONFIG for status-to-display mapping.

2. **KanbanBoard Component** - Implements 4-column CSS grid layout (grid-cols-4) with 16px gaps (gap-4) and padding (p-4). Groups tasks by status and renders columns in correct order (Backlog, In Progress, Review, Done). Includes loading state.

3. **KanbanBoardContainer** - Wrapper component that handles tRPC data fetching with `trpc.tasks.getAll.useQuery()`. Manages loading/error states and transforms task dates from tRPC serialization.

4. **App Integration** - Updated App.tsx to render KanbanBoardContainer inside AppShell when project is open. Board respects terminal dock height via AppShell's existing padding logic.

5. **Path Alias Configuration** - Added `@shared` path alias to vitest.config.ts, electron.vite.config.ts, and tsconfig.web.json to support importing shared types in renderer.

6. **Test Coverage** - 28 tests covering:
   - KanbanColumn: rendering, styling, dark theme, scroll behavior (11 tests)
   - KanbanBoard: grid layout, column order, task grouping, loading state (11 tests)
   - KanbanBoardContainer: tRPC integration, loading/error states (6 tests)

### File List

**New Files:**
- src/renderer/src/components/board/KanbanBoard.tsx
- src/renderer/src/components/board/KanbanBoard.test.tsx
- src/renderer/src/components/board/KanbanColumn.tsx
- src/renderer/src/components/board/KanbanColumn.test.tsx
- src/renderer/src/components/board/KanbanBoardContainer.tsx
- src/renderer/src/components/board/KanbanBoardContainer.test.tsx
- src/renderer/src/components/board/index.ts

**Modified Files:**
- src/renderer/src/App.tsx (added KanbanBoardContainer import and rendering)
- src/shared/types/task.types.ts (fixed Task.status type from string to TaskStatus)
- tsconfig.web.json (added @shared path alias and src/shared include)
- electron.vite.config.ts (added @shared path alias)
- vitest.config.ts (added @shared path alias)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: in-progress → done)

## Change Log

- 2026-01-05: Implemented KanbanBoard and KanbanColumn components with 4-column grid layout, dark theme styling, and tRPC integration. Added comprehensive test coverage (28 tests). Integrated board into App.tsx with AppShell. All 278 project tests pass.
- 2026-01-05: [Code Review] Fixed 3 MEDIUM issues: (1) Removed debug console.log from KanbanBoardContainer.tsx, (2) Reverted unrelated db/index.ts debug log, (3) Fixed Task.status type from `string` to `TaskStatus` for type safety. All 278 tests pass.
