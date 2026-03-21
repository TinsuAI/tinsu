# Story 9.9: Planning Workspace Keyboard Navigation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want keyboard shortcuts for the planning workspace,
So that I can navigate efficiently without using the mouse.

## Acceptance Criteria

1. **Given** I'm in the planning workspace **When** I press `1`, `2`, or `3` **Then** the phase tab switches to Analysis, Planning, or Solutioning respectively **And** the shortcut only fires when no INPUT/TEXTAREA/contenteditable element is focused

2. **Given** I'm in the planning workspace **When** I press `N` **Then** focus moves to the "What Next?" panel **And** it scrolls into view if needed

3. **Given** I'm in the planning workspace **When** I press `R` **Then** the Recent Runs table opens/focuses

4. **Given** I'm in the planning workspace **When** I press `G` **Then** the Readiness Gate results panel opens/focuses

5. **Given** I'm in the planning workspace **When** I press `Escape` **Then** the workspace closes and returns to the Kanban board (ALREADY IMPLEMENTED — verify no regression)

6. **Given** I'm in the planning workspace **When** I press `Tab`/`Shift+Tab` **Then** focus cycles through: phase tabs → workflow list → center content → action buttons (FOCUS TRAP ALREADY IMPLEMENTED — verify correct tab order)

7. **Given** the planning workspace **When** rendered **Then** ARIA roles are set: `role="tablist"` on phase tabs (Radix handles this), `aria-label` regions for workflow list/center content/action areas, `role="status"` for live announcements on phase transitions and artifact status changes

8. **Given** I'm in the planning workspace **When** I press `?` **Then** a keyboard shortcuts help overlay appears listing all available shortcuts **And** pressing `?` again or `Escape` dismisses it

9. **Given** the planning workspace shortcuts **When** compared with task workspace shortcuts **Then** there are no conflicts (task workspace uses: `A`=Approve, `R`=Reject, `C`=Changes, `/`=terminal, `Cmd+S`=save, `Cmd+E`=edit, `1-4`=mobile tabs)

## Tasks / Subtasks

- [x] Task 1: Create `usePlanningKeyboardShortcuts` hook (AC: 1, 2, 3, 4, 9)
  - [x] 1.1 Create `src/renderer/src/hooks/usePlanningKeyboardShortcuts.ts`
  - [x] 1.2 Accept callback props for each shortcut action:
    ```typescript
    interface PlanningKeyboardShortcutCallbacks {
      onPhaseChange: (phase: PlanningPhase) => void
      onFocusWhatNext: () => void
      onFocusRecentRuns: () => void
      onFocusReadinessGate: () => void
      onToggleHelp: () => void
    }
    ```
  - [x] 1.3 Register a single `keydown` event listener on the workspace container ref (NOT `document`) — this ensures shortcuts only fire when the planning workspace is mounted and focused
  - [x] 1.4 Guard: skip all shortcut handling if `event.target` is an INPUT, TEXTAREA, or has `contenteditable="true"`, or is inside a Monaco editor (`[class*="monaco-"]`). Reuse the same guard pattern from `PlanningWorkspacePage.tsx` lines 136-142
  - [x] 1.5 Key mappings (case-insensitive, ignore when Cmd/Ctrl/Alt modifiers are held):
    - `1` → `onPhaseChange('analysis')`
    - `2` → `onPhaseChange('planning')`
    - `3` → `onPhaseChange('solutioning')`
    - `N` → `onFocusWhatNext()`
    - `R` → `onFocusRecentRuns()`
    - `G` → `onFocusReadinessGate()`
    - `?` (Shift+/) → `onToggleHelp()`
  - [x] 1.6 Call `event.preventDefault()` for matched shortcuts to prevent browser defaults
  - [x] 1.7 Use `useEffect` with cleanup to add/remove the event listener. Depend on the container ref and callback props
  - [x] 1.8 NO conflict with task workspace: task workspace is never mounted simultaneously (they are different full-screen routes). Number keys `1-3` are safe because task workspace uses `1-4` on mobile layout only via different page

