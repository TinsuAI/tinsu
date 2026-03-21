# Story 9.8: Agent Persona Indicator

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to see which BMAD agent persona is currently active,
So that I know "who" is working on my planning artifacts.

## Acceptance Criteria

1. **Given** a BMAD agent is running in a planning workflow **When** I view the planning workspace header **Then** it shows the active agent: name and a distinct color badge **And** the agent mapping is: Analyst (blue), PM (green), Architect (orange), UX Designer (purple)

2. **Given** the agent indicator **When** I view it **Then** it shows: agent name (e.g., "Analyst"), the workflow being executed (e.g., "Creating Product Brief")

3. **Given** workflows transition between agents **When** the active agent changes (e.g., PRD → Architecture) **Then** the indicator updates to show the new agent

4. **Given** no agent is running **When** I view the workspace header **Then** the indicator shows "No agent active" in a muted style

5. **Given** the agent indicator is also shown on planning task cards (from Story 3.3) **When** I view a card in In Progress **Then** the card shows the agent badge matching the workspace header

## Tasks / Subtasks

- [x] Task 1: Create `AGENT_PERSONA_CONFIG` constant mapping (AC: 1)
  - [x] 1.1 Add to `src/renderer/src/constants/planning-workspace.ts` a new exported constant:
    ```typescript
    export interface AgentPersonaConfig {
      /** Display name shown in the UI (e.g., "Analyst", "PM") */
      displayName: string
      /** Tailwind color classes for the persona badge */
      bg: string
      text: string
      border: string
      dot: string
    }

    export const AGENT_PERSONA_CONFIG: Record<string, AgentPersonaConfig> = {
      'bmad:bmm:agents:analyst': {
        displayName: 'Analyst',
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400'
      },
      'bmad:bmm:agents:pm': {
        displayName: 'PM',
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        border: 'border-green-500/30',
        dot: 'bg-green-400'
      },
      'bmad:bmm:agents:architect': {
        displayName: 'Architect',
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-400'
      },
      'bmad:bmm:agents:ux-designer': {
        displayName: 'UX Designer',
        bg: 'bg-purple-500/20',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        dot: 'bg-purple-400'
      }
    }
    ```
  - [x] 1.2 Add a helper function `getAgentPersona(agentName: string | null): AgentPersonaConfig | null` that looks up the config, returning `null` for unknown/null agents
  - [x] 1.3 The `analyst` entry is for potential future use (brainstorming/domain-research agents). The current `BMAD_PLANNING_PHASES` maps phase 1 (Product Brief) and phase 2 (PRD) to `bmad:bmm:agents:pm`, phase 3 to `architect`, phase 4 to `ux-designer`, phase 5 to `pm`. Include the analyst mapping for forward-compatibility.

