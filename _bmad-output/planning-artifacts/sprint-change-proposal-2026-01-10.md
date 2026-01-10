# Sprint Change Proposal

**Date:** 2026-01-10
**Author:** John (PM Agent) with Tinxu
**Status:** APPROVED
**Change Scope:** Moderate

**Addendum (Post-Approval):**
- Story 5.1 reworked: "Execution Mode Configuration" → "Agent Model Configuration"
- Story 5.2 removed: "Sprint Planning Agent Step" → Not needed for MVP
- Story 5.14 removed: "Basic Claude Code Mode (Fallback)" → Covered by Story 5.3b

---

## 1. Issue Summary

### Problem Statement

Epic 5 (Story Implementation Workflow) was designed assuming all tasks follow a single execution path where stories are ready (or drafted by SM agent) when moved to "In Progress".

**The Reality:** There are **two distinct task types** with different workflows:

1. **Story Tasks** (BMAD-generated) – Require a "Create Story" phase to generate full story content via `/bmad:bmm:workflows:create-story` before execution with `/bmad:bmm:workflows:dev-story`

2. **Basic Tasks** (manually created) – Execute directly with their description/prompt, no BMAD workflow needed

### Discovery Context

- Discovered during pre-implementation planning for Epic 5
- Story summaries in `epics.md` are just summaries, not executable content
- Full story content must be created and stored in `implementation-artifacts/`
- The current 4-column Kanban lacks the intermediate "Create Story" column

### Evidence

- `/bmad:bmm:workflows:dev-story` expects a full story file to execute against
- `/bmad:bmm:workflows:create-story` is the proper command to generate full stories
- Basic Tasks don't use BMAD workflows at all

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact Level | Details |
|------|--------------|---------|
| **Epic 5** | Moderate | Goal updated, Stories 5.3/5.4 reworked, 3 new stories added |
| **Epic 2** | None | Story 2.1 already implemented; new column added via Epic 5 |
| **Epic 6-8** | None | No changes required |

### Artifact Impact

| Artifact | Impact Level | Changes |
|----------|--------------|---------|
| **PRD** | Minor | FR1 updated (4 → 5 columns) |
| **Architecture** | Minor | 1 reference updated |
| **UX Spec** | Minor | 7 references updated |
| **Epics** | Moderate | Epic 5 goal + 5 story changes |
| **Database Schema** | Minor | Add `task_type`, `story_file_status`, `story_file_path` columns |

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment

**Rationale:**
- Pre-implementation timing – all changes are document-only
- Low effort, low risk
- No code to refactor, no regressions possible
- Better workflow design before building

**Why Not Other Options:**
- **Rollback:** Nothing to roll back (Epic 5 not implemented)
- **MVP Review:** MVP still achievable, just needs refinement

---

## 4. Detailed Change Proposals

### 4.1 Epic 5 Changes

#### Epic 5 Goal (Updated)

**From:** "Story Implementation Workflow" with single execution path

**To:** "Task Execution Workflow" with two distinct paths:
1. Story Tasks: Backlog → Create Story → In Progress → Review → Done
2. Basic Tasks: Backlog → In Progress → Review → Done

---

#### Story 5.2b: Add "Create Story" Column to Kanban Board (NEW)

```markdown
As a founder,
I want a "Create Story" column between Backlog and In Progress,
So that Story Tasks have a dedicated phase for full story file generation.

Acceptance Criteria:
- 5-column board: Backlog → Create Story → In Progress → Review → Done
- Column header with tooltip explaining purpose
- Database status enum includes 'create_story'
```

---

#### Story 5.2c: Task Type and Story File Status Handling (NEW)

```markdown
As a founder,
I want tasks classified by type and Story Tasks to show story file status,
So that I know which tasks need story creation and which are ready for development.

Acceptance Criteria:
- task_type: 'story_task' | 'basic_task'
- story_file_status: 'summary_only' | 'story_ready' (Story Tasks only)
- Visual indicators on cards
- Drag behavior enforced based on type and status
```

