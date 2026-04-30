---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-12'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-task-execution-sandbox.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/project-context.md
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
workflowType: 'architecture'
project_name: 'TinSu'
user_name: 'Tinsu'
date: '2026-04-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines 53 functional requirements across 10 capability areas, plus 47 FRs from the Task Execution Sandbox feature extension (100 total FRs):

- **Board & Task Management (FR1-FR6):** Kanban interface with drag-and-drop, Sprint/Epic/Story hierarchy, task velocity metrics
- **Agent Execution (FR7-FR11):** Claude Code CLI integration via tmux, automatic context loading, real-time terminal view
- **Agent Monitoring & Control (FR12-FR16):** Stall detection, Pause/Resume, reasoning log visibility
- **Review & Approval (FR17-FR21):** Diff view via Monaco Editor, Approve/Reject/Request Changes, feedback loop
- **Git & Version Control (FR22-FR27):** Worktree per task, branch naming convention, merge on approve, conflict detection
- **Project Configuration (FR28-FR31):** Methodology selection (BMAD/TaskMaster), YAML config, story file reading
- **Data Persistence (FR32-FR35):** SQLite for state, agent run history, searchable logs, version-controlled config
- **Planning Workspace (FR36-FR43):** Multi-agent chat sessions with BMAD workflow sidebar, persistent tmux-backed sessions, bidirectional communication
- **Concurrent Agent Support (FR44-FR47):** Multiple simultaneous sessions, background execution, live status indicators
- **Multi-Project & Persistence (FR48-FR53):** Project-scoped sessions, cross-project concurrency, session health monitoring

**Task Execution Sandbox FRs (TES FR1-FR47):** Per-task terminal management, activity logging (7 event types), 3-column task workspace, diff viewer, workflow automation (Story vs Basic tasks), scrollback persistence, session-task mapping

**Non-Functional Requirements:**
32 NFRs from the main PRD + TES NFRs that drive architectural decisions:

- **Performance:** <100ms UI interactions, <500ms terminal streaming, <1s board load, <200ms tab switching
- **Reliability:** 5-minute stall detection, crash recovery without data loss, ACID SQLite, 100% terminal persistence across restart/reboot
- **Concurrency:** 5+ simultaneous chat sessions, 10+ concurrent task terminals
- **Session Management:** <15s session creation, <2s stale detection, 100% hook routing accuracy, zero background message loss
- **Integration:** tmux required on host, Claude Code hooks system, PTY on macOS/Linux

**Scale & Complexity:**

- Primary domain: Full-stack cross-platform application (Rust backend + React frontend + SSH networking)
- Complexity level: High
- Estimated architectural components: 12-15 major subsystems (increased from 8-10 due to SSH layer + platform abstraction)

### Technical Constraints & Dependencies

1. **Tauri v2 Runtime:** WebView-based (WKWebView on macOS/iOS, WebView2 on Windows, WebKitGTK on Linux, Android WebView) — replaces Electron's Chromium. Minor rendering differences possible.
2. **Rust Backend:** All services rewritten in Rust. Async runtime (tokio) for I/O. No Node.js in the final app.
3. **Claude Code CLI Prerequisite:** Must be installed separately on the machine where agents run (local or remote)
4. **tmux Prerequisite:** Required on the execution host — locally on desktop, remotely on the SSH target for mobile
5. **Git Repository Required:** Project directory must be git-initialized (same as before)
6. **Platform Support:** macOS, Linux, Windows (desktop); Android, iOS (mobile) — Windows added vs. Electron MVP
7. **Local-First + Remote:** Desktop operates locally (existing behavior). Mobile and remote-desktop connect via SSH to a machine with Claude Code + tmux.
8. **Single-User:** No authentication, RBAC, or multi-device sync for MVP (unchanged)

### Cross-Cutting Concerns Identified

1. **Type-Safe IPC Across Language Boundary:** tRPC provided end-to-end TypeScript type safety. Tauri invoke commands cross a Rust↔TypeScript boundary. Must find equivalent type safety (TauRPC, rspc, or codegen approach) to prevent regression in developer experience and AI agent consistency.

2. **Local vs Remote Execution Duality:** Every service that touches filesystem, tmux, git, or Claude Code must support two modes:
   - **Local mode (desktop):** Direct access to tmux, git, filesystem — same as current Electron app
   - **Remote mode (mobile + remote desktop):** SSH tunnel to remote machine; commands executed via SSH exec/shell channels

3. **Platform-Specific Capabilities:**
   - Desktop: Full local execution + optional remote
   - Mobile: Remote-only (no local tmux/git/Claude Code)
   - This means the architecture must cleanly separate "where is the execution host?" from "what is the UI doing?"

4. **Async Rust Runtime:** Node.js's event loop is replaced by tokio. All I/O (database, filesystem, SSH, process spawning) is async. Services must be designed for Rust's ownership model and async patterns.

5. **State Synchronization:** Keeping task state (SQLite), UI state (React), agent execution state (tmux), and Git branch state consistent — same fundamental challenge as Electron, but now across the Rust↔JS invoke boundary.

6. **Session Persistence Model:** tmux sessions (both task and chat) survive app restarts. On desktop this works natively. On mobile/remote, session persistence depends on the remote machine's uptime — the app must handle reconnection gracefully.

## Starter Template Evaluation

### Primary Technology Domain

Cross-platform application (Tauri v2 + React) based on project requirements:

- Cross-platform targets: macOS, Linux, Windows, Android, iOS
- Rust backend replacing Node.js services
- Existing React frontend preserved from Electron app
- SSH networking for remote project support
- Local SQLite persistence

### Starter Options Considered

| Starter | Build Tool | Pros | Cons |
|---------|-----------|------|------|
| `create-tauri-app --template react-ts` | Vite 6 | Official Tauri template, React + TS, minimal and clean | Bare-bones — all Rust services from scratch |
| Custom scaffolding (migrate existing) | Vite (existing) | Preserves all existing React code, keeps `package.json` deps | Requires manual `src-tauri/` setup, more initial work |
| Tauri + Drizzle + SQLite starter | Vite | Proven pattern for Tauri + SQLite | Uses Drizzle via proxy (JS ORM → Rust SQL), adds complexity |

### Selected Starter: `create-tauri-app` (React + TypeScript) with migration overlay

**Rationale for Selection:**

- The official `create-tauri-app --template react-ts` provides the correct Tauri v2 project structure (`src-tauri/` with Cargo.toml, tauri.conf.json, capabilities)
- Since we have an existing React frontend with 50+ components, hooks, stores, and shadcn/ui setup, we'll use the starter as a reference and add `src-tauri/` to the existing project
- This is the approach recommended by Tauri's own docs for integrating into existing projects

**Initialization Approach:**

```bash
# Option A: Scaffold fresh, then migrate React code into it
npm create tauri-app@latest tinsu -- --template react-ts

# Option B (recommended): Add Tauri to existing React project
cd tinsu
npm install @tauri-apps/cli@latest @tauri-apps/api@latest
npm run tauri init
```

Option B is recommended because it preserves the existing React app, Vite config, and all frontend dependencies without having to manually copy them.

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**

- TypeScript 5.x for frontend (preserved from existing)
- Rust (stable) for backend via `src-tauri/`
- Tauri v2.10.3 runtime (latest stable, March 2026)

**Build Tooling:**

- Vite 6.x for frontend (existing, compatible with Tauri)
- Cargo for Rust backend compilation
- Tauri CLI for dev server, bundling, and mobile builds
- Tauri bundler v2.8.1 for distribution packaging

**Project Structure:**

