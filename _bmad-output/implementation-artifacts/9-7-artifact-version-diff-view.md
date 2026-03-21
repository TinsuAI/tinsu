# Story 9.7: Artifact Version Diff View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to compare versions of a planning artifact when it's been regenerated or updated,
So that I can see what changed and make informed approval decisions.

## Acceptance Criteria

1. **Given** an artifact has been updated (file content changed) **When** I open the artifact viewer **Then** a "Compare Versions" button is available

2. **Given** I click "Compare Versions" **When** the diff view opens **Then** it uses the Monaco diff viewer component (from TES Epic 4) **And** shows side-by-side or unified diff format (toggle available)

3. **Given** the diff is displayed **When** I review it **Then** changes are highlighted with section-aware context (heading names visible) **And** additions, deletions, and modifications are color-coded

4. **Given** version history **When** I access it from the artifact viewer **Then** I can see a list of versions with timestamps **And** select any two versions to compare

5. **Given** Git is available **When** computing versions **Then** the system uses `git log` for the artifact file to derive version history **And** `git diff` for computing differences

## Tasks / Subtasks

- [x] Task 1: Add artifact file version history to git service (AC: 5)
  - [x] 1.1 Add `getFileVersionHistory(repoPath: string, filePath: string, limit?: number): Promise<ArtifactVersionEntry[]>` method to `src/main/services/git.service.ts`. This runs `git log --follow --format="%H%x09%an%x09%at%x09%s" -- <filePath>` to get commit history for a specific file. Parse output into array of `{ commitSha, author, timestamp, message }`. Default limit to 50.
  - [x] 1.2 Add `getFileContentAtCommit(repoPath: string, filePath: string, commitSha: string): Promise<string>` method to `src/main/services/git.service.ts`. This runs `git show <commitSha>:<filePath>` to get file content at a specific commit. Throw TRPCError NOT_FOUND if file doesn't exist at that commit.
  - [x] 1.3 Define types in git.service.ts (or `src/shared/types/git.types.ts` if that file already has git types):
    ```typescript
    export interface ArtifactVersionEntry {
      commitSha: string
      author: string
      timestamp: number  // Unix timestamp seconds
      message: string
    }
    ```
  - [x] 1.4 Write unit tests in `src/main/services/git.service.test.ts` (extend existing): test getFileVersionHistory returns parsed commits for a known file, test getFileContentAtCommit returns correct content, test error handling when file doesn't exist at commit

- [x] Task 2: Add tRPC procedures for artifact version history and diff (AC: 4, 5)
  - [x] 2.1 Add `getArtifactVersionHistory` query to `src/main/trpc/routers/planning.router.ts`:
    - Input: `{ projectId: string, workflowKey: string }`
    - Resolves the artifact file path using the existing `ARTIFACT_FILES` mapping from `planning-workflow-constants.ts` (same pattern as `getArtifactContent`)
    - Calls `gitService.getFileVersionHistory(projectPath, artifactRelativePath)` with `projectPath` resolved from `projectId`
    - Returns `ArtifactVersionEntry[]` or empty array if file has no git history (new/untracked)
  - [x] 2.2 Add `getArtifactVersionDiff` query to `src/main/trpc/routers/planning.router.ts`:
    - Input: `{ projectId: string, workflowKey: string, fromCommitSha: string, toCommitSha: string }`
    - Resolves artifact file path using same mapping
    - Calls `gitService.getFileContentAtCommit()` for both commits
    - Returns `{ original: string, modified: string, language: 'markdown', fromCommit: ArtifactVersionEntry, toCommit: ArtifactVersionEntry }` — the Monaco diff editor needs the two text contents
    - If `fromCommitSha` is empty string or "initial", return `original: ''` (treat as initial creation)
  - [x] 2.3 Write tests in `src/main/trpc/routers/planning.router.test.ts` (extend existing): test getArtifactVersionHistory returns entries, test getArtifactVersionDiff returns content pair, test error when workflowKey has no artifact file

