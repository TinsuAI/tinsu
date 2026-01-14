---
stepsCompleted: [1, 2, 3, 4]
status: complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd-task-execution-sandbox.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
featureName: 'Task Execution Sandbox'
parentPrd: '_bmad-output/planning-artifacts/prd-task-execution-sandbox.md'
date: '2026-01-12'
author: 'Tinxu'
---

# Task Execution Sandbox - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the **Task Execution Sandbox** feature, decomposing the requirements from the Feature PRD, Architecture extension, and UX Design specification into implementable stories.

## Requirements Inventory

### Functional Requirements

**Terminal Session Management (FR1-FR9)**
- FR1: User can view a dedicated terminal session for each task
- FR2: User can navigate away from a task and return to find the terminal session still active
- FR3: User can type commands directly into a task's terminal
- FR4: User can scroll through the complete terminal history (scrollback)
- FR5: System can create a new terminal session when a task moves to In Progress
- FR6: System can send commands to a task's terminal without user being attached
- FR7: System can detect when a terminal session ends or becomes unresponsive
- FR8: User can view terminal sessions that survive app restart
- FR9: User can view terminal sessions that survive system reboot

**Activity Logging (FR10-FR20)**
- FR10: System can capture status change events for each task
- FR11: System can capture agent start events when Claude Code begins work
- FR12: System can capture agent complete events when Claude Code finishes responding
- FR13: System can capture tool usage events (file edits, bash commands, git operations)
- FR14: System can capture user command events when user types in terminal
- FR15: System can capture automation trigger events when workflows auto-execute
- FR16: System can capture error events when agents or hooks fail
- FR17: User can view the activity log for a specific task
- FR18: User can filter the activity log by event type
- FR19: User can see activity events in real-time as they occur
- FR20: User can see timestamps for each activity event

**Task Detail View (FR21-FR25)**
- FR21: User can view task details with all 4 sections visible simultaneously on large screens (Terminal, Activities, Diff, Content in a quad-pane layout)
- FR22: User can expand any section to full-screen view and collapse back
- FR23: User can view task description and acceptance criteria in Content section
- FR24: User can switch between different tasks while preserving each task's state
- FR25: User can have multiple tasks open simultaneously (10+ concurrent)

**Diff Viewer (FR26-FR29)**
- FR26: User can view git diff of changes made by the agent
- FR27: User can see which files were added, modified, or deleted
- FR28: User can view side-by-side or unified diff format
- FR29: User can see the scope of changes at a glance (file count, line count)

**Workflow Automation (FR30-FR38)**
- FR30: System can differentiate between Story tasks and Basic tasks
- FR31: System can auto-execute dev-story command when Story task moves to In Progress
- FR32: System can auto-move Story task to Review when dev-story completes
- FR33: System can auto-execute code-review command when Story task enters Review
- FR34: System can auto-execute Claude Code with task description when Basic task moves to In Progress
- FR35: System can notify user when code-review is complete and ready for review
- FR36: User can manually trigger code-review via button (fallback)
- FR37: User can manually trigger any workflow command via button
- FR38: System can track current workflow phase for each task (dev-story, code-review, user-feedback)

**Scrollback Persistence (FR39-FR44)**
- FR39: System can backup terminal scrollback to filesystem
- FR40: System can restore terminal scrollback from backup when session is recreated
- FR41: System can backup scrollback on status change
- FR42: System can backup scrollback periodically (every 5 minutes while active)
- FR43: System can backup scrollback on app shutdown
- FR44: User can view scrollback even after system reboot

**Session-Task Mapping (FR45-FR47)**
- FR45: System can associate Claude Code session ID with task ID
- FR46: System can route hook events to correct task based on session ID
- FR47: System can rebuild session-task mapping from existing terminal sessions on app restart

### Non-Functional Requirements

**Performance**
- NFR1: Activity log event latency <1 second (events appear in UI within 1 second of occurrence)
- NFR2: Activity log filter/search <1 second (filter results return within 1 second)
- NFR3: Terminal streaming latency <500ms (active terminal output appears with <500ms delay)
- NFR4: Terminal scrollback load <2 seconds (inactive terminal history loads on-demand in <2 seconds)
- NFR5: Automation trigger latency <5 seconds (Story task auto-triggers within 5 seconds of status change)
- NFR6: Tab switching <200ms (switching between Terminal/Activities/Diff/Content tabs feels instant)
- NFR7: Concurrent task support 10+ tasks (system remains responsive with 10+ tasks with active terminals)
- NFR8: UI responsiveness with no jank (board and task detail views remain smooth during background terminal activity)

**Reliability**
- NFR9: Terminal persistence (app restart) 100% (all terminal sessions restore after app restart)
- NFR10: Terminal persistence (system reboot) 100% (scrollback backup restores after system reboot)
- NFR11: Activity log integrity with zero loss (no activity events lost during normal operation)
- NFR12: Automation success rate 99%+ (Story task automation triggers correctly 99%+ of the time)
- NFR13: Hook event delivery 99%+ (Claude Code hook events successfully reach TinSu)
- NFR14: Scrollback backup success 100% (periodic and on-event backups complete without failure)
- NFR15: Session-task mapping integrity 100% (session-task associations survive app restart)
- NFR16: Graceful degradation required (if tmux unavailable, show clear error and fallback options)

**Integration**
- NFR17: tmux must be installed on host system (macOS/Linux); app checks on startup and prompts installation if missing
- NFR18: Claude Code CLI must support Stop and PostToolUse hooks; version compatibility check on app startup
- NFR19: Hook scripts receive JSON via stdin with session_id, transcript_path, cwd, hook_event_name
- NFR20: Filesystem read/write access to `{appData}/terminal-history/` for scrollback backups
- NFR21: IPC via file watcher or HTTP localhost for Hook → Electron communication
- NFR22: xterm.js attach/detach to tmux sessions without losing state

**Data Integrity**
- NFR23: Activity log writes are atomic (no partial writes)
- NFR24: Scrollback backup is atomic (temp file + rename)
- NFR25: Session mapping is consistent (updated in transaction with status changes)
- NFR26: Crash recovery is automatic (app recovers state from SQLite + tmux list-sessions on restart)

### Additional Requirements

**From Architecture:**
- AR1: tmux session naming convention: `tinsu-{projectName}-{taskId}` for multi-project safety
- AR2: New database tables: `task_activities`, `task_sessions`, `app_settings`
- AR3: New services: TaskTerminalService, HookListenerService, ActivityLogService, AutomationService, ScrollbackBackupService
- AR4: New tRPC router: `activity.router.ts` with queries, subscriptions, and retention settings
- AR5: Updates to `agent.router.ts`: createTaskSession, sendTerminalCommand, getTaskSession procedures
- AR6: Claude Code hook configuration in `.claude/settings.json`
- AR7: Hook scripts: `task-completion.sh` (Stop hook), `log-tool-use.sh` (PostToolUse hook)
- AR8: HTTP endpoints for hook IPC: `/api/hooks/stop`, `/api/hooks/tool-use`, `/api/hooks/health`
- AR9: Scrollback storage location: `{app.getPath('userData')}/terminal-history/{taskId}/`
- AR10: Platform requirements: macOS and Linux for MVP (Windows via WSL deferred)
- AR11: Startup dependency check for tmux installation

