# Story 9.3: Artifact Viewer with Status Lifecycle

Status: review

> **🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

## Story

As a founder,
I want to view planning artifacts (PRD, architecture, etc.) inside TinSu with section navigation,
so that I can review what BMAD agents produced without leaving the app.

## Acceptance Criteria

1. **Given** I click on an artifact in the planning workspace **When** the artifact viewer opens **Then** it renders the markdown content with proper formatting (headings, tables, code blocks) **And** a section outline appears on the left for quick navigation

2. **Given** the artifact viewer is showing a document **When** I click a heading in the section outline **Then** the viewer scrolls to that section

3. **Given** the artifact has a status **When** I view the artifact header **Then** it shows a status badge: Draft, In Review, or Approved **And** I can transition the status via a dropdown action

4. **Given** a completed planning task card is clicked on the Kanban board **When** the task has a linked artifact **Then** the artifact viewer opens showing that artifact

5. **Given** the artifact viewer **When** I view the metadata bar **Then** it shows: file path, last modified timestamp, word count, which workflow produced it

6. **Given** the artifact is displayed **When** I view it **Then** it is read-only (editing happens via BMAD agents in terminal) **And** a "Edit with Agent" button links to the relevant planning task

## Tasks / Subtasks

- [x] Task 1: Extend `planning.router.ts` with `getArtifactContent` procedure (AC: 1, 5)
  - [x] 1.1 Add `getArtifactContent` query procedure to `src/main/trpc/routers/planning.router.ts`
  - [x] 1.2 Input: `{ projectId: string, workflowKey: string }` — validate `workflowKey` is in `ARTIFACT_FILES`
  - [x] 1.3 Resolve file path: `join(ctx.projectRoot, '_bmad-output', 'planning-artifacts', filename)` using the filename from `BMAD_WORKFLOWS`
  - [x] 1.4 Read file content with `readFileSync(filePath, 'utf-8')` — if file doesn't exist, throw `TRPCError({ code: 'NOT_FOUND' })`
  - [x] 1.5 Return `{ content: string, filePath: string, lastModified: number, sizeBytes: number, wordCount: number, workflowKey: string }`
  - [x] 1.6 Compute `wordCount` by splitting content on whitespace: `content.split(/\s+/).filter(Boolean).length`

- [x] Task 2: Update artifact status enum to include 'in-review' (AC: 3)
  - [x] 2.1 Update `PLANNING_ARTIFACT_STATUS` in `src/main/db/schema.ts` from `['draft', 'approved']` to `['draft', 'in-review', 'approved']`
  - [x] 2.2 No DB migration needed — the `status` column is `TEXT`, so any string value is accepted; only the Zod validation in the router and the TypeScript type change
  - [x] 2.3 Run `npm run rebuild:electron` after schema change (per CLAUDE.md)

- [x] Task 3: Create `ArtifactViewer` component (AC: 1, 2, 3, 5, 6) — **USE /frontend-design**
  - [x] 3.1 Create `src/renderer/src/components/planning/ArtifactViewer.tsx`
  - [x] 3.2 Accept prop: `workflowKey: string` — used to fetch content and metadata
  - [x] 3.3 Call `trpc.planning.getArtifactContent.useQuery({ projectId, workflowKey })` for markdown content
  - [x] 3.4 Call `trpc.planning.scanArtifacts.useQuery({ projectId })` to get the current artifact status
  - [x] 3.5 **Header bar**: show artifact name (from `BMAD_WORKFLOWS`), status badge dropdown (Draft / In Review / Approved), and "Edit with Agent" button
  - [x] 3.6 **Section outline (left panel)**: parse headings from markdown content with regex `/^(#{1,3})\s+(.+)$/gm`, render as a clickable TOC with indentation by level
  - [x] 3.7 **Markdown content (main area)**: render with `ReactMarkdown` + `remarkGfm` + existing `markdownComponents` from `@renderer/components/task/MarkdownComponents`
  - [x] 3.8 Add `id` attributes to rendered headings for scroll targeting: extend `markdownComponents` h1/h2/h3 to include `id={slugify(children)}`
  - [x] 3.9 Section outline click handler: `document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth' })` (AC: 2)
  - [x] 3.10 **Metadata bar** (below header or footer): file path, last modified (formatted with `date-fns`), word count, workflow name (AC: 5)
  - [x] 3.11 Status dropdown: call `trpc.planning.updateArtifactStatus.useMutation()` on status change, invalidate `scanArtifacts` query (AC: 3)
  - [x] 3.12 "Edit with Agent" button: navigate to the corresponding planning task on the Kanban board — call `closeWorkspace()` from `usePlanningWorkspaceStore` (AC: 6)
  - [x] 3.13 Handle loading state with skeleton, handle error state with message
  - [x] 3.14 Ensure scroll container is the markdown content area, not the whole page

