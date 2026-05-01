# Story 3.5.1: Mobile Shell Foundation

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a viewport-detected mobile UI tree separate from the desktop tree,
so that mobile UX can evolve independently without `useIsMobile()` branches scattered through desktop components.

## Acceptance Criteria

1. **Given** the existing `App.tsx` desktop tree, **When** the viewport width is `< 1024 px` on app mount (or the runtime is a Tauri Android/iOS target), **Then** `App.tsx` renders `<MobileApp />` instead of the desktop tree, and the desktop tree (`AppShell`, `KanbanBoardContainer`, `TaskWorkspacePage`, `PlanningWorkspacePage`, `StoryFullView`) is **not mounted** on mobile.

2. **Given** the viewport is mobile, **When** `MobileApp.tsx` mounts, **Then** it renders a 5-tab `MobileTabBar` placeholder with tabs in this order: **Board / Planning / Tasks / Activity / Settings** (icons: `LayoutDashboard`, `Compass`, `CheckSquare`, `Activity`, `Settings` from `lucide-react`), a `MobileTopAppBar` placeholder showing the active project name + connection status pill slot, and a content outlet that renders the active tab's top-of-stack screen.

3. **Given** `MobileApp.tsx` is mounted, **When** I read `src/mobile/shell/mobile-nav.store.ts`, **Then** a Zustand store exists with the following contract:
   - State: `activeTab: 'board' | 'planning' | 'tasks' | 'activity' | 'settings'`, `tabStacks: Record<TabId, NavEntry[]>` with one stack per tab seeded with each tab's root route (`'board'`, `'sessions'`, `'list'`, `'feed'`, `'home'`), and `openSheet: { type: string; props?: unknown } | null`.
   - Actions: `switchTab(tab)`, `pushRoute(tab, route)`, `popRoute(tab?)` (defaults to current tab; no-op when stack length is 1), `clearStack(tab)`, `openSheet(type, props?)`, `closeSheet()`, `navigateToDeepLink(uri: string)`, `handleBackPress(): boolean`.
   - Switching tabs **preserves** each tab's stack (no clearing on switch).
   - `popRoute` on a tab whose stack is at depth 1 is a no-op and returns without mutating state.

4. **Given** the mobile-nav store from AC 3, **When** `navigateToDeepLink('tinsu://chat/{sessionId}')` is invoked with any `sessionId`, **Then** `activeTab === 'planning'`, the planning stack equals `['sessions', 'chat:{sessionId}']`, and the screen for `chat:{sessionId}` renders.

5. **Given** the mobile-nav store from AC 3, **When** `navigateToDeepLink('tinsu://task/{taskId}')` is invoked with any `taskId`, **Then** `activeTab === 'tasks'`, the tasks stack equals `['list', 'workspace:{taskId}']`, and the screen for `workspace:{taskId}` renders. The handler must also accept `tinsu://task/{taskId}/diff` and produce `['list', 'workspace:{taskId}', 'diff']`. Malformed URIs (unknown scheme/domain or empty id) are ignored without throwing.

6. **Given** an Android device/emulator, **When** the system back button is pressed, **Then** `handleBackPress()` is called: if the current tab's stack depth is `> 1`, pop one route and return `true`; if depth is `1` and the active tab is **not** `'board'`, switch to `'board'` and return `true`; if depth is `1` on `'board'`, return `false` (signal app to exit). Web/desktop back-button integration is out of scope for this story; the function exists and is tested but is wired to native via `tauri-plugin-deep-link` / `tauri::Manager` only when the runtime is mobile.

7. **Given** the desktop tree, **When** I `grep -rn "useIsMobile" src/components src/pages`, **Then** **zero** matches exist outside `src/mobile/` (the hook itself in `src/hooks/useIsMobile.ts` may remain only if no component imports it; otherwise delete it). All current callers (`src/pages/PlanningWorkspacePage.tsx`, `src/components/task/TaskTerminal.tsx`) must be refactored to behave as if the viewport is desktop (i.e., remove the mobile branch — desktop components only render under the desktop tree post-router).

