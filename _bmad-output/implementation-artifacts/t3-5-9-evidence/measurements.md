# T3.5-9 Measurements — Master Evidence Table

**Story:** T3.5-9 Real-Device Validation Gate
**Branch:** tauri-pivot
**Mobile tree:** src/mobile/
**Android target:** API 34 (Android 14), Pixel 6 profile
**iOS status:** iOS-deferred (macOS unavailable in headless agent context)
**Executed by:** DEV 1 agent (automation pass) + [PENDING-DEVICE-RUN: developer name + device serial]

---

## Environment Header

| Field | Value |
|-------|-------|
| SSH endpoint | PENDING-DEVICE-RUN: document host + auth method |
| Android device | PENDING-DEVICE-RUN: model + Android version + serial last 4 |
| iOS device | iOS-deferred — macOS unavailable |
| `adb` version | PENDING-DEVICE-RUN |
| Build date | PENDING-DEVICE-RUN |
| APK path | `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` |

---

## AC 1 — Cold-Start Launch < 3s

**Procedure:** `adb shell am force-stop <pkg> && adb shell am start -W <pkg>/.MainActivity` — parse `TotalTime` field.

| Run # | Platform | Device | TotalTime (ms) | Pass? | Evidence path |
|-------|----------|--------|----------------|-------|---------------|
| 1 | Android emulator (API 34) | Pixel 6 profile | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-emu-run1.png |
| 2 | Android emulator (API 34) | Pixel 6 profile | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-emu-run2.png |
| 3 | Android emulator (API 34) | Pixel 6 profile | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-emu-run3.png |
| 4 | Android emulator (API 34) | Pixel 6 profile | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-emu-run4.png |
| 5 | Android emulator (API 34) | Pixel 6 profile | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-emu-run5.png |
| **Mean (emu)** | | | **PENDING** | **PENDING (< 3000ms required)** | |
| 1 | Android physical | PENDING | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-phys-run1.png |
| 2 | Android physical | PENDING | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-phys-run2.png |
| 3 | Android physical | PENDING | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-phys-run3.png |
| 4 | Android physical | PENDING | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-phys-run4.png |
| 5 | Android physical | PENDING | PENDING-DEVICE-RUN | — | evidence/screenshots/ac1-cold-start-phys-run5.png |
| **Mean (phys)** | | | **PENDING** | **PENDING (< 3000ms required)** | |
| iOS | iOS simulator | — | iOS-deferred | — | — |

**Status: PENDING-DEVICE-RUN**

---

## AC 2 — Responsive Layout (360×800 / 375×812)

**Procedure:** Walk every mobile screen at 360×800 on emulator. Screenshot each. Verify no horizontal overflow; all interactive elements ≥ 44×44 px via Chrome DevTools remote-inspect.

| Screen | Platform | Overflow? | Touch-target violations | Screenshot | Status |
|--------|----------|-----------|------------------------|------------|--------|
| MobileBoardScreen | Android emu | PENDING | PENDING | screenshots/ac2-board.png | PENDING-DEVICE-RUN |
| MobileTaskWorkspaceScreen (all 4 tabs) | Android emu | PENDING | PENDING | screenshots/ac2-workspace-*.png | PENDING-DEVICE-RUN |
| MobilePlanningHome + MobileChatScreen | Android emu | PENDING | PENDING | screenshots/ac2-planning*.png | PENDING-DEVICE-RUN |
| MobileDiffViewerScreen | Android emu | PENDING | PENDING | screenshots/ac2-review.png | PENDING-DEVICE-RUN |
| MobileConnectionsListScreen + MobileConnectionFormScreen | Android emu | PENDING | PENDING | screenshots/ac2-ssh*.png | PENDING-DEVICE-RUN |
| MobileActivityFeedScreen | Android emu | PENDING | PENDING | screenshots/ac2-activity.png | PENDING-DEVICE-RUN |
| MobileSettingsHome + 5 sub-screens | Android emu | PENDING | PENDING | screenshots/ac2-settings*.png | PENDING-DEVICE-RUN |
| iOS 375×812 | iOS sim | — | — | — | iOS-deferred |

