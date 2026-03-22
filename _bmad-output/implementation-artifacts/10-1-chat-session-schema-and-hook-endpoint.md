# Story 10.1: Chat Session Schema & Hook Endpoint

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want TinSu to have the infrastructure to manage chat sessions and receive events from Claude Code,
So that future chat features have a reliable foundation for session tracking and event delivery.

## Acceptance Criteria

1. **Given** the application starts **When** the database initializes **Then** a `chat_sessions` table exists with columns: id, session_uuid, agent_persona, workflow_phase, project_id, status (active/paused/completed), created_at, updated_at, last_message_at **And** a `chat_messages` table exists with columns: id, session_id (FK), role (user/assistant/tool), content, tool_name (nullable), tool_input (nullable), created_at

2. **Given** the application starts **When** the main process initializes **Then** a local HTTP endpoint is listening to receive Claude Code hook events **And** the endpoint accepts POST requests with JSON payloads matching Claude Code hook event schemas

3. **Given** a hook event is received at the HTTP endpoint **When** the event type is `Stop` with `last_assistant_message` **Then** the message is stored in the `chat_messages` table linked to the correct session **And** the session's `last_message_at` is updated

4. **Given** a hook event is received **When** the event type is `PostToolUse` **Then** the tool activity is stored in `chat_messages` with role "tool", tool_name, and tool_input

5. **Given** the tRPC layer **When** chat session procedures are available **Then** `chatSession.create`, `chatSession.list`, `chatSession.getMessages`, `chatSession.updateStatus` procedures exist and work correctly

## Tasks / Subtasks

- [x] Task 1: Add `chat_sessions` table to Drizzle schema (AC: 1)
  - [x] 1.1 Add `CHAT_SESSION_STATUS` enum: `['active', 'paused', 'completed'] as const` in `src/main/db/schema.ts`
  - [x] 1.2 Add `CHAT_MESSAGE_ROLE` enum: `['user', 'assistant', 'tool'] as const` in `src/main/db/schema.ts`
  - [x] 1.3 Define `chat_sessions` table in `src/main/db/schema.ts`
  - [x] 1.4 Export type aliases: `ChatSession`, `NewChatSession`

- [x] Task 2: Add `chat_messages` table to Drizzle schema (AC: 1)
  - [x] 2.1 Define `chat_messages` table in `src/main/db/schema.ts`
  - [x] 2.2 Export type aliases: `ChatMessage`, `NewChatMessage`

- [x] Task 3: Add database migrations in `db/index.ts` (AC: 1)
  - [x] 3.1 Add `CREATE TABLE IF NOT EXISTS chat_sessions` migration in `applyIncrementalMigrations()` with all columns and indexes
  - [x] 3.2 Add `CREATE TABLE IF NOT EXISTS chat_messages` migration in `applyIncrementalMigrations()` with all columns, FK, and indexes
  - [x] 3.3 Follow existing migration pattern: use `CREATE TABLE IF NOT EXISTS` + separate `CREATE INDEX IF NOT EXISTS` statements

- [x] Task 4: Extend hook listener for chat events (AC: 2, 3, 4)
  - [x] 4.1 Add a new endpoint `POST /api/hooks/chat-stop` in `HookListenerService.handleRequest()` in `src/main/services/hook-listener.service.ts`
  - [x] 4.2 Create `ChatStopHookPayloadSchema` Zod schema
  - [x] 4.3 Implement `onChatStopHook()` method
  - [x] 4.4 Add a new endpoint `POST /api/hooks/chat-tool-use` in `HookListenerService.handleRequest()`
  - [x] 4.5 Implement `onChatToolUseHook()` method

