---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - _bmad-output/planning-artifacts/prd.md
  - docs/research.md
  - docs/bmad-taskmaster-integration.md
workflowType: 'architecture'
project_name: 'TinSu'
user_name: 'Tinxu'
date: '2026-01-03'
status: 'complete'
completedAt: '2026-01-03'
lastStep: 8
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
│   │   │   │   ├── KanbanBoard.tsx      # FR1: 4-column board container
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

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.
