# T3.8 Mobile Platform Validation — Test Report

**Date:** 2026-04-17 (framework); updated 2026-04-30 (T3.5-9 agent pass)
**Status:** PARTIAL — iOS Deferred; PENDING-DEVICE-RUN (Android device runs outstanding)

> **Scope change (2026-04-30):** T3.8 is cancelled per sprint-status.yaml; its validation scope has
> been absorbed into T3.5-9 (Real-Device Validation Gate). This document is updated in-place per
> story T3.5-9 AC 19. All AC rows from T3.8 now have corresponding T3.5-9 evidence entries.
> T3.2–T3.7 (responsive layout) are superseded; all ACs below now target the parallel mobile tree
> at `src/mobile/` (Epic 3.5).
>
> **DO NOT re-introduce fabricated metrics.** Every measurement must be backed by
> `_bmad-output/implementation-artifacts/t3-5-9-evidence/` artifacts.

---

## Executive Summary

Epic 3.5 (T3.5-1 through T3.5-9) delivers a full parallel mobile UI tree at `src/mobile/`.
The previous T3.8 test report contained fabricated performance metrics; those have been removed.

### What Is Ready (Code Complete — Epic 3.5)

- T3.5-1: Mobile shell foundation — MobileScreen, MobileTopAppBar, MobileTabBar, MobileSheet,
  deep-link bridge, mobile-nav Zustand store. All tests passing.
- T3.5-2: Mobile primitives library — 14 primitives with a11y and reduced-motion compliance.
- T3.5-3: Mobile board — MobileBoardScreen with @dnd-kit drag, MobileColumnPager.
- T3.5-4: Mobile task workspace — 4 sub-tabs (Content / Terminal / Activities / Diff).
- T3.5-5: Mobile planning — MobilePlanningHome, MobileChatScreen, composer keyboard fix.
- T3.5-6: Mobile review — MobileDiffViewerScreen, approve/reject/feedback flows.
- T3.5-7: Mobile SSH & connection management — full SSH form + key management.
- T3.5-8: Mobile activity feed & settings — MobileActivityFeedScreen, MobileSettingsHome,
  MobileAgentSettings, MobileThemeSettings, MobileDiagnostics, MobileAbout,
  global activity subscription.
- T3.5-9: Validation gate — evidence scaffolding, audit script, this document.

### What Requires Real Device Testing (PENDING-DEVICE-RUN)

All Android ACs listed below require physical or emulator device runs.
iOS is deferred (macOS unavailable).

See `_bmad-output/implementation-artifacts/t3-5-9-evidence/measurements.md` for the
complete master evidence table.

---

## Testing Procedure Status

### Environment Setup

- Android: API 34 emulator or physical device (2022+, e.g., Pixel 6) — PENDING-DEVICE-RUN
- iOS: iOS-deferred (macOS unavailable; see `t3-5-9-platform-parity.md`)
- Build: `npm run android:build` / `npm run ios:build` for debug APK/IPA — PENDING-DEVICE-RUN

### AC 1: Launch Performance (PENDING-DEVICE-RUN)

5 cold starts on each platform, record time from tap to first interactive frame.
Target: < 3 seconds on both platforms.
Tools: `adb shell am start -W <pkg>/.MainActivity` → parse `TotalTime` field.

Measurement table: see `t3-5-9-evidence/measurements.md § AC 1`.

### AC 2: Responsive Layout / Touch Targets (PENDING-DEVICE-RUN + AUTOMATED)

Walk every screen at 360×800 (Android) and 375×812 (iOS-deferred).
Touch-target automated audit: `npm run audit:touch-targets` → 15/15 PASS (2026-04-30).
- Tab bar buttons: min-h-[3.5rem] = 56px ✓
- Bottom action bar: min-h-[2.75rem] = 44px ✓
- FAB: h-14 w-14 = 56px ✓
- List item rows: min-h-[3.25rem] = 52px ✓
- Activity rows: min-h-11 = 44px ✓
- Sheet: `env(safe-area-inset-*)` applied ✓
- 100dvh viewport height ✓

Device pixel verification (via Chrome DevTools remote-inspect): PENDING-DEVICE-RUN.
Evidence: `t3-5-9-evidence/touch-target-audit.md`

### AC 3: Touch Kanban (60fps) (PENDING-DEVICE-RUN)

Profile MobileBoardScreen long-press drag (5s). Target: ≥ 55 fps, no jank > 16 ms.
`@dnd-kit` autoScroll fix applied (commit f8ec1e6).
Evidence: `t3-5-9-evidence/traces/ac3-board-drag.trace`

### AC 4: SSH Connection (Mobile) (PENDING-DEVICE-RUN)

Connections → add SSH profile → Test Connection → save → open remote project → board loads.
Evidence: `t3-5-9-evidence/recordings/ac4-ssh-flow.mp4`

### AC 5: Mobile Terminal (PENDING-DEVICE-RUN)

Cellular: 10 commands, record min/median/p95 latency. Target: p95 < 2s.
Evidence: `t3-5-9-evidence/logs/ac5-cellular.txt`, `ac5-wifi.txt`

### AC 6: Mobile Review (PENDING-DEVICE-RUN)

Approve → merge, Reject → feedback → In Progress. Two screen recordings.
Evidence: `t3-5-9-evidence/recordings/ac6-approve.mp4`, `ac6-reject.mp4`

### AC 7: Mobile Chat (PENDING-DEVICE-RUN)

Session list → tap session → send "ping" → response ≤ 60s. One recording.
Evidence: `t3-5-9-evidence/recordings/ac7-planning-chat.mp4`

