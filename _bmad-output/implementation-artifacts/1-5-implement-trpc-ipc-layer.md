# Story 1.5: Implement tRPC IPC Layer

Status: done

---

## Story

As a developer,
I want type-safe IPC communication between main and renderer using tRPC,
So that the UI can call main process functions with full TypeScript inference.

---

## Acceptance Criteria

### AC1: Package Installation
**Given** the database is set up from Story 1.4
**When** I install @trpc/server ^11.8.1, @trpc/client ^11.8.1, trpc-electron, and zod ^4.3.5
**Then** the packages install without errors

### AC2: tRPC Router Definition
**Given** tRPC packages are installed
**When** I create a tRPC router in src/main/trpc/router.ts
**Then** I can define procedures like `tasks.getAll`, `tasks.create`, `tasks.updateStatus`
**And** procedures use Zod schemas for input validation

### AC3: tRPC-Electron Integration
**Given** the router is defined
**When** I expose it via trpc-electron in the main process
**Then** the renderer can import the router type
**And** calling `trpc.tasks.getAll.query()` returns typed task data

### AC4: Full Type Safety
**Given** the tRPC layer is complete
**When** I make IPC calls from the renderer
**Then** TypeScript provides full autocomplete for procedure names and parameters
**And** runtime validation errors are thrown for invalid inputs

---

## Tasks / Subtasks

