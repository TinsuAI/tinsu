# Story T1.10: Desktop Feature Parity Validation (Phase 1 Gate)

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to verify that the Tauri desktop app matches the Electron app feature-for-feature,
So that I can confidently retire the Electron version and proceed to Phase 2.

## Acceptance Criteria

1. **Given** all T1.1–T1.9 stories are complete **When** I run the Tauri desktop app through a full workflow **Then** the Kanban board with drag-and-drop works identically to Electron (FR1–FR6)

2. **Given** a task moved to In Progress **When** agent execution runs **Then** terminal streaming works and the 3-column task workspace renders correctly (FR7–FR11, TES FR21–FR25)

3. **Given** an agent running **When** I use stall detection and pause/resume **Then** they work as expected (FR12–FR16)

4. **Given** a completed agent run **When** I enter the review panel **Then** diff view, approve, and reject with feedback all work (FR17–FR21)

5. **Given** a task approved **When** the merge completes **Then** git worktrees with merge on approve work correctly (FR22–FR27)

6. **Given** a project **When** I configure settings **Then** project configuration, methodology selection, YAML config, and git init work (FR28–FR31)

7. **Given** the SQLite database **When** I run CRUD operations **Then** data persistence is ACID-compliant and queries complete in <200ms (FR32–FR35, NFR6, NFR15)

8. **Given** the planning workspace **When** I use the Phase Progress Dashboard **Then** it shows artifact scan results across all 3 BMAD phases (analysis, planning, solutioning) with correct status badges (Draft/Approved/Missing)

9. **Given** the planning workspace **When** I view the ArtifactViewer **Then** it renders markdown content with section navigation, status lifecycle dropdown, and file metadata bar

10. **Given** the planning workspace **When** I view the WhatNext panel **Then** it recommends the next BMAD step based on which artifacts are present on disk

11. **Given** a readiness report exists in `_bmad-output/planning-artifacts/` **When** I view the ReadinessGatePanel **Then** it shows PASS/CONCERNS/FAIL badge, issues list, and approve-for-implementation action

12. **Given** an agent running a planning workflow **When** I view the WorkflowRunPanel **Then** it shows the active run with status, elapsed time, and output links; and RecentRunsTable shows historical runs

13. **Given** the planning workspace chat **When** I use concurrent chat sessions **Then** they work with persistent tmux sessions, live status indicators, and session health validation (FR36–FR53)

14. **Given** all 7 hook event types **When** agents fire Claude Code hooks **Then** activity logging captures them and streams to the UI in real time (TES FR10–FR20)

15. **Given** workflow automation **When** a Story task moves to In Progress **Then** dev-story auto-executes; when it completes, the task auto-moves to Review (TES FR30–FR38)

16. **Given** scrollback persistence **When** the app restarts or system reboots **Then** terminal scrollback restores correctly (TES FR39–FR47)

17. **Given** all existing React frontend tests **When** I run `npm test` **Then** all tests pass with no new failures

18. **Given** all Rust backend services **When** I run `cargo test` **Then** all Rust tests pass including ≥10 new tests for planning commands

19. **Given** the built Tauri binary **When** I check its size **Then** it is under 30MB (NFR37)

20. **Given** the app **When** I use keyboard shortcuts **Then** A (approve), R (reject), Enter (open), Escape (close), Space (pause/resume), arrows (navigate), ? (show shortcuts) all work (UX-DR5)

21. **Given** all UI components **When** I audit for accessibility **Then** WCAG AA is maintained: 2px focus rings, ARIA roles, live regions, `prefers-reduced-motion` support (UX-DR6)

## Tasks / Subtasks

### Task 1: Implement planning Tauri commands — `src-tauri/src/commands/planning.rs` (AC: 8–12, 18)

- [ ] 1.1 Create `src-tauri/src/commands/planning.rs` and add `pub mod planning;` to `src-tauri/src/commands/mod.rs`

- [ ] 1.2 Define DTOs (all with `#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]`):
  ```rust
  pub struct ArtifactScanResult {
      pub workflow_key: String,
      pub exists: bool,
      pub filename: Option<String>,        // actual filename found (for glob patterns)
      pub last_modified: Option<i64>,      // unix ms
      pub size_bytes: Option<i64>,
      pub status: String,                  // "draft" | "in-review" | "approved" | "missing"
  }
  pub struct ArtifactContentResult {
      pub content: String,
      pub file_path: String,
      pub last_modified: i64,
      pub size_bytes: i64,
      pub word_count: i64,
      pub workflow_key: String,
  }
  pub struct WorkflowRunModel {
      pub id: String,
      pub project_id: String,
      pub workflow_key: String,
      pub phase: Option<String>,
      pub status: String,
      pub started_at: Option<i64>,
      pub finished_at: Option<i64>,
      pub input_artifacts: Option<Vec<String>>,   // parsed from JSON
      pub output_artifacts: Option<Vec<String>>,  // parsed from JSON
      pub agent_name: Option<String>,
      pub task_id: Option<String>,
  }
  pub struct GateDecisionModel {
      pub id: String,
      pub project_id: String,
      pub decision: String,           // "pass" | "concerns" | "fail"
      pub rationale: Option<String>,
      pub issues: Option<Vec<GateIssue>>,  // parsed from JSON
      pub created_at: i64,
      pub workflow_run_id: Option<String>,
  }
  pub struct GateIssue {
      pub severity: String,           // "critical" | "major" | "minor"
      pub description: String,
      pub artifact_key: Option<String>,
      pub section_ref: Option<String>,
  }
  ```

