---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/project-context.md
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - docs/research.md
  - docs/bmad-taskmaster-integration.md
workflowType: 'feature-prd'
lastStep: 11
documentCounts:
  existingPrd: 1
  projectContext: 1
  briefCount: 1
  researchCount: 2
featureName: 'Task Execution Sandbox'
parentPrd: '_bmad-output/planning-artifacts/prd.md'
---

# Feature PRD: Task Execution Sandbox

**Author:** Tinxu
**Date:** 2026-01-12
**Parent PRD:** TinSu v1 (prd.md)
**Feature Type:** Major Enhancement

## Executive Summary

The Task Execution Sandbox transforms TinSu's task detail view from a static content display into a fully-featured execution workspace. Each task becomes an isolated runtime environment with three core capabilities:

1. **Activities Log** — A real-time, append-only event stream capturing every action: status changes, agent events (start, complete, error), user actions, and system events. Filterable by event type for focused debugging and review.

2. **Per-Task Terminal** — A persistent terminal session tied to each task's lifecycle. Scrollback history survives navigation between tasks and across app sessions. Users can both observe agent output and manually type commands.

3. **Workflow Automation** — Task-type-aware command triggers. Story tasks (BMAD-generated) automatically execute `dev-story` on In Progress and `code-review` on Review. Basic tasks (user-created) remain manual-only, preserving user control.

This feature operationalizes TinSu's core differentiator: tasks are not records to track, but runtime environments to execute work under human oversight.

### What Makes This Special

The "isolated execution context" pattern solves the fundamental problem of terminal transience. In current workflows, terminal output disappears when navigating away or switching tasks. The Task Execution Sandbox makes execution history a first-class citizen — every task accumulates its own observable, interactive history that persists indefinitely.

The task-type-aware automation ensures BMAD workflows run seamlessly (Story → dev-story → code-review) while preserving manual control for ad-hoc Basic tasks. This respects both structured methodology users and "just let me do it" users.

## Project Classification

**Parent Product:** TinSu (AI Agent Orchestration Platform)
**Feature Type:** Infrastructure Enhancement
**Technical Scope:** New data model + UI components + automation engine
**Domain:** General (Productivity/Developer Tools)
**Complexity:** Medium
**Project Context:** Brownfield — extending existing FR7-FR21 (agent execution) and FR32-FR35 (data persistence)

**Builds On:**
- Existing terminal infrastructure (xterm.js, node-pty)
- Existing tRPC subscription patterns
- Existing SQLite/Drizzle data layer
- Existing task status state machine

## Success Criteria

### User Success

**Core Experience:**
- Switch between multiple tasks without losing terminal context — scrollback preserved indefinitely
- Find any historical event within 10 seconds using activity log filters
- Zero manual intervention for Story task workflow (In Progress → dev-story → Review → code-review)

**Aha Moment:**
- "I have 3 tasks running in parallel, and I can jump between them without losing anything"

**Measurable Outcomes:**
- 100% event capture — every status change, agent event, user action logged
- Terminal scrollback survives app restart and system reboot
- Workflow automation triggers within 5 seconds of status change
- Activity log filter/search returns results in <1 second

### Business Success

**Capability Unlock:**
- Enables parallel task execution — users can run multiple agents simultaneously
- Force multiplier for task velocity: potential 2-3x increase with parallel work

**Product-Market Fit Signal:**
- "I can't go back to serial task execution"
- Users naturally adopt multi-task parallel workflows

**Scale Enabler:**
- Foundation for team collaboration (future: multiple users watching same task)
- Foundation for automation pipelines (future: chain multiple tasks)

### Technical Success

**Performance:**
- Active task terminal streams in real-time (<500ms latency)
- Inactive task terminals load scrollback on-demand (<2 second load)
- System remains responsive with 10+ tasks with persistent terminals

**Reliability:**
- Terminal scrollback persists across: navigation, app restart, system reboot
- Activities log: zero event loss, append-only integrity
- Automation triggers: 99%+ success rate for Story task transitions

**Storage:**
- Unlimited scrollback per task (system manages efficiently)
- Activities log retained forever (until task deleted)
- Graceful handling of large scrollback (lazy loading, virtualization)