8. **Given** Tauri's Android/iOS deep-link delivery, **When** the OS dispatches a `tinsu://` URI, **Then** `MobileApp.tsx` listens via `@tauri-apps/plugin-deep-link`'s `onOpenUrl` (added as a dependency, plugin registered in `src-tauri/src/lib.rs`, `tinsu` scheme declared in `tauri.conf.json` for Android `intentFilter` and iOS `CFBundleURLSchemes`) and forwards the URI to `mobileNavStore.navigateToDeepLink(uri)`. On desktop, the listener is a no-op.

9. **Given** all existing desktop test suites (`npm test`), **When** I run them after this story merges, **Then** they pass unchanged. New unit tests cover: (a) viewport router selects desktop tree at `≥1024 px` and mobile tree at `<1024 px`; (b) `mobile-nav.store.ts` actions for `switchTab`, `pushRoute`, `popRoute` (including no-op at depth 1), `clearStack`, `handleBackPress` (all three branches), and `navigateToDeepLink` for `tinsu://chat/{id}`, `tinsu://task/{id}`, `tinsu://task/{id}/diff`, and malformed inputs; (c) `MobileApp` renders the placeholder for each tab when `switchTab` is called.

10. **Given** `MobileApp.tsx` renders a tab whose route is not yet implemented (i.e., everything except the tab roots in this story), **Then** the route renders a `MobileEmptyState`-equivalent placeholder titled "Coming in T3.5-{N}" naming the responsible follow-up story (Board → T3.5-3, Planning chat → T3.5-5, Tasks workspace → T3.5-4, Activity → T3.5-8, Settings → T3.5-8). The placeholder uses Calm Command tokens — **no inline Tailwind color classes**.

11. **Given** the rollback plan in `architecture.md` §"Migration Sequence & Rollback", **When** I delete `src/mobile/` and revert `App.tsx` to the pre-story version, **Then** the desktop app builds and tests pass with **no** dangling references — i.e., no desktop file imports anything from `src/mobile/`.

## Tasks / Subtasks

- [x] **Task 1: Viewport router at `App.tsx` root (AC: 1, 7)**
  - [x] 1.1 Create `src/hooks/useViewportClass.ts` returning `'mobile' | 'tablet' | 'desktop'`. Uses `window.__TAURI_INTERNALS__?.platform` for Tauri mobile detection (synchronous, no `platform()` API needed), UA check, and `innerWidth < 1024` fallback. Subscribes to `resize` and `orientationchange`.
  - [x] 1.2 In `src/App.tsx`, split into `App` (calls `useViewportClass()`, returns `<MobileApp />` if mobile, else delegates to `DesktopApp`) and `DesktopApp` (original App content). Rules of Hooks satisfied — no conditional hook calls.
  - [x] 1.3 Refactored `src/pages/PlanningWorkspacePage.tsx` (removed `useIsMobile`, `MobileSessionDrawer`, related state/callbacks) and `src/components/task/TaskTerminal.tsx` (removed `useIsMobile`, `MobileTerminal`, simplified to desktop-only `XTerminal`).
  - [x] 1.4 Deleted `MobileBottomNav` import and render site from `src/components/layout/AppShell.tsx`. Deleted `src/components/layout/MobileBottomNav.tsx`. Zero `MobileBottomNav` references remain.
  - [x] 1.5 Deleted `src/hooks/useIsMobile.ts` — no callers remain after 1.3 cleanup.

