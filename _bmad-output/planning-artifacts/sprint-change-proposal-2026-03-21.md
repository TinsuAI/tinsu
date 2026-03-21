# Sprint Change Proposal - Epic 9: BMAD Planning Workspace

**Date:** 2026-03-21
**Initiated by:** Tinsu
**Status:** Approved

---

## 1. Issue Summary

### Problem Statement
Two deep research reports (ChatGPT and Gemini) analyzing the BMAD planning workflow reveal a significantly richer planning experience than what the current Epic 3 stories cover. The existing Epic 3 treats BMAD planning as "5 cards on the Kanban board with terminal agents" — functional but thin. The research shows opportunities for a dedicated planning workspace with phase navigation, artifact lifecycle management, "What Next?" intelligence, and readiness gate visualization.

### Context
- Epic 3 (BMAD Planning Workflow) is currently in backlog with 7+ stories covering infrastructure: task types, agent spawning, artifact detection, story import
- Research reports from ChatGPT and Gemini provide complementary visions for a planning UI
- ChatGPT report focuses on: rigorous data model, workflow runs, artifact versioning/diffing, UI wireframes per phase
- Gemini report focuses on: persona-driven UI concepts, agent presence, adversarial validation visualization, rich workspace metaphors

### Evidence
| Gap in Current Epic 3 | Research Insight |
|------------------------|-----------------|
| No dedicated planning view | Both reports recommend phase-aware workspace with tabs |
| No artifact viewer in-app | Both recommend in-app markdown viewing with section navigation |
| No "What Next?" guidance | ChatGPT: BMad-Help-like recommender; Gemini: progress ring + locked phases |
| No validation gate UI | ChatGPT: PASS/CONCERNS/FAIL capture; Gemini: "Adversarial Validation Studio" |
| No workflow run tracking | ChatGPT: WorkflowRun entity with inputs/outputs/status |
| No agent persona visibility | Gemini: Active agent avatars with distinct colors per role |
| No artifact version diffing | ChatGPT: Side-by-side markdown diff with semantic summaries |

### Research Synthesis Strategy
**Best of both reports, adapted to TinSu's Electron desktop context:**

| Concept | ChatGPT Contribution | Gemini Contribution | TinSu Adaptation |
|---------|---------------------|---------------------|-------------------|
| Phase navigation | Phase tabs + Workflow Map launcher | Vertical stepper in sidebar | Phase tabs in planning workspace |
| Workflow execution | "Run" engine with wizard steps | "Dual-Pane" chat + live document | Guided run tracker (agents run in terminal via Epic 3) |
| Artifact management | Versioning, diffing, approval states | "Artifact Forge" with live editing | Artifact viewer with status badges + Monaco diff reuse |
| "What Next?" | BMad-Help recommender scanning artifacts | Progress ring + locked phases | "What Next?" panel scanning `_bmad-output/` |
| Validation | Gate capture (PASS/CONCERNS/FAIL) | Heatmap + resolution assistant | Readiness gate results panel with issue list |
| Agent presence | Not emphasized | Active agent avatar + persona colors | Agent badge on workspace header |
| Data model | Full entities (WorkflowRun, Artefact, etc.) | State tracking via YAML frontmatter | Lightweight: workflow_runs table + artifact_metadata |

---

## 2. Impact Analysis

### Epic Impact

**Epic 3 - BMAD Planning Workflow:** No changes. Remains as infrastructure layer (task types, agent launcher, artifact detection, story import).

**New Epic 9 - BMAD Planning Workspace:** 9 new stories providing the rich planning UI experience synthesized from research.

**Other Epics:** No impact on Epics 1-2, 5-8, or TES Epics.

### Story Impact
- No existing stories modified
- 9 new stories added under new Epic 9

### Artifact Conflicts
- **PRD:** No conflicts — FR28-FR30 remain valid. New features are additive.
- **Architecture:** No conflicts — leverages existing tRPC, Drizzle, Monaco infrastructure. Minor schema additions needed (workflow_runs, artifact_metadata tables).
- **UX Design:** No conflicts — current spec covers Kanban + task workspace. Planning workspace is a new view.
- **Project Context:** No changes needed.

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment — Add new Epic 9 alongside existing Epic 3

**Rationale:**
- Epic 3 provides essential infrastructure that the new epic depends on
- Research insights are additive, not contradictory to existing plans
- TinSu's Electron architecture already supports the needed components (Monaco, xterm.js, tRPC)
- Keeping Epic 3 separate ensures the planning foundation can ship independently
- New epic can be prioritized based on dog-fooding needs

**Effort Estimate:** Medium-High (new workspace UI + workflow tracking + recommender logic)
**Risk Level:** Low (additive, leverages existing infrastructure)
**Timeline Impact:** Adds ~9 stories to the backlog, but no disruption to current sprint

