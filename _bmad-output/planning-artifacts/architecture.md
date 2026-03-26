---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/prd-task-execution-sandbox.md
  - docs/research.md
  - docs/bmad-taskmaster-integration.md
  - _bmad-output/planning-artifacts/handoff-chat-tmux-migration.md
workflowType: 'architecture'
project_name: 'TinSu'
user_name: 'Tinxu'
date: '2026-01-03'
status: 'complete'
completedAt: '2026-01-03'
lastStep: 8
addenda:
  - name: 'Sprint Management Feature'
    date: '2026-01-13'
    status: 'ready'
lastUpdated: '2026-03-26'
featureExtensions:
  - name: 'Task Execution Sandbox'
    prd: 'prd-task-execution-sandbox.md'
    addedAt: '2026-01-12'
  - name: 'Chat Session tmux Migration'
    prd: 'prd.md (FR36-FR53, NFR25-NFR32)'
    handoff: 'handoff-chat-tmux-migration.md'
    addedAt: '2026-03-26'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines 35 functional requirements across 6 capability areas:

- **Board & Task Management (FR1-FR6):** Kanban interface with drag-and-drop, Sprint/Epic/Story hierarchy, task velocity metrics
- **Agent Execution (FR7-FR11):** Claude Code CLI integration, automatic context loading, real-time terminal view, auto-transition to Review
- **Agent Monitoring & Control (FR12-FR16):** Stall detection, Pause/Resume, reasoning log visibility
- **Review & Approval (FR17-FR21):** Diff view, Approve/Reject/Request Changes, feedback loop re-execution
- **Git & Version Control (FR22-FR27):** Worktree per task, branch naming convention, merge on approve, conflict detection
- **Project Configuration (FR28-FR31):** Methodology selection (BMAD/TaskMaster), YAML config, story file reading
- **Data Persistence (FR32-FR35):** SQLite for state, agent run history, searchable logs, version-controlled config

**Non-Functional Requirements:**

- **Performance:** <100ms UI interactions, <1s board load, <500ms terminal streaming, non-blocking execution
- **Reliability:** 5-minute stall detection, 1-second pause/resume, crash recovery without data loss, ACID SQLite
- **Integration:** PTY on macOS/Linux, 50KB context injection, 10GB repo support, clean error messages

**Scale & Complexity:**

- Primary domain: Full-stack desktop application (Web UI + local backend)
- Complexity level: Medium
- Estimated architectural components: 8-10 major subsystems

### Technical Constraints & Dependencies

1. **Claude Code CLI Prerequisite:** Must be installed separately; app detects and reports if missing
2. **Git Repository Required:** Project directory must be git-initialized
3. **Platform Support:** macOS and Linux (PTY integration); Windows deferred
4. **Local-First:** No cloud dependency for core functionality
5. **Single-User:** No authentication, RBAC, or multi-device sync for MVP

### Cross-Cutting Concerns Identified

1. **Process Lifecycle Management:** Spawning, monitoring, pausing, resuming, and cleaning up Claude Code subprocesses
2. **State Synchronization:** Keeping task state (SQLite), UI state, agent execution state, and Git branch state consistent
3. **Error Recovery:** Handling crashes, force-quits, merge conflicts, and agent failures gracefully
4. **Context Injection:** Dynamically loading story definitions, architecture specs, and project context into agent prompts
5. **Event-Driven Updates:** Real-time UI updates from PTY output and agent state changes

## Starter Template Evaluation

### Primary Technology Domain

Desktop Application (Electron) based on project requirements:

- Local-first architecture with no cloud dependency
- PTY integration for Claude Code CLI orchestration
- Real-time terminal streaming to embedded UI
- SQLite persistence for task state
- Git worktree management

### Starter Options Considered

| Starter                    | Build Tool | Pros                                         | Cons                          |
| -------------------------- | ---------- | -------------------------------------------- | ----------------------------- |
| electron-vite              | Vite 5     | Fastest HMR, latest v5.0, active maintenance | Need to add app-specific deps |
| Electron React Boilerplate | Webpack 5  | Battle-tested, 23k stars                     | Slower dev experience         |
| Electron Forge + Vite      | Vite       | Official tooling                             | Vite support experimental     |

### Selected Starter: electron-vite (React + TypeScript)

**Rationale for Selection:**

- Latest version (5.0) released December 2025 with isolated build improvements
- Vite provides sub-second HMR for rapid iteration
- Official React + TypeScript template with proper IPC structure
- Proven compatibility with node-pty ecosystem (used by electerm, xpty)
- electron-builder included for distribution packaging

**Initialization Command:**

```bash
npm create @quick-start/electron@latest tinsu -- --template react-ts
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**

- TypeScript 5.x with strict mode
- Node.js for main process
- Chromium for renderer process

**Build Tooling:**

- Vite 5.x for both main and renderer
- electron-builder for packaging
- ESBuild for fast transpilation

**Project Structure:**

```
tinsu/
├── src/
│   ├── main/           # Electron main process
│   ├── preload/        # Preload scripts (IPC bridge)
│   └── renderer/       # React application
├── electron.vite.config.ts
└── package.json
```

**Development Experience:**

- Hot Module Replacement (HMR) for React components
- Source maps for debugging
- TypeScript type checking
- ESLint + Prettier integration

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Data persistence layer (Drizzle + SQLite)
- IPC communication pattern (tRPC)
- UI component foundation (shadcn/ui + Tailwind)

**Important Decisions (Shape Architecture):**

- State management strategy (TanStack Query + Zustand)
- Drag-and-drop implementation (@dnd-kit)
- Code diff visualization (Monaco Editor)

**Deferred Decisions (Post-MVP):**

- Auto-update strategy (electron-updater)
- Crash reporting (Sentry integration)
- Analytics/telemetry

### Data Architecture

| Decision       | Choice                    | Version      | Rationale                                                       |
| -------------- | ------------------------- | ------------ | --------------------------------------------------------------- |
| **Database**   | SQLite via better-sqlite3 | latest       | Synchronous API ideal for Electron main process, local-first    |
| **ORM**        | Drizzle ORM               | 1.0.0-beta.2 | Type-safe, lightweight, excellent DX with better-sqlite3 driver |
| **Migrations** | Drizzle Kit               | 1.0.0-beta.2 | Schema introspection <1s, automatic migration generation        |

**Schema Strategy:**

- Tasks table: id, title, description, status, sprint_id, epic_id, timestamps
- Agent runs table: task_id, started_at, ended_at, token_usage, exit_status
- Logs table: run_id, timestamp, level, message (indexed for search)

### Authentication & Security

| Decision              | Choice                  | Rationale                               |
| --------------------- | ----------------------- | --------------------------------------- |
| **Authentication**    | None (MVP)              | Single-user local app, no auth required |
| **IPC Security**      | contextBridge isolation | Renderer has no direct Node.js access   |
| **Process Isolation** | Sandbox enabled         | Default Electron security model         |

### API & Communication Patterns

| Decision             | Choice        | Version | Rationale                                   |
| -------------------- | ------------- | ------- | ------------------------------------------- |
| **IPC Pattern**      | tRPC          | 11.6.0  | End-to-end type safety, procedure-based API |
| **Electron Adapter** | trpc-electron | latest  | Fork maintained for tRPC v11 compatibility  |
| **Validation**       | Zod           | latest  | Runtime validation for procedure inputs     |

**IPC Architecture:**

```
Renderer (React) ──tRPC Client──► Preload ──IPC──► Main (tRPC Router)
                                                      │
                                                      ├── taskRouter
                                                      ├── agentRouter
                                                      ├── gitRouter
                                                      └── configRouter
```

### Frontend Architecture

| Decision           | Choice         | Version  | Rationale                                                       |
| ------------------ | -------------- | -------- | --------------------------------------------------------------- |
| **Server State**   | TanStack Query | via tRPC | Automatic caching, refetching, optimistic updates               |
| **Local UI State** | Zustand        | latest   | Minimal boilerplate, React-friendly                             |
| **Components**     | shadcn/ui      | latest   | Tailwind-based, copy-paste ownership, accessible                |
| **Styling**        | Tailwind CSS   | ^4.1.18  | Utility-first, CSS-first config (no tailwind.config.js)         |
| **Drag-and-Drop**  | @dnd-kit       | latest   | Modern, accessible, excellent Kanban support                    |
| **Diff Viewer**    | Monaco Editor  | 4.7.0    | VS Code-quality diffs, syntax highlighting, handles large files |
| **Terminal**       | xterm.js       | latest   | Industry standard, used by VS Code                              |

**Component Architecture:**

- Layout: App shell with sidebar, main content, terminal panel
- Board: KanbanBoard → KanbanColumn → TaskCard (draggable)
- Task Detail: TaskPanel with tabs (Details, Terminal, Diff, Logs)
- Terminal: XTerminal component wrapping xterm.js + node-pty IPC

### Infrastructure & Deployment

| Decision        | Choice                                | Rationale                                   |
| --------------- | ------------------------------------- | ------------------------------------------- |
| **Packaging**   | electron-builder                      | Included with electron-vite, cross-platform |
| **Platforms**   | macOS (.dmg), Linux (.AppImage, .deb) | Per PRD, Windows deferred                   |
| **Auto-Update** | Deferred                              | Not required for MVP dog-fooding            |
| **Logging**     | electron-log                          | Simple file + console logging               |

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialize electron-vite project
2. Add Drizzle + better-sqlite3, create schema
3. Set up tRPC routers (main process)
4. Configure tRPC client (renderer)
5. Build UI shell with shadcn/ui + Tailwind
6. Implement Kanban board with @dnd-kit
7. Integrate xterm.js + node-pty for terminal
8. Add Monaco diff viewer for review panel

**Cross-Component Dependencies:**

- tRPC routers depend on Drizzle schema
- Terminal component depends on PTY IPC handlers
- Diff viewer depends on git worktree state
- Kanban state syncs with SQLite via tRPC mutations

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 6 areas where AI agents could make incompatible choices without explicit patterns.

### Naming Patterns

**Database Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake*case, plural | `tasks`, `agent_runs`, `sprint_stories` |
| Columns | snake_case | `created_at`, `task_id`, `exit_status` |
| Foreign Keys | `{referenced_table}_id` | `sprint_id`, `epic_id` |
| Indexes | `idx*{table}\_{columns}`|`idx_tasks_status`, `idx_logs_run_id` |

**tRPC Procedure Naming:**
| Type | Convention | Example |
|------|------------|---------|
| Queries | camelCase, get/list prefix | `getTask`, `listSprintTasks` |
| Mutations | camelCase, verb prefix | `createTask`, `updateStatus`, `deleteRun` |
| Subscriptions | camelCase, on prefix | `onAgentOutput`, `onTaskUpdate` |

**React/TypeScript Naming:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `TaskCard`, `KanbanBoard` |
| Component files | PascalCase.tsx | `TaskCard.tsx` |
| Hooks | camelCase, use prefix | `useTask`, `useAgentStatus` |
| Stores | camelCase, use + Store | `useTaskStore`, `useUIStore` |
| Types/Interfaces | PascalCase, no I prefix | `Task`, `AgentRun`, `SprintConfig` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_STALL_TIME`, `DEFAULT_BRANCH_PREFIX` |
| Utility functions | camelCase | `formatDate`, `parseStoryFile` |