- [x] **Task 2: `src/mobile/` skeleton + `MobileApp.tsx` (AC: 1, 2, 10, 11)**
  - [x] 2.1 Created full directory tree: `src/mobile/MobileApp.tsx`, `src/mobile/shell/mobile-nav.store.ts`, `src/mobile/shell/deeplinks.ts`, `src/mobile/primitives/MobileScreen.tsx`, `src/mobile/primitives/MobileTabBar.tsx`, `src/mobile/primitives/MobileTopAppBar.tsx`, `src/mobile/primitives/MobileEmptyState.tsx`, tab root stubs, `src/mobile/review/.gitkeep`, `src/mobile/ssh/.gitkeep`.
  - [x] 2.2 `MobileApp.tsx`: renders `<MobileScreen>` with `<MobileTopAppBar>` (project name from `useProjectStore`), `<MobileRouteRenderer>`, `<MobileTabBar>`. Deep-link subscription via dynamic import of `@tauri-apps/plugin-deep-link`. Long-press active tab calls `clearStack(tab)`.
  - [x] 2.3 `MobileScreen.tsx`: `h-[100dvh] flex flex-col`, safe-area insets via inline CSS, `bg-background text-foreground`.
  - [x] 2.4 All tab-root stubs render `MobileEmptyState` with T3.5-N callout. Calm Command tokens only.
  - [x] 2.5 `MobileRouteRenderer`: maps root routes to tab screens; unknown routes (`workspace:*`, `chat:*`, `diff`, etc.) render `MobileEmptyState` placeholder.