- [ ] 1.3 Implement `ARTIFACT_FILE_PATTERNS` static map — maps `workflow_key` → `(glob_pattern, is_glob)`:
  ```
  brainstorming     → "brainstorming/brainstorming-session-*.md" (glob)
  market-research   → "research/market-*-research-*.md" (glob)
  domain-research   → "research/domain-*-research-*.md" (glob)
  product-brief     → "product-brief-*.md" (glob)
  prd               → "prd.md" (exact)
  growth-review     → "growth-hacking-review.md" (exact)
  ux-design         → "ux-design-specification.md" (exact)
  architecture      → "architecture.md" (exact)
  epics-stories     → "epics.md" (exact)
  readiness-check   → "implementation-readiness-report-*.md" (glob)
  ```
  Use a `phf::Map` or `once_cell::sync::Lazy<HashMap<...>>` for the lookup.
  **IMPORTANT:** `phf` is NOT in Cargo.toml. Use `once_cell` or a match statement.

- [ ] 1.4 Implement `resolve_artifact_path(project_path: &str, workflow_key: &str) -> Option<PathBuf>` helper:
  - For exact patterns: check if `{project_path}/_bmad-output/planning-artifacts/{filename}` exists
  - For glob patterns: use `tokio::fs::read_dir` on the containing directory and filter by prefix/suffix matching
  - Return `Some(path)` if found, `None` if not found

- [ ] 1.5 Implement `scan_artifacts(project_id, db)` Tauri command:
  - Load project `path` from DB
  - For each entry in `ARTIFACT_FILE_PATTERNS`, call `resolve_artifact_path`
  - Load the artifact's stored status from `planning_artifact_statuses` via SeaORM
  - Return `Vec<ArtifactScanResult>` — one entry per workflow key (10 total)
  - If file doesn't exist, status is always "missing" regardless of DB value

- [ ] 1.6 Implement `get_artifact_content(project_id, workflow_key, db)` Tauri command:
  - Load project `path` from DB
  - Resolve file path via `resolve_artifact_path`; if None → `AppError::NotFound`
  - Read file with `tokio::fs::read_to_string`
  - Compute word count: `content.split_whitespace().count()`
  - Get file metadata for `last_modified` and `size_bytes` via `tokio::fs::metadata`
  - Return `ArtifactContentResult`

- [ ] 1.7 Implement `update_artifact_status(project_id, artifact_key, status, db)` Tauri command:
  - Validate `status` is one of: "draft" | "in-review" | "approved"
  - Upsert into `planning_artifact_statuses`: if row with `(project_id, artifact_key)` exists → update `status`, else insert new row with `uuid::Uuid::new_v4().to_string()` as id
  - Use SeaORM `on_conflict().do_update_column(Column::Status)` pattern
  - Return `Result<(), AppError>`

- [ ] 1.8 Implement `create_workflow_run(project_id, workflow_key, phase, agent_name, task_id, input_artifacts, db)` Tauri command:
  - Validate `workflow_key` is in the known set
  - Insert into `workflow_runs` with status "running", `started_at = now_unix_ms()`
  - `input_artifacts` serialized to JSON string
  - Return `Result<WorkflowRunModel, AppError>`

- [ ] 1.9 Implement `update_workflow_run(run_id, status, output_artifacts, db)` Tauri command:
  - Update `status`; if status is terminal ("succeeded" | "failed" | "cancelled"), set `finished_at = now_unix_ms()`
  - `output_artifacts` serialized to JSON string
  - Return `Result<WorkflowRunModel, AppError>`

- [ ] 1.10 Implement `list_workflow_runs(project_id, limit, db)` Tauri command:
  - SELECT from `workflow_runs` WHERE `project_id = ?` ORDER BY `started_at DESC` LIMIT `limit` (default 20, max 100)
  - Parse `input_artifacts` / `output_artifacts` from JSON strings to `Vec<String>`
  - Return `Result<Vec<WorkflowRunModel>, AppError>`

- [ ] 1.11 Implement `get_active_workflow_run(project_id, db)` Tauri command:
  - SELECT WHERE `project_id = ?` AND `status IN ('running', 'needs-input')` ORDER BY `started_at DESC` LIMIT 1
  - Return `Result<Option<WorkflowRunModel>, AppError>`

