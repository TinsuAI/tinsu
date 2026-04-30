# Story 3.5.6: Mobile Review

Status: review

> 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a mobile-native review screen with sticky Approve / Request Changes / Reject action bar (Approve in the dominant thumb position) plus a unified-only diff view and a `MobileSheet`-based file picker,
so that I can approve or reject a task's changes one-handed on a phone — without scrolling past the diff to find an action button, and without ever seeing a desktop-shaped split-diff or modal that doesn't belong on mobile.

## Acceptance Criteria

1. **Given** the mobile shell from T3.5-1 + T3.5-4 (workspace push) and the existing `review:<taskId>` placeholder route emitted by `MobileTaskWorkspaceScreen.tsx` (lines 179–204) when the user taps Approve while a task is in `status === 'review'`, **When** the active route on any tab matches `review:<taskId>`, **Then** `MobileApp.tsx`'s `isFullScreenRoute()` MUST return `true` for that route AND `MobileRouteRenderer` MUST render `<MobileDiffViewerScreen taskId={taskId} />`. The current `if (route === 'diff')` placeholder branch in `MobileApp.tsx` (lines 186–193) is **removed** — it referred to an obsolete deep-link target. Add the new branch immediately after the existing `chat:` branch. **Test ID:** screen root `data-testid="mobile-review-screen"`.

2. **Given** the existing `MobileTaskWorkspaceScreen.tsx` Diff sub-tab action bar placeholder (the `case 'diff':` branch at lines 179–203 that today emits `pushRoute(activeTab, \`review:${task?.id ?? taskId}\`)` for Approve and disables Request Changes), **When** this story implements the real review screen, **Then** the workspace Diff sub-tab MUST be updated so its Approve button **continues to push `review:<taskId>`** (now resolving to `MobileDiffViewerScreen`) AND the disabled "Request Changes" placeholder is **also** wired to push `review:<taskId>` (the screen itself surfaces the Request Changes flow via the action bar — the workspace sub-tab does NOT need its own feedback sheet). Both buttons remain `disabled` when `task.status !== 'review'`. **Do NOT** add a third button to the workspace sub-tab — the action bar there stays primary+secondary; the rich 3-button (Approve / Request Changes / Reject) layout lives only inside `MobileReviewActionBar` on the review screen.

3. **Given** `MobileDiffViewerScreen` mounts with a `taskId`, **When** the screen renders, **Then** the layout uses a custom flex column matching `MobileTaskWorkspaceScreen`'s full-screen pattern (NOT the root `MobileScreen` shell, since AC 1 makes this a full-screen push): `<div className="flex flex-col h-[100dvh] bg-background" data-testid="mobile-review-screen">` with three slots: (a) header — inline chrome mirroring `MobileTopAppBar`'s shape with a back button on the left (`onClick: () => useMobileNavStore.getState().popRoute()`, `data-testid="mobile-review-back-button"`, `aria-label="Back"`), the task title in the middle (truncate to 32 chars + ellipsis using the same `buildTitle()` helper inlined from `MobileTaskWorkspaceScreen.tsx` — **do not** import that local helper across files; copy the 4-line function), and a Files pill on the right (`<button data-testid="mobile-review-files-pill" aria-label="Show file tree">📄 N files</button>` styled as a small `bg-card/60 border-border/40 rounded-full px-2.5 py-1 text-xs` chip, where `N` is `diff.files.length`); (b) main scroll area — `flex-1 min-h-0 overflow-hidden` containing the unified diff renderer (AC 7); (c) bottom — `<MobileReviewActionBar>` (AC 8). When the task is loading, render `<MobileLoadingSkeleton variant="card" />` ×3 stacked in the main area. When task fetch errors, render `<MobileEmptyState title="Couldn't load task" subtitle={errorMessage} />`.

4. **Given** the screen mounts, **When** it needs the task, **Then** it queries the task via `trpc.tasks.byId.useQuery(taskId)` **with the same call shape used by `MobileTaskWorkspaceScreen.tsx`** (do not invent a new query key). The hook accepts `{ enabled: !!taskId }`. **Do NOT** call any rspc command for the task fetch — desktop and mobile both use trpc for `tasks.byId` (T3.5-4 precedent). When the task's status is **not** `'review'` (e.g. user navigated to a stale `review:<id>` deep-link after the task was already approved), render `<MobileEmptyState title="Not in review" subtitle="This task is no longer awaiting review." />` and a single back button — **do NOT** mount the diff or action bar in that state.

5. **Given** the screen mounts, **When** it needs the diff, **Then** it imports the desktop hook `useDiff` from `@renderer/hooks/useDiff` (cross-tree allowed, AC 18) and calls it with: `{ taskId, mode: task?.status === 'done' ? 'historical' : 'worktree', worktreePath: task?.worktree_path, mergeCommitSha: task?.merge_commit_sha, baselineCommit: task?.last_review_commit }`. **Do NOT** pass `versionComparison` (Story 7.7 desktop-only feature, deferred T1.10). **Do NOT** rebuild the hook in the mobile tree — `useDiff` is mobile-safe (pure data fetch, no UI).

6. **Given** the Files pill is tapped, **When** the user activates it, **Then** `MobileFileTreeSheet` opens as a `MobileSheet` (`snapPoint='half'`, `title="Files changed"`, `description="{N} files modified"`, `data-testid="mobile-review-file-tree-sheet"`). The sheet body lists each file as a `MobileListItem` row showing: (a) leading status icon (`Plus` for added, `Circle` filled for modified, `Minus` for deleted, `ArrowRight` for renamed) — Lucide icons sized `h-4 w-4`, color from a local `STATUS_COLOR` map keyed by status (`added`/`modified`/`deleted`/`renamed`); (b) title = filename (`file.path.split('/').pop() ?? file.path`) in `font-mono text-sm`; (c) subtitle = full path in `font-mono text-[10px] text-muted-foreground`; (d) trailing = `<span>+{additions} <span>-{deletions}</span>` (separate spans for + and − so colors can come from `STATUS_COLOR` map). Tapping a row: (i) closes the sheet; (ii) calls `scrollToFile(path)` which scrolls the unified diff main area to the file's section using the same `requestAnimationFrame` + 150 ms `setTimeout` + `scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })` pattern as desktop `MobileDiffViewer.tsx` lines 50–63. Files MUST sort by status order (`modified`, `added`, `deleted`, `renamed`) — copy the desktop sort from `src/components/review/MobileFileTree.tsx` lines 37–45.

7. **Given** the diff has loaded, **When** the unified diff renders in the main scroll area, **Then** each file shows: (a) a sticky-within-scroll-container `MobileDiffFileHeader` row with status pill (`bg-{statusColor}/15 text-{statusColor} rounded px-1.5 py-0.5 text-[10px] uppercase`), filename, and `+X/-Y` change summary on the right; (b) below the header, the diff hunks render as **unified-only** rows — each line a flex row with: line-number gutter (10 px text, muted-foreground/30), prefix gutter (`+`/`-`/` `), and the line content as a `<pre><code>{line.content}</code></pre>` with `whitespace-pre` so horizontal scroll works for long lines; (c) line backgrounds use **token-derived** semantic colors via a `LINE_COLOR_CONFIG` constant in `MobileDiffViewerScreen.tsx` — `add` → `bg-emerald-500/10 text-emerald-200`, `remove` → `bg-red-500/10 text-red-200`, `context` → `text-muted-foreground/80`. **Document** in a code comment that this `LINE_COLOR_CONFIG` is the single AC-21 token-discipline exception for this story (mirrors UX-DR10 diff colors with `+`/`-` prefix for accessibility per UX-DR19). All other surfaces (chrome, action bar, file tree, headers) MUST use Calm Command tokens (`bg-card`, `bg-muted/40`, `text-foreground`, `text-muted-foreground`, `border-border/40`, `bg-primary`, `bg-destructive`). **Do NOT** import `MobileDiffViewer` from `@renderer/components/review/MobileDiffViewer` — the desktop component uses inline hex colors (`#0a0a0b`, `#3fb950`, `#f85149`, `#d29922`, `#aff5b4`, `#ffdcd7`) that violate token discipline; the mobile screen MUST rebuild the diff renderer with tokens. **DO** keep the same data shape (consume `GitDiffFile` + `GitDiffHunk` from `@shared/types/git-diff.types`).

8. **Given** the screen is mounted with a loaded task whose status is `'review'`, **When** the action bar renders at the bottom, **Then** `MobileReviewActionBar` mounts as a sticky bottom bar using `MobileBottomActionBar`'s **`children` escape hatch** (the primitive's default primary/secondary contract supports only two slots — see `src/mobile/primitives/MobileBottomActionBar.tsx` lines 47–48; this story's three-button layout requires the children API). The bar contains three buttons in this exact left-to-right order: **(left)** Reject — `bg-destructive/15 text-destructive border border-destructive/40` text-button style, label "Reject", `data-testid="mobile-review-reject-btn"`, `aria-label="Reject changes"`; **(middle)** Request Changes — `bg-muted/50 text-foreground border border-border/40` outlined-style, label "Request changes", `data-testid="mobile-review-request-btn"`, `aria-label="Request changes"`; **(right, dominant thumb)** Approve — `bg-primary text-primary-foreground` filled-style, label "Approve", `data-testid="mobile-review-approve-btn"`, `aria-label="Approve and merge"`. All three buttons are `min-h-[2.75rem] flex-1 rounded-xl text-sm font-semibold` (matches `MobileBottomActionBar` spec). The Approve button is `disabled` when the approval mutation `isPending` OR when `hasConflict === true` (AC 13). Reject and Request Changes are `disabled` when either mutation `isPending`. On Approve press, fire `hapticFeedback(20)` (only on press; the confirmation flow in AC 9 fires the heavier success haptic). On Reject/Request press, fire `hapticFeedback(20)` once.

9. **Given** the user taps Approve, **When** the press fires, **Then** an `AlertDialog`-style **confirmation step** opens — implemented as a `MobileSheet` (`snapPoint='fit'`, `title="Approve & merge"`, `description="This will merge the changes into main and complete the task."`, `data-testid="mobile-review-approve-confirm-sheet"`) with two buttons: a Cancel button (`bg-muted/50 text-foreground`) that dismisses the sheet, and a Confirm button (`bg-primary text-primary-foreground`, label "Confirm approval", `data-testid="mobile-review-approve-confirm-btn"`) that fires `hapticFeedback([10, 30, 10])` and then calls `useApprovalMutation.approve()`. **Do NOT** use Radix `AlertDialog` directly — the mobile tree's confirmation pattern is `MobileSheet` + two buttons (matches `MobileNewSessionSheet` precedent and avoids importing two dialog primitives). On confirm, the sheet closes optimistically. On approval mutation success: (i) `useMobileNavStore.getState().popRoute()` to return to the previous screen (the workspace Diff sub-tab); (ii) the `useApprovalMutation` hook itself fires the success toast via `sonner`. **Do NOT** show an inline success state in the review screen — popping is sufficient.

