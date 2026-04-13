---
project_name: 'TinSu'
date: '2026-01-03'
architecture_doc: '_bmad-output/planning-artifacts/architecture.md'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing TinSu. Focus on unobvious details that prevent implementation mistakes._

---

## Technology Stack & Versions

| Layer      | Technology     | Version      | Notes                              |
| ---------- | -------------- | ------------ | ---------------------------------- |
| Framework  | Tauri v2       | latest       | Desktop + mobile app, NOT web      |
| UI         | React          | 18.x         | Strict mode enabled                |
| Language   | TypeScript     | 5.x          | `strict: true` in tsconfig         |
| Build      | Vite           | latest       | Bundler for React frontend         |
| Backend    | Rust (rspc)    | latest       | Tauri commands replace tRPC        |
| Database   | SQLite (SeaORM)| latest       | Via Tauri Rust backend             |
| Mobile     | Tauri mobile   | latest       | Same React+Rust, WebView on Android/iOS — KMP approach deprecated 2026-04-12 |
| Validation | Zod            | latest       | Runtime validation                 |
| Components | shadcn/ui      | latest       | Copy-paste, Tailwind-based         |
| Styling    | Tailwind CSS   | ^4.1.18      | Utility-first, CSS-first config    |
| DnD        | @dnd-kit       | latest       | Kanban drag-drop                   |
| Terminal   | xterm.js       | latest       | Embedded terminal                  |
| PTY        | node-pty       | latest       | Main process only                  |
| Diff       | Monaco Editor  | 4.7.0        | VS Code diff component             |
| State      | Zustand        | latest       | Local UI state only                |

---

## Critical Implementation Rules

### Electron Process Boundaries

**NEVER do these in renderer:**

- Import `node-pty`, `better-sqlite3`, `child_process`, or `fs`
- Access Node.js APIs directly
- Use `ipcRenderer.send()` or `ipcRenderer.invoke()` directly

**ALWAYS:**

- Use tRPC procedures for ALL main↔renderer communication
- Database operations happen in main process only
- PTY operations happen in main process only

### tRPC Patterns

**DO:**

```typescript
// Return data directly
getTask: t.procedure.input(z.object({ id: z.string() })).query(({ input }) => {
  return db.query.tasks.findFirst({ where: eq(tasks.id, input.id) })
})
```

**DON'T:**

```typescript
// NEVER wrap responses
return { success: true, data: task } // WRONG
return { data: task, error: null } // WRONG
```

**Error handling:**

```typescript
// ALWAYS use TRPCError, not generic Error
throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })
```

### Naming Conventions

| Element        | Convention              | Example                      | Anti-pattern        |
| -------------- | ----------------------- | ---------------------------- | ------------------- |
| DB tables      | snake_case plural       | `tasks`, `agent_runs`        | `Task`, `agentRuns` |
| DB columns     | snake_case              | `created_at`                 | `createdAt`         |
| tRPC queries   | camelCase, get/list     | `getTask`, `listTasks`       | `fetchTask`         |
| tRPC mutations | camelCase, verb         | `createTask`, `updateStatus` | `task_create`       |
| Components     | PascalCase              | `TaskCard.tsx`               | `task-card.tsx`     |
| Hooks          | use prefix              | `useTask`                    | `taskHook`          |
| Stores         | use + Store             | `useTaskStore`               | `taskStore`         |
| Types          | PascalCase, NO I prefix | `Task`                       | `ITask`             |

### State Management

**Server state (from main process):**

- Use tRPC + TanStack Query
- NEVER use `useState` for data from main process

**Local UI state (renderer only):**

- Use Zustand stores
- Examples: sidebar visibility, selected task ID, panel states

### File Organization

```
src/main/          → Node.js code (DB, PTY, Git)
src/preload/       → IPC bridge only
src/renderer/      → React code (NO Node.js imports)
src/shared/types/  → Type definitions shared between processes
```

**Tests:** Co-locate with source files (`TaskCard.test.tsx` next to `TaskCard.tsx`)

### Styling Rules

- Use Tailwind classes inline
- NEVER create separate CSS files
- Use `cn()` utility from `lib/utils.ts` for conditional classes
- shadcn/ui components go in `components/ui/`

### Error Handling Layers

| Layer        | Pattern                                      |
| ------------ | -------------------------------------------- |
| Services     | Catch errors, throw `TRPCError` with context |
| tRPC Routers | Let `TRPCError` propagate                    |
| React Query  | Use `onError` callback, show toast           |
| React UI     | `ErrorBoundary` at AppShell level            |

---

## Anti-Patterns to Avoid

| NEVER                             | INSTEAD                       |
| --------------------------------- | ----------------------------- |
| `ipcRenderer.send()` direct calls | Use tRPC procedures           |
| `useState` for server data        | Use tRPC queries              |
| `ITask`, `IUser` (I prefix)       | `Task`, `User`                |
| Tests in `__tests__/` folder      | Co-located `*.test.ts`        |
| Separate CSS/SCSS files           | Tailwind inline classes       |
| `throw new Error()` in routers    | `throw new TRPCError()`       |
| Import node modules in renderer   | Use tRPC to call main process |

