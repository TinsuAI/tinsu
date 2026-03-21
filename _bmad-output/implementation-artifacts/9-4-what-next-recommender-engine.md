# Story 9.4: "What Next?" Recommender Engine

Status: review

## Story

As a founder,
I want TinSu to tell me what BMAD planning step I should do next,
so that I follow the recommended workflow without memorizing the method.

## Acceptance Criteria

1. **Given** I am in the planning workspace **When** the "What Next?" panel renders **Then** it scans `_bmad-output/planning-artifacts/` for existing artifacts **And** determines which workflows have been completed based on artifact presence

2. **Given** the scan is complete **When** the panel displays **Then** it shows a prominent "Next Recommended Step" card with: workflow name (e.g., "Create PRD"), why it's recommended (e.g., "Product Brief is complete. PRD defines requirements before solutioning."), what it produces (e.g., "prd.md"), and a "Start" button that navigates to the relevant planning task

3. **Given** the BMAD phase ordering **When** determining the next step **Then** it respects: Product Brief → PRD → Architecture → UX Design (optional) → Epics & Stories → Readiness Gate **And** UX Design is shown as "optional" with context

4. **Given** all planning artifacts exist **When** the panel renders **Then** it recommends "Run Implementation Readiness Check" as the final step

5. **Given** artifacts are created or modified on disk **When** the workspace is visible **Then** the recommendation updates via refetch (using the existing `refetchOnWindowFocus: true` pattern and query invalidation)

## Tasks / Subtasks

- [x] Task 1: Define the BMAD workflow recommendation chain as a constant (AC: 3)
  - [x] 1.1 Add a `BMAD_RECOMMENDATION_CHAIN` constant to `src/renderer/src/constants/planning-workspace.ts`
  - [x] 1.2 Each entry: `{ workflowKey: string, label: string, reason: string, produces: string, requires: string[], optional?: boolean, phase: PlanningPhase }`
  - [x] 1.3 Ordered chain: `product-brief` → `prd` (requires product-brief) → `architecture` (requires prd) → `ux-design` (requires prd, optional) → `epics-stories` (requires architecture) → `readiness-check` (requires epics-stories)
  - [x] 1.4 Each entry includes a human-readable `reason` explaining why it's recommended at that point (e.g., "Product Brief defines your vision. Everything starts here.")

- [x] Task 2: Create `useNextRecommendation` hook (AC: 1, 3, 4)
  - [x] 2.1 Create `src/renderer/src/hooks/useNextRecommendation.ts`
  - [x] 2.2 Input: the `scanArtifacts` query result (array of `{ workflowKey, exists }`)
  - [x] 2.3 Logic: iterate `BMAD_RECOMMENDATION_CHAIN` in order; for each entry, check if artifact exists in scan results; return the FIRST entry whose artifact is missing AND whose `requires` are ALL satisfied (i.e., all prerequisite artifacts exist)
  - [x] 2.4 If no entry matches (all artifacts exist or no prerequisites satisfied), return `null`
  - [x] 2.5 Special case: if all required (non-optional) artifacts exist but `readiness-check` is missing, recommend readiness check
  - [x] 2.6 Special case: if ALL artifacts including readiness-check exist, return a "complete" indicator (not null — a completion state with message "All planning artifacts are complete!")
  - [x] 2.7 Return type: `{ workflowKey: string, label: string, reason: string, produces: string, phase: PlanningPhase, optional?: boolean } | { complete: true, message: string } | null`

- [x] Task 3: Create `WhatNextPanel` component (AC: 2, 3, 4)
  - [x] 3.1 Create `src/renderer/src/components/planning/WhatNextPanel.tsx`
  - [x] 3.2 Props: none — fetches data internally via `trpc.planning.scanArtifacts.useQuery` and `useNextRecommendation` hook
  - [x] 3.3 Render a prominent card with: icon (e.g., `Lightbulb` or `Compass` from lucide), "Next Step" heading, workflow name in larger text, reason text in muted color, produces filename in monospace
  - [x] 3.4 "Start" button: calls `setSelectedWorkflow(recommendation.workflowKey)` from `usePlanningWorkspaceStore` AND sets `setActivePhase(recommendation.phase)` to navigate to the correct phase tab and select the workflow
  - [x] 3.5 If recommendation is optional (UX Design), show an "(optional)" badge and a "Skip" action that advances to the next recommendation
  - [x] 3.6 Completion state: when all artifacts exist, show a congratulatory card with checkmark icon and "All planning complete — ready for implementation!" message
  - [x] 3.7 Loading state: show a subtle skeleton while `scanArtifacts` query is loading
  - [x] 3.8 Style using Tailwind inline classes consistent with existing Planning Workspace components (cyan accent, subtle borders, muted backgrounds)