### Structure Patterns

**Project Organization:**

```
src/
├── main/                         # Electron main process (Node.js)
│   ├── index.ts                  # Main entry, window creation
│   ├── trpc/
│   │   ├── routers/
│   │   │   ├── task.router.ts    # Task CRUD operations
│   │   │   ├── agent.router.ts   # PTY spawning, control
│   │   │   ├── git.router.ts     # Worktree, branch, merge
│   │   │   └── config.router.ts  # Project settings
│   │   ├── context.ts            # tRPC context (db access)
│   │   └── index.ts              # Root router, merged
│   ├── services/
│   │   ├── pty.service.ts        # node-pty wrapper
│   │   ├── git.service.ts        # Git/worktree operations
│   │   └── stall-detector.ts     # Agent monitoring
│   └── db/
│       ├── schema.ts             # Drizzle schema definitions
│       ├── index.ts              # DB connection
│       └── migrations/           # Generated migrations
├── preload/
│   └── index.ts                  # contextBridge, tRPC IPC
├── renderer/                     # React application
│   ├── App.tsx                   # Root component
│   ├── components/
│   │   ├── board/                # Kanban components
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── TaskCard.tsx
│   │   ├── task/                 # Task detail components
│   │   │   ├── TaskPanel.tsx
│   │   │   ├── TaskDetails.tsx
│   │   │   └── TaskActions.tsx
│   │   ├── terminal/             # Terminal components
│   │   │   ├── TerminalPanel.tsx
│   │   │   └── TerminalOutput.tsx
│   │   ├── review/               # Review/diff components
│   │   │   ├── DiffViewer.tsx
│   │   │   └── ReviewActions.tsx
│   │   ├── layout/               # App shell components
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── ui/                   # shadcn/ui components
│   ├── hooks/
│   │   ├── useTask.ts
│   │   ├── useAgent.ts
│   │   └── useTerminal.ts
│   ├── stores/
│   │   ├── ui.store.ts           # UI state (sidebar, panels)
│   │   └── terminal.store.ts     # Terminal buffer state
│   └── lib/
│       ├── trpc.ts               # tRPC client setup
│       └── utils.ts              # Shared utilities
└── shared/                       # Shared between main/renderer
    └── types/
        ├── task.types.ts
        ├── agent.types.ts
        └── ipc.types.ts
```

**File Co-location Rules:**

- Components: Related files together (TaskCard.tsx, TaskCard.test.tsx)
- Tests: Co-located with source files (\*.test.ts pattern)
- Styles: Tailwind classes inline, no separate CSS files

### Format Patterns

**tRPC Response Format:**

```typescript
// Direct returns - tRPC handles wrapping
// DO NOT wrap in { data: ... } or { success: true }

// Query - return data directly
getTask: t.procedure.input(z.object({ id: z.string() })).query(({ input }) => {
  return db.query.tasks.findFirst({ where: eq(tasks.id, input.id) })
})

// Mutation - return affected entity
updateStatus: t.procedure
  .input(
    z.object({
      id: z.string(),
      status: z.enum(['backlog', 'in_progress', 'review', 'done'])
    })
  )
  .mutation(({ input }) => {
    return db.update(tasks).set({ status: input.status }).where(eq(tasks.id, input.id)).returning()
  })
```

**Error Format:**

```typescript
// Use TRPCError with standard codes
throw new TRPCError({
  code: 'NOT_FOUND', // or BAD_REQUEST, INTERNAL_SERVER_ERROR, etc.
  message: 'Task not found',
  cause: originalError // Optional: chain original error
})

// Frontend receives: { message, code, data? }
```

**Date/Time Format:**

- Database: INTEGER (Unix timestamp in seconds)
- tRPC responses: ISO 8601 string (`2026-01-03T10:30:00Z`)
- Display: Formatted via `date-fns` in renderer

### Communication Patterns

**IPC Event Naming:**
| Category | Pattern | Examples |
|----------|---------|----------|
| PTY events | `pty:{action}` | `pty:data`, `pty:exit`, `pty:error` |
| Agent lifecycle | `agent:{state}` | `agent:started`, `agent:stalled`, `agent:complete` |
| Git operations | `git:{action}` | `git:worktree-created`, `git:merge-conflict` |
| Task updates | `task:{action}` | `task:status-changed`, `task:logs-updated` |

**Zustand Store Pattern:**

```typescript
// Pattern for all stores
interface TaskStore {
  // State
  selectedTaskId: string | null

  // Actions (always set prefix for mutations)
  setSelectedTask: (id: string | null) => void
  clearSelection: () => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  selectedTaskId: null,
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  clearSelection: () => set({ selectedTaskId: null })
}))
```

### Process Patterns

**Error Handling Layers:**
| Layer | Handling Approach |
|-------|-------------------|
| **Drizzle/DB** | Catch constraint violations, throw TRPCError |
| **Services** | Catch external errors (git, pty), throw TRPCError with context |
| **tRPC Router** | Let TRPCError propagate, add trpc error formatter |
| **React Query** | Use `onError` callback, show toast via shadcn/ui |
| **React UI** | ErrorBoundary at AppShell level for unexpected errors |

**Loading State Pattern:**

```typescript
// Use TanStack Query states directly
const { data, isLoading, error } = trpc.task.getTask.useQuery({ id });

// In components:
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <TaskDetails task={data} />;
```

**Agent Execution State Machine:**

```
idle → starting → running → (stalled?) → completing → review
                     ↓            ↓
                  paused      intervention
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly as documented
2. Place files in the correct directories per structure patterns
3. Use tRPC procedures for all main↔renderer communication
4. Throw TRPCError (not generic Error) in routers/services
5. Use Zustand stores for local UI state, tRPC for server state
6. Co-locate tests with source files

**Pattern Verification:**

- ESLint rules enforce naming conventions
- TypeScript strict mode catches type mismatches
- PR review checklist includes pattern compliance

### Anti-Patterns to Avoid

| Anti-Pattern                         | Correct Pattern              |
| ------------------------------------ | ---------------------------- |
| `ITask`, `IUser` (I prefix)          | `Task`, `User`               |
| `user_data.tsx` (snake_case file)    | `UserData.tsx`               |
| `{ success: true, data: ... }`       | Direct return from tRPC      |
| `ipcRenderer.send()` direct calls    | Use tRPC procedures          |
| `useState` for server data           | Use tRPC + TanStack Query    |
| Tests in separate `__tests__` folder | Co-located `*.test.ts` files |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
tinsu/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── electron-builder.yml
├── components.json                # shadcn/ui config (Tailwind v4 uses CSS-first, no tailwind.config.js)
├── drizzle.config.ts              # Drizzle Kit config
├── .env.example
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, typecheck, test
│       └── release.yml            # Build & publish releases
│
├── resources/                     # Electron app resources
│   └── icon.png
│
├── src/
│   ├── main/                      # === ELECTRON MAIN PROCESS ===
│   │   ├── index.ts               # App entry, window creation, tRPC setup
│   │   │
│   │   ├── trpc/
│   │   │   ├── index.ts           # Root router, createContext
│   │   │   ├── trpc.ts            # tRPC instance, procedure helpers
│   │   │   ├── context.ts         # Context type (db, services)
│   │   │   └── routers/
│   │   │       ├── task.router.ts       # FR1-FR6: Board & task CRUD
│   │   │       ├── agent.router.ts      # FR7-FR16: PTY spawn, control, monitor
│   │   │       ├── review.router.ts     # FR17-FR21: Approve/reject, feedback
│   │   │       ├── git.router.ts        # FR22-FR27: Worktree, branch, merge
│   │   │       └── config.router.ts     # FR28-FR31: Project settings
│   │   │
│   │   ├── services/
│   │   │   ├── pty.service.ts           # node-pty wrapper, spawn/kill/signal
│   │   │   ├── git.service.ts           # Git CLI wrapper, worktree ops
│   │   │   ├── stall-detector.service.ts # Output monitoring, timeout detection
│   │   │   ├── context-builder.service.ts # Story/arch context assembly
│   │   │   └── claude-cli.service.ts     # Claude Code CLI detection
│   │   │
│   │   └── db/
│   │       ├── index.ts                  # better-sqlite3 + Drizzle connection
│   │       ├── schema.ts                 # FR32-FR35: All table definitions
│   │       └── migrations/               # Drizzle Kit generated
│   │
│   ├── preload/                   # === PRELOAD SCRIPTS ===
│   │   ├── index.ts               # contextBridge, exposeInMainWorld
│   │   └── index.d.ts             # Type declarations for window.api
│   │
│   ├── renderer/                  # === REACT APPLICATION ===
│   │   ├── index.html             # Vite entry HTML
│   │   ├── main.tsx               # React root, providers
│   │   ├── App.tsx                # Root component, routing
│   │   ├── globals.css            # Tailwind base + shadcn vars
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx         # Main layout container
│   │   │   │   ├── Header.tsx           # App header, project selector
│   │   │   │   ├── Sidebar.tsx          # Sprint/Epic navigation
│   │   │   │   └── BottomPanel.tsx      # Collapsible terminal area
│   │   │   │
│   │   │   ├── board/
│   │   │   │   ├── KanbanBoard.tsx      # FR1: 5-column board container
│   │   │   │   ├── KanbanColumn.tsx     # FR1: Single column (Backlog/In Progress/Review/Done)
│   │   │   │   ├── TaskCard.tsx         # FR2: Draggable task card
│   │   │   │   └── NewTaskButton.tsx    # FR3: Quick task creation
│   │   │   │
│   │   │   ├── task/
│   │   │   │   ├── TaskPanel.tsx        # Side panel container
│   │   │   │   ├── TaskDetails.tsx      # FR4: Task info display
│   │   │   │   ├── TaskActions.tsx      # FR7: Start Agent button
│   │   │   │   └── TaskStatusBadge.tsx  # Status indicator
│   │   │   │
│   │   │   ├── terminal/
│   │   │   │   ├── TerminalPanel.tsx    # FR10: Embedded terminal container
│   │   │   │   ├── TerminalOutput.tsx   # xterm.js wrapper component
│   │   │   │   └── TerminalControls.tsx # FR13-14: Pause/Resume buttons
│   │   │   │
│   │   │   ├── review/
│   │   │   │   ├── DiffViewer.tsx       # FR18: Monaco diff editor
│   │   │   │   ├── ReviewActions.tsx    # FR17: Approve/Reject/Changes buttons
│   │   │   │   └── FeedbackForm.tsx     # FR20: Request changes input
│   │   │   │
│   │   │   ├── git/
│   │   │   │   ├── ConflictAlert.tsx    # FR26: Merge conflict UI
│   │   │   │   └── BranchBadge.tsx      # FR23: Branch indicator
│   │   │   │
│   │   │   └── ui/                      # shadcn/ui components
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── tabs.tsx
│   │   │       ├── toast.tsx
│   │   │       ├── skeleton.tsx
│   │   │       └── ... (other shadcn components)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTask.ts               # Task query/mutation helpers
│   │   │   ├── useAgent.ts              # Agent control hooks
│   │   │   ├── useTerminal.ts           # Terminal instance management
│   │   │   └── useGit.ts                # Git operation hooks
│   │   │
│   │   ├── stores/
│   │   │   ├── ui.store.ts              # Sidebar, panel visibility
│   │   │   └── terminal.store.ts        # Terminal buffer, history
│   │   │
│   │   └── lib/
│   │       ├── trpc.ts                  # tRPC client, React Query provider
│   │       ├── utils.ts                 # cn(), formatDate, etc.
│   │       └── constants.ts             # App-wide constants
│   │
│   └── shared/                    # === SHARED TYPES ===
│       └── types/
│           ├── task.types.ts            # Task, Sprint, Epic types
│           ├── agent.types.ts           # AgentRun, AgentStatus types
│           ├── git.types.ts             # Worktree, Branch types
│           └── config.types.ts          # ProjectConfig, MethodologyType
│
├── data/                          # Runtime data (gitignored)
│   └── tinsu.db                   # SQLite database file
│
└── dist/                          # Build output (gitignored)
    ├── main/
    ├── preload/
    └── renderer/
```

