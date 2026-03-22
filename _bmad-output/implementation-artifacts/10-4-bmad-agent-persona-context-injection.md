# Story 10.4: BMAD Agent Persona Context Injection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want the CLI session to behave as the selected BMAD agent persona,
So that I get expert planning guidance from the right specialist (PM for PRDs, Architect for architecture, etc.).

## Acceptance Criteria

1. **Given** I select the PM persona and start a chat **When** the CLI session is spawned **Then** the first message sent to stdin includes the PM agent persona instructions loaded from `_bmad/bmm/agents/pm.md` **And** the agent responds in character as the PM

2. **Given** I select the Architect persona **When** the CLI session starts **Then** the persona context from `_bmad/bmm/agents/architect.md` is injected **And** the agent responds with architecture expertise

3. **Given** I select the UX Designer persona **When** the CLI session starts **Then** the persona context from `_bmad/bmm/agents/ux-designer.md` is injected

4. **Given** I select the Analyst persona **When** the CLI session starts **Then** the persona context from `_bmad/bmm/agents/analyst.md` is injected

5. **Given** any persona is selected **When** the context is injected **Then** the injection also includes the project's `_bmad/bmm/config.yaml` values (user_name, project_name, output paths) **And** the agent is instructed to produce artifacts in the correct `_bmad-output/planning-artifacts/` directory

6. **Given** a persona chat session already exists for a persona **When** I switch to a different persona **Then** a new separate CLI session is spawned for the new persona **And** the previous session remains accessible for resuming later

## Tasks / Subtasks

- [x] Task 1: Create `PersonaContextService` for loading and formatting persona instructions (AC: 1, 2, 3, 4, 5)
  - [x] 1.1 Create `src/main/services/persona-context.service.ts` — a service class that reads BMAD agent persona markdown files from disk and combines them with project config into a context injection string. Constructor takes `bmadRoot: string` (path to `_bmad` directory) and `projectRoot: string`.
  - [x] 1.2 Implement persona-to-file mapping. Use a static readonly map:
    ```
    'bmad:bmm:agents:pm'          -> 'bmm/agents/pm.md'
    'bmad:bmm:agents:architect'   -> 'bmm/agents/architect.md'
    'bmad:bmm:agents:ux-designer' -> 'bmm/agents/ux-designer.md'
    'bmad:bmm:agents:analyst'     -> 'bmm/agents/analyst.md'
    ```
    These keys match `AGENT_PERSONA_CONFIG` in `src/renderer/src/constants/planning-workspace.ts` and the `ChatPersonaKey` type. The file paths are relative to the `_bmad/` directory.
  - [x] 1.3 Implement `loadConfig(): { user_name: string, project_name: string, planning_artifacts: string, output_folder: string, communication_language: string }` — reads `_bmad/bmm/config.yaml` using `fs.readFileSync`, parses YAML (use a simple regex/split approach or import `yaml` if already a dependency — check `package.json`). Resolves `{project-root}` placeholders to actual `projectRoot`. Caches the result after first load.
  - [x] 1.4 Implement `buildContext(personaKey: string): string` — the main method. Flow: (1) Look up persona file path from the mapping. Throw descriptive error if personaKey not found. (2) Read persona markdown file via `fs.readFileSync(path, 'utf-8')`. (3) Call `loadConfig()` to get project config values. (4) Build and return a formatted context string that wraps the persona instructions and config in a clear structure:
    ```
    You are acting as a BMAD planning agent in TinSu. Follow the persona instructions below.

    <persona-instructions>
    {contents of persona .md file}
    </persona-instructions>

    <project-config>
    Project: {project_name}
    User: {user_name}
    Communication Language: {communication_language}
    Planning Artifacts Output: {planning_artifacts resolved path}
    Output Folder: {output_folder resolved path}
    </project-config>

    IMPORTANT: When producing any artifacts (PRDs, architecture docs, etc.), save them to: {planning_artifacts resolved path}/
    ```
  - [x] 1.5 Implement `getPersonaFilePath(personaKey: string): string | null` — returns the absolute path to the persona markdown file, or null if the personaKey is not in the mapping. Useful for validation without reading the file.

