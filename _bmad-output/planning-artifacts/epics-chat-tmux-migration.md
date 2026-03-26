---
stepsCompleted: [1, 2, 3, 4]
completedDate: 2026-03-26
totalEpics: 2
totalStories: 6
epicPrefix: 'ctm'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/handoff-chat-tmux-migration.md
featureName: 'Chat Session tmux Migration'
parentEpics: '_bmad-output/planning-artifacts/epics.md'
supersedes: 'Epic 10 stories 10.3 and 10.6 (CLI spawning and session persistence) — replaced by tmux-based equivalents'
---

# TinSu - Epic Breakdown: Chat Session tmux Migration

## Overview

This document provides the epic and story breakdown for migrating Planning Workspace chat sessions from node-pty to tmux, enabling persistent concurrent multi-agent sessions. This extends the original Epic 10 (Agent Planning Chat) from the main epics document, replacing the node-pty session management with tmux-based architecture.

## Requirements Inventory

### Functional Requirements

FR36: Founder can open a Planning Workspace with BMAD workflow steps displayed in a sidebar
FR37: Founder can select an agent persona (PM, Architect, UX Designer, Dev, QA, or custom) for each chat session
FR38: Founder can send messages to an agent and receive responses in a chat interface with message bubbles
FR39: System creates a persistent, isolated terminal session for each new chat conversation
FR40: System provides a bidirectional communication channel for sending messages to and receiving output from agent sessions
FR41: System launches the agent process with unique session identity and persona context pre-loaded
FR42: System routes agent lifecycle events (completion, tool use, permission requests, notifications) to the correct chat session without cross-session leakage
FR43: System persists assistant responses and tool activity for retrieval and display in the chat interface
FR44: Founder can run multiple chat sessions simultaneously across different agent personas, each in an independent persistent session
FR45: Founder can switch between active chat sessions without interrupting background agent work
FR46: System displays a session list with live status indicators (thinking, idle, completed, exited) reflecting the agent session state
FR47: Founder can view and resume any previous chat session from the session list
FR48: Chat sessions are scoped to a project — each session records its project_id and only appears in that project's session list
FR49: Founder can run concurrent chat sessions across different projects without cross-project interference
FR50: System confines each agent session's file operations to the target project directory, ensuring project isolation
FR51: Chat sessions persist across app restarts — founder can resume conversations without context loss
FR52: System validates chat session health on startup, marking unavailable sessions for re-creation on next message
FR53: System monitors agent session health and updates session status within 2 seconds of a session becoming unavailable

### NonFunctional Requirements

NFR25: System supports at least 5 concurrent chat tmux sessions without degradation of session management operations (create, switch, monitor)
NFR26: Switching between chat sessions completes in <500ms (session list click to message display)
NFR27: Background chat sessions experience zero message loss and no added processing latency >1 second due to foreground session activity
NFR28: Chat tmux sessions survive app restart with zero context loss — conversation resumes from exact state
NFR29: Startup validation of chat tmux sessions completes in <5 seconds for up to 20 sessions
NFR30: Hook events from concurrent chat sessions are routed to the correct session with 100% accuracy (no cross-session event leakage)
NFR31: Chat tmux session creation (including Claude CLI spawn and TUI ready detection) completes in <15 seconds
NFR32: Stale session detection (tmux process gone) updates UI status within one polling interval (2 seconds)

### Additional Requirements

- Schema migration: add `tmux_session TEXT` column to `chat_sessions` table
- Shared tmux server with task sessions (distinct `tinsu-chat-*` naming prevents collision)
- 2-hour idle timeout (extended from 30 min for conversational chat sessions)
- Permanent PTY attachment to tmux session (I/O channel lifetime = session lifetime)
- Hook identification via `TINSU_TMUX_SESSION` env var + O(1) cache routing
- Unchanged patterns: `writeWhenReady`, `busySessions`, `onData` callbacks, 150ms Enter delay, persona injection
- Remove orphan logic: `findOrphanSession()`, `discoverCorrectUuid()`, `maybeRetryResume()`, `tryRegisterChatOrphan()`
- 2-second `tmux has-session` polling for health monitoring
- Three-case `sendChatMessage` handler (tmux alive+PTY attached, tmux alive+PTY detached, no tmux)
- Environment variable injection via `tmux set-environment` at session creation

### UX Design Requirements