### Architectural Boundaries

**Process Boundaries:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │   tRPC      │   │  Services   │   │     Database        │  │
│  │   Routers   │──▶│  (PTY, Git) │──▶│  (Drizzle+SQLite)   │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
│         ▲                                                       │
│         │ IPC (contextBridge)                                   │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PRELOAD SCRIPT                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ IPC (invoke/on)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RENDERER PROCESS (React)                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │   tRPC      │   │   Zustand   │   │    React            │  │
│  │   Client    │──▶│   Stores    │──▶│    Components       │  │
│  └─────────────┘   └─────────────┘   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**tRPC Router Boundaries:**
| Router | Responsibility | External Dependencies |
|--------|----------------|----------------------|
| `task.router` | Task/Sprint/Epic CRUD, status transitions | Drizzle (db) |
| `agent.router` | PTY spawn, pause, resume, kill | PtyService, StallDetectorService |
| `review.router` | Get diff, approve, reject, request changes | GitService |
| `git.router` | Worktree create/remove, branch merge | GitService (shell commands) |
| `config.router` | Read/write project YAML, detect CLI | File system |

**Service Boundaries:**
| Service | Owns | Exposes to Router |
|---------|------|-------------------|
| `PtyService` | node-pty instance map | spawn(), write(), kill(), pause(), resume() |
| `GitService` | Git CLI execution | createWorktree(), removeWorktree(), merge(), getDiff() |
| `StallDetectorService` | Output timers | startMonitoring(), onStall callback |
| `ContextBuilderService` | File reading | buildContext(taskId) → prompt string |

**Data Boundaries:**
| Boundary | Pattern | Notes |
|----------|---------|-------|
| DB → Router | Drizzle queries in router | No raw SQL in routers |
| Router → Client | tRPC procedures | Type-safe, validated with Zod |
| Client → Component | TanStack Query hooks | useQuery/useMutation wrappers |
| Component → Store | Zustand actions | UI-only state |

### Requirements to Structure Mapping

**FR Categories → Directories:**

| FR Category                   | Primary Location                          | Supporting Locations                                                 |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| **FR1-FR6: Board & Task**     | `renderer/components/board/`              | `main/trpc/routers/task.router.ts`, `main/db/schema.ts`              |
| **FR7-FR11: Agent Execution** | `main/services/pty.service.ts`            | `renderer/components/terminal/`, `main/trpc/routers/agent.router.ts` |
| **FR12-FR16: Monitoring**     | `main/services/stall-detector.service.ts` | `renderer/components/terminal/TerminalControls.tsx`                  |
| **FR17-FR21: Review**         | `renderer/components/review/`             | `main/trpc/routers/review.router.ts`                                 |
| **FR22-FR27: Git**            | `main/services/git.service.ts`            | `renderer/components/git/`, `main/trpc/routers/git.router.ts`        |
| **FR28-FR31: Config**         | `main/trpc/routers/config.router.ts`      | Project root YAML files                                              |
| **FR32-FR35: Persistence**    | `main/db/`                                | All routers via Drizzle context                                      |

### Integration Points

**Internal Communication:**
| From | To | Method |
|------|-----|--------|
| React Component | tRPC Router | `trpc.{router}.{procedure}.useQuery/useMutation()` |
| tRPC Router | Service | Direct function call (injected via context) |
| Service | Database | Drizzle ORM queries |
| PTY output | React Terminal | tRPC subscription → xterm.js write |

**External Integrations:**
| System | Integration Point | Method |
|--------|-------------------|--------|
| Claude Code CLI | `main/services/pty.service.ts` | node-pty spawn with `claude` command |
| Git | `main/services/git.service.ts` | child_process.exec for git commands |
| File System | Config router, Context builder | Node.js fs module |

**Data Flow (Task Execution):**

```
User clicks "Start Agent" on TaskCard
  → TaskActions.tsx calls trpc.agent.startAgent.mutate({ taskId })
  → agent.router creates worktree via GitService
  → agent.router builds context via ContextBuilderService
  → agent.router spawns PTY via PtyService
  → PtyService emits 'pty:data' events
  → agent.router streams via tRPC subscription
  → TerminalOutput.tsx writes to xterm.js
  → StallDetectorService monitors for timeouts
  → On completion: agent.router updates task status to 'review'
```

### Development Workflow

**Dev Server:**

```bash
npm run dev          # Starts electron-vite dev server (HMR for all processes)
```

**Database Migrations:**

```bash
npm run db:generate  # Generate migrations from schema changes
npm run db:push      # Apply migrations to dev database
```

**Build & Package:**