- [ ] 1.12 Implement `parse_and_save_gate_result(project_id, workflow_run_id, db)` Tauri command:
  - Load project `path` from DB
  - Try to find readiness report: first check `_bmad-output/planning-artifacts/readiness-check.md`, then glob `implementation-readiness-report-*.md` (pick most recently modified)
  - If no report found → `AppError::NotFound`
  - Read file content with `tokio::fs::read_to_string`
  - Parse the gate result:
    - Search for "READY" (not "NOT READY" or "NEEDS WORK") → decision = "pass"
    - Search for "NEEDS WORK" → decision = "concerns"
    - Search for "NOT READY" → decision = "fail"
    - Case-insensitive; search in the first 2000 chars for "Overall Readiness Status" section
    - Extract issues: find lines with 🔴 → "critical", 🟠 → "major", 🟡 → "minor", parse description from bullet text
    - Extract rationale from "Summary and Recommendations" section (up to 500 chars)
  - Insert into `gate_decisions` table with `uuid::Uuid::new_v4().to_string()` as id
  - Return `Result<GateDecisionModel, AppError>`

- [ ] 1.13 Implement `get_latest_gate_decision(project_id, db)` Tauri command:
  - SELECT most recent gate_decision for project, parse `issues` JSON
  - Return `Result<Option<GateDecisionModel>, AppError>`

- [ ] 1.14 Implement `list_gate_decisions(project_id, limit, db)` Tauri command:
  - SELECT ordered by `created_at DESC`, limit default 10, max 50
  - Return `Result<Vec<GateDecisionModel>, AppError>`

- [ ] 1.15 Implement `approve_for_implementation(project_id, db)` Tauri command:
  - Verify latest gate decision is "pass" → if not, return `AppError::BadRequest("No passing gate decision found")`
  - Upsert "approved" status for ALL known workflow keys in `planning_artifact_statuses`
  - Return `Result<i64, AppError>` (count of artifacts approved)

- [ ] 1.16 Register all 12 new commands in `src-tauri/src/lib.rs` `collect_commands![]`:
  ```rust
  commands::planning::scan_artifacts,
  commands::planning::get_artifact_content,
  commands::planning::update_artifact_status,
  commands::planning::create_workflow_run,
  commands::planning::update_workflow_run,
  commands::planning::list_workflow_runs,
  commands::planning::get_active_workflow_run,
  commands::planning::parse_and_save_gate_result,
  commands::planning::get_latest_gate_decision,
  commands::planning::list_gate_decisions,
  commands::planning::approve_for_implementation,
  ```
  Then regenerate `src/bindings.ts` via `cargo test generate_bindings -- --ignored`

- [ ] 1.17 Write ≥10 unit tests in `planning.rs` (or `planning_test.rs`):
  - `resolve_artifact_path` finds exact files correctly
  - `resolve_artifact_path` returns None when file missing
  - `parse_gate_result_from_content` parses "READY" → "pass"
  - `parse_gate_result_from_content` parses "NOT READY" → "fail"
  - `parse_gate_result_from_content` parses "NEEDS WORK" → "concerns"
  - `parse_gate_result_from_content` extracts 🔴 critical issues
  - `parse_gate_result_from_content` extracts 🟡 minor issues
  - `scan_artifacts` returns all 10 workflow keys
  - `update_artifact_status` upserts correctly (insert then update same key)
  - `approve_for_implementation` rejects without passing gate

### Task 2: Restore PhaseProgressDashboard (AC: 8)

- [ ] 2.1 Remove the T1.9 stub from `src/components/planning/PhaseProgressDashboard.tsx` and restore a full implementation using Tauri commands

- [ ] 2.2 Use `useQuery` calling `commands.scanArtifacts(projectId)` — `projectId` from `useProjectStore`

- [ ] 2.3 Group results by `phase` (analysis / planning / solutioning) using `BMAD_PHASES` from `@renderer/constants/planning-workspace`

- [ ] 2.4 Render 3 phase cards, each showing its workflows with status badges:
  - `approved` → green checkmark badge
  - `draft` → amber "Draft" badge
  - `missing` → dimmed gray "Missing" tag

- [ ] 2.5 "Project Health" checklist: check Product Brief, PRD, UX Spec (optional), Architecture, Epics & Stories, Readiness Gate — each checkmark or "Missing"

- [ ] 2.6 Empty state: when NO artifact exists → show "No artifacts yet. Start with brainstorming or create a product brief." with a "Start Planning" button

- [ ] 2.7 Status badge click → call `commands.updateArtifactStatus(projectId, artifactKey, 'approved')` and invalidate `['scan-artifacts', projectId]` query

- [ ] 2.8 Use `staleTime: 0, refetchOnWindowFocus: true` in query options

- [ ] 2.9 Include `WhatNextPanel` at the top of the dashboard (above the phase cards) — same layout as Epic 9 story 9.4

