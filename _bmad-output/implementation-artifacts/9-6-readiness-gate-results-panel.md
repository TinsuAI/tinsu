# Story 9.6: Readiness Gate Results Panel

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to see the results of the implementation readiness check in a clear visual format,
So that I know whether my planning artifacts are ready for implementation.

## Acceptance Criteria

1. **Given** the readiness gate has been run **When** I view the results panel **Then** it shows a large status badge: PASS (green), CONCERNS (yellow), or FAIL (red)

2. **Given** the gate result is CONCERNS or FAIL **When** I view the issues list **Then** each issue shows: severity (Critical/Major/Minor), description, and a link to the affected artifact section **And** clicking an issue link opens the artifact viewer scrolled to that section

3. **Given** the gate result **When** I want to re-check **Then** a "Re-run Gate" button starts the readiness check workflow **And** the previous result is preserved for comparison

4. **Given** a gate decision **When** it is recorded **Then** it persists: decision (PASS/CONCERNS/FAIL), rationale text, timestamp, and list of issues **And** historical gate results are viewable

5. **Given** all planning is complete and gate passes **When** I view the results panel **Then** a prominent "Approve for Implementation" action is available **And** activating it marks all planning artifacts as "Approved" and signals readiness

6. **Given** accessibility requirements **When** the status badge renders **Then** it uses color + icon + text (not color alone) for the PASS/CONCERNS/FAIL indicator

## Tasks / Subtasks

- [x] Task 1: Create `gate_decisions` database table (AC: 4)
  - [x] 1.1 Add `GATE_DECISION_STATUS` constant array to `src/main/db/schema.ts`: `['pass', 'concerns', 'fail'] as const` with `GateDecisionStatus` type export
  - [x] 1.2 Add `gate_decisions` table to `src/main/db/schema.ts` using Drizzle ORM with these columns:
    - `id: text('id').primaryKey()` (UUID)
    - `project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' })`
    - `decision: text('decision').notNull()` ('pass' | 'concerns' | 'fail')
    - `rationale: text('rationale').notNull()` (free-text summary from the readiness report)
    - `issues: text('issues')` (nullable JSON string — array of `{ severity: 'critical' | 'major' | 'minor', description: string, artifactKey?: string, sectionRef?: string }`)
    - `created_at: integer('created_at', { mode: 'timestamp' }).notNull().default(sql\`(unixepoch())\`)`
    - `workflow_run_id: text('workflow_run_id').references(() => workflow_runs.id, { onDelete: 'set null' })` (nullable — links to the workflow run that produced this gate decision)
  - [x] 1.3 Add index: `idx_gate_decisions_project_id` on `project_id`, `idx_gate_decisions_created_at` on `created_at`
  - [x] 1.4 Export types: `GateDecision = InferSelectModel<typeof gate_decisions>`, `NewGateDecision = InferInsertModel<typeof gate_decisions>`
  - [x] 1.5 Add migration to `src/main/db/index.ts` — raw SQL `CREATE TABLE IF NOT EXISTS gate_decisions (...)` with all columns and indexes, following the same pattern as `planning_artifact_statuses` migration (line ~412) and `workflow_runs` migration (line ~426)
  - [x] 1.6 Run `npm run rebuild:electron` after DB changes