---

## Git Worktree Pattern

Each task gets an isolated worktree:

- Created when task moves to in_progress: `git worktree add .tinsu/worktrees/{task-id} -b tinsu/story-{task-id}-{slug} HEAD`
- Branch naming: `tinsu/story-{task-id}-{slug}` where slug is derived from task title (lowercase, hyphens, max 50 chars)
- Branch collision: Suffix `-2`, `-3` etc. appended if branch already exists
- Removed after merge or rejection
- Merge conflicts detected before merge attempt

---

## PTY/Terminal Pattern

- PTY spawned in main process via `node-pty`
- Output streamed via tRPC subscription
- Pause/Resume via SIGSTOP/SIGCONT signals
- Stall detection monitors output patterns

---

## Date/Time Handling

| Context        | Format                           |
| -------------- | -------------------------------- |
| Database       | INTEGER (Unix timestamp seconds) |
| tRPC responses | ISO 8601 string                  |
| UI display     | Format with `date-fns`           |

---

## Testing with Native Modules (CRITICAL)

The project uses `better-sqlite3` which requires compilation for different Node.js versions:

| Context      | Node.js Version          | Compile Command            |
| ------------ | ------------------------ | -------------------------- |
| Electron app | Electron's embedded Node | `npm run rebuild:electron` |
| Vitest tests | System Node.js           | `npm run rebuild:node`     |

**Test scripts handle this automatically:**

```json
"pretest": "npm run rebuild:node",     // Before tests: compile for Node.js
"test": "vitest run",                   // Run tests
"posttest": "npm run rebuild:electron"  // After tests: recompile for Electron
```

**If app crashes with NODE_MODULE_VERSION error:**

```bash
npm run rebuild:electron
```

**If tests fail with NODE_MODULE_VERSION error:**

```bash
npm run rebuild:node
```

---

## Vitest Configuration (Electron)

```typescript
// vitest.config.ts - Multi-environment testing
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node', // Main process = Node.js
          include: ['src/main/**/*.test.ts']
        }
      },
      {
        resolve: {
          alias: { '@renderer': path.resolve(__dirname, 'src/renderer/src') }
        },
        test: {
          name: 'renderer',
          environment: 'happy-dom', // Renderer = browser-like
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test-setup.ts']
        }
      }
    ]
  }
})
```

**Test setup (renderer):**

```typescript
// src/renderer/src/test-setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
}) // Prevent DOM pollution between tests
```

---

## Task Execution Sandbox Patterns (Feature Extension)

_Added: 2026-01-12_

### tmux Session Pattern

Each task gets an isolated tmux session:

- **Naming:** `tinsu-{projectName}-{taskId}`
- Created when task moves to In Progress
- Survives app restart (tmux server independent)
- Commands sent via `tmux send-keys`

```bash
# Create session
tmux new-session -d -s tinsu-myapp-task-abc123

# Send command
tmux send-keys -t tinsu-myapp-task-abc123 "claude --print ..." Enter

# Attach (for xterm.js)
tmux attach-session -t tinsu-myapp-task-abc123

# Capture scrollback
tmux capture-pane -t tinsu-myapp-task-abc123 -p -S -50000
```

### Claude Code Hooks Pattern

Hook events received via HTTP localhost:

| Endpoint | Hook | Purpose |
|----------|------|---------|
| `POST /api/hooks/stop` | Stop | Task completion detection |
| `POST /api/hooks/tool-use` | PostToolUse | Activity logging |

**Port Discovery:** Hook scripts read port from `/tmp/tinsu-hook-port`

### Activity Log Event Types

| Type | When Logged |
|------|-------------|
| `status_change` | Task moved between columns |
| `agent_start` | Claude Code started in tmux |
| `agent_complete` | Stop hook received |
| `tool_used` | PostToolUse hook received |
| `user_command` | User typed in terminal |
| `automation_trigger` | Auto code-review triggered |
| `error` | Agent or hook failure |

### Workflow Automation Rules

**Story Tasks (BMAD-generated):**
```
In Progress → create tmux → send dev-story prompt
dev-story complete → move to Review → send /code-review
code-review complete → notify user
```

**Basic Tasks (user-created):**
```
In Progress → create tmux → send task.description
agent complete → move to Review
[No auto code-review - manual only]
```

### New Services (Main Process)

| Service | Responsibility |
|---------|---------------|
| `task-terminal.service.ts` | tmux session lifecycle |
| `hook-listener.service.ts` | HTTP server for hooks |
| `activity-log.service.ts` | Event logging + streaming |
| `automation.service.ts` | Story/Basic state machine |
| `scrollback-backup.service.ts` | Filesystem persistence |

### New Database Tables

| Table | Purpose |
|-------|---------|
| `task_activities` | Append-only activity log |
| `task_sessions` | tmux + Claude Code session mapping |
| `app_settings` | User preferences (retention, etc.) |

---

## Reference Documents

- **Full Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **PRD:** `_bmad-output/planning-artifacts/prd.md`
- **Task Execution Sandbox PRD:** `_bmad-output/planning-artifacts/prd-task-execution-sandbox.md`
