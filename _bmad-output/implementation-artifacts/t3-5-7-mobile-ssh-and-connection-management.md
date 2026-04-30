# Story 3.5.7: Mobile SSH and Connection Management

Status: done

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a mobile-native SSH connection flow with a full-screen list, full-screen add/edit form, a `MobileSheet`-based key picker, an inline test-connection result, and a generate-key sheet,
so that I can add, test, edit, and remove remote connections one-handed on a phone — without ever seeing a desktop-shaped `Dialog`/`Select` or the cramped `MobileSshConnectionForm` desktop component, and so the founder can recover from "no keys / wrong key / wrong host" errors without leaving the screen.

## Acceptance Criteria

1. **Given** the mobile shell from T3.5-1 + T3.5-2 and the existing `if (route === 'connections')` placeholder branch in `src/mobile/MobileApp.tsx` (lines 193–200, currently rendering `<MobileEmptyState title="Connections" subtitle="Coming in T3.5-7 — SSH connection management."/>`), **When** the active route on any tab matches the literal string `'connections'`, **Then** the placeholder branch in `MobileRouteRenderer` MUST be **replaced** by `return <MobileConnectionsListScreen />` AND the screen MUST render inside the standard `MobileScreen` shell (i.e. `'connections'` is **NOT** added to `isFullScreenRoute()` — the connections list keeps the bottom tab bar). **Test ID:** screen root `data-testid="mobile-connections-screen"`.

2. **Given** the user opens an SSH connection for add or edit, **When** they navigate to the form, **Then** the form route is `connection-form:new` (for add) or `connection-form:<connectionId>` (for edit) AND `isFullScreenRoute()` MUST return `true` for any route starting with `connection-form:` (extend the existing prefix check to: `route.startsWith('workspace:') || route.startsWith('chat:') || route.startsWith('review:') || route.startsWith('connection-form:')`). The form screen owns its own chrome (header with back button + title + Save trailing action) and **bypasses** the root `MobileScreen` shell + tab bar — matching the workspace / chat / review precedent. **Test ID:** screen root `data-testid="mobile-connection-form-screen"`. **Note:** UX redesign §3.6 line 325 calls the add flow a "bottom-sheet wizard"; we deviate to a **full-screen push** because (a) the existing `MobileSshConnectionForm` already renders as a full-page form (lines 181–415), (b) the form has 6+ required fields + nested install-key wizard which exceeds the half-sheet thumb-zone budget, (c) the workspace/chat/review screens already established the full-screen push pattern for action-required flows. This deviation is **locked**; document inline in `MobileConnectionFormScreen.tsx` JSDoc.