```bash
npm run build        # TypeScript compile + Vite bundle
npm run package      # electron-builder → .dmg / .AppImage
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices form a cohesive stack:

- electron-vite 5.0 + React 18 + TypeScript 5.x — proven combination
- tRPC 11 + Zod — type-safe IPC with runtime validation
- Drizzle 1.0-beta.2 + better-sqlite3 — synchronous ORM ideal for Electron main process
- shadcn/ui + Tailwind 4.x — modern, accessible UI foundation (CSS-first configuration)
- @dnd-kit + xterm.js + Monaco — specialized components with no conflicts

**Pattern Consistency:**

- Naming conventions (snake_case DB, camelCase tRPC, PascalCase components) are industry-standard for this stack
- Structure patterns match electron-vite conventions
- Communication patterns (tRPC procedures, Zustand stores) align with chosen libraries

**Structure Alignment:**

- Project structure extends electron-vite template properly
- Boundaries (main/preload/renderer) follow Electron security model
- Integration points are well-defined with clear data flow

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

| FR Category               | Status | Architectural Support                                |
| ------------------------- | ------ | ---------------------------------------------------- |
| FR1-FR6: Board & Task     | ✅     | `board/` components, `task.router`, Drizzle schema   |
| FR7-FR11: Agent Execution | ✅     | `pty.service`, `agent.router`, terminal components   |
| FR12-FR16: Monitoring     | ✅     | `stall-detector.service`, `TerminalControls`         |
| FR17-FR21: Review         | ✅     | Monaco diff viewer, `review.router`, `ReviewActions` |
| FR22-FR27: Git            | ✅     | `git.service`, `git.router`, worktree patterns       |
| FR28-FR31: Config         | ✅     | `config.router`, YAML file handling                  |
| FR32-FR35: Persistence    | ✅     | Drizzle schema, SQLite, migrations                   |

**Non-Functional Requirements Coverage:**

| NFR Category                 | Status | How Addressed                                              |
| ---------------------------- | ------ | ---------------------------------------------------------- |
| Performance (<100ms UI)      | ✅     | Vite HMR, React 18 concurrent, SQLite sync API             |
| Reliability (crash recovery) | ✅     | ACID SQLite, error handling layers, TRPCError patterns     |
| Integration (PTY, Git)       | ✅     | node-pty service, Git CLI service, contextBridge isolation |

### Implementation Readiness Validation ✅

**Decision Completeness:**

- All critical decisions documented with verified versions
- Technology rationale provided for each choice
- Deferred decisions explicitly noted (auto-update, crash reporting)

**Structure Completeness:**

- 50+ files/directories defined with FR mapping
- Component boundaries clear (board/, task/, terminal/, review/)
- Service boundaries explicit (PTY, Git, StallDetector)

**Pattern Completeness:**

- 6 naming convention categories with examples
- tRPC response/error patterns with code samples
- Zustand store pattern template
- Error handling layers defined per component type
- Anti-patterns documented to prevent common mistakes

### Gap Analysis Results

**Critical Gaps:** None identified

**Important Gaps (addressable during implementation):**

1. Detailed Drizzle schema not yet written (will be first implementation task)
2. tRPC subscription pattern for real-time PTY streaming not fully specified
3. Stall detection algorithm specifics deferred to implementation

**Nice-to-Have (post-MVP):**

- Testing strategy details (unit, integration, e2e)
- CI/CD pipeline specifics
- Performance profiling approach

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (35 FRs, 24 NFRs)
- [x] Scale and complexity assessed (Medium complexity)
- [x] Technical constraints identified (5 constraints)
- [x] Cross-cutting concerns mapped (5 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (14 libraries)
- [x] Integration patterns defined (tRPC, IPC events)
- [x] Performance considerations addressed (sync SQLite, Vite HMR)

**✅ Implementation Patterns**

- [x] Naming conventions established (DB, tRPC, React, TS)
- [x] Structure patterns defined (50+ files mapped)
- [x] Communication patterns specified (tRPC, Zustand, IPC events)
- [x] Process patterns documented (error handling, loading states)

**✅ Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established (main/preload/renderer)
- [x] Integration points mapped (services → routers → client)
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH — All validation checks pass, no critical gaps

**Key Strengths:**

- Type-safe end-to-end with tRPC + Zod + TypeScript
- Modern, fast tooling (Vite, Drizzle)
- Clear separation of concerns (Electron process model)
- Comprehensive patterns prevent AI agent conflicts
- Industry-proven library choices (VS Code uses same terminal stack)

**Areas for Future Enhancement:**

- Testing strategy (can evolve during implementation)
- Auto-update mechanism (post-MVP)
- Windows platform support (deferred per PRD)

### Implementation Handoff

**AI Agent Guidelines:**

1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and boundaries
4. Refer to this document for all architectural questions
5. When in doubt, check the Anti-Patterns section

**First Implementation Priority:**

```bash
npm create @quick-start/electron@latest tinsu -- --template react-ts
```

Then proceed through the Implementation Sequence (8 steps) defined in Core Architectural Decisions.

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-03
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**

- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**

- 14 major architectural decisions made
- 6 implementation pattern categories defined
- 8 architectural components specified
- 35 functional requirements + 24 non-functional requirements fully supported

**AI Agent Implementation Guide**

- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Implementation Handoff

**For AI Agents:**
This architecture document is your complete guide for implementing TinSu. Follow all decisions, patterns, and structures exactly as documented.

**First Implementation Priority:**

```bash
npm create @quick-start/electron@latest tinsu -- --template react-ts
```

**Development Sequence:**

1. Initialize project using documented starter template
2. Set up development environment per architecture
3. Implement core architectural foundations (Drizzle schema, tRPC routers)
4. Build features following established patterns
5. Maintain consistency with documented rules

### Quality Assurance Checklist

**✅ Architecture Coherence**

- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**

- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**

- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring all stakeholders understand the architectural direction.

**Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents will produce compatible, consistent code that works together seamlessly.

**Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**Solid Foundation**
The chosen starter template and architectural patterns provide a production-ready foundation following current best practices.

---

## Task Execution Sandbox Architecture (Feature Extension)

_Added: 2026-01-12 | PRD: prd-task-execution-sandbox.md_

This section extends the core architecture with infrastructure for per-task execution environments, activity logging, and workflow automation.

### Feature Overview

The Task Execution Sandbox transforms task detail views into isolated execution workspaces:

- **Per-Task Terminal** — Persistent tmux session per task, survives app restart and reboot
- **Activity Log** — Real-time, append-only event stream for complete audit trail
- **Workflow Automation** — Task-type-aware triggers (Story vs Basic)
- **4-Tab Task Detail** — Terminal, Activities, Diff, Content

### New Technology Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Terminal Persistence | **tmux** | Native session management, survives app restart, `send-keys` for automation |
| Event Detection | **Claude Code Hooks** | Stop + PostToolUse hooks for completion and activity tracking |
| Hook IPC | **HTTP localhost** | Reliable delivery, debuggable, no race conditions |
| Activity Storage | **SQLite** | Consistent with existing data layer, supports real-time streaming |
| Scrollback Backup | **Filesystem (gzip)** | Survives system reboot, lazy loading |

### New Database Schema

```sql
-- Task Activities (append-only event log)
CREATE TABLE task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,                    -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_activities_task_id ON task_activities(task_id);
CREATE INDEX idx_task_activities_event_type ON task_activities(event_type);
CREATE INDEX idx_task_activities_created_at ON task_activities(created_at);

-- Task Sessions (tmux + Claude Code session mapping)
CREATE TABLE task_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  session_id TEXT,                 -- Claude Code session ID (from hooks)
  tmux_session TEXT NOT NULL,      -- tinsu-{projectName}-{taskId}
  current_phase TEXT,              -- dev-story | code-review | user-feedback
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_sessions_session_id ON task_sessions(session_id);

-- Activity Retention Settings
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Default: activity_retention_days = -1 (unlimited)
```

**Event Types:**
| Type | Description | Payload Example |
|------|-------------|-----------------|
| `status_change` | Task moved between columns | `{ from: 'backlog', to: 'in_progress' }` |
| `agent_start` | Claude Code started | `{ phase: 'dev-story' }` |
| `agent_complete` | Stop hook fired | `{ phase: 'dev-story', duration_ms: 45000 }` |
| `tool_used` | PostToolUse hook | `{ tool: 'Edit', file: 'src/foo.ts' }` |
| `user_command` | User typed in terminal | `{ command: '/code-review' }` |
| `automation_trigger` | Auto code-review | `{ command: 'code-review', trigger: 'dev-story-complete' }` |
| `error` | Agent or hook failure | `{ message: 'ECONNREFUSED', code: 'HOOK_FAILED' }` |

### New Services Architecture

```
src/main/services/
├── task-terminal.service.ts       # tmux session lifecycle
├── hook-listener.service.ts       # HTTP server for hook events
├── activity-log.service.ts        # Event logging + streaming
├── automation.service.ts          # Story/Basic state machine
└── scrollback-backup.service.ts   # Filesystem persistence
```

#### TaskTerminalService

```typescript
interface TaskTerminalService {
  // Session lifecycle
  createSession(taskId: string, projectName: string): Promise<string>  // Returns tmux session name
  killSession(taskId: string): Promise<void>
  hasSession(taskId: string): Promise<boolean>

  // Command execution
  sendCommand(taskId: string, command: string): Promise<void>  // tmux send-keys

  // Attachment (for xterm.js)
  getAttachCommand(taskId: string): string  // Returns: tmux attach-session -t {name}

  // Scrollback
  captureScrollback(taskId: string, lines?: number): Promise<string>
}
```

**tmux Session Naming:** `tinsu-{projectName}-{taskId}`
- Multi-project safe
- Easy to identify in `tmux list-sessions`
- Example: `tinsu-myapp-task-abc123`

#### HookListenerService

```typescript
interface HookListenerService {
  // Lifecycle
  start(port: number): Promise<void>
  stop(): Promise<void>

  // Event handlers (internal)
  onStopHook(payload: StopHookPayload): Promise<void>
  onToolUseHook(payload: ToolUseHookPayload): Promise<void>
}

interface StopHookPayload {
  session_id: string
  transcript_path: string
  cwd: string
  hook_event_name: 'Stop'
}

interface ToolUseHookPayload {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  hook_event_name: 'PostToolUse'
}
```

**HTTP Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/hooks/stop` | POST | Receives Stop hook events |
| `/api/hooks/tool-use` | POST | Receives PostToolUse hook events |
| `/api/hooks/health` | GET | Health check for hook scripts |

**Port Selection:** Use `TINSU_HOOK_PORT` env var, default to dynamic port stored in temp file for hook scripts to read.

#### ActivityLogService

```typescript
interface ActivityLogService {
  // Write
  logActivity(taskId: string, eventType: EventType, payload?: object): Promise<Activity>

  // Read
  getActivities(taskId: string, options?: ActivityQueryOptions): Promise<Activity[]>

  // Stream (for real-time UI)
  subscribeToTask(taskId: string): Observable<Activity>

  // Retention
  cleanupOldActivities(retentionDays: number): Promise<number>  // Returns deleted count
}

interface ActivityQueryOptions {
  eventTypes?: EventType[]
  limit?: number
  offset?: number
  since?: Date
}
```

#### AutomationService

```typescript
interface AutomationService {
  // Status change triggers
  onStatusChange(taskId: string, newStatus: TaskStatus): Promise<void>

  // Hook event triggers
  onAgentComplete(sessionId: string): Promise<void>

  // Manual triggers (fallback UI)
  triggerDevStory(taskId: string): Promise<void>
  triggerCodeReview(taskId: string): Promise<void>
}
```

**State Machine:**
```
Story Task:
  In Progress → createSession → sendCommand(dev-story prompt)
  dev-story complete (Stop hook) → updateStatus(review) → sendCommand('/code-review')
  code-review complete (Stop hook) → notifyUser('Ready for review')

Basic Task:
  In Progress → createSession → sendCommand(task.description)
  agent complete (Stop hook) → updateStatus(review)
  [No auto code-review - user reviews manually]
```

#### ScrollbackBackupService

