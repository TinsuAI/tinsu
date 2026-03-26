# Story 2.3: Session List with Live Status Badges

Status: done

**FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

## Story

As a founder,
I want to see all my chat sessions with real-time status indicators,
So that I know which agents are thinking, idle, or have exited at a glance.

## Acceptance Criteria

1. **Given** I view the chat session list in the Planning Workspace, **When** sessions exist for the current project, **Then** each session shows: agent persona icon/name, last message preview, timestamp, and a live status badge. Status badges show one of: "thinking" (agent processing), "idle" (waiting for input), "completed" (agent finished), "exited" (tmux session gone).

2. **Given** the `listChatSessionsWithStatus` tRPC procedure is called, **When** it queries sessions for a project, **Then** it returns sessions ordered by most recently active, each session includes `liveStatus` from `chatCliService.getSessionStatus()`, and the query completes quickly enough for <500ms total switch time (NFR26).

3. **Given** an agent is processing a message in a background session, **When** I view the session list, **Then** that session's badge shows "thinking" in real-time, and when the agent finishes, the badge updates to "idle" without manual refresh.

4. **Given** the Planning Workspace sidebar, **When** background sessions are active, **Then** a summary shows the count of active background sessions and their status. Example: "PM (payment PRD) -- idle, Architect (payment) -- thinking".

5. **Given** I click on a session in the list, **When** the session loads, **Then** the transition is smooth and completes in <500ms (NFR26), and the chat area shows all messages for that session.

## Tasks / Subtasks