**Status: PENDING-DEVICE-RUN** (touch-target automated audit via AC 12 script runs independently)

---

## AC 3 — Long-Press Drag + Column Pager at 60fps

**Procedure:** Android Studio CPU Profiler or Chrome DevTools Performance tab via chrome://inspect. 5s drag interaction on MobileBoardScreen. Export trace.

| Interaction | Platform | Sustained FPS | Max jank frame (ms) | Trace file | Status |
|-------------|----------|--------------|--------------------|-----------  |--------|
| Long-press drag (5s) | Android physical | PENDING | PENDING | traces/ac3-board-drag.trace | PENDING-DEVICE-RUN |
| Column pager swipe | Android physical | PENDING | PENDING | traces/ac3-column-swipe.trace | PENDING-DEVICE-RUN |

**Pass criterion:** ≥ 55 fps sustained, no jank frame > 16 ms.
**Status: PENDING-DEVICE-RUN**

---

## AC 4 — End-to-End SSH Connect → Remote Project → Tasks Load

**Procedure:** Screen record (≤ 30s). Open Connections → add SSH profile → Test Connection → save → switch project → board loads.

| Step | Result | Evidence |
|------|--------|----------|
| Add SSH profile | PENDING-DEVICE-RUN | recordings/ac4-ssh-flow.mp4 |
| Test Connection succeeds | PENDING-DEVICE-RUN | (in recording) |
| Switch remote project | PENDING-DEVICE-RUN | (in recording) |
| Board loads remote tasks | PENDING-DEVICE-RUN | (in recording) |

**Status: PENDING-DEVICE-RUN**

---

## AC 5 — Terminal Latency < 2s on Cellular

**Procedure:** Cellular only (WiFi off). Send 10 commands. Repeat on WiFi.

| # | Network | Command | Latency (ms) | Evidence |
|---|---------|---------|-------------|----------|
| 1 | Cellular | echo hello | PENDING-DEVICE-RUN | logs/ac5-cellular.txt |
| 2 | Cellular | ls -la | PENDING-DEVICE-RUN | |
| 3–10 | Cellular | various | PENDING-DEVICE-RUN | |
| **min/median/p95 (cellular)** | | | **PENDING** | |
| 1–10 | WiFi | various | PENDING-DEVICE-RUN | logs/ac5-wifi.txt |
| **min/median/p95 (WiFi)** | | | **PENDING** | |

**Pass criterion:** p95 latency < 2000 ms on cellular.
**Status: PENDING-DEVICE-RUN**

---

## AC 6 — Review Sub-Tab: Approve → Merge; Reject → Feedback

| Path | Result | Recording |
|------|--------|-----------|
| Approve → merge → task Done | PENDING-DEVICE-RUN | recordings/ac6-approve.mp4 |
| Reject → feedback → task In Progress | PENDING-DEVICE-RUN | recordings/ac6-reject.mp4 |

**Status: PENDING-DEVICE-RUN**

---

## AC 7 — Planning Tab Chat Round-Trip

| Step | Result | Recording |
|------|--------|-----------|
| Open session → send "ping" → response ≤ 60s | PENDING-DEVICE-RUN | recordings/ac7-planning-chat.mp4 |
| Tool-activity indicator blinks during agent work | PENDING-DEVICE-RUN | (in recording) |

**Status: PENDING-DEVICE-RUN**

---

## AC 8 — Critical User Journeys (No Crashes)

**Procedure:** Execute each journey end-to-end on physical Android. Capture logcat per journey. Grep for FATAL / AndroidRuntime / RustPanic. Zero required.

