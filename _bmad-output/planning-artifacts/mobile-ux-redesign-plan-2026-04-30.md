---
date: '2026-04-30'
author: frontend-design (planning skill)
project: TinSu
docType: 'Mobile UX Redesign Plan'
mode: 'PLAN-ONLY (no code)'
inputDocuments:
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md
  - _bmad-output/implementation-artifacts/t3-8-test-report.md
status: 'For approval — supersedes responsive mobile approach'
---

# TinSu Mobile UX Redesign — Parallel Tree Plan

**Title:** From Responsive Compromise to Mobile-Native Control Plane
**Scope:** Full-feature parity mobile UI built as parallel tree (`src/mobile/`), not breakpoint variants
**Target:** Android + iOS phones, 320–767 px portrait primary; tablets benefit but not optimized

---

## 0. Aesthetic Direction (Mobile Translation)

### 0.1 The Continuing Vision

The desktop UX is "Calm Command" — refined control-room dark interface, dense terminal-grade information, monospaced code as a first-class citizen. The mobile redesign **does not** invent a second visual language. It translates the existing aesthetic into thumb-first ergonomics.

**One-line vision for mobile:**
> A pocket-sized terminal control room. Bloomberg Terminal × your favorite dark IDE × the speed of a chat app — built so that 30 seconds on the train ships real work.

### 0.2 What Mobile Inherits From Desktop

| Token / Pattern | Reuse |
|---|---|
| Color palette (UX-DR1) | All 8 base + 4 status + 3 semantic tokens identical |
| Typography (UX-DR2) | Inter UI / JetBrains Mono code, but mobile scale shifts down half a step |
| 4 px grid (UX-DR3) | Identical |
| AgentStatusBadge (UX-DR4) | Identical icon + color set, sized up to 18 px for thumbs |
| Diff colors (UX-DR10) | Identical green / red tints |
| Toast types (UX-DR13) | Identical, but anchored above bottom-tab on mobile |
| Calm-degradation principle | Yellow for reconnecting, never red flash |
| Honest status indicators | Connection, agent, session truth always visible |

### 0.3 What Mobile Diverges On

| Aspect | Desktop | Mobile |
|---|---|---|
| Information density | Maximalist (5 columns, 3-pane workspace, dock) | Density per screen, **one job at a time** |
| Primary navigation | Top sidebar + keyboard | Bottom 5-tab bar + edge swipes |
| Action position | Top right, command palette, keyboard A/R | Sticky bottom action bar in thumb zone |
| Modal pattern | Slide-over panel from right | Bottom sheets that rise into thumb reach |
| Hover affordances | Heavy use | Replaced with long-press + haptic preview |
| Information depth per screen | ~3 panes side-by-side | 1 view + 1 sheet max simultaneous |
| Type scale | h1 24 / body 14 | h1 22 / body 15 (slightly larger body) |
| Code font size | 13 sp/pt monospace | 13 sp baseline, pinch-to-zoom 1×–3× |
| Touch target minimum | n/a | 44 × 44 pt iOS, 48 × 48 dp Android |

### 0.4 Five Mobile Design Principles

