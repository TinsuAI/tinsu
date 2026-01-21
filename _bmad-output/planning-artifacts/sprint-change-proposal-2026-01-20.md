# Sprint Change Proposal: Task Workspace Layout Redesign

**Date:** 2026-01-20
**Triggered By:** Story `tes-3-2-quad-pane-layout` implementation feedback
**Author:** John (PM Agent)
**Status:** Pending Approval

---

## Section 1: Issue Summary

### Problem Statement

The implemented quad-pane layout (2x2 grid) in a 60-70% slide-in panel is too cramped for effective task execution workspace usage. Specifically:

- **Content section** needs full visibility for reading/editing story details and acceptance criteria
- **Diff section** needs more horizontal space for effective side-by-side code review
- Four equal-sized panes don't reflect the actual importance hierarchy of different task functions

### Discovery Context

- Discovered during implementation of Story 3.2 (Quad-Pane Layout)
- User feedback after seeing the implemented quad-pane: "4 panes look smaller, especially the content section"
- Additional finding: Stories 3.4, 3.5, 3.6 were already implemented during earlier work

### Evidence

- Content editing requires careful reading — cramped quarter-panel reduces comprehension
- Code review is a critical approval gate — inadequate diff space slows review velocity
- Terminal and Activities serve monitoring functions and can share space effectively

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| Epic 1: Per-Task Terminal Sessions | None | No changes needed |
| Epic 2: Activity Log & Event Tracking | None | No changes needed |
| **Epic 3: Quad-Pane Task Workspace** | **Modified** | Renamed and restructured |
| Epic 4: Git Diff Viewer | Positive | More space for diff review |
| Epic 5: Workflow Automation Engine | None | No changes needed |

### Story Impact

| Story | Change | Status |
|-------|--------|--------|
| 3.1 Task Detail Panel Container | **Updated** | Slide panel → Full-screen route |
| 3.2 Quad-Pane Layout | **Updated** | Quad-pane → 3-column resizable |
| 3.3 Section Expand/Collapse | No change | Still applicable |
| 3.4 Terminal Section Integration | **Mark Complete** | Already implemented |
| 3.5 Activities Section Integration | **Mark Complete** | Already implemented |
| 3.6 Content Section Display | **Mark Complete** | Already implemented |
| 3.7-3.13 | No change | Visual polish, accessibility |

### Artifact Conflicts

| Artifact | Section | Change Needed |
|----------|---------|---------------|
| PRD | FR21 | Update layout description |
| Architecture | None | No conflicts |
| UX Design | 4-Tab Interface section | Update to 3-column workspace |
| Epics | Epic 3 summary | Update title and description |

### Technical Impact

- **Code changes:** Layout components only (QuadPaneLayout.tsx → ThreeColumnLayout.tsx)
- **No backend changes:** All services remain unchanged
- **New feature:** Resizable columns with localStorage persistence

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

Modify existing stories within the current epic structure. No rollback or MVP scope change needed.

### Rationale

1. Individual sections (Terminal, Activities, Content) are already working well
2. Only the container layout needs adjustment
3. Low effort, low risk change
4. Improves UX without adding scope
5. Aligns with user workflow (Content reading, Diff reviewing need more space)

### Effort & Risk Assessment

| Factor | Assessment |
|--------|------------|
| Effort | **Low** — Layout component refactor only |
| Risk | **Low** — No backend changes, no data model changes |
| Timeline Impact | **Minimal** — ~1-2 story points of rework |

---

## Section 4: Detailed Change Proposals

### 4.1 Story 3.1: Navigation Change

**Story:** `tes-3-1-task-detail-panel-container`

**OLD Acceptance Criteria:**
```
Given the user is viewing the Kanban board
When the user clicks on a task card
Then a detail panel slides in from the right
And the panel width is 60-70% of viewport on desktop
And the board remains partially visible behind
```

**NEW Acceptance Criteria:**
```
Given the user is viewing the Kanban board
When the user clicks on a task card
Then the app navigates to a full-screen task workspace (route: /task/{taskId})
And a back button is visible in the header to return to the board

Given the user is in the task workspace
When the user clicks the back button or presses Escape
Then the app navigates back to the Kanban board
And the previously selected task card is scrolled into view
```

---

### 4.2 Story 3.2: Layout Change

**Story:** `tes-3-2-quad-pane-layout` → `tes-3-2-three-column-task-workspace`

**NEW Title:** Three-Column Task Workspace

**NEW User Story:**
```
As a user,
I want a full-screen task workspace with resizable columns for Content, Execution, and Diff,
So that I can customize my workspace layout based on my current focus.
```

