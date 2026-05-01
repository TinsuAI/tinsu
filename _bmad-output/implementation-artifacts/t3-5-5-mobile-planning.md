# Story 3.5.5: Mobile Planning

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a mobile-native planning workspace with a session list root and full-screen chat (with persona selection, message bubbles, and a sticky composer that resumes existing sessions via deep links),
so that I can continue BMAD planning conversations on a phone — pick up an existing session, switch personas for new sessions, send a message, and watch the agent reply — without losing session context or being forced into the desktop UI.

## Acceptance Criteria

1. **Given** the mobile shell from T3.5-1, **When** the user is on the Planning tab and the active route is `'sessions'` (the planning tab root), **Then** `MobileApp.tsx`'s `MobileRouteRenderer` renders `<MobilePlanningHome />` (the existing component file at `src/mobile/planning/MobilePlanningHome.tsx`). The current placeholder body of `MobilePlanningHome.tsx` (the `Compass` icon + "Coming in T3.5-5" `MobileEmptyState`) **MUST be replaced** with the real session-list screen described in AC 2–6. **Do NOT** create a new tab-root file (no `MobileSessionListScreen.tsx`); the architecture doc lists that as a separate concept, but for v1 the session list IS the planning home — keep the file count minimal.

2. **Given** `MobilePlanningHome` mounts, **When** the screen renders and a project is selected (`useProjectStore((s) => s.projectId)` is non-null), **Then** the screen displays: (a) a `MobileTopAppBar` with `title="Planning"`, **no** `backButton` (this is a tab root, not a push), and `trailingActions={null}` (no overflow yet — defer to T3.5-8); (b) a vertically-scrolling list region of `MobileSessionRow` items (one per chat session) sorted with `liveStatus === 'thinking'` first, then by `last_message_at` desc; (c) a `MobileFab` anchored bottom-right (above the tab bar safe area) with `Plus` icon, `aria-label="New chat session"`, that opens the new-session sheet (AC 5). **Test ID:** root `data-testid="mobile-planning-home"`, list `data-testid="mobile-planning-session-list"`, fab `data-testid="mobile-planning-new-chat"`.

3. **Given** the session list region renders, **When** it has data, **Then** each `MobileSessionRow` shows: (a) an 8 px persona dot using `AGENT_PERSONA_CONFIG[session.agent_persona].dot` (fallback to `'bg-muted-foreground/40'` when persona is unknown — **DO NOT** crash on unknown personas); (b) the persona display name (`config.displayName`) as the row title; (c) a 1-line truncated `last_message_preview` (or em-dash placeholder when null/empty); (d) a relative timestamp ("3m ago", "2h ago", "yesterday") computed using a local `formatRelativeTime` helper **mirroring `src/components/planning/ChatSessionList.tsx`'s `formatRelativeTime`** (do NOT import the helper directly to avoid coupling to the desktop file's internal export); (e) a `LiveStatusBadge` rendering `liveStatus` from the preview row (one of `thinking`, `idle`, `completed`, `exited`, `unknown`) using the same color mapping as desktop (`thinking`: cyan + `animate-pulse`; `idle`: emerald; `completed`: zinc; `exited`: amber; `unknown`: hidden). Tapping the row pushes route `chat:<sessionId>` via `useMobileNavStore.getState().pushRoute('planning', \`chat:${session.id}\`)`. Use `MobileListItem` as the row primitive — **do not** invent a custom row component if the primitive's API supports leading icon + title + subtitle + trailing slot.

