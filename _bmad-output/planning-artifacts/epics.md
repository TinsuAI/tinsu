---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
completedDate: 2026-01-04
totalEpics: 7
totalStories: 76
deferredEpics: [4]
---

# TinSu - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TinSu, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Founder can view a Kanban board with four columns (Backlog, In Progress, Review, Done)
FR2: Founder can drag tasks between columns to change their status
FR3: Founder can create new tasks (stories) with title, description, and acceptance criteria
FR4: Founder can organize tasks into a Sprint/Epic/Story hierarchy
FR5: Founder can view task velocity metrics (tasks completed per week)
FR6: Founder can filter and view tasks by sprint, epic, or status
FR7: Founder can start agent execution by moving a task to In Progress
FR8: System spawns Claude Code CLI with story context automatically loaded
FR9: Founder can view real-time terminal output from the agent in an embedded view
FR10: System automatically moves task to Review when agent completes execution
FR11: Founder can add context notes to a story that the agent will receive on execution
FR12: System detects when an agent has stalled (no progress for configurable threshold)
FR13: Founder can see visual indicator when agent is stalled (yellow status)
FR14: Founder can pause a running agent mid-execution
FR15: Founder can resume a paused agent with preserved context
FR16: Founder can view agent reasoning logs to understand decisions
FR17: Founder can view a diff of all changes made by the agent
FR18: Founder can approve changes, which triggers merge and task completion
FR19: Founder can reject changes with feedback, returning task to In Progress
FR20: Founder can request changes with inline comments, returning task to agent
FR21: System re-executes agent with rejection feedback as additional context
FR22: System creates a git worktree for each task moved to In Progress
FR23: System creates a branch following naming convention (tinsu/story-{id}-{slug})
FR24: Agent executes within isolated worktree to prevent conflicts
FR25: System merges worktree branch to main on task approval
FR26: System deletes worktree after successful merge
FR27: System detects merge conflicts and surfaces them to founder for resolution
FR28: Founder can select methodology (BMAD Method or TaskMaster) per project
FR29: Founder can configure project settings via YAML file
FR30: System reads story definitions from markdown/YAML files
FR31: Founder can initialize TinSu in an existing git repository
FR32: System persists task state, status, and timestamps in SQLite database
FR33: System stores agent run history (start time, duration, token usage, exit status)
FR34: System maintains searchable index of agent logs
FR35: System preserves human-readable project config in version-controlled YAML

### NonFunctional Requirements

NFR1: Kanban board interactions (drag, click, navigation) complete in <100ms
NFR2: Board loads with full task list in <1 second
NFR3: UI remains responsive (non-blocking) during agent execution
NFR4: Agent terminal output streams to UI with <500ms latency
NFR5: Terminal view handles high-frequency output without dropping frames
NFR6: SQLite queries for task list views complete in <200ms
NFR7: Task state changes persist immediately (no visible delay)
NFR8: Agent stall detection triggers within configured threshold (default: 5 minutes of no output)
NFR9: Pause/Resume commands execute within 1 second
NFR10: System recovers gracefully from Claude Code CLI crashes without data loss
NFR11: No task data is lost if application is force-quit during agent execution
NFR12: Worktree creation/deletion succeeds or fails cleanly (no partial states)
NFR13: Merge conflicts are detected before corrupting main branch
NFR14: Git operations provide clear error messages on failure
NFR15: SQLite database maintains ACID properties
NFR16: Application can recover from unexpected shutdown without database corruption
NFR17: System detects if Claude Code CLI is not installed and provides clear error
NFR18: Context injection works with story files up to 50KB
NFR19: PTY integration works on macOS and Linux
NFR20: System detects if git is not initialized and provides clear error
NFR21: Worktree operations work with repositories up to 10GB
NFR22: Branch operations complete within 5 seconds for typical repositories
NFR23: System handles story files with special characters in filenames
NFR24: YAML/Markdown parsing provides clear error messages on invalid syntax

### Additional Requirements

**From Architecture (Starter Template - CRITICAL for Epic 1 Story 1):**

- Initialize project using electron-vite with React + TypeScript template
- Command: `npm create @quick-start/electron@latest tinsu -- --template react-ts`
- This provides: TypeScript, Vite, React, electron-builder

**From Architecture (Technology Stack - EXPLICIT VERSIONS as of January 2026):**

| Category            | Package               | Version      | Notes                          |
| ------------------- | --------------------- | ------------ | ------------------------------ |
| **Core Framework**  | electron              | ^39.2.7      | Chromium M142, Node.js 22      |
|                     | electron-vite         | ^5.0.0       | Latest stable                  |
|                     | react                 | ^19.2.3      | Activity API, useEffectEvent   |
|                     | react-dom             | ^19.2.3      |                                |
|                     | typescript            | ^5.9.3       | v6/v7 coming 2026              |
|                     | vite                  | ^7.3.0       | ESM-only, Node 20.19+ required |
| **Data Layer**      | drizzle-orm           | 1.0.0-beta.2 | Use beta tag                   |
|                     | better-sqlite3        | ^12.5.0      | Sync API for Electron          |
|                     | @trpc/server          | ^11.8.1      |                                |
|                     | @trpc/client          | ^11.8.1      |                                |
|                     | trpc-electron         | latest       | mat-sz fork for tRPC v11       |
|                     | zod                   | ^4.3.5       | v4 with Codecs API             |
| **UI Layer**        | tailwindcss           | ^4.1.18      | New Vite plugin setup          |
|                     | @tailwindcss/vite     | ^4.1.18      | Required for Vite 7            |
|                     | shadcn/ui             | CLI-based    | Copy-paste, no version lock    |
|                     | @dnd-kit/core         | ^6.3.1       | Stable                         |
|                     | @dnd-kit/sortable     | ^9.0.0       | For Kanban columns             |
|                     | zustand               | ^5.0.9       | v5 major                       |
|                     | @tanstack/react-query | ^5.90.16     | Via tRPC integration           |
| **Terminal & Diff** | @xterm/xterm          | ^6.0.0       | New scoped package name        |
|                     | node-pty              | ^1.1.0       | Microsoft maintained           |
|                     | monaco-editor         | ^0.55.1      | ESM preferred                  |
|                     | @monaco-editor/react  | ^4.7.0       | React wrapper                  |
| **Build**           | electron-builder      | ^26.4.0      | Dec 2025 release               |

**From Architecture (Project Structure):**

- src/main/ - Electron main process (tRPC routers, services, db)
- src/preload/ - contextBridge IPC (type-safe window.api)
- src/renderer/ - React application (components, hooks, stores)
- src/shared/ - Shared types between main/renderer
- data/tinsu.db - SQLite database file (gitignored)

**From Architecture (Naming Conventions):**

- Database: snake_case tables (tasks, agent_runs), snake_case columns (created_at)
- tRPC: camelCase procedures (getTask, createTask, updateStatus)
- React: PascalCase components (TaskCard, KanbanBoard), use prefix hooks (useTask)
- TypeScript: PascalCase types (Task, AgentRun), no I prefix

**From Architecture (Service Boundaries):**

- PtyService: node-pty wrapper for spawn/kill/pause/resume
- GitService: Git CLI wrapper for worktree/branch/merge operations
- StallDetectorService: Output monitoring with timeout detection
- ContextBuilderService: Story/arch context assembly for agent prompts

**From UX Design (Interaction Patterns):**

- Keyboard-first navigation: A to approve, R to reject, arrow keys to navigate board
- 60-Second Velocity Loop: Review → Approve → Commit → Next → Go
- Drag to start agent execution (no confirmation modal)
- Approve triggers git merge automatically (no extra confirmation)

**From UX Design (Layout Specifications):**