- [x] Task 1: Enhance `listWithPreview` tRPC procedure with liveStatus (AC: #2)
  - [x] 1.7 Enhanced existing `listWithPreview` procedure to include `liveStatus` field. For completed sessions returns 'completed' directly; for all others calls `chatCliService.getSessionStatus(session.id)`. Uses existing direct import of `chatCliService`.

- [x] Task 2: Real-time badge updates via reduced polling interval (AC: #3)
  - [x] 2.2 Changed `refetchInterval` from 5000ms to 2000ms in ChatSessionList to match health monitoring poll cycle. Polling approach chosen over tRPC subscriptions for simplicity.

- [x] Task 3: Update ChatSessionList component with live status badges (AC: #1, #5)
  - [x] 3.1 Created `LIVE_STATUS_CONFIG` replacing old `STATUS_CONFIG` with thinking/idle/completed/exited mappings
  - [x] 3.2 Created `LiveStatusBadge` inline component with lucide-react icons (Activity, Circle, CheckCircle2, XCircle), color-coded pills
  - [x] 3.3 Replaced static badge with LiveStatusBadge using `liveStatus` from enhanced query
  - [x] 3.4 Added `animate-pulse` class for thinking status
  - [x] 3.5 Session card click handler unchanged, <500ms transition preserved
  - [x] 3.6 Updated `ChatSessionListItem` type with `liveStatus` optional field

- [x] Task 4: Add background session summary to Planning Workspace sidebar (AC: #4)
  - [x] 4.1 Created `BackgroundSessionSummary` exported component in `ChatSessionList.tsx`
  - [x] 4.2 Filters sessions with liveStatus 'thinking' or 'idle', excludes selected session
  - [x] 4.3 Renders persona name + workflow_key context + status with color-coded labels
  - [x] 4.4 Returns null (hidden) when no background sessions
  - [x] 4.5 Styled as thin strip below "New Chat" button, above session cards

- [x] Task 5: Update tRPC query in ChatSessionList to use enhanced data (AC: #1, #2, #3)
  - [x] 5.1 Query unchanged (same `listWithPreview`), now returns `liveStatus` from enhanced backend
  - [x] 5.2 Updated `refetchInterval` from 5000ms to 2000ms
  - [x] 5.3 Query key unchanged, liveStatus changes trigger re-renders via tRPC polling

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 Router test: enhanced `listWithPreview` returns `liveStatus` field for each session (5 new tests)
  - [x] 6.2 Router test: `liveStatus` reflects `chatCliService.getSessionStatus()` return value (thinking, idle, exited)
  - [x] 6.3 Router test: Sessions ordered by most recently active (existing test preserved)
  - [x] 6.4 Renderer test: ChatSessionList renders live status badge with correct label for each status type (thinking, idle, completed, exited)
  - [x] 6.5 Renderer test: "thinking" badge has animate-pulse class, "idle" does not
  - [x] 6.6 Renderer test: Background session summary shows correct persona names and colors
  - [x] 6.7 Renderer test: Background summary hidden when no active background sessions
  - [x] 6.8 Renderer test: Session click calls `onSelectSession` correctly (existing test preserved)
  - [x] 6.9 Renderer test: Completed sessions use liveStatus "completed" with zinc styling

## Dev Notes

### Architecture Reference: Session List with Live Status

The architecture document (`architecture.md` lines 2134-2149) specifies the `listChatSessionsWithStatus` procedure:

```typescript
listChatSessionsWithStatus: t.procedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ input, ctx }) => {
    const sessions = await db.query.chatSessions.findMany({
      where: eq(chatSessions.projectId, input.projectId),
      orderBy: desc(chatSessions.lastMessageAt)
    })

    return sessions.map(s => ({
      ...s,
      liveStatus: ctx.chatCliService.getSessionStatus(s.id)
      // 'thinking' | 'idle' | 'completed' | 'exited'
    }))
  }),
```

**IMPORTANT:** The architecture shows this as a separate procedure, but the recommended approach is to enhance the existing `listWithPreview` procedure to include `liveStatus`. This avoids duplicating the session query logic and the message preview lookup. The ChatSessionList already consumes `listWithPreview` -- extending it is the simplest path.

### Existing Infrastructure to Reuse

| Component | Location | Status | Use in This Story |
|-----------|----------|--------|-------------------|
| `ChatSessionList` | `src/renderer/src/components/planning/ChatSessionList.tsx` | Exists (Story 10.6) | Enhance with live status badges |
| `ChatSessionContextMenu` + `ChatSessionListItem` type | `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` | Exists (Story 10.6) | Extend type with `liveStatus` |
| `listWithPreview` query | `src/main/trpc/routers/chat-session.router.ts` line 575 | Exists (Story 10.6) | Enhance return value with `liveStatus` |
| `getSessionStatus()` | `src/main/services/chat-cli.service.ts` line 736 | Exists (CTM-2.1) | Call from router to get live status |
| `onSessionStatus()` listener | `src/main/services/chat-cli.service.ts` line 190 | Exists (CTM-2.2) | Available for real-time push if needed |
| `emitSessionStatus()` events | `src/main/services/chat-cli.service.ts` line 203 | Exists (CTM-2.2) | Fires on session exit and idle timeout |
| `AGENT_PERSONA_CONFIG` | `src/renderer/src/constants/planning-workspace.ts` line 228 | Exists (Story 9.8) | Persona display names for summary bar |
| `AgentStatusBadge` component | `src/renderer/src/components/ui/AgentStatusBadge.tsx` | Exists (Story 5.2) | Reference for badge pattern (do NOT reuse directly -- different status types) |
| `STATUS_CONFIG` in ChatSessionList | `ChatSessionList.tsx` line 60-73 | Exists (Story 10.6) | Replace/extend with live status config |
| `formatRelativeTime()` | `ChatSessionList.tsx` line 33-57 | Exists (Story 10.6) | Keep as-is |
| `getServices()` | `src/main/services/index.ts` | Exists | Access `chatCliService` from router |
| `busySessions` Set | `chat-cli.service.ts` | Exists (Epic 10) | Drives "thinking" status in `getSessionStatus()` |

### What MUST Change

| File | Change | Why |
|------|--------|-----|
| `src/main/trpc/routers/chat-session.router.ts` | Enhance `listWithPreview` to include `liveStatus` field | Backend live status data |
| `src/renderer/src/components/planning/ChatSessionList.tsx` | New live status badge rendering, 2s polling, background summary | Frontend live status display |
| `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` | Add `liveStatus` to `ChatSessionListItem` type | Type alignment |
| `src/renderer/src/components/planning/ChatSessionList.test.tsx` | Update existing tests, add new tests for live status | Test coverage |
| `src/main/trpc/routers/chat-session.router.test.ts` | Add test for `liveStatus` field in `listWithPreview` response | Backend test coverage |

### What MUST NOT Change

| Component | Reason |
|-----------|--------|
| `spawnSession()` | CTM-1.1 complete |
| `reattachSession()` | CTM-1.3 complete |
| `validateSessionsOnStartup()` | CTM-1.3 complete |
| `sendChatMessage` three-case handler | CTM-1.3 complete |
| `getSessionStatus()` method logic | CTM-2.1 complete |
| `startMonitoring()` health poll | CTM-2.2 complete |
| `emitSessionStatus()` / `onSessionStatus()` | CTM-2.2 complete |
| Hook routing via `TINSU_TMUX_SESSION` | CTM-1.2 complete |
| `killSession()` core logic | Already correct |
| `handleSelectSession` in ChatPanel | CTM-2.1 complete |
| Persona-switch `useEffect` in ChatPanel | CTM-2.1 complete |
| DB schema (`chat_sessions` table) | CTM-1.1 complete |

### Live Status Mapping Logic

The `getSessionStatus()` method (CTM-2.1) returns `'thinking' | 'idle' | 'exited' | 'unknown'`. Map these to badge visuals:

| `liveStatus` | Badge Label | Visual | Color | Animation |
|-------------|-------------|--------|-------|-----------|
| `thinking` | Thinking | Pulsing dot or spinner icon | Cyan (`text-cyan-400`, `bg-cyan-500/15`) | `animate-pulse` |
| `idle` | Idle | Solid dot | Emerald (`text-emerald-400`, `bg-emerald-500/15`) | None |
| `exited` | Exited | Stop/X icon | Amber (`text-amber-400`, `bg-amber-500/15`) | None |
| `unknown` | -- | No badge shown | -- | -- |

For sessions with DB `status === 'completed'`: show "Completed" badge with dimmed zinc styling (existing behavior). Do NOT call `getSessionStatus()` for completed sessions -- they have no tmux session.

### Service Layer: Accessing chatCliService from Router

The `listWithPreview` procedure currently does not access any service. To add `liveStatus`, import `getServices` from `../../services`:

```typescript
import { getServices } from '../../services'

// Inside the query handler:
const { chatCliService } = getServices()
return sessions.map((session) => {
  const lastMessage = /* existing preview lookup */
  return {
    ...session,
    lastMessagePreview: lastMessage?.content ?? null,
    liveStatus: session.status === 'completed'
      ? 'completed' as const
      : chatCliService.getSessionStatus(session.id)
  }
})
```

This matches the pattern used by `sendChatMessage` (line 924) which already calls `getServices().chatCliService`.

### Polling vs Subscription Trade-off

**Polling (recommended):**
- Simplest implementation: change `refetchInterval` from 5000 to 2000
- Aligns with health monitor poll cycle (2 seconds)
- NFR32 says stale detection is <2 seconds -- 2-second polling matches this
- Slightly higher server load but negligible (one DB query + Map lookups per 2 seconds)

**Subscription (optional, not required for AC):**
- `chatCliService.onSessionStatus()` already exists (CTM-2.2)
- Would need tRPC subscription procedure + React consumer
- Adds architectural complexity for marginal benefit over 2s polling
- Consider for future optimization, not this story

### Background Session Summary Format

The summary bar should show a compact list of active background sessions:

```
PM -- idle | Architect -- thinking
```

or when there's workflow context:

```
PM (create-prd) -- idle | Architect (architecture) -- thinking
```

Use `AGENT_PERSONA_CONFIG[session.agent_persona]?.displayName` for the persona name. The workflow context can use the session's `workflow_key` mapped through `BMAD_WORKFLOWS.find(w => w.key === session.workflow_key)?.label`.

### Test Patterns to Follow

**Router tests** (`chat-session.router.test.ts`):
- Mock `getServices` to return a mock `chatCliService` with controlled `getSessionStatus()` return values
- Use `mockDbSelect` / `mockDbAll` for session data
- Follow existing test patterns in the file

**Renderer tests** (`ChatSessionList.test.tsx`):
- Existing tests mock `trpc.chatSession.listWithPreview.useQuery` -- update mock data to include `liveStatus`
- Use `@testing-library/react` with `render`, `screen`, `waitFor`
- Test badge rendering by checking `data-testid` attributes and text content
- Test animation classes with `className` assertions

### DB Column Name Convention

The `chat_sessions` table uses `snake_case` columns: `updated_at`, `last_message_at`, `session_uuid`, `agent_persona`, `workflow_key`, `skip_permissions`. The Drizzle schema maps these to the same `snake_case` names in JavaScript. When accessing properties in the router response, use `session.last_message_at`, `session.agent_persona`, etc.

### Previous Story Intelligence

- **CTM-2.2** added `startMonitoring()` with 2-second health polling, `emitSessionStatus()` event system, and integrated idle checks. All 72 tests passing. The event system (`onSessionStatus`) is available for this story's real-time updates but polling is recommended.
- **CTM-2.2 code review** applied 2 fixes: dead `idleCheckInterval` property removed, `busySessions.clear()` added to `killAll()`.
- **CTM-2.1** added `getSessionStatus()` method, persona-switch session preservation in ChatPanel, and concurrent session independence verification. All 86 tests passing. Code review applied 1 fix: `prevMessageCountRef.current = 0` on resume.
- **Pre-existing test failures:** 5 pre-existing test failures exist in unrelated files. Do not fix.

### NFR26 Compliance

NFR26 requires <500ms session switch time. The existing `handleSelectSession` in ChatPanel (CTM-2.1) already completes the switch by setting React state synchronously. The enhanced `listWithPreview` adds one `getSessionStatus()` call per session (in-memory Map lookup, O(1)) -- negligible impact on query time.

### Project Structure Notes

Changes span both main process (router) and renderer (components):
- `src/main/trpc/routers/chat-session.router.ts` -- enhance `listWithPreview` with `liveStatus`
- `src/renderer/src/components/planning/ChatSessionList.tsx` -- live status badge UI, background summary
- `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` -- type update
- Test files co-located with source files

### References

- [Source: _bmad-output/planning-artifacts/epics-chat-tmux-migration.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#lines 2134-2149 - listChatSessionsWithStatus procedure]
- [Source: _bmad-output/planning-artifacts/architecture.md#lines 2085-2107 - Session Monitoring]
- [Source: src/main/services/chat-cli.service.ts#line 736 - getSessionStatus method]
- [Source: src/main/services/chat-cli.service.ts#line 190 - onSessionStatus method]
- [Source: src/main/trpc/routers/chat-session.router.ts#line 575 - listWithPreview procedure]
- [Source: src/renderer/src/components/planning/ChatSessionList.tsx - current session list]
- [Source: src/renderer/src/components/planning/ChatSessionContextMenu.tsx#line 15 - ChatSessionListItem type]
- [Source: src/renderer/src/constants/planning-workspace.ts#line 228 - AGENT_PERSONA_CONFIG]
- [Source: src/renderer/src/components/ui/AgentStatusBadge.tsx - badge pattern reference]
- [Source: _bmad-output/implementation-artifacts/ctm-2-2-session-health-monitoring-and-idle-timeout.md - previous story]
- [Source: _bmad-output/implementation-artifacts/ctm-2-1-concurrent-session-execution-and-background-persistence.md - prior story]
- [Source: _bmad-output/planning-artifacts/project-context.md - testing and naming conventions]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 30 renderer tests passing (ChatSessionList.test.tsx)
- All 65 router tests passing (chat-session.router.test.ts) -- 5 new CTM-2.3 tests added

### Completion Notes List
- Enhanced existing `listWithPreview` router procedure with `liveStatus` field (preferred approach per story)
- Created `LiveStatusBadge` component with lucide-react icons and color-coded pills
- Created `BackgroundSessionSummary` component for active background session strip
- Updated `ChatSessionListItem` type with optional `liveStatus` field
- Changed polling interval from 5000ms to 2000ms to match health monitor cadence
- Passed `selectedSessionId` from ChatPanel to ChatSessionList for background summary filtering
- Completed sessions return 'completed' liveStatus directly from DB status (no tmux query)
- "unknown" liveStatus renders no badge (hidden)

### Change Log
- `src/main/trpc/routers/chat-session.router.ts` -- Enhanced `listWithPreview` to include `liveStatus` from `chatCliService.getSessionStatus()`
- `src/renderer/src/components/planning/ChatSessionList.tsx` -- Replaced static STATUS_CONFIG with LIVE_STATUS_CONFIG, added LiveStatusBadge, BackgroundSessionSummary, 2s polling, selectedSessionId prop
- `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` -- Added `liveStatus` to `ChatSessionListItem` type
- `src/renderer/src/components/planning/ChatPanel.tsx` -- Passed `selectedSessionId` prop to ChatSessionList
- `src/renderer/src/components/planning/ChatSessionList.test.tsx` -- Updated existing tests for 2s interval, added 14 new tests for live badges and background summary
- `src/main/trpc/routers/chat-session.router.test.ts` -- Added `mockGetSessionStatus` mock, 5 new CTM-2.3 tests

### File List
- `src/main/trpc/routers/chat-session.router.ts` (modified)
- `src/main/trpc/routers/chat-session.router.test.ts` (modified)
- `src/renderer/src/components/planning/ChatSessionList.tsx` (modified)
- `src/renderer/src/components/planning/ChatSessionList.test.tsx` (modified)
- `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` (modified)
- `src/renderer/src/components/planning/ChatPanel.tsx` (modified)