---

## 4. Detailed Change Proposals

### 4.1 New Epic 9: BMAD Planning Workspace

**Goal:** A dedicated planning workspace that guides founders through BMAD's Analysis → Planning → Solutioning phases with artifact management, guided workflow execution, and intelligent next-step recommendations.

**User Outcome:** "I can see exactly where I am in planning, what artifacts exist, what's next, and whether I'm ready for implementation."

**FRs covered:** New planning-specific FRs (additive to existing FR28-FR30)
**Dependencies:** Epic 3 (planning task types, agent launcher, artifact detection, story import), TES Epic 4 (Monaco diff viewer)

---

### Story 9.1: Planning Workspace Route & Navigation
**Task ID:** `9-1-planning-workspace-route-and-navigation`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want a dedicated planning workspace accessible from the main navigation,
So that I can focus on BMAD planning phases in a purpose-built environment.

**Acceptance Criteria:**

**Given** I am on the Kanban board
**When** I click the "Planning" button in the sidebar navigation
**Then** I navigate to a full-screen planning workspace route (/planning)
**And** the workspace displays 3 phase tabs: Analysis, Planning, Solutioning

**Given** I am in the planning workspace
**When** I select a phase tab (e.g., "Planning")
**Then** the left sidebar shows the workflows available for that phase
**And** each workflow entry shows: name, purpose, and expected output filename

**Given** I am in the planning workspace
**When** I view the center area
**Then** it shows the active workflow content or the phase progress dashboard

**Given** the workspace header
**When** I view it
**Then** it shows the project name and active agent indicator (if running)

**Given** I click a planning task card on the Kanban board
**When** the card is a planning-type task
**Then** I navigate to the planning workspace with the relevant phase tab selected

**Given** I am in the planning workspace
**When** I press Escape or click "Board" in navigation
**Then** I return to the Kanban board

**References:** ChatGPT report (Phase navigation), Gemini report (vertical stepper)

---

### Story 9.2: Phase Progress Dashboard
**Task ID:** `9-2-phase-progress-dashboard`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to see progress across all BMAD planning phases at a glance,
So that I know what's been completed, what's in progress, and what's missing.

**Acceptance Criteria:**

**Given** I open the planning workspace
**When** the dashboard loads
**Then** it shows all 3 phases with their artifact completion status
**And** each phase shows: workflows available, artifacts produced, status badges

**Given** an artifact exists in `_bmad-output/planning-artifacts/`
**When** the dashboard renders
**Then** the artifact shows a status badge: "Draft" (exists but not reviewed), "Approved" (manually marked), or the appropriate state

**Given** an artifact is missing
**When** the dashboard renders
**Then** the workflow shows a "Missing" tag with a dimmed appearance

**Given** a "Project Health" panel
**When** I view it
**Then** it shows a checklist: Product Brief, PRD, UX Spec (optional), Architecture, Epics & Stories, Readiness Gate
**And** each item shows a checkmark (exists) or "Missing" tag

**Given** a new project with no artifacts
**When** I view the dashboard
**Then** it shows: "No artifacts yet. Start with brainstorming or create a product brief."
**And** a prominent "Start Planning" button is visible

**Given** artifacts are created or modified on disk
**When** I return to the dashboard
**Then** the status reflects the current filesystem state

**References:** ChatGPT report (Project health panel), Gemini report (progress ring)

---

### Story 9.3: Artifact Viewer with Status Lifecycle
**Task ID:** `9-3-artifact-viewer-with-status-lifecycle`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to view planning artifacts (PRD, architecture, etc.) inside TinSu with section navigation,
So that I can review what BMAD agents produced without leaving the app.

**Acceptance Criteria:**

**Given** I click on an artifact in the planning workspace
**When** the artifact viewer opens
**Then** it renders the markdown content with proper formatting (headings, tables, code blocks)
**And** a section outline appears on the left for quick navigation

**Given** the artifact viewer is showing a document
**When** I click a heading in the section outline
**Then** the viewer scrolls to that section

**Given** the artifact has a status
**When** I view the artifact header
**Then** it shows a status badge: Draft, In Review, or Approved
**And** I can transition the status via a dropdown action

**Given** a completed planning task card is clicked on the Kanban board
**When** the task has a linked artifact
**Then** the artifact viewer opens showing that artifact

**Given** the artifact viewer
**When** I view the metadata bar
**Then** it shows: file path, last modified timestamp, word count, which workflow produced it

**Given** the artifact is displayed
**When** I view it
**Then** it is read-only (editing happens via BMAD agents in terminal)
**And** a "Edit with Agent" button links to the relevant planning task