- [x] Task 2: Create `KeyboardShortcutsOverlay` component (AC: 8)
  - [x] 2.1 Create `src/renderer/src/components/planning/KeyboardShortcutsOverlay.tsx`
  - [x] 2.2 Props:
    ```typescript
    interface KeyboardShortcutsOverlayProps {
      isOpen: boolean
      onClose: () => void
    }
    ```
  - [x] 2.3 Render a centered modal overlay (backdrop `bg-black/50`, panel `bg-popover`) showing all shortcuts in a grid:
    ```
    Keyboard Shortcuts
    ─────────────────────────────
    Phase Navigation
      1          Analysis
      2          Planning
      3          Solutioning

    Panels
      N          What Next?
      R          Recent Runs
      G          Readiness Gate

    General
      ?          Toggle this help
      Esc        Close workspace
      Tab        Cycle focus
    ```
  - [x] 2.4 Use `<kbd>` elements styled with `rounded bg-muted px-1.5 py-0.5 font-mono text-xs` — same pattern as `TaskDetailContent.tsx` (lines 661-692)
  - [x] 2.5 Close on `Escape` key or click outside (use `onKeyDown` on the overlay div)
  - [x] 2.6 Add `data-testid="keyboard-shortcuts-overlay"` on the container
  - [x] 2.7 Use semantic HTML: `<dialog>` or `role="dialog"` with `aria-label="Keyboard shortcuts"`
  - [x] 2.8 Auto-focus the close button when opened for keyboard accessibility

- [x] Task 3: Create `?` trigger button in workspace header (AC: 8)
  - [x] 3.1 Modify `src/renderer/src/pages/PlanningWorkspacePage.tsx`
  - [x] 3.2 Add a small ghost button with `Keyboard` icon (from lucide-react) in the header bar, between the agent persona indicator and the close button area
  - [x] 3.3 Use the same `Tooltip` pattern from `TaskDetailContent.tsx`:
    ```tsx
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowShortcutsHelp(true)}>
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Keyboard shortcuts (?)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    ```
  - [x] 3.4 Add `showShortcutsHelp` local state (`useState<boolean>(false)`)
  - [x] 3.5 Render `<KeyboardShortcutsOverlay isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />`

- [x] Task 4: Integrate keyboard shortcuts into PlanningWorkspacePage (AC: 1, 2, 3, 4)
  - [x] 4.1 Modify `src/renderer/src/pages/PlanningWorkspacePage.tsx`
  - [x] 4.2 Import and call `usePlanningKeyboardShortcuts` hook with the workspace container ref and callbacks
  - [x] 4.3 WhatNextPanel and RecentRunsTable wrapped with focusable divs (data-testid + tabIndex={-1}) in PhaseProgressDashboard
  - [x] 4.4 WhatNextPanel section wrapped with `<div data-testid="what-next-section" tabIndex={-1}>` to make it focusable
  - [x] 4.5 RecentRunsTable section wrapped with `<div data-testid="recent-runs-section" tabIndex={-1}>` to make it focusable
  - [x] 4.6 For `G` (Readiness Gate): switch to solutioning phase and select the readiness gate workflow (`readiness-check` key)
  - [x] 4.7 IMPORTANT: The existing `Escape` handler and focus trap remain unchanged. The new hook adds shortcuts alongside them

- [x] Task 5: Add ARIA landmark roles and live regions (AC: 7)
  - [x] 5.1 Modify `src/renderer/src/pages/PlanningWorkspacePage.tsx`
  - [x] 5.2 Add `aria-label="Planning workspace"` to the root container div
  - [x] 5.3 Add `aria-label="Phase navigation"` to the `TabsList` wrapper (Radix already provides `role="tablist"` automatically)
  - [x] 5.4 Add `aria-label="Workflow list"` and `role="navigation"` to the left sidebar workflow list container
  - [x] 5.5 Add `aria-label="Workspace content"` and `role="main"` to the center content area
  - [x] 5.6 Create a visually hidden live region for phase transition announcements:
    ```tsx
    <div role="status" aria-live="polite" className="sr-only" data-testid="phase-announcer">
      {phaseAnnouncement}
    </div>
    ```
  - [x] 5.7 Update `phaseAnnouncement` state when `activePhase` changes: `"Switched to {phase} phase"`. Use a `useEffect` that watches `activePhase` and sets the announcement text. Clear it after 1 second to prevent stale announcements
  - [x] 5.8 Also announce artifact status changes when the viewer loads a new artifact: `"{artifact name} - {status}"` via the same live region

