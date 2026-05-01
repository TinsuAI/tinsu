# Sprint Change Proposal — Mobile UX Native Redesign (Parallel Tree)

**Date:** 2026-04-30
**Triggered by:** Mobile UX defect velocity from responsive single-tree approach
**Scope Classification:** Major
**Approved by:** _pending — awaiting Tinsu sign-off_
**Related plan:** [`mobile-ux-redesign-plan-2026-04-30.md`](./mobile-ux-redesign-plan-2026-04-30.md)
**Supersedes within:** Tauri Epic 3 (T3.1–T3.8)

---

## Section 1: Issue Summary

### Problem Statement

Tauri Epic 3 delivered Android/iOS build targets and a responsive React tree that switches behavior on `useIsMobile()` (`src/hooks/useIsMobile.ts:7`). The result is the desktop app shrunk to a phone with touch handlers bolted on:

- Mobile-only branches scattered across desktop components (kanban, task workspace, planning, review, SSH form, terminal).
- Each new mobile defect ships as a localized patch — recent commits `f8ec1e6`, `43a6488`, `519cd61`, `1df4ba6` are mobile-fix patches against shared components, not feature work.
- T3.8 platform validation never reached real-device sign-off (`_bmad-output/implementation-artifacts/t3-8-test-report.md` AC 1, 3, 4, 5, 8, 9, 10 all blocked on device testing).
- Mobile-native interaction patterns (bottom-tab stacks, full-screen flows, bottom sheets, edge swipe, sticky thumb-zone action bars) cannot be retrofitted onto desktop layouts without further branching.

### Discovery Context

- **When:** Tauri Epic 3 implementation, T3.1 through T3.7 marked done, T3.8 stuck in-progress.
- **Evidence:** Visible patch cadence on `tauri-pivot` branch (5+ mobile-only commits since T3.7), test report admitting fabricated metrics, recurring user-reported regressions on mobile after desktop changes.
- **Root cause:** Responsive approach optimized for code reuse, not for mobile-native UX. Mobile and desktop have different navigation models, gesture vocabulary, density, and information hierarchy. Conflating them in one component tree forces every UI change to consider both, and the cheaper of the two (desktop, since the developer is on desktop) wins by default.

### Mandate

User decision (2026-04-30): **batch correction** + **Option E modified** — parallel mobile UI tree at `src/mobile/` with **full feature parity in MVP**. No scope cut. Both kanban-on-mobile and planning-workspace-on-mobile must ship.

---

## Section 2: Impact Analysis

### Epic Impact

**Restructured (this proposal):**

| Epic | Stories Done | Stories In-Progress | Action |
|---|---|---|---|
| Tauri Epic 3 (Mobile Targets — responsive) | 7 (T3.1–T3.7) | 1 (T3.8) | Renamed → "Mobile Foundation"; T3.1 (build targets) **kept as-is**; T3.2–T3.7 marked **superseded-as-foundation** (artifacts kept, behavior replaced); T3.8 cancelled (validation rolls into new epic gate). |

**New (this proposal):**

| Epic | Stories | Phase | Effort |
|---|---|---|---|
| Tauri Epic 3.5: Mobile UX Native Redesign | 9 | New Phase 3.5 (between current Phase 3 and Phase 4) | 5–6 weeks |

**Unaffected:**

- Tauri Epic 1 (Desktop Foundation) — done, no changes.
- Tauri Epic 2 (Remote SSH) — done, reused by mobile tree unchanged.
- Tauri Epic 4 (CI/CD) — backlog, no changes; mobile build pipeline still T4.2/T4.3.
- All desktop-side React components — preserved. Desktop tree continues to render the existing `App.tsx` path when viewport is desktop.

### Artifact Conflicts