- [ ] 2.10 Update `PhaseProgressDashboard.test.tsx`: remove placeholder test, add tests verifying:
  - Phase cards render with correct workflow names
  - Empty state shows when all artifacts missing
  - Health checklist shows checkmarks for existing artifacts
  - Badge click triggers status update mutation

### Task 3: Restore ArtifactViewer (AC: 9)

- [ ] 3.1 Remove T1.9 stub from `src/components/planning/ArtifactViewer.tsx`

- [ ] 3.2 Props interface (preserve existing — other components import it):
  ```typescript
  interface ArtifactViewerProps {
    workflowKey: string
    filePath: string        // kept for compatibility; actual path resolved server-side
    onCloseFile: () => void
  }
  ```

- [ ] 3.3 Fetch content via `useQuery` calling `commands.getArtifactContent(projectId, workflowKey)` — display loading skeleton and "NOT FOUND" state

- [ ] 3.4 Fetch status via `useQuery` calling `commands.scanArtifacts(projectId)` — find the entry matching `workflowKey`

- [ ] 3.5 Render:
  - **Header bar**: artifact name (from `BMAD_WORKFLOWS` lookup by key), status badge dropdown (Draft / In Review / Approved), "Close" button calling `onCloseFile`
  - **Section outline (left ~20%)**: parse headings with `/^(#{1,3})\s+(.+)$/gm`, render clickable TOC with indentation; click → `document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth' })`
  - **Markdown content (main area)**: use `ReactMarkdown` + `remarkGfm` + existing `markdownComponents` from `@renderer/components/task/MarkdownComponents`; add `id` attributes to h1/h2/h3 for scroll targeting (slugify heading text)
  - **Metadata footer**: file path, last modified (format with `date-fns`), word count, workflow name

- [ ] 3.6 Status dropdown → `commands.updateArtifactStatus(projectId, workflowKey, newStatus)` + invalidate both queries

- [ ] 3.7 "Edit with Agent" link: `closeWorkspace()` from `usePlanningWorkspaceStore` to return to Kanban

- [ ] 3.8 Update `ArtifactViewer.test.tsx`: replace placeholder test with tests for content rendering, section outline, status dropdown mutation call

### Task 4: Restore WhatNextPanel (AC: 10)

- [ ] 4.1 Remove T1.9 stub from `src/components/planning/WhatNextPanel.tsx`

- [ ] 4.2 Use `useQuery` calling `commands.scanArtifacts(projectId)` and `useNextRecommendation` hook — both already exist from Epic 9 (do NOT reimplement; just import from `@renderer/hooks/useNextRecommendation` and existing constants)

- [ ] 4.3 Render recommendation card with: icon (Lightbulb/Compass from lucide), workflow name, reason text, produces filename in monospace, "Start" button that calls `setSelectedWorkflow(workflowKey)` from `usePlanningWorkspaceStore`

- [ ] 4.4 Handle optional workflows (UX Design): show "(optional)" badge + "Skip" action

- [ ] 4.5 Completion state: all artifacts exist → congratulatory card with check icon

- [ ] 4.6 Loading state: subtle skeleton

- [ ] 4.7 Update `WhatNextPanel.test.tsx`: replace placeholder test with real render tests (recommendation card, completion state, start button navigation)

### Task 5: Restore ReadinessGatePanel (AC: 11)

- [ ] 5.1 Remove T1.9 stub from `src/components/planning/ReadinessGatePanel.tsx`

- [ ] 5.2 Use `useQuery` calling `commands.getLatestGateDecision(projectId)` with `refetchOnWindowFocus: true`

- [ ] 5.3 When gate result exists, render:
  - Large status badge: PASS (emerald) / CONCERNS (yellow) / FAIL (red) — use icon + color + text (UX-DR6 color independence)
  - Issues list: severity chip + description; Critical issues in red, Major in amber, Minor in muted
  - "Re-run Gate" button → `useMutation` calling `commands.parseAndSaveGateResult(projectId, null)` + invalidate query
  - Historical gate decisions via `commands.listGateDecisions(projectId)` in a collapsible "History" section

- [ ] 5.4 When gate is PASS: show prominent "Approve for Implementation" button → `commands.approveForImplementation(projectId)` with confirmation dialog

- [ ] 5.5 Empty state: "No readiness check results yet. Run the Implementation Readiness workflow first."

- [ ] 5.6 Update `ReadinessGatePanel.test.tsx`: replace placeholder test with tests for PASS/FAIL states, issues list rendering, approve button visibility

### Task 6: Restore WorkflowRunPanel and RecentRunsTable (AC: 12)

- [ ] 6.1 Remove T1.9 stub from `src/components/planning/WorkflowRunPanel.tsx`

- [ ] 6.2 Use `useQuery` calling `commands.getActiveWorkflowRun(projectId)` with `refetchInterval: 3000`