3. **Given** `MobileConnectionsListScreen` mounts, **When** the screen renders, **Then** the layout uses the root `MobileScreen` shell (top app bar + tab bar via the parent `MobileApp.tsx` shell — same pattern as `MobileTaskListScreen` and `MobileBoardScreen`) AND the screen body contains: (a) a `MobileTopAppBar` rendered by the parent shell — **the screen does NOT render its own top bar**; instead the screen exposes its title via the parent (the `connections` route is reached by `pushRoute('settings', 'connections')`, so when active the parent's `MobileTopAppBar` shows the project name as left slot — for v1 this is acceptable; T3.5-8 may revisit when settings owns its own dynamic title); (b) main scroll area listing connections via `MobileListItem` rows; (c) a floating `MobileFab` with `Plus` icon, `aria-label="Add connection"`, `data-testid="mobile-connections-fab"`, `onClick={() => useMobileNavStore.getState().pushRoute('settings', 'connection-form:new')}`. **Note:** the FAB lives inside the screen body, not the tab bar; `MobileFab` (T3.5-2) handles safe-area + position automatically.

4. **Given** the connections list mounts, **When** it queries connections, **Then** it MUST use `useListSshConnections()` from `@renderer/hooks/useSshCommands` (cross-tree allowed, AC 17). The hook returns `SshConnectionProfile[]` (no live status field — see AC 6 for the live-status strategy). When `isLoading`, render `<MobileLoadingSkeleton variant="row" />` ×4 stacked. When `error`, render `<MobileEmptyState title="Couldn't load connections" subtitle={errorMessage} />` with a Retry button that calls `queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })`. When `data.length === 0`, render `<MobileEmptyState title="No connections yet" subtitle="Add an SSH connection to start working on remote projects." />` with a primary CTA button "Add Connection" that pushes `connection-form:new`. **Do NOT** show the FAB simultaneously with the empty-state CTA (the empty-state owns the primary action); the FAB renders only when `data.length > 0`.

5. **Given** the connections list has data, **When** rows render, **Then** each connection renders as a `MobileListItem` with: (a) **leading** = a colored status dot (`<span className="h-2 w-2 rounded-full bg-{statusColor}" />`) where `statusColor` is derived from per-row test result state (AC 6) — `bg-emerald-500` (connected), `bg-amber-500` (testing), `bg-destructive` (error), `bg-muted-foreground/40` (idle/unknown); (b) **title** = `connection.host` (not `id` — host is human-readable); (c) **subtitle** = `${connection.username}@${connection.host}:${connection.port}` in `font-mono text-xs text-muted-foreground`; (d) **trailing** = a `ChevronRight` Lucide icon (`h-4 w-4 text-muted-foreground/60`); (e) `onPress={() => setActiveDetailConnectionId(connection.id)}` → opens `MobileConnectionDetailSheet` (AC 9). Each row has `data-testid={\`mobile-connection-row-${connection.id}\`}` and `aria-label={\`SSH connection \${connection.host}\`}`. Sort connections by `created_at` descending (newest first) — `[...connections].sort((a, b) => b.created_at - a.created_at)`.

6. **Given** the connections list renders rows, **When** the screen needs live connection status, **Then** the screen MUST keep a per-row local `Map<string, 'idle' | 'testing' | 'connected' | 'error'>` in `useState`. **There is NO dedicated rspc subscription** for connection status (the backend's `SshConnectionProfile` does not expose a status field — see `src/bindings.ts` lines 796–805). Instead: (a) on row mount the status is `'idle'` (gray dot); (b) the user can tap a row's "Test" affordance from the detail sheet (AC 9) — the test result updates the per-row map; (c) the detail sheet's swipe-actions (Edit/Delete) and Test button are the only interactions that change a row's status. **Do NOT** auto-test on mount (would spam the network on cold-start with N connections); deferred to T3.5-9 if a "background health-check" is desired. Document this v1 behavior in Dev Notes.

7. **Given** any connection row, **When** the user **swipes left** on the row, **Then** two action buttons reveal beneath the row: (a) **Edit** — `bg-primary/15 text-primary border border-primary/40 px-4 min-h-[2.75rem]`, label "Edit", `data-testid={\`mobile-connection-row-edit-${id}\`}`, `aria-label="Edit connection"`, on tap pushes `connection-form:<connectionId>`; (b) **Delete** — `bg-destructive/15 text-destructive border border-destructive/40 px-4 min-h-[2.75rem]`, label "Delete", `data-testid={\`mobile-connection-row-delete-${id}\`}`, `aria-label="Delete connection"`, on tap opens `MobileDeleteConfirmSheet` (AC 12). Use `framer-motion` is **NOT** allowed; instead implement swipe via plain `onPointerDown`/`onPointerMove`/`onPointerUp` handlers on the row wrapper that translate the row by `clamp(-160, deltaX, 0)` and reveal the action layer absolutely-positioned behind it. Threshold: if `|deltaX| > 80px`, snap to revealed state on pointer-up; otherwise snap back. Tapping anywhere outside the revealed row (including another row) auto-collapses the swipe state (track via shared local state `[swipedRowId, setSwipedRowId]`). Reduced-motion: skip the snap animation; just toggle revealed/hidden instantly. **Do NOT** add `react-swipeable`, `react-spring`, or `framer-motion` as new deps.

8. **Given** the user taps a connection row (no swipe), **When** the press fires, **Then** `MobileConnectionDetailSheet` opens as a `MobileSheet` (`snapPoint='fit'`, `title={connection.host}`, `description={\`\${connection.username}@\${connection.host}:\${connection.port}\`}`, `data-testid="mobile-connection-detail-sheet"`). The sheet body contains: (a) a metadata block — Host, Port, Username, Auth Method, Key Name (or "Password (test only)") rendered as label/value pairs (`text-xs uppercase tracking-widest text-muted-foreground` labels, `text-sm font-mono text-foreground` values, separated by `border-b border-border/40 py-3`); (b) a "Created" timestamp formatted via `new Date(connection.created_at * 1000).toLocaleString()`; (c) action buttons row with **Test Connection** (primary), **Edit** (secondary, navigates to `connection-form:<id>` and closes sheet), **Delete** (destructive, opens `MobileDeleteConfirmSheet`). Test Connection inline-runs `useTestSshConnection.mutateAsync({...})` with the connection's existing fields (no password field — saved connections are key-auth; if the saved connection's `auth_method === 'password'`, show a one-time password input field that mirrors the form's password input). Test result renders inline below the buttons as a token-styled banner: success → `bg-emerald-500/10 border-emerald-500/40 text-emerald-200` with fingerprint; error → `bg-destructive/10 border-destructive/40 text-destructive` with error message. On test fire, update the per-row status map (AC 6) so the list view's status dot reflects the result.

9. **Given** `MobileConnectionFormScreen` mounts (route `connection-form:new` or `connection-form:<id>`), **When** the screen renders, **Then** the layout is a custom flex column matching the workspace/review pattern: `<div className="flex flex-col h-[100dvh] bg-background" data-testid="mobile-connection-form-screen">` with three slots: (a) **header** — inline chrome mirroring `MobileTopAppBar` shape: back button on the left (`onClick: () => useMobileNavStore.getState().popRoute()`, `data-testid="mobile-connection-form-back-button"`, `aria-label="Back"`), the title in the middle ("New Connection" for new; "Edit Connection" for edit — derived from route), no trailing action (Save button lives in the bottom action bar, not the header — matches T3.5-5 chat pattern); (b) **scrollable body** — the form fields described in AC 10; (c) **bottom** — a sticky `MobileBottomActionBar` with primary "Save" button + secondary "Cancel" button (Cancel calls `popRoute()`). When in edit mode (route includes a connection id), the screen MUST fetch the connection via `useListSshConnections()` data and find by id; if not found, render `<MobileEmptyState title="Connection not found" />` with a back button.

10. **Given** the connection form screen, **When** the form fields render in the scrollable body, **Then** the field set MUST include (in this exact order): (a) **Host** — plain HTML `<input type="text">` (NOT desktop `<Input>`), label "HOST" (uppercase tracking-widest text-muted-foreground), `placeholder="e.g. 1.2.3.4 or example.com"`, `inputMode="text"`, `autoCorrect="off"`, `autoCapitalize="none"`, `spellCheck={false}`, `autoComplete="off"`, classes `h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full`; (b) **Port** — `<input type="number" inputMode="numeric" min={1} max={65535}>`, label "PORT", default `22`; (c) **Username** — `<input type="text">`, label "USERNAME", `autoComplete="username"`; (d) **Authentication** — a custom `MobileSegmentedTabs`-style picker (use the existing `MobileSegmentedTabs` primitive from `src/mobile/primitives/MobileSegmentedTabs.tsx`) with two tabs: `key` (label "SSH Key") and `password` (label "Password (test only)"); (e) **SSH Key** (visible only when `authMethod === 'key'`) — a tappable row showing the currently-selected key name (or "Select a key" placeholder) with a `ChevronRight` trailing icon, on tap opens `MobileKeyPickerSheet` (AC 11); (f) **Password** (visible only when `authMethod === 'password'`) — `<input type="password" autoComplete="current-password">` plus a help text `"Note: Passwords are used for testing or key installation and are never stored."` in `text-xs text-muted-foreground`; (g) **Test Connection** button (`<button>` with token classes — NOT desktop `<Button>`) that fires `useTestSshConnection.mutateAsync(...)` and renders inline result below as a banner (success/error styling identical to AC 8 detail-sheet result). All inputs use Calm Command tokens (`bg-card/30 border-border/40 rounded-xl text-foreground`) — **DO NOT** import `@renderer/components/ui/input`, `@renderer/components/ui/label`, `@renderer/components/ui/select`, or `@renderer/components/ui/button`.

11. **Given** the user taps the SSH Key row in the form, **When** the press fires, **Then** `MobileKeyPickerSheet` opens as a `MobileSheet` (`snapPoint='half'`, `title="Select SSH Key"`, `description="Pick an existing key or generate a new one."`, `data-testid="mobile-key-picker-sheet"`). The sheet body lists each key from `useListSshKeys()` as a `MobileListItem` row with: leading = `Key` Lucide icon (`h-4 w-4 text-sky-400` — AC-21 exception, document inline), title = `key.name`, subtitle = `key.public_key.slice(0, 32) + '…'` (truncated public key for ID), trailing = a `Check` icon (`h-4 w-4 text-primary`) when this key is currently selected, on tap calls `onKeySelect(key.name)` and closes the sheet. Below the key list, a **divider** (`<div className="h-px bg-border/40 my-2" />`) and a **"Generate New Key"** row that opens `MobileGenerateKeySheet` (AC 12). When `useListSshKeys()` returns an empty array, render only the "Generate New Key" row + a helpful subtitle ("No keys found. Generate one to continue.") above it. While `useListSshKeys.isLoading`, render `<MobileLoadingSkeleton variant="row" />` ×3 inside the sheet body.

12. **Given** the user taps "Generate New Key" in the key picker, **When** the press fires, **Then** `MobileGenerateKeySheet` opens as a **second `MobileSheet` layered above** the key picker (`snapPoint='fit'`, `title="Generate New SSH Key"`, `description="Provide the server password — used once to install the key, never stored."`, `data-testid="mobile-generate-key-sheet"`). The sheet body contains: (a) a read-only display of Host / Port / Username pulled from the form's current state (so the user can verify the target server before typing the password); (b) a one-time password `<input type="password">` (`autoComplete="current-password"`); (c) an optional Key Name `<input type="text">` (`placeholder={\`\${username || 'host'}-tinsu\`}`) — defaults to a generated name when blank; (d) a primary "Generate & Install" button that fires `useInstallSshKey.mutateAsync({ host, port, username, password, key_name })`, displays a spinner while pending, on success: closes the generate sheet, updates the form's `keyName` state to the new key name, fires `hapticFeedback([10, 30, 10])`, and shows a success toast via `sonner` ("Key generated and installed"); on error: shows inline error banner with the error message + a Retry button. Both Host/Port/Username AND password are required for the button to enable. **Do NOT** open the generate sheet without the form's host/port/username already populated — if any are blank, the generate sheet shows an inline warning "Fill in host, port, and username first" and the Generate button stays disabled. **Architectural note:** layered sheets work because each `MobileSheet` Radix Portal is independent; verify in tests that opening generate sheet does NOT close the key picker sheet.

13. **Given** the user taps Save in the form's bottom action bar, **When** the press fires, **Then** the screen MUST: (a) validate the form (host non-empty, port 1–65535, username non-empty, key_name non-empty when authMethod==='key') — invalid: shake the action bar (`hapticFeedback(300)` long buzz; visual shake skipped under reduced-motion) and abort; (b) call `useCreateSshConnection.mutateAsync(...)` (for new) or `useUpdateSshConnection.mutateAsync({ id, ... })` (for edit); (c) on success: fire `hapticFeedback([10, 30, 10])`, show success toast via `sonner` ("Connection saved" / "Connection updated"), call `useMobileNavStore.getState().popRoute()` to return to the list; (d) on error: fire `hapticFeedback(300)`, show error toast with `description: err.message`, leave the form on screen so the user can correct the issue. Save button is `disabled` while either mutation `isPending`. **Do NOT** auto-run Test Connection before Save — UX redesign §3.6 line 327 says Test is "mandatory before save", but for v1 we surface it as a strong recommendation (the Test result banner persists visible above Save) rather than a hard gate, because mandatory pre-save gating breaks the edit flow when the user only changed `key_name` on a working connection. Document this deviation in Dev Notes; T3.5-9 may revisit if user feedback supports a hard gate.

14. **Given** the user taps Delete in the connection detail sheet, **When** the press fires, **Then** `MobileDeleteConfirmSheet` opens as a `MobileSheet` (`snapPoint='fit'`, `title="Delete connection?"`, `description={\`This will permanently remove the connection to \${connection.host}.\`}`, `data-testid="mobile-connection-delete-sheet"`) with two buttons: Cancel (token-muted) and Delete (token-destructive, label "Delete", `data-testid="mobile-connection-delete-confirm-btn"`, on tap fires `hapticFeedback([10, 30, 10])` and calls `useDeleteSshConnection.mutateAsync(connection.id)`). On success: closes both sheets (delete sheet + parent detail sheet), shows success toast ("Connection deleted"), and the list auto-refreshes via the hook's invalidation. On error: closes only the delete sheet, leaves detail sheet open, shows error toast with `description: err.message`. **Do NOT** use `AlertDialog` from `@renderer/components/ui/alert-dialog` — mobile confirmation pattern is `MobileSheet` + 2 buttons (matches T3.5-6 approve confirmation precedent). **Do NOT** delete without confirmation (no swipe-to-delete-direct).

15. **Given** the user is on `connections` list OR `connection-form:*`, **When** they trigger Android system back-press, **Then** `useMobileNavStore.handleBackPress()` (T3.5-1) pops the active tab's stack:
    - From `connection-form:*` → returns to `connections` list (still in settings tab).
    - From `connections` (depth 1) → switches to `board` tab (T3.5-1 contract — non-board single-depth tabs jump to board on back).
    **Do NOT** modify `mobile-nav.store.ts`. Add a unit test that mounts `MobileApp` with `tabStacks.settings = ['home', 'connections', 'connection-form:new']`, calls `handleBackPress()`, asserts the connections list re-renders.

16. **Given** the deep-link table (T3.5-1 / `src/mobile/shell/deeplinks.ts`), **When** a user follows `tinsu://settings/connections`, **Then** the deep-link MUST resolve to `{ tab: 'settings', stack: ['home', 'connections'] }` (the existing settings tab root `'home'` stays as-is — T3.5-8 owns it; we push `connections` on top). Add a new `case 'settings':` branch to `parseDeepLink()` that handles ONLY the `connections` sub-path: `tinsu://settings/connections` → above target. **All other** `tinsu://settings/*` URIs return null (T3.5-8 may extend later). The mobile UX plan §2.4 line 150 lists this deep-link as "Settings tab, SSH list, Settings → connections" — implementing it is in-scope here. Add 2 unit tests in `src/mobile/shell/deeplinks.test.ts`: valid `tinsu://settings/connections` → expected target; invalid `tinsu://settings/foo` → null.

17. **Given** any new files this story creates under `src/mobile/ssh/` and the modified `src/mobile/MobileApp.tsx`, `src/mobile/shell/deeplinks.ts`, `src/mobile/settings/MobileSettingsHome.tsx`, **When** I `grep -REn "from '@renderer/components|from '../../components|from '@renderer/pages|from '@renderer/stores"` on them, **Then** **only allowed cross-tree imports** are:
    | Import | Reason |
    |---|---|
    | `@renderer/hooks/useSshCommands` (`useListSshKeys`, `useListSshConnections`, `useTestSshConnection`, `useCreateSshConnection`, `useUpdateSshConnection`, `useDeleteSshConnection`, `useInstallSshKey`) | All SSH mutations + queries — pure data + sonner toasts; mobile-safe |
    | `@renderer/lib/utils` (`cn`, `hapticFeedback`) | utility |
    | `@renderer/lib/rspc` | TYPE-ONLY for `SshConnectionProfile`, `SshKeyEntry`, `CreateSshConnectionInput`, `UpdateSshConnectionInput`, `TestSshConnectionInput`, `SshConnectionTestResult`, `InstallSshKeyInput`, `AppError` |
    | `sonner` (`toast`) | success / error toasts. **Note:** the SSH hooks do NOT auto-toast (unlike `useApprovalMutation`); the screen owns user feedback for SSH flows (deviates from T3.5-6 review pattern — documented in Dev Notes) |
    **Forbidden:** any import from `@renderer/components/remote/MobileSshConnectionForm`, `@renderer/components/settings/SshConnectionsPanel`, `@renderer/components/ui/dialog`, `@renderer/components/ui/alert-dialog`, `@renderer/components/ui/input`, `@renderer/components/ui/label`, `@renderer/components/ui/select`, `@renderer/components/ui/button`, `@renderer/components/ui/textarea`, `react-tauri-mock`, `framer-motion`, `react-spring`, `react-swipeable`, `react-window`, `react-virtual`, `@tanstack/react-virtual`. The mobile SSH tree **MUST NOT** mount any desktop SSH form, panel, dialog, input, button, label, or select component — fork only the surface. Direct imports of `lucide-react` icons are required.

18. **Given** the desktop SSH tree, **When** I run desktop tests (`SshConnectionsPanel.test.tsx` if it exists, `MobileSshConnectionForm.test.tsx` if it exists, `useSshCommands.test.ts` if it exists), **Then** **all desktop tests still pass with zero regressions** because this story does **not** modify any file under `src/components/`, `src/hooks/`, `src/stores/`, `src-tauri/`. The only allowed touches outside `src/mobile/ssh/` are: (a) replacing the `if (route === 'connections')` placeholder branch in `src/mobile/MobileApp.tsx` AND extending `isFullScreenRoute()` for `connection-form:` prefix AND adding a `connection-form:` route branch to `MobileRouteRenderer`, (b) adding the `tinsu://settings/connections` deep-link branch to `src/mobile/shell/deeplinks.ts`, (c) replacing the `MobileSettingsHome.tsx` placeholder body with a minimal settings list that exposes a single "Connections" row pushing `connections` route — full settings rebuild is T3.5-8's scope, but T3.5-7 needs ONE entry point so the connections list is reachable without a deep-link. The settings home modification is **strictly limited** to: rendering a single `MobileListItem` row with title "Connections", subtitle "SSH connections", `onPress` pushes `connections`, plus a one-line subtitle "Full settings coming in T3.5-8." Document this as "transitional T3.5-8 placeholder" inline.

19. **Given** the new files this story creates, **When** I run `npm test`, **Then** new colocated tests cover at minimum: (a) `MobileApp` route renderer maps `'connections'` → `<MobileConnectionsListScreen />` AND `'connection-form:new'` → `<MobileConnectionFormScreen mode="new" />` AND `'connection-form:abc'` → `<MobileConnectionFormScreen mode="edit" connectionId="abc" />`; (b) `isFullScreenRoute('connection-form:new') === true` AND `isFullScreenRoute('connections') === false`; (c) `MobileConnectionsListScreen` renders rows from `useListSshConnections` mock; (d) loading skeleton rendered while loading; (e) empty-state rendered when `data.length === 0`; (f) FAB rendered when `data.length > 0`; (g) tap on FAB pushes `connection-form:new`; (h) tap on row opens `MobileConnectionDetailSheet`; (i) swipe-left on row reveals Edit/Delete actions; (j) tap Edit pushes `connection-form:<id>`; (k) tap Delete opens `MobileDeleteConfirmSheet`; (l) Delete confirm calls `useDeleteSshConnection` mock; (m) `MobileConnectionFormScreen` renders all 7 fields in correct order; (n) tapping SSH Key row opens `MobileKeyPickerSheet`; (o) selecting a key in picker updates the form's keyName state and closes sheet; (p) "Generate New Key" opens `MobileGenerateKeySheet` (layered); (q) Generate sheet button disabled when host/port/username blank; (r) Generate sheet success calls `useInstallSshKey` mock and updates form keyName; (s) Test Connection button fires mock + renders success/error banner; (t) Save calls correct mutation (create vs update) and pops route on success; (u) deep-link `tinsu://settings/connections` resolves to `{ tab: 'settings', stack: ['home', 'connections'] }`; (v) Android back-press from `connection-form:new` returns to `connections` list. **Total ≥18 new tests**, zero new failures vs T3.5-6 baseline.

20. **Given** all new files under `src/mobile/ssh/` AND the modified `src/mobile/MobileApp.tsx`, `src/mobile/shell/deeplinks.ts`, `src/mobile/settings/MobileSettingsHome.tsx`, **When** I `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]"` on them, **Then** **the only allowed direct matches** are:
    1. **Status dot colors** in `MobileConnectionsListScreen.tsx` (`bg-emerald-500`, `bg-amber-500`) — UX-DR9 connection-state palette mirror.
    2. **Test result banner colors** in `MobileConnectionFormScreen.tsx` AND `MobileConnectionDetailSheet.tsx` (`bg-emerald-500/10 border-emerald-500/40 text-emerald-200` for success) — UX-DR4 success-state mirror.
    3. **Key icon color** in `MobileKeyPickerSheet.tsx` (`text-sky-400` for `Key` Lucide icon — auth identity hint) — UX-DR9 informational-icon palette.
    All other surfaces (chrome, action bar, sheet headers, form fields, error banners, FAB) MUST use Calm Command tokens (`bg-card`, `bg-muted/40`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-destructive`, `bg-primary/15`, `border-destructive/40`, etc.). **Document** all three exceptions inline as code comments. **Do NOT** introduce hex literals (`#0a0a0b`, `#3fb950`, `#f85149`, `#d29922`, `#aff5b4`, `#ffdcd7`, `#0d1117`, `#58a6ff`, `#2ea043`) anywhere in the SSH tree. **Do NOT** use the desktop `MobileSshConnectionForm.tsx`'s `text-sky-400` / `text-amber-400` for auth-method icons inside `MobileSegmentedTabs` — the segmented tabs use token-derived backgrounds for selected/unselected states and no per-method color icons.

21. **Given** the user is on the connection form (route `connection-form:*`), **When** they trigger Android system back-press while `useCreateSshConnection.isPending === true` OR `useUpdateSshConnection.isPending === true`, **Then** the back-press is **swallowed** (returns true from `handleBackPress`'s caller path, but since we don't modify the store, we instead intercept in the form screen via a `useEffect` listener). Specifically: the form screen MUST register a `keydown`/`popstate` listener (or use the platform back-press event from `@tauri-apps/plugin-deep-link` if exposed; in v1 we just rely on `popRoute()` being a no-op while pending — practically: disable the Save button during pending so the user can't double-fire, and disable the back button visually (`opacity-50 pointer-events-none`) while pending). **Decision:** v1 keeps it simple — disable both Save and back button visually during the mutation pending window. Document inline that this is a UX guardrail, not a hard interception (the system back gesture still works; the user just doesn't see a navigable back arrow). T3.5-9 may revisit with proper Tauri back-press intercept once the plugin exposes it.

22. **Given** the workspace screen + DEV harness route `#__mobile-primitives` (T3.5-2 AC 14), **When** I run with `import.meta.env.DEV` and force-refresh on any of `connections`, `connection-form:new`, `connection-form:abc`, **Then** I see **no console errors** and **no React warnings** (no missing keys on connection list, no act() warnings in StrictMode, no Radix Dialog warnings on `MobileSheet` (especially on the layered key-picker → generate-key sheets), no Lucide icon warnings, no unused-state warnings on the swipe action handlers). The DEV harness route `#__mobile-primitives` continues to render correctly — i.e., this story does **not** touch `src/mobile/dev/MobilePrimitivesHarness.tsx` and does not modify the harness routing in `MobileApp.tsx` beyond adding the `connection-form:` branch in `MobileRouteRenderer` and the prefix in `isFullScreenRoute`.

## Tasks / Subtasks

- [ ] **Task 1: `MobileConnectionsListScreen` shell + data (AC: 1, 3, 4, 5, 6, 22)**
  - [ ] 1.1 Create `src/mobile/ssh/MobileConnectionsListScreen.tsx`. No props.
  - [ ] 1.2 Layout: `<div data-testid="mobile-connections-screen" className="flex flex-col h-full">` with scrollable main area + `MobileFab` (positioned via the primitive's own absolute layout).
  - [ ] 1.3 Data: `const { data: connections = [], isLoading, error } = useListSshConnections()`.
  - [ ] 1.4 Loading: 4× `<MobileLoadingSkeleton variant="row" />` stacked.
  - [ ] 1.5 Error: `<MobileEmptyState title="Couldn't load connections" subtitle={String(error?.message ?? 'Unknown error')}/>` + Retry button calling `queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })`.
  - [ ] 1.6 Empty: `<MobileEmptyState title="No connections yet" subtitle="Add an SSH connection to start working on remote projects." />` with primary CTA "Add Connection" pushing `connection-form:new` (FAB hidden in this branch).
  - [ ] 1.7 List: sort by `created_at` desc, map to `MobileListItem` rows per AC 5.
  - [ ] 1.8 Per-row local status map: `const [statusMap, setStatusMap] = useState<Map<string, 'idle'|'testing'|'connected'|'error'>>(new Map())`. Pass `setStatusMap` down to detail-sheet test handler so detail-sheet test result writes back to the list view.
  - [ ] 1.9 Detail sheet state: `[activeDetailConnectionId, setActiveDetailConnectionId] = useState<string | null>(null)`. Render `<MobileConnectionDetailSheet>` when non-null.
  - [ ] 1.10 Delete confirm sheet state: `[deleteCandidate, setDeleteCandidate] = useState<SshConnectionProfile | null>(null)`. Render `<MobileDeleteConfirmSheet>` when non-null.

- [ ] **Task 2: Swipe-action layer for connection rows (AC: 7)**
  - [ ] 2.1 Create `src/mobile/ssh/MobileConnectionRow.tsx`. Props: `{ connection: SshConnectionProfile; status: ConnectionStatus; isSwiped: boolean; onSwipeChange: (id: string | null) => void; onPress: () => void; onEdit: () => void; onDelete: () => void }`.
  - [ ] 2.2 Layout: outer wrapper `<div className="relative overflow-hidden">` containing (a) absolute-positioned action layer (right-side flex row with Edit + Delete buttons, `inset-y-0 right-0 flex items-center`); (b) the row itself transformed by `translateX(deltaX)`.
  - [ ] 2.3 Pointer handlers: `onPointerDown` saves start X + sets pointer capture; `onPointerMove` updates `deltaX = clamp(-160, currentX - startX, 0)`; `onPointerUp` snaps to revealed (`-160`) if `|deltaX| > 80`, else snaps back (`0`).
  - [ ] 2.4 When `isSwiped === false`, force `transform: translateX(0)`. When `true`, force `translateX(-160px)`.
  - [ ] 2.5 Reduced-motion: skip CSS transition (`transition: none` when `useReducedMotion()`).
  - [ ] 2.6 Tap action layer's Edit button → calls `onEdit()`. Delete button → calls `onDelete()`.
  - [ ] 2.7 Tap on the row body (when not swiped) calls `onPress()`. When swiped, tap on row body resets swipe (calls `onSwipeChange(null)`).
  - [ ] 2.8 `data-testid={\`mobile-connection-row-${connection.id}\`}` on outer wrapper. `data-testid={\`mobile-connection-row-edit-${id}\`}` and `mobile-connection-row-delete-${id}\`}` on action buttons.

- [ ] **Task 3: `MobileConnectionDetailSheet` (AC: 8, 14)**
  - [ ] 3.1 Create `src/mobile/ssh/MobileConnectionDetailSheet.tsx`. Props: `{ open: boolean; connection: SshConnectionProfile | null; onOpenChange: (open: boolean) => void; onEdit: () => void; onDelete: () => void; onTestStatusChange: (id: string, status: ConnectionStatus) => void }`.
  - [ ] 3.2 Mount `<MobileSheet snapPoint="fit" title={connection?.host ?? 'Connection'} description={...}>`.
  - [ ] 3.3 Metadata block: Host / Port / Username / Auth Method / Key Name (or "Password (test only)") rows separated by `border-b border-border/40 py-3`.
  - [ ] 3.4 Created timestamp via `new Date(connection.created_at * 1000).toLocaleString()`.
  - [ ] 3.5 Action buttons row: Test Connection (primary), Edit (secondary, calls `onEdit()` + closes sheet), Delete (destructive, calls `onDelete()`).
  - [ ] 3.6 Test handler: local `[testResult, setTestResult] = useState<{state: 'idle'|'testing'|'success'|'error', fingerprint?: string, message?: string}>({state: 'idle'})`. On Test press: `setTestResult({state: 'testing'})`, call `useTestSshConnection.mutateAsync(...)`, on result update local state AND call `onTestStatusChange(connection.id, 'connected'|'error')`.
  - [ ] 3.7 Test result banner inline below buttons (success: emerald tokens; error: destructive tokens) — AC-21 exception 2.
  - [ ] 3.8 Password-auth case: show one-time password input field that mirrors form's password input; required for test fire when `auth_method === 'password'`.

- [ ] **Task 4: `MobileDeleteConfirmSheet` (AC: 14)**
  - [ ] 4.1 Create `src/mobile/ssh/MobileDeleteConfirmSheet.tsx`. Props: `{ open: boolean; connection: SshConnectionProfile | null; onOpenChange: (open: boolean) => void; onConfirmed: () => void }`.
  - [ ] 4.2 Mount `<MobileSheet snapPoint="fit" title="Delete connection?" description={\`This will permanently remove the connection to \${connection?.host}.\`} data-testid="mobile-connection-delete-sheet">`.
  - [ ] 4.3 Cancel button (token-muted) and Delete button (token-destructive). Delete fires `hapticFeedback([10, 30, 10])` + calls `useDeleteSshConnection.mutateAsync(connection.id)`.
  - [ ] 4.4 On success: closes sheet (set `open=false`), calls `onConfirmed()` (which closes parent detail sheet), shows success toast.
  - [ ] 4.5 On error: closes only this sheet, leaves detail sheet open, shows error toast.

- [ ] **Task 5: `MobileConnectionFormScreen` shell + form layout (AC: 2, 9, 10, 13, 21)**
  - [ ] 5.1 Create `src/mobile/ssh/MobileConnectionFormScreen.tsx`. Props: `{ mode: 'new' | 'edit'; connectionId?: string }`.
  - [ ] 5.2 Layout: `<div className="flex flex-col h-[100dvh] bg-background" data-testid="mobile-connection-form-screen">` with header / scroll body / action bar slots.
  - [ ] 5.3 Inline header: back button + title + spacer (no trailing — Save in action bar).
  - [ ] 5.4 Form state: `host`, `port`, `username`, `authMethod ('key'|'password')`, `keyName`, `password`, `testStatus`, `keyPickerOpen`, `generateKeyOpen`. For edit mode: derive initial values from `useListSshConnections()` data finding by id.
  - [ ] 5.5 Form fields (in scroll body): Host, Port, Username, Authentication (`MobileSegmentedTabs`), SSH Key row (key-mode) OR Password input (password-mode), Test Connection button + result banner.
  - [ ] 5.6 All inputs use plain HTML `<input>` + token classes — NO `@renderer/components/ui/*` imports.
  - [ ] 5.7 Bottom action bar: `<MobileBottomActionBar primary={{label: 'Save', onPress: handleSave, disabled: isSaving || !isFormValid}} secondary={{label: 'Cancel', onPress: () => popRoute()}}/>`.
  - [ ] 5.8 Edit mode + connection not found: render `<MobileEmptyState title="Connection not found" />` + back button.
  - [ ] 5.9 During mutation pending: disable Save AND back button (visual `opacity-50 pointer-events-none` on back).

- [ ] **Task 6: `MobileKeyPickerSheet` (AC: 11)**
  - [ ] 6.1 Create `src/mobile/ssh/MobileKeyPickerSheet.tsx`. Props: `{ open: boolean; selectedKeyName: string; onOpenChange: (open: boolean) => void; onKeySelect: (name: string) => void; onGenerateNew: () => void }`.
  - [ ] 6.2 Mount `<MobileSheet snapPoint="half" title="Select SSH Key" description="Pick an existing key or generate a new one.">`.
  - [ ] 6.3 Data: `const { data: keys = [], isLoading } = useListSshKeys()`.
  - [ ] 6.4 Loading: 3× `<MobileLoadingSkeleton variant="row" />`.
  - [ ] 6.5 Empty: hide list, show only Generate New row + subtitle "No keys found. Generate one to continue."
  - [ ] 6.6 Key rows via `MobileListItem`: leading `<Key className="h-4 w-4 text-sky-400"/>` (AC-21 exception 3), title `key.name`, subtitle truncated public key, trailing `<Check>` when selected.
  - [ ] 6.7 Divider then Generate New row: `MobileListItem` with `<Plus />` leading, title "Generate New Key", `onPress={onGenerateNew}`.

- [ ] **Task 7: `MobileGenerateKeySheet` (AC: 12)**
  - [ ] 7.1 Create `src/mobile/ssh/MobileGenerateKeySheet.tsx`. Props: `{ open: boolean; onOpenChange: (open: boolean) => void; host: string; port: number; username: string; onSuccess: (keyName: string) => void }`.
  - [ ] 7.2 Mount `<MobileSheet snapPoint="fit" title="Generate New SSH Key" description="Provide the server password — used once to install the key, never stored." data-testid="mobile-generate-key-sheet">`.
  - [ ] 7.3 Read-only Host/Port/Username display block (token-styled rows).
  - [ ] 7.4 Password input + optional Key Name input (default placeholder `${username || 'host'}-tinsu`).
  - [ ] 7.5 Local `[isPending, error]` state. On Generate press: fire `useInstallSshKey.mutateAsync({...})`. On success: `hapticFeedback([10, 30, 10])`, toast.success("Key generated and installed"), call `onSuccess(entry.name)` (parent updates form keyName + closes sheet).
  - [ ] 7.6 On error: render inline error banner with message + Retry button.
  - [ ] 7.7 Disabled state: when host/port/username are blank → show inline warning "Fill in host, port, and username first" + Generate button disabled.

- [ ] **Task 8: Wire `MobileApp.tsx` route renderer (AC: 1, 2, 15, 22)**
  - [ ] 8.1 Edit `src/mobile/MobileApp.tsx`. Update `isFullScreenRoute()` to: `return route.startsWith('workspace:') || route.startsWith('chat:') || route.startsWith('review:') || route.startsWith('connection-form:')`.
  - [ ] 8.2 Update `MobileRouteRenderer`: **replace** the existing `if (route === 'connections')` placeholder branch (lines 193–200) with `if (route === 'connections') return <MobileConnectionsListScreen />`.
  - [ ] 8.3 Add a new branch for the form: `if (route.startsWith('connection-form:')) { const param = route.slice('connection-form:'.length); return param === 'new' ? <MobileConnectionFormScreen mode="new" /> : <MobileConnectionFormScreen mode="edit" connectionId={param} /> }`. Place this branch immediately after the `review:` branch.
  - [ ] 8.4 Import `MobileConnectionsListScreen` and `MobileConnectionFormScreen` at the top with the other screen imports.
  - [ ] 8.5 Update `src/mobile/MobileApp.test.tsx`: add tests for `isFullScreenRoute('connection-form:new') === true`; `isFullScreenRoute('connections') === false`; route renderer maps `'connections'` → mocked list screen, `'connection-form:new'` → mocked form (mode=new), `'connection-form:abc'` → mocked form (mode=edit, connectionId="abc"); back-press from `connection-form:new` returns to `connections`.

- [ ] **Task 9: Wire deep-link `tinsu://settings/connections` (AC: 16)**
  - [ ] 9.1 Edit `src/mobile/shell/deeplinks.ts`. Add new `case 'settings':` branch in `parseDeepLink()` switch.
  - [ ] 9.2 Logic: when `parts[0] === 'connections'`, return `{ tab: 'settings', stack: ['home', 'connections'] }`. Otherwise return `null`.
  - [ ] 9.3 Update `src/mobile/shell/deeplinks.test.ts` (if exists; otherwise create): add tests for valid `tinsu://settings/connections`, invalid `tinsu://settings/foo`, missing path `tinsu://settings`.

- [ ] **Task 10: `MobileSettingsHome` minimal entry point (AC: 18)**
  - [ ] 10.1 Edit `src/mobile/settings/MobileSettingsHome.tsx`. Replace the existing `MobileEmptyState` body with a minimal list: a single `<MobileListItem>` row titled "Connections" + subtitle "SSH connections" pushing `connections` route on press, plus a small "Full settings coming in T3.5-8." subtitle below the list.
  - [ ] 10.2 The screen MUST still be reachable via the existing settings tab root (`'home'`). Do NOT modify `mobile-nav.store.ts` (`'home'` stays as the settings tab root).
  - [ ] 10.3 Document inline JSDoc that this is a "transitional T3.5-8 placeholder" — the full settings list lands in T3.5-8.

- [ ] **Task 11: Wire mutations + test handlers in form screen (AC: 10, 13)**
  - [ ] 11.1 Hook setup in `MobileConnectionFormScreen.tsx`: `const createMutation = useCreateSshConnection(); const updateMutation = useUpdateSshConnection(); const testMutation = useTestSshConnection()`.
  - [ ] 11.2 `handleTest`: validate form first; set `testStatus={state:'testing'}`; call `testMutation.mutateAsync(...)`; on result update `testStatus` to `success`/`error`.
  - [ ] 11.3 `handleSave`: validate form (`isFormValid`); fire `hapticFeedback([10, 30, 10])` on press; for new mode call `createMutation.mutateAsync({host, port, username, auth_method: authMethod, key_name: authMethod === 'key' ? keyName.trim() || null : null})`; for edit mode call `updateMutation.mutateAsync({id: connectionId, ...})`; on success: `toast.success('Connection saved'|'updated')`, `popRoute()`; on error: `hapticFeedback(300)`, `toast.error('Failed to save', {description: err.message})`.
  - [ ] 11.4 `isFormValid` matches existing form (`host.trim() !== '' && username.trim() !== '' && port >= 1 && port <= 65535 && (authMethod !== 'key' || keyName.trim() !== '')`).

- [ ] **Task 12: Tests (AC: 19)**
  - [ ] 12.1 `src/mobile/ssh/MobileConnectionsListScreen.test.tsx` — ≥6 tests: rows render from `useListSshConnections` mock; loading skeleton; error retry; empty state with CTA; FAB shows when data present; FAB push pushes `connection-form:new`.
  - [ ] 12.2 `src/mobile/ssh/MobileConnectionRow.test.tsx` — ≥4 tests: row renders host/user/port; tap opens detail; swipe-left reveals actions; tap Edit/Delete fires correct callback.
  - [ ] 12.3 `src/mobile/ssh/MobileConnectionDetailSheet.test.tsx` — ≥4 tests: metadata renders; Test fires `useTestSshConnection` mock and renders banner; Edit calls `onEdit`; Delete opens delete sheet.
  - [ ] 12.4 `src/mobile/ssh/MobileDeleteConfirmSheet.test.tsx` — ≥3 tests: Cancel closes; Delete calls mutation + closes both sheets; Delete error leaves sheets open.
  - [ ] 12.5 `src/mobile/ssh/MobileConnectionFormScreen.test.tsx` — ≥6 tests: all 7 fields render in correct order; key picker opens on row tap; key selection updates state; test connection result banner renders success/error; Save calls correct mutation; Save success pops route.
  - [ ] 12.6 `src/mobile/ssh/MobileKeyPickerSheet.test.tsx` — ≥3 tests: keys render from mock; Generate New row opens generate sheet; selection calls `onKeySelect` + closes.
  - [ ] 12.7 `src/mobile/ssh/MobileGenerateKeySheet.test.tsx` — ≥3 tests: button disabled when host blank; success calls `useInstallSshKey` + onSuccess; error renders banner.
  - [ ] 12.8 `src/mobile/MobileApp.test.tsx` updates — add ≥4 tests: `isFullScreenRoute('connection-form:new') === true`; `isFullScreenRoute('connections') === false`; `'connections'` route renders list mock; `'connection-form:abc'` renders form mock with mode=edit + connectionId="abc".
  - [ ] 12.9 `src/mobile/shell/deeplinks.test.ts` updates — add ≥2 tests: valid `tinsu://settings/connections` resolves; invalid `tinsu://settings/foo` returns null.
  - [ ] 12.10 Mock surface: `vi.mock('@renderer/hooks/useSshCommands', () => ({ useListSshKeys: vi.fn(() => ({data: [...], isLoading: false, error: null})), useListSshConnections: vi.fn(() => ({data: [...], ...})), useTestSshConnection: vi.fn(() => ({mutateAsync: vi.fn(), isPending: false})), useCreateSshConnection / useUpdateSshConnection / useDeleteSshConnection / useInstallSshKey same shape }))`. Mock `sonner` `toast` for success/error assertions. Mock `useMobileNavStore` `popRoute` / `pushRoute`.
  - [ ] 12.11 Total ≥18 new tests; pre-existing failure count unchanged from T3.5-6 baseline.

- [ ] **Task 13: Token discipline + a11y audit (AC: 17, 20, 22)**
  - [ ] 13.1 `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]" src/mobile/ssh/` → expected matches ONLY: (a) status dots in `MobileConnectionsListScreen.tsx`; (b) test-result banners in `MobileConnectionFormScreen.tsx` + `MobileConnectionDetailSheet.tsx`; (c) `Key` icon in `MobileKeyPickerSheet.tsx`. Document each inline.
  - [ ] 13.2 `grep -REn "from '@renderer/components/(remote|settings)" src/mobile/ssh/ src/mobile/MobileApp.tsx src/mobile/shell/deeplinks.ts src/mobile/settings/MobileSettingsHome.tsx` → assert zero matches.
  - [ ] 13.3 `grep -REn "from '@renderer/components/ui/(dialog|alert-dialog|input|label|select|button|textarea)'" src/mobile/ssh/` → assert zero matches.
  - [ ] 13.4 `grep -REn "#[0-9a-fA-F]{6}\b" src/mobile/ssh/` → assert zero matches (no hex literals).
  - [ ] 13.5 All interactive elements have `aria-label` or accessible text. `MobileSheet` `title` set on every sheet. Action bar buttons have `data-testid` + descriptive `aria-label`.
  - [ ] 13.6 Touch targets: every button is `min-h-[2.75rem]` (44 px) — verified by class.
  - [ ] 13.7 Confirm via `git diff --stat` after implementation — ONLY allowed touched files outside `src/mobile/ssh/` are: `src/mobile/MobileApp.tsx`, `src/mobile/MobileApp.test.tsx`, `src/mobile/shell/deeplinks.ts`, `src/mobile/shell/deeplinks.test.ts` (if it doesn't exist, may be created), `src/mobile/settings/MobileSettingsHome.tsx`.

- [ ] **Task 14: Lint, typecheck, regression (AC: 18, 19, 22)**
  - [ ] 14.1 `npx tsc --noEmit` — zero new TypeScript errors in `src/mobile/ssh/`, the modified files.
  - [ ] 14.2 `npm test` — pre-existing failure count unchanged from T3.5-6 baseline; all new tests pass.
  - [ ] 14.3 Manual smoke (Tailscale Android dev): tap settings tab → tap Connections row → list renders; tap FAB → form opens; fill host/port/user → tap SSH Key row → key picker opens → tap Generate New → enter password → key installs → form keyName updates; test connection succeeds; Save → list updates; swipe-left on row → Edit/Delete reveal; Edit pushes form pre-filled; Delete confirms + removes; back-press from form returns to list. Deferred to reviewer per T3.5-9 gate.
  - [ ] 14.4 Manual smoke (deep-link): from a fresh app cold-start, follow `tinsu://settings/connections` → settings tab activates and list renders. Deferred to T3.5-9.

- [ ] **Task 15: Documentation passes (AC: 18, 20, 22)**
  - [ ] 15.1 Each new file has a top-of-file JSDoc block: purpose, AC references, cross-tree allowlist (where applicable), token-discipline exceptions (where applicable).
  - [ ] 15.2 `MobileConnectionFormScreen.tsx` documents the deviation from UX redesign §3.6 (full-screen push instead of bottom-sheet wizard) inline + the relaxed "Test before Save" guideline (recommendation, not gate).
  - [ ] 15.3 `MobileConnectionsListScreen.tsx` documents the v1 status-map strategy (no auto-test on mount; user-triggered only via detail sheet).
  - [ ] 15.4 `MobileKeyPickerSheet.tsx` + `MobileGenerateKeySheet.tsx` document the layered-sheet pattern (parent stays open; child layers above via independent Radix Portal).
  - [ ] 15.5 `MobileSettingsHome.tsx` documents inline that this is a "transitional T3.5-8 placeholder" — full settings list lands in T3.5-8.

## Dev Notes

### MUST USE /frontend-design skill (CLAUDE.md mandate)

This is a **🎨 FRONTEND/UI STORY**. Before writing any TSX, the dev agent MUST invoke `/frontend-design` with: tech stack (React 19 / TypeScript / Tailwind v4 / shadcn / @radix-ui / Lucide), the AC matrix below, the Calm Command token list (`src/globals.css`), and the existing primitive surface (`MobileSheet`, `MobileBottomActionBar`, `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `MobileSegmentedTabs`, `MobileFab`, `MobileTopAppBar`). Pass the cross-tree allowlist (`useSshCommands` hooks + types) so the skill knows which desktop dependencies are reusable. Pass the three token-discipline exceptions (status dots, test-result banners, Key icon sky) so the skill produces compliant output. Integrate the skill's output verbatim where viable; do not write screen TSX from scratch without it.

### Why this story exists (do not skip)

Today the mobile shell has a placeholder `if (route === 'connections')` branch in `MobileApp.tsx` that renders `<MobileEmptyState>"Coming in T3.5-7 — SSH connection management."</MobileEmptyState>`. The settings tab root is also placeholder. Founders cannot add an SSH connection on phone unless they switch to desktop — which defeats the entire mobile-first thesis (Epic 3.5). The desktop `SshConnectionsPanel.tsx` (1085 lines) and `MobileSshConnectionForm.tsx` (416 lines) cover the data + flows but use shadcn `Dialog`/`Input`/`Select`/`Button` shapes that violate the parallel-tree separation (CLAUDE.md). This story closes the gap by:

1. Replacing the `connections` placeholder with a real `MobileConnectionsListScreen` (still inside the standard `MobileScreen` shell — it's a tab sub-route, not a full-screen push).
2. Adding a `connection-form:` full-screen push for add/edit (matches workspace/chat/review pattern; deviates from UX redesign §3.6's bottom-sheet wizard for thumb-zone reasons documented in AC 2).
3. Building a `MobileKeyPickerSheet` + `MobileGenerateKeySheet` layered-sheet flow for key selection and on-the-fly generation.
4. Wiring all 7 SSH hooks (`useListSshConnections`, `useListSshKeys`, `useTestSshConnection`, `useCreateSshConnection`, `useUpdateSshConnection`, `useDeleteSshConnection`, `useInstallSshKey`) cross-tree.
5. Implementing swipe-left actions on rows (Edit/Delete) without `framer-motion` — inline pointer-event handlers + token-styled action layer.
6. Adding `tinsu://settings/connections` deep-link.
7. Adding a minimal `MobileSettingsHome` entry point so the connections list is reachable without a deep-link (full settings rebuild stays in T3.5-8 scope).

The implementation **reuses every backend artifact unchanged**:
- Same Tauri commands (`commands.listSshConnections`, `createSshConnection`, `updateSshConnection`, `deleteSshConnection`, `testSshConnection`, `installSshKey`, `listSshKeys`) — accessed via `useSshCommands` hooks.
- Same `SshConnectionProfile`, `SshKeyEntry`, `SshConnectionTestResult`, `Create/Update/TestSshConnectionInput`, `InstallSshKeyInput` types from `@renderer/lib/rspc`.
- Same Sonner toast surface (the screen owns toasts since the SSH hooks DO NOT auto-toast — deviation from `useApprovalMutation`/`useRejectionMutation` documented in AC 17).

The mobile UI is **forked at the surface only** — list screen, form screen, detail sheet, delete confirm, key picker, generate key sheet, swipe-action layer. The desktop `SshConnectionsPanel` and `MobileSshConnectionForm` live on under `src/components/settings/` and `src/components/remote/` for the desktop tree's own use (no edits this story).

### Key architectural decisions (locked, do NOT redebate)

- **Full-screen push for add/edit, NOT bottom-sheet wizard** (deviation from UX redesign §3.6 line 325). Rationale: 6+ required fields + nested install-key flow exceed thumb-zone half-sheet budget; workspace/chat/review precedent already established the full-screen push pattern; existing `MobileSshConnectionForm` already renders as a full-page form. AC 2 documents this.
- **List screen stays inside `MobileScreen` shell** (NOT full-screen). Rationale: it's a tab sub-route, founder needs to switch tabs without back-pressing first. Bottom tab bar visible; FAB lives inside the screen body. AC 1.
- **No live status subscription**. Rationale: backend's `SshConnectionProfile` does not expose a status field; an rspc subscription doesn't exist; mass-pinging on cold-start would degrade UX. v1: per-row local status map updated only when user explicitly tests. T3.5-9 may add a background health-check. AC 6.
- **Layered sheets for key picker → generate key**. Rationale: each `MobileSheet` Radix Portal is independent; the parent picker stays mounted; the generate sheet layers above. Verified via test in Task 12.6. AC 12.
- **Swipe via plain pointer events, NOT `framer-motion`**. Rationale: bundle size + `framer-motion` is overkill for a 1D translate. Plain `onPointer*` handlers + CSS transition are sufficient. AC 7. **Do NOT** add `framer-motion`, `react-spring`, `react-swipeable`.
- **Test before Save is recommended, NOT mandatory** (deviation from UX redesign §3.6 line 327). Rationale: edit-only-key-name flows shouldn't require a fresh test. v1 surfaces test result banner above Save (visual reminder). T3.5-9 may revisit. AC 13.
- **Sonner toasts owned by the screen**, NOT the hooks (deviation from T3.5-6's review pattern where `useApprovalMutation` auto-toasts). Rationale: `useSshCommands.ts` (line 9 imports `toast` but only `useInstallSshKey` and the existing `MobileSshConnectionForm` call site fire toasts; the create/update/delete hooks don't). To keep the toast UX consistent, the screen owns `toast.success`/`toast.error` calls. AC 17 documents this.
- **`MobileSegmentedTabs` for auth method picker, NOT a `<select>`**. Rationale: 2 options + thumb-friendly visual. The desktop form uses `Select` from shadcn; mobile uses the segmented primitive (T3.5-2). AC 10(d).
- **Plain HTML `<input>` + token classes, NOT shadcn `<Input>`**. Rationale: parallel-tree discipline; shadcn `<Input>` carries desktop hover/focus shapes that don't align with phone touch UX. AC 10 + AC 17.
- **Delete confirmation is `MobileSheet`, NOT `AlertDialog`**. Rationale: matches T3.5-6 approve-confirm pattern; avoids importing `AlertDialog` primitive. AC 14.
- **Settings home gets a minimal real entry point this story** (deviation from "T3.5-8 owns settings/**"). Rationale: connections list is unreachable without a deep-link otherwise; T3.5-8 will replace the minimal list with the full settings rebuild. AC 18.
- **Deep-link table extended for `tinsu://settings/connections` in this story**. Rationale: UX plan §2.4 line 150 lists this deep-link; T3.5-8 may add more `tinsu://settings/*` routes; this story owns only the `connections` sub-path. AC 16.

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** import `MobileSshConnectionForm` from `@renderer/components/remote/`. The desktop form uses `<Input>`, `<Label>`, `<Button>`, `<Select>` — all forbidden in mobile tree. Rebuild from scratch.
2. **DO NOT** import `SshConnectionsPanel`, `ConnectionDialog`, or `ConnectionRow` from `@renderer/components/settings/SshConnectionsPanel.tsx`. Rebuild list UI in mobile tree.
3. **DO NOT** import `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `AlertDialog`, `AlertDialogContent`, etc. from `@renderer/components/ui/`. Use `MobileSheet` for ALL modal-ish surfaces (detail, delete-confirm, key-picker, generate-key).
4. **DO NOT** import `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Button`, `Textarea` from `@renderer/components/ui/`. Use plain HTML `<input>`, `<label>`, `<button>` elements with token classes.
5. **DO NOT** add inline hex colors. Forbidden literals: `#0a0a0b`, `#3fb950`, `#f85149`, `#d29922`, `#aff5b4`, `#ffdcd7`, `#0d1117`, `#58a6ff`, `#2ea043`. Use Calm Command tokens.
6. **DO NOT** add `framer-motion`, `react-spring`, `react-swipeable`, `react-window`, `react-virtual`, `@tanstack/react-virtual`, `@radix-ui/react-alert-dialog` (use MobileSheet), `@radix-ui/react-select` (build segmented tabs from existing primitive), `@tanstack/react-form` (manage form state with `useState` directly).
7. **DO NOT** call `commands.listSshConnections`, `commands.createSshConnection`, etc. directly. Always go through `useSshCommands` hooks (they handle queryKey invalidation).
8. **DO NOT** use `useIsMobile()` or any responsive branching — mobile code lives in `src/mobile/`; desktop code lives in `src/components/`. They never share a render tree (CLAUDE.md mobile-tree-not-branch rule).
9. **DO NOT** modify `mobile-nav.store.ts` — `popRoute()`, `pushRoute()`, `handleBackPress()` already do the right thing. Settings tab root stays as `'home'`.
10. **DO NOT** modify `useSshCommands.ts` — it's read-only cross-tree (the screen consumes; it doesn't extend the hook).
11. **DO NOT** modify `commands.ts` / `bindings.ts` / Rust SSH services. The backend is unchanged.
12. **DO NOT** modify `parseDeepLink` for any path other than `tinsu://settings/connections`. T3.5-8 may extend later.
13. **DO NOT** assert against desktop test IDs (`ssh-connection-form`, `ssh-connection-card`, `ssh-add-button`, `connection-dialog`). Mobile uses `mobile-connections-screen`, `mobile-connection-form-screen`, `mobile-connection-row-{id}`, `mobile-key-picker-sheet`, `mobile-generate-key-sheet`, `mobile-connection-delete-sheet`, `mobile-connections-fab`.
14. **DO NOT** auto-test connections on cold-start — local status map only updates on user-triggered tests via the detail sheet (AC 6).
15. **DO NOT** require Test before Save as a hard gate — surface as recommendation only (AC 13).
16. **DO NOT** show the FAB and the empty-state CTA simultaneously — empty-state owns the primary action when `data.length === 0` (AC 4).
17. **DO NOT** introduce a `useConnectionStatus` Zustand store — keep status state local to `MobileConnectionsListScreen`. Phase 2 may centralize.
18. **DO NOT** introduce `useFormState` / `react-hook-form` / `formik` — plain `useState` for form fields suffices.
19. **DO NOT** import `toast` from `sonner` inside `useSshCommands.ts` — that hook already imports `toast` but doesn't fire in create/update/delete; the screen owns the toast UX.
20. **DO NOT** introduce ssh key delete in this story — `commands.deleteSshKey` exists but the UX redesign §3.6 doesn't surface it on mobile v1. Defer to T3.5-9 if user feedback supports it.
21. **DO NOT** introduce ssh key generation outside the `MobileGenerateKeySheet` flow — `commands.generateSshKey` exists but is NOT used by this story (we use `installSshKey` which both generates AND installs in one call). The standalone "generate key without install" flow is desktop-only.
22. **DO NOT** add a "Test all" or "Refresh all" action — v1 keeps it simple. Each connection is tested individually via its detail sheet.
23. **DO NOT** use `setTimeout` for sheet close animations — `MobileSheet`'s `onOpenChange(false)` triggers Radix's own animation. Just call it.
24. **DO NOT** measure sheet height or set explicit numeric heights on `MobileSheet`. Use `snapPoint='half'` or `'fit'` (T3.5-2 contract).
25. **DO NOT** import `lucide-react` for the connection status dot — use plain `<span>` with token-derived `bg-{color}` classes (avoid Lucide overhead for 8x8 dots).
26. **DO NOT** modify `src/mobile/dev/MobilePrimitivesHarness.tsx` — DEV harness stays untouched (AC 22).
27. **DO NOT** modify `src/mobile/MobileApp.tsx` outside the route renderer + isFullScreenRoute extension. The deep-link subscription, harness gate, MobileScreen shell — all stay as-is.

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `react`, `react-dom` | 19 (already in project) | Components | n/a |
| `@tanstack/react-query` v5 | already in project | mutations + queries via `useSshCommands` | hooks own queryClient access |
| `@radix-ui/react-dialog` | already in project (via `MobileSheet`) | sheets | reuse `MobileSheet` only |
| `lucide-react` | `^0.562.0` already | `Plus`, `Key`, `Lock`, `Pencil`, `Trash2`, `Zap`, `CheckCircle2`, `XCircle`, `Loader2`, `ChevronRight`, `Check`, `Server`, `Terminal` | no new icons |
| `tailwindcss` | `^4.1.18` already | Calm Command tokens | exceptions: status dots, test-result banners, Key icon sky |
| `@tauri-apps/plugin-deep-link` | already in project | `tinsu://settings/connections` resolution via existing `parseDeepLink` extension | no plugin config change |
| `sonner` | already in project | success / error toasts owned by screen | no auto-toast in hooks |
| `vitest` + `@testing-library/react` | already in project | tests | n/a |

**No new dependencies.** If you reach for `framer-motion`, `react-spring`, `react-swipeable`, `react-hook-form`, `formik`, `react-window`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-select` — **STOP**. Built primitives + plain HTML inputs + inline pointer-event swipe are sufficient.

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/mobile/ssh/MobileConnectionsListScreen.tsx
src/mobile/ssh/MobileConnectionsListScreen.test.tsx
src/mobile/ssh/MobileConnectionRow.tsx
src/mobile/ssh/MobileConnectionRow.test.tsx
src/mobile/ssh/MobileConnectionDetailSheet.tsx
src/mobile/ssh/MobileConnectionDetailSheet.test.tsx
src/mobile/ssh/MobileDeleteConfirmSheet.tsx
src/mobile/ssh/MobileDeleteConfirmSheet.test.tsx
src/mobile/ssh/MobileConnectionFormScreen.tsx
src/mobile/ssh/MobileConnectionFormScreen.test.tsx
src/mobile/ssh/MobileKeyPickerSheet.tsx
src/mobile/ssh/MobileKeyPickerSheet.test.tsx
src/mobile/ssh/MobileGenerateKeySheet.tsx
src/mobile/ssh/MobileGenerateKeySheet.test.tsx
```

**Files this story modifies:**

```
src/mobile/MobileApp.tsx                            (extend isFullScreenRoute for connection-form: prefix; replace connections placeholder branch; add connection-form: route branch; import new screen components)
src/mobile/MobileApp.test.tsx                       (add route renderer + isFullScreenRoute tests + back-press integration test)
src/mobile/shell/deeplinks.ts                       (add settings/connections branch to parseDeepLink)
src/mobile/shell/deeplinks.test.ts                  (add tests for new deep-link; create file if it doesn't exist)
src/mobile/settings/MobileSettingsHome.tsx          (replace placeholder with minimal connections entry point — transitional)
```

**Files this story may NOT modify (regression guard, AC 18):**

```
src/components/**                                  (desktop tree — read-only imports per allowlist; specifically do NOT touch SshConnectionsPanel.tsx, MobileSshConnectionForm.tsx)
src/hooks/useSshCommands.ts                        (read-only — used by import only)
src/hooks/**                                       (read-only)
src/stores/**                                      (read-only)
src/lib/rspc.ts                                    (read-only — type imports only)
src/bindings.ts                                    (auto-generated — never hand-edit)
src-tauri/**                                       (no Rust changes)
src/mobile/board/**                                (T3.5-3 contract)
src/mobile/tasks/**                                (T3.5-4 contract)
src/mobile/planning/**                             (T3.5-5 contract)
src/mobile/review/**                               (T3.5-6 contract)
src/mobile/activity/**                             (T3.5-8 owns)
src/mobile/primitives/**                           (T3.5-2 contract; no edits)
src/mobile/shell/mobile-nav.store.ts               (T3.5-1 contract; settings tab root stays 'home')
src/mobile/dev/**                                  (DEV harness; no edits)
```

### Testing requirements

- **Unit tests** colocated next to each new component:
  - `MobileConnectionsListScreen.test.tsx` — ≥6 tests covering AC 19 (a)–(g)
  - `MobileConnectionRow.test.tsx` — ≥4 tests covering AC 19 (h)–(j)
  - `MobileConnectionDetailSheet.test.tsx` — ≥4 tests covering AC 19 (h)
  - `MobileDeleteConfirmSheet.test.tsx` — ≥3 tests covering AC 19 (k)–(l)
  - `MobileConnectionFormScreen.test.tsx` — ≥6 tests covering AC 19 (m)–(t)
  - `MobileKeyPickerSheet.test.tsx` — ≥3 tests covering AC 19 (n)–(o)
  - `MobileGenerateKeySheet.test.tsx` — ≥3 tests covering AC 19 (p)–(r)
  - `MobileApp.test.tsx` updates — ≥4 new tests covering AC 19 (a)–(b)
  - `deeplinks.test.ts` updates — ≥2 tests covering AC 19 (u)
- **Total ≥18 new tests** (AC 19 floor). Higher is better.
- **Mock pattern** for `@renderer/hooks/useSshCommands`:
  ```ts
  vi.mock('@renderer/hooks/useSshCommands', () => ({
    useListSshKeys: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useListSshConnections: vi.fn(() => ({ data: [], isLoading: false, error: null })),
    useTestSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useCreateSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useUpdateSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useDeleteSshConnection: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useInstallSshKey: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  }))
  ```
  Per-test: spy `mutateAsync` ref, mock its resolved/rejected value to drive screen behavior.
- **Mock pattern** for `sonner`:
  ```ts
  vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
  ```
- **Mock pattern** for `useMobileNavStore`: spy `popRoute` / `pushRoute` to assert navigation. Use the store's actual zustand-created reference — patch the methods in setup.
- **Reduced-motion test**: mock `useReducedMotion` to return `true`; verify swipe transition is skipped.
- **Fixture connection**:
  ```ts
  const fixtureConn: SshConnectionProfile = {
    id: 'conn-1', host: 'example.com', port: 22, username: 'ubuntu',
    auth_method: 'key', key_name: 'mykey', created_at: 1714463400
  }
  ```
- **Fixture key**:
  ```ts
  const fixtureKey: SshKeyEntry = { name: 'mykey', public_key: 'ssh-ed25519 AAAA...' }
  ```
- **Coverage target:** ≥80% line coverage on new files in `src/mobile/ssh/`.
- **Manual smoke on Android (Tailscale)**: deferred to reviewer per T3.5-9 gate — verify FAB → form → key picker → generate key → save → list refresh → swipe-edit → swipe-delete → confirm → list refresh; deep-link `tinsu://settings/connections` from cold start.
- **No e2e tests** (TEA territory, deferred to T3.5-9).

### Project Structure Notes

- `src/mobile/ssh/` already exists with only `.gitkeep`. New files colocated here.
- The architecture doc lists the SSH-flow files under `src/mobile/ssh/` — this story populates that directory.
- `MobileApp.tsx` route renderer needs (a) replacing the existing `connections` placeholder branch with the real screen import and (b) adding the `connection-form:` prefix branch + `isFullScreenRoute` extension. Keep changes minimal (matches T3.5-4 / T3.5-5 / T3.5-6 precedent — no separate router file).
- The 5-tab bottom nav is **visible** on the connections list (AC 1) and **hidden** on the connection form (AC 2 — full-screen push).
- `MobileSettingsHome.tsx` gets a transitional minimal list with one row (Connections) — full settings rebuild lands in T3.5-8; this story keeps the entry point so the connections list is reachable without a deep-link.
- Deep-link table extension is scoped to `tinsu://settings/connections` only — T3.5-8 may add more `tinsu://settings/*` paths.

### Previous story intelligence (T3.5-1 through T3.5-6)

- **T3.5-1** established the route renderer pattern (`MobileApp.tsx` switch case + `if (route === ...)` and `if (route.startsWith(...))` branches). Reuse this pattern; do NOT introduce a separate router.
- **T3.5-1** established the 5-tab structure with `'settings'` tab root `'home'`. The connections list pushes `connections` onto `tabStacks.settings`. Settings tab root stays `'home'` (T3.5-8 owns the home rebuild).
- **T3.5-1** established the deep-link table — `tinsu://chat/{id}`, `tinsu://task/{id}`, `tinsu://task/{id}/diff`. This story adds `tinsu://settings/connections`. The `parseDeepLink` switch already handles unknown hosts by returning null; we add a `case 'settings':` branch.
- **T3.5-2** primitives: `MobileSheet` snap points are `'half' | 'full' | 'fit'`. Use `'half'` for key picker; `'fit'` for delete confirm, generate key, detail. `MobileBottomActionBar` supports `primary` + `secondary` slots — use the standard primary/secondary contract for the form's Save/Cancel (NOT the children escape hatch — only 2 buttons here).
- **T3.5-2** `MobileSegmentedTabs` is the canonical 2-N-tab picker — use for auth method selector. **`MobileFab`** is the canonical floating action button — use for the list's add CTA.
- **T3.5-2** `useReducedMotion()` lives in `src/mobile/hooks/useReducedMotion.ts`. Use it for the swipe transition.
- **T3.5-2** `MobileLoadingSkeleton` variants: `'card' | 'row' | 'avatar'`. Use `'row'` for connection rows + key rows.
- **T3.5-4** established the full-screen-push pattern (workspace screen). Mirror exactly for the connection form — `isFullScreenRoute()` returns true → `MobileApp.tsx` returns `<MobileRouteRenderer route={topRoute} />` directly without the root `MobileScreen` shell. Add `connection-form:` to the prefix check.
- **T3.5-4** established cross-tree import discipline: only allow data hooks (in this story: `useSshCommands` hooks) and types. Forbid component imports from `@renderer/components/`.
- **T3.5-5** established the `MobileSheet`-based confirmation pattern (chat new-session sheet). Reuse for delete confirmation (AC 14).
- **T3.5-5** established the deep-link integration test pattern: pre-set `tabStacks.<tab> = [...]`, mount `MobileApp`, assert the screen renders. Mirror for back-press tests (AC 15).
- **T3.5-6** established the cross-tree allowlist as a strict table with forbidden-imports list. This story mirrors the strictness (AC 17).
- **T3.5-6** established the `MobileSheet` + 2 buttons pattern for confirm dialogs (NOT `AlertDialog`). Reuse for delete confirmation (AC 14).
- **T3.5-6** established the layered-sheet pattern (approve confirm sheet rendered alongside the screen). Extend to nested sheets here (key picker → generate key — AC 12).
- **T3.5-6** confirmed `MobileSheet` Radix integration works correctly with sr-only `Dialog.Title` + `aria-describedby={undefined}` patches. Reuse the primitive as-is.
- **Existing desktop SSH flows** (`SshConnectionsPanel.tsx`, `MobileSshConnectionForm.tsx`) — mirror the data flow + Test/Save/Install patterns; rebuild surface in mobile tree per the cross-tree allowlist.
- **Test pattern**: `vitest` + `@testing-library/react`; colocated `.test.tsx`; `render` + `screen` + `fireEvent` + `act`. Match patterns in `MobileTaskWorkspaceScreen.test.tsx`, `MobileChatScreen.test.tsx`, `MobileDiffViewerScreen.test.tsx`.
- **Pre-existing failing tests:** Compare `npm test` line-for-line to T3.5-6 baseline. Don't introduce new failures.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Mobile screen location | `src/mobile/ssh/` for all SSH/connection components | `architecture.md` §"`src/mobile/` Directory Structure" |
| Connections list route | `connections` (tab sub-route inside settings tab — NOT full-screen) | this story AC 1 |
| Connection form route | `connection-form:new` / `connection-form:<id>` full-screen push (extend `isFullScreenRoute`) | this story AC 2 |
| Token discipline | Calm Command CSS vars only EXCEPT 3 documented exceptions: status dots, test-result banners, Key icon sky | `architecture.md` §"Mobile Primitive Contract" §1; `globals.css`; UX-DR4, UX-DR9 |
| Touch targets | ≥44 pt iOS / ≥48 dp Android — `min-h-[2.75rem]` matches | UX-DR7 |
| A11y | Semantic HTML, `aria-label` on icon-only buttons (FAB, swipe action buttons, back button), focus visible, `role="dialog"` via Radix on sheets | `architecture.md` §"Mobile Primitive Contract" §3; UX-DR6 |
| Safe-area | FAB respects `env(safe-area-inset-bottom)` via primitive; form action bar via `MobileBottomActionBar` primitive | `architecture.md` §"Mobile Primitive Contract" §4 |
| Reduced motion | Swipe transition skipped when reduced; sheet animations gated by primitive | T3.5-2 contract |
| Deep-link table | `tinsu://settings/connections` → `{tab: 'settings', stack: ['home', 'connections']}` | this story AC 16; UX plan §2.4 line 150 |
| Forbidden imports | NO imports from desktop `SshConnectionsPanel`, `MobileSshConnectionForm`, button/dialog/textarea/input/label/select primitives | this story AC 17 |
| Desktop preserved | NO edits to `src/components/**`, `src/hooks/**`, `src/stores/**`, `src-tauri/**`; mobile is parallel tree | CLAUDE.md, sprint-change-proposal-2026-04-30.md |
| Settings entry point | `MobileSettingsHome` gets a minimal Connections row — full rebuild deferred to T3.5-8 | this story AC 18 |
| Mutation surface | All SSH ops via `useSshCommands` hooks; toasts owned by screen | this story AC 17 |
| Workspace integration | n/a — workspace screen unchanged | n/a |

### Git intelligence (recent commit patterns)

```
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
c8148ab docs(course-correction): mobile UX native redesign — parallel tree (Epic 3.5)
24dfc4a fix android build
f8ec1e6 fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile
43a6488 fix: [t3-7] SSH form UX + [t3-2/t3-3/t3-5] mobile UI improvements
```

- The latest course-correction commits (`cd023c2`, `c8148ab`) are the authoritative source for the parallel-tree decision and the cross-tree import discipline.
- The earlier `43a6488` t3-7 commit is the **legacy** SSH form work (mobile-on-desktop responsive branching pre-Epic 3.5). This story REPLACES that approach with the parallel-tree implementation. The desktop `MobileSshConnectionForm.tsx` stays for reference but is NOT imported by mobile.
- Read T3.5-4's commits (look for `t3-5-4` in `git log`) to understand the workspace full-screen push pattern. The connection form full-screen push mirrors it.
- Read T3.5-6's commits (look for `t3-5-6` in `git log`) to understand `MobileSheet`-based confirmation + layered sheets.
- Read `src/mobile/MobileApp.tsx` to see the existing `isFullScreenRoute` helper + `MobileRouteRenderer` + the existing `if (route === 'connections')` placeholder branch (lines 193–200) — this story replaces it.
- Read `src/mobile/shell/deeplinks.ts` to see the existing `case 'chat':` and `case 'task':` branches — this story adds `case 'settings':`.

### Latest technical specifics

- **React 19** is adopted. `useId`, `use()`, `useTransition` available; only adopt where natural.
- **Tailwind v4** uses `@theme inline` (already wired). Token vars: `--background`, `--card`, `--primary`, `--destructive`, `--muted-foreground`, `--border`. Prefer `bg-card/95 backdrop-blur-xl` for elevated surfaces; use `bg-destructive` for the Delete button (token-derived, not `bg-red-600`).
- **`@tanstack/react-query` v5** + Tauri rspc commands: hooks return `{ data, isLoading, error, refetch }`; mutations return `{ mutateAsync, isPending, isError, error, reset }`. The `useSshCommands` hooks already wrap the Tauri commands and throw on `result.status === 'error'`.
- **`@radix-ui/react-dialog`** (via `MobileSheet`): the sheet auto-portals to `document.body`, focus-traps, Esc-dismisses. Don't reimplement.
- **CSS `env(safe-area-inset-bottom)`** is supported by Tauri WebView on iOS and Android. `MobileBottomActionBar` and `MobileFab` already apply it.
- **`Element.scrollIntoView({ behavior, block })`**: not used in this story (no diff scroll-to-file).
- **`navigator.vibrate`**: supported on Android Tauri WebView; iOS WebKit ignores. Use as best-effort haptic feedback.
- **`SshConnectionProfile` shape** (from `src/bindings.ts` line 796):
  ```ts
  type SshConnectionProfile = {
    id: string,
    host: string,
    port: number,
    username: string,
    auth_method: string,        // 'key' | 'password' (string in bindings)
    key_name: string | null,
    created_at: number,         // Unix seconds
  }
  ```
  No `status` / `last_connected_at` fields — see AC 6 for the local status-map strategy.
- **`SshConnectionTestResult` shape** (line 806):
  ```ts
  type SshConnectionTestResult = {
    success: boolean,
    fingerprint: string | null, // SHA256 host fingerprint on success
    error: string | null,       // error description on failure
  }
  ```
- **`SshKeyEntry` shape** (line 814):
  ```ts
  type SshKeyEntry = { name: string, public_key: string }
  ```
- **`InstallSshKeyInput` shape** (line 621):
  ```ts
  type InstallSshKeyInput = {
    host: string, port: number, username: string,
    password: string,    // one-time, never stored
    key_name: string,    // user-provided name for the new key
  }
  ```
- **`useInstallSshKey` hook** (`useSshCommands.ts` line 87): returns `{ mutateAsync(input) → Promise<SshKeyEntry>, isPending, ... }`. Invalidates `['ssh_keys']` on success.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (Epic 3.5 charter — Section 4.4 SSH/connections scope)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T3.5-7-Mobile-SSH-and-Connection-Management] (canonical AC source — lines 1068–1086)
- [Source: _bmad-output/planning-artifacts/architecture.md#src-mobile-Directory-Structure] (canonical screen + component locations)
- [Source: _bmad-output/planning-artifacts/architecture.md#Deep-Link-Routing-Table] (deep-link table — `tinsu://settings/connections` added by this story)
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (token, touch-target, a11y, safe-area, reduced-motion rules)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#3.6] (SSH connection management decisions — list+wizard, mandatory test, key generation flow, swipe-left actions, connection cards; this story deviates on bottom-sheet wizard → full-screen push, AC 2, and on hard-test-gate → recommendation, AC 13)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#2.4] (deep-link table — `tinsu://settings/connections` line 150)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#7.2] (component list — `MobileConnectionsList`, `MobileSshAddSheet`, `MobileGenerateKeySheet`, `MobileTestConnectionSheet`, `MobileConnectionDetailSheet`)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Visual-Design-Foundation] (typography + tokens)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Accessibility-Considerations] (UX-DR4, UX-DR6, UX-DR7, UX-DR9)
- [Source: _bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md] (shell + nav store + route renderer + deep-link parser; settings tab root `'home'`)
- [Source: _bmad-output/implementation-artifacts/t3-5-2-mobile-primitives-library.md] (primitive contracts: `MobileSheet`, `MobileBottomActionBar`, `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `MobileSegmentedTabs`, `MobileFab`, `useReducedMotion`)
- [Source: _bmad-output/implementation-artifacts/t3-5-4-mobile-task-workspace.md] (full-screen push pattern; cross-tree import discipline)
- [Source: _bmad-output/implementation-artifacts/t3-5-5-mobile-planning.md] (cross-tree allowlist enforcement template; `MobileSheet`-based new-session pattern; full-screen push test patterns)
- [Source: _bmad-output/implementation-artifacts/t3-5-6-mobile-review.md] (cross-tree allowlist strictness; `MobileSheet` + 2-button confirmation pattern; layered-sheet pattern; AC-21 token-discipline exception template)
- [Source: src/mobile/MobileApp.tsx] (route renderer; this story replaces `connections` placeholder + adds `connection-form:` branch + extends `isFullScreenRoute`)
- [Source: src/mobile/shell/mobile-nav.store.ts] (`pushRoute`, `popRoute`, `handleBackPress`, `parseDeepLink` — DO NOT modify)
- [Source: src/mobile/shell/deeplinks.ts] (`parseDeepLink` — this story adds `case 'settings':` branch)
- [Source: src/mobile/primitives/MobileSheet.tsx] (snap-point + a11y + Radix Dialog wiring)
- [Source: src/mobile/primitives/MobileBottomActionBar.tsx] (primary/secondary slots — used for form Save/Cancel)
- [Source: src/mobile/primitives/MobileListItem.tsx] (list-row primitive — leading/title/subtitle/trailing slots for connections + keys)
- [Source: src/mobile/primitives/MobileSegmentedTabs.tsx] (segmented picker — used for auth method)
- [Source: src/mobile/primitives/MobileFab.tsx] (floating action button — used for list "Add Connection")
- [Source: src/mobile/primitives/MobileEmptyState.tsx] (empty-state shape)
- [Source: src/mobile/primitives/MobileLoadingSkeleton.tsx] (skeleton variants)
- [Source: src/mobile/hooks/useReducedMotion.ts] (reduced-motion gating hook)
- [Source: src/mobile/settings/MobileSettingsHome.tsx] (placeholder this story replaces with minimal entry point)
- [Source: src/components/remote/MobileSshConnectionForm.tsx] (desktop reference: form layout + Test + InstallKey + haptic patterns — mirror, do NOT import)
- [Source: src/components/settings/SshConnectionsPanel.tsx] (desktop reference: list + ConnectionDialog + ConnectionRow patterns — mirror, do NOT import; note: contains hex literals that violate token discipline — DO NOT replicate those)
- [Source: src/hooks/useSshCommands.ts] (cross-tree allowed: all 7 SSH hooks)
- [Source: src/lib/rspc.ts] (TYPE-ONLY for `SshConnectionProfile`, `SshKeyEntry`, `CreateSshConnectionInput`, `UpdateSshConnectionInput`, `TestSshConnectionInput`, `SshConnectionTestResult`, `InstallSshKeyInput`)
- [Source: src/bindings.ts] (auto-generated tauri-specta types — line 796–820 `SshConnectionProfile` / `SshConnectionTestResult` / `SshKeyEntry`; lines 489, 621, 839, 881 `*Input` shapes)
- [Source: src/globals.css] (Calm Command token definitions)
- [Source: CLAUDE.md] (`/frontend-design` mandate; mobile-tree-not-branch rule; src/mobile/ ownership)

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

(to be filled by dev agent)

### Completion Notes List

(to be filled by dev agent)

### File List

(to be filled by dev agent)

### Review Findings

- [x] [Review][Patch] Edit mode form fields not pre-populated when useListSshConnections loads async [src/mobile/ssh/MobileConnectionFormScreen.tsx:93-99] — FIXED: added `useEffect` to sync form state when `existingConnection` becomes available after async load
- [x] [Review][Patch] Edit mode "not found" guard required `connections.length > 0` which incorrectly skipped the not-found UI when connections list loaded empty [src/mobile/ssh/MobileConnectionFormScreen.tsx:121] — FIXED: removed `connections.length > 0` guard; updated test to provide correct fixture data and added a dedicated "not found" test
- [x] [Review][Dismiss] Port field `Number('')` gives 0 on clear — validation `port >= 1` prevents save silently; acceptable v1 behavior, no crash risk
- [x] [Review][Dismiss] Status dot color classes (bg-emerald-500, bg-amber-500) in MobileConnectionRow.tsx vs. MobileConnectionsListScreen.tsx per AC-20 wording — acceptable component composition, functionally compliant
- [x] [Review][Dismiss] MobileFab hardcodes data-testid="mobile-fab" ignoring data-testid="mobile-connections-fab" from AC-3 — known prior-story primitive contract; tests correctly use "mobile-fab"; AC deviation accepted

### Change Log

| Date | Change |
|------|--------|
| 2026-04-30 | Story created (SM Opus 4.7) |
| 2026-04-30 | Code review complete — 2 auto-fixes applied (edit mode useEffect state sync, not-found guard fix), 3 dismissed, all 110 tests passing (DEV 2 Sonnet 4.6) |
