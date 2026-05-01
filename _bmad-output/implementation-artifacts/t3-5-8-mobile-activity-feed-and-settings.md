# Story T3.5-8: Mobile Activity Feed and Settings

Status: Done

> **🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

<!-- Validation optional. Run validate-create-story before dev-story for quality check. -->

## Story

As a founder running agents from my phone,
I want a cross-task activity feed and proper mobile Settings screens,
so that I can monitor what every agent is doing at a glance and configure model, theme, diagnostics, and SSH connections without ever falling back to the desktop UI.

## Acceptance Criteria

1. **MobileActivityFeedScreen** mounts as the activity-tab root (`'feed'` in `MobileApp.tsx`) and replaces the placeholder. It renders inside the existing `MobileScreen` shell (top app bar + tab bar visible — NOT full-screen).
2. The feed shows activity events from **all tasks** in chronological order (newest first), each row using a new `MobileActivityRow` primitive showing: leading event-type icon (token-styled per event category), title (humanised event_type), subtitle (one-line summary derived from `payload`), trailing relative time (e.g. "2m", "1h", "yesterday"), and tappable affordance.
3. Initial seed: on mount, fetch via `commands.listTasks()` then for each task call `commands.listActivitiesForTask(taskId, 50, null, null)` in parallel (Promise.all). Merge, sort by `created_at` desc, cap displayed at 200 rows. Live updates: subscribe to the Tauri global `'activity:created'` event WITHOUT filtering by task_id (cross-task listener) and prepend new activities; deduplicate by `activity.id`. Highlight new rows with a 1.5 s glow animation; respect `prefers-reduced-motion` (skip glow if reduced).
4. A `MobileChipStrip` above the list exposes filters: **All / Status / Agent / Tools / Errors / User / Auto**, with this canonical event-type mapping (per epics.md AC + UX §3.7):
   - All → no filter
   - Status → `status_change`
   - Agent → `agent_start`, `agent_complete`
   - Tools → `tool_used`
   - Errors → `error`, `stall_detected`
   - User → `user_command`, `rejection`
   - Auto → `automation_trigger`, `auto_commit`, `stall_recovered`, `session_ended`
   Selection is single-select, persisted to component state only (no global store). Default is "All".
5. Empty state (zero rows after fetch + filter applied) renders `MobileEmptyState` with icon `<Activity/>`, title "No activity yet", subtitle "Start a task to see agent events here." When a non-default filter yields zero rows, subtitle becomes "No events match this filter — try All."
6. Loading state on first fetch renders `MobileLoadingSkeleton` variant `'row'` ×6. Subsequent live updates do NOT show skeleton.
7. Tapping a row opens `MobileActivityDetail` (a `MobileSheet` with `snap='half'`) showing: event_type heading, full payload (pretty-printed JSON inside a token-styled scrollable code block), task name + status pill (resolved via cached `useTaskById` hook from the parallel feed fetch — no extra rspc round-trip per tap if already cached), created_at as long-form timestamp, and a primary "Open task" button.
8. The detail sheet's **"Open task"** button calls `pushRoute('tasks', 'workspace:{taskId}')` then `switchTab('tasks')` (in that order so the tab switch sees the freshly-pushed route). Choice of sub-tab inside the workspace is determined by event_type:
   - `tool_used` → `'terminal'` sub-tab (set via `useTaskWorkspaceStore.setSubTab` if present, else via initial-prop fallback)
   - all other event types → `'activities'` sub-tab
   Activity tab stack is NOT cleared (caller can use back to return).
9. **MobileSettingsHome** replaces the transitional placeholder. It renders inside `MobileScreen` (tab bar visible) and shows a sectioned list using a NEW primitive `MobileSettingsRow` (~80 LOC, list row with leading icon, title, optional value text, optional toggle/switch trailing, chevron when navigates). Sections (in order, with section headers):
   - **Agent**: Dev agent model (value=current model), Review agent model (value=current model)
   - **Connections**: Connections (subtitle: "{n} configured" or "No SSH connections yet")
   - **Appearance**: Theme (value: Light / Dark / System)
   - **About**: About TinSu (chevron), Diagnostics (chevron), Open-source licenses (chevron)
