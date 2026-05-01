---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-04-12'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-task-execution-sandbox.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md
---

# TinSu - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TinSu's Tauri v2 migration, decomposing the requirements from the PRD, TES PRD, UX Design Specification, Architecture, and Sprint Change Proposal into implementable stories organized across 4 phased Tauri epics.

## Requirements Inventory

### Functional Requirements

**Board & Task Management (FR1-FR6):**
- FR1: Founder can view a Kanban board with five columns (Backlog, Create Story, In Progress, Review, Done)
- FR2: Founder can drag tasks between columns to change their status
- FR3: Founder can create new tasks (stories) with title, description, and acceptance criteria
- FR4: Founder can organize tasks into a Sprint/Epic/Story hierarchy
- FR5: Founder can view task velocity metrics (tasks completed per week)
- FR6: Founder can filter and view tasks by sprint, epic, or status

**Agent Execution (FR7-FR11):**
- FR7: Founder can start agent execution by moving a task to In Progress
- FR8: System spawns Claude Code CLI with story context automatically loaded
- FR9: Founder can view real-time terminal output from the agent in an embedded view
- FR10: System automatically moves task to Review when agent completes execution
- FR11: Founder can add context notes to a story that the agent will receive on execution

**Agent Monitoring & Control (FR12-FR16):**
- FR12: System detects when an agent has stalled (no progress for configurable threshold)
- FR13: Founder can see visual indicator when agent is stalled (yellow status)
- FR14: Founder can pause a running agent mid-execution
- FR15: Founder can resume a paused agent with preserved context
- FR16: Founder can view agent reasoning logs to understand decisions

**Review & Approval (FR17-FR21):**
- FR17: Founder can view a diff of all changes made by the agent
- FR18: Founder can approve changes, which triggers merge and task completion
- FR19: Founder can reject changes with feedback, returning task to In Progress
- FR20: Founder can request changes with inline comments, returning task to agent
- FR21: System re-executes agent with rejection feedback as additional context

**Git & Version Control (FR22-FR27):**
- FR22: System creates a git worktree for each task moved to In Progress
- FR23: System creates a branch following naming convention (tinsu/story-{id}-{slug})
- FR24: Agent executes within isolated worktree to prevent conflicts
- FR25: System merges worktree branch to main on task approval
- FR26: System deletes worktree after successful merge
- FR27: System detects merge conflicts and surfaces them to founder for resolution

**Project Configuration (FR28-FR31):**
- FR28: Founder can select methodology (BMAD Method or TaskMaster) per project
- FR29: Founder can configure project settings via YAML file
- FR30: System reads story definitions from markdown/YAML files
- FR31: Founder can initialize TinSu in an existing git repository

**Data Persistence (FR32-FR35):**
- FR32: System persists task state, status, and timestamps in SQLite database
- FR33: System stores agent run history (start time, duration, token usage, exit status)
- FR34: System maintains searchable index of agent logs
- FR35: System preserves human-readable project config in version-controlled YAML

**Planning Workspace (FR36-FR38):**
- FR36: Founder can open a Planning Workspace with BMAD workflow steps displayed in a sidebar
- FR37: Founder can select an agent persona (PM, Architect, UX Designer, Dev, QA, or custom) for each chat session
- FR38: Founder can send messages to an agent and receive responses in a chat interface with message bubbles

**Planning Chat Session Management (FR39-FR43):**
- FR39: System creates a persistent, isolated terminal session for each new chat conversation
- FR40: System provides a bidirectional communication channel for sending messages to and receiving output from agent sessions
- FR41: System launches the agent process with unique session identity and persona context pre-loaded
- FR42: System routes agent lifecycle events (completion, tool use, permission requests, notifications) to the correct chat session without cross-session leakage
- FR43: System persists assistant responses and tool activity for retrieval and display in the chat interface

**Concurrent Agent Support (FR44-FR47):**
- FR44: Founder can run multiple chat sessions simultaneously across different agent personas, each in an independent persistent session
- FR45: Founder can switch between active chat sessions without interrupting background agent work
- FR46: System displays a session list with live status indicators (thinking, idle, completed, exited) reflecting the agent session state
- FR47: Founder can view and resume any previous chat session from the session list

**Multi-Project Session Scoping (FR48-FR50):**
- FR48: Chat sessions are scoped to a project — each session records its project_id and only appears in that project's session list
- FR49: Founder can run concurrent chat sessions across different projects without cross-project interference
- FR50: System confines each agent session's file operations to the target project directory, ensuring project isolation

**Planning Chat Persistence (FR51-FR53):**
- FR51: Chat sessions persist across app restarts — founder can resume conversations without context loss
- FR52: System validates chat session health on startup, marking unavailable sessions for re-creation on next message
- FR53: System monitors agent session health and updates session status within 2 seconds of a session becoming unavailable

**TES: Terminal Session Management (TES FR1-FR9):**
- TES FR1: User can view a dedicated terminal session for each task
- TES FR2: User can navigate away from a task and return to find the terminal session still active
- TES FR3: User can type commands directly into a task's terminal
- TES FR4: User can scroll through the complete terminal history (scrollback)
- TES FR5: System can create a new terminal session when a task moves to In Progress
- TES FR6: System can send commands to a task's terminal without user being attached
- TES FR7: System can detect when a terminal session ends or becomes unresponsive
- TES FR8: User can view terminal sessions that survive app restart
- TES FR9: User can view terminal sessions that survive system reboot

**TES: Activity Logging (TES FR10-FR20):**
- TES FR10: System can capture status change events for each task
- TES FR11: System can capture agent start events when Claude Code begins work
- TES FR12: System can capture agent complete events when Claude Code finishes responding
- TES FR13: System can capture tool usage events (file edits, bash commands, git operations)
- TES FR14: System can capture user command events when user types in terminal
- TES FR15: System can capture automation trigger events when workflows auto-execute
- TES FR16: System can capture error events when agents or hooks fail
- TES FR17: User can view the activity log for a specific task
- TES FR18: User can filter the activity log by event type
- TES FR19: User can see activity events in real-time as they occur
- TES FR20: User can see timestamps for each activity event

**TES: Task Detail View (TES FR21-FR25):**
- TES FR21: User can view task details in a full-screen 3-column workspace with resizable columns (Content, Terminal+Activities, Diff) optimized for editing, monitoring, and code review
- TES FR22: User can resize column widths via drag handles, with preferences persisted to localStorage
- TES FR23: User can view task description and acceptance criteria in Content tab
- TES FR24: User can switch between different tasks while preserving each task's state
- TES FR25: User can have multiple tasks open simultaneously (10+ concurrent)

**TES: Diff Viewer (TES FR26-FR29):**
- TES FR26: User can view git diff of changes made by the agent
- TES FR27: User can see which files were added, modified, or deleted
- TES FR28: User can view side-by-side or unified diff format
- TES FR29: User can see the scope of changes at a glance (file count, line count)

**TES: Workflow Automation (TES FR30-FR38):**
- TES FR30: System can differentiate between Story tasks and Basic tasks
- TES FR31: System can auto-execute dev-story command when Story task moves to In Progress
- TES FR32: System can auto-move Story task to Review when dev-story completes
- TES FR33: System can auto-execute code-review command when Story task enters Review
- TES FR34: System can auto-execute Claude Code with task description when Basic task moves to In Progress
- TES FR35: System can notify user when code-review is complete and ready for review
- TES FR36: User can manually trigger code-review via button (fallback)
- TES FR37: User can manually trigger any workflow command via button
- TES FR38: System can track current workflow phase for each task (dev-story, code-review, user-feedback)