## Product Scope

### MVP — Minimum Viable Product

**Must-Have:**
- `task_activities` table — append-only event log with real-time streaming
- Per-task terminal persistence — scrollback stored in SQLite, survives restart
- Activity log UI — filterable by event type (status, agent, user, error)
- Workflow automation — Story tasks auto-trigger `dev-story` and `code-review`
- Task detail page redesign — tabs for Terminal, Activities, Content

**Architecture:**
- Terminal scrollback stored in database (not just memory)
- tRPC subscription for real-time activity streaming
- State machine hooks for automation triggers

### Growth Features (Post-MVP)

- Configurable automation rules per task type
- Activity log export (JSON, CSV)
- Terminal session replay (playback mode)
- User-configurable concurrency limits
- Activity log search across all tasks (global search)

### Vision (Future)

- Cross-device terminal sync (pick up where you left off on another machine)
- Team collaboration: multiple users can watch/interact with same task terminal
- Automation pipelines: chain tasks together (Task A done → trigger Task B)
- AI-powered activity insights ("this task stalled 3 times, pattern detected")

## User Journeys

### Journey 1: Tinxu — The Parallel Sprint Master (Story Tasks)

It's Tuesday morning. Tinxu opens TinSu and sees his board: 10 Story tasks spread across In Progress and Review columns. In the old days, he'd have one task running while the others sat idle. Now, they're all alive — each with its own terminal session ticking away.

He clicks on the first task in In Progress — "Implement user settings page." The task detail opens with four tabs: Terminal, Activities, Diff, and Content. He's on the Terminal tab — Claude Code is mid-work, outputting code changes in real-time. He switches to Activities and sees: `09:12:03 - Agent started`, `09:14:22 - File created: SettingsPage.tsx`. Everything's moving. He switches to the next task.

Task 2 is in Review. When it landed there 10 minutes ago, TinSu automatically fired `code-review` in its terminal. The review is done. Tinxu clicks the **Diff tab** — he sees 4 files changed: 2 new components, 1 modified route, 1 updated test. The side-by-side diff shows exactly what the agent wrote. He spots a minor issue with error handling.

He switches to the Terminal tab and types directly: "The error toast should show the actual error message, not a generic 'Something went wrong'." The agent acknowledges and starts fixing. He checks Activities — the event is logged: `09:42:18 - User command entered`.

He cycles through all 10 tasks: check Diff to see scope of changes, read Activities for status, review Terminal for details, give feedback, move on. By 10am, he's moved 3 tasks to Done without writing a single line of code himself. The other 7 are progressing in parallel.

The breakthrough moment: he realizes he's doing in one morning what used to take an entire day of serial task execution. The four-tab layout gives him complete observability — Diff for "what changed", Activities for "what happened", Terminal for "what's happening now", Content for "what was requested".

### Journey 2: Tinxu — Debugging the Mystery Failure (Error Recovery)

It's Wednesday afternoon. Tinxu notices a task has been in Review for 2 hours but something feels off. He opens the task.

First stop: the **Diff tab**. He sees 3 files modified, but the changes look incomplete — the component is half-finished. Something went wrong.

He switches to **Activities** and filters by "error" events. There it is: `14:22:45 - Agent error: ECONNREFUSED connecting to localhost:3000`. The code-review command failed because the dev server wasn't running.