- [x] Task 6: Write tests (AC: 1-9)
  - [x] 6.1 Create `src/renderer/src/hooks/usePlanningKeyboardShortcuts.test.ts`:
    - Test: `1` key triggers onPhaseChange('analysis')
    - Test: `2` key triggers onPhaseChange('planning')
    - Test: `3` key triggers onPhaseChange('solutioning')
    - Test: `N` key triggers onFocusWhatNext
    - Test: `R` key triggers onFocusRecentRuns
    - Test: `G` key triggers onFocusReadinessGate
    - Test: `?` key triggers onToggleHelp
    - Test: shortcuts do NOT fire when target is INPUT element
    - Test: shortcuts do NOT fire when target is TEXTAREA element
    - Test: shortcuts do NOT fire when Ctrl/Cmd modifier is held
    - Test: shortcuts are case-insensitive (both `n` and `N` work)
  - [x] 6.2 Create `src/renderer/src/components/planning/KeyboardShortcutsOverlay.test.tsx`:
    - Test: renders all shortcut descriptions when isOpen=true
    - Test: does not render when isOpen=false
    - Test: calls onClose when Escape pressed
    - Test: calls onClose when clicking outside
    - Test: displays correct key labels (1, 2, 3, N, R, G, ?, Esc, Tab)
    - Test: has role="dialog" and aria-label
  - [x] 6.3 Extend `src/renderer/src/pages/PlanningWorkspacePage.test.tsx`:
    - Test: pressing `1` switches to Analysis phase
    - Test: pressing `2` switches to Planning phase
    - Test: pressing `3` switches to Solutioning phase
    - Test: pressing `?` shows keyboard shortcuts overlay
    - Test: keyboard shortcut button visible in header
    - Test: ARIA labels present on workspace container, tab list, sidebar, content area
    - Test: live region exists with role="status"
    - Test: shortcuts don't fire when focused on input elements

## Dev Notes

### Architecture: Hook-Based Keyboard Shortcut Pattern (CRITICAL)

Extract keyboard shortcut logic into a custom hook rather than adding inline keydown handlers to PlanningWorkspacePage. Reasons:

1. **Testability**: Hook can be tested independently with renderHook
2. **Separation of concerns**: Keyboard logic separated from rendering
3. **Reusability**: Pattern can be adapted for other workspaces
4. **Existing pattern**: The existing Escape and Tab handlers in PlanningWorkspacePage are inline — this story's shortcuts go in a hook to keep the page component manageable

### Input Element Guard Pattern (CRITICAL — Reuse Existing)

PlanningWorkspacePage lines 136-142 already implement the guard:
```typescript
const target = event.target as HTMLElement
const tagName = target.tagName.toLowerCase()
if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return
// Also check for Monaco editor
if (target.closest('[class*="monaco-"]')) return
```

The `usePlanningKeyboardShortcuts` hook MUST replicate this exact guard. Also ignore when Cmd/Ctrl/Alt modifiers are pressed (`event.metaKey || event.ctrlKey || event.altKey`).

### Shortcut Conflict Analysis (CRITICAL — No Conflicts)

Task workspace shortcuts (TaskDetailContent.tsx): `A`, `R`, `C`, `/`, `Cmd+S`, `Cmd+E`, `1-4` (mobile)
Planning workspace shortcuts: `1`, `2`, `3`, `N`, `R`, `G`, `?`, `Escape`, `Tab`

**Overlap on `R`**: Task workspace uses `R` for "Reject" and planning uses `R` for "Recent Runs". This is **NOT a conflict** because:
- Task workspace and planning workspace are never mounted simultaneously
- They are different full-screen views (PlanningWorkspacePage vs TaskWorkspacePage)
- User can only be in one at a time

**Overlap on `1`, `2`, `3`**: Task workspace uses `1-4` for mobile tab switching. Same analysis — not a conflict.

### Existing Escape and Focus Trap (DO NOT MODIFY)

PlanningWorkspacePage already has:
- **Escape handler** (lines 134-153): Closes workspace, navigates back to board
- **Focus trap** (lines 165-191): Tab/Shift+Tab cycles within workspace

These are registered via `useEffect` on `document`. The new `usePlanningKeyboardShortcuts` hook should register on the **workspace container ref** (more specific). Both can coexist. DO NOT remove or modify the existing handlers.

### Panel Focus Strategy for N/R/G Shortcuts

The `N`, `R`, and `G` shortcuts need different strategies:

- **`N` (What Next?)**: The WhatNextPanel is rendered inside PhaseProgressDashboard when no workflow is selected. Strategy: clear selected workflow (shows dashboard), then scroll to and focus the WhatNextPanel container.
- **`R` (Recent Runs)**: The RecentRunsTable is also in PhaseProgressDashboard. Same strategy: clear selection, scroll+focus.
- **`G` (Readiness Gate)**: ReadinessGatePanel is rendered when the readiness gate workflow is selected in the Solutioning phase. Strategy: set phase to 'solutioning' and select workflow key `'bmad-check-implementation-readiness'`.