**From UX Design:**
- UX1: Quad-pane Task Detail Layout — all 4 sections (Terminal, Activities, Diff, Content) visible simultaneously on large screens
- UX2: Expand-to-full button on each section for focused viewing; collapse back to quad-pane
- UX3: Panel width 60-70% viewport on desktop (to fit quad-pane), full-width on mobile with tabbed fallback
- UX4: Terminal tab: Status bar with phase indicator, xterm.js output, command input field, action buttons
- UX5: Activities tab: Filter chips (All, Status, Agent, User, Error), real-time streaming, event cards
- UX6: Diff tab: Summary bar, unified/split view toggle, file tree, Monaco diff viewer
- UX7: Content tab: Task header, markdown description, acceptance criteria checklist
- UX8: Task-type visual differentiation (Story badge with "Auto" icon vs Basic "Task" label)
- UX9: Workflow phase indicators showing progression through dev-story → code-review → Ready
- UX10: Manual trigger buttons: Run dev-story, Run code-review, Retry, Pause, Resume
- UX11: Keyboard shortcuts: 1-4 for tabs, D for dev-story, C for code-review, Space for pause/resume
- UX12: Parallel task UX: Active task streams live, inactive tasks load on-demand
- UX13: Error states with View Logs, Retry, Cancel Task actions
- UX14: Responsive: 50% desktop, 70% tablet, full-screen mobile overlay
- UX15: Accessibility: ARIA roles for tabs, log regions, status announcements

### FR Coverage Map

| FR Range | Epic | Description |
|----------|------|-------------|
| FR1-FR9 | Epic 1 | Terminal session management |
| FR10-FR20 | Epic 2 | Activity logging |
| FR21-FR25 | Epic 3 | Task detail workspace |
| FR26-FR29 | Epic 4 | Diff viewer |
| FR30-FR38 | Epic 5 | Workflow automation |
| FR39-FR44 | Epic 1 | Scrollback persistence |
| FR45-FR47 | Epic 1 | Session-task mapping |

## Epic List

### Epic 1: Per-Task Terminal Sessions
Users can view a dedicated, persistent terminal for each task — surviving navigation, app restart, and system reboot.

**User Outcome:** "I can switch between 10 tasks and never lose terminal context"

**FRs covered:** FR1-FR9, FR39-FR44, FR45-FR47
**Additional:** AR1, AR3 (TaskTerminalService, ScrollbackBackupService), AR9-AR11

### Epic 2: Activity Log & Event Tracking
Users can view a real-time, filterable timeline of everything happening on a task.

**User Outcome:** "I can debug any issue in 30 seconds by filtering the activity log"

**FRs covered:** FR10-FR20
**Additional:** AR2, AR3 (HookListenerService, ActivityLogService), AR4, AR6-AR8

### Epic 3: Quad-Pane Task Workspace
Users can view Terminal, Activities, Diff, and Content simultaneously with expand-to-full options.

**User Outcome:** "I have complete visibility of every task in one view"

**FRs covered:** FR21-FR25
**Additional:** UX1-UX3, UX8-UX15

### Epic 4: Git Diff Viewer
Users can review all code changes made by the agent with file tree and unified/split views.

**User Outcome:** "I can see exactly what the agent changed before I approve"

**FRs covered:** FR26-FR29
**Additional:** UX6

### Epic 5: Workflow Automation Engine
Story tasks automatically flow through dev-story → Review → code-review with manual fallbacks.

**User Outcome:** "My Story tasks run without intervention while Basic tasks give me control"

**FRs covered:** FR30-FR38
**Additional:** AR3 (AutomationService), AR5, UX4-UX5, UX7, UX10-UX11

---

## Epic 1: Per-Task Terminal Sessions

Users can view a dedicated, persistent terminal for each task — surviving navigation, app restart, and system reboot.

### Story 1.1: tmux Dependency Check & Installation Prompt
**Task ID:** `tes-1-1-tmux-dependency-check-and-installation-prompt`

As a user,
I want TinSu to check for tmux on startup and guide me to install it if missing,
So that I can use the terminal features without cryptic errors.

**Acceptance Criteria:**

**Given** TinSu is starting up
**When** the app initializes
**Then** it checks if tmux is installed by running `tmux -V`
**And** if tmux is found, startup continues normally

**Given** tmux is not installed on the system
**When** TinSu starts up
**Then** an error dialog displays with the message "tmux Required"
**And** the dialog includes install instructions for macOS (`brew install tmux`) and Linux (`apt install tmux`)
**And** the app does not proceed until the user acknowledges

**References:** FR7 (partial), AR10, AR11

---

### Story 1.2: Task Session Database Schema
**Task ID:** `tes-1-2-task-session-database-schema`

As a developer,
I want a task_sessions table to store terminal session mappings,
So that the system can track which tmux session belongs to which task.

**Acceptance Criteria:**

**Given** the database schema needs to support terminal sessions
**When** the migration runs
**Then** a `task_sessions` table is created with columns: id (TEXT PK), task_id (TEXT NOT NULL UNIQUE), session_id (TEXT), tmux_session (TEXT NOT NULL), current_phase (TEXT), created_at (INTEGER NOT NULL)
**And** a foreign key references tasks(id) with ON DELETE CASCADE
**And** an index exists on session_id for fast lookups

**Given** a task is deleted
**When** the deletion cascades
**Then** the associated task_session record is also deleted

**References:** FR45, AR2

---

### Story 1.3: tmux Session Creation Service
**Task ID:** `tes-1-3-tmux-session-creation-service`

As a user,
I want a tmux session created automatically when I move a task to In Progress,
So that the agent has an isolated terminal environment to work in.

**Acceptance Criteria:**

**Given** a task exists in Backlog or any non-In Progress status
**When** the user drags the task to In Progress
**Then** TaskTerminalService creates a new tmux session
**And** the session is named `tinsu-{projectName}-{taskId}`
**And** a task_sessions record is created linking the task to the tmux session

**Given** a tmux session already exists for the task
**When** the task moves to In Progress again
**Then** the existing session is reused (not duplicated)

**Given** tmux session creation fails
**When** the error is caught
**Then** an error toast displays "Failed to create terminal session"
**And** the error is logged with details