He switches to **Terminal** and scrolls up (the full scrollback is there, even though he's been switching between 9 other tasks all day). He finds the exact moment things went wrong — buried in 500 lines of output that he would have missed without the activity log pointing him there.

He types into the terminal: "Start the dev server first, then retry the code review." The agent recovers. The Activities log updates: `14:35:02 - User command entered`, `14:35:03 - Agent resumed`.

Without the Activity log as his error radar, he'd have spent 20 minutes hunting through terminal output. With it, he found the problem in 30 seconds. The Diff tab confirmed his suspicion that the work was incomplete.

### Journey 3: Tinxu — The Ad-Hoc Fix (Basic Task)

It's Thursday. Tinxu notices a bug in production — the login button is misaligned on mobile. This isn't a planned Story from the sprint backlog; it's an urgent fix that needs to happen now.

He creates a Basic Task with the description: "Fix mobile login button alignment — the button is misaligned on mobile screens. Check the LoginButton component and fix the Tailwind responsive classes."

He drags it to In Progress. TinSu automatically launches Claude Code CLI with the task description as the prompt. The agent starts working immediately. He watches the Terminal tab as the agent analyzes the component.

Five minutes later, the agent finishes and the task moves to Review. But unlike Story tasks, **no `code-review` auto-triggers** — Basic Tasks stop here and wait for Tinxu's manual review.

He clicks the **Diff tab**. Clean and simple: one file changed (`LoginButton.tsx`), 2 lines modified. The diff shows the Tailwind classes updated from `px-4` to `px-4 sm:px-6` and a responsive width fix. He can see instantly this is correct.

He checks **Activities** — the full timeline is there: `11:45:02 - Status: In Progress`, `11:45:03 - Agent started`, `11:49:18 - Agent completed`, `11:49:19 - Status: Review`. If anyone asks "what happened with that mobile bug?" — the complete audit trail exists.

He drags the task to Done. Total time: 5 minutes for a production fix, fully documented.

The key difference from Story tasks:
- **Story Task**: In Progress → `dev-story` → Review → auto `code-review` → manual approval → Done
- **Basic Task**: In Progress → Claude Code with description → Review → **manual review only** → Done

Basic Tasks still get automatic execution, but skip the BMAD workflow commands. Same four-tab observability either way.

### Journey Requirements Summary

These journeys reveal the following capability areas:

**From Journey 1 (Parallel Sprint Master):**
- Per-task terminal persistence across navigation
- Real-time activity log streaming
- Automatic workflow triggers for Story tasks (In Progress → dev-story, Review → code-review)
- Ability to type feedback directly into task terminal
- Support for 10+ concurrent active tasks
- Four-tab task detail layout: Terminal, Activities, Diff, Content

**From Journey 2 (Debugging Mystery Failure):**
- Activity log filtering by event type (error, status, agent, user)
- Terminal scrollback preserved indefinitely
- Timestamp visibility for event correlation
- Quick identification of failure points
- Diff tab shows incomplete work state for diagnosis

**From Journey 3 (Basic Task Ad-Hoc Fix):**
- Task type differentiation (Story vs Basic)
- Basic tasks auto-run Claude Code CLI with task description as prompt
- Basic tasks skip automated `code-review` — manual review only
- Same activity log capture regardless of task type
- Same terminal persistence and Diff view, different automation rules

**Diff Viewer (from all journeys):**
- Git diff view showing all files changed by agent
- Side-by-side or unified diff format (like GitHub PR)
- File tree showing which files were added/modified/deleted
- Quick scan capability — see scope of changes at a glance
- Integrated into task detail as dedicated tab

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Task as Execution Workspace (Not Just Record)**

Traditional project management treats tasks as database rows — text descriptions moved between columns. The Task Execution Sandbox redefines tasks as **self-contained execution environments** with:
- Persistent terminal session (survives navigation, restart, reboot)
- Real-time activity log (complete audit trail)
- Integrated diff view (see what changed)
- Content/description (what was requested)

This four-tab workspace pattern doesn't exist in current tools as a unified experience.

**2. Task-Type-Aware Automation**

State-triggered workflows differentiated by task type:
- **Story Tasks** (BMAD-generated): In Progress → `dev-story` → Review → auto `code-review`
- **Basic Tasks** (user-created): In Progress → Claude Code with description → Review → manual only

This isn't generic automation — it's workflow-aware automation based on how structured methodology (BMAD) vs ad-hoc work actually flows.

**3. Parallel Execution with Isolated Contexts**

Support for 10+ concurrent tasks, each with their own:
- Terminal session (active one streams, others load on-demand)
- Activity history (independent event logs)
- Diff state (per-task git changes)

This enables parallelism without context collision — a force multiplier for task velocity.

### Market Context & Competitive Landscape

**Prior Art:**
- **Auto-Claude**: Uses git worktrees for parallel agent isolation
- **Vibe Kanban**: Visual Kanban interface for coding agents with terminal integration

**Gap Identified:**
Neither combines persistent per-task terminal + activities log + diff view + task-type automation into a unified task detail experience. They solve pieces of the puzzle; Task Execution Sandbox solves the whole "task as workspace" pattern.

**Positioning:**
Not "first to do agent orchestration" — but "first to make the task card itself a complete execution environment with full observability."

### Validation Approach

**Dogfooding (Primary):**
- Founder (Tinxu) uses this pattern daily
- Automation rules based on actual workflow, not theoretical design
- Success signal: "I can't go back to serial task execution"

**Pattern Validation:**
- Terminal persistence: Does switching between 10 tasks feel seamless?
- Activities log: Can errors be found in <30 seconds?
- Automation: Does code-review auto-trigger reduce friction?

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Automation fails silently | Manual trigger button as fallback |
| Terminal persistence bloats storage | Lazy loading, virtualized scrollback |
| Parallel execution causes resource contention | Active-only streaming, on-demand loading |
| Task-type detection wrong | User can manually override task type |

## Desktop App + SaaS B2B Specific Requirements

### Project-Type Overview

The Task Execution Sandbox is a **desktop app feature** (Electron) with **B2B SaaS patterns** (multi-task orchestration, audit logging, workflow automation). It extends TinSu's existing terminal infrastructure with persistent sessions and event-driven automation.

### Technical Architecture

#### Terminal Persistence: tmux Sessions

Each task gets a dedicated tmux session that persists independently of the UI:

```
Task lifecycle:
├── In Progress → tmux new-session -d -s tinsu-task-{id}
├── Claude Code runs inside tmux (stays alive)
├── User navigates away → tmux session continues in background
├── User returns → xterm.js attaches to existing tmux session
├── Task Done → optionally kill tmux session or keep for reference
```

**Key Commands:**

| Action | tmux Command |
|--------|--------------|
| Create session | `tmux new-session -d -s tinsu-task-{id}` |
| Send command | `tmux send-keys -t tinsu-task-{id} "cmd" Enter` |
| Attach (for xterm.js) | `tmux attach-session -t tinsu-task-{id}` |
| Check if alive | `tmux has-session -t tinsu-task-{id}` |
| Capture scrollback | `tmux capture-pane -t tinsu-task-{id} -p -S -50000` |
| Kill session | `tmux kill-session -t tinsu-task-{id}` |

**Benefits:**
- Session survives app restart (tmux server is independent)
- Background execution (tasks run while user views other tasks)
- Send commands without UI attachment (`send-keys`)
- Built-in scrollback buffer

#### Event Detection: Claude Code Hooks

Use Claude Code's native hooks system to detect phases:

**Stop Hook (Task Completion):**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bash .claude/hooks/task-completion.sh"
      }]
    }]
  }
}
```

Hook receives JSON via stdin:
```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/transcript.json",
  "cwd": "/project/root",
  "hook_event_name": "Stop"
}
```

**PostToolUse Hook (Activity Tracking):**
```json
{
  "hooks": {
    "PostToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "bash .claude/hooks/log-tool-use.sh"
      }]
    }]
  }
}
```

Captures every tool call (file edits, bash commands, git operations) for the activity log.

#### Session-Task Mapping

```typescript
interface TaskSession {
  taskId: string
  sessionId: string        // Claude Code session ID
  tmuxSession: string      // tinsu-task-{taskId}
  currentPhase: 'dev-story' | 'code-review' | 'user-feedback'
  createdAt: Date
}
```

Hooks emit `session_id` → lookup `taskId` → route events to correct task.

### Data Architecture

#### Activities Log Table

```sql
CREATE TABLE task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,           -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

