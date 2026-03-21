# Story 9.1: Planning Workspace Route & Navigation

Status: review

## Story

As a founder,
I want a dedicated planning workspace accessible from the main navigation,
so that I can focus on BMAD planning phases in a purpose-built environment.

## Acceptance Criteria

1. **Given** I am on the Kanban board **When** I click the "Planning" button in the sidebar navigation **Then** I navigate to a full-screen planning workspace route (/planning) **And** the workspace displays 3 phase tabs: Analysis, Planning, Solutioning

2. **Given** I am in the planning workspace **When** I select a phase tab (e.g., "Planning") **Then** the left sidebar shows the workflows available for that phase **And** each workflow entry shows: name, purpose, and expected output filename

3. **Given** I am in the planning workspace **When** I view the center area **Then** it shows the active workflow content or the phase progress dashboard

4. **Given** the workspace header **When** I view it **Then** it shows the project name and active agent indicator (if running)

5. **Given** I click a planning task card on the Kanban board **When** the card is a planning-type task **Then** I navigate to the planning workspace with the relevant phase tab selected

6. **Given** I am in the planning workspace **When** I press Escape or click "Board" in navigation **Then** I return to the Kanban board

## Tasks / Subtasks

- [x] Task 1: Create `usePlanningWorkspaceStore` Zustand store (AC: 1, 5, 6)
  - [x] 1.1 Create `src/renderer/src/stores/planning-workspace.store.ts`
  - [x] 1.2 State: `isOpen`, `activePhase` ("analysis" | "planning" | "solutioning"), `selectedWorkflowKey`
  - [x] 1.3 Actions: `openWorkspace(phase?)`, `closeWorkspace()`, `setActivePhase(phase)`, `setSelectedWorkflow(key)`
  - [x] 1.4 Export from `src/renderer/src/stores/index.ts`

- [x] Task 2: Define BMAD planning phase/workflow constants (AC: 1, 2)
  - [x] 2.1 Create `src/renderer/src/constants/planning-workspace.ts`
  - [x] 2.2 Define `BMAD_PHASES` array: Analysis, Planning, Solutioning with metadata
  - [x] 2.3 Define `BMAD_WORKFLOWS` mapping each workflow to its phase, name, purpose, and expected output filename

- [x] Task 3: Add "Planning" button to Sidebar (AC: 1)
  - [x] 3.1 Add a "Planning" navigation button in `Sidebar.tsx` above or below SprintList
  - [x] 3.2 When collapsed, show a planning icon (e.g., `Compass` or `Map` from lucide-react)
  - [x] 3.3 On click, call `usePlanningWorkspaceStore.openWorkspace()`

- [x] Task 4: Create `PlanningWorkspacePage` full-screen component (AC: 1, 2, 3, 4, 6)
  - [x] 4.1 Create `src/renderer/src/pages/PlanningWorkspacePage.tsx`
  - [x] 4.2 Layout: full-screen (fixed inset-0 z-50) with header + phase tabs + content area
  - [x] 4.3 Header: project name (from useProjectStore), "Board" back button, active agent indicator placeholder
  - [x] 4.4 Phase tabs: 3 tabs (Analysis, Planning, Solutioning) using shadcn Tabs component
  - [x] 4.5 Left sidebar: list of workflows for the active phase from BMAD_WORKFLOWS
  - [x] 4.6 Center area: placeholder for phase progress dashboard (Story 9.2 fills this)
  - [x] 4.7 Escape key handler: close workspace and return to board
  - [x] 4.8 Body scroll lock when workspace is open

- [x] Task 5: Integrate PlanningWorkspacePage in App.tsx (AC: 1, 6)
  - [x] 5.1 Import `usePlanningWorkspaceStore` and `PlanningWorkspacePage`
  - [x] 5.2 Add conditional render: `{isPlanningOpen && <PlanningWorkspacePage />}`
  - [x] 5.3 Hide AppShell when planning workspace is open (same pattern as `isViewingTask`)

- [x] Task 6: Connect planning task cards to workspace navigation (AC: 5)
  - [x] 6.1 In `KanbanBoardContainer.tsx` or `PlanningTaskCard.tsx`, on click of a planning-type task card, call `openWorkspace(mappedPhase)` with the correct phase based on task `phase_number`
  - [x] 6.2 Phase mapping: phase 1 → "analysis", phase 2 → "planning", phase 3 → "solutioning", phase 4 → "planning", phase 5 → "solutioning"