```
tinsu/
├── src/                    # React frontend (preserved from Electron)
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   ├── lib/
│   └── ...
├── src-tauri/              # NEW: Rust backend (replaces src/main/)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/       # Tauri v2 permission system
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── lib.rs          # Command registrations
│   │   ├── commands/       # Tauri invoke handlers (replaces tRPC routers)
│   │   ├── services/       # Business logic (PTY, Git, SSH, tmux)
│   │   ├── db/             # SQLite schema + migrations
│   │   └── models/         # Rust data structures
│   └── icons/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

**Development Experience:**

- `npm run tauri dev` — starts Vite dev server + Tauri window with HMR
- `npm run tauri build` — production build for current platform
- `npm run tauri android dev` / `npm run tauri ios dev` — mobile development
- Hot Module Replacement for React components (Vite)
- Rust recompilation on save (Tauri CLI watches `src-tauri/`)

**Key Rust Dependencies (verified versions, April 2026):**

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.10.3 | Core framework |
| `taurpc` | 0.5.2 | Type-safe IPC (Rust↔TypeScript) |
| `sqlx` | latest | Async SQLite with compile-time checked queries |
| `portable-pty` | 0.9.0 | Cross-platform PTY (wezterm project) |
| `russh` | 0.54.6 | SSH client library (async, tokio-based) |
| `axum` | 0.8.8 | HTTP server for Claude Code hook listener |
| `tokio` | latest | Async runtime |
| `serde` / `serde_json` | latest | Serialization for IPC and config |
| `specta` | 2.0.0-rc.22 | TypeScript type generation (used by TauRPC) |

**Note:** The first implementation story (T1.1) should initialize Tauri in the existing project and validate the React frontend renders in Tauri's webview.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Data persistence layer (SeaORM + SQLite)
- IPC communication pattern (rspc)
- Real-time streaming (Tauri Channels + Tauri Events)
- Frontend migration approach (rspc hooks, flatten directory)

**Important Decisions (Shape Architecture):**

- SSH key management (OS keychain)
- Logging strategy (tracing crate)
- Testing strategy (cargo test + Vitest)

**Deferred Decisions (Post-MVP):**

- E2E testing (Tauri WebDriver support)
- CI/CD pipeline (Phase 4)
- Auto-update strategy
- Crash reporting

### Data Architecture

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| **Database** | SQLite via SeaORM | SeaORM latest | ORM pattern familiar from Drizzle, entity generation, async-native |
| **ORM** | SeaORM | latest | ActiveRecord pattern maps to Drizzle's schema model, query builder, relationship handling |
| **Migrations** | sea-orm-migration | latest | Rust-based migrations compiled into binary, auto-run on startup |

**Schema Strategy:**

- Port all 17 existing tables faithfully (same snake_case names, same column types)
- SeaORM entities generated to match existing Drizzle schema exactly
- No schema changes in Phase 1 — faithful port only
- New tables (SSH connections, remote projects) added in Phase 2
- One-time data export/import path for Electron→Tauri transition

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Authentication** | None (MVP) | Single-user local app, no auth required |
| **IPC Security** | Tauri v2 capabilities | Webview only accesses explicitly permitted commands |
| **Process Isolation** | Webview sandbox (default) | No direct Rust/OS access from frontend |
| **File Access** | Scoped via `fs` plugin permissions | Only project directories, not full filesystem |
| **SSH Key Storage** | OS keychain via `keyring` crate | Platform-native (macOS Keychain, Linux Secret Service, Windows Credential Manager) |

### API & Communication Patterns

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| **IPC Pattern** | rspc | latest | Router-based like tRPC, minimal frontend migration, built-in React Query integration |
| **Tauri Adapter** | `@rspc/tauri` | latest | Bridges rspc router to Tauri invoke |
| **React Integration** | `@rspc/react` | latest | TanStack Query hooks nearly identical to tRPC hooks |
| **Validation** | rspc built-in (Specta types) | latest | Type generation replaces Zod runtime validation |

**IPC Architecture:**

```
Frontend (React) ──rspc Client──► Tauri IPC ──► Rust (rspc Router)
                                                    │
                                                    ├── task procedures
                                                    ├── agent procedures
                                                    ├── git procedures
                                                    ├── config procedures
                                                    ├── activity procedures
                                                    ├── sprint procedures
                                                    └── chat procedures
```

**Real-Time Streaming Architecture:**

| Data Type | Primitive | Rationale |
|-----------|-----------|-----------|
| **PTY terminal output** | Tauri Channels | High throughput, single-consumer, byte-level streaming |
| **Activity log events** | Tauri Events | Multi-listener, lower frequency, fire-and-forget |
| **Session status changes** | Tauri Events | Multi-listener, UI status badges |
| **Hook notifications** | Tauri Events | Fire-and-forget from axum hook listener to frontend |
| **All request-response** | rspc queries/mutations | Typed, cached via TanStack Query |

### Frontend Architecture

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| **Server State** | TanStack Query via rspc | via `@rspc/react` | Near-identical API to tRPC hooks, automatic caching |
| **Local UI State** | Zustand | latest | Unchanged from Electron app |
| **Components** | shadcn/ui | latest | Unchanged, Tailwind-based |
| **Styling** | Tailwind CSS | ^4.x | Unchanged, CSS-first config |
| **Drag-and-Drop** | @dnd-kit | latest | Unchanged |
| **Diff Viewer** | Monaco Editor | latest | Unchanged |
| **Terminal** | xterm.js | latest | Unchanged, now backed by Tauri Channels instead of tRPC subscriptions |

**Migration Approach:**

- `src/renderer/src/` flattens to `src/` (standard Vite structure)
- `src/main/` deleted (replaced by `src-tauri/src/`)
- `src/preload/` deleted (replaced by rspc + Tauri invoke)
- `src/shared/types/` preserved, updated to match rspc-generated types
- tRPC hook calls migrated to rspc hooks (find-and-replace pattern)
- tRPC subscriptions migrated to Tauri Event listeners

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Packaging** | Tauri bundler v2.8.1 | Built-in, cross-platform |
| **Desktop Platforms** | macOS (.dmg), Linux (.AppImage, .deb), Windows (.msi) | Per PRD + Windows added |
| **Mobile Platforms** | Android (.apk/.aab), iOS (.ipa) | Phase 3 |
| **Testing (Rust)** | `cargo test` | Native, no rebuild dance |
| **Testing (React)** | Vitest + React Testing Library | Same as existing, simplified (no native module issues) |
| **E2E Testing** | Deferred | Tauri WebDriver support, post-MVP |
| **Logging** | `tracing` crate | Tokio ecosystem standard, structured spans, async-friendly |
| **CI/CD** | Deferred to Phase 4 | GitHub Actions + `tauri-action` for desktop, separate mobile pipelines |

## Mobile UI Architecture (Tauri Epic 3.5)

### Overview

Tauri Epic 3.5 introduces a **parallel mobile UI tree** at `src/mobile/` to replace the responsive-design approach of Tauri Epic 3 (T3.2–T3.7). The decision, approved 2026-04-30, delivers mobile-native UX with bottom-tab navigation, full-screen workflows, bottom sheets, and gesture-first interactions—rather than retrofitting desktop layouts to phones.

**Key principle:** One-shot viewport detection at `App.tsx` renders either the desktop tree OR the mobile tree, never both. `useIsMobile()` hook is replaced with a viewport router at the root level; child components do not branch on viewport.

**Authoritative design reference:** `_bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md` §6–§10 and `sprint-change-proposal-2026-04-30.md` §4.4 document the full UX spec, screen inventory, and interaction patterns.

### Viewport Routing Pattern

**`src/App.tsx:18` (insertion point):**

```typescript
function App(): React.JSX.Element {
  // One-time viewport detection at root — no per-component branching
  const isMobileViewport = useViewportRouter() // <1024px → true
  
  return isMobileViewport ? <MobileApp /> : <DesktopApp />
}
```

**Rationale:**
- Viewport detection runs once at app root, not on every component render.
- Each tree renders exclusively for its form factor — desktop tree never mounts on mobile, and vice versa.
- Removes all `useIsMobile()` conditional branches from child components (desktop components can no longer access this hook).
- Trees share routing at the root; no cross-tree navigation.
- Deep links (e.g., `tinsu://task/{taskId}`) resolve via mobile-nav Zustand store in `MobileApp`, not via desktop router.

**Responsive design (width-based breakpoints) is NOT used in `src/mobile/`** — all mobile layouts are designed for 320–767 px portrait, with portrait orientation lock on both Android and iOS.

### `src/mobile/` Directory Structure

Mobile UI lives exclusively in `src/mobile/`. Desktop components are NOT modified after T3.5-2 (foundations). The parallel tree mirrors the feature coverage of desktop:

