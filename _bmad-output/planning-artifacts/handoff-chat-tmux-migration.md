---
title: "Handoff: Planning Workspace Chat Session tmux Migration"
date: 2026-03-26
status: ready-for-architecture
prd: prd.md
related_epics: epics.md
---

# Handoff: Chat Session tmux Migration

## Problem Statement

The Planning Workspace chat system currently spawns one node-pty process per conversation. This architecture breaks when running multiple agents or projects concurrently.

### Root Causes Identified

**1. Orphan UUID Routing Bug** (`src/main/services/chat-cli.service.ts:669-677`)
`findOrphanSession()` returns the FIRST session whose UUID doesn't match the incoming hook event. With multiple concurrent sessions, this routes hooks to the wrong session.

**2. No Session Persistence**
node-pty processes die on app restart. The system relies on Claude Code's `--resume` flag to restore context, which requires re-spawning the process and waiting for TUI ready detection.

**3. Single-Project UI Scoping** (`src/renderer/src/components/planning/ChatPanel.tsx:46-47`)
`project.getCurrent` returns only one project. Sessions from other projects' PTYs are invisible while consuming resources.

**4. No Background Session Visibility**
When switching agents, the UI disconnects from the old session (`setSessionId(null)` at `ChatPanel.tsx:185`). Message polling stops. The old PTY runs blind — no status feedback, no completion notification.

### How It Manifests

User starts PM agent chat → switches to Architect → PM session becomes invisible → hooks from PM may route to wrong session → switching back may find session idle-killed (30 min timeout) or in unknown state.

## Solution Decision

**Migrate chat sessions from node-pty to tmux** — the same pattern already used for task execution on the Kanban board.

### Why tmux

- Already battle-tested in the task system (`TaskTerminalService`, `TaskSessionService`)
- Persistent sessions survive app restart natively
- Stable session identifiers (tmux session names) eliminate orphan UUID bugs
- Independent session lifecycle — switching agents doesn't affect background sessions
- Unified architecture — one session model for all Claude Code interactions

### Why NOT Other Options

| Option | Rejected Because |
|--------|-----------------|
| Shared tmux + serialization | No true concurrency — agents pause when not in focus |
| Claude API SDK | Loses Claude Code's built-in tools (Read, Write, Edit, Bash, etc.) |
| Keep node-pty + fix bugs | Doesn't solve persistence or background visibility; patching orphan routing is fragile |

## Architecture: Two-Layer Model

```
tmux session (persistence layer)
  └─ PTY attached via ptyService.spawn(tmux attach ...)  (I/O layer)
       └─ claude --session-id {uuid}  (agent process)
            └─ hooks POST to /api/hooks/chat-*  (event routing)
```

**Key insight:** Use tmux for session persistence and lifecycle management, but attach a PTY to the tmux session for message I/O. This gives direct `ptyService.write()` control (byte-level stdin) instead of `tmux send-keys` (which has escaping issues with multi-line messages, code blocks, and special characters).

This is the same pattern the task system uses for terminal display:
- Task system: `ptyService.spawn('bash', ['-c', 'tmux attach-session -t tinsu-{project}-{taskId}'])` for xterm.js rendering
- Chat system: same attachment pattern, but for programmatic stdin writing instead of visual display

## Existing Patterns to Reuse

### From Task Terminal Service (`src/main/services/task-terminal.service.ts`)

| Pattern | Task System | Chat Adaptation |
|---------|------------|-----------------|
| Session naming | `tinsu-{project}-{taskId}` | `tinsu-chat-{sessionId}` |
| Session creation | `tmux new-session -d -s {name}` | Same |
| Session monitoring | `tmux has-session` polling every 2s | Same |
| Startup validation | `validateSessionsOnStartup()` — checks all DB sessions against tmux | Same pattern for `chat_sessions` |
| Session cache | `Map<taskId, tmuxSessionName>` | `Map<chatSessionId, tmuxSessionName>` |
| Security | `SAFE_SHELL_ARG_REGEX` for session names | Same |

### From Task Session Service (`src/main/services/task-session.service.ts`)

| Pattern | Reuse |
|---------|-------|
| `sessionToTaskCache` (Map for O(1) hook routing) | Adapt to `sessionToChatCache` for chat hook routing |
| Session history tracking | Adapt for chat session lifecycle events |

### Hook Infrastructure (Already Exists)

Chat-specific hook endpoints already exist and are separate from task hooks:
- `/api/hooks/chat-stop`
- `/api/hooks/chat-tool-use`
- `/api/hooks/chat-pre-tool-use`
- `/api/hooks/chat-notification`
- `/api/hooks/chat-status`