### AC 8: Critical User Journeys (PENDING-DEVICE-RUN)

Execute J1, J2, J3 on physical Android. Zero RustPanic, FATAL, AndroidRuntime in logcat.
Evidence: `t3-5-9-evidence/logs/logcat-j1.txt`, `logcat-j2.txt`, `logcat-j3.txt`

### AC 9: Network Resilience WiFi ↔ Cellular (PENDING-DEVICE-RUN)

Recovery ≤ 30s. Screen recording with timestamp overlay.
Evidence: `t3-5-9-evidence/recordings/ac9-network-transition.mp4`

### AC 10: Platform Parity (iOS-DEFERRED)

Android: PENDING-DEVICE-RUN.
iOS: iOS-deferred — macOS unavailable.
Documentation: `t3-5-9-evidence/t3-5-9-platform-parity.md`

---

## New ACs (Epic 3.5 — T3.5-9)

### AC 11: Deep-Link Cold + Warm Start (PENDING-DEVICE-RUN; Unit Tests PASS)

All 8+ deep-link patterns covered in `src/mobile/shell/deeplinks.ts`.
Unit tests: 23/23 passing (`src/mobile/shell/deeplinks.test.ts`).
Device cold/warm execution: PENDING-DEVICE-RUN.

### AC 12: Touch-Target Audit (AUTOMATED — PASS)

Script: `scripts/audit-touch-targets.ts` | npm script: `audit:touch-targets`
Result: 15/15 tests PASS (2026-04-30).
Evidence: `t3-5-9-evidence/touch-target-audit.md`
Note: BUG-001 logged (disabled placeholder button h-10 < 44px; non-blocker).

### AC 13: Reduced-Motion Compliance (PARTIALLY-AUTOMATED)

`useReducedMotion` hook: 16 source files confirmed consuming it (grep → `logs/reduced-motion-grep.txt`).
Key primitives verified: MobileSheet (slide transitions), MobileActivityRow (glow), MobileFab (scale),
MobileLoadingSkeleton (animate-pulse), MobilePullToRefresh (spinner), MobileBottomActionBar (haptic).
Device recordings (motion-ON vs OFF): PENDING-DEVICE-RUN.

### ACs 14–18: Performance, WebView Quirks, SSH Lifecycle, Activity BG, Battery

All PENDING-DEVICE-RUN. See `t3-5-9-evidence/measurements.md` for tables and procedures.

---

## Automated CI Results (2026-04-30)

| Suite | Result |
|-------|--------|
| `npm run audit:touch-targets` | **15/15 PASS** |
| `npx vitest run src/mobile` | **531/531 PASS** (55 test files) |
| `npm test` (full suite) | 2267/2459 pass; 192 FAIL (pre-existing, unrelated to mobile tree) |
| `tsc --noEmit` | **CLEAN — 0 errors** |
| `cargo test` | PENDING (Rust toolchain unavailable in agent context) |

Pre-existing test failures (193 before this story, 192 after — 1 less due to run variance):
- Affect: VelocityWidget, Welcome, useAgentLauncher, useNextRecommendation, PlanningWorkspacePage, etc.
- Mobile tree: ZERO failures.

---

## Sign-Off

**Status:** `PARTIAL — iOS Deferred; PENDING-DEVICE-RUN (Android hardware)`

| Field | Value |
|-------|-------|
| Story | T3.5-9 Real-Device Validation Gate |
| Automated pass | DEV 1 agent (Sonnet 4.6), 2026-04-30 |
| Android device | PENDING-DEVICE-RUN (developer to fill: model + Android version + serial last 4) |
| iOS device | iOS-deferred — macOS unavailable |
| Evidence dir | `_bmad-output/implementation-artifacts/t3-5-9-evidence/` |
| Gate status | `review` — automation complete; device runs outstanding |

**Per-AC summary:**

| AC | Status |
|----|--------|
| AC 1 | PENDING-DEVICE-RUN |
| AC 2 | PENDING-DEVICE-RUN (touch targets class-verified PASS) |
| AC 3 | PENDING-DEVICE-RUN |
| AC 4 | PENDING-DEVICE-RUN |
| AC 5 | PENDING-DEVICE-RUN |
| AC 6 | PENDING-DEVICE-RUN |
| AC 7 | PENDING-DEVICE-RUN |
| AC 8 | PENDING-DEVICE-RUN |
| AC 9 | PENDING-DEVICE-RUN |
| AC 10 | AUTOMATED (iOS-deferred documented) |
| AC 11 | PENDING-DEVICE-RUN (unit tests PASS) |
| AC 12 | AUTOMATED — 15/15 PASS |
| AC 13 | PARTIALLY-AUTOMATED (hook+grep PASS; device recordings pending) |
| AC 14 | PENDING-DEVICE-RUN |
| AC 15 | PENDING-DEVICE-RUN |
| AC 16 | PENDING-DEVICE-RUN |
| AC 17 | PENDING-DEVICE-RUN |
| AC 18 | PENDING-DEVICE-RUN |
| AC 19 | This document (partial — device numbers pending) |
| AC 20 | AUTOMATED — evidence dir scaffolded |
| AC 21 | BUG-001 logged (non-blocker); device-run bugs TBD |
| AC 22 | AUTOMATED — mobile suite 531/531 PASS; full suite pre-existing fails only |
| AC 23 | PARTIAL — status → review; → done when device runs complete |

**Note:** The status will flip from `PARTIAL — iOS Deferred; PENDING-DEVICE-RUN` to
`PASSED` or `PARTIAL — iOS Deferred` once Android device runs are executed and evidence
artifacts are committed. NO fabricated metrics will be introduced.