10. Settings sub-screens to build, each with `MobileTopAppBar` + back button (`popRoute('settings')`):
    - `MobileAgentSettings` (route key `'agent-settings'`) — full-screen route prefix NOT needed; pushed inside MobileScreen shell. Two list rows that open inline picker sheets for `devAgentModel` / `reviewAgentModel` (values: opus / sonnet / haiku). Saves via `commands.updateConfig({devAgentModel|reviewAgentModel})` (rspc — see existing `commands.getConfig` / `commands.updateConfig` pattern from `AgentSettingsPanel`). Autosave on selection (no explicit Save button); show `MobileToast` on success/error.
    - `MobileThemeSettings` (route `'theme-settings'`) — single list with three rows (Light / Dark / System), single-select via radio-style trailing check icon. Persists to localStorage key `tinsu.theme` (re-uses any existing theme hook via `@renderer/hooks/useTheme` if present; otherwise read/write directly and dispatch a `theme-change` CustomEvent). Autosave on selection.
    - `MobileDiagnostics` (route `'diagnostics'`) — read-only list of: app version (from `import.meta.env.VITE_APP_VERSION` or `package.json` build-time inject), Tauri version (`@tauri-apps/api/app.getVersion()`), platform (`@tauri-apps/plugin-os.platform()`), database path (via `commands.getDiagnostics()` — if not present, document the dependency and fall back to "Unavailable"), recent log file count, and a `MobileBottomActionBar` primary button "Copy Diagnostics" that copies a JSON dump via the Web Clipboard API and shows `MobileToast` "Copied to clipboard."
    - `MobileAbout` (route `'about'`) — static screen with TinSu logo placeholder, version, build hash (if injected), short description, and rows: "Visit website" (no-op stub w/ "Coming soon" toast), "Privacy policy" (same), "Terms" (same). Stub rows MUST be marked with subtitle "Coming soon" and emit `MobileToast` on tap.
    - `MobileLicenses` (route `'licenses'`) — static read-only `<pre>` block rendering an OSS notice. v1: hard-code a short attribution placeholder and TODO comment to wire a generated `licenses.json` in a follow-up. Do NOT block on a license generator.
11. **Stub rows** for `SSH Keys`, `Mosh`, `Cache` — rendered in `MobileSettingsHome` as MobileSettingsRow entries with subtitle "Coming soon" and an `onPress` that triggers `MobileToast` "Coming in a future release." This keeps UX continuity without committing to backend work outside this story's scope.
12. **Connections row** in `MobileSettingsHome` MUST `pushRoute('settings', 'connections')` (the route key `'connections'` already routes to `MobileConnectionsListScreen` per T3.5-7 — DO NOT change that wiring). Subtitle resolves connection count via the existing `useSshConnections` query.
13. Extend `parseDeepLink()` in `src/mobile/shell/deeplinks.ts` so additional `tinsu://settings/*` paths resolve to their settings sub-screens:
    - `tinsu://settings/connections` → `{tab:'settings', stack:['home','connections']}` (existing — keep)
    - `tinsu://settings/agent` → `{tab:'settings', stack:['home','agent-settings']}`
    - `tinsu://settings/theme` → `{tab:'settings', stack:['home','theme-settings']}`
    - `tinsu://settings/diagnostics` → `{tab:'settings', stack:['home','diagnostics']}`
    - `tinsu://settings/about` → `{tab:'settings', stack:['home','about']}`
    Add deep-link `tinsu://activity/{taskId}` → `{tab:'activity', stack:['feed']}` followed by automatic open of `MobileActivityDetail` for the most-recent activity belonging to that task (deferred-open via a transient `pendingActivityForTask` field on `useMobileNavStore`, consumed and cleared by `MobileActivityFeedScreen` on mount). If no activity is found within 2 s of mount, no sheet opens (silent no-op).
14. `isFullScreenRoute()` in `MobileApp.tsx` MUST NOT be extended — none of the new settings sub-screens are full-screen. They render inside the existing `MobileScreen` shell (tab bar visible). This is the explicit design choice; do not add a `settings:` prefix.
15. Add new route renderer cases in `MobileApp.tsx` `MobileRouteRenderer`:
    - `'agent-settings'` → `<MobileAgentSettings/>`
    - `'theme-settings'` → `<MobileThemeSettings/>`
    - `'diagnostics'` → `<MobileDiagnostics/>`
    - `'about'` → `<MobileAbout/>`
    - `'licenses'` → `<MobileLicenses/>`
    Place these AFTER the existing tab-root switch and BEFORE the `connection-form:` startsWith branch, mirroring the `'connections'` case style.
16. **Cross-tree import allowlist** — these screens MAY import:
    - `@renderer/hooks/*` (rspc/react-query hooks: `useTasks`, `useTaskById`, `useSshConnections`, etc.)
    - `@renderer/lib/utils` (`cn`)
    - `@renderer/lib/rspc` (types only)
    - `@renderer/stores/*` (Zustand domain stores)
    - `@renderer/shared/types/*` (type imports)
    - `sonner` (toast — though prefer the new `MobileToast` primitive)
    - `lucide-react` icons
    They MUST NOT import any `@renderer/components/ui/*` (Dialog, Input, Button, Select, Label, Card, etc.) or any desktop panel under `@renderer/components/settings/*`. The desktop `AgentSettingsPanel` is a structural reference only — re-implement the picker UX with mobile primitives.