| Journey | Crash? | FATAL grep | RustPanic grep | Logcat file | Status |
|---------|--------|-----------|----------------|-------------|--------|
| J1: Create → In Progress → SSH → terminal | PENDING-DEVICE-RUN | PENDING | PENDING | logs/logcat-j1.txt | PENDING-DEVICE-RUN |
| J2: Review → diff → approve → Done | PENDING-DEVICE-RUN | PENDING | PENDING | logs/logcat-j2.txt | PENDING-DEVICE-RUN |
| J3: Planning → new chat → send → response | PENDING-DEVICE-RUN | PENDING | PENDING | logs/logcat-j3.txt | PENDING-DEVICE-RUN |

**Status: PENDING-DEVICE-RUN**

---

## AC 9 — WiFi ↔ Cellular Transition Recovers ≤ 30s

| Transition | Recovery time (s) | Session survived? | Recording | Status |
|------------|------------------|-------------------|-----------|--------|
| WiFi → airplane → cellular | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | recordings/ac9-network-transition.mp4 | PENDING-DEVICE-RUN |

**Status: PENDING-DEVICE-RUN**

---

## AC 11 — Deep-Link Cold + Warm Start

**Procedure (cold):** `adb shell am force-stop <pkg> && adb shell am start -W -a android.intent.action.VIEW -d "<deep-link>"`
**Procedure (warm):** invoke while app already running; assert no re-mount.

| Deep-link | Cold: landing screen | Cold: logcat parseDeepLink line | Warm: no re-mount? | Screenshots | Status |
|-----------|---------------------|--------------------------------|---------------------|-------------|--------|
| tinsu://chat/{sessionId} | planning/chat | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-chat-cold.png | PENDING-DEVICE-RUN |
| tinsu://task/{taskId} | tasks/workspace | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-task-cold.png | PENDING-DEVICE-RUN |
| tinsu://settings/connections | settings/connections | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-settings-conn-cold.png | PENDING-DEVICE-RUN |
| tinsu://settings/agent | settings/agent-settings | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-settings-agent-cold.png | PENDING-DEVICE-RUN |
| tinsu://settings/theme | settings/theme-settings | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-settings-theme-cold.png | PENDING-DEVICE-RUN |
| tinsu://settings/diagnostics | settings/diagnostics | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-settings-diag-cold.png | PENDING-DEVICE-RUN |
| tinsu://settings/about | settings/about | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-settings-about-cold.png | PENDING-DEVICE-RUN |
| tinsu://activity/{taskId} | activity/feed+detail | PENDING-DEVICE-RUN | PENDING-DEVICE-RUN | screenshots/ac11-activity-cold.png | PENDING-DEVICE-RUN |

**Note:** parseDeepLink() unit tests pass (see AC 22 CI snapshot). Cold/warm device execution pending.
**Status: PENDING-DEVICE-RUN** (unit logic verified by existing test suite)

---

## AC 12 — Touch Target Audit (Automated)

**Procedure:** `npm run audit:touch-targets` — vitest jsdom run of scripts/audit-touch-targets.ts

| Result | Date | Command | Output file | Status |
|--------|------|---------|-------------|--------|
| See touch-target-audit.md | 2026-04-30 | `npm run audit:touch-targets` | evidence/touch-target-audit.md | AUTOMATED-RUN |

**Status: AUTOMATED** (script ships; full device pixel verification per AC 2 still PENDING-DEVICE-RUN)

---

## AC 13 — Reduced-Motion Compliance

**Automated grep evidence:**
- `useReducedMotion` hook implemented in `src/mobile/hooks/useReducedMotion.ts`
- Files using reduced-motion hook: MobileSheet.tsx, MobileActivityRow.tsx, MobileActivityFeedScreen.tsx, MobileBottomActionBar.tsx, MobilePullToRefresh.tsx, MobileLoadingSkeleton.tsx, MobileFab.tsx, MobileSegmentedTabs.tsx, and others in the mobile tree.
- Grep results committed to: logs/reduced-motion-grep.txt