| Artifact | Impact | Action |
|---|---|---|
| `_bmad-output/planning-artifacts/epics.md` | High | Restructure Tauri Epic 3 stories; add Tauri Epic 3.5 with 9 stories |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | High | Mark T3.2–T3.7 `superseded`, T3.8 `cancelled`, add `tauri-epic-3-5` block |
| `_bmad-output/planning-artifacts/ux-design-specification.md` | High | Add cross-reference to mobile redesign plan; mobile section now lives in dedicated plan doc |
| `_bmad-output/planning-artifacts/architecture.md` | Medium | Document `src/mobile/` parallel tree, viewport routing at `App.tsx`, mobile-nav Zustand store, deep-link handlers |
| `_bmad-output/planning-artifacts/prd.md` | Low | Note FR coverage now delivered via mobile-native tree, not responsive |
| `CLAUDE.md` | Low | Add note: mobile UI changes go to `src/mobile/`, not desktop components |
| `mobile-ux-redesign-plan-2026-04-30.md` | — | Already authored; serves as the design substrate for Epic 3.5 |
| `_bmad-output/implementation-artifacts/t3-8-test-report.md` | Low | Add note: T3.8 cancelled, validation rolls into Epic 3.5 device gate |

### Technical Impact

**Code added (~6,000 LOC):**

- `src/mobile/primitives/` — 14 mobile primitives (`MobileScreen`, `MobileTopAppBar`, `MobileTabBar`, `MobileSheet`, `MobileSegmentedTabs`, `MobileColumnPager`, `MobileBottomActionBar`, `MobileListItem`, `MobileEmptyState`, `MobileChip`, `MobileFab`, `MobileSearchBar`, `MobileLoadingSkeleton`, `MobilePullToRefresh`).
- `src/mobile/board/` — column pager kanban + add-task sheet.
- `src/mobile/tasks/` — full-screen task workspace with 4 sub-tabs (Content / Terminal / Activities / Diff) + segmented control.
- `src/mobile/planning/` — session list root, chat screen, BMAD top pill + bottom sheet.
- `src/mobile/review/` — diff screen (unified-only), file tree as bottom sheet, sticky review action bar.
- `src/mobile/ssh/` — SSH connection form as full-screen flow + key picker sheet.
- `src/mobile/activity/` — cross-task activity feed.
- `src/mobile/settings/` — mobile settings screens.
- `src/mobile/shell/` — `MobileApp.tsx` root, viewport router, mobile-nav Zustand store with 5 parallel stacks, deep-link wiring.

**Code removed (~3,000 LOC):**

- All `useIsMobile()` branches in desktop components.
- `MobileBottomNav.tsx`, `MobileTerminal.tsx` (replaced), `MobileSshConnectionForm.tsx` (replaced), `MobileReviewActionBar.tsx`, `MobileDiffViewer.tsx`, `MobileFileTree.tsx`, `MobileSessionDrawer.tsx` — all migrate into `src/mobile/` and the desktop-tree variants are deleted.
- Mobile-specific Tailwind responsive utility scatter on desktop components.

**Net:** ~+3,000 LOC for materially better mobile UX, lower future-feature cost (one place to change mobile, one place to change desktop, no cross-contamination).

**Reused unchanged:**

- All Rust backend / Tauri commands / SSH services / tmux session services / git diff backend.
- All Zustand domain stores (`project.store`, `useTaskWorkspaceStore`, `usePlanningWorkspaceStore`, `useStoryViewStore`).
- All rspc hooks and TanStack Query patterns.
- Calm Command design tokens (`--background`, `--card`, `--primary`, JetBrains Mono / Inter) carry over verbatim.
- xterm.js, Monaco, @dnd-kit (kanban only) — wrapped in mobile primitives but not re-implemented.

**Routing change (critical):**

`App.tsx:18` — viewport detection runs once at root. If `isMobile`, render `<MobileApp />` (new). Otherwise render existing desktop tree (`AppShell` + `KanbanBoardContainer` + conditional full-screen pages). `useIsMobile()` is replaced with a one-shot viewport detector at root; the hook is removed from all child components (since each tree only renders for one form factor).

---

## Section 3: Recommended Approach

### Selected Path: Parallel Mobile UI Tree (Option E modified — full parity)

**Why not keep responsive (Direct Adjustment)?**
Continues patch cadence indefinitely. Every desktop change risks a mobile regression and vice-versa. UX ceiling is "miniaturized desktop."

**Why not abandon mobile (Rollback)?**
Mobile is the strategic capability that motivated the Tauri pivot (`sprint-change-proposal-2026-04-12.md`). Cannot abandon.