17. **Token discipline (Calm Command)** — no inline color classes outside the documented exceptions. All surfaces / borders / text use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, etc.). Event-type icons MAY use accent tokens (e.g. `text-destructive` for `error`, `text-primary` for `agent_*`) — document the rule inline at the icon-color helper. Run `rg "text-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx src/mobile/primitives/MobileActivityRow.tsx` — output MUST be empty.
18. **Touch targets** — every interactive row, chip, button, switch ≥ 44 × 44 px (verified via `min-h-11` or `h-11` Tailwind utility on the row class plus inner padding). Picker sheet rows use `min-h-11`.
19. **Accessibility** — every row + chip exposes `role` + `aria-label`; the activity-detail sheet sets `aria-modal` / `aria-labelledby`; settings list uses `role="list"` with each row as `role="listitem"` (or rely on Radix dialog primitives where used). Live-region announce "{n} new activities" when ≥ 1 row prepends in a 1 s window (use `aria-live="polite"`, throttled).
20. **Tests** — at minimum 22 new tests across:
    - `MobileActivityFeedScreen.test.tsx` (≥ 8): renders empty state, renders rows after fetch, applies chip filter, prepends on 'activity:created' event, deduplicates by id, taps row opens detail sheet, "Open task" navigates with correct sub-tab for `tool_used` vs other events, `prefers-reduced-motion` disables glow.
    - `MobileActivityRow.test.tsx` (≥ 3): icon / title / time render, payload subtitle truncation, AC-17 token grep.
    - `MobileSettingsHome.test.tsx` (≥ 4): all sections render, Connections subtitle reflects count, stub-row toast fires, agent / theme / diagnostics / about rows push correct routes.
    - `MobileAgentSettings.test.tsx` (≥ 3): renders current model, picker sheet opens, selection autosaves via `commands.updateConfig` mock.
    - `MobileThemeSettings.test.tsx` (≥ 2): renders current theme, selection persists.
    - `MobileDiagnostics.test.tsx` (≥ 2): renders fields, "Copy Diagnostics" button copies & toasts.
    - `deeplinks.test.ts` extension (≥ 5): each new `tinsu://settings/*` path + `tinsu://activity/{taskId}` parses to expected target.
21. **No regressions** — full mobile test suite still green (`npm test -- src/mobile`). MobileConnectionsListScreen, MobileTaskWorkspaceScreen, MobileApp routing tests unchanged in behaviour.
22. **Docs** — append a "T3.5-8" section to `docs/agent-team-bmad-implementation.md` (existing pattern from prior T3.5 stories) with one-paragraph completion summary + file list. Do NOT create a separate readme. Update `mobile-ux-redesign-plan-2026-04-30.md` only if scope deviates from §2.5/§2.6/§3.7/§3.9 (e.g. SSH Keys / Mosh / Cache deferred to follow-up — flag explicitly).

## Tasks / Subtasks

- [ ] **Task 1**: Add `MobileSettingsRow` primitive (AC: 9, 17, 18, 19)
  - [ ] Create `src/mobile/primitives/MobileSettingsRow.tsx` with props: `icon?: ReactNode`, `title: string`, `value?: string`, `subtitle?: string`, `trailing?: 'chevron' | 'switch' | 'check' | ReactNode`, `onPress?: () => void`, `disabled?: boolean`, `data-testid?: string`. Render with `min-h-11`, token-only colors, role="listitem".
  - [ ] Add unit tests `MobileSettingsRow.test.tsx`: renders title/value, fires onPress, trailing variants, disabled state, AC-17 token grep.
  - [ ] Export from `src/mobile/primitives/index.ts` (if barrel exists; otherwise add direct imports).

- [ ] **Task 2**: Add `MobileActivityRow` primitive + icon/category helpers (AC: 2, 4, 17, 18, 19)
  - [ ] Create `src/mobile/activity/MobileActivityRow.tsx` rendering icon + title + subtitle + relative time. Props: `activity: Activity`, `onPress: (a: Activity) => void`, `highlight?: boolean` (1.5 s glow when true; respects `prefers-reduced-motion`).
  - [ ] Create `src/mobile/activity/activity-meta.ts` (pure helpers): `eventTypeToCategory(t)`, `eventTypeToIcon(t)`, `eventTypeToTitle(t)`, `payloadToSubtitle(activity)`, `categoryFilterToEventTypes(category)`. Cover all 12 event_types from `activity.types.ts`.
  - [ ] Tests `MobileActivityRow.test.tsx` and `activity-meta.test.ts`.

- [ ] **Task 3**: Build `MobileActivityFeedScreen` (AC: 1, 2, 3, 4, 5, 6, 7, 19, 20)
  - [ ] Replace placeholder content. Implement parallel fetch via `commands.listTasks` + `Promise.all(commands.listActivitiesForTask(...))`, merge, sort, cap at 200.
  - [ ] Add cross-task subscription: a NEW hook `src/hooks/useGlobalActivitySubscription.ts` (or add `taskId: string | null` overload to existing `useActivitySubscription`) listening to `'activity:created'` without filtering. Document the design choice inline.
  - [ ] Render `MobileChipStrip` with the 7 categories and wire single-select state.
  - [ ] Render list virtualised only if > 200 rows (cap means typically not needed for v1 — render plain).
  - [ ] Wire row tap → `MobileActivityDetail` sheet.
  - [ ] Implement `prefers-reduced-motion` check via `window.matchMedia` or existing `@renderer/hooks/usePrefersReducedMotion` if present.
  - [ ] Live-region announcer: `aria-live="polite"` div, throttled to 1 s.
  - [ ] Tests covering AC-20 list above.