**References:** FR5, AR1, AR3

---

### Story 1.4: xterm.js Terminal Attachment
**Task ID:** `tes-1-4-xterm-js-terminal-attachment`

As a user,
I want to see real-time terminal output when viewing a task,
So that I can watch the agent work and see command results.

**Acceptance Criteria:**

**Given** a task has an active tmux session
**When** the user opens the task detail view
**Then** xterm.js attaches to the tmux session via node-pty
**And** existing terminal content (scrollback) is displayed
**And** new output streams in real-time with <500ms latency

**Given** the terminal is displaying output
**When** the user scrolls up in the terminal
**Then** they can view the complete scrollback history
**And** new output continues appending at the bottom

**Given** no tmux session exists for the task
**When** the user views the task detail
**Then** an empty terminal state displays "No active session"

**References:** FR1, FR4

---

### Story 1.5: User Command Input
**Task ID:** `tes-1-5-user-command-input`

As a user,
I want to type commands directly into the task terminal,
So that I can interact with the agent or run manual commands.

**Acceptance Criteria:**

**Given** a task has an active tmux session
**When** the user types in the terminal input field and presses Enter
**Then** the command is sent to tmux via `tmux send-keys -t {session} "{command}" Enter`
**And** the command appears in the terminal output
**And** the input field clears after sending

**Given** the terminal input field is focused
**When** the user presses Enter with an empty input
**Then** nothing is sent to tmux

**Given** a task terminal is in view
**When** the user presses `/` key (global shortcut)
**Then** the terminal input field receives focus

**References:** FR3, FR6

---

### Story 1.6: Terminal Persistence Across Navigation
**Task ID:** `tes-1-6-terminal-persistence-across-navigation`

As a user,
I want my terminal session to keep running when I navigate to other tasks,
So that I don't lose work in progress when switching context.

**Acceptance Criteria:**

**Given** a task has an active tmux session with a running process
**When** the user clicks on a different task
**Then** the tmux session continues running in the background
**And** the xterm.js instance detaches cleanly

**Given** a user previously navigated away from a task with an active session
**When** they return to that task
**Then** xterm.js reattaches to the existing tmux session
**And** all output generated while away is visible in scrollback
**And** live output resumes streaming immediately

**References:** FR2

---

### Story 1.7: Session-Task Mapping & Event Routing
**Task ID:** `tes-1-7-session-task-mapping-and-event-routing`

As a system,
I want to associate Claude Code session IDs with task IDs,
So that hook events can be routed to the correct task.

**Acceptance Criteria:**

**Given** Claude Code starts in a task's tmux session
**When** a Stop or PostToolUse hook fires with a session_id
**Then** the system looks up the task_id from task_sessions table
**And** routes the event to the correct task's activity log

**Given** a session_id is not found in task_sessions
**When** a hook event arrives
**Then** the event is logged as "orphan event" for debugging
**And** no error is thrown

**Given** Claude Code session starts
**When** the session_id becomes known (from hook payload)
**Then** the task_sessions record is updated with the session_id

**References:** FR45-FR47

---

### Story 1.8: Scrollback Backup Service
**Task ID:** `tes-1-8-scrollback-backup-service`

As a user,
I want my terminal history backed up automatically,
So that I don't lose important output if something goes wrong.

**Acceptance Criteria:**

**Given** a task has an active tmux session
**When** the task status changes (e.g., In Progress → Review)
**Then** ScrollbackBackupService captures scrollback via `tmux capture-pane -p -S -50000`
**And** saves it to `{userData}/terminal-history/{taskId}/scrollback.txt.gz`
**And** updates metadata.json with line count and timestamp

**Given** a task is active (In Progress status)
**When** 5 minutes have passed since last backup
**Then** a periodic backup is triggered automatically

**Given** the app is shutting down
**When** there are active tmux sessions
**Then** all sessions have their scrollback backed up before exit

**References:** FR39, FR41-FR43, AR9

---

### Story 1.9: Scrollback Restoration After App Restart
**Task ID:** `tes-1-9-scrollback-restoration-after-app-restart`

As a user,
I want to see my terminal history after restarting TinSu,
So that I can review what happened before the restart.

**Acceptance Criteria:**

**Given** a task has a scrollback backup file
**When** the user opens the task detail after app restart
**Then** the scrollback is restored from `scrollback.txt.gz`
**And** displayed in xterm.js before any live session attachment
**And** loading completes in <2 seconds

**Given** a tmux session still exists (survived restart)
**When** the user opens the task
**Then** xterm.js attaches to the live session
**And** the backup scrollback is prepended if there's a gap

**Given** no backup exists for a task
**When** the user opens the task after restart
**Then** the terminal shows only live session content (or empty state)

**References:** FR8, FR40

---

### Story 1.10: Scrollback Survival After System Reboot
**Task ID:** `tes-1-10-scrollback-survival-after-system-reboot`

As a user,
I want my terminal history to survive a system reboot,
So that I can review past work even after restarting my computer.

**Acceptance Criteria:**

**Given** the system was rebooted
**When** TinSu starts and the user opens a task
**Then** the scrollback is restored from the filesystem backup
**And** the user can scroll through the complete history from before reboot

**Given** a task had an active session before reboot
**When** TinSu starts after reboot
**Then** the task_sessions record is updated to reflect no active tmux session
**And** the task can start a new session if moved to In Progress

**References:** FR9, FR44

---

### Story 1.11: Session End & Unresponsive Detection
**Task ID:** `tes-1-11-session-end-and-unresponsive-detection`

As a user,
I want to know when a terminal session ends or becomes unresponsive,
So that I can take appropriate action.

**Acceptance Criteria:**

**Given** a tmux session is running
**When** the process inside the session exits
**Then** the system detects the session ended
**And** the task status bar updates to show "Session ended"
**And** an activity event is logged

**Given** a tmux session exists
**When** `tmux has-session -t {session}` returns error
**Then** the system marks the session as ended
**And** cleans up the task_sessions record

**Given** stall detection is enabled
**When** no output is received for 5 minutes
**Then** the status changes to "Stalled"
**And** a warning indicator appears on the task card

**References:** FR7

---

## Epic 2: Activity Log & Event Tracking

Users can view a real-time, filterable timeline of everything happening on a task.

### Story 2.1: Task Activities Database Schema
**Task ID:** `tes-2-1-task-activities-database-schema`

As a developer,
I want a task_activities table to store all task events,
So that the system can maintain a complete audit trail.

**Acceptance Criteria:**

**Given** the database schema needs to support activity logging
**When** the migration runs
**Then** a `task_activities` table is created with columns: id (TEXT PK), task_id (TEXT NOT NULL), event_type (TEXT NOT NULL), payload (TEXT for JSON), created_at (INTEGER NOT NULL)
**And** a foreign key references tasks(id) with ON DELETE CASCADE
**And** indexes exist on task_id, event_type, and created_at for fast queries