**References:** ChatGPT report (Artefact editor + preview), Gemini report (Artifact Forge)

---

### Story 9.4: "What Next?" Recommender Engine
**Task ID:** `9-4-what-next-recommender-engine`

As a founder,
I want TinSu to tell me what BMAD planning step I should do next,
So that I follow the recommended workflow without memorizing the method.

**Acceptance Criteria:**

**Given** I am in the planning workspace
**When** the "What Next?" panel renders
**Then** it scans `_bmad-output/planning-artifacts/` for existing artifacts
**And** determines which workflows have been completed based on artifact presence

**Given** the scan is complete
**When** the panel displays
**Then** it shows a prominent "Next Recommended Step" card with:
- Workflow name (e.g., "Create PRD")
- Why it's recommended (e.g., "Product Brief is complete. PRD defines requirements before solutioning.")
- What it produces (e.g., "prd.md")
- A "Start" button that navigates to the relevant planning task

**Given** the BMAD phase ordering
**When** determining the next step
**Then** it respects: Product Brief → PRD → Architecture → UX Design (optional) → Epics & Stories → Readiness Gate
**And** UX Design is shown as "optional" with context

**Given** all planning artifacts exist
**When** the panel renders
**Then** it recommends "Run Implementation Readiness Check" as the final step

**Given** artifacts are created or modified on disk
**When** the workspace is visible
**Then** the recommendation updates in real-time via filesystem watching

**References:** ChatGPT report (BMad-Help-like recommender), Gemini report (progress gating)

---

### Story 9.5: Guided Workflow Run Tracker
**Task ID:** `9-5-guided-workflow-run-tracker`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to see the status and history of BMAD workflow executions,
So that I can track what agents have done and what they produced.

**Acceptance Criteria:**