**Event types:**
- `status_change` — Task moved between columns
- `agent_start` — Claude Code started working
- `agent_complete` — Stop hook fired (response complete)
- `tool_used` — PostToolUse hook (file edit, bash, etc.)
- `user_command` — User typed in terminal
- `automation_trigger` — Auto code-review triggered
- `error` — Agent error or hook failure

#### Terminal Scrollback Storage

**Hybrid approach:**
- **Live sessions:** tmux handles scrollback in memory (50K+ lines)
- **Persistence backup:** Periodic dump to filesystem for reboot survival

```
{appData}/terminal-history/{taskId}/
├── scrollback.txt.gz     # Compressed scrollback backup
├── metadata.json         # Line count, last backup time
└── transcript.json       # Claude Code transcript (from hook)
```

**Backup triggers:**
- On status change (In Progress → Review → Done)
- Every 5 minutes while task is active
- On app shutdown

### Automation Engine

#### State Machine Triggers

```typescript
async function onStatusChange(taskId: string, newStatus: TaskStatus) {
  const task = await getTask(taskId)

  if (newStatus === 'in_progress') {
    await taskTerminal.createSession(taskId)

    if (task.type === 'story') {
      await taskTerminal.sendCommand(taskId, buildDevStoryPrompt(task))
    } else {
      await taskTerminal.sendCommand(taskId, task.description)
    }

    await logActivity(taskId, 'agent_start', { phase: 'initial' })
  }
}

async function onStopHook(sessionId: string) {
  const taskSession = await getTaskBySession(sessionId)
  const task = await getTask(taskSession.taskId)

  await logActivity(task.id, 'agent_complete', { phase: taskSession.currentPhase })

  if (task.type === 'story' && taskSession.currentPhase === 'dev-story') {
    await updateTaskStatus(task.id, 'review')
    await taskTerminal.sendCommand(task.id, '/code-review')
    await updateTaskSession(task.id, { currentPhase: 'code-review' })
    await logActivity(task.id, 'automation_trigger', { command: 'code-review' })
  }

  if (task.type === 'story' && taskSession.currentPhase === 'code-review') {
    await notifyUser(`Task "${task.title}" ready for your review`)
  }
}
```

