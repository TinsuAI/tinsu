# Story TES-2.3: Hook Listener HTTP Server

Status: done

---

## Story

As a system,
I want an HTTP server to receive Claude Code hook events,
So that hook scripts can communicate with TinSu reliably.

## Acceptance Criteria

1. **Given** TinSu is starting up, **When** HookListenerService initializes, **Then** an HTTP server starts on a configurable port (default 3847), **And** the port is written to /tmp/tinsu-hook-port for hook scripts to read

2. **Given** the hook server is running, **When** a POST request arrives at /api/hooks/stop, **Then** the Stop hook payload is parsed and processed, **And** the response returns 200 OK

3. **Given** the hook server is running, **When** a POST request arrives at /api/hooks/tool-use, **Then** the PostToolUse payload is parsed and processed, **And** the response returns 200 OK

4. **Given** the hook server is running, **When** a GET request arrives at /api/hooks/health, **Then** the response returns 200 with { status: "ok" }

5. **Given** TinSu is shutting down, **When** the app exits, **Then** the HTTP server stops gracefully

## Tasks / Subtasks

- [x] Task 1: Create HookListenerService with HTTP server lifecycle (AC: #1, #5)
  - [x] 1.1: Create `src/main/services/hook-listener.service.ts`
  - [x] 1.2: Implement class with `start(port: number)` method that creates HTTP server
  - [x] 1.3: Use Node.js native `http` module (no Express - keep it simple)
  - [x] 1.4: Make port configurable via parameter with default 3847
  - [x] 1.5: Write port to `/tmp/tinsu-hook-port` after server starts
  - [x] 1.6: Implement `stop()` method for graceful HTTP server shutdown
  - [x] 1.7: Clean up `/tmp/tinsu-hook-port` file on stop
  - [x] 1.8: Add error handling for port already in use (EADDRINUSE)

- [x] Task 2: Implement POST /api/hooks/stop endpoint (AC: #2)
  - [x] 2.1: Add route handler for POST /api/hooks/stop
  - [x] 2.2: Parse JSON body from request stream
  - [x] 2.3: Define `StopHookPayload` interface matching Claude Code hook format
  - [x] 2.4: Call internal `onStopHook(payload)` handler method
  - [x] 2.5: Return 200 OK on success
  - [x] 2.6: Return 400 Bad Request on parse error
  - [x] 2.7: Log received payload for debugging

- [x] Task 3: Implement POST /api/hooks/tool-use endpoint (AC: #3)
  - [x] 3.1: Add route handler for POST /api/hooks/tool-use
  - [x] 3.2: Parse JSON body from request stream
  - [x] 3.3: Define `ToolUseHookPayload` interface matching Claude Code hook format
  - [x] 3.4: Call internal `onToolUseHook(payload)` handler method
  - [x] 3.5: Return 200 OK on success
  - [x] 3.6: Return 400 Bad Request on parse error
  - [x] 3.7: Log received payload for debugging

- [x] Task 4: Implement GET /api/hooks/health endpoint (AC: #4)
  - [x] 4.1: Add route handler for GET /api/hooks/health
  - [x] 4.2: Return 200 with JSON body `{ status: "ok" }`
  - [x] 4.3: Include additional info: uptime, port

- [x] Task 5: Integrate with app lifecycle (AC: #1, #5)
  - [x] 5.1: Export HookListenerService instance from services index
  - [x] 5.2: Initialize and start server in main/index.ts after app ready
  - [x] 5.3: Stop server on app 'before-quit' event
  - [x] 5.4: Add HookListenerService to tRPC context (for potential future procedures)

- [x] Task 6: Write comprehensive unit tests (AC: #1-#5)
  - [x] 6.1: Test server starts and listens on specified port
  - [x] 6.2: Test port file is written correctly
  - [x] 6.3: Test POST /api/hooks/stop parses payload and returns 200
  - [x] 6.4: Test POST /api/hooks/tool-use parses payload and returns 200
  - [x] 6.5: Test GET /api/hooks/health returns { status: "ok" }
  - [x] 6.6: Test stop() closes server gracefully
  - [x] 6.7: Test port file is cleaned up on stop
  - [x] 6.8: Test invalid JSON returns 400
  - [x] 6.9: Test 404 for unknown routes

## Dev Notes

### Architecture Compliance

This story implements **AR3** and **AR8** from the Task Execution Sandbox Architecture extension:

> AR3: New services: TaskTerminalService, **HookListenerService**, ActivityLogService, AutomationService, ScrollbackBackupService

> AR8: HTTP endpoints for hook IPC: `/api/hooks/stop`, `/api/hooks/tool-use`, `/api/hooks/health`

And supports **FR10-FR16** (Activity Logging) by providing the communication channel for Claude Code hooks.

[Source: _bmad-output/planning-artifacts/architecture.md#task-execution-sandbox-architecture-feature-extension]

### Previous Story Learnings (TES-2.2)

**From TES-2.2 (Activity Log Service):**
- ActivityLogService is now instance-based with DB persistence
- Service exports from `src/main/services/index.ts` include activityLogService instance
- Context pattern in `src/main/trpc/context.ts` injects services
- Service naming: `kebab-case.service.ts`
- Test file co-located: `hook-listener.service.test.ts`
- Uses TRPCError for known errors (though HTTP service uses HTTP status codes)

**Key Integration:**
- HookListenerService will call ActivityLogService.logActivity() in future stories (TES-2.4+)
- For this story, just log to console and define handler stubs

[Source: _bmad-output/implementation-artifacts/tes-2-2-activity-log-service-core.md]

### Technical Implementation Guidance

**HookListenerService Interface (from Architecture):**

```typescript
interface HookListenerService {
  // Lifecycle
  start(port: number): Promise<void>
  stop(): Promise<void>

  // Event handlers (internal)
  onStopHook(payload: StopHookPayload): Promise<void>
  onToolUseHook(payload: ToolUseHookPayload): Promise<void>
}

interface StopHookPayload {
  session_id: string
  transcript_path: string
  cwd: string
  hook_event_name: 'Stop'
}

interface ToolUseHookPayload {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  hook_event_name: 'PostToolUse'
}
```

[Source: _bmad-output/planning-artifacts/architecture.md#hooklistenerservice]

**HTTP Server Implementation Pattern:**

```typescript
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const PORT_FILE = '/tmp/tinsu-hook-port'

export class HookListenerService {
  private server: http.Server | null = null
  private port: number = 3847

  async start(port: number = 3847): Promise<void> {
    this.port = port

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res)
    })

    return new Promise((resolve, reject) => {
      this.server!.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`))
        } else {
          reject(err)
        }
      })

      this.server!.listen(port, () => {
        // Write port to temp file for hook scripts
        fs.writeFileSync(PORT_FILE, String(port))
        console.log(`[HookListener] Started on port ${port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          // Clean up port file
          if (fs.existsSync(PORT_FILE)) {
            fs.unlinkSync(PORT_FILE)
          }
          console.log('[HookListener] Stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { method, url } = req

    // Set CORS headers for local scripts
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Route handling
    if (method === 'GET' && url === '/api/hooks/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok', port: this.port }))
      return
    }

    if (method === 'POST' && url === '/api/hooks/stop') {
      try {
        const body = await this.parseBody(req)
        await this.onStopHook(body as StopHookPayload)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
      return
    }

    if (method === 'POST' && url === '/api/hooks/tool-use') {
      try {
        const body = await this.parseBody(req)
        await this.onToolUseHook(body as ToolUseHookPayload)
        res.writeHead(200)
        res.end(JSON.stringify({ received: true }))
      } catch (err) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
      return
    }

    // 404 for unknown routes
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }

  private parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let data = ''
      req.on('data', chunk => { data += chunk })
      req.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON'))
        }
      })
      req.on('error', reject)
    })
  }

  async onStopHook(payload: StopHookPayload): Promise<void> {
    console.log('[HookListener] Stop hook received:', payload)
    // TODO: TES-2.6 - Call ActivityLogService to log agent_complete event
    // TODO: TES-2.6 - Trigger AutomationService.onAgentComplete()
  }

  async onToolUseHook(payload: ToolUseHookPayload): Promise<void> {
    console.log('[HookListener] Tool use hook received:', payload)
    // TODO: TES-2.7 - Call ActivityLogService to log tool_used event
  }
}
```

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Service class | PascalCase | `HookListenerService` |
| Service file | kebab-case | `hook-listener.service.ts` |
| Test file | kebab-case | `hook-listener.service.test.ts` |
| Interface | PascalCase | `StopHookPayload` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Service Instantiation Pattern:**
```typescript
// src/main/services/index.ts
import { HookListenerService } from './hook-listener.service'

export const hookListenerService = new HookListenerService()
```

**App Lifecycle Integration:**
```typescript
// src/main/index.ts
import { hookListenerService } from './services'

app.on('ready', async () => {
  // ... existing initialization
  await hookListenerService.start(process.env.TINSU_HOOK_PORT ? parseInt(process.env.TINSU_HOOK_PORT) : 3847)
})

app.on('before-quit', async () => {
  await hookListenerService.stop()
})
```

### Project Structure Notes

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/hook-listener.service.ts` | CREATE | HTTP server for hook events |
| `src/main/services/hook-listener.service.test.ts` | CREATE | Unit tests for service |
| `src/main/services/index.ts` | MODIFY | Export hookListenerService instance |
| `src/main/index.ts` | MODIFY | Initialize and shutdown hook listener |
| `src/main/trpc/context.ts` | MODIFY | Add hookListenerService to context |

### References

- [Architecture: HookListenerService](/_bmad-output/planning-artifacts/architecture.md#hooklistenerservice)
- [Architecture: HTTP Endpoints](/_bmad-output/planning-artifacts/architecture.md#ar8-http-endpoints)
- [Epics: Story 2.3](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-23-hook-listener-http-server)
- [Project Context: Service Patterns](/_bmad-output/planning-artifacts/project-context.md)
- [TES-2.2: Activity Log Service](/_bmad-output/implementation-artifacts/tes-2-2-activity-log-service-core.md)

### Testing Notes

Run tests with:
```bash
npm test src/main/services/hook-listener.service.test.ts
```

Test scenarios:
1. **start():** Server listens on specified port
2. **start():** Port file written to /tmp/tinsu-hook-port
3. **start():** EADDRINUSE error handled gracefully
4. **POST /api/hooks/stop:** Parses payload and returns 200
5. **POST /api/hooks/stop:** Returns 400 on invalid JSON
6. **POST /api/hooks/tool-use:** Parses payload and returns 200
7. **POST /api/hooks/tool-use:** Returns 400 on invalid JSON
8. **GET /api/hooks/health:** Returns { status: "ok" }
9. **Unknown route:** Returns 404
10. **stop():** Server closes gracefully
11. **stop():** Port file cleaned up

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Hook event delivery | 99%+ | Claude Code hook events successfully reach TinSu (NFR13) |
| Activity event latency | <1s | Events appear in UI within 1 second (NFR1) |
| Graceful degradation | Required | If server fails, don't crash app (NFR16) |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With Claude Code Hook Scripts (TES-2.4):**
- Hook scripts POST to these endpoints
- Scripts read port from /tmp/tinsu-hook-port
- Silent failure if TinSu not running

**With ActivityLogService (TES-2.6, TES-2.7):**
- onStopHook will call logActivity() with agent_complete event
- onToolUseHook will call logActivity() with tool_used event
- These integrations are TODO stubs in this story

**With AutomationService (TES-5.2):**
- onStopHook will trigger workflow state transitions
- This integration is TODO stub in this story

### Edge Cases to Handle

1. **Port already in use:** Return clear error message, don't crash
2. **Port file permissions:** Handle gracefully if /tmp not writable
3. **Invalid JSON:** Return 400 with error message
4. **Empty body:** Treat as empty object or return 400
5. **Very large body:** Consider size limit (64KB reasonable)
6. **Concurrent requests:** HTTP server handles naturally
7. **Server not started:** stop() should be idempotent

### Scope Notes

**In Scope (This Story):**
- HTTP server lifecycle (start/stop)
- Three endpoints: stop, tool-use, health
- Port file management
- Payload parsing with error handling
- Console logging for debugging
- Unit tests

**Out of Scope (Future Stories):**
- ActivityLogService integration (TES-2.6, TES-2.7)
- Session-to-task mapping lookup (TES-2.5+)
- AutomationService integration (TES-5.x)
- Hook scripts themselves (TES-2.4)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - all tests passing.

### Completion Notes List

- Created HookListenerService implementing HTTP server for Claude Code hook events
- Server uses Node.js native http module (no Express) for simplicity
- Three endpoints implemented: /api/hooks/stop, /api/hooks/tool-use, /api/hooks/health
- Port discovery via /tmp/tinsu-hook-port file for hook scripts
- Configurable port via TINSU_HOOK_PORT environment variable (default: 3847)
- CORS support with preflight handling for local hook scripts
- Request body size limit of 64KB for security
- Graceful error handling: EADDRINUSE, invalid JSON, empty body
- Service integrated into app lifecycle (start on ready, stop on before-quit)
- Added to tRPC context for future procedure integration
- 25 unit tests all passing covering all acceptance criteria

### File List

| File | Action |
|------|--------|
| src/main/services/hook-listener.service.ts | CREATE |
| src/main/services/hook-listener.service.test.ts | CREATE |
| src/main/services/index.ts | MODIFY |
| src/main/index.ts | MODIFY |
| src/main/trpc/context.ts | MODIFY |
| _bmad-output/implementation-artifacts/sprint-status.yaml | MODIFY |

### Change Log

- 2026-01-14: Initial implementation of TES-2.3 Hook Listener HTTP Server
- 2026-01-14: Code review fixes applied:
  - Fixed race condition in stop() - port file now deleted after server closes
  - Added Zod validation for StopHookPayload and ToolUseHookPayload
  - Improved error handling to differentiate parse errors vs handler errors (400 vs 500)
  - Fixed promise leak on request abort by handling 'close' event
  - Added test for MAX_BODY_SIZE (64KB) limit enforcement
  - Improved flaky default port test
  - Total: 26 tests passing