**Device recordings (PENDING-DEVICE-RUN):**

| Recording | Status |
|-----------|--------|
| recordings/ac13-motion-on.mp4 (flow: activity → sheet → back) | PENDING-DEVICE-RUN |
| recordings/ac13-motion-off.mp4 (same flow, Remove animations ON) | PENDING-DEVICE-RUN |

**Status: PARTIALLY-AUTOMATED** (hook + grep verified; device recordings pending)

---

## AC 14 — Performance Smoke

| Measurement | Value | Pass criterion | Status |
|-------------|-------|----------------|--------|
| Cold-start (see AC 1) | PENDING | < 3s | PENDING-DEVICE-RUN |
| Scroll FPS (200-row activity feed, 5s) | PENDING | ≥ 50 fps | PENDING-DEVICE-RUN |
| Pss Total (t=0) | PENDING | < 250 MB | PENDING-DEVICE-RUN |
| Pss Total (t=10 min) | PENDING | < 250 MB, no monotonic leak | PENDING-DEVICE-RUN |
| Native Heap (t=10 min) | PENDING | no leak | PENDING-DEVICE-RUN |

**Evidence:** traces/ac14-scroll-fps.json, logs/ac14-meminfo-t0.txt, logs/ac14-meminfo-t10.txt
**Status: PENDING-DEVICE-RUN**

---

## AC 15 — Tauri WebView Quirks Audit

| Quirk | Screens | Result | Evidence |
|-------|---------|--------|----------|
| Safe-area insets (notch/hole-punch/nav) | All screens | PENDING-DEVICE-RUN | screenshots/ac15-safe-area-*.png |
| Keyboard avoidance — chat composer | MobileChatScreen | PENDING-DEVICE-RUN | screenshots/ac15-keyboard-chat.png |
| Keyboard avoidance — SSH form | MobileConnectionFormScreen | PENDING-DEVICE-RUN | screenshots/ac15-keyboard-ssh.png |
| Keyboard avoidance — agent picker | MobileAgentSettings | PENDING-DEVICE-RUN | screenshots/ac15-keyboard-agent.png |
| Scroll bounce / overscroll — no layout breakage | Board, Activity, Planning | PENDING-DEVICE-RUN | recordings/ac15-overscroll.mp4 |
| Hardware back button — pops stack, not exit | All tabs (5 tabs) | PENDING-DEVICE-RUN | logs/ac15-back-button-logcat.txt |

**Status: PENDING-DEVICE-RUN**

---

## AC 16 — SSH Connection Lifecycle on WiFi + Cellular

| Scenario | Network | Wake from screen-off? | Foreground from BG? | Result | Status |
|----------|---------|-----------------------|---------------------|--------|--------|
| Idle 5 min → wake → command works | WiFi | PENDING-DEVICE-RUN | — | PENDING | PENDING-DEVICE-RUN |
| App backgrounded 60s → foreground | WiFi | — | PENDING-DEVICE-RUN | PENDING | PENDING-DEVICE-RUN |
| Idle 2 min → wake → reconnect ≤ 5s | Cellular | PENDING-DEVICE-RUN | — | PENDING | PENDING-DEVICE-RUN |
| App backgrounded 60s → foreground | Cellular | — | PENDING-DEVICE-RUN | PENDING | PENDING-DEVICE-RUN |

**Status: PENDING-DEVICE-RUN**

---

## AC 17 — Activity Feed Live Updates While Backgrounded

| Scenario | Result | Recording | Status |
|----------|--------|-----------|--------|
| Desktop-side event during 30s mobile BG → foreground shows new event | PENDING-DEVICE-RUN | recordings/ac17-bg-live-update.mp4 | PENDING-DEVICE-RUN |
| Glow respects reduced-motion | PENDING-DEVICE-RUN | (in recording) | PENDING-DEVICE-RUN |

