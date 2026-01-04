---
project_name: 'TinSu'
date: '2026-01-03'
architecture_doc: '_bmad-output/planning-artifacts/architecture.md'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing TinSu. Focus on unobvious details that prevent implementation mistakes._

---

## Technology Stack & Versions

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Electron | latest | Desktop app, NOT web |
| UI | React | 18.x | Strict mode enabled |
| Language | TypeScript | 5.x | `strict: true` in tsconfig |
| Build | electron-vite | 5.0 | Vite for all processes |
| Database | better-sqlite3 | latest | Synchronous API, main process only |
| ORM | Drizzle | 1.0.0-beta.2 | Type-safe, lightweight |
| IPC | tRPC | 11.6.0 | End-to-end type safety |
| Adapter | trpc-electron | latest | Fork for tRPC v11 |
| Validation | Zod | latest | Runtime validation |
| Components | shadcn/ui | latest | Copy-paste, Tailwind-based |
| Styling | Tailwind CSS | ^4.1.18 | Utility-first, CSS-first config |
| DnD | @dnd-kit | latest | Kanban drag-drop |
| Terminal | xterm.js | latest | Embedded terminal |
| PTY | node-pty | latest | Main process only |
| Diff | Monaco Editor | 4.7.0 | VS Code diff component |
| State | Zustand | latest | Local UI state only |

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
  return db.query.tasks.findFirst({ where: eq(tasks.id, input.id) });
});
```

**DON'T:**
```typescript
// NEVER wrap responses
return { success: true, data: task };  // WRONG
return { data: task, error: null };    // WRONG
```

**Error handling:**
```typescript
// ALWAYS use TRPCError, not generic Error
throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
```

### Naming Conventions

| Element | Convention | Example | Anti-pattern |
|---------|------------|---------|--------------|
| DB tables | snake_case plural | `tasks`, `agent_runs` | `Task`, `agentRuns` |
| DB columns | snake_case | `created_at` | `createdAt` |
| tRPC queries | camelCase, get/list | `getTask`, `listTasks` | `fetchTask` |
| tRPC mutations | camelCase, verb | `createTask`, `updateStatus` | `task_create` |
| Components | PascalCase | `TaskCard.tsx` | `task-card.tsx` |
| Hooks | use prefix | `useTask` | `taskHook` |
| Stores | use + Store | `useTaskStore` | `taskStore` |
| Types | PascalCase, NO I prefix | `Task` | `ITask` |

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

| Layer | Pattern |
|-------|---------|
| Services | Catch errors, throw `TRPCError` with context |
| tRPC Routers | Let `TRPCError` propagate |
| React Query | Use `onError` callback, show toast |
| React UI | `ErrorBoundary` at AppShell level |

---

## Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| `ipcRenderer.send()` direct calls | Use tRPC procedures |
| `useState` for server data | Use tRPC queries |
| `ITask`, `IUser` (I prefix) | `Task`, `User` |
| Tests in `__tests__/` folder | Co-located `*.test.ts` |
| Separate CSS/SCSS files | Tailwind inline classes |
| `throw new Error()` in routers | `throw new TRPCError()` |
| Import node modules in renderer | Use tRPC to call main process |

---

## Git Worktree Pattern

Each task gets an isolated worktree:
- Created when agent starts: `git worktree add .worktrees/{task-id} -b task/{task-id}`
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

| Context | Format |
|---------|--------|
| Database | INTEGER (Unix timestamp seconds) |
| tRPC responses | ISO 8601 string |
| UI display | Format with `date-fns` |

---

## Reference Documents

- **Full Architecture:** `_bmad-output/planning-artifacts/architecture.md`
- **PRD:** `_bmad-output/planning-artifacts/prd.md`