- [x] Task 4: Integrate `ArtifactViewer` into `PlanningWorkspacePage.tsx` (AC: 1, 4)
  - [x] 4.1 Replace `SelectedWorkflowPlaceholder` with `ArtifactViewer` when a workflow is selected AND the artifact exists
  - [x] 4.2 Keep `SelectedWorkflowPlaceholder` for workflows where the artifact file is missing (no content to view)
  - [x] 4.3 Use `scanArtifacts` query data already available from `PhaseProgressDashboard` (or fetch independently) to determine if artifact exists
  - [x] 4.4 The center `<main>` area should render: no workflow selected → `PhaseProgressDashboard`, workflow selected + artifact exists → `ArtifactViewer`, workflow selected + artifact missing → `SelectedWorkflowPlaceholder`
  - [x] 4.5 Remove the `items-center justify-center` centering when showing the ArtifactViewer (it fills the area)

- [x] Task 5: Enable Kanban board → artifact viewer navigation (AC: 4)
  - [x] 5.1 Extend `usePlanningWorkspaceStore` with `openWorkspaceToArtifact(workflowKey: string)` action that sets `isOpen: true`, the appropriate `activePhase`, and `selectedWorkflowKey`
  - [x] 5.2 In the Kanban board's task card click handler for planning-type tasks: if the task is completed and has a linked artifact, call `openWorkspaceToArtifact(workflowKey)` to navigate directly to the artifact viewer
  - [x] 5.3 Use `BMAD_WORKFLOWS` to map from the planning task's workflow key to the correct phase for `activePhase`

- [x] Task 6: Write tests (AC: 1-6)
  - [x] 6.1 Unit test for `getArtifactContent` procedure in `planning.router.test.ts`: mock filesystem, verify content returned, verify NOT_FOUND error for missing files, verify word count
  - [x] 6.2 Render test for `ArtifactViewer.tsx` in `ArtifactViewer.test.tsx`: verify markdown rendering, section outline, status badge, metadata bar, loading/error states
  - [x] 6.3 Integration test: verify `PlanningWorkspacePage` shows `ArtifactViewer` when workflow selected and artifact exists, shows placeholder when missing

## Dev Notes

### Architecture Pattern: Reading Artifact Content (CRITICAL)

Artifact files live on the filesystem at `_bmad-output/planning-artifacts/`. Reading them **MUST** happen in the main process via a tRPC procedure. **Never import `fs` in renderer code.**

**Existing pattern to follow:** The `planning.router.ts` already uses `statSync` to check file existence. For content reading, add `readFileSync` in the new `getArtifactContent` procedure using the same file resolution pattern:

```typescript
import { readFileSync, statSync } from 'fs'
import { join } from 'path'

// In getArtifactContent procedure:
const workflow = ARTIFACT_FILES.find(a => a.workflowKey === input.workflowKey)
if (!workflow) throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown workflow: ${input.workflowKey}` })

const filePath = join(ctx.projectRoot, '_bmad-output', 'planning-artifacts', workflow.filename)
let content: string
try {
  content = readFileSync(filePath, 'utf-8')
} catch {
  throw new TRPCError({ code: 'NOT_FOUND', message: `Artifact not found: ${workflow.filename}` })
}

const stat = statSync(filePath)
return {
  content,
  filePath: `_bmad-output/planning-artifacts/${workflow.filename}`,
  lastModified: stat.mtimeMs,
  sizeBytes: stat.size,
  wordCount: content.split(/\s+/).filter(Boolean).length,
  workflowKey: input.workflowKey
}
```

### Markdown Rendering: Reuse Existing Components (CRITICAL)

**DO NOT install new markdown libraries.** The project already has:
- `react-markdown` (^10.1.0) — markdown renderer
- `remark-gfm` (^4.0.1) — GitHub Flavored Markdown support (tables, strikethrough, etc.)

**Existing `markdownComponents`** at `src/renderer/src/components/task/MarkdownComponents.tsx` provides all styled elements: h1-h4, p, ul, ol, li, blockquote, code (with syntax highlighting via `CodeBlock`), tables, links, etc.

**Usage pattern:**
```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'

<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
  {content}