#### Manual Trigger Fallback

```typescript
async function manualTriggerCodeReview(taskId: string) {
  await taskTerminal.sendCommand(taskId, '/code-review')
  await logActivity(taskId, 'user_command', { command: '/code-review' })
}
```

### Platform Considerations

| Platform | tmux Support | Notes |
|----------|--------------|-------|
| **macOS** | ✅ Native | Homebrew: `brew install tmux` |
| **Linux** | ✅ Native | apt/yum: `tmux` |
| **Windows** | ⚠️ WSL required | Defer to post-MVP |

**MVP scope:** macOS and Linux (founder dog-fooding environment)

### Implementation Considerations

#### Service Architecture

```
src/main/services/
├── task-terminal.service.ts      # tmux session management
├── hook-listener.service.ts      # Watch for hook events
├── activity-log.service.ts       # Event logging + streaming
├── automation.service.ts         # State machine triggers
└── scrollback-backup.service.ts  # Periodic persistence
```

#### Hook Files to Create

```
.claude/hooks/
├── task-completion.sh    # Stop hook → signals TinSu
├── log-tool-use.sh       # PostToolUse → activity log
└── hooks-config.json     # Shared config for hooks
```

#### IPC for Hook → Electron Communication

**Option 1: File-based (simple)**
```bash
echo "STOP:${SESSION_ID}" >> /tmp/tinsu-events.log
```

**Option 2: HTTP localhost (robust)**
```bash
curl -X POST http://localhost:${TINSU_PORT}/api/hooks/stop \
  -H "Content-Type: application/json" -d "$INPUT"
```

**Option 3: Unix socket (fastest)**
```bash
echo "$INPUT" | nc -U /tmp/tinsu.sock
```

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP
- Build the complete Task Execution Sandbox foundation
- Full observability (terminal + activities + diff) from day one
- Full automation infrastructure (hooks) from day one
- No shortcuts that create technical debt

**Rationale:**
- Founder dog-fooding daily — quality matters
- The architecture (tmux + hooks) is the hard part
- UI components are straightforward once infra is solid
- Parallel work unlock is the core value — needs to work fully

**Resource Requirements:**
- Solo founder with AI assistance
- macOS/Linux only for MVP

### MVP Feature Set (Phase 1)

**Core Infrastructure:**
- tmux session management service
- Claude Code hook files (Stop + PostToolUse)
- Hook → Electron IPC communication
- Session ↔ Task mapping in database
- Scrollback backup service (filesystem + gzip)