Wrapper divs with `tabIndex={-1}` are needed to make non-interactive containers focusable for `scrollIntoView` + `focus()`.

### KeyboardShortcutsOverlay Pattern (Reuse TaskDetailContent)

TaskDetailContent.tsx (lines 661-692) has a `Tooltip`-based shortcuts display. For the planning workspace, use a **modal overlay** instead (AC8 says "help overlay"). This is more appropriate because:
- Planning workspace has more shortcuts to display
- A tooltip can't fit all shortcuts comfortably
- Modal is more discoverable and accessible

Pattern: centered dialog with semi-transparent backdrop, grid layout for key-description pairs, `<kbd>` styled elements.

### ARIA Live Region for Phase Announcements

Use `aria-live="polite"` with a visually hidden `<div>` (`sr-only` Tailwind class). When phase changes:
1. Set announcement text: `"Switched to Analysis phase"`
2. Screen readers announce it
3. Clear text after ~1s to prevent re-reading on re-render

This is the standard pattern for dynamic content updates that screen readers should announce.

### PhaseProgressDashboard Ref Forwarding

WhatNextPanel and RecentRunsTable are rendered inside `PhaseProgressDashboard`. The refs need to target wrapper divs INSIDE the dashboard. Two approaches:

1. **Preferred**: Add refs directly in PlanningWorkspacePage around the dashboard sections (if layout allows)
2. **Alternative**: Use `data-testid` selectors with `document.querySelector` to find and focus elements

Approach 1 is cleaner. Check the current PhaseProgressDashboard rendering structure to determine where to place refs.

### Styling: Match Planning Workspace Aesthetic

Follow established patterns from Stories 9.1-9.8:
- **Ghost buttons**: `variant="ghost"` with `h-7 w-7 p-0` sizing for header icons
- **Tooltip pattern**: `TooltipProvider > Tooltip > TooltipTrigger + TooltipContent`
- **Modal overlay**: `fixed inset-0 z-[60]` (above workspace z-50), `bg-black/50` backdrop
- **Card styling**: `bg-popover border rounded-lg shadow-lg`
- **Kbd styling**: `rounded bg-muted px-1.5 py-0.5 font-mono text-xs`
- **sr-only class**: Tailwind utility for visually hidden but screen-reader accessible elements

### Anti-Patterns to Avoid

- **DO NOT** register shortcuts on `document` — use the workspace container ref so shortcuts only fire in planning workspace context
- **DO NOT** create a new Zustand store for shortcut state — `showShortcutsHelp` is transient UI state, use `useState`
- **DO NOT** use `useHotkeys` from a library — this project has no hotkey library; use native `addEventListener('keydown')`
- **DO NOT** modify the existing Escape handler — it already works correctly
- **DO NOT** modify the existing focus trap — it already works correctly
- **DO NOT** add keyboard shortcuts to individual planning components (WhatNextPanel, etc.) — centralize all shortcuts in the hook
- **DO NOT** import Node.js modules in renderer code
- **DO NOT** create separate CSS files — Tailwind inline only
- **DO NOT** use `event.keyCode` — use `event.key` (modern standard)

### Previous Story Intelligence (Story 9.8)

Story 9.8 established:
- `AgentPersonaIndicator` component in workspace header — new `?` button goes adjacent
- `AGENT_PERSONA_CONFIG` constant pattern in `planning-workspace.ts` — follow similar pattern for shortcut definitions if needed
- Props-driven component design — KeyboardShortcutsOverlay follows same pattern (isOpen, onClose)
- PlanningWorkspacePage already has `getActiveWorkflowRun` query (3s poll) — no impact on keyboard shortcuts

**Key learnings from 9.8 code review:**
- Always validate/guard nullable values before using them
- Use `??` fallbacks for optional fields
- `Object.freeze` for immutable config objects

### Git Intelligence

Recent commits (Epic 9):
```
5512474 feat: 9-8 Agent Persona Indicator with color-coded BMAD roles
7adf05b feat: 9-7 Artifact Version Diff View with git history integration
32c6b07 feat: 9-6 Readiness Gate Results Panel with parser and approval flow
f603449 feat: 9-5 Guided Workflow Run Tracker with agent integration
d6e2f84 feat: 9-4 What Next recommender engine for planning workflow guidance
```