```typescript
interface ScrollbackBackupService {
  // Backup triggers
  backupOnStatusChange(taskId: string): Promise<void>
  startPeriodicBackup(taskId: string, intervalMs: number): void
  stopPeriodicBackup(taskId: string): void
  backupOnShutdown(): Promise<void>

  // Restore
  restoreScrollback(taskId: string): Promise<string | null>

  // Cleanup
  deleteBackup(taskId: string): Promise<void>
}
```

**Storage Location:** `{app.getPath('userData')}/terminal-history/{taskId}/`
```
terminal-history/
└── {taskId}/
    ├── scrollback.txt.gz     # Compressed scrollback
    ├── metadata.json         # { lines: 5000, lastBackup: '...', tmuxSession: '...' }
    └── transcript.json       # Claude Code transcript (from hook)
```

### New tRPC Router

**`activity.router.ts`**

```typescript
export const activityRouter = router({
  // Queries
  listActivities: t.procedure
    .input(z.object({
      taskId: z.string(),
      eventTypes: z.array(z.enum([...])).optional(),
      limit: z.number().default(100),
      offset: z.number().default(0)
    }))
    .query(({ input, ctx }) => {
      return ctx.activityLogService.getActivities(input.taskId, input)
    }),

  // Subscriptions (real-time streaming)
  onActivityCreated: t.procedure
    .input(z.object({ taskId: z.string() }))
    .subscription(({ input, ctx }) => {
      return observable<Activity>((emit) => {
        const sub = ctx.activityLogService.subscribeToTask(input.taskId)
        sub.subscribe((activity) => emit.next(activity))
        return () => sub.unsubscribe()
      })
    }),

  // Retention settings
  getRetentionDays: t.procedure.query(({ ctx }) => {
    return ctx.settingsService.get('activity_retention_days') ?? -1
  }),

  setRetentionDays: t.procedure
    .input(z.object({ days: z.number().min(-1) }))  // -1 = unlimited
    .mutation(({ input, ctx }) => {
      return ctx.settingsService.set('activity_retention_days', input.days)
    })
})
```

**Updates to `agent.router.ts`**

```typescript
// Add to existing agent.router.ts
createTaskSession: t.procedure
  .input(z.object({ taskId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const task = await ctx.db.query.tasks.findFirst({ where: eq(tasks.id, input.taskId) })
    if (!task) throw new TRPCError({ code: 'NOT_FOUND' })

    const projectName = ctx.configService.getProjectName()
    const tmuxSession = await ctx.taskTerminalService.createSession(input.taskId, projectName)

    await ctx.db.insert(taskSessions).values({
      id: generateId(),
      taskId: input.taskId,
      tmuxSession,
      createdAt: Date.now()
    })

    return { tmuxSession }
  }),

sendTerminalCommand: t.procedure
  .input(z.object({ taskId: z.string(), command: z.string() }))
  .mutation(async ({ input, ctx }) => {
    await ctx.taskTerminalService.sendCommand(input.taskId, input.command)
    await ctx.activityLogService.logActivity(input.taskId, 'user_command', { command: input.command })
  }),

getTaskSession: t.procedure
  .input(z.object({ taskId: z.string() }))
  .query(({ input, ctx }) => {
    return ctx.db.query.taskSessions.findFirst({ where: eq(taskSessions.taskId, input.taskId) })
  })
```

### New UI Components

```
src/renderer/components/
├── task/
│   ├── TaskDetailTabs.tsx          # 4-tab container
│   ├── ActivitiesTab.tsx           # Activity log with filters
│   ├── ActivitiesFilter.tsx        # Event type filter chips
│   ├── ActivityItem.tsx            # Single activity row
│   ├── ContentTab.tsx              # Task description display
│   ├── TaskAutomationStatus.tsx    # Current phase indicator
│   └── ManualTriggerButtons.tsx    # Fallback trigger UI
```

**TaskDetailTabs.tsx Structure:**
```typescript
<Tabs defaultValue="terminal">
  <TabsList>
    <TabsTrigger value="terminal">Terminal</TabsTrigger>
    <TabsTrigger value="activities">Activities</TabsTrigger>
    <TabsTrigger value="diff">Diff</TabsTrigger>
    <TabsTrigger value="content">Content</TabsTrigger>
  </TabsList>

  <TabsContent value="terminal">
    <TerminalOutput taskId={taskId} />
    <TerminalControls taskId={taskId} />
  </TabsContent>

  <TabsContent value="activities">
    <ActivitiesTab taskId={taskId} />
  </TabsContent>

  <TabsContent value="diff">
    <DiffViewer taskId={taskId} />
  </TabsContent>

  <TabsContent value="content">
    <ContentTab task={task} />
  </TabsContent>
</Tabs>
```

### Claude Code Hook Configuration

**`.claude/settings.json` (project-level)**
```json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash .claude/hooks/task-completion.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "bash .claude/hooks/log-tool-use.sh"
      }]
    }]
  }
}
```

**`.claude/hooks/task-completion.sh`**
```bash
#!/bin/bash
# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Send to TinSu
curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/stop" \
  -H "Content-Type: application/json" \
  -d "$INPUT" || true  # Don't fail if TinSu not running
```

**`.claude/hooks/log-tool-use.sh`**
```bash
#!/bin/bash
INPUT=$(cat)
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/tool-use" \
  -H "Content-Type: application/json" \
  -d "$INPUT" || true
```

### Integration Patterns

**Terminal Attachment (xterm.js → tmux):**
```typescript
// In TerminalOutput.tsx
const { data: session } = trpc.agent.getTaskSession.useQuery({ taskId })

useEffect(() => {
  if (session?.tmuxSession) {
    // Spawn PTY that attaches to tmux
    const attachCmd = `tmux attach-session -t ${session.tmuxSession}`
    ptyService.spawn('bash', ['-c', attachCmd])
  }
}, [session?.tmuxSession])
```

**Activity Streaming (real-time updates):**
```typescript
// In ActivitiesTab.tsx
const [activities, setActivities] = useState<Activity[]>([])

// Initial load
const { data } = trpc.activity.listActivities.useQuery({ taskId })

// Real-time subscription
trpc.activity.onActivityCreated.useSubscription(
  { taskId },
  { onData: (activity) => setActivities(prev => [activity, ...prev]) }
)
```

**Automation Trigger Flow:**
```typescript
// In task.router.ts - updateStatus mutation
updateStatus: t.procedure
  .input(z.object({ id: z.string(), status: z.enum([...]) }))
  .mutation(async ({ input, ctx }) => {
    const oldTask = await ctx.db.query.tasks.findFirst({ where: eq(tasks.id, input.id) })

    // Update status
    const [updated] = await ctx.db.update(tasks)
      .set({ status: input.status, updatedAt: Date.now() })
      .where(eq(tasks.id, input.id))
      .returning()

    // Log activity
    await ctx.activityLogService.logActivity(input.id, 'status_change', {
      from: oldTask?.status,
      to: input.status
    })

    // Trigger automation
    await ctx.automationService.onStatusChange(input.id, input.status)

    return updated
  })
```

### Platform Requirements

| Platform | tmux Support | Notes |
|----------|--------------|-------|
| **macOS** | ✅ Native | `brew install tmux` |
| **Linux** | ✅ Native | `apt install tmux` / `yum install tmux` |
| **Windows** | ⚠️ WSL only | Deferred to post-MVP |

**Startup Check:**
```typescript
// In main/index.ts
async function checkDependencies() {
  try {
    await execAsync('tmux -V')
  } catch {
    dialog.showErrorBox(
      'tmux Required',
      'TinSu requires tmux for terminal persistence.\n\n' +
      'Install with:\n' +
      '  macOS: brew install tmux\n' +
      '  Linux: apt install tmux'
    )
    app.quit()
  }
}
```

### Updated Project Structure

```
src/main/
├── services/
│   ├── pty.service.ts              # Existing
│   ├── git.service.ts              # Existing
│   ├── stall-detector.service.ts   # Existing
│   ├── context-builder.service.ts  # Existing
│   ├── task-terminal.service.ts    # NEW: tmux management
│   ├── hook-listener.service.ts    # NEW: HTTP hook server
│   ├── activity-log.service.ts     # NEW: Event logging
│   ├── automation.service.ts       # NEW: State machine
│   └── scrollback-backup.service.ts# NEW: Filesystem persistence
├── trpc/routers/
│   ├── task.router.ts              # Existing
│   ├── agent.router.ts             # UPDATED: Session management
│   ├── activity.router.ts          # NEW: Activity CRUD + streaming
│   └── ...
└── db/
    └── schema.ts                   # UPDATED: task_activities, task_sessions, app_settings

src/renderer/components/
├── task/
│   ├── TaskPanel.tsx               # UPDATED: Uses TaskDetailTabs
│   ├── TaskDetailTabs.tsx          # NEW: 4-tab container
│   ├── ActivitiesTab.tsx           # NEW: Activity log UI
│   ├── ContentTab.tsx              # NEW: Description display
│   └── ...
└── ...

.claude/
├── settings.json                   # NEW: Hook configuration
└── hooks/
    ├── task-completion.sh          # NEW: Stop hook
    └── log-tool-use.sh             # NEW: PostToolUse hook
```

### Task Execution Sandbox NFRs

| Metric | Target | Notes |
|--------|--------|-------|
| Activity event latency | <1s | Events appear in UI within 1 second |
| Terminal streaming | <500ms | Active terminal output lag |
| Scrollback load | <2s | On-demand loading for inactive tasks |
| Automation trigger | <5s | Story task auto-triggers |
| Concurrent tasks | 10+ | System responsive with many terminals |
| Terminal persistence | 100% | Survives app restart + reboot |
| Activity integrity | Zero loss | No events dropped |

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

---

## Architecture Addendum: Sprint Management Feature

**Date Added:** 2026-01-13
**Feature:** Sprint Management with per-sprint Kanban boards

### Overview

This addendum extends the core architecture to support Sprint Management — a feature that organizes epics into time-boxed sprints, each with its own dedicated Kanban board view.

### Data Model Changes

#### Sprint Table (Extended Schema)