**Data Layer:**
- `task_activities` table with real-time streaming
- `task_sessions` table (session ↔ task mapping)
- Terminal scrollback backup to filesystem

**UI Components:**
- Task detail page redesign (4 tabs)
- Terminal tab (xterm.js → tmux attach)
- Activities tab (filterable event log, real-time)
- Diff tab (Monaco Editor, git diff view)
- Content tab (existing task description)

**Automation:**
- Story task: In Progress → auto dev-story
- Story task: dev-story complete → auto move to Review
- Story task: Review → auto code-review
- Basic task: In Progress → auto Claude Code with description
- Manual trigger buttons as fallback

**Activity Events Captured (via hooks):**
- `status_change` — Task moved between columns
- `agent_start` — Claude Code started
- `agent_complete` — Stop hook fired
- `tool_used` — PostToolUse hook (file edit, bash, git, etc.)
- `user_command` — User typed in terminal
- `automation_trigger` — Auto code-review triggered
- `error` — Agent or hook failure

### Post-MVP Features (Phase 2: Growth)

- Configurable automation rules per task type
- Activity log export (JSON, CSV)
- Terminal session replay (playback mode)
- User-configurable concurrency limits
- Global activity search (across all tasks)
- Windows support via WSL
- Advanced diff features (file tree, inline comments)

### Future Vision (Phase 3: Expansion)

- Cross-device terminal sync
- Team collaboration (multiple users on same task)
- Automation pipelines (chain tasks: A done → trigger B)
- AI-powered activity insights ("task stalled 3 times")
- Prompt-based Stop hooks (LLM decides if task complete)

### Risk Mitigation Strategy

| Risk | Mitigation |
|------|------------|
| tmux not installed | Check on app startup, prompt user to install |
| Hook IPC fails | File-based fallback (`/tmp/tinsu-events.log`) |
| Scrollback grows huge | Chunked gzip, lazy loading, size warnings |
| Automation triggers incorrectly | Manual override buttons, activity log for debugging |
| Session-task mapping lost | Store in SQLite, rebuild from tmux `list-sessions` |
| Claude Code hook format changes | Version check, graceful degradation |

### MVP Success Criteria Checklist

- Can run 10 tasks in parallel without UI lag
- Switching tasks preserves full terminal scrollback
- Activity log shows events within 1 second of occurrence
- Story task auto-triggers code-review with 99%+ reliability
- Scrollback survives app restart AND system reboot
- Diff view shows accurate file changes

## Functional Requirements

### Terminal Session Management

- **FR1:** User can view a dedicated terminal session for each task
- **FR2:** User can navigate away from a task and return to find the terminal session still active
- **FR3:** User can type commands directly into a task's terminal
- **FR4:** User can scroll through the complete terminal history (scrollback)
- **FR5:** System can create a new terminal session when a task moves to In Progress
- **FR6:** System can send commands to a task's terminal without user being attached
- **FR7:** System can detect when a terminal session ends or becomes unresponsive
- **FR8:** User can view terminal sessions that survive app restart
- **FR9:** User can view terminal sessions that survive system reboot

### Activity Logging

- **FR10:** System can capture status change events for each task
- **FR11:** System can capture agent start events when Claude Code begins work
- **FR12:** System can capture agent complete events when Claude Code finishes responding
- **FR13:** System can capture tool usage events (file edits, bash commands, git operations)
- **FR14:** System can capture user command events when user types in terminal
- **FR15:** System can capture automation trigger events when workflows auto-execute
- **FR16:** System can capture error events when agents or hooks fail
- **FR17:** User can view the activity log for a specific task
- **FR18:** User can filter the activity log by event type
- **FR19:** User can see activity events in real-time as they occur
- **FR20:** User can see timestamps for each activity event

### Task Detail View

- **FR21:** User can view task details in a full-screen 3-column workspace with resizable columns (Content, Terminal+Activities, Diff) optimized for editing, monitoring, and code review
- **FR22:** User can resize column widths via drag handles, with preferences persisted to localStorage
- **FR23:** User can view task description and acceptance criteria in Content tab
- **FR24:** User can switch between different tasks while preserving each task's state
- **FR25:** User can have multiple tasks open simultaneously (10+ concurrent)