- [x] Task 5: Create `chatSession` tRPC router (AC: 5)
  - [x] 5.1 Create `src/main/trpc/routers/chat-session.router.ts`
  - [x] 5.2 Implement `create` mutation
  - [x] 5.3 Implement `list` query: filter by `projectId`, order by `last_message_at` desc (nulls last), then `created_at` desc
  - [x] 5.4 Implement `getMessages` query: filter by `sessionId`, order by `created_at` asc, support `limit` (default 100) and `offset` (default 0)
  - [x] 5.5 Implement `updateStatus` mutation: accepts `sessionId` and `status` (validated against `CHAT_SESSION_STATUS`), updates `status` and `updated_at`
  - [x] 5.6 Register router in `src/main/trpc/index.ts` as `chatSession: chatSessionRouter`

- [x] Task 6: Write unit tests (AC: 1, 2, 3, 4, 5)
  - [x] 6.1 Create `src/main/db/chat-sessions.test.ts`: test table creation, FK constraints, index existence (11 tests)
  - [x] 6.2 Create `src/main/services/hook-listener-chat.test.ts`: test chat-stop and chat-tool-use endpoints (payload validation, message storage, orphan handling) (9 tests)
  - [x] 6.3 Create `src/main/trpc/routers/chat-session.router.test.ts`: test all 4 procedures (create, list, getMessages, updateStatus) (19 tests)

## Dev Notes

### Architecture Compliance