No UX Design requirements — the UX design specification does not cover the Planning Workspace chat system.

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR36 | Epic 10 (existing) | Planning Workspace with BMAD sidebar |
| FR37 | Epic 10 (existing) | Agent persona selector |
| FR38 | Epic 10 (existing) | Chat interface with message bubbles |
| FR39 | CTM Epic 1 | Persistent isolated terminal session (tmux) |
| FR40 | CTM Epic 1 | Bidirectional communication channel (PTY on tmux) |
| FR41 | CTM Epic 1 | Agent launch with session identity |
| FR42 | CTM Epic 1 | Event routing without cross-session leakage |
| FR43 | CTM Epic 1 | Message persistence |
| FR44 | CTM Epic 2 | Multiple simultaneous sessions |
| FR45 | CTM Epic 2 | Switch without interrupting background |
| FR46 | CTM Epic 2 | Session list with live status indicators |
| FR47 | CTM Epic 2 | Resume previous sessions |
| FR48 | CTM Epic 2 | Project-scoped sessions |
| FR49 | CTM Epic 2 | Cross-project concurrent sessions |
| FR50 | CTM Epic 2 | Project-confined file operations |
| FR51 | CTM Epic 1 | Survive app restart |
| FR52 | CTM Epic 1 | Startup health validation |
| FR53 | CTM Epic 2 | Health monitoring with 2s detection |

### NFR Coverage Map

| NFR | Epic | Target |
|-----|------|--------|
| NFR25 | CTM Epic 2 | 5+ concurrent sessions |
| NFR26 | CTM Epic 2 | <500ms session switch |
| NFR27 | CTM Epic 2 | Zero background message loss |
| NFR28 | CTM Epic 1 | Zero context loss on restart |
| NFR29 | CTM Epic 1 | <5s startup validation |
| NFR30 | CTM Epic 1 | 100% hook routing accuracy |
| NFR31 | CTM Epic 1 | <15s session creation |
| NFR32 | CTM Epic 2 | <2s stale detection |

## Epic List

### CTM Epic 1: Persistent Chat Sessions via tmux

Founder's chat sessions survive app restart, hooks always route to the correct session, and conversation context is never lost. This is the core migration from node-pty to tmux for session lifecycle, I/O, and event routing.

**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR51, FR52
**NFRs addressed:** NFR28, NFR29, NFR30, NFR31
**Supersedes:** Epic 10 stories 10.3 (CLI spawning) and 10.6 (session persistence)
**Dependencies:** Epic 10 (complete ✅)

### CTM Epic 2: Concurrent Multi-Agent Sessions

Founder can run PM, Architect, and other agents simultaneously across projects, see their live status, and switch between them without interrupting background work. Enables the full Journey 3 (Multi-Agent Planning) experience.

**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR53
**NFRs addressed:** NFR25, NFR26, NFR27, NFR32
**Dependencies:** CTM Epic 1

## CTM Epic 1: Persistent Chat Sessions via tmux

**Goal:** Founder's chat sessions survive app restart, hooks always route to the correct session, and conversation context is never lost. This is the core migration from node-pty to tmux for session lifecycle, I/O, and event routing.

**User Outcome:** "I can restart the app and my chat sessions are still there. Hooks never route to the wrong session."

**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR51, FR52
**NFRs addressed:** NFR28, NFR29, NFR30, NFR31
**Supersedes:** Epic 10 stories 10.3 (CLI spawning) and 10.6 (session persistence)
**Dependencies:** Epic 10 (complete ✅)

### Story 1.1: tmux Session Creation & PTY Attachment
**Task ID:** `ctm-1-1-tmux-session-creation-and-pty-attachment`

As a founder,
I want my chat sessions to run inside persistent tmux sessions with a PTY I/O channel,
So that sessions survive app restarts and I never lose conversation context.

**Acceptance Criteria:**

**Given** I send the first message in a new chat session
**When** the system creates the session
**Then** a tmux session is created with name `tinsu-chat-{sessionId}`
**And** environment variables `TINSU_TMUX_SESSION` and `TINSU_SESSION_UUID` are set via `tmux set-environment`
**And** `claude --session-id {uuid} --append-system-prompt {persona}` is sent into the tmux session
**And** a PTY is attached via `ptyService.spawn('bash', ['-c', 'tmux attach-session -t tinsu-chat-{sessionId}'])`
**And** the `chat_sessions.tmux_session` column is populated with the tmux session name
**And** `sessionCache` is populated with the mapping

**Given** the PTY is attached to the tmux session
**When** the TUI ready detection fires (`writeWhenReady`)
**Then** the user's message is written via `ptyService.write()` (not `tmux send-keys`)
**And** the existing 150ms delay between message content and Enter key is preserved