- [x] Task 4: Integrate `WhatNextPanel` into `PhaseProgressDashboard` (AC: 1, 2)
  - [x] 4.1 Import `WhatNextPanel` into `PhaseProgressDashboard.tsx`
  - [x] 4.2 Render `WhatNextPanel` as the FIRST section in the dashboard, above the "Project Health" panel
  - [x] 4.3 The panel should be visible at the top of the scrollable dashboard area, giving it prominence as the primary actionable element

- [x] Task 5: Write tests (AC: 1-5)
  - [x] 5.1 Unit tests for recommendation logic in `useNextRecommendation.test.ts`: test empty artifacts → recommends product-brief, test product-brief exists → recommends prd, test all required exist → recommends readiness-check, test all exist → returns complete state, test optional UX skip behavior, test prerequisite enforcement (can't recommend architecture before prd)
  - [x] 5.2 Render tests for `WhatNextPanel.test.tsx`: verify recommendation card renders with correct workflow name, reason, produces, and Start button; verify completion state; verify loading skeleton; verify Start button navigation
  - [x] 5.3 Integration test in `PhaseProgressDashboard.test.tsx`: verify WhatNextPanel appears above health panel

## Dev Notes

### Architecture Decision: Client-Side Recommendation Logic (CRITICAL)

The recommendation engine is **pure client-side logic** — no new tRPC procedure needed. The existing `scanArtifacts` query already returns all artifact existence data from the filesystem. The recommendation is a deterministic computation over that data.

**DO NOT** create a new backend procedure for recommendations. The logic is:
1. Get artifact scan results from `trpc.planning.scanArtifacts` (already fetched in PhaseProgressDashboard)
2. Walk the ordered chain, find the first missing artifact whose prerequisites are met
3. Return the recommendation

### Recommendation Chain Definition (CRITICAL)

The BMAD method has a specific ordering with dependency relationships:

```
Product Brief (analysis)
    └→ PRD (planning, requires: product-brief)
         ├→ Architecture (solutioning, requires: prd)
         │    └→ Epics & Stories (solutioning, requires: architecture)
         │         └→ Readiness Check (solutioning, requires: epics-stories)
         └→ UX Design (planning, requires: prd, OPTIONAL)
```

`brainstorming`, `market-research`, `domain-research` are **excluded** from the chain — they are optional analysis activities, not part of the core planning pipeline.

**Note on `product-brief` vs `brainstorming`:** Both share the same output file (`product-brief.md`). The recommendation should use `product-brief` as the canonical workflow key. Checking if `product-brief.md` exists covers both.

### Existing Data Source: Reuse scanArtifacts (CRITICAL)

**DO NOT** call `scanArtifacts` again in the `WhatNextPanel` — the `PhaseProgressDashboard` already fetches it. Either:
1. Pass the artifact data down as a prop from `PhaseProgressDashboard` to `WhatNextPanel`
2. Or rely on TanStack Query's deduplication — calling the same query with the same key in `WhatNextPanel` will use the cached data (preferred, simpler, no prop drilling)

The `scanArtifacts` query is configured with `refetchOnWindowFocus: true` in both `PlanningWorkspacePage` and `PhaseProgressDashboard`, so recommendations will update when the user refocuses the window after running a BMAD agent.

### "Real-time" Updates (AC: 5 Clarification)

The AC says "recommendation updates in real-time via filesystem watching." The existing codebase does **NOT** use filesystem watchers. Instead it uses:
- `refetchOnWindowFocus: true` — re-scans when user returns to the app
- Query invalidation on mutations (e.g., `updateArtifactStatus`)

**DO NOT** implement a filesystem watcher (`fs.watch`, `chokidar`, etc.) — this would add complexity, be error-prone, and break the existing pattern. The `refetchOnWindowFocus` approach is sufficient.

### "Start" Button Navigation Pattern

The "Start" button should navigate the user to the recommended workflow within the planning workspace. Use the existing Zustand store actions:

```typescript
const { setActivePhase, setSelectedWorkflow } = usePlanningWorkspaceStore()

// Navigate to the recommended workflow
const handleStart = () => {
  setActivePhase(recommendation.phase)
  setSelectedWorkflow(recommendation.workflowKey)
}
```

This will switch the phase tab and highlight the workflow in the sidebar. The center content will show either the `ArtifactViewer` (if artifact exists) or the `SelectedWorkflowPlaceholder` (if missing).

### Styling: Match Existing Planning Workspace Aesthetic

Follow the established visual patterns from Stories 9.1-9.3:
- **Accent color:** `cyan-500` for primary actions and highlights
- **Background:** `bg-card/50` for card surfaces, `bg-muted/50` for secondary
- **Borders:** `border-border` with subtle `ring-1 ring-cyan-500/20` for emphasis
- **Text hierarchy:** `text-foreground` for primary, `text-muted-foreground` for secondary, `text-muted-foreground/60` for tertiary
- **Icons:** lucide-react icons, sized consistently (`h-4 w-4` for inline, larger for hero)
- **Spacing:** `p-4` to `p-6` for sections, `gap-2` to `gap-3` between items
- **Typography:** `text-xs` for labels, `text-sm` for body, uppercase tracking-wider for section headers

### Skip Optional Step Behavior

When UX Design is recommended and the user clicks "Skip":
- Advance the `useNextRecommendation` hook's output to the next non-optional step
- Implementation: track skipped keys in local state (`useState<string[]>([])`) within `WhatNextPanel`
- The skipped state is ephemeral (resets on remount) — this is acceptable since the user can always come back

### Project Structure Notes

Files to create:
```
src/renderer/src/hooks/useNextRecommendation.ts              <- NEW (recommendation logic hook)
src/renderer/src/hooks/useNextRecommendation.test.ts         <- NEW (unit tests)
src/renderer/src/components/planning/WhatNextPanel.tsx        <- NEW (UI component)
src/renderer/src/components/planning/WhatNextPanel.test.tsx   <- NEW (render tests)
```

Files to modify:
```
src/renderer/src/constants/planning-workspace.ts              <- ADD BMAD_RECOMMENDATION_CHAIN constant
src/renderer/src/components/planning/PhaseProgressDashboard.tsx <- ADD WhatNextPanel as first section
src/renderer/src/components/planning/PhaseProgressDashboard.test.tsx <- ADD WhatNextPanel integration test
```

### Anti-Patterns to Avoid

- **DO NOT** create a new tRPC procedure for recommendations — compute client-side from existing `scanArtifacts` data
- **DO NOT** implement filesystem watchers — use existing `refetchOnWindowFocus` pattern
- **DO NOT** include `brainstorming`, `market-research`, `domain-research` in the recommendation chain — they are optional analysis activities
- **DO NOT** import `fs` or any Node.js modules in renderer code
- **DO NOT** create a new Zustand store for recommendation state — use `useState` for local skip state, use existing store for navigation
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** wrap tRPC responses — return data directly
- **DO NOT** implement complex state machines for the recommendation — it's a simple ordered walk with prerequisite checking
- **DO NOT** make the hook depend on `usePlanningWorkspaceStore` — keep it a pure computation from artifact data so it's easily testable
- **DO NOT** add polling/interval refetching — `refetchOnWindowFocus: true` is the established pattern

### Previous Story Intelligence (Story 9.3)

Story 9.3 established:
- `ArtifactViewer` component for viewing markdown artifacts with section navigation
- `getArtifactContent` tRPC procedure for file reading
- 3-state status lifecycle: Draft → In Review → Approved
- `openWorkspaceToArtifact(workflowKey)` action in Zustand store
- Extended `markdownComponents` pattern for artifact-specific heading IDs
- Three-state center content in PlanningWorkspacePage: no workflow → PhaseProgressDashboard, workflow + artifact → ArtifactViewer, workflow + no artifact → SelectedWorkflowPlaceholder
- 65 tests across 4 test files, all passing

**Key learnings:**
- Status cycling uses `updateArtifactStatus.useMutation()` with `onSuccess` invalidating `scanArtifacts`
- TanStack Query deduplication works well — multiple components can call the same query
- `PhaseProgressDashboard` already imports `trpc`, `usePlanningWorkspaceStore`, `BMAD_WORKFLOWS`, and `BMAD_PHASES`
- `cn()` utility from `@renderer/lib/utils` for conditional Tailwind classes
- Test patterns: mock `trpc` with `vi.mock('@renderer/lib/trpc')`, use `render()` from `@testing-library/react`

### Git Intelligence

Recent commits (Epic 9):
```
0a310c5 feat: 9-3 Artifact Viewer with status lifecycle and section navigation (13 files, +1405 -28)
a123597 feat: 9-2 Phase Progress Dashboard with artifact scanning (12 files, +1318 -31)
4e84b83 feat: 9-1 Planning Workspace route and navigation (16 files, +1424 -40)
```

Code patterns are consistent and well-established. The planning workspace follows a clear architecture with tRPC backend, Zustand store, and component hierarchy.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4 lines 3223-3258]
- [Source: docs/deep-research-report-chatgpt.md — "What next?" recommender, BMad-Help-like guidance]
- [Source: src/renderer/src/components/planning/PhaseProgressDashboard.tsx — Integration target]
- [Source: src/renderer/src/constants/planning-workspace.ts — BMAD_WORKFLOWS, BMAD_PHASES]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — Navigation actions]
- [Source: src/main/trpc/routers/planning.router.ts — scanArtifacts procedure]
- [Source: src/main/trpc/routers/planning-workflow-constants.ts — Backend workflow mapping]
- [Source: _bmad-output/planning-artifacts/project-context.md — Implementation rules]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Initial test run: 4 failures (3 in useNextRecommendation due to ux-design ordering in chain, 1 in PhaseProgressDashboard integration due to mock cleanup). All fixed in second run.