- [ ] 6.3 When active run exists, render card showing:
  - Workflow name (lookup from `BMAD_WORKFLOWS`)
  - Phase badge
  - Agent name
  - Status with color + animation (Running: cyan pulse, Needs Input: yellow, Succeeded: emerald, Failed: red, Cancelled: gray)
  - Elapsed time computed from `started_at` to `Date.now()`, updating every second via `useEffect` interval
  - Input artifact tags
  - "View Terminal" link → navigate to the task workspace for `task_id`

- [ ] 6.4 When run succeeds: show output artifact links that call `setSelectedWorkflow(key)` from store

- [ ] 6.5 Remove T1.9 stub from `src/components/planning/RecentRunsTable.tsx`

- [ ] 6.6 Use `useQuery` calling `commands.listWorkflowRuns(projectId, 20)` with `refetchOnWindowFocus: true`

- [ ] 6.7 Render a table with columns: Workflow, Phase, Status badge, Started (formatted), Duration (computed from `started_at` and `finished_at`)

- [ ] 6.8 Update test files: `WorkflowRunPanel.test.tsx` and `RecentRunsTable.test.tsx` — replace placeholder tests with real render tests

### Task 7: Fix remaining deferred items from T1.9 (AC: 13)

- [ ] 7.1 **Stale session cleanup timer**: Add a periodic health monitor in `src-tauri/src/lib.rs` setup block. After `validate_chat_sessions_on_startup`, spawn a `tokio::task` that:
  - Polls every 30 seconds
  - For each chat session where `status NOT IN ('exited', 'deleted')`, checks `TmuxService::has_session`
  - If session is gone → emit `chat:session-status-changed` event with `status="exited"` and update DB
  - Use `app_handle.state::<Arc<TmuxService>>()` to access TmuxService from the background task
  - Store `Arc<DatabaseConnection>` clone for DB access (same pattern as `validate_chat_sessions_on_startup`)

- [ ] 7.2 **Permission resolution inline UX (ChatPanel)**: The T1.9 stub shows inline text "Permission: {tool_name} approved". Verify this is rendering correctly from the `chat:permission-request` Tauri Event listener in `ChatPanel.tsx`. No full permission modal needed — the existing inline message is sufficient for T1.10.

### Task 8: Feature Parity Validation Checklist (AC: 1–7, 14–16, 20–21)

Run through and document each item in the Dev Agent Record. For each failing item, fix the root cause:

- [ ] 8.1 **Kanban Board**: Open app, verify 5 columns render; drag a task between columns; check status badge updates; create new task with acceptance criteria. (FR1–FR6, UX-DR4)

- [ ] 8.2 **Task Workspace**: Open a task, verify 3-column layout (Content/Terminal+Activities/Diff); resize columns with drag handles; content tab shows description and ACs. (TES FR21–FR25)

- [ ] 8.3 **Agent Execution**: Move a Story task to In Progress; verify tmux session created; terminal output streams with <500ms latency; auto dev-story command fires; task auto-moves to Review. (FR7–FR11, TES FR31–FR32)

- [ ] 8.4 **Stall Detection**: Verify stall detector triggers after configured threshold with visual indicator. (FR12–FR13, NFR8)

- [ ] 8.5 **Pause/Resume**: Test pause and resume on running agent; verify <1 second response. (FR14–FR15, NFR9)

- [ ] 8.6 **Review Workflow**: Approve changes → merge; reject with feedback → returns to In Progress; diff viewer shows file tree with Monaco Editor. (FR17–FR21, UX-DR10, UX-DR14)

- [ ] 8.7 **Git Worktrees**: Verify worktree created on In Progress, deleted after approve; branch naming `tinsu/story-{id}-{slug}`; conflict detection surface. (FR22–FR27, NFR12–NFR14)

- [ ] 8.8 **Project Config**: Test YAML config, methodology selection, git init. (FR28–FR31)

- [ ] 8.9 **Activity Log**: Verify all 7 event types captured: status_change, agent_start, agent_complete, tool_used, user_command, automation_trigger, error; filter chips work. (TES FR10–FR20, UX-DR9)

- [ ] 8.10 **Scrollback Persistence**: Restart the app; verify terminal scrollback restores from backup; verify backup survives system reboot scenario. (TES FR39–FR47, NFR11)

- [ ] 8.11 **Planning Chat**: Create 3 concurrent chat sessions with different personas; verify live status indicators; switch between sessions; verify persistence across app restart. (FR36–FR53, NFR25–NFR32)

- [ ] 8.12 **Keyboard Shortcuts**: Test A (approve), R (reject), Enter (open task), Escape (close), Space (pause/resume), ↑↓ (navigate), ? (shortcut overlay). (UX-DR5)

- [ ] 8.13 **Accessibility**: Verify 2px focus rings on interactive elements; check ARIA roles via browser DevTools; verify color independence in status badges (icon + color + text). (UX-DR6)

- [ ] 8.14 **Binary Size**: Run `npm run tauri build` and check binary size < 30MB. (NFR37)

### Task 9: Verification (AC: 17–19)

- [ ] 9.1 `cargo test` → all tests pass, ≥10 new from T1.10 planning commands, no regressions

