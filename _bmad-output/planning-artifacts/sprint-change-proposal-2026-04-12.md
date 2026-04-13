# Sprint Change Proposal — Tauri v2 Migration

**Date:** 2026-04-12
**Triggered by:** KMP mobile codebase maintenance burden
**Scope Classification:** Major
**Approved by:** Tinsu (2026-04-12)

---

## Section 1: Issue Summary

### Problem Statement

TinSu currently requires three separate codebases to deliver its cross-platform vision:

1. **Electron + Node.js** (desktop — macOS, Linux)
2. **Kotlin Multiplatform + Jetpack Compose** (Android)
3. **Kotlin Multiplatform + SwiftUI** (iOS)

After completing Mobile Epics 1–2 (12 stories), the maintenance burden of separate UI layers (Compose + SwiftUI) with zero code sharing from the Electron desktop app became unsustainable for a solo founder. Additionally, the desktop app lacks remote project support — the very capability the mobile app was designed to provide.

### Discovery Context

- **When:** During Mobile Epic 2 implementation (Connection Management + SSH)
- **Evidence:** Each mobile story required implementing the same feature twice (Android + iOS) in languages/frameworks completely different from the desktop stack. The KMP shared layer helps with business logic but UI is platform-specific.
- **Root cause:** Architectural mismatch — choosing KMP for mobile created a second product to maintain instead of extending the first.

---

## Section 2: Impact Analysis

### Epic Impact

**Superseded (scrapped):**

| Epic | Stories Done | Stories Backlog | Action |
|------|-------------|----------------|--------|
| Mobile Epic 1: KMP Foundation | 6 | 0 | Superseded |
| Mobile Epic 2: Connect to PC | 6 | 0 | Superseded |
| Mobile Epic 3: Chat with Agents | 0 | 5 | Superseded |
| Mobile Epic 4: Read Documents | 0 | 4 | Superseded |
| Mobile Epic 5: Review & Act | 0 | 4 | Superseded |
| Mobile Epic 6: Dashboard | 0 | 2 | Superseded |
| Mobile Epic 7: Resilience | 0 | 4 | Superseded |
| **Total** | **12** | **19** | **All superseded** |

**Deferred (until Tauri migration complete):**

| Epic | Stories | Reason |
|------|---------|--------|
| TES Epic 5: Workflow Automation | 10 (backlog) | Don't implement on dying Electron backend |
| Epic 6: Agent Monitoring | 8 (backlog) | Don't implement on dying Electron backend |

**Unaffected:**

All completed desktop epics (1, 2, 3, 7, 8, 9, 10, TES 1–4, CTM 1–2) — their React frontend code is preserved in the Tauri migration. Backend logic is rewritten in Rust but with identical behavior.

### New Epics Added

| Epic | Stories | Phase | Effort Estimate |
|------|---------|-------|-----------------|
| Tauri Epic 1: Desktop Foundation & React Migration | 10 | Phase 1 | 8–10 weeks |
| Tauri Epic 2: Remote Project Support via SSH | 8 | Phase 2 | 4–6 weeks |
| Tauri Epic 3: Mobile Targets (Android + iOS) | 8 | Phase 3 | 4–6 weeks |
| Tauri Epic 4: CI/CD and Build Pipeline | 4 | Phase 4 | 2–3 weeks |
| **Total** | **30** | | **18–25 weeks** |

### Artifact Conflicts

| Artifact | Impact Level | Action |
|----------|-------------|--------|
| PRD (prd.md) | High | Update tech stack, add FR54–FR61, move mobile to MVP, update risk table |
| Architecture (architecture.md) | Very High | Rewrite backend sections, add SSH architecture, update tech stack |
| Project Context (project-context.md) | Very High | Rewrite tech stack, process boundaries, file structure, testing |
| UX Design (ux-design-specification.md) | Medium | Add mobile-responsive layouts, touch interactions |
| Epics (epics.md) | High | Supersede mobile epics, add 4 Tauri epics |
| Sprint Status (sprint-status.yaml) | High | Update all mobile + deferred statuses, add Tauri epic entries |
| epics-mobile.md | Obsolete | Superseded entirely |
| CI/CD pipelines | High | Replace Electron + KMP builds with Tauri multi-platform |