- [x] Task 7: Write tests (AC: 1-6)
  - [x] 7.1 Unit test for `usePlanningWorkspaceStore` (open, close, phase switching, workflow selection)
  - [x] 7.2 Render test for `PlanningWorkspacePage` (tabs render, phase switching, workflow list, escape key)
  - [x] 7.3 Render test for Sidebar "Planning" button (renders, calls openWorkspace on click)

## Dev Notes

### Navigation Architecture (CRITICAL)

TinSu does **NOT** use React Router. All navigation is **Zustand store-driven** with conditional rendering in `App.tsx`.

**Existing pattern** (follow exactly):
```
App.tsx line 119-134:
  isViewingTask = !!activeTaskId   → renders <TaskWorkspacePage />
  isViewingStory = !!activeStoryId → renders <StoryFullView />
  else                             → renders <AppShell><KanbanBoardContainer /></AppShell>
```

**New pattern to add:**
```
  isPlanningOpen = usePlanningWorkspaceStore(s => s.isOpen) → renders <PlanningWorkspacePage />
```

The AppShell is hidden (`className="hidden"`) when any full-screen view is active. Follow the same `inert` and `aria-hidden` attributes for accessibility.

### Full-Screen Workspace Pattern (CRITICAL)

Follow `TaskWorkspacePage.tsx` exactly:
- `fixed inset-0 z-50` for full-screen overlay
- Escape key listener with check that Monaco editor isn't focused
- Body scroll lock via `useEffect` on `document.body.style.overflow`
- Focus trap for accessibility

### Sidebar Integration

Current Sidebar (`src/renderer/src/components/layout/Sidebar.tsx` lines 1-53):
- Contains only `SprintList` inside a `<nav>` element
- When collapsed (`sidebarCollapsed`), shows a Calendar icon
- Width toggles between `w-60` and `w-16`

Add the "Planning" button:
- Place it above or below the SprintList, visually separated with a border
- When collapsed: show a planning icon (e.g., `Compass` from lucide-react)
- When expanded: show "Planning" text label + icon
- Active state: highlight when planning workspace is open

### BMAD Phase → Workflow Mapping

The 3 BMAD phases group the workflows:

| Phase | Workflows | Expected Output |
|-------|-----------|-----------------|
| Analysis | Brainstorming, Product Brief, Market Research, Domain Research | product-brief.md, market-research.md, etc. |
| Planning | PRD, UX Design | prd.md, ux-design-specification.md |
| Solutioning | Architecture, Epics & Stories, Implementation Readiness Check | architecture.md, epics.md |

**Phase ↔ Existing Planning Task Phases:**
| Planning Task Phase # | Maps to BMAD Phase |
|-----------------------|--------------------|
| 1 (Product Brief) | Analysis |
| 2 (PRD) | Planning |
| 3 (Architecture) | Solutioning |
| 4 (UX Design) | Planning |
| 5 (Epics & Stories) | Solutioning |

### Workflow Entry Data Structure

Each workflow entry in the sidebar should show:
- **Name**: e.g., "Create PRD"
- **Purpose**: e.g., "Document detailed requirements and features"
- **Output file**: e.g., "prd.md"

Define this as a static constant — no database queries needed for this story.

### Active Agent Indicator (Header)

For Story 9.1, the agent indicator in the header is a **placeholder only**. Show "No agent active" in muted text. Story 9.8 implements the full agent persona indicator.

### Center Content Area (Placeholder)

For Story 9.1, the center content area shows a simple placeholder:
- "Select a workflow from the sidebar to get started"
- Or a minimal summary of the phase with workflow cards
- Story 9.2 replaces this with the Phase Progress Dashboard

### UI Component Choices

| Component | Use |
|-----------|-----|
| `shadcn/ui Tabs` | Phase tabs (Analysis, Planning, Solutioning) |
| `shadcn/ui Button` | "Board" back button, sidebar Planning button |
| `shadcn/ui Badge` | Phase labels, workflow status |
| `cn()` utility | Conditional class merging (from `@renderer/lib/utils`) |
| `lucide-react` icons | Navigation icons, workflow icons |

### Existing Stores Reference

| Store | File | Purpose |
|-------|------|---------|
| `useTaskWorkspaceStore` | `stores/task-workspace.store.ts` | Pattern to follow for navigation store |
| `useStoryViewStore` | `stores/story-view.store.ts` | Another navigation store pattern |
| `useUIStore` | `stores/ui.store.ts` | Sidebar collapse state, filters |
| `useProjectStore` | `stores/project.store.ts` | Project name/path |
| `useThemeStore` | `stores/theme.store.ts` | Theme state |

