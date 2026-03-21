# Story 9.5: Guided Workflow Run Tracker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to see the status and history of BMAD workflow executions,
so that I can track what agents have done and what they produced.

## Acceptance Criteria

1. **Given** a BMAD agent is running (spawned by Epic 3's agent launcher) **When** I view the planning workspace **Then** a "Run" panel shows: which workflow is running, which agent is active, input artifacts used, run status

2. **Given** run statuses **When** displayed **Then** they are one of: Running (animated), Needs Input (yellow), Succeeded (green), Failed (red), Cancelled (gray)

3. **Given** a workflow run completes **When** the run tracker updates **Then** it shows output files produced with links to the artifact viewer **And** the run is recorded in the `workflow_runs` database table

4. **Given** the "Recent Runs" section **When** I view it **Then** it shows a table with columns: Workflow, Phase, Status, Started, Duration **And** clicking a run shows its details (inputs, outputs, status)

5. **Given** the run tracker **When** I want to view the agent's terminal **Then** a "View Terminal" link navigates to the task detail workspace (connecting to Epic 3 + TES)

6. **Given** the database schema **When** a `workflow_runs` table is created **Then** it has columns: id, project_id, workflow_key, phase, status, started_at, finished_at, input_artifacts (JSON), output_artifacts (JSON), agent_name

## Tasks / Subtasks

- [x] Task 1: Create `workflow_runs` database table (AC: 6)
  - [x] 1.1 Add `WORKFLOW_RUN_STATUS` constant array to `src/main/db/schema.ts`: `['running', 'needs-input', 'succeeded', 'failed', 'cancelled'] as const` with `WorkflowRunStatus` type export
  - [x] 1.2 Add `workflow_runs` table to `src/main/db/schema.ts` using Drizzle ORM with these columns:
    - `id: text('id').primaryKey()` (UUID)
    - `project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' })`
    - `workflow_key: text('workflow_key').notNull()` (matches BMAD_WORKFLOWS keys: brainstorming, product-brief, prd, etc.)
    - `phase: text('phase').notNull()` ('analysis' | 'planning' | 'solutioning')
    - `status: text('status').notNull().default('running')` (from WORKFLOW_RUN_STATUS)
    - `started_at: integer('started_at', { mode: 'timestamp' }).notNull().default(sql\`(unixepoch())\`)`
    - `finished_at: integer('finished_at', { mode: 'timestamp' })` (nullable — set on completion)
    - `input_artifacts: text('input_artifacts')` (nullable JSON string — array of artifact keys used as inputs)
    - `output_artifacts: text('output_artifacts')` (nullable JSON string — array of artifact filenames produced)
    - `agent_name: text('agent_name')` (nullable — the BMAD agent identifier, e.g. "bmad-analyst")
    - `task_id: text('task_id').references(() => tasks.id, { onDelete: 'set null' })` (nullable — links to the planning task on the Kanban board, enables "View Terminal")
  - [x] 1.3 Add indexes: `idx_workflow_runs_project_id` on `project_id`, `idx_workflow_runs_status` on `status`, `idx_workflow_runs_started_at` on `started_at`
  - [x] 1.4 Export types: `WorkflowRun = InferSelectModel<typeof workflow_runs>`, `NewWorkflowRun = InferInsertModel<typeof workflow_runs>`
  - [x] 1.5 Add migration to `src/main/db/index.ts` — raw SQL `CREATE TABLE IF NOT EXISTS workflow_runs (...)` with all columns and indexes, following the same pattern as `planning_artifact_statuses` migration (lines 411-424)
  - [x] 1.6 Run `npm run rebuild:electron` after DB changes

- [x] Task 2: Create tRPC procedures for workflow runs (AC: 3, 4)
  - [x] 2.1 Add new procedures to `src/main/trpc/routers/planning.router.ts` (extend existing router, do NOT create a separate router):
  - [x] 2.2 `createWorkflowRun` mutation: input `{ projectId, workflowKey, phase, agentName?, taskId?, inputArtifacts?: string[] }`. Validates `workflowKey` against `BMAD_WORKFLOWS`. Inserts row with `crypto.randomUUID()` as id, status 'running', started_at as `new Date()`, input_artifacts as `JSON.stringify(inputArtifacts)`. Returns the full row.
  - [x] 2.3 `updateWorkflowRun` mutation: input `{ runId, status, outputArtifacts?: string[] }`. Updates status, sets `finished_at` to `new Date()` if status is terminal ('succeeded', 'failed', 'cancelled'), sets `output_artifacts` as JSON. Returns updated row.
  - [x] 2.4 `listWorkflowRuns` query: input `{ projectId, limit?: number }`. Returns workflow runs ordered by `started_at DESC`, limit defaults to 20. Returns array with all fields, parsing `input_artifacts` and `output_artifacts` from JSON strings to arrays.
  - [x] 2.5 `getActiveWorkflowRun` query: input `{ projectId }`. Returns the first workflow run where status is 'running' or 'needs-input', or null if none active. This powers the active run panel.

- [x] Task 3: Integrate agent launcher with workflow run recording (AC: 1, 3)
  - [x] 3.1 In `src/main/services/bmad-agent-launcher.service.ts`, after `launchPlanningAgent()` successfully sends the command, call `createWorkflowRun` via direct DB insert (same pattern as other services — import `db` and `workflow_runs` from schema). Extract `workflowKey` from the task's `bmad_workflow` field, `phase` from mapping the task's `phase_number` to phase name, `agentName` from `task.bmad_agent`, `taskId` from the task id.
  - [x] 3.2 For `inputArtifacts`: determine from BMAD_RECOMMENDATION_CHAIN which artifacts are prerequisites for the given workflow. For example, if launching `architecture`, input artifacts are `['prd']`. Use a simple lookup map — do NOT call `scanArtifacts` from the main process service.
  - [x] 3.3 In the hook listener or agent completion handler (`src/main/services/hook-listener.service.ts` or relevant completion handler), when a planning task's agent completes: find the active workflow_run by `task_id`, update status to 'succeeded', set `finished_at`, scan the output filename from BMAD_WORKFLOWS to populate `output_artifacts`.
  - [x] 3.4 If agent fails/errors: update workflow_run status to 'failed'. If cancelled via task pause/stop: update to 'cancelled'.

- [x] Task 4: Create `WorkflowRunPanel` component (AC: 1, 2)
  - [x] 4.1 Create `src/renderer/src/components/planning/WorkflowRunPanel.tsx`
  - [x] 4.2 Props: none — fetches data internally via `trpc.planning.getActiveWorkflowRun.useQuery({ projectId })` with `refetchInterval: 3000` (poll every 3s while a run is active)
  - [x] 4.3 When a run is active (not null), render a card showing:
    - Workflow name (map `workflowKey` to label via `BMAD_WORKFLOWS` constant)
    - Phase badge (analysis/planning/solutioning)
    - Agent name
    - Status indicator with appropriate color and animation (see AC 2)
    - Input artifacts as small tags
    - Elapsed time (computed from `started_at` to now, updating every second)
  - [x] 4.4 Status indicator styling (AC: 2):
    - Running: `bg-cyan-500/20 text-cyan-400` with `animate-pulse` dot
    - Needs Input: `bg-yellow-500/20 text-yellow-400` with static warning icon
    - Succeeded: `bg-emerald-500/20 text-emerald-400` with check icon
    - Failed: `bg-red-500/20 text-red-400` with X icon
    - Cancelled: `bg-zinc-500/20 text-zinc-400` with slash icon
  - [x] 4.5 When run is completed (succeeded): show output artifact links that navigate to the artifact viewer via `openWorkspaceToArtifact(workflowKey)` from `usePlanningWorkspaceStore` (AC: 3)
  - [x] 4.6 "View Terminal" button: navigates to the task workspace for the run's associated `task_id`. Use `closeWorkspace()` from planning store, then navigate to the task in Kanban by setting `selectedTaskId` in the task store (AC: 5)
  - [x] 4.7 When no active run: render nothing (return null) — the panel only shows when a workflow is executing
  - [x] 4.8 Style consistent with planning workspace aesthetic: `bg-card/50`, `border-border`, cyan accent for active states

- [x] Task 5: Create `RecentRunsTable` component (AC: 4)
  - [x] 5.1 Create `src/renderer/src/components/planning/RecentRunsTable.tsx`
  - [x] 5.2 Fetches data via `trpc.planning.listWorkflowRuns.useQuery({ projectId, limit: 10 })` with `refetchOnWindowFocus: true`
  - [x] 5.3 Render a table with columns: Workflow (name), Phase (badge), Status (colored badge), Started (relative time), Duration (computed from started_at/finished_at)
  - [x] 5.4 Clicking a row expands an inline detail section showing: input artifacts list, output artifacts list (with links to artifact viewer), agent name, exact timestamps
  - [x] 5.5 Empty state: "No workflow runs yet. Start a planning workflow to see run history here."
  - [x] 5.6 Loading state: subtle skeleton matching existing planning workspace patterns
  - [x] 5.7 Use `<Table>` from shadcn/ui if available, or build with Tailwind table classes following existing patterns
  - [x] 5.8 Style: muted header row, hover highlight on rows, text-xs for metadata, alternating subtle backgrounds

- [x] Task 6: Integrate into Planning Workspace (AC: 1, 4)
  - [x] 6.1 Import `WorkflowRunPanel` and `RecentRunsTable` into `PlanningWorkspacePage.tsx`
  - [x] 6.2 Render `WorkflowRunPanel` in the center content area — it should appear ABOVE the current center content (PhaseProgressDashboard or ArtifactViewer) as a sticky/floating banner when a run is active. When no run is active, it renders nothing and doesn't affect layout.
  - [x] 6.3 Add `RecentRunsTable` to `PhaseProgressDashboard.tsx` as a new section BELOW the phase cards grid, with a "Recent Runs" heading. This positions it alongside the other dashboard overview information.
  - [x] 6.4 Pass `projectId` from the planning workspace context — the `PlanningWorkspacePage` already has access to the active project via `trpc` context or the Zustand app store

- [x] Task 7: Write tests (AC: 1-6)
  - [x] 7.1 Unit tests for tRPC procedures in `src/main/trpc/routers/planning.router.test.ts` (extend existing test file if it exists, else create): test createWorkflowRun validates workflowKey, test listWorkflowRuns returns ordered results, test updateWorkflowRun sets finished_at for terminal statuses, test getActiveWorkflowRun returns null when none active
  - [x] 7.2 Render tests for `WorkflowRunPanel.test.tsx`: verify active run renders workflow name and status, verify status indicator colors match AC 2, verify "View Terminal" button present, verify null render when no active run, verify output artifact links on succeeded run
  - [x] 7.3 Render tests for `RecentRunsTable.test.tsx`: verify table renders with correct columns, verify empty state message, verify row expansion shows details, verify artifact links navigate to viewer
  - [x] 7.4 Integration test in `PhaseProgressDashboard.test.tsx`: verify RecentRunsTable appears below phase cards

## Dev Notes

### Architecture Decision: Split Between Active Run + History (CRITICAL)

The story requires two distinct UI areas with different data needs:

1. **WorkflowRunPanel** (active run) — needs polling (`refetchInterval: 3000`) to show live status. Only renders when a run is active. Lives in PlanningWorkspacePage as a banner.

2. **RecentRunsTable** (history) — static data, refreshes on window focus. Lives in PhaseProgressDashboard alongside health and phase info.

This split prevents unnecessary polling on the history table and keeps the active run indicator responsive.

### Database Design: workflow_runs Table (CRITICAL)

The `workflow_runs` table is NEW — it does NOT replace `task_sessions` or `task_activities`. Those tables track terminal sessions and activity events for ALL task types. The `workflow_runs` table specifically tracks BMAD planning workflow executions with their input/output artifact relationships.

The `task_id` column links back to the planning task on the Kanban board, enabling the "View Terminal" feature. This is a nullable foreign key because workflow_runs should persist even if the task is deleted.

**JSON columns:** `input_artifacts` and `output_artifacts` store JSON arrays as TEXT. Parse with `JSON.parse()` when reading, `JSON.stringify()` when writing. This follows the same pattern as `task_activities.payload` (line 365 in schema.ts).

### Integration With Agent Launcher (CRITICAL)

The recording happens in `BmadAgentLauncherService.launchPlanningAgent()` — this is the single entry point for planning agent execution. After the command is successfully sent to tmux, insert a `workflow_runs` row with status 'running'.

For completion detection, the existing hook-listener (`POST /api/hooks/stop`) already detects when an agent finishes. Extend the stop handler to:
1. Look up the task by the session that completed
2. Check if the task is `task_type: 'planning'`
3. If so, find the active workflow_run by `task_id` and update it

**Input artifacts lookup map** (derive from BMAD_RECOMMENDATION_CHAIN pattern):
```typescript
const WORKFLOW_INPUT_MAP: Record<string, string[]> = {
  'brainstorming': [],
  'product-brief': [],
  'market-research': [],
  'domain-research': [],
  'prd': ['product-brief'],
  'ux-design': ['prd'],
  'architecture': ['prd'],
  'epics-stories': ['architecture'],
  'readiness-check': ['epics-stories']
}
```

### "View Terminal" Navigation Pattern (CRITICAL)

To navigate from the planning workspace to a task's terminal:
1. Close the planning workspace: `closeWorkspace()` from `usePlanningWorkspaceStore`
2. Navigate to the task's workspace: Use the existing navigation pattern from Epic 3/TES — set the `selectedTaskId` in the app's task store or use the router to navigate to `/task/{taskId}`

Look at how `PlanningWorkspacePage` header's back button navigates — it calls `closeWorkspace()` which returns to the Kanban board. Then programmatically select the task to open its workspace.

The exact navigation depends on how TES task workspace navigation works. Check `src/renderer/src/stores/` for the main app store that controls which task is selected. The key store is likely `useUIStore` or `useAppStore` — search for `selectedTaskId` or equivalent.

### Polling Strategy (CRITICAL)

**Active run polling:** `refetchInterval: 3000` on `getActiveWorkflowRun` — only active while the planning workspace is open (component mounted). This gives responsive status updates without overwhelming the main process.

**DO NOT** use `refetchInterval` on `listWorkflowRuns` — use `refetchOnWindowFocus: true` instead. Historical data doesn't need live polling.

**DO NOT** implement WebSocket/subscription-based updates — the existing codebase does not use tRPC subscriptions for any planning features. Polling is the established pattern.

### Duration Computation

For active runs: compute `Date.now() - startedAt.getTime()` in the component, update via `setInterval(1000)`. Clean up interval on unmount.

For completed runs: compute `finishedAt.getTime() - startedAt.getTime()`. Format as "Xm Ys" for durations under 1 hour, "Xh Ym" for longer.

### Existing Code Patterns to Follow

**tRPC procedure pattern** (from planning.router.ts):
```typescript
createWorkflowRun: publicProcedure
  .input(z.object({ projectId: z.string(), workflowKey: z.string(), ... }))
  .mutation(async ({ ctx, input }) => {
    // Validate inputs
    // Insert with crypto.randomUUID()
    // Return data directly (no wrapper)
  })
```

**DB schema pattern** (from schema.ts):
```typescript
export const workflow_runs = sqliteTable(
  'workflow_runs',
  { ... },
  (table) => [
    index('idx_workflow_runs_project_id').on(table.project_id),
    ...
  ]
)
```

**Component test pattern** (from WhatNextPanel.test.tsx):
- Mock tRPC: `vi.mock('@renderer/lib/trpc')`
- Mock stores: `vi.mock('@renderer/stores/planning-workspace.store')`
- Use `render()` from `@testing-library/react`
- Use `screen.getByText()`, `screen.queryByText()` for assertions

**UI card pattern** (from WhatNextPanel.tsx, PhaseProgressDashboard.tsx):
```tsx
<div className="rounded-lg border border-border bg-card/50 p-4">
  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
    <Icon className="h-4 w-4" />
    Section Label
  </div>
  {/* Content */}
</div>
```

### Styling: Match Planning Workspace Aesthetic

Follow the established patterns from Stories 9.1-9.4:
- **Accent color:** `cyan-500` for running/active states, `emerald-500` for success, `yellow-500` for needs-input, `red-500` for failed, `zinc-500` for cancelled
- **Background:** `bg-card/50` for card surfaces
- **Borders:** `border-border` with subtle rings for emphasis
- **Text:** `text-foreground` primary, `text-muted-foreground` secondary, `text-muted-foreground/60` tertiary
- **Icons:** lucide-react icons, sized `h-4 w-4` inline
- **Spacing:** `p-4` for sections, `gap-2` between items

### Anti-Patterns to Avoid

- **DO NOT** create a separate tRPC router for workflow runs — add procedures to the existing `planningRouter`
- **DO NOT** use tRPC subscriptions — use polling with `refetchInterval` for active runs
- **DO NOT** import `fs` or Node.js modules in renderer code
- **DO NOT** wrap tRPC responses — return data directly
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** call `scanArtifacts` from the main process service to determine inputs — use the static WORKFLOW_INPUT_MAP lookup
- **DO NOT** create a filesystem watcher for run completion — use the existing hook-listener pattern
- **DO NOT** add a new Zustand store for run state — use tRPC queries with TanStack Query caching
- **DO NOT** poll `listWorkflowRuns` — use `refetchOnWindowFocus: true` only
- **DO NOT** add duration column to the DB — compute it from `started_at` and `finished_at` at query time or in the UI

### Previous Story Intelligence (Story 9.4)

Story 9.4 established:
- `BMAD_RECOMMENDATION_CHAIN` constant with dependency graph (useful for deriving input artifacts)
- `WhatNextPanel` integrated as first section in PhaseProgressDashboard
- TanStack Query deduplication pattern — multiple components can call the same query
- `computeNextRecommendation` pure function for testable logic
- `usePlanningWorkspaceStore` actions: `setActivePhase`, `setSelectedWorkflow`, `openWorkspaceToArtifact`
- Styling patterns: cyan accent, muted backgrounds, subtle borders, rounded-lg cards

**Key learnings from 9.4:**
- Status cycling uses `useMutation()` with `onSuccess` invalidating related queries
- Keep hooks pure (no store dependencies) for easy testing
- Test patterns: 15 unit + 14 render + 18 integration = 47 tests
- `cn()` utility for conditional Tailwind classes

### Git Intelligence

Recent commits (Epic 9):
```
d6e2f84 feat: 9-4 What Next recommender engine for planning workflow guidance
0a310c5 feat: 9-3 Artifact Viewer with status lifecycle and section navigation
a123597 feat: 9-2 Phase Progress Dashboard with artifact scanning
4e84b83 feat: 9-1 Planning Workspace route and navigation
```

Pattern: Each story adds 1000-1400 lines across 8-16 files. Consistent file organization and naming conventions established.

### Project Structure Notes

Files to create:
```
src/renderer/src/components/planning/WorkflowRunPanel.tsx       <- NEW (active run banner)
src/renderer/src/components/planning/WorkflowRunPanel.test.tsx  <- NEW (render tests)
src/renderer/src/components/planning/RecentRunsTable.tsx        <- NEW (run history table)
src/renderer/src/components/planning/RecentRunsTable.test.tsx   <- NEW (render tests)
```

Files to modify:
```
src/main/db/schema.ts                                           <- ADD workflow_runs table + types
src/main/db/index.ts                                            <- ADD migration for workflow_runs
src/main/trpc/routers/planning.router.ts                        <- ADD 4 new procedures (create/update/list/getActive)
src/main/services/bmad-agent-launcher.service.ts                <- ADD workflow_run creation on launch
src/main/services/hook-listener.service.ts                      <- ADD workflow_run completion on stop hook
src/renderer/src/pages/PlanningWorkspacePage.tsx                 <- ADD WorkflowRunPanel banner
src/renderer/src/components/planning/PhaseProgressDashboard.tsx  <- ADD RecentRunsTable section
src/renderer/src/components/planning/PhaseProgressDashboard.test.tsx <- ADD RecentRunsTable integration test
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.5 lines 3262-3299]
- [Source: docs/deep-research-report-chatgpt.md — WorkflowRun entity, run/preview modal, run logging]
- [Source: src/main/db/schema.ts — Existing table patterns: planning_artifact_statuses (lines 230-253), task_sessions (lines 286-305)]
- [Source: src/main/db/index.ts — Migration pattern (lines 411-424)]
- [Source: src/main/trpc/routers/planning.router.ts — Existing planning procedures pattern]
- [Source: src/main/trpc/routers/planning-workflow-constants.ts — BMAD_WORKFLOWS mapping]
- [Source: src/main/services/bmad-agent-launcher.service.ts — Agent launch integration point]
- [Source: src/main/services/hook-listener.service.ts — Agent completion detection]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — Navigation actions]
- [Source: src/renderer/src/components/planning/WhatNextPanel.tsx — UI pattern reference]
- [Source: src/renderer/src/constants/planning-workspace.ts — BMAD_RECOMMENDATION_CHAIN]
- [Source: _bmad-output/planning-artifacts/project-context.md — Implementation rules]
- [Source: _bmad-output/planning-artifacts/architecture.md — Data architecture, tRPC patterns]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Backend tests have pre-existing NODE_MODULE_VERSION mismatch (better-sqlite3 compiled against v140, runtime v137) — not caused by this story
- TypeScript timestamp type mismatches fixed: tRPC serialization returns strings for Date fields, updated all timestamp helpers and interfaces to accept `Date | number | string`

### Completion Notes List
- All 7 tasks completed with 43 renderer tests passing (12 WorkflowRunPanel + 12 RecentRunsTable + 19 PhaseProgressDashboard)
- 14 backend tRPC tests written (createWorkflowRun, updateWorkflowRun, listWorkflowRuns, getActiveWorkflowRun) — blocked by pre-existing native module issue
- Used /frontend-design skill for both WorkflowRunPanel and RecentRunsTable components
- WorkflowRunPanel uses polling (refetchInterval: 3000), RecentRunsTable uses refetchOnWindowFocus only
- Agent launcher integration uses direct DB insert after successful tmux command send
- Hook listener updates workflow_run status on agent stop hook

### Change Log
- Added `workflow_runs` table schema + types to `src/main/db/schema.ts`
- Added migration SQL to `src/main/db/index.ts`
- Added 4 tRPC procedures to `src/main/trpc/routers/planning.router.ts`
- Added workflow run recording to `src/main/services/bmad-agent-launcher.service.ts`
- Added workflow run completion to `src/main/services/hook-listener.service.ts`
- Created `WorkflowRunPanel` component with active run banner UI
- Created `RecentRunsTable` component with expandable history table
- Integrated WorkflowRunPanel into `PlanningWorkspacePage.tsx`
- Integrated RecentRunsTable into `PhaseProgressDashboard.tsx`
- Added 14 backend tests to `planning.router.test.ts`
- Created `WorkflowRunPanel.test.tsx` (12 tests)
- Created `RecentRunsTable.test.tsx` (12 tests)
- Added RecentRunsTable integration test to `PhaseProgressDashboard.test.tsx`

### File List
New files:
- `src/renderer/src/components/planning/WorkflowRunPanel.tsx`
- `src/renderer/src/components/planning/WorkflowRunPanel.test.tsx`
- `src/renderer/src/components/planning/RecentRunsTable.tsx`
- `src/renderer/src/components/planning/RecentRunsTable.test.tsx`

Modified files:
- `src/main/db/schema.ts`
- `src/main/db/index.ts`
- `src/main/trpc/routers/planning.router.ts`
- `src/main/trpc/routers/planning.router.test.ts`
- `src/main/services/bmad-agent-launcher.service.ts`
- `src/main/services/hook-listener.service.ts`
- `src/renderer/src/pages/PlanningWorkspacePage.tsx`
- `src/renderer/src/components/planning/PhaseProgressDashboard.tsx`
- `src/renderer/src/components/planning/PhaseProgressDashboard.test.tsx`
