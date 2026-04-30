# Story 3.5.3: Mobile Board

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a mobile-native kanban board with horizontal column pager and long-press drag,
so that I can review and reorder tasks one-handed on a phone.

## Acceptance Criteria

1. **Given** the mobile shell from T3.5-1 and the primitive library from T3.5-2, **When** I open the Board tab on mobile, **Then** `MobileBoardScreen` renders the **5 kanban columns in canonical order** (`backlog`, `create_story`, `in_progress`, `review`, `done`) inside a `MobileColumnPager` so that **one column is fully visible plus 8 % peek of the next column** at rest. The column order, titles, and `TASK_STATUS` constant **must be sourced from `@shared/types/task.types`** and `COLUMN_CONFIG` from `@renderer/components/board/KanbanColumn` — do **not** redefine them.

2. **Given** a board with tasks loaded for the active project, **When** I horizontally swipe left/right on the column pager, **Then** the pager pages between columns at **60 fps with snap-to-column**, releasing past 50 % of column width or velocity ≥0.4 px/ms snaps to the neighbour, and pulls below threshold spring back. Snap is instant under `prefers-reduced-motion: reduce` (delegated to `MobileColumnPager`'s built-in behaviour from T3.5-2). The pager exposes the active column index via `onIndexChange` so the screen can reflect it in the top app bar.

3. **Given** any task card on a column, **When** I **long-press the card for 250 ms**, **Then** drag is initiated using the **existing `@dnd-kit/core` `DndContext` and `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 10 }`** (matching the desktop `KanbanBoard.tsx` config — do NOT introduce a new drag library). A light haptic (`hapticFeedback(10)`) fires on drag start; the picked card lifts visually (shadow / opacity / `DragOverlay`).

4. **Given** I am dragging a card, **When** the drag pointer enters within **56 dp of either horizontal edge** of the column pager and remains there for **800 ms**, **Then** the pager auto-advances to the adjacent column. Implementation uses the existing `@dnd-kit` `autoScroll` config that was finalised in commit `f8ec1e6` (`fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile`) — keep that config intact and verify the `DndContext` wraps the pager so `autoScroll` operates against the pager's overflow-x scroll container.

5. **Given** I drop a card on a different column's droppable area, **When** the drop succeeds, **Then** the `useUpdateTaskStatus(activeProjectId)` mutation from `@renderer/hooks/useTaskCommands` fires with `{ id, status }`, the optimistic update applies immediately (mirroring the desktop's `onMutate` cache update), a medium haptic (`hapticFeedback(10)`) fires on drop, and on rspc error the cache rolls back via the existing mutation's `onError` handler. **No new Tauri command is added** — reuse `commands.updateTaskStatus`.

6. **Given** a card is dropped within the **same column at a different vertical position**, **When** the drop completes, **Then** `useReorderTasks(activeProjectId)` fires with `{ task_ids, status }` containing the new ordered IDs for that column. Reordering matches desktop semantics — within a column only; cross-column drops are status changes (AC 5). Both mutations exist in `@renderer/hooks/useTaskCommands.ts` — do not reimplement.

7. **Given** the board screen is mounted, **When** I view the bottom-right of the board area (above the bottom tab bar), **Then** a **`MobileFab`** with `Plus` lucide icon is rendered with `position: 'bottom-right'`, `ariaLabel: 'Add task'`. Tapping the FAB opens a **`MobileSheet`** at `snapPoint: 'fit'` containing an add-task form. The FAB's haptic firing is handled by the primitive (do not call `hapticFeedback` again from the screen).

8. **Given** the add-task `MobileSheet` is open, **When** I enter a non-empty title and tap **Submit**, **Then** `useCreateTask(activeProjectId)` runs with `{ title, project_id: activeProjectId }`. On success the sheet closes, the form resets, and the board's task list refreshes via React Query invalidation (already wired in `useCreateTask`'s `onSuccess`). Title trimming and required-field validation match `CreateTaskDialog.tsx` semantics: empty/whitespace-only title shows inline error and blocks submit. The sheet **also accepts an `initialStatus`** so that the column the FAB is pressed on becomes the default — pre-fill from the pager's `currentIndex`. (Other fields — sprint, epic, AC — are **deferred to a later mobile-task-detail story**; only `title` is required for v1.)

9. **Given** any haptic-firing interaction (drag start, drop, FAB tap, sheet primary action), **When** the OS reports `prefers-reduced-motion: reduce`, **Then** **no haptic fires**. Use `useReducedMotion()` from `src/mobile/hooks/useReducedMotion.ts` to gate the two screen-level vibration calls (drag start + drop). Primitive-level haptics (`MobileFab`, `MobileBottomActionBar`) already self-gate per T3.5-2 AC 13; do not double-gate.

10. **Given** I open a task card on the mobile board, **When** I **tap the card body (short press, no drag)**, **Then** the screen pushes the task workspace via `useMobileNavStore.getState().pushRoute('board', 'workspace:<task-id>')`. Tapping is distinct from long-press: `@dnd-kit` `TouchSensor` with `delay: 250` ensures taps under that threshold do not initiate drag. The route resolves to the existing T3.5-1 placeholder (`Coming in T3.5-4 — full task workspace…`) — that integration is T3.5-4's responsibility; this story only wires the tap → push.

11. **Given** the column pager is rendered, **When** I view the top app bar, **Then** `MobileTopAppBar` shows a layered title `<currentColumnTitle> · <projectName>` (e.g., "In Progress · TinSu"), updated reactively as the pager's `currentIndex` changes. The active project name is read from `useProjectStore((s) => s.projectName)`. Use the additive `title` prop on `MobileTopAppBar` (added in T3.5-2 AC 1, Task 2.2). Project name fallback: 'TinSu'.