1. **One Decision Per Screen.** Every screen answers exactly one question or supports one decision. Compound screens (desktop's 3-column workspace) are decomposed, not miniaturized.
2. **Thumb Authority.** All primary actions live in the bottom 33 % of the screen. Top of screen is for status and identity, never for the action that matters.
3. **Status Is Ambient.** Connection, agent, session, and sync state communicate by glowing dots, status bars, and color shifts — never by interrupting the user with modals.
4. **Gesture Is Faster Than Tap.** Edge swipe to switch, swipe-down to dismiss sheets, long-press to drag — gestures must always be available even when buttons exist.
5. **Calm Under Failure.** Networks drop, sessions stale, agents stall. Mobile UI absorbs these with yellow banners and queued operations. Dialogs only when the user must decide.

### 0.5 Four Memorable Moments to Engineer

These are the experiences users will describe to a friend. Every other design decision serves these.

| Moment | What the user feels |
|---|---|
| **The Train Reconnect** | Tap saved project → pocket terminal opens → board materializes in <2 s. "It's already there." |
| **The Drag-Reveal** | Long-press a card → it lifts with haptic → drag toward right edge → next column slides in. "It just knew." |
| **The Approve-and-Pocket** | Open Review tab → diff in unified view → tap Approve → success haptic → screen calmly returns. Phone goes back in pocket. "Done in 30 seconds." |
| **The Streaming Agent** | Open chat → typing dots in agent bubble → response streams in token by token, monospaced, with code blocks rendering inline. "It's actually working." |

---

## 1. Mobile Information Architecture

### 1.1 Tab Choice — 5 Tabs vs 4 Tabs

**Decision: 5 tabs.** Five tabs accommodate full feature parity without nesting Activity/Diff under another tab where they'd be hard to reach during a review.

```
┌────────────────────────────────────────┐
│   Connection status pill               │  TopAppBar (collapsible)
│   project name ▾                       │
├────────────────────────────────────────┤
│                                        │
│         Active screen content          │
│                                        │
├────────────────────────────────────────┤
│  ▢    ◇    ◯    ⚏    ⚙              │  Bottom Tab Bar
│ Board Plan Tasks  Activity  Settings   │
└────────────────────────────────────────┘
```

| Tab | Icon | Purpose | Badge |
|---|---|---|---|
| **Board** | `LayoutDashboard` (Lucide) | Kanban — primary workflow tab | none |
| **Planning** | `Compass` | Planning Workspace, agent chat sessions | active session count (Thinking + Active) |
| **Tasks** | `CheckSquare` | Task list, task workspace, review/diff | review-pending count |
| **Activity** | `Activity` | Real-time activity feed across project | none (live indicator dot when streaming) |
| **Settings** | `Settings` | Connections, SSH keys, mosh, cache, diagnostics | red dot when connection unhealthy |

**Why 5 not 4:** Board and Tasks are both essential and distinct. Board is for status-at-a-glance and triage (drag, sort). Tasks is for deep work on a single task (workspace, review, terminal). Collapsing them under one tab forces the user into list-then-detail flow on every interaction; mobile users want immediate access to the task they were on.

**Why Activity gets its own tab:** Activity is the "what's happened since I left" surface — habit-forming, aligned with the existing Critical Success Moment "anticipation on app open." Hiding it inside Tasks costs the muscle memory.

**Optional: tab badge counts (UX-DR9 mobile carry-over)**
- Planning: count of sessions where status ∈ {Thinking, Active}
- Tasks: count of tasks where status = Review
- Settings: red dot when any saved connection is `disconnected` or `error`

### 1.2 Tab Persistence Behavior

- Each tab maintains its own navigation stack (back-stack independent per tab).
- Switching tabs preserves scroll position, sub-route, and form state of all other tabs.
- Hardware back gesture (Android) or swipe-from-left edge (iOS) goes back **within** the current tab, never across tabs.
- Long-press on already-active tab = scroll to top of that tab's root list (iOS-native pattern).

### 1.3 Navigation Depth Per Flow

Maximum 3 levels deep in any flow. Beyond 3, switch to bottom sheet.

| Flow | Depth | Path |
|---|---|---|
| Board → Card detail | 2 | Board → Task Workspace |
| Board → Drag → Drop | 0 (in-place gesture) | Board only |
| Tasks → Review → Approve | 3 | Tasks → Diff → Review Sheet |
| Planning → Session → Send Msg | 2 | Planning → Chat |
| Planning → New Session → Pick Persona | 3 | Planning → New Session sheet → Persona sheet |
| Settings → SSH Connections → Add | 3 | Settings → SSH List → Add Sheet |
| Settings → Diagnostics | 2 | Settings → Diagnostics |

### 1.4 Deep Link Map

Tauri deep links wire to mobile screens identically to desktop:

| URI | Resolves to | Stack restored |
|---|---|---|
| `tinsu://project/{id}` | Board tab, project loaded | Board → root |
| `tinsu://task/{id}` | Tasks tab, task workspace open | Tasks → workspace |
| `tinsu://task/{id}/diff` | Tasks tab, diff tab pre-selected | Tasks → workspace → diff |
| `tinsu://chat/{sessionId}` | Planning tab, chat open | Planning → chat |
| `tinsu://activity/{taskId}` | Activity tab filtered | Activity → filtered |
| `tinsu://settings/connections` | Settings tab, SSH list | Settings → connections |

Push notifications (Phase 3+) will use the same URI scheme.

### 1.5 Mobile-Specific Surfaces (cross-cutting)

These are not tabs but appear over any tab.

| Surface | Trigger | Behavior |
|---|---|---|
| **Project Switcher Sheet** | Tap project name in TopAppBar | Bottom sheet with local + remote projects, search field, "Add connection" CTA |
| **Connection Detail Sheet** | Tap connection status pill | Bottom sheet showing host, transport, latency, "Reconnect" / "Disconnect" |
| **Command Palette** (Android FAB / iOS shake or pull-to-search) | Optional Phase-2 enhancement | Bottom sheet with searchable commands |
| **Toast** | Action confirmations | Anchored 16 dp above bottom tab bar, max stack 3, types from UX-DR13 |
| **Reconnecting Banner** | Connection state = Reconnecting | Sticky 32 dp yellow strip below TopAppBar, shows retry attempt |
| **Offline Banner** | Connection state = Offline | Sticky 32 dp gray strip with "Cached data" label |

---

## 2. Screen Inventory

Sixty mobile screens cover full feature parity. Each maps to a desktop equivalent (or replaces a section of one).

### 2.1 App Shell & Onboarding (5)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 1 | `MobileWelcome` | `Welcome.tsx` | Full-screen, hero pattern, 3 CTAs (Open Local / Add Remote / New Project) |
| 2 | `MobileOnboarding` | `ProjectSetupDialog.tsx` (onboard mode) | Full-screen wizard, 4 steps, swipe pager + bottom Next/Back bar |
| 3 | `MobileNewProjectFlow` | `NewProjectDialog.tsx` | Full-screen wizard, 3 steps |
| 4 | `MobileToolHealth` | inline tool-health check | Sheet — appears when window focus reveals missing tool |
| 5 | `MobileCrashRecovery` | `CrashRecoveryDialog.tsx` | Sheet listing crashed ops with per-op resolve actions |

### 2.2 Board Tab (5)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 6 | `MobileBoardScreen` | `KanbanBoard.tsx` | Tab root — single-column pager (see §4) |
| 7 | `MobileColumnPager` | n/a (mobile-only primitive) | Horizontal swipe between 5 columns, peek of next col |
| 8 | `MobileTaskCard` | `TaskCard.tsx` / `StoryTaskCard.tsx` / `PlanningTaskCard.tsx` | Card primitive, 3 variants |
| 9 | `MobileTaskFilters` | `filter/` components | Bottom sheet with filter chips |
| 10 | `MobileNewTaskSheet` | `NewTaskDialog.tsx` | Bottom sheet, multi-step (Title → Description → AC) |

### 2.3 Planning Tab (8)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 11 | `MobilePlanningHome` | `PlanningWorkspacePage.tsx` (left+main) | Tab root — session list + BMAD workflow header pill |
| 12 | `MobileSessionList` | session list portion of planning | Card list, status chips, last message preview |
| 13 | `MobileChatScreen` | chat portion of planning | Full-screen chat, sticky bottom composer |
| 14 | `MobileChatBubble` | chat bubble component | Custom primitive, user/agent variants, code block sub-blocks |
| 15 | `MobileNewSessionSheet` | new session dialog | Bottom sheet for persona selection |
| 16 | `MobilePersonaPicker` | inline persona select | Sheet child — grid of 6 personas with bios |
| 17 | `MobileBmadWorkflowSheet` | BMAD sidebar | Bottom sheet listing workflow steps with progress |
| 18 | `MobileChatToolActivity` | inline tool activity | Inline expandable bubble showing tool calls within a message |

### 2.4 Tasks Tab (12)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 19 | `MobileTaskListScreen` | task list views | Tab root — flat list with status filter chips |
| 20 | `MobileTaskWorkspaceScreen` | `TaskWorkspacePage.tsx` | Full-screen, sub-tabs Content / Terminal / Activities / Diff (see §6) |
| 21 | `MobileContentTab` | left column of workspace | Full-screen tab content; description, AC, agent context notes |
| 22 | `MobileTerminalTab` | terminal panel | Full-screen with sticky status bar (already partially built — `MobileTerminal`) |
| 23 | `MobileActivitiesTab` | activities panel | Real-time list, scoped to this task |
| 24 | `MobileDiffTab` | diff panel | File tree → file diff (drill-down or sheet) |
| 25 | `MobileFileTreeSheet` | `MobileFileTree.tsx` (rebuild as sheet) | Bottom sheet with searchable file list, change indicators |
| 26 | `MobileDiffViewerScreen` | `MobileDiffViewer.tsx` (keep, harden) | Full-screen unified diff with sticky review action bar |
| 27 | `MobileReviewActionBar` | `MobileReviewActionBar.tsx` (keep) | Sticky bottom; Approve / Request Changes / Reject |
| 28 | `MobileFeedbackSheet` | inline feedback dialog | Bottom sheet with text editor, submit/cancel |
| 29 | `MobileRejectionSheet` | rejection dialog | Bottom sheet with text editor + confirmation step |
| 30 | `MobileTaskActionMenu` | three-dot menu on card | Bottom sheet with task-level actions (pause, resume, archive, view reasoning) |

### 2.5 Activity Tab (3)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 31 | `MobileActivityFeedScreen` | activity log views | Tab root — full feed across project; live |
| 32 | `MobileActivityFilters` | filter chips | Pinned chip strip + sheet for advanced filters |
| 33 | `MobileActivityDetail` | event detail | Bottom sheet with raw event payload + jump-to-task link |

### 2.6 Settings Tab (15)

| # | Screen | Replaces (desktop) | Type |
|---|---|---|---|
| 34 | `MobileSettingsHome` | settings entrypoint | List with sections (Connections, Mosh, Cache, Theme, Diagnostics, About) |
| 35 | `MobileConnectionsList` | connection list (UX-DR16) | Card list, connection cards with status dot |
| 36 | `MobileSshAddSheet` | new SSH form | Bottom sheet wizard: host → key → test → name (rebuild from `MobileSshConnectionForm`) |
| 37 | `MobileSshKeysList` | key mgmt | List of stored keys with copy/export/delete |
| 38 | `MobileGenerateKeySheet` | key generation flow | Bottom sheet with key-type picker + progress |
| 39 | `MobileShowPublicKey` | public key viewer | Sheet with copy button + `ssh-copy-id` command |
| 40 | `MobileTestConnectionSheet` | test connection result | Sheet with progress → result with troubleshooting hints |
| 41 | `MobileMoshSettings` | mosh config | List form (port range, prediction mode, default transport) |
| 42 | `MobileCacheSettings` | cache mgmt | List with cache size, clear-by-category, max-size slider |
| 43 | `MobileDiagnostics` | diagnostics | Read-only fields + Copy Diagnostics + recent events log |
| 44 | `MobileThemeSettings` | theme picker | Dark / Light / Auto + accent picker (Phase 2) |
| 45 | `MobileAbout` | about | Version, build, links |
| 46 | `MobileProjectSwitcherSheet` | project switcher | Cross-cutting sheet, listed here for completeness |
| 47 | `MobileConnectionDetailSheet` | connection details | Cross-cutting sheet |
| 48 | `MobileLicenses` | licenses | List of OSS licenses |

### 2.7 Cross-Cutting Components (covered in §7)

Items 49–60 are reusable primitives, not screens. Documented in component inventory.

---

## 3. Per-Feature Mobile UX Patterns

For each of the 9 required features, this section specifies layout strategy, primary interactions, gesture map, and component dependencies.

### 3.1 Kanban Board

| Aspect | Decision |
|---|---|
| Layout | **Horizontal column pager with 8 % peek of next column.** See §4 for rationale. |
| Primary interactions | Tap card → open task. Long-press card (250 ms) → enter drag mode. Swipe horizontally on board → next column. Pull-to-refresh → re-sync. |
| Card actions | Tap = open. Long-press = drag. Three-dot menu on card → bottom sheet with quick actions (move to col, edit, archive, delete). |
| Gesture map | Long-press lift (haptic light) → finger drag → swipe to edge → column slides → drop on column → haptic medium + status update |
| Empty state | Per-column empty state with column-appropriate CTA |
| Status indicators | AgentStatusBadge (UX-DR4) on every Story-type card; pulse animation when Running; respect `prefers-reduced-motion` |
| Components needed | `MobileColumnPager`, `MobileTaskCard` (variants Story / Basic / Planning), `MobileColumnHeader` (with count + collapse), `MobileFilterChipsStrip` |

### 3.2 Planning Workspace

| Aspect | Decision |
|---|---|
| Layout | Tab root is **session list**. Tap a session → `MobileChatScreen` (full-screen). Chat input sticky bottom. |
| BMAD workflow access | Top-of-list pill: "BMAD: Step 3 of 7 — UX Design" → tap opens `MobileBmadWorkflowSheet`. Pill always visible at top of session list. |
| Persona context | Persona shown as chip in chat header. Tap chip → bottom sheet with persona bio + can switch persona for new session only (mid-session persona switch is disabled). |
| Concurrent sessions | Session list sorts: Thinking (top) → Active → Idle → Completed → Exited. Pulse on Thinking sessions. |
| Streaming response | Bubble with typing-dots placeholder → text streams in. Auto-scroll to bottom unless user has scrolled up (then show "↓ N new messages" pill at bottom). |
| Tool activity | Inline expandable sub-bubble in agent message; collapsed shows "🔧 Read 3 files, edited 2"; expanded shows full tool call list. |
| Primary interactions | Tap session card → open. Swipe-left on session card → archive / delete actions. Pull-to-refresh → re-sync sessions. |
| Components needed | `MobileSessionList`, `MobileSessionCard`, `MobileChatScreen`, `MobileChatBubble`, `MobileChatComposer`, `MobileNewSessionSheet`, `MobilePersonaPicker`, `MobileBmadWorkflowSheet`, `MobileChatToolActivity` |

### 3.3 Task Workspace (3-column → mobile)

| Aspect | Decision |
|---|---|
| Layout | **Sub-tab pager inside the task screen.** 4 sub-tabs: Content / Terminal / Activities / Diff. Horizontal swipe between sub-tabs OR tap sub-tab in pinned segmented control. See §6. |
| Primary interactions | Tap sub-tab. Swipe horizontally between sub-tabs. Pull-to-refresh re-syncs only the active sub-tab. |
| Header | Task title + status badge + 3-dot menu (action sheet). Stays pinned across sub-tabs. |
| Sticky bottom | Diff tab only: sticky `MobileReviewActionBar`. Other tabs: free space at bottom (composer for Content notes, command input for Terminal). |
| Gesture map | Edge-swipe-from-left = back to task list. Horizontal swipe in body = sub-tab change. Pull-down = refresh. |
| Components needed | `MobileTaskWorkspaceScreen`, `MobileTaskHeader`, `MobileSubTabBar`, `MobileTaskActionMenu`, the four content tabs |

### 3.4 Terminal View

| Aspect | Decision |
|---|---|
| Layout | Full-screen sub-tab content. xterm.js renders with mobile-tuned options (font 13 sp, scrollback 5000, custom touch handlers). |
| Status bar | Sticky 32 dp pill at top of terminal area showing Running / Stalled / Paused / Complete with AgentStatusBadge style. |
| Command input | Sticky bottom 56 dp bar with text field + send button + virtual keyboard accessory toolbar (Tab / Esc / Ctrl / Arrow keys). |
| Primary interactions | Single-finger drag = scroll terminal. Two-finger pinch = zoom 1×–2×. Long-press = copy selection. Double-tap = select word. Tap input field = open keyboard. |
| Keyboard accessory | Above the keyboard: row of common terminal keys (Tab, Esc, Up, Down, Ctrl, ` ~ |, send button). Saves users from punching screen reaching for these. |
| Pause / Resume | Sticky overlay button bottom-right, only visible when running; haptic on tap; collapses into status bar after 3 seconds. |
| Components needed | `MobileTerminal` (already exists — keep, harden), `MobileTerminalStatusBar`, `MobileTerminalAccessoryBar`, `MobileTerminalCommandInput` |

### 3.5 Review / Approval (Diff Viewer)

| Aspect | Decision |
|---|---|
| Layout | File tree as bottom sheet (`MobileFileTreeSheet`); main view = `MobileDiffViewerScreen` showing unified diff for selected file. Sticky bottom = `MobileReviewActionBar`. |
| Primary interactions | Tap file in sheet → diff loads in main view. Tap "Files" pill in header → sheet opens. Pinch-to-zoom on diff. Long-press a line → inline comment sheet (Phase-2). |
| Action bar | Approve = primary filled green button (largest). Request Changes = secondary outlined yellow. Reject = destructive red text button. Order: Reject (left) | Request Changes (center) | Approve (right) — Approve in dominant thumb position. |
| Confirmation | Approve → confirmation dialog (modal) with task title + change summary + Confirm. Request Changes → bottom sheet with `TextEditor`. Reject → bottom sheet with `TextEditor` + confirmation dialog. |
| Diff format | **Unified only** on phone. Side-by-side never on mobile. Diff colors UX-DR10 with `+`/`-` prefix for accessibility (UX-DR19). |
| File summary | Sticky bar above diff: filename + +X/-Y change summary + scroll-to-top button on long files. |
| Components needed | `MobileDiffViewerScreen`, `MobileFileTreeSheet`, `MobileReviewActionBar` (keep), `MobileFeedbackSheet`, `MobileRejectionSheet`, `MobileDiffFileHeader`, `MobileDiffLine` |

### 3.6 SSH Connection Management

| Aspect | Decision |
|---|---|
| Layout | List screen `MobileConnectionsList`. Add flow is bottom-sheet wizard `MobileSshAddSheet`. Edit is sheet variant of same. |
| Wizard steps | Step 1: Host + port + username. Step 2: Key — generate new / pick from stored / paste. Step 3: Show public key + copy button + `ssh-copy-id` command. Step 4: Test. Step 5: Save with display name. Steps swipeable; bottom Next button advances. |
| Test connection | Mandatory before save. Success: green check + server fingerprint. Failure: clear error with troubleshooting hint + retry button. |
| Key generation | Inside Step 2 if user picks "Generate New". Bottom sheet shows progress, then surfaces the public key + copy. |
| Connection cards | Display name, host, last connected timestamp, status dot. Swipe-left on card → Edit / Delete. Tap → connection detail sheet. |
| Components needed | `MobileConnectionsList`, `MobileConnectionCard`, `MobileSshAddSheet`, `MobileGenerateKeySheet`, `MobileShowPublicKey`, `MobileTestConnectionSheet`, `MobileSshConnectionForm` (already exists — refactor into sheet) |

### 3.7 Activity Log

| Aspect | Decision |
|---|---|
| Layout | Tab root list. Newest event at top. Auto-prepends as events stream. Live indicator (small green dot) in TopAppBar when streaming. |
| Filters | Pinned chip strip: All / Status / Agent / Tools / Errors / User / Auto. Tap chip toggles filter. Long-press strip → advanced filter sheet (date range, task, severity). |
| Event row | Icon by event type (UX-DR9), event title, secondary metadata (task name, timestamp), expand chevron for events with payload. Tap row = expand inline OR open detail sheet for very large payloads. |
| Real-time UX | New events animate in from the top with subtle highlight glow that fades over 1.5 s. Respect `prefers-reduced-motion`. |
| Empty state | "No activity yet — start a task to see agent events here" |
| Components needed | `MobileActivityFeedScreen`, `MobileActivityRow`, `MobileActivityChipStrip`, `MobileActivityDetail`, `MobileLiveIndicator` |

### 3.8 Project Switcher

| Aspect | Decision |
|---|---|
| Layout | Bottom sheet `MobileProjectSwitcherSheet` invoked from project name in TopAppBar (chevron icon ▾). |
| Content | Pinned section: Local Projects. Below: Remote Projects (grouped by SSH connection). Search field at top. "Add Connection" CTA at bottom. |
| Indicators | Connection status dot per remote project (green/yellow/red/gray). Last accessed timestamp per project. |
| Primary interactions | Tap project → switch + close sheet. Swipe-down on sheet handle = dismiss. Pull-to-refresh inside sheet = re-sync remote project lists. |
| Components needed | `MobileProjectSwitcherSheet`, `MobileProjectRow`, `MobileSearchField` |

### 3.9 Settings

| Aspect | Decision |
|---|---|
| Layout | List screen with sections: Connections (count badge), SSH Keys, Mosh, Cache, Theme, Diagnostics, About. Each row → drill-in screen. |
| Drill-in pattern | Standard mobile settings — list of forms / toggles / list rows. Forms autosave on change (no Save button) where reversible; explicit Save button only on multi-field forms (Mosh, SSH connections). |
| Diagnostics | Read-only fields: app version, Tauri version, transport library versions, current connection details, recent connection events (last 50). "Copy Diagnostics" button → clipboard. |
| Components needed | `MobileSettingsHome`, `MobileSettingsRow`, `MobileSettingsSection`, plus per-screen as listed in §2.6 |

---

## 4. Kanban-on-Mobile Design

### 4.1 Three Approaches Considered

#### Option A — Single column + swipe between
- Show one column at a time, full width. Swipe horizontally to move between columns.
- **Pros:** Maximum readable card width; no peek waste.
- **Cons:** No spatial sense of "which column comes next." Drag-to-edge cannot reveal target. User loses board mental model.

#### Option B — Horizontal column pager with 8 % peek of next column ✅
- Each column ~92 % width, with ~8 % of the next column's first card peeking on the right edge. Swipe carries to next column with snap. Drag-to-edge during card drag reveals neighboring column.
- **Pros:** Preserves spatial sense ("Backlog → Create Story → In Progress …"); peek hints navigation; drag-to-edge gives natural drag-drop UX; matches Trello-mobile prior art that users already understand.
- **Cons:** Slightly less card width.

#### Option C — Vertical-stacked collapsible columns
- All 5 columns stacked vertically; tap header to expand/collapse. Drag a card to scroll-and-drop on another column header.
- **Pros:** No swipe needed; everything visible.
- **Cons:** Drag-drop feels awkward (long-distance scroll-while-dragging); breaks Kanban metaphor (columns become rows); poor for boards with many tasks per column.

### 4.2 Decision: Option B

**Rationale:**
1. Preserves the Kanban mental model. Users think "I'm moving this from In Progress to Review" — they need spatial direction.
2. Drag-drop feels natural with edge-reveal.
3. Peek of next column is a known mobile pattern (Instagram stories, Trello, App Store cards) — zero learning curve.
4. Allows column-level affordances (count badge, collapse, sort) on visible header.

### 4.3 Column Pager Behavior

```
┌────────────────────────────────────────┐
│  ◀  In Progress (3)        ▾  ▾   ▶   │  Column header (with count, sort, settings)
├────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──┐  │
│  │ Card                     │  │  │  │
│  │ #ID Story title          │  │R │  │  Peek of next col (Review)
│  │ ✓ Running  ◯ idle        │  │  │  │
│  └──────────────────────────┘  └──┘  │
│  ┌──────────────────────────┐         │
│  │ Card                     │         │
│  │ ...                      │         │
│  └──────────────────────────┘         │
│                                        │
└────────────────────────────────────────┘
   ●  ●  ◯  ◯  ◯       Pager dots (5)
```

- Snap behavior: when finger releases at >40 % of column width past midpoint, snap to next column.
- Pager dots indicator at bottom of board area (not bottom of screen — bottom is reserved for tab bar).
- TopAppBar shows current column name AND project name in a layered title ("In Progress · TinSu").

### 4.4 Drag-and-Drop UX

**Flow:**
1. **Long-press** card (250 ms) → light haptic → card lifts 4 dp with elevation shadow (shadow-2xl).
2. **Drag** finger → card follows; original position shows ghost outline.
3. **Drag toward right edge** → after 800 ms hover at edge, board slides left, revealing next column. Same on left edge.
4. **Drop** on a column area → medium haptic + status update. Card animates into place with spring physics.
5. **Drop** outside any column → light failure haptic; card returns to origin with spring.
6. **Cancel**: drag back over original card → release → return.

**Edge auto-scroll trigger:** finger held within 56 dp of left/right edge for 800 ms triggers column-pager advance. (Already implemented as `autoScroll` in `@dnd-kit`'s DndContext per recent t3-3 fix.)

**Failure modes:**
- Card cannot move to a status that violates business rules (e.g., Backlog → Done direct skip): show toast "Cannot move directly — task must pass through In Progress" + return to origin.
- Network drop mid-drag: visual indicator on card "Saving offline…" then sync on reconnect.

### 4.5 Card Variants

Three visual variants of `MobileTaskCard` (matching desktop UX-DR11):

| Variant | Visual treatment |
|---|---|
| Story | "Story" pill (status-review purple bg) + workflow phase indicator (UX-DR12) + "Auto" icon |
| Basic | "Task" pill (text-muted bg) + no workflow indicator |
| Planning | "Plan" pill (status-running green bg) + agent persona icon |

All three use the same card shell: status badge top-right, title 2-line clamp, secondary metadata bottom row (sprint, epic, last activity timestamp).

### 4.6 Filter & Sort

- Pinned chip strip below TopAppBar: Sprint / Epic / Status / Type. Tap chip → sheet with options.
- Sort controlled per-column via column header settings (the "▾▾" icon in mock above): default = lastUpdated desc.
- "Clear filters" pill appears when any filter is active.

---

## 5. Planning Workspace Mobile Design

### 5.1 Architecture

The desktop Planning Workspace has three regions: BMAD sidebar (left), session list (left-mid), chat (right). On mobile this collapses into a flow:

```
Planning tab root
└── BMAD step pill (top)         → MobileBmadWorkflowSheet on tap
└── Session list (cards)         → MobileSessionCard
    └── New Session FAB (bottom-right)
└── Tap session card             → MobileChatScreen (push)
    └── Persona chip in header   → MobilePersonaPicker on tap
    └── Chat composer (sticky)   → MobileChatComposer
```

### 5.2 Session List

Each card shows:
- Persona icon + name
- Last message preview (1 line, ellipsis)
- SessionStatusChip (UX-DR4 mobile variant: 18 px chip, all 5 states)
- Timestamp (relative: "3m ago")

Sort order: Thinking → Active → Idle → Completed → Exited; secondary by lastActiveAt desc.

Sessions in Thinking state pulse subtly (chip background animates 0.6 ↔ 1.0 alpha at 1 Hz).

Swipe-left on session card reveals Archive / Delete buttons (iOS-native pattern; works on Android via JS gesture).

### 5.3 Chat Screen

```
┌────────────────────────────────────────┐
│  ◀  PM Agent  ●Active        ⋮        │  Chat header
│       persona ▾                        │
├────────────────────────────────────────┤
│                                        │
│              [agent bubble]            │
│      [user bubble]                     │
│                                        │
│              [agent bubble streaming…] │
│                                        │
├────────────────────────────────────────┤
│  ↓ 2 new messages                      │  Auto-scroll restore pill
├────────────────────────────────────────┤
│  ┃ Type a message...           [➤]    │  Sticky composer
└────────────────────────────────────────┘
```

**Streaming bubble:** Three pulsing dots placeholder until first token; then text streams in. Render Markdown inline. Code blocks inside messages use JetBrains Mono 13 sp + horizontal scroll + copy button.

**Auto-scroll:** Lock to bottom unless user scrolls up >100 px. While unlocked, new messages show "↓ N new" pill above composer; tap = jump to bottom + re-lock.

**Composer:**
- Single-line collapsed (44 dp), expands up to 4 visible lines on multi-line input, then internal scroll.
- Send button fills with primary color when text is non-empty.
- Long-press send → "Send and start new session" option (Phase-2).

**Tool activity sub-bubble (inside agent message):**
- Collapsed: "🔧 Used 3 tools" + chevron
- Expanded: list of tool calls with name, status, brief result, timestamp
- Animates expand/collapse at 200 ms

### 5.4 BMAD Workflow Access

Top of session list shows a pill:
```
BMAD: Step 3 of 7 — UX Design  ▸
```

Tap → `MobileBmadWorkflowSheet` (bottom sheet, ~75 % screen height) with:
- List of all 7 BMAD steps (Brief, PRD, UX Design, Architecture, Stories, Implementation, Review)
- Per-step status (Done / Active / Pending) + icon
- Tap step → close sheet, scroll session list to first session of that step (or filter)
- Footer: "Mark step complete" / "Move to next step" actions

This makes BMAD navigable without dedicating a full tab to it. The pill is always visible; the sheet is always 1 tap away.

### 5.5 New Session Flow

FAB (bottom-right above tab bar, 56 dp) with `+` icon → `MobileNewSessionSheet`:
1. Persona picker (grid of 6 personas: PM, Architect, UX Designer, Dev, QA, Custom). Each shows icon + name + 1-line bio.
2. Tap persona → opens chat screen with new session created in background (optimistic UI: chat opens immediately; first user message sends after session is ready, otherwise shows "Initializing…" placeholder).

---

## 6. Task Workspace Mobile

### 6.1 Sub-tab Pattern

Desktop has 3 columns: Content / Terminal+Activities / Diff. Mobile decomposes into **4 sub-tabs** because Terminal and Activities serve very different purposes and shouldn't share a screen on mobile.

```
┌────────────────────────────────────────┐
│  ◀  TINSU-123: Add Auth   ●Running ⋮ │  Task header
├────────────────────────────────────────┤
│  Content │ Terminal │ Activities │ Diff│  Sub-tab segmented bar (sticky)
├────────────────────────────────────────┤
│                                        │
│         Active sub-tab content         │
│                                        │
├────────────────────────────────────────┤
│  (empty OR composer OR action bar)     │  Sticky bottom
└────────────────────────────────────────┘
```

### 6.2 Sub-tab Choice — Pager vs Segmented Bar

**Decision: Both.** A pinned segmented control AT the top (taps directly select a sub-tab) AND horizontal swipe inside the content area moves between sub-tabs.

**Rationale:**
- Segmented control = direct access and visual indicator of which sub-tab is active.
- Swipe = mobile-native gesture; faster for incrementing through tabs.
- The two reinforce each other; users self-select their preferred mode.

**Constraint:** Swipe must NOT conflict with internal scrolling. Implementation: only the segmented bar acts on horizontal swipes that cross 25 % of the screen width within 200 ms; below this threshold, gestures fall through to internal handlers.

### 6.3 Per-Sub-tab Behavior

| Sub-tab | Content | Sticky bottom |
|---|---|---|
| **Content** | Task description (markdown), AC checklist, Agent context notes (editable), task metadata | Inline editor save indicator only |
| **Terminal** | xterm.js full-screen, status bar pinned at top of content area | Command input (`MobileTerminalCommandInput`) + keyboard accessory bar |
| **Activities** | Real-time list scoped to this task. Filter chips above list. | None |
| **Diff** | File tree pill at top → opens sheet → select file → diff renders | `MobileReviewActionBar` (Approve/Request/Reject) |

### 6.4 Header

Pinned header (collapsing on scroll within sub-tab):
- Back chevron → exit task workspace
- Task ID + truncated title
- Status badge (UX-DR4)
- Three-dot menu → `MobileTaskActionMenu`:
  - View task reasoning log (FR36)
  - Pause / Resume agent
  - View agent run history
  - Edit task
  - Archive
  - Delete

### 6.5 State Preservation

Each sub-tab preserves its own scroll position and any partial input across tab switches and across navigation away from the task. Stored in `task-workspace.store.ts` (existing).

---

## 7. Component Library Decisions

### 7.1 Existing Mobile* Components — Keep / Refactor / Rebuild

| Component | Status | Action |
|---|---|---|
| `MobileTerminal.tsx` | Functional, partially tested | **Keep**. Harden touch handlers, ensure xterm.js options are mobile-tuned. Add `MobileTerminalAccessoryBar` sibling. |
| `MobileBottomNav.tsx` | Currently has 3 tabs (Board / Planning / Settings) | **Rebuild as 5-tab nav** matching §1.1. Reuse styling. |
| `MobileSshConnectionForm.tsx` | Form-only, not sheet-aware | **Refactor** — wrap in sheet, add wizard step state. |
| `MobileReviewActionBar.tsx` | Sticky bottom bar | **Keep**. Verify safe-area inset handling on iOS. |
| `MobileDiffViewer.tsx` | Mobile diff renderer | **Keep**. Verify pinch-to-zoom on diff lines. |
| `MobileFileTree.tsx` | Tree component | **Refactor** into bottom sheet (`MobileFileTreeSheet`). |
| `MobileSessionDrawer.tsx` | Currently a drawer | **Rebuild as session list screen** within Planning tab — drawer pattern doesn't fit the new tab architecture. Salvage list-row styling. |

### 7.2 New Shared Mobile Primitives

These are mobile-only primitives, not previously built. They are the foundation for every mobile screen.

| Primitive | Purpose | Approx LOC | Notes |
|---|---|---|---|
| `MobileScreen` | Standard mobile screen scaffold: TopAppBar slot + body slot + sticky-bottom slot + safe-area handling | ~100 | Used by every tab and detail screen |
| `MobileTopAppBar` | Title + connection status pill + action icons + collapsible-on-scroll behavior | ~150 | Reusable across all screens |
| `MobileSheet` | Bottom sheet primitive over shadcn Sheet — adds drag handle, snap points (50 %, 90 %, full), backdrop dismiss | ~120 | Used everywhere bottom sheets appear |
| `MobileTabBar` | 5-tab bottom navigation with badge support, safe-area inset, active indicator pill | ~100 | App root |
| `MobileSegmentedTabs` | Horizontal segmented control + swipeable content pager | ~180 | Used in Task Workspace sub-tabs |
| `MobileColumnPager` | Horizontal column pager with peek + drag-edge auto-advance | ~250 | Kanban core |
| `MobileChipStrip` | Pinned filter chip strip with horizontal scroll | ~80 | Used by Activity, Tasks, Filter screens |
| `MobileEmptyState` | Empty-state primitive with icon, title, subtitle, optional CTA | ~60 | Every list screen |
| `MobileLoadingState` | Skeleton shimmer primitive matching card / list / chat | ~80 | Loading states across screens |
| `MobileToast` | Toast container anchored above tab bar (UX-DR13 mobile variant) | ~100 | Replaces sonner positioning on mobile |
| `MobileFAB` | Floating action button with safe-area inset, 56 dp | ~50 | Used by Planning + Tasks for quick-create |
| `MobileSearchField` | Search input with prefix icon, clear button, focus ring | ~60 | Project switcher, settings |
| `MobileSettingsRow` | List row with leading icon, title, value, chevron / toggle / switch | ~80 | All settings sub-screens |
| `MobileConnectionStatusPill` | Compact connection state chip for TopAppBar | ~70 | Replaces desktop status bar |

### 7.3 Reusable from Desktop (Unchanged)

These desktop components work as-is in mobile screens. Not duplicated.

- All `src/components/ui/` shadcn primitives (Button, Card, Input, Switch, Toast, Dialog, etc.)
- `AgentStatusBadge`, `SessionStatusChip` (UX-DR4) — same component, smaller default size on mobile
- Diff parser logic (not the renderer)
- Markdown renderer (mikepenz)
- All Zustand stores
- All rspc hooks (`useTaskCommands`, `useAgentLauncher`, etc.)
- All TanStack Query setup
- All lib utilities (`fuzzy-match`, `cn`)

### 7.4 Component Naming Convention

- All mobile-tree components prefixed `Mobile*` (already established).
- All mobile-tree files live under `src/mobile/components/` (new folder).
- Existing top-level `Mobile*` files relocated under `src/mobile/components/` during migration. Their imports updated.
- Tests co-located: `MobileScreen.tsx` + `MobileScreen.test.tsx`.

---

## 8. Routing & Shell Architecture

### 8.1 Viewport-Routed Root

```
src/main.tsx
  └── <App />                     (current root)
        └── if (isMobileViewport)
            └── <MobileApp />     (new mobile root, src/mobile/MobileApp.tsx)
        └── else
            └── <DesktopApp />    (rename of current App.tsx contents)
```

**Viewport detection:**
- New hook `useViewportClass()` returning `'mobile' | 'tablet' | 'desktop'`.
- `mobile` < 768 px width OR userAgent matches mobile.
- Subscribe to `resize` and `orientationchange`.
- On Tauri mobile target: viewport is always `mobile` regardless of width (Android tablet = `mobile` for now; revisit Phase-4 for tablet UX).
- Decision happens once at app shell mount; `MobileApp` and `DesktopApp` are mutually exclusive — no responsive switching mid-session.

### 8.2 Mobile Router

`MobileApp` owns its own router state via Zustand store `mobile-nav.store.ts`:

```
mobile-nav.store.ts
  - activeTab: 'board' | 'planning' | 'tasks' | 'activity' | 'settings'
  - tabStacks: Record<TabId, NavEntry[]>
  - openSheet: { type, props } | null
  - actions: switchTab, push, pop, openSheet, closeSheet
```

**Why Zustand and not React Router:**
- Each tab needs an independent stack with persisted scroll/state (already supported by Zustand pattern in this app).
- Sheet vs screen distinction matters here; sheets stack on top of screens within the same tab.
- React Router's nested routes don't model "5 parallel stacks" well without extra plumbing.
- Backed by existing project store conventions.

Deep links from Tauri intent handler call `mobileNavStore.handleDeepLink(uri)` which sets `activeTab` and pushes the resolved screen onto that tab's stack.

### 8.3 Mobile File Structure

```
src/
├── App.tsx                     (becomes thin viewport router)
├── DesktopApp.tsx              (renamed from current App.tsx body)
├── mobile/
│   ├── MobileApp.tsx           (root mobile shell)
│   ├── MobileShell.tsx         (TopAppBar + tabbar + outlet)
│   ├── stores/
│   │   └── mobile-nav.store.ts
│   ├── hooks/
│   │   ├── useViewportClass.ts
│   │   ├── useMobileBack.ts    (hardware back integration)
│   │   ├── useSafeArea.ts
│   │   └── useHaptic.ts        (navigator.vibrate wrapper)
│   ├── components/
│   │   ├── primitives/
│   │   │   ├── MobileScreen.tsx
│   │   │   ├── MobileTopAppBar.tsx
│   │   │   ├── MobileSheet.tsx
│   │   │   ├── MobileTabBar.tsx
│   │   │   ├── MobileSegmentedTabs.tsx
│   │   │   ├── MobileColumnPager.tsx
│   │   │   ├── MobileChipStrip.tsx
│   │   │   ├── MobileEmptyState.tsx
│   │   │   ├── MobileLoadingState.tsx
│   │   │   ├── MobileToast.tsx
│   │   │   ├── MobileFAB.tsx
│   │   │   ├── MobileSearchField.tsx
│   │   │   ├── MobileSettingsRow.tsx
│   │   │   └── MobileConnectionStatusPill.tsx
│   │   ├── board/
│   │   │   ├── MobileTaskCard.tsx
│   │   │   ├── MobileColumnHeader.tsx
│   │   │   └── ...
│   │   ├── planning/
│   │   │   ├── MobileSessionList.tsx
│   │   │   ├── MobileSessionCard.tsx
│   │   │   ├── MobileChatScreen.tsx
│   │   │   ├── MobileChatBubble.tsx
│   │   │   ├── MobileChatComposer.tsx
│   │   │   ├── MobileNewSessionSheet.tsx
│   │   │   ├── MobilePersonaPicker.tsx
│   │   │   ├── MobileBmadWorkflowSheet.tsx
│   │   │   └── MobileChatToolActivity.tsx
│   │   ├── tasks/
│   │   │   ├── MobileTaskListScreen.tsx
│   │   │   ├── MobileTaskWorkspaceScreen.tsx
│   │   │   ├── MobileContentTab.tsx
│   │   │   ├── MobileTerminalTab.tsx       (uses existing MobileTerminal)
│   │   │   ├── MobileActivitiesTab.tsx
│   │   │   ├── MobileDiffTab.tsx
│   │   │   └── ...
│   │   ├── review/
│   │   │   ├── MobileDiffViewerScreen.tsx
│   │   │   ├── MobileFileTreeSheet.tsx
│   │   │   ├── MobileFeedbackSheet.tsx
│   │   │   └── MobileRejectionSheet.tsx
│   │   ├── ssh/
│   │   │   ├── MobileConnectionsList.tsx
│   │   │   ├── MobileSshAddSheet.tsx
│   │   │   ├── MobileGenerateKeySheet.tsx
│   │   │   ├── MobileShowPublicKey.tsx
│   │   │   └── MobileTestConnectionSheet.tsx
│   │   ├── activity/
│   │   │   ├── MobileActivityFeedScreen.tsx
│   │   │   ├── MobileActivityRow.tsx
│   │   │   └── MobileActivityDetail.tsx
│   │   ├── settings/
│   │   │   ├── MobileSettingsHome.tsx
│   │   │   ├── MobileMoshSettings.tsx
│   │   │   ├── MobileCacheSettings.tsx
│   │   │   ├── MobileDiagnostics.tsx
│   │   │   ├── MobileThemeSettings.tsx
│   │   │   └── MobileAbout.tsx
│   │   └── shell/
│   │       ├── MobileWelcome.tsx
│   │       ├── MobileOnboarding.tsx
│   │       ├── MobileNewProjectFlow.tsx
│   │       ├── MobileProjectSwitcherSheet.tsx
│   │       └── MobileConnectionDetailSheet.tsx
│   └── styles/
│       └── mobile-tokens.css   (mobile-specific overrides; <50 lines)
└── pages/                      (desktop pages — unchanged)
└── components/                 (desktop components — unchanged after migration extracts the Mobile* files)
```

### 8.4 Why Parallel Tree, Not Responsive

| Concern | Responsive (current) | Parallel tree (proposed) |
|---|---|---|
| Component structure | Same component handles both with `useIsMobile()` checks | Two distinct components |
| Touch handlers | Bolted into desktop component | Native to mobile component |
| Layout | Breakpoint variants of same layout | Layout designed mobile-first |
| Bundle size | Single bundle has both | Tree-shake possible at build time (future) |
| Test surface | One component, two render paths | Two components, one path each |
| Maintenance burden per feature | Touch-up two paths in one file | Touch-up one file per platform |
| Cognitive load when reading code | High (constant breakpoint checks) | Low (single platform context) |
| Risk of mobile/desktop regressions interfering | High | None — isolated trees |

Tree duplication cost is real but bounded by the shared backend (rspc/stores/hooks) and shared ui primitives. Estimated duplicate UI surface: ~30 mobile screens × ~200 LOC avg = ~6 k LOC of mobile-specific UI. Compare to current responsive approach which already has ~3 k LOC of mobile branches scattered across desktop components. Net cost: ~3 k LOC for materially better UX and lower future-feature cost.

### 8.5 Shared Backend Pattern

Mobile and desktop pull from the same:
- rspc client (`src/lib/rspc.ts`)
- All `src/hooks/use*Commands.ts` (server actions)
- All `src/stores/*.store.ts`
- Domain types (Task, Sprint, Epic, Session, Connection)

Mobile-only stores live in `src/mobile/stores/` (currently just `mobile-nav.store.ts`; expand if needed).

Mobile components compose desktop hooks. Example: `MobileTaskCard` calls `useTaskCommands().updateStatus()` — same as desktop.

---

## 9. Migration Path from Responsive Code

### 9.1 What to Delete

| File | Reason |
|---|---|
| `src/hooks/useIsMobile.ts` | Replaced by `useViewportClass()`; the hook itself can stay if any non-component logic needs it, but components stop importing it. |
| All `useIsMobile()` branches inside desktop components | Once mobile tree carries its own implementations, desktop components revert to desktop-only. |
| Mobile-specific Tailwind classes in desktop components (e.g., `lg:hidden`, `hidden lg:flex` for mobile-vs-desktop layout) | These become dead code in desktop tree. |
| Any responsive layout primitives used solely to handle mobile (e.g., `useQuadPaneLayout` mobile fallback) | Verify and excise. |

### 9.2 What to Move

Existing files at `src/components/**/Mobile*.tsx` move to `src/mobile/components/`:

```
src/components/terminal/MobileTerminal.tsx         → src/mobile/components/tasks/MobileTerminal.tsx
src/components/terminal/MobileTerminal.test.tsx    → src/mobile/components/tasks/MobileTerminal.test.tsx
src/components/layout/MobileBottomNav.tsx          → src/mobile/components/primitives/MobileTabBar.tsx (rename + rebuild for 5 tabs)
src/components/remote/MobileSshConnectionForm.tsx  → src/mobile/components/ssh/MobileSshConnectionForm.tsx
src/components/review/MobileReviewActionBar.tsx    → src/mobile/components/review/MobileReviewActionBar.tsx
src/components/review/MobileDiffViewer.tsx         → src/mobile/components/review/MobileDiffViewerScreen.tsx (rename to reflect screen role)
src/components/review/MobileFileTree.tsx           → src/mobile/components/review/MobileFileTreeSheet.tsx (refactor into sheet)
src/components/planning/MobileSessionDrawer.tsx    → src/mobile/components/planning/MobileSessionList.tsx (rebuild as screen, not drawer)
```

After move, search-and-replace imports in `src/` to update paths.

### 9.3 What to Keep

- All shared backend hooks and stores.
- All shadcn ui primitives (`src/components/ui/`).
- Theme tokens (`src/globals.css` — already mobile-friendly).
- All non-mobile desktop components — unchanged after their `useIsMobile` branches are removed.

### 9.4 What to Build Net New

- All 14 mobile primitives (§7.2).
- ~30 mobile screens (§2).
- `mobile-nav.store.ts` and `useViewportClass`.
- `MobileApp` and `MobileShell`.
- `useMobileBack`, `useSafeArea`, `useHaptic` hooks.

### 9.5 Migration Sequence (high level)

1. **Foundation** (Week 1): viewport router, `MobileApp` shell, `MobileTabBar`, primitives 1–6, `MobileScreen`, `MobileTopAppBar`, theme tokens passthrough. App is navigable but empty per tab.
2. **Board tab** (Week 1–2): `MobileColumnPager`, `MobileTaskCard`, board screen, drag-drop, filters. Replaces current responsive board.
3. **Tasks tab** (Week 2–3): list + workspace + sub-tabs + diff + review action bar. Reuses `MobileTerminal`, `MobileDiffViewer`.
4. **Planning tab** (Week 3): session list + chat screen + composer + persona picker + new-session flow + BMAD workflow sheet.
5. **Activity tab** (Week 3–4): feed + filters + detail.
6. **Settings tab** (Week 4): all 11 sub-screens + SSH wizard rebuilt as sheet.
7. **Shell flows** (Week 4): welcome, onboarding, project switcher, connection detail, crash recovery.
8. **Polish + a11y + perf** (Week 5): focus rings, screen reader, reduced-motion, performance budgets, loading skeletons.
9. **Real device validation** (Week 5–6): Pixel 6 + iPhone 15 testing of all journeys; fix.

Total estimate: 5–6 weeks of focused work — comparable to current Tauri Epic 3 effort but produces a coherent mobile UX rather than fragile responsive overlay.

### 9.6 Coexistence Strategy During Migration

While the mobile tree is being built, the existing responsive mobile UI continues to work. Approach:

- Add `MobileApp` next to current `App`. Viewport router starts with feature flag default `mobile-tree=false` (so all phones still use current responsive code).
- As each tab is completed, flip its corresponding flag (`mobile-tree=board`, `mobile-tree=planning`, etc.). Allows partial cutover and easy rollback per-tab.
- After all tabs complete and validated, remove flag and delete responsive mobile code.

---

## 10. Risks and Open Questions

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| xterm.js touch handling on mobile webview is finicky | Medium | High | `MobileTerminal` already exists and partially works. Budget time for two-finger pinch and long-press select. Fall back to a non-xterm read-only renderer for view-only modes. |
| @dnd-kit drag-drop conflicts with column-pager swipes | Medium | High | Clear gesture priority: long-press required to enter drag (already implemented per t3-3). Pager swipes only fire when not in drag mode. |
| Monaco Editor performance on low-end Android devices | High | Medium | Use existing `MobileDiffViewer` (custom, not Monaco) for diff display on mobile. Monaco only for editing — and editing is desktop-only for MVP. |
| Bottom sheet stacking + keyboard avoidance on Android | Medium | Medium | Use Tauri's keyboard-aware insets via `useSafeArea`. Test on Android keyboard with tall sheet. |
| iOS swipe-from-left back conflicting with column pager swipe | Medium | Low | Reserve leftmost 12 px as system gesture zone; column pager ignores swipes starting in that zone. |
| Activity stream performance with high-frequency events | Low | Medium | Virtualize feed list (react-virtuoso or equivalent). Throttle UI updates to 30 fps max. |
| Tauri webview on Android has older WebKit than expected | Medium | Medium | Test polyfills early; degrade gracefully on container queries, view transitions, etc. |

### 10.2 UX Open Questions

These need product/UX decisions before or during implementation:

| Question | Why it matters | Suggested default |
|---|---|---|
| **Q1.** Should a mobile user be able to create a new project from scratch on phone? | Project creation is heavy (git init, config wizard, tool health checks). Mobile users may not have CLI tools available. | **Default: no.** Mobile users open existing projects (local or remote). Hide "New Project" CTA on welcome. |
| **Q2.** Should activities filter chips be pinned or scrolled with feed? | Pinned = always reachable; takes vertical space. Scrolling = more feed real estate; loses access. | **Default: pinned.** Filtering is a top-2 user need. |
| **Q3.** Does mobile show the BMAD workflow as a tab pill, a top-of-screen banner, or a dedicated 6th tab? | Affects information architecture. | **Default: pill (§5.4).** A 6th tab over-allocates IA real estate to a feature that's mostly read-only. |
| **Q4.** Does mobile support concurrent multi-task workspace (10+ tasks open simultaneously like desktop)? | Tab/screen state preservation cost. | **Default: yes for state, no for UI affordance.** Each visited task workspace preserves state (via Zustand). UI does not show a "switcher" — user navigates via Tasks tab. |
| **Q5.** What happens when a long-running terminal session has 100k+ scrollback lines? | Performance + memory on mobile webview. | **Default: cap at 5k lines visible** + "Load more" button. Backup to filesystem unchanged. |
| **Q6.** Should mobile have a command palette? | Power-user keyboard substitute. | **Default: defer to Phase-2.** Mobile users prefer touch for now. |
| **Q7.** Tablet form factor — when does mobile tree handle it? | Android tablets with 800 dp+ width fall in tweener zone. | **Default for MVP: treat as mobile.** Phase-4 adds tablet adaptive (two-pane on Tasks, side-by-side diff). |
| **Q8.** Push notifications? | Mobile-native expectation. | **Default: defer to Phase-3** (already in plan). |

### 10.3 Things That Will Not Translate Well

Be honest about it:

- **Multiple terminal panes.** Desktop's docked terminal alongside the board has no mobile analog. Mobile uses sub-tab inside Task Workspace. Consequence: mobile user can't watch terminal while triaging board.
- **Complex YAML editing.** Project config editing on mobile is painful. Provide read-only view + "Edit on desktop" prompt.
- **Inline code commenting on diff.** Desktop has fluent click-to-comment on diff lines. Mobile defers to Phase-2; long-press will eventually trigger inline comment sheet.
- **Wide-table data.** Velocity charts, sprint burndown — render reasonably on phone but lose detail. Acceptable trade-off.
- **Multi-window workflows.** Desktop power-users open multiple windows; mobile is single-screen. Acceptable.

### 10.4 Things to Prototype Before Committing

1. `MobileColumnPager` — drag-edge auto-advance + drop on scrolling target. Highest-risk interaction in the plan. Build a 1-day prototype with 5 fake columns and 50 cards. Verify FPS on Pixel 6 mid-tier device.
2. `MobileTerminal` keyboard accessory bar — verify Android keyboard insets play well with sticky bar.
3. xterm.js pinch-to-zoom — confirm 60 fps zoom on real device.
4. Bottom sheet drag handle physics — verify snap points feel native on both Android and iOS.
5. Activity feed real-time stream with new-event highlight glow — verify smooth animation under load.

If any of the five prototypes shows fundamental blockers, surface in the next sprint correction.

---

## 11. Acceptance Criteria for "Mobile UX Done Right"

These are the criteria the next mobile epic will measure against. They're stricter than what T3.1–T3.8 aimed at, because the previous bar was "responsive layout works" and the new bar is "mobile-native experience."

### 11.1 Architecture Criteria

- [ ] All mobile UI lives under `src/mobile/`. Zero `useIsMobile()` calls from `src/components/` (desktop tree).
- [ ] Mobile and desktop apps mount via `<MobileApp />` vs `<DesktopApp />` decision at App.tsx root, made once per session.
- [ ] All shared logic (rspc, stores, hooks) is consumed by both trees identically.
- [ ] Bundle analysis shows mobile-only code does not ship in desktop bundle (Phase-2 target via Vite split chunks).

### 11.2 IA & Navigation Criteria

- [ ] 5-tab bottom navigation (Board / Planning / Tasks / Activity / Settings) on every authenticated screen.
- [ ] Each tab maintains independent back-stack + scroll position.
- [ ] Hardware back / swipe-back goes back within tab, never across tabs.
- [ ] Long-press tab returns to that tab's root.
- [ ] Tab badges accurate within 500 ms of underlying state change.
- [ ] All deep links from §1.4 resolve to correct screen with correct stack.

### 11.3 Per-Feature Criteria

| Feature | Acceptance |
|---|---|
| Kanban | Single-column-with-peek pager scrolls at 60 fps; drag-drop with edge-reveal works on Pixel 6 + iPhone SE; long-press → drag latency <100 ms |
| Planning | New session → first message latency <2 s; concurrent 5 sessions confirmed; streaming response renders incrementally |
| Task workspace | Sub-tab swipe latency <100 ms; sub-tab state preserved across navigation |
| Terminal | xterm.js renders stream at <500 ms latency; keyboard accessory bar visible above keyboard; pinch-zoom at 60 fps |
| Review | Approve / Request Changes / Reject all functional; review action bar in thumb zone; offline queue works |
| SSH | Add connection wizard completes in <5 minutes; test connection mandatory before save; key generation <2 s |
| Activity | Real-time stream with <500 ms latency; filter chip toggles instantly; live indicator visible during stream |
| Project switcher | Sheet opens in <200 ms; switching project completes in <1 s; remote project status accurate |
| Settings | All 11 sub-screens reachable; diagnostics copy works; cache clear confirmed |

### 11.4 Quality Bar

- [ ] All touch targets ≥ 44 × 44 pt on iOS and ≥ 48 × 48 dp on Android (WCAG 2.5.5 AAA where feasible, AA minimum).
- [ ] All text supports system font scaling up to 200 % without truncation of critical info (status, connection name, task title).
- [ ] All status indicators are color + icon (UX-DR19).
- [ ] All animations respect `prefers-reduced-motion`.
- [ ] All screens have an empty state with guidance.
- [ ] All screens have a loading state (skeleton or progress).
- [ ] All errors recover gracefully via inline retry; no dead-end screens.
- [ ] Test on real Pixel 6 + iPhone SE 3rd gen + iPhone 15 Pro for each screen.
- [ ] WCAG AA contrast (4.5:1) verified across dark and light themes.

### 11.5 Performance Bar

- [ ] App cold start to Welcome / Board screen: <2 s on 2022+ devices.
- [ ] Tab switch: <100 ms.
- [ ] Sub-tab swipe: <100 ms.
- [ ] Sheet open: <200 ms.
- [ ] Drag-drop frame rate: ≥55 fps sustained.
- [ ] Terminal stream: <500 ms latency.
- [ ] Activity feed scrolling: ≥55 fps with 500 events loaded.
- [ ] Memory: <250 MB on Pixel 6 mid-tier.

---

## 12. What This Plan Does Not Cover

Out of scope for the immediate redesign:

- Tablet layouts (Phase-4).
- Foldables (Phase-4).
- Push notifications (Phase-3).
- Voice input (Phase-4).
- Widget support (Phase-4).
- Watch companion (out of scope entirely).
- Desktop UX changes (this is mobile-only redesign).
- Backend changes (rspc/Rust services unchanged).
- Build pipeline changes (Tauri Android/iOS already configured per T3.1).

If any of these become priorities, write a separate change proposal.

---

## 13. Summary — Why This Plan

The current responsive approach optimized for code reuse. It produced a desktop UI that *also* renders on phones. Each mobile bug fix patched the symptom; the substrate stayed wrong.

The parallel-tree approach optimizes for **mobile UX quality**. Two UI codebases, one shared backend. Mobile gets thumb-first ergonomics, native gestures, full-screen flows. Desktop stays a power-user keyboard-first workspace. Neither compromises the other.

Cost: ~6 k LOC of mobile-specific UI; ~5–6 weeks of focused work to retire current responsive code and stand up the parallel tree.

Benefit: a mobile experience that earns the four memorable moments — **the train reconnect**, **the drag-reveal**, **the approve-and-pocket**, **the streaming agent** — moments that no responsive miniaturization can deliver.

Mobile is no longer a smaller desktop. It's its own product, sharing TinSu's heart.

---

## Appendix A — Mobile Visual Reference (Calm Command Mobile)

### A.1 Color Tokens (mobile uses)

Identical to desktop UX-DR1 tokens. Mobile heightens use of `--status-running` (active sessions) and `--status-review` (pending reviews) because those are the badges users hunt for on mobile.

### A.2 Typography Scale Adjustment

| Role | Desktop | Mobile |
|---|---|---|
| H1 | 24 px / 600 | 22 px / 600 |
| H2 | 18 px / 600 | 17 px / 600 |
| H3 | 14 px / 500 | 14 px / 500 |
| Body | 14 px / 400 | 15 px / 400 ⬆️ (legibility on phone) |
| Small | 12 px / 400 | 12 px / 400 |
| Mono | 13 px / 400 | 13 px / 400 |
| Tab label | n/a | 10 px / 600 uppercase tracking-wider |
| Status pill | 11 px / 500 | 11 px / 500 |

### A.3 Spacing & Sizing on Mobile

| Token | Value |
|---|---|
| Content margins | 16 px (matches desktop) |
| Card padding | 12 px (tighter than desktop's 16 px) |
| Sub-tab bar height | 44 px |
| Bottom tab bar height | 56 px + safe-area-inset-bottom |
| TopAppBar height | 56 px (collapsed) / 96 px (expanded) |
| Sticky bottom action bar | 64 px + safe-area-inset-bottom |
| Sheet drag handle | 4 px tall × 32 px wide, top 8 px |
| Touch target minimum | 44 px (iOS) / 48 dp (Android) |
| Inter-target spacing | 8 px minimum |

### A.4 Motion

- Tab switch: cross-fade 150 ms.
- Screen push: slide-from-right 250 ms easeOut (iOS) / fade-and-rise 200 ms (Android).
- Sheet open: slide-up 250 ms easeOut + backdrop fade 150 ms.
- Card lift on long-press: scale 1.0 → 1.04 + shadow over 150 ms.
- Drag-drop drop: spring (stiffness 300, damping 26).
- Activity event new: glow fade-out 1500 ms.
- All motion disabled when `prefers-reduced-motion: reduce`.

### A.5 Haptics

| Event | Pattern |
|---|---|
| Long-press to drag | Light impact |
| Drop on column | Medium impact |
| Drop fail | Failure (double light) |
| Approve | Success haptic |
| Reject | Warning haptic |
| Connection established | Success haptic |
| Connection lost | Warning haptic |
| Tab switch | Selection feedback (subtle) |
| Sheet snap | Selection feedback |

Use `navigator.vibrate()` on Android; iOS Tauri webview supports `Taptic Engine` via plugin.

---

*End of Mobile UX Redesign Plan.*
*Length: this document is intentionally exhaustive so that the implementing agents have everything they need without further design rounds.*
*Next step: produce the Sprint Change Proposal that supersedes the responsive-mobile T3.x stories with stories implementing this plan.*
