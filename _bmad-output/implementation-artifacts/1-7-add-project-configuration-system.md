# Story 1.7: Add Project Configuration System

Status: done

## Story

As a founder,
I want project configuration stored in a human-readable YAML file,
So that settings are version-controlled and editable outside the app (FR35).

## Acceptance Criteria

1. **Given** the app shell from Story 1.6, **When** I create a ConfigService in src/main/services/, **Then** it reads from .tinsu/config.yaml in the project root **And** it creates a default config file if none exists

2. **Given** the ConfigService exists, **When** I define the config schema, **Then** it includes: projectName (string), methodology (enum: 'bmad' | 'taskmaster'), createdAt (ISO date), version (string) **And** the schema is validated with Zod on load

3. **Given** a config file exists, **When** I expose config via tRPC procedure `config.get`, **Then** the renderer can read the current configuration **And** `config.update` allows updating specific fields

4. **Given** the config file is in .tinsu/, **When** I commit the project to git, **Then** the .tinsu/config.yaml is tracked in version control **And** .tinsu/data/ (database) is gitignored

5. **Given** the config file has invalid YAML syntax, **When** the app attempts to load it, **Then** a clear error message is displayed (NFR24) **And** the app does not crash

## Tasks / Subtasks

- [x] Task 1: Create ConfigService with YAML read/write (AC: #1, #2, #5)
  - [x] 1.1: Install `js-yaml` package for YAML parsing
  - [x] 1.2: Create `src/main/services/config.service.ts`
  - [x] 1.3: Define Zod schema for ProjectConfig type
  - [x] 1.4: Implement `getConfigPath()` to resolve `.tinsu/config.yaml`
  - [x] 1.5: Implement `loadConfig()` with YAML parsing and Zod validation
  - [x] 1.6: Implement `saveConfig()` to write YAML
  - [x] 1.7: Implement `getOrCreateConfig()` that creates default if missing
  - [x] 1.8: Handle YAML parse errors gracefully with clear messages
  - [x] 1.9: Write unit tests for ConfigService

- [x] Task 2: Create config.router.ts with tRPC procedures (AC: #3)
  - [x] 2.1: Create `src/main/trpc/routers/config.router.ts`
  - [x] 2.2: Implement `config.get` query procedure
  - [x] 2.3: Implement `config.update` mutation procedure with partial updates
  - [x] 2.4: Add config router to root router
  - [x] 2.5: Write tests for config router procedures

- [x] Task 3: Create shared config types (AC: #2)
  - [x] 3.1: Create `src/shared/types/config.types.ts`
  - [x] 3.2: Define `ProjectConfig` type
  - [x] 3.3: Define `Methodology` enum type
  - [x] 3.4: Export Zod schema for reuse in renderer

- [x] Task 4: Update .gitignore for .tinsu directory (AC: #4)
  - [x] 4.1: Add `.tinsu/data/` to .gitignore (keep config.yaml tracked)
  - [x] 4.2: Verify existing `data/` gitignore doesn't conflict

- [x] Task 5: Integration and verification
  - [x] 5.1: Test config creation on first app launch
  - [x] 5.2: Test config persistence across restarts
  - [x] 5.3: Test invalid YAML error handling
  - [x] 5.4: Verify tRPC type inference works in renderer

## Dev Notes

### Architecture Compliance

**File Locations (per architecture.md):**

- Service: `src/main/services/config.service.ts`
- Router: `src/main/trpc/routers/config.router.ts`
- Types: `src/shared/types/config.types.ts`

**Naming Conventions:**

- tRPC procedures: `config.get`, `config.update` (camelCase, verb prefix)
- Types: `ProjectConfig`, `Methodology` (PascalCase, no I prefix)
- Files: camelCase for services, PascalCase for types

**tRPC Patterns (CRITICAL):**

```typescript
// DO: Return data directly
get: t.procedure.query(() => {
  return configService.getOrCreateConfig()
})

// DON'T: Wrap in success objects
// return { success: true, data: config }; // WRONG

// DO: Use TRPCError for errors
throw new TRPCError({
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Failed to load config',
  cause: error
})

// DON'T: Use generic Error
// throw new Error('Failed'); // WRONG
```

### Project Structure Notes

**Config File Location:**

- Path: `{projectRoot}/.tinsu/config.yaml`
- Database path should be updated to: `.tinsu/data/tinsu.db` (currently `data/tinsu.db`)
- This aligns with FR35 requirement for version-controlled config

**Config Schema:**

```typescript
// src/shared/types/config.types.ts
import { z } from 'zod'

export const MethodologySchema = z.enum(['bmad', 'taskmaster'])
export type Methodology = z.infer<typeof MethodologySchema>

export const ProjectConfigSchema = z.object({
  projectName: z.string().min(1),
  methodology: MethodologySchema,
  createdAt: z.string().datetime(), // ISO 8601
  version: z.string().default('1.0.0')
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>
```

### Technical Requirements

**Dependencies to Add:**

- `js-yaml` - YAML parsing (or `yaml` package)
- `@types/js-yaml` - TypeScript types

**Error Handling:**

- YAML parse errors → Return clear message with line/column if available
- Zod validation errors → Return specific field errors
- File system errors → Check for permissions, directory existence
- Never crash the app on config errors

**Default Config:**

```yaml
# .tinsu/config.yaml
projectName: TinSu # Detected from package.json or folder name
methodology: bmad
createdAt: 2026-01-04T00:00:00Z
version: 1.0.0
```

### Previous Story Intelligence

**From Story 1.5 (tRPC IPC Layer):**

- tRPC router pattern established in `src/main/trpc/routers/task.router.ts`
- Root router merges individual routers in `src/main/trpc/index.ts`
- Context includes database access pattern
- Vitest configured for main process tests

**From Story 1.6 (App Shell):**

- UI state management via Zustand in `src/renderer/src/stores/ui.store.ts`
- Component patterns established in `src/renderer/src/components/`

**Code Patterns to Follow:**

```typescript
// Router pattern from task.router.ts
import { router, publicProcedure } from '../trpc';

export const configRouter = router({
  get: publicProcedure.query(async () => {
    // Implementation
  }),
  update: publicProcedure
    .input(z.object({ ... }))
    .mutation(async ({ input }) => {
      // Implementation
    }),
});
```

### Git Intelligence

**Recent Commits:**

- `259208b` - Story 1.6: AppShell layout with header, sidebar, main content
- `2a0edf4` - Story 1.5: tRPC IPC layer with task router
- `7772cca` - Story 1.4: Database schema for tasks and agent_runs
- `883c12d` - Story 1.3: SQLite + Drizzle ORM setup
- `73b50f0` - Story 1.2: Tailwind CSS 4 + shadcn/ui configuration

**Files likely to be modified:**

- `src/main/trpc/index.ts` - Add configRouter to root router
- `.gitignore` - Add `.tinsu/data/` pattern

**Files to create:**

- `src/main/services/config.service.ts`
- `src/main/services/config.service.test.ts`
- `src/main/trpc/routers/config.router.ts`
- `src/main/trpc/routers/config.router.test.ts`
- `src/shared/types/config.types.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/prd.md#Project Configuration]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/project-context.md#tRPC Patterns]

### Library/Framework Requirements

**js-yaml (YAML Parsing):**

- Version: `^4.1.0` (latest stable)
- Usage: `yaml.load()` for parsing, `yaml.dump()` for serialization
- Note: Handles YAML 1.2 spec, safe by default

**Zod (Validation):**

- Already installed (from Story 1.5)
- Use `.safeParse()` for validation without throwing
- Return `.error.format()` for human-readable errors

### Testing Requirements

**Unit Tests (config.service.test.ts):**

- Test: Default config creation when file doesn't exist
- Test: Config loading from existing file
- Test: Config update preserves unmodified fields
- Test: Invalid YAML returns clear error message
- Test: Invalid schema returns validation errors
- Test: Directory creation if .tinsu/ doesn't exist

**Integration Tests (config.router.test.ts):**

- Test: `config.get` returns valid config
- Test: `config.update` persists changes
- Test: tRPC error handling for invalid inputs

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- **Task 1**: Created ConfigService at `src/main/services/config.service.ts` with full YAML read/write capabilities. Uses js-yaml for parsing and Zod v4 for validation. Custom ConfigError class provides clear error messages with YAML line/column info for parse errors.
- **Task 2**: Created config router with `config.get` (query) and `config.update` (mutation) procedures. Router properly handles ConfigError and converts to TRPCError. Added to root router in `src/main/trpc/index.ts`.
- **Task 3**: Created shared types at `src/shared/types/config.types.ts` with ProjectConfig, Methodology, and Zod schemas exported for use in both main and renderer processes.
- **Task 4**: Updated `.gitignore` to include `.tinsu/data/` pattern, keeping `config.yaml` tracked but database files ignored.
- **Task 5**: Verified all functionality with 21 new tests (14 for ConfigService, 7 for config router). TypeScript compiles cleanly. All 64 tests pass.

**Technical Decisions:**

- Used Zod v4 API (`issues` instead of `errors` array) for error handling
- Added `projectRoot` to tRPC context for ConfigService to access project directory
- ConfigService auto-detects project name from package.json or folder name

### File List

**Created:**

- `src/main/services/config.service.ts` - ConfigService with YAML read/write
- `src/main/services/config.service.test.ts` - 14 unit tests for ConfigService
- `src/main/trpc/routers/config.router.ts` - tRPC router with get/update procedures
- `src/main/trpc/routers/config.router.test.ts` - 7 integration tests for router
- `src/shared/types/config.types.ts` - ProjectConfig type and Zod schemas

**Modified:**

- `src/main/trpc/index.ts` - Added configRouter to root router
- `src/main/trpc/context.ts` - Added projectRoot to context
- `src/main/trpc/routers/task.router.test.ts` - Updated test context
- `.gitignore` - Added `.tinsu/data/` pattern
- `package.json` - Added js-yaml and @types/js-yaml dependencies

## Senior Developer Review (AI)

**Reviewer:** Amelia (Dev Agent) | **Date:** 2026-01-04 | **Outcome:** ✅ APPROVED

### Issues Found & Fixed

| Severity | Issue | File | Fix Applied |
|----------|-------|------|-------------|
| HIGH | `createdAt` mutable via service layer - `ProjectConfigUpdateSchema` allowed updating immutable field | `config.types.ts:18` | Changed `.partial()` to `.pick({...}).partial()` excluding `createdAt` |
| MEDIUM | ConfigService instantiated on every request - performance waste | `config.router.ts:8` | Added `configServiceCache` Map for singleton pattern per projectRoot |
| MEDIUM | `process.cwd()` fallback may fail in packaged Electron app | `context.ts:12` | Added TODO comment documenting issue for future fix |
| MEDIUM | Permission error test was empty placeholder | `config.service.test.ts:206` | Implemented 2 real tests for read/write permission errors |

### Low Issues (Documented, Not Fixed)

- No concurrent write protection (acceptable for v1 - config updates are rare)
- Missing JSDoc on exported types (nice to have)
- Silent error swallowing in `detectProjectName()` (intentional fallback behavior)

### Verification

- **Tests:** 65 passing (was 64, +1 permission error test)
- **TypeScript:** Compiles cleanly
- **All ACs:** Verified implemented