- [ ] **Task 4**: Build `MobileActivityDetail` sheet (AC: 7, 8, 19)
  - [ ] Create `src/mobile/activity/MobileActivityDetail.tsx`. Use `MobileSheet` with `snap='half'`. Render heading, formatted timestamp, task pill, scrollable JSON code block (`<pre className="text-xs font-mono bg-muted/40 p-3 rounded-md overflow-auto max-h-64">`).
  - [ ] "Open task" button uses tokens, ≥ 44 px touch target, calls `pushRoute('tasks', 'workspace:{taskId}')` then `switchTab('tasks')`. Set workspace sub-tab via `useTaskWorkspaceStore` if available.
  - [ ] Tests inline within `MobileActivityFeedScreen.test.tsx` (sheet open + Open-task navigation).

- [ ] **Task 5**: Replace `MobileSettingsHome` with full sectioned list (AC: 9, 11, 12, 17, 18, 19, 20)
  - [ ] Replace transitional placeholder. Render section headers + `MobileSettingsRow` entries per AC 9 + 11.
  - [ ] Wire onPress handlers for each row (`pushRoute('settings', '<key>')` or stub toast).
  - [ ] Connections row subtitle uses `useSshConnections` count.
  - [ ] Tests covering AC-20.

- [ ] **Task 6**: Build `MobileAgentSettings` screen (AC: 10a, 16, 17, 18, 19, 20)
  - [ ] Create `src/mobile/settings/MobileAgentSettings.tsx`. Use `commands.getConfig` + `commands.updateConfig` (rspc). Render two `MobileSettingsRow` rows that open a `MobileSheet` (`snap='fit'`) picker with three rows (opus / sonnet / haiku). Selection autosaves and shows toast.
  - [ ] Tests.

- [ ] **Task 7**: Build `MobileThemeSettings` screen (AC: 10b, 17, 18, 19, 20)
  - [ ] Create `src/mobile/settings/MobileThemeSettings.tsx`. Three rows: Light / Dark / System. Persist to `localStorage` (`tinsu.theme`) and dispatch `theme-change` CustomEvent. If a `useTheme` hook already exists (`rg useTheme src/`), reuse it.
  - [ ] Tests.

- [ ] **Task 8**: Build `MobileDiagnostics` screen (AC: 10c, 17, 18, 19, 20)
  - [ ] Create `src/mobile/settings/MobileDiagnostics.tsx`. Read-only fields. "Copy Diagnostics" button uses `navigator.clipboard.writeText(JSON.stringify(diag, null, 2))`. Show toast.
  - [ ] If `commands.getDiagnostics` does not exist, surface partial info (version, platform via `@tauri-apps/plugin-os` or `@tauri-apps/api/app`) and add `// TODO(T3.5-9): expand once getDiagnostics command lands` comment.
  - [ ] Tests.

- [ ] **Task 9**: Build `MobileAbout` + `MobileLicenses` screens (AC: 10d, 10e, 17, 18, 19)
  - [ ] Create `src/mobile/settings/MobileAbout.tsx` + `src/mobile/settings/MobileLicenses.tsx`. Static content + stub-row toast on tap.
  - [ ] Smoke tests (render + back-button presence).

- [ ] **Task 10**: Wire new routes in `MobileApp.tsx` (AC: 14, 15)
  - [ ] Add the 5 new route cases in `MobileRouteRenderer` AFTER tab-root switch, BEFORE `connection-form:` branch.
  - [ ] Confirm `isFullScreenRoute` is unchanged.

- [ ] **Task 11**: Extend deep-link parser (AC: 13, 20)
  - [ ] Edit `src/mobile/shell/deeplinks.ts` `case 'settings'` to recognise `agent` / `theme` / `diagnostics` / `about` + add new `case 'activity'` (returning `{tab:'activity', stack:['feed']}`).
  - [ ] Add `pendingActivityForTask: string | null` field to `useMobileNavStore` + setter `setPendingActivityForTask(id|null)`. `navigateToDeepLink('tinsu://activity/{taskId}')` calls the setter then performs the regular navigation.
  - [ ] `MobileActivityFeedScreen` reads + clears `pendingActivityForTask` on mount and opens the detail sheet for the most-recent matching activity (or no-op after 2 s).
  - [ ] Add deeplinks tests for all new paths.

- [ ] **Task 12**: Cross-task activity subscription wiring (AC: 3)
  - [ ] Add `src/hooks/useGlobalActivitySubscription.ts` that listens without `task_id` filter. Mirror existing `useActivitySubscription` API but with no filtering. Add unit test that simulates an emitted event and asserts the handler is called for any task_id.

- [ ] **Task 13**: Update `MobileTopAppBar` usage in new screens (AC: 10, 19)
  - [ ] Each sub-screen renders a top app bar with a left back button that calls `popRoute('settings')`. Test back-button onClick fires `popRoute`.