```sql
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date INTEGER,              -- Unix timestamp (nullable for backlog sprint)
  end_date INTEGER,                -- Unix timestamp (nullable for backlog sprint)
  status TEXT DEFAULT 'planning',  -- 'planning' | 'active' | 'completed'
  goal TEXT,                       -- Optional sprint goal
  velocity INTEGER,                -- Optional: story points completed
  capacity INTEGER,                -- Optional: team capacity
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
```

**Status Enum Values:**
| Status | Description |
|--------|-------------|
| `planning` | Sprint being prepared, not yet started |
| `active` | Currently executing sprint (max 1 per project) |
| `completed` | Sprint finished, read-only |

#### Epic Table (Addition)

```sql
ALTER TABLE epics ADD COLUMN IF NOT EXISTS sprint_id TEXT REFERENCES sprints(id);
CREATE INDEX IF NOT EXISTS idx_epics_sprint_id ON epics(sprint_id);
```

**Note:** `sprint_id` is nullable for migration compatibility. New epics must have a sprint assigned via UI validation.

### Entity Relationships

```
Project (1) ──────► Sprint (many)
                        │
                        ▼
                   Epic (many) ──────► Task/Story (many)
```

**Cardinality Rules:**
- Project has many Sprints
- Sprint has many Epics (1:many, epic belongs to exactly 1 sprint)
- Epic has many Tasks/Stories (unchanged from core architecture)

### Business Constraints

#### 1. Single Active Sprint Constraint

**Rule:** Only one sprint per project can have `status = 'active'` at any time.

**Implementation:** Application-level validation in `sprint.router.ts`:

```typescript
// In updateSprintStatus mutation
const activeSprint = await db.query.sprints.findFirst({
  where: and(
    eq(sprints.projectId, input.projectId),
    eq(sprints.status, 'active'),
    ne(sprints.id, input.sprintId)  // Exclude current sprint
  )
});

if (activeSprint && input.status === 'active') {
  throw new TRPCError({
    code: 'CONFLICT',
    message: `Sprint "${activeSprint.name}" is already active. Complete or deactivate it first.`
  });
}
```

#### 2. Cascade Delete Behavior

**Rule:** Deleting a sprint removes all child epics and their stories.

**Implementation:** Application-level cascade in transaction:

```typescript
// In deleteSprint mutation
await db.transaction(async (tx) => {
  // Get all epic IDs for this sprint
  const epicIds = await tx.query.epics.findMany({
    where: eq(epics.sprintId, input.sprintId),
    columns: { id: true }
  });

  // Delete tasks for each epic
  for (const epic of epicIds) {
    await tx.delete(tasks).where(eq(tasks.epicId, epic.id));
  }

  // Delete epics
  await tx.delete(epics).where(eq(epics.sprintId, input.sprintId));

  // Delete sprint
  await tx.delete(sprints).where(eq(sprints.id, input.sprintId));
});
```

#### 3. Completed Sprint Read-Only

**Rule:** Sprints with `status = 'completed'` cannot be modified.

**Implementation:** Guard in all sprint/epic/task mutations:

```typescript
// Helper function
async function assertSprintNotCompleted(sprintId: string) {
  const sprint = await db.query.sprints.findFirst({
    where: eq(sprints.id, sprintId)
  });

  if (sprint?.status === 'completed') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Cannot modify completed sprint'
    });
  }
}
```

### tRPC Router Additions

#### sprint.router.ts

```typescript
export const sprintRouter = router({
  // Queries
  listSprints: t.procedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => { /* ... */ }),

  getSprint: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => { /* ... */ }),

  // Mutations
  createSprint: t.procedure
    .input(z.object({
      projectId: z.string(),
      name: z.string(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      goal: z.string().optional()
    }))
    .mutation(({ input }) => { /* ... */ }),

  updateSprint: t.procedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      goal: z.string().optional(),
      velocity: z.number().optional(),
      capacity: z.number().optional()
    }))
    .mutation(({ input }) => { /* ... */ }),

  updateSprintStatus: t.procedure
    .input(z.object({
      id: z.string(),
      projectId: z.string(),
      status: z.enum(['planning', 'active', 'completed'])
    }))
    .mutation(({ input }) => { /* ... */ }),  // Enforces single-active constraint

  deleteSprint: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => { /* ... */ }),  // Cascade deletes epics/tasks

  // Epic linking
  linkEpicToSprint: t.procedure
    .input(z.object({ epicId: z.string(), sprintId: z.string() }))
    .mutation(({ input }) => { /* ... */ }),
});
```

### Migration Strategy

**On App Startup (in `db/index.ts`):**

```typescript
// Migration: Create default sprint for orphaned epics
async function migrateOrphanedEpics(projectId: string) {
  const orphanedEpics = await db.query.epics.findMany({
    where: and(
      eq(epics.projectId, projectId),
      isNull(epics.sprintId)
    )
  });

  if (orphanedEpics.length === 0) return;

  // Check if Backlog sprint exists
  let backlogSprint = await db.query.sprints.findFirst({
    where: and(
      eq(sprints.projectId, projectId),
      eq(sprints.name, 'Backlog')
    )
  });

  // Create if not exists
  if (!backlogSprint) {
    const [created] = await db.insert(sprints).values({
      id: crypto.randomUUID(),
      name: 'Backlog',
      status: 'planning',
      projectId: projectId
    }).returning();
    backlogSprint = created;
  }

  // Assign orphaned epics
  await db.update(epics)
    .set({ sprintId: backlogSprint.id })
    .where(and(
      eq(epics.projectId, projectId),
      isNull(epics.sprintId)
    ));
}
```

### UI Architecture

#### Sidebar (Sprint List)

```
src/renderer/components/layout/Sidebar.tsx
├── Project selector (existing)
├── Sprint list                    ← NEW
│   ├── SprintListItem.tsx         ← NEW (shows name + status badge)
│   └── NewSprintButton.tsx        ← NEW
└── Navigation (existing)
```

**SprintListItem Component:**
- Display: Sprint name + status indicator (planning/active/completed)
- Active sprint: visually emphasized (bold, accent color)
- Click: Loads sprint's Kanban board
- No tree structure (flat list per user requirement)

#### Kanban Board (Sprint-Scoped)

```typescript
// KanbanBoard.tsx receives sprintId prop
interface KanbanBoardProps {
  sprintId: string;  // Filters epics/tasks to this sprint
}
```

**Board behavior:**
- Fetches epics where `epic.sprintId === sprintId`
- Task cards show epic badge (existing)
- Completed sprint: disable drag-drop, show read-only indicator

#### Epic Import Dialog

**Existing file picker** (per user confirmation) handles importing story `.md` files. When linking existing epics:

```typescript
// Dialog shows file picker for _bmad-output/implementation-artifacts/*.md
// On selection: creates epic record and links to current sprint
```

### File Structure Additions

```
src/main/
├── trpc/routers/
│   └── sprint.router.ts           ← NEW
├── db/
│   └── migrations/
│       └── XXXX_add_sprint_management.ts  ← Generated by Drizzle

src/renderer/components/
├── layout/
│   └── Sidebar.tsx                ← MODIFIED (add sprint list)
├── sprint/                        ← NEW directory
│   ├── SprintListItem.tsx
│   ├── NewSprintButton.tsx
│   ├── SprintForm.tsx             ← Create/edit sprint dialog
│   └── SprintStatusBadge.tsx
```

### Type Definitions

```typescript
// src/shared/types/sprint.types.ts

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface Sprint {
  id: string;
  name: string;
  startDate: number | null;
  endDate: number | null;
  status: SprintStatus;
  goal: string | null;
  velocity: number | null;
  capacity: number | null;
  projectId: string;
  createdAt: number;
}

export interface CreateSprintInput {
  projectId: string;
  name: string;
  startDate?: number;
  endDate?: number;
  goal?: string;
}

export interface UpdateSprintInput {
  id: string;
  name?: string;
  startDate?: number;
  endDate?: number;
  goal?: string;
  velocity?: number;
  capacity?: number;
}
```

### Implementation Checklist

**Database Layer:**
- [ ] Add `status`, `goal`, `velocity`, `capacity` columns to sprints table
- [ ] Add `sprint_id` column to epics table
- [ ] Create indexes for new columns
- [ ] Run migration on existing databases

**tRPC Layer:**
- [ ] Implement `sprint.router.ts` with all CRUD operations
- [ ] Add single-active constraint validation
- [ ] Add completed sprint guards
- [ ] Implement cascade delete transaction

**UI Layer:**
- [ ] Add sprint list to Sidebar
- [ ] Create SprintListItem, SprintStatusBadge components
- [ ] Create SprintForm dialog for create/edit
- [ ] Modify KanbanBoard to accept sprintId prop
- [ ] Add epic import dialog with sprint assignment

**Migration:**
- [ ] Implement orphaned epic migration on startup
- [ ] Create default "Backlog" sprint if needed

---

**Addendum Status:** READY FOR IMPLEMENTATION ✅

---

## Chat Session tmux Migration (Feature Extension)

_Added: 2026-03-26 | PRD: prd.md (FR36-FR53, NFR25-NFR32) | Handoff: handoff-chat-tmux-migration.md_

This section extends the architecture to migrate Planning Workspace chat sessions from node-pty to tmux, aligning with the task execution pattern and enabling persistent, concurrent multi-agent chat sessions.

### Problem Summary

The current chat system spawns one node-pty process per conversation. This breaks under concurrency:

1. **Orphan UUID Routing** — `findOrphanSession()` returns the wrong session when multiple are active
2. **No Session Persistence** — node-pty dies on app restart, requiring `--resume` + TUI ready detection
3. **Single-Project Scoping** — `project.getCurrent` returns one project; other sessions are invisible
4. **No Background Visibility** — switching agents disconnects the old session (`setSessionId(null)`)

### Solution: Two-Layer tmux Model

```
tmux session (persistence layer)  ─── tinsu-chat-{sessionId}
  └─ PTY attached via ptyService.spawn(tmux attach ...)  (I/O layer)
       └─ claude --session-id {uuid}  (agent process)
            └─ hooks POST to /api/hooks/chat-*  (event routing)
```