**Why not scope-cut (drop kanban or planning from mobile)?**
User mandate: full parity. Both kanban and planning are core daily-use surfaces. A mobile app without them is a notification client, not a TinSu mobile app.

**Why parallel tree?**

- Mobile gets purpose-built navigation (5-tab bottom bar, full-screen flows, bottom sheets, edge swipe, sticky thumb-zone action bars).
- Desktop stops paying mobile-branching tax. Future desktop features no longer need to consider mobile.
- Migration is incremental — `MobileApp.tsx` can ship with one tab populated and others routed to legacy components, then each tab cuts over as its screens land.
- Foundational T3.1 work (Android/iOS build, signing, dev tooling) is kept and reused — only the UI layer is replaced.

### Phased Plan (within Tauri Epic 3.5)

```
Phase 3.5: Mobile UX Native Redesign (5–6 weeks)
├── T3.5-1  Mobile shell foundation: viewport router, MobileApp.tsx,
│           5-stack mobile-nav Zustand store, deep-link wiring          [foundation]
├── T3.5-2  Mobile primitives library: 14 primitives, design-token
│           audit, storybook-equivalent visual harness                  [foundation]
├── T3.5-3  Mobile board: column pager, peek-of-next, add-task sheet,
│           long-press drag using existing @dnd-kit core                [feature]
├── T3.5-4  Mobile task workspace: 4 sub-tabs, segmented control,
│           swipe between sub-tabs, sticky action bar per sub-tab       [feature]
├── T3.5-5  Mobile planning: session list root, chat screen,
│           BMAD persona pill + bottom sheet, deep link tinsu://chat    [feature]
├── T3.5-6  Mobile review: unified diff screen, file tree sheet,
│           sticky Approve/Request-changes action bar                   [feature]
├── T3.5-7  Mobile SSH + connection mgmt: full-screen flow,
│           key picker sheet, error-state recovery                      [feature]
├── T3.5-8  Mobile activity feed + settings + polish: cross-task
│           activity, settings screens, empty states, skeletons         [feature]
├── T3.5-9  Real-device validation gate: Android + iOS, all 10 ACs
│           from t3-8-test-report.md verified on hardware               [GATE]
```

### Effort, Risk, Timeline

| Dimension | Assessment |
|---|---|
| **Total effort** | 5–6 weeks |
| **Risk level** | Medium |
| **Top risk** | Drift between desktop and mobile feature behavior (mitigated: Rust backend is single source of truth; UI trees only differ in presentation) |
| **Second risk** | Mobile primitive churn during early stories (mitigated: T3.5-2 stabilizes primitives before feature stories) |
| **Third risk** | Real-device gate (T3.5-9) finds issues that retroactively change earlier stories (mitigated: test on emulator + at least one physical device every 2 stories, not only at the end) |
| **Timeline impact** | Adds ~5–6 weeks before Phase 4 (CI/CD). Phase 4 unaffected in scope. |
| **What's preserved** | Rust backend, domain stores, rspc hooks, design tokens, xterm/Monaco/@dnd-kit, T3.1 build infra |
| **What's lost** | T3.2–T3.7 mobile UI artifacts (replaced); T3.8 validation report becomes input doc, not deliverable |
| **What's gained** | Mobile-native UX, removal of `useIsMobile()` branches from desktop, one-place-per-form-factor maintenance |

---

## Section 4: Detailed Change Proposals

### 4.1 Epic & Story Changes

**Tauri Epic 3 — restructure:**

| Story | Current | New | Note |
|---|---|---|---|
| t3-1 (build targets) | done | done — kept | Foundation reused |
| t3-2 (responsive layout + nav) | done | superseded-foundation | Mobile bottom nav replaced by `MobileTabBar` primitive |
| t3-3 (touch kanban) | done | superseded-foundation | @dnd-kit config preserved, wrapped in `MobileColumnPager` |
| t3-4 (mobile SSH) | done | superseded-foundation | Form logic preserved, presentation rebuilt as full-screen flow |
| t3-5 (mobile terminal) | done | superseded-foundation | Canvas renderer preserved, integrated into mobile task workspace sub-tab |
| t3-6 (mobile review) | done | superseded-foundation | Action bar/diff/file-tree preserved, regrouped in mobile review screen |
| t3-7 (mobile chat) | done | superseded-foundation | MobileSessionDrawer replaced by full session list screen |
| t3-8 (validation) | in-progress | cancelled | Validation rolls into T3.5-9 gate |