- [x] Task 2: Update `ChatCliService.spawnSession` to accept and prepend persona context (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Add an optional `personaContext?: string` parameter to `spawnSession()` method signature. When provided, prepend the persona context to the initial message: the first write to stdin becomes `personaContext + '\n\n' + initialMessage + '\n'` instead of just `initialMessage + '\n'`. If `personaContext` is undefined/empty, behavior is unchanged (backward compatible).
  - [x] 2.2 Similarly add `personaContext?: string` to `resumeSession()`. When resuming, do NOT re-inject the persona context — Claude Code's `--resume` flag restores the conversation including the original persona injection. The parameter exists for API symmetry but is intentionally not used on resume. Add a code comment explaining this design decision.

- [x] Task 3: Update `sendChatMessage` tRPC mutation to inject persona context on first spawn (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Import `PersonaContextService` in `chat-session.router.ts`. Instantiate it using the project's `_bmad` directory path. To resolve paths: use `projectPath` (from `getProjectPath()`) to derive `bmadRoot = join(projectPath, '_bmad')` and `projectRoot = projectPath`.
  - [x] 3.2 In the `sendChatMessage` mutation, Case C (no CLI session ever started — spawn fresh): before calling `chatCliService.spawnSession()`, build persona context using `personaContextService.buildContext(session.agent_persona)`. Pass the context as the new `personaContext` parameter. The `agent_persona` column already stores the persona key (e.g., `'bmad:bmm:agents:pm'`).
  - [x] 3.3 In Case B (resume exited session): do NOT inject persona context. Pass `undefined` for `personaContext`. Claude Code's `--resume` restores the full conversation history including the original persona injection.
  - [x] 3.4 Wrap the `personaContextService.buildContext()` call in a try/catch. If persona loading fails (file not found, YAML parse error), log a warning but still send the user's message without persona context. Do NOT block the chat — degrade gracefully. Log: `[ChatSessionRouter] Warning: Failed to load persona context for ${session.agent_persona}: ${error.message}`.

- [x] Task 4: Handle persona switching — new session per persona (AC: 6)
  - [x] 4.1 In `ChatPanel.tsx`, when `selectedPersona` changes (via `onPersonaChange`): if an active session exists, clear `sessionId` to `null`. This forces a new session to be created on the next message send. The previous session's CLI process continues running in the background (not killed).
  - [x] 4.2 Add a `useEffect` in `ChatPanel.tsx` that watches `selectedPersona`. When it changes: (1) set `sessionId` to `null`, (2) set `isAgentThinking` to `false`, (3) clear the thinking safety timeout. This ensures the UI resets cleanly for the new persona.
  - [x] 4.3 After persona switch and new session creation, messages will poll from the new session. The old session's messages are no longer displayed (they are still in the DB for future Story 10.6 session resume). No need to kill the old CLI process — it will either exit naturally or be cleaned up on app shutdown.

- [x] Task 5: Write tests (AC: 1-6)
  - [x] 5.1 Create `src/main/services/persona-context.service.test.ts` — tests:
    - `buildContext()` returns string containing persona file content and config values
    - `buildContext()` throws for unknown persona key
    - `buildContext()` resolves `{project-root}` placeholders in config paths
    - `loadConfig()` caches config after first load (second call doesn't re-read file)
    - `getPersonaFilePath()` returns correct path for known keys, null for unknown
    - `buildContext()` includes planning artifacts path instruction
  - [x] 5.2 Add tests to `src/main/services/chat-cli.service.test.ts` — tests:
    - `spawnSession()` with `personaContext` prepends context to initial message
    - `spawnSession()` without `personaContext` sends only initial message (backward compat)
    - `resumeSession()` does NOT prepend persona context even when provided
  - [x] 5.3 Add tests to `src/main/trpc/routers/chat-session.router.test.ts` — tests:
    - `sendChatMessage` calls `personaContextService.buildContext()` on first spawn
    - `sendChatMessage` passes persona context to `chatCliService.spawnSession()`
    - `sendChatMessage` does NOT inject context on resume (Case B)
    - `sendChatMessage` still works when persona context loading fails (graceful degradation)
  - [x] 5.4 Add tests to `src/renderer/src/components/planning/ChatPanel.test.tsx` — tests:
    - Persona change resets sessionId (new session created on next message)
    - Persona change clears thinking indicator

## Dev Notes

### Architecture Compliance

- **Process boundaries**: `PersonaContextService` runs in the main process. It reads files from disk (`fs.readFileSync`) — NEVER import this in the renderer. The renderer only knows the persona key string (e.g., `'bmad:bmm:agents:pm'`), not the file contents.
- **Context injection point**: Context is injected at the `sendChatMessage` tRPC mutation level (main process), NOT in the renderer. The renderer calls `sendChatMessage({ sessionId, content })` — the mutation handles persona context transparently.
- **No streaming changes**: Persona context is prepended to the first stdin write. The existing polling-based message delivery (2s `refetchInterval`) is unchanged.

### Critical Design Decisions

**Persona context is injected as the first stdin message, NOT as CLI flags:**
- Claude Code's CLI does not have a flag for custom system prompts or persona injection.
- The approach: prepend the persona instructions + project config to the user's first message. The concatenated text is written to stdin as one write: `[persona context]\n\n[user message]\n`.
- On resume (`--resume`), persona context is NOT re-injected because Claude Code restores the full conversation history including the original injection.

**PersonaContextService is NOT a singleton:**
- Unlike `ChatCliService` (which needs global state for session tracking), `PersonaContextService` is stateless (except config caching). It can be instantiated per-call in the router or kept as a module-level variable — either works.
- Recommendation: Create it inside the `sendChatMessage` mutation body each time it's needed, passing `projectPath` to derive paths. This avoids needing to resolve paths at module load time (when project context may not yet be known).

**Persona-to-file mapping uses the same keys as AGENT_PERSONA_CONFIG:**
- The keys `'bmad:bmm:agents:pm'`, `'bmad:bmm:agents:architect'`, etc. are already used by: `ChatPersonaSelector` (renderer), `AGENT_PERSONA_CONFIG` (renderer constants), `chat_sessions.agent_persona` (DB column). This story reuses the same keys on the main process side for file path resolution.
- The file paths under `_bmad/bmm/agents/` are: `pm.md`, `architect.md`, `ux-designer.md`, `analyst.md`.

**Config YAML parsing — keep it simple:**
- The `_bmad/bmm/config.yaml` file is small (< 20 lines). Use simple line-by-line parsing or check if `yaml` package is already in `package.json`. If yes, use it. If not, use a regex-based parser to avoid adding a dependency for 10 lines of YAML.
- Key fields needed: `user_name`, `project_name`, `communication_language`, `planning_artifacts`, `output_folder`.
- Replace `{project-root}` in values with the actual project root path.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| ChatCliService (session spawning) | `src/main/services/chat-cli.service.ts` | Modify `spawnSession()` and `resumeSession()` signatures |
| Chat session router | `src/main/trpc/routers/chat-session.router.ts` | Add persona context loading to `sendChatMessage` Case C |
| AGENT_PERSONA_CONFIG | `src/renderer/src/constants/planning-workspace.ts` | Reference for persona key format (read-only, do not modify) |
| ChatPersonaSelector | `src/renderer/src/components/planning/ChatPersonaSelector.tsx` | Reference for `ChatPersonaKey` type — do NOT modify |
| ChatPanel | `src/renderer/src/components/planning/ChatPanel.tsx` | Add persona switch reset logic |
| BMAD agent persona files | `_bmad/bmm/agents/{pm,architect,ux-designer,analyst}.md` | Read-only — loaded by PersonaContextService |
| BMAD config | `_bmad/bmm/config.yaml` | Read-only — parsed by PersonaContextService |
| chat_sessions.agent_persona | `src/main/db/schema.ts` | Column stores persona key, already populated by session create |

### Existing Code NOT to Touch

- Do NOT modify `ChatPersonaSelector.tsx` — stable from Story 10.2, read-only reference
- Do NOT modify `ChatMessageBubble.tsx` — no persona display changes in this story
- Do NOT modify `ChatMessageArea.tsx` — no message rendering changes in this story
- Do NOT modify `ChatInput.tsx` — no input changes in this story
- Do NOT modify `hook-listener.service.ts` — chat hook endpoints unchanged
- Do NOT modify `pty.service.ts` — use via ChatCliService
- Do NOT modify DB schema — `agent_persona` column already stores the persona key
- Do NOT modify `AGENT_PERSONA_CONFIG` — renderer constant, used for display only
- Do NOT modify the BMAD agent `.md` files — they are read-only inputs

### Key Patterns from Previous Stories (10.1, 10.2, 10.3)

- `chat_sessions.agent_persona` stores the full persona key string (e.g., `'bmad:bmm:agents:pm'`). This is set during session creation in the `create` mutation and is available on the session record when `sendChatMessage` queries it.
- `ChatCliService.spawnSession()` currently takes `(sessionId, sessionUuid, projectPath, initialMessage)`. This story adds an optional 5th parameter `personaContext`.
- The `sendChatMessage` mutation already has three dispatch cases (alive/exited/new). Persona context injection only applies to Case C (new spawn). Case B (resume) restores context via `--resume`.
- The router uses synchronous Drizzle queries (better-sqlite3) — no async/await needed for DB operations.
- `getProjectPath(projectId)` already exists in the router to resolve project filesystem path.

### File Structure

Files to create:
- `src/main/services/persona-context.service.ts` (new service)
- `src/main/services/persona-context.service.test.ts` (new tests)

Files to modify:
- `src/main/services/chat-cli.service.ts` (add `personaContext` parameter to `spawnSession`/`resumeSession`)
- `src/main/services/chat-cli.service.test.ts` (add persona context tests)
- `src/main/trpc/routers/chat-session.router.ts` (add persona context injection in `sendChatMessage`)
- `src/main/trpc/routers/chat-session.router.test.ts` (add persona context tests)
- `src/renderer/src/components/planning/ChatPanel.tsx` (add persona switch reset)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (add persona switch tests)

### Testing Standards

- Co-locate tests with source: `*.test.ts` next to `*.ts`
- Main process tests use `node` environment with Vitest
- Renderer tests use `happy-dom` environment with `@testing-library/react`
- Mock `fs.readFileSync` in PersonaContextService tests using `vi.mock('fs')`
- Mock `PersonaContextService` in router tests — do NOT read actual BMAD files in tests
- Mock ChatCliService in router tests — do NOT actually spawn PTY processes
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Test graceful degradation: persona context loading failure should not block chat

### Project Structure Notes

- `PersonaContextService` follows the same pattern as other main process services: class-based, co-located with tests, exported from `services/index.ts`.
- The `_bmad/bmm/agents/` directory is part of the project root (not inside `src/`). Path resolution must use the project's filesystem path from the `projects` table, NOT relative paths from the source tree.
- BMAD config and agent files are NOT bundled with the Electron app — they live in the user's project directory. The service reads them at runtime from the project path.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Context Injection]
- [Source: _bmad-output/planning-artifacts/project-context.md#Electron Process Boundaries]
- [Source: src/main/services/chat-cli.service.ts] — ChatCliService spawnSession/resumeSession
- [Source: src/main/trpc/routers/chat-session.router.ts] — sendChatMessage mutation with 3-way dispatch
- [Source: src/renderer/src/constants/planning-workspace.ts] — AGENT_PERSONA_CONFIG, ChatPersonaKey
- [Source: src/renderer/src/components/planning/ChatPanel.tsx] — Persona selection state, session lifecycle
- [Source: src/renderer/src/components/planning/ChatPersonaSelector.tsx] — ChatPersonaKey type, CHAT_PERSONAS
- [Source: _bmad/bmm/agents/pm.md] — PM agent persona instructions
- [Source: _bmad/bmm/agents/architect.md] — Architect agent persona instructions
- [Source: _bmad/bmm/agents/ux-designer.md] — UX Designer agent persona instructions
- [Source: _bmad/bmm/agents/analyst.md] — Analyst agent persona instructions
- [Source: _bmad/bmm/config.yaml] — Project config (user_name, project_name, output paths)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Fixed vitest mock constructor pattern: arrow functions cannot be used with `new` keyword after `vi.clearAllMocks()`. Must use regular `function` syntax in `mockImplementation` for class constructor mocks.

### Completion Notes List
- Task 1: Created PersonaContextService with persona-to-file mapping, config YAML parsing (using `yaml` package already in deps), buildContext formatting, getPersonaFilePath utility, and config caching. 13 unit tests passing.
- Task 2: Added optional `personaContext?: string` parameter to both `spawnSession()` (prepends when truthy) and `resumeSession()` (intentionally unused, with code comment). Backward compatible. 4 new tests (23 total).
- Task 3: Updated sendChatMessage mutation to build persona context in Case C (new spawn), skip in Case B (resume), with graceful degradation try/catch. 4 new tests (38 total).
- Task 4: Added useEffect in ChatPanel watching selectedPersona that resets sessionId, isAgentThinking, and thinking timeout. 2 new tests (12 total).
- Task 5: All test suites created/updated. Total: 86 tests passing across 4 files.
- Exported PersonaContextService from services barrel (index.ts).

### File List
- `src/main/services/persona-context.service.ts` (new)
- `src/main/services/persona-context.service.test.ts` (new)
- `src/main/services/index.ts` (modified — added PersonaContextService export)
- `src/main/services/chat-cli.service.ts` (modified — added personaContext parameter)
- `src/main/services/chat-cli.service.test.ts` (modified — added persona context tests)
- `src/main/trpc/routers/chat-session.router.ts` (modified — persona context injection in sendChatMessage)
- `src/main/trpc/routers/chat-session.router.test.ts` (modified — added persona context injection tests)
- `src/renderer/src/components/planning/ChatPanel.tsx` (modified — added persona switch reset useEffect)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (modified — added persona switch tests)

### Change Log
- 2026-03-22: Story 10.4 implemented — BMAD agent persona context injection with PersonaContextService, CLI parameter additions, router integration, and UI persona switch handling. 86 tests passing.