- [x] Task 2: Create readiness report parsing service (AC: 1, 2, 4)
  - [x] 2.1 Create `src/main/services/readiness-gate.service.ts`
  - [x] 2.2 Implement `parseReadinessReport(markdownContent: string): ParsedGateResult` that extracts:
    - Overall status: map "READY" → 'pass', "NEEDS WORK" → 'concerns', "NOT READY" → 'fail' (case-insensitive search in "Overall Readiness Status" section)
    - Rationale: extract text from "Summary and Recommendations" section
    - Issues list: parse from severity-marked sections (🔴 Critical → 'critical', 🟠 Major → 'major', 🟡 Minor → 'minor'). Each issue gets: severity, description (bullet text), artifactKey (inferred from mention of artifact names like "PRD", "Architecture", etc.), sectionRef (heading reference if present)
  - [x] 2.3 The parser must handle both possible output filenames: `readiness-check.md` (from BMAD_WORKFLOWS mapping) and `implementation-readiness-report-*.md` (from the check-implementation-readiness skill's step-06 output). Use glob to find the most recent match if `readiness-check.md` does not exist.
  - [x] 2.4 Define exported types in the same file:
    ```typescript
    export interface GateIssue {
      severity: 'critical' | 'major' | 'minor'
      description: string
      artifactKey?: string  // e.g., 'prd', 'architecture', 'epics-stories'
      sectionRef?: string   // e.g., 'Story 3.2' or heading text
    }
    export interface ParsedGateResult {
      decision: 'pass' | 'concerns' | 'fail'
      rationale: string
      issues: GateIssue[]
    }
    ```
  - [x] 2.5 Write unit tests in `src/main/services/readiness-gate.service.test.ts`: test parsing of READY/NEEDS WORK/NOT READY, test issue extraction with all severity levels, test graceful fallback when sections are missing

- [x] Task 3: Create tRPC procedures for gate decisions (AC: 3, 4, 5)
  - [x] 3.1 Add new procedures to `src/main/trpc/routers/planning.router.ts` (extend existing router, do NOT create a separate router):
  - [x] 3.2 `parseAndSaveGateResult` mutation: input `{ projectId, workflowRunId?: string }`. Reads the readiness report file from `_bmad-output/planning-artifacts/`, calls `parseReadinessReport()`, inserts a row into `gate_decisions` with `crypto.randomUUID()` as id, returns the parsed result + saved row. If no report file is found, throw `TRPCError({ code: 'NOT_FOUND' })`.
  - [x] 3.3 `getLatestGateDecision` query: input `{ projectId }`. Returns the most recent gate_decision row ordered by `created_at DESC`, or null. Parse `issues` from JSON string to array.
  - [x] 3.4 `listGateDecisions` query: input `{ projectId, limit?: number }`. Returns gate decisions ordered by `created_at DESC`, limit defaults to 10. Parse `issues` JSON.
  - [x] 3.5 `approveForImplementation` mutation: input `{ projectId }`. Updates ALL planning artifact statuses to 'approved' via the existing `planning_artifact_statuses` table (upsert pattern from `updateArtifactStatus` procedure). Only succeeds if the latest gate decision is 'pass'. Returns `{ approved: true, artifactCount: number }`.
  - [x] 3.6 Write tests in `src/main/trpc/routers/planning.router.test.ts` (extend existing): test parseAndSaveGateResult saves to DB, test getLatestGateDecision returns most recent, test approveForImplementation rejects when no pass decision

- [x] Task 4: Create `ReadinessGatePanel` component (AC: 1, 2, 4, 6)
  - [x] 4.1 Create `src/renderer/src/components/planning/ReadinessGatePanel.tsx`
  - [x] 4.2 Props: none — fetches data internally via `trpc.planning.getLatestGateDecision.useQuery({ projectId })` with `refetchOnWindowFocus: true`
  - [x] 4.3 When gate result exists, render:
    - **Large status badge** (AC: 1, 6): PASS → green with CheckCircle2 icon + "PASS" text, CONCERNS → yellow with AlertTriangle icon + "CONCERNS" text, FAIL → red with XCircle icon + "FAIL" text. Must use color + icon + text together for accessibility.
    - **Rationale section**: Display the rationale text below the badge
    - **Timestamp**: Show when the gate was last run (relative time via date-fns `formatDistanceToNow`)
  - [x] 4.4 Issues list (AC: 2): render each issue with:
    - Severity badge: Critical → `bg-red-500/10 text-red-500`, Major → `bg-orange-500/10 text-orange-500`, Minor → `bg-yellow-500/10 text-yellow-500`
    - Description text
    - If `artifactKey` is present: a "View" link button that calls `openWorkspaceToArtifact(artifactKey)` from `usePlanningWorkspaceStore` to navigate to that artifact in the ArtifactViewer
  - [x] 4.5 When no gate result exists, render an empty state: "No readiness gate results yet. Run the implementation readiness check to assess your planning artifacts."
  - [x] 4.6 Style consistent with planning workspace aesthetic: `bg-card/50`, `border-border`, cyan accent for headers, same card pattern as WorkflowRunPanel and PhaseProgressDashboard

- [x] Task 5: Add Re-run Gate and historical comparison (AC: 3, 4)
  - [x] 5.1 Add "Re-run Gate" button to `ReadinessGatePanel.tsx`. When clicked:
    - Navigate the user to the `readiness-check` workflow in the planning workspace by calling `setSelectedWorkflow('readiness-check')` from `usePlanningWorkspaceStore`
    - The existing agent launcher flow (Epic 3's `BmadAgentLauncherService`) will handle spawning the agent. The panel does NOT spawn agents directly.
  - [x] 5.2 Add "History" toggle/expander that loads `trpc.planning.listGateDecisions.useQuery({ projectId })` and shows previous gate results as a compact list: date, decision badge, issue count
  - [x] 5.3 When showing history, clicking a historical entry expands its details inline (same layout as the current result: badge, rationale, issues)
  - [x] 5.4 The current (latest) result is always shown prominently at the top; history appears below as a collapsible section

- [x] Task 6: Add Approve for Implementation action (AC: 5)
  - [x] 6.1 Add "Approve for Implementation" button to `ReadinessGatePanel.tsx`, only visible when the latest gate decision is 'pass'
  - [x] 6.2 Button styling: prominent action — `bg-emerald-600 text-white hover:bg-emerald-500` with CheckCircle2 icon, matching the "Start Planning" button prominence from PhaseProgressDashboard
  - [x] 6.3 On click: call `trpc.planning.approveForImplementation.useMutation()`, which marks all artifacts as 'approved'. On success, invalidate scanArtifacts query so the dashboard updates. Show a success indicator.
  - [x] 6.4 If gate decision is not 'pass', show a muted/disabled state with tooltip text: "Gate must pass before approving for implementation"

- [x] Task 7: Integrate into Planning Workspace (AC: 1-6)
  - [x] 7.1 Import `ReadinessGatePanel` into `PlanningWorkspacePage.tsx`
  - [x] 7.2 When `selectedWorkflowKey === 'readiness-check'` AND the readiness-check artifact exists (`artifactExists === true`): render the `ReadinessGatePanel` ABOVE the `ArtifactViewer` as a summary card. The ArtifactViewer still shows the full report markdown below.
  - [x] 7.3 When `selectedWorkflowKey === 'readiness-check'` AND the artifact does NOT exist: render the `ReadinessGatePanel` in empty state mode (with the run prompt), instead of the `SelectedWorkflowPlaceholder`
  - [x] 7.4 Also trigger `parseAndSaveGateResult` automatically when the readiness-check artifact viewer loads AND no gate decision exists yet (or the artifact's lastModified is newer than the latest gate decision's created_at). This ensures the gate result is parsed and saved the first time the user views the readiness check output.

- [x] Task 8: Write tests (AC: 1-6)
  - [x] 8.1 Unit tests for `parseReadinessReport` in `src/main/services/readiness-gate.service.test.ts`: test READY/NEEDS WORK/NOT READY parsing, test critical/major/minor issue extraction, test graceful handling of missing sections, test artifact key inference from issue text
  - [x] 8.2 Render tests for `ReadinessGatePanel.test.tsx`: verify PASS badge renders green with icon and text, verify CONCERNS badge yellow, verify FAIL badge red, verify issues list renders with severity badges, verify "View" link calls openWorkspaceToArtifact, verify empty state message, verify "Approve for Implementation" button visible only on PASS, verify history section loads and displays
  - [x] 8.3 tRPC tests in `planning.router.test.ts`: test parseAndSaveGateResult persists result, test getLatestGateDecision returns most recent, test listGateDecisions returns ordered results, test approveForImplementation requires pass decision
  - [x] 8.4 Integration test in `PlanningWorkspacePage.test.tsx`: verify ReadinessGatePanel renders when readiness-check workflow selected and artifact exists

## Dev Notes

### Architecture Decision: ReadinessGatePanel Above ArtifactViewer (CRITICAL)

The story requires the results panel to coexist with the full report. The pattern is:
1. When `readiness-check` is selected and artifact exists → render `ReadinessGatePanel` as a summary card ABOVE the `ArtifactViewer` in a scrollable column. The user sees the parsed gate result (badge, issues, actions) then can scroll to see the full markdown report.
2. When artifact doesn't exist → render `ReadinessGatePanel` in empty state (with "Run" guidance) INSTEAD of `SelectedWorkflowPlaceholder`.

This mirrors how `WorkflowRunPanel` renders above other content — a summary that adds value without replacing the underlying detail.

### Database Design: gate_decisions Table (CRITICAL)

The `gate_decisions` table is NEW. It stores structured results parsed from the readiness report markdown. Key design points:
- `issues` column stores JSON array as TEXT — same pattern as `workflow_runs.input_artifacts`. Parse with `JSON.parse()` when reading, `JSON.stringify()` when writing.
- `workflow_run_id` is optional FK to `workflow_runs` — connects a gate result to the specific workflow run that produced it. Nullable because gate results could be manually parsed from existing files.
- Each run of the readiness check creates a NEW row — old rows are preserved for history comparison (AC: 3, 4).

### Readiness Report Parsing (CRITICAL)

The BMAD `check-implementation-readiness` skill produces a markdown report with this structure:
```markdown
## Summary and Recommendations
### Overall Readiness Status
[READY/NEEDS WORK/NOT READY]
### Critical Issues Requiring Immediate Action
[list of issues]
### Recommended Next Steps
1. [action item]
```

And earlier sections with severity-marked issues:
```markdown
#### 🔴 Critical Violations
- [issue description]
#### 🟠 Major Issues
- [issue description]
#### 🟡 Minor Concerns
- [issue description]
```

**Status mapping:**
- "READY" → `pass`
- "NEEDS WORK" → `concerns`
- "NOT READY" → `fail`
- If none found → default to `concerns`

**Output filename discrepancy:** The planning-workflow-constants map `readiness-check` → `readiness-check.md`, but the actual skill outputs `implementation-readiness-report-{date}.md` in the same planning-artifacts folder. The parser must:
1. First try `readiness-check.md`
2. If not found, glob for `implementation-readiness-report-*.md` and use the most recent
3. If neither found, throw NOT_FOUND

### Re-run Gate Navigation Pattern (CRITICAL)

The "Re-run Gate" button does NOT directly launch an agent. Instead, it navigates the user to the `readiness-check` workflow in the sidebar:
```typescript
setSelectedWorkflow('readiness-check')
```
The user then uses the existing planning task system (Epic 3's agent launcher) to start the readiness check. This keeps the launch pattern consistent and avoids duplicating agent spawning logic.

### Approve for Implementation (CRITICAL)

The "Approve for Implementation" action uses the existing `planning_artifact_statuses` table and `updateArtifactStatus` mutation pattern. It:
1. Validates the latest gate decision is 'pass'
2. Iterates over ALL known artifact keys from `BMAD_WORKFLOWS` (the `ARTIFACT_FILES` array in planning.router.ts)
3. Upserts each artifact's status to 'approved'
4. Returns count of artifacts updated

This reuses the existing status infrastructure from Story 9.2 / 9.3 rather than creating new columns or tables.

### Issue-to-Artifact Linking (AC: 2)

When parsing issues, infer the `artifactKey` from keywords in the issue description:
```typescript
const ARTIFACT_KEYWORDS: Record<string, string> = {
  'product brief': 'product-brief',
  'prd': 'prd',
  'requirements': 'prd',
  'ux': 'ux-design',
  'architecture': 'architecture',
  'epics': 'epics-stories',
  'stories': 'epics-stories'
}
```
This is a best-effort heuristic. If no keyword matches, `artifactKey` is null and no navigation link is shown.

### Existing Code Patterns to Follow

**tRPC procedure pattern** (from planning.router.ts):
```typescript
getLatestGateDecision: publicProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ ctx, input }) => {
    const result = ctx.db.select().from(gate_decisions)
      .where(eq(gate_decisions.project_id, input.projectId))
      .orderBy(desc(gate_decisions.created_at))
      .limit(1)
      .get()
    if (!result) return null
    return { ...result, issues: result.issues ? JSON.parse(result.issues) : [] }
  })
```

**DB schema pattern** (from schema.ts):
```typescript
export const gate_decisions = sqliteTable(
  'gate_decisions',
  { ... },
  (table) => [
    index('idx_gate_decisions_project_id').on(table.project_id),
    index('idx_gate_decisions_created_at').on(table.created_at)
  ]
)
```

**Component test pattern** (from WorkflowRunPanel.test.tsx):
- Mock tRPC: `vi.mock('@renderer/lib/trpc')`
- Mock stores: `vi.mock('@renderer/stores/planning-workspace.store')`
- Use `render()` from `@testing-library/react`
- Use `screen.getByText()`, `screen.queryByText()` for assertions

**UI card pattern** (from WorkflowRunPanel.tsx, PhaseProgressDashboard.tsx):
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

Follow established patterns from Stories 9.1-9.5:
- **PASS badge:** `bg-emerald-500/20 text-emerald-400` with CheckCircle2 icon
- **CONCERNS badge:** `bg-yellow-500/20 text-yellow-400` with AlertTriangle icon
- **FAIL badge:** `bg-red-500/20 text-red-400` with XCircle icon
- **Issue severity Critical:** `bg-red-500/10 text-red-500` small badge
- **Issue severity Major:** `bg-orange-500/10 text-orange-500` small badge
- **Issue severity Minor:** `bg-yellow-500/10 text-yellow-500` small badge
- **Background:** `bg-card/50` for card surfaces
- **Borders:** `border-border` with subtle rings for emphasis
- **Text:** `text-foreground` primary, `text-muted-foreground` secondary
- **Icons:** lucide-react icons, sized `h-4 w-4` inline
- **Spacing:** `p-4` for sections, `gap-2` between items

### Anti-Patterns to Avoid

- **DO NOT** create a separate tRPC router for gate decisions — add procedures to the existing `planningRouter`
- **DO NOT** spawn agents directly from the ReadinessGatePanel — use existing navigation + agent launcher flow
- **DO NOT** import `fs` or Node.js modules in renderer code — all file reading happens via tRPC
- **DO NOT** wrap tRPC responses — return data directly
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** add a new Zustand store for gate state — use tRPC queries with TanStack Query caching
- **DO NOT** use tRPC subscriptions — use `refetchOnWindowFocus` for gate results (not live-updating data)
- **DO NOT** parse the readiness report in the renderer — parsing happens in the main process service, results are persisted in DB, renderer reads from DB via tRPC
- **DO NOT** create a new router file — extend `planningRouter` in `planning.router.ts`

### Previous Story Intelligence (Story 9.5)

Story 9.5 established:
- `workflow_runs` DB table with status tracking — gate_decisions follows the same schema pattern
- `WorkflowRunPanel` as a banner component above center content — ReadinessGatePanel follows similar integration
- `RecentRunsTable` with expandable rows — gate history uses similar expand pattern
- Polling via `refetchInterval` for active data, `refetchOnWindowFocus` for static data
- `openWorkspaceToArtifact()` for cross-navigation from components to artifact viewer
- tRPC procedure patterns: mutation for writes, query for reads, JSON column parsing

**Key learnings from 9.5:**
- Status cycling uses `useMutation()` with `onSuccess` invalidating related queries
- TypeScript timestamp type mismatches: tRPC serialization returns strings for Date fields — use `Date | number | string` for timestamp helpers
- Backend tests have pre-existing native module issue — don't debug that, just write the tests
- Test patterns from 9.5: 12 WorkflowRunPanel + 12 RecentRunsTable + 19 PhaseProgressDashboard

### Git Intelligence

Recent commits (Epic 9):
```
f603449 feat: 9-5 Guided Workflow Run Tracker with agent integration
d6e2f84 feat: 9-4 What Next recommender engine for planning workflow guidance
0a310c5 feat: 9-3 Artifact Viewer with status lifecycle and section navigation
a123597 feat: 9-2 Phase Progress Dashboard with artifact scanning
4e84b83 feat: 9-1 Planning Workspace route and navigation
```

Commit message pattern: `feat: 9-{N} {story title summary}`

### Project Structure Notes

Files to create:
```
src/main/services/readiness-gate.service.ts                           <- NEW (report parser)
src/main/services/readiness-gate.service.test.ts                      <- NEW (parser tests)
src/renderer/src/components/planning/ReadinessGatePanel.tsx            <- NEW (results panel)
src/renderer/src/components/planning/ReadinessGatePanel.test.tsx       <- NEW (render tests)
```

Files to modify:
```
src/main/db/schema.ts                                                  <- ADD gate_decisions table + types
src/main/db/index.ts                                                   <- ADD migration for gate_decisions
src/main/trpc/routers/planning.router.ts                               <- ADD 4 new procedures
src/main/trpc/routers/planning.router.test.ts                          <- ADD gate decision tests
src/renderer/src/pages/PlanningWorkspacePage.tsx                        <- ADD ReadinessGatePanel integration
src/renderer/src/pages/PlanningWorkspacePage.test.tsx                   <- ADD integration test
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6 lines 3303-3342]
- [Source: .claude/skills/bmad-check-implementation-readiness/steps/step-06-final-assessment.md — output format: READY/NEEDS WORK/NOT READY, issue severity markers]
- [Source: .claude/skills/bmad-check-implementation-readiness/steps/step-05-epic-quality-review.md — severity format: 🔴 Critical, 🟠 Major, 🟡 Minor]
- [Source: src/main/db/schema.ts — planning_artifact_statuses table pattern (lines 230-253), workflow_runs table (lines 414-442)]
- [Source: src/main/db/index.ts — Migration pattern (lines 411-438)]
- [Source: src/main/trpc/routers/planning.router.ts — Existing procedures: scanArtifacts, getArtifactContent, updateArtifactStatus, createWorkflowRun, getActiveWorkflowRun]
- [Source: src/main/trpc/routers/planning-workflow-constants.ts — readiness-check → readiness-check.md mapping]
- [Source: src/renderer/src/constants/planning-workspace.ts — BMAD_WORKFLOWS, BMAD_RECOMMENDATION_CHAIN with readiness-check entry]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — openWorkspaceToArtifact, setSelectedWorkflow actions]
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx — Center content rendering: selectedWorkflow → ArtifactViewer vs PhaseProgressDashboard]
- [Source: src/renderer/src/components/planning/PhaseProgressDashboard.tsx — HEALTH_ITEMS includes 'Readiness Gate', StatusBadge patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md — Implementation rules, naming conventions, test patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md — tRPC patterns, error handling layers]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed Python-style `\Z` regex → JS `$` in readiness-gate.service.ts
- Fixed `trpc.useUtils()` React hook rules violation in PlanningWorkspacePage.tsx
- Fixed PlanningWorkspacePage.test.tsx missing tRPC mock for `getActiveWorkflowRun`
- Ran `npm run rebuild:node` for tests, `npm run rebuild:electron` for final build

### Completion Notes List

- All 8 tasks implemented: DB schema + migration, parser service, 4 tRPC procedures, ReadinessGatePanel UI, re-run/history/approve actions, workspace integration, tests
- 76 tests passing: 14 parser + 40 router + 22 panel (plus 18 PlanningWorkspacePage integration)
- Auto-parse triggers when readiness-check artifact is viewed and no gate decision exists or artifact is newer
- Used /frontend-design skill for ReadinessGatePanel component design

### File List

New files:
- `src/main/services/readiness-gate.service.ts` — Report parser service
- `src/main/services/readiness-gate.service.test.ts` — 14 parser unit tests
- `src/renderer/src/components/planning/ReadinessGatePanel.tsx` — Results panel component
- `src/renderer/src/components/planning/ReadinessGatePanel.test.tsx` — 22 render tests

Modified files:
- `src/main/db/schema.ts` — Added gate_decisions table + types
- `src/main/db/index.ts` — Added migration for gate_decisions table
- `src/main/trpc/routers/planning.router.ts` — Added 4 new procedures (parseAndSaveGateResult, getLatestGateDecision, listGateDecisions, approveForImplementation)
- `src/main/trpc/routers/planning.router.test.ts` — Added 12 gate decision tests
- `src/renderer/src/pages/PlanningWorkspacePage.tsx` — ReadinessGatePanel integration + auto-parse logic
- `src/renderer/src/pages/PlanningWorkspacePage.test.tsx` — Added integration test mocks

### Change Log

- 2026-03-21: Initial implementation of all 8 tasks, status → review