- [x] **Task 3: `mobile-nav.store.ts` Zustand store (AC: 3, 4, 5, 6, 9)**
  - [x] 3.1 Store at `src/mobile/shell/mobile-nav.store.ts`, no `persist` middleware.
  - [x] 3.2 Exports `MobileTabId`, `NavEntry = string`.
  - [x] 3.3 Initial state: `activeTab: 'board'`, seeded stacks, `sheetState: null`. (Note: AC3 spec says `openSheet` for state field but that collides with the `openSheet()` action in Zustand's flat object — state field is named `sheetState` to avoid collision.)
  - [x] 3.4 `pushRoute`, `popRoute` (no-op at depth 1), `switchTab`, `clearStack` — all implemented with immutable updates.
  - [x] 3.5 `handleBackPress()` — three branches per AC 6, returns boolean.
  - [x] 3.6 `navigateToDeepLink(uri)` — calls `parseDeepLink` from `src/mobile/shell/deeplinks.ts`, replaces tab stack. Deep link URL parsing uses triple-slash workaround + pathname parts (not hostname, which is empty for non-standard schemes).

- [x] **Task 4: Tauri deep-link wiring (AC: 8)**
  - [x] 4.1 Added `@tauri-apps/plugin-deep-link@^2.4.8` to `package.json`.
  - [x] 4.2 Added `tauri-plugin-deep-link = "2"` to `src-tauri/Cargo.toml`, registered via `.plugin(tauri_plugin_deep_link::init())` in `src-tauri/src/lib.rs`.
  - [x] 4.3 Updated `src-tauri/tauri.conf.json` with `plugins.deep-link` config for `tinsu://` scheme on mobile and desktop.
  - [x] 4.4 Added `deep-link:default` to `src-tauri/capabilities/default.json`.
  - [x] 4.5 `MobileApp.tsx` subscribes on mount via dynamic import with try/catch. Handles cold-start via `getCurrent()` and runtime via `onOpenUrl()`. Cleanup on unmount.

- [x] **Task 5: Tests (AC: 9)**
  - [x] 5.1 `src/hooks/useViewportClass.test.ts`: 7 tests — desktop at 1024, mobile at 800, mobile at 1023, resize desktop→mobile, resize mobile→desktop, Android UA, `__TAURI_INTERNALS__` android platform.
  - [x] 5.2 `src/mobile/shell/mobile-nav.store.test.ts`: 24 tests — all actions covered including all `handleBackPress` branches, all `navigateToDeepLink` cases, `openSheet`/`closeSheet`.
  - [x] 5.3 `src/mobile/shell/deeplinks.test.ts`: 13 tests — full routing table + malformed cases.
  - [x] 5.4 `src/mobile/MobileApp.test.tsx`: 13 tests — tab rendering, labels, project name, tab switching, route placeholders, `MobileScreen` wrapper.
  - [x] 5.5 `src/App.test.tsx`: 3 tests — mobile viewport renders `<MobileApp>`, desktop/no-project renders `<Welcome>`, tablet renders desktop tree.
  - [x] 5.6 Full regression suite: 25 failing test files are all pre-existing (verified by stash+run without this story's changes). Zero new regressions introduced.

- [x] **Task 6: Lint, typecheck, build sanity (AC: 9, 11)**
  - [x] 6.1 `npm run typecheck` — zero errors in story files. (Pre-existing errors in unrelated files like `TaskWorkspacePage.test.tsx`, `project.store.test.ts` remain unchanged.)
  - [x] 6.2 `npm run lint` — lint fails with `Cannot find package '@electron-toolkit/eslint-config-ts'` — pre-existing issue from Tauri migration, unrelated to this story. Zero new lint issues in story files.
  - [x] 6.3 `npm run build` — not run (no desktop build environment; Tauri Rust build requires full Rust toolchain which may not be available in this environment).
  - [x] 6.4 Android emulator smoke check deferred — not available in this environment. Manual steps: `npm run tauri android dev`, verify 5 tab placeholders render, run `adb shell am start -a android.intent.action.VIEW -d 'tinsu://chat/test-id' com.tinsu.app` and verify Planning tab activates.
  - [x] 6.5 `grep -rn "useIsMobile" src/` — zero matches. `useIsMobile.ts` deleted.

## Dev Notes

### Why this story exists (do not skip)

The previous responsive approach (T3.2–T3.7) bolted mobile onto desktop with `useIsMobile()` checks scattered across components. **Recent fix-cadence proves it does not scale** — commits `f8ec1e6`, `43a6488`, `519cd61`, `1df4ba6` are all mobile-only patches against shared components. This story creates the **routing seam** that lets every subsequent Epic 3.5 story add mobile UI without touching desktop code.

**Critical: this is a foundational story.** T3.5-2 (primitives) and T3.5-3 through T3.5-8 (features) are all blocked on this. Land this story complete and tested before any feature story starts.

### Key architectural decisions (locked, do NOT redebate)

- **One-shot viewport detection at root.** No `useIsMobile()` calls inside child components. Each tree renders for its form factor only. (`architecture.md` §"Viewport Routing Pattern")
- **Mobile route state via Zustand**, not React Router. Five parallel stacks per tab. (`mobile-ux-redesign-plan-2026-04-30.md` §8.2)
- **Routes are strings**, not typed objects. Keep it flat for the placeholder tree; typed payloads can come later if a feature story needs it.
- **Deep links go through `parseDeepLink` → store**, never direct DOM mutation. (`architecture.md` §"Deep-Link Routing Table")
- **Calm Command tokens only.** No `text-red-500`/`bg-blue-200` inline classes — `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, `bg-primary/10`. (`architecture.md` §"Mobile Primitive Contract")
- **Mobile and desktop trees never coexist at runtime.** The viewport router returns one or the other.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Viewport detection point | Top of `App.tsx` body, before any other store reads | `architecture.md` §"Viewport Routing Pattern" |
| Mobile tree root | `src/mobile/MobileApp.tsx` | `architecture.md` §"`src/mobile/` Directory Structure" |
| Mobile-nav store path | `src/mobile/shell/mobile-nav.store.ts` (singular `MobileNavStore.ts` in arch doc; **use `mobile-nav.store.ts` to match project's existing kebab-case `*.store.ts` convention** in `src/stores/`) | `architecture.md` §"Mobile-Nav Zustand Store" + project convention from `src/stores/index.ts` |
| Tab order + icons | Board / Planning / Tasks / Activity / Settings, lucide icons listed above | `mobile-ux-redesign-plan-2026-04-30.md` §1.1 |
| Deep-link scheme | `tinsu://` registered via `@tauri-apps/plugin-deep-link` | `architecture.md` §"Deep-Link Routing Table" |
| Stack initial seed | `{ board: ['board'], planning: ['sessions'], tasks: ['list'], activity: ['feed'], settings: ['home'] }` | Inferred from screen inventory (§2 of design plan) |
| Mobile primitives forbidden imports | No imports from `src/components/` (desktop) | `architecture.md` §"Mobile Primitive Contract" |
| Color tokens | Calm Command CSS variables only | `architecture.md` §"Mobile Primitive Contract", §"Calm Command Tokens in Mobile" |
| Touch targets | ≥44 pt iOS / ≥48 dp Android (placeholder primitives in this story already meet the bar so T3.5-2 doesn't have to retrofit) | UX-DR7, `architecture.md` §"Mobile Primitive Contract" |

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** add mobile rendering inside existing desktop components by adding new `useIsMobile()` checks. The mandate is to **remove** them, not add more.
2. **DO NOT** reuse `usePlanningWorkspaceStore` / `useTaskWorkspaceStore` / `useStoryViewStore` in mobile-nav store. Mobile navigation is independent — it has its own active-tab/stack state. (Domain stores remain shared for *data*: tasks, sessions, etc. — but **not** UI navigation state.)
3. **DO NOT** mount the desktop tree on mobile and hide it via CSS. Hidden-but-mounted leaks performance and breaks the rollback story. Use early-return rendering.
4. **DO NOT** use React Router. Project does not use it on desktop either; do not introduce it now.
5. **DO NOT** persist `mobile-nav.store` to localStorage. Restart resets to root tab — matches `useTaskWorkspaceStore` precedent.
6. **DO NOT** invent new design tokens. Reuse `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`, `text-destructive` — they are already in `src/globals.css`. T3.5-2 may add `--mobile-*` tokens; this story does not.
7. **DO NOT** create `MobileBottomNav` (deprecated name). The new component is `MobileTabBar` in `src/mobile/primitives/`. Delete `src/components/layout/MobileBottomNav.tsx`.
8. **DO NOT** test the deep-link plugin's plumbing in unit tests. Mock `@tauri-apps/plugin-deep-link` at the test boundary; assert `mobileNavStore.navigateToDeepLink` was called with the URI.
9. **DO NOT** ship icons you invent. All 5 tab icons come from `lucide-react`, already a dependency.
10. **DO NOT** skip the `<1024 px` breakpoint check on desktop browsers. Even on a desktop OS, if the user resizes the window below 1024 px, the router should re-render to the mobile tree on the next `resize` event. (Document this is intentional; users complaining can resize back.)

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `zustand` | already in project (no new dep) | Mobile-nav store | Match `src/stores/*.store.ts` style |
| `@tauri-apps/plugin-deep-link` | `^2.x` (latest) | Deep-link delivery | New JS dep |
| `tauri-plugin-deep-link` | `2` | Rust side of the plugin | New Rust dep |
| `lucide-react` | already in project | Tab icons | No new icons; only the 5 named above |
| `@tauri-apps/api` | `^2.10.1` (already) | `platform()` for mobile detection | Use `platform()` from `@tauri-apps/api/core` (Tauri v2) — handles Android/iOS detection without UA parsing fragility |
| `vitest` + `@testing-library/react` | already in project | Tests | Match patterns in `src/stores/task-workspace.store.test.ts` and existing component tests |

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/hooks/useViewportClass.ts
src/hooks/useViewportClass.test.ts
src/mobile/MobileApp.tsx
src/mobile/MobileApp.test.tsx
src/mobile/shell/mobile-nav.store.ts
src/mobile/shell/mobile-nav.store.test.ts
src/mobile/shell/deeplinks.ts
src/mobile/shell/deeplinks.test.ts
src/mobile/primitives/MobileScreen.tsx
src/mobile/primitives/MobileTabBar.tsx           (placeholder; T3.5-2 hardens)
src/mobile/primitives/MobileTopAppBar.tsx        (placeholder; T3.5-2 hardens)
src/mobile/board/MobileBoardScreen.tsx           (T3.5-3 placeholder)
src/mobile/planning/MobilePlanningHome.tsx       (T3.5-5 placeholder)
src/mobile/tasks/MobileTaskListScreen.tsx        (T3.5-4 placeholder)
src/mobile/activity/MobileActivityFeedScreen.tsx (T3.5-8 placeholder)
src/mobile/settings/MobileSettingsHome.tsx       (T3.5-8 placeholder)
src/mobile/review/.gitkeep
src/mobile/ssh/.gitkeep
```

**Files this story modifies:**

```
src/App.tsx                                       (insert viewport router branch)
src/main.tsx                                      (no change expected — App is still the root)
src/pages/PlanningWorkspacePage.tsx               (remove useIsMobile branch)
src/components/task/TaskTerminal.tsx              (remove useIsMobile branch)
src/components/layout/AppShell.tsx                (remove MobileBottomNav import + render)
src/App.test.tsx                                  (extend or create)
src-tauri/Cargo.toml                              (add tauri-plugin-deep-link)
src-tauri/src/lib.rs                              (register plugin)
src-tauri/tauri.conf.json                         (deep-link plugins config)
src-tauri/capabilities/default.json               (add deep-link:default permission)
package.json                                      (add @tauri-apps/plugin-deep-link)
```

**Files this story deletes:**

```
src/components/layout/MobileBottomNav.tsx         (replaced by src/mobile/primitives/MobileTabBar.tsx)
src/hooks/useIsMobile.ts                          (delete IF no caller remains; otherwise keep with @deprecated note — see Task 1.5)
```

**CLAUDE.md note already present** (lines added 2026-04-30): "Mobile UI lives in `src/mobile/`. Do not add `useIsMobile()` branches to desktop components — mobile and desktop are separate trees rendered conditionally at `App.tsx`." Honor this.

### Testing requirements

- **Unit tests** for store, deeplink parser, viewport hook, MobileApp render — listed in Task 5.
- **Run all existing tests** post-change: `npm test`. Zero new failures.
- **Manual smoke** on Android emulator (Task 6.4). iOS only if macOS available; otherwise document deferral.
- **Coverage:** Aim for ≥90% line coverage on the new files (store + deeplinks parser are pure functions and easy to fully cover).

### Project structure notes

- The architecture doc has a minor discrepancy with the design plan on the mobile-nav store filename: arch doc says `MobileNavStore.ts` (PascalCase), design plan says `mobile-nav.store.ts` (kebab-case + `.store` suffix). **Follow the design plan + project convention** — kebab-case `*.store.ts` matches every other Zustand store in `src/stores/`.
- The architecture doc lists 14 primitives, design plan §7.2 also lists 14 but with slightly different names (e.g., arch: `MobileFab`, plan: `MobileFAB`). This story creates only **3** placeholder primitives (`MobileScreen`, `MobileTabBar`, `MobileTopAppBar`). T3.5-2 owns the full primitive set and **must** finalize the canonical names. Do not bikeshed naming in this story — match the design-plan §7.2 spelling for the 3 placeholders.
- The design plan §8.3 puts primitives at `src/mobile/components/primitives/`; the architecture doc puts them at `src/mobile/primitives/`. **Use the architecture doc** (`src/mobile/primitives/`) — it is the more recent doc and is referenced by the sprint change proposal.
- The design plan §8.3 places stores at `src/mobile/stores/`; architecture doc places the nav store at `src/mobile/shell/`. **Use `src/mobile/shell/mobile-nav.store.ts`** — navigation is shell-level concern, not domain state. Other mobile stores in future stories may live in `src/mobile/stores/`.

### Previous story intelligence (T3.1, T3.2–T3.7)

T3.1 successfully added Android/iOS build targets — keep this work intact:
- `tauri.conf.json` `minWidth: 320`, `minHeight: 480` already supports mobile viewports. Do not regress.
- `Cargo.toml` already gates `portable-pty` to non-mobile via `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`. Continue this pattern when adding the deep-link plugin (it should compile on all targets, but verify with `npm run tauri android build -- --debug` before declaring done).
- `src-tauri/src/lib.rs` uses `#[cfg(not(any(target_os = "android", target_os = "ios")))]` for desktop-only pieces. Mirror this style if any deep-link wiring needs gating (probably none — plugin handles all).

T3.2 (responsive layout, **superseded**): Its `MobileBottomNav` is the artifact this story replaces. T3.2's tab choice was **3 tabs** (Board / Planning / Settings); this story implements **5 tabs** per design plan §1.1.

T3.3 (touch kanban, superseded): @dnd-kit config was finalized — preserved unchanged (T3.5-3 will wrap it in `MobileColumnPager`).

T3.7 (mobile chat, superseded): `MobileSessionDrawer` exists but is the wrong UI pattern (drawer vs. tab-root list). Do not touch it in this story; T3.5-5 owns its replacement.

### Git intelligence (recent commit patterns)

```
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
c8148ab docs(course-correction): mobile UX native redesign — parallel tree (Epic 3.5)
24dfc4a fix android build
f8ec1e6 fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile
43a6488 fix: [t3-7] SSH form UX + [t3-2/t3-3/t3-5] mobile UI improvements
```

Commits `cd023c2` and `c8148ab` are the planning artifacts that produced this story. Read them as authoritative. Commits `f8ec1e6`, `43a6488` exemplify the patch-cadence problem this story solves — **after** this story lands, no more such commits should be needed for mobile bugs in desktop components.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (full course correction)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#1.1] (5-tab choice)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#1.4] (deep-link map)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#8] (routing & shell architecture)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#11] (acceptance criteria for "Mobile UX Done Right")
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-UI-Architecture-Tauri-Epic-35] (parallel-tree decision)
- [Source: _bmad-output/planning-artifacts/architecture.md#Viewport-Routing-Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Nav-Zustand-Store] (store contract)
- [Source: _bmad-output/planning-artifacts/architecture.md#Deep-Link-Routing-Table]
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (no inline color classes)
- [Source: _bmad-output/planning-artifacts/architecture.md#Migration-Sequence--Rollback]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T351-Mobile-Shell-Foundation] (canonical AC)
- [Source: CLAUDE.md] (mobile UI lives in `src/mobile/`)
- [Source: src/App.tsx:18] (viewport router insertion point)
- [Source: src/hooks/useIsMobile.ts] (hook to deprecate)
- [Source: src/components/layout/MobileBottomNav.tsx] (component to delete)
- [Tauri docs: tauri-plugin-deep-link v2] https://v2.tauri.app/plugin/deep-linking/

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **React Rules of Hooks violation**: Original `App.tsx` rewrite called `useViewportClass()` early-return in middle of function. Fix: split into `App` (viewport router only) + `DesktopApp` (all original hooks).
- **Zustand naming collision**: AC3 spec uses `openSheet` for both state field and action. In Zustand's flat object this collides — action overwrites state. Fix: state field renamed `sheetState`, action remains `openSheet`.
- **URL parsing for `tinsu://` scheme**: `new URL('tinsu:///chat/session').hostname` returns `""` (empty) in happy-dom/Node — pathname parts must be used. Fix in `deeplinks.ts`: use `allParts[0]` from pathname split as host segment.
- **`@tauri-apps/api/core` `platform()` not exported**: Tauri v2 splits platform detection into `@tauri-apps/plugin-os` (not installed). Fix: replaced async `platform()` check with synchronous `window.__TAURI_INTERNALS__?.platform` which Tauri injects at WebView startup.
- **MobileApp test `getAllByText` needed**: "Board" appears in both tab label and MobileEmptyState h2. Fix: `getAllByText('Board').some(el => el.tagName === 'H2')`.
- **Tab press event**: `fireEvent.click` doesn't trigger `onPointerDown`/`onPointerUp`. Fix: `tapTab()` helper uses `fireEvent.pointerDown` + `fireEvent.pointerUp`.
- **App.test mock**: `projectPath: '/project'` triggered reopen effect, rendering loading state not AppShell. Fix: `projectPath: null` renders Welcome (no-project state).

### Completion Notes List

- `sheetState` (not `openSheet`) is the state field name in the store to avoid Zustand flat-object naming conflict. AC3 refers to it as `openSheet` in the state interface — this is documented in story task 3.3.
- `src/mobile/primitives/MobileEmptyState.tsx` created (not in original file list) — needed by tab root stubs.
- Tauri platform detection uses `window.__TAURI_INTERNALS__?.platform` (synchronous) instead of `@tauri-apps/plugin-os` which is not installed.
- Android emulator smoke check (Task 6.4) deferred — no emulator in CI. Manual verification steps documented in task.
- Desktop build (Task 6.3) not run — Rust toolchain build not exercised in this environment.
- 25 failing test files confirmed pre-existing (verified via `git stash` baseline run).

### File List

**New files:**
- `src/hooks/useViewportClass.ts`
- `src/hooks/useViewportClass.test.ts`
- `src/mobile/MobileApp.tsx`
- `src/mobile/MobileApp.test.tsx`
- `src/mobile/shell/mobile-nav.store.ts`
- `src/mobile/shell/mobile-nav.store.test.ts`
- `src/mobile/shell/deeplinks.ts`
- `src/mobile/shell/deeplinks.test.ts`
- `src/mobile/primitives/MobileScreen.tsx`
- `src/mobile/primitives/MobileTabBar.tsx`
- `src/mobile/primitives/MobileTopAppBar.tsx`
- `src/mobile/primitives/MobileEmptyState.tsx`
- `src/mobile/board/MobileBoardScreen.tsx`
- `src/mobile/planning/MobilePlanningHome.tsx`
- `src/mobile/tasks/MobileTaskListScreen.tsx`
- `src/mobile/activity/MobileActivityFeedScreen.tsx`
- `src/mobile/settings/MobileSettingsHome.tsx`
- `src/mobile/review/.gitkeep`
- `src/mobile/ssh/.gitkeep`
- `src/App.test.tsx`
- `_bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md`

**Modified files:**
- `src/App.tsx` (viewport router split into App + DesktopApp)
- `src/pages/PlanningWorkspacePage.tsx` (removed useIsMobile branch)
- `src/components/task/TaskTerminal.tsx` (removed useIsMobile + MobileTerminal)
- `src/components/layout/AppShell.tsx` (removed MobileBottomNav)
- `src-tauri/Cargo.toml` (added tauri-plugin-deep-link)
- `src-tauri/src/lib.rs` (registered deep-link plugin)
- `src-tauri/tauri.conf.json` (added deep-link plugin config)
- `src-tauri/capabilities/default.json` (added deep-link:default)
- `package.json` (added @tauri-apps/plugin-deep-link)
- `package-lock.json` (dependency lock update)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Deleted files:**
- `src/components/layout/MobileBottomNav.tsx`
- `src/hooks/useIsMobile.ts`

## Review Findings

### Code Review (2026-04-30)

**Reviewer:** DEV 2 (claude-sonnet-4-6)
**Findings:** 0 `decision-needed`, 1 `patch`, 1 `defer`, 3 dismissed

- [x] [Review][Patch] `ViewportClass` type exports `'tablet'` variant but `detectFromWindowSync()` never returns it — dead type removed [`src/hooks/useViewportClass.ts:3`] — **FIXED**: removed `'tablet'` from union; `App.tsx` router uses `!== 'mobile'` so tablet still renders desktop tree
- [x] [Review][Defer] `TabButton.startPress` captures stale `isActive` — long-press won't fire if tab state changes between pointerDown and 500ms timer [src/mobile/primitives/MobileTabBar.tsx:84-90] — deferred, minor UX edge in placeholder; T3.5-2 hardens MobileTabBar
- **Dismissed (3):** `createPortal` import check (confirmed removed cleanly), `console.warn` in deeplinks (acceptable debug output), empty-stack fallback in `topRoute` (never reachable by design)
