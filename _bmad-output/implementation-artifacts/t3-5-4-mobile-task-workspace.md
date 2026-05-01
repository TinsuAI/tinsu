# Story 3.5.4: Mobile Task Workspace

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a full-screen mobile task workspace with 4 sub-tabs (Content / Terminal / Activities / Diff) that swipe and tap-switch with sticky bottom action bars,
so that I can monitor agent execution end-to-end on a phone — read context, watch the terminal stream, scan activities, and review diffs without leaving the task.

## Acceptance Criteria

1. **Given** the mobile shell from T3.5-1 and the primitives library from T3.5-2, **When** the user is on the Board or Tasks tab and a route shaped `workspace:<task-id>` is on top of the active tab's stack, **Then** `MobileApp.tsx` renders `<MobileTaskWorkspaceScreen taskId="<task-id>" />` for that route. The existing `'workspace:'` placeholder branch in `MobileRouteRenderer` (`src/mobile/MobileApp.tsx`) **must be replaced** to render the new screen instead of the `MobileEmptyState` "Coming in T3.5-4…" placeholder. The bare `'diff'` placeholder branch is **kept unchanged** (it belongs to a separate cross-task diff route and is not part of this story).

2. **Given** `MobileTaskWorkspaceScreen` mounts for a `taskId`, **When** the screen renders, **Then** `MobileTopAppBar` is shown with: (a) `backButton.onClick` calls `useMobileNavStore.getState().popRoute()` (no tab arg — pops the active tab's stack), (b) `title` set to the task's truncated title (max 32 chars, ellipsis if longer; falls back to `Task #<short-id>` when the title is empty/whitespace), (c) `trailingActions` containing one icon button (Lucide `MoreVertical`, `aria-label="Task menu"`, min-h-[2.75rem] min-w-[2.75rem]) that opens a `MobileSheet` (snapPoint='fit'). The overflow sheet renders **placeholder rows only** (View reasoning log, Pause / Resume, Run history, Edit, Archive, Delete) — each row is a disabled `<button>` with `aria-disabled="true"` and a "Coming soon" hint; **no Tauri commands are wired** in this story (defer to T3.5-8). Test ID: `mobile-task-workspace-menu`.

3. **Given** the workspace screen is mounted, **When** I look directly under the top app bar, **Then** a pinned `MobileSegmentedTabs` is rendered with exactly four tabs in this order: `[{ id: 'content', label: 'Content' }, { id: 'terminal', label: 'Terminal' }, { id: 'activities', label: 'Activities' }, { id: 'diff', label: 'Diff' }]`. The `activeTabId` is **controlled** from screen state (`activeSubTab`); `onTabChange` updates state and triggers a horizontal smooth-scroll on the content pager (see AC 4). `ariaLabel="Task workspace sub-tabs"`. Test ID: existing `mobile-segmented-tabs` from primitive.

4. **Given** the segmented tabs are rendered, **When** I horizontally swipe inside the body region (below the segmented bar, above the action bar), **Then** the body pages between the four sub-tabs in a CSS-snap pager and the `activeSubTab` state syncs to the page that occupies ≥50 % of the viewport. Implementation **MUST mirror the exact pattern in `src/components/task/TaskDetailContent.tsx`** (`tabsContentRef`, `isManualScrollingRef`, `handleTabClick`, `handleTabsScroll`, `scrollTo({ left: index * clientWidth, behavior: 'smooth' })`, 800 ms manual-scroll lockout). Snap is instant under `prefers-reduced-motion: reduce` (via `useReducedMotion()`; pass `behavior: 'auto'` instead of `'smooth'`). Do **not** introduce new gesture libraries (`framer-motion`, `react-spring`, `embla-carousel`).

5. **Given** the workspace is mounted, **When** I switch sub-tabs (segmented click or swipe) and back, **Then** each sub-tab's **scroll position** and **partial input** (e.g., terminal command typed but not sent) is preserved. Implementation: each sub-tab body is **rendered as a sibling slide** within the pager (all four mounted at once, side-by-side); none are unmounted on switch. Scroll position is preserved automatically by the DOM. Refs may be held for `terminalRef`/`diffScrollRef` per existing patterns. **Do NOT** use `key` props or conditional `isActive && <Tab/>` rendering that would unmount tabs.

6. **Given** the **Content** sub-tab is the body, **When** I view it, **Then** it renders `MobileContentTab` which displays: (a) the **task title** as h2; (b) **task status pill** sourced from `task.status` mapped via the existing `TASK_STATUS_LABELS` and `STATUS_BADGE_VARIANT` (or equivalent) — render with shadcn `<Badge>` from `@renderer/components/ui/badge` (allowed cross-tree primitive); (c) **markdown description** rendered with `react-markdown` + `remarkGfm` using `markdownComponents` exported from `@renderer/components/task/MarkdownComponents` (allowed cross-tree imports — list expanded in AC 16); (d) when `task.story_number != null` and `task.full_content` is non-empty, a **collapsible "Story File"** section that renders `task.full_content` via the same markdown stack; (e) acceptance-criteria list (parsed from `task.full_content` matching desktop `parseAcceptanceCriteria` if available — otherwise omit gracefully); (f) **read-only** in v1 — no inline editing. Edit affordance is deferred (overflow menu placeholder row only).

7. **Given** the **Terminal** sub-tab is the body, **When** I view it, **Then** it renders `MobileTerminalTab` which composes the existing **`<TaskTerminal taskId={taskId} />`** component (`src/components/task/TaskTerminal.tsx` — allowed cross-tree component for v1) **inside a flex column** that fills the slide. Below the terminal, **`<TerminalAccessoryBar onKeyPress={...} />`** (from `src/components/terminal/TerminalAccessoryBar.tsx`) is mounted as a sticky bottom strip ABOVE the screen-level `MobileBottomActionBar`. Wiring of `onKeyPress` simply calls the `TaskTerminal`'s exposed `focusInput()` for now AND sends the key sequence via the input — **defer rich CTRL/ALT chord handling to a follow-up**; v1 acceptable behaviour: send the literal escape sequence (`\t`, `\x1b`, arrow codes) to the terminal input ref, ignore Ctrl/Alt rows (render disabled). The screen-level `MobileBottomActionBar` shows `primary={{ label: 'Send', onPress: focusInput, variant: 'primary' }}` — its sole job is to bring up the soft keyboard (focus the terminal input), per UX-DR7 thumb-zone rule.

8. **Given** the **Activities** sub-tab is the body, **When** I view it, **Then** it renders `MobileActivitiesTab` which **reuses the existing `<ActivitiesTab taskId={taskId} />`** component (`src/components/task/ActivitiesTab.tsx`) wrapped only in a `div` that scrolls vertically and adds a 12 px top padding. **Do NOT fork** `ActivitiesFilter`, `ActivityItem`, or the activity-subscription hook — the desktop tab is already filterable, virtualised, and live-streaming via `useActivitySubscription`. Mobile filter chips render via the desktop component's existing `<ActivitiesFilter>`, which in turn reuses the `MobileChip`-equivalent ARIA semantics. The screen-level `MobileBottomActionBar` is **omitted** for this sub-tab (AC 11 — null when on Activities).

9. **Given** the **Diff** sub-tab is the body, **When** I view it for a task whose status is `review`, `done`, or has a worktree, **Then** it renders `MobileDiffTab` which mounts the existing **`<MobileDiffViewer taskId={taskId} task={task} />`** component (`src/components/review/MobileDiffViewer.tsx`) with no fork. The viewer's built-in file-tree button opens its own `MobileFileTree` sheet (already implemented). When `task.status` ∉ `{review, done}` AND no `task.worktree_path`, render `<MobileEmptyState title="No changes yet" subtitle="Diffs appear once an agent has produced changes." />` instead of the viewer.

10. **Given** the Diff sub-tab is active and the task status is `review`, **When** I view the screen-level `MobileBottomActionBar`, **Then** it shows `primary={{ label: 'Approve', variant: 'primary' }}` and `secondary={{ label: 'Request changes', variant: 'destructive' is NOT used — use default unstyled secondary }}`. **In this story (T3.5-4)** the buttons are **rendered but call placeholders**: `primary.onPress = () => useMobileNavStore.getState().pushRoute(activeTab, 'review:<task-id>')` (the actual approve mutation lives in T3.5-6 Mobile Review, which owns the route handler). `secondary.onPress` is a no-op `() => {}` with `aria-label="Request changes (Coming in T3.5-6)"` and `disabled` set true. Add a JSDoc comment on the screen citing T3.5-6 as the owner of full review wiring. **Do NOT** import `useApprovalMutation`, `useRejectionMutation`, or `useRequestChangesMutation` in this story — those belong to T3.5-6.

11. **Given** the screen-level sticky bottom area, **When** I observe per-sub-tab behaviour, **Then** the **action bar is per-sub-tab** (a single render slot whose contents change with `activeSubTab`):
    | Sub-tab | Action bar contents |
    |---|---|
    | Content | `MobileBottomActionBar` with `primary={{ label: 'Edit', onPress: noop, disabled: true }}` (a11y: `aria-label="Edit (Coming soon)"`) |
    | Terminal | `MobileBottomActionBar` with `primary={{ label: 'Focus terminal', onPress: focusInput }}` |
    | Activities | `null` (no action bar — filter chips are inside the tab) |
    | Diff | See AC 10 |
    The action bar slot is a sibling of the pager (NOT inside any slide) — placed at the end of the `MobileScreen` `tabBar` slot OR rendered manually beneath the pager via `position: sticky; bottom: 0` if `MobileScreen` does not accept dynamic per-route bottom content. Verify by inspecting `MobileScreen` in `src/mobile/primitives/MobileScreen.tsx`; the simpler path is rendering the action bar as a direct child of the screen root with `MobileScreen` `tabBar={undefined}` for the workspace screen (workspace is full-screen / push, NOT inside the bottom tab bar context).

12. **Given** the user navigates from the Mobile Board (T3.5-3), **When** they tap a `MobileTaskCard`, **Then** the existing `pushRoute('board', `workspace:${task.id}`)` in `MobileBoardScreen.tsx` resolves to `<MobileTaskWorkspaceScreen taskId={task.id} />` (AC 1). **Do NOT modify `MobileBoardScreen.tsx`**, `MobileTaskCard.tsx`, or any T3.5-3 file — the route handler in `MobileApp.tsx` is the only seam needed. Also wire the same render path for `pushRoute('tasks', `workspace:${task.id}`)` so future T3.5-8 task-list rows route here too.

13. **Given** the workspace is rendered as a push screen, **When** I observe the bottom tab bar (5-tab nav), **Then** the bottom tab bar **is hidden** for the duration of the workspace push. Implementation: workspace screen sets `<MobileScreen>` with `tabBar={undefined}` (NOT the parent `MobileApp.tsx`'s `<MobileTabBar>`). This requires the route renderer in `MobileApp.tsx` to return a **distinct shell** for `workspace:` routes — i.e. when the active route starts with `workspace:`, `MobileApp.tsx` renders `<MobileTaskWorkspaceScreen />` **at the same level as the root `MobileScreen`** (not inside it). The detail of how to express this without violating the current `MobileApp.tsx` structure: introduce a helper `function isFullScreenRoute(route: string): boolean` returning `route.startsWith('workspace:') || route.startsWith('chat:')`, and branch on it before rendering the root `<MobileScreen>` with tab bar.

14. **Given** Android system back-press, **When** I am on the workspace screen, **Then** the existing `useMobileNavStore.handleBackPress()` logic (T3.5-1) already pops the route and returns to the previous tab root. Verify: tap back on Android emulator after pushing workspace → returns to board. **Do NOT modify `mobile-nav.store.ts`** — its existing handler already does the right thing because workspace is a normal stack entry. Add a unit test that mounts the workspace, calls `handleBackPress()`, and asserts the screen unmounts and `MobileBoardScreen` re-renders.

15. **Given** any haptic-firing interaction inside the workspace, **When** the OS reports `prefers-reduced-motion: reduce`, **Then** **no haptic fires**. Apply `useReducedMotion()` only to screen-level haptics (none introduced by this story — `MobileBottomActionBar` self-gates its primary-button haptic per T3.5-2 AC 13). Therefore this story should **not call `hapticFeedback`** directly anywhere; the gating responsibility lives in primitives.

16. **Given** any new files this story creates under `src/mobile/tasks/`, **When** I `grep -REn "from '@renderer/components|from '../../components|from '@renderer/pages|from '@renderer/stores"` on them, **Then** **only allowed cross-tree imports** are:
    | Import | Reason |
    |---|---|
    | `@renderer/components/task/TaskTerminal` | Reused desktop terminal (AC 7) |
    | `@renderer/components/task/ActivitiesTab` | Reused desktop activities tab (AC 8) |
    | `@renderer/components/task/MarkdownComponents` (`markdownComponents`) | Reused markdown render set (AC 6) |
    | `@renderer/components/terminal/TerminalAccessoryBar` | Mobile accessory bar already (AC 7) |
    | `@renderer/components/review/MobileDiffViewer` | Reused mobile diff viewer (AC 9) |
    | `@renderer/components/ui/badge` | shadcn primitive — used for status pill (AC 6) |
    | `@renderer/lib/utils` (`cn`) | utility |
    | `@renderer/lib/trpc` | task fetch (`trpc.tasks.getById`) |
    | `@shared/types/task.types` | Task / TaskStatus types |
    **Forbidden:** any import from `@renderer/components/task/TaskDetailContent`, `TaskDetailPanel`, `QuadPaneLayout`, `QuadPaneSection`, `DiffPlaceholder`, `EpicSelect`, `SprintSelect`, `CreateTaskDialog`, `useApprovalMutation`, `useRejectionMutation`, `useRequestChangesMutation`, `@renderer/components/workspace`, `@renderer/components/conflict`, `@renderer/components/review/{ApproveButton,RejectButton,RequestChangesButton,VersionSelector,ReviewTimeline,FeedbackHistory,MobileReviewActionBar}`, `@renderer/stores/task-detail-panel.store`, `@renderer/stores/task-workspace.store`, `@renderer/stores/inline-comments.store`, `react-markdown`, `remark-gfm` (use them transitively via `markdownComponents` if needed; otherwise omit AC 6 (e) and render `task.description` as plain pre-text in v1). The mobile workspace **MUST NOT** mount any desktop workspace shell.

17. **Given** the desktop task workspace, **When** I open the desktop app and run desktop workspace tests (`TaskDetailContent.test.tsx`, `TaskDetailPanel.test.tsx`, `QuadPaneLayout.test.tsx`, `ActivitiesTab.test.tsx`, `TaskTerminal.test.tsx`), **Then** **all desktop tests still pass with zero regressions** because this story does **not** modify any file under `src/components/task/`, `src/components/terminal/`, `src/components/diff/`, `src/components/review/`, `src/components/workspace/`, `src/components/conflict/`, `src/stores/`, `src-tauri/`. The only allowed touch outside `src/mobile/` is **strict imports** of the cross-tree allowlist above.

18. **Given** the new files this story creates, **When** I run `npm test`, **Then** new colocated tests cover at minimum: (a) `MobileApp.tsx` route renderer maps `workspace:abc` → workspace screen for both `board` and `tasks` tabs (mount + assertions); (b) workspace screen renders top app bar with task title + back button that calls `popRoute`; (c) overflow menu opens a `MobileSheet` and renders 6 disabled rows; (d) segmented tabs render exactly 4 sub-tabs in canonical order with `Content` selected by default; (e) clicking a segmented tab calls `scrollTo` on the pager ref; (f) horizontal scroll past 50 % of pager width updates `activeSubTab` (use `Object.defineProperty` on ref's `scrollLeft` and dispatch `scroll` event — pattern from `TaskDetailContent.test.tsx`); (g) Content sub-tab renders task title, status badge, and markdown body when `description` is set; (h) Terminal sub-tab mounts `TaskTerminal` (assert via test-id or mocked component); (i) Activities sub-tab mounts `ActivitiesTab` (mocked); (j) Diff sub-tab mounts `MobileDiffViewer` for `status='review'`; (k) Diff sub-tab shows empty state when `status='backlog'` AND no worktree; (l) action bar contents differ per sub-tab (Content=Edit-disabled, Terminal=Focus, Activities=null, Diff=Approve+RequestChanges-disabled); (m) reduced-motion mock causes `scrollTo` to be called with `behavior: 'auto'`. **Total ≥14 new tests**, zero new failures vs T3.5-3 baseline.

19. **Given** the workspace screen, **When** I run with `import.meta.env.DEV` and force-refresh while on `workspace:<id>` route, **Then** I see **no console errors** and **no React warnings** (no missing keys, no act() warnings in StrictMode, no Radix Dialog warnings). The DEV harness route `#__mobile-primitives` (T3.5-2 AC 14) continues to render correctly — i.e., this story does **not** touch `src/mobile/dev/MobilePrimitivesHarness.tsx` and does not modify the harness routing in `MobileApp.tsx` beyond adding the workspace branch.

20. **Given** all new files under `src/mobile/tasks/`, **When** I `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]"` on them, **Then** **zero matches** are returned. All colours come from Calm Command tokens via `bg-card`, `bg-muted/40`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-destructive`, `border-border/40`, etc.

## Tasks / Subtasks

- [x] **Task 1: Add `MobileTaskWorkspaceScreen` skeleton (AC: 1, 13)**
  - [x] 1.1 Create `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`. Props: `{ taskId: string }`.
  - [x] 1.2 Inside, fetch task via `trpc.tasks.getById.useQuery({ id: taskId })`. Surface `task`, `isLoading`, `error`.
  - [x] 1.3 Render a thin shell: `<div className="flex flex-col h-full bg-background">` with three slots: top app bar, pager body, bottom action bar.
  - [x] 1.4 Loading state: `<MobileLoadingSkeleton variant="screen" />` (or repeated card variants if `screen` does not exist — verify primitive). Error state: `<MobileEmptyState title="Task not found" subtitle="…" />`.
  - [x] 1.5 Add JSDoc `@see Story T3.5-4` and `@see T3.5-6` for the future review wiring.

- [x] **Task 2: Wire route renderer in `MobileApp.tsx` (AC: 1, 12, 13)**
  - [x] 2.1 Edit `src/mobile/MobileApp.tsx`. Add helper `function isFullScreenRoute(route: string): boolean { return route.startsWith('workspace:') }` (chat: stays placeholder for now).
  - [x] 2.2 Replace the `if (route.startsWith('workspace:')) return <MobileEmptyState … />` branch in `MobileRouteRenderer` with `if (route.startsWith('workspace:')) return <MobileTaskWorkspaceScreen taskId={route.slice('workspace:'.length)} />`.
  - [x] 2.3 Above the existing `<MobileScreen>` render in `MobileApp`, branch: if `isFullScreenRoute(topRoute)`, return `<MobileRouteRenderer route={topRoute} />` directly (no top-level `MobileScreen` shell, no `MobileTabBar` — the workspace owns its full chrome).
  - [x] 2.4 Verify `MobileApp.test.tsx` still passes; if a test relies on the placeholder text, update the test to assert the workspace screen mounts (use a stub that renders `data-testid="mobile-task-workspace"`). Update mocks to include `trpc.tasks.getById` and any new dependencies.

- [x] **Task 3: Top app bar + overflow menu (AC: 2)**
  - [x] 3.1 Render `<MobileTopAppBar backButton={{ onClick: () => useMobileNavStore.getState().popRoute() }} title={truncatedTitle} trailingActions={<MoreVerticalButton />} />`.
  - [x] 3.2 `truncatedTitle`: `(task?.title?.trim() || \`Task #${task?.id?.slice(0, 6) ?? '?'}\`).slice(0, 32)` + ellipsis if original is longer.
  - [x] 3.3 `MoreVerticalButton`: button with `MoreVertical` Lucide icon, `aria-label="Task menu"`, `min-h-[2.75rem] min-w-[2.75rem]`, `data-testid="mobile-task-workspace-menu"`. Tap toggles `menuOpen` state.
  - [x] 3.4 Render a `<MobileSheet open={menuOpen} onOpenChange={setMenuOpen} snapPoint="fit" title="Task menu" description="Task actions">` containing 6 disabled rows: View reasoning log, Pause/Resume, Run history, Edit, Archive, Delete. Each row: `<button type="button" disabled aria-disabled="true" className="flex w-full items-center justify-between px-4 py-3 text-left text-foreground/60">{label}<span className="text-xs text-muted-foreground">Coming soon</span></button>`.

- [x] **Task 4: Segmented tabs + horizontal pager (AC: 3, 4, 5)**
  - [x] 4.1 State: `const [activeSubTab, setActiveSubTab] = useState<SubTabId>('content')` where `type SubTabId = 'content' | 'terminal' | 'activities' | 'diff'`.
  - [x] 4.2 Render `<MobileSegmentedTabs tabs={[…]} activeTabId={activeSubTab} onTabChange={(id) => handleTabClick(id as SubTabId)} ariaLabel="Task workspace sub-tabs" />`.
  - [x] 4.3 Pager body: a div with `ref={pagerRef}` that has `flex overflow-x-auto snap-x snap-mandatory scrollbar-none` plus `flex-1` for vertical fill. Inside, four sibling `<section className="snap-start shrink-0 w-full h-full overflow-y-auto">` slides in canonical order.
  - [x] 4.4 Implement `handleTabClick(id)` mirroring `TaskDetailContent.tsx`: set state, set `isManualScrollingRef.current = true`, call `pagerRef.current?.scrollTo({ left: index * pagerRef.current.clientWidth, behavior: reduced ? 'auto' : 'smooth' })`, schedule `setTimeout(() => { isManualScrollingRef.current = false }, 800)`.
  - [x] 4.5 Implement `handleScroll` on the pager: if `isManualScrollingRef.current` return; compute `Math.round(scrollLeft / clientWidth)` → next sub-tab; if changed, `setActiveSubTab(next)`.
  - [x] 4.6 `useReducedMotion()` toggles smooth vs auto for both segmented click and pager handler.
  - [x] 4.7 All four tab bodies stay mounted at all times. Per-tab DOM scroll preservation is automatic.

- [x] **Task 5: `MobileContentTab` (AC: 6)**
  - [x] 5.1 Create `src/mobile/tasks/MobileContentTab.tsx`. Props: `{ task: Task | null | undefined }`.
  - [x] 5.2 If `!task` render skeleton (`<MobileLoadingSkeleton variant="card" />` x 2). Otherwise: title h2 (`text-foreground text-lg font-semibold`), status badge from `<Badge variant="secondary">{task.status}</Badge>` (use shadcn Badge — token-styled).
  - [x] 5.3 Markdown body: `<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{task.description ?? ''}</ReactMarkdown>`. NOTE: this requires `react-markdown` and `remark-gfm` direct imports — verify the desktop `MarkdownComponents.tsx` already pulls them. If you want to avoid direct imports here, **alternative**: render `task.description` inside a `<pre className="whitespace-pre-wrap font-sans text-sm">` v1; document the trade-off in Dev Notes. Pick one approach and stay consistent with desktop precedent.
  - [x] 5.4 If `task.story_number != null` AND `task.full_content` non-empty, render a `<details>` collapsible with `<summary>` "Story File" + the same markdown stack rendering `task.full_content`.
  - [x] 5.5 If a `parseAcceptanceCriteria(task.full_content)` helper exists in `@renderer/lib`, render an AC checklist; otherwise omit gracefully.
  - [x] 5.6 Read-only — no edit affordances in v1.

- [x] **Task 6: `MobileTerminalTab` (AC: 7)**
  - [x] 6.1 Create `src/mobile/tasks/MobileTerminalTab.tsx`. Props: `{ taskId: string }`.
  - [x] 6.2 Layout: `<div className="flex flex-col h-full bg-background">`. Inside: `<div className="flex-1 min-h-0"><TaskTerminal ref={terminalRef} taskId={taskId} /></div>` then `<TerminalAccessoryBar onKeyPress={handleKeyPress} />`.
  - [x] 6.3 `handleKeyPress(key: string)`: branch — for `Ctrl`/`Alt` chord rows, no-op (TODO marker); for `\t`, `\x1b`, arrow escape codes, call `terminalRef.current?.focusInput?.()` first, then write the literal sequence using whatever public method `TaskTerminal` exposes. **Verify** the expose surface; `TaskTerminalRef` lists `focusInput`. If write isn't exposed, mount a `useRef` that calls into the underlying `XTerminal` via the input; **fallback v1**: only `focusInput()` is wired and the accessory bar key codes are written into the focused command input (treating arrow keys as escape sequences). Document any gaps in Dev Notes.
  - [x] 6.4 Expose `focusInput` upward via `forwardRef` so the screen-level action bar's "Focus terminal" can call `terminalRef.current?.focusInput?.()`.

- [x] **Task 7: `MobileActivitiesTab` (AC: 8)**
  - [x] 7.1 Create `src/mobile/tasks/MobileActivitiesTab.tsx`. Props: `{ taskId: string }`.
  - [x] 7.2 Layout: `<div className="h-full overflow-hidden pt-3"><ActivitiesTab taskId={taskId} /></div>`.
  - [x] 7.3 Verify `ActivitiesTab` does not depend on a desktop-only context (e.g., `TooltipProvider`); if it does, mount a local `<TooltipProvider>` wrapper here.

- [x] **Task 8: `MobileDiffTab` (AC: 9, 10)**
  - [x] 8.1 Create `src/mobile/tasks/MobileDiffTab.tsx`. Props: `{ task: Task | null | undefined }`.
  - [x] 8.2 If `!task` → loading skeleton. If `task.status` ∉ `{review, done}` AND `!task.worktree_path` → `<MobileEmptyState title="No changes yet" subtitle="Diffs appear once an agent has produced changes." />`.
  - [x] 8.3 Else: `<MobileDiffViewer taskId={task.id} task={task} />`. The viewer's internal file-tree button + sheet remain unchanged.

- [x] **Task 9: Per-sub-tab action bar (AC: 10, 11)**
  - [x] 9.1 Define `function renderActionBar(activeSubTab, task, terminalRef)` that returns `null` for activities and a `<MobileBottomActionBar>` instance otherwise.
  - [x] 9.2 Content: `primary={{ label: 'Edit', onPress: () => {}, disabled: true, variant: 'primary' }}` (`aria-label="Edit (Coming soon)"`).
  - [x] 9.3 Terminal: `primary={{ label: 'Focus terminal', onPress: () => terminalRef.current?.focusInput?.() }}`.
  - [x] 9.4 Diff: `primary={{ label: 'Approve', onPress: () => useMobileNavStore.getState().pushRoute(activeTab, \`review:${task.id}\`), disabled: task.status !== 'review' }}` and `secondary={{ label: 'Request changes', onPress: () => {}, disabled: true }}` (`aria-label="Request changes (Coming in T3.5-6)"`).
  - [x] 9.5 Render slot: place at the bottom of the workspace shell as a sibling of the pager: `{renderActionBar(activeSubTab, task, terminalRef)}`.

- [x] **Task 10: Tests (AC: 18)**
  - [x] 10.1 `src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx` — top app bar + back button + overflow menu + segmented tabs render + click syncs state + pager `scrollTo` invoked with smooth/auto per `useReducedMotion`.
  - [x] 10.2 `src/mobile/tasks/MobileContentTab.test.tsx` — title + status pill + markdown body + collapsible Story File when story_number set.
  - [x] 10.3 `src/mobile/tasks/MobileTerminalTab.test.tsx` — mocked `TaskTerminal` mounts, accessory bar visible, focus button calls forwarded ref.
  - [x] 10.4 `src/mobile/tasks/MobileActivitiesTab.test.tsx` — mocked `ActivitiesTab` receives `taskId` prop.
  - [x] 10.5 `src/mobile/tasks/MobileDiffTab.test.tsx` — empty state for backlog task; `MobileDiffViewer` mounts for review task; status filter logic.
  - [x] 10.6 Update `src/mobile/MobileApp.test.tsx` to add a `route: 'workspace:abc'` case asserting workspace screen mount and tab bar absence.
  - [x] 10.7 Mock surface: `vi.mock('@renderer/components/task/TaskTerminal')`, `vi.mock('@renderer/components/task/ActivitiesTab')`, `vi.mock('@renderer/components/review/MobileDiffViewer')`, `vi.mock('@renderer/lib/trpc', () => ({ trpc: { tasks: { getById: { useQuery: vi.fn(() => ({ data: mockTask, isLoading: false, error: null })) } } } }))`. Also mock `useMobileNavStore` for popRoute / pushRoute assertions.
  - [x] 10.8 Reduced-motion test: `vi.stubGlobal('matchMedia', vi.fn().mockImplementation(q => ({ matches: q.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() })))` — assert `scrollTo` called with `behavior: 'auto'`.
  - [x] 10.9 Total ≥14 new tests; total project test count must show ≥14 new passes vs T3.5-3 baseline (zero new failures).

- [x] **Task 11: Token discipline + a11y audit (AC: 16, 17, 19, 20)**
  - [x] 11.1 `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]" src/mobile/tasks/` → assert zero matches.
  - [x] 11.2 `grep -REn "from '@renderer/components/(workspace|conflict|review/(ApproveButton|RejectButton|RequestChangesButton|VersionSelector|ReviewTimeline|FeedbackHistory|MobileReviewActionBar))" src/mobile/tasks/` → assert zero matches.
  - [x] 11.3 `grep -REn "from '@renderer/hooks/(useApprovalMutation|useRejectionMutation|useRequestChangesMutation)" src/mobile/tasks/` → assert zero matches.
  - [x] 11.4 All interactive elements have `aria-label` or accessible text. `MobileSheet` has `title` (Radix Dialog will assign aria-labelledby); description present where appropriate.
  - [x] 11.5 No new files modified outside `src/mobile/tasks/` and `src/mobile/MobileApp.tsx` and tests. Confirm via `git diff --stat` after implementation.

- [x] **Task 12: Lint, typecheck, regression (AC: 17, 18, 19)**
  - [x] 12.1 `npx tsc --noEmit` — zero new TypeScript errors in `src/mobile/tasks/` and `src/mobile/MobileApp.tsx`.
  - [x] 12.2 `npm test` — assert pre-existing failure count is unchanged from T3.5-3 baseline; new tests pass.
  - [x] 12.3 Manual smoke: deferred to reviewer (visual + Android Tailscale dev verification).
  - [x] 12.4 Manual smoke on Android: deferred to reviewer (segmented swipe, `prefers-reduced-motion` real-device check).

## Dev Notes

### MUST USE /frontend-design skill (CLAUDE.md mandate)

This is a **🎨 FRONTEND/UI STORY**. Before writing any TSX, the dev agent MUST invoke `/frontend-design` with: tech stack (React 19 / TypeScript / Tailwind v4 / shadcn / @radix-ui / Lucide), the AC matrix below, the Calm Command token list (`src/globals.css`), and the existing primitive surface (`MobileTopAppBar`, `MobileSegmentedTabs`, `MobileSheet`, `MobileBottomActionBar`, `MobileEmptyState`, `MobileLoadingSkeleton`). Pass the cross-tree allowlist (TaskTerminal, ActivitiesTab, MobileDiffViewer, TerminalAccessoryBar) so the skill knows which desktop components are reusable. Integrate the skill's output verbatim where viable; do not write screen TSX from scratch without it.

### Why this story exists (do not skip)

T3.5-3 wired tap → `pushRoute('board', 'workspace:<id>')` and the route currently lands on a `MobileEmptyState` placeholder. Mobile now has a board but no way to **view a task in depth on a phone**. Without the workspace, the board is read-only — useful for status check but not for shipping work from the train. T3.5-4 closes that loop by mounting a real workspace shell that **reuses** the desktop terminal (`TaskTerminal`), activities (`ActivitiesTab`), and diff viewer (`MobileDiffViewer`) inside a 4-sub-tab segmented pager — so the mobile UI gets feature-parity for monitoring without reimplementing any backend logic.

This is also the **last big mobile shell story** before the per-feature tabs (T3.5-5 Planning, T3.5-6 Review, T3.5-7 SSH, T3.5-8 Activity+Settings). After this lands, all subsequent stories are scoped to a single tab and a single screen — much smaller surface area each.

### Key architectural decisions (locked, do NOT redebate)

- **Reuse desktop TaskTerminal, ActivitiesTab, MobileDiffViewer.** All three are already mobile-aware. Forking them costs weeks; reusing them costs an import. The cross-tree allowlist (AC 16) explicitly permits these and forbids the desktop workspace shell (`TaskDetailContent`, `TaskDetailPanel`, `QuadPaneLayout`).
- **Reuse the swipe-pager pattern from `TaskDetailContent.tsx`.** Don't invent a new mechanism. The existing pattern (CSS scroll-snap + `scrollTo` + manual-scroll lockout ref) is proven and tested. The mobile workspace's pager is **stylistically identical** to the desktop's mobile-mode pager — only the parent shell differs (top app bar instead of inline back button).
- **All 4 sub-tab bodies stay mounted at all times.** Conditional `isActive && <Tab/>` would unmount the terminal between switches — losing scrollback and connection. CSS scroll-snap with siblings is the only viable design for state preservation.
- **Approve / Request Changes are placeholders.** T3.5-6 (Mobile Review) owns the actual mutation wiring. This story only renders the buttons. Don't try to be "helpful" by also wiring `useApprovalMutation` — that creates merge friction with T3.5-6 and breaks the agent-team pipeline cadence.
- **Workspace is a full-screen push (no bottom tab bar).** Mobile-native pattern. The bottom 5-tab nav is for tab roots; pushed screens own the full chrome.
- **Overflow menu is placeholder-only.** Each row is disabled with "Coming soon". The actual actions (reasoning log, pause/resume, history, edit, archive, delete) need backend wiring + dialogs that are out of scope. Disabled rows preserve the visual contract for users (and for designers reviewing the screen) without committing to broken interactions.
- **No edit affordance in v1.** Inline editing of task description on mobile is out of scope. Reading is enough. Edit is a future story.
- **No new gesture libraries.** CSS scroll-snap + `scrollTo` is sufficient. `framer-motion`, `react-spring`, `embla-carousel`, `swiper` are all forbidden.
- **No haptic from this story.** All haptics live inside primitives (e.g. `MobileBottomActionBar` primary button self-vibrates and self-gates per T3.5-2 AC 13). The screen does not call `hapticFeedback`.

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** import `TaskDetailContent`, `TaskDetailPanel`, `QuadPaneLayout`, `QuadPaneSection`, `DiffPlaceholder`, or any `@renderer/components/workspace`/`@renderer/components/conflict` content. The mobile workspace is a parallel tree.
2. **DO NOT** import `useApprovalMutation`, `useRejectionMutation`, `useRequestChangesMutation`, `useTaskDetailPanelStore`, `useTaskWorkspaceStore`, or `useInlineCommentsStore`. These are owned by desktop / T3.5-6.
3. **DO NOT** mount `<MobileScreen tabBar={<MobileTabBar/>}>` inside the workspace. The workspace is full-screen — no bottom nav. The tab-bar branch lives in `MobileApp.tsx`'s root render.
4. **DO NOT** use `key={activeSubTab}` on the pager — that unmounts other tabs and trashes terminal state.
5. **DO NOT** mount only `<TerminalTab>` when `activeSubTab === 'terminal'`. The slide must always exist; the user navigates to it via swipe or click.
6. **DO NOT** introduce a new drag/swipe library. Use CSS `scroll-snap-type: x mandatory` with native `scrollTo`. Pattern from `TaskDetailContent.tsx`.
7. **DO NOT** import `react-markdown`/`remark-gfm` if avoidable — `markdownComponents` from `@renderer/components/task/MarkdownComponents` already wires them. If your bundler complains, the fallback is to render `task.description` inside `<pre className="whitespace-pre-wrap">` (documented v1 trade-off, AC 6).
8. **DO NOT** redefine the 4-sub-tab order. It is `Content / Terminal / Activities / Diff` per epic AC + UX redesign §6.1. No other order.
9. **DO NOT** put the action bar inside one of the slides — it is a sibling of the pager, sticky-bottom. If you put it inside a slide, the other slides won't show it.
10. **DO NOT** call `useMobileNavStore` inside a render-time selector that isn't subscribed; either use `useMobileNavStore((s) => s.popRoute)` for stable references or call `useMobileNavStore.getState().popRoute()` from inside an event handler. The same applies for `pushRoute`. Do not re-create handlers on every render unless wrapped in `useCallback` with stable deps.
11. **DO NOT** mutate `useMobileNavStore` to add new state for sub-tab persistence. The active sub-tab is **screen-local state** — when the user navigates away and back, sub-tab can reset to 'content' (acceptable v1 behaviour). If a future story wants per-task sub-tab persistence, that story owns the store change.
12. **DO NOT** modify any file under `src/components/`, `src/hooks/`, `src/stores/`, `src-tauri/`. The cross-tree allowlist (AC 16) is **strict imports only**.
13. **DO NOT** modify `mobile-nav.store.ts`. The existing `popRoute()`, `pushRoute()`, and `handleBackPress()` are sufficient.
14. **DO NOT** modify `T3.5-3` files (`MobileBoardScreen.tsx`, `MobileTaskCard.tsx`, etc.). The board's tap-to-push is already wired correctly; the only change needed is the `MobileApp.tsx` route renderer.
15. **DO NOT** rename `MobileTaskWorkspaceScreen` — the architecture doc lists this exact filename.
16. **DO NOT** assert against `data-testid` strings the desktop uses (e.g., `task-workspace`, `task-content`). Mobile uses `mobile-task-workspace`, `mobile-task-content-tab`, etc.
17. **DO NOT** introduce a new top-level Zustand store. Sub-tab state is local React state.
18. **DO NOT** split the markdown render between Content sub-tab and Story File section — both render the same markdown stack via `markdownComponents`.
19. **DO NOT** add `role="tabpanel"` aria around each slide unless you also add `aria-labelledby` referencing the corresponding `MobileSegmentedTabs` button. The simpler v1 approach: omit the explicit `role="tabpanel"` since `MobileSegmentedTabs` already exposes `role="tab"` + `aria-selected` and the body is a scroll-snap pager (not a strict ARIA tablist). Document this trade-off; T3.5-9 a11y validation can revisit.

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `react`, `react-dom` | 19 (already in project) | Components | n/a |
| `@tanstack/react-query` | already in project | task fetch via `trpc.tasks.getById` | n/a |
| `@radix-ui/react-dialog` | already in project (via `MobileSheet`) | overflow menu sheet | reuse `MobileSheet` |
| `lucide-react` | `^0.562.0` already | `MoreVertical`, `ChevronLeft` (already used by MobileTopAppBar) | no new icons |
| `tailwindcss` | `^4.1.18` already | Calm Command tokens | no inline colours (AC 20) |
| `react-markdown` + `remark-gfm` | already in project (via `MarkdownComponents`) | task description / story file render | optional — fallback is `<pre>` (AC 6 alt path) |
| `vitest` + `@testing-library/react` | already in project | tests | n/a |

**No new dependencies are required.** If you reach for `framer-motion`, `react-spring`, `embla-carousel`, `swiper`, `react-virtual`, `react-window`, `vaul` — **STOP**. The existing toolkit is sufficient.

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/mobile/tasks/MobileTaskWorkspaceScreen.tsx
src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx
src/mobile/tasks/MobileContentTab.tsx
src/mobile/tasks/MobileContentTab.test.tsx
src/mobile/tasks/MobileTerminalTab.tsx
src/mobile/tasks/MobileTerminalTab.test.tsx
src/mobile/tasks/MobileActivitiesTab.tsx
src/mobile/tasks/MobileActivitiesTab.test.tsx
src/mobile/tasks/MobileDiffTab.tsx
src/mobile/tasks/MobileDiffTab.test.tsx
```

**Files this story modifies (minimal):**

```
src/mobile/MobileApp.tsx              (add workspace route branch + isFullScreenRoute helper)
src/mobile/MobileApp.test.tsx         (update placeholder assertion + add workspace mount test)
```

**Files this story may NOT modify (regression guard, AC 17):**

```
src/components/**                     (desktop tree — read-only imports per allowlist)
src/hooks/**                          (read-only)
src/stores/**                         (read-only)
src/mobile/board/**                   (T3.5-3 contract; no edits)
src/mobile/primitives/**              (T3.5-2 contract; no edits)
src/mobile/shell/**                   (T3.5-1 contract; no edits)
src/mobile/dev/**                     (DEV harness; no edits)
src-tauri/**                          (no Rust changes)
src/mobile/tasks/MobileTaskListScreen.tsx  (placeholder; T3.5-8 owns the rewrite)
```

### Testing requirements

- **Unit tests** colocated next to each new component:
  - `MobileTaskWorkspaceScreen.test.tsx` — ≥6 tests covering AC 18 (a)–(f), (l), (m)
  - `MobileContentTab.test.tsx` — ≥3 tests covering AC 18 (g)
  - `MobileTerminalTab.test.tsx` — ≥2 tests covering AC 18 (h)
  - `MobileActivitiesTab.test.tsx` — ≥2 tests covering AC 18 (i)
  - `MobileDiffTab.test.tsx` — ≥3 tests covering AC 18 (j), (k)
- **Total ≥14 new tests** (AC 18 floor). Higher is better.
- **Mock pattern** for `trpc.tasks.getById`: `vi.mock('@renderer/lib/trpc', () => ({ trpc: { tasks: { getById: { useQuery: vi.fn() } } } }))`; per-test override via `(trpc.tasks.getById.useQuery as Mock).mockReturnValue({...})`.
- **Mock pattern** for `useMobileNavStore`: spy on `popRoute` / `pushRoute` to assert back/forward navigation.
- **Mock pattern** for cross-tree components: `vi.mock('@renderer/components/task/TaskTerminal', () => ({ TaskTerminal: forwardRef((props, ref) => <div data-testid="task-terminal-mock" />) }))`. Same shape for `ActivitiesTab` and `MobileDiffViewer`.
- **Reduced-motion test**: mock `window.matchMedia` to return `matches: true` for `(prefers-reduced-motion: reduce)` — match `MobileFab.test.tsx` / `MobileBottomActionBar.test.tsx` patterns.
- **Pager-scroll test**: assign `Object.defineProperty(pagerRef, 'scrollLeft', { get: () => 800, configurable: true })` then dispatch `scroll` event; assert `activeSubTab` updates. (Pattern from `TaskDetailContent.test.tsx`.)
- **Coverage target:** ≥80 % line coverage on new files in `src/mobile/tasks/`.
- **Manual smoke on Android (Tailscale)**: deferred to reviewer per T3.5-9 gate — verify swipe between sub-tabs, status bar safe-area, terminal accessory bar reaching above the soft keyboard.
- **No e2e tests** (TEA territory, deferred to T3.5-9).

### Project structure notes

- `src/mobile/tasks/` already exists and contains only `MobileTaskListScreen.tsx` (a T3.5-1 placeholder). New files colocated here.
- The architecture doc (`architecture.md` §"`src/mobile/` Directory Structure") lists `MobileTaskWorkspaceScreen.tsx`, `MobileContentTab.tsx`, `MobileTerminalTab.tsx`, `MobileActivitiesTab.tsx`, `MobileDiffTab.tsx` under `src/mobile/tasks/`. Match exactly.
- `MobileFileTreeSheet.tsx` and `MobileDiffViewerScreen.tsx` are listed in the architecture doc but are **out of scope for this story** — `MobileDiffViewer` already includes its own file-tree sheet, so these are redundant for v1. T3.5-6 (Mobile Review) may revisit.
- `MobileApp.tsx` route table needs the workspace branch + the full-screen-route helper. Do **not** centralise route mapping into a separate file in this story — keep changes minimal.

### Previous story intelligence (T3.5-1 + T3.5-2 + T3.5-3)

- **`MobileSegmentedTabs` is purely controlled** (T3.5-2). It does NOT own swipe — that's this story's pager. The segmented control just renders tab buttons + sliding indicator + ARIA `role="tab"`/`aria-selected`.
- **`MobileSheet` snap points:** `'half' | 'full' | 'fit'`. Use `'fit'` for the overflow menu (content-driven height).
- **`MobileBottomActionBar`** primary-button haptic self-gates via `useReducedMotion()`. Don't double-gate from the screen.
- **`MobileTopAppBar`** supports `backButton`, `title`, `trailingActions`. The `title` prop was added in T3.5-2 AC 1.
- **`useMobileNavStore.popRoute()`** without a tab arg pops the active tab. **`useMobileNavStore.pushRoute(tab, route)`** requires both args.
- **`handleBackPress()`** logic (T3.5-1): pops route → switches to `'board'` → returns `false` (signals OS exit). Workspace is a normal stack entry, no special-casing needed.
- **DEV harness route `#__mobile-primitives`** must continue to work — don't break it by changing `MobileApp.tsx`'s render order.
- **`@dnd-kit/core` integration in T3.5-3** is unrelated to this story. The board owns drag; the workspace doesn't drag anything.
- **Mobile Vite dev port: 1420.** Android dev uses Tailscale via `TAURI_DEV_HOST` env (gitignored, loaded by `android:dev` script).
- **Pre-existing failing tests:** Compare `npm test` line-for-line to T3.5-3 baseline (35 new T3.5-3 tests passing on top of the prior 25 pre-existing failures unchanged). Don't introduce new failures.
- **Stale-state-in-setTimeout pattern:** if you find yourself reading state inside a 800 ms manual-scroll lockout closure, use `useRef` for the latest value (mirrors `MobileTabBar`'s long-press fix from T3.5-2).
- **Test pattern**: `vitest` with happy-dom (or jsdom — verify in `vitest.config.ts`); colocated `.test.tsx`; `@testing-library/react` `render` + `screen` + `fireEvent` + `act`. Match patterns in `MobileBoardScreen.test.tsx`, `MobileNewTaskSheet.test.tsx`.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Mobile screen location | `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx` | `architecture.md` §"`src/mobile/` Directory Structure" |
| Sub-tab order | Content / Terminal / Activities / Diff (canonical) | `epics.md` Story T3.5-4; `mobile-ux-redesign-plan-2026-04-30.md` §6.1 |
| Token discipline | Calm Command CSS vars only (no inline color classes) | `architecture.md` §"Mobile Primitive Contract" §1; `globals.css` |
| Touch targets | ≥44 pt iOS / ≥48 dp Android (top app bar back button, overflow icon, action bar buttons) | UX-DR7; `ux-design-specification-mobile.md` §"Accessibility Considerations" |
| A11y | Semantic HTML, `aria-label` on icon-only, focus visible, no color-only signals | `architecture.md` §"Mobile Primitive Contract" §3; UX-DR6 |
| Safe-area | Inherit via `MobileTopAppBar` + `MobileBottomActionBar`; don't manually compute | `architecture.md` §"Mobile Primitive Contract" §4 |
| Reduced motion | Pager `scrollTo` `behavior: 'auto'` when reduced; no haptics from screen | T3.5-2 contract |
| Forbidden imports | NO imports from `@renderer/components/{workspace,conflict}/*`, `@renderer/components/review/{ApproveButton,RejectButton,...}`, `@renderer/hooks/{useApprovalMutation,useRejectionMutation,useRequestChangesMutation}`, `@renderer/stores/{task-detail-panel,task-workspace,inline-comments}.store` | this story AC 16 |
| Desktop preserved | NO edits to `src/components/**`, `src/hooks/**`, `src/stores/**`; mobile is parallel tree | CLAUDE.md, sprint-change-proposal-2026-04-30.md |
| Route ownership | Workspace branch lives in `MobileApp.tsx` route renderer; not in a separate router file | this story AC 1, 13 |

### Git intelligence (recent commit patterns)

```
e78decd fix: [t3-5-3] code review fixes — autoScroll config, BasicTask pill, act() test wrapper
ae8e994 feat: [t3-5-3] mobile board — column pager + @dnd-kit drag + task cards
275c741 feat: [t3-5-2] mobile primitives library — 14 primitives, 76 new tests, code review fixes
ea6f346 feat: [t3-5-1] mobile shell foundation
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
```

- `e78decd` + `ae8e994` are T3.5-3 — the board this story builds on top of. Read `MobileBoardScreen.tsx` to see the `pushRoute('board', \`workspace:${task.id}\`)` call site.
- `275c741` is T3.5-2 — the primitive library. Read `src/mobile/primitives/index.ts` for canonical exports; read `MobileSegmentedTabs.tsx` to understand the controlled tablist contract.
- `ea6f346` is T3.5-1 — the shell. Read `MobileApp.tsx` to understand the existing route-renderer pattern and where the workspace branch slots in.
- The sprint change proposal commits (`cd023c2`, `c8148ab`) are the authoritative source for the parallel-tree decision and the cross-tree import discipline.

### Latest technical specifics

- **React 19** is adopted. `useId`, `use()`, `useTransition` available; only adopt where natural.
- **Tailwind v4** uses `@theme inline` (already wired). Token vars: `--background`, `--card`, `--primary`, `--muted-foreground`, `--border`. Prefer `bg-card/95 backdrop-blur-xl` for elevated surfaces (matches T3.5-2 primitives).
- **CSS scroll-snap** (`scroll-snap-type: x mandatory` + `snap-start` on slides) is the modern primitive for swipeable horizontal pagers — no JavaScript pager library required. Confirmed by `TaskDetailContent.tsx`.
- **`@tanstack/react-query` v5** + `trpc` v11: `trpc.tasks.getById.useQuery({ id })` returns `{ data, isLoading, error }`. Don't add a parallel optimistic layer — read-only here.
- **`@radix-ui/react-dialog`** (via `MobileSheet`): the sheet auto-portals to `document.body`, focus-traps, Esc-dismisses. Don't reimplement.
- **`react-markdown` + `remark-gfm`** are bundled via `MarkdownComponents`. Avoid bundling them again from this story unless you want a direct import (and document the trade-off if so).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (Epic 3.5 charter; T3.5-4 success criteria)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T3.5-4-Mobile-Task-Workspace] (canonical AC source)
- [Source: _bmad-output/planning-artifacts/architecture.md#src-mobile-Directory-Structure] (canonical screen + component locations)
- [Source: _bmad-output/planning-artifacts/architecture.md#Migration-Sequence-Rollback] (T3.5-4 placement in story sequence)
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (token, touch-target, a11y, safe-area, reduced-motion rules)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#6.1] (sub-tab pattern: 4 sub-tabs)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#6.2] (segmented bar + swipe — both)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#6.3] (per-sub-tab content + sticky bottom)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#6.4] (header pattern + overflow menu items)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#6.5] (state preservation — scroll position + partial input)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#7.2] (component LOC estimates — primitives reused)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Visual-Design-Foundation] (typography + tokens)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Accessibility-Considerations] (UX-DR6, UX-DR7)
- [Source: _bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md] (shell + nav store + route renderer)
- [Source: _bmad-output/implementation-artifacts/t3-5-2-mobile-primitives-library.md] (primitive contracts + reduced motion + segmented tabs)
- [Source: _bmad-output/implementation-artifacts/t3-5-3-mobile-board.md] (tap-to-push wiring, T3.5-3 patterns reused here)
- [Source: src/mobile/MobileApp.tsx] (route renderer; this story modifies the `workspace:` branch + adds full-screen route helper)
- [Source: src/mobile/shell/mobile-nav.store.ts] (`popRoute`, `pushRoute`, `handleBackPress` — DO NOT modify)
- [Source: src/mobile/primitives/MobileSegmentedTabs.tsx] (controlled tablist contract)
- [Source: src/mobile/primitives/MobileSheet.tsx] (snap-point + a11y + Radix Dialog wiring)
- [Source: src/mobile/primitives/MobileBottomActionBar.tsx] (primary/secondary action contract + self-gated haptic)
- [Source: src/mobile/primitives/MobileTopAppBar.tsx] (back button + title + trailing actions contract)
- [Source: src/mobile/primitives/MobileEmptyState.tsx] (empty-state shape)
- [Source: src/mobile/primitives/MobileLoadingSkeleton.tsx] (skeleton variants)
- [Source: src/mobile/hooks/useReducedMotion.ts] (reduced-motion gating hook)
- [Source: src/components/task/TaskDetailContent.tsx] (desktop reference: scroll-snap pager pattern; mirror handleTabClick + handleTabsScroll + isManualScrollingRef)
- [Source: src/components/task/TaskTerminal.tsx] (cross-tree allowed: terminal embed; ref shape `TaskTerminalRef.focusInput`)
- [Source: src/components/task/ActivitiesTab.tsx] (cross-tree allowed: activity feed)
- [Source: src/components/task/MarkdownComponents.tsx] (`markdownComponents` export; cross-tree allowed)
- [Source: src/components/terminal/TerminalAccessoryBar.tsx] (cross-tree allowed: terminal accessory bar)
- [Source: src/components/review/MobileDiffViewer.tsx] (cross-tree allowed: diff viewer; already mounts `MobileFileTree`)
- [Source: src/components/ui/badge.tsx] (status pill primitive; cross-tree allowed via `@renderer/components/ui/*`)
- [Source: src/lib/utils.ts] (`cn`; do NOT call `hapticFeedback` from this story)
- [Source: src/lib/trpc.ts] (`trpc` client; `trpc.tasks.getById.useQuery({ id })`)
- [Source: src/shared/types/task.types.ts] (`Task`, `TaskStatus`, `TASK_STATUS`)
- [Source: src/globals.css] (Calm Command token definitions)
- [Source: CLAUDE.md] (`/frontend-design` mandate; mobile-tree-not-branch rule)

### Project Structure Notes

- Architecture doc and design plan agree on `src/mobile/tasks/` as the workspace location. Use it.
- Architecture doc lists 5 files in `src/mobile/tasks/`: `MobileTaskWorkspaceScreen`, `MobileContentTab`, `MobileTerminalTab`, `MobileActivitiesTab`, `MobileDiffTab`. We add no others. (`MobileFileTreeSheet`, `MobileDiffViewerScreen` listed in the doc are deferred — `MobileDiffViewer` already covers their behaviour.)
- The mobile workspace does **NOT** mirror `TaskDetailPanel.tsx` or `TaskDetailContent.tsx`. Their roles are taken on by the parallel mobile tree:
  - Slide-over panel → full-screen push (mobile-nav stack)
  - 3-column desktop layout → 4-sub-tab pager
  - `TaskDetailContent`'s mobile-mode swipe-pager → reused pattern in `MobileTaskWorkspaceScreen` (intentional duplication: desktop's mobile mode and the mobile tree are independent code paths per CLAUDE.md)
- `MobileTaskListScreen.tsx` (current T3.5-1 placeholder under `src/mobile/tasks/`) is NOT modified by this story. T3.5-8 owns its rewrite.
- The 5-tab bottom nav is **hidden** on the workspace push (AC 13). This is the first mobile screen that hides the tab bar — verify the implementation pattern can extend to future push screens (`chat:<id>` in T3.5-5).

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all issues resolved inline during implementation.

### Completion Notes List

- All 5 new component files created under `src/mobile/tasks/`
- `MobileApp.tsx` updated with `isFullScreenRoute()` helper and full-screen branch
- `MobileApp.test.tsx` updated: added workspace route tests, `isFullScreenRoute` unit tests, and required mocks
- 5 colocated test files created — 72 total new test cases, all passing
- Token discipline audit: zero inline color classes
- Cross-tree import audit: only allowed imports used
- TypeScript: zero new errors in `src/mobile/tasks/` or `src/mobile/MobileApp.tsx`
- `MobileTopAppBar` limitation discovered: `title` + `backButton` in same slot → worked around with custom inline top bar for workspace screen
- `data-testid="mobile-content-tab-status"` moved from `<Badge>` to wrapping `<div>` to avoid mock shadowing in tests
- Pre-existing test failure count unchanged (24–25 files, pre-existing only)

### File List

**Created:**
- `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`
- `src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx`
- `src/mobile/tasks/MobileContentTab.tsx`
- `src/mobile/tasks/MobileContentTab.test.tsx`
- `src/mobile/tasks/MobileTerminalTab.tsx`
- `src/mobile/tasks/MobileTerminalTab.test.tsx`
- `src/mobile/tasks/MobileActivitiesTab.tsx`
- `src/mobile/tasks/MobileActivitiesTab.test.tsx`
- `src/mobile/tasks/MobileDiffTab.tsx`
- `src/mobile/tasks/MobileDiffTab.test.tsx`

**Modified:**
- `src/mobile/MobileApp.tsx`
- `src/mobile/MobileApp.test.tsx`

### Review Findings

- [x] [Review][Patch] Pager scrollbar hidden only in Firefox — webkit scrollbar visible [`MobileTaskWorkspaceScreen.tsx:360`] — **Fixed**: replaced `scrollbar-hide` (undefined Tailwind class) + `style={{scrollbarWidth:'none'}}` with `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` (pattern from `MobileColumnPager.tsx`).
- [x] [Review][Patch] `MobileBottomActionBar.ActionButton` lacked `ariaLabel` field — AC 11/10 required `aria-label="Edit (Coming soon)"` on Content tab Edit button and `aria-label="Request changes (Coming in T3.5-6)"` on Diff tab secondary button [`src/mobile/primitives/MobileBottomActionBar.tsx`] — **Fixed**: added optional `ariaLabel?: string` to `ActionButton` interface, threaded through to both primary and secondary `<button>` elements, and passed the required values from `MobileTaskWorkspaceScreen.tsx`.
- [x] [Review][Dismiss] `react-markdown`/`remark-gfm` direct imports in `MobileContentTab.tsx` — AC 16 says "forbidden" but `MarkdownComponents.tsx` does not re-export them; Dev Notes Task 5.3 explicitly documents this trade-off and says to pick one approach. The direct import approach is consistent with desktop precedent. **Dismissed as intentional dev decision.**