---

#### Story 5.3: Story Task Execution Path (REWORKED)

```markdown
As a founder,
I want Story Tasks to go through a "Create Story" phase before development,
So that full story content is generated and reviewed before implementation.

Acceptance Criteria:
- Drag to "Create Story" triggers /bmad:bmm:workflows:create-story
- Story file saved to implementation-artifacts/
- Card shows "Story Ready" when complete
- Drag to "In Progress" triggers /bmad:bmm:workflows:dev-story
```

---

#### Story 5.3b: Basic Task Execution Path (NEW)

```markdown
As a founder,
I want Basic Tasks to execute directly when moved to In Progress,
So that manually-created tasks run without BMAD workflow overhead.

Acceptance Criteria:
- Drag directly from Backlog to In Progress
- Claude Code spawns with task description as prompt
- "Create Story" column is not a valid destination
```

---

#### Story 5.4: SM Agent: Draft Story File (REMOVED)

**Reason:** Merged into Story 5.3. Story creation now happens in "Create Story" column via `/bmad:bmm:workflows:create-story`, eliminating the need for a separate SM draft step inside "In Progress".

---

### 4.2 PRD Changes

| Location | Change |
|----------|--------|
| FR1 | "four columns" → "five columns (Backlog, Create Story, In Progress, Review, Done)" |

---

### 4.3 Architecture Changes

| Location | Change |
|----------|--------|
| Line 558 | KanbanBoard.tsx comment: "4-column" → "5-column" |

---

### 4.4 UX Spec Changes

| Line | Change |
|------|--------|
| 544 | "Classic 4-column Kanban" → "Classic 5-column Kanban" |
| 554 | "4 equal-width columns" → "5 equal-width columns" |
| 566 | "4-column Kanban" → "5-column Kanban" |
| 852 | "4 columns: Backlog..." → "5 columns: Backlog, Create Story..." |
| 1189 | "4-column board" → "5-column board" |
| 1195 | "4 equal-width columns" → "5 equal-width columns" |
| 1217 | "Full 4-column" → "Full 5-column" |

---

### 4.5 Database Schema Changes

```sql
-- Add to tasks table
task_type ENUM('story_task', 'basic_task') DEFAULT 'basic_task'
story_file_status ENUM('summary_only', 'story_ready') NULL
story_file_path VARCHAR(500) NULL

-- Update status enum
status ENUM('backlog', 'create_story', 'in_progress', 'review', 'done')
```

---

## 5. Implementation Handoff

### Change Scope Classification: **Moderate**

Requires document updates and new stories, but no fundamental replan.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| **PM (You)** | Apply document edits to PRD, Architecture, UX Spec |
| **Dev Team** | Implement Epic 5 stories with new workflow |
| **Architect** | Review schema changes before implementation |

### Implementation Sequence

1. Apply all document edits (PRD, Architecture, UX Spec, Epics)
2. Update database schema (add columns, update enum)
3. Implement Story 5.2b (Create Story column)
4. Implement Story 5.2c (task type handling)
5. Implement Story 5.3 (Story Task path)
6. Implement Story 5.3b (Basic Task path)
7. Continue with remaining Epic 5 stories

### Success Criteria

- [ ] All document edits applied
- [ ] Database schema updated
- [ ] Story Tasks flow: Backlog → Create Story → In Progress → Review → Done
- [ ] Basic Tasks flow: Backlog → In Progress → Review → Done
- [ ] Visual indicators show task type and story file status
- [ ] Drag behavior enforced based on task type

---

## 6. Approval

**Proposed by:** John (PM Agent)
**Reviewed with:** Tinxu
**Date:** 2026-01-10

- [x] **Approved** – Proceed with implementation
- [ ] **Rejected** – Requires revision
- [ ] **Deferred** – Postpone to future sprint

**Approved by:** Tinxu
**Approval Date:** 2026-01-10
**All document edits applied:** Yes

---

*Generated via BMAD Correct Course Workflow*