**Tauri Epic 3.5 — new (added to `epics.md` and `sprint-status.yaml`):**

9 stories listed above. Story files to be authored by SM after approval.

### 4.2 epics.md Changes

- Rename "Tauri Epic 3: Mobile Targets" → "Tauri Epic 3: Mobile Foundation (Build Targets)".
- Move T3.2–T3.8 to a "Superseded by Epic 3.5" subsection with cross-reference.
- Add new "Tauri Epic 3.5: Mobile UX Native Redesign" with 9 stories and acceptance criteria pulled from `mobile-ux-redesign-plan-2026-04-30.md` §11.

### 4.3 sprint-status.yaml Changes

```yaml
# Tauri Epic 3: Mobile Foundation (Build Targets)
tauri-epic-3: in-progress    # was: done
t3-1-add-android-and-ios-build-targets: done
t3-2-responsive-layout-and-mobile-navigation: superseded   # was: done
t3-3-touch-optimized-kanban-interactions: superseded
t3-4-mobile-ssh-connection-flow: superseded
t3-5-mobile-terminal-view: superseded
t3-6-mobile-review-and-approval-flow: superseded
t3-7-mobile-chat-with-planning-agents: superseded
t3-8-mobile-platform-validation: cancelled                  # was: in-progress

# Tauri Epic 3.5: Mobile UX Native Redesign (added 2026-04-30)
# Source: sprint-change-proposal-2026-04-30.md
# Design plan: mobile-ux-redesign-plan-2026-04-30.md
tauri-epic-3-5: backlog
t3-5-1-mobile-shell-foundation: backlog
t3-5-2-mobile-primitives-library: backlog
t3-5-3-mobile-board: backlog
t3-5-4-mobile-task-workspace: backlog
t3-5-5-mobile-planning: backlog
t3-5-6-mobile-review: backlog
t3-5-7-mobile-ssh-and-connection-management: backlog
t3-5-8-mobile-activity-feed-and-settings: backlog
t3-5-9-real-device-validation-gate: backlog
tauri-epic-3-5-retrospective: optional
```

### 4.4 Architecture Changes

Add to `architecture.md`:

- "Mobile UI Architecture" section documenting parallel tree at `src/mobile/`.
- Viewport routing pattern: one-shot detection at `App.tsx`, no per-component branching.
- `mobile-nav` Zustand store: 5 parallel navigation stacks (one per bottom tab) for native back-button behavior.
- Deep-link table: `tinsu://chat/{sessionId}`, `tinsu://task/{taskId}`, mapped to mobile-nav store actions.
- Mobile primitive contract: all primitives consume Calm Command tokens; no inline Tailwind colors.

### 4.5 PRD Changes

Minor: in the mobile FR section, add a footnote that mobile is delivered via parallel UI tree (not responsive), and that all mobile FRs are validated against the mobile tree, not the desktop tree shrunk to phone width.

### 4.6 UX Design Changes

`ux-design-specification.md` adds a one-paragraph cross-reference to `mobile-ux-redesign-plan-2026-04-30.md` as the authoritative mobile UX doc. Desktop UX is unchanged.

### 4.7 CLAUDE.md Changes

Add line:

> Mobile UI lives in `src/mobile/`. Do not add `useIsMobile()` branches to desktop components — mobile and desktop are now separate trees rendered conditionally at `App.tsx`.

---

## Section 5: Implementation Handoff

### Scope Classification: Major

Replans an in-flight epic and introduces a new epic. Requires SM and Architect alignment before dev starts.

### Handoff Plan