- **Database**: Follow snake_case table/column naming. Use `text('id').primaryKey()` with `crypto.randomUUID()`. Use `integer('...', { mode: 'timestamp' })` for date columns. FK with `onDelete: 'cascade'` for session-scoped data.
- **tRPC**: Use `publicProcedure` from `../trpc`. Return data directly (no `{ success: true }` wrappers). Use `TRPCError` for errors. Register new router in `src/main/trpc/index.ts`.
- **Hook Listener**: Extend the existing `HookListenerService` class. Use separate `/api/hooks/chat-stop` and `/api/hooks/chat-tool-use` endpoints (NOT reuse the existing `/api/hooks/stop` and `/api/hooks/tool-use` which are bound to task execution). This separation prevents chat events from conflicting with the task execution pipeline (orphan session registration, automation triggers, auto-commits, etc.).
- **Migrations**: Add to `applyIncrementalMigrations()` in `src/main/db/index.ts` using `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.

### Critical Design Decision: Separate Chat Hook Endpoints

The existing `/api/hooks/stop` endpoint triggers task automation (auto-commits, workflow transitions, automation triggers via `AutomationService.onAgentComplete`). Chat sessions are NOT task executions and must NOT trigger these side effects. Therefore:

- Use `/api/hooks/chat-stop` for chat session Stop events
- Use `/api/hooks/chat-tool-use` for chat session PostToolUse events
- The Claude Code hook scripts for chat sessions (Story 10.3) will POST to these chat-specific endpoints
- The existing task execution hook endpoints remain unchanged

### Key Pattern: Session UUID vs Session ID

- `session_uuid` in `chat_sessions` maps to Claude Code's `session_id` from hook payloads (used for `--session-id` CLI flag)
- `id` in `chat_sessions` is TinSu's internal primary key (UUID generated by app)
- `session_id` FK in `chat_messages` references `chat_sessions.id` (internal PK), not the Claude Code session UUID
- Lookup pattern: hook receives `payload.session_id` -> query `chat_sessions WHERE session_uuid = payload.session_id` -> get internal `id` -> insert `chat_messages` with `session_id = chat_sessions.id`

### Existing Code to Reuse

- `HookListenerService` at `src/main/services/hook-listener.service.ts`: extend with new route handlers
- `StopHookPayloadSchema` and `ToolUseHookPayloadSchema`: reference for Zod schema patterns
- `db` import from `../db` for database operations
- `router`, `publicProcedure` from `../trpc` for tRPC router
- Test patterns from `src/main/services/hook-listener.service.test.ts` and `src/main/trpc/routers/activity.router.ts`

### Existing Code NOT to Touch

- Do NOT modify existing `onStopHook()` or `onToolUseHook()` methods -- they handle task execution events
- Do NOT modify existing `tryRegisterOrphanSession()` -- it registers sessions with `task_sessions`, not `chat_sessions`
- Do NOT modify `AutomationService` or `TaskSessionService` -- those are task execution concerns

### Testing Standards

- Co-locate tests with source: `*.test.ts` next to `*.ts`
- Use Vitest with `describe`/`it`/`expect`
- For DB tests: use in-memory SQLite (`new Database(':memory:')`) with migrations applied
- For router tests: create a test caller using `appRouter.createCaller(ctx)`
- For hook listener tests: mock HTTP requests or call handler methods directly

### Project Structure Notes

Files to create:
- `src/main/trpc/routers/chat-session.router.ts` (new router)
- `src/main/trpc/routers/chat-session.router.test.ts` (new tests)
- `src/main/services/hook-listener-chat.test.ts` (new tests)
- `src/main/db/chat-sessions.test.ts` (new tests)

Files to modify:
- `src/main/db/schema.ts` (add tables + types)
- `src/main/db/index.ts` (add migrations)
- `src/main/services/hook-listener.service.ts` (add chat endpoints)
- `src/main/trpc/index.ts` (register chatSession router)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md#Critical Implementation Rules]
- [Source: src/main/db/schema.ts] - Existing schema patterns (table definitions, FK constraints, indexes)
- [Source: src/main/db/index.ts] - Migration pattern (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS)
- [Source: src/main/services/hook-listener.service.ts] - Hook endpoint patterns, Zod schemas, request handling
- [Source: src/main/trpc/index.ts] - Router registration pattern
- [Source: src/main/trpc/trpc.ts] - tRPC initialization, publicProcedure export
- [Source: src/main/trpc/context.ts] - Context shape for router procedures

## Change Log

- 2026-03-22: Story 10.1 implementation complete - all 6 tasks done, 39 tests passing

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- All 39 new tests pass (11 schema + 9 hook listener + 19 router)
- No regressions introduced (pre-existing test failures in velocity.router, task-sessions, activity-log, bmad-agent-launcher are unrelated)
- Ran `npm run rebuild:electron` after DB changes per CLAUDE.md

### Completion Notes List

- Task 1-2: Added `chat_sessions` and `chat_messages` tables to Drizzle schema with all specified columns, FK constraints, indexes, and type exports. Added `CHAT_SESSION_STATUS` and `CHAT_MESSAGE_ROLE` enums.
- Task 3: Added `CREATE TABLE IF NOT EXISTS` migrations for both tables in `applyIncrementalMigrations()` with FK constraints and all indexes.
- Task 4: Extended `HookListenerService` with two new endpoints (`/api/hooks/chat-stop` and `/api/hooks/chat-tool-use`) that are fully isolated from task execution endpoints. Added `ChatStopHookPayloadSchema` and `ChatToolUseHookPayloadSchema` Zod schemas. Implemented `onChatStopHook()` (stores assistant messages, updates timestamps) and `onChatToolUseHook()` (stores tool activity with JSON-stringified tool_input). Both handle orphan events gracefully with warning logs.
- Task 5: Created `chatSession` tRPC router with `create`, `list`, `getMessages`, `updateStatus` procedures. Registered as `chatSession` in `src/main/trpc/index.ts`.
- Task 6: Created 39 unit tests across 3 test files covering all acceptance criteria: schema validation, FK constraints, index existence, endpoint payload validation, message storage, orphan handling, endpoint isolation from task automation, and all 4 tRPC procedures.

### File List

Files created:
- src/main/trpc/routers/chat-session.router.ts
- src/main/trpc/routers/chat-session.router.test.ts
- src/main/services/hook-listener-chat.test.ts
- src/main/db/chat-sessions.test.ts

Files modified:
- src/main/db/schema.ts (added chat_sessions, chat_messages tables + enums + type exports)
- src/main/db/index.ts (added CREATE TABLE migrations for chat_sessions and chat_messages)
- src/main/services/hook-listener.service.ts (added chat-stop, chat-tool-use endpoints + Zod schemas + handlers)
- src/main/trpc/index.ts (registered chatSession router)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status updates)
- _bmad-output/implementation-artifacts/10-1-chat-session-schema-and-hook-endpoint.md (story file updates)