**Key insight:** Use tmux for session persistence and lifecycle, but attach a PTY to the tmux session for message I/O. This gives direct `ptyService.write()` control (byte-level stdin) instead of `tmux send-keys` (which has escaping issues with multi-line messages, code blocks, and special characters).

This is the same two-layer pattern the task system uses — `ptyService.spawn('bash', ['-c', 'tmux attach-session -t ...'])` — but for programmatic stdin writing instead of visual xterm.js display.

### Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **tmux server** | Shared with task sessions (default server) | Distinct naming (`tinsu-chat-*` vs `tinsu-*`) prevents collision; separate servers add complexity with no benefit |
| **Idle timeout** | 2 hours (extended from 30 min) | tmux sessions are cheap to keep alive (no `--resume`); chat is conversational with longer gaps. Task sessions retain 30 min |
| **PTY attachment** | Permanent (lifetime of session) | PTY is the I/O channel for `ptyService.write()` — on-demand attachment adds latency to message send and a complex attach/detach state machine |
| **Hook session ID** | `TINSU_TMUX_SESSION` env var passed to hook scripts | Cleaner than DB lookup per hook event; set at spawn time, included in POST payload for O(1) cache routing |
| **Ready detection** | Same `writeWhenReady` pattern on tmux-attached PTY | TUI output flows through tmux transparently; "ctrl+g"/"/effort" detection unchanged |
| **Busy tracking** | Same `busySessions` Set pattern | Application-level guard independent of PTY backing; hook-based detection unchanged |

### Schema Change

```sql
ALTER TABLE chat_sessions ADD COLUMN tmux_session TEXT;
```

The `tmux_session` column stores the tmux session name (e.g., `tinsu-chat-abc123`). This becomes the stable identifier for hook routing, replacing the `session_uuid` lookup that was prone to orphan mismatches.

**No new tables required.** The existing `chat_sessions`, `chat_messages`, and `chat_message_attachments` tables are sufficient. The migration adds a single column.

### Service Architecture Changes

#### ChatCliService (`src/main/services/chat-cli.service.ts`) — Major Refactor

**What changes:**