```
src/mobile/
├── MobileApp.tsx                   # Root component (inserted by viewport router)
├── shell/
│   ├── MobileTabBar.tsx            # Bottom 5-tab navigation, persistent across screens
│   ├── MobileTopAppBar.tsx         # Project name, connection status pill
│   ├── MobileNavStore.ts           # Zustand store with 5 parallel navigation stacks
│   └── deeplinks.ts                # URI scheme handlers (tinsu://task, tinsu://chat)
├── primitives/                     # 14 mobile primitive components
│   ├── MobileScreen.tsx            # Base screen container with safe-area insets
│   ├── MobileTopAppBar.tsx         # Status bar + project pill + back button
│   ├── MobileTabBar.tsx            # Bottom 5-tab bar with badges
│   ├── MobileSheet.tsx             # Bottom-sheet modal, swipe-to-dismiss, height control
│   ├── MobileSegmentedTabs.tsx     # Horizontal tab control (e.g., Content/Terminal/Activities/Diff)
│   ├── MobileColumnPager.tsx       # Horizontal swipe between columns with peek
│   ├── MobileBottomActionBar.tsx   # Sticky action bar (thumbs at bottom)
│   ├── MobileListItem.tsx          # Row primitive for lists
│   ├── MobileEmptyState.tsx        # Empty state with illustration + CTA
│   ├── MobileChip.tsx              # Filter/status badge
│   ├── MobileFab.tsx               # Floating action button (fixed bottom-right, above tab bar)
│   ├── MobileSearchBar.tsx         # Search input in header or dedicated screen
│   ├── MobileLoadingSkeleton.tsx   # Skeleton loader variants
│   └── MobilePullToRefresh.tsx     # Pull-down refresh primitive
├── board/                          # Kanban board tab
│   ├── MobileBoardScreen.tsx       # Tab root: column pager + header + filters
│   ├── MobileTaskCard.tsx          # Card primitive (Story/Basic/Planning variants)
│   └── MobileNewTaskSheet.tsx      # Bottom sheet: add task workflow
├── tasks/                          # Task workspace tab
│   ├── MobileTaskListScreen.tsx    # Tab root: task list with filter chips
│   ├── MobileTaskWorkspaceScreen.tsx # Full-screen task workspace (push)
│   ├── MobileContentTab.tsx        # Task details: description, AC, context
│   ├── MobileTerminalTab.tsx       # Terminal subtab (xterm.js integrated)
│   ├── MobileActivitiesTab.tsx     # Activity log for this task
│   ├── MobileDiffTab.tsx           # Diff subtab root
│   ├── MobileFileTreeSheet.tsx     # File picker (bottom sheet)
│   └── MobileDiffViewerScreen.tsx  # Unified diff view + action bar
├── planning/                       # Planning workspace tab
│   ├── MobilePlanningHome.tsx      # Tab root: BMAD pill + session list
│   ├── MobileSessionListScreen.tsx # Session card list
│   ├── MobileChatScreen.tsx        # Full-screen chat (push)
│   ├── MobileChatBubble.tsx        # Chat message primitive
│   ├── MobileChatComposer.tsx      # Message input (sticky)
│   ├── MobileNewSessionSheet.tsx   # Create session sheet
│   ├── MobilePersonaPicker.tsx     # Persona grid (sheet child)
│   └── MobileBmadWorkflowSheet.tsx # Workflow steps (sheet)
├── review/                         # Review tab (within Tasks)
│   ├── MobileReviewActionBar.tsx   # Approve / Request Changes / Reject (sticky)
│   ├── MobileFeedbackSheet.tsx     # Request changes form (bottom sheet)
│   └── MobileRejectionSheet.tsx    # Rejection form (bottom sheet)
├── activity/                       # Activity tab
│   ├── MobileActivityFeedScreen.tsx # Cross-project activity list (tab root)
│   ├── MobileActivityRow.tsx       # Activity item primitive
│   ├── MobileActivityChipStrip.tsx # Filter chips
│   └── MobileActivityDetail.tsx    # Event detail (bottom sheet)
├── ssh/                            # SSH management (within Settings)
│   ├── MobileConnectionsList.tsx   # Connection list (settings sub-screen)
│   ├── MobileConnectionCard.tsx    # Connection item
│   ├── MobileSshAddSheet.tsx       # Multi-step SSH setup (bottom sheet)
│   ├── MobileGenerateKeySheet.tsx  # Key generation (nested sheet)
│   ├── MobileShowPublicKey.tsx     # Public key display (nested sheet)
│   └── MobileTestConnectionSheet.tsx # Test result (nested sheet)
├── settings/                       # Settings tab
│   ├── MobileSettingsHome.tsx      # Settings list (tab root)
│   ├── MobileConnectionsSettings.tsx # SSH connections drill-in
│   ├── MobileKeysSettings.tsx      # SSH keys management
│   ├── MobileMoshSettings.tsx      # Mosh config
│   ├── MobileCacheSettings.tsx     # Cache management
│   ├── MobileDiagnosticsScreen.tsx # Diagnostics (read-only)
│   ├── MobileThemeSettings.tsx     # Theme picker
│   └── MobileAboutScreen.tsx       # Version, links
└── assets/                         # Mobile-specific icons, images (if any)
```

**Design token integration:**
All primitives in `src/mobile/primitives/` consume Calm Command CSS variables (`--background`, `--card`, `--primary`, `--destructive`, `--warning`) and type scale tokens (`--font-size-body`, `--font-family-mono` for code). **No inline Tailwind color classes** (e.g., `text-red-500`) in mobile primitives — color always comes from tokens.

### Mobile-Nav Zustand Store

**Location:** `src/mobile/shell/MobileNavStore.ts`

**Purpose:** Manage 5 parallel navigation stacks (one per bottom tab), enabling native back-button behavior and deep-link routing.

**Store contract:**

```typescript
interface MobileNavStore {
  // 5 parallel stacks — each tab maintains its own history
  boardStack: string[]        // Routes: 'board', 'task:ID', etc.
  planningStack: string[]     // Routes: 'sessions', 'chat:ID', etc.
  tasksStack: string[]        // Routes: 'list', 'workspace:ID', etc.
  activityStack: string[]     // Routes: 'feed', 'detail:ID', etc.
  settingsStack: string[]     // Routes: 'home', 'connections', etc.
  
  activeTab: 'board' | 'planning' | 'tasks' | 'activity' | 'settings'
  
  // Stack manipulation
  pushRoute: (tab: TabName, route: string) => void
  popRoute: (tab?: TabName) => void           // Pop current tab if not specified
  switchTab: (tab: TabName) => void
  clearStack: (tab: TabName) => void
  
  // Deep-link support
  navigateToDeepLink: (uri: string) => void  // e.g., 'tinsu://task/123' or 'tinsu://chat/abc'
  
  // Android back-button support
  handleBackPress: () => boolean              // Returns true if consumed, false if should exit app
}
```

**Back-button behavior (Android):**
- Tap system back → calls `handleBackPress()`.
- If current tab's stack has >1 entry: pop the stack, stay on tab.
- If stack has 1 entry (root of tab): switch to previous tab (left neighbor cyclically).
- If at root of "Board" tab (first tab): exit app.