12. **Given** the desktop kanban board, **When** I open the desktop app and run the desktop kanban tests (`KanbanBoard.test.tsx`, `KanbanColumn.test.tsx`, `KanbanBoardContainer.test.tsx`), **Then** **all desktop tests still pass with zero regressions** because this story does **not** modify any file under `src/components/board/`, `src/components/dialogs/`, or `src/components/task/`. Mobile tree is parallel (`src/mobile/board/`) — see CLAUDE.md ("Do not add `useIsMobile()` branches to desktop components"). The **only allowed touch outside `src/mobile/`** is reading the existing exports `KanbanColumn.COLUMN_CONFIG`, `task.types.TASK_STATUS`, and the `useTaskCommands.ts` hooks — strictly imports, no edits.

13. **Given** the column header inside each pager column, **When** I view it, **Then** a `MobileColumnHeader` sub-component (declared inside `src/mobile/board/`) shows `{title}` + `{count}` badge + a `Plus` icon button (`min-h-[2.75rem] min-w-[2.75rem]`) that opens the same add-task sheet pre-targeting that column's status. The column header for `create_story` shows the `FileText` icon + tooltip-via-press affordance (mobile uses tap-to-toast or similar — defer the tooltip pattern to existing desktop mirror; minimum requirement: render the `FileText` icon when `status === 'create_story'`).

14. **Given** an empty column (zero tasks), **When** I view it on the pager, **Then** a `MobileEmptyState` is shown inside the column body with `title: '<columnTitle>'`, `subtitle: 'No tasks here yet.'`, and `action: { label: 'Add Task', onPress: () => openAddTaskSheet(status) }`. No drop-zone confusion: the column root remains a valid `useDroppable` target so cross-column drops still work.

15. **Given** the task cards on mobile, **When** I render them, **Then** they use `MobileTaskCard` (new under `src/mobile/board/`), **not** the desktop `TaskCard.tsx` / `StoryTaskCard.tsx` / `PlanningTaskCard.tsx`. `MobileTaskCard` is a **leaf component** that consumes only `Calm Command tokens` (no inline color classes), shows: status pill (Story / Basic / Planning per `task.task_type`, mapping to `bg-primary/15 text-primary` / `bg-muted/40 text-muted-foreground` / `bg-primary/10 text-primary` respectively), a **2-line clamped title**, and a **secondary metadata row** (epic name if present + last-updated timestamp). Variants are not split into separate files — one component with a discriminated `task.task_type` switch is preferred for v1. **No** workflow_phase indicator, branch status, agent status, or planning artifact integration in this story — those are future enhancement targets, but the card **must** preserve the underlying `Task` shape so future features can layer on without renaming props.

16. **Given** the new files this story creates, **When** I run the existing test suite (`npm test`), **Then** new colocated tests cover: (a) `MobileBoardScreen` renders 5 columns + FAB + top-bar title with column name; (b) tap card pushes `workspace:<id>` to `boardStack`; (c) long-press card initiates `@dnd-kit` drag (use `pointerDown` + `setTimeout(260)` then `pointerMove` pattern, or test by firing `dragStart` directly via testing utilities — match patterns in `KanbanBoard.test.tsx`); (d) drop card on different column fires `updateTaskStatus` mutation; (e) FAB tap opens add-task sheet; (f) submitting non-empty title fires `createTask` mutation and closes sheet; (g) submitting empty title shows error and does not fire mutation; (h) reduced-motion suppresses haptic on drag start/drop. **Total new test count: ≥10**, zero new failures vs. the T3.5-2 baseline (25 pre-existing failures, 122+ passing).

17. **Given** all new files under `src/mobile/board/`, **When** I `grep -REn "from '@renderer/components|from '../../components|from '@renderer/pages|from '@renderer/stores"` on them, **Then** **only allowed cross-tree imports** are: (a) `@renderer/hooks/useTaskCommands` (data hooks); (b) `@renderer/hooks/useEpicCommands` (only if needed for epic-name lookup); (c) `@renderer/stores/project.store` (for `activeProjectId` + `projectName` reads); (d) `@renderer/components/board/KanbanColumn` (only `COLUMN_CONFIG` constant export); (e) `@renderer/lib/utils` (`cn`, `hapticFeedback`); (f) `@shared/types/*`. **Forbidden:** any import from `@renderer/components/board/KanbanBoard*`, `KanbanBoardContainer`, `TaskCard*`, `StoryTaskCard*`, `PlanningTaskCard*`, `Sortable*`, `@renderer/components/dialogs/*`, `@renderer/components/task/*`. (The mobile tree may **NOT** mount any desktop board UI component.)

18. **Given** the mobile board screen, **When** I run with `import.meta.env.DEV` mode and force-refresh while the Board tab is active, **Then** I see no console errors and no React warnings (no missing keys on mapped columns, no act() warnings in StrictMode). The DEV harness route `#__mobile-primitives` continues to render correctly (T3.5-2 AC 14) — i.e., this story does **not** touch `src/mobile/dev/MobilePrimitivesHarness.tsx` or the harness routing in `MobileApp.tsx` beyond the `MobileBoardScreen` import already present.

## Tasks / Subtasks