| Current (node-pty) | New (tmux + PTY) |
|---------------------|------------------|
| `ptyService.spawn('claude', [...args])` | `tmux new-session -d -s tinsu-chat-{sessionId}` then `ptyService.spawn('bash', ['-c', 'tmux attach-session -t ...'])` |
| In-memory `processId → sessionId` map | In-memory `chatSessionId → tmuxSessionName` cache (like task system's `taskToSessionCache`) |
| `findOrphanSession()` orphan UUID matching | **Removed** — tmux session name is the stable identifier; no UUID mismatch possible |
| `discoverCorrectUuid()` filesystem scan | **Removed** — orphan recovery no longer needed |
| `maybeRetryResume()` | **Removed** — tmux sessions don't need `--resume` |
| `IDLE_TIMEOUT_MS = 30 * 60 * 1000` | `IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000` (2 hours) |
| `resumeSession()` with `--resume` flag | `tmux has-session` check + PTY re-attachment (session still alive in tmux) |

**What stays the same:**

| Pattern | Why |
|---------|-----|
| `writeWhenReady()` with TUI detection | PTY output stream is identical through tmux |
| `busySessions` Set | Application-level guard, independent of backing |
| `onData` callback for output capture | PTY data events flow the same way |
| 150ms delay between message content and Enter | TUI paste-mode bug mitigation unchanged |
| Persona injection via `--append-system-prompt` | Spawn-time argument, not affected by tmux |

**New interface shape:**

```typescript
interface ChatCliService {
  // Session lifecycle (replaces direct PTY spawn)
  spawnSession(sessionId: string, opts: SpawnOpts): Promise<string>  // Returns tmux session name
  killSession(sessionId: string): Promise<void>
  isSessionAlive(sessionId: string): boolean  // Check tmux + PTY

  // Message I/O (unchanged interface, different backing)
  sendMessage(sessionId: string, message: string): Promise<void>  // writeWhenReady on attached PTY

  // Session recovery (simplified — no --resume needed)
  reattachSession(sessionId: string): Promise<void>  // PTY attach to existing tmux session

  // Monitoring
  checkIdleSessions(): void  // 2-hour timeout
  validateSessionsOnStartup(): Promise<void>  // tmux has-session for all DB sessions

  // Cache
  sessionCache: Map<string, string>  // chatSessionId → tmuxSessionName
}

interface SpawnOpts {
  sessionUuid: string      // Claude Code --session-id
  persona: string          // --append-system-prompt content
  projectDir: string       // Working directory
  skipPermissions: boolean // Tool use auto-approve
}
```

**Startup validation pattern** (adapted from `TaskTerminalService.validateSessionsOnStartup()`):

```typescript
async validateSessionsOnStartup(): Promise<void> {
  const activeSessions = await db.query.chatSessions.findMany({
    where: eq(chatSessions.status, 'active')
  })

  for (const session of activeSessions) {
    if (!session.tmuxSession) continue

    const alive = await tmuxHasSession(session.tmuxSession)
    if (!alive) {
      // Mark for re-creation on next message (FR52)
      await db.update(chatSessions)
        .set({ status: 'paused', updatedAt: Date.now() })
        .where(eq(chatSessions.id, session.id))
    } else {
      // Rebuild cache
      this.sessionCache.set(session.id, session.tmuxSession)
    }
  }
}
```

#### HookListenerService (`src/main/services/hook-listener.service.ts`) — Routing Update

**What changes:**

| Current | New |
|---------|-----|
| `tryRegisterChatOrphan()` — find session by mismatched UUID | **Removed** — no orphan UUIDs with tmux |
| Route by `session_uuid` DB lookup | Route by `tmux_session` from hook payload (O(1) cache lookup) |

**New routing pattern:**

```typescript
// In-memory cache (like task system's sessionToTaskCache)
private sessionToChatCache: Map<string, string>  // tmuxSessionName → chatSessionId

async onChatStopHook(payload: ChatStopPayload): Promise<void> {
  const tmuxSession = payload.tmux_session  // From TINSU_TMUX_SESSION env var
  const chatSessionId = this.sessionToChatCache.get(tmuxSession)

  if (!chatSessionId) {
    // Fallback: DB lookup
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.tmuxSession, tmuxSession)
    })
    if (!session) return  // Unknown session, ignore
    chatSessionId = session.id
    this.sessionToChatCache.set(tmuxSession, session.id)
  }

  // Process hook event for chatSessionId...
}
```

**Permission system unchanged** — `pendingPermissions` Map, `resolvePreToolUseDecision()`, 4-minute timeout all stay the same. Only the session lookup changes.

#### Session Monitoring — tmux Health Polling

```typescript
// Poll every 2 seconds (same interval as task system)
private monitorInterval: NodeJS.Timeout

startMonitoring(): void {
  this.monitorInterval = setInterval(async () => {
    for (const [sessionId, tmuxName] of this.sessionCache) {
      const alive = await tmuxHasSession(tmuxName)
      if (!alive) {
        // Session exited — update status (NFR32: <2s detection)
        this.sessionCache.delete(sessionId)
        await db.update(chatSessions)
          .set({ status: 'paused', updatedAt: Date.now() })
          .where(eq(chatSessions.id, sessionId))
        // Emit status change event for UI
        this.emitSessionStatus(sessionId, 'exited')
      }
    }
  }, 2000)
}
```

### tRPC Router Changes

#### `chat-session.router.ts` — Three-Case Handler Update

The `sendChatMessage` mutation's three-case logic simplifies:

```typescript
// Case A: tmux session alive + PTY attached → sendMessage()
// Case B: tmux session alive + PTY detached → reattachSession() then sendMessage()
// Case C: No tmux session (new or paused):
//   - If session.tmuxSession exists but tmux dead → create new tmux session, spawn claude
//   - If no session.tmuxSession → spawnSession() (first message)
```

**Key simplification:** Case B no longer needs `--resume`. The tmux session is still alive with Claude Code running inside it. We just re-attach the PTY for I/O.

**New procedures:**

```typescript
// Startup validation (called from app init)
validateChatSessions: t.procedure
  .mutation(async ({ ctx }) => {
    await ctx.chatCliService.validateSessionsOnStartup()
  }),

// Session list with live status (FR46)
listChatSessionsWithStatus: t.procedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ input, ctx }) => {
    const sessions = await db.query.chatSessions.findMany({
      where: eq(chatSessions.projectId, input.projectId),
      orderBy: desc(chatSessions.lastMessageAt)
    })

    return sessions.map(s => ({
      ...s,
      liveStatus: ctx.chatCliService.getSessionStatus(s.id)
      // 'thinking' | 'idle' | 'completed' | 'exited'
    }))
  }),
```

### Hook Script Changes

#### All Chat Hook Scripts (`src/main/resources/chat-hooks/*.sh`)

**Change:** Include `TINSU_TMUX_SESSION` in POST payload.

```bash
#!/bin/bash
# stop.sh (updated)
INPUT=$(cat)
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")
TMUX_SESSION="${TINSU_TMUX_SESSION:-unknown}"

# Inject tmux session name into payload
PAYLOAD=$(echo "$INPUT" | jq --arg ts "$TMUX_SESSION" '. + {tmux_session: $ts}')

curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/chat-stop" \
  -H "Content-Type: application/json" \
  --connect-timeout 2 --max-time 5 \
  -d "$PAYLOAD" || true
```

Same pattern for `tool-use.sh`, `pre-tool-use.sh`, and `status.sh`.

**Environment variable injection** (in `ChatCliService.spawnSession()`):

```typescript
// When creating tmux session, set env vars in the tmux environment
const tmuxName = `tinsu-chat-${sessionId}`
await execAsync(`tmux new-session -d -s ${tmuxName}`)
await execAsync(`tmux set-environment -t ${tmuxName} TINSU_TMUX_SESSION ${tmuxName}`)
await execAsync(`tmux set-environment -t ${tmuxName} TINSU_SESSION_UUID ${sessionUuid}`)

// Then send the claude command into the tmux session
// PTY attachment handles I/O from this point
```

### UI Component Changes

#### `ChatPanel.tsx` — Multi-Session Awareness

| Current | New |
|---------|-----|
| `setSessionId(null)` on agent switch | Keep `sessionId` — session runs in background |
| Single `isAgentThinking` state | Per-session status from `listChatSessionsWithStatus` |
| No session status badges | Live status badges in session list (thinking/idle/completed/exited) |

**Session list enhancement (FR46):**

```typescript
// ChatSessionList now shows live status
interface SessionListItem {
  id: string
  agentPersona: string
  lastMessageAt: number
  liveStatus: 'thinking' | 'idle' | 'completed' | 'exited'
  preview: string  // Last message snippet
}
```

**Session switching (FR45):**

```typescript
// Switching agents no longer kills the old session
const handlePersonaSwitch = (newPersona: string) => {
  // Old session continues in tmux background
  // Just update UI to show new/different session
  const existingSession = sessions.find(
    s => s.agentPersona === newPersona && s.liveStatus !== 'exited'
  )
  if (existingSession) {
    setSessionId(existingSession.id)  // Resume existing
  } else {
    setSessionId(null)  // Will create on first message
  }
}
```

#### `PlanningWorkspacePage.tsx` — Session Status Visibility

Add session status summary in sidebar or header showing count of active background sessions:

```
PM (payment PRD) — idle
Architect (payment) — thinking
PM (side project) — idle
```

### Integration Patterns

**tmux Session Creation Flow:**

```
User sends first message
  → chatSession.create() in DB (with tmux_session = null)
  → chatCliService.spawnSession():
      1. tmux new-session -d -s tinsu-chat-{sessionId}
      2. tmux set-environment TINSU_TMUX_SESSION / TINSU_SESSION_UUID
      3. tmux send-keys "claude --session-id {uuid} --append-system-prompt {persona} ..." Enter
      4. ptyService.spawn('bash', ['-c', 'tmux attach-session -t tinsu-chat-{sessionId}'])
      5. Update DB: chat_sessions.tmux_session = tinsu-chat-{sessionId}
      6. Populate sessionCache
      7. writeWhenReady() detects TUI → write user message
```

**Session Recovery Flow (App Restart):**

```
App starts
  → validateSessionsOnStartup():
      For each active chat_session in DB:
        tmux has-session -t {tmux_session}?
          YES → rebuild cache, status stays 'active'
          NO  → set status = 'paused'
  → User opens chat, selects paused session, sends message:
      → spawnSession() creates NEW tmux session (fresh claude process)
      → Claude Code's --session-id restores conversation context
      → No --resume needed (claude starts fresh but session-id gives history)
```

**Multi-Project Isolation (FR48-FR50):**

```
Project A sessions:  tinsu-chat-{sessionId-a1}, tinsu-chat-{sessionId-a2}
Project B sessions:  tinsu-chat-{sessionId-b1}

DB query: WHERE project_id = ?  (existing filter, unchanged)
tmux: All sessions on same server, but UI only shows current project's sessions
File isolation: Claude Code's cwd set to project directory at spawn time
```

### Removed Code

The following patterns are **deleted** in this migration:

| Removed | Why |
|---------|-----|
| `findOrphanSession()` | tmux session name is stable — no UUID mismatch possible |
| `discoverCorrectUuid()` | No filesystem scan for session recovery needed |
| `maybeRetryResume()` | tmux sessions don't die and need `--resume` |
| `tryRegisterChatOrphan()` in HookListenerService | Orphan concept eliminated |
| `--resume` flag usage for chat sessions | tmux persistence replaces `--resume` |

### NFR Coverage

| NFR | Target | How Met |
|-----|--------|---------|
| NFR25 | 5+ concurrent sessions | Independent tmux sessions, shared server handles hundreds |
| NFR26 | <500ms session switch | PTY permanently attached; switch = UI state change + cache lookup |
| NFR27 | Zero background message loss | tmux sessions run independently; no PTY disconnect on switch |
| NFR28 | Zero context loss on restart | tmux survives restart; `validateSessionsOnStartup()` reconciles |
| NFR29 | <5s startup validation | Sequential `tmux has-session` calls (~50ms each, 20 sessions = 1s) |
| NFR30 | 100% hook routing accuracy | `TINSU_TMUX_SESSION` env var → O(1) cache lookup, no orphan ambiguity |
| NFR31 | <15s session creation | tmux new-session (<1s) + claude spawn + TUI ready (~10-12s) |
| NFR32 | <2s stale detection | 2-second polling interval on `tmux has-session` |

### FR Coverage

| FR | Description | Architectural Support |
|----|-------------|----------------------|
| FR36 | Planning Workspace with BMAD sidebar | Existing UI — no architectural change |
| FR37 | Agent persona selector | Existing `--append-system-prompt` injection — unchanged |
| FR38 | Chat interface with message bubbles | Existing `chat_messages` table + ChatPanel — unchanged |
| FR39 | Persistent isolated terminal session | tmux session per chat (`tinsu-chat-{sessionId}`) |
| FR40 | Bidirectional communication channel | PTY attached to tmux; `ptyService.write()` for input, `onData` for output |
| FR41 | Agent launch with session identity | `claude --session-id {uuid}` inside tmux with `TINSU_TMUX_SESSION` env var |
| FR42 | Event routing without cross-session leakage | `TINSU_TMUX_SESSION` env var → O(1) cache routing, no orphan matching |
| FR43 | Message persistence | Existing `chat_messages` + `chat-stop` hook transcript extraction — unchanged |
| FR44 | Multiple simultaneous sessions | Independent tmux sessions, permanent PTY attachment each |
| FR45 | Switch without interrupting background | Switching = UI state change; tmux sessions unaffected |
| FR46 | Session list with live status | `listChatSessionsWithStatus` query + 2s polling health monitor |
| FR47 | Resume previous sessions | Session list click → PTY re-attach if needed, or send message to alive session |
| FR48 | Project-scoped sessions | `chat_sessions.project_id` filter (existing) + `tinsu-chat-*` naming |
| FR49 | Cross-project concurrent sessions | Same tmux server, project isolation via DB filter and Claude cwd |
| FR50 | Project-confined file operations | Claude Code cwd set to project directory at spawn time |
| FR51 | Survive app restart | tmux sessions persist natively; `validateSessionsOnStartup()` reconciles |
| FR52 | Startup health validation | `tmux has-session` for each active DB session; mark unavailable as 'paused' |
| FR53 | Health monitoring with 2s detection | 2-second polling interval on `tmux has-session` for all cached sessions |

### Files Changed

**Backend (Main Process):**

| File | Change |
|------|--------|
| `src/main/services/chat-cli.service.ts` | **Major refactor** — tmux session creation + PTY attachment, remove orphan logic, 2-hour idle timeout, startup validation, session cache |
| `src/main/services/hook-listener.service.ts` | Route chat hooks by `tmux_session` payload field via `sessionToChatCache`; remove `tryRegisterChatOrphan()` |
| `src/main/services/index.ts` | No new services — existing services refactored |
| `src/main/trpc/routers/chat-session.router.ts` | Simplify three-case handler for tmux; add `validateChatSessions`, `listChatSessionsWithStatus` |
| `src/main/db/schema.ts` | Add `tmux_session` column to `chat_sessions` table |
| `src/main/db/index.ts` | Migration for `tmux_session` column |

**Frontend (Renderer):**

| File | Change |
|------|--------|
| `src/renderer/src/components/planning/ChatPanel.tsx` | Multi-session awareness; session switching without kill; live status badges |
| `src/renderer/src/components/planning/ChatSessionList.tsx` | Live status indicators per session |
| `src/renderer/src/pages/PlanningWorkspacePage.tsx` | Background session count/status in sidebar |

**Hook Scripts:**

| File | Change |
|------|--------|
| `src/main/resources/chat-hooks/stop.sh` | Include `TINSU_TMUX_SESSION` in POST payload via jq |
| `src/main/resources/chat-hooks/tool-use.sh` | Same |
| `src/main/resources/chat-hooks/pre-tool-use.sh` | Same |
| `src/main/resources/chat-hooks/status.sh` | Same |

### Implementation Checklist

**Database Layer:**
- [ ] Add `tmux_session TEXT` column to `chat_sessions` schema
- [ ] Add migration in `db/index.ts`
- [ ] Run `npm run rebuild:electron`

**Service Layer:**
- [ ] Refactor `ChatCliService.spawnSession()` to create tmux session + PTY attachment
- [ ] Refactor `ChatCliService.resumeSession()` to PTY re-attachment (no `--resume`)
- [ ] Add `validateSessionsOnStartup()` with `tmux has-session` checks
- [ ] Add `sessionCache` (Map<chatSessionId, tmuxSessionName>)
- [ ] Add `startMonitoring()` with 2-second polling
- [ ] Change `IDLE_TIMEOUT_MS` to 2 hours
- [ ] Remove `findOrphanSession()`, `discoverCorrectUuid()`, `maybeRetryResume()`
- [ ] Update `HookListenerService` to route by `tmux_session` payload field
- [ ] Add `sessionToChatCache` (Map<tmuxSessionName, chatSessionId>)
- [ ] Remove `tryRegisterChatOrphan()`

**tRPC Layer:**
- [ ] Simplify `sendChatMessage` three-case handler for tmux
- [ ] Add `validateChatSessions` mutation
- [ ] Add `listChatSessionsWithStatus` query

**Hook Scripts:**
- [ ] Update all 4 chat hook scripts to include `TINSU_TMUX_SESSION` in payload
- [ ] Set `TINSU_TMUX_SESSION` env var via `tmux set-environment` at session creation

**UI Layer:**
- [ ] Update `ChatPanel.tsx` for multi-session awareness
- [ ] Add live status badges to `ChatSessionList`
- [ ] Add background session visibility to `PlanningWorkspacePage`

---

**Extension Status:** READY FOR IMPLEMENTATION ✅