- [x] Task 3: Create `ArtifactVersionHistory` component (AC: 1, 4)
  - [x] 3.1 Create `src/renderer/src/components/planning/ArtifactVersionHistory.tsx`
  - [x] 3.2 Props: `{ workflowKey: string, onSelectVersions: (from: ArtifactVersionEntry | null, to: ArtifactVersionEntry) => void, onClose: () => void }`
  - [x] 3.3 Fetch version history via `trpc.planning.getArtifactVersionHistory.useQuery({ projectId, workflowKey })`
  - [x] 3.4 Render a compact vertical timeline of versions:
    - Each entry shows: commit message (truncated 60 chars), relative timestamp (via `formatDistanceToNow` from date-fns), author name
    - Most recent version at top with "Current" badge
    - Each entry has a radio-button-style selector for "from" and "to" comparison points
    - Default: "from" = second most recent, "to" = most recent (current)
  - [x] 3.5 "Compare Selected" button at bottom calls `onSelectVersions(from, to)` with the selected entries
  - [x] 3.6 When only 1 version exists (file only committed once), show message: "Only one version exists. Make changes and commit to see version history."
  - [x] 3.7 Empty state: "No git history available for this artifact." (for untracked files)
  - [x] 3.8 Style: `bg-card/50 border-border` card matching planning workspace aesthetic. Cyan accent for "Current" badge. Same compact card style as ReadinessGatePanel history entries.

- [x] Task 4: Create `ArtifactDiffView` component (AC: 2, 3)
  - [x] 4.1 Create `src/renderer/src/components/planning/ArtifactDiffView.tsx`
  - [x] 4.2 Props: `{ workflowKey: string, fromCommit: ArtifactVersionEntry | null, toCommit: ArtifactVersionEntry, onClose: () => void }`
  - [x] 4.3 Fetch diff data via `trpc.planning.getArtifactVersionDiff.useQuery({ projectId, workflowKey, fromCommitSha: fromCommit?.commitSha ?? '', toCommitSha: toCommit.commitSha })`
  - [x] 4.4 Reuse the existing `MonacoDiffEditor` component from `src/renderer/src/components/diff/MonacoDiffEditor.tsx`:
    - Pass `original` and `modified` content strings
    - Set `language` to `'markdown'`
    - Set `readOnly` to `true`
    - The MonacoDiffEditor already supports split/unified view toggle via the `useDiffStore` — reuse that
  - [x] 4.5 Render a header bar above the diff showing:
    - Left side: "From: {fromCommit message}" with relative timestamp, or "Initial (empty)" if no fromCommit
    - Right side: "To: {toCommit message}" with relative timestamp
    - View mode toggle button (split/unified) — reuse `useDiffStore` `viewMode` and `toggleViewMode`
    - Close button (X icon) that calls `onClose()`
  - [x] 4.6 Handle loading state: show `Skeleton` component matching diff area dimensions
  - [x] 4.7 Handle error state: show error message with retry link
  - [x] 4.8 The diff must occupy the full available height of the center content area (use `flex-1` and `min-h-0` to prevent overflow)

