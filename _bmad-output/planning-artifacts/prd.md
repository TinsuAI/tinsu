---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - docs/research.md
  - docs/bmad-taskmaster-integration.md
workflowType: 'prd'
lastStep: 8
documentCounts:
  briefCount: 1
  researchCount: 1
  brainstormingCount: 0
  projectDocsCount: 1
lastEdited: '2026-03-26'
editHistory:
  - date: '2026-03-26'
    changes: 'Added Planning Workspace chat system with tmux migration architecture — new user journey (Journey 3: Multi-Agent Planning), FR36-FR53, NFR25-NFR32, updated integration architecture to dual tmux model, updated MVP scope and risk mitigation'
---

# Product Requirements Document - TinSu

**Author:** Tinxu
**Date:** 2026-01-02

## Executive Summary

TinSu is an AI Agent Orchestration Platform that transforms unstructured "vibe coding" into trustworthy, structured product development. Built for founders who want to delegate work to AI agents without losing control, TinSu provides a familiar Kanban interface where tasks aren't just tracked — they're executed by AI agents under human oversight.

The platform bridges the gap between powerful-but-inaccessible developer tools (BMAD Method, TaskMaster, Claude Code) and intuitive project management interfaces (Asana, Trello). Founders manage sprints, epics, and stories while AI agents actually implement them — with human approval gates at every critical juncture.

Beyond execution, TinSu provides a **Planning Workspace** where founders collaborate with specialized AI agents (PM, Architect, UX Designer) through concurrent chat sessions. Multiple agents can run simultaneously across projects, each in a persistent terminal session that survives app restarts and continues working in the background.

### What Makes This Special

1. **Service-as-a-Software Model**: Project management that executes work, not just tracks it. Tasks become runtime environments, not static records.

2. **Manager-in-the-Loop**: Nothing ships without human review. Founders can pause, inspect, and intervene at any point — the antidote to "fire and forget" anxiety with AI agents.

3. **Methodology Choice**: Users select their preferred workflow — BMAD Method for persona-driven planning, TaskMaster for deterministic execution, or their own approach. The platform adapts to how you work, not the other way around.

4. **Dog-fooded Credibility**: TinSu is being built using its own methodology — living proof the approach works.

## Project Classification

**Technical Type:** saas_b2b (B2B Platform) + web_app (Browser SPA)
**Domain:** General (Productivity/Developer Tools)
**Complexity:** Low-Medium
**Project Context:** Greenfield - new project

**MVP Architecture:**