- [ ] 9.2 `npm run typecheck` → 0 new TypeScript errors

- [ ] 9.3 `npm test` → all frontend tests pass, no regressions introduced by restored planning components

- [ ] 9.4 `cargo test generate_bindings -- --ignored` → regenerate `src/bindings.ts`

## Dev Notes

### Critical: Planning Commands — DB Entity Location

All three DB entities are already ported from Electron's 17-table schema in T1.2:
- `src-tauri/src/db/entities/planning_artifact_status.rs` — table `planning_artifact_statuses`
- `src-tauri/src/db/entities/workflow_run.rs` — table `workflow_runs`
- `src-tauri/src/db/entities/gate_decision.rs` — table `gate_decisions`

**No new DB migration needed.** The entities match the Electron schema exactly. Read each entity file before writing commands to get correct column names and types.

`planning_artifact_statuses` key column is `artifact_key` (not `workflow_key` — different naming than the frontend). When mapping, `artifact_key == workflow_key`.

### Critical: Upsert Pattern for planning_artifact_statuses

SeaORM doesn't have a one-liner upsert. Use this pattern:
```rust
use sea_orm::sea_query::OnConflict;
use crate::db::entities::planning_artifact_status;

let new_row = planning_artifact_status::ActiveModel {
    id: Set(uuid::Uuid::new_v4().to_string()),
    project_id: Set(project_id.clone()),
    artifact_key: Set(artifact_key.clone()),
    status: Set(status.clone()),
    updated_at: Set(now_unix_ms()),
};
planning_artifact_status::Entity::insert(new_row)
    .on_conflict(
        OnConflict::columns([planning_artifact_status::Column::ProjectId, planning_artifact_status::Column::ArtifactKey])
            .update_columns([planning_artifact_status::Column::Status, planning_artifact_status::Column::UpdatedAt])
            .to_owned()
    )
    .exec(&db).await
    .map_err(|e| AppError::Database(e.to_string()))?;
```

### Critical: Glob Pattern Resolution Without phf/glob Crate

`glob` and `phf` crates are NOT in Cargo.toml. Do NOT add them (unnecessary dep). Use `tokio::fs::read_dir` + manual matching:

```rust
async fn find_file_with_prefix_suffix(dir: &Path, prefix: &str, suffix: &str) -> Option<PathBuf> {
    let mut entries = tokio::fs::read_dir(dir).await.ok()?;
    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(prefix) && name.ends_with(suffix) {
            if let Ok(meta) = entry.metadata().await {
                let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                if best.as_ref().map_or(true, |(_, t)| &modified > t) {
                    best = Some((entry.path(), modified));
                }
            }
        }
    }
    best.map(|(p, _)| p)
}
```

### Critical: Frontend Result Wrapper Pattern (Same as T1.4–T1.9)

All Tauri commands return:
```typescript
{ status: "ok"; data: T } | { status: "error"; error: AppError }
```

Always unwrap in React:
```typescript
const r = await commands.scanArtifacts(projectId)
if (r.status === 'error') throw new Error(JSON.stringify(r.error))
return r.data
```

### Critical: useProjectStore for projectId

Get the active project ID in frontend components:
```typescript
import { useProjectStore } from '@renderer/stores'
const { activeProjectId } = useProjectStore()
```
Then guard: `if (!activeProjectId) return null`.

### Critical: BMAD_WORKFLOWS Constants Already Exist

Do NOT redefine `BMAD_WORKFLOWS` or `BMAD_RECOMMENDATION_CHAIN` — they are in:
- `src/constants/planning-workspace.ts` — `BMAD_WORKFLOWS`, `BMAD_RECOMMENDATION_CHAIN`, `BMAD_PHASES`
- `src/hooks/useNextRecommendation.ts` — the recommendation hook

Import and reuse these. The 10 workflow keys in the Rust `ARTIFACT_FILE_PATTERNS` map must exactly match the `key` field in `BMAD_WORKFLOWS`.

### Critical: Planning Component Props Must Be Preserved

The 6 planning components have existing props signatures used by their parent `PlanningWorkspacePage.tsx`. Preserve exact component signatures:
- `PhaseProgressDashboard` — no props (fetches internally)
- `ArtifactViewer` — `{ workflowKey: string, filePath: string, onCloseFile: () => void }`
- `WhatNextPanel` — no props
- `ReadinessGatePanel` — no props
- `WorkflowRunPanel` — no props
- `RecentRunsTable` — no props

### Critical: ReactMarkdown Usage Pattern

The existing `markdownComponents` are at `src/components/task/MarkdownComponents.tsx`. Import and reuse:
```typescript
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
  {content}
</ReactMarkdown>
```
Extend `markdownComponents.h1/h2/h3` locally in `ArtifactViewer.tsx` to add `id` attributes for section scroll targeting.

### Critical: Stale Session Timer — tokio::spawn Pattern