**Tab switching:**
- Tapping a tab button in `MobileTabBar` calls `switchTab()`.
- Preserves scroll position and form state of all other tabs (each maintains its own DOM subtree; Zustand doesn't unmount tabs).
- Long-press on already-active tab: scroll root of that tab's stack to top (iOS-native pattern).

### Deep-Link Routing Table

**Scheme:** `tinsu://[domain]/[path]`

Tauri deep-link plugin wires invocations to `navigateToDeepLink()` in mobile-nav store. Desktop deep links continue via desktop router (unchanged).

| URI | Mobile Target | Stack Restored | Desktop Target |
|---|---|---|---|
| `tinsu://project/{id}` | Board tab, project switched | `['board']` | Project sidebar selector |
| `tinsu://board/{id}` | Board tab, root | `['board']` | Kanban board + sidebar |
| `tinsu://task/{id}` | Tasks tab, workspace open | `['list', 'workspace:{id}']` | Task workspace full-screen |
| `tinsu://task/{id}/diff` | Tasks tab, diff sub-tab | `['list', 'workspace:{id}', 'diff']` | Diff viewer full-screen |
| `tinsu://chat/{sessionId}` | Planning tab, chat open | `['sessions', 'chat:{sessionId}']` | Planning workspace chat pane |
| `tinsu://activity/{taskId}` | Activity tab, filtered | `['feed:filter=task:{taskId}']` | Activity log, desktop app shell |
| `tinsu://settings/connections` | Settings tab, connections | `['home', 'connections']` | Settings modal, connections section |

**Implementation point (Tauri):**
- `tauri.conf.json` registers the `tinsu://` scheme.
- Rust handler invokes a Tauri command that emits a Tauri Event with the deep link URI.
- React listener in `MobileApp` calls `mobileNavStore.navigateToDeepLink(uri)`.
- Store parses URI, pushes routes onto the appropriate tab stack, switches tab.

### Mobile Primitive Contract

**All 14 primitives follow this contract:**

1. **CSS Variables Only:** All color, spacing, typography come from Calm Command tokens (`--background`, `--card`, `--primary`, `--destructive`, `--muted-foreground`, `--border`, `--font-family-mono`, `--font-size-body`, etc.). No inline Tailwind color classes like `text-red-500` or `bg-blue-200`.

2. **Touch Target Minimums:**
   - Interactive elements (button, tap area): ≥44 pt (iOS) / ≥48 dp (Android) height and width.
   - Tap targets spaced ≥8 pt apart (to avoid accidental multi-touch).

3. **Accessibility (a11y):**
   - Semantic HTML: buttons are `<button>`, text is `<p>` or `<span>`, lists are `<ul>` / `<li>`.
   - `aria-label` on icon-only buttons.
   - Color is never the only indicator — status always has text or icon (e.g., diff uses `+`/`-` prefix for colors).
   - Respect `prefers-reduced-motion` — no infinite animations; animations opt-out on reduced-motion.

4. **Layout Safe Areas:**
   - All primitives wrap content in `MobileScreen.tsx` which applies safe-area insets (`padding-top: env(safe-area-inset-top)`, etc.).
   - `MobileTabBar` is always bottom-fixed and accounts for safe-area inset bottom.
   - `MobileBottomActionBar` and `MobileSheet` layer above the tab bar, also accounting for safe areas.

5. **Performance:**
   - Virtualized lists use React virtualization (e.g., `react-window` or `@tanstack/react-virtual`) for 100+ items.
   - Lazy load sheet content (don't render content until sheet is opened).
   - Memo functional components that don't change.

**Primitives never import from `src/components/` (desktop)** — they are self-contained and use only Calm Command tokens and base React.

### Reused Unchanged

The following systems are shared by both desktop and mobile trees. Both call the same Rust backend, use the same domain stores, and fetch the same data.

| System | Desktop | Mobile | Backend |
|--------|---------|--------|---------|
| **Rust Backend** | Tauri commands via rspc | Same rspc hooks | `src-tauri/src/router/*`, `src-tauri/src/services/*` |
| **Tauri Commands** | `rspc.useMutation(...)` | Same `rspc.useMutation(...)` | Unchanged |
| **Domain Stores** | `useTaskWorkspaceStore`, `usePlanningWorkspaceStore`, `useStoryViewStore`, `project.store`, etc. | Same Zustand stores | No `useIsMobile()` version — stores are form-factor agnostic |
| **rspc Hooks** | `useQuery`, `useMutation`, TanStack Query | Same hooks | Single data layer |
| **Diff Computation** | Desktop Monaco diff viewer | Mobile unified diff | `git_service.rs` provides diff hunks |
| **Terminal (xterm.js)** | `TerminalOutput.tsx` (Tauri Channels) | `MobileTerminalTab.tsx` (same Channels) | Same PTY service |
| **Kanban Logic** | `@dnd-kit` with desktop DndContext | `@dnd-kit` core reused, wrapped in `MobileColumnPager` | Unchanged |
| **Design Tokens** | Calm Command CSS variables | Same CSS variables | Single token system |
| **Search/Filter** | Zustand `uiStore` + rspc queries | Same Zustand + rspc | No duplication |

**What does NOT get duplicated:**
- Rust backend services (PTY, Git, tmux, SSH, activity logging, automation).
- TanStack Query / rspc client integration.
- All Zustand domain stores.
- Design tokens.
- `@dnd-kit` drag-drop library core.

**What gets reimplemented (mobile-only):**
- Navigation and routing (mobile-nav store vs. desktop router).
- UI component layout (mobile primitives vs. shadcn/ui).
- Gesture handling and responsive behavior (mobile features like bottom sheets, swipe navigation, long-press menus).

### Navigation Stack Examples

**Example 1: Board → Task → Complete**

```
User taps card on Board tab
  → pushRoute('tasks', 'workspace:123')
  → switchTab('tasks')
  → Tasks tab now shows: activeRoute = 'workspace:123'
  → Screen renders <MobileTaskWorkspaceScreen taskId={123} />

User presses Android back
  → handleBackPress() → stack = ['list', 'workspace:123'] → pop
  → activeRoute = 'list'
  → Tasks tab shows task list again
  → Scroll position preserved from earlier

User taps another tab (Planning)
  → switchTab('planning')
  → Tasks tab unmounts (stays in Zustand)
  → Planning tab content renders

Back to Tasks tab
  → switchTab('tasks')
  → Tasks re-mounts at activeRoute = 'list' with same scroll position
```

**Example 2: Deep Link → Chat**

```
System opens 'tinsu://chat/session-42'
  → Rust deep-link handler emits Tauri Event with URI
  → MobileApp listener calls mobileNavStore.navigateToDeepLink('tinsu://chat/session-42')
  → Store parses: tab='planning', route='chat:session-42'
  → pushRoute('planning', 'chat:session-42')
  → switchTab('planning')
  → Planning tab renders <MobileChatScreen sessionId="session-42" />
```

### Migration Sequence & Rollback

**Foundational stories (blocking all feature work):**
- **T3.5-1:** Mobile shell foundation (viewport router, `MobileApp.tsx`, mobile-nav store, deep-link wiring). Must land first.
- **T3.5-2:** Mobile primitives library (14 primitives, design token audit, storybook equivalent). Must land before any feature story to stabilize the design surface.

**Feature stories (T3.5-3 through T3.5-8):**
- T3.5-3: Board (column pager + long-press drag)
- T3.5-4: Task workspace (segmented sub-tabs + sticky bars)
- T3.5-5: Planning (session list + chat)
- T3.5-6: Review (diff + action bar)
- T3.5-7: SSH management
- T3.5-8: Activity + Settings

**Gate story (mandatory before Phase 4):**
- **T3.5-9:** Real-device validation. All 10 ACs from `t3-8-test-report.md` verified on Android API 34 emulator + at least one physical Android device. iOS on macOS if available; otherwise deferred with documented path.

**Rollback semantics:**

- **Before T3.5-3 (board lands):** Rollback is trivial. Revert viewport router in `App.tsx` to pre-3.5 state. T3.5-1 and T3.5-2 are additive (new files, no desktop component changes). Delete `src/mobile/`.
- **After T3.5-3 (during feature rollout):** Each feature story can be rolled back individually by reverting its `src/mobile/` subdirectory. Desktop components keep their original implementations (no `useIsMobile()` branches are removed from desktop until the end).
- **End of T3.5 (all stories merged):** Delete `useIsMobile()` hook and all references in desktop components (dead code). This deletion cannot be undone without restoring from git history.

**Per-story reversibility:** Each feature story T3.5-3 through T3.5-8 is independently reversible until merged. After merge, the desktop tree's corresponding feature still works via the same Rust backend and domain stores — no feature loss, only the mobile UI is absent.

### Calm Command Tokens in Mobile

Mobile screens inherit all Calm Command tokens from `globals.css`. Key mappings:

```css
/* Color tokens (unchanged) */
--background          /* Dark card background */
--foreground          /* Primary text */
--card                /* Card/panel background, slightly lighter */
--primary             /* Accent color, action buttons */
--secondary           /* Secondary action */
--destructive         /* Error, delete actions */
--muted-foreground    /* Disabled text, metadata */
--border              /* Dividers, input borders */
--success             /* Green, approval states */
--warning             /* Yellow, reconnecting states */

/* Typography tokens */
--font-family-base    /* Inter */
--font-family-mono    /* JetBrains Mono */
--font-size-body      /* 14 sp on desktop, 15 sp on mobile */
--font-size-h1        /* 24 pt desktop, 22 pt mobile */

/* Spacing (unchanged 4 px grid) */
/* All margins/padding in multiples of 4 px */
```

**Mobile primitives sample:**

```typescript
// MobileTaskCard.tsx
export function MobileTaskCard({ task }: Props) {
  return (
    <div className="rounded-lg bg-[var(--card)] p-4 border border-[var(--border)]">
      <div className="flex items-start justify-between">
        <h3 className="text-[var(--font-size-body)] font-mono text-[var(--foreground)]">
          {task.title}
        </h3>
        <span className="text-[var(--font-size-body)] text-[var(--muted-foreground)]">
          #{task.id}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          className="rounded px-3 py-2 bg-[var(--primary)] text-[var(--background)] text-sm"
          onClick={() => openTask(task.id)}
        >
          Open
        </button>
      </div>
    </div>
  )
}
```

(Note: CSS variables used directly, no `text-red-500`-style classes.)

### Architecture Boundaries (Mobile)

**Mobile-specific boundary:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   MOBILE APP (src/mobile/)                       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ MobileNavStore│   │ Mobile Prim. │   │ Screen Components│    │
│  │ (5 stacks)   │──▶│ (14 types)   │──▶│ (Features)       │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│        │                                          │               │
│        └──────────────────┬───────────────────────┘               │
│                           │                                       │
│                      ┌────▼──────┐                               │
│                      │ rspc Hooks │ (shared with desktop)        │
│                      │ Zustand    │                              │
│                      └────┬──────┘                               │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │  SHARED SERVICES    │
                │  (Unchanged)        │
                │  - Rust backend     │
                │  - rspc client      │
                │  - Domain stores    │
                │  - Design tokens    │
                └─────────────────────┘
```

**Process boundaries:** Mobile and desktop are mounted conditionally at the root; they never interact after the viewport check.

---

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialize Tauri v2 in existing project, validate React renders in webview
2. Set up SeaORM with SQLite, port 17-table schema
3. Set up rspc router, register Tauri commands
4. Migrate frontend hooks from tRPC to rspc
5. Implement Rust services (task, sprint, epic CRUD)
6. Implement PTY service with portable-pty + Tauri Channels
7. Implement tmux service, hook listener (axum)
8. Implement git service
9. Implement chat CLI service
10. Feature parity validation (Phase 1 gate)

**Cross-Component Dependencies:**

- rspc router depends on SeaORM entities (data layer first)
- Terminal streaming depends on PTY service + Tauri Channels
- Activity events depend on hook listener (axum) + Tauri Events
- Frontend migration depends on rspc router being operational
- Chat/planning depends on tmux service + hook routing

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 7 areas where AI agents could make incompatible choices without explicit patterns.

### Naming Patterns

**Database Naming Conventions (unchanged):**

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | snake_case, plural | `tasks`, `agent_runs`, `sprint_stories` |
| Columns | snake_case | `created_at`, `task_id`, `exit_status` |
| Foreign Keys | `{referenced_table}_id` | `sprint_id`, `epic_id` |
| Indexes | `idx_{table}_{columns}` | `idx_tasks_status`, `idx_logs_run_id` |

**SeaORM Entity Naming (new):**

| Element | Convention | Example |
|---------|-----------|---------|
| Entity module | snake_case (matches table) | `task.rs`, `agent_run.rs` |
| Entity struct | PascalCase `Model` | `task::Model`, `agent_run::Model` |
| ActiveModel | `ActiveModel` | `task::ActiveModel` |
| Column enum | PascalCase | `task::Column::CreatedAt` |

**rspc Procedure Naming (mirrors existing tRPC):**

| Type | Convention | Example |
|------|-----------|---------|
| Queries | camelCase, get/list prefix | `getTask`, `listSprintTasks` |
| Mutations | camelCase, verb prefix | `createTask`, `updateStatus`, `deleteRun` |

**Rust Code Naming:**

| Element | Convention | Example |
|---------|-----------|---------|
| Modules | snake_case | `task_service.rs`, `pty_service.rs` |
| Structs | PascalCase | `TaskService`, `PtySession` |
| Functions | snake_case | `create_session`, `get_task` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_STALL_TIME`, `IDLE_TIMEOUT_MS` |
| Traits | PascalCase | `ExecutionHost`, `SessionManager` |
| Enums | PascalCase variants | `TaskStatus::InProgress` |

**React/TypeScript Naming (unchanged):**

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `TaskCard`, `KanbanBoard` |
| Component files | PascalCase.tsx | `TaskCard.tsx` |
| Hooks | camelCase, use prefix | `useTask`, `useAgentStatus` |
| Stores | camelCase, use + Store | `useTaskStore`, `useUIStore` |
| Types/Interfaces | PascalCase, no I prefix | `Task`, `AgentRun`, `SprintConfig` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_STALL_TIME`, `DEFAULT_BRANCH_PREFIX` |
| Utility functions | camelCase | `formatDate`, `parseStoryFile` |

**Tauri Event Naming (new):**

| Category | Pattern | Examples |
|----------|---------|----------|
| PTY events | `pty:{action}` | `pty:data`, `pty:exit`, `pty:error` |
| Agent lifecycle | `agent:{state}` | `agent:started`, `agent:stalled`, `agent:complete` |
| Git operations | `git:{action}` | `git:worktree-created`, `git:merge-conflict` |
| Task updates | `task:{action}` | `task:status-changed`, `task:logs-updated` |
| Chat events | `chat:{action}` | `chat:message-received`, `chat:session-exited` |
| Hook events | `hook:{type}` | `hook:stop`, `hook:tool-use`, `hook:chat-stop` |

### Structure Patterns

**Rust Backend Organization (`src-tauri/src/`):**

```
src-tauri/src/
├── main.rs                    # Tauri entry point
├── lib.rs                     # rspc router setup, command registration
├── router/
│   ├── mod.rs                 # Root router, merged
│   ├── task.rs                # Task CRUD procedures
│   ├── agent.rs               # PTY spawn, control, monitor
│   ├── review.rs              # Approve/reject, feedback
│   ├── git.rs                 # Worktree, branch, merge
│   ├── config.rs              # Project settings
│   ├── activity.rs            # Activity CRUD + streaming
│   ├── sprint.rs              # Sprint management
│   └── chat.rs                # Chat session management
├── services/
│   ├── mod.rs
│   ├── pty_service.rs         # portable-pty wrapper
│   ├── git_service.rs         # Git CLI operations
│   ├── tmux_service.rs        # tmux session lifecycle
│   ├── hook_listener.rs       # axum HTTP server for hooks
│   ├── activity_log.rs        # Event logging
│   ├── automation.rs          # Story/Basic state machine
│   ├── scrollback_backup.rs   # Terminal persistence
│   ├── chat_cli.rs            # Chat session management
│   ├── context_builder.rs     # Story/arch context assembly
│   └── stall_detector.rs      # Output monitoring
├── db/
│   ├── mod.rs                 # SeaORM connection setup
│   └── entities/
│       ├── mod.rs
│       ├── task.rs
│       ├── sprint.rs
│       ├── epic.rs
│       ├── agent_run.rs
│       ├── task_activity.rs
│       ├── task_session.rs
│       ├── chat_session.rs
│       ├── chat_message.rs
│       └── ...                # All 17 entities
├── migration/
│   ├── mod.rs
│   └── m20260412_000001_initial_schema.rs
└── models/
    ├── mod.rs
    ├── task_status.rs         # Enums, shared types
    ├── event_types.rs
    └── ssh_config.rs
```

**Frontend Organization (`src/` — flattened from `src/renderer/src/`):**

```
src/
├── App.tsx                    # Root component
├── main.tsx                   # React root, providers
├── globals.css                # Tailwind base + shadcn vars
├── components/
│   ├── board/                 # Kanban components (unchanged)
│   ├── task/                  # Task detail components (unchanged)
│   ├── terminal/              # Terminal components (unchanged)
│   ├── review/                # Review/diff components (unchanged)
│   ├── layout/                # App shell components (unchanged)
│   ├── planning/              # Chat/planning components (unchanged)
│   ├── sprint/                # Sprint management (unchanged)
│   └── ui/                    # shadcn/ui components (unchanged)
├── hooks/
│   ├── useTask.ts             # Migrated from tRPC to rspc
│   ├── useAgent.ts
│   ├── useTerminal.ts
│   └── useGit.ts
├── stores/
│   ├── ui.store.ts
│   └── terminal.store.ts
└── lib/
    ├── rspc.ts                # rspc client setup (replaces trpc.ts)
    ├── utils.ts               # cn(), formatDate, etc.
    └── constants.ts
```

**File Co-location Rules:**

- Rust tests: Co-located in same file via `#[cfg(test)] mod tests { ... }`
- React tests: Co-located with source files (`TaskCard.test.tsx` next to `TaskCard.tsx`)
- Styles: Tailwind classes inline, no separate CSS files

### Format Patterns

**rspc Response Format:**

```rust
// Direct returns — rspc handles serialization
// DO NOT wrap in Result<ApiResponse<T>> or { data: ... }

// Query — return data directly
.query(|ctx, input: GetTaskInput| async move {
    let task = ctx.db.find_by_id(input.id).await?;
    Ok(task)
})

// Mutation — return affected entity
.mutation(|ctx, input: UpdateStatusInput| async move {
    let task = task::ActiveModel {
        id: Set(input.id),
        status: Set(input.status),
        ..Default::default()
    };
    Ok(task.update(&ctx.db).await?)
})
```

**Rust Error Handling:**

```rust
// Define app-level error type
#[derive(Debug, thiserror::Error, specta::Type, serde::Serialize)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Database error: {0}")]
    Database(String),
}

// Convert from SeaORM errors
impl From<sea_orm::DbErr> for AppError {
    fn from(err: sea_orm::DbErr) -> Self {
        AppError::Database(err.to_string())
    }
}

// Use in procedures
.query(|ctx, input| async move {
    ctx.db.find_by_id(input.id).await?
        .ok_or(AppError::NotFound("Task not found".into()))
})
```

**Date/Time Format (unchanged):**

- Database: INTEGER (Unix timestamp in seconds)
- rspc responses: ISO 8601 string (`2026-04-12T10:30:00Z`)
- Display: Formatted via `date-fns` in renderer

**Zustand Store Pattern (unchanged):**

```typescript
interface TaskStore {
  selectedTaskId: string | null
  setSelectedTask: (id: string | null) => void
  clearSelection: () => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  selectedTaskId: null,
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  clearSelection: () => set({ selectedTaskId: null }),
}))
```

### Communication Patterns

**Tauri Event Emission (Rust → Frontend):**

```rust
// Emit from Rust
app_handle.emit("task:status-changed", TaskStatusPayload {
    task_id: task.id.clone(),
    old_status: old.status,
    new_status: new_status,
})?;

// Listen in React
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
    const unlisten = listen<TaskStatusPayload>('task:status-changed', (event) => {
        // handle event.payload
    });
    return () => { unlisten.then(fn => fn()); };
}, []);
```

**Tauri Channel Pattern (PTY streaming):**

```rust
// Rust side — high-throughput byte stream
#[tauri::command]
async fn attach_terminal(task_id: String, channel: Channel<Vec<u8>>) -> Result<(), AppError> {
    let pty = pty_service.get_or_create(&task_id).await?;
    tokio::spawn(async move {
        loop {
            let data = pty.read().await;
            if channel.send(data).is_err() { break; }
        }
    });
    Ok(())
}
```

### Process Patterns

**Error Handling Layers:**

| Layer | Handling Approach |
|-------|-------------------|
| **SeaORM/DB** | `?` operator propagates `DbErr`, auto-converted to `AppError::Database` |
| **Services** | Catch external errors (git, pty, ssh), return `AppError` with context |
| **rspc Router** | Let `AppError` propagate, rspc serializes to frontend |
| **React Query** | Use `onError` callback, show toast via shadcn/ui |
| **React UI** | `ErrorBoundary` at AppShell level for unexpected errors |

**Loading State Pattern (unchanged):**

```typescript
const { data, isLoading, error } = rspc.useQuery(['task.getTask', { id }]);

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <TaskDetails task={data} />;
```

**Agent Execution State Machine (unchanged):**

```
idle → starting → running → (stalled?) → completing → review
                     ↓            ↓
                  paused      intervention
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly as documented (Rust snake_case, React PascalCase, DB snake_case)
2. Place files in the correct directories per structure patterns
3. Use rspc procedures for all frontend↔backend communication
4. Use `AppError` (not generic `anyhow::Error`) in router procedures
5. Use Zustand stores for local UI state, rspc for server state
6. Co-locate tests with source files (Rust: `#[cfg(test)]`, React: `*.test.tsx`)
7. Use Tauri Events for fire-and-forget notifications, Channels for streams
8. Never access filesystem/process/network directly from frontend code

**Pattern Verification:**

- `cargo clippy` enforces Rust naming and style
- ESLint + Prettier enforce TypeScript naming and formatting
- TypeScript strict mode catches type mismatches
- rspc + Specta auto-generated types prevent IPC type drift

### Anti-Patterns to Avoid

| Anti-Pattern | Correct Pattern |
|-------------|-----------------|
| `ITask`, `IUser` (I prefix) | `Task`, `User` |
| `user_data.tsx` (snake_case file) | `UserData.tsx` |
| `{ success: true, data: ... }` | Direct return from rspc |
| `invoke('get_task', ...)` raw Tauri calls | Use rspc procedures |
| `useState` for server data | Use rspc + TanStack Query |
| `anyhow::Error` in router | `AppError` with specific variants |
| Tests in separate `__tests__` folder | Co-located `*.test.ts` / `#[cfg(test)]` |
| `println!` for logging | `tracing::info!`, `tracing::error!` |
| Separate CSS files | Tailwind classes inline |
| `unwrap()` in production Rust | `?` operator with proper error types |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
tinsu/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── components.json                # shadcn/ui config
├── .env.example
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, typecheck, test (Phase 4)
│       └── release.yml            # Build & publish (Phase 4)
│
├── src-tauri/                     # === RUST BACKEND ===
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json            # Tauri app config (window, bundle, plugins)
│   ├── capabilities/
│   │   ├── default.json           # Default webview permissions
│   │   └── main-window.json       # Main window capabilities
│   ├── icons/                     # App icons (all platforms)
│   ├── src/
│   │   ├── main.rs                # Tauri entry point, app setup
│   │   ├── lib.rs                 # rspc router init, Tauri command registration
│   │   ├── error.rs               # AppError enum, From impls
│   │   │
│   │   ├── router/                # rspc procedures (replaces tRPC routers)
│   │   │   ├── mod.rs             # Root router, merged
│   │   │   ├── task.rs            # FR1-FR6: Board & task CRUD
│   │   │   ├── agent.rs           # FR7-FR16: PTY spawn, control, monitor
│   │   │   ├── review.rs          # FR17-FR21: Approve/reject, feedback
│   │   │   ├── git.rs             # FR22-FR27: Worktree, branch, merge
│   │   │   ├── config.rs          # FR28-FR31: Project settings
│   │   │   ├── activity.rs        # TES FR10-FR20: Activity CRUD + streaming
│   │   │   ├── sprint.rs          # Sprint management
│   │   │   └── chat.rs            # FR36-FR53: Chat session management
│   │   │
│   │   ├── services/              # Business logic
│   │   │   ├── mod.rs
│   │   │   ├── pty_service.rs     # portable-pty wrapper, spawn/kill/signal
│   │   │   ├── git_service.rs     # Git CLI wrapper, worktree ops
│   │   │   ├── tmux_service.rs    # tmux session lifecycle (task + chat)
│   │   │   ├── hook_listener.rs   # axum HTTP server for Claude Code hooks
│   │   │   ├── activity_log.rs    # Event logging + Tauri Event emission
│   │   │   ├── automation.rs      # Story/Basic task state machine
│   │   │   ├── scrollback_backup.rs # Filesystem terminal persistence
│   │   │   ├── chat_cli.rs        # Chat session spawn, I/O, monitoring
│   │   │   ├── context_builder.rs # Story/arch context assembly
│   │   │   ├── stall_detector.rs  # Output monitoring, timeout detection
│   │   │   └── ssh_service.rs     # Phase 2: russh SSH client
│   │   │
│   │   ├── db/
│   │   │   ├── mod.rs             # SeaORM connection setup
│   │   │   └── entities/          # SeaORM entity definitions
│   │   │       ├── mod.rs
│   │   │       ├── project.rs
│   │   │       ├── sprint.rs
│   │   │       ├── epic.rs
│   │   │       ├── task.rs
│   │   │       ├── agent_run.rs
│   │   │       ├── task_activity.rs
│   │   │       ├── task_session.rs
│   │   │       ├── chat_session.rs
│   │   │       ├── chat_message.rs
│   │   │       ├── chat_message_attachment.rs
│   │   │       ├── app_settings.rs
│   │   │       ├── log_entry.rs
│   │   │       └── prelude.rs     # Re-exports for convenience
│   │   │
│   │   ├── migration/
│   │   │   ├── mod.rs
│   │   │   └── m20260412_000001_initial_schema.rs
│   │   │
│   │   └── models/                # Shared Rust types (non-entity)
│   │       ├── mod.rs
│   │       ├── task_status.rs     # TaskStatus enum
│   │       ├── event_types.rs     # ActivityEventType enum
│   │       ├── agent_state.rs     # AgentState enum
│   │       └── ssh_config.rs      # Phase 2: SSH connection types
│   │
│   └── resources/                 # Hook scripts bundled with app
│       ├── hooks/
│       │   ├── task-completion.sh     # Stop hook for tasks
│       │   ├── log-tool-use.sh        # PostToolUse hook
│       │   ├── chat-stop.sh           # Stop hook for chat sessions
│       │   ├── chat-tool-use.sh       # PostToolUse for chat
│       │   ├── chat-pre-tool-use.sh   # PreToolUse for chat permissions
│       │   └── chat-status.sh         # Status hook for chat
│       └── templates/
│           └── claude-settings.json   # Template .claude/settings.json
│
├── src/                           # === REACT FRONTEND ===
│   ├── index.html                 # Vite entry HTML
│   ├── main.tsx                   # React root, rspc provider, QueryClient
│   ├── App.tsx                    # Root component, routing
│   ├── globals.css                # Tailwind base + shadcn CSS variables
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx           # Main layout container
│   │   │   ├── Header.tsx             # App header, project selector
│   │   │   ├── Sidebar.tsx            # Sprint/Epic navigation + sprint list
│   │   │   └── BottomPanel.tsx        # Collapsible terminal area
│   │   │
│   │   ├── board/
│   │   │   ├── KanbanBoard.tsx        # FR1: 5-column board container
│   │   │   ├── KanbanColumn.tsx       # FR1: Single column
│   │   │   ├── TaskCard.tsx           # FR2: Draggable task card
│   │   │   └── NewTaskButton.tsx      # FR3: Quick task creation
│   │   │
│   │   ├── task/
│   │   │   ├── TaskPanel.tsx          # Task workspace container
│   │   │   ├── TaskDetails.tsx        # FR4: Task info display
│   │   │   ├── TaskActions.tsx        # FR7: Start Agent button
│   │   │   ├── TaskStatusBadge.tsx    # Status indicator
│   │   │   ├── TaskDetailTabs.tsx     # TES: 3-column workspace
│   │   │   ├── ActivitiesTab.tsx      # TES: Activity log with filters
│   │   │   ├── ActivitiesFilter.tsx   # TES: Event type filter chips
│   │   │   ├── ActivityItem.tsx       # TES: Single activity row
│   │   │   ├── ContentTab.tsx         # TES: Task description display
│   │   │   ├── TaskAutomationStatus.tsx # TES: Current phase indicator
│   │   │   └── ManualTriggerButtons.tsx # TES: Fallback trigger UI
│   │   │
│   │   ├── terminal/
│   │   │   ├── TerminalPanel.tsx      # FR10: Embedded terminal container
│   │   │   ├── TerminalOutput.tsx     # xterm.js wrapper (Tauri Channel)
│   │   │   └── TerminalControls.tsx   # FR13-14: Pause/Resume buttons
│   │   │
│   │   ├── review/
│   │   │   ├── DiffViewer.tsx         # FR18: Monaco diff editor
│   │   │   ├── ReviewActions.tsx      # FR17: Approve/Reject/Changes buttons
│   │   │   └── FeedbackForm.tsx       # FR20: Request changes input
│   │   │
│   │   ├── git/
│   │   │   ├── ConflictAlert.tsx      # FR26: Merge conflict UI
│   │   │   └── BranchBadge.tsx        # FR23: Branch indicator
│   │   │
│   │   ├── planning/
│   │   │   ├── PlanningWorkspacePage.tsx # FR36: Planning workspace
│   │   │   ├── ChatPanel.tsx          # FR38: Chat interface
│   │   │   ├── ChatSessionList.tsx    # FR46: Session list + live status
│   │   │   ├── ChatMessage.tsx        # Message bubble component
│   │   │   └── PersonaSelector.tsx    # FR37: Agent persona dropdown
│   │   │
│   │   ├── sprint/
│   │   │   ├── SprintListItem.tsx     # Sprint in sidebar
│   │   │   ├── NewSprintButton.tsx
│   │   │   ├── SprintForm.tsx         # Create/edit sprint dialog
│   │   │   └── SprintStatusBadge.tsx
│   │   │
│   │   └── ui/                        # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── tabs.tsx
│   │       ├── toast.tsx
│   │       ├── skeleton.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── useTask.ts                 # Task query/mutation (rspc)
│   │   ├── useAgent.ts                # Agent control hooks
│   │   ├── useTerminal.ts             # Terminal + Tauri Channel
│   │   ├── useGit.ts                  # Git operation hooks
│   │   ├── useActivity.ts             # Activity log + Tauri Events
│   │   ├── useSprint.ts               # Sprint hooks
│   │   └── useChat.ts                 # Chat session hooks
│   │
│   ├── stores/
│   │   ├── ui.store.ts                # Sidebar, panel visibility
│   │   └── terminal.store.ts          # Terminal buffer state
│   │
│   └── lib/
│       ├── rspc.ts                    # rspc client + React Query provider
│       ├── events.ts                  # Tauri Event listener helpers
│       ├── utils.ts                   # cn(), formatDate, etc.
│       └── constants.ts               # App-wide constants
│
├── data/                          # Runtime data (gitignored)
│   └── tinsu.db                   # SQLite database file
│
└── dist/                          # Build output (gitignored)
```

### Architectural Boundaries

**Process Boundaries:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAURI RUST BACKEND                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │   rspc      │   │  Services   │   │     Database        │  │
│  │   Router    │──▶│  (PTY, Git, │──▶│  (SeaORM+SQLite)    │  │
│  │             │   │  tmux, SSH) │   │                     │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
│         ▲                │                                      │
│         │ invoke         │ Tauri Events + Channels              │
│         ▼                ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              TAURI IPC LAYER (capabilities)              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ▲                 │
         │ rspc invoke     │ Events/Channels
         ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WEBVIEW (React Frontend)                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │   rspc      │   │   Zustand   │   │    React            │  │
│  │   Client    │──▶│   Stores    │──▶│    Components       │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**rspc Router Boundaries:**

| Router | Responsibility | Service Dependencies |
|--------|----------------|---------------------|
| `task` | Task/Sprint/Epic CRUD, status transitions | SeaORM (db) |
| `agent` | PTY spawn, pause, resume, kill, session management | PtyService, TmuxService, StallDetector |
| `review` | Get diff, approve, reject, request changes | GitService |
| `git` | Worktree create/remove, branch merge | GitService |
| `config` | Read/write project YAML, detect CLI | Filesystem |
| `activity` | Activity CRUD + event queries | ActivityLog |
| `sprint` | Sprint lifecycle, single-active constraint | SeaORM (db) |
| `chat` | Chat session management, message send | ChatCliService, TmuxService |

**Service Boundaries:**

| Service | Owns | Exposes to Router |
|---------|------|-------------------|
| `PtyService` | portable-pty instances | `spawn()`, `write()`, `kill()`, `pause()`, `resume()` |
| `GitService` | Git CLI execution | `create_worktree()`, `remove_worktree()`, `merge()`, `get_diff()` |
| `TmuxService` | tmux session lifecycle | `create_session()`, `kill_session()`, `has_session()`, `send_keys()` |
| `HookListener` | axum HTTP server | `start()`, `stop()`, event routing to Tauri Events |
| `ActivityLog` | Event persistence | `log_activity()`, `get_activities()` |
| `Automation` | Story/Basic state machine | `on_status_change()`, `on_agent_complete()` |
| `ChatCliService` | Chat session spawn/I/O | `spawn_session()`, `send_message()`, `kill_session()` |
| `StallDetector` | Output timers | `start_monitoring()`, stall callback |
| `SshService` | Phase 2: SSH connections | `connect()`, `exec()`, `forward_port()` |

**Data Boundaries:**

| Boundary | Pattern | Notes |
|----------|---------|-------|
| DB → Router | SeaORM queries in router procedures | No raw SQL in routers |
| Router → Client | rspc procedures | Type-safe, auto-generated TS types |
| Client → Component | TanStack Query hooks via `@rspc/react` | `useQuery` / `useMutation` wrappers |
| Component → Store | Zustand actions | UI-only state |
| Rust → Frontend (stream) | Tauri Channels | PTY byte data |
| Rust → Frontend (events) | Tauri Events | Activity, status, hooks |

### Requirements to Structure Mapping

**FR Categories → Directories:**

| FR Category | Primary Location (Rust) | Primary Location (React) |
|-------------|------------------------|--------------------------|
| **FR1-FR6: Board & Task** | `router/task.rs`, `db/entities/task.rs` | `components/board/`, `hooks/useTask.ts` |
| **FR7-FR11: Agent Execution** | `services/pty_service.rs`, `services/tmux_service.rs` | `components/terminal/`, `hooks/useAgent.ts` |
| **FR12-FR16: Monitoring** | `services/stall_detector.rs` | `components/terminal/TerminalControls.tsx` |
| **FR17-FR21: Review** | `router/review.rs`, `services/git_service.rs` | `components/review/` |
| **FR22-FR27: Git** | `services/git_service.rs`, `router/git.rs` | `components/git/` |
| **FR28-FR31: Config** | `router/config.rs` | Project root YAML files |
| **FR32-FR35: Persistence** | `db/`, all entities | All routers via SeaORM |
| **FR36-FR53: Planning** | `router/chat.rs`, `services/chat_cli.rs` | `components/planning/` |
| **TES FR1-FR47** | `services/activity_log.rs`, `services/automation.rs` | `components/task/`, `hooks/useActivity.ts` |

### Integration Points

**Internal Communication:**

| From | To | Method |
|------|-----|--------|
| React Component | rspc Router | `rspc.useQuery(['router.procedure', input])` |
| rspc Router | Service | Direct function call (injected via app state) |
| Service | Database | SeaORM queries |
| PTY output | React Terminal | Tauri Channel → xterm.js write |
| Hook listener | React UI | Tauri Event emission |
| Activity events | React UI | Tauri Event → `listen()` callback |

**External Integrations:**

| System | Integration Point | Method |
|--------|-------------------|--------|
| Claude Code CLI | `services/tmux_service.rs` | tmux send-keys + PTY attachment |
| Git | `services/git_service.rs` | `tokio::process::Command` for git CLI |
| File System | Config router, Context builder | `tokio::fs` |
| Claude Code Hooks | `services/hook_listener.rs` | axum HTTP POST endpoints |
| SSH (Phase 2) | `services/ssh_service.rs` | russh async SSH client |

**Data Flow (Task Execution):**

```
User clicks "Start Agent" on TaskCard
  → useAgent hook calls rspc.useMutation('agent.startAgent')
  → agent router creates worktree via GitService
  → agent router builds context via ContextBuilder
  → agent router creates tmux session via TmuxService
  → TmuxService sends claude command into tmux
  → PtyService attaches to tmux, streams via Tauri Channel
  → TerminalOutput.tsx writes Channel data to xterm.js
  → StallDetector monitors output timing
  → Hook listener receives Stop event via axum
  → Automation service updates task status
  → Tauri Event emits 'task:status-changed'
  → React components update via event listener
```

### Development Workflow

**Dev Server:**

```bash
npm run tauri dev    # Starts Vite dev server + Tauri window (HMR for React, recompile for Rust)
```

**Database Migrations:**

```bash
# Migrations run automatically on app startup via sea-orm-migration
# To generate a new migration:
cd src-tauri && cargo run --bin migration -- generate MIGRATION_NAME
```

**Build & Package:**

```bash
npm run tauri build              # Desktop build for current platform
npm run tauri android build      # Android APK/AAB (Phase 3)
npm run tauri ios build          # iOS IPA (Phase 3)
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices form a cohesive, modern stack:

- Tauri v2.10.3 + React 18 + TypeScript 5.x — proven combination
- rspc + Specta — type-safe IPC with auto-generated TypeScript types, designed for Tauri
- SeaORM + SQLite — async ORM on tokio runtime, compile-time entity validation
- axum 0.8.8 on tokio — same async runtime as Tauri's backend, no runtime conflict
- portable-pty 0.9.0 — cross-platform PTY from wezterm project
- russh 0.54.6 — async SSH on tokio, compatible with the async stack
- shadcn/ui + Tailwind v4 + xterm.js + Monaco — all web-based, render identically in Tauri's webview

**Pattern Consistency:**

- Naming conventions: Rust snake_case ↔ DB snake_case aligned; React PascalCase ↔ rspc camelCase aligned
- Structure patterns match technology conventions (Cargo module system, Vite project layout)
- Communication patterns (rspc for request-response, Channels for streams, Events for notifications) are non-overlapping

**Structure Alignment:**

- `src-tauri/src/router/` mirrors the existing tRPC router structure
- `src-tauri/src/services/` maps 1:1 to existing Node.js services
- Frontend structure preserved from Electron with minimal changes

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR Category | Status | Architectural Support |
|-------------|--------|----------------------|
| FR1-FR6: Board & Task | ✅ | `router/task.rs`, `board/` components, SeaORM entities |
| FR7-FR11: Agent Execution | ✅ | `pty_service.rs`, `tmux_service.rs`, `agent` router, terminal components |
| FR12-FR16: Monitoring | ✅ | `stall_detector.rs`, `TerminalControls`, Tauri Events |
| FR17-FR21: Review | ✅ | Monaco diff viewer, `review` router, `ReviewActions` |
| FR22-FR27: Git | ✅ | `git_service.rs`, `git` router, worktree patterns |
| FR28-FR31: Config | ✅ | `config` router, YAML file handling via `tokio::fs` |
| FR32-FR35: Persistence | ✅ | SeaORM entities, SQLite, sea-orm-migration |
| FR36-FR43: Planning | ✅ | `chat` router, `chat_cli.rs`, `planning/` components |
| FR44-FR47: Concurrent | ✅ | Independent tmux sessions, Tauri Events for status |
| FR48-FR53: Multi-Project | ✅ | Project-scoped DB queries, tmux session naming |
| TES FR1-FR47 | ✅ | `activity_log.rs`, `automation.rs`, `task/` components |

**Non-Functional Requirements Coverage:**

| NFR Category | Status | How Addressed |
|-------------|--------|---------------|
| Performance (<100ms UI) | ✅ | Vite HMR, React 18, Tauri's native webview |
| Terminal streaming (<500ms) | ✅ | Tauri Channels — direct byte streaming |
| Reliability (crash recovery) | ✅ | ACID SQLite via SeaORM, tmux persistence, AppError patterns |
| Concurrency (5+ chat, 10+ task) | ✅ | Independent tmux sessions, tokio async runtime |
| Session persistence | ✅ | tmux native persistence, scrollback backup service |
| Hook routing accuracy | ✅ | tmux session name keyed, Tauri Event emission |

### Implementation Readiness Validation ✅

**Decision Completeness:**

- 15 major architectural decisions documented with verified 2026 versions
- Implementation patterns cover all 7 conflict categories
- Concrete code examples for rspc, Rust errors, Tauri Events, Channels, Zustand

**Structure Completeness:**

- 80+ files/directories defined with FR mapping
- Component boundaries clear (board/, task/, terminal/, review/, planning/)
- Service boundaries explicit (PTY, Git, tmux, hooks, activity, automation, chat, SSH)

**Pattern Completeness:**

- 6 naming convention categories with examples
- rspc response/error patterns with code samples
- Error handling layers defined per component type
- Anti-patterns documented

### Gap Analysis Results

**Critical Gaps:** None identified

**Important Gaps (addressable during implementation):**

1. SeaORM entity definitions not yet written — first implementation task when porting the 17-table schema
2. rspc subscription pattern for real-time activity streaming — Tauri Events cover this, exact API integration explored during T1.3
3. Mobile-specific patterns (Phase 3) — responsive layouts, touch interactions deferred

**Nice-to-Have (post-MVP):**

- Detailed testing strategy for Rust services (cargo test patterns, mocking SeaORM)
- CI/CD pipeline specifics (Phase 4)
- Performance profiling approach
- SSH connection pooling strategy (Phase 2)

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (100 FRs, 32+ NFRs)
- [x] Scale and complexity assessed (High — 5 platforms, Rust rewrite, SSH)
- [x] Technical constraints identified (8 constraints)
- [x] Cross-cutting concerns mapped (6 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented with verified 2026 versions
- [x] Technology stack fully specified (15+ libraries/crates)
- [x] Integration patterns defined (rspc, Tauri Events, Channels)
- [x] Performance considerations addressed (Channels for PTY, async tokio)

**✅ Implementation Patterns**

- [x] Naming conventions established (DB, SeaORM, rspc, Rust, React, Tauri Events)
- [x] Structure patterns defined (80+ files mapped)
- [x] Communication patterns specified (rspc, Events, Channels)
- [x] Process patterns documented (error handling, loading states, state machine)

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established (Rust backend / Tauri IPC / React frontend)
- [x] Integration points mapped (services → routers → client → components)
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH — All validation checks pass, no critical gaps

**Key Strengths:**

- Type-safe end-to-end with rspc + Specta + TypeScript
- Single codebase for 5 platforms — core migration motivation
- React frontend preserved — zero UI rewrite, massive risk reduction
- Async-native Rust backend — tokio runtime for all I/O
- Comprehensive patterns prevent AI agent conflicts across Rust/TypeScript boundary
- Clear migration path — tRPC→rspc is near 1:1, service structure mirrors existing

**Areas for Future Enhancement:**

- SSH remote execution abstraction (Phase 2 — LocalHost vs RemoteHost trait)
- Mobile-specific responsive patterns (Phase 3)
- Testing strategy refinement (evolves during implementation)
- Auto-update mechanism (post-MVP)

### Implementation Handoff

**AI Agent Guidelines:**

1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and boundaries
4. Refer to this document for all architectural questions
5. When in doubt, check the Anti-Patterns section

**First Implementation Priority:**

```bash
cd tinsu
npm install @tauri-apps/cli@latest @tauri-apps/api@latest
npm run tauri init
```

Then proceed through the Implementation Sequence (10 steps) defined in Core Architectural Decisions.

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-04-12
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**

- All architectural decisions documented with verified 2026 versions
- Implementation patterns ensuring AI agent consistency across Rust + TypeScript
- Complete project structure with 80+ files and directories
- Requirements to architecture mapping for 100+ FRs
- Validation confirming coherence and completeness

**Technology Stack Summary**

| Layer | Electron (old) | Tauri (new) |
|-------|---------------|-------------|
| Framework | Electron | Tauri v2.10.3 |
| Backend | Node.js + TypeScript | Rust + tokio |
| IPC | tRPC 11.6.0 + trpc-electron | rspc + @rspc/tauri |
| Database | better-sqlite3 + Drizzle | SQLite + SeaORM |
| PTY | node-pty | portable-pty 0.9.0 |
| HTTP hooks | Custom Express | axum 0.8.8 |
| SSH | N/A | russh 0.54.6 |
| Frontend | React + shadcn/ui + Tailwind | **Unchanged** |
| Platforms | macOS, Linux | macOS, Linux, Windows, Android, iOS |

**Implementation Ready Foundation**

- 15 major architectural decisions made
- 7 implementation pattern categories defined
- 12-15 architectural components specified
- 100+ functional requirements + 32+ non-functional requirements fully supported

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