- [x] Task 5: Integrate into ArtifactViewer (AC: 1, 2, 3, 4)
  - [x] 5.1 Modify `src/renderer/src/components/planning/ArtifactViewer.tsx`:
    - Add a "Compare Versions" button to the artifact header metadata bar (next to the status badge area)
    - Button uses `GitCompareArrows` icon from lucide-react (or `GitCompare` if that doesn't exist — check lucide docs) with text "Compare Versions"
    - Button is only enabled when `versionCount >= 2` (prefetch version count via the `getArtifactVersionHistory` query, check `data?.length >= 2`)
    - If only 1 or 0 versions, show button as disabled with tooltip: "Needs at least 2 committed versions"
  - [x] 5.2 Add local state to ArtifactViewer (or use a Zustand slice in planning-workspace.store.ts):
    - `diffViewMode: 'viewer' | 'history' | 'diff'` — controls which view is shown
    - `selectedFromCommit: ArtifactVersionEntry | null`
    - `selectedToCommit: ArtifactVersionEntry | null`
  - [x] 5.3 When "Compare Versions" is clicked → set `diffViewMode = 'history'`, render `ArtifactVersionHistory` INSTEAD of the markdown content
  - [x] 5.4 When versions are selected in ArtifactVersionHistory → set `diffViewMode = 'diff'`, render `ArtifactDiffView` INSTEAD of the markdown content
  - [x] 5.5 Both `ArtifactVersionHistory` and `ArtifactDiffView` have close/back buttons that return to `diffViewMode = 'viewer'` (normal markdown view)
  - [x] 5.6 The section outline sidebar should be hidden when in 'history' or 'diff' mode (the diff takes full width)
  - [x] 5.7 When returning to 'viewer' mode, the markdown content and section outline restore as before

- [x] Task 6: Write tests (AC: 1-5)
  - [x] 6.1 Unit tests for git service methods in `src/main/services/git.service.test.ts`:
    - Test `getFileVersionHistory` parses git log output correctly
    - Test `getFileVersionHistory` returns empty array for untracked files
    - Test `getFileContentAtCommit` returns file content
    - Test `getFileContentAtCommit` throws on nonexistent file
  - [x] 6.2 tRPC tests in `src/main/trpc/routers/planning.router.test.ts`:
    - Test `getArtifactVersionHistory` returns version entries
    - Test `getArtifactVersionHistory` returns empty for untracked artifact
    - Test `getArtifactVersionDiff` returns content pair
    - Test `getArtifactVersionDiff` with empty fromCommitSha returns empty original
  - [x] 6.3 Render tests for `ArtifactVersionHistory.test.tsx`:
    - Verify version list renders with timestamps and messages
    - Verify "Current" badge on most recent
    - Verify version selectors work (from/to radio selection)
    - Verify "Compare Selected" button calls onSelectVersions
    - Verify single-version message
    - Verify empty state
  - [x] 6.4 Render tests for `ArtifactDiffView.test.tsx`:
    - Verify MonacoDiffEditor receives correct original/modified props
    - Verify header shows from/to commit info
    - Verify view mode toggle works
    - Verify close button calls onClose
    - Verify loading skeleton renders
    - Verify error state renders
  - [x] 6.5 Integration test in `ArtifactViewer.test.tsx` (extend or create):
    - Verify "Compare Versions" button appears when 2+ versions exist
    - Verify button disabled when < 2 versions
    - Verify clicking "Compare Versions" switches to history view
    - Verify section outline hides in diff mode

## Dev Notes

### Architecture Decision: Git-Based Versioning (CRITICAL)

Story 9.7 uses Git as the version control backend for planning artifacts. This is the RIGHT approach because:
1. Planning artifacts are markdown files tracked in git
2. Git already has complete version history via `git log`
3. No need for a new database table — versions derive from git commits
4. `git show` retrieves file content at any commit
5. Monaco diff editor expects two strings (original/modified) — `git show` provides both

**DO NOT create a new database table for artifact versions.** Use git history directly via the git service.

### Reusing MonacoDiffEditor from TES Epic 4 (CRITICAL)

The `MonacoDiffEditor` component at `src/renderer/src/components/diff/MonacoDiffEditor.tsx` is a mature, well-tested diff component. It accepts:
- `original: string` — left/old content
- `modified: string` — right/new content
- `language: string` — for syntax highlighting (use `'markdown'`)
- It reads `viewMode` from `useDiffStore` for split vs unified toggle

**DO NOT create a new diff viewer component.** Reuse `MonacoDiffEditor` directly. The `ArtifactDiffView` wrapper handles the artifact-specific header and data fetching, then passes content strings to MonacoDiffEditor.

**IMPORTANT:** Check the actual props interface of `MonacoDiffEditor` before integrating. The architecture doc shows a generic pattern, but the real component (built during TES Epic 4 / Story 7.7 / Story 8.11) may have a different API. Read the actual component file.

### Diff Content Strategy: Two Strings, Not Git Diff Patches

The Monaco diff editor works with two full-text strings (original and modified), NOT with unified diff patches. The backend should:
1. Use `git show <sha>:<path>` to get the full file content at each version
2. Return both strings to the renderer
3. Let Monaco compute and render the diff client-side

This is simpler and more reliable than parsing `git diff` output.

### Integration into ArtifactViewer (CRITICAL)

The "Compare Versions" flow replaces the artifact markdown view WITHIN the ArtifactViewer, not in a separate route or modal:

```
Normal mode:
┌─────────────────────────────────────────────┐
│ [Header: title, status, metadata]           │
│ [Compare Versions] button in header         │
├──────────┬──────────────────────────────────│
│ Sections │ Markdown content                  │
│ outline  │                                   │
└──────────┴──────────────────────────────────┘

History mode (after clicking Compare Versions):
┌─────────────────────────────────────────────┐
│ [Header: title, status, metadata]           │
│ [← Back to Viewer] button                   │
├─────────────────────────────────────────────│
│ Version History Timeline                     │
│ ○ Current — "Updated PRD requirements" 2h ago│
│ ● v2 — "Added NFRs section" 1d ago          │
│ ● v1 — "Initial PRD creation" 3d ago        │
│ [Compare Selected]                           │
└─────────────────────────────────────────────┘

Diff mode (after selecting versions):
┌─────────────────────────────────────────────┐
│ [From: v1 "Initial PRD"] [To: v2 "Added.."]│
│ [Split/Unified toggle] [← Back] [✕ Close]  │
├─────────────────────────────────────────────│
│ MonacoDiffEditor (full height)               │
│                                              │
└─────────────────────────────────────────────┘
```

### Artifact File Path Resolution (CRITICAL)

Planning artifacts map via `ARTIFACT_FILES` in `src/main/trpc/routers/planning-workflow-constants.ts`. The existing `getArtifactContent` procedure already resolves `workflowKey` → file path. Follow the same pattern for version history:

```typescript
// Existing pattern in planning.router.ts:
const artifactFile = ARTIFACT_FILES[workflowKey]
const artifactPath = path.join(projectPath, '_bmad-output/planning-artifacts', artifactFile)
// For git operations, use relative path from repo root:
const relativeArtifactPath = path.join('_bmad-output/planning-artifacts', artifactFile)
```

### MonacoDiffEditor Props (VERIFY BEFORE USING)

Based on codebase exploration, `MonacoDiffEditor` likely uses these props:
```typescript
interface MonacoDiffEditorProps {
  original: string
  modified: string
  language?: string
  readOnly?: boolean
  // Possibly more — READ THE ACTUAL FILE
}
```

The component reads view mode (split/unified) from `useDiffStore` at `src/renderer/src/stores/diff.store.ts`. The store has:
```typescript
viewMode: 'split' | 'unified'
toggleViewMode: () => void
```

### Existing Code Patterns to Follow

**tRPC procedure pattern** (from planning.router.ts):
```typescript
getArtifactVersionHistory: publicProcedure
  .input(z.object({ projectId: z.string(), workflowKey: z.string() }))
  .query(async ({ ctx, input }) => {
    const project = ctx.db.select().from(projects).where(eq(projects.id, input.projectId)).get()
    if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
    const artifactFile = ARTIFACT_FILES[input.workflowKey]
    if (!artifactFile) return []
    const relPath = path.join('_bmad-output/planning-artifacts', artifactFile)
    return gitService.getFileVersionHistory(project.path, relPath)
  })
```

**Component test pattern** (from ReadinessGatePanel.test.tsx, WorkflowRunPanel.test.tsx):
- Mock tRPC: `vi.mock('@renderer/lib/trpc')`
- Mock stores: `vi.mock('@renderer/stores/planning-workspace.store')`
- Use `render()` from `@testing-library/react`
- Use `screen.getByText()`, `screen.queryByText()` for assertions

**UI card pattern** (from planning workspace):
```tsx
<div className="rounded-lg border border-border bg-card/50 p-4">
  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
    <Icon className="h-4 w-4" />
    Section Label
  </div>
</div>
```

### Styling: Match Planning Workspace Aesthetic

Follow established patterns from Stories 9.1-9.6:
- **Card surfaces:** `bg-card/50`
- **Borders:** `border-border`
- **Primary accent:** cyan for badges and active states
- **"Current" version badge:** `bg-cyan-500/20 text-cyan-400`
- **Version entry hover:** `hover:bg-muted/50`
- **Compare button:** `variant="outline"` with `GitCompare` icon
- **Disabled state:** `opacity-50 cursor-not-allowed` with tooltip
- **Close/back buttons:** ghost variant with `ArrowLeft` or `X` icon
- **Spacing:** `p-4` for sections, `gap-2` between items
- **Text:** `text-foreground` primary, `text-muted-foreground` secondary

### Anti-Patterns to Avoid

- **DO NOT** create a new database table for artifact versions — use git history
- **DO NOT** create a new diff viewer component — reuse `MonacoDiffEditor` from `src/renderer/src/components/diff/`
- **DO NOT** import `fs`, `child_process`, or Node.js modules in renderer code — all git operations via tRPC
- **DO NOT** wrap tRPC responses — return data directly
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** parse git diff patches in the renderer — fetch full file content at each commit and let Monaco diff
- **DO NOT** create a new route for the diff view — it replaces content within ArtifactViewer
- **DO NOT** add a new Zustand store for diff state — use local `useState` in ArtifactViewer for `diffViewMode`, and reuse `useDiffStore` for split/unified toggle
- **DO NOT** create a new tRPC router — extend `planningRouter` in `planning.router.ts`
- **DO NOT** use `ipcRenderer.send()` — use tRPC procedures only
- **DO NOT** use `git diff` for computing the visual diff — use `git show` to get full content at each commit, let Monaco compute the diff

### Previous Story Intelligence (Story 9.6)

Story 9.6 established:
- `gate_decisions` DB table — Story 9.7 does NOT need a new table (uses git)
- `ReadinessGatePanel` as a banner above ArtifactViewer — Story 9.7 modifies the ArtifactViewer itself
- Issue-to-artifact linking via `openWorkspaceToArtifact()` — Story 9.7 works within the artifact viewer
- Auto-parse pattern (trigger mutation on view) — Story 9.7 uses queries only (version history is read-only)

**Key learnings from 9.6:**
- TypeScript timestamp mismatches: git timestamps are Unix seconds, ensure consistent conversion
- Backend tests have pre-existing native module issue — don't debug that, just write the tests
- Test patterns from 9.6: 14 parser + 40 router + 22 panel + integration tests
- `trpc.useUtils()` must be called at component top level (React hook rules)

### Git Intelligence

Recent commits (Epic 9):
```
32c6b07 feat: 9-6 Readiness Gate Results Panel with parser and approval flow
f603449 feat: 9-5 Guided Workflow Run Tracker with agent integration
d6e2f84 feat: 9-4 What Next recommender engine for planning workflow guidance
0a310c5 feat: 9-3 Artifact Viewer with status lifecycle and section navigation
a123597 feat: 9-2 Phase Progress Dashboard with artifact scanning
4e84b83 feat: 9-1 Planning Workspace route and navigation
```

Commit message pattern: `feat: 9-{N} {story title summary}`

Files modified in Story 9.6 (latest commit):
- `src/main/db/schema.ts` — table additions
- `src/main/db/index.ts` — migration
- `src/main/services/readiness-gate.service.ts` — new service
- `src/main/trpc/routers/planning.router.ts` — new procedures
- `src/renderer/src/components/planning/ReadinessGatePanel.tsx` — new component
- `src/renderer/src/pages/PlanningWorkspacePage.tsx` — integration

### Project Structure Notes

Files to create:
```
src/renderer/src/components/planning/ArtifactVersionHistory.tsx     <- NEW (version list + selector)
src/renderer/src/components/planning/ArtifactVersionHistory.test.tsx <- NEW (render tests)
src/renderer/src/components/planning/ArtifactDiffView.tsx           <- NEW (Monaco diff wrapper)
src/renderer/src/components/planning/ArtifactDiffView.test.tsx      <- NEW (render tests)
```

Files to modify:
```
src/main/services/git.service.ts                                    <- ADD getFileVersionHistory, getFileContentAtCommit
src/main/services/git.service.test.ts                               <- ADD version history tests
src/main/trpc/routers/planning.router.ts                            <- ADD 2 new procedures
src/main/trpc/routers/planning.router.test.ts                       <- ADD version history/diff tests
src/renderer/src/components/planning/ArtifactViewer.tsx             <- ADD Compare Versions button + view switching
src/renderer/src/components/planning/ArtifactViewer.test.tsx         <- ADD/CREATE integration tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.7 — AC and user story]
- [Source: src/renderer/src/components/diff/MonacoDiffEditor.tsx — Reusable Monaco diff component from TES Epic 4]
- [Source: src/renderer/src/stores/diff.store.ts — Split/unified view mode toggle]
- [Source: src/renderer/src/hooks/useDiff.ts — Version comparison data fetching pattern]
- [Source: src/main/services/git.service.ts — Existing git operations (getDiff, getHistoricalDiff, getCommitInfo)]
- [Source: src/main/trpc/routers/planning.router.ts — Existing planning procedures (getArtifactContent, scanArtifacts)]
- [Source: src/main/trpc/routers/planning-workflow-constants.ts — ARTIFACT_FILES mapping]
- [Source: src/renderer/src/components/planning/ArtifactViewer.tsx — Base component to extend]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — openWorkspaceToArtifact, setSelectedWorkflow]
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx — Workspace layout and center content rendering]
- [Source: _bmad-output/planning-artifacts/architecture.md — tRPC patterns, Monaco editor specs, git service interface]
- [Source: _bmad-output/planning-artifacts/project-context.md — Implementation rules, naming conventions, test patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None needed — clean implementation with all tests passing on first run.

### Completion Notes List

- Task 1: Added `ArtifactVersionEntry` type, `getFileVersionHistory()` and `getFileContentAtCommit()` methods to GitService. Uses `git log --follow` and `git show` commands.
- Task 2: Added `getArtifactVersionHistory` and `getArtifactVersionDiff` tRPC procedures to planning router. Resolves artifact file paths via existing ARTIFACT_FILES mapping.
- Task 3: Created `ArtifactVersionHistory` component with compact vertical timeline, radio-button version selectors, "Current" badge, empty/single-version states. Used /frontend-design skill.
- Task 4: Created `ArtifactDiffView` component wrapping existing `MonacoDiffEditor` with commit metadata header bar, split/unified toggle via `useDiffStore`, loading/error states.
- Task 5: Integrated into `ArtifactViewer` with "Compare Versions" button (enabled when 2+ versions exist), local state for `diffViewMode`, view switching that hides section outline in history/diff modes.
- Task 6: 247 tests total across 5 test files — 14 ArtifactVersionHistory + 11 ArtifactDiffView + 23 ArtifactViewer + 47 planning.router + 152 git.service (including 10 new Story 9.7 tests). All pass, no regressions.

### Change Log

- Story 9.7 implementation complete (Date: 2026-03-21)
- Story 9.7 code review complete (Date: 2026-03-21): 10 auto-fixes applied by DEV 2 agent — SHA format validation (P1), limit bounds clamping (P2), NaN timestamp guard (P3), tab-in-message parsing fix (P4), same-version compare guard (P5), error double-cast fix (P6), toIndex bounds check (P7), forward-slash path separator (P8), loading state when projectId unresolved (P9), toCommitSha empty validation (P10). Bad spec noted: AC5 wording contradicts implementation strategy. All 253 tests passing.

### File List

New files:
- src/renderer/src/components/planning/ArtifactVersionHistory.tsx
- src/renderer/src/components/planning/ArtifactVersionHistory.test.tsx
- src/renderer/src/components/planning/ArtifactDiffView.tsx
- src/renderer/src/components/planning/ArtifactDiffView.test.tsx

Modified files:
- src/main/services/git.service.ts (added ArtifactVersionEntry type, getFileVersionHistory, getFileContentAtCommit)
- src/main/services/git.service.test.ts (added 10 tests for new methods)
- src/main/trpc/routers/planning.router.ts (added getArtifactVersionHistory, getArtifactVersionDiff procedures + GitService import)
- src/main/trpc/routers/planning.router.test.ts (added GitService mock, 7 tests for new procedures, mock reset in beforeEach)
- src/renderer/src/components/planning/ArtifactViewer.tsx (added Compare Versions button, diffViewMode state, view switching, ArtifactVersionHistory/ArtifactDiffView integration)
- src/renderer/src/components/planning/ArtifactViewer.test.tsx (added versionHistory mock, 6 integration tests for Compare Versions)