- Single-tenant (local install on founder's device)
- Single role: Founder (full access)
- Core integrations: Claude Code, GitHub, Git

## Success Criteria

### User Success

**Core Experience:**

- Review in 10 minutes what would have taken 3 hours to build manually
- Review is mandatory — nothing ships without human approval

**Aha Moment:**

- First time a founder approves agent output without touching code

**Measurable Outcomes:**

- Peace of Mind Index: >80% of tasks delegated to agents vs. done manually
- Quality Approval Rate: >80% of agent outputs approved on first review
- Daily Engagement: Founder checks board daily
- Task Velocity: 20+ tasks completed per week (North Star Metric)

### Business Success

**Product-Market Fit Signal:**

- Dog-food validation: "I can't stop using it myself"
- Core loop works reliably (Create → Execute → Review → Done)

**Scale Target:**

- 1 million tasks executed

**Revenue:**

- Not a factor for MVP — pure validation phase

### Technical Success

**Reliability:**

- Agents must never hang mid-task without visibility or recovery
- Graceful handling of interruptions and failures

**Performance:**

- Instant UI responsiveness (snappy Kanban, no perceptible lag)

**Integration Stability:**

- Claude Code CLI integration works reliably for MVP
- Claude API integration planned for future sprints

## Product Scope

### MVP - Minimum Viable Product

**Core Features:**

- Kanban board interface (Backlog → In Progress → Review → Done)
- Sprint/Epic/Story hierarchy (BMAD Method structure)
- AI agent execution via Claude Code CLI
- Review workflow with Approve/Reject mechanism
- Methodology choice: BMAD Method or TaskMaster
- GitHub + Git integration
- Planning Workspace with multi-agent chat sessions (PM, Architect, UX Designer, Dev)
- Concurrent agent support across multiple projects via persistent tmux sessions

**Architecture:**

- Single-tenant (local install on founder's device)
- Single role: Founder (full access)
- tmux-based terminal session management for both task execution and planning chat

### Growth Features (Post-MVP)

- Non-technical founder UX (simplified interface)
- Horizontal workflows (content creation, sales outreach, growth experiments)
- Claude API integration (beyond CLI)

### Vision (Future)

TinSu becomes the **operating system for AI-powered startups** — the single interface where founders manage all their AI agents across every business function: code, content, growth, and sales.

## User Journeys

### Journey 1: Technical Founder — Happy Path (Core Loop)

**Tinxu — From Chaos to Control**

Tinxu is a technical founder who's been building his startup with Claude Code and the BMAD Method. He's productive — absurdly productive — but there's a problem. Everything lives in the terminal. When he closes his laptop at night, he has no idea where things stand. His "project management" is a mix of mental notes, scattered markdown files, and `git log` archaeology.

One Monday morning, he opens TinSu instead of jumping straight into Claude Code. He sees his Kanban board: 3 stories in Backlog from last week's planning session, 1 story still In Progress (the auth flow he paused Friday). He drags "Implement user login" from Backlog to In Progress.

TinSu spins up Claude Code with the story context already loaded — the acceptance criteria, the relevant architecture decisions, the BMAD-generated spec. Tinxu watches the agent work in the embedded terminal. 20 minutes later, the card automatically moves to Review.

He opens the Review panel. There's a diff view: 3 new files, 47 lines changed. The agent's reasoning log shows why it chose JWT over sessions. Tinxu scans the code, spots a minor issue with error handling, types feedback, and clicks "Request Changes."

The card moves back to In Progress. The agent incorporates feedback. 5 minutes later, Review again. This time it's clean. Tinxu clicks "Approve." The card moves to Done. Git commit happens automatically.

He checks the board: 4 stories completed this week. 20+ tasks on track. He closes TinSu and walks away — knowing exactly where everything stands.

### Journey 2: Technical Founder — Recovery Path (When Agents Fail)

**Tinxu — Catching the Spiral Before It Burns**

It's Wednesday afternoon. Tinxu drags "Integrate Stripe payments" to In Progress and kicks off the agent. He switches tabs to review some docs.

15 minutes later, he glances back. The card is still In Progress, but something's wrong — the agent's terminal output shows a loop. Claude Code is stuck retrying the same API call, burning tokens on a hallucinated endpoint that doesn't exist. Classic "loop of hell."

In the old days, Tinxu would've discovered this an hour later after wasting $20 in API calls. But TinSu's status indicator is pulsing yellow: **"Agent stalled — no progress in 5 minutes."** He clicks Pause.

The agent freezes mid-execution. Tinxu opens the reasoning log and sees where it went wrong — the agent assumed Stripe's API structure instead of checking the docs. He adds a note to the story: "Use Stripe SDK, not raw API. Reference: stripe.com/docs/payments/accept-a-payment."

He clicks Resume. The agent re-reads the story with the new context, pivots approach, and 10 minutes later the card moves to Review.

In Review, the diff looks good — but Tinxu spots a security issue: the API key is hardcoded. He clicks "Reject" with feedback: "Move API key to environment variable."

The card moves back to In Progress. The agent fixes it in 2 minutes. Review again. Clean. Approved. Done.

Later that evening, Tinxu reflects: in the old flow, that Stripe bug would've cost him an hour of debugging and a minor security incident. TinSu caught it in 5 minutes because _nothing moved to Done without his eyes on it_.

### Journey 3: Technical Founder — Multi-Agent Planning Session

**Tinxu — Orchestrating the Brain Trust**

It's Thursday morning. Tinxu is starting a new feature — payment processing. Before writing a single line of code, he needs a PRD, architecture decisions, and UX wireframes. In the old days, he'd do this all in one Claude Code session, losing context when switching between PM thinking and architect thinking.

He opens TinSu's Planning Workspace. The sidebar shows the BMAD workflow steps: Product Brief → PRD → Architecture → Epics. He clicks "PRD" and selects the PM agent persona from the dropdown. Types: "Let's create a PRD for the payment processing feature."

The PM agent spins up in its own persistent tmux session. It starts asking probing questions — WHY payment processing, what's the user pain point, what's the success metric. 10 minutes in, Tinxu realizes he needs the Architect's input on a technical constraint.

He switches the persona dropdown to "Architect" and types: "What are the integration options for Stripe in an Electron app?" A second tmux session spins up. The PM agent's session keeps running in the background — its status badge shows "idle" in the session list.

The Architect responds with three options and trade-offs. Tinxu switches back to PM — the session is exactly where he left it, no context lost, no resume delay. He incorporates the Architect's recommendation into the PRD discussion.

An hour later, Tinxu has a complete PRD drafted by the PM agent, architecture constraints validated by the Architect, and both sessions are still available for follow-up questions. He opens a second project (his side project) and starts a new PM chat there — three concurrent agents across two projects, all running independently.

He checks the session list: PM (payment PRD) — idle, Architect (payment) — idle, PM (side project) — thinking. All sessions persist. He closes TinSu, reopens it after lunch — all three sessions resume exactly where they were.

### Journey Requirements Summary

These journeys reveal the following capability areas:

**From Journey 1 (Happy Path):**

- Kanban board with visual task status (Backlog → In Progress → Review → Done)
- Drag-and-drop task state changes
- Claude Code CLI integration with automatic context loading
- Embedded terminal view for agent execution
- Automatic card movement on agent completion
- Review panel with diff view
- Agent reasoning log visibility
- Request Changes / Approve actions
- Automatic git commit on approval
- Task velocity tracking

**From Journey 2 (Recovery Path):**

- Agent stall detection ("no progress" indicator)
- Pause/Resume agent controls
- Reasoning log for debugging agent behavior
- Inline story annotation (adding context mid-execution)
- Reject with feedback mechanism
- Agent re-execution with updated context
- Security review in diff view

**From Journey 3 (Multi-Agent Planning):**

- Planning Workspace with BMAD workflow sidebar
- Agent persona selector (PM, Architect, UX Designer, Dev, etc.)
- Concurrent chat sessions with independent tmux-backed processes
- Background session execution (agent continues working when not in focus)
- Session list with live status badges (thinking, idle, completed)
- Instant session switching without context loss or resume delay
- Multi-project session isolation (sessions scoped to project)
- Session persistence across app restarts (tmux survives restart)
- Chat message history with tool activity visibility

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Task Redefinition: Runtime Environments, Not Records**

Traditional project management treats tasks as static database entries — text descriptions moved between columns by humans. TinSu redefines the task as a _runtime environment_ where AI agents plan, execute, and deliver work. The card is not a status indicator; it's a production unit.

**2. Manager-in-the-Loop: The Trust Pattern for AI Delegation**

Current AI tools force a binary choice: micromanage every interaction (defeating productivity gains) or accept uncontrolled quality risks. TinSu introduces the "Manager-in-the-Loop" pattern — mandatory review gates where humans retain approval authority without doing the work. Nothing ships without human eyes. This is the antidote to "fire and forget" anxiety.

**3. Methodology Agnosticism: Platform Adapts to Workflow**

Unlike tools that impose a single workflow, TinSu offers methodology choice — BMAD Method for persona-driven planning, TaskMaster for deterministic execution, or custom approaches. The platform is a vessel for _how you work_, not a prescription for how you should work.

### Market Context & Competitive Landscape

**Gap Identified:**

- Incumbent PM tools (Asana, Trello, Jira) track human work but don't execute it
- Developer AI tools (Cursor, Claude Code) execute but require terminal expertise
- Agent frameworks (CrewAI, LangChain) are powerful but lack management-tier UI

TinSu occupies the whitespace: a **visual control plane for AI agents** accessible to founders without terminal dependency.

### Validation Approach

**Dog-food Validation (Primary):**

- Founder uses TinSu to build TinSu itself
- Success signal: "I can't stop using it myself"
- Measures: Task velocity, approval rates, daily engagement

**Pattern Validation:**

- Manager-in-the-Loop: Does the review step catch real issues? (Journey 2 scenario)
- Runtime Tasks: Do agents complete work autonomously with context loaded?
- Methodology Choice: Can users switch between BMAD/TaskMaster seamlessly?

### Risk Mitigation

| Innovation          | Risk                                        | Mitigation                                                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| Tasks as Runtimes   | Agent execution is unreliable or slow       | Stall detection, Pause/Resume controls, clear status indicators           |
| Manager-in-the-Loop | Review becomes bottleneck, slows velocity   | Streamlined diff view, quick approve/reject actions, batching potential   |
| Methodology Choice  | Complexity of supporting multiple workflows | MVP focuses on 2 methodologies (BMAD, TaskMaster), defer custom workflows |

## SaaS B2B Specific Requirements

### Project-Type Overview

TinSu is a B2B platform with web application characteristics, designed for single-tenant local installation during MVP. Unlike typical SaaS multi-tenant architectures, MVP prioritizes founder trust through local data ownership and direct integration with development tooling.

### Technical Architecture Considerations

#### Tenant Model (MVP)

**Single-Tenant Local Installation:**

- Application runs entirely on founder's device
- No cloud dependency for core functionality
- Data remains local — builds trust through ownership
- Future: Optional cloud sync for multi-device access

#### Permission Model (MVP)

**Single Role: Founder**

- Full access to all features
- No permission matrix required for MVP
- Future: Role-based access when team collaboration is added

### Integration Architecture

#### Claude Code CLI Integration

TinSu uses two terminal session models depending on context:

**1. Task Execution: tmux Sessions (Kanban Board)**

| Component              | Implementation                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Process Management** | One tmux session per task (`tinsu-{project}-{taskId}`)                              |
| **Command Injection**  | `tmux send-keys` injects Claude CLI commands into persistent session                |
| **Visual Display**     | PTY attaches to tmux session (`tmux attach-session`), rendered via xterm.js         |
| **Persistence**        | tmux sessions survive app restarts; sessions validated on startup                   |
| **Session Monitoring** | Polling `tmux has-session` every 2s detects session exit                            |
| **Control Signals**    | Send SIGSTOP/SIGCONT via tmux for Pause/Resume                                      |
| **State Detection**    | Hook scripts POST events to HTTP listener; stall detection via output monitoring    |

**2. Planning Chat: tmux Sessions + PTY I/O Channel**

| Component              | Implementation                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Process Management** | One tmux session per chat (`tinsu-chat-{sessionId}`)                                |
| **I/O Channel**        | PTY attaches to tmux session for direct stdin writing (not `send-keys`)             |
| **Message Input**      | `ptyService.write()` for byte-level control over message content and Enter key      |
| **Persistence**        | tmux sessions survive app restarts; no `--resume` flag needed                       |
| **Concurrency**        | Multiple tmux sessions run independently across agents and projects                 |
| **Session Monitoring** | `tmux has-session` polling detects background session completion/exit                |
| **Hook Routing**       | Chat-specific hook endpoints (`/api/hooks/chat-*`) route by tmux session name       |

**Why tmux for Both:**

- Persistent sessions survive app restarts without `--resume` flag
- Independent session lifecycle — switching agents doesn't affect background sessions
- Stable session identifiers (tmux session names) eliminate orphan UUID routing bugs
- Unified architecture — one session model for all Claude Code interactions
- PTY attachment provides both visual terminal display (tasks) and reliable I/O (chat)

**Two-Layer Architecture:**

```
tmux session (persistence layer)
  └─ PTY attached via ptyService.spawn(tmux attach ...)  (I/O layer)
       └─ claude --session-id {uuid}  (agent process)
            └─ hooks POST to /api/hooks/{chat-*|stop|tool-use}  (event routing)
```

#### Git Integration

**Approach: Git Worktrees for Parallel Task Isolation**

| Capability             | Implementation                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| **Task Isolation**     | Each active task gets dedicated worktree (e.g., `/.worktrees/story-123/`) |
| **Parallel Execution** | Multiple agents can work simultaneously without conflicts                 |
| **Merge on Approve**   | When task approved, merge worktree branch to main                         |
| **Cleanup**            | Delete worktree after successful merge                                    |
| **Conflict Handling**  | Detect merge conflicts, surface to founder for resolution                 |

**Worktree Lifecycle:**

1. Task moves to In Progress → Create worktree + branch
2. Agent works in isolated worktree
3. Task approved → Merge branch to main
4. Worktree deleted after successful merge

#### GitHub Integration (MVP Scope)

- Auto-commit on approve (within worktree, then merge)
- Branch naming convention: `tinsu/story-{id}-{slug}`
- Future: PR creation, GitHub Actions integration

### Data Persistence Architecture

**Hybrid Approach: SQLite + JSON/YAML**

| Data Type                 | Storage        | Rationale                                                   |
| ------------------------- | -------------- | ----------------------------------------------------------- |
| **Task State**            | SQLite         | Queryable, handles concurrent reads, timestamps, agent logs |
| **Sprint/Epic Structure** | SQLite         | Relational data, status tracking                            |
| **Project Config**        | YAML           | Human-readable, version-controlled                          |
| **Story Definitions**     | Markdown/YAML  | Compatible with BMAD/TaskMaster patterns                    |
| **Agent Logs**            | SQLite + Files | Indexed for search, full logs in filesystem                 |

**SQLite Schema Considerations:**

- Tasks table: id, title, status, sprint_id, epic_id, created_at, updated_at
- Agent runs table: task_id, started_at, ended_at, token_usage, exit_status
- Logs table: run_id, timestamp, log_level, message

**File Structure:**

```
project/
├── .tinsu/
│   ├── tinsu.db          # SQLite state
│   ├── config.yaml       # Project configuration
│   └── worktrees/        # Git worktrees for active tasks
├── .bmad/                # BMAD artifacts (if using BMAD)
└── stories/              # Story markdown files
```

### Implementation Considerations

**MVP Technical Constraints:**

- Must work offline (no cloud dependency)
- Single-user, single-device
- Claude Code CLI must be installed separately (prerequisite)
- Git must be initialized in project directory

**Performance Requirements:**

- UI must remain responsive during agent execution
- PTY output streaming should not block main thread
- SQLite queries should be indexed for task list views

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP

- Solve the core pain (terminal chaos → visual control) with minimal but complete features
- Focus on dog-food validation before external users
- Quality over speed — the integrations must work reliably

**Resource Requirements:**

- Solo founder (dog-fooding)
- Prerequisites: Claude Code CLI installed, Git initialized
- No external dependencies for core functionality

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

1. Happy Path — Create → Execute → Review → Done
2. Recovery Path — Stall detection, Pause/Resume, Reject with feedback

**Must-Have Capabilities:**

| Capability                     | Rationale                                   |
| ------------------------------ | ------------------------------------------- |
| Kanban Board (4 columns)       | Core visual interface — the "control plane" |
| Sprint/Epic/Story Hierarchy    | Structure for BMAD/TaskMaster compatibility |
| Claude Code CLI via tmux       | Agent execution with persistent sessions    |
| Git Worktrees                  | Parallel task isolation without conflicts   |
| Review Panel + Diff View       | Manager-in-the-Loop pattern                 |
| Approve/Reject/Request Changes | Human oversight actions                     |
| Stall Detection                | Catch agent loops before they burn tokens   |
| Pause/Resume                   | Intervention without losing context         |
| Auto-commit on Approve         | Merge worktree, clean up                    |
| SQLite + YAML Hybrid           | State persistence + human-readable config   |
| Planning Workspace + Chat      | Multi-agent collaboration for planning phases |
| Concurrent tmux Chat Sessions  | Multiple agents/projects without interference |
| Session Persistence            | tmux sessions survive restart, no context loss |

**Explicitly Deferred from MVP:**

- Non-technical founder UX
- Horizontal workflows (content, sales, growth)
- Claude API integration (direct API calls)
- Multi-device sync
- Team collaboration / RBAC
- Mobile app

### Post-MVP Features

**Phase 2 (Growth):**

- Non-technical founder UX (simplified interface, guided onboarding)
- Horizontal workflows (content creation, sales outreach, growth experiments)
- Claude API integration (move beyond CLI)
- Basic analytics dashboard (task velocity trends)

**Phase 3 (Expansion):**

- Multi-tenant cloud option (SaaS model)
- Team collaboration + role-based access
- Multiple AI providers (OpenAI, Gemini, etc.)
- Marketplace for workflow templates
- Mobile companion app

### Risk Mitigation Strategy

**Technical Risks:**

| Risk                            | Mitigation                                                  |
| ------------------------------- | ----------------------------------------------------------- |
| tmux + PTY complexity across platforms | tmux is battle-tested; node-pty for I/O channel; test on macOS + Linux |
| Worktree merge conflicts        | Surface conflicts in UI, manual resolution workflow         |
| Stall detection false positives | Tunable thresholds, manual override always available        |
| Concurrent session rate limits  | Bounded by subscription plan; sessions queue gracefully on 429 |
| Hook routing for N concurrent sessions | Keyed by tmux session name (stable identifier), eliminates orphan UUID bugs |
| tmux session accumulation       | Idle timeout (30 min) auto-kills inactive sessions; startup validation cleans stale sessions |

**Market Risks:**

| Risk                                       | Mitigation                                              |
| ------------------------------------------ | ------------------------------------------------------- |
| Only useful for founder, not generalizable | Dog-food validation first, then expand to similar users |
| Claude Code CLI changes break integration  | Abstract CLI layer, monitor for API changes             |

**Resource Risks:**

| Risk                   | Mitigation                                      |
| ---------------------- | ----------------------------------------------- |
| Solo founder bandwidth | Lean MVP scope, use TinSu to build TinSu        |
| Scope creep            | Explicit "deferred" list, strict MVP boundaries |

## Functional Requirements

### Board & Task Management

- FR1: Founder can view a Kanban board with five columns (Backlog, Create Story, In Progress, Review, Done)
- FR2: Founder can drag tasks between columns to change their status
- FR3: Founder can create new tasks (stories) with title, description, and acceptance criteria
- FR4: Founder can organize tasks into a Sprint/Epic/Story hierarchy
- FR5: Founder can view task velocity metrics (tasks completed per week)
- FR6: Founder can filter and view tasks by sprint, epic, or status

### Agent Execution

- FR7: Founder can start agent execution by moving a task to In Progress
- FR8: System spawns Claude Code CLI with story context automatically loaded
- FR9: Founder can view real-time terminal output from the agent in an embedded view
- FR10: System automatically moves task to Review when agent completes execution
- FR11: Founder can add context notes to a story that the agent will receive on execution

### Agent Monitoring & Control

- FR12: System detects when an agent has stalled (no progress for configurable threshold)
- FR13: Founder can see visual indicator when agent is stalled (yellow status)
- FR14: Founder can pause a running agent mid-execution
- FR15: Founder can resume a paused agent with preserved context
- FR16: Founder can view agent reasoning logs to understand decisions

### Review & Approval

- FR17: Founder can view a diff of all changes made by the agent
- FR18: Founder can approve changes, which triggers merge and task completion
- FR19: Founder can reject changes with feedback, returning task to In Progress
- FR20: Founder can request changes with inline comments, returning task to agent
- FR21: System re-executes agent with rejection feedback as additional context

### Git & Version Control

- FR22: System creates a git worktree for each task moved to In Progress
- FR23: System creates a branch following naming convention (tinsu/story-{id}-{slug})
- FR24: Agent executes within isolated worktree to prevent conflicts
- FR25: System merges worktree branch to main on task approval
- FR26: System deletes worktree after successful merge
- FR27: System detects merge conflicts and surfaces them to founder for resolution

### Project Configuration

- FR28: Founder can select methodology (BMAD Method or TaskMaster) per project
- FR29: Founder can configure project settings via YAML file
- FR30: System reads story definitions from markdown/YAML files
- FR31: Founder can initialize TinSu in an existing git repository

### Data Persistence

- FR32: System persists task state, status, and timestamps in SQLite database
- FR33: System stores agent run history (start time, duration, token usage, exit status)
- FR34: System maintains searchable index of agent logs
- FR35: System preserves human-readable project config in version-controlled YAML

### Planning Workspace

- FR36: Founder can open a Planning Workspace with BMAD workflow steps displayed in a sidebar
- FR37: Founder can select an agent persona (PM, Architect, UX Designer, Dev, QA, or custom) for each chat session
- FR38: Founder can send messages to an agent and receive responses in a chat interface with message bubbles

### Planning Chat Session Management

- FR39: System creates a persistent, isolated terminal session for each new chat conversation
- FR40: System provides a bidirectional communication channel for sending messages to and receiving output from agent sessions
- FR41: System launches the agent process with unique session identity and persona context pre-loaded
- FR42: System routes agent lifecycle events (completion, tool use, permission requests, notifications) to the correct chat session without cross-session leakage
- FR43: System persists assistant responses and tool activity for retrieval and display in the chat interface

### Concurrent Agent Support

- FR44: Founder can run multiple chat sessions simultaneously across different agent personas, each in an independent persistent session
- FR45: Founder can switch between active chat sessions without interrupting background agent work
- FR46: System displays a session list with live status indicators (thinking, idle, completed, exited) reflecting the agent session state
- FR47: Founder can view and resume any previous chat session from the session list

### Multi-Project Session Scoping

- FR48: Chat sessions are scoped to a project — each session records its project_id and only appears in that project's session list
- FR49: Founder can run concurrent chat sessions across different projects without cross-project interference
- FR50: System confines each agent session's file operations to the target project directory, ensuring project isolation

### Planning Chat Persistence

- FR51: Chat sessions persist across app restarts — founder can resume conversations without context loss
- FR52: System validates chat session health on startup, marking unavailable sessions for re-creation on next message
- FR53: System monitors agent session health and updates session status within 2 seconds of a session becoming unavailable

## Non-Functional Requirements

### Performance

**UI Responsiveness:**

- NFR1: Kanban board interactions (drag, click, navigation) complete in <100ms
- NFR2: Board loads with full task list in <1 second
- NFR3: UI main thread event loop latency remains below 50ms during agent execution

**Terminal Output:**

- NFR4: Agent terminal output streams to UI with <500ms latency
- NFR5: Terminal view renders agent output at up to 1000 lines/second with no more than 5% frame loss

**Data Operations:**

- NFR6: SQLite queries for task list views complete in <200ms
- NFR7: Task state changes persist immediately (no visible delay)

### Reliability

**Agent Execution:**

- NFR8: Agent stall detection triggers within configured threshold (default: 5 minutes of no output)
- NFR9: Pause/Resume commands execute within 1 second
- NFR10: System recovers gracefully from Claude Code CLI crashes without data loss
- NFR11: No task data is lost if application is force-quit during agent execution

**Git Operations:**

- NFR12: Worktree creation/deletion succeeds or fails cleanly (no partial states)
- NFR13: Merge conflicts are detected before corrupting main branch
- NFR14: Git operations provide clear error messages on failure

**Data Integrity:**

- NFR15: SQLite database maintains ACID properties
- NFR16: Application can recover from unexpected shutdown without database corruption

### Integration

**Claude Code CLI:**

- NFR17: System detects if Claude Code CLI is not installed and provides clear error
- NFR18: Context injection works with story files up to 50KB
- NFR19: PTY integration works on macOS and Linux

**Git:**

- NFR20: System detects if git is not initialized and provides clear error
- NFR21: Worktree operations work with repositories up to 10GB
- NFR22: Branch operations complete within 5 seconds for typical repositories

**File System:**

- NFR23: System handles story files with special characters in filenames
- NFR24: YAML/Markdown parsing provides clear error messages on invalid syntax

### Planning Chat

**Session Concurrency:**

- NFR25: System supports at least 5 concurrent chat tmux sessions without degradation of session management operations (create, switch, monitor)
- NFR26: Switching between chat sessions completes in <500ms (session list click to message display)
- NFR27: Background chat sessions experience zero message loss and no added processing latency >1 second due to foreground session activity

**Session Reliability:**

- NFR28: Chat tmux sessions survive app restart with zero context loss — conversation resumes from exact state
- NFR29: Startup validation of chat tmux sessions completes in <5 seconds for up to 20 sessions
- NFR30: Hook events from concurrent chat sessions are routed to the correct session with 100% accuracy (no cross-session event leakage)

**Session Lifecycle:**

- NFR31: Chat tmux session creation (including Claude CLI spawn and TUI ready detection) completes in <15 seconds
- NFR32: Stale session detection (tmux process gone) updates UI status within one polling interval (2 seconds)