**Given** a task is deleted
**When** the deletion cascades
**Then** all associated activity records are also deleted

**References:** FR10 (partial), AR2

---

### Story 2.2: Activity Log Service (Core)
**Task ID:** `tes-2-2-activity-log-service-core`

As a system,
I want an ActivityLogService to write and read activity events,
So that all task events are captured reliably.

**Acceptance Criteria:**

**Given** an event occurs on a task
**When** logActivity(taskId, eventType, payload) is called
**Then** a new record is inserted into task_activities
**And** the write is atomic (no partial writes)
**And** the function returns the created Activity object

**Given** a user requests activity history
**When** getActivities(taskId, options) is called
**Then** activities are returned sorted by created_at descending
**And** optional filters (eventTypes, limit, offset, since) are applied

**Given** multiple events occur simultaneously
**When** they are logged
**Then** each event gets a unique id and accurate timestamp
**And** no events are lost

**References:** FR10-FR16

---

### Story 2.3: Hook Listener HTTP Server
**Task ID:** `tes-2-3-hook-listener-http-server`

As a system,
I want an HTTP server to receive Claude Code hook events,
So that hook scripts can communicate with TinSu reliably.

**Acceptance Criteria:**

**Given** TinSu is starting up
**When** HookListenerService initializes
**Then** an HTTP server starts on a configurable port (default 3847)
**And** the port is written to /tmp/tinsu-hook-port for hook scripts to read

**Given** the hook server is running
**When** a POST request arrives at /api/hooks/stop
**Then** the Stop hook payload is parsed and processed
**And** the response returns 200 OK

**Given** the hook server is running
**When** a POST request arrives at /api/hooks/tool-use
**Then** the PostToolUse payload is parsed and processed
**And** the response returns 200 OK

**Given** the hook server is running
**When** a GET request arrives at /api/hooks/health
**Then** the response returns 200 with { status: "ok" }

**Given** TinSu is shutting down
**When** the app exits
**Then** the HTTP server stops gracefully

**References:** AR3, AR8

---

### Story 2.4: Claude Code Hook Scripts
**Task ID:** `tes-2-4-claude-code-hook-scripts`

As a developer,
I want hook scripts that send events to TinSu,
So that Claude Code activities are captured automatically.

**Acceptance Criteria:**

**Given** the project needs Claude Code integration
**When** hook scripts are created
**Then** `.claude/hooks/task-completion.sh` exists and is executable
**And** `.claude/hooks/log-tool-use.sh` exists and is executable

**Given** task-completion.sh receives a Stop hook event
**When** the script runs
**Then** it reads JSON from stdin
**And** sends a POST to http://localhost:{port}/api/hooks/stop
**And** fails silently if TinSu is not running (exit 0)

**Given** log-tool-use.sh receives a PostToolUse event
**When** the script runs
**Then** it reads JSON from stdin
**And** sends a POST to http://localhost:{port}/api/hooks/tool-use
**And** fails silently if TinSu is not running

**Given** hooks need to be configured
**When** the project is set up
**Then** `.claude/settings.json` contains Stop and PostToolUse hook configurations pointing to the scripts

**References:** AR6, AR7

---

### Story 2.5: Status Change Event Capture
**Task ID:** `tes-2-5-status-change-event-capture`

As a user,
I want status changes logged automatically,
So that I can see when tasks moved between columns.

**Acceptance Criteria:**

**Given** a task exists in any status
**When** the task status changes (e.g., Backlog → In Progress)
**Then** an activity event is logged with event_type: "status_change"
**And** payload contains { from: "backlog", to: "in_progress" }
**And** the timestamp reflects when the change occurred

**Given** multiple status changes happen rapidly
**When** they are logged
**Then** each change is captured as a separate event in order

**References:** FR10

---

### Story 2.6: Agent Start/Complete Event Capture
**Task ID:** `tes-2-6-agent-start-complete-event-capture`

As a user,
I want to see when agents start and finish working,
So that I can track execution phases.

**Acceptance Criteria:**

**Given** Claude Code starts working on a task
**When** the agent begins execution
**Then** an activity event is logged with event_type: "agent_start"
**And** payload contains { phase: "dev-story" | "code-review" | "manual" }

**Given** a Stop hook fires for a task
**When** the hook event is received
**Then** an activity event is logged with event_type: "agent_complete"
**And** payload contains { phase, duration_ms, session_id }

**Given** agent_start was logged
**When** agent_complete is logged
**Then** duration_ms is calculated from the start event

**References:** FR11, FR12

---

### Story 2.7: Tool Usage Event Capture
**Task ID:** `tes-2-7-tool-usage-event-capture`

As a user,
I want to see what tools the agent used,
So that I can understand what actions were taken.

**Acceptance Criteria:**

**Given** a PostToolUse hook fires
**When** the hook event is received by HookListenerService
**Then** an activity event is logged with event_type: "tool_used"
**And** payload contains { tool: "Edit" | "Bash" | "Read" | etc., file?: string, summary?: string }

**Given** the agent edits a file
**When** the tool_used event is logged
**Then** the payload includes the file path and change summary (e.g., "+45 -12")

**Given** the agent runs a bash command
**When** the tool_used event is logged
**Then** the payload includes the command (truncated if long)

**References:** FR13

---

### Story 2.8: User Command Event Capture
**Task ID:** `tes-2-8-user-command-event-capture`

As a user,
I want my terminal commands logged,
So that I have a record of my interactions.

**Acceptance Criteria:**

**Given** a user types a command in the task terminal
**When** the command is sent to tmux
**Then** an activity event is logged with event_type: "user_command"
**And** payload contains { command: "the command text" }

**Given** the user sends an empty command
**When** Enter is pressed with no input
**Then** no user_command event is logged

**References:** FR14

---

### Story 2.9: Automation Trigger Event Capture
**Task ID:** `tes-2-9-automation-trigger-event-capture`

As a user,
I want to see when automation triggers fire,
So that I understand what happened automatically.

**Acceptance Criteria:**

**Given** a Story task completes dev-story phase
**When** code-review is auto-triggered
**Then** an activity event is logged with event_type: "automation_trigger"
**And** payload contains { command: "code-review", trigger: "dev-story-complete" }

**Given** a Story task moves to In Progress
**When** dev-story is auto-triggered
**Then** an activity event is logged with event_type: "automation_trigger"
**And** payload contains { command: "dev-story", trigger: "status-in-progress" }

**References:** FR15

---

### Story 2.10: Error Event Capture
**Task ID:** `tes-2-10-error-event-capture`

As a user,
I want errors logged prominently,
So that I can quickly identify what went wrong.

