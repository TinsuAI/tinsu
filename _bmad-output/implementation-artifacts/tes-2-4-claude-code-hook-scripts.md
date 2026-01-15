# Story TES-2.4: Claude Code Hook Scripts

Status: done

---

## Story

As a developer,
I want hook scripts that send events to TinSu,
So that Claude Code activities are captured automatically.

## Acceptance Criteria

1. **Given** the project needs Claude Code integration, **When** hook scripts are created, **Then** `.claude/hooks/task-completion.sh` exists and is executable, **And** `.claude/hooks/log-tool-use.sh` exists and is executable

2. **Given** task-completion.sh receives a Stop hook event, **When** the script runs, **Then** it reads JSON from stdin, **And** sends a POST to http://localhost:{port}/api/hooks/stop, **And** fails silently if TinSu is not running (exit 0)

3. **Given** log-tool-use.sh receives a PostToolUse event, **When** the script runs, **Then** it reads JSON from stdin, **And** sends a POST to http://localhost:{port}/api/hooks/tool-use, **And** fails silently if TinSu is not running

4. **Given** hooks need to be configured, **When** the project is set up, **Then** `.claude/settings.json` contains Stop and PostToolUse hook configurations pointing to the scripts

## Tasks / Subtasks

- [x] Task 1: Create task-completion.sh Stop hook script (AC: #1, #2)
  - [x] 1.1: Create `.claude/hooks/task-completion.sh` file
  - [x] 1.2: Read JSON from stdin using `cat`
  - [x] 1.3: Read TinSu hook port from `/tmp/tinsu-hook-port` with fallback to 3847
  - [x] 1.4: Send POST to `/api/hooks/stop` using curl
  - [x] 1.5: Add `|| true` to fail silently if TinSu not running
  - [x] 1.6: Make script executable with `chmod +x`
  - [x] 1.7: Add shebang `#!/bin/bash` at top

- [x] Task 2: Create log-tool-use.sh PostToolUse hook script (AC: #1, #3)
  - [x] 2.1: Create `.claude/hooks/log-tool-use.sh` file
  - [x] 2.2: Read JSON from stdin using `cat`
  - [x] 2.3: Read TinSu hook port from `/tmp/tinsu-hook-port` with fallback to 3847
  - [x] 2.4: Send POST to `/api/hooks/tool-use` using curl
  - [x] 2.5: Add `|| true` to fail silently if TinSu not running
  - [x] 2.6: Make script executable with `chmod +x`
  - [x] 2.7: Add shebang `#!/bin/bash` at top

- [x] Task 3: Configure Claude Code hooks in settings.json (AC: #4)
  - [x] 3.1: Create or update `.claude/settings.json` file
  - [x] 3.2: Add Stop hook configuration pointing to task-completion.sh
  - [x] 3.3: Add PostToolUse hook configuration pointing to log-tool-use.sh
  - [x] 3.4: Use proper hook format: `{ "hooks": { "Stop": [...], "PostToolUse": [...] } }`
  - [x] 3.5: Verify JSON is valid

- [x] Task 4: Write integration tests (AC: #1-#4)
  - [x] 4.1: Test task-completion.sh exists and is executable
  - [x] 4.2: Test log-tool-use.sh exists and is executable
  - [x] 4.3: Test task-completion.sh sends correct HTTP request when server running
  - [x] 4.4: Test task-completion.sh exits 0 when server not running
  - [x] 4.5: Test log-tool-use.sh sends correct HTTP request when server running
  - [x] 4.6: Test log-tool-use.sh exits 0 when server not running
  - [x] 4.7: Test settings.json contains valid hook configuration
  - [x] 4.8: Test hook scripts read port from port file correctly

- [x] Task 5: Code Review Fixes (AI-Review)
  - [x] 5.1: Update .gitignore to allow TinSu hook scripts (was blocking version control)
  - [x] 5.2: Add tests for empty port file edge case (fallback to 3847)

## Dev Notes

### Architecture Compliance

This story implements **AR6** and **AR7** from the Task Execution Sandbox Architecture extension:

> AR6: Claude Code hook configuration in `.claude/settings.json`
> AR7: Hook scripts: `task-completion.sh` (Stop hook), `log-tool-use.sh` (PostToolUse hook)

And completes the integration chain from Claude Code to TinSu started in TES-2.3 (Hook Listener HTTP Server).

[Source: _bmad-output/planning-artifacts/architecture.md#claude-code-hook-configuration]

### Previous Story Learnings (TES-2.3)

**From TES-2.3 (Hook Listener HTTP Server):**
- HookListenerService runs on configurable port (default 3847)
- Port written to `/tmp/tinsu-hook-port` for hook scripts to discover
- Endpoints: POST `/api/hooks/stop`, POST `/api/hooks/tool-use`, GET `/api/hooks/health`
- Zod validation for payloads: `StopHookPayload`, `ToolUseHookPayload`
- Service handles invalid JSON with 400 error, valid payload returns 200

**Key Integration:**
- Hook scripts POST to HookListenerService endpoints
- Scripts must read port from `/tmp/tinsu-hook-port` (or fallback to 3847)
- Silent failure required - TinSu may not be running

[Source: _bmad-output/implementation-artifacts/tes-2-3-hook-listener-http-server.md]

### Technical Implementation Guidance

**Hook Script Pattern (from Architecture):**

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

**Claude Code Hook Configuration Format:**

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

[Source: _bmad-output/planning-artifacts/architecture.md#claude-code-hook-configuration]

### Hook Payload Schemas (from HookListenerService)

**StopHookPayload:**
```typescript
{
  session_id: string      // Claude Code session ID
  transcript_path: string // Path to transcript file
  cwd: string            // Working directory
  hook_event_name: 'Stop' // Always 'Stop'
}
```

**ToolUseHookPayload:**
```typescript
{
  session_id: string              // Claude Code session ID
  tool_name: string               // e.g., 'Edit', 'Bash', 'Read'
  tool_input: Record<string, any> // Tool-specific input
  hook_event_name: 'PostToolUse'  // Always 'PostToolUse'
}
```

[Source: src/main/services/hook-listener.service.ts:29-57]

### Code Patterns (Following Project Standards)

**File Locations:**
| File | Location | Purpose |
|------|----------|---------|
| task-completion.sh | `.claude/hooks/task-completion.sh` | Stop hook script |
| log-tool-use.sh | `.claude/hooks/log-tool-use.sh` | PostToolUse hook script |
| settings.json | `.claude/settings.json` | Claude Code configuration |

**Shell Script Best Practices:**
- Use `#!/bin/bash` shebang
- Use `$(cat)` to read stdin
- Use `2>/dev/null` to suppress errors
- Use `|| echo "default"` for fallbacks
- Use `|| true` for silent failure
- Use `-s` flag with curl for silent mode
- Use `-X POST` for HTTP method

### Project Structure Notes

**Existing .claude directory structure:**
```
.claude/
├── commands/          # BMAD commands (existing)
│   └── ...
├── hooks/             # MODIFIED: Add TinSu hook scripts
│   ├── task-completion.sh    # NEW: Stop hook
│   ├── log-tool-use.sh       # NEW: PostToolUse hook
│   └── ...                   # (existing AgentVibes hooks)
└── settings.json      # NEW: Hook configuration
```

**IMPORTANT:** The `.claude/hooks/` directory already contains AgentVibes hook scripts. DO NOT modify or remove existing scripts - only add the new TinSu-specific scripts.

[Source: Project file listing]

### References

- [Architecture: Claude Code Hook Configuration](/_bmad-output/planning-artifacts/architecture.md#claude-code-hook-configuration)
- [Architecture: AR6 & AR7](/_bmad-output/planning-artifacts/architecture.md#ar6-ar7)
- [Epics: Story 2.4](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-24-claude-code-hook-scripts)
- [Project Context: Task Execution Sandbox](/_bmad-output/planning-artifacts/project-context.md#task-execution-sandbox-patterns)
- [TES-2.3: Hook Listener HTTP Server](/_bmad-output/implementation-artifacts/tes-2-3-hook-listener-http-server.md)
- [HookListenerService Implementation](src/main/services/hook-listener.service.ts)

### Testing Notes

**Integration Test Approach:**

Tests should verify end-to-end integration between hook scripts and HookListenerService:

1. **Script Existence Tests:**
   - Verify files exist at expected paths
   - Verify files are executable (`chmod +x`)

2. **Script Behavior Tests:**
   - Start HookListenerService on test port
   - Echo JSON payload to script stdin
   - Verify HTTP request received by service
   - Verify correct endpoint hit with correct payload

3. **Silent Failure Tests:**
   - Do NOT start HookListenerService
   - Run script with payload
   - Verify script exits 0 (not error)

4. **Port Discovery Tests:**
   - Write test port to `/tmp/tinsu-hook-port`
   - Run script
   - Verify request goes to correct port
   - Clean up port file after test

**Test File Location:** Tests can be shell-based or integrated into existing Vitest test suite.

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Hook event delivery | 99%+ | Claude Code hook events successfully reach TinSu (NFR13) |
| Silent failure | Required | Scripts must exit 0 even if TinSu not running |
| Startup overhead | Minimal | Scripts should execute quickly (<100ms) |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With HookListenerService (TES-2.3):**
- Scripts POST to `/api/hooks/stop` and `/api/hooks/tool-use`
- Service validates payload with Zod schemas
- Service logs events for debugging

**With ActivityLogService (TES-2.6, TES-2.7):**
- HookListenerService.onStopHook will call logActivity() (future)
- HookListenerService.onToolUseHook will call logActivity() (future)

**With Session-Task Mapping (TES-1.7):**
- session_id in payload maps to task_id via task_sessions table
- This enables routing events to correct task

### Edge Cases to Handle

1. **Port file not exists:** Use fallback port 3847
2. **Port file empty:** Use fallback port 3847
3. **Invalid JSON from Claude Code:** Let HookListenerService return 400
4. **Network error (ECONNREFUSED):** Exit 0 silently
5. **Very large payload:** HookListenerService has 64KB limit
6. **Concurrent hook calls:** HTTP handles naturally
7. **Script called but TinSu not running:** Exit 0 (silent failure)

### Scope Notes

**In Scope (This Story):**
- Create task-completion.sh hook script
- Create log-tool-use.sh hook script
- Create/update .claude/settings.json
- Integration tests for scripts

**Out of Scope (Future Stories):**
- ActivityLogService integration (TES-2.6, TES-2.7)
- Session-to-task mapping lookup (TES-1.7 already done)
- AutomationService integration (TES-5.x)
- Hook script for other hook types (UserPromptSubmit, etc.)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debugging issues encountered.

### Completion Notes List

- Created task-completion.sh Stop hook script with bash shebang, stdin JSON reading, port discovery from `/tmp/tinsu-hook-port` (fallback 3847), curl POST to `/api/hooks/stop`, and silent failure via `|| true`
- Created log-tool-use.sh PostToolUse hook script with identical pattern but POST to `/api/hooks/tool-use`
- Added curl timeouts (--connect-timeout 2, --max-time 5) to prevent hook scripts from hanging
- Updated existing .claude/settings.json to add Stop and PostToolUse hook configurations while preserving existing SessionStart hook
- Created comprehensive test suite (29 tests) covering script existence, executability, content verification, silent failure, and HTTP integration
- All 55 hook-related tests pass (29 new + 26 existing HookListenerService tests)

**Code Review Fixes (2026-01-14):**
- Fixed .gitignore to allow TinSu hook scripts while keeping other .claude/ files ignored (was blocking version control of hook scripts)
- Added 2 new tests for empty port file edge case (total 31 tests now)

### File List

| File | Action |
|------|--------|
| .claude/hooks/task-completion.sh | CREATE |
| .claude/hooks/log-tool-use.sh | CREATE |
| .claude/settings.json | MODIFY |
| src/main/services/claude-hooks-scripts.test.ts | CREATE |
| .gitignore | MODIFY |

### Change Log

| Date | Change |
|------|--------|
| 2026-01-14 | Implemented TES-2.4: Created Claude Code hook scripts for Stop and PostToolUse events, updated settings.json, added integration tests |
| 2026-01-14 | Code Review: Fixed .gitignore to allow TinSu hooks, added empty port file edge case tests (31 tests total) |