| Role | Responsibility | Deliverable |
|---|---|---|
| **Architect (Winston)** | Document `src/mobile/` parallel tree pattern, viewport router, mobile-nav store contract, deep-link table in `architecture.md` | Updated `architecture.md` |
| **UX Designer (Sally)** | Confirm `mobile-ux-redesign-plan-2026-04-30.md` is the authoritative mobile UX doc; cross-reference from `ux-design-specification.md` | Cross-reference added; plan promoted to authoritative |
| **Scrum Master (Bob)** | Apply sprint-status.yaml diff in §4.3; update `epics.md` per §4.2; create the 9 Epic 3.5 story files | Updated `sprint-status.yaml`, `epics.md`, 9 story files |
| **PM (John)** | Footnote in `prd.md` per §4.5; update `CLAUDE.md` per §4.7 | Updated `prd.md`, `CLAUDE.md` |
| **Developer (Amelia)** | Execute T3.5-1 → T3.5-9 in order. Every UI story uses `/frontend-design` skill (per CLAUDE.md frontend rule) | Working mobile tree, real-device gate passed |

### Execution Order

1. Architect documents the architecture deltas (blocking — dev needs the routing + primitive contract).
2. SM updates sprint-status.yaml + epics.md + creates story files (blocking — dev needs story spec).
3. UX promotes plan doc (parallel with Architect).
4. PM footnotes PRD + updates CLAUDE.md (parallel, non-blocking).
5. Dev starts T3.5-1 (mobile shell foundation) — must land before any feature story since it owns the routing seam.
6. Dev runs T3.5-2 (primitives) before any feature story to stabilize the design surface.
7. Feature stories T3.5-3 through T3.5-8 can interleave; recommended order matches list above (board → tasks → planning → review → SSH → activity/settings) since each builds confidence in the primitive set.
8. T3.5-9 gate is mandatory before Phase 4. Real Android device + iOS simulator (or device if macOS available) must execute every AC in `t3-8-test-report.md`.

### Frontend Skill Mandate

Per `CLAUDE.md`, every UI-bearing story (T3.5-1 through T3.5-8) carries the bold note:

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

T3.5-9 is a validation story; no `/frontend-design` mandate.

### Success Criteria

- [ ] `useIsMobile()` removed from all desktop components; only used by viewport router at `App.tsx`.
- [ ] `src/mobile/` tree renders all 30 mobile screens listed in plan §6.
- [ ] All 14 mobile primitives published and used consistently across mobile features.
- [ ] Calm Command tokens audited — no inline Tailwind color classes in `src/mobile/`.
- [ ] Deep links `tinsu://chat/{sessionId}` and `tinsu://task/{taskId}` route to correct mobile screens.
- [ ] T3.5-9 real-device gate: all 10 ACs in `t3-8-test-report.md` verified on Android API 34 emulator + at least one physical device. iOS verified if macOS available; otherwise documented as iOS-deferred.
- [ ] Desktop tree behavior unchanged — full desktop test suite passes after Epic 3.5 lands.

### Rollback Plan

If Epic 3.5 stalls before T3.5-3 (board) lands, rollback is trivial: revert `App.tsx` viewport router to the pre-3.5 conditional render. T3.5-1 and T3.5-2 are additive (new files under `src/mobile/`); no desktop component changes until T3.5-3 begins removing `useIsMobile()` branches.

If Epic 3.5 stalls after T3.5-3, rollback per story: each feature story restores its desktop counterpart's mobile branch. This is reversible because the desktop tree is preserved unchanged throughout the migration; only at the end of Epic 3.5 is the dead `useIsMobile()` branching deleted from desktop components.

---

## Approval

- [ ] **Tinsu** — approve scope, classification, and execution order
- [ ] Confirm SM applies §4.3 sprint-status.yaml diff
- [ ] Confirm Architect updates `architecture.md` with §4.4 deltas
- [ ] Confirm Dev begins with T3.5-1 (no parallel feature work until shell + primitives land)

---

## References

- Design plan: `_bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md`
- Prior course correction: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md` (KMP → Tauri)
- T3.8 validation backlog: `_bmad-output/implementation-artifacts/t3-8-test-report.md`
- Current mobile UI inventory: `MobileBottomNav.tsx`, `MobileTerminal.tsx`, `MobileSshConnectionForm.tsx`, `MobileReviewActionBar.tsx`, `MobileDiffViewer.tsx`, `MobileFileTree.tsx`, `MobileSessionDrawer.tsx`
- Routing seam: `src/App.tsx:18` (viewport router insertion point)
- Hook to be retired from child components: `src/hooks/useIsMobile.ts:7`
