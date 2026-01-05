# Story 1.10: Terminal Dock Component

Status: done

## Story

As a founder,
I want an embedded terminal dock at the bottom of the app,
So that I can see real-time output from agents during planning and execution.

## Acceptance Criteria

1. **Given** the app shell layout, **When** the terminal dock is rendered, **Then** it appears at the bottom of the screen **And** it occupies 30-40% of viewport height by default

2. **Given** the terminal dock, **When** I click the collapse button, **Then** it collapses to 80px height showing only the header **And** I can expand it again by clicking

3. **Given** the terminal is expanded, **When** I drag the resize handle, **Then** I can adjust the height between 80px and 60% of viewport **And** the height preference persists across sessions

4. **Given** the terminal component, **When** it initializes with xterm.js, **Then** it uses the dark theme (background #0a0a0b) **And** font is monospace, 14px, with proper line height

5. **Given** output is streaming to the terminal, **When** high-frequency output occurs, **Then** the terminal handles it without dropping frames (NFR5) **And** scrollback buffer is limited to 10,000 lines

6. **Given** the terminal has content, **When** I select text, **Then** I can copy it to clipboard **And** right-click shows a context menu with Copy option

7. **Given** accessibility requirements, **When** I use keyboard navigation, **Then** I can focus the terminal with Tab **And** the terminal announces its role to screen readers

## Tasks / Subtasks

- [x] Task 1: Install xterm.js dependencies (AC: #4)
  - [x] 1.1: Add `xterm` to dependencies: `npm install xterm`
  - [x] 1.2: Add `@xterm/addon-fit` for auto-resize support
  - [x] 1.3: Add `@xterm/addon-web-links` for clickable links (optional) - SKIPPED: not needed initially
  - [x] 1.4: Import xterm CSS in renderer entry point

- [x] Task 2: Create tRPC PTY router for IPC (AC: #5)
  - [x] 2.1: Create `src/main/trpc/routers/pty.router.ts`
  - [x] 2.2: Add `spawn` procedure - spawns shell process, returns processId
  - [x] 2.3: Add `write` procedure - sends input to process
  - [x] 2.4: Add `kill` procedure - terminates process
  - [x] 2.5: Add `resize` procedure - resizes terminal dimensions
  - [x] 2.6: Add `onOutput` subscription - streams PTY output via tRPC subscription
  - [x] 2.7: Add `onExit` subscription - notifies when process exits
  - [x] 2.8: Register router in main router index

- [x] Task 3: Create TerminalDock component (AC: #1, #2, #3)
  - [x] 3.1: Create `src/renderer/src/components/terminal/TerminalDock.tsx`
  - [x] 3.2: Implement dock container with fixed positioning at bottom
  - [x] 3.3: Add collapse/expand toggle button in header
  - [x] 3.4: Implement resize handle with drag functionality
  - [x] 3.5: Set default height to 35vh (30-40% as per AC)
  - [x] 3.6: Constrain resize between 80px min and 60vh max
  - [x] 3.7: Persist height preference to localStorage

- [x] Task 4: Create XTerminal component (AC: #4, #5, #6, #7)
  - [x] 4.1: Create `src/renderer/src/components/terminal/XTerminal.tsx`
  - [x] 4.2: Initialize xterm.js Terminal instance in useEffect
  - [x] 4.3: Configure dark theme: background #0a0a0b, foreground #fafafa
  - [x] 4.4: Set font: 'Menlo, Monaco, Consolas, monospace', size 14px
  - [x] 4.5: Set scrollback limit to 10,000 lines
  - [x] 4.6: Attach FitAddon for auto-resize on container resize
  - [x] 4.7: Enable built-in text selection and copy support
  - [x] 4.8: Add ARIA role="log" for screen reader accessibility
  - [x] 4.9: Implement tabIndex for keyboard focus

- [x] Task 5: Connect XTerminal to PTY via tRPC (AC: #5)
  - [x] 5.1: Create `src/renderer/src/hooks/useTerminal.ts` hook
  - [x] 5.2: Subscribe to `pty.onOutput` and write to xterm
  - [x] 5.3: Subscribe to `pty.onExit` and display exit message
  - [x] 5.4: Handle terminal input → call `pty.write` mutation
  - [x] 5.5: Call `pty.resize` on terminal resize events
  - [x] 5.6: Clean up subscriptions on unmount

- [x] Task 6: Create terminal Zustand store (AC: #2)
  - [x] 6.1: Create `src/renderer/src/stores/terminal.store.ts`
  - [x] 6.2: Add state: isExpanded, height, activeProcessId
  - [x] 6.3: Add actions: setExpanded, setHeight, setActiveProcess
  - [x] 6.4: Initialize from localStorage if available

- [x] Task 7: Integrate with AppShell layout (AC: #1)
  - [x] 7.1: Import TerminalDock into AppShell
  - [x] 7.2: Position dock at bottom of main content area
  - [x] 7.3: Adjust main content padding to account for dock height
  - [x] 7.4: Handle dock collapse/expand affecting content area

- [x] Task 8: Write unit tests for components (AC: all)
  - [x] 8.1: Create `src/renderer/src/components/terminal/TerminalDock.test.tsx`
  - [x] 8.2: Test: dock renders at default height
  - [x] 8.3: Test: collapse button toggles dock height
  - [x] 8.4: Test: resize handle updates height within bounds
  - [x] 8.5: Test: height persists to localStorage
  - [x] 8.6: Create `src/renderer/src/components/terminal/XTerminal.test.tsx`
  - [x] 8.7: Test: xterm initializes with correct theme options
  - [x] 8.8: Test: terminal has accessible role and tabIndex
  - [x] 8.9: Create `src/main/trpc/routers/pty.router.test.ts`
  - [x] 8.10: Test: spawn procedure creates process and returns ID
  - [x] 8.11: Test: write procedure sends data to process
  - [x] 8.12: Test: kill procedure terminates process

## Dev Notes

### Architecture Compliance

**File Locations (per architecture.md):**

- tRPC Router: `src/main/trpc/routers/pty.router.ts`
- Components: `src/renderer/src/components/terminal/`
- Hook: `src/renderer/src/hooks/useTerminal.ts`
- Store: `src/renderer/src/stores/terminal.store.ts`
- Tests: Co-located with source files (`.test.tsx` pattern)

**Naming Conventions:**

- Components: `TerminalDock`, `XTerminal` (PascalCase)
- Hook: `useTerminal` (camelCase, use prefix)
- Store: `useTerminalStore` (use + Store suffix)
- tRPC procedures: `spawn`, `write`, `kill`, `resize`, `onOutput`, `onExit` (camelCase)
- Types: `TerminalState`, `PtyRouterInputs` (PascalCase, NO I prefix)

**Process Boundaries (CRITICAL):**

- xterm.js runs in renderer process (browser-based terminal emulator)
- PTY operations run in main process via pty.service.ts
- Communication ONLY via tRPC procedures - NEVER import node-pty in renderer
- Use tRPC subscriptions for real-time output streaming

### Technical Requirements

**xterm.js Installation:**

```bash
npm install xterm @xterm/addon-fit
```

**CSS Import (in renderer entry):**

```typescript
// In src/renderer/src/main.tsx
import 'xterm/css/xterm.css'
```

**tRPC PTY Router Design:**

```typescript
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { observable } from '@trpc/server/observable'
import { ptyService, PtyOutputEvent, PtyExitEvent } from '../../services/pty.service'

export const ptyRouter = router({
  spawn: publicProcedure
    .input(
      z.object({
        command: z.string().optional().default('/bin/bash'),
        args: z.array(z.string()).optional().default([]),
        cwd: z.string().optional()
      })
    )
    .mutation(({ input }) => {
      return ptyService.spawn(input.command, input.args, { cwd: input.cwd })
    }),

  write: publicProcedure
    .input(
      z.object({
        processId: z.string(),
        data: z.string()
      })
    )
    .mutation(({ input }) => {
      ptyService.write(input.processId, input.data)
    }),

  kill: publicProcedure.input(z.object({ processId: z.string() })).mutation(({ input }) => {
    ptyService.kill(input.processId)
  }),

  resize: publicProcedure
    .input(
      z.object({
        processId: z.string(),
        cols: z.number().int().positive(),
        rows: z.number().int().positive()
      })
    )
    .mutation(({ input }) => {
      ptyService.resize(input.processId, input.cols, input.rows)
    }),

  onOutput: publicProcedure.input(z.object({ processId: z.string() })).subscription(({ input }) => {
    return observable<PtyOutputEvent>((emit) => {
      const handler = (event: PtyOutputEvent) => {
        if (event.processId === input.processId) {
          emit.next(event)
        }
      }
      ptyService.on('output', handler)
      return () => ptyService.off('output', handler)
    })
  }),

  onExit: publicProcedure.input(z.object({ processId: z.string() })).subscription(({ input }) => {
    return observable<PtyExitEvent>((emit) => {
      const handler = (event: PtyExitEvent) => {
        if (event.processId === input.processId) {
          emit.next(event)
        }
      }
      ptyService.on('exit', handler)
      return () => ptyService.off('exit', handler)
    })
  })
})
```

**XTerminal Component Pattern:**

```typescript
import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

interface XTerminalProps {
  processId: string | null
  onData?: (data: string) => void
}

export function XTerminal({ processId, onData }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#0a0a0b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#0a0a0b',
        selectionBackground: '#3f3f46'
      },
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 10000,
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    // Handle user input
    terminal.onData((data) => {
      onData?.(data)
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Resize on container resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
    }
  }, [onData])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      role="log"
      aria-label="Terminal output"
      tabIndex={0}
    />
  )
}
```

**TerminalDock Component Pattern:**

```typescript
import { useState, useCallback } from 'react'
import { XTerminal } from './XTerminal'
import { ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTerminalStore } from '@renderer/stores/terminal.store'

const MIN_HEIGHT = 80
const MAX_HEIGHT_VH = 60
const DEFAULT_HEIGHT_VH = 35

export function TerminalDock() {
  const { isExpanded, height, setExpanded, setHeight } = useTerminalStore()
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startY = e.clientY
    const startHeight = height

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(window.innerHeight * (MAX_HEIGHT_VH / 100), startHeight + delta)
      )
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [height, setHeight])

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800',
        'flex flex-col transition-height duration-200'
      )}
      style={{ height: isExpanded ? height : MIN_HEIGHT }}
    >
      {/* Resize handle */}
      {isExpanded && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-zinc-600"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-800">
        <span className="text-sm text-zinc-400 font-medium">Terminal</span>
        <button
          onClick={() => setExpanded(!isExpanded)}
          className="p-1 rounded hover:bg-zinc-800"
          aria-label={isExpanded ? 'Collapse terminal' : 'Expand terminal'}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* Terminal content */}
      {isExpanded && (
        <div className="flex-1 p-2 overflow-hidden">
          <XTerminal processId={null} />
        </div>
      )}
    </div>
  )
}
```

**Terminal Store Pattern:**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_HEIGHT = window.innerHeight * 0.35 // 35vh

interface TerminalState {
  isExpanded: boolean
  height: number
  activeProcessId: string | null

  setExpanded: (expanded: boolean) => void
  setHeight: (height: number) => void
  setActiveProcess: (processId: string | null) => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      isExpanded: true,
      height: DEFAULT_HEIGHT,
      activeProcessId: null,

      setExpanded: (isExpanded) => set({ isExpanded }),
      setHeight: (height) => set({ height }),
      setActiveProcess: (activeProcessId) => set({ activeProcessId })
    }),
    {
      name: 'terminal-storage',
      partialize: (state) => ({ height: state.height, isExpanded: state.isExpanded })
    }
  )
)
```

### Previous Story Intelligence

**From Story 1.9 (PTY Service):**

- PtyService singleton pattern established at `src/main/services/pty.service.ts`
- EventEmitter-based events: 'output', 'exit', 'error' with typed interfaces
- Methods available: `spawn`, `write`, `kill`, `pause`, `resume`, `resize`, `killAll`
- Process IDs are UUIDs via `randomUUID()`
- Error class `PtyError` with codes: NOT_FOUND, INVALID_STATE, SPAWN_ERROR, KILLED
- Service exported as singleton: `export const ptyService = new PtyService()`

**Key Integration Points:**

- Subscribe to `ptyService.on('output', handler)` for output events
- Subscribe to `ptyService.on('exit', handler)` for exit events
- Use tRPC subscriptions to bridge events to renderer

**Testing Patterns from 1.9:**

- Use simple commands like `echo`, `cat` for tests
- Clean up processes in `afterEach` with `killAll()`
- Use timeouts (100ms typical) for async event assertions

### Library/Framework Requirements

**xterm.js:**

- Industry-standard terminal emulator (used by VS Code)
- Latest stable version
- Addons needed:
  - `@xterm/addon-fit` - Auto-resize terminal to container
  - `@xterm/addon-web-links` (optional) - Clickable URLs

**Installation:**

```bash
npm install xterm @xterm/addon-fit
```

**Theme Colors (matching app dark theme):**

| Element    | Color   |
| ---------- | ------- |
| Background | #0a0a0b |
| Foreground | #fafafa |
| Cursor     | #fafafa |
| Selection  | #3f3f46 |

**tRPC Subscriptions:**

- Use `observable` from `@trpc/server/observable`
- Pattern: observable → emit.next(data) on event
- Cleanup: return unsubscribe function

### Project Structure Notes

**Terminal component location:**

```
src/renderer/src/components/terminal/
├── TerminalDock.tsx
├── TerminalDock.test.tsx
├── XTerminal.tsx
└── XTerminal.test.tsx
```

**tRPC router registration:**

Add to `src/main/trpc/routers/index.ts`:

```typescript
import { ptyRouter } from './pty.router'

export const appRouter = router({
  task: taskRouter,
  project: projectRouter,
  pty: ptyRouter // Add this
})
```

### Testing Strategy

**Component Tests (Renderer):**

- Mock tRPC client for subscription tests
- Use `@testing-library/react` for DOM interactions
- Mock xterm.js Terminal class

**Router Tests (Main Process):**

- Use real PtyService with simple shell commands
- Test procedure inputs/outputs
- Clean up processes after each test

**Integration Considerations:**

- Terminal tests may be flaky due to timing
- Use `vi.useFakeTimers()` where appropriate
- Test resize within bounds validation

### Error Handling

| Scenario           | Layer       | Handling                                   |
| ------------------ | ----------- | ------------------------------------------ |
| PTY spawn fails    | pty.router  | Throw TRPCError with INTERNAL_SERVER_ERROR |
| Process not found  | pty.router  | Throw TRPCError with NOT_FOUND             |
| xterm init fails   | XTerminal   | Display error message in container         |
| Subscription error | useTerminal | Log error, show toast notification         |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.10]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md#Electron Process Boundaries]
- [Source: _bmad-output/implementation-artifacts/1-9-pty-service-for-process-management.md]
- [xterm.js documentation](https://xtermjs.org/)
- [tRPC subscriptions](https://trpc.io/docs/subscriptions)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Used @xterm/xterm instead of deprecated xterm package
- Used vi.hoisted() for vitest mocks to handle module hoisting

### Completion Notes List

- All 8 tasks completed successfully
- 250 tests pass (including 73 new tests for terminal components)
- xterm.js v5 (@xterm/xterm + @xterm/addon-fit) installed
- PTY router with spawn/write/kill/resize mutations + onOutput/onExit subscriptions
- TerminalDock with resizable, collapsible UI
- XTerminal with dark theme, accessibility attributes, ref API, context menu with Copy
- useTerminal hook for PTY-terminal connection with error handling
- terminal.store.ts with zustand persist middleware
- AppShell integration with dynamic padding based on dock height

### Senior Developer Review (AI)

**Reviewed by:** Claude Opus 4.5 on 2026-01-04
**Outcome:** APPROVED (after fixes applied)

**Issues Found and Fixed:**

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| HIGH-1 | 🔴 | AC6 context menu NOT implemented | ✅ Added context menu with Copy option to XTerminal |
| HIGH-2 | 🔴 | useTerminal cleanup bug - stale closure causing process leaks | ✅ Fixed using ref to track current processId |
| MEDIUM-1 | 🟡 | No useTerminal hook tests | ✅ Created useTerminal.test.ts (15 tests) |
| MEDIUM-2 | 🟡 | package-lock.json not in File List | ✅ Added to File List |
| MEDIUM-3 | 🟡 | No error handling in useTerminal mutations | ✅ Added onError callbacks with terminal output |
| LOW-1 | 🟢 | Test count inconsistency | Corrected in completion notes |
| LOW-2 | 🟢 | Magic timeout number | Documented, acceptable |
| LOW-3 | 🟢 | Console.log in prod code | Acceptable for terminal debugging |

**AC Verification:**
- ✅ AC1: Terminal dock at bottom, 35vh default height (within 30-40%)
- ✅ AC2: Collapse button toggles to 80px
- ✅ AC3: Resize handle with drag, 80px-60vh, persists via localStorage
- ✅ AC4: xterm.js with dark theme #0a0a0b, 14px monospace
- ✅ AC5: 10,000 line scrollback, high-frequency output handled by xterm
- ✅ AC6: Text selection + right-click context menu with Copy option (FIXED)
- ✅ AC7: tabIndex=0, role="log", aria-label for accessibility

### File List

**Created:**
- src/main/trpc/routers/pty.router.ts - tRPC router for PTY operations
- src/main/trpc/routers/pty.router.test.ts - Router unit tests (12 tests)
- src/renderer/src/components/terminal/TerminalDock.tsx - Dock container component
- src/renderer/src/components/terminal/TerminalDock.test.tsx - Dock tests (16 tests)
- src/renderer/src/components/terminal/XTerminal.tsx - xterm.js wrapper component with context menu
- src/renderer/src/components/terminal/XTerminal.test.tsx - XTerminal tests (26 tests, includes context menu)
- src/renderer/src/components/terminal/index.ts - Barrel exports
- src/renderer/src/hooks/useTerminal.ts - PTY connection hook with error handling
- src/renderer/src/hooks/useTerminal.test.ts - Hook tests (15 tests) [REVIEW FIX]
- src/renderer/src/stores/terminal.store.ts - Terminal state management
- src/renderer/src/stores/terminal.store.test.ts - Store tests (15 tests)

**Modified:**
- src/main/trpc/index.ts - Added pty router registration
- src/renderer/src/main.tsx - Added xterm CSS import
- src/renderer/src/stores/index.ts - Export terminal store
- src/renderer/src/components/layout/AppShell.tsx - Integrated TerminalDock
- src/renderer/src/components/layout/AppShell.test.tsx - Added terminal tests
- package.json - Added @xterm/xterm and @xterm/addon-fit dependencies
- package-lock.json - Dependency lock file updated