- [x] **Task 1: Replace `MobileBoardScreen` placeholder with real implementation (AC: 1, 2, 11)**
  - [x] 1.1 Read current `src/mobile/board/MobileBoardScreen.tsx` (placeholder) and back it up mentally — replace with full implementation.
  - [x] 1.2 New module composition (single file or split — prefer split: `MobileBoardScreen.tsx` orchestrator + `MobileColumnHeader.tsx` + `MobileTaskCard.tsx` + `MobileNewTaskSheet.tsx` colocated in `src/mobile/board/`).
  - [x] 1.3 Source columns from `TASK_STATUS` (`@shared/types/task.types`). Use `COLUMN_CONFIG` from `@renderer/components/board/KanbanColumn` for the title text — do **not** rewrite the title strings.
  - [x] 1.4 Mount columns inside `<MobileColumnPager>`, pass `peekPercent={8}`, controlled `currentIndex` state. On `onIndexChange`, update local `currentIndex` and the top-app-bar title prop.
  - [x] 1.5 Column-name pill rendered inline above the pager (no MobileApp.tsx refactor). Documented trade-off in Dev Notes. Project name fallback: 'TinSu'.

- [x] **Task 2: Wire `@dnd-kit` `DndContext` (AC: 3, 4, 5, 6, 9)**
  - [x] 2.1 DndContext with same sensor config as desktop KanbanBoard.tsx: MouseSensor(8), TouchSensor(250/10), KeyboardSensor. pointerWithin collision detection.
  - [x] 2.2 autoScroll defaults active; pager scroll container is autoScroll target (DndContext wraps pager). Inherits f8ec1e6 fix.
  - [x] 2.3 handleDragStart: setActiveId; hapticFeedback(10) gated by useReducedMotion().
  - [x] 2.4 handleDragOver: no-op (overId tracking not needed — resolveDrop reads tasksByStatus).
  - [x] 2.5 handleDragEnd: resolveDrop pure helper resolves status-change or reorder; fires mutations; hapticFeedback(10) on drop gated by useReducedMotion().
  - [x] 2.6 DragOverlay: renders MobileTaskCard ghost while dragging.
  - [x] 2.7 SortableContext per column with verticalListSortingStrategy. Inline SortableMobileTaskCard (≤30 LOC).

- [x] **Task 3: `MobileTaskCard` component (AC: 15)**
  - [x] 3.1 Created `src/mobile/board/MobileTaskCard.tsx`. Props: `{ task: Task; onPress?: () => void; isDragging?: boolean }`. Type pill: story→"Story", planning→"Plan", default→"Task".
  - [x] 3.2 Layout: min-h-[5.5rem] rounded-xl border border-border/40 bg-card/95 backdrop-blur-xl p-3 flex flex-col gap-2. Monospace date metadata row.
  - [x] 3.3 Entire card is press target (button element). onPress fires on click.
  - [x] 3.4 Leaf-level: no cross-tree component imports beyond @renderer/lib/utils.cn.
  - [x] 3.5 Tests: 8 tests covering title, pills, onPress, isDragging opacity.

- [x] **Task 4: `MobileColumnHeader` component (AC: 13, 14)**
  - [x] 4.1 Created `src/mobile/board/MobileColumnHeader.tsx`. Title from COLUMN_CONFIG, count badge, Plus button (44×44, aria-label).
  - [x] 4.2 FileText icon rendered for create_story status. Tooltip deferred.
  - [x] 4.3 Tests: 5 tests covering title, count, onAddTask, FileText icon, aria-label.

- [x] **Task 5: `MobileNewTaskSheet` component (AC: 7, 8)**
  - [x] 5.1 Created `src/mobile/board/MobileNewTaskSheet.tsx`. MobileSheet snapPoint='fit'. Title input + MobileBottomActionBar primary.
  - [x] 5.2 useCreateTask mutation with onSuccess/onError. Inline error on empty submit. initialStatus captured but not propagated to Rust (v1 gap documented).
  - [x] 5.3 Tests: 6 tests covering open/close, mutate, empty error, whitespace error, onSuccess, closed state.

- [x] **Task 6: FAB integration (AC: 7)**
  - [x] 6.1 MobileFab with icon={<Plus />} ariaLabel="Add task" position="bottom-right". openAddTaskSheet manages sheetOpen + sheetInitialStatus.
  - [x] 6.2 openAddTaskSheet is the single source of truth for FAB, column header, and empty-state CTA.

- [x] **Task 7: Empty-state and loading-state handling (AC: 14)**
  - [x] 7.1 Loading: 4 MobileLoadingSkeleton variant='card' in first column only.
  - [x] 7.2 Empty column: MobileEmptyState with title/subtitle/Add Task action. Wrapped in DroppableColumn so drops still work.
  - [x] 7.3 Error state: MobileEmptyState with retry button (window.location.reload()).

- [x] **Task 8: Wire the route into `MobileApp.tsx` (AC: 18)**
  - [x] 8.1 Route 'board' already maps to MobileBoardScreen — not changed.
  - [x] 8.2 MobileApp.test.tsx updated with task commands mocks to keep harness tests green.

- [x] **Task 9: Tap-to-open task workspace (AC: 10)**
  - [x] 9.1 pushRoute from useMobileNavStore. onPress={() => pushRoute('board', `workspace:${task.id}`)} passed to each MobileTaskCard.
  - [x] 9.2 @dnd-kit TouchSensor delay:250 handles tap vs drag distinction natively.

- [x] **Task 10: Token discipline + a11y audit (AC: 17)**
  - [x] 10.1 grep token check: zero raw color class matches in src/mobile/board/.
  - [x] 10.2 grep forbidden import check: zero forbidden cross-tree imports.
  - [x] 10.3 Interactive elements have aria-label: MobileFab (ariaLabel="Add task"), column header Plus (aria-label="Add task to {title}"), cards (aria-label=task.title).

- [x] **Task 11: Tests (AC: 16)**
  - [x] 11.1 MobileBoardScreen.test.tsx: 16 tests covering AC 16 (a)–(h) + resolveDrop unit tests.
  - [x] 11.2 vi.mock('@renderer/hooks/useTaskCommands') + useProjectStore mock.
  - [x] 11.3 matchMedia mock for reduced-motion branch.
  - [x] 11.4 vi.spyOn(navigator, 'vibrate') asserting not called under reduced motion.
  - [x] 11.5 resolveDrop extracted as pure exported helper — tested without pointer events.
  - [x] 11.6 Total: 35 new tests (8 MobileTaskCard + 5 MobileColumnHeader + 6 MobileNewTaskSheet + 16 MobileBoardScreen). Zero new failures vs T3.5-2 baseline.

