# Sprint Change Proposal - Epic 7 & 8 Alignment

**Date:** 2026-01-21
**Initiated by:** tinsu
**Status:** Approved

---

## 1. Issue Summary

### Problem Statement
Epic 7 (Review & Approval Workflow) contains stories that overlap with already-implemented TES (Task Execution Sandbox) epics. Additionally, Epic 8 (Git Integration) needs enhancements for:
1. Worktree timing based on task type (Story vs Basic)
2. Commit SHA persistence for historical diff viewing
3. Gitignore for worktrees folder

### Context
- TES Epics 1-4 implemented a 3-column full-screen task workspace with integrated diff viewer
- This supersedes Epic 7's original slide-over panel approach
- Epic 8 has not started yet, making it ideal timing for enhancement

### Evidence
| Epic 7 Story | TES Overlap | TES Status |
|--------------|-------------|------------|
| 7-1: Review Panel Slide-over | TES 3-1/3-2: Full-screen workspace | ✅ Done |
| 7-2: Monaco Diff Viewer | TES 4-4: Monaco Diff Viewer | ✅ Done |
| 7-8: Keyboard Navigation | TES 3-11: Keyboard Navigation | Deferred |
| 7-9: Review Notifications | TES 5-7: Code-Review Notification | Backlog |

---

## 2. Impact Analysis

### Epic Impact

**Epic 7 - Review & Approval Workflow:**
- 4 stories superseded by TES implementation
- 5 stories remain for core approve/reject functionality

**Epic 8 - Git Integration:**
- 1 story modified (8-2: worktree timing)
- 1 story enhanced (8-5: commit SHA)
- 1 new story added (8-11: historical diff)
- 1 AC added to existing story (8-1: gitignore)

### Artifact Conflicts
- **PRD:** No conflicts - all FRs remain valid
- **Architecture:** No conflicts - worktree paths already defined
- **sprint-status.yaml:** Requires updates for superseded stories

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment

**Rationale:**
- Epic 7 & 8 are in backlog - no disruption to in-progress work
- TES implementation is superior (full-screen vs slide-over)
- Changes are additive, not breaking
- Low effort, low risk

**Effort Estimate:** Low
**Risk Level:** Low
**Timeline Impact:** None (enhances future work)

---

## 4. Detailed Change Proposals

### 4.1 Epic 7 - Superseded Stories

Mark the following stories as `superseded` in sprint-status.yaml:

| Story | Superseded By | Rationale |
|-------|---------------|-----------|
| 7-1-review-panel-slide-over | TES 3-1/3-2 | Full-screen workspace replaces slide-over |
| 7-2-monaco-diff-viewer-integration | TES 4-1 through 4-6 | Complete diff viewer implemented |
| 7-8-keyboard-first-review-navigation | TES 3-11 | Keyboard navigation in workspace |
| 7-9-review-notifications | TES 5-7 | Code-review notifications |

**Epic 7 Remaining Stories (unchanged):**
- 7-3: Approve Changes Action
- 7-4: Reject Changes with Feedback
- 7-5: Request Changes with Inline Comments
- 7-6: Agent Re-execution with Feedback Context
- 7-7: Review History & Comparison

### 4.2 Story 8-1: Add Gitignore AC

**NEW Acceptance Criteria:**

```markdown
**Given** GitService initializes for a project
**When** the .tinsu/ folder exists
**Then** `.tinsu/worktrees/` is added to .gitignore if not already present
**And** this happens before any worktree operations
```

### 4.3 Story 8-2: Worktree Creation by Task Type

**REPLACE existing AC with:**

```markdown
**Given** a Story Task is dragged to "Create Story" column
**When** the drop completes
**Then** GitService creates a new worktree
**And** the worktree is located at .tinsu/worktrees/{task-id}/
**And** the agent executes in this worktree for story creation

**Given** a Basic Task is dragged to "In Progress" column
**When** the drop completes
**Then** GitService creates a new worktree
**And** the worktree is located at .tinsu/worktrees/{task-id}/
**And** the agent executes in this worktree for direct execution

**Given** a Story Task with existing worktree is dragged from "Create Story" to "In Progress"
**When** the drop completes
**Then** the existing worktree is reused
**And** no new worktree is created
```

### 4.4 Story 8-5: Commit SHA Persistence

**ADD to existing AC:**

```markdown
**Given** the merge succeeds
**When** it completes
**Then** main branch contains all changes from the worktree
**And** the merge is a fast-forward if possible, otherwise merge commit
**And** the resulting commit SHA is saved to the task record (merge_commit_sha)
**And** the original branch name is saved to the task record (branch_name)

**Given** a task has merge_commit_sha stored
**When** I view the task detail (even after Done)
**Then** I can view the historical diff for that commit
**And** the diff shows exactly what this task changed
```

**Schema Addition (tasks table):**
- `merge_commit_sha`: TEXT nullable
- `branch_name`: TEXT nullable

### 4.5 NEW Story 8-11: Historical Diff View

```markdown
### Story 8.11: Historical Diff View for Completed Tasks

As a founder,
I want to view the git diff for completed tasks,
So that I can review what changes a task made even after it's done.

**Acceptance Criteria:**

**Given** a task in Done status with merge_commit_sha stored
**When** I open the task detail view
**Then** the Diff section displays the historical diff for that commit
**And** the diff shows all files changed by that task

**Given** a completed task's diff is displayed
**When** I view it
**Then** it uses the same Monaco diff viewer as in-progress tasks (TES 4-4)
**And** file tree, summary bar, and unified/split toggle work identically

**Given** a task in Done status
**When** merge_commit_sha is null (legacy task or worktree skipped)
**Then** the Diff section shows "No diff available for this task"
**And** a tooltip explains why

**Given** I want to see the exact commit
**When** I view the diff header
**Then** the commit SHA is displayed (truncated, copyable)
**And** the original branch name is shown for reference

**Given** I want to compare with current main
**When** I click "Compare with current"
**Then** a diff shows changes between task's commit and current HEAD
**And** this helps identify if the task's changes were later modified
```

**Dependencies:** Story 8-5, TES Epic 4

---

## 5. Implementation Handoff

### Change Scope: Minor

Changes can be implemented directly by development team.

### Deliverables
1. ✅ Sprint Change Proposal (this document)
2. ⏳ Updated epics.md with Story 8-2, 8-5 changes and new Story 8-11
3. ⏳ Updated sprint-status.yaml with superseded stories and new story

### Success Criteria
- Epic 7 stories 7-1, 7-2, 7-8, 7-9 marked superseded
- Epic 8 stories updated per proposals
- New Story 8-11 added to epics.md and sprint-status.yaml
- Dev team can start Epic 8 with clear requirements

---

## Approval

**Approved by:** tinsu
**Date:** 2026-01-21
**Mode:** Incremental review

---

*Generated by Correct Course workflow*