- [ ] **Task 14**: AC-17 + AC-21 audits
  - [ ] Run `rg "text-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx src/mobile/primitives/MobileActivityRow.tsx` — must be empty.
  - [ ] Run `rg "@renderer/components/ui" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx src/mobile/primitives/MobileActivityRow.tsx` — must be empty.
  - [ ] Run `npm test -- src/mobile src/hooks/useGlobalActivitySubscription` — full pass.

- [ ] **Task 15**: Docs (AC: 22)
  - [ ] Append `## T3.5-8: Mobile Activity Feed and Settings` section to `docs/agent-team-bmad-implementation.md` with one-paragraph summary + file list. No new .md files.

## Dev Notes

### Why this story exists

T3.5-8 is the final UI-bearing story in the Epic 3.5 mobile parallel-tree pivot before the T3.5-9 real-device validation gate. Up to now, the activity tab and settings tab have rendered placeholder screens — the user can navigate to them but cannot use them. Two distinct workflows must land here:

1. **Cross-task activity feed** — a unified, live, filterable view of all agent events across all tasks. The feed is the founder's "what's happening right now" pulse-check on a phone. It has no pure-Rust backend equivalent (the `commands.list_activities_for_task` API is per-task), so v1 implements the merge in TypeScript by parallel-fetching per-task seeds and tapping the global `'activity:created'` Tauri event for live updates. This decision is documented inline and is intentional: a follow-up story can add `list_recent_activities_for_project` if the seed cost becomes prohibitive.
2. **Mobile Settings screens** — agent model selection, theme, diagnostics, about, licenses, and entry-points to existing Connections (T3.5-7 done). Stub rows for SSH Keys / Mosh / Cache keep UX continuity but are deferred since they need backend work outside this story's scope.

When this story is done, every tab in the 5-tab mobile shell is functional and there is no remaining "Coming Soon" placeholder visible to users on a real device.

### Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| Cross-task feed merges in TS, not Rust | No `list_recent_activities_for_project` Rust command exists. Building one is a meaningful new schema query that is out of scope for a UI-bearing story. The TS merge is correct, simple, and bounded (50 per task × N tasks, capped at 200 displayed). Document as v1; flag follow-up. |
| `'activity:created'` event tapped without task_id filter | The Rust emitter at `src-tauri/src/services/activity_log.rs` already broadcasts globally — no backend change needed. New `useGlobalActivitySubscription` hook intentionally does NOT filter, mirroring the existing `useActivitySubscription` API otherwise. |
| Settings sub-screens render INSIDE MobileScreen shell (tab bar visible) | Per AC 14 — these are not full-screen tasks (workspace, chat, review, connection-form). Keeping the tab bar lets the user switch tabs without losing the settings stack. |
| Stub rows for SSH Keys / Mosh / Cache | Backend work for these features is not in this story's scope. Showing stubs with "Coming soon" toast preserves UX completeness and signals intent without committing to half-shipped features. |
| Theme persistence via localStorage | Avoids new backend round-trip for a v1 nice-to-have. If a `useTheme` hook already exists in `@renderer/hooks/`, reuse it. Otherwise direct read/write + CustomEvent. |
| `MobileSettingsRow` primitive (~80 LOC) | Adds a 16th mobile primitive (after T3.5-2's 15). UX redesign §7.2 mandates it. Keeps settings list visually consistent and AC-17 token-clean. |
| `MobileActivityRow` lives under `src/mobile/activity/`, NOT primitives | It's domain-specific (knows about Activity event types). Primitives stay generic; domain rows live with the feature. |
| Deferred `pendingActivityForTask` open via store | Deep-link arrival and feed mount are decoupled (the feed needs to fetch first). A transient store field bridges them, consumed-and-cleared on mount. 2 s timeout prevents stale opens. |
| No new full-screen route prefix | `isFullScreenRoute()` is unchanged. Settings sub-screens are NOT full-screen — they keep the bottom tab bar visible. This is the explicit design choice. |

### LLM-developer guardrails

1. **DO NOT import** any `@renderer/components/ui/*` (Dialog, Input, Button, Select, Label, Card, Switch, RadioGroup, ScrollArea, Tabs, etc.). Mobile primitives only. AC-16 forbids it.
2. **DO NOT import** `@renderer/components/settings/AgentSettingsPanel` or any other desktop settings panel. They are reference material only — re-implement with mobile primitives.
3. **DO NOT add** a `useIsMobile()` branch to any desktop component. Mobile and desktop are separate trees per CLAUDE.md.
4. **DO NOT extend** `isFullScreenRoute()`. Settings sub-screens render inside `MobileScreen`. AC-14 is explicit.
5. **DO NOT clear** the activity tab stack when navigating to a task workspace from MobileActivityDetail — the user needs back-navigation. AC-8 specifies push + switchTab order.
6. **DO NOT** filter the new `useGlobalActivitySubscription` hook by task_id — it is the cross-task counterpart to the existing per-task hook, by design.
7. **DO NOT** show the loading skeleton on subsequent live updates. Only on first fetch. AC-6.
8. **DO** respect `prefers-reduced-motion` for the row glow animation. AC-3, 19.
9. **DO** debounce / throttle the live-region announcer to 1 s windows (AC-19) — unthrottled `aria-live` updates spam screen readers.
10. **DO** deduplicate by `activity.id` when prepending — the seed fetch and the subscription can race for the same row.
11. **DO** mark stub rows ("SSH Keys", "Mosh", "Cache") with subtitle "Coming soon" — never silently no-op.
12. **DO** use `min-h-11` (44 px) for every interactive row / chip / button — AC-18 is non-negotiable for touch.
13. **DO** verify token discipline with the AC-17 grep BEFORE marking the story complete.
14. **DO** run the full mobile test suite (`npm test -- src/mobile`) and confirm 0 failures + 22+ new passing tests.

### Library / framework requirements

| Lib | Why | Notes |
|-----|-----|-------|
| React 19 | Existing | `useEffect`, `useMemo`, `useState` only. No new patterns. |
| Tauri v2 | Existing | `@tauri-apps/api/event.listen` for global activity sub. `@tauri-apps/plugin-deep-link` for deep links (already wired). `@tauri-apps/plugin-os.platform()` for diagnostics. `@tauri-apps/api/app.getVersion()` for version. |
| rspc | Existing | `commands.listTasks`, `commands.listActivitiesForTask`, `commands.getConfig`, `commands.updateConfig`. NO new commands. |
| Zustand | Existing | Extend `useMobileNavStore` with `pendingActivityForTask` field. |
| react-query | Existing (via rspc) | Reuse hooks from `@renderer/hooks/`. |
| Tailwind v4 + tokens | Existing | Token-only colors per Calm Command. |
| Radix primitives | Existing (via MobileSheet) | No direct Radix usage in new files — mediated by MobileSheet primitive. |
| Lucide icons | Existing | `Activity`, `User`, `Bot`, `Wrench`, `AlertTriangle`, `Clock`, `Cpu`, `Palette`, `Info`, `FileText`, `Network`, etc. |
| sonner | Existing | Use only via `MobileToast` primitive. Do not import directly in new screens. |

### File structure

**New files:**

- `src/mobile/primitives/MobileSettingsRow.tsx` (~80 LOC)
- `src/mobile/primitives/MobileSettingsRow.test.tsx`
- `src/mobile/activity/MobileActivityRow.tsx`
- `src/mobile/activity/MobileActivityRow.test.tsx`
- `src/mobile/activity/MobileActivityDetail.tsx`
- `src/mobile/activity/activity-meta.ts`
- `src/mobile/activity/activity-meta.test.ts`
- `src/mobile/settings/MobileAgentSettings.tsx`
- `src/mobile/settings/MobileAgentSettings.test.tsx`
- `src/mobile/settings/MobileThemeSettings.tsx`
- `src/mobile/settings/MobileThemeSettings.test.tsx`
- `src/mobile/settings/MobileDiagnostics.tsx`
- `src/mobile/settings/MobileDiagnostics.test.tsx`
- `src/mobile/settings/MobileAbout.tsx`
- `src/mobile/settings/MobileAbout.test.tsx`
- `src/mobile/settings/MobileLicenses.tsx`
- `src/hooks/useGlobalActivitySubscription.ts`
- `src/hooks/useGlobalActivitySubscription.test.ts`

**Modified files:**

- `src/mobile/MobileApp.tsx` — add 5 route cases in `MobileRouteRenderer`. Do NOT change `isFullScreenRoute`.
- `src/mobile/activity/MobileActivityFeedScreen.tsx` — replace placeholder.
- `src/mobile/activity/MobileActivityFeedScreen.test.tsx` — new file or extend existing if present.
- `src/mobile/settings/MobileSettingsHome.tsx` — replace transitional placeholder.
- `src/mobile/settings/MobileSettingsHome.test.tsx` — new file.
- `src/mobile/shell/deeplinks.ts` — extend `case 'settings'` and add `case 'activity'`.
- `src/mobile/shell/deeplinks.test.ts` — add cases.
- `src/mobile/shell/mobile-nav.store.ts` — add `pendingActivityForTask: string | null` field + setter; have `navigateToDeepLink` set it for `tinsu://activity/{taskId}`.
- `src/mobile/shell/mobile-nav.store.test.ts` — add cases for new deep-link.
- `docs/agent-team-bmad-implementation.md` — append T3.5-8 section.

**Files to NOT touch:**

- `src/components/settings/*` — desktop reference only.
- `src/components/task/ActivitiesTab.tsx` — desktop reference only.
- `src-tauri/src/commands/activity.rs` — no new Rust command in this story.
- `src-tauri/src/services/activity_log.rs` — global emit already correct.

### Testing requirements

- **Unit + integration tests** via Vitest + React Testing Library, mocking `@renderer/lib/rspc` `commands.*` and `@tauri-apps/api/event.listen`. Use existing patterns from `MobileConnectionsListScreen.test.tsx` as reference.
- ≥ **22 new tests** across the AC-20 list. Aim higher in practice — settings sub-screens warrant 4–6 tests each.
- **No regressions** — full `npm test -- src/mobile` must pass. Existing tests for MobileConnectionsListScreen, MobileTaskWorkspaceScreen, deeplinks, mobile-nav.store unchanged in behaviour (any file changes must remain compatible).
- **Token grep** — AC-17 grep yields zero results. Document in story Dev Agent Record `Completion Notes`.
- **Cross-tree grep** — `rg "@renderer/components/ui" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx src/mobile/primitives/MobileActivityRow.tsx` yields zero results.

### Architecture compliance

| Rule | Compliance |
|------|------------|
| Mobile lives under `src/mobile/` | All new files under `src/mobile/*` except the new shared hook (`src/hooks/useGlobalActivitySubscription.ts`, parallel to existing `useActivitySubscription.ts`). |
| No `useIsMobile()` branches in desktop | Confirmed — no desktop file modified. |
| Reuse Rust backend / Zustand stores / rspc hooks | `commands.getConfig`, `commands.updateConfig`, `commands.listTasks`, `commands.listActivitiesForTask`, `useSshConnections`, `useMobileNavStore`. No new Rust commands. |
| Calm Command tokens | AC-17 grep enforces. |
| 5-tab mobile nav | Both tab roots (`'feed'`, `'home'`) wired correctly per `mobile-nav.store.ts` `TAB_ROOTS`. Story does not change tab structure. |
| Cross-tree allowlist | AC-16 enforces. |
| Touch targets ≥ 44 px | AC-18 + Tailwind `min-h-11`. |
| Accessibility | AC-19 (roles, aria-live, aria-modal). |

### Project Structure Notes

- All new code respects the `src/mobile/` parallel-tree boundary except `src/hooks/useGlobalActivitySubscription.ts` — that hook is a shared cross-task subscription utility and naturally lives next to the existing `useActivitySubscription.ts`. This is consistent with prior story patterns.
- `MobileSettingsRow` is the 16th mobile primitive. UX redesign §7.2 lists it. After this story, the mobile primitive set is complete for Epic 3.5.
- The `pendingActivityForTask` field in `useMobileNavStore` is a transient deep-link bridge — it is NOT persisted. Document inline.

### Previous story intelligence (T3.5-7 "done")

- `MobileConnectionsListScreen` and `MobileConnectionFormScreen` are done and used as references for token discipline, primitive composition, and cross-tree allowlist patterns.
- The `'connections'` route key is already wired in `MobileRouteRenderer` — `MobileSettingsHome`'s Connections row only needs to push that key.
- Two auto-fixes during T3.5-7 review: `useEffect` state sync on edit-mode form, not-found guard fix. Cross-check this story's screens for similar patterns (form mounting / async state).
- Story wasn't required to write a new Rust command — same precedent applies here.

### Latest technical specifics

- `Activity` shape (`src/shared/types/activity.types.ts`): `{ id, task_id, event_type, payload (JSON string), created_at (epoch ms) }`. Use `JSON.parse(activity.payload)` carefully — wrap in try/catch since it's a string.
- 12 event_types: `status_change`, `agent_start`, `agent_complete`, `tool_used`, `user_command`, `automation_trigger`, `error`, `session_ended`, `stall_detected`, `stall_recovered`, `auto_commit`, `rejection`. Filter map in AC-4 covers all 12.
- `commands.getConfig` returns full `Config` object (`devAgentModel`, `reviewAgentModel`, etc.). `commands.updateConfig` accepts a partial update. See `src/shared/types/config.types.ts` for schema.
- `MobileSheet` primitive supports `snap='half'|'full'|'fit'` — use `'half'` for activity detail, `'fit'` for picker sheets.

### References

- [Source: docs/agent-team-bmad-implementation.md] — bmad pipeline + frontend-design skill mandate
- [Source: _bmad-output/planning-artifacts/epics.md#T3.5-8 (lines 1087-1105)] — canonical AC
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] — Epic 3.5 charter (T3.5-8 covers cross-task activity, settings screens, empty states, skeletons)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§2.5] — Activity Tab screens (Feed, Filters, Detail)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§2.6] — Settings Tab screens (15 screens enumerated; this story scopes a subset; SSH Keys / Mosh / Cache deferred to follow-up)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§3.7] — Activity Log: chip strip categories, empty state copy, glow animation, prefers-reduced-motion
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§3.9] — Settings: list with sections, autosave on change, Diagnostics fields + Copy button
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§7.2] — `MobileSettingsRow` primitive spec
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#§8.3] — file structure (`src/mobile/activity/*`, `src/mobile/settings/*`)
- [Source: _bmad-output/implementation-artifacts/t3-5-7-mobile-ssh-and-connection-management.md] — reference story style + AC pattern
- [Source: src/mobile/MobileApp.tsx] — `MobileRouteRenderer`, `isFullScreenRoute`
- [Source: src/mobile/shell/mobile-nav.store.ts] — `TAB_ROOTS`, `pushRoute`, `popRoute`, `navigateToDeepLink`
- [Source: src/mobile/shell/deeplinks.ts] — `parseDeepLink` + existing `'settings'` case to extend
- [Source: src/hooks/useActivitySubscription.ts] — pattern for the new `useGlobalActivitySubscription`
- [Source: src/shared/types/activity.types.ts] — `Activity` shape + 12 event types
- [Source: src/components/task/ActivitiesTab.tsx] — desktop per-task activities view (REFERENCE ONLY — do not import)
- [Source: src/components/settings/AgentSettingsPanel.tsx] — desktop agent settings (REFERENCE ONLY — do not import)
- [Source: src-tauri/src/services/activity_log.rs] — global `'activity:created'` event emit confirmed
- [Source: src-tauri/src/commands/activity.rs] — confirmed only `list_activities_for_task` exists; no cross-task command (TS merge required)
- [Source: src/shared/types/config.types.ts] — `ClaudeModel`, `devAgentModel`, `reviewAgentModel` schemas
- [Source: CLAUDE.md] — mobile parallel-tree rule; no `useIsMobile()` branches in desktop

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (or current dev agent model per `commands.getConfig().devAgentModel`)