**TES: Scrollback Persistence (TES FR39-FR44):**
- TES FR39: System can backup terminal scrollback to filesystem
- TES FR40: System can restore terminal scrollback from backup when session is recreated
- TES FR41: System can backup scrollback on status change
- TES FR42: System can backup scrollback periodically (every 5 minutes while active)
- TES FR43: System can backup scrollback on app shutdown
- TES FR44: User can view scrollback even after system reboot

**TES: Session-Task Mapping (TES FR45-FR47):**
- TES FR45: System can associate Claude Code session ID with task ID
- TES FR46: System can route hook events to correct task based on session ID
- TES FR47: System can rebuild session-task mapping from existing terminal sessions on app restart

### NonFunctional Requirements

**Performance (NFR1-NFR7):**
- NFR1: Kanban board interactions (drag, click, navigation) complete in <100ms
- NFR2: Board loads with full task list in <1 second
- NFR3: UI main thread event loop latency remains below 50ms during agent execution
- NFR4: Agent terminal output streams to UI with <500ms latency
- NFR5: Terminal view renders agent output at up to 1000 lines/second with no more than 5% frame loss
- NFR6: SQLite queries for task list views complete in <200ms
- NFR7: Task state changes persist immediately (no visible delay)

**Reliability (NFR8-NFR16):**
- NFR8: Agent stall detection triggers within configured threshold (default: 5 minutes of no output)
- NFR9: Pause/Resume commands execute within 1 second
- NFR10: System recovers gracefully from Claude Code CLI crashes without data loss
- NFR11: No task data is lost if application is force-quit during agent execution
- NFR12: Worktree creation/deletion succeeds or fails cleanly (no partial states)
- NFR13: Merge conflicts are detected before corrupting main branch
- NFR14: Git operations provide clear error messages on failure
- NFR15: SQLite database maintains ACID properties
- NFR16: Application can recover from unexpected shutdown without database corruption

**Integration (NFR17-NFR24):**
- NFR17: System detects if Claude Code CLI is not installed and provides clear error
- NFR18: Context injection works with story files up to 50KB
- NFR19: PTY integration works on macOS and Linux
- NFR20: System detects if git is not initialized and provides clear error
- NFR21: Worktree operations work with repositories up to 10GB
- NFR22: Branch operations complete within 5 seconds for typical repositories
- NFR23: System handles story files with special characters in filenames
- NFR24: YAML/Markdown parsing provides clear error messages on invalid syntax

**Planning Chat (NFR25-NFR32):**
- NFR25: System supports at least 5 concurrent chat tmux sessions without degradation
- NFR26: Switching between chat sessions completes in <500ms
- NFR27: Background chat sessions experience zero message loss and no added processing latency >1 second
- NFR28: Chat tmux sessions survive app restart with zero context loss
- NFR29: Startup validation of chat tmux sessions completes in <5 seconds for up to 20 sessions
- NFR30: Hook events from concurrent chat sessions are routed to the correct session with 100% accuracy
- NFR31: Chat tmux session creation completes in <15 seconds
- NFR32: Stale session detection updates UI status within one polling interval (2 seconds)

**TES Performance:**
- TES NFR-P1: Activity log event latency <1 second
- TES NFR-P2: Activity log filter/search <1 second
- TES NFR-P3: Terminal streaming latency <500ms
- TES NFR-P4: Terminal scrollback load <2 seconds
- TES NFR-P5: Automation trigger latency <5 seconds
- TES NFR-P6: Tab switching <200ms
- TES NFR-P7: Concurrent task support 10+ tasks
- TES NFR-P8: UI responsiveness — no jank during background terminal activity

**TES Reliability:**
- TES NFR-R1: Terminal persistence (app restart) 100%
- TES NFR-R2: Terminal persistence (system reboot) 100%
- TES NFR-R3: Activity log integrity — zero event loss
- TES NFR-R4: Automation success rate 99%+
- TES NFR-R5: Hook event delivery 99%+
- TES NFR-R6: Scrollback backup success 100%
- TES NFR-R7: Session-task mapping integrity 100%
- TES NFR-R8: Graceful degradation if tmux unavailable

### Additional Requirements

**From Architecture — Starter Template:**
- Architecture specifies `create-tauri-app` React+TS with migration overlay (Option B: add Tauri to existing project)
- First story (T1.1) should initialize Tauri in the existing project and validate React frontend renders in Tauri's webview

**From Architecture — Technology Stack:**
- Tauri v2.10.3 runtime with Rust + tokio async backend
- SeaORM + SQLite replacing Drizzle + better-sqlite3 (port all 17 tables faithfully)
- rspc for type-safe IPC replacing tRPC (router-based, React Query integration)
- Tauri Channels for PTY streaming (high throughput, byte-level)
- Tauri Events for activity/status/hook notifications (multi-listener, fire-and-forget)
- portable-pty 0.9.0 for cross-platform PTY
- axum 0.8.8 for Claude Code hook listener HTTP server
- `tracing` crate for structured logging (replaces console.log)
- `keyring` crate for OS keychain SSH key storage (Phase 2)
- russh 0.54.6 for async SSH client (Phase 2)

**From Architecture — Frontend Migration:**
- Flatten `src/renderer/src/` to `src/` (standard Vite structure)
- Delete `src/main/` (replaced by `src-tauri/src/`)
- Delete `src/preload/` (replaced by rspc + Tauri invoke)
- Migrate tRPC hooks to rspc hooks (find-and-replace pattern)
- Migrate tRPC subscriptions to Tauri Event listeners

**From Architecture — Implementation Sequence:**
1. Initialize Tauri v2, validate React renders in webview
2. Set up SeaORM with SQLite, port 17-table schema
3. Set up rspc router, register Tauri commands
4. Migrate frontend hooks from tRPC to rspc
5. Implement Rust services (task, sprint, epic CRUD)
6. Implement PTY service with portable-pty + Tauri Channels
7. Implement tmux service, hook listener (axum)
8. Implement git service
9. Implement chat CLI service
10. Feature parity validation (Phase 1 gate)

**From Sprint Change Proposal — Phase Structure:**
- Phase 1: Tauri Desktop Foundation (8-10 weeks) — 10 stories
- Phase 2: Remote Project Support via SSH (4-6 weeks) — 8 stories
- Phase 3: Mobile Foundation — Build Targets (T3.1 only retained) — 1 story kept; T3.2–T3.8 superseded 2026-04-30
- Phase 3.5: Mobile UX Native Redesign (5-6 weeks) — 9 stories (added 2026-04-30 via sprint-change-proposal-2026-04-30.md)
- Phase 4: CI/CD and Build Pipeline (2-3 weeks) — 4 stories
- Phase gates at end of each phase for validation

### UX Design Requirements