- Dark theme with "Calm Command" palette (background #0a0a0b, card #18181b)
- Terminal dock at bottom 30-40% height, collapsible to 80px
- Review panel 400px slide-over from right edge
- 4 equal-width Kanban columns with 12px card gap, 16px column padding

**From UX Design (Status System):**

- AgentStatusBadge variants: Idle (gray), Running (green), Stalled (yellow), Review (purple), Done (green check), Error (red)
- Status colors: --status-running #22c55e, --status-stalled #f59e0b, --status-review #8b5cf6

**From UX Design (Accessibility):**

- WCAG 2.1 Level AA compliance required
- Visible 2px focus rings on interactive elements
- Color + icon for status (not color alone)
- Support prefers-reduced-motion for animations
- Responsive: Desktop 1024px+, Tablet 768-1023px, Mobile 320-767px

### FR Coverage Map

| FR   | Epic   | Description                          |
| ---- | ------ | ------------------------------------ |
| FR1  | Epic 2 | Kanban board with 4 columns          |
| FR2  | Epic 2 | Drag tasks between columns           |
| FR3  | Epic 2 | Create new tasks                     |
| FR4  | Epic 2 | Sprint/Epic/Story hierarchy          |
| FR5  | Epic 2 | Task velocity metrics                |
| FR6  | Epic 2 | Filter by sprint/epic/status         |
| FR7  | Epic 5 | Start agent on drag to In Progress   |
| FR8  | Epic 5 | Spawn Claude Code CLI with context   |
| FR9  | Epic 5 | Real-time terminal output            |
| FR10 | Epic 5 | Auto-move to Review on completion    |
| FR11 | Epic 5 | Add context notes for agent          |
| FR12 | Epic 6 | Stall detection                      |
| FR13 | Epic 6 | Visual stall indicator               |
| FR14 | Epic 6 | Pause agent                          |
| FR15 | Epic 6 | Resume agent                         |
| FR16 | Epic 6 | View reasoning logs                  |
| FR17 | Epic 7 | Diff view of changes                 |
| FR18 | Epic 7 | Approve → merge + Done               |
| FR19 | Epic 7 | Reject with feedback                 |
| FR20 | Epic 7 | Request changes with comments        |
| FR21 | Epic 7 | Agent re-executes with feedback      |
| FR22 | Epic 8 | Create worktree per task             |
| FR23 | Epic 8 | Branch naming convention             |
| FR24 | Epic 8 | Agent works in isolated worktree     |
| FR25 | Epic 8 | Merge on approve                     |
| FR26 | Epic 8 | Delete worktree after merge          |
| FR27 | Epic 8 | Detect merge conflicts               |
| FR28 | Epic 3 | Select methodology (BMAD/TaskMaster) |
| FR29 | Epic 3 | Configure via YAML                   |
| FR30 | Epic 3 | Read story definitions from files    |
| FR31 | Epic 1 | Initialize in existing git repo      |
| FR32 | Epic 1 | Persist task state in SQLite         |
| FR33 | Epic 1 | Store agent run history              |
| FR34 | Epic 1 | Searchable agent logs                |
| FR35 | Epic 1 | Version-controlled YAML config       |

**Coverage:** 35/35 FRs mapped

---

## Epic List

### Epic 1: Project Foundation & Development Environment

Initialize the Electron application with the full technology stack, database schema, and core infrastructure.
**FRs covered:** FR31, FR32, FR33, FR34, FR35

### Epic 2: Kanban Board & Task Management

Deliver the visual Kanban interface with drag-and-drop, task hierarchy, filtering, and velocity metrics.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6

### Epic 3: BMAD Planning Workflow

Run complete BMAD planning inside TinSu. Planning phases as Kanban cards with guided sequencing. Spawn BMAD agents, detect artifacts, import stories, bidirectional sync.
**FRs covered:** FR28, FR29, FR30

### Epic 4: TaskMaster Integration ⏸️ DEFERRED

Enable TaskMaster tasks.json sync and deterministic execution state management.
**FRs covered:** TaskMaster-specific requirements
**Status:** Deferred to future sprint — MVP focuses on BMAD Method only

### Epic 5: Story Implementation Workflow

Full BMAD implementation workflow: Sprint Planning → SM Draft → DEV Implement → DEV Review (different model) → Human Review → Retrospective. Multi-agent orchestration, 5x retry loop, or basic Claude Code fallback.
**FRs covered:** FR7, FR8, FR9, FR10, FR11

### Epic 6: Agent Monitoring & Control

Detect agent stalls, provide visual indicators, and enable Pause/Resume intervention with reasoning log visibility.
**FRs covered:** FR12, FR13, FR14, FR15, FR16

### Epic 7: Review & Approval Workflow

Deliver the Manager-in-the-Loop experience with diff view, approve/reject actions, and feedback loop re-execution.
**FRs covered:** FR17, FR18, FR19, FR20, FR21

### Epic 8: Git Integration & Version Control

Manage git worktrees for task isolation, branch naming, merge on approve, and conflict detection.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27

---

## Epic 1: Project Foundation & Development Environment

**Goal:** Founder has a running Electron application with the complete technology stack, database persistence, tRPC IPC, and UI foundation configured — ready for feature development. Founder can initialize TinSu in any existing git repository.

**FRs covered:** FR31, FR32, FR33, FR34, FR35
**Dependencies:** None (this is the foundation)

### Story 1.1: Initialize Electron Project with electron-vite

As a developer,
I want to initialize the TinSu project using the electron-vite React TypeScript template,
So that I have a working Electron development environment with hot reload and proper build tooling.

**Acceptance Criteria:**

**Given** an empty project directory
**When** I run `npm create @quick-start/electron@latest tinsu -- --template react-ts`
**Then** the project scaffolds with src/main, src/preload, src/renderer directories
**And** running `npm run dev` launches the Electron app with hot reload
**And** the package.json includes electron ^39.2.7, electron-vite ^5.0.0, react ^19.2.3, typescript ^5.9.3

**Given** the project is initialized
**When** I run `npm run build`
**Then** the application builds successfully for the current platform
**And** no TypeScript errors are present

---

### Story 1.2: Configure Tailwind CSS 4 and shadcn/ui

As a developer,
I want Tailwind CSS 4 and shadcn/ui configured with the dark theme,
So that I can build consistent, accessible UI components using the design system.

**Acceptance Criteria:**

**Given** the electron-vite project from Story 1.1
**When** I install tailwindcss ^4.1.18 and @tailwindcss/vite ^4.1.18
**Then** Tailwind processes CSS in the renderer process
**And** utility classes like `bg-zinc-900` render correctly

**Given** Tailwind is configured
**When** I run `npx shadcn@latest init`
**Then** shadcn/ui initializes with the "zinc" base color and dark mode
**And** I can add components via `npx shadcn@latest add button`

**Given** the dark theme is configured
**When** the app loads
**Then** the background color is #0a0a0b (--background from Calm Command palette)
**And** the CSS variable --card is set to #18181b

---

### Story 1.3: Set Up SQLite Database with Drizzle ORM

As a developer,
I want SQLite database connectivity with Drizzle ORM in the main process,
So that task and agent data can be persisted locally with type-safe queries.

**Acceptance Criteria:**

**Given** the project from Story 1.2
**When** I install drizzle-orm@beta, better-sqlite3 ^12.5.0, and drizzle-kit
**Then** the packages install without errors
**And** better-sqlite3 native bindings compile for Electron

**Given** Drizzle is installed
**When** I create a database connection in src/main/db/index.ts
**Then** the database file is created at data/tinsu.db on first run
**And** the data/ directory is gitignored

**Given** the database connection exists
**When** I run `npx drizzle-kit generate`
**Then** migration SQL files are generated in drizzle/ directory
**And** `npx drizzle-kit migrate` applies migrations successfully

**Given** the database is configured
**When** the app starts after a crash or force-quit
**Then** the SQLite database maintains ACID properties (NFR15)
**And** no data corruption occurs (NFR16)

---

### Story 1.4: Create Core Database Schema for Tasks and Agent Runs

As a developer,
I want the core database schema for tasks and agent_runs tables,
So that task state and agent execution history can be persisted (FR32, FR33).

**Acceptance Criteria:**

**Given** Drizzle ORM is configured from Story 1.3
**When** I define the tasks table schema
**Then** the table includes: id (text PK), title (text), description (text), status (text), epic_id (text nullable), sprint_id (text nullable), created_at (integer), updated_at (integer)
**And** snake_case naming convention is used per architecture

**Given** the tasks table exists
**When** I define the agent_runs table schema
**Then** the table includes: id (text PK), task_id (text FK), start_time (integer), end_time (integer nullable), duration_ms (integer nullable), token_usage (integer nullable), exit_status (text nullable), log_path (text nullable)
**And** a foreign key relationship links agent_runs to tasks

**Given** both schemas are defined
**When** I run migrations
**Then** both tables are created in tinsu.db
**And** I can insert and query records using Drizzle's type-safe API

**Given** records exist in the database
**When** I query task list views
**Then** queries complete in <200ms (NFR6)

---

### Story 1.5: Implement tRPC IPC Layer

As a developer,
I want type-safe IPC communication between main and renderer using tRPC,
So that the UI can call main process functions with full TypeScript inference.

**Acceptance Criteria:**

**Given** the database is set up from Story 1.4
**When** I install @trpc/server ^11.8.1, @trpc/client ^11.8.1, trpc-electron, and zod ^4.3.5
**Then** the packages install without errors

**Given** tRPC packages are installed
**When** I create a tRPC router in src/main/trpc/router.ts
**Then** I can define procedures like `tasks.getAll`, `tasks.create`, `tasks.updateStatus`
**And** procedures use Zod schemas for input validation

**Given** the router is defined
**When** I expose it via trpc-electron in the main process
**Then** the renderer can import the router type
**And** calling `trpc.tasks.getAll.query()` returns typed task data

**Given** the tRPC layer is complete
**When** I make IPC calls from the renderer
**Then** TypeScript provides full autocomplete for procedure names and parameters
**And** runtime validation errors are thrown for invalid inputs

---

### Story 1.6: Build App Shell Layout with Dark Theme

As a founder,
I want to see the basic app shell with header, sidebar placeholder, and main content area,
So that I know the application is running and ready for feature development.

**Acceptance Criteria:**

**Given** tRPC is working from Story 1.5
**When** I create the AppShell component in src/renderer/components/
**Then** it renders a header bar at the top (48px height)
**And** a sidebar placeholder on the left (240px width, collapsible)
**And** a main content area filling the remaining space

**Given** the AppShell exists
**When** the app loads
**Then** the dark theme from Story 1.2 is applied
**And** the header shows "TinSu" as the app title
**And** the main area displays "Ready for development" placeholder text

**Given** the layout is rendered
**When** I resize the window
**Then** the layout responds appropriately (min-width: 1024px for desktop)
**And** the main content area adjusts to fill available space

**Given** the app is running
**When** I use keyboard navigation
**Then** focus rings are visible (2px) on interactive elements
**And** the app meets WCAG 2.1 AA contrast requirements

---

### Story 1.7: Add Project Configuration System

As a founder,
I want project configuration stored in a human-readable YAML file,
So that settings are version-controlled and editable outside the app (FR35).

**Acceptance Criteria:**

**Given** the app shell from Story 1.6
**When** I create a ConfigService in src/main/services/
**Then** it reads from .tinsu/config.yaml in the project root
**And** it creates a default config file if none exists

**Given** the ConfigService exists
**When** I define the config schema
**Then** it includes: projectName (string), methodology (enum: 'bmad' | 'taskmaster'), createdAt (ISO date), version (string)
**And** the schema is validated with Zod on load

**Given** a config file exists
**When** I expose config via tRPC procedure `config.get`
**Then** the renderer can read the current configuration
**And** `config.update` allows updating specific fields

**Given** the config file is in .tinsu/
**When** I commit the project to git
**Then** the .tinsu/config.yaml is tracked in version control
**And** .tinsu/data/ (database) is gitignored

**Given** the config file has invalid YAML syntax
**When** the app attempts to load it
**Then** a clear error message is displayed (NFR24)
**And** the app does not crash

---

### Story 1.8: Initialize TinSu in Existing Git Repository

As a founder,
I want to initialize TinSu in my existing git repository,
So that I can use TinSu to manage development on an active project (FR31).

**Acceptance Criteria:**

**Given** I open TinSu without a project loaded
**When** I click "Open Existing Project" or use File → Open
**Then** a file picker opens to select a directory
**And** only directories containing a .git folder are valid selections

**Given** I select a valid git repository
**When** TinSu initializes
**Then** a .tinsu/ folder is created in the project root
**And** .tinsu/config.yaml is created with detected project name
**And** .tinsu/data/ is added to .gitignore if not already present

**Given** the repository has no .git folder
**When** I try to select it
**Then** an error message explains "TinSu requires a git repository"
**And** the selection is rejected

**Given** the repository already has .tinsu/ folder
**When** I open the project
**Then** TinSu loads the existing configuration
**And** no duplicate initialization occurs

**Given** I successfully initialize a project
**When** the app loads
**Then** the project name appears in the header
**And** the Kanban board is ready (empty or with imported tasks)

---

### Story 1.9: PTY Service for Process Management

As a developer,
I want a PTY service that wraps node-pty for process management,
So that both planning agents and story execution can spawn and control CLI processes.

**Acceptance Criteria:**

**Given** the main process
**When** I create a PtyService instance
**Then** it can spawn a new PTY process with a given command and args
**And** it returns a process ID for tracking

**Given** a running PTY process
**When** I call write(processId, data)
**Then** the data is sent to the process stdin
**And** special characters are handled correctly

**Given** a running PTY process
**When** I call kill(processId)
**Then** the process receives SIGTERM
**And** the process ID is cleaned up after exit

**Given** a running PTY process
**When** the process emits output
**Then** the PtyService emits an 'output' event with processId and data
**And** output events fire within 100ms of process output

**Given** PTY operations on macOS or Linux
**When** I spawn a process
**Then** it works correctly on both platforms (NFR19)
**And** shell environment variables are inherited

**Given** a process that crashes
**When** the crash occurs
**Then** the PtyService emits an 'exit' event with code and signal
**And** no zombie processes remain

---

### Story 1.10: Terminal Dock Component

As a founder,
I want an embedded terminal dock at the bottom of the app,
So that I can see real-time output from agents during planning and execution.

**Acceptance Criteria:**

**Given** the app shell layout
**When** the terminal dock is rendered
**Then** it appears at the bottom of the screen
**And** it occupies 30-40% of viewport height by default

**Given** the terminal dock
**When** I click the collapse button
**Then** it collapses to 80px height showing only the header
**And** I can expand it again by clicking

**Given** the terminal is expanded
**When** I drag the resize handle
**Then** I can adjust the height between 80px and 60% of viewport
**And** the height preference persists across sessions

**Given** the terminal component
**When** it initializes with xterm.js
**Then** it uses the dark theme (background #0a0a0b)
**And** font is monospace, 14px, with proper line height

**Given** output is streaming to the terminal
**When** high-frequency output occurs
**Then** the terminal handles it without dropping frames (NFR5)
**And** scrollback buffer is limited to 10,000 lines

**Given** the terminal has content
**When** I select text
**Then** I can copy it to clipboard
**And** right-click shows a context menu with Copy option

**Given** accessibility requirements
**When** I use keyboard navigation
**Then** I can focus the terminal with Tab
**And** the terminal announces its role to screen readers

---

## Epic 2: Kanban Board & Task Management

**Goal:** Founder can see all tasks on a visual 4-column Kanban board, drag tasks between columns, create new tasks with details, organize by Sprint/Epic/Story hierarchy, view velocity metrics, and filter the view.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6
**Dependencies:** Epic 1 (requires database and UI foundation)

### Story 2.1: Render Kanban Board with 4 Columns

As a founder,
I want to see a Kanban board with four columns (Backlog, In Progress, Review, Done),
So that I can visualize the status of all my tasks at a glance (FR1).

**Acceptance Criteria:**

**Given** the app shell from Epic 1
**When** I navigate to the main board view
**Then** I see four columns: "Backlog", "In Progress", "Review", "Done"
**And** columns have equal width with 16px padding
**And** column headers display the column name and task count

**Given** the board is rendered
**When** I view the layout
**Then** columns are arranged left-to-right in status order
**And** the board fills the main content area
**And** columns scroll vertically if content overflows

**Given** the board uses the dark theme
**When** I view the columns
**Then** column backgrounds use the card color (#18181b)
**And** column headers have subtle borders for separation

---

### Story 2.2: Display Task Cards in Columns

As a founder,
I want to see task cards displayed in their appropriate columns based on status,
So that I can see what work is in each stage (FR1).

**Acceptance Criteria:**

**Given** tasks exist in the database
**When** the board loads
**Then** each task appears as a card in its corresponding status column
**And** cards display the task title prominently
**And** cards show a truncated description (max 2 lines)

**Given** a task card is rendered
**When** I view the card
**Then** it displays an AgentStatusBadge (Idle, Running, etc.) based on agent state
**And** the card shows the epic name if assigned
**And** cards have 12px gap between them

**Given** the board has many tasks
**When** the board loads
**Then** the full task list loads in <1 second (NFR2)
**And** cards render without layout shift

**Given** I use keyboard navigation
**When** I press arrow keys on the board
**Then** focus moves between cards
**And** focused cards show a visible 2px focus ring

---

### Story 2.3: Implement Drag-and-Drop Between Columns

As a founder,
I want to drag task cards between columns to change their status,
So that I can quickly update task progress (FR2).

**Acceptance Criteria:**

**Given** @dnd-kit/core and @dnd-kit/sortable are installed
**When** I drag a task card
**Then** the card follows my cursor with a subtle shadow
**And** the source column shows a placeholder
**And** valid drop zones highlight on hover

**Given** I am dragging a card
**When** I drop it in a different column
**Then** the task status updates to match the column
**And** the database persists the change immediately (NFR7)
**And** the card animates smoothly to its new position

**Given** I am dragging a card
**When** I drop it in the same column at a different position
**Then** the card reorders within the column
**And** the sort order is persisted

**Given** drag-and-drop is active
**When** I perform any drag operation
**Then** the interaction completes in <100ms (NFR1)
**And** no UI jank or frame drops occur

**Given** accessibility requirements
**When** I use keyboard to move a card
**Then** I can use Space to pick up, arrows to move, Space to drop
**And** screen readers announce the drag state

---

### Story 2.4: Create New Task Dialog

As a founder,
I want to create new tasks with title, description, and acceptance criteria,
So that I can add work items to my board (FR3).

**Acceptance Criteria:**

**Given** I am viewing the board
**When** I click the "+" button in a column header or press "N"
**Then** a modal dialog opens for creating a new task
**And** the dialog is focused and traps keyboard focus

**Given** the create task dialog is open
**When** I view the form
**Then** I see fields for: Title (required), Description (optional), Acceptance Criteria (optional, markdown)
**And** the form pre-selects the column I clicked "+" in as the initial status

**Given** I fill out the task form
**When** I click "Create" or press Cmd/Ctrl+Enter
**Then** the task is created in the database
**And** the new card appears in the appropriate column
**And** the dialog closes

**Given** the title field is empty
**When** I try to submit
**Then** validation prevents submission
**And** the title field shows an error message

**Given** I want to cancel
**When** I press Escape or click outside the dialog
**Then** the dialog closes without saving
**And** no task is created

---

### Story 2.5: Add Sprint/Epic/Story Hierarchy

As a founder,
I want to organize tasks into a Sprint/Epic/Story hierarchy,
So that I can group related work and plan releases (FR4).

**Acceptance Criteria:**

**Given** the database schema from Epic 1
**When** I extend the schema
**Then** I add an `epics` table with: id, title, description, created_at
**And** I add a `sprints` table with: id, name, start_date, end_date, is_active
**And** tasks have foreign keys to epic_id and sprint_id (nullable)

**Given** epics and sprints exist
**When** I create or edit a task
**Then** I can assign it to an epic from a dropdown
**And** I can assign it to a sprint from a dropdown
**And** both are optional

**Given** a task is assigned to an epic
**When** I view the task card
**Then** the epic name appears as a colored badge on the card
**And** each epic has a consistent color

**Given** sprints exist
**When** I view the sidebar
**Then** I see a list of sprints with their date ranges
**And** the active sprint is highlighted
**And** I can click a sprint to filter the board

---

<!-- ### Story 2.5.1: Create and Edit Sprint

As a founder,
I want to create and edit sprints with name and date range,
So that I can organize my work into time-boxed iterations.

**Acceptance Criteria:**

**Given** I am viewing the sidebar
**When** I click the "+" button in the Sprints section
**Then** a modal dialog opens for creating a new sprint
**And** the dialog shows fields for: Name (required), Start Date, End Date
**And** dates default to a 2-week range starting from today (or after the last sprint)

**Given** the create sprint dialog is open
**When** I fill in the name and dates and click "Create"
**Then** the sprint is created in the database
**And** the new sprint appears in the sidebar sprint list
**And** the dialog closes

**Given** I want to edit an existing sprint
**When** I right-click a sprint in the sidebar or click its edit icon
**Then** an edit dialog opens with current values pre-filled
**And** I can modify name, start date, and end date

**Given** I edit sprint dates
**When** I set end date before start date
**Then** validation prevents saving
**And** an error message explains the issue

**Given** I save sprint changes
**When** the update completes
**Then** the sidebar reflects the updated sprint info immediately
**And** any filtered views update to match

---

### Story 2.5.2: Sprint List and Selection UI

As a founder,
I want to see all sprints in the sidebar and filter the board by sprint,
So that I can focus on work for a specific iteration.

**Acceptance Criteria:**

**Given** sprints exist in the database
**When** I view the sidebar
**Then** I see a "Sprints" section with all sprints listed
**And** sprints are grouped: Active (if any), Upcoming, Completed
**And** each sprint shows its name and task count

**Given** the sprint list is displayed
**When** I view an active sprint
**Then** it has a distinct visual indicator (e.g., green dot or "Active" badge)
**And** it appears at the top of the list

**Given** I click on a sprint in the sidebar
**When** the selection applies
**Then** the Kanban board filters to show only tasks in that sprint
**And** the selected sprint is highlighted in the sidebar
**And** the board header shows "Sprint: [name]" filter indicator

**Given** I want to see all tasks
**When** I click "All Tasks" or clear the sprint filter
**Then** the board shows tasks from all sprints (and unassigned)
**And** no sprint is highlighted in the sidebar

**Given** a sprint has no tasks assigned
**When** I view it in the sidebar
**Then** it shows "(0 tasks)" count
**And** selecting it shows empty columns with "No tasks in this sprint" placeholder

---

### Story 2.5.3: Sprint Lifecycle and Deletion

As a founder,
I want to start, close, and delete sprints,
So that I can manage the sprint lifecycle and clean up completed iterations.

**Acceptance Criteria:**

**Given** a sprint exists that is not active
**When** I click "Start Sprint" from its context menu
**Then** the sprint is marked as active
**And** any previously active sprint is automatically deactivated
**And** the sidebar updates to show the new active sprint

**Given** a sprint is active
**When** I click "Close Sprint" from its context menu
**Then** a dialog appears asking how to handle incomplete tasks
**And** options are: "Move to Backlog", "Move to [next sprint]", or "Keep in closed sprint"

**Given** I choose to move incomplete tasks when closing
**When** the close action completes
**Then** tasks with status != "done" are moved to the selected destination
**And** the sprint is marked as closed/completed
**And** it moves to the "Completed" section in sidebar

**Given** I want to delete a sprint
**When** I click "Delete" from its context menu
**Then** a confirmation dialog shows: "Delete [Sprint Name]? X tasks will be unassigned."
**And** I can confirm or cancel

**Given** I confirm sprint deletion
**When** the delete completes
**Then** the sprint is removed from the database
**And** all tasks previously in that sprint have their sprint_id set to null
**And** the sidebar updates immediately

**Given** the active sprint is deleted
**When** deletion completes
**Then** no sprint is marked as active
**And** the board shows all tasks (no sprint filter) -->

---

### Story 2.6: Implement Task Filtering

As a founder,
I want to filter tasks by sprint, epic, or status,
So that I can focus on specific subsets of work (FR6).

**Acceptance Criteria:**

**Given** I am viewing the board
**When** I click the filter button in the header
**Then** a filter panel appears with options for: Sprint, Epic, Status
**And** each filter shows available options as checkboxes

**Given** filters are available
**When** I select a sprint filter
**Then** only tasks in that sprint are displayed
**And** the filter state is reflected in the UI (badge showing active filters)

**Given** I select an epic filter
**When** I view the board
**Then** only tasks belonging to that epic are shown
**And** I can select multiple epics (OR logic)

**Given** I select a status filter
**When** I view the board
**Then** columns without matching tasks show "No tasks" placeholder
**And** the task count in column headers updates

**Given** multiple filters are active
**When** I view results
**Then** filters combine with AND logic (sprint AND epic)
**And** I can clear all filters with one click

**Given** I apply filters
**When** I refresh the page
**Then** filter state is preserved in URL query params
**And** I can share filtered views via URL

---

### Story 2.7: Add Velocity Metrics Widget

As a founder,
I want to view task velocity metrics showing tasks completed per week,
So that I can track my team's throughput over time (FR5).

**Acceptance Criteria:**

**Given** tasks have been completed (moved to Done with timestamps)
**When** I view the velocity widget in the sidebar or header
**Then** I see tasks completed in the current week
**And** I see a mini chart showing the last 4 weeks trend

**Given** velocity data exists
**When** I hover over the chart
**Then** I see the exact count for each week
**And** the tooltip shows the week date range

**Given** I want more detail
**When** I click the velocity widget
**Then** a detailed view expands showing:

- Tasks completed by day (bar chart)
- Average velocity (tasks/week)
- Comparison to previous period

**Given** no tasks have been completed yet
**When** I view the velocity widget
**Then** it shows "No data yet" with helpful text
**And** the chart area shows a placeholder

**Given** the velocity calculation
**When** computing "completed this week"
**Then** it uses the task's updated_at timestamp when status changed to "done"
**And** weeks start on Monday (ISO week)

---

## Epic 3: BMAD Planning Workflow

**Goal:** Founder can run the complete BMAD planning workflow inside TinSu. Planning phases appear as task cards on the Kanban board with guided sequencing. TinSu spawns the correct BMAD agent for each phase, detects created artifacts, and imports stories to the board. Artifacts sync bidirectionally with the Kanban.

**FRs covered:** FR28, FR29, FR30
**Dependencies:** Epic 1 (database, PTY, terminal), Epic 2 (Kanban board)

### Story 3.1: Planning Task Type & Database Schema

As a developer,
I want a task_type field to distinguish planning tasks from story tasks,
So that TinSu can handle them differently in the UI and execution.

**Acceptance Criteria:**

**Given** the tasks table schema
**When** I add the task_type field
**Then** it is an enum: 'planning' | 'story'
**And** existing tasks default to 'story'

**Given** a planning task
**When** I query for it
**Then** it includes: phase_number (1-5), phase_name, bmad_agent, bmad_workflow
**And** these fields are null for story tasks

**Given** the database schema
**When** I define the planning phases
**Then** the phases are: 1=Product Brief, 2=PRD, 3=Architecture, 4=UX Design, 5=Epics & Stories
**And** each phase maps to a specific BMAD agent and workflow path

**Given** migrations run
**When** the schema updates
**Then** existing data is preserved
**And** new fields have appropriate defaults

---

### Story 3.2: Initialize Planning Tasks on New Project

As a founder,
I want TinSu to create the 5 BMAD planning phase cards when I start a new project,
So that I have a guided path through the planning workflow.

**Acceptance Criteria:**

**Given** I initialize a new project with TinSu
**When** the project is created
**Then** 5 planning tasks are created in the Backlog column
**And** they are ordered: Product Brief (1), PRD (2), Architecture (3), UX Design (4), Epics & Stories (5)

**Given** the planning tasks are created
**When** I view the Kanban board
**Then** all 5 cards appear in Backlog in sequence
**And** the first card (Product Brief) is visually highlighted as "Start Here"

**Given** an existing project with BMAD artifacts
**When** I open it in TinSu for the first time
**Then** TinSu detects which phases are complete (artifacts exist)
**And** completed phases are created in Done column
**And** remaining phases are in Backlog

**Given** the project config
**When** planning tasks are initialized
**Then** the initialization state is persisted in .tinsu/config.yaml
**And** re-opening the project does not duplicate planning tasks

---

### Story 3.3: Planning Task Card UI

As a founder,
I want planning task cards to look distinct from story cards,
So that I can easily identify planning work vs implementation work.

**Acceptance Criteria:**

**Given** a planning task card
**When** it renders on the board
**Then** it shows a phase badge "📋 1/5" (or 2/5, 3/5, etc.)
**And** the badge uses a distinct color (e.g., blue) from story cards

**Given** a planning task card
**When** I view its content
**Then** it shows the phase name prominently (e.g., "Product Brief")
**And** it shows a brief description of what this phase produces

**Given** a planning task in Backlog
**When** it is the recommended next step
**Then** it has a subtle glow or border indicating "suggested"
**And** a tooltip explains why it's recommended

**Given** a completed planning task (in Done)
**When** I view the card
**Then** it shows a checkmark and the artifact file path
**And** clicking the card opens the artifact file

**Given** accessibility requirements
**When** screen readers encounter planning cards
**Then** they announce "Planning phase 1 of 5: Product Brief"
**And** the card role is properly identified

---

### Story 3.4: BMAD Agent Launcher

As a founder,
I want TinSu to spawn the correct BMAD agent when I drag a planning task to In Progress,
So that I can create planning artifacts without leaving TinSu.

**Acceptance Criteria:**

**Given** I drag "Product Brief" to In Progress
**When** the drop completes
**Then** TinSu spawns Claude Code CLI with the Analyst agent
**And** the terminal dock expands to show output
**And** the working directory is the project root

**Given** I drag "PRD" to In Progress
**When** the drop completes
**Then** TinSu spawns Claude Code CLI with the PM agent and PRD workflow
**And** the context includes the Product Brief if it exists

**Given** I drag "Architecture" to In Progress
**When** the drop completes
**Then** TinSu spawns Claude Code CLI with the Architect agent
**And** the context includes PRD and Product Brief

**Given** I drag "UX Design" to In Progress
**When** the drop completes
**Then** TinSu spawns Claude Code CLI with the UX Designer agent
**And** the context includes PRD and Architecture

**Given** I drag "Epics & Stories" to In Progress
**When** the drop completes
**Then** TinSu spawns Claude Code CLI with the PM agent and epics workflow
**And** the context includes PRD, Architecture, and UX Design

**Given** Claude Code CLI is not installed
**When** I try to start a planning phase
**Then** TinSu shows a clear error message (NFR17)
**And** provides instructions to install Claude Code

---

### Story 3.5: Artifact Detection on Phase Completion

As a founder,
I want TinSu to automatically detect artifacts when a planning phase completes,
So that I don't have to manually link files.

**Acceptance Criteria:**

**Given** the Product Brief agent exits successfully
**When** TinSu scans for new files
**Then** it detects product-brief\*.md in \_bmad-output/planning-artifacts/
**And** links the file to the planning task

**Given** the PRD agent exits successfully
**When** TinSu scans for new files
**Then** it detects prd.md in \_bmad-output/planning-artifacts/
**And** links the file to the planning task

**Given** the Architecture agent exits successfully
**When** TinSu scans for new files
**Then** it detects architecture.md in \_bmad-output/planning-artifacts/
**And** links the file to the planning task

**Given** the UX Design agent exits successfully
**When** TinSu scans for new files
**Then** it detects ux-design\*.md in \_bmad-output/planning-artifacts/
**And** links the file to the planning task

**Given** an artifact is detected
**When** the link is created
**Then** the planning task auto-moves to Review column
**And** the founder can verify the artifact before marking Done

**Given** no artifact is detected after agent exit
**When** TinSu scans
**Then** it shows a warning "Expected artifact not found"
**And** the task stays in In Progress for retry

---

### Story 3.6: Next Phase Suggestion with Skip Warning

As a founder,
I want TinSu to suggest the next planning phase and warn me if I skip,
So that I follow the recommended workflow but retain flexibility.

**Acceptance Criteria:**

**Given** Product Brief is Done
**When** I view the board
**Then** the PRD card is highlighted as "Recommended Next"
**And** other phases show their sequence number but no highlight

**Given** phases 1-3 are Done
**When** I view the board
**Then** UX Design (phase 4) is highlighted as "Recommended Next"

**Given** I try to start Architecture (phase 3) before PRD (phase 2)
**When** I drag it to In Progress
**Then** a warning modal appears: "PRD is recommended before Architecture. The Architect agent works best with a completed PRD. Continue anyway?"
**And** I can choose "Continue" or "Cancel"

**Given** I choose "Continue" on the skip warning
**When** the modal closes
**Then** the phase starts normally
**And** the warning is logged but not blocking

**Given** I want to see the recommended order
**When** I hover over a planning card
**Then** a tooltip shows: "Phase 3 of 5 • Depends on: PRD • Produces: architecture.md"

---

### Story 3.7: Story Import After Epics Phase

As a founder,
I want stories from epics.md to appear as task cards after the Epics & Stories phase completes,
So that I can start implementation immediately.

**Acceptance Criteria:**

**Given** the Epics & Stories phase completes
**When** TinSu detects epics.md
**Then** it parses the file to extract all epics and stories
**And** each story becomes a task card in Backlog

**Given** stories are imported
**When** I view the Kanban board
**Then** story cards show their epic badge (e.g., "Epic 1")
**And** story cards show their number (e.g., "1.3")
**And** cards are ordered by epic then story number

**Given** an epic has 7 stories
**When** they are imported
**Then** all 7 appear with correct parent epic reference
**And** the epic itself is created in the epics table

**Given** stories are imported
**When** I view a story card
**Then** it shows the story title and truncated description
**And** clicking opens a detail panel with full acceptance criteria

**Given** the import completes
**When** I check the planning phase card
**Then** it shows "Imported X stories from Y epics"
**And** the planning phase moves to Done

---

### Story 3.8: BMAD Artifact Scanner & Parser

As a founder,
I want TinSu to scan and parse existing BMAD artifacts,
So that I can open a project mid-planning and continue where I left off.

**Acceptance Criteria:**

**Given** a project with \_bmad-output/planning-artifacts/ folder
**When** TinSu opens the project
**Then** it scans for: product-brief*.md, prd.md, architecture.md, ux-design*.md, epics.md
**And** detected artifacts are indexed in the database

**Given** a markdown file with YAML frontmatter
**When** the parser processes it
**Then** it extracts frontmatter fields (stepsCompleted, inputDocuments, etc.)
**And** it extracts the document body as structured sections

**Given** epics.md exists
**When** the parser processes it
**Then** it extracts all epics with goals
**And** it extracts all stories with acceptance criteria in Given/When/Then format
**And** story numbers (e.g., "1.3") are parsed correctly

**Given** a file with invalid YAML frontmatter
**When** the parser attempts to process it
**Then** a clear error message identifies the issue (NFR24)
**And** the file is skipped but scanning continues

**Given** a file larger than 50KB
**When** the parser processes it
**Then** it succeeds but logs a warning about size (NFR18)
**And** context injection may truncate this file later

---

### Story 3.9: Bidirectional Sync Between Kanban and epics.md

As a founder,
I want changes in the Kanban board and epics.md to stay synchronized,
So that I can edit in either place without conflicts.

**Acceptance Criteria:**

**Given** I move a story task to a different column
**When** the status changes
**Then** the corresponding story in epics.md is updated with a status marker
**And** the file write completes within 1 second

**Given** I edit epics.md externally (e.g., in VS Code)
**When** I return to TinSu
**Then** it detects file changes via file watcher
**And** a notification appears: "epics.md changed. Sync now?"

**Given** I click "Sync now"
**When** sync runs
**Then** new stories are added to the board
**And** deleted stories are removed (with confirmation)
**And** updated content is reflected in task details

**Given** both Kanban and file changed the same story
**When** conflict is detected
**Then** TinSu shows a diff view
**And** I choose which version to keep

**Given** sync is in progress
**When** I try to edit a task
**Then** editing is blocked with "Syncing..." indicator
**And** editing resumes after sync completes

---

### Story 3.10: Link Artifacts to Tasks

As a founder,
I want each task linked to its relevant BMAD artifacts,
So that context injection knows which documents apply.

**Acceptance Criteria:**

**Given** a story task is imported from epics.md
**When** it is created
**Then** it automatically links to: PRD, Architecture, UX Design (if they exist)
**And** it stores a reference to its section in epics.md

**Given** the database schema
**When** I define artifact linking
**Then** a task_artifacts table stores: task_id, artifact_type, artifact_path, section_ref

**Given** a task has linked artifacts
**When** I view the task detail panel
**Then** I see a list of linked artifacts with file icons
**And** clicking opens the file in the system editor

**Given** I want to customize links
**When** I edit a task
**Then** I can add or remove artifact links
**And** changes persist to the database

**Given** an artifact file is deleted
**When** I view a task that referenced it
**Then** the link shows as "missing" with a warning icon
**And** context injection skips the missing file gracefully

---

### Story 3.11: Context Builder Service

As a founder,
I want the Context Builder Service to assemble relevant context for agent execution,
So that agents have the full picture when implementing stories.

**Acceptance Criteria:**

**Given** a story task is about to execute
**When** the Context Builder Service is invoked
**Then** it assembles: story title, description, acceptance criteria
**And** it includes: PRD summary (goals, constraints, user personas)
**And** it includes: Architecture summary (tech stack, patterns, conventions)
**And** it includes: UX Design summary (if available)

**Given** the assembled context
**When** it exceeds 50KB total
**Then** the service truncates less critical sections (UX first, then PRD details)
**And** story acceptance criteria are NEVER truncated
**And** a warning is logged about truncation

**Given** the Context Builder output
**When** I inspect it
**Then** sections are clearly delineated: ## Story, ## PRD, ## Architecture
**And** the format is compatible with Claude Code CLI

**Given** the story has custom context notes (FR11)
**When** context is assembled
**Then** notes appear in a ## Human Guidance section
**And** they are clearly marked as founder-provided

**Given** a planning task (not a story task)
**When** Context Builder is invoked
**Then** it includes artifacts from prior phases
**And** it does NOT include story-specific content

---

### Story 3.12: Re-run Planning Phase (Brownfield Refinement)

As a founder,
I want to re-run a planning phase to refine artifacts mid-sprint,
So that I can update my PRD or Architecture as I learn more.

**Acceptance Criteria:**

**Given** a planning phase is in Done
**When** I drag it back to In Progress
**Then** a confirmation appears: "Re-run Architecture phase? This will update architecture.md."
**And** I can choose "Re-run" or "Cancel"

**Given** I confirm re-run
**When** the agent spawns
**Then** the existing artifact is passed as context
**And** the agent can update or extend it

**Given** the re-run completes
**When** TinSu detects the updated artifact
**Then** the task moves back to Review
**And** I can verify changes before marking Done again

**Given** I have story tasks that depend on the artifact
**When** the artifact is updated
**Then** those stories automatically get the updated context on next execution
**And** no manual re-linking is required

**Given** I want to create a new story mid-sprint
**When** I click "+" in a column
**Then** I can create a BMAD-formatted story
**And** I choose: append to epics.md OR create separate file
**And** the new story appears on the board immediately

---

## Epic 4: TaskMaster Integration

**Goal:** Founder can initialize TinSu in an existing git repository with TaskMaster artifacts, sync tasks.json with the Kanban board, and leverage deterministic execution state management.

**FRs covered:** FR31 + Research requirements
**Dependencies:** Epic 1 (database), Epic 2 (Kanban), Epic 3 (methodology selection)

**Key Components:**

- Project initialization in existing git repo
- TaskMaster tasks.json detection and import
- Bi-directional sync: tasks.json ↔ Kanban board
- Dependency graph visualization
- Execution state management (pending → in_progress → done)

<!-- Stories will be added in Step 3 -->

---

## Epic 5: Story Implementation Workflow

**Goal:** Founder can execute stories using the full BMAD implementation workflow (Sprint Planning → SM Draft → DEV Implement → DEV Review → Human Review → Retrospective) or basic Claude Code mode. Multi-agent orchestration with configurable models, automated code review loop (max 5 retries), and epic retrospectives.

**FRs covered:** FR7, FR8, FR9, FR10, FR11
**Dependencies:** Epic 1 (PTY, terminal), Epic 2 (Kanban), Epic 3 (context injection)

### Story 5.1: Execution Mode Configuration

As a founder,
I want to configure the execution mode and model settings for my project,
So that I can choose between full BMAD workflow or basic Claude Code execution.

**Acceptance Criteria:**

**Given** the project settings panel
**When** I view execution configuration
**Then** I see options for: Execution Mode (BMAD Method | Basic Claude Code)
**And** I see model selection for: Dev Agent, Review Agent
**And** settings persist in .tinsu/config.yaml

**Given** BMAD Method mode is selected
**When** I configure models
**Then** I can select different models for Dev (e.g., Claude Opus) and Review (e.g., Claude Sonnet)
**And** a tooltip explains why different models are recommended

**Given** Basic Claude Code mode is selected
**When** I view settings
**Then** model selection shows only one model option
**And** the multi-agent workflow options are hidden

**Given** I change execution mode
**When** I save settings
**Then** the change applies to future story executions
**And** in-progress stories continue with their original mode

---

### Story 5.2: Sprint Planning Agent Step

As a founder,
I want TinSu to run the Scrum Master agent for sprint planning at the start of a sprint,
So that stories are properly prioritized and the sprint scope is defined.

**Acceptance Criteria:**

**Given** I have stories in Backlog
**When** I click "Start Sprint" or create a new sprint
**Then** TinSu prompts: "Run Sprint Planning with SM agent?"
**And** I can choose "Run Planning" or "Skip"

**Given** I choose "Run Planning"
**When** the SM agent spawns
**Then** it analyzes available stories and suggests sprint scope
**And** the terminal shows the agent's reasoning
**And** a sprint-status.yaml file is created/updated

**Given** sprint planning completes
**When** I view the board
**Then** suggested stories are marked with a "Sprint" badge
**And** I can accept or modify the sprint scope

**Given** I skip sprint planning
**When** I proceed
**Then** I can manually add stories to the sprint
**And** no SM agent is invoked

**Given** an active sprint exists
**When** I try to start another sprint
**Then** TinSu warns: "Active sprint exists. Close current sprint first?"

---

### Story 5.3: Trigger Story Execution on Drag

As a founder,
I want to start story execution by dragging a story card to In Progress,
So that the BMAD workflow begins automatically (FR7).

**Acceptance Criteria:**

**Given** BMAD Method mode is configured
**When** I drag a story to In Progress
**Then** TinSu shows the workflow steps: "SM Draft → DEV → Review"
**And** the first agent (SM) spawns automatically
**And** the terminal dock expands

**Given** Basic Claude Code mode is configured
**When** I drag a story to In Progress
**Then** Claude Code spawns directly with story context
**And** no multi-agent workflow UI is shown

**Given** a story is already In Progress
**When** I try to drag another story to In Progress
**Then** TinSu warns: "Another story is running. Queue this story?"
**And** I can choose "Queue", "Cancel", or "Run in parallel" (if supported)

**Given** the story has no acceptance criteria
**When** I drag it to In Progress
**Then** TinSu warns: "Story has no acceptance criteria. SM agent will draft them first."

---

### Story 5.4: SM Agent: Draft Story File

As a founder,
I want the Scrum Master agent to draft detailed story files before development,
So that the Dev agent has clear requirements to implement.

**Acceptance Criteria:**

**Given** a story is moved to In Progress (BMAD mode)
**When** the story lacks detailed acceptance criteria
**Then** the SM agent spawns first
**And** it creates/updates the story file with detailed AC in Given/When/Then format

**Given** the SM agent is running
**When** I view the progress indicator
**Then** it shows "Step 1/3: SM Drafting Story"
**And** the terminal shows SM agent output

**Given** the story already has detailed AC
**When** execution starts
**Then** SM draft step is skipped
**And** workflow proceeds directly to DEV agent

**Given** the SM agent completes
**When** the story file is updated
**Then** the updated content syncs to the task in TinSu
**And** workflow automatically proceeds to DEV agent

**Given** the SM agent fails
**When** an error occurs
**Then** the task shows error status
**And** I can retry or edit the story manually

---

### Story 5.5: DEV Agent: Implement Story

As a founder,
I want the Dev agent to implement the story with full context injection,
So that code is written according to requirements and architecture (FR8).

**Acceptance Criteria:**

**Given** SM draft completes (or is skipped)
**When** DEV agent spawns
**Then** Context Builder provides: story AC, PRD summary, architecture, UX design
**And** the agent works in the git worktree (if Epic 8 complete) or project root

**Given** the DEV agent is running
**When** I view the progress indicator
**Then** it shows "Step 2/3: DEV Implementing"
**And** the terminal streams real-time output (FR9)

**Given** the configured dev model
**When** the agent spawns
**Then** it uses the model selected in settings (e.g., Claude Opus)

**Given** the story has context notes (FR11)
**When** DEV agent runs
**Then** notes are included in the ## Human Guidance section of context

**Given** DEV agent completes successfully
**When** exit code is 0
**Then** workflow automatically proceeds to code review
**And** the terminal shows transition message

---

### Story 5.6: DEV Agent: Automated Code Review

As a founder,
I want an automated code review by a different model,
So that code quality is checked before human review.

**Acceptance Criteria:**

**Given** DEV implementation completes
**When** code review starts
**Then** a second DEV agent spawns with the configured review model
**And** progress shows "Step 3/3: Code Review"

**Given** the review agent
**When** it analyzes the changes
**Then** it has access to: the diff, story AC, architecture patterns
**And** it evaluates: correctness, style, security, test coverage

**Given** code review passes
**When** the review agent approves
**Then** the task auto-moves to Review column (FR10)
**And** terminal shows "✓ Code review passed"

**Given** code review fails
**When** the review agent finds issues
**Then** issues are captured as structured feedback
**And** workflow loops back to DEV agent with feedback

**Given** the review model setting
**When** review runs
**Then** it uses the configured review model (e.g., Claude Sonnet)
**And** this can differ from the dev model

---

### Story 5.7: Code Review Retry Loop

As a founder,
I want failed code reviews to automatically retry up to 5 times,
So that minor issues are fixed without my intervention.

**Acceptance Criteria:**

**Given** code review fails
**When** retry count is < 5
**Then** DEV agent re-runs with review feedback as additional context
**And** progress shows "DEV Implementing (Retry 2/5)"

**Given** retry is in progress
**When** DEV agent makes changes
**Then** the new diff is passed to review agent
**And** the cycle continues

**Given** code review fails 5 times
**When** the limit is reached
**Then** TinSu escalates to human review
**And** task moves to Review with warning: "Auto-review failed after 5 attempts"
**And** all review feedback is attached for human inspection

**Given** a retry is in progress
**When** I want to intervene
**Then** I can click "Stop & Review" to halt the loop
**And** current state moves to Review column

**Given** retry history
**When** I view task details
**Then** I see all retry attempts with their feedback
**And** I can understand why reviews failed

---

### Story 5.8: Real-time Output Streaming

As a founder,
I want to see real-time terminal output from all agents,
So that I can monitor progress and understand agent reasoning (FR9).

**Acceptance Criteria:**

**Given** any agent is running (SM, DEV, or Review)
**When** output is produced
**Then** it streams to the terminal dock within 500ms (NFR4)
**And** the terminal handles high-frequency output without drops (NFR5)

**Given** multiple agents run in sequence
**When** one agent completes and another starts
**Then** the terminal shows a clear separator: "═══ DEV Agent Starting ═══"
**And** output continues in the same terminal

**Given** the terminal has scrollback
**When** I scroll up during execution
**Then** new output doesn't force scroll to bottom
**And** I can click "Jump to latest" to resume auto-scroll

**Given** I want to copy output
**When** I select text in the terminal
**Then** I can copy to clipboard
**And** ANSI colors are preserved or stripped based on preference

---

### Story 5.9: Multi-Agent Progress Indicator

As a founder,
I want a visual progress indicator showing the current workflow step,
So that I know where I am in the SM → DEV → Review pipeline.

**Acceptance Criteria:**

**Given** BMAD workflow is running
**When** I view the task card or header
**Then** I see a stepper: [SM] → [DEV] → [Review]
**And** the current step is highlighted
**And** completed steps show checkmarks

**Given** a retry is in progress
**When** I view the stepper
**Then** DEV step shows "Retry 2/5"
**And** the Review step pulses to indicate pending

**Given** workflow completes
**When** task moves to Review column
**Then** all steps show checkmarks
**And** the stepper collapses to a summary: "Ready for human review"

**Given** an error occurs
**When** a step fails
**Then** that step shows an error icon
**And** tooltip explains the failure

**Given** Basic Claude Code mode
**When** execution runs
**Then** no multi-step indicator is shown
**And** just a simple "Running..." status appears

---

### Story 5.10: Auto-transition to Human Review

As a founder,
I want the task to automatically move to Review when code review passes,
So that I'm notified work is ready for my approval (FR10).

**Acceptance Criteria:**

**Given** code review passes
**When** the review agent exits successfully
**Then** the task moves to Review column
**And** the card shows "Awaiting human review" status

**Given** task moves to Review
**When** I have notifications enabled
**Then** a notification appears: "Story X.Y ready for review"
**And** clicking the notification focuses that card

**Given** Basic Claude Code mode
**When** the agent exits with code 0
**Then** task moves directly to Review
**And** no code review step occurred

**Given** agent exits with error
**When** exit code is non-zero
**Then** task stays in In Progress with error status
**And** I can view logs and retry

---

### Story 5.11: Context Notes for Stories

As a founder,
I want to add context notes to a story that the agent will receive,
So that I can provide human guidance for complex implementations (FR11).

**Acceptance Criteria:**

**Given** I view a story task detail
**When** I see the "Context Notes" field
**Then** I can add/edit markdown notes
**And** notes are saved to the task in database

**Given** context notes exist
**When** any agent runs for this story
**Then** notes appear in the ## Human Guidance section of assembled context
**And** notes are clearly marked as founder-provided

**Given** I edit notes while agent is running
**When** I save changes
**Then** current execution continues with old notes
**And** next execution uses updated notes

**Given** I want to add notes quickly
**When** I right-click a task card
**Then** "Add Context Note" option appears
**And** a quick-edit popover opens

---

### Story 5.12: Agent Run History

As a founder,
I want to see the history of all agent runs for a story,
So that I can track execution patterns and debug issues (FR33).

**Acceptance Criteria:**

**Given** an agent runs for a story
**When** it completes (success or failure)
**Then** a record is created: agent_type, model, start_time, end_time, duration_ms, exit_status, token_usage (if available)

**Given** multiple runs exist for a story
**When** I view task detail
**Then** I see a "Run History" section
**And** runs are listed chronologically with expandable details

**Given** a run has retry attempts
**When** I view history
**Then** each retry is logged as a separate entry
**And** linked to the same execution session

**Given** I want to debug a failure
**When** I click a run entry
**Then** I can view the full terminal log for that run
**And** logs are searchable (FR34)

**Given** the agent_runs table
**When** I query run history
**Then** queries complete in <200ms (NFR6)

---

### Story 5.13: SM Agent: Epic Retrospective

As a founder,
I want the Scrum Master agent to run a retrospective when all stories in an epic are done,
So that learnings are captured for future sprints.

**Acceptance Criteria:**

**Given** all stories in an epic are in Done
**When** the last story completes
**Then** TinSu prompts: "All stories in Epic X complete. Run retrospective?"
**And** I can choose "Run Retrospective" or "Skip"

**Given** I choose "Run Retrospective"
**When** the SM agent spawns
**Then** it analyzes: completed stories, time taken, retry counts, review feedback
**And** produces a retrospective summary document

**Given** retrospective completes
**When** the document is generated
**Then** it's saved to \_bmad-output/retrospectives/epic-{id}-retro.md
**And** the epic is marked as "Retrospective Complete"

**Given** I skip retrospective
**When** I proceed
**Then** the epic is marked "Done (no retro)"
**And** I can run retrospective later manually

**Given** I want to run retrospective early
**When** some stories remain
**Then** I can manually trigger retrospective from epic context menu
**And** it analyzes completed stories only

---

### Story 5.14: Basic Claude Code Mode (Fallback)

As a founder,
I want a simple execution mode without the multi-agent workflow,
So that I can quickly test or run simple tasks.

**Acceptance Criteria:**

**Given** Basic Claude Code mode is configured
**When** I drag a story to In Progress
**Then** Claude Code spawns directly with Context Builder output
**And** no SM draft or code review steps occur

**Given** basic mode execution
**When** the agent completes
**Then** task moves to Review (success) or stays In Progress (error)
**And** only one agent run is recorded in history

**Given** I want to switch modes mid-project
**When** I change execution mode in settings
**Then** the change applies to next story execution
**And** in-progress stories continue with their original mode

**Given** basic mode is selected
**When** I view settings
**Then** review model configuration is hidden
**And** UI is simplified to single-model selection

---

## Epic 6: Agent Monitoring & Control

**Goal:** Founder can monitor running agents for stalls, see visual indicators when intervention is needed, pause agents mid-execution, resume with preserved context, and view reasoning logs to understand agent decisions.

**FRs covered:** FR12, FR13, FR14, FR15, FR16
**Dependencies:** Epic 5 (requires agent execution)

### Story 6.1: Stall Detector Service

As a founder,
I want the system to detect when an agent has stalled,
So that I'm alerted when progress has stopped (FR12).

**Acceptance Criteria:**

**Given** an agent is running
**When** no terminal output occurs for the configured threshold (default: 5 minutes)
**Then** the agent is marked as "stalled"
**And** the stall event is logged with timestamp

**Given** the stall threshold
**When** I view project settings
**Then** I can configure the timeout (1-30 minutes)
**And** the default is 5 minutes (NFR8)

**Given** an agent is stalled
**When** new output arrives
**Then** the stall status clears automatically
**And** the agent returns to "running" status

**Given** the Stall Detector Service
**When** monitoring multiple agents (if parallel execution)
**Then** each agent is tracked independently
**And** stall detection triggers within the configured threshold (NFR8)

**Given** the agent is in a code review retry loop
**When** waiting between retries
**Then** the brief pause is not counted as a stall
**And** a grace period applies during transitions

---

### Story 6.2: Visual Stall Indicator

As a founder,
I want to see a visual indicator when an agent is stalled,
So that I know intervention may be needed (FR13).

**Acceptance Criteria:**

**Given** an agent is detected as stalled
**When** I view the Kanban board
**Then** the task card shows a yellow "Stalled" status badge
**And** the badge pulses gently to draw attention

**Given** the stalled status
**When** I view the AgentStatusBadge
**Then** it uses the --status-stalled color (#f59e0b)
**And** an icon (⚠️ or clock) accompanies the color (not color alone)

**Given** a stalled agent
**When** I hover over the status badge
**Then** a tooltip shows: "No output for X minutes. Consider pausing or checking."
**And** the tooltip includes action suggestions

**Given** a stalled agent
**When** I view the terminal dock header
**Then** it also shows the stalled indicator
**And** the header background subtly changes to amber

**Given** accessibility requirements
**When** the stall indicator appears
**Then** screen readers announce "Agent stalled, no output for X minutes"
**And** the status change is not communicated by color alone

---

### Story 6.3: Pause Running Agent

As a founder,
I want to pause a running agent mid-execution,
So that I can intervene or investigate without losing progress (FR14).

**Acceptance Criteria:**

**Given** an agent is running
**When** I click the "Pause" button in the terminal dock
**Then** SIGSTOP is sent to the PTY process
**And** the agent suspends immediately

**Given** an agent is paused
**When** I view the task card
**Then** it shows a "Paused" status badge (gray with pause icon)
**And** the terminal output shows "⏸ Agent paused by user"

**Given** pause is requested
**When** the command executes
**Then** it completes within 1 second (NFR9)
**And** the process state is preserved

**Given** an agent is paused
**When** I view the terminal
**Then** I can still scroll and read previous output
**And** I can copy text from the terminal

**Given** keyboard shortcuts
**When** I press Cmd/Ctrl+P with terminal focused
**Then** the pause action triggers
**And** the shortcut is shown in the button tooltip

---

### Story 6.4: Resume Paused Agent

As a founder,
I want to resume a paused agent with preserved context,
So that execution continues from where it stopped (FR15).

**Acceptance Criteria:**

**Given** an agent is paused
**When** I click the "Resume" button
**Then** SIGCONT is sent to the PTY process
**And** the agent continues execution

**Given** resume is requested
**When** the command executes
**Then** it completes within 1 second (NFR9)
**And** the agent context is fully preserved

**Given** an agent resumes
**When** I view the terminal
**Then** output shows "▶ Agent resumed"
**And** new output continues streaming

**Given** an agent resumes
**When** I view the task card
**Then** status returns to "Running" (green badge)
**And** any stall timer resets

**Given** keyboard shortcuts
**When** I press Cmd/Ctrl+P with a paused agent
**Then** the resume action triggers (same shortcut toggles)

**Given** an agent was paused for a long time
**When** I resume it
**Then** execution continues normally
**And** any API connections are re-established if needed

---

### Story 6.5: Pause/Resume During Multi-Agent Workflow

As a founder,
I want pause/resume to work correctly during the BMAD multi-agent workflow,
So that I can intervene at any step.

**Acceptance Criteria:**

**Given** the SM agent is running (step 1)
**When** I pause
**Then** only the current agent (SM) is paused
**And** the workflow does not advance to DEV

**Given** the DEV agent is running (step 2)
**When** I pause
**Then** the DEV agent pauses
**And** no code review starts

**Given** a paused agent in the workflow
**When** I resume
**Then** that specific step continues
**And** workflow proceeds normally after completion

**Given** I pause during a code review retry
**When** I view status
**Then** the retry count is preserved
**And** resume continues the retry loop

**Given** I want to abort the workflow entirely
**When** I click "Stop" (not pause)
**Then** the agent is killed
**And** task returns to Backlog with "Stopped" status

---

### Story 6.6: Reasoning Log Capture

As a founder,
I want agent reasoning logs captured and stored,
So that I can understand how the agent made decisions (FR16).

**Acceptance Criteria:**

**Given** an agent is running
**When** it produces output
**Then** all output is captured to a log file
**And** the log path is stored in agent_runs table

**Given** Claude Code outputs reasoning (thinking blocks, tool calls)
**When** captured in logs
**Then** reasoning sections are tagged/identified
**And** tool calls are logged with inputs and outputs

**Given** a completed agent run
**When** I view the log file
**Then** it includes: full terminal output, timestamps, agent type, model used
**And** the file is stored in .tinsu/logs/{task-id}/{run-id}.log

**Given** log storage
**When** logs accumulate
**Then** old logs are retained for at least 30 days
**And** a cleanup setting allows configuration

**Given** log files exist
**When** I search across logs (FR34)
**Then** I can search by keyword across all logs
**And** results show file, line, and context

---

### Story 6.7: Reasoning Log Viewer

As a founder,
I want to view agent reasoning logs in a readable format,
So that I can understand agent decisions without parsing raw output (FR16).

**Acceptance Criteria:**

**Given** a task with agent run history
**When** I click "View Logs" on a run entry
**Then** a log viewer panel opens
**And** the log is displayed with syntax highlighting

**Given** the log viewer
**When** I view reasoning content
**Then** thinking blocks are collapsible/expandable
**And** tool calls are formatted as structured blocks

**Given** a long log
**When** I search within it
**Then** Cmd/Ctrl+F opens search
**And** matches are highlighted with navigation

**Given** the log viewer
**When** I want to share or debug
**Then** I can copy the entire log
**And** I can export to a file

**Given** the log contains errors
**When** I view it
**Then** error sections are highlighted in red
**And** I can jump to errors via a quick-nav

---

### Story 6.8: Agent Health Dashboard

As a founder,
I want a quick overview of all agent activity and health,
So that I can monitor multiple stories and spot issues.

**Acceptance Criteria:**

**Given** agents are running (or recently ran)
**When** I view the dashboard widget in the sidebar
**Then** I see: active agents count, stalled count, completed today
**And** clicking expands to show details

**Given** the dashboard
**When** an agent is stalled
**Then** the stalled count highlights in yellow
**And** I can click to jump to that task

**Given** multiple stories in progress
**When** I view the dashboard
**Then** each is listed with: story name, current step, duration
**And** status badges show running/stalled/paused

**Given** no agents are running
**When** I view the dashboard
**Then** it shows "No active agents"
**And** displays recent completions (last 24h)

**Given** I want quick actions
**When** I hover over an agent in the dashboard
**Then** I see Pause/Resume/View buttons
**And** clicking performs the action without navigating away

---

## Epic 7: Review & Approval Workflow

**Goal:** Founder can review all changes made by an agent in a diff view, approve changes (triggering merge and Done), reject with feedback (returning to In Progress), request changes with inline comments, and have the agent re-execute with feedback context — the Manager-in-the-Loop pattern.

**FRs covered:** FR17, FR18, FR19, FR20, FR21
**Dependencies:** Epic 5 (requires agent completion), Epic 8 (requires git worktree)

### Story 7.1: Review Panel Slide-over

As a founder,
I want a slide-over panel to review agent work,
So that I can see changes without leaving the Kanban board.

**Acceptance Criteria:**

**Given** a task is in the Review column
**When** I click the task card or press Enter
**Then** a 400px slide-over panel opens from the right
**And** the Kanban board remains visible (dimmed)

**Given** the review panel is open
**When** I view it
**Then** I see: story title, acceptance criteria summary, diff view, action buttons
**And** the layout follows the UX specification

**Given** the review panel
**When** I press Escape or click outside
**Then** the panel closes
**And** no changes are made to task status

**Given** multiple tasks in Review
**When** I close one panel and click another task
**Then** the panel updates to show the new task
**And** I can navigate between review tasks with arrow keys

**Given** accessibility requirements
**When** the panel opens
**Then** focus moves to the panel
**And** Tab cycles through panel elements only (focus trap)

---

### Story 7.2: Monaco Diff Viewer Integration

As a founder,
I want to see all changes in a VS Code-quality diff view,
So that I can review exactly what the agent modified (FR17).

**Acceptance Criteria:**

**Given** a task in Review
**When** the diff viewer loads
**Then** it shows all file changes made by the agent
**And** Monaco editor renders with syntax highlighting

**Given** the diff viewer
**When** I view changes
**Then** additions are highlighted in green
**And** deletions are highlighted in red
**And** unchanged context lines are shown for reference

**Given** multiple files were changed
**When** I view the diff
**Then** I see a file tree/list on the left
**And** clicking a file shows its diff in the main view
**And** file tree shows +/- line counts per file

**Given** the diff view
**When** I navigate
**Then** I can jump between changes with keyboard (N/P for next/prev)
**And** line numbers from both old and new versions are shown

**Given** the dark theme
**When** Monaco renders
**Then** it uses colors consistent with TinSu's "Calm Command" palette
**And** the diff colors have sufficient contrast

**Given** a large diff
**When** loading
**Then** the diff loads progressively
**And** I can scroll through smoothly without lag

---

### Story 7.3: Approve Changes Action

As a founder,
I want to approve changes with a single action,
So that the merge happens automatically and the task completes (FR18).

**Acceptance Criteria:**

**Given** I'm reviewing a task
**When** I click "Approve" or press "A"
**Then** the git worktree branch merges to main (Epic 8)
**And** the task moves to Done column

**Given** approval is triggered
**When** the merge succeeds
**Then** the worktree is cleaned up
**And** a success notification shows: "Story X.Y approved and merged"

**Given** approval is triggered
**When** a merge conflict occurs
**Then** the merge is aborted
**And** a warning shows: "Merge conflict detected"
**And** task stays in Review for conflict resolution

**Given** the 60-Second Velocity Loop (UX spec)
**When** I approve
**Then** no confirmation dialog appears (per UX spec: direct action)
**And** the next Review task auto-focuses if available

**Given** keyboard-first navigation
**When** "A" is pressed in review panel
**Then** approve action triggers
**And** the shortcut is shown in the button

---

### Story 7.4: Reject Changes with Feedback

As a founder,
I want to reject changes with written feedback,
So that the agent can retry with my guidance (FR19).

**Acceptance Criteria:**

**Given** I'm reviewing a task
**When** I click "Reject" or press "R"
**Then** a feedback modal opens
**And** I can type rejection reason in a text area

**Given** the feedback modal
**When** I type feedback and submit
**Then** the task moves back to In Progress
**And** the agent re-executes with feedback as context (FR21)

**Given** rejection feedback
**When** stored
**Then** it's saved to the task as "rejection_feedback"
**And** linked to the specific agent run that was rejected

**Given** the agent re-runs after rejection
**When** context is assembled
**Then** a ## Previous Attempt Feedback section is included
**And** the feedback is clearly marked as human-provided

**Given** I reject without feedback
**When** I leave the text area empty
**Then** a warning shows: "Feedback helps the agent improve. Continue anyway?"
**And** I can proceed or add feedback

---

### Story 7.5: Request Changes with Inline Comments

As a founder,
I want to add inline comments on specific lines,
So that the agent knows exactly what to fix (FR20).

**Acceptance Criteria:**

**Given** I'm viewing a diff
**When** I click the gutter next to a line
**Then** a comment input appears inline
**And** I can type my comment

**Given** I add an inline comment
**When** I submit it
**Then** the comment is anchored to that file:line
**And** a comment indicator shows on that line

**Given** multiple inline comments
**When** I view the diff
**Then** all comments are visible with indicators
**And** I can expand/collapse comment threads

**Given** I've added inline comments
**When** I click "Request Changes"
**Then** all comments are collected as structured feedback
**And** task moves back to In Progress
**And** agent re-runs with inline feedback in context

**Given** inline comments in context
**When** the agent receives them
**Then** they appear as: "File: path/to/file.ts, Line 42: [comment]"
**And** the agent can locate and address each comment

---

### Story 7.6: Agent Re-execution with Feedback Context

As a founder,
I want the agent to automatically re-run with my feedback,
So that it can address my concerns without manual re-configuration (FR21).

**Acceptance Criteria:**

**Given** a task is rejected or changes requested
**When** it returns to In Progress
**Then** the BMAD workflow restarts from DEV agent (not SM)
**And** previous context plus feedback is passed

**Given** the feedback is in context
**When** DEV agent runs
**Then** Context Builder includes: original story, architecture, PLUS rejection feedback
**And** feedback is in a prominent ## Revision Required section

**Given** inline comments exist
**When** context is assembled
**Then** comments are formatted as a structured list
**And** grouped by file for clarity

**Given** multiple rejection cycles
**When** feedback accumulates
**Then** only the most recent feedback is included (avoid bloat)
**And** previous attempts are summarized briefly

**Given** re-execution completes
**When** code review passes
**Then** task returns to Review for human inspection
**And** diff shows changes since last human review

---

### Story 7.7: Review History & Comparison

As a founder,
I want to compare the current version with previous review attempts,
So that I can see what changed after my feedback.

**Acceptance Criteria:**

**Given** a task has been rejected and re-submitted
**When** I view it in Review
**Then** I see a version selector: "v1, v2, v3..."
**And** I can compare any two versions

**Given** I select two versions
**When** the diff loads
**Then** it shows changes between those specific versions
**And** I can see what the agent modified based on my feedback

**Given** the review panel
**When** multiple versions exist
**Then** a timeline shows: "v1 → Rejected → v2 → Changes Requested → v3"
**And** clicking a version shows that snapshot

**Given** I want to see all my feedback
**When** I click "Feedback History"
**Then** I see all rejection/comment feedback chronologically
**And** each entry links to the version it addressed

---

### Story 7.8: Keyboard-First Review Navigation

As a founder,
I want to navigate and act on reviews entirely with keyboard,
So that I can maintain the 60-second velocity loop (UX spec).

**Acceptance Criteria:**

**Given** a task in Review column is focused
**When** I press Enter
**Then** the review panel opens
**And** focus moves to the diff viewer

**Given** the review panel is open
**When** I use keyboard shortcuts
**Then** A = Approve, R = Reject, C = Request Changes
**And** N/P = Next/Previous file in diff
**And** J/K = Next/Previous change within file

**Given** I approve a task
**When** it completes
**Then** focus moves to the next task in Review
**And** pressing Enter opens that review immediately

**Given** no more tasks in Review
**When** the last one is approved
**Then** focus returns to the board
**And** a toast shows "All reviews complete"

**Given** I want to see shortcuts
**When** I press "?" in review panel
**Then** a shortcuts overlay appears
**And** lists all available keyboard actions

---

### Story 7.9: Review Notifications

As a founder,
I want to be notified when tasks need my review,
So that I don't miss completed agent work.

**Acceptance Criteria:**

**Given** a task moves to Review column
**When** the transition occurs
**Then** a notification appears: "Story X.Y ready for review"
**And** clicking the notification opens that task's review panel

**Given** multiple tasks complete in sequence
**When** notifications queue up
**Then** they stack (max 3 visible)
**And** "X more" link shows additional

**Given** notification settings
**When** I configure them
**Then** I can enable/disable: in-app, system notifications
**And** I can set a notification sound

**Given** I'm actively reviewing
**When** new tasks arrive in Review
**Then** a subtle badge appears on the Review column header
**And** no disruptive notification interrupts my flow

**Given** I've been away
**When** I return to TinSu
**Then** I see a summary: "3 tasks awaiting review"
**And** clicking jumps to the Review column

---

## Epic 8: Git Integration & Version Control

**Goal:** Founder's code changes are safely isolated in git worktrees per task, branches follow naming convention, merge to main happens automatically on approval, worktrees are cleaned up, and merge conflicts are detected and surfaced.

**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27
**Dependencies:** Epic 1 (foundation), Epic 2 (task management)

### Story 8.1: Git Service Foundation

As a developer,
I want a Git Service that wraps git CLI operations,
So that all git interactions go through a consistent, error-handled interface.

**Acceptance Criteria:**

**Given** the main process
**When** I create a GitService instance
**Then** it can execute git commands via child_process
**And** all outputs are captured and parsed

**Given** the GitService
**When** I call any git operation
**Then** errors are caught and returned with clear messages (NFR14)
**And** the error includes the git command that failed

**Given** git is not installed
**When** GitService initializes
**Then** it detects the missing dependency
**And** throws a clear error: "Git not found. Please install git." (NFR20)

**Given** the project is not a git repository
**When** GitService operations are called
**Then** it detects the missing .git folder
**And** returns error: "Not a git repository" (NFR20)

**Given** repository size considerations
**When** operations run
**Then** they complete within reasonable time for repos up to 10GB (NFR21)
**And** branch operations complete within 5 seconds (NFR22)

---

### Story 8.2: Create Worktree on Task Start

As a founder,
I want a git worktree created when I move a task to In Progress,
So that agent work is isolated from the main branch (FR22).

**Acceptance Criteria:**

**Given** a story task is dragged to In Progress
**When** the drop completes
**Then** GitService creates a new worktree
**And** the worktree is located at .tinsu/worktrees/{task-id}/

**Given** worktree creation
**When** it runs
**Then** it uses `git worktree add` command
**And** the worktree is based on the current HEAD of main

**Given** worktree creation succeeds
**When** I check the filesystem
**Then** the worktree directory contains a full working copy
**And** the task record stores the worktree path

**Given** worktree creation fails
**When** an error occurs (e.g., disk full)
**Then** the task stays in Backlog
**And** a clear error message is shown
**And** no partial worktree is left behind (NFR12)

**Given** a worktree already exists for this task
**When** task is moved to In Progress again
**Then** the existing worktree is reused
**And** no duplicate is created

---

### Story 8.3: Branch Naming Convention

As a founder,
I want branches to follow a consistent naming convention,
So that I can identify which branch belongs to which story (FR23).

**Acceptance Criteria:**

**Given** a worktree is created for a story
**When** the branch is named
**Then** it follows pattern: tinsu/story-{task-id}-{slug}
**And** slug is derived from story title (lowercase, hyphens)

**Given** a story title "Add User Authentication"
**When** branch is created
**Then** branch name is: tinsu/story-abc123-add-user-authentication
**And** slug is truncated to max 50 characters

**Given** a story title with special characters
**When** slug is generated
**Then** special characters are removed or replaced
**And** the branch name is valid for git (NFR23)

**Given** a branch with this name already exists
**When** worktree creation attempts
**Then** a suffix is added: tinsu/story-{id}-{slug}-2
**And** uniqueness is guaranteed

**Given** I view the task in TinSu
**When** a branch exists
**Then** the branch name is displayed in task details
**And** I can copy it to clipboard

---

### Story 8.4: Agent Executes in Worktree

As a founder,
I want the agent to execute within the isolated worktree,
So that changes don't affect main until approved (FR24).

**Acceptance Criteria:**

**Given** an agent is spawned for a story
**When** PTY process is created
**Then** the working directory is set to the worktree path
**And** the agent sees only that worktree's files

**Given** the agent makes changes
**When** files are modified
**Then** changes are only in the worktree
**And** main branch remains unaffected

**Given** the agent runs git commands
**When** it commits
**Then** commits go to the worktree's branch
**And** main branch history is unchanged

**Given** the worktree path
**When** Context Builder assembles context
**Then** it uses worktree path for any file references
**And** relative paths work correctly

**Given** multiple tasks running in parallel (future)
**When** each has its own worktree
**Then** they are fully isolated
**And** no file conflicts occur between agents

---

### Story 8.5: Merge Worktree on Approval

As a founder,
I want the worktree branch to merge to main when I approve,
So that completed work is integrated automatically (FR25).

**Acceptance Criteria:**

**Given** I approve a task in Review
**When** the approval action triggers
**Then** GitService merges the worktree branch to main
**And** a merge commit is created

**Given** the merge succeeds
**When** it completes
**Then** main branch contains all changes from the worktree
**And** the merge is a fast-forward if possible, otherwise merge commit

**Given** the merge
**When** commit message is generated
**Then** it includes: "Merge story {id}: {title}"
**And** references the TinSu task ID

**Given** main has advanced since worktree creation
**When** merge is attempted
**Then** GitService first rebases or merges main into worktree
**And** then merges worktree to main

**Given** the merge completes
**When** I check git log
**Then** the story branch commits are in main history
**And** attribution is preserved

---

### Story 8.6: Delete Worktree After Merge

As a founder,
I want worktrees cleaned up after successful merge,
So that disk space is reclaimed and clutter is avoided (FR26).

**Acceptance Criteria:**

**Given** a merge completes successfully
**When** cleanup runs
**Then** `git worktree remove` is called
**And** the worktree directory is deleted

**Given** worktree removal
**When** it succeeds
**Then** the branch is also deleted (if merged)
**And** the task record clears the worktree path

**Given** worktree removal fails
**When** an error occurs
**Then** a warning is logged
**And** task still moves to Done (cleanup is best-effort)

**Given** I want to keep a worktree
**When** I enable "preserve worktrees" in settings
**Then** cleanup is skipped
**And** worktrees remain for inspection

**Given** orphaned worktrees exist
**When** I run cleanup from settings
**Then** TinSu lists worktrees without active tasks
**And** I can delete them manually

---

### Story 8.7: Merge Conflict Detection

As a founder,
I want merge conflicts detected before corrupting main,
So that I can resolve them safely (FR27, NFR13).

**Acceptance Criteria:**

**Given** a merge is attempted
**When** conflicts exist
**Then** the merge is aborted (not committed)
**And** main branch remains unchanged (NFR13)

**Given** conflicts are detected
**When** GitService reports them
**Then** it returns: list of conflicting files, conflict markers
**And** the task shows "Conflict" status

**Given** conflicts exist
**When** I view the task in Review
**Then** a warning banner shows: "Merge conflict in X files"
**And** conflicting files are listed

**Given** the conflict detection
**When** it runs
**Then** it uses `git merge --no-commit --no-ff` to test
**And** aborts immediately if conflicts found

---

### Story 8.8: Conflict Resolution UI

As a founder,
I want to resolve merge conflicts within TinSu,
So that I don't have to switch to command line.

**Acceptance Criteria:**

**Given** a task has merge conflicts
**When** I click "Resolve Conflicts"
**Then** a conflict resolution view opens
**And** I see each conflicting file listed

**Given** a conflicting file
**When** I click to view it
**Then** Monaco shows the conflict markers (<<<, ===, >>>)
**And** I can edit to resolve

**Given** I'm resolving a conflict
**When** I choose a side
**Then** I can click "Accept Incoming" or "Accept Current" or edit manually
**And** conflict markers are removed

**Given** all conflicts are resolved
**When** I click "Complete Merge"
**Then** the merge commits successfully
**And** task proceeds to Done

**Given** I can't resolve in TinSu
**When** I click "Open in Editor"
**Then** the worktree opens in system default editor
**And** I can resolve externally and return

---

### Story 8.9: Branch Status Indicators

As a founder,
I want to see branch status on task cards,
So that I know the git state at a glance.

**Acceptance Criteria:**

**Given** a task with an active worktree
**When** I view the card
**Then** a branch icon shows with the branch name (truncated)
**And** hovering shows full branch name

**Given** a task's branch is behind main
**When** I view the card
**Then** a warning shows: "X commits behind main"
**And** tooltip suggests rebasing

**Given** a task's branch has uncommitted changes
**When** the agent finishes
**Then** changes are auto-committed with message: "WIP: Agent changes"
**And** the card shows commit count

**Given** the task is in Done
**When** branch was merged
**Then** the branch indicator shows a checkmark
**And** "Merged" status is displayed

---

### Story 8.10: Git Operations Error Recovery

As a founder,
I want clear error messages and recovery options for git failures,
So that I can fix issues without losing work.

**Acceptance Criteria:**

**Given** any git operation fails
**When** the error occurs
**Then** TinSu shows a clear message explaining what failed (NFR14)
**And** suggests recovery steps

**Given** worktree creation fails
**When** the error is shown
**Then** I can retry or proceed without worktree (dev mode)
**And** the choice is logged

**Given** merge fails (not due to conflicts)
**When** the error occurs
**Then** the worktree is preserved
**And** I can manually inspect and retry

**Given** the app crashes during git operation
**When** I restart TinSu
**Then** it detects incomplete operations
**And** offers to clean up or resume

**Given** I want to debug
**When** git errors occur
**Then** full command and output are logged
**And** I can view detailed logs in settings