**Given** a BMAD agent is running (spawned by Epic 3's agent launcher)
**When** I view the planning workspace
**Then** a "Run" panel shows: which workflow is running, which agent is active, input artifacts used, run status

**Given** run statuses
**When** displayed
**Then** they are one of: Running (animated), Needs Input (yellow), Succeeded (green), Failed (red), Cancelled (gray)

**Given** a workflow run completes
**When** the run tracker updates
**Then** it shows output files produced with links to the artifact viewer
**And** the run is recorded in the `workflow_runs` database table

**Given** the "Recent Runs" section
**When** I view it
**Then** it shows a table with columns: Workflow, Phase, Status, Started, Duration
**And** clicking a run shows its details (inputs, outputs, status)

**Given** the run tracker
**When** I want to view the agent's terminal
**Then** a "View Terminal" link navigates to the task detail workspace (connecting to Epic 3 + TES)

**Given** the database schema
**When** a workflow_runs table is created
**Then** it has columns: id, project_id, workflow_key, phase, status, started_at, finished_at, input_artifacts (JSON), output_artifacts (JSON), agent_name

**References:** ChatGPT report (WorkflowRun entity, Run/preview modal), Gemini report (run logging)

---

### Story 9.6: Readiness Gate Results Panel
**Task ID:** `9-6-readiness-gate-results-panel`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to see the results of the implementation readiness check in a clear visual format,
So that I know whether my planning artifacts are ready for implementation.

**Acceptance Criteria:**

**Given** the readiness gate has been run
**When** I view the results panel
**Then** it shows a large status badge: PASS (green), CONCERNS (yellow), or FAIL (red)

**Given** the gate result is CONCERNS or FAIL
**When** I view the issues list
**Then** each issue shows: severity (Critical/Major/Minor), description, and a link to the affected artifact section
**And** clicking an issue link opens the artifact viewer scrolled to that section

**Given** the gate result
**When** I want to re-check
**Then** a "Re-run Gate" button starts the readiness check workflow
**And** the previous result is preserved for comparison

**Given** a gate decision
**When** it is recorded
**Then** it persists: decision (PASS/CONCERNS/FAIL), rationale text, timestamp, and list of issues
**And** historical gate results are viewable

**Given** all planning is complete and gate passes
**When** I view the results panel
**Then** a prominent "Approve for Implementation" action is available
**And** activating it marks all planning artifacts as "Approved" and signals readiness

**Given** accessibility requirements
**When** the status badge renders
**Then** it uses color + icon + text (not color alone) for the PASS/CONCERNS/FAIL indicator

**References:** ChatGPT report (GateDecision entity), Gemini report (Implementation Launchpad)

---

### Story 9.7: Artifact Version Diff View
**Task ID:** `9-7-artifact-version-diff-view`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to compare versions of a planning artifact when it's been regenerated or updated,
So that I can see what changed and make informed approval decisions.

**Acceptance Criteria:**

**Given** an artifact has been updated (file content changed)
**When** I open the artifact viewer
**Then** a "Compare Versions" button is available

**Given** I click "Compare Versions"
**When** the diff view opens
**Then** it uses the Monaco diff viewer component (from TES Epic 4)
**And** shows side-by-side or unified diff format (toggle available)

**Given** the diff is displayed
**When** I review it
**Then** changes are highlighted with section-aware context (heading names visible)
**And** additions, deletions, and modifications are color-coded

**Given** version history
**When** I access it from the artifact viewer
**Then** I can see a list of versions with timestamps
**And** select any two versions to compare

**Given** Git is available
**When** computing versions
**Then** the system uses `git log` for the artifact file to derive version history
**And** `git diff` for computing differences

**References:** ChatGPT report (ArtefactVersion entity, diff features), TES Epic 4 (Monaco diff infrastructure)

---

### Story 9.8: Agent Persona Indicator
**Task ID:** `9-8-agent-persona-indicator`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to see which BMAD agent persona is currently active,
So that I know "who" is working on my planning artifacts.

**Acceptance Criteria:**

**Given** a BMAD agent is running in a planning workflow
**When** I view the planning workspace header
**Then** it shows the active agent: name and a distinct color badge
**And** the agent mapping is: Analyst (blue), PM (green), Architect (orange), UX Designer (purple)

**Given** the agent indicator
**When** I view it
**Then** it shows: agent name (e.g., "Analyst"), the workflow being executed (e.g., "Creating Product Brief")

**Given** workflows transition between agents
**When** the active agent changes (e.g., PRD → Architecture)
**Then** the indicator updates to show the new agent

**Given** no agent is running
**When** I view the workspace header
**Then** the indicator shows "No agent active" in a muted style

**Given** the agent indicator is also shown on planning task cards (from Story 3.3)
**When** I view a card in In Progress
**Then** the card shows the agent badge matching the workspace header

**References:** Gemini report (active agent avatars + persona colors)

---

### Story 9.9: Planning Workspace Keyboard Navigation
**Task ID:** `9-9-planning-workspace-keyboard-navigation`

As a founder,
I want keyboard shortcuts for the planning workspace,
So that I can navigate efficiently without using the mouse.

**Acceptance Criteria:**

**Given** I am in the planning workspace
**When** I press keyboard shortcuts
**Then** the following work:
- `1` / `2` / `3`: Jump to Analysis / Planning / Solutioning tab
- `N`: Focus "What Next?" panel
- `R`: Open Recent Runs
- `G`: Open Readiness Gate results
- `Escape`: Return to Kanban board

**Given** tab navigation
**When** I press Tab / Shift+Tab
**Then** focus cycles through: phase tabs → workflow list → center content → action buttons

**Given** accessibility requirements
**When** the workspace renders
**Then** ARIA roles are set: tablist for phase tabs, region for artifact list, status for announcements
**And** screen readers announce phase transitions and artifact status changes

**Given** existing TinSu keyboard patterns
**When** shortcuts are defined
**Then** they are consistent with task workspace shortcuts (no conflicts)
**And** a help overlay (?) shows available shortcuts

**References:** ChatGPT report (accessibility section), existing TinSu keyboard patterns

---

## 5. Implementation Handoff

### Change Scope: Minor

Changes can be implemented directly by development team. No disruption to current work.

### Deliverables
1. ✅ Sprint Change Proposal (this document)
2. ⏳ Updated epics.md with new Epic 9 and all 9 stories
3. ⏳ Updated sprint-status.yaml with new epic and stories (if exists)

### Sequencing
Epic 9 depends on Epic 3 being complete (planning task types, agent launcher, artifact detection).

**Recommended story order:**
1. **9.1** Route & Navigation (foundation)
2. **9.2** Phase Progress Dashboard (first useful screen)
3. **9.3** Artifact Viewer (core viewing capability)
4. **9.4** "What Next?" Recommender (intelligence layer)
5. **9.5** Workflow Run Tracker (execution visibility)
6. **9.8** Agent Persona Indicator (polish)
7. **9.6** Readiness Gate Panel (gate experience)
8. **9.7** Version Diff View (comparison capability)
9. **9.9** Keyboard Navigation (accessibility)

### Success Criteria
- Planning workspace accessible from main navigation
- All 3 phases navigable with artifact status visible
- "What Next?" correctly recommends next workflow based on filesystem scan
- Artifact viewer renders markdown with section outline
- Readiness gate shows PASS/CONCERNS/FAIL with actionable issue list
- Keyboard navigation covers all major actions

---

## Approval

**Approved by:** Tinsu
**Date:** 2026-03-21
**Mode:** Incremental review

---

*Generated by Correct Course workflow*
*Research inputs: docs/deep-research-report-chatgpt.md, docs/deep-research-report-gemini.md*