- [x] **Task 1: Install tRPC and Zod packages** (AC: #1)
  - [x] Install @trpc/server@^11.8.1
  - [x] Install @trpc/client@^11.8.1
  - [x] Install trpc-electron (mat-sz fork for tRPC v11)
  - [x] Install zod@^4.3.5 (check if v4 available, fallback to v3)
  - [x] Install @tanstack/react-query (required for tRPC React integration)
  - [x] Verify all packages install without peer dependency conflicts

- [x] **Task 2: Create tRPC base configuration** (AC: #2)
  - [x] Create `src/main/trpc/trpc.ts` with tRPC instance and procedure helpers
  - [x] Create `src/main/trpc/context.ts` with context type (db access)
  - [x] Export `publicProcedure` for use in routers
  - [x] Configure error formatter for TRPCError handling

- [x] **Task 3: Implement task router** (AC: #2)
  - [x] Create `src/main/trpc/routers/task.router.ts`
  - [x] Implement `tasks.getAll` query - list all tasks
  - [x] Implement `tasks.getById` query - get single task by id
  - [x] Implement `tasks.create` mutation - create new task
  - [x] Implement `tasks.updateStatus` mutation - update task status
  - [x] Implement `tasks.delete` mutation - delete task
  - [x] Use Zod schemas for all input validation
  - [x] Return data directly (no wrapping in {success, data})

- [x] **Task 4: Create root router** (AC: #2)
  - [x] Create `src/main/trpc/index.ts` as root router
  - [x] Merge task router into root
  - [x] Export `AppRouter` type for client consumption
  - [x] Export `createContext` function

- [x] **Task 5: Set up trpc-electron in main process** (AC: #3)
  - [x] Modify `src/main/index.ts` to initialize tRPC IPC handler
  - [x] Create tRPC context with database access
  - [x] Register IPC handlers via trpc-electron's `createIPCHandler`
  - [x] Ensure handler is registered before window creation

- [x] **Task 6: Configure preload script** (AC: #3)
  - [x] Update `src/preload/index.ts` to expose tRPC IPC bridge
  - [x] Use trpc-electron's `exposeElectronTRPC` or equivalent
  - [x] Update `src/preload/index.d.ts` with type declarations
  - [x] Ensure contextIsolation security is maintained

- [x] **Task 7: Create tRPC client in renderer** (AC: #3, #4)
  - [x] Create `src/renderer/lib/trpc.ts`
  - [x] Configure tRPC client with electron IPC link
  - [x] Set up TanStack Query provider
  - [x] Export typed `trpc` client hook
  - [x] Update `src/renderer/main.tsx` with QueryClientProvider

- [x] **Task 8: Verify end-to-end type safety** (AC: #4)
  - [x] Create temporary test component that calls `trpc.tasks.getAll.useQuery()`
  - [x] Verify TypeScript autocomplete works for procedure names
  - [x] Verify TypeScript autocomplete works for input parameters
  - [x] Test runtime validation by passing invalid input
  - [x] Remove test component after verification

- [x] **Task 9: Verify build and typecheck** (AC: #1, #2, #3, #4)
  - [x] Run `npm run typecheck` - must pass
  - [x] Run `npm run build` - must complete without errors
  - [x] Run `npm run dev` - verify app launches with tRPC working
  - [x] Test a simple query/mutation flow in dev tools console

---

## Dev Notes

### Critical Architecture Compliance

**MANDATORY: Follow these patterns exactly**

From [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns]:

> **IPC Pattern:** tRPC 11.6.0 — End-to-end type safety, procedure-based API
> **Electron Adapter:** trpc-electron — Fork maintained for tRPC v11 compatibility
> **Validation:** Zod — Runtime validation for procedure inputs

From [Source: _bmad-output/planning-artifacts/architecture.md#IPC-Architecture]:

```
Renderer (React) ──tRPC Client──► Preload ──IPC──► Main (tRPC Router)
                                                      │
                                                      ├── taskRouter
                                                      ├── agentRouter
                                                      ├── gitRouter
                                                      └── configRouter
```

### tRPC v11 Pattern (CRITICAL)

**DO NOT** use tRPC v10 patterns. The v11 API is different:

```typescript
// src/main/trpc/trpc.ts - CORRECT v11 pattern
import { initTRPC } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

### tRPC Response Format (MANDATORY)

From [Source: _bmad-output/planning-artifacts/project-context.md#tRPC-Patterns]:

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

### trpc-electron Setup Pattern

The `trpc-electron` package provides IPC integration. Key files:

**Main Process (`src/main/index.ts`):**
```typescript
import { createIPCHandler } from 'trpc-electron/main';
import { appRouter, createContext } from './trpc';

// In app.whenReady():
createIPCHandler({ router: appRouter, createContext });
```

**Preload (`src/preload/index.ts`):**
```typescript
import { exposeElectronTRPC } from 'trpc-electron/preload';
exposeElectronTRPC();
```

**Renderer (`src/renderer/lib/trpc.ts`):**
```typescript
import { createTRPCReact } from '@trpc/react-query';
import { ipcLink } from 'trpc-electron/renderer';
import type { AppRouter } from '../../main/trpc';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [ipcLink()],
});
```

### Zod Version Note

Architecture specifies Zod ^4.3.5, but as of January 2026, Zod v4 may still be in development. If v4 is not available:
- Install latest Zod v3.x (`npm install zod@latest`)
- Document the actual version installed
- The API is compatible for basic validation needs

### Database Context Pattern

From [Source: _bmad-output/planning-artifacts/architecture.md#tRPC-Router-Boundaries]:

```typescript
// src/main/trpc/context.ts
import { db } from '../db';

export interface Context {
  db: typeof db;
}

export const createContext = (): Context => ({
  db,
});
```

### Task Router Implementation Pattern

```typescript
// src/main/trpc/routers/task.router.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { tasks } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';

export const taskRouter = router({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.select().from(tasks);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get();
      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return task;
    }),

  create: publicProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(['backlog', 'in_progress', 'review', 'done']).default('backlog'),
      epic_id: z.string().optional(),
      sprint_id: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const id = nanoid();
      return ctx.db.insert(tasks).values({ id, ...input }).returning().get();
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['backlog', 'in_progress', 'review', 'done']),
    }))
    .mutation(({ ctx, input }) => {
      const result = ctx.db
        .update(tasks)
        .set({ status: input.status, updated_at: new Date() })
        .where(eq(tasks.id, input.id))
        .returning()
        .get();
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return result;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const result = ctx.db.delete(tasks).where(eq(tasks.id, input.id)).returning().get();
      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
      }
      return { success: true };
    }),
});
```

### Previous Story Learnings

From [Source: _bmad-output/implementation-artifacts/1-4-create-core-database-schema-for-tasks-and-agent-runs.md]:

1. **Drizzle API**: Use `drizzle({ client: sqlite, schema })` pattern
2. **Database connection**: Already exists at `src/main/db/index.ts`
3. **Schema exports**: `tasks`, `agent_runs` tables with type exports `Task`, `NewTask`, etc.
4. **Status enum**: Use `TaskStatus` from schema (`'backlog' | 'in_progress' | 'review' | 'done'`)

### Git Recent Commits

Recent work shows:
- 1.4: Core database schema (tasks, agent_runs tables)
- 1.3: SQLite + Drizzle ORM setup
- 1.2: Tailwind CSS 4 + shadcn/ui
- 1.1: Electron-vite initialization

### What NOT To Do

1. **DO NOT** use tRPC v10 syntax (`createRouter`, `createContext` from v10)
2. **DO NOT** wrap responses in `{ success: true, data }` format
3. **DO NOT** use generic `Error` in routers - use `TRPCError`
4. **DO NOT** import database directly in renderer - use tRPC procedures
5. **DO NOT** skip Zod validation on inputs
6. **DO NOT** use `ipcRenderer.send()` directly - use tRPC procedures
7. **DO NOT** forget to expose the tRPC bridge in preload script

---

## Technical Requirements

### Package Versions

From [Source: _bmad-output/planning-artifacts/architecture.md#Technology-Stack]:

| Package | Target Version | Notes |
|---------|----------------|-------|
| @trpc/server | ^11.8.1 | Latest stable |
| @trpc/client | ^11.8.1 | Must match server |
| trpc-electron | latest | mat-sz fork for v11 |
| zod | ^4.3.5 (or latest v3) | Runtime validation |
| @tanstack/react-query | ^5.90.16 | Required for tRPC React |

### File Structure

From [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure]:

```
src/
├── main/
│   ├── index.ts                  # Add tRPC handler setup
│   ├── trpc/
│   │   ├── index.ts              # Root router, createContext export
│   │   ├── trpc.ts               # tRPC instance, procedure helpers
│   │   ├── context.ts            # Context type (db access)
│   │   └── routers/
│   │       └── task.router.ts    # Task CRUD operations
├── preload/
│   ├── index.ts                  # Add tRPC IPC exposure
│   └── index.d.ts                # Update type declarations
└── renderer/
    ├── main.tsx                  # Add QueryClientProvider
    └── lib/
        └── trpc.ts               # tRPC client setup
```

### Naming Conventions

From [Source: _bmad-output/planning-artifacts/architecture.md#tRPC-Procedure-Naming]:

| Type | Convention | Example |
|------|------------|---------|
| Queries | camelCase, get/list prefix | `getTask`, `listSprintTasks` |
| Mutations | camelCase, verb prefix | `createTask`, `updateStatus`, `deleteRun` |
| Subscriptions | camelCase, on prefix | `onAgentOutput`, `onTaskUpdate` |

### IPC Security Requirements

From [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security]:

- **contextBridge isolation**: Renderer has no direct Node.js access
- **Process isolation**: Sandbox enabled (Electron default)
- Preload script must use `contextBridge.exposeInMainWorld()`

---

## Testing Requirements

### Manual Verification Checklist

- [ ] `npm install` completes without peer dependency warnings for tRPC packages
- [ ] TypeScript recognizes `trpc.tasks.getAll` in renderer code
- [ ] Autocomplete works for procedure names
- [ ] Autocomplete works for input parameters
- [ ] `trpc.tasks.getAll.useQuery()` returns typed `Task[]`
- [ ] `trpc.tasks.create.useMutation()` accepts typed input
- [ ] Invalid input (e.g., missing title) throws Zod validation error
- [ ] TRPCError with 'NOT_FOUND' code propagates to client correctly
- [ ] `npm run typecheck` passes
- [ ] `npm run build` completes without errors
- [ ] App launches and tRPC calls work in dev mode

### Expected Outcomes

1. **Package installation:**
   - All tRPC packages installed with compatible versions
   - No peer dependency conflicts

2. **tRPC configuration:**
   - `src/main/trpc/trpc.ts` - tRPC instance configured
   - `src/main/trpc/context.ts` - Context with db access
   - `src/main/trpc/routers/task.router.ts` - Task CRUD procedures
   - `src/main/trpc/index.ts` - Root router with AppRouter type export

3. **IPC integration:**
   - Main process: tRPC handler registered via trpc-electron
   - Preload: tRPC bridge exposed to renderer
   - Renderer: tRPC client configured with IPC link

4. **Type safety:**
   - Full autocomplete for procedure names and parameters
   - Runtime validation via Zod
   - Proper error handling with TRPCError

---

## References

### Architecture & Planning
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#IPC-Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#tRPC-Router-Boundaries]
- [Source: _bmad-output/planning-artifacts/project-context.md#tRPC-Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5]

### Previous Stories
- [Source: _bmad-output/implementation-artifacts/1-4-create-core-database-schema-for-tasks-and-agent-runs.md]

### External Documentation
- [tRPC v11 Documentation](https://trpc.io/docs)
- [trpc-electron GitHub](https://github.com/mat-sz/trpc-electron)
- [Zod Documentation](https://zod.dev)
- [TanStack Query](https://tanstack.com/query/latest)
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)

---

## Project Context Reference

From [Source: _bmad-output/planning-artifacts/project-context.md]:

### Critical Rules
- Database operations happen in **main process ONLY**
- Use tRPC procedures for ALL main↔renderer communication
- Return data directly from tRPC, don't wrap in `{ success: true, data }`
- Use `TRPCError` not generic `Error` for router errors
- NEVER use `ipcRenderer.send()` or `ipcRenderer.invoke()` directly

### Error Handling Layers

| Layer | Pattern |
|-------|---------|
| Services | Catch errors, throw `TRPCError` with context |
| tRPC Routers | Let `TRPCError` propagate |
| React Query | Use `onError` callback, show toast |
| React UI | `ErrorBoundary` at AppShell level |

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Installed all tRPC packages (@trpc/server@11.8.1, @trpc/client@11.8.1, @trpc/react-query@11.8.1, @tanstack/react-query@5.90.16, trpc-electron@0.1.2, zod@4.3.5) with no peer dependency conflicts
- Created tRPC base configuration with context providing database access
- Implemented task router with 5 procedures: getAll, getById, create, updateStatus, delete
- All procedures use Zod validation and TRPCError for error handling
- Set up trpc-electron IPC handler in main process before window creation
- Configured preload script with exposeElectronTRPC from trpc-electron/main
- Created tRPC client in renderer with ipcLink and TanStack Query provider
- TypeScript provides full autocomplete for procedure names and parameters
- Build and typecheck pass successfully
- Dev mode launches with database initialization and tRPC handler active

### Code Review Fixes (2026-01-04)

- **Fixed delete procedure response**: Changed from `{ deleted: true }` to returning the deleted task directly, per project-context.md mandate against wrapped responses
- **Improved electronTRPC type declaration**: Updated src/preload/index.d.ts with accurate types from trpc-electron (RendererGlobalElectronTRPC with sendMessage/onMessage)
- **Added unit tests**: Created comprehensive test suite for task router with 12 tests covering all CRUD operations (src/main/trpc/routers/task.router.test.ts)
- **Added test infrastructure**: Installed vitest, added vitest.config.ts, added test scripts to package.json

### File List

**New Files:**
- src/main/trpc/context.ts
- src/main/trpc/trpc.ts
- src/main/trpc/routers/task.router.ts
- src/main/trpc/routers/task.router.test.ts (code review addition)
- src/main/trpc/index.ts
- src/renderer/src/lib/trpc.ts
- vitest.config.ts (code review addition)

**Modified Files:**
- package.json (added dependencies, added vitest + test scripts)
- package-lock.json (updated)
- src/main/index.ts (added tRPC IPC handler)
- src/preload/index.ts (added exposeElectronTRPC)
- src/preload/index.d.ts (improved electronTRPC type from code review)
- src/renderer/src/main.tsx (added QueryClientProvider and tRPC.Provider)