**Acceptance Criteria:**

**Given** an agent encounters an error
**When** the error is detected (via hook or process exit)
**Then** an activity event is logged with event_type: "error"
**And** payload contains { message, code?, stack? }

**Given** a hook script fails to deliver
**When** the HTTP request fails
**Then** an error event is logged with details about the delivery failure

**Given** tmux session creation fails
**When** the error is caught
**Then** an error event is logged for the task

**References:** FR16

---

### Story 2.11: Activity Log UI Display
**Task ID:** `tes-2-11-activity-log-ui-display`

As a user,
I want to see the activity log for a task,
So that I can review what happened.

**Acceptance Criteria:**

**Given** a task has activity events
**When** the user views the Activities section
**Then** events are displayed in reverse chronological order (newest first)
**And** each event shows: timestamp, event type icon, description
**And** timestamps are formatted as HH:MM:SS

**Given** an event has a payload with details
**When** the event is displayed
**Then** relevant details are shown (e.g., file path for tool_used, command for user_command)

**Given** a task has no activity events
**When** the user views the Activities section
**Then** an empty state displays "No activity yet"

**References:** FR17, FR20

---

### Story 2.12: Activity Log Filtering
**Task ID:** `tes-2-12-activity-log-filtering`

As a user,
I want to filter the activity log by event type,
So that I can focus on specific events.

**Acceptance Criteria:**

**Given** the activity log is displayed
**When** the user clicks the "Status" filter chip
**Then** only status_change events are shown
**And** the chip appears selected (highlighted)

**Given** filter chips exist for each category
**When** displayed
**Then** chips are: All, Status, Agent, User, Error
**And** "Agent" includes: agent_start, agent_complete, tool_used
**And** "Error" filter highlights error events prominently

**Given** multiple filters are selected
**When** events are filtered
**Then** events matching ANY selected filter are shown (OR logic)

**Given** the "All" chip is selected
**When** events are displayed
**Then** all event types are shown

**References:** FR18

---

### Story 2.13: Real-Time Activity Streaming
**Task ID:** `tes-2-13-real-time-activity-streaming`

As a user,
I want to see new activities appear in real-time,
So that I can monitor task progress live.

**Acceptance Criteria:**

**Given** the Activities section is open for a task
**When** a new activity event is logged
**Then** the event appears at the top of the list within 1 second
**And** the event animates in (slide + fade)

**Given** the user has scrolled up in the activity log
**When** new events arrive
**Then** events are added to the top but view doesn't auto-scroll
**And** a "New events" indicator appears
**And** clicking the indicator scrolls to the top

**Given** multiple events arrive rapidly
**When** they are streamed
**Then** all events appear in correct order without duplicates

**Given** the tRPC subscription is active
**When** a new activity is logged via ActivityLogService
**Then** subscribers for that taskId receive the event immediately

**References:** FR19, AR4

---

## Epic 3: Quad-Pane Task Workspace

Users can view Terminal, Activities, Diff, and Content simultaneously with expand-to-full options.

### Story 3.1: Task Detail Panel Container
**Task ID:** `tes-3-1-task-detail-panel-container`

As a user,
I want a task detail panel that slides in when I select a task,
So that I can view task information without losing board context.

**Acceptance Criteria:**

**Given** the user is viewing the Kanban board
**When** the user clicks on a task card
**Then** a detail panel slides in from the right
**And** the panel width is 60-70% of viewport on desktop
**And** the board remains partially visible behind

**Given** the detail panel is open
**When** the user clicks outside the panel or presses Escape
**Then** the panel slides out and closes
**And** focus returns to the previously selected task card

**Given** the detail panel is open
**When** the user clicks a different task card
**Then** the panel content updates to show the new task
**And** no slide animation occurs (instant switch)

**References:** FR21, UX3

---

### Story 3.2: Quad-Pane Layout
**Task ID:** `tes-3-2-quad-pane-layout`

As a user,
I want to see Terminal, Activities, Diff, and Content all at once,
So that I have complete visibility without switching tabs.

**Acceptance Criteria:**

**Given** the task detail panel is open on a large screen (1024px+)
**When** the layout renders
**Then** four sections are displayed in a 2x2 grid
**And** Terminal is top-left, Activities is top-right
**And** Diff is bottom-left, Content is bottom-right

**Given** each section in the quad-pane
**When** displayed
**Then** each section has a header with section name
**And** each section has an expand button in the header
**And** sections have subtle borders for visual separation

**Given** the viewport is resized
**When** width remains above 1024px
**Then** the quad-pane layout is maintained with proportional sizing

**References:** FR21, UX1

---

### Story 3.3: Section Expand/Collapse
**Task ID:** `tes-3-3-section-expand-collapse`

As a user,
I want to expand any section to full view,
So that I can focus on one aspect when needed.

**Acceptance Criteria:**

**Given** a section is displayed in quad-pane view
**When** the user clicks the expand button (or presses keyboard shortcut)
**Then** that section expands to fill the entire panel
**And** other sections are hidden
**And** a collapse button appears in the header

**Given** a section is in expanded view
**When** the user clicks the collapse button (or presses Escape)
**Then** the view returns to quad-pane layout
**And** all four sections are visible again

**Given** a section is expanded
**When** the user presses number keys 1-4
**Then** the view switches to the corresponding section expanded
**And** transition is smooth (<200ms)

**References:** FR22, UX2

---

### Story 3.4: Terminal Section Integration
**Task ID:** `tes-3-4-terminal-section-integration`

As a user,
I want the Terminal section to show my task's terminal,
So that I can watch agent work within the quad-pane.

**Acceptance Criteria:**

**Given** a task has an active tmux session
**When** the Terminal section is displayed
**Then** xterm.js renders within the section bounds
**And** output streams in real-time
**And** scrolling works within the section

**Given** the Terminal section is displayed
**When** rendered
**Then** a status bar shows: task status, elapsed time, current phase
**And** the command input field is at the bottom of the section

**Given** the Terminal section is in quad-pane (smaller size)
**When** the user wants more detail
**Then** they can expand to full view for more terminal real estate

**References:** UX4

---

### Story 3.5: Activities Section Integration
**Task ID:** `tes-3-5-activities-section-integration`

As a user,
I want the Activities section to show the event log,
So that I can monitor task events in the quad-pane.

**Acceptance Criteria:**

**Given** a task has activity events
**When** the Activities section is displayed
**Then** events are shown in a scrollable list
**And** filter chips are visible at the top of the section

**Given** the Activities section is in quad-pane
**When** new events arrive
**Then** they animate in at the top
**And** real-time streaming works as in Epic 2

**Given** the Activities section has limited height
**When** there are many events
**Then** the section scrolls independently
**And** the filter chips remain fixed at the top

**References:** UX5

---

