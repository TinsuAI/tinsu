# Story TES-1.1: tmux Dependency Check & Installation Prompt

Status: done

---

## Story

As a user,
I want TinSu to check for tmux on startup and guide me to install it if missing,
So that I can use the terminal features without cryptic errors.

## Acceptance Criteria

1. **Given** TinSu is starting up, **When** the app initializes, **Then** it checks if tmux is installed by running `tmux -V`, **And** if tmux is found, startup continues normally

2. **Given** tmux is not installed on the system, **When** TinSu starts up, **Then** an error dialog displays with the message "tmux Required", **And** the dialog includes install instructions for macOS (`brew install tmux`) and Linux (`apt install tmux`), **And** the app does not proceed until the user acknowledges

3. **Given** tmux version check fails due to another error (not missing), **When** the error is caught, **Then** the app logs the error details and shows appropriate message

4. **Given** tmux is installed and version is returned, **When** startup continues, **Then** the tmux version is logged for debugging purposes

## Tasks / Subtasks

- [x] Task 1: Create TmuxService class in main process (AC: #1, #2, #3, #4)
  - [x] 1.1: Create `src/main/services/tmux.service.ts` file
  - [x] 1.2: Implement `checkTmuxInstalled()` method using `child_process.exec`
  - [x] 1.3: Implement `getTmuxVersion()` method that parses `tmux -V` output
  - [x] 1.4: Export service instance for use in main process

- [x] Task 2: Integrate tmux check into app startup (AC: #1, #2)
  - [x] 2.1: Add tmux check to `src/main/index.ts` after app ready
  - [x] 2.2: Use Electron `dialog.showErrorBox()` for missing tmux
  - [x] 2.3: Include platform-specific install instructions in dialog message
  - [x] 2.4: Call `app.quit()` after user acknowledges if tmux missing

- [x] Task 3: Add logging and error handling (AC: #3, #4)
  - [x] 3.1: Use console.log for tmux version logging (aligned with existing logging patterns)
  - [x] 3.2: Handle edge cases (tmux exists but returns error, permission issues)
  - [x] 3.3: Ensure graceful degradation with informative messages

- [x] Task 4: Write unit tests for TmuxService (AC: #1, #2, #3)
  - [x] 4.1: Create `src/main/services/tmux.service.test.ts`
  - [x] 4.2: Test successful tmux detection scenario
  - [x] 4.3: Test missing tmux scenario (mock exec failure)
  - [x] 4.4: Test version parsing

## Dev Notes

### Architecture Compliance

This story establishes the foundational dependency check for the Task Execution Sandbox feature. The tmux dependency is **CRITICAL** because:

- **Per-task terminal sessions** rely on tmux for persistence across navigation and app restarts
- **Command sending** (`tmux send-keys`) enables automation triggers
- **Scrollback capture** (`tmux capture-pane`) enables terminal history backup

[Source: _bmad-output/planning-artifacts/architecture.md#Task-Execution-Sandbox-Architecture]

### Technical Requirements

**Service Location:** `src/main/services/tmux.service.ts`
- Services live in `src/main/services/` directory per architecture
- Main process only (Node.js APIs like `child_process` required)
- NEVER import in renderer process

**tmux Commands Used (for reference):**
```bash
# Check version
tmux -V                    # Returns "tmux X.Y" or error if not installed

# Future commands (not for this story, but context):
tmux new-session -d -s {name}    # Create detached session
tmux send-keys -t {name} "cmd"   # Send command to session
tmux attach-session -t {name}    # Attach to session
```

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#Technical-Architecture]

### Platform-Specific Install Instructions

| Platform | Install Command | Notes |
|----------|-----------------|-------|
| macOS | `brew install tmux` | Assumes Homebrew installed |
| Linux (Debian/Ubuntu) | `sudo apt install tmux` | Most common |
| Linux (Fedora/RHEL) | `sudo dnf install tmux` | Alternative |

### Error Dialog Message Format

```
Title: tmux Required

Body:
TinSu requires tmux for per-task terminal sessions.

Please install tmux:

macOS:
  brew install tmux

Linux (Debian/Ubuntu):
  sudo apt install tmux

Linux (Fedora/RHEL):
  sudo dnf install tmux

After installing, restart TinSu.
```

### Electron Dialog API

```typescript
import { dialog, app } from 'electron'

// Use synchronous dialog (blocks until user responds)
dialog.showErrorBox('tmux Required', message)
app.quit()
```

**Note:** Use `showErrorBox` (synchronous) rather than `showMessageBox` (async) because we need to block startup and quit immediately.

### Project Structure Notes

- Aligned with unified project structure per architecture.md
- Service follows existing pattern from `pty.service.ts` and `git.service.ts`
- No conflicts with existing services

### File Locations

| File | Purpose |
|------|---------|
| `src/main/services/tmux.service.ts` | NEW - tmux operations service |
| `src/main/services/tmux.service.test.ts` | NEW - unit tests |
| `src/main/index.ts` | MODIFIED - add startup check |

### References

- [Architecture: Task Execution Sandbox](../_bmad-output/planning-artifacts/architecture.md#task-execution-sandbox-architecture-feature-extension)
- [PRD: Technical Architecture](../_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#technical-architecture)
- [Epics: Story 1.1](../_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-11-tmux-dependency-check--installation-prompt)
- [Project Context](../_bmad-output/planning-artifacts/project-context.md#tmux-session-pattern)

### Code Patterns to Follow

**Naming Conventions:**
- Service: `TmuxService` (PascalCase class)
- Methods: `checkTmuxInstalled()`, `getTmuxVersion()` (camelCase)
- File: `tmux.service.ts` (kebab-case with suffix)
- Test: `tmux.service.test.ts` (co-located)

**Error Handling:**
```typescript
// In services, throw descriptive errors
throw new Error(`tmux not found: ${stderr}`)

// Let calling code (main/index.ts) handle user notification
```

**Async Pattern:**
```typescript
// Use promisified exec
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function checkTmuxInstalled(): Promise<boolean> {
  try {
    await execAsync('tmux -V')
    return true
  } catch {
    return false
  }
}
```

### Testing Notes

Run tests with:
```bash
npm test -- --filter tmux
```

Remember native module rebuild:
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Created TmuxService class with checkTmuxInstalled(), getTmuxVersion(), clearCache(), and getInstallInstructions() methods
- Service uses promisified child_process.exec for async tmux -V execution
- Results are cached to avoid repeated shell calls
- Integrated tmux check into app startup in src/main/index.ts - checks tmux before database init
- On missing tmux: shows error dialog with platform-specific install instructions (macOS, Debian/Ubuntu, Fedora/RHEL), then quits
- On check error: shows error dialog with error details
- On success: logs tmux version and continues startup
- All 11 unit tests pass covering: successful detection, missing tmux detection, version parsing, caching behavior, cache clearing, and install instructions

### File List

**New Files:**
- `src/main/services/tmux.service.ts` - TmuxService class implementation
- `src/main/services/tmux.service.test.ts` - Unit tests (11 tests)

**Modified Files:**
- `src/main/services/index.ts` - Added TmuxService export
- `src/main/index.ts` - Added tmux dependency check on startup

### Change Log

- 2026-01-13: Implemented tmux dependency check feature (TES-1.1)
- 2026-01-13: Code review fixes applied (see Senior Developer Review below)

---

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-13
**Outcome:** ✅ APPROVED (with fixes applied)

### Issues Found & Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | H1: Missing distinction between "not found" and other errors in checkTmuxInstalled | Fixed: Now returns false only for exit code 127, throws for other errors (AC#3 compliance) |
| MEDIUM | M2: Silent failure mode - all errors treated as "not installed" | Fixed: Same as H1 |
| MEDIUM | M3: No timeout for tmux command - could hang forever | Fixed: Added 5-second timeout to all execAsync calls |

### Fixes Applied

1. **tmux.service.ts**:
   - Added `TMUX_COMMAND_TIMEOUT = 5000` constant
   - Added `ExecError` interface for proper typing
   - `checkTmuxInstalled()` now returns `false` only for exit code 127 (command not found)
   - `checkTmuxInstalled()` now throws for other errors (permission denied, timeout, crash)
   - Both exec calls now include `{ timeout: TMUX_COMMAND_TIMEOUT }`
   - Updated JSDoc to document throwing behavior

2. **tmux.service.test.ts**:
   - Added new test: "throws error for non-installation failures"
   - Updated all mocks to handle `(cmd, options, callback)` signature
   - Test count: 11 → 12 tests (all passing)

### Verification

- All 12 unit tests pass ✅
- All 4 Acceptance Criteria verified ✅
- All Tasks verified as complete ✅
- No lint errors in changed files ✅
- Git changes match File List ✅