### Project Structure Notes

Files to create:
```
src/renderer/src/stores/planning-workspace.store.ts     ← NEW
src/renderer/src/constants/planning-workspace.ts         ← NEW
src/renderer/src/pages/PlanningWorkspacePage.tsx          ← NEW (🎨 use /frontend-design)
```

Files to modify:
```
src/renderer/src/stores/index.ts                         ← ADD export
src/renderer/src/App.tsx                                 ← ADD conditional render
src/renderer/src/components/layout/Sidebar.tsx           ← ADD Planning button
src/renderer/src/components/board/PlanningTaskCard.tsx    ← ADD click → openWorkspace
```

Test files to create:
```
src/renderer/src/stores/planning-workspace.store.test.ts
src/renderer/src/pages/PlanningWorkspacePage.test.tsx
```

### Anti-Patterns to Avoid

- **DO NOT** use React Router or URL-based routing — this app uses Zustand store state
- **DO NOT** create a tRPC router for this story — the workflow data is static constants
- **DO NOT** create CSS files — use Tailwind inline classes only
- **DO NOT** import Node.js modules in renderer — all renderer code is browser-only
- **DO NOT** use `useState` for the active phase — use the Zustand store for navigation state
- **DO NOT** over-engineer the center content area — it's a placeholder (Story 9.2 replaces it)
- **DO NOT** implement the full agent persona indicator — just a "No agent active" placeholder

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 Story 9.1]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-03-21.md#Story 9.1]
- [Source: src/renderer/src/App.tsx - Navigation pattern lines 119-134]
- [Source: src/renderer/src/stores/task-workspace.store.ts - Full-screen workspace store pattern]
- [Source: src/renderer/src/pages/TaskWorkspacePage.tsx - Full-screen workspace component pattern]
- [Source: src/renderer/src/components/layout/Sidebar.tsx - Sidebar integration point]
- [Source: src/renderer/src/components/board/PlanningTaskCard.tsx - Planning task card click handler]
- [Source: src/renderer/src/constants/planning-phases.ts - Existing phase constants]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- No halts or blockers encountered

### Completion Notes List
- Created Zustand store for planning workspace navigation (open/close/phase/workflow state)
- Defined BMAD_PHASES and BMAD_WORKFLOWS constants with phase-to-workflow mapping
- Built PlanningWorkspacePage using /frontend-design skill with full-screen overlay pattern matching TaskWorkspacePage
- Added shadcn/ui Tabs component (newly installed)
- Added "Planning" button to Sidebar with Compass icon, active state, collapsed/expanded support
- Integrated PlanningWorkspacePage in App.tsx following existing isViewingTask/isViewingStory pattern
- Connected PlanningTaskCard click to open planning workspace with correct phase mapping
- 38 tests written: 10 store unit tests, 15 page render tests, 13 sidebar tests (4 new planning button tests)
- All new tests pass; no regressions in existing tests
- Fixed pre-existing Sidebar test mock (SprintList mock) to work with current component

### File List
New files:
- src/renderer/src/stores/planning-workspace.store.ts
- src/renderer/src/constants/planning-workspace.ts
- src/renderer/src/pages/PlanningWorkspacePage.tsx
- src/renderer/src/stores/planning-workspace.store.test.ts
- src/renderer/src/pages/PlanningWorkspacePage.test.tsx
- src/renderer/src/components/ui/tabs.tsx (shadcn/ui Tabs)

Modified files:
- src/renderer/src/stores/index.ts (added export)
- src/renderer/src/App.tsx (added conditional render for PlanningWorkspacePage)
- src/renderer/src/components/layout/Sidebar.tsx (added Planning button)
- src/renderer/src/components/board/PlanningTaskCard.tsx (added click → openWorkspace navigation)
- src/renderer/src/components/layout/Sidebar.test.tsx (fixed mock, added planning button tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updates)
- _bmad-output/implementation-artifacts/9-1-planning-workspace-route-and-navigation.md (task checkboxes, completion notes)

### Change Log
- 2026-03-21: Implemented Story 9.1 - Planning Workspace Route & Navigation. Created planning workspace store, constants, full-screen page component, sidebar integration, and planning task card navigation. 38 tests added.