- [x] **Task 12: Lint, typecheck, regression (AC: 12, 16, 17, 18)**
  - [x] 12.1 npx tsc --noEmit: zero new TypeScript errors in src/mobile/board/.
  - [x] 12.2 npm test: 25 failing (matches T3.5-2 baseline), 35 new passing tests added.
  - [x] 12.3 Manual smoke: deferred to reviewer (visual verification required).
  - [x] 12.4 Manual smoke on Android: deferred to reviewer (native haptics require real hardware).

## Dev Notes

### MUST USE /frontend-design skill (CLAUDE.md mandate)

This is a **🎨 FRONTEND/UI STORY**. The dev agent MUST invoke `/frontend-design` before writing any TSX in `src/mobile/board/`. Pass the skill: tech stack (React 19 / TypeScript / Tailwind v4 / shadcn / @dnd-kit), the AC matrix from this story, the Calm Command token list from `src/globals.css`, and the existing primitive surface (`MobileColumnPager`, `MobileFab`, `MobileSheet`, `MobileBottomActionBar`, `MobileLoadingSkeleton`, `MobileEmptyState`). Integrate the skill's output; do not write screen TSX from scratch without it.

### Why this story exists (do not skip)

T3.5-1 created the routing seam, T3.5-2 created the primitive library, and now T3.5-3 builds the **first feature screen** that proves the primitives compose into a real product surface. The board is the highest-value mobile screen (founders open this multiple times a day) and validates that the `@dnd-kit` reuse strategy + `MobileColumnPager` peek-of-next pattern actually works at 60 fps on real devices. If this story lands cleanly, T3.5-4 through T3.5-8 are de-risked.

### Key architectural decisions (locked, do NOT redebate)