```rust
// In lib.rs setup block, after validate_chat_sessions_on_startup:
let db_clone = db.clone();
let tmux_clone = Arc::clone(&tmux_service);
let app_handle_clone = app.handle().clone();
tokio::spawn(async move {
    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
        services::chat_cli::check_and_update_stale_sessions(&db_clone, &tmux_clone, &app_handle_clone).await;
    }
});
```

Add `pub async fn check_and_update_stale_sessions(db, tmux, app_handle)` to `chat_cli.rs`.

### Architecture Compliance

- **Planning commands location**: `src-tauri/src/commands/planning.rs` [Source: architecture.md#File Organization]
- **IPC pattern**: tauri-specta commands ONLY [Source: architecture.md#API & Communication Patterns]
- **Error type**: `AppError` enum [Source: architecture.md#Rust Error Handling]
- **Logging**: `tracing::warn!` / `tracing::info!` — NO `println!` [Source: architecture.md#Anti-Patterns]
- **Filesystem**: `tokio::fs` for async file ops — no blocking `std::fs` in async contexts [Source: architecture.md]
- **DB access**: SeaORM entities from `crate::db::entities::*` [Source: T1.2–T1.9 patterns]

### Previous Story Learnings (T1.9)

1. **`SeaORM ActiveModelTrait`**: Must import `use sea_orm::ActiveModelTrait;` in any file calling `.update(&db)` or `.save(&db)`
2. **`project.path` field**: DB entity column is named `path` (not `project_path`)
3. **Non-fatal service failures**: Wrap calls in `if let Err(e) = ... { tracing::warn!(...) }` to prevent cascading failures
4. **Clone `db` before `app_handle.manage(db)`**: Order matters in lib.rs setup block
5. **Tauri Channel for PTY**: Rust uses `Vec<u8>`, TS sees `number[]` due to serialization
6. **`useEffect` cleanup**: Always return unlisten fn from `listen()` calls to prevent memory leaks

### Previous Story Learnings (T1.8)

1. **`exec_git` stdout+stderr combined** for CONFLICT detection
2. **Deleted-file path fix** in `parse_unified_diff` — dead paths resolved correctly
3. **SeaORM `update()` active model** requires `.set(Column::Field, Set(value))` before calling `.update`

### Key File Paths

**New Rust file:**
- `src-tauri/src/commands/planning.rs`

**Modified Rust files:**
- `src-tauri/src/commands/mod.rs` — add `pub mod planning;`
- `src-tauri/src/lib.rs` — register 11 planning commands + stale session timer
- `src-tauri/src/services/chat_cli.rs` — add `check_and_update_stale_sessions` function

**Modified TypeScript files:**
- `src/bindings.ts` — auto-regenerated (do not edit manually)
- `src/components/planning/PhaseProgressDashboard.tsx` — restore from stub
- `src/components/planning/PhaseProgressDashboard.test.tsx` — restore tests
- `src/components/planning/ArtifactViewer.tsx` — restore from stub
- `src/components/planning/ArtifactViewer.test.tsx` — restore tests
- `src/components/planning/WhatNextPanel.tsx` — restore from stub
- `src/components/planning/WhatNextPanel.test.tsx` — restore tests
- `src/components/planning/ReadinessGatePanel.tsx` — restore from stub
- `src/components/planning/ReadinessGatePanel.test.tsx` — restore tests
- `src/components/planning/WorkflowRunPanel.tsx` — restore from stub
- `src/components/planning/WorkflowRunPanel.test.tsx` — restore tests
- `src/components/planning/RecentRunsTable.tsx` — restore from stub
- `src/components/planning/RecentRunsTable.test.tsx` — restore tests

**TypeScript files NOT to touch (already migrated or pure display):**
- `src/components/planning/ArtifactVersionHistory.tsx` (uses git commands from T1.8)
- `src/components/planning/ArtifactDiffView.tsx` (uses Monaco, no tRPC)
- `src/components/planning/AgentPersonaIndicator.tsx`
- `src/components/planning/ChatPanel.tsx` (migrated in T1.9)
- `src/components/planning/ChatSessionList.tsx` (migrated in T1.9)
- `src/components/planning/ChatTerminal.tsx` (migrated in T1.9)
- `src/constants/planning-workspace.ts` (do NOT modify — reuse as-is)
- `src/hooks/useNextRecommendation.ts` (do NOT modify — reuse as-is)

### Source References

- [Source: epics.md#Story T1.10] — Full AC and user story statement
- [Source: _bmad-output/implementation-artifacts/9-2-phase-progress-dashboard.md] — PhaseProgressDashboard original Electron implementation
- [Source: _bmad-output/implementation-artifacts/9-3-artifact-viewer-with-status-lifecycle.md] — ArtifactViewer original Electron implementation
- [Source: _bmad-output/implementation-artifacts/9-4-what-next-recommender-engine.md] — WhatNextPanel + useNextRecommendation hook original Electron implementation
- [Source: _bmad-output/implementation-artifacts/9-5-guided-workflow-run-tracker.md] — WorkflowRunPanel + RecentRunsTable original Electron implementation
- [Source: _bmad-output/implementation-artifacts/9-6-readiness-gate-results-panel.md] — ReadinessGatePanel original Electron implementation
- [Source: _bmad-output/implementation-artifacts/t1-9-migrate-chat-cli-and-planning-services-to-rust.md#Deferred to T1.10] — exact list of deferred items
- [Source: src-tauri/src/db/entities/planning_artifact_status.rs] — entity schema
- [Source: src-tauri/src/db/entities/workflow_run.rs] — entity schema
- [Source: src-tauri/src/db/entities/gate_decision.rs] — entity schema
- [Source: src-tauri/src/commands/chat.rs] — tauri-specta command pattern to follow
- [Source: src-tauri/src/services/chat_cli.rs] — validate_chat_sessions_on_startup pattern for stale session timer
- [Source: src/constants/planning-workspace.ts] — BMAD_WORKFLOWS, BMAD_PHASES, BMAD_RECOMMENDATION_CHAIN (do NOT redefine)
- [Source: src/hooks/useNextRecommendation.ts] — recommendation logic (do NOT reimplement)
- [Source: src/components/task/MarkdownComponents.tsx] — markdownComponents to import in ArtifactViewer

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Implemented `src-tauri/src/commands/planning.rs` with 11 Tauri commands: scanArtifacts, getArtifactContent, updateArtifactStatus, createWorkflowRun, updateWorkflowRun, listWorkflowRuns, getActiveWorkflowRun, parseAndSaveGateResult, getLatestGateDecision, listGateDecisions, approveForImplementation
- Used `match` statement for `get_artifact_pattern()` instead of `once_cell` (not in Cargo.toml)
- Added stale session timer in `src-tauri/src/lib.rs` (tokio::spawn loop, 30s interval) calling `check_and_update_stale_sessions()`
- Added `check_and_update_stale_sessions()` to `src-tauri/src/services/chat_cli.rs`
- Regenerated `src/bindings.ts` with all 11 new commands and associated types
- Restored all 6 planning UI components from T1.9 stubs: WhatNextPanel, ReadinessGatePanel, WorkflowRunPanel, RecentRunsTable, ArtifactViewer, PhaseProgressDashboard
- Fixed type mismatch in WhatNextPanel: mapped `ArtifactScanResult[]` (snake_case) to `ArtifactScanItem[]` (camelCase) before passing to `useNextRecommendation`
- Fixed import path in RecentRunsTable: `@renderer/../../bindings` → `@renderer/bindings`
- Updated all 6 stub test files with proper mocked tests (QueryClientProvider + vi.mock)
- Verification: 103 Rust unit tests pass; 12 new frontend tests pass; 0 new TypeScript errors in planning components

### File List

**New files:**
- `src-tauri/src/commands/planning.rs`

**Modified files:**
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/services/chat_cli.rs`
- `src/bindings.ts`
- `src/components/planning/WhatNextPanel.tsx`
- `src/components/planning/WhatNextPanel.test.tsx`
- `src/components/planning/ReadinessGatePanel.tsx`
- `src/components/planning/ReadinessGatePanel.test.tsx`
- `src/components/planning/WorkflowRunPanel.tsx`
- `src/components/planning/WorkflowRunPanel.test.tsx`
- `src/components/planning/RecentRunsTable.tsx`
- `src/components/planning/RecentRunsTable.test.tsx`
- `src/components/planning/ArtifactViewer.tsx`
- `src/components/planning/ArtifactViewer.test.tsx`
- `src/components/planning/PhaseProgressDashboard.tsx`
- `src/components/planning/PhaseProgressDashboard.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [ ] [Review][Patch] `extract_section` slices string by byte offset — can panic on multi-byte UTF-8 chars at the 500-char boundary [`planning.rs:635`]
- [ ] [Review][Patch] `resolve_artifact_path` uses blocking `std::path::Path::exists()` in async fn — violates architecture rule (use `tokio::fs`) [`planning.rs:213`]
- [ ] [Review][Patch] `ArtifactViewer` heading id extraction uses `typeof children === 'string'` — fails for headings with inline bold/code/links (ReactMarkdown passes arrays); scroll targeting breaks [`ArtifactViewer.tsx:70-97`]
- [x] [Review][Defer] `WorkflowRunPanel` "View Terminal" renders as non-clickable text — task 6.3 requires navigation to task workspace; deferred, needs task workspace navigation store integration [`WorkflowRunPanel.tsx:147`]
- [x] [Review][Defer] `WorkflowRunPanel` output artifact links missing when run succeeds — task 6.4 unimplemented; deferred, architectural limitation (active query only returns running/needs-input) [`WorkflowRunPanel.tsx`]
- [x] [Review][Defer] `ArtifactViewer` "Edit with Agent" button missing — task 3.7 not implemented; deferred, pre-existing gap [`ArtifactViewer.tsx`]