4. **Given** the session list is empty (no sessions yet for the project) **OR** loading, **When** the screen renders, **Then** the empty state shows `<MobileEmptyState icon={<Compass/>} title="No chat sessions yet" subtitle="Tap the + button to start a planning conversation." />` and the loading state shows three `<MobileLoadingSkeleton variant="row" />` items (or `variant="card"` if `row` does not exist — verify the primitive's allowed variants from T3.5-2). When `commands.listChatSessionsWithPreview(projectId)` returns an error, render `<MobileEmptyState title="Couldn't load sessions" subtitle={errorMessage} />` with a retry button (`secondaryAction` slot if `MobileEmptyState` exposes one — otherwise omit retry and rely on pull-to-refresh in a future story).

5. **Given** the user taps the new-chat FAB, **When** the FAB is pressed, **Then** a `MobileSheet` opens with `snapPoint='fit'`, `title="New planning chat"`, `description="Pick a BMAD agent to start a new session."`. The sheet body lists 6 personas in this exact order: `'general'`, `'bmad:bmm:agents:pm'`, `'bmad:bmm:agents:architect'`, `'bmad:bmm:agents:ux-designer'`, `'bmad:bmm:agents:analyst'`, `'bmad:ghk:agents:growth-guru'` (matches `CHAT_PERSONAS` in `src/components/planning/ChatPersonaSelector.tsx`). Each row uses `MobileListItem` with the persona's color dot + `displayName` + optional `characterName` subtitle (e.g. "PM — John"). Tapping a persona row: (i) creates a session via `commands.createChatSession(projectId, agentPersonaKey, null)` — the third arg `workflowKey` is `null` for v1 (no workflow context picker yet); (ii) on success, pushes route `chat:<newSessionId>` via `pushRoute('planning', \`chat:${newSessionId}\`)`; (iii) closes the sheet. On error, surface the error inside the sheet via inline text (do NOT toast — toasts are out of scope for this story). **Test ID:** sheet `data-testid="mobile-planning-new-session-sheet"`, persona rows `data-testid="mobile-planning-persona-{personaSlug}"` where `personaSlug` is `displayName.toLowerCase().replace(/\s+/g,'-')`.

6. **Given** the user taps a session row OR the deep-link `tinsu://chat/{sessionId}` is opened, **When** the route resolves to `chat:<sessionId>`, **Then** `MobileApp.tsx`'s `MobileRouteRenderer` renders `<MobileChatScreen sessionId={sessionId} />`. **`isFullScreenRoute()` MUST be extended** in `MobileApp.tsx` to return true for routes starting with `chat:` (currently it only matches `workspace:`). The chat screen MUST render at the same level as the workspace screen (no root `MobileScreen` shell, no `MobileTabBar`). **Do NOT** modify `parseDeepLink` in `src/mobile/shell/deeplinks.ts` — it already produces `stack: ['sessions', 'chat:<id>']`.

7. **Given** `MobileChatScreen` mounts for a `sessionId`, **When** the screen renders, **Then** the layout uses `<MobileScreen tabBar={undefined} topBar={<chatHeader/>}>` with: (a) chat header — back button (`onClick: () => useMobileNavStore.getState().popRoute()`), persona pill showing the session's persona color dot + display name (tappable only to open the read-only persona-info sheet from AC 13 — **mid-session persona switch is disabled per UX redesign §3.2**), and an overflow `MoreVertical` icon button as a placeholder (`disabled` for v1, `aria-label="Chat menu (Coming in T3.5-8)"`); (b) message area — vertically scrolling, auto-scrolls to bottom on new messages **unless** the user has scrolled up >100 px (then show "↓ N new messages" pill above the composer; tapping it jumps to bottom and re-locks); (c) composer — sticky at the bottom of the screen, ABOVE the keyboard safe area, with a single multiline `<textarea>` and a Send icon button (Lucide `Send`). The textarea expands up to ~4 visible lines then internally scrolls. Send button is `disabled` when input is empty/whitespace-only OR when a send is in flight.

8. **Given** the chat screen is mounted, **When** the message area renders messages, **Then** it queries `commands.getChatMessages(sessionId, null, null)` via `useQuery({ queryKey: ['chat-messages', sessionId], refetchInterval: 2000, enabled: !!sessionId })` AND subscribes to the Tauri event `'chat:message-received'` via `listen<{ session_id: string }>('chat:message-received', …)` to invalidate the query when a message arrives for the current `sessionId` (mirror exactly the pattern in `src/components/planning/ChatPanel.tsx` lines 246–279). **Do NOT** remount the listener on every render — wrap the `listen` call in a `useEffect([sessionId, queryClient])` with the `isMounted` guard pattern from desktop ChatPanel. On unmount, call the returned unlisten function.

9. **Given** message data has loaded, **When** rendering each message, **Then** `MobileChatBubble` renders: (a) **user** messages right-aligned with primary-tinted background (`bg-primary/15 border-primary/20 text-foreground`); (b) **assistant** messages left-aligned with card background (`bg-card border-border/40 text-foreground`); (c) **tool** messages collapsed by default into a `MobileChatToolActivity` summary row (e.g. `🔧 Used 3 tools` with a chevron — tap to expand showing tool name, status, brief result). Use `react-markdown` + `remark-gfm` with the existing `markdownComponents` export from `@renderer/components/task/MarkdownComponents` for rendering assistant message body. Code blocks render via `@renderer/components/ui/code-block` (`CodeBlock`) — DO NOT fork; reuse desktop primitives. **Performance:** if message count exceeds 200, render only the last 200 in v1 (no virtualization library); document this trade-off in Dev Notes; T3.5-9 may revisit.

10. **Given** the composer is rendered, **When** the user taps Send (or presses Enter — but **NOT** Enter alone if the device has a soft keyboard, see implementation note), **Then** the screen calls `commands.sendChatMessage(sessionId, content)` via a `useMutation`. **Soft-keyboard rule:** on mobile (`window.matchMedia('(hover: none)').matches === true`), Enter inserts a newline and Send is the only way to submit; on hover-capable devices, Enter sends and Shift+Enter inserts a newline (matches desktop `ChatInput.tsx` if present). On send: (i) clear the input optimistically; (ii) invalidate `['chat-messages', sessionId]`; (iii) show the working indicator (AC 11). On error: revert the input value and surface inline error below the composer ("Send failed — tap to retry"). **Do NOT** import `useApprovalMutation` or any task-mutation hooks — chat mutations only.

11. **Given** an assistant message has been requested but not yet arrived, **When** the user has just sent a message, **Then** display a `MobileChatWorkingIndicator` row at the bottom of the message list — a left-aligned bubble with three pulsing dots and the persona's display name (e.g. "PM is thinking…"). Use the existing `<ChatWorkingIndicator agentPersona={…} toolActivity={null} />` component from `@renderer/components/planning/ChatWorkingIndicator` (allowed cross-tree import — it consumes `AGENT_PERSONA_CONFIG` and renders self-contained). Hide the indicator when the next assistant message arrives (mirror desktop `ChatPanel.tsx` `prevMessageCountRef` logic — when `messages.length > prev` AND last message is `role === 'assistant'` AND no tool messages after it, set `isAgentThinking = false`). A safety timeout of 120 seconds auto-clears the indicator if no message arrives (prevents stuck UI on silent CLI crash).

12. **Given** the auto-scroll lock from AC 7(b), **When** the user manually scrolls up >100 px from the bottom of the message area, **Then** auto-scroll unlocks; new arriving messages do NOT scroll the view but increment a "↓ N new messages" pill counter rendered as a `MobileChip`-style floating button anchored 12 px above the composer. Tapping the pill calls `messageScrollRef.current?.scrollTo({ top: messageScrollRef.current.scrollHeight, behavior: 'smooth' })` AND re-locks. Re-lock also fires when the user manually scrolls back to within 50 px of the bottom (debounce-free; rely on the scroll event). **Reduced motion:** `behavior: 'auto'` instead of `'smooth'` when `useReducedMotion()` returns true.

13. **Given** the chat header persona pill, **When** the user taps it, **Then** a `MobileSheet` opens (`snapPoint='fit'`, `title="Agent persona"`) showing **read-only** info: persona icon dot, display name, character name (e.g. "John"), and a static 1-2 sentence bio per persona (hardcoded in a local `PERSONA_BIO` map keyed by persona key — values are short hints like "Project Manager — focuses on requirements and PRDs."). The sheet has NO "switch persona" action (mid-session persona switch is disabled per UX redesign §3.2 and CTM-2.1 contract). **DO NOT** call `commands.setSessionPersona` or any persona-mutation API — none such exists in this story's allowlist.

14. **Given** the deep link `tinsu://chat/{sessionId}` is opened (cold-start or while running), **When** `parseDeepLink` resolves it to `{ tab: 'planning', stack: ['sessions', 'chat:<id>'] }` (already implemented in T3.5-1), **Then** `MobileApp.tsx`'s existing deep-link `useEffect` calls `navigateToDeepLink(uri)` which sets the planning tab's stack to `['sessions', 'chat:<id>']`. With AC 6 and AC 7 implemented, this resolves to a full-screen `MobileChatScreen sessionId="<id>"`. **Do NOT** modify `parseDeepLink` or `navigateToDeepLink`. Add an integration test that mounts `MobileApp` with mocked `mobileNavStore.tabStacks.planning = ['sessions', 'chat:abc']` and asserts the chat screen renders with `data-testid="mobile-chat-screen"` and `sessionId === 'abc'`.

15. **Given** Android system back-press while on `chat:<id>`, **When** the user presses back, **Then** the existing `useMobileNavStore.handleBackPress()` (T3.5-1) pops `chat:<id>` from the planning stack, returning to `'sessions'` (the planning home). **Do NOT modify `mobile-nav.store.ts`**. Add a unit test that mounts the chat screen via the route renderer, calls `handleBackPress()`, and asserts the planning home re-renders.

16. **Given** the user is in the chat screen and taps Send, **When** the send mutation resolves, **Then** the planning home's session preview list (`['chat-sessions-preview', projectId]`) is also invalidated so the session row's `last_message_preview` and `last_message_at` update on next visit. Add `queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] })` in both the `sendChatMessage.onSuccess` callback AND the `chat:message-received` listener (mirroring desktop ChatPanel.tsx line 267). The session list polls every 2 s anyway via `refetchInterval: 2000` (matches desktop pattern), so this is a freshness optimization, not a correctness requirement.

17. **Given** any new files this story creates under `src/mobile/planning/`, **When** I `grep -REn "from '@renderer/components|from '../../components|from '@renderer/pages|from '@renderer/stores"` on them, **Then** **only allowed cross-tree imports** are:
    | Import | Reason |
    |---|---|
    | `@renderer/lib/rspc` (`commands`) | Tauri command client (sessions, messages, send) |
    | `@renderer/constants/planning-workspace` (`AGENT_PERSONA_CONFIG`, `getAgentPersona`, `type AgentPersonaConfig`) | persona color/name lookup |
    | `@renderer/components/planning/ChatWorkingIndicator` | Reused thinking indicator (AC 11) |
    | `@renderer/components/task/MarkdownComponents` (`markdownComponents`) | Reused markdown render set (AC 9) |
    | `@renderer/components/ui/code-block` (`CodeBlock`) | Reused syntax-highlighted code block (AC 9) |
    | `@renderer/components/ui/badge` | Status pill (if needed for live status) |
    | `@renderer/lib/utils` (`cn`) | utility |
    | `@renderer/stores/project.store` (`useProjectStore`) | resolve `projectId` |
    | `@shared/types/chat.types` | `ChatMessageAttachment`, message types |
    **Forbidden:** any import from `@renderer/components/planning/{ChatPanel,ChatSessionList,ChatMessageArea,ChatMessageBubble,ChatInput,ChatPersonaSelector,ChatToolActivityCard,ChatToolActivityGroup,ChatSessionContextMenu,ChatArtifactNotification,MobileSessionDrawer,WhatNextPanel,WorkflowRunPanel,PhaseProgressDashboard,ReadinessGatePanel,ArtifactViewer,ArtifactDiffView,ArtifactVersionHistory,RecentRunsTable,SessionDocumentsBar,SessionDocumentViewer,KeyboardShortcutsOverlay,AutocompleteDropdown,AgentPersonaIndicator,ChatSessionUsage,ChatTerminal}`, `@renderer/stores/planning-workspace.store`, `@renderer/stores/chat.store`, `react-tauri-mock`. The mobile planning tree **MUST NOT** mount any desktop chat-panel shell or its session-list/message-area sub-components — fork only the surface (rows, bubbles, composer); reuse the working indicator + markdown stack + persona color map. Direct imports of `react-markdown`/`remark-gfm` are allowed if needed (mirrors T3.5-4 AC 16 trade-off documented in Dev Notes).

18. **Given** the desktop planning workspace, **When** I run desktop tests (`ChatPanel.test.tsx`, `ChatSessionList.test.tsx`, `ChatMessageArea.test.tsx`, `ChatPersonaSelector.test.tsx`, `ChatWorkingIndicator.test.tsx`), **Then** **all desktop tests still pass with zero regressions** because this story does **not** modify any file under `src/components/planning/`, `src/components/ui/`, `src/components/task/`, `src/stores/`, `src-tauri/`. The only allowed touch outside `src/mobile/` is **strict imports** of the cross-tree allowlist above and **adding `chat:` to `isFullScreenRoute()` inside `src/mobile/MobileApp.tsx`** (AC 6).

19. **Given** the new files this story creates, **When** I run `npm test`, **Then** new colocated tests cover at minimum: (a) `MobilePlanningHome` renders empty state when no sessions; (b) renders session rows with persona dot + display name + last message + relative time + live status badge; (c) tapping a row calls `pushRoute('planning', 'chat:<id>')`; (d) FAB tap opens new-session sheet; (e) selecting a persona in the sheet calls `commands.createChatSession` and pushes `chat:<newId>`; (f) `MobileApp` route renderer maps `chat:abc` → `<MobileChatScreen sessionId="abc"/>` AND `isFullScreenRoute('chat:abc') === true`; (g) `MobileChatScreen` renders header with back button + persona pill; (h) header back button calls `popRoute()`; (i) message area mounts `useQuery` for `getChatMessages` and renders user vs assistant bubbles; (j) `chat:message-received` Tauri event invalidates `['chat-messages', sessionId]`; (k) composer Send button disabled when empty, enabled with text; (l) tapping Send calls `commands.sendChatMessage` and clears the input; (m) working indicator appears after send and disappears when next assistant message arrives; (n) auto-scroll lock: scrolling up >100 px hides auto-scroll; tapping "↓ N new" pill scrolls to bottom; (o) reduced-motion mock causes `scrollTo` with `behavior: 'auto'`; (p) persona pill tap opens read-only info sheet (no switch action); (q) deep-link `tinsu://chat/abc` resolves to chat screen via mocked `tabStacks.planning = ['sessions', 'chat:abc']`. **Total ≥17 new tests**, zero new failures vs T3.5-4 baseline.

20. **Given** all new files under `src/mobile/planning/`, **When** I `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]"` on them, **Then** **zero direct matches** are returned EXCEPT inside the `LIVE_STATUS_CONFIG` constant (cyan/emerald/zinc/amber for live status — explicitly mirroring desktop `ChatSessionList.tsx`'s status colors which are part of UX-DR4 honest-status semantics) AND inside the `PERSONA_BIO` config consumption that pulls from `AGENT_PERSONA_CONFIG`. All other colors come from Calm Command tokens via `bg-card`, `bg-muted/40`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-destructive`, `border-border/40`, etc. Persona colors are read transitively from `AGENT_PERSONA_CONFIG[…].dot/.bg/.text/.border` (those Tailwind class strings live inside the constant, not in mobile files — this is the desktop pattern and is intentional).

21. **Given** the workspace screen, **When** I run with `import.meta.env.DEV` and force-refresh while on `chat:<id>` route, **Then** I see **no console errors** and **no React warnings** (no missing keys on message list, no act() warnings in StrictMode, no Radix Dialog warnings on `MobileSheet`, no Lucide icon warnings). The DEV harness route `#__mobile-primitives` (T3.5-2 AC 14) continues to render correctly — i.e., this story does **not** touch `src/mobile/dev/MobilePrimitivesHarness.tsx` and does not modify the harness routing in `MobileApp.tsx` beyond adding the `chat:` branch in `MobileRouteRenderer` and `isFullScreenRoute`.

## Tasks / Subtasks

- [x] **Task 1: Replace `MobilePlanningHome` placeholder with session list (AC: 1, 2, 3, 4)**
  - [x] 1.1 Edit `src/mobile/planning/MobilePlanningHome.tsx`. Remove the `Compass` placeholder body. Keep the same export name `MobilePlanningHome` (no rename).
  - [x] 1.2 Read `projectId` from `useProjectStore((s) => s.projectId)`. If `projectId == null`, render `<MobileEmptyState title="No project selected" subtitle="Open a project to view planning sessions." />`.
  - [x] 1.3 Query sessions via `useQuery({ queryKey: ['chat-sessions-preview', projectId], queryFn: async () => { const r = await commands.listChatSessionsWithPreview(projectId); if (r.status === 'error') throw new Error(JSON.stringify(r.error)); return r.data }, refetchInterval: 2000, enabled: !!projectId })`.
  - [x] 1.4 Sort: `[...sessions].sort((a,b) => { const aPriority = a.live_status === 'thinking' ? 0 : 1; const bPriority = b.live_status === 'thinking' ? 0 : 1; if (aPriority !== bPriority) return aPriority - bPriority; return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime() })`.
  - [x] 1.5 Render `<MobileTopAppBar title="Planning" />`. Below it, scroll container with the sorted list. Use `MobileListItem` for rows.
  - [x] 1.6 Render `<MobileFab icon={<Plus />} aria-label="New chat session" onClick={() => setNewSessionSheetOpen(true)} data-testid="mobile-planning-new-chat" />` anchored bottom-right.
  - [x] 1.7 Empty / loading / error states per AC 4. Wrap the content in `<div data-testid="mobile-planning-home">…</div>`.

- [x] **Task 2: `MobileSessionRow` (AC: 3)**
  - [x] 2.1 Create `src/mobile/planning/MobileSessionRow.tsx`. Props: `{ session: ChatSessionListItemPreview; onTap: () => void }`. (Define `ChatSessionListItemPreview` locally as a TypeScript interface mirroring the shape returned by `commands.listChatSessionsWithPreview` — fields: `id: string`, `agent_persona: string | null`, `last_message_preview: string | null`, `last_message_at: string | null`, `live_status: string | undefined`. **Do not** import `ChatSessionListItem` from `@renderer/components/planning/ChatSessionContextMenu` — that introduces an unwanted cross-tree dep.)
  - [x] 2.2 Resolve `personaConfig = AGENT_PERSONA_CONFIG[session.agent_persona ?? 'general'] ?? AGENT_PERSONA_CONFIG['general']`. Render the persona dot via the config's `dot` class.
  - [x] 2.3 Title: `personaConfig.displayName`. Subtitle: `last_message_preview ?? '—'` (1-line truncate via `line-clamp-1`). Trailing: `<LiveStatusBadge liveStatus={session.live_status} />` + relative timestamp.
  - [x] 2.4 Use `<MobileListItem leading={<dot/>} title={…} subtitle={…} trailing={…} onPress={onTap} />`. If `MobileListItem` lacks any of these slots, render a custom row using token classes only (`bg-card border-b border-border/40 px-4 py-3 flex gap-3`).
  - [x] 2.5 `formatRelativeTime` — local helper, mirrors `src/components/planning/ChatSessionList.tsx` lines 38–62 (just now / N min ago / N hours ago / yesterday / `toLocaleDateString`).

- [x] **Task 3: `LiveStatusBadge` mobile primitive (AC: 3)**
  - [x] 3.1 Create `src/mobile/planning/LiveStatusBadge.tsx`. Props: `{ liveStatus: string | undefined }`.
  - [x] 3.2 Mirror `LIVE_STATUS_CONFIG` from `src/components/planning/ChatSessionList.tsx` lines 68–95 (cyan thinking + animate-pulse, emerald idle, zinc completed, amber exited, hidden when unknown). **Document** in a code comment that this constant is duplicated from desktop intentionally to keep the mobile tree decoupled (per CLAUDE.md mobile-tree-not-branch rule).
  - [x] 3.3 Render: `<span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', config.className, animationClassName)}><Icon className="h-3 w-3" />{label}</span>`.

- [x] **Task 4: `MobileNewSessionSheet` (AC: 5)**
  - [x] 4.1 Create `src/mobile/planning/MobileNewSessionSheet.tsx`. Props: `{ open: boolean; onOpenChange: (open: boolean) => void; projectId: string; onSessionCreated: (sessionId: string) => void }`.
  - [x] 4.2 Mount `<MobileSheet open={open} onOpenChange={onOpenChange} snapPoint="fit" title="New planning chat" description="Pick a BMAD agent to start a new session." data-testid="mobile-planning-new-session-sheet">`.
  - [x] 4.3 Define `CHAT_PERSONAS` locally as `['general', 'bmad:bmm:agents:pm', 'bmad:bmm:agents:architect', 'bmad:bmm:agents:ux-designer', 'bmad:bmm:agents:analyst', 'bmad:ghk:agents:growth-guru'] as const` (intentional duplicate of `src/components/planning/ChatPersonaSelector.tsx` for mobile-tree-decoupling).
  - [x] 4.4 Render rows: `CHAT_PERSONAS.map(key => { const cfg = AGENT_PERSONA_CONFIG[key]; return <MobileListItem leading={<dot/>} title={cfg.displayName} subtitle={cfg.characterName ? \`— ${cfg.characterName}\` : undefined} onPress={() => handleSelect(key)} data-testid={...} /> })`.
  - [x] 4.5 `handleSelect(personaKey)` — `useMutation` calling `commands.createChatSession(projectId, personaKey, null)`. On success: `onSessionCreated(newSession.id)`, call `onOpenChange(false)`. On error: render an inline error block at bottom of sheet via local `errorMessage` state.
  - [x] 4.6 Disable rows while mutation is `isPending`; show a skeleton or inline "Creating session…" text on the active row.

- [x] **Task 5: Wire route renderer in `MobileApp.tsx` (AC: 1, 6, 14)**
  - [x] 5.1 Edit `src/mobile/MobileApp.tsx`. Update `isFullScreenRoute()` to: `return route.startsWith('workspace:') || route.startsWith('chat:')`.
  - [x] 5.2 Update `MobileRouteRenderer` — replace the existing `if (route.startsWith('chat:'))` placeholder branch (currently renders `<MobileEmptyState>Coming in T3.5-5</MobileEmptyState>`) with: `if (route.startsWith('chat:')) { const sessionId = route.slice('chat:'.length); return <MobileChatScreen sessionId={sessionId} /> }`. Import `MobileChatScreen` at top.
  - [x] 5.3 Verify the existing `case 'sessions': return <MobilePlanningHome />` branch is unchanged (it is — Task 1 only edits the file body, not the route key).
  - [x] 5.4 Update `MobileApp.test.tsx`: replace the placeholder assertion for `'chat:abc'` (currently asserts the empty-state copy) with an assertion that `<MobileChatScreen>` mounts (use a stub mock with `data-testid="mobile-chat-screen"`). Add a test for `isFullScreenRoute('chat:foo') === true`. Add a test that `tabStacks.planning = ['sessions', 'chat:abc']` causes the chat screen to render with `sessionId === 'abc'` and the tab bar to be absent.

- [x] **Task 6: `MobileChatScreen` shell (AC: 6, 7, 15)**
  - [x] 6.1 Create `src/mobile/planning/MobileChatScreen.tsx`. Props: `{ sessionId: string }`.
  - [x] 6.2 Layout: `<div className="flex flex-col h-full bg-background" data-testid="mobile-chat-screen">` with three slots: header, message area (`flex-1 min-h-0`), composer (sticky bottom).
  - [x] 6.3 Header: a `<div>` styled like `MobileTopAppBar` (cannot reuse `MobileTopAppBar` directly because we need both back button AND persona pill in the title slot — verify `MobileTopAppBar` can accept a `title` ReactNode; if so, pass `<PersonaPill onClick={…} />` as the title and use `backButton={{ onClick: popRoute }}`. Otherwise inline the chrome — same pattern T3.5-4 used for the workspace header).
  - [x] 6.4 Message area: `<MessageList messages={messages} attachmentsByMessageId={…} />` (Task 7).
  - [x] 6.5 Composer: `<MobileChatComposer onSend={handleSend} disabled={!sessionId || sendChatMessage.isPending} />` (Task 8).
  - [x] 6.6 Persona-info sheet wired off the persona pill (AC 13).
  - [x] 6.7 JSDoc `@see Story T3.5-5` and link to T3.5-8 for overflow-menu wiring.

- [x] **Task 7: `MobileChatMessageList` + `MobileChatBubble` (AC: 8, 9, 11, 12, 16)**
  - [x] 7.1 Create `src/mobile/planning/MobileChatMessageList.tsx`. Props: `{ sessionId: string; persona: AgentPersonaConfig; isAgentThinking: boolean; toolActivity: ToolActivityState | null }`.
  - [x] 7.2 `useQuery({ queryKey: ['chat-messages', sessionId], queryFn: () => commands.getChatMessages(sessionId, null, null), refetchInterval: 2000, enabled: !!sessionId })`.
  - [x] 7.3 `useEffect` to subscribe to `'chat:message-received'` via `import { listen } from '@tauri-apps/api/event'`. Mirror desktop pattern (lines 260–279 of `ChatPanel.tsx`): isMounted guard, unlisten on cleanup, invalidate `['chat-messages', sessionId]` AND `['chat-sessions-preview', projectId]` on event.
  - [x] 7.4 Auto-scroll: `messageScrollRef`, on messages change scroll to bottom unless `isAtBottomRef.current === false`. On scroll event: compute distance from bottom; if `> 100 px`, set `isAtBottomRef.current = false`, increment `newMessagesSinceScrollUp`. If `< 50 px`, reset.
  - [x] 7.5 Floating "↓ N new" pill: render when `newMessagesSinceScrollUp > 0` AND `isAtBottomRef.current === false`. Tap = `messageScrollRef.current?.scrollTo({ top: scrollHeight, behavior: reduced ? 'auto' : 'smooth' })` + reset.
  - [x] 7.6 Reduced motion: `useReducedMotion()` toggles `behavior` between `'auto'` and `'smooth'`.
  - [x] 7.7 Render messages: filter to last 200 (`messages.slice(-200)`); map to `<MobileChatBubble key={msg.id} message={msg} persona={persona} />`.
  - [x] 7.8 At bottom: if `isAgentThinking`, append `<ChatWorkingIndicator agentPersona={agentPersonaKey} toolActivity={toolActivity} />` (cross-tree desktop component, AC 11).

- [x] **Task 8: `MobileChatBubble` (AC: 9)**
  - [x] 8.1 Create `src/mobile/planning/MobileChatBubble.tsx`. Props: `{ message: ChatMessage; persona: AgentPersonaConfig }` where `ChatMessage` is the row type returned by `getChatMessages` (has `role`, `content`, `created_at`, optional `tool_name`/`tool_input` fields).
  - [x] 8.2 Branch on `message.role`:
    - `user` → right-aligned bubble: `<div className="ml-auto max-w-[85%] rounded-lg bg-primary/15 border border-primary/20 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">{message.content}</div>`.
    - `assistant` → left-aligned bubble: `<div className="mr-auto max-w-[85%] rounded-lg bg-card border border-border/40 px-3 py-2 text-sm text-foreground"><ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown></div>`.
    - `tool` → collapsed: `<button type="button" onClick={() => setExpanded(!expanded)} className="mr-auto inline-flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground border border-border/40">🔧 Tool: {message.tool_name ?? 'unknown'}<ChevronDown className={…} /></button>` + when `expanded`, render `tool_input` JSON in a `<pre>`.
  - [x] 8.3 Timestamp: small muted-foreground `<time>` below or beside, format `HH:mm`.

- [x] **Task 9: `MobileChatComposer` (AC: 7, 10)**
  - [x] 9.1 Create `src/mobile/planning/MobileChatComposer.tsx`. Props: `{ onSend: (content: string) => Promise<void> | void; disabled: boolean; placeholder?: string }`.
  - [x] 9.2 State: `const [value, setValue] = useState('')`.
  - [x] 9.3 Render a sticky-bottom `<div className="sticky bottom-0 bg-background border-t border-border/40 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] flex items-end gap-2">`. Inside: a `<textarea>` with `rows={1}`, `aria-label="Type a message"`, auto-grow up to `max-h-[6rem]` via `style={{ height: 'auto' }}` + onInput resize. Send button: `<button type="button" disabled={disabled || !value.trim()} aria-label="Send message" className="…"><Send className="h-4 w-4" /></button>`.
  - [x] 9.4 Keyboard handling: detect mobile via `window.matchMedia('(hover: none)').matches` (use `useState`-cached value computed once at mount). On hover device: Enter → send (preventDefault + call `handleSend`); Shift+Enter → newline. On mobile: Enter → newline always; only Send button submits.
  - [x] 9.5 `handleSend()` — clear `value` optimistically; call `await onSend(value)`; if it throws, restore `value` and surface inline error below the composer.

- [x] **Task 10: Persona pill + persona-info sheet (AC: 7, 13)**
  - [x] 10.1 Inside `MobileChatScreen.tsx`, render the persona pill in the header: `<button type="button" onClick={() => setPersonaSheetOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-card/60 border border-border/40 px-2.5 py-1 text-xs"><span className={cn('h-2 w-2 rounded-full', persona.dot)}/><span className="text-foreground">{persona.displayName}</span></button>`.
  - [x] 10.2 Mount `<MobileSheet open={personaSheetOpen} onOpenChange={setPersonaSheetOpen} snapPoint="fit" title="Agent persona" description={\`\${persona.displayName} — \${persona.characterName || 'agent'}\`}>` containing a static read-only summary of the persona (icon + bio from `PERSONA_BIO` map).
  - [x] 10.3 Local `PERSONA_BIO: Record<string,string>` map with hardcoded short bios (e.g. `'bmad:bmm:agents:pm': 'Project Manager — focuses on requirements, PRDs, and roadmap planning.'`). Fall back to `''` for unknown keys.
  - [x] 10.4 No "switch persona" button. Sheet has a single dismiss action (close button in `MobileSheet`'s top bar).

- [x] **Task 11: Send + thinking indicator + invalidations (AC: 10, 11, 16)**
  - [x] 11.1 Inside `MobileChatScreen.tsx`, add `const sendChatMessage = useMutation({ mutationFn: ({ content }: { content: string }) => commands.sendChatMessage(sessionId, content).then(r => { if (r.status === 'error') throw new Error(JSON.stringify(r.error)); return r.data }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] }); queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] }) } })`.
  - [x] 11.2 `handleSend(content)` → `setIsAgentThinking(true)`; start a 120 s `setTimeout` to clear thinking; call `sendChatMessage.mutateAsync({ content })`; on resolve, do not clear thinking (let the message-arrival effect do it); on reject, clear thinking + clear timeout.
  - [x] 11.3 `useEffect([messages.length])` mirrors desktop `prevMessageCountRef` logic: when count grows AND last new message is `role === 'assistant'` AND no tool messages after it, clear thinking + clear timeout.
  - [x] 11.4 `prevMessageCountRef` reset to 0 on `sessionId` change to handle session resume correctly.

- [x] **Task 12: Tests (AC: 19)**
  - [x] 12.1 `src/mobile/planning/MobilePlanningHome.test.tsx` — empty state, session row render, sort order (thinking first), tap row → pushRoute, FAB tap → sheet opens, error state.
  - [x] 12.2 `src/mobile/planning/MobileSessionRow.test.tsx` — persona dot, display name, last message preview, relative time, live status badge, onTap.
  - [x] 12.3 `src/mobile/planning/LiveStatusBadge.test.tsx` — renders correct color/icon for each status; renders nothing for `'unknown'`/`undefined`; thinking has `animate-pulse`.
  - [x] 12.4 `src/mobile/planning/MobileNewSessionSheet.test.tsx` — renders 6 personas in canonical order; selecting a row calls `commands.createChatSession` then `onSessionCreated`; mutation in flight disables rows; error message renders inline.
  - [x] 12.5 `src/mobile/planning/MobileChatScreen.test.tsx` — back button calls popRoute; persona pill opens info sheet; composer disabled when empty; tapping Send calls `commands.sendChatMessage` and clears the input; thinking indicator appears after send and disappears when assistant message arrives; auto-scroll lock test (>100 px scroll up + new messages → "↓ N new" pill); reduced-motion test for `scrollTo`.
  - [x] 12.6 `src/mobile/planning/MobileChatBubble.test.tsx` — user vs assistant alignment + style; tool message collapsed/expanded.
  - [x] 12.7 `src/mobile/planning/MobileChatComposer.test.tsx` — send disabled when empty/whitespace; Send click clears input; Enter on hover device sends (mock matchMedia); Enter on mobile inserts newline.
  - [x] 12.8 Update `src/mobile/MobileApp.test.tsx`: assert `isFullScreenRoute('chat:abc') === true`; assert `'chat:abc'` route renders mocked `MobileChatScreen` with `sessionId="abc"`; assert `tabBar` is absent for chat routes; deep-link integration: pre-set `tabStacks.planning = ['sessions', 'chat:abc']` and assert chat screen renders.
  - [x] 12.9 Mock surface: `vi.mock('@renderer/lib/rspc', () => ({ commands: { listChatSessionsWithPreview: vi.fn(), createChatSession: vi.fn(), getChatMessages: vi.fn(), sendChatMessage: vi.fn() } }))`. Mock `@tauri-apps/api/event` `listen`. Mock `@renderer/components/planning/ChatWorkingIndicator` to a simple `<div data-testid="chat-working-indicator">` stub. Mock `@renderer/components/task/MarkdownComponents` to `{ markdownComponents: {} }`. Mock `@renderer/components/ui/code-block` to a passthrough `<pre>{children}</pre>`. Mock `useMobileNavStore` for popRoute / pushRoute assertions.
  - [x] 12.10 Total ≥17 new tests; pre-existing failure count unchanged from T3.5-4 baseline.

- [x] **Task 13: Token discipline + a11y audit (AC: 17, 18, 20, 21)**
  - [x] 13.1 `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]" src/mobile/planning/` → expected matches ONLY inside `LiveStatusBadge.tsx` `LIVE_STATUS_CONFIG` constant (cyan / emerald / zinc / amber). Document this exception in code comment + Dev Notes.
  - [x] 13.2 `grep -REn "from '@renderer/components/planning/(ChatPanel|ChatSessionList|ChatMessageArea|ChatMessageBubble|ChatInput|ChatPersonaSelector|MobileSessionDrawer)'" src/mobile/planning/` → assert zero matches.
  - [x] 13.3 `grep -REn "from '@renderer/stores/(planning-workspace|chat)\\.store'" src/mobile/planning/` → assert zero matches.
  - [x] 13.4 All interactive elements have `aria-label` or accessible text. `MobileSheet` `title` is set (Radix Dialog will assign aria-labelledby); `description` set where applicable.
  - [x] 13.5 No new files modified outside `src/mobile/planning/` and `src/mobile/MobileApp.tsx` and tests. Confirm via `git diff --stat` after implementation.

- [x] **Task 14: Lint, typecheck, regression (AC: 18, 19, 21)**
  - [x] 14.1 `npx tsc --noEmit` — zero new TypeScript errors in `src/mobile/planning/` and `src/mobile/MobileApp.tsx`.
  - [x] 14.2 `npm test` — pre-existing failure count unchanged from T3.5-4 baseline; all new tests pass.
  - [x] 14.3 Manual smoke: deferred to reviewer (Tailscale Android dev — verify session list polls, chat opens, message sends, deep link `tinsu://chat/<id>` resolves to chat screen).
  - [x] 14.4 Manual smoke on Android: deferred to reviewer per T3.5-9 gate (composer reaches above soft keyboard; auto-scroll lock; reduced-motion).

## Dev Notes

### MUST USE /frontend-design skill (CLAUDE.md mandate)

This is a **🎨 FRONTEND/UI STORY**. Before writing any TSX, the dev agent MUST invoke `/frontend-design` with: tech stack (React 19 / TypeScript / Tailwind v4 / shadcn / @radix-ui / Lucide), the AC matrix below, the Calm Command token list (`src/globals.css`), and the existing primitive surface (`MobileTopAppBar`, `MobileSheet`, `MobileFab`, `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `MobileChip`). Pass the cross-tree allowlist (`ChatWorkingIndicator`, `markdownComponents`, `CodeBlock`, `AGENT_PERSONA_CONFIG`) so the skill knows which desktop dependencies are reusable. Integrate the skill's output verbatim where viable; do not write screen TSX from scratch without it.

### Why this story exists (do not skip)

After T3.5-4 the mobile app has Board → Task Workspace working end-to-end. The Planning tab is still a placeholder (`MobilePlanningHome` renders a Compass icon and "Coming in T3.5-5"). On phone the founder cannot resume a planning conversation, cannot send a message, cannot see assistant streams — Planning is the second-most-critical mobile flow after Board → Workspace. This story closes that gap by implementing the **session list root** + **full-screen chat push** described in the UX redesign §5.

The implementation **reuses every backend artifact unchanged**:
- Same `commands.listChatSessionsWithPreview / createChatSession / getChatMessages / sendChatMessage` Tauri commands.
- Same `chat:message-received` Tauri event.
- Same `AGENT_PERSONA_CONFIG` color/name mapping from `@renderer/constants/planning-workspace`.
- Same `ChatWorkingIndicator` thinking-dots component.
- Same `markdownComponents` + `CodeBlock` for assistant message rendering.

The mobile UI is **forked at the surface only** — rows, bubbles, composer, sheet — because mobile UX patterns (sticky composer, single-column session list, full-screen chat push, FAB) are different enough from the desktop 3-region split that sharing UI components would constrain both. The cross-tree allowlist (AC 17) makes this discipline strict.

### Key architectural decisions (locked, do NOT redebate)

- **Reuse `ChatWorkingIndicator`, `markdownComponents`, `CodeBlock`, `AGENT_PERSONA_CONFIG`.** These are mobile-safe (no desktop-specific layout assumptions). Do **NOT** reuse `ChatPanel`, `ChatSessionList`, `ChatMessageArea`, `ChatMessageBubble`, `ChatInput`, or `ChatPersonaSelector` — those are desktop-shaped and are the surface-area fork.
- **Session list IS the planning tab root.** No separate `MobileSessionListScreen.tsx`. The architecture doc lists both `MobilePlanningHome.tsx` and `MobileSessionListScreen.tsx`, but for v1 we collapse them into one file. Future stories (BMAD workflow pill from UX §5.4) can introduce the BMAD step pill above the session list inside `MobilePlanningHome.tsx` without renaming.
- **Mid-session persona switch is disabled.** The persona pill in chat header opens a **read-only** info sheet (per UX §3.2 + CTM-2.1 contract). The pill is tappable but does NOT mutate session persona. This avoids the persona-switch race-guard complexity from desktop ChatPanel (which uses `sessionPersonaRef` to discard sessions when persona changes mid-flight); the mobile chat screen never changes persona on an existing session, so no race exists.
- **Chat screen is a full-screen push (no bottom tab bar).** Mobile-native pattern — same as workspace push from T3.5-4. Extends `isFullScreenRoute()` to match `chat:` prefix.
- **No tool-activity expansion (AC 9 tool branch is collapsed-only in v1).** Desktop's `ChatToolActivityCard` is rich; the mobile bubble's tool branch shows "🔧 Tool: name" + chevron + collapsed JSON. Tool list virtualization, group cards, full-fidelity tool UI = future story.
- **Message virtualization deferred — last 200 only.** Real-world planning sessions rarely exceed 200 messages; if they do, scroll perf is acceptable. T3.5-9 (real-device validation) may require we revisit; if so, that story owns the change.
- **No artifact-detection notification on mobile (Story 10.7).** The desktop `ChatArtifactNotification` is out of scope for v1. The hook-listener still emits artifact events; the mobile chat does not surface them. Future story.
- **No keyboard shortcuts overlay (Story 9.9 / desktop).** Mobile keyboard is the soft keyboard; no `?` overlay. The Send button is the only submit affordance on touch devices.
- **`live_status` from preview row, not from a separate query.** Desktop calls `commands.listChatSessionsWithPreview` which already includes `live_status` (CTM-2.3). Mobile reuses that — no separate `getSessionLiveStatus` call.

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** import `ChatPanel`, `ChatSessionList`, `ChatMessageArea`, `ChatMessageBubble`, `ChatInput`, `ChatPersonaSelector`, `ChatToolActivityCard`, `ChatToolActivityGroup`, `ChatSessionContextMenu`, `ChatArtifactNotification`, `MobileSessionDrawer`, `WhatNextPanel`, `WorkflowRunPanel`, `PhaseProgressDashboard`, `ReadinessGatePanel`, `ArtifactViewer`, `ArtifactDiffView`, `ArtifactVersionHistory`, `RecentRunsTable`, `SessionDocumentsBar`, `SessionDocumentViewer`, `KeyboardShortcutsOverlay`, `AutocompleteDropdown`, `AgentPersonaIndicator`, `ChatSessionUsage`, `ChatTerminal`. **All of those are desktop-only.**
2. **DO NOT** import or use `usePlanningWorkspaceStore` — it owns desktop-only state (active sessions, sheet states, target chat session for navigation). Mobile uses `useMobileNavStore` for navigation and screen-local React state for everything else.
3. **DO NOT** import or wire artifact notifications — Story 10.7 is desktop-only for now.
4. **DO NOT** call `commands.setSessionPersona` (no such API exists in this story's allowlist) or any persona-mutation. Mid-session persona switch is intentionally disabled.
5. **DO NOT** modify `parseDeepLink` or `navigateToDeepLink` in `src/mobile/shell/`. The deep-link table is correct.
6. **DO NOT** modify `mobile-nav.store.ts` — `popRoute()`, `pushRoute()`, `handleBackPress()` already do the right thing for chat routes.
7. **DO NOT** rename `MobilePlanningHome` — the architecture doc lists this exact filename; the existing route renderer maps `'sessions'` to it.
8. **DO NOT** create `MobileSessionListScreen.tsx` even though the architecture doc lists it. v1 collapses session list into `MobilePlanningHome.tsx` to keep file count minimal. (If a future story needs to split, that story owns the rename.)
9. **DO NOT** introduce a global `isAgentThinking` Zustand store — keep it as screen-local React state in `MobileChatScreen.tsx`. When user navigates away, indicator state can reset (acceptable v1).
10. **DO NOT** auto-scroll on every render — only when `messages.length` increased AND `isAtBottomRef.current === true`. Otherwise the user gets jerked to the bottom while reading old messages.
11. **DO NOT** use a wheel-event or pointer-event handler for swipe gestures inside the chat — the chat is vertical scroll only. No horizontal pager. (Workspace's pager pattern from T3.5-4 does NOT apply here.)
12. **DO NOT** use `key={messages.length}` on the message list — that unmounts the list every time a message arrives. Use `key={msg.id}` on each `<MobileChatBubble>`.
13. **DO NOT** mount the `chat:message-received` listener inside the bubble component — it must live in `MobileChatMessageList.tsx` (one listener per chat screen, not one per bubble).
14. **DO NOT** call `commands.killChatSession` from this story — session lifecycle is owned by CTM-2.2 and is invisible to the mobile UI.
15. **DO NOT** introduce date-fns or moment for relative time. Implement a local `formatRelativeTime` mirroring `ChatSessionList.tsx` lines 38–62 — pure JavaScript, zero deps.
16. **DO NOT** modify any file under `src/components/`, `src/hooks/`, `src/stores/`, `src-tauri/`. The cross-tree allowlist (AC 17) is **strict imports only**. The only file outside `src/mobile/planning/` you may modify is `src/mobile/MobileApp.tsx` (route renderer + `isFullScreenRoute`).
17. **DO NOT** add `role="log"` or `aria-live="polite"` to the message list without testing — Radix may already manage this. Verify before adding ARIA roles.
18. **DO NOT** rely on `useIsMobile()` or any responsive branching — mobile code lives in `src/mobile/`; desktop code lives in `src/components/`. They never share a render tree (CLAUDE.md mobile-tree-not-branch rule).
19. **DO NOT** assert against desktop test IDs (`chat-panel-root`, `chat-message-area`, `chat-input`). Mobile uses `mobile-planning-home`, `mobile-chat-screen`, `mobile-planning-new-session-sheet`, etc.
20. **DO NOT** call `setIsAgentThinking(false)` directly when send mutation resolves — the assistant message arrival is what clears thinking (mirroring desktop). Send resolution only confirms the user message is queued.
21. **DO NOT** introduce `framer-motion`, `react-spring`, `embla-carousel`, `swiper`, `react-virtual`, `react-window` — not needed. Native CSS + scroll events are sufficient.
22. **DO NOT** import `ChatPanel.tsx`'s internal `prevMessageCountRef` logic verbatim by copy-pasting 50 lines — extract just the message-arrival rule (`messages.length > prev` + last message is assistant + no tool after) and inline it. Keep the mobile screen lean.

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `react`, `react-dom` | 19 (already in project) | Components | n/a |
| `@tanstack/react-query` v5 | already in project | sessions, messages, send via `useQuery`/`useMutation` | n/a |
| `@radix-ui/react-dialog` | already in project (via `MobileSheet`) | new-session sheet, persona-info sheet | reuse `MobileSheet` |
| `lucide-react` | `^0.562.0` already | `Plus`, `Send`, `MoreVertical`, `ChevronDown`, `Compass`, `Activity`, `Circle`, `CheckCircle2`, `XCircle` | no new icons needed |
| `tailwindcss` | `^4.1.18` already | Calm Command tokens | no inline colors except `LIVE_STATUS_CONFIG` exception (AC 20) |
| `react-markdown` + `remark-gfm` | already in project | assistant message body | reuse `markdownComponents` from desktop |
| `@tauri-apps/api/event` | already in project | `listen('chat:message-received')` | n/a |
| `vitest` + `@testing-library/react` | already in project | tests | n/a |

**No new dependencies are required.** If you reach for `react-chat-elements`, `@chatscope/chat-ui-kit-react`, `tailwind-chat`, etc. — **STOP**. Built primitives are sufficient.

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/mobile/planning/MobileSessionRow.tsx
src/mobile/planning/MobileSessionRow.test.tsx
src/mobile/planning/LiveStatusBadge.tsx
src/mobile/planning/LiveStatusBadge.test.tsx
src/mobile/planning/MobileNewSessionSheet.tsx
src/mobile/planning/MobileNewSessionSheet.test.tsx
src/mobile/planning/MobileChatScreen.tsx
src/mobile/planning/MobileChatScreen.test.tsx
src/mobile/planning/MobileChatMessageList.tsx
src/mobile/planning/MobileChatBubble.tsx
src/mobile/planning/MobileChatBubble.test.tsx
src/mobile/planning/MobileChatComposer.tsx
src/mobile/planning/MobileChatComposer.test.tsx
src/mobile/planning/MobilePlanningHome.test.tsx   (new test for the rewritten file)
```

**Files this story modifies:**

```
src/mobile/planning/MobilePlanningHome.tsx        (replace placeholder body with real session list)
src/mobile/MobileApp.tsx                          (extend isFullScreenRoute + chat: route branch)
src/mobile/MobileApp.test.tsx                     (update placeholder assertion + add chat-route + isFullScreenRoute tests + deep-link integration test)
```

**Files this story may NOT modify (regression guard, AC 18):**

```
src/components/**                                 (desktop tree — read-only imports per allowlist)
src/hooks/**                                      (read-only)
src/stores/**                                     (read-only)
src/mobile/board/**                               (T3.5-3 contract; no edits)
src/mobile/tasks/**                               (T3.5-4 contract; no edits)
src/mobile/primitives/**                          (T3.5-2 contract; no edits)
src/mobile/shell/**                               (T3.5-1 contract; no edits)
src/mobile/dev/**                                 (DEV harness; no edits)
src/mobile/activity/**                            (T3.5-8 owns)
src/mobile/settings/**                            (T3.5-8 owns)
src/mobile/ssh/**                                 (T3.5-7 owns)
src/mobile/review/**                              (T3.5-6 owns)
src-tauri/**                                      (no Rust changes)
```

### Testing requirements

- **Unit tests** colocated next to each new component:
  - `MobilePlanningHome.test.tsx` — ≥4 tests covering AC 19 (a)–(b), (c), (d)
  - `MobileSessionRow.test.tsx` — ≥3 tests covering AC 19 (b)
  - `LiveStatusBadge.test.tsx` — ≥3 tests
  - `MobileNewSessionSheet.test.tsx` — ≥3 tests covering AC 19 (e)
  - `MobileChatScreen.test.tsx` — ≥6 tests covering AC 19 (g)–(h), (k)–(p)
  - `MobileChatBubble.test.tsx` — ≥3 tests covering AC 19 (i)
  - `MobileChatComposer.test.tsx` — ≥3 tests covering AC 19 (k)
  - `MobileApp.test.tsx` updates — ≥3 new tests covering AC 19 (f), (q)
- **Total ≥17 new tests** (AC 19 floor). Higher is better.
- **Mock pattern** for `@renderer/lib/rspc`:
  ```ts
  vi.mock('@renderer/lib/rspc', () => ({
    commands: {
      listChatSessionsWithPreview: vi.fn(),
      createChatSession: vi.fn(),
      getChatMessages: vi.fn(),
      sendChatMessage: vi.fn(),
    }
  }))
  ```
  Per-test override: `(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({ status: 'ok', data: [...] })`.
- **Mock pattern** for `@tauri-apps/api/event`:
  ```ts
  vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))
  ```
  To assert the callback fires, capture the listener: `const listenMock = vi.mocked(listen); const cb = listenMock.mock.calls[0]?.[1]; cb?.({ payload: { session_id: 'abc' } } as any)`.
- **Mock pattern** for `useMobileNavStore`: spy on `popRoute` / `pushRoute` to assert navigation.
- **Mock pattern** for cross-tree components:
  ```ts
  vi.mock('@renderer/components/planning/ChatWorkingIndicator', () => ({
    ChatWorkingIndicator: () => <div data-testid="chat-working-indicator" />
  }))
  vi.mock('@renderer/components/task/MarkdownComponents', () => ({ markdownComponents: {} }))
  vi.mock('@renderer/components/ui/code-block', () => ({ CodeBlock: ({ children }: any) => <pre>{children}</pre> }))
  ```
- **Reduced-motion test**: mock `window.matchMedia` to return `matches: true` for `(prefers-reduced-motion: reduce)` — match `MobileFab.test.tsx` / `MobileTaskWorkspaceScreen.test.tsx` patterns.
- **Auto-scroll lock test**: assign `Object.defineProperty(messageScrollRef, 'scrollTop', { value: 0, configurable: true })`; assign `Object.defineProperty(…, 'scrollHeight', { value: 1000 })`, `'clientHeight', { value: 600 }`; dispatch `scroll` event; assert "↓ N new" pill appears.
- **Coverage target:** ≥80 % line coverage on new files in `src/mobile/planning/`.
- **Manual smoke on Android (Tailscale)**: deferred to reviewer per T3.5-9 gate — verify session list polls, chat opens, message sends, deep link `tinsu://chat/<id>` resolves to chat screen, composer reaches above soft keyboard.
- **No e2e tests** (TEA territory, deferred to T3.5-9).

### Project Structure Notes

- `src/mobile/planning/` already exists and contains only `MobilePlanningHome.tsx` (a T3.5-1 placeholder). New files colocated here.
- The architecture doc (`architecture.md` §"`src/mobile/` Directory Structure" line 386) lists `MobilePlanningHome`, `MobileSessionListScreen`, `MobileChatScreen`, `MobileChatBubble`, `MobileChatComposer`, `MobileNewSessionSheet`, `MobilePersonaPicker`, `MobileBmadWorkflowSheet` under `src/mobile/planning/`.
  - We **collapse** `MobileSessionListScreen` into `MobilePlanningHome` (one screen, not two, in v1 — fewer files, simpler routing).
  - We **collapse** `MobilePersonaPicker` into `MobileNewSessionSheet`'s body (one sheet, not two).
  - We **defer** `MobileBmadWorkflowSheet` (the BMAD step pill from UX §5.4) to a follow-up story — v1 ships without the workflow pill at the top of the session list. The pill can be added inside `MobilePlanningHome.tsx` later without renaming.
  - The actual filenames we ship: `MobilePlanningHome.tsx` (modified), `MobileSessionRow.tsx`, `LiveStatusBadge.tsx`, `MobileNewSessionSheet.tsx`, `MobileChatScreen.tsx`, `MobileChatMessageList.tsx`, `MobileChatBubble.tsx`, `MobileChatComposer.tsx`. Document this deviation from the architecture doc here.
- `MobileApp.tsx` route renderer needs the `chat:` branch + the `isFullScreenRoute` extension. Do **not** centralise route mapping into a separate file in this story — keep changes minimal (matches T3.5-4 precedent).
- The 5-tab bottom nav is **hidden** on the chat push (per AC 6 + `isFullScreenRoute` extension). This is the second mobile screen to use the full-screen push pattern (after T3.5-4 workspace).

### Previous story intelligence (T3.5-1 + T3.5-2 + T3.5-3 + T3.5-4)

- **T3.5-1** established the route renderer pattern (`MobileApp.tsx` switch case + `if (route.startsWith(...))` branches). Reuse this pattern; do NOT introduce a separate router.
- **T3.5-1** established `parseDeepLink('tinsu://chat/<id>')` → `{ tab: 'planning', stack: ['sessions', 'chat:<id>'] }`. Already correct; no changes needed.
- **T3.5-2** primitives: `MobileSheet` snap points are `'half' | 'full' | 'fit'`. Use `'fit'` for new-session sheet and persona-info sheet (content-driven height). `MobileFab` accepts `icon`, `aria-label`, `onClick`, `data-testid`. `MobileListItem` accepts `leading`, `title`, `subtitle`, `trailing`, `onPress` slots.
- **T3.5-2** **`MobileTopAppBar`** supports `backButton` (with `onClick`), `title` (string OR ReactNode), and `trailingActions` (ReactNode). Verify whether `title` accepts ReactNode for the persona pill — if so, embed; if not, render the chat header inline (mirror T3.5-4's workspace top bar fix).
- **T3.5-2** **`useReducedMotion()`** lives in `src/mobile/hooks/useReducedMotion.ts`. Use it for `scrollTo`'s `behavior` flag.
- **T3.5-2** `MobileBottomActionBar` is **not used** in chat — chat composer is its own custom row, not an action bar.
- **T3.5-4** established the full-screen-push pattern (workspace screen). Mirror exactly for the chat screen — `isFullScreenRoute()` returns true → `MobileApp.tsx` returns `<MobileRouteRenderer route={topRoute} />` directly without the root `MobileScreen` shell. Add `chat:` to the prefix check.
- **T3.5-4** established cross-tree import discipline: `@renderer/components/task/TaskTerminal`, etc. Mirror the strictness for planning: only `ChatWorkingIndicator`, `markdownComponents`, `CodeBlock`, `AGENT_PERSONA_CONFIG`, `useProjectStore`, `commands`. Forbid the rest.
- **CTM-2.3** session list pattern: `commands.listChatSessionsWithPreview` returns rows with `live_status` field; sort `thinking` first, then by `last_message_at` desc; poll every 2 s via `refetchInterval: 2000`. Mirror this exactly.
- **Story 10.5** thinking indicator: `ChatWorkingIndicator` accepts `agentPersona` (string) and `toolActivity` (`{ toolName, toolInput } | null`) props. Pass the current persona key (string) directly; for v1 pass `toolActivity = null` (no tool-activity tracking on mobile yet — future story).
- **Story 10.6** session resume: `commands.getChatMessages(sessionId, null, null)` returns full message list. `chat:message-received` Tauri event payload: `{ session_id: string }`. Already implemented; mobile just consumes.
- **Story 10.7** artifact notifications: `ChatArtifactNotification` is desktop-only for v1 — DO NOT include on mobile.
- **CTM-1.2** hook routing by tmux session name — invisible to mobile UI; no work needed.
- **Pre-existing failing tests:** Compare `npm test` line-for-line to T3.5-4 baseline (72 new T3.5-4 tests passing on top of pre-existing failures unchanged). Don't introduce new failures.
- **Test pattern**: `vitest` + `@testing-library/react`; colocated `.test.tsx`; `render` + `screen` + `fireEvent` + `act`. Match patterns in `MobileTaskWorkspaceScreen.test.tsx`, `MobileBoardScreen.test.tsx`.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Mobile screen location | `src/mobile/planning/` for all chat / session components | `architecture.md` §"`src/mobile/` Directory Structure" line 386 |
| Session-list root | `MobilePlanningHome.tsx` (existing file; replace body) | `epics.md` Story T3.5-5; `mobile-ux-redesign-plan-2026-04-30.md` §5.1 |
| Chat-screen route | `chat:<sessionId>` full-screen push (extend `isFullScreenRoute`) | `epics.md` Story T3.5-5; T3.5-4 precedent |
| Token discipline | Calm Command CSS vars only (no inline color classes EXCEPT `LIVE_STATUS_CONFIG` mirroring desktop UX-DR4) | `architecture.md` §"Mobile Primitive Contract" §1; `globals.css` |
| Touch targets | ≥44 pt iOS / ≥48 dp Android (back button, persona pill, FAB, send button, persona rows in sheet) | UX-DR7; `ux-design-specification-mobile.md` §"Accessibility Considerations" |
| A11y | Semantic HTML, `aria-label` on icon-only buttons, focus visible, no color-only signals | `architecture.md` §"Mobile Primitive Contract" §3; UX-DR6 |
| Safe-area | Composer respects `env(safe-area-inset-bottom)`; FAB respects `env(safe-area-inset-bottom)` via `MobileFab` primitive | `architecture.md` §"Mobile Primitive Contract" §4 |
| Reduced motion | Auto-scroll `behavior: 'auto'` when reduced; no haptics from screen | T3.5-2 contract |
| Persona switch | Mid-session persona switch DISABLED — pill is read-only info only | UX redesign §3.2; CTM-2.1 contract |
| Forbidden imports | NO imports from desktop `ChatPanel`, `ChatSessionList`, `ChatMessageArea`, `ChatMessageBubble`, `ChatInput`, `ChatPersonaSelector`, `MobileSessionDrawer`, `usePlanningWorkspaceStore` | this story AC 17 |
| Desktop preserved | NO edits to `src/components/**`, `src/hooks/**`, `src/stores/**`, `src-tauri/**`; mobile is parallel tree | CLAUDE.md, sprint-change-proposal-2026-04-30.md |
| Route ownership | `chat:` branch lives in `MobileApp.tsx` route renderer; not in a separate router file | this story AC 6, T3.5-4 precedent |

### Git intelligence (recent commit patterns)

```
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
c8148ab docs(course-correction): mobile UX native redesign — parallel tree (Epic 3.5)
24dfc4a fix android build
f8ec1e6 fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile
43a6488 fix: [t3-7] SSH form UX + [t3-2/t3-3/t3-5] mobile UI improvements
```

- The latest course-correction commits (`cd023c2`, `c8148ab`) are the authoritative source for the parallel-tree decision and the cross-tree import discipline.
- Read T3.5-4's commits (look for `t3-5-4` in `git log`) to understand the workspace full-screen push pattern. The chat full-screen push mirrors it.
- Read `src/mobile/MobileApp.tsx` to see the existing `isFullScreenRoute` helper + `MobileRouteRenderer`. The chat branch slots in next to the workspace branch.

### Latest technical specifics

- **React 19** is adopted. `useId`, `use()`, `useTransition` available; only adopt where natural.
- **Tailwind v4** uses `@theme inline` (already wired). Token vars: `--background`, `--card`, `--primary`, `--muted-foreground`, `--border`. Prefer `bg-card/95 backdrop-blur-xl` for elevated surfaces (matches T3.5-2 primitives).
- **`@tanstack/react-query` v5** + Tauri rspc commands: results return `{ status: 'ok' | 'error', data?, error? }` discriminated union — match desktop's pattern of throwing in queryFn when `status === 'error'`.
- **`@radix-ui/react-dialog`** (via `MobileSheet`): the sheet auto-portals to `document.body`, focus-traps, Esc-dismisses. Don't reimplement.
- **`react-markdown` + `remark-gfm`** are bundled via `markdownComponents`. Reuse the export from `@renderer/components/task/MarkdownComponents`. If you must direct-import (e.g. for unique props), document the trade-off in Dev Notes (mirrors T3.5-4 AC 16 alt path).
- **`@tauri-apps/api/event`** `listen` returns a Promise of an unlisten function. Always store and call it on cleanup.
- **CSS `env(safe-area-inset-bottom)`** is supported by Tauri WebView on iOS and Android. Use `pb-[max(env(safe-area-inset-bottom),0.5rem)]` for the composer to clear the home indicator and gesture area.
- **Soft keyboard detection:** `window.matchMedia('(hover: none)').matches` is the modern way to detect touch-only devices. Avoid user-agent sniffing.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (Epic 3.5 charter; T3.5-5 success criteria — line 216)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T3.5-5-Mobile-Planning] (canonical AC source — lines 1027–1046)
- [Source: _bmad-output/planning-artifacts/architecture.md#src-mobile-Directory-Structure] (canonical screen + component locations — lines 385–393)
- [Source: _bmad-output/planning-artifacts/architecture.md#Migration-Sequence-Rollback] (T3.5-5 placement — line 595)
- [Source: _bmad-output/planning-artifacts/architecture.md#Deep-Link-Routing-Table] (deep-link table — `tinsu://chat/<id>` → planning tab)
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (token, touch-target, a11y, safe-area, reduced-motion rules)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#3.2] (Planning Workspace mobile decisions — session list root, full-screen chat, mid-session persona switch disabled)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#5] (Planning Workspace Mobile Design — full §5.1 architecture, §5.2 session list, §5.3 chat screen, §5.4 BMAD workflow access (deferred), §5.5 new session flow)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#7.2] (component LOC estimates — primitives reused)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Visual-Design-Foundation] (typography + tokens)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Accessibility-Considerations] (UX-DR6, UX-DR7)
- [Source: _bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md] (shell + nav store + route renderer + deep-link parser)
- [Source: _bmad-output/implementation-artifacts/t3-5-2-mobile-primitives-library.md] (primitive contracts: `MobileSheet`, `MobileFab`, `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `MobileTopAppBar`, `useReducedMotion`)
- [Source: _bmad-output/implementation-artifacts/t3-5-4-mobile-task-workspace.md] (full-screen push pattern; cross-tree import discipline; segmented tabs not used here but pattern principles apply)
- [Source: src/mobile/MobileApp.tsx] (route renderer; this story modifies `isFullScreenRoute` and the `chat:` branch)
- [Source: src/mobile/shell/mobile-nav.store.ts] (`popRoute`, `pushRoute`, `handleBackPress`, `navigateToDeepLink` — DO NOT modify)
- [Source: src/mobile/shell/deeplinks.ts] (`parseDeepLink` — `tinsu://chat/<id>` already correct; DO NOT modify)
- [Source: src/mobile/primitives/MobileSheet.tsx] (snap-point + a11y + Radix Dialog wiring)
- [Source: src/mobile/primitives/MobileFab.tsx] (FAB primitive — safe-area + haptic self-gating)
- [Source: src/mobile/primitives/MobileListItem.tsx] (list-row primitive — leading/title/subtitle/trailing slots)
- [Source: src/mobile/primitives/MobileTopAppBar.tsx] (back button + title + trailing actions contract)
- [Source: src/mobile/primitives/MobileEmptyState.tsx] (empty-state shape)
- [Source: src/mobile/primitives/MobileLoadingSkeleton.tsx] (skeleton variants)
- [Source: src/mobile/hooks/useReducedMotion.ts] (reduced-motion gating hook)
- [Source: src/components/planning/ChatPanel.tsx] (desktop reference: send mutation pattern; `chat:message-received` listener pattern; thinking-indicator-clearing logic — mirror, do NOT import)
- [Source: src/components/planning/ChatSessionList.tsx] (desktop reference: `formatRelativeTime` helper + `LIVE_STATUS_CONFIG` — mirror, do NOT import)
- [Source: src/components/planning/ChatPersonaSelector.tsx] (desktop reference: `CHAT_PERSONAS` ordered list — mirror, do NOT import)
- [Source: src/components/planning/ChatWorkingIndicator.tsx] (cross-tree allowed: thinking indicator with persona display)
- [Source: src/components/task/MarkdownComponents.tsx] (`markdownComponents` export; cross-tree allowed)
- [Source: src/components/ui/code-block.tsx] (cross-tree allowed: syntax-highlighted code block)
- [Source: src/constants/planning-workspace.ts] (`AGENT_PERSONA_CONFIG`, `getAgentPersona`, `type AgentPersonaConfig`; cross-tree allowed)
- [Source: src/lib/rspc.ts] (`commands` client; `commands.listChatSessionsWithPreview`, `commands.createChatSession`, `commands.getChatMessages`, `commands.sendChatMessage`)
- [Source: src/stores/project.store.ts] (`useProjectStore`; cross-tree allowed)
- [Source: src/shared/types/chat.types.ts] (`ChatMessageAttachment` and related types)
- [Source: src/globals.css] (Calm Command token definitions)
- [Source: CLAUDE.md] (`/frontend-design` mandate; mobile-tree-not-branch rule)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TS check: `npx tsc --noEmit` — zero new errors in `src/mobile/planning/` and `src/mobile/MobileApp.tsx`
- Token discipline: `grep -REn "text-(red|green|blue|orange|...)" src/mobile/planning/` — matches ONLY inside `LiveStatusBadge.tsx` LIVE_STATUS_CONFIG constant (AC 20 exception confirmed)
- Forbidden imports: `grep -REn "from '@renderer/components/planning/(ChatPanel|ChatSessionList...)"` — zero matches
- Forbidden stores: `grep -REn "from '@renderer/stores/(planning-workspace|chat)\\.store'"` — zero matches
- Test run: all 289 mobile tests pass across 34 test files; pre-existing failures in `src/stores/`, `src/components/`, `src/hooks/`, `src/pages/` confirmed pre-existing (unchanged from T3.5-4 baseline)

### Completion Notes List

- Task 1: Replaced `MobilePlanningHome` placeholder with real session list — `useQuery` polling every 2s, `sortSessions` (thinking first then by `last_message_at` desc), `MobileFab` + `MobileNewSessionSheet` wired, empty/loading/error states, all test IDs present
- Task 2: `MobileSessionRow` — local `ChatSessionListItemPreview` interface, local `formatRelativeTime` (mirrors ChatSessionList.tsx), persona fallback to 'general', `MobileListItem` with dot + displayName + preview + timestamp + LiveStatusBadge
- Task 3: `LiveStatusBadge` — `LIVE_STATUS_CONFIG` duplicated from desktop (mobile-tree-decoupling comment), returns null for unknown/undefined, thinking has `animate-pulse`
- Task 4: `MobileNewSessionSheet` — `CHAT_PERSONAS` const (intentional duplicate), `useMutation` calling `commands.createChatSession`, inline error state, rows disabled while `isPending`
- Task 5: `MobileApp.tsx` wired — `isFullScreenRoute` extended for `chat:` prefix, `MobileChatScreen` imported + chat route branch added, `MobileApp.test.tsx` updated with mock + new describe block (3 tests)
- Task 6: `MobileChatScreen` shell — inlined `<header>` (MobileTopAppBar has `title?: string` string-only, cannot accept ReactNode persona pill), back button with `data-testid="mobile-chat-back-button"`, persona pill, persona-info sheet, isAgentThinking + thinkingTimeoutRef (120s safety), `prevMessageCountRef`
- Task 7: `MobileChatMessageList` — `useQuery(['chat-messages', sessionId])` + Tauri `listen('chat:message-received')` with isMounted guard, auto-scroll lock (>100px = lock, <50px = unlock), floating "↓ N new" pill, messages sliced to last 200, `ChatWorkingIndicator` cross-tree import
- Task 8: `MobileChatBubble` — user right-aligned (bg-primary/15), assistant left-aligned (bg-card + ReactMarkdown + remark-gfm), tool collapsed button + expand on click
- Task 9: `MobileChatComposer` — `isTouchOnlyRef` cached once at mount, auto-grow textarea, optimistic clear with error restore, safe-area `pb-[max(env(safe-area-inset-bottom),0.5rem)]`
- Task 10: Persona pill + persona-info sheet — `PERSONA_BIO` local map, read-only sheet, no switch action
- Task 11: Send + thinking indicator — `sendChatMessage` useMutation with dual invalidation (`['chat-messages', sessionId]` + `['chat-sessions-preview', projectId]`), 120s safety timeout, `prevMessageCountRef` logic
- Task 12: 53 new tests across 7 new test files + 3 updated tests in `MobileApp.test.tsx` (well above ≥17 floor)
- Task 13: Token discipline + a11y audit passed — all greps confirmed clean
- Task 14: TypeScript clean, all tests pass, manual smoke deferred to reviewer per AC

### File List

**New files:**
- `src/mobile/planning/LiveStatusBadge.tsx`
- `src/mobile/planning/LiveStatusBadge.test.tsx`
- `src/mobile/planning/MobileSessionRow.tsx`
- `src/mobile/planning/MobileSessionRow.test.tsx`
- `src/mobile/planning/MobileNewSessionSheet.tsx`
- `src/mobile/planning/MobileNewSessionSheet.test.tsx`
- `src/mobile/planning/MobileChatScreen.tsx`
- `src/mobile/planning/MobileChatScreen.test.tsx`
- `src/mobile/planning/MobileChatMessageList.tsx`
- `src/mobile/planning/MobileChatBubble.tsx`
- `src/mobile/planning/MobileChatBubble.test.tsx`
- `src/mobile/planning/MobileChatComposer.tsx`
- `src/mobile/planning/MobileChatComposer.test.tsx`
- `src/mobile/planning/MobilePlanningHome.test.tsx`

**Modified files:**
- `src/mobile/planning/MobilePlanningHome.tsx` (replaced placeholder body with real session list)
- `src/mobile/MobileApp.tsx` (extended `isFullScreenRoute` + `chat:` route branch + `MobileChatScreen` import)
- `src/mobile/MobileApp.test.tsx` (added `MobileChatScreen` + `MobilePlanningHome` mocks, updated chat-route assertions, added 3-test describe block)

### Review Findings

- [x] [Review][Patch] Composer error `<p>` uses `absolute` without `relative` on parent container [`src/mobile/planning/MobileChatComposer.tsx:95`] — **Fixed**: added `relative` to outer `<div>` so `bottom-full` positions correctly above the composer bar. All 78 tests still passing.
- [x] [Review][Dismiss] Redundant `chat-messages` query in `MobileChatScreen` (lines 65–75) — React Query deduplicates same-key queries; no functional problem. Minor comment inaccuracy ("to infer persona") acceptable in v1.
- [x] [Review][Dismiss] `data-testid` spread via `as any` cast in `MobileNewSessionSheet` — `MobileListItem` does not expose `data-testid` prop in its interface; this is a correct workaround. Tests pass.
- [x] [Review][Dismiss] Direct color classes (`text-green-400`, `bg-green-400`, `bg-green-500/20`) in test mock fixtures — these are `AgentPersonaConfig` mock values mirroring the real config shape, not UI styling. AC 20 applies to production UI code only.
