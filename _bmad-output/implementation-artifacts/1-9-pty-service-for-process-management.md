# Story 1.9: PTY Service for Process Management

Status: done

## Story

As a developer,
I want a PTY service that wraps node-pty for process management,
So that both planning agents and story execution can spawn and control CLI processes.

## Acceptance Criteria

1. **Given** the main process, **When** I create a PtyService instance, **Then** it can spawn a new PTY process with a given command and args **And** it returns a process ID for tracking

2. **Given** a running PTY process, **When** I call write(processId, data), **Then** the data is sent to the process stdin **And** special characters are handled correctly

3. **Given** a running PTY process, **When** I call kill(processId), **Then** the process receives SIGTERM **And** the process ID is cleaned up after exit

4. **Given** a running PTY process, **When** the process emits output, **Then** the PtyService emits an 'output' event with processId and data **And** output events fire within 100ms of process output

5. **Given** PTY operations on macOS or Linux, **When** I spawn a process, **Then** it works correctly on both platforms (NFR19) **And** shell environment variables are inherited

6. **Given** a process that crashes, **When** the crash occurs, **Then** the PtyService emits an 'exit' event with code and signal **And** no zombie processes remain

## Tasks / Subtasks

- [x] Task 1: Install node-pty dependency (AC: #5)
  - [x] 1.1: Add `node-pty` to dependencies: `npm install node-pty`
  - [x] 1.2: Add `@types/node-pty` to devDependencies if needed (not needed - built-in types)
  - [x] 1.3: Update electron-rebuild to include node-pty: modify postinstall script
  - [x] 1.4: Verify native module builds for Electron (run `npm run rebuild:electron`)

- [x] Task 2: Create PtyService with process spawning (AC: #1, #5)
  - [x] 2.1: Create `src/main/services/pty.service.ts`
  - [x] 2.2: Define `PtyProcess` interface with id, pty instance, process info
  - [x] 2.3: Implement `spawn(command, args, options)` - creates PTY with unique ID
  - [x] 2.4: Store active processes in Map<processId, PtyProcess>
  - [x] 2.5: Inherit shell environment variables via `process.env`
  - [x] 2.6: Support custom working directory option
  - [x] 2.7: Generate unique process IDs (uuid or nanoid pattern)

- [x] Task 3: Implement process input/output handling (AC: #2, #4)
  - [x] 3.1: Implement `write(processId, data)` - sends data to process stdin
  - [x] 3.2: Handle special characters (Ctrl+C as `\x03`, Ctrl+D as `\x04`, etc.)
  - [x] 3.3: Subscribe to PTY `onData` events and emit via EventEmitter
  - [x] 3.4: Define event types: 'output', 'exit', 'error'
  - [x] 3.5: Include processId in all emitted events
  - [x] 3.6: Ensure output events fire within 100ms (no batching/debouncing)

- [x] Task 4: Implement process lifecycle management (AC: #3, #6)
  - [x] 4.1: Implement `kill(processId)` - sends SIGTERM to process
  - [x] 4.2: Subscribe to PTY `onExit` events
  - [x] 4.3: Clean up process from Map on exit
  - [x] 4.4: Emit 'exit' event with exitCode and signal
  - [x] 4.5: Implement `killAll()` for cleanup on app shutdown
  - [x] 4.6: Handle process crashes gracefully - no zombie processes

- [x] Task 5: Add pause/resume support (AC: foundation for FR14, FR15)
  - [x] 5.1: Implement `pause(processId)` - sends SIGSTOP signal
  - [x] 5.2: Implement `resume(processId)` - sends SIGCONT signal
  - [x] 5.3: Track process state (running, paused, killed)
  - [x] 5.4: Prevent operations on invalid process states

- [x] Task 6: Write unit tests for PtyService (AC: all)
  - [x] 6.1: Create `src/main/services/pty.service.test.ts`
  - [x] 6.2: Test: `spawn()` returns unique process ID
  - [x] 6.3: Test: `write()` sends data to process (use echo command)
  - [x] 6.4: Test: `kill()` terminates process
  - [x] 6.5: Test: 'output' events are emitted correctly
  - [x] 6.6: Test: 'exit' events include code and signal
  - [x] 6.7: Test: Environment variables are inherited
  - [x] 6.8: Test: Working directory is respected
  - [x] 6.9: Test: Multiple concurrent processes work independently
  - [x] 6.10: Test: `pause()` and `resume()` signals work (Linux/macOS)

- [x] Task 7: Integration with main process (AC: #1)
  - [x] 7.1: Export PtyService as singleton from services index
  - [x] 7.2: Clean up processes on app `before-quit` event
  - [x] 7.3: Add error logging for unexpected process failures

## Dev Notes

### Architecture Compliance

**File Locations (per architecture.md):**

- Service: `src/main/services/pty.service.ts`
- Tests: `src/main/services/pty.service.test.ts`

**Naming Conventions:**

- Service class: `PtyService` (PascalCase)
- Methods: `spawn`, `write`, `kill`, `pause`, `resume` (camelCase, verb prefix)
- Events: `pty:data`, `pty:exit`, `pty:error` (per architecture IPC event naming)
- Types: `PtyProcess`, `PtySpawnOptions`, `PtyExitEvent` (PascalCase, no I prefix)

**Process Boundaries (CRITICAL):**

- PTY operations MUST run in main process only (Node.js APIs)
- NEVER import node-pty in renderer process
- Future stories will expose PTY via tRPC subscriptions

### Technical Requirements

**node-pty Installation:**

```bash
npm install node-pty
```

After installation, ensure the native module builds for Electron:

```bash
npm run rebuild:electron
```

**Update package.json postinstall if needed:**

```json
"postinstall": "electron-builder install-app-deps && electron-rebuild -f -w better-sqlite3 -w node-pty"
```

**PtyService API Design:**

```typescript
import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

export interface PtySpawnOptions {
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PtyProcess {
  id: string
  pty: pty.IPty
  command: string
  args: string[]
  cwd: string
  state: 'running' | 'paused' | 'killed'
}

export interface PtyOutputEvent {
  processId: string
  data: string
}

export interface PtyExitEvent {
  processId: string
  exitCode: number
  signal?: number
}

export class PtyService extends EventEmitter {
  private processes: Map<string, PtyProcess> = new Map()

  spawn(command: string, args: string[] = [], options: PtySpawnOptions = {}): string {
    const id = randomUUID()
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'

    // Spawn PTY process
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    })

    // Subscribe to events
    ptyProcess.onData((data) => {
      this.emit('output', { processId: id, data })
    })

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', { processId: id, exitCode, signal })
      this.processes.delete(id)
    })

    // Store process
    this.processes.set(id, {
      id,
      pty: ptyProcess,
      command,
      args,
      cwd: options.cwd || process.cwd(),
      state: 'running'
    })

    return id
  }

  write(processId: string, data: string): void {
    const proc = this.processes.get(processId)
    if (!proc) throw new Error(`Process ${processId} not found`)
    if (proc.state !== 'running') throw new Error(`Process ${processId} is ${proc.state}`)
    proc.pty.write(data)
  }

  kill(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) return
    proc.state = 'killed'
    proc.pty.kill()
  }

  pause(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) throw new Error(`Process ${processId} not found`)
    if (proc.state !== 'running') return
    process.kill(proc.pty.pid, 'SIGSTOP')
    proc.state = 'paused'
  }

  resume(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) throw new Error(`Process ${processId} not found`)
    if (proc.state !== 'paused') return
    process.kill(proc.pty.pid, 'SIGCONT')
    proc.state = 'running'
  }

  killAll(): void {
    for (const proc of this.processes.values()) {
      proc.pty.kill()
    }
    this.processes.clear()
  }

  getProcess(processId: string): PtyProcess | undefined {
    return this.processes.get(processId)
  }

  getActiveProcesses(): string[] {
    return Array.from(this.processes.keys())
  }
}

// Singleton export
export const ptyService = new PtyService()
```

### Previous Story Intelligence

**From Story 1.8 (Project Initialization):**

- `ProjectService` singleton pattern - use similar pattern for PtyService
- Static methods with singleton state pattern established
- Error class pattern (`ProjectError`) - create `PtyError` similarly

**From architecture.md Service Patterns:**

- Services are in `src/main/services/`
- Use EventEmitter for async event handling
- Co-locate tests with source files

**Code Patterns from Existing Services:**

```typescript
// Error pattern from project.service.ts
export class PtyError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID_STATE' | 'SPAWN_ERROR' | 'KILLED',
    public readonly details?: string
  ) {
    super(message)
    this.name = 'PtyError'
  }
}
```

### Special Characters Reference

```typescript
// Control characters for terminal input
const CONTROL_CHARS = {
  CTRL_C: '\x03',    // Interrupt (SIGINT)
  CTRL_D: '\x04',    // EOF
  CTRL_Z: '\x1a',    // Suspend (SIGTSTP)
  CTRL_L: '\x0c',    // Clear screen
  ENTER: '\r',       // Carriage return
  BACKSPACE: '\x7f', // Delete char
}
```

### Platform Considerations

**macOS/Linux:**

- Use `process.env.SHELL` or fall back to `/bin/bash`
- SIGSTOP/SIGCONT work for pause/resume
- Environment variables inherited automatically

**Windows (future - not required for MVP):**

- Use `powershell.exe` or `cmd.exe`
- ConPTY for terminal emulation
- Different signal handling (CTRL_C_EVENT)

### Testing Strategy

**Unit Tests:**

Since node-pty spawns real processes, tests should:

1. Use simple commands like `echo`, `cat`, `sleep`
2. Use short timeouts to avoid slow tests
3. Clean up processes in `afterEach`
4. Skip platform-specific tests on Windows

```typescript
// Example test
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PtyService } from './pty.service'

describe('PtyService', () => {
  let service: PtyService

  beforeEach(() => {
    service = new PtyService()
  })

  afterEach(() => {
    service.killAll()
  })

  it('spawns process and returns unique ID', () => {
    const id = service.spawn('echo', ['hello'])
    expect(id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    expect(service.getProcess(id)).toBeDefined()
  })

  it('emits output events', async () => {
    const outputs: string[] = []
    service.on('output', ({ data }) => outputs.push(data))

    service.spawn('echo', ['hello'])

    // Wait for output
    await new Promise(r => setTimeout(r, 100))
    expect(outputs.join('')).toContain('hello')
  })

  it('emits exit event with code', async () => {
    const exitPromise = new Promise<{ exitCode: number }>(resolve => {
      service.on('exit', resolve)
    })

    service.spawn('true') // Exit code 0

    const exit = await exitPromise
    expect(exit.exitCode).toBe(0)
  })

  it('kills process on request', async () => {
    const id = service.spawn('sleep', ['10'])
    service.kill(id)

    // Wait for cleanup
    await new Promise(r => setTimeout(r, 100))
    expect(service.getProcess(id)).toBeUndefined()
  })
})
```

### Error Handling

| Scenario | Error Code | Action |
|----------|------------|--------|
| Process ID not found | `NOT_FOUND` | Throw PtyError |
| Write to paused process | `INVALID_STATE` | Throw PtyError |
| Spawn fails (command not found) | `SPAWN_ERROR` | Emit error event, throw |
| Kill already killed process | - | No-op (silent) |
| Process crashes | - | Emit exit event with signal |

### App Lifecycle Integration

```typescript
// In src/main/index.ts - add before-quit handler
import { ptyService } from './services/pty.service'

app.on('before-quit', () => {
  ptyService.killAll()
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9]
- [Source: _bmad-output/planning-artifacts/prd.md#FR7-FR16 (Agent Execution & Monitoring)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR19 (PTY platform support)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Services]
- [Source: _bmad-output/planning-artifacts/project-context.md#Electron Process Boundaries]
- [node-pty documentation](https://github.com/microsoft/node-pty)

### Library/Framework Requirements

**node-pty:**

- Microsoft's pseudo-terminal library
- Used by VS Code for integrated terminal
- Supports macOS, Linux, and Windows (ConPTY)
- Native module - requires rebuild for Electron
- Latest stable version recommended

**Installation:**

```bash
npm install node-pty
```

**Rebuild for Electron:**

```bash
npm run rebuild:electron
```

### Future Integration Points

This service will be consumed by:

- **Story 1.10:** Terminal Dock Component (connects xterm.js to PtyService via tRPC)
- **Epic 3:** BMAD Planning Workflow (spawns planning agents)
- **Epic 5:** Story Implementation Workflow (spawns Claude Code CLI)
- **Epic 6:** Agent Monitoring & Control (pause/resume, stall detection)

The service is intentionally designed without tRPC integration - that will be added in Story 1.10 via an `agent.router.ts` that exposes PTY operations.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - clean implementation

### Completion Notes List

- Installed node-pty v1.1.0 with built-in TypeScript types
- Updated package.json scripts for comma-separated module rebuild (postinstall, rebuild:electron, rebuild:node)
- Implemented PtyService with full API: spawn, write, kill, pause, resume, killAll, resize
- Added PtyError class with typed error codes (NOT_FOUND, INVALID_STATE, SPAWN_ERROR, KILLED)
- Implemented EventEmitter events: 'output', 'exit', 'error' with typed event interfaces
- Created comprehensive test suite with 46 tests covering all acceptance criteria
- Added before-quit handler for PTY process cleanup
- Added error logging for unexpected process failures
- Created services index barrel export

### Code Review Fixes Applied

- **[HIGH]** Fixed incorrect import path in services/index.ts (`../../../src/shared/` → `../../shared/`)
- **[MEDIUM]** Added try-catch for pause/resume SIGSTOP/SIGCONT signals to handle race conditions
- **[MEDIUM]** Added validation for resize() dimensions (must be positive integers)
- **[MEDIUM]** Improved Ctrl+C test with proper assertions verifying process termination
- **[MEDIUM]** Updated latency test threshold from 150ms to 100ms to match AC4 requirement
- Added 1 new test for resize() invalid dimensions validation

### File List

**New Files:**
- src/main/services/pty.service.ts (PtyService implementation)
- src/main/services/pty.service.test.ts (46 unit tests)
- src/main/services/index.ts (services barrel export)

**Modified Files:**
- package.json (added node-pty dependency, updated rebuild scripts)
- src/main/index.ts (added ptyService import, before-quit handler, error logging)