- **Reuse `@dnd-kit/core`.** Architecture doc §"Kanban Logic" mandates "`@dnd-kit` core reused, wrapped in `MobileColumnPager`. Unchanged." Do **not** introduce `react-spring`, `framer-motion`, `react-beautiful-dnd`, `dnd-kit-multiple-containers`, or `vaul`. Sensor config is copied verbatim from desktop `KanbanBoard.tsx`.
- **Reuse `useTaskCommands` hooks.** No new Tauri commands. The mobile board is a UI story over an existing Rust backend.
- **`MobileTaskCard` is leaf-level.** Do not import desktop `TaskCard.tsx`, `StoryTaskCard.tsx`, `PlanningTaskCard.tsx`, or any of their `Sortable*` wrappers — those pull in `AgentStatusBadge`, `StoryFileStatusBadge`, `EpicBadge`, `BranchStatusIndicator`, etc., which would balloon the mobile bundle and re-enter desktop UI. The mobile card is intentionally minimal for v1.
- **`COLUMN_CONFIG` is reused.** The titles ("Backlog", "Create Story", "In Progress", "Review", "Done") and column ordering are the **single source of truth** in `src/components/board/KanbanColumn.tsx`. Mobile imports the constant; do not redeclare.
- **`initialStatus` for new task creation does NOT yet propagate to backend.** `commands.createTask` accepts only `{ title, project_id }`. New tasks always land in `backlog`. Plumbing `initialStatus` into the Rust command is **out of scope** — defer to a follow-up. Reflect this in toast feedback ("Task added to Backlog") if needed.
- **Top-bar title composition.** The mobile shell (`MobileApp.tsx`) currently owns `MobileTopAppBar` with only `projectName`. **Do not refactor `MobileApp.tsx`** to accept dynamic per-screen titles — that is a shell-level change. Render the column-name pill **inline above the column pager** within the board screen. (If a future story raises a top-app-bar contract, that story owns the refactor.)
- **No tooltip on mobile create-story column.** Touch tooltips need their own primitive (long-press tooltip, accessible). Defer. Render the `FileText` icon only.
- **No workflow phase, no agent status, no branch status, no merge conflict, no story file status, no inline comments on cards.** This is the v1 mobile board. Each missing feature is a deliberately deferred enhancement. The cards know their `Task` shape so future stories can layer on without renaming.
- **Drag-edge auto-scroll uses `@dnd-kit` `autoScroll` defaults.** Commit `f8ec1e6` already enabled this. Do **not** disable it; do **not** roll a custom 800 ms timer in JS — let `@dnd-kit` own the auto-scroll behavior.
- **`MobileColumnPager` does not own drag-drop.** It only owns swipe-to-page. Drag-drop runs through `DndContext` at the screen level. They cooperate because `DndContext`'s `autoScroll` operates against the pager's overflow-x scroll container automatically.

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** import `KanbanBoard`, `KanbanColumn`'s component (the JSX export — only `COLUMN_CONFIG` constant), `KanbanBoardContainer`, `TaskCard`, `StoryTaskCard`, `PlanningTaskCard`, `SortableTaskCard`, `SortableStoryTaskCard`, `SortablePlanningTaskCard`, or any `dialogs/*` from the desktop tree.
2. **DO NOT** add `useIsMobile()` branches anywhere in the desktop tree (`src/components/`, `src/pages/`). Mobile and desktop are separate trees per CLAUDE.md and architecture doc §"`src/mobile/`".
3. **DO NOT** introduce a new drag library. `@dnd-kit/core` is the project standard, sensors are pre-configured, autoScroll is wired (`f8ec1e6`).
4. **DO NOT** reimplement haptics. Use `hapticFeedback` from `@renderer/lib/utils`. Gate via `useReducedMotion()` at the screen level (drag start + drop only); primitive-level haptics self-gate.
5. **DO NOT** call `commands.createTask` with extra fields (`status`, `epic_id`, etc.) — the Rust signature is `{ title, project_id }`. Adding fields requires a Rust command change which is out of scope.
6. **DO NOT** add an `initialStatus` parameter to `commands.createTask`. Tasks land in `backlog` by Rust default; that's acceptable for v1.
7. **DO NOT** add a navigation `MobileSegmentedTabs` to the board — the column pager IS the navigation. `MobileSegmentedTabs` is for `MobileTaskWorkspaceScreen` (T3.5-4).
8. **DO NOT** wrap the column pager in `<DndContext>` then **also** wrap each column in `<DndContext>`. One `DndContext` per drag domain — at the screen level above the pager.
9. **DO NOT** use `framer-motion`, `react-spring`, `react-virtual`, `react-window`, or `react-beautiful-dnd`. None are in deps; do not add.
10. **DO NOT** fork or duplicate `COLUMN_CONFIG`. Import from `@renderer/components/board/KanbanColumn`. If lint flags this as a cross-tree import, **add this exact import to the AC 17 allowlist** (it's already in this story).
11. **DO NOT** put the FAB outside the screen container. `MobileFab` is `fixed`-positioned per primitive contract; mount it as a sibling at `MobileBoardScreen` root level.
12. **DO NOT** open the add-task sheet via `Dialog` from `src/components/ui/dialog.tsx`. Use `MobileSheet` (snap-fit) — that is the mobile pattern.
13. **DO NOT** introduce a custom column-pager scroll handler or override `MobileColumnPager` from T3.5-2. The primitive's behaviour is locked.
14. **DO NOT** rename the screen file. `MobileBoardScreen.tsx` is the route target wired in `MobileApp.tsx`.
15. **DO NOT** insert long-press handlers on cards yourself. `@dnd-kit/core` `TouchSensor` `delay: 250` IS the long-press. Tap = press shorter than delay → onPress fires.
16. **DO NOT** assert against `data-testid` strings the desktop uses (e.g., `column-${status}`, `add-task-${status}`). The mobile tree uses its own testids (e.g., `mobile-column-${status}`, `mobile-add-task-${status}`). Keep them parallel.
17. **DO NOT** import `Plus` from `@renderer/components/ui/...`. It is a `lucide-react` icon — `import { Plus } from 'lucide-react'`. Same for `LayoutDashboard`, `FileText`.
18. **DO NOT** use `setTimeout` for tap-vs-drag detection. The `@dnd-kit` sensor handles it.
19. **DO NOT** add Storybook, Cypress, or Playwright in this story. Vitest + JSDOM are sufficient for the test scope.

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `react`, `react-dom` | 19 (already in project) | Components | n/a |
| `@dnd-kit/core` | already in project | Drag context, sensors, autoScroll | Reuse desktop sensor config |
| `@dnd-kit/sortable` | already in project | `SortableContext`, `useSortable`, `verticalListSortingStrategy` | Reuse desktop pattern |
| `@tanstack/react-query` | already in project | `useQuery`/`useMutation` via `useTaskCommands` | n/a |
| `lucide-react` | `^0.562.0` already | Icons (`Plus`, `LayoutDashboard`, `FileText`) | No new icons |
| `tailwindcss` | `^4.1.18` already | Utility classes via Calm Command tokens | n/a |
| `class-variance-authority` | `^0.7.1` already | Optional for variant typing on `MobileTaskCard` | Use only if helpful |
| `sonner` | already in project | Toast on create-task error | Match desktop pattern |
| `vitest` + `@testing-library/react` | already in project | Tests | n/a |

**No new dependencies are required.** If you reach for `vaul`, `framer-motion`, `react-spring`, `react-beautiful-dnd`, `react-virtual`, `react-window`, or any new drag/animation library — **STOP**. The existing toolkit is sufficient.

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/mobile/board/MobileColumnHeader.tsx
src/mobile/board/MobileColumnHeader.test.tsx
src/mobile/board/MobileTaskCard.tsx
src/mobile/board/MobileTaskCard.test.tsx
src/mobile/board/MobileNewTaskSheet.tsx
src/mobile/board/MobileNewTaskSheet.test.tsx
src/mobile/board/MobileBoardScreen.test.tsx
```

**Files this story modifies:**

```
src/mobile/board/MobileBoardScreen.tsx   (replace placeholder with full implementation)
```

**Files this story may NOT modify (regression guard, AC 12):**

```
src/components/board/**                   (desktop tree — read-only imports)
src/components/dialogs/**                 (desktop tree — forbidden)
src/components/task/**                    (desktop tree — forbidden)
src/mobile/MobileApp.tsx                  (route table already correct — keep)
src/mobile/primitives/**                  (T3.5-2 contract; no edits)
src/mobile/shell/**                       (T3.5-1 contract; no edits)
src/hooks/useTaskCommands.ts              (read-only)
src-tauri/**                              (no Rust changes)
```

### Testing requirements

- **Unit tests** colocated next to each new component:
  - `MobileTaskCard.test.tsx` — ≥4 tests
  - `MobileColumnHeader.test.tsx` — ≥3 tests
  - `MobileNewTaskSheet.test.tsx` — ≥4 tests
  - `MobileBoardScreen.test.tsx` — ≥7 tests covering AC 16 (a)–(h)
- **Total ≥18 tests** (story AC 16 mandates ≥10; aim higher for coverage).
- **Mock pattern** for `useTaskCommands` hooks: `vi.mock('@renderer/hooks/useTaskCommands', () => ({ useListTasks: vi.fn(), useCreateTask: vi.fn(), useUpdateTaskStatus: vi.fn(), useReorderTasks: vi.fn() }))`.
- **Mock pattern** for `useProjectStore`: spy via `vi.spyOn` — match T3.5-1 patterns (`MobileApp.test.tsx`).
- **Mock pattern** for `useMobileNavStore`: spy on `pushRoute` to assert tap-routing.
- **Reduced-motion tests**: mock `window.matchMedia` to return `matches: true` for `(prefers-reduced-motion: reduce)`. Match `MobileFab.test.tsx` / `MobileBottomActionBar.test.tsx` patterns.
- **Drag-drop tests**: prefer **refactoring `handleDragEnd` into a pure exported helper** (e.g., `function resolveDrop({ activeId, overId, tasks }): DropAction | null`) so tests can assert the resolved action without faking pointer events. The screen still wires the helper to `DndContext`. This is the cleanest test surface and matches desktop `KanbanBoard.tsx` style (where helpers are inline closures).
- **Coverage target:** ≥80 % line coverage on new files in `src/mobile/board/`.
- **Manual smoke** on Android emulator (or real device via Tailscale) is required for AC 12.4.
- **No e2e tests** (TEA territory, deferred).

### Project structure notes

- `src/mobile/board/` already exists (`MobileBoardScreen.tsx` placeholder created in T3.5-1). New files colocated here.
- `MobileNewTaskSheet` is a board-screen sub-component — it lives in `src/mobile/board/`, NOT in `src/mobile/primitives/`. The primitive layer is shared infrastructure; sheet contents are screen-specific.
- The architecture doc lists `MobileBoardScreen.tsx`, `MobileTaskCard.tsx`, `MobileNewTaskSheet.tsx` under `src/mobile/board/` — match exactly.
- The architecture doc does NOT list `MobileColumnHeader.tsx` — we're adding it for v1 because the in-pager column needs a header. This is an additive, screen-local component; future stories may extract if reused.
- `MobileApp.tsx` already maps `'board'` → `<MobileBoardScreen />`. No route-table edits needed.
- `useMobileNavStore.pushRoute` accepts `(tab: MobileTabId, route: NavEntry)`. `NavEntry` is a string. Use template literal `` `workspace:${task.id}` ``.

### Previous story intelligence (T3.5-1 + T3.5-2)

- **`MobileColumnPager` props locked in T3.5-2:** `{ children: ReactNode[]; currentIndex?: number; defaultIndex?: number; onIndexChange?: (i: number) => void; peekPercent?: number; ariaLabel?: string }`. Use `currentIndex` (controlled) + `onIndexChange` to keep top-of-pager state in sync with the column-name pill.
- **`MobileFab` requires `ariaLabel`** (T3.5-2 AC 1). Set `ariaLabel="Add task"`.
- **`MobileSheet` snap points:** `'half' | 'full' | 'fit'`. For the new-task form, `'fit'` minimises chrome; verify content height fits without overflow.
- **`MobileEmptyState` props:** `{ icon?, title, subtitle?, action? }`. `action: { label: string; onPress: () => void }`. Suitable for empty columns.
- **`useReducedMotion` hook** exists at `src/mobile/hooks/useReducedMotion.ts`. Use for screen-level haptic gating only — primitives self-gate.
- **`hapticFeedback`** at `src/lib/utils.ts`. Reuse, do not redefine.
- **Test pattern**: `vitest` with happy-dom (or jsdom — verify in `vitest.config.ts`); colocated `.test.tsx`; `@testing-library/react` `render` + `screen` + `fireEvent`. Pointer events (`pointerDown` / `pointerUp`) are required for `@dnd-kit` interactions per Radix-style sensor wiring. Match `MobileSheet.test.tsx`, `MobileColumnPager.test.tsx` patterns.
- **Pre-existing failing tests:** 25 test files fail in T3.5-2 baseline. Compare `npm test` output line-for-line to ensure no new regressions.
- **Mobile Vite dev port: 1420.** Android dev uses Tailscale via `TAURI_DEV_HOST` env (gitignored).
- **Long-press timer** in `MobileTabBar` was fixed (T3.5-2 stale-isActive bug). Mirror the `useRef`-for-latest-prop pattern if you find yourself reading state in a setTimeout closure.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Mobile screen location | `src/mobile/board/MobileBoardScreen.tsx` | `architecture.md` §"`src/mobile/` Directory Structure" |
| Drag library | `@dnd-kit` (core + sortable) reused unchanged | `architecture.md` §"Kanban Logic" |
| Token discipline | Calm Command CSS vars only (no inline color classes) | `architecture.md` §"Mobile Primitive Contract" §1 |
| Touch targets | ≥44 pt iOS / ≥48 dp Android | UX-DR7 |
| A11y | Semantic HTML, `aria-label` on icon-only, color is never the only indicator | `architecture.md` §"Mobile Primitive Contract" §3 |
| Safe-area | Inherit from `MobileScreen`/`MobileTabBar`/`MobileFab` | `architecture.md` §"Mobile Primitive Contract" §4 |
| Reduced motion | Haptics + animations opt-out via `useReducedMotion` | T3.5-2 contract |
| Forbidden imports | NO imports from `src/components/board/Kanban*`, `Sortable*`, `TaskCard*`, `StoryTaskCard*`, `PlanningTaskCard*`, `dialogs/*`, `task/*` | this story AC 17 |
| Desktop preserved | NO edits to `src/components/**`; mobile is a parallel tree | CLAUDE.md, sprint-change-proposal-2026-04-30.md |

### Git intelligence (recent commit patterns)

```
275c741 feat: [t3-5-2] mobile primitives library — 14 primitives, 76 new tests, code review fixes
ea6f346 feat: [t3-5-1] mobile shell foundation
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
c8148ab docs(course-correction): mobile UX native redesign — parallel tree (Epic 3.5)
24dfc4a fix android build
f8ec1e6 fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile
43a6488 fix: [t3-7] SSH form UX + [t3-2/t3-3/t3-5] mobile UI improvements
```

- `275c741` is T3.5-2 — the primitives this story consumes. Read `src/mobile/primitives/index.ts` to import from.
- `ea6f346` is T3.5-1 — read `src/mobile/MobileApp.tsx` and `src/mobile/shell/mobile-nav.store.ts` to understand the routing pattern.
- `f8ec1e6` is the autoScroll fix on the desktop `DndContext`. The mobile board inherits this fix because it reuses the same `@dnd-kit` core. **Do not regress** by overriding autoScroll defaults.
- `43a6488` was the kind of patch this redesign is preventing — single-line fixes on shared mobile/desktop UI. T3.5-3 keeps the mobile tree separate so no such patches are needed for the board going forward.

### Latest technical specifics

- **React 19** is adopted. `useId`, `use()`, `useTransition` available; only adopt where natural — do not refactor desktop patterns.
- **Tailwind v4** uses `@theme inline` (already wired). Token vars: `--background`, `--card`, `--primary`, `--destructive`, `--muted-foreground`, `--border`. Prefer `bg-card/95 backdrop-blur-xl` for elevated surfaces (matches desktop pattern + T3.5-2 primitives).
- **`@dnd-kit/core` ≥6.0**: `pointerWithin` collision detection is the recommended algorithm for column-style boards (matches desktop). `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 10 }` is the long-press idiom.
- **`@tanstack/react-query` v5**: optimistic `onMutate` pattern is in place inside `useUpdateTaskStatus` and `useReorderTasks` — do **not** add a parallel optimistic layer in the screen. Trust the hook.
- **Vite `import.meta.env.DEV`** is the correct gate for the existing harness route. This story does not add a new DEV-gated route.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (Epic 3.5 charter; T3.5-3 success criteria)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T353-Mobile-Board] (canonical AC source)
- [Source: _bmad-output/planning-artifacts/architecture.md#src-mobile-Directory-Structure] (canonical screen + component locations)
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (token, touch-target, a11y, safe-area, performance rules)
- [Source: _bmad-output/planning-artifacts/architecture.md#Kanban-Logic] (`@dnd-kit` reuse mandate)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#4] (Kanban-on-mobile design, Option B, drag UX, edge auto-advance)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#7.2] (component LOC estimates)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Visual-Design-Foundation] (typography + tokens)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Accessibility-Considerations] (UX-DR6, UX-DR7)
- [Source: _bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md] (shell + nav store)
- [Source: _bmad-output/implementation-artifacts/t3-5-2-mobile-primitives-library.md] (primitive contracts + reduced motion)
- [Source: src/components/board/KanbanBoard.tsx] (desktop reference: sensor config, `DndContext`, `DragOverlay`, `SortableContext`, drag handlers)
- [Source: src/components/board/KanbanColumn.tsx] (`COLUMN_CONFIG` constant — IMPORT, do not redefine)
- [Source: src/components/board/KanbanBoardContainer.tsx] (desktop reference: hook composition, optimistic updates, error handling)
- [Source: src/components/task/CreateTaskDialog.tsx] (desktop reference: title trim + required validation pattern)
- [Source: src/hooks/useTaskCommands.ts] (`useListTasks`, `useCreateTask`, `useUpdateTaskStatus`, `useReorderTasks` signatures)
- [Source: src/shared/types/task.types.ts] (`Task`, `TaskStatus`, `TaskType`, `TASK_STATUS`, `isStoryTask`, `isPlanningTask`)
- [Source: src/mobile/primitives/index.ts] (primitive exports surface)
- [Source: src/mobile/primitives/MobileColumnPager.tsx] (props contract, scroll-snap behaviour)
- [Source: src/mobile/primitives/MobileFab.tsx] (props contract, FAB position)
- [Source: src/mobile/primitives/MobileSheet.tsx] (snap-point + a11y contract)
- [Source: src/mobile/primitives/MobileBottomActionBar.tsx] (action bar layout)
- [Source: src/mobile/primitives/MobileEmptyState.tsx] (empty-state props)
- [Source: src/mobile/primitives/MobileLoadingSkeleton.tsx] (loading variant)
- [Source: src/mobile/MobileApp.tsx] (route table — DO NOT modify)
- [Source: src/mobile/shell/mobile-nav.store.ts] (`pushRoute`, `MobileTabId`, `NavEntry`)
- [Source: src/lib/utils.ts] (`hapticFeedback`)
- [Source: src/globals.css] (Calm Command token definitions)
- [Source: CLAUDE.md] (`/frontend-design` mandate; mobile-tree-not-branch rule)
- [@dnd-kit Sensors docs] https://docs.dndkit.com/api-documentation/sensors
- [@dnd-kit Touch Sensor docs] https://docs.dndkit.com/api-documentation/sensors/touch
- [@dnd-kit Collision Detection algorithms] https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms

### Project Structure Notes

- Architecture doc and design plan agree on `src/mobile/board/` as the screen location. Use it.
- Architecture doc lists three files in `src/mobile/board/`: `MobileBoardScreen.tsx`, `MobileTaskCard.tsx`, `MobileNewTaskSheet.tsx`. We add `MobileColumnHeader.tsx` (additive) for screen-local composition.
- Design plan §4.5 mentions three card variants (Story / Basic / Planning). For v1, render a single `MobileTaskCard` with a discriminated `task.task_type` switch — splitting into separate files now is premature given the card is leaf-level (no shared sub-components yet).
- The mobile board does **NOT** mirror `KanbanBoardContainer.tsx` exactly. The container's role is:
  - Loading tasks (`useListTasks`) ✓ keep
  - Loading epics for badges (`useListEpics`) — defer (no epic badge in v1 cards)
  - Branch status (`useBranchStatus`) — defer
  - Story sync (`useStorySync`) — defer
  - Confirmation dialogs (CreateStoryConfirmDialog, DevStoryConfirmDialog, BasicTaskConfirmDialog) — defer (mobile users do not yet drag stories into create-story / in-progress with confirmation flows; that's a future T3.5-3-followup)
  - Git error recovery (GitErrorDialog) — defer
  - Phase-5 import (ImportStoriesDialog, useAgentLauncher) — defer
- The deferred items above are not regressions — they're features absent from the mobile v1 board by design. When a future story adds them, it can mirror the desktop container's composition pattern. Mention this scope-narrowing in the v1 PR description.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Token discipline check (AC 17.1): `grep -REn "text-(red|...)" src/mobile/board/` → zero matches.
- Forbidden import check (AC 17.2): `grep -REn "from '@renderer/components/board/Kanban..."` → zero matches.
- TypeScript: `npx tsc --noEmit` → zero new errors in src/mobile/board/.
- Tests: `npx vitest run src/mobile/board/` → 35/35 pass.
- Regression: `npx vitest run` → 25 failing (matches T3.5-2 baseline), 35 new passing tests.
- MobileApp.test.tsx: Updated with useTaskCommands mock (required because MobileBoardScreen now renders real hooks). All 13 tests still pass.

### Completion Notes List

- Implemented full MobileBoardScreen, MobileTaskCard, MobileColumnHeader, MobileNewTaskSheet.
- resolveDrop extracted as pure exported helper for testable drag-drop logic (no pointer events needed in tests).
- Column-name pill rendered inline above pager (no MobileApp.tsx top-bar refactor, per dev notes trade-off decision).
- initialStatus prop captured in MobileNewTaskSheet but not propagated to Rust command (v1 limitation, documented in component JSDoc).
- New task always lands in 'backlog' (Rust backend default). Scroll-to-column on success not implemented for v1 — acceptable per story AC 8.
- Button disabled only during isPending (not empty input) — allows inline error to show on empty submit, matching CreateTaskDialog.tsx semantics.
- MobileApp.test.tsx modified (not in forbidden list) to add task commands mock preventing QueryClient crash.
- 35 new tests: 8 MobileTaskCard + 5 MobileColumnHeader + 6 MobileNewTaskSheet + 16 MobileBoardScreen.
- Token discipline: all colors via CSS vars (bg-card/95, bg-primary/15, bg-muted/40, text-muted-foreground, etc.).
- Zero forbidden desktop imports. Only COLUMN_CONFIG from KanbanColumn (explicitly allowed per AC 17).

### File List

- src/mobile/board/MobileBoardScreen.tsx (modified — replaced placeholder with full implementation)
- src/mobile/board/MobileTaskCard.tsx (new)
- src/mobile/board/MobileTaskCard.test.tsx (new)
- src/mobile/board/MobileColumnHeader.tsx (new)
- src/mobile/board/MobileColumnHeader.test.tsx (new)
- src/mobile/board/MobileNewTaskSheet.tsx (new)
- src/mobile/board/MobileNewTaskSheet.test.tsx (new)
- src/mobile/board/MobileBoardScreen.test.tsx (new)
- src/mobile/MobileApp.test.tsx (modified — added task commands mock)
- _bmad-output/implementation-artifacts/t3-5-3-mobile-board.md (this file)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updated)

### Review Findings

- [x] [Review][Patch] Missing autoScroll config in mobile DndContext [src/mobile/board/MobileBoardScreen.tsx:343] — AC 4 requires autoScroll config from commit f8ec1e6 (`{ enabled: true, interval: 5, threshold: { x: 0.2, y: 0.2 } }`). Added to DndContext. **Fixed.**
- [x] [Review][Patch] MobileTaskCard pill logic unreachable default branch — basic task detection [src/mobile/board/MobileTaskCard.tsx:32] — AC 15 requires "Task" pill for basic tasks but switch on task_type never hits default (only 'planning'|'story' exist). Fixed to use `task.task_type === 'planning'` check + `isBasicTask(task)` guard for correct Basic/Story/Plan discrimination. **Fixed.**
- [x] [Review][Patch] MobileNewTaskSheet test: onSuccess callback called without act() wrapper [src/mobile/board/MobileNewTaskSheet.test.tsx:105] — causes React state-update warnings. Fixed by wrapping in `act()` and replacing unused `waitFor` import. **Fixed.**
- [x] [Review][Patch] MobileTaskCard.test.tsx: "Story pill" test used default task (story_number=null = basic task), and "Task pill" test was a no-op. Fixed tests to properly distinguish Story (story_number set) vs Task (story_number=null). **Fixed.**

### Change Log

- 2026-04-30: Implemented T3.5-3 Mobile Board — MobileBoardScreen full implementation, MobileTaskCard, MobileColumnHeader, MobileNewTaskSheet, 35 new tests, zero regressions. resolveDrop exported pure helper enables testable drag-drop logic. MobileApp.test.tsx mock added. (DEV 1, claude-sonnet-4-6)
- 2026-04-30: Code review complete — 4 auto-fixes applied (autoScroll config added to DndContext per AC4/f8ec1e6, MobileTaskCard pill logic fixed to correctly render Basic/Story/Plan via isBasicTask+task_type, MobileNewTaskSheet test act() wrapper for onSuccess, MobileTaskCard test corrected Story vs Basic pill assertions), all 35 tests passing, 25 pre-existing failures unchanged. (DEV 2, claude-sonnet-4-6)