### Story 3.6: Content Section Display
**Task ID:** `tes-3-6-content-section-display`

As a user,
I want to see the task description and acceptance criteria,
So that I can reference what needs to be done.

**Acceptance Criteria:**

**Given** a task is selected
**When** the Content section is displayed
**Then** the task title appears as a header
**And** the description is rendered as markdown
**And** acceptance criteria are displayed as a checklist

**Given** acceptance criteria exist
**When** displayed
**Then** each criterion shows a checkbox icon
**And** completed criteria show a green checkmark
**And** pending criteria show an empty circle

**Given** the content is longer than the section height
**When** the section is in quad-pane
**Then** the section scrolls independently
**And** the task title remains fixed at the top

**References:** FR23, UX7

---

### Story 3.7: Task State Preservation
**Task ID:** `tes-3-7-task-state-preservation`

As a user,
I want my panel state preserved when switching tasks,
So that I don't lose my place when multitasking.

**Acceptance Criteria:**

**Given** the user has scrolled within a section (e.g., Activities)
**When** they switch to a different task and back
**Then** the scroll position is restored for the original task

**Given** the user has expanded a section to full view
**When** they switch tasks and return
**Then** the expanded state is preserved for that task

**Given** multiple tasks have been viewed in the session
**When** the user navigates between them
**Then** each task's panel state is maintained independently

**References:** FR24

---

### Story 3.8: Concurrent Task Support (10+)
**Task ID:** `tes-3-8-concurrent-task-support-10-plus`

As a user,
I want the system to handle many tasks smoothly,
So that I can work on multiple tasks in parallel.

**Acceptance Criteria:**

**Given** 10+ tasks are in In Progress or Review status
**When** the user navigates between them
**Then** the UI remains responsive with no jank
**And** panel switching completes in <200ms

**Given** a task is not currently viewed
**When** it has an active terminal session
**Then** the session continues in the background
**And** xterm.js is not rendered (memory efficient)

**Given** a task becomes active (viewed)
**When** the panel opens
**Then** terminal content loads on-demand in <2 seconds
**And** activities load with pagination if needed

**References:** FR25, UX12

---

### Story 3.9: Task Type Visual Differentiation
**Task ID:** `tes-3-9-task-type-visual-differentiation`

As a user,
I want to see whether a task is a Story or Basic task,
So that I know what automation to expect.

**Acceptance Criteria:**

**Given** a Story task (BMAD-generated) is displayed
**When** the panel header renders
**Then** a "Story" badge appears with purple background
**And** an "Auto" icon indicates automation is enabled

**Given** a Basic task (user-created) is displayed
**When** the panel header renders
**Then** a "Task" label appears with muted gray background
**And** no automation icon is shown

**Given** the task type badge is displayed
**When** the user hovers over it
**Then** a tooltip explains the difference (e.g., "Story tasks auto-run code-review")

**References:** UX8

---

### Story 3.10: Workflow Phase Indicator
**Task ID:** `tes-3-10-workflow-phase-indicator`

As a user,
I want to see the current workflow phase,
So that I know where the task is in the automation pipeline.

**Acceptance Criteria:**

**Given** a Story task is in dev-story phase
**When** the phase indicator is displayed
**Then** it shows "dev-story" with a running indicator
**And** the progress shows step 1 of 2

**Given** a Story task is in code-review phase
**When** the phase indicator is displayed
**Then** it shows "code-review" with a running indicator
**And** the progress shows step 2 of 2

**Given** code-review is complete
**When** the phase indicator is displayed
**Then** it shows "Ready for review" with a checkmark
**And** the progress bar is complete

**Given** a Basic task is running
**When** the phase indicator is displayed
**Then** it shows "Running" with no numbered steps

**References:** UX9

---

### Story 3.11: Keyboard Navigation
**Task ID:** `tes-3-11-keyboard-navigation`

As a user,
I want to navigate the quad-pane with keyboard,
So that I can work efficiently without a mouse.

**Acceptance Criteria:**

**Given** the task detail panel is open
**When** the user presses `1`
**Then** focus moves to the Terminal section
**And** the section is highlighted

**Given** the panel is open
**When** the user presses `2`, `3`, or `4`
**Then** focus moves to Activities, Diff, or Content respectively

**Given** a section has focus
**When** the user presses `Enter` or `E`
**Then** that section expands to full view

**Given** a section is expanded
**When** the user presses `Escape`
**Then** the view collapses back to quad-pane

**Given** the Terminal section has focus
**When** the user presses `/`
**Then** the terminal input field receives focus

**References:** UX11

---

### Story 3.12: Responsive Layout
**Task ID:** `tes-3-12-responsive-layout`

As a user,
I want the layout to adapt to smaller screens,
So that I can use TinSu on tablet or mobile for intervention.

**Acceptance Criteria:**

**Given** the viewport is 768-1023px (tablet)
**When** the task detail panel is open
**Then** sections stack vertically (single column)
**And** each section is collapsible
**And** panel width is 70% of viewport

**Given** the viewport is <768px (mobile)
**When** the task detail panel is open
**Then** the panel is full-width overlay
**And** sections display as tabs (fallback to tabbed interface)
**And** swipe gestures switch between tabs

**Given** the viewport is resized
**When** crossing breakpoints
**Then** the layout adapts smoothly without content loss

**References:** UX14

---

### Story 3.13: Accessibility
**Task ID:** `tes-3-13-accessibility`

As a user with accessibility needs,
I want the quad-pane to be fully accessible,
So that I can use screen readers and keyboard navigation.

**Acceptance Criteria:**

**Given** the task detail panel is open
**When** a screen reader parses the content
**Then** the panel has `role="dialog"` with aria-label "Task details: {task title}"
**And** each section has `role="region"` with appropriate aria-label

**Given** the Activities section updates
**When** new events arrive
**Then** the section has `aria-live="polite"` for announcements
**And** screen reader announces "New activity: {event type}"

**Given** the Terminal section is active
**When** output streams
**Then** the terminal has `role="log"`
**And** critical updates are announced

**Given** focus moves between sections
**When** using keyboard navigation
**Then** focus is visible with a clear indicator
**And** focus order follows the visual layout (left-to-right, top-to-bottom)

**References:** UX15

---

## Epic 4: Git Diff Viewer

Users can review all code changes made by the agent with file tree and unified/split views.

### Story 4.1: Git Diff Data Fetching
**Task ID:** `tes-4-1-git-diff-data-fetching`

As a user,
I want to fetch the git diff for a task's changes,
So that I can see what the agent modified.

**Acceptance Criteria:**

**Given** a task has an associated git worktree
**When** the Diff section requests data
**Then** the system runs `git diff` against the task's branch
**And** returns a structured diff object with files and hunks