**Given** the system creates a tmux session
**When** the session name is generated
**Then** it uses the `tinsu-chat-` prefix (distinct from task system's `tinsu-` prefix)
**And** the session name passes `SAFE_SHELL_ARG_REGEX` validation

**Given** the database schema
**When** the migration runs
**Then** the `chat_sessions` table has a new `tmux_session TEXT` column
**And** existing rows have `tmux_session = NULL` (no backfill needed)

**Given** the ChatCliService is refactored
**When** the orphan logic methods are evaluated
**Then** `findOrphanSession()`, `discoverCorrectUuid()`, and `maybeRetryResume()` are removed
**And** the `IDLE_TIMEOUT_MS` is changed from 30 minutes to 2 hours

**Given** session creation completes
**When** timing is measured
**Then** the full flow (tmux new-session + claude spawn + TUI ready) completes in <15 seconds (NFR31)

---

### Story 1.2: Hook Routing by tmux Session Name
**Task ID:** `ctm-1-2-hook-routing-by-tmux-session-name`

As a founder,
I want agent lifecycle events to always reach the correct chat session,
So that I never see tool activities or responses from the wrong conversation.

**Acceptance Criteria:**

**Given** a chat tmux session is running with `TINSU_TMUX_SESSION` set
**When** any chat hook script fires (stop, tool-use, pre-tool-use, status)
**Then** the script reads `$TINSU_TMUX_SESSION` from the environment
**And** injects `tmux_session` into the JSON payload via `jq`
**And** POSTs to the appropriate `/api/hooks/chat-*` endpoint

**Given** `HookListenerService` receives a chat hook event
**When** the payload contains `tmux_session`
**Then** it looks up the `chatSessionId` from `sessionToChatCache` (O(1))
**And** if cache miss, falls back to DB lookup by `chat_sessions.tmux_session`
**And** populates the cache on fallback hit

**Given** `HookListenerService` is refactored
**When** the orphan registration logic is evaluated
**Then** `tryRegisterChatOrphan()` is removed
**And** the `session_uuid` DB lookup fallback for routing is replaced by `tmux_session` lookup

**Given** 5 concurrent chat sessions are running
**When** hook events fire from all 5 sessions simultaneously
**Then** each event routes to the correct session with 100% accuracy (NFR30)
**And** no cross-session event leakage occurs

**Given** the `sessionToChatCache` is populated during session creation
**When** `spawnSession()` completes
**Then** both `sessionCache` (chatSessionId → tmuxName) and `sessionToChatCache` (tmuxName → chatSessionId) are updated atomically

---

### Story 1.3: Session Recovery & Startup Validation
**Task ID:** `ctm-1-3-session-recovery-and-startup-validation`

As a founder,
I want the app to detect which chat sessions are still alive on startup and seamlessly recover them,
So that I can restart the app and continue conversations without losing context.

**Acceptance Criteria:**

**Given** the app starts and active chat sessions exist in the database
**When** `validateSessionsOnStartup()` runs
**Then** for each active session with a `tmux_session` value, it runs `tmux has-session -t {tmuxName}`
**And** alive sessions rebuild the `sessionCache` and `sessionToChatCache`
**And** dead sessions are marked `status = 'paused'` with updated `updatedAt`
**And** validation completes in <5 seconds for up to 20 sessions (NFR29)

**Given** I open a chat session that was validated as alive on startup
**When** the PTY was not re-attached yet (Case B: tmux alive, PTY detached)
**Then** the system re-attaches a PTY via `ptyService.spawn('bash', ['-c', 'tmux attach-session -t ...'])`
**And** I can send a message immediately after re-attachment

**Given** I send a message to a session marked as 'paused' (tmux session died)
**When** the system processes the message (Case C: no tmux)
**Then** a new tmux session is created with a fresh `claude --session-id {existing-uuid}`
**And** Claude Code restores conversation context via the session ID
**And** the `--resume` flag is NOT used (tmux persistence replaces it)
**And** the `chat_sessions.tmux_session` is updated with the new tmux session name

**Given** the `sendChatMessage` tRPC mutation
**When** it evaluates session state
**Then** it handles three cases:
- Case A: tmux alive + PTY attached → send message directly
- Case B: tmux alive + PTY detached → re-attach PTY, then send
- Case C: no tmux session → create new tmux session, spawn claude, then send

**Given** the app restarts and tmux sessions from a previous run are alive
**When** the founder resumes a conversation
**Then** zero context is lost — the conversation continues from exact state (NFR28)

## CTM Epic 2: Concurrent Multi-Agent Sessions

**Goal:** Founder can run PM, Architect, and other agents simultaneously across projects, see their live status, and switch between them without interrupting background work. Enables the full Journey 3 (Multi-Agent Planning) experience.

**User Outcome:** "I have 3 agents running across 2 projects. I can jump between them instantly and see exactly what each one is doing."

**FRs covered:** FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR53
**NFRs addressed:** NFR25, NFR26, NFR27, NFR32
**Dependencies:** CTM Epic 1

### Story 2.1: Concurrent Session Execution & Background Persistence
**Task ID:** `ctm-2-1-concurrent-session-execution-and-background-persistence`

As a founder,
I want to run multiple chat sessions simultaneously and switch between them without interrupting background agent work,
So that I can consult PM, Architect, and other agents in parallel across projects.

**Acceptance Criteria:**

**Given** I have an active chat session with the PM agent
**When** I switch to the Architect persona (or select a different session)
**Then** the PM session's tmux process continues running in the background
**And** the PM session's PTY remains attached (permanent attachment)
**And** `setSessionId(null)` is NOT called — the old session is preserved

**Given** I switch back to the PM session
**When** the session loads
**Then** I see all previous messages immediately (from `chat_messages` table)
**And** any messages the agent produced while in background are visible
**And** the switch completes in <500ms (NFR26)

**Given** I have 5 concurrent chat sessions running
**When** I interact with the foreground session
**Then** background sessions experience zero message loss (NFR27)
**And** background sessions have no added processing latency >1 second
**And** session management operations (create, switch, monitor) show no degradation (NFR25)

**Given** I have sessions across two different projects
**When** I view sessions for Project A
**Then** only Project A's sessions appear (existing `project_id` filter)
**And** Project B's sessions continue running independently (FR49)
**And** each session's Claude Code cwd is set to its respective project directory (FR50)

**Given** I click on a previous session in the session list
**When** the session has an alive tmux session
**Then** the session resumes immediately with full context (FR47)
**And** if the PTY needs re-attachment, it happens transparently

---

### Story 2.2: Session Health Monitoring & Idle Timeout
**Task ID:** `ctm-2-2-session-health-monitoring-and-idle-timeout`

As a founder,
I want the system to detect when chat sessions exit or become idle,
So that I see accurate session status and resources are managed efficiently.

**Acceptance Criteria:**

**Given** the ChatCliService starts monitoring
**When** `startMonitoring()` is called
**Then** it polls `tmux has-session` for every cached session every 2 seconds

**Given** a tmux session exits (Claude Code completes or crashes)
**When** the next polling cycle detects `tmux has-session` returns false
**Then** the session is removed from `sessionCache` and `sessionToChatCache`
**And** the DB record is updated to `status = 'paused'`
**And** a session status event is emitted for the UI
**And** detection occurs within one polling interval — <2 seconds (NFR32)

**Given** a chat session has been idle (no user messages) for 2 hours
**When** the idle timeout check runs
**Then** the tmux session is killed via `tmux kill-session`
**And** the session status is updated to 'paused'
**And** the session can be re-created on next user message (Case C from Story 1.3)

**Given** the idle timeout is configured
**When** the value is checked
**Then** chat sessions use 2 hours (not the 30-minute task timeout)
**And** the timeout resets on each user message

---

### Story 2.3: Session List with Live Status Badges
**Task ID:** `ctm-2-3-session-list-with-live-status-badges`

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

As a founder,
I want to see all my chat sessions with real-time status indicators,
So that I know which agents are thinking, idle, or have exited at a glance.

**Acceptance Criteria:**

**Given** I view the chat session list in the Planning Workspace
**When** sessions exist for the current project
**Then** each session shows: agent persona icon/name, last message preview, timestamp, and a live status badge
**And** status badges show one of: "thinking" (agent processing), "idle" (waiting for input), "completed" (agent finished), "exited" (tmux session gone)

**Given** the `listChatSessionsWithStatus` tRPC procedure is called
**When** it queries sessions for a project
**Then** it returns sessions ordered by most recently active
**And** each session includes `liveStatus` from `chatCliService.getSessionStatus()`
**And** the query completes quickly enough for <500ms total switch time (NFR26)

**Given** an agent is processing a message in a background session
**When** I view the session list
**Then** that session's badge shows "thinking" in real-time
**And** when the agent finishes, the badge updates to "idle" without manual refresh

**Given** the Planning Workspace sidebar
**When** background sessions are active
**Then** a summary shows the count of active background sessions and their status
**And** example: "PM (payment PRD) — idle, Architect (payment) — thinking"

**Given** I click on a session in the list
**When** the session loads
**Then** the transition is smooth and completes in <500ms (NFR26)
**And** the chat area shows all messages for that session