### Diff Viewer

- **FR26:** User can view git diff of changes made by the agent
- **FR27:** User can see which files were added, modified, or deleted
- **FR28:** User can view side-by-side or unified diff format
- **FR29:** User can see the scope of changes at a glance (file count, line count)

### Workflow Automation

- **FR30:** System can differentiate between Story tasks and Basic tasks
- **FR31:** System can auto-execute dev-story command when Story task moves to In Progress
- **FR32:** System can auto-move Story task to Review when dev-story completes
- **FR33:** System can auto-execute code-review command when Story task enters Review
- **FR34:** System can auto-execute Claude Code with task description when Basic task moves to In Progress
- **FR35:** System can notify user when code-review is complete and ready for review
- **FR36:** User can manually trigger code-review via button (fallback)
- **FR37:** User can manually trigger any workflow command via button
- **FR38:** System can track current workflow phase for each task (dev-story, code-review, user-feedback)

### Scrollback Persistence

- **FR39:** System can backup terminal scrollback to filesystem
- **FR40:** System can restore terminal scrollback from backup when session is recreated
- **FR41:** System can backup scrollback on status change
- **FR42:** System can backup scrollback periodically (every 5 minutes while active)
- **FR43:** System can backup scrollback on app shutdown
- **FR44:** User can view scrollback even after system reboot

### Session-Task Mapping

- **FR45:** System can associate Claude Code session ID with task ID
- **FR46:** System can route hook events to correct task based on session ID
- **FR47:** System can rebuild session-task mapping from existing terminal sessions on app restart

## Non-Functional Requirements

### Performance

| Metric | Target | Context |
|--------|--------|---------|
| Activity log event latency | <1 second | Events appear in UI within 1 second of occurrence |
| Activity log filter/search | <1 second | Filter results return within 1 second |
| Terminal streaming latency | <500ms | Active terminal output appears with <500ms delay |
| Terminal scrollback load | <2 seconds | Inactive terminal history loads on-demand in <2 seconds |
| Automation trigger latency | <5 seconds | Story task auto-triggers within 5 seconds of status change |
| Tab switching | <200ms | Switching between Terminal/Activities/Diff/Content tabs feels instant |
| Concurrent task support | 10+ tasks | System remains responsive with 10+ tasks with active terminals |
| UI responsiveness | No jank | Board and task detail views remain smooth during background terminal activity |

### Reliability

| Metric | Target | Context |
|--------|--------|---------|
| Terminal persistence (app restart) | 100% | All terminal sessions restore after app restart |
| Terminal persistence (system reboot) | 100% | Scrollback backup restores after system reboot |
| Activity log integrity | Zero loss | No activity events lost during normal operation |
| Automation success rate | 99%+ | Story task automation triggers correctly 99%+ of the time |
| Hook event delivery | 99%+ | Claude Code hook events successfully reach TinSu |
| Scrollback backup success | 100% | Periodic and on-event backups complete without failure |
| Session-task mapping integrity | 100% | Session-task associations survive app restart |
| Graceful degradation | Required | If tmux unavailable, show clear error and fallback options |

### Integration

| System | Requirements |
|--------|--------------|
| tmux | Must be installed on host system (macOS/Linux). App checks on startup and prompts installation if missing. |
| Claude Code CLI | Must support Stop and PostToolUse hooks. Version compatibility check on app startup. |
| Claude Code Hooks | Hook scripts receive JSON via stdin with session_id, transcript_path, cwd, hook_event_name. |
| Filesystem | Read/write access to `{appData}/terminal-history/` for scrollback backups. |
| IPC | Hook → Electron communication via file watcher or HTTP localhost. |
| xterm.js | Attach/detach to tmux sessions without losing state. |

### Data Integrity

| Metric | Target | Context |
|--------|--------|---------|
| Activity log writes | Atomic | Each event write is atomic (no partial writes) |
| Scrollback backup | Atomic | Backup files are written atomically (temp file + rename) |
| Session mapping | Consistent | Session-task mapping updated in transaction with status changes |
| Crash recovery | Automatic | App recovers state from SQLite + tmux `list-sessions` on restart |