### Technical Impact

**Frontend (preserved):**
- All React components, Tailwind CSS, shadcn/ui — work in Tauri's webview
- xterm.js, Monaco Editor, @dnd-kit — web-based, platform-agnostic
- Zustand stores, TanStack Query patterns — unchanged

**Backend (full rewrite):**
- 34 Node.js services → Rust services (~31,000 LoC to rewrite)
- 16 tRPC routers (179 procedures) → Tauri invoke commands
- 17 database tables → same schema in Rust ORM
- node-pty → portable-pty (Rust)
- child_process → tokio::process
- HTTP hook listener → axum

**New capability:**
- SSH client (russh) — remote project access on all platforms
- Cross-platform builds — macOS, Linux, Windows, Android, iOS from one codebase

---

## Section 3: Recommended Approach

### Selected Path: Phased Tauri v2 Migration

**Why not Direct Adjustment (keep both stacks)?**
Perpetuates the 3-codebase problem. Adding SSH to Electron still leaves mobile as a separate KMP app.

**Why not Rollback only?**
Scrapping KMP without a replacement leaves mobile unaddressed.

**Why Phased Migration?**
- Phase gates provide abort points if Tauri proves problematic
- Desktop feature parity is validated before adding mobile
- SSH capability benefits desktop users immediately (Phase 2)
- Mobile is the lightest phase because UI and backend already exist

### Phased Plan

```
Phase 1: Tauri Desktop Foundation (8-10 weeks)
├── T1.1  Initialize Tauri v2 + migrate React frontend
├── T1.2  Rust SQLite with 17-table schema
├── T1.3  Type-safe IPC (TauRPC/rspc)
├── T1.4  Task CRUD commands (Kanban works)
├── T1.5  Project, Sprint, Epic commands
├── T1.6  PTY + tmux services in Rust
├── T1.7  Hook listener HTTP server (axum)
├── T1.8  Git service in Rust
├── T1.9  Chat CLI + Planning services in Rust
├── T1.10 Feature parity validation ← GATE
│
Phase 2: Remote Project Support (4-6 weeks)
├── T2.1  Rust SSH client (russh) + key management
├── T2.2  Remote connection management UI
├── T2.3  Remote project discovery
├── T2.4  Remote tmux session attachment
├── T2.5  Remote file operations (artifacts, diffs)
├── T2.6  Remote hook event forwarding
├── T2.7  Local/remote project switcher
├── T2.8  Remote feature parity validation ← GATE
│
Phase 3: Mobile Targets (4-6 weeks)
├── T3.1  Add Android + iOS build targets
├── T3.2  Responsive layout + mobile navigation
├── T3.3  Touch-optimized Kanban interactions
├── T3.4  Mobile SSH connection flow
├── T3.5  Mobile terminal view
├── T3.6  Mobile review and approval flow
├── T3.7  Mobile chat with planning agents
├── T3.8  Mobile platform validation ← GATE
│
Phase 4: CI/CD and Build Pipeline (2-3 weeks)
├── T4.1  Desktop build pipeline (macOS, Linux, Windows)
├── T4.2  Android build pipeline
├── T4.3  iOS build pipeline
├── T4.4  Auto-update for desktop
```

### Effort, Risk, and Timeline

| Dimension | Assessment |
|-----------|------------|
| **Total effort** | 18–25 weeks (4.5–6 months) |
| **Risk level** | Medium — mitigated by phase gates |
| **Key risk** | Tauri mobile maturity (mitigated: mobile is remote-only, reducing PTY dependency) |
| **Timeline impact** | Significant — but no timeline pressure confirmed |
| **What's preserved** | All React frontend code, UX design, product vision |
| **What's lost** | 12 KMP stories (sunk cost), Electron backend (rewritten) |
| **What's gained** | 5-platform support, SSH/remote projects, single codebase, smaller binaries |