**Given** the task's worktree has uncommitted changes
**When** the diff is fetched
**Then** both staged and unstaged changes are included
**And** the diff reflects the current working state

**Given** the task has no changes yet
**When** the diff is fetched
**Then** an empty diff is returned
**And** the UI shows "No changes yet"

**Given** git diff fails (e.g., worktree missing)
**When** the error is caught
**Then** an error state is displayed with "Unable to load diff"

**References:** FR26, FR27

---

### Story 4.2: Diff Summary Bar
**Task ID:** `tes-4-2-diff-summary-bar`

As a user,
I want to see a summary of changes at a glance,
So that I can quickly assess the scope of work.

**Acceptance Criteria:**

**Given** a diff has been loaded
**When** the summary bar is displayed
**Then** it shows: "{N} files changed · +{added} lines · -{removed} lines"

**Given** the diff includes new files
**When** the summary is calculated
**Then** new files are counted in the file total
**And** all their lines count as additions

**Given** the user wants to refresh the diff
**When** they click the Refresh button
**Then** the diff is re-fetched from the worktree
**And** the summary updates to reflect current state

**Given** a diff is loading
**When** the Refresh button was clicked
**Then** a loading spinner appears on the button
**And** the button is disabled until complete

**References:** FR29

---

### Story 4.3: File Tree Component
**Task ID:** `tes-4-3-file-tree-component`

As a user,
I want to see a list of changed files,
So that I can navigate to specific changes.

**Acceptance Criteria:**

**Given** a diff contains changed files
**When** the file tree is displayed
**Then** each file shows: filename, change indicator, line stats (+N -M)

**Given** a file was added (new)
**When** displayed in the tree
**Then** it shows a green "+" icon and "(new)" label

**Given** a file was modified
**When** displayed in the tree
**Then** it shows an orange "●" icon

**Given** a file was deleted
**When** displayed in the tree
**Then** it shows a red "-" icon and "(deleted)" label

**Given** a file entry in the tree
**When** the user clicks on it
**Then** the diff viewer scrolls to that file's diff
**And** the file is highlighted as selected

**Given** many files are changed
**When** the tree is displayed
**Then** it is scrollable independently
**And** files are sorted: modified first, then added, then deleted

**References:** FR27

---

### Story 4.4: Monaco Diff Viewer Integration
**Task ID:** `tes-4-4-monaco-diff-viewer-integration`

As a user,
I want to see syntax-highlighted diffs,
So that I can easily read and understand code changes.

**Acceptance Criteria:**

**Given** a file diff is displayed
**When** Monaco diff editor renders
**Then** the original (left) and modified (right) versions are shown
**And** syntax highlighting matches the file type (detected from extension)

**Given** a diff hunk shows added lines
**When** rendered
**Then** added lines have green background (rgba(34, 197, 94, 0.15))
**And** the "+" gutter indicator is visible

**Given** a diff hunk shows removed lines
**When** rendered
**Then** removed lines have red background (rgba(239, 68, 68, 0.15))
**And** the "-" gutter indicator is visible

**Given** the diff viewer is displayed
**When** the user scrolls
**Then** both sides scroll in sync (in split view)
**And** line numbers are visible in the gutter

**Given** a large file with many changes
**When** displayed
**Then** unchanged sections are collapsed by default
**And** clicking expands to show context

**References:** FR26

---

### Story 4.5: Unified vs Split View Toggle
**Task ID:** `tes-4-5-unified-vs-split-view-toggle`

As a user,
I want to switch between unified and split diff views,
So that I can choose my preferred review style.

**Acceptance Criteria:**

**Given** the diff viewer is displayed
**When** the view toggle shows "Unified" selected
**Then** changes are shown interleaved (removed then added)
**And** single column layout is used

**Given** the diff viewer is displayed
**When** the view toggle shows "Split" selected
**Then** original is on the left, modified on the right
**And** two-column side-by-side layout is used

**Given** the user clicks the toggle
**When** switching between views
**Then** the view updates immediately (<200ms)
**And** scroll position is preserved as closely as possible

**Given** a view preference is selected
**When** the user closes and reopens the diff
**Then** their preference is persisted (localStorage)
**And** the same view mode is restored

**References:** FR28

---

### Story 4.6: Diff Section in Quad-Pane
**Task ID:** `tes-4-6-diff-section-in-quad-pane`

As a user,
I want the diff viewer integrated into the quad-pane,
So that I can review changes alongside other task info.

**Acceptance Criteria:**

**Given** the quad-pane layout is displayed
**When** the Diff section is visible
**Then** the file tree and summary bar are shown
**And** the Monaco diff viewer fits within the section bounds

**Given** the Diff section is in quad-pane (limited space)
**When** displayed
**Then** the file tree collapses to icons only (expandable)
**And** the diff viewer uses available space efficiently

**Given** the user expands the Diff section to full view
**When** expanded
**Then** the file tree expands to show full filenames
**And** the Monaco viewer has more vertical space
**And** split view becomes more usable

**Given** the Diff section has focus
**When** the user presses `[` or `]` keys
**Then** navigation moves to previous/next file in the tree

**References:** UX6

---

## Epic 5: Workflow Automation Engine

Story tasks automatically flow through dev-story → Review → code-review with manual fallbacks.

### Story 5.1: Task Type Field & Differentiation
**Task ID:** `tes-5-1-task-type-field-and-differentiation`

As a system,
I want to differentiate between Story and Basic tasks,
So that automation rules can be applied appropriately.

**Acceptance Criteria:**

**Given** a task is created from BMAD epics/stories
**When** the task is saved
**Then** the task_type field is set to "story"

**Given** a task is created manually by the user
**When** the task is saved
**Then** the task_type field is set to "basic"

**Given** a task exists
**When** queried
**Then** the task_type is available for automation decisions
**And** UI can display appropriate badge (Story vs Task)

**Given** the database schema
**When** migration runs
**Then** tasks table has task_type column (TEXT, default "basic")

**References:** FR30

---

### Story 5.2: Automation Service Core
**Task ID:** `tes-5-2-automation-service-core`

As a system,
I want an AutomationService that responds to task events,
So that workflow rules are applied consistently.

**Acceptance Criteria:**

**Given** a task status changes
**When** the change is committed to database
**Then** AutomationService.onStatusChange(taskId, newStatus) is called

**Given** AutomationService receives a status change
**When** processing
**Then** it looks up the task type
**And** applies the appropriate automation rule

**Given** a Stop hook fires
**When** AutomationService.onAgentComplete(taskId, phase) is called
**Then** it determines the next action based on task type and phase

**Given** automation rules execute
**When** they trigger commands
**Then** they use TaskTerminalService to send commands to tmux
**And** they log automation_trigger events via ActivityLogService

**References:** AR3, AR5

---