Hook scripts (`src/main/resources/chat-hooks/*.sh`) POST to these endpoints. The routing change is: instead of looking up `chat_sessions.session_uuid`, route by tmux session name (stable identifier).

## What Changed in the PRD

### New Functional Requirements (FR36-FR53)

| Group | FRs | Summary |
|-------|-----|---------|
| Planning Workspace | FR36-FR38 | Workspace UI, persona selector, chat interface |
| Session Management | FR39-FR43 | Persistent sessions, I/O channel, agent launch, event routing, message persistence |
| Concurrent Support | FR44-FR47 | Multiple simultaneous sessions, background execution, session list with status, resume |
| Multi-Project | FR48-FR50 | Project-scoped sessions, cross-project isolation, project-confined file operations |
| Persistence | FR51-FR53 | Survive app restart, startup validation, health monitoring |

### New Non-Functional Requirements (NFR25-NFR32)

| Group | NFRs | Key Metrics |
|-------|------|-------------|
| Concurrency | NFR25-NFR27 | 5+ concurrent sessions, <500ms switch, zero message loss in background |
| Reliability | NFR28-NFR30 | Zero context loss on restart, <5s startup validation, 100% hook routing accuracy |
| Lifecycle | NFR31-NFR32 | <15s session creation, <2s stale detection |

### New User Journey

**Journey 3: Multi-Agent Planning Session** — Founder works with PM agent, switches to Architect for technical input, switches back to PM. Three concurrent agents across two projects, all persistent across app restart.

## Files That Will Need Changes

### Backend (Main Process)

| File | Change |
|------|--------|
| `src/main/services/chat-cli.service.ts` | **Major refactor** — Replace node-pty spawning with tmux session creation + PTY attachment. Replace `writeWhenReady` with tmux-aware ready detection. Replace idle timeout with tmux monitoring. Remove orphan UUID logic. |
| `src/main/services/hook-listener.service.ts` | Update chat hook handlers to route by tmux session name instead of `session_uuid` DB lookup. Remove `tryRegisterChatOrphan`. |
| `src/main/services/index.ts` | Wire up new/refactored chat services |
| `src/main/trpc/routers/chat-session.router.ts` | Update `sendChatMessage` three-case handler for tmux-based sessions. Add startup validation call. |
| `src/main/db/schema.ts` | Add `tmux_session` column to `chat_sessions` table |
| `src/main/db/index.ts` | Migration for new column |

### Frontend (Renderer)

| File | Change |
|------|--------|
| `src/renderer/src/components/planning/ChatPanel.tsx` | Multi-project session awareness, session status badges |
| `src/renderer/src/stores/planning-workspace.store.ts` | Multi-project state if needed |
| `src/renderer/src/pages/PlanningWorkspacePage.tsx` | Layout updates for session status visibility |

### Hook Scripts

| File | Change |
|------|--------|
| `src/main/resources/chat-hooks/stop.sh` | May need to include tmux session identifier in payload |
| `src/main/resources/chat-hooks/status.sh` | Same — currently uses `TINSU_SESSION_UUID` env var |

## Schema Change

```sql
ALTER TABLE chat_sessions ADD COLUMN tmux_session TEXT;
```

The `tmux_session` column stores the tmux session name (e.g., `tinsu-chat-abc123`). This becomes the stable identifier for hook routing, replacing the `session_uuid` lookup that was prone to orphan mismatches.

## Open Questions for Architecture

1. **Should chat tmux sessions share the tmux server with task sessions?** Both use the default tmux server. This is probably fine (tmux handles hundreds of sessions), but worth confirming.

2. **Idle timeout strategy:** Keep the 30-minute idle kill? With tmux, sessions are cheaper to keep alive (no --resume needed). Could extend to 2 hours or remove entirely. Trade-off: resource usage vs. convenience.

3. **PTY attachment lifecycle:** Should the PTY remain attached to the tmux session permanently, or attach on-demand (when the user opens that chat) and detach when switching? Permanent attachment = simpler code. On-demand = fewer PTY processes.

4. **Hook script session identification:** Currently hooks receive `session_id` (Claude Code's UUID) in the payload. To route by tmux session name, we need either: (a) look up tmux_session from session_uuid in DB, or (b) pass tmux session name via env var to hook scripts. Option (b) is cleaner — `TINSU_TMUX_SESSION` env var alongside existing `TINSU_SESSION_UUID`.