### Debug Log References

### Completion Notes List

- AC-17 token grep: `rg "text-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx` — EMPTY (clean).
- AC-16 cross-tree grep: `rg "@renderer/components/ui" src/mobile/activity src/mobile/settings src/mobile/primitives/MobileSettingsRow.tsx` — only doc-comment mentions, zero actual imports (clean).
- TypeScript: `npx tsc --noEmit` — clean, no errors.
- Full mobile test suite: 531 tests passing (55 test files), no regressions.
- New story tests: 101 tests passing across 10 test files.
- @tauri-apps/plugin-os: not installed — stubbed via vitest.config.ts alias (intentional, documented in story).
- trpc.config.get/update pattern: intentionally used (mirrors existing desktop AgentSettingsPanel, same tRPC backend wiring).

### File List

**New files created:**
- src/mobile/primitives/MobileSettingsRow.tsx
- src/mobile/primitives/MobileSettingsRow.test.tsx
- src/mobile/activity/activity-meta.ts
- src/mobile/activity/activity-meta.test.ts
- src/mobile/activity/MobileActivityRow.tsx
- src/mobile/activity/MobileActivityRow.test.tsx
- src/mobile/activity/MobileActivityDetail.tsx
- src/mobile/activity/MobileActivityFeedScreen.test.tsx
- src/mobile/settings/MobileAgentSettings.tsx
- src/mobile/settings/MobileAgentSettings.test.tsx
- src/mobile/settings/MobileThemeSettings.tsx
- src/mobile/settings/MobileThemeSettings.test.tsx
- src/mobile/settings/MobileDiagnostics.tsx
- src/mobile/settings/MobileDiagnostics.test.tsx
- src/mobile/settings/MobileAbout.tsx
- src/mobile/settings/MobileAbout.test.tsx
- src/mobile/settings/MobileLicenses.tsx
- src/hooks/useGlobalActivitySubscription.ts
- src/hooks/useGlobalActivitySubscription.test.ts
- src/__mocks__/tauri-plugin-os.ts