### Completion Notes List
- Task 1: Added `BMAD_RECOMMENDATION_CHAIN` constant with `BmadRecommendationEntry` interface to planning-workspace.ts. 6 entries with dependency graph: product-brief → prd → architecture → ux-design (optional) → epics-stories → readiness-check.
- Task 2: Created `useNextRecommendation` hook with `computeNextRecommendation` pure function (exported for testing) and `useNextRecommendation` React hook. Handles brainstorming/product-brief alias, skip state, completion detection.
- Task 3: Created `WhatNextPanel` component using /frontend-design skill. Three states: loading skeleton, recommendation card with Start/Skip, completion card with emerald accents. Uses TanStack Query deduplication for scanArtifacts.
- Task 4: Integrated WhatNextPanel as first section in PhaseProgressDashboard, above Project Health panel.
- Task 5: 47 tests total — 15 unit tests (recommendation logic), 14 render tests (WhatNextPanel), 18 integration tests (PhaseProgressDashboard including WhatNextPanel presence check).

### Change Log
- 2026-03-21: Story 9.4 implementation complete — "What Next?" Recommender Engine with all ACs satisfied

### File List
New files:
- src/renderer/src/hooks/useNextRecommendation.ts
- src/renderer/src/hooks/useNextRecommendation.test.ts
- src/renderer/src/components/planning/WhatNextPanel.tsx
- src/renderer/src/components/planning/WhatNextPanel.test.tsx

Modified files:
- src/renderer/src/constants/planning-workspace.ts (added BMAD_RECOMMENDATION_CHAIN constant and BmadRecommendationEntry interface)
- src/renderer/src/components/planning/PhaseProgressDashboard.tsx (imported and rendered WhatNextPanel)
- src/renderer/src/components/planning/PhaseProgressDashboard.test.tsx (added WhatNextPanel mock and integration test)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: ready-for-dev → in-progress → review)
- _bmad-output/implementation-artifacts/9-4-what-next-recommender-engine.md (task checkboxes, dev record, status)