---

## Section 4: Detailed Change Proposals

### 4.1 Epic Changes

**Supersede KMP Mobile Epics (7 epics, 31 stories):**
All Mobile Epics 1–7 marked as `superseded` in epics.md and sprint-status.yaml with reference to this change proposal.

**Defer Electron-only Backlog Epics (2 epics, 18 stories):**
TES Epic 5 (Workflow Automation) and Epic 6 (Agent Monitoring) status changed from `backlog`/`superseded` to `deferred` — to be implemented directly in Rust after Phase 1.

**Add Tauri Migration Epics (4 epics, 30 stories):**
- Tauri Epic 1: Desktop Foundation & React Migration (10 stories)
- Tauri Epic 2: Remote Project Support via SSH (8 stories)
- Tauri Epic 3: Mobile Targets — Android + iOS (8 stories)
- Tauri Epic 4: CI/CD and Build Pipeline (4 stories)

### 4.2 PRD Changes

- Executive Summary: Add multi-platform and SSH language
- MVP Architecture: Update to Tauri v2 + Rust, add remote project support
- Technology Stack: Replace Electron/Node.js references with Tauri/Rust stack
- Post-MVP: Move mobile from Phase 3 to MVP
- New FRs: FR54–FR61 for SSH and remote project support
- Risk Mitigation: Add Tauri mobile maturity and Rust rewrite risks

### 4.3 Architecture Changes

- Full rewrite of backend sections (starter template, tech stack, IPC, database, services)
- New SSH & Remote Project Architecture section
- Updated project structure (src-tauri/ replaces src/main/)
- Frontend sections preserved (React, Tailwind, shadcn, xterm.js, Monaco)
- **Recommendation:** Dedicated Architect agent session post-approval

### 4.4 Project Context Changes

- Technology stack table rewritten for Tauri/Rust
- Process boundary rules updated (Tauri invoke replaces tRPC)
- File organization updated
- Testing section updated (cargo test + Vitest, no native module rebuild dance)
- **Recommendation:** Dedicated Architect agent session post-approval

### 4.5 UX Design Changes

- Add mobile-responsive layouts and touch interaction patterns
- Add bottom tab navigation for mobile
- Add SSH connection management UI patterns
- Desktop UX unchanged

---

## Section 5: Implementation Handoff

### Scope Classification: Major

This is a fundamental replan requiring PM and Architect involvement.

### Handoff Plan

| Role | Responsibility | Deliverable |
|------|---------------|-------------|
| **Product Manager** | Update PRD with approved changes (FR54–FR61, tech stack, risk table, scope) | Updated prd.md |
| **Architect** | Rewrite architecture backend sections, add SSH architecture, update project-context.md | Updated architecture.md, project-context.md |
| **UX Designer** | Design mobile-responsive layouts, touch patterns, SSH connection flow | Updated ux-design-specification.md |
| **Scrum Master** | Update sprint-status.yaml, create Tauri epic entries, run sprint planning | Updated sprint-status.yaml |
| **Developer** | Execute Phase 1 stories (Tauri foundation) | Working Tauri desktop app |

### Execution Order

1. **Architect** rewrites architecture.md and project-context.md (blocking — dev needs this)
2. **PM** updates prd.md (can parallel with Architect)
3. **UX Designer** adds mobile patterns (can parallel, needed before Phase 3)
4. **SM** updates sprint-status.yaml and runs sprint planning (after Architect done)
5. **Dev** begins Phase 1, Story T1.1

### Success Criteria

- [ ] Phase 1 Gate: Tauri desktop app matches Electron feature-for-feature
- [ ] Phase 2 Gate: Can SSH to remote machine and manage a project
- [ ] Phase 3 Gate: App runs on Android + iOS with remote project support
- [ ] Phase 4 Gate: Automated builds for all 5 platforms
- [ ] All existing React frontend tests pass in Tauri webview
- [ ] All Rust backend services have cargo test coverage