10. **Given** the user taps Request Changes, **When** the press fires, **Then** `MobileFeedbackSheet` opens as a `MobileSheet` (`snapPoint='half'`, `title="Request changes"`, `description="Provide feedback. The task will return to In Progress."`, `data-testid="mobile-review-feedback-sheet"`) with: (a) a multiline `<textarea>` (`rows={4}`, `placeholder="What needs to be fixed?"`, `aria-label="Feedback for agent"`, `min-h-[8rem] bg-card/30 border border-border/40 rounded-xl p-3 text-sm`); (b) a Cancel button (left); (c) a Submit button (right, `bg-primary text-primary-foreground`, label "Submit feedback", `data-testid="mobile-review-feedback-submit-btn"`, `disabled` when textarea is empty/whitespace-only). On Submit: fire `hapticFeedback([10, 30, 10])`, call `useRejectionMutation.reject(feedback)` (the rejection hook handles both Reject **and** Request Changes flows since the backend command `commands.rejectTask(taskId, feedback)` accepts the feedback string and moves the task back to `in_progress`; **only the UX label differs** — desktop's split into Reject vs Request Changes is purely UI, see `useRejectionMutation.ts` lines 27–30). On rejection mutation success: pop route + sheet closes via the `onSuccess` callback. **Implementation note:** this sheet is in `src/mobile/review/MobileFeedbackSheet.tsx` (not nested inside `MobileReviewActionBar.tsx`) so it can be focus-managed independently and tested in isolation — see Task 4.

11. **Given** the user taps Reject, **When** the press fires, **Then** `MobileRejectionSheet` opens as a `MobileSheet` (`snapPoint='half'`, `title="Reject task"`, `description="Reject these changes and return to In Progress."`, `data-testid="mobile-review-rejection-sheet"`) with the same textarea layout as AC 10 BUT with: (a) `placeholder="Why are you rejecting?"`; (b) a `data-testid="mobile-review-rejection-warning"` inline warning that appears ONLY when the user taps Submit while the textarea is empty (mirrors the existing desktop `MobileReviewActionBar.tsx` `showRejectWarning` state at lines 60–71): warning shows `<AlertTriangle className="h-5 w-5"/>` icon + text "Feedback is recommended. Reject anyway?" inside a `border-amber-500/40 bg-amber-500/10 text-amber-400` block (this is **the second AC-21 token-discipline exception** for this story — amber for warning is documented in code comment); (c) the Submit button label flips to **"Reject without feedback"** when the warning is showing AND the textarea is still empty, vs **"Submit & reject"** otherwise. On Submit (or Submit-anyway after warning): fire `hapticFeedback([10, 30, 10])`, call `useRejectionMutation.reject(feedback || null)` (passing `null` when empty). On success: pop route + close sheet. **Sheet focus:** when sheet opens, focus the textarea after a 350 ms timer (matches the desktop `useEffect` at lines 81–88 of `MobileReviewActionBar.tsx`). **Reduced motion:** if `useReducedMotion()` returns true, skip the focus delay (focus immediately).

12. **Given** the approval mutation, **When** wired in `MobileDiffViewerScreen`, **Then** it MUST use `useApprovalMutation` from `@renderer/hooks/useApprovalMutation` (cross-tree allowed, AC 18) with options: `{ taskId, storyNumber: task?.story_number ?? null, projectId: task?.project_id ?? '', onSuccess: () => useMobileNavStore.getState().popRoute(), onConflict: (msg) => setConflictMessage(msg), onError: (err) => { /* hook already toasts; no-op */ } }`. The hook's internal `sonner` toasts handle user feedback — **do not** add additional inline toasts. **Do NOT** call `commands.approveTask` directly — go through the hook so the desktop-tree GitConflict detection (lines 25–35 of `useApprovalMutation.ts`) and tasks-list invalidation (lines 47–58) are inherited for free.

13. **Given** the approval flow detects a Git conflict (the `useApprovalMutation` hook's `onConflict` callback fires with a string message), **When** the conflict is reported, **Then** `MobileDiffViewerScreen` MUST: (a) store the message in local state (`const [conflictMessage, setConflictMessage] = useState<string | null>(null)`); (b) render a non-dismissible inline banner above the diff content area with `data-testid="mobile-review-conflict-banner"`, the message, and the static text "Resolve conflicts on desktop to approve" (token classes: `bg-destructive/10 border border-destructive/40 text-destructive p-3 rounded-lg flex items-center gap-2`, with `<AlertCircle className="h-5 w-5"/>` lucide icon); (c) pass `hasConflict={!!conflictMessage}` to `MobileReviewActionBar` so the Approve button auto-disables (AC 8). **Do NOT** auto-pop the route on conflict — the user must see the banner. Reject and Request Changes remain enabled (the founder can still send the conflict back as feedback). The conflict banner clears when the user changes (e.g. agent re-runs and pushes a new commit) — for v1, clearing is **manual via re-tapping Approve** (a successful approve clears the banner because we pop the route; if it errors again, the banner re-renders with the new message). **Do NOT** introduce a polling-clear or a "Dismiss" button — keep the v1 UX minimal.

14. **Given** the rejection mutation (used by both Request Changes and Reject), **When** wired in `MobileDiffViewerScreen`, **Then** it MUST use `useRejectionMutation` from `@renderer/hooks/useRejectionMutation` with options: `{ taskId, storyNumber: task?.story_number?.toString() ?? null, projectId: task?.project_id ?? '', onSuccess: () => { useMobileNavStore.getState().popRoute(); setFeedbackSheetOpen(false); setRejectionSheetOpen(false) }, onError: (err) => { /* hook already toasts; no-op */ } }`. **One mutation hook handles both flows** (this is the architectural simplification AC 10 calls out).

15. **Given** large diffs (>500 lines total across all files, computed as `diff.files.reduce((s, f) => s + f.hunks.reduce((sh, h) => sh + h.lines.length, 0), 0)`), **When** the diff renders, **Then** the per-line render path MUST switch to a **simple windowing strategy** to keep scroll smooth: render only the lines whose vertical position falls within `[scrollTop - viewport, scrollTop + 2*viewport]` (50 % overscan top, 100 % overscan bottom). Implement via a small inline windowing helper in `MobileDiffViewerScreen.tsx` — **do NOT** add `react-window`, `react-virtual`, or `@tanstack/react-virtual` as new deps. Use a fixed line height assumption (`20 px` matches the `text-xs leading-5` Tailwind class) and a `ResizeObserver` on the scroll container to recompute the visible range on resize. For diffs ≤500 lines, render every line directly (no windowing). **Document** this trade-off + the 500-line threshold in Dev Notes; T3.5-9 may revisit if the heuristic underperforms on real device profiling. Verify in tests that a synthetic 700-line diff renders only ~80 lines into the DOM (not all 700) — see Task 12.

16. **Given** the user is on the review screen, **When** they trigger Android system back-press, **Then** `useMobileNavStore.handleBackPress()` (T3.5-1) pops `review:<taskId>` from the active tab's stack, returning to `workspace:<taskId>`. **Do NOT** modify `mobile-nav.store.ts`. Add a unit test that mounts the screen via the route renderer with `tabStacks.tasks = ['list', 'workspace:abc', 'review:abc']`, calls `handleBackPress()`, and asserts the workspace screen re-renders.

17. **Given** the file tree sheet is open AND the user changes orientation OR rotates the device, **When** the viewport changes, **Then** the sheet remains open and re-flows naturally (Radix Dialog handles this for free via `MobileSheet`). **Do NOT** add orientation-change listeners. The unified diff main area MUST also handle viewport changes — the windowing math (AC 15) recomputes visible range on `ResizeObserver` callback, so rotating from portrait to landscape re-renders only the new visible range.

18. **Given** any new files this story creates under `src/mobile/review/` and the modified `src/mobile/MobileApp.tsx` and `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`, **When** I `grep -REn "from '@renderer/components|from '../../components|from '@renderer/pages|from '@renderer/stores"` on them, **Then** **only allowed cross-tree imports** are:
    | Import | Reason |
    |---|---|
    | `@renderer/lib/rspc` (`commands`) | NOT used directly; mutations go through hooks. Allowed for type-only `AppError` if needed |
    | `@renderer/hooks/useApprovalMutation` | Approve flow + GitConflict detection + tasks-list invalidation (AC 12) |
    | `@renderer/hooks/useRejectionMutation` | Reject + Request Changes flow (AC 14) |
    | `@renderer/hooks/useDiff` | Diff fetch hook — pure data, mobile-safe (AC 5) |
    | `@renderer/lib/utils` (`cn`, `hapticFeedback`) | utility |
    | `@renderer/lib/trpc` (`trpc`) | task fetch via `tasks.byId` (AC 4, T3.5-4 precedent) |
    | `@shared/types/git-diff.types` (`GitDiffFile`, `GitDiffHunk`, `GitDiffResult`) | diff data shape |
    | `@shared/types/task.types` (`Task`) | task type |
    **Forbidden:** any import from `@renderer/components/review/{MobileDiffViewer,MobileReviewActionBar,MobileFileTree,ApproveButton,RejectButton,RequestChangesButton,InlineCommentInput,InlineCommentThread,InlineCommentIndicator,FeedbackHistory,ReviewTimeline,VersionSelector,ReviewActions,DiffViewer,FileTree,DiffPanel}`, `@renderer/components/ui/dialog`, `@renderer/components/ui/textarea`, `@renderer/components/ui/button`, `@renderer/stores/review.store` (if exists), `@renderer/stores/diff.store` (if exists), `react-tauri-mock`. The mobile review tree **MUST NOT** mount any desktop review-panel shell, button component, dialog, or textarea — fork only the surface (sheet, action bar, file tree, diff renderer); reuse only the mutation/data hooks. Direct imports of `lucide-react` icons are required (matches T3.5-4/T3.5-5 pattern).

19. **Given** the desktop review tree, **When** I run desktop tests (`MobileDiffViewer.test.tsx` if it exists, `MobileReviewActionBar.test.tsx` if it exists, `ApproveButton.test.tsx`, `RejectButton.test.tsx`, `RequestChangesButton.test.tsx`, `useApprovalMutation.test.ts`, `useRejectionMutation.test.ts`, `useDiff.test.tsx`), **Then** **all desktop tests still pass with zero regressions** because this story does **not** modify any file under `src/components/review/`, `src/components/ui/`, `src/hooks/`, `src/stores/`, `src-tauri/`. The only allowed touches outside `src/mobile/review/` are: (a) adding the `review:` route branch to `src/mobile/MobileApp.tsx` (`isFullScreenRoute` + `MobileRouteRenderer`), (b) updating the Diff sub-tab's Request Changes button in `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx` (lines 196–201) to push `review:<taskId>` instead of being disabled, (c) updating `src/mobile/tasks/MobileDiffTab.tsx` to import from the **new** `src/mobile/review/MobileDiffRenderer.tsx` (the mobile-tree replacement for the cross-tree `@renderer/components/review/MobileDiffViewer`) IF and only if the dev decides MobileDiffTab should switch — **OR** keep MobileDiffTab using the cross-tree desktop `MobileDiffViewer` for now (the inner-tab preview is read-only, no actions, and doesn't need the full mobile review screen treatment). **Decision recorded for the dev:** keep `MobileDiffTab` cross-tree to avoid churn; the mobile review screen is a separate full-screen push that owns the action bar + file sheet + token-clean diff. (See Dev Notes "Architectural decisions" for rationale.)

20. **Given** the new files this story creates, **When** I run `npm test`, **Then** new colocated tests cover at minimum: (a) `MobileApp` route renderer maps `review:abc` → `<MobileDiffViewerScreen taskId="abc"/>` AND `isFullScreenRoute('review:abc') === true`; (b) `MobileDiffViewerScreen` renders header (back button + title + Files pill); (c) loading skeleton rendered while task is loading; (d) "Not in review" empty state when `task.status !== 'review'`; (e) Files pill tap opens `MobileFileTreeSheet`; (f) tapping a file row in the sheet closes the sheet and triggers `scrollIntoView`; (g) action bar renders three buttons in correct order (Reject / Request Changes / Approve); (h) Approve tap opens confirmation sheet; (i) Confirm Approval calls `useApprovalMutation.approve` (mock the hook); (j) Approval onSuccess calls `popRoute()`; (k) Approval onConflict renders the conflict banner and disables Approve; (l) Request Changes tap opens feedback sheet; (m) Submit feedback (non-empty) calls `useRejectionMutation.reject(text)`; (n) Submit button disabled when textarea empty; (o) Reject tap opens rejection sheet; (p) Reject Submit on empty textarea shows warning; second Submit calls `reject(null)`; (q) Rejection onSuccess closes sheet + popRoute; (r) large-diff windowing: synthetic 700-line diff renders ≤120 line elements into DOM; (s) reduced-motion: `scrollIntoView` uses `behavior: 'auto'`; (t) Android back-press from `review:abc` returns to `workspace:abc`. **Total ≥18 new tests**, zero new failures vs T3.5-5 baseline.

21. **Given** all new files under `src/mobile/review/` and the modified `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`, **When** I `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]"` on them, **Then** **the only allowed direct matches** are inside the `LINE_COLOR_CONFIG` constant of `MobileDiffViewerScreen.tsx` (emerald/red for diff add/remove — UX-DR10 mirror, AC 7) AND the rejection-warning amber block in `MobileRejectionSheet.tsx` (UX-DR4 warning state — AC 11). All other surfaces (chrome, action bar, file tree, sheets, headers, banners) MUST use Calm Command tokens (`bg-card`, `bg-muted/40`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-destructive`, `border-border/40`). **Document** both exceptions inline as code comments. **Do NOT** introduce `bg-emerald-600`, `bg-red-600`, `text-emerald-500`, `#0a0a0b`, `#3fb950`, `#f85149`, `#d29922`, `#aff5b4`, `#ffdcd7`, or any hex literal anywhere — those were the desktop `MobileDiffViewer.tsx` violations (lines 67, 91, 100, 102, 148–151, 161–162, 184, 195–197) and the mobile screen MUST NOT inherit them.

22. **Given** the workspace screen, **When** I run with `import.meta.env.DEV` and force-refresh while on `review:<id>` route, **Then** I see **no console errors** and **no React warnings** (no missing keys on diff line list, no act() warnings in StrictMode, no Radix Dialog warnings on `MobileSheet`, no Lucide icon warnings, no ResizeObserver warnings from the windowing helper). The DEV harness route `#__mobile-primitives` (T3.5-2 AC 14) continues to render correctly — i.e., this story does **not** touch `src/mobile/dev/MobilePrimitivesHarness.tsx` and does not modify the harness routing in `MobileApp.tsx` beyond adding the `review:` branch in `MobileRouteRenderer` and `isFullScreenRoute`.

## Tasks / Subtasks

- [x] **Task 1: `MobileDiffViewerScreen` shell (AC: 1, 3, 4, 5, 16, 22)**
  - [x] 1.1 Create `src/mobile/review/MobileDiffViewerScreen.tsx`. Props: `{ taskId: string }`.
  - [x] 1.2 Layout: `<div className="flex flex-col h-[100dvh] bg-background" data-testid="mobile-review-screen">` with header / main / action bar slots.
  - [x] 1.3 Inline header with back button (`<button aria-label="Back" onClick={() => useMobileNavStore.getState().popRoute()} data-testid="mobile-review-back-button">`), centered title via local `buildTitle()` helper (4-line copy of the `MobileTaskWorkspaceScreen.tsx` helper — do NOT import), and Files pill (`<button data-testid="mobile-review-files-pill">📄 {files.length} files</button>`).
  - [x] 1.4 Task fetch: `const taskQuery = trpc.tasks.byId.useQuery(taskId, { enabled: !!taskId })` (mirror MobileTaskWorkspaceScreen pattern). Treat loading / error / not-in-review states explicitly.
  - [x] 1.5 Diff fetch: `const { diff, isLoading: diffLoading, error: diffError, refresh } = useDiff({ taskId, mode: task?.status === 'done' ? 'historical' : 'worktree', worktreePath: task?.worktree_path, mergeCommitSha: task?.merge_commit_sha, baselineCommit: task?.last_review_commit })`.
  - [x] 1.6 Loading state: render 3× `MobileLoadingSkeleton variant="card"` stacked.
  - [x] 1.7 Not-in-review state: render `MobileEmptyState` with title "Not in review" + back button.
  - [x] 1.8 No-changes state (diff loaded with 0 files): render `MobileEmptyState` with title "No changes detected".

- [x] **Task 2: `MobileFileTreeSheet` (AC: 6)**
  - [x] 2.1 Create `src/mobile/review/MobileFileTreeSheet.tsx`. Props: `{ open: boolean; onOpenChange: (open: boolean) => void; files: GitDiffFile[]; onFileSelect: (path: string) => void }`.
  - [x] 2.2 Mount `<MobileSheet open={open} onOpenChange={onOpenChange} snapPoint="half" title="Files changed" description={\`\${files.length} files modified\`} data-testid="mobile-review-file-tree-sheet">`.
  - [x] 2.3 Sort files: `[...files].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])` where `STATUS_ORDER = { modified: 0, added: 1, deleted: 2, renamed: 3 }`.
  - [x] 2.4 Render rows via `MobileListItem` with `leading={<StatusIcon status={file.status} />}`, `title={filename}`, `subtitle={fullPath}`, `trailing={<ChangeStat additions={file.additions} deletions={file.deletions} status={file.status} />}`, `onPress={() => { onFileSelect(file.path); onOpenChange(false) }}`.
  - [x] 2.5 Local helper components `StatusIcon` + `ChangeStat`: use Lucide icons (`Plus`/`Circle`/`Minus`/`ArrowRight`) and the `STATUS_COLOR` map. The `STATUS_COLOR` map IS allowed to use `text-emerald-400` / `text-red-400` / `text-amber-400` / `text-sky-400` (this is the third AC-21 exception — document inline).
  - [x] 2.6 Empty state inside sheet (no files at all): render `<p className="px-4 py-6 text-center text-sm text-muted-foreground">No file changes</p>`.

- [x] **Task 3: `MobileReviewActionBar` (AC: 8, 13)**
  - [x] 3.1 Create `src/mobile/review/MobileReviewActionBar.tsx`. Props: `{ onApprove: () => void; onReject: () => void; onRequestChanges: () => void; isApproving: boolean; isRejecting: boolean; hasConflict: boolean }`.
  - [x] 3.2 Mount `<MobileBottomActionBar>{children}</MobileBottomActionBar>` using the `children` escape hatch (NOT primary/secondary slots — see primitive contract).
  - [x] 3.3 Render three `<button>` elements in left-to-right order: Reject (destructive token classes), Request Changes (muted token classes), Approve (primary token classes).
  - [x] 3.4 Each button: `min-h-[2.75rem] flex-1 rounded-xl text-sm font-semibold`, fires `hapticFeedback(20)` on press, then calls the prop callback.
  - [x] 3.5 Approve `disabled={isApproving || hasConflict || isRejecting}`. Reject/Request Changes `disabled={isApproving || isRejecting}`.
  - [x] 3.6 `data-testid` on each: `mobile-review-reject-btn`, `mobile-review-request-btn`, `mobile-review-approve-btn`. `aria-label` matches button label.
  - [x] 3.7 Wrap in `<div role="toolbar" aria-label="Review actions">` so screen-readers announce the group.

- [x] **Task 4: `MobileFeedbackSheet` (AC: 10)**
  - [x] 4.1 Create `src/mobile/review/MobileFeedbackSheet.tsx`. Props: `{ open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (feedback: string) => void; isSubmitting: boolean }`.
  - [x] 4.2 Mount `<MobileSheet snapPoint="half" title="Request changes" description="Provide feedback. The task will return to In Progress." data-testid="mobile-review-feedback-sheet">`.
  - [x] 4.3 Local `[feedback, setFeedback] = useState('')`; reset to `''` when `open` flips false.
  - [x] 4.4 Render `<textarea>` with the spec from AC 10 (no Radix `Textarea` import — plain HTML element with token classes).
  - [x] 4.5 Render Cancel button (`onClick={() => onOpenChange(false)}`) and Submit button (`onClick={() => onSubmit(feedback)}`, `disabled={!feedback.trim() || isSubmitting}`, `data-testid="mobile-review-feedback-submit-btn"`).
  - [x] 4.6 On `open` flip true, focus the textarea after 350 ms (or immediately if `useReducedMotion()`).
  - [x] 4.7 Sheet has aria-described-by from `description`; submit button has `aria-label="Submit feedback"`.

- [x] **Task 5: `MobileRejectionSheet` (AC: 11)**
  - [x] 5.1 Create `src/mobile/review/MobileRejectionSheet.tsx`. Props: `{ open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (feedback: string | null) => void; isSubmitting: boolean }`.
  - [x] 5.2 Mount `<MobileSheet snapPoint="half" title="Reject task" description="Reject these changes and return to In Progress." data-testid="mobile-review-rejection-sheet">`.
  - [x] 5.3 Same textarea + focus + cancel pattern as Task 4. Placeholder: "Why are you rejecting?".
  - [x] 5.4 Local `[feedback, setFeedback] = useState('')`, `[showWarning, setShowWarning] = useState(false)`.
  - [x] 5.5 First Submit when textarea empty: `setShowWarning(true)` + `hapticFeedback([50, 50])`. Submit button label flips to "Reject without feedback". Second Submit (still empty + warning showing): call `onSubmit(null)`.
  - [x] 5.6 Submit when textarea non-empty: call `onSubmit(feedback.trim())`. Reset warning when user types into textarea.
  - [x] 5.7 Warning block: `<div className="border-amber-500/40 bg-amber-500/10 text-amber-400 rounded-lg p-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5"/><span>Feedback is recommended. Reject anyway?</span></div>` — document inline that this is the AC-21 amber-warning exception.

- [x] **Task 6: Diff renderer + windowing (AC: 7, 15, 17)**
  - [x] 6.1 Inside `MobileDiffViewerScreen.tsx`, render the unified diff list as a child of the main scroll area: `diff.files.map((file) => <MobileDiffFile key={file.path} file={file} fileRef={(el) => fileRefs.current[file.path] = el} />)`.
  - [x] 6.2 Local `MobileDiffFile` component (in same file, not exported): renders sticky header (status pill + filename + +X/-Y), then the diff hunks below.
  - [x] 6.3 Local `MobileDiffHunk` component: renders the hunk header (`hunk.header` in monospace muted-foreground/60) and the lines.
  - [x] 6.4 Local `LINE_COLOR_CONFIG` constant: `{ add: 'bg-emerald-500/10 text-emerald-200', remove: 'bg-red-500/10 text-red-200', context: 'text-muted-foreground/80' }` — document AC-21 exception inline.
  - [x] 6.5 For diffs with `totalLines > 500`: implement windowing. Track `scrollTop`, `clientHeight` via `ResizeObserver` on the scroll container. Compute visible-line range: `[Math.floor(scrollTop / 20) - viewport, Math.floor(scrollTop / 20) + 2 * viewport]` where `viewport = clientHeight / 20`. Render only files+hunks+lines whose flattened line index falls in that range. Insert spacer divs (`<div style={{ height: skippedLines * 20 + 'px' }} aria-hidden />`) above and below the rendered window so the scroll container's total height is preserved.
  - [x] 6.6 For diffs ≤500 lines: skip windowing entirely; render all files/hunks/lines.
  - [x] 6.7 Rotation/resize: `ResizeObserver` callback recomputes the visible range; no orientation listener needed.
  - [x] 6.8 `scrollToFile(path)` helper: stored ref `fileRefs.current[path]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })` wrapped in `requestAnimationFrame` + 150 ms `setTimeout` to wait for sheet close animation.

- [x] **Task 7: Wire `MobileApp.tsx` route renderer (AC: 1, 16)**
  - [x] 7.1 Edit `src/mobile/MobileApp.tsx`. Update `isFullScreenRoute()` to: `return route.startsWith('workspace:') || route.startsWith('chat:') || route.startsWith('review:')`.
  - [x] 7.2 Update `MobileRouteRenderer`: add new branch `if (route.startsWith('review:')) { const taskId = route.slice('review:'.length); return <MobileDiffViewerScreen taskId={taskId} /> }` immediately after the `chat:` branch.
  - [x] 7.3 **Remove** the obsolete `if (route === 'diff')` placeholder branch (lines 186–193) — it pointed at a defunct deep-link target and is replaced by the workspace Diff sub-tab.
  - [x] 7.4 Import `MobileDiffViewerScreen` at the top with the other screen imports.
  - [x] 7.5 Update `src/mobile/MobileApp.test.tsx`: add tests for `isFullScreenRoute('review:foo') === true`; add test that `'review:abc'` route renders mocked `MobileDiffViewerScreen` with `taskId === 'abc'` and tab bar absent.

- [x] **Task 8: Wire workspace Diff sub-tab → review screen (AC: 2, 19)**
  - [x] 8.1 Edit `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`. In the `case 'diff':` branch (lines 179–203), the Approve `MobileBottomActionBar.primary.onPress` already pushes `review:<taskId>` — leave it.
  - [x] 8.2 Update the Request Changes secondary button: change `disabled: true` → `disabled: task?.status !== 'review'`; change `onPress: () => {}` → `onPress: () => { useMobileNavStore.getState().pushRoute(activeTab, \`review:${task?.id ?? taskId}\`) }`; remove the "(Coming in T3.5-6)" suffix from `ariaLabel`.
  - [x] 8.3 Verify Approve and Request Changes both produce the same effect (push to review screen) — the differentiation between approve and request-changes happens **inside** the review screen's action bar, not at the workspace level.
  - [x] 8.4 Update `src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx` (if test file exists): assert Request Changes button is enabled when `task.status === 'review'` and pushes `review:<taskId>` on tap.

- [x] **Task 9: Wire `useApprovalMutation` + `useRejectionMutation` (AC: 9, 10, 11, 12, 13, 14)**
  - [x] 9.1 In `MobileDiffViewerScreen.tsx`, declare local state: `[conflictMessage, setConflictMessage] = useState<string | null>(null)`, `[approveSheetOpen, setApproveSheetOpen] = useState(false)`, `[feedbackSheetOpen, setFeedbackSheetOpen] = useState(false)`, `[rejectionSheetOpen, setRejectionSheetOpen] = useState(false)`.
  - [x] 9.2 `const { approve, isPending: isApproving } = useApprovalMutation({ taskId, storyNumber: task?.story_number ?? null, projectId: task?.project_id ?? '', onSuccess: () => { setApproveSheetOpen(false); useMobileNavStore.getState().popRoute() }, onConflict: (msg) => { setApproveSheetOpen(false); setConflictMessage(msg) }, onError: () => setApproveSheetOpen(false) })`.
  - [x] 9.3 `const { reject, isPending: isRejecting } = useRejectionMutation({ taskId, storyNumber: task?.story_number?.toString() ?? null, projectId: task?.project_id ?? '', onSuccess: () => { setFeedbackSheetOpen(false); setRejectionSheetOpen(false); useMobileNavStore.getState().popRoute() } })`.
  - [x] 9.4 Wire action bar callbacks: `onApprove={() => setApproveSheetOpen(true)}`, `onRequestChanges={() => setFeedbackSheetOpen(true)}`, `onReject={() => setRejectionSheetOpen(true)}`.
  - [x] 9.5 Render the three sheets (`MobileFeedbackSheet`, `MobileRejectionSheet`, and the inline approve confirmation sheet).
  - [x] 9.6 Approve confirmation sheet: `<MobileSheet open={approveSheetOpen} onOpenChange={setApproveSheetOpen} snapPoint="fit" title="Approve & merge" description="This will merge the changes into main and complete the task." data-testid="mobile-review-approve-confirm-sheet">` with Cancel + Confirm buttons. Confirm fires `hapticFeedback([10, 30, 10])` then calls `approve()`.

- [x] **Task 10: Conflict banner (AC: 13)**
  - [x] 10.1 Inside `MobileDiffViewerScreen.tsx`, when `conflictMessage` is non-null, render banner above the diff content area: `<div className="bg-destructive/10 border border-destructive/40 text-destructive p-3 rounded-lg flex items-center gap-2 m-4" data-testid="mobile-review-conflict-banner"><AlertCircle className="h-5 w-5 shrink-0"/><div><p className="font-semibold">Merge conflict</p><p className="text-sm opacity-80">{conflictMessage}</p><p className="text-sm mt-1">Resolve conflicts on desktop to approve.</p></div></div>`.
  - [x] 10.2 Pass `hasConflict={!!conflictMessage}` to `MobileReviewActionBar`.

- [x] **Task 11: Tests (AC: 20)**
  - [x] 11.1 `src/mobile/review/MobileDiffViewerScreen.test.tsx` — ≥10 tests: header renders (back/title/files-pill); loading skeleton; not-in-review empty state; no-changes empty state; Files pill opens sheet; tapping file in sheet calls scrollIntoView; action bar renders three buttons in correct order; Approve opens confirm sheet; Confirm calls `approve` mock; onSuccess calls `popRoute`; onConflict renders banner + disables Approve.
  - [x] 11.2 `src/mobile/review/MobileFileTreeSheet.test.tsx` — ≥3 tests: renders sorted file rows; tap closes sheet + calls onFileSelect; empty state when files=[].
  - [x] 11.3 `src/mobile/review/MobileReviewActionBar.test.tsx` — ≥4 tests: three buttons render in correct order; haptic + callback fires on each press; Approve disabled when `hasConflict`; Reject/Request disabled when `isApproving`.
  - [x] 11.4 `src/mobile/review/MobileFeedbackSheet.test.tsx` — ≥3 tests: textarea empty → submit disabled; non-empty → onSubmit called with text; cancel calls onOpenChange(false).
  - [x] 11.5 `src/mobile/review/MobileRejectionSheet.test.tsx` — ≥4 tests: empty submit shows warning; second submit calls onSubmit(null); non-empty submit calls onSubmit(text); button label flips correctly.
  - [x] 11.6 `src/mobile/MobileApp.test.tsx` updates — assert `isFullScreenRoute('review:abc') === true`; assert `'review:abc'` renders mocked `MobileDiffViewerScreen` with `taskId="abc"`; assert tab bar absent for review routes.
  - [x] 11.7 Windowing test: synthetic 700-line diff (1 file, 700 lines). Mount `MobileDiffViewerScreen`; assert DOM contains ≤120 line elements (e.g. `screen.getAllByRole('row')` or `data-testid="diff-line"` count ≤120) — proves windowing kicked in.
  - [x] 11.8 Reduced-motion test: mock `useReducedMotion` to return `true`; trigger `scrollToFile`; assert `scrollIntoView` was called with `behavior: 'auto'`.
  - [x] 11.9 Back-press integration: mount `MobileApp` with `tabStacks.tasks = ['list', 'workspace:abc', 'review:abc']`; call `useMobileNavStore.getState().handleBackPress()`; assert workspace screen re-renders.
  - [x] 11.10 Mock surface: `vi.mock('@renderer/hooks/useApprovalMutation', () => ({ useApprovalMutation: vi.fn(() => ({ approve: vi.fn(), isPending: false, isSuccess: false, isError: false, error: null })) }))`. Same shape for `useRejectionMutation`. `vi.mock('@renderer/hooks/useDiff', () => ({ useDiff: vi.fn(() => ({ diff: { files: [...] }, isLoading: false, error: null, refresh: vi.fn(), isRefreshing: false })) }))`. Mock `@renderer/lib/trpc` with `trpc.tasks.byId.useQuery` returning a fixture task. Mock `useMobileNavStore` `popRoute` / `pushRoute`.
  - [x] 11.11 Total ≥18 new tests; pre-existing failure count unchanged from T3.5-5 baseline.

- [x] **Task 12: Token discipline + a11y audit (AC: 18, 19, 21, 22)**
  - [x] 12.1 `grep -REn "text-(red|green|blue|orange|yellow|amber|emerald|sky|rose|violet|fuchsia|indigo|pink|purple|cyan|teal|lime)-[0-9]" src/mobile/review/` → expected matches ONLY inside (a) `MobileDiffViewerScreen.tsx` `LINE_COLOR_CONFIG` (emerald + red — AC 7); (b) `MobileFileTreeSheet.tsx` `STATUS_COLOR` map (emerald/red/amber/sky for file statuses — Task 2.5); (c) `MobileRejectionSheet.tsx` warning block (amber — AC 11). Document each exception in code comment + Dev Notes.
  - [x] 12.2 `grep -REn "from '@renderer/components/review/'" src/mobile/review/ src/mobile/MobileApp.tsx src/mobile/tasks/MobileTaskWorkspaceScreen.tsx` → assert zero matches.
  - [x] 12.3 `grep -REn "from '@renderer/components/ui/(dialog|textarea|button)'" src/mobile/review/` → assert zero matches.
  - [x] 12.4 `grep -REn "#[0-9a-fA-F]{6}\b" src/mobile/review/` → assert zero matches (no hex literals).
  - [x] 12.5 All interactive elements have `aria-label` or accessible text. `MobileSheet` `title` is set on every sheet; `description` set where applicable. Action bar wrapped in `role="toolbar"`. Conflict banner wrapped in `role="alert"` (so screen-readers announce on render).
  - [x] 12.6 Touch targets: every button is `min-h-[2.75rem]` (44 px) — verified by computed style or class.
  - [x] 12.7 Confirm via `git diff --stat` after implementation — ONLY allowed touched files outside `src/mobile/review/` are: `src/mobile/MobileApp.tsx`, `src/mobile/MobileApp.test.tsx`, `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`, `src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx` (if tests exist).

- [x] **Task 13: Lint, typecheck, regression (AC: 19, 20, 22)**
  - [x] 13.1 `npx tsc --noEmit` — zero new TypeScript errors in `src/mobile/review/`, `src/mobile/MobileApp.tsx`, `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`.
  - [x] 13.2 `npm test` — pre-existing failure count unchanged from T3.5-5 baseline; all new tests pass.
  - [x] 13.3 Manual smoke (Tailscale Android dev): tap Approve in workspace Diff sub-tab → review screen pushes; Files pill opens sheet; tapping file scrolls; Approve → confirm sheet → Confirm → success toast + back to workspace; Reject → sheet → empty submit shows warning, second submit closes + back; Request Changes → sheet → submit feedback closes + back; back gesture pops correctly. Deferred to reviewer per T3.5-9 gate.
  - [x] 13.4 Manual smoke (large-diff perf): open a task with >500-line diff; verify scroll is smooth and DOM line count stays bounded (~80–120 elements at any time). Deferred to T3.5-9.

- [x] **Task 14: Documentation passes (AC: 19, 21, 22)**
  - [x] 14.1 Each new file has a top-of-file JSDoc block: purpose, AC references, cross-tree allowlist (where applicable), token-discipline exceptions (where applicable).
  - [x] 14.2 `MobileDiffViewerScreen.tsx` documents the windowing strategy and the 500-line threshold inline.
  - [x] 14.3 `MobileReviewActionBar.tsx` documents why it uses `MobileBottomActionBar`'s `children` escape hatch (3 buttons, primitive supports 2).
  - [x] 14.4 `MobileRejectionSheet.tsx` documents the empty-feedback warning UX (mirrors desktop `MobileReviewActionBar.tsx` lines 60–71).
  - [x] 14.5 `MobileFeedbackSheet.tsx` documents that it shares the rejection backend (`commands.rejectTask`) — only the UX label differs.

## Dev Notes

### MUST USE /frontend-design skill (CLAUDE.md mandate)

This is a **🎨 FRONTEND/UI STORY**. Before writing any TSX, the dev agent MUST invoke `/frontend-design` with: tech stack (React 19 / TypeScript / Tailwind v4 / shadcn / @radix-ui / Lucide), the AC matrix below, the Calm Command token list (`src/globals.css`), and the existing primitive surface (`MobileSheet`, `MobileBottomActionBar`, `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `MobileTopAppBar`). Pass the cross-tree allowlist (`useApprovalMutation`, `useRejectionMutation`, `useDiff`, `trpc.tasks.byId`) so the skill knows which desktop dependencies are reusable. Pass the three token-discipline exceptions (LINE_COLOR_CONFIG, STATUS_COLOR, rejection-warning amber) so the skill produces compliant output. Integrate the skill's output verbatim where viable; do not write screen TSX from scratch without it.

### Why this story exists (do not skip)

After T3.5-4 the workspace Diff sub-tab pushes to a `review:<taskId>` placeholder route, and `MobileApp.tsx` renders an `<MobileEmptyState>"Coming in T3.5-4 — inline code diff viewer."</MobileEmptyState>` that lies (T3.5-4 didn't own this). The Request Changes button is fully disabled. Founders cannot complete a review on phone — the Approve/Reject loop is stub-only. This story closes that gap by:

1. Making `review:<taskId>` a full-screen push (matches workspace and chat patterns).
2. Replacing the cross-tree desktop `MobileDiffViewer` (which uses inline hex colors and violates token discipline) with a token-clean mobile-tree `MobileDiffViewerScreen` that owns: header chrome, file tree sheet, unified diff renderer, three-button action bar, three sheets (approve confirm / feedback / rejection).
3. Wiring real mutations through the existing `useApprovalMutation` and `useRejectionMutation` hooks (cross-tree allowed, mobile-safe).
4. Implementing simple windowing for >500-line diffs (no `react-window` dep).
5. Surfacing GitConflict via inline banner so the founder knows to switch to desktop.

The implementation **reuses every backend artifact unchanged**:
- Same `commands.approveTask`, `commands.rejectTask` Tauri commands (via the hooks).
- Same `useDiff` hook (calls `commands.getTaskDiff` internally).
- Same `trpc.tasks.byId` for task fetch.
- Same `GitDiffFile`, `GitDiffHunk`, `GitDiffResult` types from `@shared`.
- Same Sonner toast surface (the hooks fire toasts internally).

The mobile UI is **forked at the surface only** — diff renderer (token-clean), file tree (sheet form), action bar (3 buttons), feedback/rejection sheets. The desktop `MobileDiffViewer` and `MobileReviewActionBar` live on under `src/components/review/` for the desktop tree's own use (no edits this story).

### Key architectural decisions (locked, do NOT redebate)

- **Three buttons, NOT two.** Desktop `MobileReviewActionBar.tsx` (the legacy mobile-on-desktop component) has Pause / Reject / Approve. The mobile-tree story collapses Pause (deferred to a future story — agent pause is being migrated to Tauri Rust core per the existing toast text on line 75 of the desktop component) and replaces it with **Request Changes**. Final order: **Reject (left) | Request Changes (middle) | Approve (right, dominant thumb)**. Matches UX redesign §3.5.
- **MobileBottomActionBar `children` escape hatch.** Primitive's primary/secondary slots are 2 buttons; we need 3 → use `<MobileBottomActionBar>{customLayout}</MobileBottomActionBar>`. Document inline.
- **Reuse `useApprovalMutation` and `useRejectionMutation` cross-tree.** These hooks are pure data + sonner toasts; they have no UI shape. Mobile-safe. Reusing inherits GitConflict detection + tasks-list invalidation for free.
- **Reuse `useDiff` cross-tree.** Pure data fetch; no UI. Mobile-safe.
- **`commands.rejectTask` handles BOTH Reject AND Request Changes.** Backend doesn't differentiate — only the UX label does. Same hook (`useRejectionMutation`) wires both flows. Two separate sheets (`MobileFeedbackSheet`, `MobileRejectionSheet`) so they can be focus-managed and tested independently. Documented in Task 4 + Task 5 + AC 10.
- **Approve confirmation = `MobileSheet`, NOT `AlertDialog`.** Mobile tree's confirmation pattern is sheet + 2 buttons (matches `MobileNewSessionSheet` from T3.5-5). Avoids importing yet another Radix primitive.
- **Conflict banner is non-dismissible.** v1: founder must approve again (which clears the banner if successful). No "Dismiss" button (would let users hide the warning and stay confused). Phase 2 may add a polling-clear that runs `useDiff.refresh()` after the agent pushes a new commit — out of scope here.
- **Windowing without `react-window`.** A simple `Math.floor(scrollTop / 20)` + `ResizeObserver` strategy keeps the bundle small and the implementation unit-testable. 500-line threshold is a heuristic; T3.5-9 may revisit. **Do NOT** add `react-virtual`, `react-window`, `@tanstack/react-virtual`.
- **`MobileDiffTab` (the workspace inner sub-tab) keeps using cross-tree `MobileDiffViewer`.** That sub-tab is read-only, no actions, low-stakes. The mobile review screen is a **full-screen push** that owns the actions; it deserves the token-clean rebuild. Two-tier strategy: read-only preview cross-tree, action-required full-screen mobile-native. Documented in AC 19.
- **Diff format is unified-only.** No split toggle on phone (UX redesign §3.5 + UX-DR10). The desktop `useDiff` returns hunks with `add`/`remove`/`context` line types — exactly what unified rendering needs.
- **No inline comments in v1.** Desktop has `InlineCommentInput`/`InlineCommentThread`/`InlineCommentIndicator` — the long-press-to-comment pattern is **deferred to Phase 2** (UX redesign §3.5: "Long-press a line → inline comment sheet (Phase-2)"). This story's review surface is approve/reject/request-changes-only.
- **No `MobileFileTree.tsx` direct port.** Desktop file tree uses inline hex colors. We rebuild as `MobileFileTreeSheet` with token-derived colors (modulo the `STATUS_COLOR` Tailwind exception). Sort logic is the only direct copy.
- **Pause functionality NOT implemented.** Desktop's "Pause" button just toasts "coming soon" — agent pause is migrating to Tauri Rust core. Mobile review screen does NOT include Pause. Reject + Request Changes cover the "stop / redirect agent" need.

### LLM-developer guardrails — common mistakes to prevent

1. **DO NOT** import `MobileDiffViewer`, `MobileReviewActionBar`, `MobileFileTree`, `ApproveButton`, `RejectButton`, `RequestChangesButton`, `InlineCommentInput`, `InlineCommentThread`, `InlineCommentIndicator`, `FeedbackHistory`, `ReviewTimeline`, `VersionSelector`, `ReviewActions`, `DiffViewer`, `FileTree`, or `DiffPanel` from `@renderer/components/review/`. **All of those are desktop-only.**
2. **DO NOT** import `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@renderer/components/ui/dialog`. Use `MobileSheet` for ALL modal-ish surfaces (confirm, feedback, rejection).
3. **DO NOT** import `Textarea` from `@renderer/components/ui/textarea` or `Button` from `@renderer/components/ui/button`. Use plain HTML `<textarea>` and `<button>` elements with token classes.
4. **DO NOT** import `toast` from `sonner` directly inside review tree files. The mutation hooks already toast.
5. **DO NOT** add inline hex colors anywhere. Forbidden literals: `#0a0a0b`, `#3fb950`, `#f85149`, `#d29922`, `#aff5b4`, `#ffdcd7`, `#0d1117`, `#58a6ff`, `#2ea043` (these are the desktop violations from `MobileDiffViewer.tsx` lines 67/91/100/102/148–151/161–162/184/195–197). Use Calm Command tokens.
6. **DO NOT** introduce a `usePauseMutation` — Pause is out of scope (Tauri Rust core migration).
7. **DO NOT** introduce inline comment threads — Phase-2 per UX redesign §3.5.
8. **DO NOT** add `react-window`, `react-virtual`, `@tanstack/react-virtual`. Use the inline windowing strategy from Task 6.5.
9. **DO NOT** re-fetch the task inside `useDiff` callsite — `useDiff` doesn't fetch the task; you fetch the task separately via `trpc.tasks.byId.useQuery` and pass `worktree_path` etc. to `useDiff` (mirror desktop `MobileDiffViewer.tsx` lines 31–44).
10. **DO NOT** modify `mobile-nav.store.ts` — `popRoute()`, `pushRoute()`, `handleBackPress()` already do the right thing for review routes.
11. **DO NOT** modify `parseDeepLink` in `src/mobile/shell/deeplinks.ts` — current `tinsu://task/{taskId}/diff` deep-link still resolves to the workspace+diff stack (not a review push). Adding a new `tinsu://task/{taskId}/review` deep-link is out of scope (no AC requires it).
12. **DO NOT** introduce a global `isReviewing` Zustand store — keep mutation state via the hook's `isPending` + screen-local `useState` for sheets and conflict banner.
13. **DO NOT** auto-pop the route on conflict (the user must see the banner). Pop only on Approve success and Reject success.
14. **DO NOT** call `commands.approveTask` or `commands.rejectTask` directly. Always go through `useApprovalMutation` / `useRejectionMutation`.
15. **DO NOT** use `useIsMobile()` or any responsive branching — mobile code lives in `src/mobile/`; desktop code lives in `src/components/`. They never share a render tree (CLAUDE.md mobile-tree-not-branch rule).
16. **DO NOT** assert against desktop test IDs (`mobile-review-action-bar`, `mobile-approve-btn`, `mobile-reject-btn`, `mobile-pause-btn`, `mobile-conflict-msg`, `mobile-diff-viewer`). Mobile uses `mobile-review-screen`, `mobile-review-approve-btn`, `mobile-review-reject-btn`, `mobile-review-request-btn`, `mobile-review-conflict-banner`, `mobile-review-files-pill`, etc.
17. **DO NOT** import `react-markdown` for diff rendering — diff lines are plain text in `<pre><code>`. Markdown is for chat (T3.5-5), not diffs.
18. **DO NOT** modify any file under `src/components/`, `src/hooks/`, `src/stores/`, `src-tauri/`. The cross-tree allowlist (AC 18) is **strict imports only**. The only files outside `src/mobile/review/` you may modify are `src/mobile/MobileApp.tsx`, `src/mobile/MobileApp.test.tsx`, `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx`, and (if it exists) `src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx`.
19. **DO NOT** add `role="log"` or `aria-live="polite"` to the diff main area. The diff is static content; live regions would announce nothing useful.
20. **DO NOT** change the existing `MobileDiffTab.tsx` (workspace sub-tab) to use a new mobile-tree diff renderer — keep it cross-tree per AC 19. The split between read-only preview (cross-tree) and action-required review (mobile-tree) is intentional.
21. **DO NOT** introduce `Sonner` directly. The mutation hooks own toast feedback. The screen reacts to `onSuccess`/`onConflict`/`onError` callbacks — sheets close, banners render, route pops.
22. **DO NOT** use `setTimeout` for sheet close animations — `MobileSheet`'s `onOpenChange(false)` triggers Radix's own animation. Just call it.
23. **DO NOT** add a "Pull to refresh" gesture on the diff scroll area — `useDiff.refresh()` is available but v1 doesn't surface it (the user can pop and re-enter). Phase 2 may add it.
24. **DO NOT** measure sheet height or set explicit numeric heights on `MobileSheet`. Use `snapPoint='half'` or `'fit'` (T3.5-2 contract). The primitive owns sizing.

### Library / framework requirements (versions matter)

| Lib | Version | Purpose | Notes |
|---|---|---|---|
| `react`, `react-dom` | 19 (already in project) | Components | n/a |
| `@tanstack/react-query` v5 | already in project | mutations via the hooks | hooks own queryClient access |
| `@radix-ui/react-dialog` | already in project (via `MobileSheet`) | sheets | reuse `MobileSheet` only |
| `lucide-react` | `^0.562.0` already | `Plus`, `Minus`, `Circle`, `ArrowRight`, `ChevronRight`, `AlertCircle`, `AlertTriangle`, `CheckCircle2`, `XCircle`, `MessageSquare` | no new icons |
| `tailwindcss` | `^4.1.18` already | Calm Command tokens | exceptions: `LINE_COLOR_CONFIG`, `STATUS_COLOR`, rejection warning |
| `@tauri-apps/plugin-deep-link` | already in project | n/a — no new deep-link added | deep-link table unchanged |
| `vitest` + `@testing-library/react` | already in project | tests | n/a |

**No new dependencies.** If you reach for `react-window`, `react-virtual`, `@tanstack/react-virtual`, `react-syntax-highlighter`, `prismjs`, `react-diff-viewer`, `diff2html`, `monaco-editor` — **STOP**. Built primitives + `useDiff` data + plain `<pre><code>` rendering + inline windowing are sufficient.

### File structure requirements (exhaustive list)

**New files this story creates:**

```
src/mobile/review/MobileDiffViewerScreen.tsx
src/mobile/review/MobileDiffViewerScreen.test.tsx
src/mobile/review/MobileFileTreeSheet.tsx
src/mobile/review/MobileFileTreeSheet.test.tsx
src/mobile/review/MobileReviewActionBar.tsx
src/mobile/review/MobileReviewActionBar.test.tsx
src/mobile/review/MobileFeedbackSheet.tsx
src/mobile/review/MobileFeedbackSheet.test.tsx
src/mobile/review/MobileRejectionSheet.tsx
src/mobile/review/MobileRejectionSheet.test.tsx
```

**Files this story modifies:**

```
src/mobile/MobileApp.tsx                           (add review: route branch + isFullScreenRoute extension; remove obsolete 'diff' branch; import MobileDiffViewerScreen)
src/mobile/MobileApp.test.tsx                      (add review-route + isFullScreenRoute tests + back-press integration test)
src/mobile/tasks/MobileTaskWorkspaceScreen.tsx     (enable Request Changes button to push review:<taskId>)
src/mobile/tasks/MobileTaskWorkspaceScreen.test.tsx (if exists, update Request Changes assertion)
```

**Files this story may NOT modify (regression guard, AC 19):**

```
src/components/**                                 (desktop tree — read-only imports per allowlist)
src/hooks/**                                      (read-only — useApprovalMutation, useRejectionMutation, useDiff used by import only)
src/stores/**                                     (read-only)
src/mobile/board/**                               (T3.5-3 contract; no edits)
src/mobile/tasks/MobileDiffTab.tsx                (decision: keep cross-tree per AC 19)
src/mobile/tasks/MobileContentTab.tsx             (T3.5-4 contract)
src/mobile/tasks/MobileTerminalTab.tsx            (T3.5-4 contract)
src/mobile/tasks/MobileActivitiesTab.tsx          (T3.5-4 contract)
src/mobile/primitives/**                          (T3.5-2 contract; no edits)
src/mobile/shell/**                               (T3.5-1 contract; no edits)
src/mobile/dev/**                                 (DEV harness; no edits)
src/mobile/planning/**                            (T3.5-5 contract)
src/mobile/activity/**                            (T3.5-8 owns)
src/mobile/settings/**                            (T3.5-8 owns)
src/mobile/ssh/**                                 (T3.5-7 owns)
src-tauri/**                                      (no Rust changes)
```

### Testing requirements

- **Unit tests** colocated next to each new component:
  - `MobileDiffViewerScreen.test.tsx` — ≥10 tests covering AC 20 (a)–(k), (r)–(t)
  - `MobileFileTreeSheet.test.tsx` — ≥3 tests covering AC 20 (e)–(f)
  - `MobileReviewActionBar.test.tsx` — ≥4 tests covering AC 20 (g)
  - `MobileFeedbackSheet.test.tsx` — ≥3 tests covering AC 20 (l)–(n)
  - `MobileRejectionSheet.test.tsx` — ≥4 tests covering AC 20 (o)–(q)
  - `MobileApp.test.tsx` updates — ≥3 new tests covering AC 20 (a), (t)
- **Total ≥18 new tests** (AC 20 floor). Higher is better.
- **Mock pattern** for `@renderer/hooks/useApprovalMutation`:
  ```ts
  vi.mock('@renderer/hooks/useApprovalMutation', () => ({
    useApprovalMutation: vi.fn((opts: any) => ({
      approve: vi.fn(),
      isPending: false, isSuccess: false, isError: false, error: null,
      __opts: opts // expose for assertions
    }))
  }))
  ```
  Per-test: spy the `approve` ref, simulate `opts.onSuccess()` / `opts.onConflict('msg')` to drive screen behavior.
- **Mock pattern** for `@renderer/hooks/useRejectionMutation`: identical shape.
- **Mock pattern** for `@renderer/hooks/useDiff`:
  ```ts
  vi.mock('@renderer/hooks/useDiff', () => ({
    useDiff: vi.fn(() => ({
      diff: { files: [] }, isLoading: false, error: null, refresh: vi.fn(), isRefreshing: false
    }))
  }))
  ```
- **Mock pattern** for `@renderer/lib/trpc`:
  ```ts
  vi.mock('@renderer/lib/trpc', () => ({
    trpc: {
      tasks: { byId: { useQuery: vi.fn() } }
    }
  }))
  ```
  Per-test: `(trpc.tasks.byId.useQuery as Mock).mockReturnValue({ data: { id: 'abc', status: 'review', worktree_path: '/tmp/wt', ... }, isLoading: false, error: null })`.
- **Mock pattern** for `useMobileNavStore`: spy `popRoute` / `pushRoute` / `handleBackPress` to assert navigation.
- **Reduced-motion test**: mock `useReducedMotion` to return `true` (the hook is already a separate import; `vi.mock('@renderer/mobile/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))`).
- **Windowing test**: build a fixture with 1 file × 700 lines (`{ files: [{ path: 'a.ts', additions: 350, deletions: 0, status: 'modified', hunks: [{ header: '@@', lines: Array.from({length: 700}, (_, i) => ({ type: 'context', oldLineNo: i, newLineNo: i, content: 'line ' + i })) }] }] }`). Mount the screen with `clientHeight = 600`, `scrollTop = 0`. Assert `screen.getAllByTestId('diff-line').length <= 120`.
- **`scrollIntoView` mock**: `Element.prototype.scrollIntoView = vi.fn()`.
- **`ResizeObserver` mock**: `globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }`.
- **Coverage target:** ≥80% line coverage on new files in `src/mobile/review/`.
- **Manual smoke on Android (Tailscale)**: deferred to reviewer per T3.5-9 gate — verify Approve flow end-to-end, Reject empty-then-confirm, Request Changes feedback, GitConflict banner, file tree sheet scroll-to-file, large-diff perf.
- **No e2e tests** (TEA territory, deferred to T3.5-9).

### Project Structure Notes

- `src/mobile/review/` already exists with only `.gitkeep`. New files colocated here.
- The architecture doc (`architecture.md` §"`src/mobile/` Directory Structure" lines 394–397) lists three files: `MobileReviewActionBar.tsx`, `MobileFeedbackSheet.tsx`, `MobileRejectionSheet.tsx`. We **add** `MobileDiffViewerScreen.tsx` and `MobileFileTreeSheet.tsx` here (the architecture doc puts `MobileDiffViewerScreen.tsx` and `MobileFileTreeSheet.tsx` under `src/mobile/tasks/` at lines 383–384, but that conflicts with the parallel-tree separation between **read-only preview** (`src/mobile/tasks/MobileDiffTab.tsx`) and **action-required full-screen review** (this story). We deviate from the doc: all 5 review-flow files live under `src/mobile/review/` for cohesion. Document this deviation in Dev Notes (architectural decision #11).
- `MobileApp.tsx` route renderer needs the `review:` branch + the `isFullScreenRoute` extension. Do **not** centralise route mapping into a separate file in this story — keep changes minimal (matches T3.5-4 + T3.5-5 precedent).
- The 5-tab bottom nav is **hidden** on the review push (per AC 1 + `isFullScreenRoute` extension). This is the third mobile screen to use the full-screen push pattern (after T3.5-4 workspace and T3.5-5 chat).
- Workspace Diff sub-tab (`MobileDiffTab.tsx`) **continues** to use the cross-tree desktop `MobileDiffViewer` for read-only preview (AC 19). The workspace sub-tab's action bar continues to push `review:<taskId>` for both Approve and Request Changes (AC 2).

### Previous story intelligence (T3.5-1 through T3.5-5)

- **T3.5-1** established the route renderer pattern (`MobileApp.tsx` switch case + `if (route.startsWith(...))` branches). Reuse this pattern; do NOT introduce a separate router.
- **T3.5-2** primitives: `MobileSheet` snap points are `'half' | 'full' | 'fit'`. Use `'half'` for file tree / feedback / rejection sheets and `'fit'` for approve confirmation. `MobileBottomActionBar` supports `primary` + `secondary` slots OR a `children` escape hatch — use `children` for the 3-button layout (AC 8).
- **T3.5-2** **`useReducedMotion()`** lives in `src/mobile/hooks/useReducedMotion.ts`. Use it for the focus-delay, `scrollIntoView` behavior, and any animation gating.
- **T3.5-2** `MobileLoadingSkeleton` variants: `'card' | 'row' | 'avatar'`. Use `'card'` for the screen's loading skeleton.
- **T3.5-4** established the full-screen-push pattern (workspace screen). Mirror exactly for the review screen — `isFullScreenRoute()` returns true → `MobileApp.tsx` returns `<MobileRouteRenderer route={topRoute} />` directly without the root `MobileScreen` shell. Add `review:` to the prefix check.
- **T3.5-4** established cross-tree import discipline: only allow data hooks (`useDiff`), mutation hooks (`useApprovalMutation`, `useRejectionMutation`), and types. Forbid component imports from `@renderer/components/review/`.
- **T3.5-4** the workspace Diff sub-tab pushes `review:<taskId>` — this story owns the route handler and updates the Request Changes button to also push (was disabled).
- **T3.5-5** established the deep-link integration test pattern: pre-set `tabStacks.<tab> = [...]`, mount `MobileApp`, assert the screen renders. Mirror for back-press (AC 16, Task 11.9).
- **T3.5-5** established the cross-tree allowlist as a strict table in AC 17 (story T3.5-5 AC 17). This story mirrors the strictness for review (AC 18).
- **T3.5-5** confirmed `MobileSheet` Radix integration works correctly with sr-only `Dialog.Title` and `aria-describedby={undefined}` patches (T3.5-2 retro). Reuse the primitive as-is.
- **T1.8 / desktop reviews** established `useApprovalMutation` and `useRejectionMutation` as the canonical mutation surface. Both hooks toast via Sonner internally; both invalidate `['tasks']` and `['tasks', 'list', projectId]`. **Do NOT** re-invalidate from the screen — the hooks own it.
- **T1.8 / Story 8.7 (merge-conflict-detection)** established `AppError.GitConflict` as the discriminated-union variant fired by the Rust core when `git merge` detects conflicts. `useApprovalMutation.ts` lines 25–35 already detects this. Mobile screen surfaces it via the conflict banner (AC 13).
- **Test pattern**: `vitest` + `@testing-library/react`; colocated `.test.tsx`; `render` + `screen` + `fireEvent` + `act`. Match patterns in `MobileTaskWorkspaceScreen.test.tsx`, `MobileChatScreen.test.tsx`, `MobileBoardScreen.test.tsx`.
- **Pre-existing failing tests:** Compare `npm test` line-for-line to T3.5-5 baseline (78 new T3.5-5 tests passing on top of pre-existing failures unchanged from T3.5-4). Don't introduce new failures.

### Architecture compliance (the dev agent MUST follow these)

| Concern | Required | Source |
|---|---|---|
| Mobile screen location | `src/mobile/review/` for all review-screen components | `architecture.md` §"`src/mobile/` Directory Structure" lines 394–397 (we add `MobileDiffViewerScreen` + `MobileFileTreeSheet` here too — deviation documented) |
| Review-screen route | `review:<taskId>` full-screen push (extend `isFullScreenRoute`) | `epics.md` Story T3.5-6; T3.5-4/T3.5-5 precedent |
| Token discipline | Calm Command CSS vars only EXCEPT 3 documented exceptions: `LINE_COLOR_CONFIG` (diff add/remove), `STATUS_COLOR` (file tree status icons), rejection-warning amber | `architecture.md` §"Mobile Primitive Contract" §1; `globals.css`; UX-DR4, UX-DR10 |
| Touch targets | ≥44 pt iOS / ≥48 dp Android (back button, files pill, action bar buttons, sheet buttons, file rows) — `min-h-[2.75rem]` matches | UX-DR7; `ux-design-specification-mobile.md` §"Accessibility Considerations" |
| A11y | Semantic HTML, `aria-label` on icon-only buttons, focus visible, `role="toolbar"` on action bar, `role="alert"` on conflict banner, no color-only signals | `architecture.md` §"Mobile Primitive Contract" §3; UX-DR6 |
| Safe-area | Action bar respects `env(safe-area-inset-bottom)` via `MobileBottomActionBar` primitive (children mode preserves the safe-area styling on the wrapper) | `architecture.md` §"Mobile Primitive Contract" §4 |
| Reduced motion | Sheet focus-delay skipped when reduced; `scrollIntoView` uses `behavior: 'auto'` when reduced | T3.5-2 contract |
| Diff format | Unified-only on phone — no split toggle, no side-by-side | UX redesign §3.5 |
| GitConflict UX | Banner above diff + Approve disabled — never auto-pop | this story AC 13 + Story 8.7 contract |
| Forbidden imports | NO imports from desktop `MobileDiffViewer`, `MobileReviewActionBar`, `MobileFileTree`, button/dialog/textarea primitives | this story AC 18 |
| Desktop preserved | NO edits to `src/components/**`, `src/hooks/**`, `src/stores/**`, `src-tauri/**`; mobile is parallel tree | CLAUDE.md, sprint-change-proposal-2026-04-30.md |
| Route ownership | `review:` branch lives in `MobileApp.tsx` route renderer; not in a separate router file | this story AC 1, T3.5-4/T3.5-5 precedent |
| Workspace integration | Diff sub-tab Request Changes button enabled (was disabled) — pushes `review:<taskId>` | this story AC 2 |

### Git intelligence (recent commit patterns)

```
cd023c2 docs(course-correction): mobile UX redesign — architecture, PRD, UX spec updates
c8148ab docs(course-correction): mobile UX native redesign — parallel tree (Epic 3.5)
24dfc4a fix android build
f8ec1e6 fix: [t3-3] enable autoScroll in DndContext for drag-to-edge column reveal on mobile
43a6488 fix: [t3-7] SSH form UX + [t3-2/t3-3/t3-5] mobile UI improvements
```

- The latest course-correction commits (`cd023c2`, `c8148ab`) are the authoritative source for the parallel-tree decision and the cross-tree import discipline.
- Read T3.5-4's commits (look for `t3-5-4` in `git log`) to understand the workspace full-screen push pattern. The review full-screen push mirrors it.
- Read T3.5-5's commits (look for `t3-5-5` in `git log`) to understand `MobileSheet`-based confirmation pattern (chat new-session sheet) and the cross-tree allowlist enforcement.
- Read `src/mobile/MobileApp.tsx` to see the existing `isFullScreenRoute` helper + `MobileRouteRenderer`. The review branch slots in next to the chat branch.
- Read `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx` lines 179–203 to see the existing Diff sub-tab action bar — this story enables the Request Changes button.

### Latest technical specifics

- **React 19** is adopted. `useId`, `use()`, `useTransition` available; only adopt where natural.
- **Tailwind v4** uses `@theme inline` (already wired). Token vars: `--background`, `--card`, `--primary`, `--destructive`, `--muted-foreground`, `--border`. Prefer `bg-card/95 backdrop-blur-xl` for elevated surfaces; use `bg-destructive` for the Reject button (token-derived, not `bg-red-600`).
- **`@tanstack/react-query` v5** + Tauri rspc commands: results return `{ status: 'ok' | 'error', data?, error? }` discriminated union — match desktop's pattern of throwing in queryFn when `status === 'error'`. The mutation hooks already do this.
- **`@radix-ui/react-dialog`** (via `MobileSheet`): the sheet auto-portals to `document.body`, focus-traps, Esc-dismisses. Don't reimplement.
- **CSS `env(safe-area-inset-bottom)`** is supported by Tauri WebView on iOS and Android. `MobileBottomActionBar` already applies it; ensure the children layout (3 buttons) doesn't override the wrapper's padding.
- **`Element.scrollIntoView({ behavior, block })`**: supported in modern WebViews. Fallback to `scrollTop = element.offsetTop` is unnecessary.
- **`ResizeObserver`**: supported in Tauri WebView (Android 7+ / iOS 13.4+). Polyfill not needed.
- **`useDiff` hook**: returns `{ diff: GitDiffResult | null, isLoading, error, refresh, isRefreshing }`. `diff.files` is the array; each file has `path`, `status`, `additions`, `deletions`, `hunks: GitDiffHunk[]`. Each hunk has `header: string` and `lines: { type: 'add' | 'remove' | 'context', oldLineNo: number | null, newLineNo: number | null, content: string }[]`.
- **`useApprovalMutation` callback contract**: `onSuccess`/`onConflict`/`onError` are all optional and called after the hook's internal toast fires. Use them to drive screen state (close sheet, pop route, set banner).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-30.md] (Epic 3.5 charter — Section 4.4 review screen scope, line 141)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-T3.5-6-Mobile-Review] (canonical AC source — lines 1048–1066)
- [Source: _bmad-output/planning-artifacts/architecture.md#src-mobile-Directory-Structure] (canonical screen + component locations — lines 383–397; we deviate by colocating `MobileDiffViewerScreen` + `MobileFileTreeSheet` under `src/mobile/review/`)
- [Source: _bmad-output/planning-artifacts/architecture.md#Migration-Sequence-Rollback] (T3.5-6 placement — line 596)
- [Source: _bmad-output/planning-artifacts/architecture.md#Deep-Link-Routing-Table] (deep-link table — `tinsu://task/<id>/diff` deep-link unchanged; no new deep-link added)
- [Source: _bmad-output/planning-artifacts/architecture.md#Mobile-Primitive-Contract] (token, touch-target, a11y, safe-area, reduced-motion rules)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#3.5] (Review/Approval mobile decisions — file tree as sheet, unified-only, action bar order Reject/Request/Approve, approve confirmation dialog, pinch-to-zoom deferred)
- [Source: _bmad-output/planning-artifacts/mobile-ux-redesign-plan-2026-04-30.md#7.2] (component LOC estimates — 26 `MobileDiffViewerScreen`, 27 `MobileReviewActionBar`)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Visual-Design-Foundation] (typography + tokens)
- [Source: _bmad-output/planning-artifacts/ux-design-specification-mobile.md#Accessibility-Considerations] (UX-DR6, UX-DR7, UX-DR10, UX-DR19)
- [Source: _bmad-output/implementation-artifacts/t3-5-1-mobile-shell-foundation.md] (shell + nav store + route renderer + deep-link parser)
- [Source: _bmad-output/implementation-artifacts/t3-5-2-mobile-primitives-library.md] (primitive contracts: `MobileSheet`, `MobileBottomActionBar` (children mode), `MobileListItem`, `MobileEmptyState`, `MobileLoadingSkeleton`, `useReducedMotion`)
- [Source: _bmad-output/implementation-artifacts/t3-5-4-mobile-task-workspace.md] (full-screen push pattern; cross-tree import discipline; the `review:<taskId>` placeholder route this story now owns)
- [Source: _bmad-output/implementation-artifacts/t3-5-5-mobile-planning.md] (cross-tree allowlist enforcement template; `MobileSheet`-based new-session pattern; full-screen push test patterns)
- [Source: src/mobile/MobileApp.tsx] (route renderer; this story modifies `isFullScreenRoute` and adds `review:` branch + removes obsolete `'diff'` branch)
- [Source: src/mobile/shell/mobile-nav.store.ts] (`popRoute`, `pushRoute`, `handleBackPress` — DO NOT modify)
- [Source: src/mobile/shell/deeplinks.ts] (`parseDeepLink` — DO NOT modify; no new deep-link added)
- [Source: src/mobile/primitives/MobileSheet.tsx] (snap-point + a11y + Radix Dialog wiring)
- [Source: src/mobile/primitives/MobileBottomActionBar.tsx] (children escape hatch — see lines 47–48; required for 3-button layout)
- [Source: src/mobile/primitives/MobileListItem.tsx] (list-row primitive — leading/title/subtitle/trailing slots for file tree)
- [Source: src/mobile/primitives/MobileTopAppBar.tsx] (back button + title contract — chat-style inline header may be needed if title slot doesn't accept ReactNode for the Files pill; mirror T3.5-5 fallback)
- [Source: src/mobile/primitives/MobileEmptyState.tsx] (empty-state shape for not-in-review and no-changes)
- [Source: src/mobile/primitives/MobileLoadingSkeleton.tsx] (skeleton variants)
- [Source: src/mobile/hooks/useReducedMotion.ts] (reduced-motion gating hook)
- [Source: src/mobile/tasks/MobileTaskWorkspaceScreen.tsx] (this story modifies the Diff sub-tab action bar — Request Changes button enabled)
- [Source: src/mobile/tasks/MobileDiffTab.tsx] (decision: keep cross-tree per AC 19)
- [Source: src/components/review/MobileDiffViewer.tsx] (desktop reference: hunk rendering shape — mirror unified diff structure but rebuild with tokens; do NOT import)
- [Source: src/components/review/MobileFileTree.tsx] (desktop reference: status icons + sort order — mirror, do NOT import)
- [Source: src/components/review/MobileReviewActionBar.tsx] (desktop reference: rejection warning UX — mirror lines 60–71 and lines 81–88 focus pattern; do NOT import)
- [Source: src/hooks/useApprovalMutation.ts] (cross-tree allowed: GitConflict detection + tasks-list invalidation + sonner toast)
- [Source: src/hooks/useRejectionMutation.ts] (cross-tree allowed: tasks-list invalidation + sonner toast; handles both Reject and Request Changes flows)
- [Source: src/hooks/useDiff.ts] (cross-tree allowed: pure data fetch — `worktree` mode for active tasks, `historical` for done tasks)
- [Source: src/lib/rspc.ts] (`commands.approveTask`, `commands.rejectTask` — accessed via the hooks, not directly)
- [Source: src/lib/trpc.ts] (`trpc.tasks.byId.useQuery` — task fetch, mirrors workspace screen)
- [Source: src/shared/types/git-diff.types.ts] (`GitDiffFile`, `GitDiffHunk`, `GitDiffResult`, `GitDiffLine`)
- [Source: src/shared/types/task.types.ts] (`Task` — including `worktree_path`, `merge_commit_sha`, `last_review_commit`, `story_number`, `project_id`, `status`)
- [Source: src/globals.css] (Calm Command token definitions)
- [Source: CLAUDE.md] (`/frontend-design` mandate; mobile-tree-not-branch rule)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-04-30)

### Debug Log References

- ResizeObserver mock required class form (not `vi.fn(() => obj)`) — class constructor pattern used in tests
- MobileSheet does not forward `data-testid` prop (hardcodes own); workaround: wrap sheet children in `<div data-testid="...">` for test queries
- Async `act()` required for onConflict/onSuccess callbacks — synchronous act produced act() warnings

### Completion Notes List

- All 58 new tests pass. Zero regressions vs baseline (24 failing/192 vs 25/193 pre-implementation).
- Windowing uses fixed 20px line height, ResizeObserver on scroll container, renders only visible range with spacer divs. Triggered when totalLines > 500.
- Token discipline verified: grep confirms no forbidden named Tailwind colors outside the 3 AC-21 exceptions (LINE_COLOR_CONFIG, STATUS_COLOR, rejection warning amber).
- `useDiff` called with `mode: 'worktree'` for in-progress tasks, `'historical'` for done/cancelled.
- `trpc.tasks.getById.useQuery({ id: taskId })` matches actual workspace screen pattern (not `byId`).
- MobileTaskWorkspaceScreen: case 'diff' Request Changes button now enabled for status==='review' tasks and pushes `review:<taskId>` route.

### File List

**New files:**
- `src/mobile/review/MobileDiffViewerScreen.tsx`
- `src/mobile/review/MobileDiffViewerScreen.test.tsx` (26 tests)
- `src/mobile/review/MobileReviewActionBar.tsx`
- `src/mobile/review/MobileReviewActionBar.test.tsx` (12 tests)
- `src/mobile/review/MobileFileTreeSheet.tsx`
- `src/mobile/review/MobileFileTreeSheet.test.tsx` (6 tests)
- `src/mobile/review/MobileFeedbackSheet.tsx`
- `src/mobile/review/MobileFeedbackSheet.test.tsx` (6 tests)
- `src/mobile/review/MobileRejectionSheet.tsx`
- `src/mobile/review/MobileRejectionSheet.test.tsx` (8 tests)

**Modified files:**
- `src/mobile/MobileApp.tsx` — added `review:` to `isFullScreenRoute`, route branch for `MobileDiffViewerScreen`, removed obsolete `diff` placeholder
- `src/mobile/MobileApp.test.tsx` — added review route + isFullScreenRoute + back-press integration tests
- `src/mobile/tasks/MobileTaskWorkspaceScreen.tsx` — case 'diff': enabled Request Changes button, pushes `review:<taskId>`

### Change Log

| Date | Change |
|------|--------|
| 2026-04-30 | Initial implementation — all 10 files created, 58 tests, zero regressions |