- UX-DR1: Implement "Calm Command" dark color system with 8 base tokens (`--background` #0a0a0b, `--card` #18181b, `--card-hover` #27272a, `--border` #27272a, `--primary` #3b82f6, `--primary-hover` #2563eb, `--text` #fafafa, `--text-muted` #a1a1aa) + 4 status tokens (`--status-running` #22c55e, `--status-stalled` #f59e0b, `--status-review` #8b5cf6, `--status-done` #6b7280) + 3 semantic tokens (`--success` #22c55e, `--warning` #f59e0b, `--destructive` #ef4444) as CSS variables
- UX-DR2: Implement typography system with Inter/system font for UI and JetBrains Mono for terminal/code, 6-level type scale (h1 24px/600, h2 18px/600, h3 14px/500, body 14px/400, small 12px/400, mono 13px/400)
- UX-DR3: Implement 4px grid spacing system with 5 space tokens (xs 4px, sm 8px, md 16px, lg 24px, xl 32px)
- UX-DR4: Implement AgentStatusBadge component with 6 variants (Idle/gray/circle, Running/green/spinner, Stalled/yellow/warning, Review/purple/eye, Done/green/check, Error/red/X) using icon + color (not color alone)
- UX-DR5: Implement keyboard-first navigation with shortcuts: A (approve), R (reject), Enter (open), Escape (close), Space (pause/resume), arrows (navigate), ? (show shortcuts)
- UX-DR6: Implement WCAG AA accessibility: 2px focus rings on all interactive elements, ARIA roles (application/listbox/option/log/dialog), live regions for toasts (polite) and status (assertive), `prefers-reduced-motion` support, color independence (icon + color)
- UX-DR7: Implement responsive layout: desktop 1024px+ (5-column board + docked terminal), tablet 768-1023px (2-column swipe), mobile 320-767px (single card + bottom action bar)
- UX-DR8: Implement 3-column task workspace: Content ~30%, Terminal+Activities ~25%, Diff ~45%, with resizable drag handles, 150px minimum column width, vertical split in center column (Terminal 60%/Activities 40%)
- UX-DR9: Implement activity log with real-time streaming, 7 event types (status_change, agent_start, agent_complete, tool_used, user_command, automation_trigger, error) with distinct icons/colors, chip-style multi-select filter toggles
- UX-DR10: Implement diff viewer with Monaco Editor diff component, collapsible file tree with change indicators (Modified/yellow, Added/green, Deleted/red, Renamed/blue), unified/split view toggle, summary bar (file count, lines added/removed)
- UX-DR11: Implement task-type visual differentiation: Story tasks get "Story" badge + `--status-review` bg + workflow indicator + "Auto" icon; Basic tasks get "Task" badge + `--text-muted` bg + no workflow indicator
- UX-DR12: Implement workflow phase indicators: Initializing (gray pulse), dev-story (green pulse), Awaiting Review (purple), code-review (purple pulse), Ready for User (purple solid check)
- UX-DR13: Implement toast notification system: 4 types (Success/green/3s, Error/red/5s sticky, Warning/yellow/4s, Info/blue/3s), bottom-right position, stack up to 3, <60 chars
- UX-DR14: Implement slide-over review panel: 400px from right edge, overlay on board, ESC to close, focus trap, keyboard shortcuts A/R
- UX-DR15: Implement z-index hierarchy: Base 0 (board), Dropdown 50 (menus), Dock 100 (terminal), Overlay 200 (sheet), Modal 300 (dialogs), Toast 400 (notifications), Command 500 (palette)

### FR Coverage Map

**Epic 1: Desktop Foundation & React Migration**
- FR1-FR6: Board & Task Management
- FR7-FR11: Agent Execution
- FR12-FR16: Agent Monitoring & Control
- FR17-FR21: Review & Approval
- FR22-FR27: Git & Version Control
- FR28-FR31: Project Configuration
- FR32-FR35: Data Persistence
- FR36-FR38: Planning Workspace
- FR39-FR43: Planning Chat Session Management
- FR44-FR47: Concurrent Agent Support
- FR48-FR50: Multi-Project Session Scoping
- FR51-FR53: Planning Chat Persistence
- FR61: Cross-platform codebase (Tauri v2 init)
- TES FR1-FR9: Terminal Session Management
- TES FR10-FR20: Activity Logging
- TES FR21-FR25: Task Detail View
- TES FR26-FR29: Diff Viewer
- TES FR30-FR38: Workflow Automation
- TES FR39-FR44: Scrollback Persistence
- TES FR45-FR47: Session-Task Mapping
- NFR1-NFR32, NFR37, TES NFRs
- UX-DR1-DR15

**Epic 2: Remote Project Support via SSH**
- FR54: SSH connection profile management
- FR55: SSH key generation + OS keychain storage
- FR56: Remote project discovery
- FR57: Remote tmux session attachment
- FR58: Remote file operations (SFTP)
- FR59: Remote hook event forwarding
- FR60: Local/remote project switcher
- NFR33-NFR36

**Epic 3: Mobile Foundation (Build Targets)**
- T3.1 only: Android + iOS Tauri build target initialization
- (T3.2–T3.8 superseded 2026-04-30; replaced by Epic 3.5)

**Epic 3.5: Mobile UX Native Redesign**
- Mobile-native delivery of FR1-FR60 via parallel UI tree at `src/mobile/`
- UX-DR1–UX-DR15 carry over (Calm Command tokens, typography, spacing)
- NFR38-NFR39

**Epic 4: CI/CD and Build Pipeline**
- FR61: Cross-platform build automation
- NFR37: Binary size validation
- Desktop, Android, iOS build pipelines + auto-update

## Epic List

### Epic 1: Desktop Foundation & React Migration
Founder can use TinSu on desktop via Tauri v2 with full feature parity — Kanban board with drag-and-drop, AI agent execution via tmux/PTY, review workflow with diff view, planning workspace with concurrent chat sessions, activity logging, workflow automation, and all existing capabilities work identically to the Electron version. This epic delivers the complete Rust backend rewrite (SeaORM, rspc, portable-pty, axum) while preserving the entire React frontend.
**FRs covered:** FR1-FR53, FR61 (init), TES FR1-FR47
**NFRs:** NFR1-NFR32, NFR37, all TES NFRs
**UX-DRs:** UX-DR1-DR15
**Stories:** 10

### Epic 2: Remote Project Support via SSH
Founder can connect to a remote machine via SSH and manage projects remotely — add/test SSH connections, generate and securely store SSH keys, discover projects on remote machines, attach to remote tmux sessions for agent execution, read/write remote files, receive forwarded hook events, and seamlessly switch between local and remote projects using a unified project switcher.
**FRs covered:** FR54-FR60
**NFRs:** NFR33-NFR36
**Stories:** 8

### Epic 3: Mobile Foundation (Build Targets)
Restructured 2026-04-30 via sprint-change-proposal-2026-04-30.md. Original T3.2–T3.8 (responsive UI approach) superseded. Only T3.1 (Android + iOS Tauri build target initialization) is retained as foundation reused by Epic 3.5.
**FRs covered:** Build target init only
**NFRs:** NFR38 (mobile launch), NFR39 (frontend parity in mobile webviews) deferred to Epic 3.5
**Stories:** 1 retained (T3.1); 7 superseded (T3.2–T3.8)

### Epic 3.5: Mobile UX Native Redesign
Founder uses TinSu on Android and iOS via a mobile-native UI tree at `src/mobile/` with full feature parity — kanban, planning workspace, task workspace, review, SSH, activity feed. Replaces the responsive single-tree approach. Reuses Rust backend, domain stores, rspc hooks, and Calm Command design tokens unchanged.
**FRs covered:** Mobile-native delivery of FR1-FR60
**NFRs:** NFR38-NFR39
**UX-DRs:** UX-DR1–UX-DR15 (carry over via mobile primitives)
**Design plan:** `_bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md`
**Stories:** 9

### Epic 4: CI/CD and Build Pipeline
Automated builds and distribution for all 5 platforms — GitHub Actions workflows for desktop builds (macOS .dmg, Linux .AppImage/.deb, Windows .msi), Android builds (.apk/.aab), iOS builds (.ipa), and desktop auto-update mechanism. Enables professional distribution and continuous integration testing.
**FRs covered:** FR61 (build automation)
**NFRs:** NFR37 (binary size)
**Stories:** 4

---

## Epic 1: Desktop Foundation & React Migration

Founder can use TinSu on desktop via Tauri v2 with full feature parity — Kanban board with drag-and-drop, AI agent execution via tmux/PTY, review workflow with diff view, planning workspace with concurrent chat sessions, activity logging, workflow automation, and all existing capabilities work identically to the Electron version.

### Story T1.1: Initialize Tauri v2 and Migrate React Frontend

As a founder,
I want TinSu to launch as a Tauri desktop application with my existing React UI visible,
So that I can verify the migration foundation works before backend services are built.

**Acceptance Criteria:**

**Given** the existing React project with 50+ components, hooks, stores, and shadcn/ui
**When** I run `npm run tauri dev`
**Then** a native Tauri window opens displaying the React frontend with HMR working
**And** the `src-tauri/` directory is created with Cargo.toml, tauri.conf.json, and capabilities
**And** the frontend directory is flattened from `src/renderer/src/` to `src/`
**And** `src/main/` (Node.js backend) and `src/preload/` are removed
**And** all existing React components render without errors in the Tauri webview
**And** Tailwind CSS, shadcn/ui, and all web-based libraries (xterm.js, Monaco, @dnd-kit) load correctly
**And** `npm run tauri build` produces a desktop binary under 30MB (NFR37)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.2: Rust SQLite Database with SeaORM Schema

As a founder,
I want all my project data (tasks, sprints, epics, agent runs, sessions) persisted in a Rust-managed SQLite database,
So that the Tauri app has the same data layer as the Electron version without Node.js.

**Acceptance Criteria:**

**Given** the existing 17-table Drizzle schema
**When** the Tauri app starts for the first time
**Then** SeaORM creates all 17 tables with identical column names, types, and foreign keys
**And** sea-orm-migration runs automatically on startup
**And** entity definitions exist for: project, sprint, epic, task, agent_run, task_activity, task_session, chat_session, chat_message, chat_message_attachment, app_settings, log_entry (and remaining tables)
**And** the database file is created at `data/tinsu.db`
**And** SQLite queries for task list views complete in <200ms (NFR6)
**And** the database maintains ACID properties (NFR15)
**And** `cargo test` validates schema creation and basic CRUD for all entities

### Story T1.3: Type-Safe IPC with rspc Router

As a founder,
I want the React frontend to communicate with the Rust backend through type-safe procedures,
So that I get the same developer experience as tRPC with automatic TypeScript type generation.

**Acceptance Criteria:**

**Given** SeaORM entities from T1.2 and the existing React frontend
**When** the rspc router is initialized in `src-tauri/src/lib.rs`
**Then** the root router merges sub-routers for: task, agent, review, git, config, activity, sprint, chat
**And** `@rspc/tauri` bridges rspc to Tauri invoke
**And** `@rspc/react` provides TanStack Query hooks in the frontend
**And** Specta auto-generates TypeScript types matching Rust structs
**And** `src/lib/rspc.ts` replaces `src/lib/trpc.ts` as the client setup
**And** AppError enum with variants (NotFound, BadRequest, Internal, Database) is defined with `thiserror` + `specta::Type`
**And** at least one query (`getTask`) and one mutation (`createTask`) work end-to-end as proof of the IPC pipeline
**And** `cargo test` validates router initialization and procedure registration

### Story T1.4: Task CRUD and Kanban Board Operations

As a founder,
I want to create, view, drag, and manage tasks on my Kanban board powered by the Rust backend,
So that the core Kanban workflow works in the Tauri app.

**Acceptance Criteria:**

**Given** rspc router and SeaORM from T1.2-T1.3
**When** I open the Kanban board
**Then** all 5 columns render (Backlog, Create Story, In Progress, Review, Done) (FR1)
**And** I can drag tasks between columns with <100ms response (FR2, NFR1)
**And** I can create new tasks with title, description, and acceptance criteria (FR3)
**And** task state changes persist immediately to SQLite (NFR7)
**And** the board loads with full task list in <1 second (NFR2)
**And** existing tRPC hooks for task operations are migrated to rspc hooks
**And** task status badge shows correct state (Idle, Running, Stalled, Review, Done) (UX-DR4)
**And** task-type visual differentiation works (Story vs Basic badges) (UX-DR11, TES FR30)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.5: Project, Sprint, and Epic Management

As a founder,
I want to organize tasks into sprints and epics, configure project settings, and manage the full hierarchy,
So that I can structure my work using BMAD Method or TaskMaster methodology.

**Acceptance Criteria:**

**Given** task CRUD from T1.4
**When** I use the sidebar and project management features
**Then** I can organize tasks into a Sprint/Epic/Story hierarchy (FR4)
**And** I can view task velocity metrics (tasks completed per week) (FR5)
**And** I can filter and view tasks by sprint, epic, or status (FR6)
**And** I can select methodology (BMAD Method or TaskMaster) per project (FR28)
**And** I can configure project settings via YAML file (FR29)
**And** the system reads story definitions from markdown/YAML files (FR30)
**And** I can initialize TinSu in an existing git repository (FR31)
**And** project config is preserved in version-controlled YAML (FR35)
**And** sprint/epic rspc procedures replace tRPC equivalents

### Story T1.6: PTY and tmux Terminal Services in Rust

As a founder,
I want to see real-time terminal output from AI agents in an embedded terminal view powered by Rust PTY,
So that I can watch agents work and interact with them directly.

**Acceptance Criteria:**

**Given** the Tauri app with task management from T1.4-T1.5
**When** a task moves to In Progress
**Then** the system creates a tmux session (`tinsu-task-{id}`) (TES FR5)
**And** portable-pty spawns and attaches to the tmux session
**And** terminal output streams to xterm.js via Tauri Channels with <500ms latency (NFR4)
**And** the user can type commands directly into the terminal (TES FR3)
**And** terminal sessions survive navigation between tasks (TES FR2)
**And** terminal sessions survive app restart (TES FR8)
**And** scrollback is backed up to filesystem periodically and on status change (TES FR39-FR43)
**And** scrollback restores after system reboot (TES FR9, TES FR44)
**And** the system detects when a terminal session ends or becomes unresponsive (TES FR7)
**And** the 3-column task workspace renders (Content, Terminal+Activities, Diff) with resizable columns (TES FR21-FR22, UX-DR8)
**And** Story tasks auto-execute dev-story command on In Progress (TES FR31)
**And** Basic tasks auto-execute Claude Code with description on In Progress (TES FR34)
**And** Pause/Resume commands execute within 1 second (NFR9, FR14-FR15)
**And** stall detection triggers after configurable threshold (FR12-FR13, NFR8)
**And** the system supports 10+ concurrent task terminals (TES NFR-P7)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.7: Hook Listener and Activity Logging

As a founder,
I want Claude Code hook events (completion, tool use, errors) to be captured and displayed as a real-time activity log,
So that I can debug agent behavior and see a complete audit trail for each task.

**Acceptance Criteria:**

**Given** tmux/PTY services from T1.6
**When** Claude Code hooks fire during agent execution
**Then** axum HTTP server receives hook POST events on localhost (TES FR46)
**And** events are routed to the correct task based on session-task mapping (TES FR45-FR46)
**And** all 7 event types are captured: status_change, agent_start, agent_complete, tool_used, user_command, automation_trigger, error (TES FR10-FR16)
**And** events are stored in task_activities table with append-only integrity (TES NFR-R3)
**And** the activity log streams events in real-time via Tauri Events (TES FR19)
**And** the activity log UI shows filterable events with chip-style toggles (TES FR17-FR18, UX-DR9)
**And** timestamps display for each event (TES FR20)
**And** hook events from concurrent sessions route with 100% accuracy (NFR30)
**And** Story tasks auto-move to Review when dev-story completes (TES FR32)
**And** Story tasks auto-trigger code-review on Review entry (TES FR33)
**And** user is notified when code-review is complete (TES FR35)
**And** manual trigger buttons work as fallback (TES FR36-FR37, UX-DR12)
**And** session-task mapping rebuilds on app restart (TES FR47)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.8: Git Service — Worktrees, Branches, and Review

As a founder,
I want each task to execute in an isolated git worktree with automatic merge on approval,
So that multiple agents can work in parallel without conflicts, and I can review and approve changes safely.

**Acceptance Criteria:**

**Given** task execution via tmux/PTY from T1.6
**When** a task moves to In Progress
**Then** the system creates a git worktree with branch `tinsu/story-{id}-{slug}` (FR22-FR23)
**And** the agent executes within the isolated worktree (FR24)
**And** I can view a diff of all changes via Monaco Editor in the Diff tab (FR17, TES FR26-FR29, UX-DR10)
**And** the diff viewer shows file tree with change indicators (Modified/Added/Deleted/Renamed)
**And** I can approve changes, which merges the worktree branch to main (FR18, FR25)
**And** I can reject changes with feedback, returning the task to In Progress (FR19-FR21)
**And** the system deletes the worktree after successful merge (FR26)
**And** merge conflicts are detected and surfaced to the founder (FR27, NFR13)
**And** worktree creation/deletion succeeds or fails cleanly — no partial states (NFR12)
**And** the review panel slides over from right (400px) with A/R keyboard shortcuts (UX-DR14)
**And** git operations provide clear error messages on failure (NFR14)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.9: Planning Workspace and Chat Services

As a founder,
I want to collaborate with AI agents (PM, Architect, UX Designer, Dev) through concurrent chat sessions in a Planning Workspace,
So that I can plan features with specialized agents without leaving TinSu.

**Acceptance Criteria:**

**Given** tmux/PTY and hook services from T1.6-T1.7
**When** I open the Planning Workspace
**Then** BMAD workflow steps display in a sidebar (FR36)
**And** I can select an agent persona for each chat session (FR37)
**And** I can send messages and receive responses in a chat interface (FR38)
**And** each chat creates a persistent tmux session (`tinsu-chat-{sessionId}`) (FR39)
**And** bidirectional communication works via PTY I/O channel (FR40)
**And** the agent launches with unique session identity and persona context (FR41)
**And** lifecycle events route to the correct session without leakage (FR42)
**And** assistant responses and tool activity persist for display (FR43)
**And** I can run 5+ concurrent chat sessions without degradation (FR44, NFR25)
**And** switching between sessions completes in <500ms (FR45, NFR26)
**And** the session list shows live status indicators (thinking, idle, completed, exited) (FR46)
**And** I can resume previous sessions (FR47)
**And** sessions are scoped to projects (FR48-FR50)
**And** sessions persist across app restart (FR51, NFR28)
**And** session health is validated on startup (FR52, NFR29)
**And** stale sessions update UI status within 2 seconds (FR53, NFR32)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T1.10: Feature Parity Validation (Phase 1 Gate)

As a founder,
I want to verify that the Tauri desktop app matches the Electron app feature-for-feature,
So that I can confidently retire the Electron version and proceed to Phase 2.

**Acceptance Criteria:**

**Given** all T1.1-T1.9 stories are complete
**When** I run the Tauri desktop app through a full workflow
**Then** the Kanban board with drag-and-drop works identically to Electron (FR1-FR6)
**And** agent execution with terminal streaming works (FR7-FR11)
**And** stall detection, pause/resume work (FR12-FR16)
**And** review with diff view and approve/reject works (FR17-FR21)
**And** git worktrees with merge on approve work (FR22-FR27)
**And** project configuration and methodology selection work (FR28-FR31)
**And** data persistence in SQLite works (FR32-FR35)
**And** planning workspace with concurrent chat sessions works (FR36-FR53)
**And** activity logging with all 7 event types works (TES FR10-FR20)
**And** task workspace with 3-column layout works (TES FR21-FR25)
**And** workflow automation (Story/Basic task types) works (TES FR30-FR38)
**And** scrollback persistence across restart/reboot works (TES FR39-FR47)
**And** all existing React frontend tests pass in Tauri webview
**And** all Rust backend services have `cargo test` coverage
**And** desktop binary is under 30MB (NFR37)
**And** keyboard shortcuts work (A/R/Enter/Escape/Space/arrows/?) (UX-DR5)
**And** WCAG AA accessibility is maintained (UX-DR6)

---

## Epic 2: Remote Project Support via SSH

Founder can connect to a remote machine via SSH and manage projects remotely — add/test SSH connections, generate and securely store SSH keys, discover projects on remote machines, attach to remote tmux sessions for agent execution, read/write remote files, receive forwarded hook events, and seamlessly switch between local and remote projects.

### Story T2.1: SSH Client and Key Management

As a founder,
I want to generate SSH key pairs and store them securely in my OS keychain,
So that I can authenticate with remote machines without managing key files manually.

**Acceptance Criteria:**

**Given** the Tauri desktop app from Epic 1
**When** I access SSH key management settings
**Then** the system can generate Ed25519 SSH key pairs via `russh-keys` (FR55)
**And** private keys are stored in the OS keychain via `keyring` crate (macOS Keychain, Linux Secret Service, Windows Credential Manager)
**And** public keys are displayed for copying to remote `authorized_keys`
**And** I can view, export, and delete stored SSH keys
**And** key generation completes in <2 seconds
**And** `cargo test` validates key generation, storage, and retrieval

### Story T2.2: SSH Connection Management UI

As a founder,
I want to add, test, edit, and remove SSH connection profiles,
So that I can manage my remote machines from within TinSu.

**Acceptance Criteria:**

**Given** SSH key management from T2.1
**When** I open connection management
**Then** I can add a new SSH connection profile with host, port, user, and authentication method (FR54)
**And** I can select from stored SSH keys or use password authentication
**And** I can test a connection to verify it works before saving (FR54)
**And** the test displays success with server fingerprint or a clear error message on failure
**And** I can edit existing connection profiles
**And** I can remove connection profiles
**And** connection establishment completes in <5 seconds on low-latency networks (NFR33)
**And** connections auto-reconnect within 10 seconds after transient network interruption (NFR35)
**And** connection profiles persist in the database

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T2.3: Remote Project Discovery and Selection

As a founder,
I want to discover and select projects on a remote machine,
So that I can manage remote codebases without manually entering paths.

**Acceptance Criteria:**

**Given** a working SSH connection from T2.2
**When** I connect to a remote machine
**Then** the system enumerates directories on the remote machine to find git repositories (FR56)
**And** discovered projects show repository name, path, and last modified date
**And** I can select a project to manage remotely
**And** the selected project is saved as a remote project profile
**And** I can manually enter a path if auto-discovery misses a project
**And** discovery handles permission errors gracefully (skips inaccessible directories)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T2.4: Remote tmux Session Attachment

As a founder,
I want to attach to tmux sessions on a remote machine over SSH,
So that I can execute and monitor AI agents on remote projects just like local ones.

**Acceptance Criteria:**

**Given** a remote project selected from T2.3
**When** a remote task moves to In Progress
**Then** the system creates a tmux session on the remote machine via SSH exec channel (FR57)
**And** the local app attaches to the remote tmux session via SSH tunnel
**And** terminal output streams to the local xterm.js with <500ms latency plus SSH overhead
**And** I can type commands into the remote terminal
**And** remote tmux sessions persist independently of the SSH connection
**And** reconnecting to a dropped SSH session reattaches to the existing tmux session
**And** the system detects when a remote tmux session ends or becomes unresponsive

### Story T2.5: Remote File Operations

As a founder,
I want to read and write project files on a remote machine (story files, diffs, logs),
So that I can review agent changes and manage artifacts without SSH-ing manually.

**Acceptance Criteria:**

**Given** remote project access from T2.3-T2.4
**When** I view a remote task's diff, content, or artifacts
**Then** the system reads remote files via SFTP (FR58)
**And** the diff viewer shows remote git changes identically to local diffs
**And** story files and acceptance criteria load from the remote filesystem
**And** agent logs and transcripts are accessible from the remote machine
**And** remote file operations complete in <3 seconds for files up to 1MB (NFR34)
**And** large files show a loading indicator
**And** file operation errors display clear messages (permission denied, file not found)

### Story T2.6: Remote Hook Event Forwarding

As a founder,
I want Claude Code hook events from a remote machine to reach my local TinSu app,
So that activity logging, automation triggers, and status updates work for remote projects.

**Acceptance Criteria:**

**Given** remote tmux sessions from T2.4
**When** Claude Code hooks fire on the remote machine
**Then** the system forwards hook events to the local app via SSH port forwarding (FR59)
**And** the local axum hook listener receives forwarded events identically to local events
**And** remote hook events add <500ms latency to local event processing (NFR36)
**And** activity logging works for remote tasks (all 7 event types)
**And** workflow automation triggers work for remote Story tasks (auto code-review)
**And** session-task mapping works across the SSH boundary
**And** port forwarding reconnects automatically after SSH reconnection

### Story T2.7: Local/Remote Project Switcher

As a founder,
I want to switch between local and remote projects using a unified project switcher in the UI,
So that managing remote projects feels as natural as local ones.

**Acceptance Criteria:**

**Given** local projects from Epic 1 and remote projects from T2.3
**When** I use the project switcher in the header
**Then** both local and remote projects appear in a unified list (FR60)
**And** remote projects show a connection status indicator (connected/disconnected/connecting)
**And** switching to a remote project establishes the SSH connection if not already connected
**And** the Kanban board, task workspace, and planning workspace all work for the selected project
**And** switching between local and remote projects preserves each project's state
**And** if a remote connection drops, the UI shows a clear disconnected state with reconnect option

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T2.8: Remote Feature Parity Validation (Phase 2 Gate)

As a founder,
I want to verify that remote project management works end-to-end,
So that I can confidently use TinSu to manage projects on any machine.

**Acceptance Criteria:**

**Given** all T2.1-T2.7 stories are complete
**When** I connect to a remote machine and manage a project
**Then** SSH key generation and OS keychain storage work (FR55)
**And** SSH connection profiles can be added, tested, edited, and removed (FR54)
**And** remote projects are discovered and selectable (FR56)
**And** remote tmux sessions attach and stream terminal output (FR57)
**And** remote file operations work for diffs, stories, and logs (FR58)
**And** remote hook events forward correctly with activity logging (FR59)
**And** the project switcher seamlessly switches between local and remote (FR60)
**And** the full task lifecycle works remotely: create → execute → review → approve → done
**And** SSH auto-reconnect recovers gracefully from network interruptions
**And** all SSH NFRs are met (NFR33-NFR36)

---

## Epic 3: Mobile Foundation (Build Targets)

> **Restructured 2026-04-30** via [sprint-change-proposal-2026-04-30.md](./sprint-change-proposal-2026-04-30.md).
> Original responsive-UI stories T3.2–T3.7 superseded. T3.8 cancelled (rolls into Epic 3.5 device gate).
> T3.1 (Android + iOS Tauri build targets) is retained as foundation reused by Epic 3.5.

### Story T3.1: Add Android and iOS Build Targets

As a founder,
I want the Tauri project configured for Android and iOS builds,
So that I can develop and test TinSu on mobile devices.

**Acceptance Criteria:**

**Given** the Tauri desktop app from Epic 1
**When** I run `npm run tauri android init` and `npm run tauri ios init`
**Then** Android build targets are configured with appropriate Gradle settings
**And** iOS build targets are configured with appropriate Xcode project settings
**And** `npm run tauri android dev` launches the app in an Android emulator or connected device
**And** `npm run tauri ios dev` launches the app in an iOS simulator or connected device
**And** the React frontend renders in mobile webviews (Android WebView, WKWebView)
**And** the Rust backend compiles for ARM targets (aarch64-linux-android, aarch64-apple-ios)
**And** mobile app launches in <3 seconds on 2022+ devices (NFR38)

---

> **Stories T3.2 through T3.8 below are SUPERSEDED (2026-04-30).** Replaced by Epic 3.5 stories T3.5-1 through T3.5-9. Story specifications retained for historical reference and as input to Epic 3.5 acceptance criteria.

### Story T3.2: Responsive Layout and Mobile Navigation [SUPERSEDED — see T3.5-1, T3.5-2]

As a founder,
I want TinSu's UI to adapt to mobile screen sizes with appropriate navigation,
So that I can use the app effectively on phones and tablets.

**Acceptance Criteria:**

**Given** the app running on a mobile device
**When** the viewport is 320-767px (mobile breakpoint)
**Then** the Kanban board shows a single column with swipe navigation between columns (UX-DR7)
**And** a bottom tab navigation replaces the desktop sidebar
**And** the task workspace shows one panel at a time with swipe between Content/Terminal/Activities/Diff
**And** all touch targets are at least 44x44px
**And** text is legible without zooming (14px minimum body text)
**When** the viewport is 768-1023px (tablet breakpoint)
**Then** the Kanban board shows 2 columns with horizontal swipe for more
**And** the task workspace shows a 2-column layout
**And** the React frontend renders identically across desktop and mobile webviews (NFR39)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.3: Touch-Optimized Kanban Interactions [SUPERSEDED — see T3.5-3]

As a founder,
I want to drag tasks, tap to open, and swipe between columns on mobile,
So that the core Kanban workflow is natural on touch devices.

**Acceptance Criteria:**

**Given** the responsive layout from T3.2
**When** I interact with the Kanban board on a touch device
**Then** I can long-press a task card to start dragging
**And** I can drop the card on a visible column or swipe to reveal adjacent columns while dragging
**And** I can tap a card to open the task detail view
**And** I can swipe left/right on the board to navigate between columns
**And** drag-and-drop feels smooth at 60fps with no jank
**And** haptic feedback fires on drag start and drop (if supported by device)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.4: Mobile SSH Connection Flow [SUPERSEDED — see T3.5-7]

As a founder,
I want to connect to remote machines from my phone,
So that I can manage remote projects while away from my desk.

**Acceptance Criteria:**

**Given** SSH capabilities from Epic 2 and mobile app from T3.1
**When** I use SSH features on mobile
**Then** I can add/edit/test SSH connection profiles with a mobile-friendly form
**And** I can select from stored SSH keys (synced from desktop or generated on device)
**And** connection status shows clearly in the mobile project switcher
**And** SSH connection handles mobile network transitions (WiFi → cellular) gracefully
**And** the app reconnects automatically when network becomes available again

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5: Mobile Terminal View [SUPERSEDED — see T3.5-4]

As a founder,
I want to view agent terminal output on my phone,
So that I can monitor what agents are doing from anywhere.

**Acceptance Criteria:**

**Given** remote tmux sessions from Epic 2 and mobile layout from T3.2
**When** I open a task's terminal on mobile
**Then** xterm.js renders in a full-screen mobile view with readable monospace font (12px minimum)
**And** I can scroll through terminal output with touch gestures
**And** I can type commands via the device keyboard
**And** terminal streaming works over SSH with acceptable latency on mobile networks
**And** the terminal view shows status bar (Running/Paused/Stalled/Complete) at the top
**And** Pause/Resume buttons are thumb-accessible at the bottom of the screen

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.6: Mobile Review and Approval Flow [SUPERSEDED — see T3.5-6]

As a founder,
I want to review diffs and approve/reject tasks from my phone,
So that I can unblock agent work without needing my laptop.

**Acceptance Criteria:**

**Given** the mobile layout from T3.2 and git service from Epic 1
**When** a task is in Review and I open it on mobile
**Then** the diff viewer shows changes in a mobile-optimized unified view
**And** file tree is collapsible with touch-friendly expand/collapse
**And** I can approve with a prominent green "Approve" button at the bottom
**And** I can reject with a "Reject" button that opens a feedback text input
**And** approval triggers merge and task completion (same as desktop)
**And** rejection sends feedback to the agent (same as desktop)
**And** a bottom action bar provides Approve/Reject/Pause controls (UX-DR7 mobile specification)

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.7: Mobile Chat with Planning Agents [SUPERSEDED — see T3.5-5]

As a founder,
I want to chat with planning agents (PM, Architect, etc.) from my phone,
So that I can continue planning work during commutes or away from my desk.

**Acceptance Criteria:**

**Given** planning workspace from Epic 1 and mobile layout from T3.2
**When** I open the Planning Workspace on mobile
**Then** the chat interface displays in a full-screen mobile view
**And** the session list is accessible via a slide-out panel or top selector
**And** I can send messages using the device keyboard with a send button
**And** chat messages render with proper formatting in mobile width
**And** I can switch between agent sessions without losing context
**And** session status indicators (thinking, idle, completed) are visible

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.8: Mobile Platform Validation (Phase 3 Gate) [CANCELLED — rolls into T3.5-9]

As a founder,
I want to verify that TinSu works correctly on Android and iOS,
So that I can use mobile as my intervention and monitoring device.

**Acceptance Criteria:**

**Given** all T3.1-T3.7 stories are complete
**When** I use TinSu on Android and iOS devices
**Then** the app launches in <3 seconds on 2022+ devices (NFR38)
**And** responsive layout works correctly at mobile and tablet breakpoints
**And** touch Kanban interactions (drag, tap, swipe) work smoothly
**And** SSH connection and remote project management work on mobile
**And** terminal viewing and command input work on mobile
**And** review and approval flow works on mobile (diff view, approve/reject)
**And** planning chat works on mobile
**And** the app handles network transitions (WiFi ↔ cellular) gracefully
**And** React frontend renders identically to desktop (NFR39)
**And** all critical user journeys complete successfully on both platforms

---

## Epic 3.5: Mobile UX Native Redesign

Founder uses TinSu on Android and iOS via a mobile-native UI tree at `src/mobile/`, rendered conditionally at `App.tsx` based on viewport. Full feature parity: kanban, planning workspace, task workspace, review/approval, SSH, activity feed, settings. Replaces responsive single-tree approach (T3.2–T3.7). Reuses Rust backend, domain stores, rspc hooks, Calm Command tokens unchanged.

**Source:** [`sprint-change-proposal-2026-04-30.md`](./sprint-change-proposal-2026-04-30.md)
**Design plan:** [`mobile-ux-redesign-plan-2026-04-30.md`](./mobile-ux-redesign-plan-2026-04-30.md) (authoritative for screens, primitives, gestures)

### Story T3.5-1: Mobile Shell Foundation

As a founder,
I want a viewport-detected mobile UI tree separate from the desktop tree,
So that mobile UX can evolve independently without `useIsMobile()` branches scattered through desktop components.

**Acceptance Criteria:**

**Given** the existing `App.tsx` desktop tree
**When** the viewport width is < 1024px on app mount
**Then** `App.tsx` renders `<MobileApp />` instead of the desktop tree
**And** the desktop tree is not mounted on mobile
**And** `MobileApp.tsx` mounts a 5-tab `MobileTabBar` (Board / Planning / Tasks / Activity / Settings)
**And** a `mobile-nav` Zustand store maintains 5 parallel navigation stacks (one per tab) with native back-button behavior
**And** `tinsu://chat/{sessionId}` deep links route to the Planning tab and push the chat screen
**And** `tinsu://task/{taskId}` deep links route to the Tasks tab and push the task workspace screen
**And** `useIsMobile()` is no longer imported by any component under `src/components/`
**And** existing desktop test suites pass unchanged

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-2: Mobile Primitives Library

As a founder,
I want a stable set of mobile UI primitives consuming Calm Command tokens,
So that feature stories build on a consistent design surface and avoid mobile-component churn.

**Acceptance Criteria:**

**Given** the mobile shell from T3.5-1
**When** I review `src/mobile/primitives/`
**Then** the directory exports 14 primitives: `MobileScreen`, `MobileTopAppBar`, `MobileTabBar`, `MobileSheet`, `MobileSegmentedTabs`, `MobileColumnPager`, `MobileBottomActionBar`, `MobileListItem`, `MobileEmptyState`, `MobileChip`, `MobileFab`, `MobileSearchBar`, `MobileLoadingSkeleton`, `MobilePullToRefresh`
**And** all primitives consume CSS variables from Calm Command tokens — no inline Tailwind color classes
**And** all touch targets are ≥44×44 px (UX-DR7)
**And** primitives respect `prefers-reduced-motion` (UX-DR6)
**And** a visual harness page renders every primitive in its key states for review
**And** primitive props are typed and documented inline

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-3: Mobile Board

As a founder,
I want a mobile-native kanban board with horizontal column pager and long-press drag,
So that I can review and reorder tasks one-handed on a phone.

**Acceptance Criteria:**

**Given** the mobile shell and primitives from T3.5-1 and T3.5-2
**When** I open the Board tab
**Then** the kanban renders as a horizontal column pager with one column visible plus 8% peek of the next column
**And** horizontal swipe pages between columns at 60fps with snap-to-column
**And** long-press (250ms) on a card initiates drag using the existing @dnd-kit core
**And** dragging near the edge auto-scrolls to the adjacent column
**And** drop on a column updates task status via the existing Tauri command
**And** an `MobileFab` opens a bottom-sheet add-task form
**And** haptic feedback fires on drag start and drop (where supported)
**And** desktop kanban behavior is unchanged

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-4: Mobile Task Workspace

As a founder,
I want a full-screen mobile task workspace with 4 sub-tabs (Content / Terminal / Activities / Diff),
So that I can monitor agent execution end-to-end on mobile.

**Acceptance Criteria:**

**Given** the mobile shell and primitives from T3.5-1 and T3.5-2
**When** I push a task workspace from the Board or Tasks tab
**Then** the screen renders full-screen with `MobileTopAppBar` (back, task title, overflow menu)
**And** a pinned `MobileSegmentedTabs` control switches between Content / Terminal / Activities / Diff
**And** horizontal swipe between sub-tabs mirrors the segmented control
**And** the Terminal sub-tab embeds xterm.js with the existing canvas renderer and a `TerminalAccessoryBar`
**And** the Activities sub-tab streams real-time activity events with chip-style filters
**And** the Diff sub-tab uses the unified diff renderer with the file tree as a `MobileSheet`
**And** each sub-tab has a sticky `MobileBottomActionBar` with the relevant primary action (e.g., Approve on Diff)
**And** scroll position is preserved per sub-tab during swipe

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-5: Mobile Planning

As a founder,
I want a mobile-native planning workspace with session list root and full-screen chat,
So that I can continue planning conversations on phone without losing session context.

**Acceptance Criteria:**

**Given** the mobile shell from T3.5-1
**When** I open the Planning tab
**Then** the root screen shows a session list with last-message preview and live status badges
**And** tapping a session pushes a full-screen chat screen
**And** the chat screen displays a top BMAD persona pill that opens a `MobileSheet` listing personas (PM, Architect, Analyst, etc.)
**And** I can start a new chat session by selecting a persona from the sheet
**And** message bubbles render at mobile width with proper formatting and code-block scroll
**And** the input bar pins to the bottom above the system keyboard with a send button
**And** session resume preserves message history via the existing rspc hooks unchanged
**And** `tinsu://chat/{sessionId}` deep links open directly to the chat screen

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-6: Mobile Review

As a founder,
I want a mobile-native review screen with sticky Approve / Request-changes action bar,
So that I can approve or reject task changes one-handed without scrolling past the diff.

**Acceptance Criteria:**

**Given** the mobile shell and primitives from T3.5-1 and T3.5-2
**When** a task is in Review and I open it on mobile
**Then** the diff renders in unified-only view (no split toggle)
**And** the file tree is accessible via a `MobileSheet` toggled from the top app bar
**And** a sticky `MobileBottomActionBar` shows Approve (right, thumb-dominant) and Request changes (left)
**And** tapping Approve triggers merge via the existing Tauri command and returns to the previous screen on success
**And** tapping Request changes opens a feedback sheet with a multiline input and submit button
**And** approval and rejection flows match desktop behavior end-to-end
**And** large diffs (>500 lines) virtualize for smooth scroll

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-7: Mobile SSH and Connection Management

As a founder,
I want a mobile-native SSH connection flow with full-screen forms and a key picker sheet,
So that I can add and test remote connections on phone without cramped modal dialogs.

**Acceptance Criteria:**

**Given** the mobile shell and primitives from T3.5-1 and T3.5-2 and the SSH backend from Tauri Epic 2
**When** I open SSH connection management on mobile (from Settings tab or empty-state CTA)
**Then** the connection list renders as a `MobileScreen` with `MobileListItem` rows showing connection name and live status
**And** adding or editing a connection opens a full-screen form (host, port, user, key picker, label)
**And** the key picker is a `MobileSheet` listing stored keys with select / generate-new actions
**And** Test Connection inline-validates and surfaces success or failure with actionable error messages
**And** connection status updates live via the existing rspc subscription unchanged
**And** mobile network transitions (WiFi ↔ cellular) trigger automatic reconnect with toast feedback

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-8: Mobile Activity Feed and Settings

As a founder,
I want a cross-task activity feed and mobile settings screens,
So that I can monitor agent activity at a glance and configure the app on phone.

**Acceptance Criteria:**

**Given** the mobile shell and primitives from T3.5-1 and T3.5-2
**When** I open the Activity tab
**Then** a chronologically merged feed of activities across all tasks renders with chip-style filters (status_change, agent_start, agent_complete, tool_used, user_command, automation_trigger, error)
**And** tapping an activity row pushes the related task workspace at the matching sub-tab (Activities or Terminal)
**When** I open the Settings tab
**Then** mobile settings screens cover: agent model configuration, SSH connection management entry, theme & accessibility, telemetry & diagnostics, about
**And** all settings screens render as `MobileScreen` with consistent top app bar and back navigation
**And** empty states use `MobileEmptyState` with appropriate copy and CTA
**And** loading states use `MobileLoadingSkeleton` matching the rendered row shape

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### Story T3.5-9: Real-Device Validation Gate (Phase 3.5 Gate)

As a founder,
I want all 10 acceptance criteria from `t3-8-test-report.md` verified on real Android and iOS hardware,
So that mobile is provably production-ready before Phase 4 (CI/CD) builds against it.

**Acceptance Criteria:**

**Given** all T3.5-1 through T3.5-8 stories are complete and merged
**When** I execute the validation procedure on Android API 34 emulator + at least one physical Android device, and on iOS 16+ simulator (and physical device if macOS available)
**Then** AC 1: cold-start launch <3s on 2022+ devices (5-run mean), measured with Android Studio Profiler / Xcode Instruments
**And** AC 2: responsive layout verified at 360×800 (Android) and 375×812 (iPhone SE) — no overflow, all targets ≥44px
**And** AC 3: long-press drag and column pager profile at 60fps (no jank frames in profiler trace)
**And** AC 4: SSH connect → remote project open → tasks load — succeeds end-to-end
**And** AC 5: terminal sub-tab on Tauri Epic 2 SSH session — input/output latency <2s on cellular
**And** AC 6: review sub-tab — open diff → approve → merge succeeds; reject → feedback submitted, task returns to In Progress
**And** AC 7: Planning tab — open session list → push chat → send message → response appears
**And** AC 8: critical user journeys complete without crashes (3 listed in test report)
**And** AC 9: WiFi ↔ cellular transition recovers within 30s and terminal session resumes
**And** AC 10: platform parity documented (Android vs iOS differences listed; iOS marked deferred if macOS unavailable)
**And** the test report is updated with actual measurements (not stub data) and committed

## Epic 4: CI/CD and Build Pipeline

Automated builds and distribution for all 5 platforms — GitHub Actions workflows for desktop, Android, and iOS builds with desktop auto-update mechanism.

### Story T4.1: Desktop Build Pipeline

As a founder,
I want automated GitHub Actions workflows that build TinSu for macOS, Linux, and Windows,
So that I can distribute desktop builds without manual compilation on each platform.

**Acceptance Criteria:**

**Given** the Tauri desktop app from Epic 1
**When** I push to the release branch or create a GitHub release
**Then** GitHub Actions builds macOS .dmg (Intel + Apple Silicon universal binary)
**And** GitHub Actions builds Linux .AppImage and .deb
**And** GitHub Actions builds Windows .msi
**And** all binaries are under 30MB (NFR37)
**And** build artifacts are attached to the GitHub release
**And** CI runs `cargo test` and `npm run test` before building
**And** CI runs `cargo clippy` and ESLint for code quality checks
**And** builds complete within 30 minutes

### Story T4.2: Android Build Pipeline

As a founder,
I want automated builds for Android,
So that I can distribute APK/AAB files for testing and eventual Play Store release.

**Acceptance Criteria:**

**Given** Android build targets from T3.1
**When** the Android build pipeline runs
**Then** GitHub Actions builds Android .apk (debug) and .aab (release)
**And** the pipeline handles Android signing with securely stored keystore
**And** the APK size is reasonable for a Tauri app (<50MB)
**And** build artifacts are attached to the GitHub release
**And** CI runs tests before building

### Story T4.3: iOS Build Pipeline

As a founder,
I want automated builds for iOS,
So that I can distribute IPA files for TestFlight and eventual App Store release.

**Acceptance Criteria:**

**Given** iOS build targets from T3.1
**When** the iOS build pipeline runs
**Then** GitHub Actions (macOS runner) builds iOS .ipa
**And** the pipeline handles iOS code signing with securely stored certificates and provisioning profiles
**And** the build is compatible with TestFlight distribution
**And** build artifacts are attached to the GitHub release
**And** CI runs tests before building

### Story T4.4: Desktop Auto-Update

As a founder,
I want TinSu to check for updates and install them automatically on desktop,
So that I always run the latest version without manual downloads.

**Acceptance Criteria:**

**Given** desktop builds from T4.1
**When** a new version is published as a GitHub release
**Then** the running TinSu desktop app detects the update via Tauri's built-in updater
**And** a notification appears informing the user of the available update
**And** the user can accept and the update downloads and installs automatically
**And** the app restarts with the new version after update
**And** update checks happen on app launch and periodically (every 24 hours)
**And** the updater verifies signatures to prevent tampered updates
**And** if the update fails, the current version continues working without corruption