- [x] Task 2: Create `AgentPersonaIndicator` component (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `src/renderer/src/components/planning/AgentPersonaIndicator.tsx`
  - [x] 2.2 The component queries active workflow run data. It does NOT call `trpc.planning.getActiveWorkflowRun` itself — instead accept props:
    ```typescript
    interface AgentPersonaIndicatorProps {
      agentName: string | null
      workflowKey: string | null
      isRunning: boolean
    }
    ```
    This avoids duplicate tRPC queries since PlanningWorkspacePage already has `WorkflowRunPanel` polling for active run.
  - [x] 2.3 When `isRunning` is true and `agentName` is non-null:
    - Look up persona via `getAgentPersona(agentName)` from Task 1
    - Render: colored dot (animated pulse when running) + persona display name + workflow name
    - Workflow name derived from `BMAD_WORKFLOWS.find(w => w.key === workflowKey)?.name ?? workflowKey`
    - Layout: `flex items-center gap-1.5 text-xs` — compact inline display for header
    - Example: `🟢(pulse) PM · Creating Product Brief`
  - [x] 2.4 When `isRunning` is false or `agentName` is null:
    - Render: `<Bot className="h-3.5 w-3.5" />` + "No agent active" in `text-muted-foreground/60`
    - This preserves the existing idle state appearance from Story 9.1
  - [x] 2.5 When persona is unknown (agent_name doesn't match any key):
    - Fallback: show the raw `agentName` string (last segment after `:`) with a neutral muted color
    - Example: `bmad:bmm:agents:dev` → display "dev" with zinc/muted colors
  - [x] 2.6 Add `data-testid="agent-persona-indicator"` for testing

- [x] Task 3: Integrate into PlanningWorkspacePage header (AC: 1, 2, 3, 4)
  - [x] 3.1 Modify `src/renderer/src/pages/PlanningWorkspacePage.tsx`:
    - Add a `trpc.planning.getActiveWorkflowRun.useQuery()` call with `{ projectId }` (poll every 3s, same as WorkflowRunPanel)
    - Extract `activeRun?.agent_name`, `activeRun?.workflow_key`, and whether `activeRun?.status === 'running' || activeRun?.status === 'needs-input'`
  - [x] 3.2 Replace the static header placeholder (lines 223-227):
    ```tsx
    {/* Right: agent indicator placeholder */}
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <Bot className="h-3.5 w-3.5" />
      <span>No agent active</span>
    </div>
    ```
    With:
    ```tsx
    <AgentPersonaIndicator
      agentName={activeRun?.agent_name ?? null}
      workflowKey={activeRun?.workflow_key ?? null}
      isRunning={activeRun?.status === 'running' || activeRun?.status === 'needs-input'}
    />
    ```
  - [x] 3.3 Import `AgentPersonaIndicator` from `@renderer/components/planning/AgentPersonaIndicator`
  - [x] 3.4 The `Bot` icon import can be removed from PlanningWorkspacePage if it's no longer used elsewhere in the file (check first)

- [x] Task 4: Add persona badge to PlanningTaskCard (AC: 5)
  - [x] 4.1 Modify `src/renderer/src/components/board/PlanningTaskCard.tsx`:
    - Import `AGENT_PERSONA_CONFIG`, `getAgentPersona` from `@renderer/constants/planning-workspace`
    - When the task's `bmad_agent` field is non-null AND `agentStatus === 'running'`, show a persona-colored badge next to the existing `AgentStatusBadge`
  - [x] 4.2 The persona badge should be a small inline `Badge` element:
    ```tsx
    {agentStatus === 'running' && persona && (
      <Badge variant="outline" className={cn('px-1 py-0 text-[10px]', persona.bg, persona.text, persona.border)}>
        {persona.displayName}
      </Badge>
    )}
    ```
  - [x] 4.3 Place the persona badge BEFORE the `AgentStatusBadge` (spinning loader) so reading order is: `[PM] [●running]`
  - [x] 4.4 The `task.bmad_agent` field is already available in the component props (`task: PlanningTask` includes `bmad_agent: string | null`)

- [x] Task 5: Write tests (AC: 1-5)
  - [x] 5.1 Create `src/renderer/src/components/planning/AgentPersonaIndicator.test.tsx`:
    - Test: renders persona display name and color when running with known agent
    - Test: renders workflow name from BMAD_WORKFLOWS mapping
    - Test: renders animated pulse dot when running
    - Test: renders "No agent active" when `isRunning` is false
    - Test: renders "No agent active" when `agentName` is null
    - Test: falls back to raw agent name segment for unknown agents
    - Test: renders with each persona color (PM=green, Architect=orange, UX Designer=purple, Analyst=blue)
  - [x] 5.2 Extend `src/renderer/src/pages/PlanningWorkspacePage.test.tsx`:
    - Add mock for `trpc.planning.getActiveWorkflowRun` returning active run with agent_name
    - Test: header shows persona indicator instead of static "No agent active"
    - Test: header updates when active run changes agent
    - Test: header shows "No agent active" when no active run
  - [x] 5.3 Extend `src/renderer/src/components/board/PlanningTaskCard.test.tsx`:
    - Test: shows persona badge when task has `bmad_agent` and `agentStatus === 'running'`
    - Test: does NOT show persona badge when `agentStatus` is not 'running'
    - Test: persona badge color matches agent mapping

## Dev Notes

### Architecture: Props-Driven Indicator (CRITICAL)

The `AgentPersonaIndicator` component accepts props rather than making its own tRPC query. This is the correct pattern because:

1. `WorkflowRunPanel` already polls `getActiveWorkflowRun` every 3s — the header indicator needs the same data
2. Adding the query to PlanningWorkspacePage (which renders both WorkflowRunPanel and the header) means one centralized data source
3. React Query deduplicates identical queries with the same key — so even with 2 `useQuery` calls (one in WorkflowRunPanel, one in PlanningWorkspacePage), only 1 network request fires per poll interval
4. Props keep the component pure and easy to test (no tRPC mocking needed in component tests)

**IMPORTANT:** The `trpc.planning.getActiveWorkflowRun` query in PlanningWorkspacePage uses the same query key as WorkflowRunPanel. React Query (TanStack Query) automatically deduplicates these. You do NOT need to lift the query up or share state via Zustand.

### Agent Name Format (CRITICAL)

Agent names stored in `workflow_runs.agent_name` use the format: `bmad:bmm:agents:{persona}`

Current mappings from `src/main/db/planning-phases.ts`:
- Phase 1 (Product Brief) → `bmad:bmm:agents:pm`
- Phase 2 (PRD) → `bmad:bmm:agents:pm`
- Phase 3 (Architecture) → `bmad:bmm:agents:architect`
- Phase 4 (UX Design) → `bmad:bmm:agents:ux-designer`
- Phase 5 (Epics & Stories) → `bmad:bmm:agents:pm`

The `createWorkflowRun` procedure stores whatever `agentName` is passed (from `task.bmad_agent`). The `bmad-agent-launcher.service.ts` line 186 passes `agent_name: task.bmad_agent`.

### Color Mapping (CRITICAL — from AC1)

The epics file specifies these persona colors:
- **Analyst** → blue (`blue-500` variants)
- **PM** → green (`green-500` variants)
- **Architect** → orange (`orange-500` variants)
- **UX Designer** → purple (`purple-500` variants)

These colors do NOT conflict with existing status colors:
- WorkflowRunPanel uses: cyan (running), yellow (needs-input), emerald (succeeded), red (failed), zinc (cancelled)
- AgentStatusBadge uses: muted (idle), green (running/done), amber (stalled), purple (review), destructive (error)
- Persona colors: blue, green, orange, purple — green overlaps with AgentStatusBadge "running" but context is different (persona vs status)

### Existing Header Placeholder (Lines 223-227 of PlanningWorkspacePage.tsx)

```tsx
{/* Right: agent indicator placeholder */}
<div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
  <Bot className="h-3.5 w-3.5" />
  <span>No agent active</span>
</div>
```

This was intentionally placed as a placeholder in Story 9.1. Replace it entirely with `<AgentPersonaIndicator ... />`.

### WorkflowRunPanel Agent Display (Reference)

The `WorkflowRunPanel` at `src/renderer/src/components/planning/WorkflowRunPanel.tsx` already shows agent_name in the meta row (lines 220-224):
```tsx
{activeRun.agent_name && (
  <span className="flex items-center gap-1">
    <Bot className="h-3 w-3" />
    <span className="font-mono text-[11px]">{activeRun.agent_name}</span>
  </span>
)}
```

Story 9.8's header indicator is a SEPARATE, more prominent display in the top header bar. The WorkflowRunPanel continues to show raw agent_name in its meta row — no changes needed there.

### PlanningTaskCard Agent Badge (AC5)

The `PlanningTaskCard` at `src/renderer/src/components/board/PlanningTaskCard.tsx` already has:
- `agentStatus` prop (line 14) — defaults to `'idle'`
- `AgentStatusBadge` rendered at line 164
- `task.bmad_agent` available from the `PlanningTask` type

For AC5, add a persona-colored `Badge` next to the existing `AgentStatusBadge` only when the task is actively running. The `PlanningTask.bmad_agent` field (e.g., `bmad:bmm:agents:pm`) maps to the same `AGENT_PERSONA_CONFIG`.

### Styling: Match Planning Workspace Aesthetic

Follow established patterns from Stories 9.1-9.7:
- **Badge pattern**: `variant="outline"` with color-specific `bg`, `text`, `border` classes
- **Pulse animation**: `animate-pulse` on a dot element (same pattern as WorkflowRunPanel running state)
- **Compact sizing**: `text-xs` for header indicator, `text-[10px]` for card badges
- **Muted idle state**: `text-muted-foreground/60` for "No agent active"
- **Card spacing**: `gap-1` between badges (see PlanningTaskCard header layout)

### Anti-Patterns to Avoid

- **DO NOT** create a new tRPC procedure — the `getActiveWorkflowRun` query already returns all needed data
- **DO NOT** create a new Zustand store for agent persona state — use query data directly
- **DO NOT** add a new database column — agent_name is already stored in `workflow_runs`
- **DO NOT** import Node.js modules in renderer code — all data comes via tRPC
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** modify WorkflowRunPanel — it continues showing raw agent_name in its meta row
- **DO NOT** modify the `workflow_runs` database schema — no schema changes needed
- **DO NOT** duplicate the tRPC query in AgentPersonaIndicator — accept props from parent

### Previous Story Intelligence (Story 9.7)

Story 9.7 established:
- Git-based versioning via `getFileVersionHistory` / `getFileContentAtCommit` — irrelevant to 9.8
- ArtifactViewer view switching pattern (viewer/history/diff) — 9.8 doesn't modify ArtifactViewer
- `trpc.useUtils()` must be called at component top level — follow same pattern if needed
- Backend tests have pre-existing native module issue — don't debug that, just write the tests
- Code review feedback from 9.7: SHA format validation, bounds clamping, NaN guards — apply similar defensive coding

**Key learnings from 9.7 code review:**
- Always validate/guard nullable values before using them
- Use `??` fallbacks for optional fields
- Ensure consistent timestamp handling (unix seconds vs milliseconds)

### Git Intelligence

Recent commits (Epic 9):
```
7adf05b feat: 9-7 Artifact Version Diff View with git history integration
32c6b07 feat: 9-6 Readiness Gate Results Panel with parser and approval flow
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
src/renderer/src/components/planning/AgentPersonaIndicator.tsx      <- NEW (header indicator)
src/renderer/src/components/planning/AgentPersonaIndicator.test.tsx  <- NEW (render tests)
```

Files to modify:
```
src/renderer/src/constants/planning-workspace.ts                    <- ADD AGENT_PERSONA_CONFIG, getAgentPersona
src/renderer/src/pages/PlanningWorkspacePage.tsx                    <- REPLACE header placeholder, ADD getActiveWorkflowRun query
src/renderer/src/pages/PlanningWorkspacePage.test.tsx               <- ADD agent persona indicator tests
src/renderer/src/components/board/PlanningTaskCard.tsx              <- ADD persona badge next to AgentStatusBadge
src/renderer/src/components/board/PlanningTaskCard.test.tsx         <- ADD persona badge tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.8 — AC and user story]
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx:223-227 — Header placeholder to replace]
- [Source: src/renderer/src/components/planning/WorkflowRunPanel.tsx:220-224 — Existing agent_name display pattern]
- [Source: src/renderer/src/constants/planning-workspace.ts — BMAD_WORKFLOWS, workflow key mappings]
- [Source: src/main/db/planning-phases.ts — BMAD_PLANNING_PHASES with agent identifiers]
- [Source: src/main/trpc/routers/planning.router.ts:298 — getActiveWorkflowRun procedure]
- [Source: src/main/db/schema.ts:430 — workflow_runs.agent_name column]
- [Source: src/renderer/src/components/board/PlanningTaskCard.tsx:164 — AgentStatusBadge location]
- [Source: src/renderer/src/components/ui/AgentStatusBadge.tsx — Existing status badge component]
- [Source: src/shared/types/task.types.ts:68 — PlanningTask.bmad_agent field]
- [Source: src/main/services/bmad-agent-launcher.service.ts:186 — agent_name passed to createWorkflowRun]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX principles: ambient status, calm confidence]
- [Source: _bmad-output/planning-artifacts/project-context.md — tRPC patterns, naming conventions, test patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — clean implementation with no blockers.

### Completion Notes List

- Task 1: Added `AgentPersonaConfig` interface, `AGENT_PERSONA_CONFIG` constant with 4 personas (Analyst/blue, PM/green, Architect/orange, UX Designer/purple), and `getAgentPersona()` helper to `planning-workspace.ts`
- Task 2: Created `AgentPersonaIndicator` component with 3 states: known persona (breathing pulse dot + colored name + workflow), idle (Bot icon + "No agent active"), unknown agent fallback (last segment extraction + zinc colors)
- Task 3: Integrated into PlanningWorkspacePage header — added `getActiveWorkflowRun` query (3s poll, React Query deduplicates with WorkflowRunPanel), replaced static placeholder with `<AgentPersonaIndicator>`, removed unused Bot import
- Task 4: Added persona-colored Badge to PlanningTaskCard next to AgentStatusBadge, only shown when `agentStatus === 'running'` and persona is known
- Task 5: Created 18 AgentPersonaIndicator unit tests, 4 PlanningWorkspacePage integration tests, 8 PlanningTaskCard persona badge tests — all 30 new tests pass. 5 pre-existing test failures (CSS class changes from earlier stories) are unrelated.

### File List

New files:
- src/renderer/src/components/planning/AgentPersonaIndicator.tsx
- src/renderer/src/components/planning/AgentPersonaIndicator.test.tsx

Modified files:
- src/renderer/src/constants/planning-workspace.ts (added AGENT_PERSONA_CONFIG, AgentPersonaConfig, getAgentPersona)
- src/renderer/src/pages/PlanningWorkspacePage.tsx (replaced header placeholder, added getActiveWorkflowRun query, removed Bot import)
- src/renderer/src/pages/PlanningWorkspacePage.test.tsx (added mockGetActiveWorkflowRun, WorkflowRunPanel mock, 4 agent persona tests)
- src/renderer/src/components/board/PlanningTaskCard.tsx (added persona badge next to AgentStatusBadge)
- src/renderer/src/components/board/PlanningTaskCard.test.tsx (added 8 persona badge tests)