**NEW Acceptance Criteria:**
```
Given the user navigates to a task workspace
When the layout renders on desktop
Then three columns are displayed with default widths:
  - Column 1 (left, default ~30%): Content Editor (WYSIWYG) - full height
  - Column 2 (center, default ~25%): Terminal (top) + Activities (bottom) - vertically stacked
  - Column 3 (right, default ~45%): Git Diff Viewer - full height for code review

Given the columns are displayed
When the user hovers between two columns
Then a resize handle (vertical divider) appears
And the cursor changes to col-resize

Given the user drags a resize handle
When dragging left or right
Then the adjacent columns resize proportionally in real-time
And minimum column width is enforced (150px) to prevent collapse

Given the user releases the resize handle
When the drag ends
Then the new column widths are persisted to localStorage
And restored on next visit to any task workspace

Given the Terminal/Activities column (column 2)
When displayed
Then a horizontal resize handle exists between Terminal and Activities
And the user can adjust the vertical split ratio (default 60% Terminal / 40% Activities)

Given each section in the workspace
When displayed
Then each section has a header with section name and icon
And each section has an expand-to-full button in the header

Given the user clicks an expand button on any section
When the section expands
Then that section fills the entire workspace
And a collapse button allows returning to 3-column view
And column proportions are preserved when returning
```

**Layout Diagram:**
```
┌─────────────────┬────────────────┬──────────────────────┐
│                 │   TERMINAL     │                      │
│    CONTENT      │       ↕        │      GIT DIFF        │
│    EDITOR    ←→ ├────────────────┤ ←→                   │
│   (WYSIWYG)     │  ACTIVITIES    │   (Code Review)      │
│                 │                │                      │
└─────────────────┴────────────────┴──────────────────────┘
        ←→ = horizontal resize handle
         ↕ = vertical resize handle
```

---

### 4.3 Stories 3.4, 3.5, 3.6: Mark Complete

**Status Change:** Mark as COMPLETE

| Story | Note |
|-------|------|
| 3.4 Terminal Section Integration | Implemented in TaskTerminal.tsx, XTerminal.tsx |
| 3.5 Activities Section Integration | Implemented in ActivitiesTab.tsx, ActivityItem.tsx |
| 3.6 Content Section Display | Implemented in TaskDetailContent.tsx, MarkdownComponents.tsx |

---

### 4.4 PRD Update

**Document:** `prd-task-execution-sandbox.md`
**Section:** FR21

**OLD:**
```
FR21: User can view task details with all 4 sections visible simultaneously
on large screens (Terminal, Activities, Diff, Content in a quad-pane layout)
```

**NEW:**
```
FR21: User can view task details in a full-screen 3-column workspace with
resizable columns (Content, Terminal+Activities, Diff) optimized for editing,
monitoring, and code review
```

---

### 4.5 UX Design Update

**Document:** `ux-design-specification.md`
**Section:** Task Execution Sandbox UX

Update "The 4-Tab Task Detail Interface" section to "The 3-Column Task Workspace" with:
- Full-screen route navigation
- 3-column layout with resize handles
- Column specifications and default widths
- Layout diagram

---

### 4.6 Epic 3 Summary Update

**Document:** `epics-task-execution-sandbox.md`

**OLD:**
```
Epic 3: Quad-Pane Task Workspace
User Outcome: "I have complete visibility of every task in one view"
```

**NEW:**
```
Epic 3: Three-Column Task Workspace
User Outcome: "I have a customizable workspace that gives each task function the space it needs"

Implementation Notes:
- Stories 3.4, 3.5, 3.6 completed during earlier implementation
- Story 3.1 updated: slide panel → full-screen route
- Story 3.2 updated: quad-pane → 3-column resizable layout
```

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Scope: Minor**

This change can be implemented directly by the development team without backlog reorganization or strategic replan.

### Handoff Recipients

| Role | Responsibility |
|------|----------------|
| **Dev Agent** | Implement 3-column layout component, resize handles, localStorage persistence |
| **PM (self)** | Update planning artifacts (PRD, UX, Epics) after approval |

### Implementation Tasks

1. Create `ThreeColumnWorkspace.tsx` component with resizable panels
2. Update routing to use full-screen route `/task/{taskId}`
3. Add resize handle components with drag behavior
4. Implement localStorage persistence for column widths
5. Update `TaskDetailContent.tsx` to use new layout
6. Remove or deprecate `QuadPaneLayout.tsx`

### Success Criteria

- [ ] Full-screen workspace loads on task click
- [ ] All three columns render with correct default widths
- [ ] Resize handles work smoothly (no jank)
- [ ] Column widths persist across sessions
- [ ] Expand/collapse works for each section
- [ ] Back button returns to board with correct scroll position

---

## Approval

**Do you approve this Sprint Change Proposal for implementation?**

- [ ] Yes - Proceed with implementation
- [ ] No - Requires revision
- [ ] Revise - Specific changes needed

---

*Generated by Correct Course Workflow*
*PM Agent: John*