**Modified files:**
- src/mobile/activity/MobileActivityFeedScreen.tsx
- src/mobile/settings/MobileSettingsHome.tsx
- src/mobile/MobileApp.tsx
- src/mobile/MobileApp.test.tsx
- src/mobile/shell/deeplinks.ts
- src/mobile/shell/deeplinks.test.ts
- src/mobile/shell/mobile-nav.store.ts
- src/mobile/shell/mobile-nav.store.test.ts
- src/mobile/primitives/index.ts
- src/globals.css
- vitest.config.ts
- docs/agent-team-bmad-implementation.md

## Review Findings (DEV 2 — 2026-04-30)

- [x] [Review][Patch] require('sonner') CommonJS dynamic in ESM module [MobileSettingsHome.tsx:37] — **fixed**: replaced with static `import { toast } from 'sonner'`
- [x] [Review][Patch] pendingActivityForTask deep-link consumed when activities=[] on mount — detail sheet never opens [MobileActivityFeedScreen.tsx:120-141] — **fixed**: effect now waits for `!isLoading` before consuming the pending taskId
- [x] [Review][Patch] Agent model rows in MobileSettingsHome missing `value=current model` per AC-9 [MobileSettingsHome.tsx:75-88] — **fixed**: added tRPC config query to show current model labels
- [x] [Review][Defer] Nested role="dialog" inside MobileSheet Radix dialog [MobileActivityDetail.tsx:103] — deferred, pre-existing Radix sheet wrapping pattern; low a11y impact since Radix handles the outer dialog role; follow-up in T3.5-9.
- Dismissed (1): React.ReactNode without explicit import in MobileThemeSettings.tsx — valid with react-jsx transform + @types/react global namespace.
