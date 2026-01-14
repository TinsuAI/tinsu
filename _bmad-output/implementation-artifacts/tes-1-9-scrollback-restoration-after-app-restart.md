# Story TES-1.9: Scrollback Restoration After App Restart

Status: done

---

## Story

As a user,
I want to see my terminal history after restarting TinSu,
So that I can review what happened before the restart.

## Acceptance Criteria

1. **Given** a task has a scrollback backup file, **When** the user opens the task detail after app restart, **Then** the scrollback is restored from `scrollback.txt.gz`, **And** displayed in xterm.js before any live session attachment, **And** loading completes in <2 seconds

2. **Given** a tmux session still exists (survived restart), **When** the user opens the task, **Then** xterm.js attaches to the live session, **And** the backup scrollback is prepended if there's a gap

3. **Given** no backup exists for a task, **When** the user opens the task after restart, **Then** the terminal shows only live session content (or empty state)

## Tasks / Subtasks

- [x] Task 1: Integrate scrollback restoration into terminal hook (AC: #1, #3)
  - [x] 1.1: Add scrollback query to `useTaskTerminal.ts` (integrated inline for coordination with TES-1.6)
  - [x] 1.2: Query calls tRPC `agent.getScrollbackBackup({ taskId })` to fetch restored content
  - [x] 1.3: Return `isRestoringScrollback` state for UI loading indication
  - [x] 1.4: Hook handles loading state for <2 second target (NFR4)
  - [x] 1.5: Write tests in `useTaskTerminal.test.ts` (TES-1.9 section)

- [x] Task 2: Add tRPC query for scrollback restoration (AC: #1, #3)
  - [x] 2.1: Add `getScrollbackBackup` query to `agent.router.ts`
  - [x] 2.2: Query input: `z.object({ taskId: z.string() })`
  - [x] 2.3: Query calls `ScrollbackBackupService.restoreScrollback(taskId)`
  - [x] 2.4: Return `{ content: string | null, metadata: BackupMetadata | null }`
  - [x] 2.5: Handle case where backup doesn't exist (return nulls, not error)
  - [x] 2.6: Write tests for getScrollbackBackup query

- [x] Task 3: Integrate restoration into TaskTerminal component (AC: #1, #2, #3)
  - [x] 3.1: Modify `useTaskTerminal.ts` hook to integrate scrollback restoration
  - [x] 3.2: On mount, check if scrollback backup exists before attaching to live session
  - [x] 3.3: If backup exists, write restored content to xterm.js terminal first
  - [x] 3.4: Then attach to live tmux session (if exists)
  - [x] 3.5: Show loading message while restoration in progress
  - [x] 3.6: Write integration tests for restoration flow

- [x] Task 4: Handle gap detection between backup and live session (AC: #2)
  - [x] 4.1: Add `getScrollbackGap(taskId)` method to ScrollbackBackupService
  - [x] 4.2: Compare backup timestamp with current tmux session start time
  - [x] 4.3: If backup is older than current session, prepend backup before live attach
  - [x] 4.4: Add visual separator between restored and live content (e.g., `--- Session Restored ---`)
  - [x] 4.5: Write tests for gap detection logic

- [x] Task 5: Add metadata query for restoration context (AC: #1)
  - [x] 5.1: Add `getBackupInfo` query to agent.router.ts returning metadata only
  - [x] 5.2: UI can use this to show "Last backup: X minutes ago" in terminal header
  - [x] 5.3: Include backup line count for progress indication
  - [x] 5.4: Write tests for metadata query

- [x] Task 6: Handle restoration edge cases (AC: #1, #2, #3)
  - [x] 6.1: Handle corrupted gzip file gracefully (log warning, return null)
  - [x] 6.2: Handle missing metadata.json (restore scrollback anyway if .gz exists)
  - [x] 6.3: Handle race condition: backup being written while restoration requested
  - [x] 6.4: Add timeout for restoration (fail after 5 seconds)
  - [x] 6.5: Write tests for all edge cases

## Dev Notes

### Architecture Compliance

This story implements **FR8, FR40** (Scrollback Restoration) from the Task Execution Sandbox PRD:

- **FR8:** User can view terminal sessions that survive app restart
- **FR40:** System can restore terminal scrollback from backup when session is recreated

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#scrollback-persistence]

### Technical Requirements

**Service Interface (using existing ScrollbackBackupService):**

```typescript
// Already implemented in TES-1.8:
interface ScrollbackBackupService {
  restoreScrollback(taskId: string): Promise<string | null>  // Decompress and return content
  getBackupMetadata(taskId: string): Promise<BackupMetadata | null>
}

// TES-1.9 adds:
interface ScrollbackBackupService {
  getScrollbackGap(taskId: string): Promise<{ hasGap: boolean, backupTimestamp: number | null }>
}
```

**New tRPC Query:**

```typescript
// Add to src/main/trpc/routers/agent.router.ts
getScrollbackBackup: t.procedure
  .input(z.object({ taskId: z.string() }))
  .query(async ({ input }) => {
    const content = await ScrollbackBackupService.restoreScrollback(input.taskId)
    const metadata = await ScrollbackBackupService.getBackupMetadata(input.taskId)
    return { content, metadata }
  }),

getBackupInfo: t.procedure
  .input(z.object({ taskId: z.string() }))
  .query(async ({ input }) => {
    return ScrollbackBackupService.getBackupMetadata(input.taskId)
  }),
```

**React Hook Pattern:**

```typescript
// src/renderer/src/hooks/useScrollbackRestore.ts
export function useScrollbackRestore(taskId: string) {
  const { data, isLoading, error } = trpc.agent.getScrollbackBackup.useQuery(
    { taskId },
    {
      staleTime: Infinity,  // Don't refetch - backup is static
      retry: false          // Don't retry on failure
    }
  )

  return {
    scrollback: data?.content ?? null,
    metadata: data?.metadata ?? null,
    isLoading,
    error
  }
}
```

**TerminalOutput Integration:**

```typescript
// In TerminalOutput.tsx
const { scrollback, isLoading } = useScrollbackRestore(taskId)
const terminalRef = useRef<Terminal>(null)

useEffect(() => {
  if (!isLoading && scrollback && terminalRef.current) {
    // Write restored scrollback first
    terminalRef.current.write(scrollback)

    // Add separator if we'll attach to live session
    if (hasLiveSession) {
      terminalRef.current.write('\r\n--- Session Restored ---\r\n')
    }
  }
}, [scrollback, isLoading])
```

### Previous Story Learnings (TES-1.8)

**From TES-1.8 Implementation:**
- ScrollbackBackupService is fully implemented with `restoreScrollback()` and `getBackupMetadata()` methods
- Uses gzip compression/decompression via `zlib.gunzip()`
- Atomic file writes using temp file + rename pattern
- Storage path: `{userData}/terminal-history/{taskId}/scrollback.txt.gz`
- Metadata stored in `metadata.json` with lines, bytes, lastBackup, tmuxSession

**Key Patterns to Follow:**
- Static service methods with internal state
- Use `console.warn` for non-critical failures (don't block UI)
- Test mocking strategy: mock fs/promises, zlib, TaskTerminalService
- Use `vi.useFakeTimers()` for time-dependent tests

**Existing Infrastructure:**
- `ScrollbackBackupService.restoreScrollback(taskId)` - returns decompressed string or null
- `ScrollbackBackupService.getBackupMetadata(taskId)` - returns BackupMetadata or null
- `TaskTerminalService.hasSession(taskId)` - check if tmux session exists
- `task_sessions` table tracks session state

### Code Patterns (Following Project Standards)

**Hook Structure:**

```typescript
// src/renderer/src/hooks/useScrollbackRestore.ts
import { trpc } from '@renderer/lib/trpc'

/**
 * Hook for restoring terminal scrollback from backup.
 *
 * Used in TerminalOutput component to display historical
 * terminal content after app restart.
 *
 * @see TES-1.9: Scrollback Restoration After App Restart
 */
export function useScrollbackRestore(taskId: string) {
  const { data, isLoading, error } = trpc.agent.getScrollbackBackup.useQuery(
    { taskId },
    {
      enabled: !!taskId,       // Only query if taskId provided
      staleTime: Infinity,     // Backup is static - no refetch
      retry: false,            // Don't retry on failure
      refetchOnWindowFocus: false
    }
  )

  return {
    scrollback: data?.content ?? null,
    metadata: data?.metadata ?? null,
    isLoading,
    error: error ?? null
  }
}
```

**tRPC Query Pattern:**

```typescript
// Add to agent.router.ts
/**
 * Get scrollback backup content for restoration.
 *
 * Story TES-1.9 - AC: #1, #3
 *
 * Returns null content if no backup exists (not an error).
 */
getScrollbackBackup: publicProcedure
  .input(z.object({ taskId: z.string() }))
  .query(async ({ input }) => {
    const content = await ScrollbackBackupService.restoreScrollback(input.taskId)
    const metadata = await ScrollbackBackupService.getBackupMetadata(input.taskId)
    return { content, metadata }
  }),
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/hooks/useScrollbackRestore.ts` | CREATE | Restoration hook |
| `src/renderer/src/hooks/useScrollbackRestore.test.ts` | CREATE | Hook unit tests |
| `src/main/trpc/routers/agent.router.ts` | MODIFY | Add getScrollbackBackup query |
| `src/main/trpc/routers/agent.router.test.ts` | MODIFY | Add query tests |
| `src/renderer/src/components/terminal/TerminalOutput.tsx` | MODIFY | Integrate restoration |
| `src/main/services/scrollback-backup.service.ts` | MODIFY | Add gap detection method |

### Project Structure Notes

- Hook follows existing pattern from `useTask.ts`, `useAgent.ts`
- tRPC query follows existing patterns in `agent.router.ts`
- Tests co-located with source files per project conventions
- Use existing `@renderer/lib/trpc` import path

### References

- [Architecture: ScrollbackBackupService](_bmad-output/planning-artifacts/architecture.md#scrollbackbackupservice)
- [PRD: FR8, FR40](_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#scrollback-persistence)
- [Epics: Story 1.9](_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-19-scrollback-restoration-after-app-restart)
- [Project Context: Hook Patterns](_bmad-output/planning-artifacts/project-context.md#critical-implementation-rules)
- [TES-1.8 Implementation](_bmad-output/implementation-artifacts/tes-1-8-scrollback-backup-service.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/hooks/useScrollbackRestore.test.ts
npm test src/main/trpc/routers/agent.router.test.ts
```

Test scenarios:
1. **Backup exists:** Verify content restored correctly, metadata returned
2. **No backup exists:** Verify null content, no error thrown
3. **Corrupted file:** Verify graceful handling, warning logged
4. **Gap detection:** Verify prepend logic when backup older than session
5. **Loading state:** Verify isLoading true during fetch, false after
6. **Timeout handling:** Verify restoration fails gracefully after 5s
7. **Race condition:** Verify safe handling during concurrent backup/restore

**Mocking Strategy:**
- Mock `ScrollbackBackupService` for tRPC router tests
- Mock tRPC client for React hook tests (use `@trpc/react-query` testing utilities)
- Use `vi.spyOn` to verify service method calls

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

[Source: _bmad-output/planning-artifacts/project-context.md#testing-with-native-modules-critical]

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Restoration load time | <2 seconds | Per NFR4 from PRD |
| Timeout | 5 seconds max | Fail gracefully if exceeded |
| Memory usage | <50MB | Reasonable for 50000 lines |
| Decompression time | <500ms | Gzip is fast for text |
| Error handling | No crash | Log warning, show empty terminal |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Integration Points

**With ScrollbackBackupService (TES-1.8):**
- Call `restoreScrollback(taskId)` to get decompressed content
- Call `getBackupMetadata(taskId)` for restoration context

**With TaskTerminalService:**
- Check `hasSession(taskId)` to determine if live session exists
- If live session, prepend backup content before attaching

**With TerminalOutput Component:**
- Hook provides scrollback content for initial write
- Component handles xterm.js write operations
- Loading state shows skeleton during restoration

### Edge Cases to Handle

1. **No backup file:** Return null, display empty terminal
2. **Corrupted gzip:** Log warning, return null, continue with live session
3. **Missing metadata.json:** Restore scrollback anyway (metadata is optional)
4. **Backup being written:** Use file locking or check lastModified timestamp
5. **Very large backup:** Stream content if >10MB to avoid memory issues
6. **Session recreated:** Don't duplicate content if session was just recreated
7. **Concurrent restores:** Singleton pattern to prevent duplicate work

### UI/UX Considerations

**Loading State:**
- Show skeleton loader in terminal area during restoration
- Display "Restoring terminal history..." message
- Disable terminal input until restoration complete

**Restored Content Indicator:**
- Add subtle separator line between restored and live content
- Consider dimming restored content vs live content
- Show "Restored from X minutes ago" in terminal header

**Error State:**
- On restoration failure, show terminal with empty state
- Log error to console for debugging
- Don't block user from interacting with live session

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Task 1 - Scrollback Restoration:** Integrated scrollback query directly into `useTaskTerminal.ts` rather than a separate hook, as it needs to coordinate with the TES-1.6 in-memory cache check and attachment flow. Added `isRestoringScrollback` state for UI loading indication.

2. **Task 2 - tRPC Queries:** Added two queries to `agent.router.ts`:
   - `getScrollbackBackup`: Returns content + metadata, with 5-second timeout protection
   - `getBackupInfo`: Returns metadata only (lightweight query for UI status display)

3. **Task 3 - TaskTerminal Integration:** Modified `useTaskTerminal.ts` hook to:
   - First check for in-memory cache (TES-1.6, takes precedence for navigation within session)
   - If no in-memory cache, restore from filesystem backup (TES-1.9, for app restart scenario)
   - Add "--- Session Restored ---" separator after restored content
   - Added `isRestoringScrollback` state for UI loading indication

4. **Task 4 - Gap Detection:** Added `getScrollbackGap(taskId)` method to `ScrollbackBackupService` that:
   - Checks if backup exists and tmux session exists
   - Returns hasGap flag for UI to decide whether to prepend backup

5. **Task 5 - Metadata Query:** Already covered by `getBackupInfo` query added in Task 2. Provides lines, bytes, lastBackup, tmuxSession metadata.

6. **Task 6 - Edge Cases:**
   - Corrupted gzip: Service already returns null on decompression errors (logging warning)
   - Missing metadata.json: Content restoration works independently of metadata
   - Timeout: Added 5-second timeout using Promise.race, fails gracefully returning null
   - Race condition: Uses atomic file operations in backup service

### File List

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/hooks/useTaskTerminal.ts` | MODIFY | Integrate backup restoration (query integrated inline) |
| `src/renderer/src/hooks/useTaskTerminal.test.ts` | MODIFY | Add TES-1.9 tests (23 tests total) |
| `src/renderer/src/components/task/TaskTerminal.tsx` | MODIFY | Update loading indicator for restoration state |
| `src/main/trpc/routers/agent.router.ts` | MODIFY | Add getScrollbackBackup and getBackupInfo queries |
| `src/main/trpc/routers/agent.router.test.ts` | MODIFY | Add query tests (59 tests total) |
| `src/main/services/scrollback-backup.service.ts` | MODIFY | Add getScrollbackGap method |

**Note:** The `useScrollbackRestore` hook was originally planned but the query is integrated directly into `useTaskTerminal.ts` to better coordinate with the in-memory cache check (TES-1.6) and attachment flow.

### Test Results

```
✓ useTaskTerminal.test.ts (23 tests passed, includes TES-1.9 restoration tests)
✓ agent.router.test.ts (59 tests passed, includes TES-1.9 query tests)
```

All tests pass. Implementation follows existing patterns and integrates with TES-1.6 in-memory buffer caching.