Commit message pattern: `feat: 9-{N} {story title summary}`

### Project Structure Notes

Files to create:
```
src/renderer/src/hooks/usePlanningKeyboardShortcuts.ts                  <- NEW (keyboard shortcut hook)
src/renderer/src/hooks/usePlanningKeyboardShortcuts.test.ts             <- NEW (hook tests)
src/renderer/src/components/planning/KeyboardShortcutsOverlay.tsx       <- NEW (help overlay)
src/renderer/src/components/planning/KeyboardShortcutsOverlay.test.tsx  <- NEW (overlay tests)
```

Files to modify:
```
src/renderer/src/pages/PlanningWorkspacePage.tsx       <- ADD hook integration, ? button, ARIA labels, live region, panel refs
src/renderer/src/pages/PlanningWorkspacePage.test.tsx  <- ADD keyboard shortcut tests, ARIA tests
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.9 — AC and user story]
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx:134-191 — Existing Escape and focus trap handlers]
- [Source: src/renderer/src/components/task/TaskDetailContent.tsx:661-692 — Keyboard shortcuts tooltip pattern]
- [Source: src/renderer/src/components/task/TaskDetailContent.tsx:366-440 — Task workspace shortcut keys]
- [Source: src/renderer/src/stores/planning-workspace.store.ts — setActivePhase, setSelectedWorkflow actions]
- [Source: src/renderer/src/components/planning/WhatNextPanel.tsx — What Next recommendation panel]
- [Source: src/renderer/src/components/planning/RecentRunsTable.tsx — Recent workflow runs table]
- [Source: src/renderer/src/components/planning/ReadinessGatePanel.tsx — Readiness gate results]
- [Source: src/renderer/src/components/planning/KeyboardShortcutsOverlay.tsx — NEW help overlay]
- [Source: _bmad-output/planning-artifacts/architecture.md — Component patterns, shadcn/ui accessibility]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Ambient status, calm confidence UX principles]
- [Source: _bmad-output/planning-artifacts/project-context.md — tRPC patterns, naming conventions, test patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None — implementation proceeded without blockers.

### Completion Notes List

- Created `usePlanningKeyboardShortcuts` hook with 7 keyboard shortcuts (1/2/3 for phase navigation, N/R/G for panel focus, ? for help overlay). Hook registers on workspace container ref, guards against input elements and modifier keys.
- Created `KeyboardShortcutsOverlay` modal component with categorized shortcut grid, kbd-styled key labels, backdrop click/Escape dismiss, auto-focus close button, and full ARIA dialog semantics.
- Integrated hook into PlanningWorkspacePage with callbacks for phase switching, panel scrolling/focusing (using querySelector for WhatNextPanel/RecentRunsTable inside PhaseProgressDashboard), and readiness gate navigation.
- Added keyboard shortcut button (Keyboard icon with tooltip) in workspace header next to agent persona indicator.
- Added ARIA landmarks: `aria-label` on workspace root, TabsList, sidebar (role="navigation"), and main content area. Added `role="status"` live region for phase transition announcements with 1-second auto-clear.
- Wrapped WhatNextPanel and RecentRunsTable in PhaseProgressDashboard with focusable divs (data-testid + tabIndex={-1}) for keyboard-driven focus/scroll.
- Note: Story specified `bmad-check-implementation-readiness` as workflow key for G shortcut, but actual key in codebase is `readiness-check`. Used the correct key.
- 78 tests passing across all modified/created files (15 hook + 10 overlay + 19 dashboard + 34 page). No regressions.

### Change Log

- 2026-03-21: Story 9.9 implementation complete — keyboard shortcuts, help overlay, ARIA landmarks, 78 tests passing

### File List

New files:
- src/renderer/src/hooks/usePlanningKeyboardShortcuts.ts
- src/renderer/src/hooks/usePlanningKeyboardShortcuts.test.ts
- src/renderer/src/components/planning/KeyboardShortcutsOverlay.tsx
- src/renderer/src/components/planning/KeyboardShortcutsOverlay.test.tsx

Modified files:
- src/renderer/src/pages/PlanningWorkspacePage.tsx
- src/renderer/src/pages/PlanningWorkspacePage.test.tsx
- src/renderer/src/components/planning/PhaseProgressDashboard.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/9-9-planning-workspace-keyboard-navigation.md