**Status: PENDING-DEVICE-RUN**

---

## AC 18 — Battery + Thermal Sanity (30-min Sustained Use)

| Measurement | Before | After | Delta | Pass? | Status |
|-------------|--------|-------|-------|-------|--------|
| Battery % | PENDING | PENDING | PENDING | < 8% drop | PENDING-DEVICE-RUN |
| Device skin-temp (`dumpsys thermalservice`) | PENDING | PENDING | — | No thermal throttle | PENDING-DEVICE-RUN |

**Evidence:** logs/ac18-thermal-before.txt, logs/ac18-thermal-after.txt
**Status: PENDING-DEVICE-RUN**

---

## AC 22 — No Regression in Desktop Test Suite

| Suite | Command | Result | Date | Snapshot |
|-------|---------|--------|------|----------|
| Vitest (full) | `npm test` | 2267/2459 pass; 192 FAIL (pre-existing, unrelated) | 2026-04-30 | evidence/ci-snapshot-final.txt |
| Vitest (mobile-only) | `npx vitest run src/mobile` | **531/531 PASS** (55 files) | 2026-04-30 | evidence/ci-snapshot-final.txt |
| TypeScript | `tsc --noEmit` | **CLEAN — 0 errors** | 2026-04-30 | evidence/ci-snapshot-final.txt |
| Cargo (Rust) | `cargo test` | PENDING (toolchain unavailable in agent context) | — | — |

**Status: PARTIALLY-AUTOMATED** — Mobile suite 531/531 PASS; TypeScript CLEAN; full suite 192 pre-existing fails (not caused by this story, verified via `git stash` isolation); cargo pending.

---

## Summary Status Table

| AC | Description | Status |
|----|-------------|--------|
| AC 1 | Cold-start < 3s | PENDING-DEVICE-RUN |
| AC 2 | Responsive layout + touch targets | PENDING-DEVICE-RUN |
| AC 3 | Drag/swipe 60fps | PENDING-DEVICE-RUN |
| AC 4 | SSH end-to-end | PENDING-DEVICE-RUN |
| AC 5 | Terminal latency | PENDING-DEVICE-RUN |
| AC 6 | Review approve/reject | PENDING-DEVICE-RUN |
| AC 7 | Planning chat | PENDING-DEVICE-RUN |
| AC 8 | Critical journeys no crash | PENDING-DEVICE-RUN |
| AC 9 | Network transition ≤ 30s | PENDING-DEVICE-RUN |
| AC 10 | Platform parity doc | AUTOMATED (iOS-deferred documented) |
| AC 11 | Deep-link cold+warm | PENDING-DEVICE-RUN (unit tests pass) |
| AC 12 | Touch-target audit | AUTOMATED (script ships) |
| AC 13 | Reduced-motion compliance | PARTIALLY-AUTOMATED (grep verified; device recordings pending) |
| AC 14 | Performance smoke | PENDING-DEVICE-RUN |
| AC 15 | Tauri WebView quirks | PENDING-DEVICE-RUN |
| AC 16 | SSH lifecycle | PENDING-DEVICE-RUN |
| AC 17 | Activity feed backgrounded | PENDING-DEVICE-RUN |
| AC 18 | Battery/thermal | PENDING-DEVICE-RUN |
| AC 19 | t3-8-test-report.md updated | PARTIAL (skeleton updated; pending real numbers) |
| AC 20 | Evidence dir committed | AUTOMATED (scaffold shipped) |
| AC 21 | Bug triage | PARTIAL (BUG-001 logged in t3-5-9-followup-bugs.md; device-run bugs TBD) |
| AC 22 | No test regression | PARTIALLY-AUTOMATED (mobile 531/531 PASS; TS clean; full suite 192 pre-existing; cargo pending) |
| AC 23 | Sprint-status update | PARTIAL (story: review; → done when device runs complete; epic: → done with story) |