### Story 5.3: Story Task Auto-Execute dev-story
**Task ID:** `tes-5-3-story-task-auto-execute-dev-story`

As a user,
I want my Story tasks to automatically start dev-story when moved to In Progress,
So that work begins without manual intervention.

**Acceptance Criteria:**

**Given** a Story task exists in Backlog
**When** the user moves it to In Progress
**Then** AutomationService triggers within 5 seconds
**And** sends the dev-story command to the task's tmux session
**And** the command includes the story content as context

**Given** dev-story is triggered
**When** the command is sent
**Then** task_sessions.current_phase is updated to "dev-story"
**And** an agent_start activity event is logged
**And** an automation_trigger activity event is logged

**Given** the Story task is already in In Progress with an active session
**When** moved to In Progress again (e.g., from Review back)
**Then** dev-story is NOT auto-triggered again
**And** the existing session continues

**References:** FR31

---

### Story 5.4: Story Task Auto-Move to Review
**Task ID:** `tes-5-4-story-task-auto-move-to-review`

As a user,
I want my Story tasks to automatically move to Review when dev-story completes,
So that the workflow progresses without manual column dragging.

**Acceptance Criteria:**

**Given** a Story task is in In Progress with phase "dev-story"
**When** the Stop hook fires (agent_complete)
**Then** AutomationService moves the task to Review status
**And** a status_change activity event is logged

**Given** the task moves to Review
**When** the status change occurs
**Then** the UI updates to show the task in the Review column
**And** no additional user action is required

**Given** dev-story completes with an error
**When** the Stop hook fires with error context
**Then** the task remains in In Progress
**And** an error activity event is logged
**And** user is notified of the failure

**References:** FR32

---

### Story 5.5: Story Task Auto-Execute code-review
**Task ID:** `tes-5-5-story-task-auto-execute-code-review`

As a user,
I want code-review to automatically run when my Story task enters Review,
So that review happens without manual triggering.

**Acceptance Criteria:**

**Given** a Story task enters Review status
**When** AutomationService processes the status change
**Then** code-review command is sent to the task's tmux session
**And** task_sessions.current_phase is updated to "code-review"
**And** automation_trigger activity event is logged

**Given** code-review is triggered
**When** the command is sent
**Then** it uses the /code-review slash command or equivalent
**And** the agent begins reviewing the changes

**Given** a Story task is manually moved to Review (not from auto-move)
**When** it enters Review
**Then** code-review is still auto-triggered
**And** the same automation flow applies

**References:** FR33

---

### Story 5.6: Basic Task Auto-Execute with Description
**Task ID:** `tes-5-6-basic-task-auto-execute-with-description`

As a user,
I want my Basic tasks to automatically start Claude Code when moved to In Progress,
So that ad-hoc tasks also get agent assistance.

**Acceptance Criteria:**

**Given** a Basic task exists in Backlog
**When** the user moves it to In Progress
**Then** AutomationService triggers within 5 seconds
**And** sends Claude Code command with the task description as the prompt

**Given** the Basic task has a description
**When** the command is built
**Then** the description is passed as the prompt to Claude Code
**And** no BMAD-specific workflow commands are used

**Given** a Basic task completes (Stop hook)
**When** the agent finishes
**Then** the task moves to Review automatically
**And** NO code-review is auto-triggered (manual review only)

**References:** FR34

---

### Story 5.7: Code-Review Complete Notification
**Task ID:** `tes-5-7-code-review-complete-notification`

As a user,
I want to be notified when code-review completes,
So that I know a task is ready for my review.

**Acceptance Criteria:**

**Given** a Story task is in code-review phase
**When** the Stop hook fires (agent_complete)
**Then** task_sessions.current_phase is updated to "user-feedback"
**And** user receives a notification

**Given** the notification is triggered
**When** displayed
**Then** a toast appears: "Task '{title}' ready for your review"
**And** the toast has an action button to navigate to the task

**Given** the task card on the board
**When** code-review completes
**Then** the card shows a "Ready for review" indicator
**And** the status badge updates to purple with checkmark

**References:** FR35

---

### Story 5.8: Workflow Phase Tracking
**Task ID:** `tes-5-8-workflow-phase-tracking`

As a system,
I want to track the current workflow phase for each task,
So that automation decisions are based on accurate state.

**Acceptance Criteria:**

**Given** a Story task begins workflow
**When** phases progress
**Then** task_sessions.current_phase reflects: "dev-story" → "code-review" → "user-feedback"

**Given** the phase indicator queries phase
**When** displayed in UI
**Then** it shows the correct current phase
**And** the phase is read from task_sessions table

**Given** a task is restarted (moved back to In Progress)
**When** the status changes
**Then** current_phase is reset to null
**And** automation can re-trigger dev-story

**Given** a Basic task is running
**When** phase is queried
**Then** current_phase is "manual" or null (no workflow phases)

**References:** FR38

---

### Story 5.9: Manual Trigger Buttons
**Task ID:** `tes-5-9-manual-trigger-buttons`

As a user,
I want manual buttons to trigger workflow commands,
So that I have fallback control when automation fails.

**Acceptance Criteria:**

**Given** a Story task is in In Progress
**When** the manual trigger bar is displayed
**Then** a "Run dev-story" button is available
**And** clicking it sends the dev-story command to tmux

**Given** a task is in Review
**When** the manual trigger bar is displayed
**Then** a "Run code-review" button is available
**And** clicking it sends the code-review command to tmux

**Given** an agent is running
**When** displayed
**Then** a "Pause" button is available
**And** clicking it pauses the tmux session (Ctrl+Z or equivalent)

**Given** an agent is paused
**When** displayed
**Then** a "Resume" button replaces Pause
**And** clicking it resumes execution

**Given** an error occurred
**When** the Retry button is displayed
**Then** clicking it re-sends the last command

**References:** FR36, FR37, UX10

---

### Story 5.10: Automation Keyboard Shortcuts
**Task ID:** `tes-5-10-automation-keyboard-shortcuts`

As a user,
I want keyboard shortcuts for workflow commands,
So that I can control automation quickly.

**Acceptance Criteria:**

**Given** the task detail panel is open
**When** the user presses `D`
**Then** dev-story command is triggered (if applicable)
**And** only works when task is in In Progress

**Given** the task detail panel is open
**When** the user presses `C`
**Then** code-review command is triggered (if applicable)
**And** only works when task is in Review

**Given** an agent is running
**When** the user presses `Space`
**Then** the agent is paused/resumed (toggle)

**Given** a shortcut is pressed
**When** the command is not applicable (wrong state)
**Then** nothing happens
**And** no error is shown (silent ignore)

**Given** the user needs help with shortcuts
**When** they press `?`
**Then** a shortcuts help overlay displays all available keys

**References:** UX11