</ReactMarkdown>
```

### Section Outline: Heading Extraction with IDs

To enable scroll-to-section navigation, the ArtifactViewer needs two things:

1. **Parse headings from raw markdown** for the outline panel:
```typescript
function extractHeadings(markdown: string): Array<{ level: number; text: string; slug: string }> {
  const headings: Array<{ level: number; text: string; slug: string }> = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let match
  while ((match = regex.exec(markdown)) !== null) {
    const text = match[2].replace(/[*_`~]/g, '') // strip inline formatting
    const slug = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    headings.push({ level: match[1].length, text, slug })
  }
  return headings
}
```

2. **Extend `markdownComponents` headings** to add `id` attributes. Create an artifact-specific extended copy (do NOT modify the shared file):
```tsx
const artifactMarkdownComponents = {
  ...markdownComponents,
  h1: ({ children }: { children?: React.ReactNode }) => {
    const text = typeof children === 'string' ? children : String(children)
    const slug = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
    return <h1 id={slug} className="...">{children}</h1>
  },
  // Similar for h2, h3
}
```

### Status Lifecycle: Adding "In Review" (AC: 3)

The current `PLANNING_ARTIFACT_STATUS` in `schema.ts` is `['draft', 'approved']`. Story 9.3 requires adding `'in-review'`:

```typescript
export const PLANNING_ARTIFACT_STATUS = ['draft', 'in-review', 'approved'] as const
```

The DB column is `TEXT` so no migration needed — just update the TypeScript const and the Zod validation picks it up automatically via `z.enum(PLANNING_ARTIFACT_STATUS)`.

**Status transitions allowed:** Draft → In Review → Approved (and any reverse). Implement as a dropdown with all 3 options (no complex state machine needed).

**Display:** Use `shadcn/ui Badge` with variant colors:
- `Draft`: default/muted appearance
- `In Review`: yellow/amber badge
- `Approved`: green badge

### Zustand Store Extension (Task 5)

Add a convenience action to `usePlanningWorkspaceStore` for direct artifact navigation from Kanban:

```typescript
openWorkspaceToArtifact: (workflowKey: string) => {
  const workflow = BMAD_WORKFLOWS.find(w => w.key === workflowKey)
  set({
    isOpen: true,
    activePhase: workflow?.phase ?? 'analysis',
    selectedWorkflowKey: workflowKey
  })
}
```

**Import note:** You'll need to import `BMAD_WORKFLOWS` from `@renderer/constants/planning-workspace` in the store. This creates a circular-ish dependency since the constants file imports the store type — use a dynamic lookup or pass the phase directly.

### PlanningWorkspacePage Integration (Task 4)

**Current center content** at `src/renderer/src/pages/PlanningWorkspacePage.tsx` lines 200-208:
```tsx
<main className={cn(
  "flex flex-1",
  selectedWorkflow && "items-center justify-center p-8"
)}>
  {selectedWorkflow ? (
    <SelectedWorkflowPlaceholder workflow={selectedWorkflow} />
  ) : (
    <PhaseProgressDashboard />
  )}
</main>
```

**Replace with three-state logic:**
```tsx
<main className={cn(
  "flex flex-1",
  selectedWorkflow && !artifactExists && "items-center justify-center p-8"
)}>
  {!selectedWorkflow ? (
    <PhaseProgressDashboard />
  ) : artifactExists ? (
    <ArtifactViewer workflowKey={selectedWorkflow.key} />
  ) : (
    <SelectedWorkflowPlaceholder workflow={selectedWorkflow} />
  )}
</main>
```

Determine `artifactExists` by checking the `scanArtifacts` data for the selected workflow's status !== 'missing'.

### Kanban Board Integration (AC: 4)

Planning task cards on the Kanban board already navigate to the planning workspace when clicked (via Story 9.1). The existing click handler in the task card calls `openWorkspace(phase)`. For Story 9.3, if the task has a completed artifact:

1. Check if the planning task's associated workflow has an existing artifact
2. If yes, call the new `openWorkspaceToArtifact(workflowKey)` to open directly to the viewer
3. If no, fall back to the existing `openWorkspace(phase)` behavior

**Finding the click handler:** Look for planning task card click handling in `src/renderer/src/components/board/` or `src/renderer/src/components/task/` — the existing pattern uses `usePlanningWorkspaceStore` actions.

### "Edit with Agent" Button (AC: 6)

The artifact is read-only. The "Edit with Agent" button should:
1. Close the planning workspace via `closeWorkspace()`
2. Navigate the user to the Kanban board where they can find the corresponding planning task
3. The user then starts the agent from the task card (existing Epic 3 functionality)

This is a simple navigation action, not a complex integration.

### UI Layout for ArtifactViewer

The ArtifactViewer fills the center `<main>` area of the planning workspace and has this internal layout:

```
┌──────────────────────────────────────────────┐
│ Header: [Artifact Name]  [Status ▾]  [Edit]  │
│ Metadata: path • modified • words • workflow  │
├────────────┬─────────────────────────────────┤
│ Section    │                                 │
│ Outline    │  Markdown Content               │
│            │  (scrollable)                   │
│ • Heading1 │                                 │
│   • Sub1   │                                 │
│   • Sub2   │                                 │
│ • Heading2 │                                 │
│   • Sub3   │                                 │
│            │                                 │
└────────────┴─────────────────────────────────┘
```

- Section outline: ~200px fixed width, scrollable independently
- Markdown content: flex-1, scrollable with `overflow-y-auto`
- Header + metadata: fixed at top, not scrollable

### Project Structure Notes

Files to create:
```
src/renderer/src/components/planning/ArtifactViewer.tsx         <- NEW (🎨 use /frontend-design)
src/renderer/src/components/planning/ArtifactViewer.test.tsx    <- NEW (tests)
```

Files to modify:
```
src/main/trpc/routers/planning.router.ts                        <- ADD getArtifactContent procedure
src/main/trpc/routers/planning.router.test.ts                   <- ADD getArtifactContent tests
src/main/db/schema.ts                                           <- UPDATE PLANNING_ARTIFACT_STATUS to include 'in-review'
src/renderer/src/pages/PlanningWorkspacePage.tsx                 <- REPLACE SelectedWorkflowPlaceholder with ArtifactViewer
src/renderer/src/stores/planning-workspace.store.ts             <- ADD openWorkspaceToArtifact action
src/renderer/src/pages/PlanningWorkspacePage.test.tsx            <- UPDATE for ArtifactViewer integration
```

### Anti-Patterns to Avoid

- **DO NOT** import `fs` or any Node.js modules in renderer — use tRPC for file reading
- **DO NOT** install new markdown libraries — use existing `react-markdown` + `remark-gfm`
- **DO NOT** modify the shared `markdownComponents` in `task/MarkdownComponents.tsx` — create an extended copy for artifact viewer
- **DO NOT** use `useState` for artifact data — use tRPC queries (TanStack Query)
- **DO NOT** wrap tRPC responses in `{ success: true, data: ... }` — return data directly
- **DO NOT** throw generic `Error` in router — use `TRPCError`
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** create a new Zustand store — extend the existing `usePlanningWorkspaceStore`
- **DO NOT** implement artifact editing — this is read-only (editing is via BMAD agents in terminal)
- **DO NOT** implement version diffing — that's Story 9.7
- **DO NOT** implement the "What Next?" recommender — that's Story 9.4
- **DO NOT** poll filesystem for changes — rely on `refetchOnWindowFocus` and query invalidation
- **DO NOT** use `dangerouslySetInnerHTML` — use `ReactMarkdown` component for safe markdown rendering

### Previous Story Intelligence (Story 9.2)

Story 9.2 established:
- `planning.router.ts` with `scanArtifacts` and `updateArtifactStatus` procedures
- `planning_artifact_statuses` DB table with atomic upsert pattern
- `PhaseProgressDashboard` component with health panel and phase cards
- `planning-workflow-constants.ts` with `BMAD_WORKFLOWS` backend mapping
- Replaced `EmptyStatePlaceholder` with `PhaseProgressDashboard` in the center area
- Pattern: `TOCTOU`-safe filesystem checks using `statSync` in try/catch
- Pattern: `refetchOnWindowFocus: true` for re-scanning artifacts
- 32 tests written, all passing
- Status badge cycling: Draft → Approved (Story 9.3 adds "In Review")

**Key learnings from Story 9.2:**
- The `scanArtifacts` data is available and should be reused for existence checks
- Status badge clicks use `updateArtifactStatus.useMutation()` with `onSuccess` invalidating `scanArtifacts`
- Artifact detection uses the `BMAD_WORKFLOWS` constant for known files
- CSS class `items-center justify-center` was conditionally applied only when showing placeholder

### Previous Story Intelligence (Story 9.1)

Story 9.1 established:
- `usePlanningWorkspaceStore` with `isOpen`, `activePhase`, `selectedWorkflowKey`, and actions
- `PlanningWorkspacePage` as a full-screen overlay (`fixed inset-0 z-50`)
- `BMAD_PHASES` and `BMAD_WORKFLOWS` constants in `src/renderer/src/constants/planning-workspace.ts`
- Phase tabs using shadcn/ui `Tabs` component
- Workflow sidebar with `WorkflowCard` component
- Escape key handler, body scroll lock, focus trap patterns
- Navigation is Zustand store-driven, NOT React Router
- `cn()` utility at `@renderer/lib/utils`
- Store exports go through `src/renderer/src/stores/index.ts`
- `useProjectStore` provides `projectName` and `projectPath`

### Git Intelligence

Recent commits:
```
a123597 feat: 9-2 Phase Progress Dashboard with artifact scanning
4e84b83 feat: 9-1 Planning Workspace route and navigation
b691d4e feat: Introduce Epic 9 for BMAD Planning Workspace
```

Code patterns from Story 9.2 are fresh and consistent. The planning router, DB schema, and component patterns are well established.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9 Story 9.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#tRPC Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Zustand Store Pattern]
- [Source: src/main/trpc/routers/planning.router.ts — Existing artifact scanning]
- [Source: src/main/db/schema.ts — PLANNING_ARTIFACT_STATUS enum]
- [Source: src/renderer/src/components/task/MarkdownComponents.tsx — Shared markdown styling]
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx — Center content area lines 200-208]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — Zustand store]
- [Source: src/renderer/src/constants/planning-workspace.ts — BMAD_WORKFLOWS]
- [Source: _bmad-output/planning-artifacts/project-context.md — Critical implementation rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed pre-existing test issue: `createCallerFactory` import from `@trpc/server` was incorrect for tRPC v11. Fixed to use `initTRPC.create().createCallerFactory` instead.
- PhaseProgressDashboard existing test expected `draft → approved` status cycling; updated to `draft → in-review` after adding the new status.

### Completion Notes List

- Task 1: Added `getArtifactContent` tRPC query procedure with file reading, metadata extraction, and word count computation. Uses TOCTOU-safe `readFileSync` in try/catch pattern consistent with existing `scanArtifacts`.
- Task 2: Extended `PLANNING_ARTIFACT_STATUS` to `['draft', 'in-review', 'approved']`. Updated `scanArtifacts` to return 'in-review' status. Updated `PhaseProgressDashboard` with 3-state status cycling (Draft → In Review → Approved → Draft) and yellow "In Review" badge.
- Task 3: Created `ArtifactViewer.tsx` via `/frontend-design` skill. Features: header with status badge dropdown, metadata bar (path/modified/words/workflow), scroll-spy TOC outline with cyan active indicator, markdown rendering with extended `markdownComponents` (added `id` attributes for scroll targeting), loading skeleton, error state with retry.
- Task 4: Integrated ArtifactViewer into PlanningWorkspacePage with three-state center content logic. Fetches `scanArtifacts` data independently to determine artifact existence.
- Task 5: Added `openWorkspaceToArtifact(workflowKey)` to Zustand store. Updated PlanningTaskCard to use it for completed tasks, mapping artifact filename to workflow key via `BMAD_WORKFLOWS`.
- Task 6: 65 tests passing across 4 files — 14 backend (planning.router), 16 ArtifactViewer, 18 PlanningWorkspacePage (3 new integration), 17 PhaseProgressDashboard (1 updated).

### File List

New files:
- src/renderer/src/components/planning/ArtifactViewer.tsx
- src/renderer/src/components/planning/ArtifactViewer.test.tsx

Modified files:
- src/main/trpc/routers/planning.router.ts (added getArtifactContent procedure, updated scanArtifacts for in-review status)
- src/main/trpc/routers/planning.router.test.ts (added getArtifactContent tests, in-review status test, fixed createCallerFactory import)
- src/main/db/schema.ts (added 'in-review' to PLANNING_ARTIFACT_STATUS)
- src/renderer/src/pages/PlanningWorkspacePage.tsx (three-state center content, ArtifactViewer integration)
- src/renderer/src/pages/PlanningWorkspacePage.test.tsx (added ArtifactViewer integration tests, trpc mocks)
- src/renderer/src/stores/planning-workspace.store.ts (added openWorkspaceToArtifact action)
- src/renderer/src/components/board/PlanningTaskCard.tsx (updated click handler for artifact viewer navigation)
- src/renderer/src/components/planning/PhaseProgressDashboard.tsx (in-review status support, 3-state cycling)
- src/renderer/src/components/planning/PhaseProgressDashboard.test.tsx (updated status cycling expectation)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: in-progress → review)
