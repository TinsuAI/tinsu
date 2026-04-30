# T3.5-9 Platform Parity Document

**Story:** T3.5-9 Real-Device Validation Gate
**AC:** 10
**Date:** 2026-04-30

---

## Android (Always Required)

| AC | Test executed on Android? | Device | Android version | Notes |
|----|--------------------------|--------|-----------------|-------|
| AC 1 — Cold-start | PENDING-DEVICE-RUN | PENDING | PENDING | Emulator API 34 + physical 2022+ |
| AC 2 — Responsive layout | PENDING-DEVICE-RUN | PENDING | PENDING | 360×800 emulator |
| AC 3 — Drag/swipe FPS | PENDING-DEVICE-RUN | physical | PENDING | CPU Profiler trace |
| AC 4 — SSH end-to-end | PENDING-DEVICE-RUN | physical | PENDING | Tailscale or LAN SSH |
| AC 5 — Terminal latency | PENDING-DEVICE-RUN | physical | PENDING | Cellular + WiFi |
| AC 6 — Review approve/reject | PENDING-DEVICE-RUN | physical | PENDING | |
| AC 7 — Planning chat | PENDING-DEVICE-RUN | physical | PENDING | |
| AC 8 — Critical journeys | PENDING-DEVICE-RUN | physical | PENDING | logcat per journey |
| AC 9 — Network transition | PENDING-DEVICE-RUN | physical | PENDING | WiFi → cellular |
| AC 11 — Deep-link | PENDING-DEVICE-RUN | physical | PENDING | adb am start VIEW |
| AC 12 — Touch target audit | AUTOMATED (jsdom) | N/A | N/A | See touch-target-audit.md |
| AC 13 — Reduced-motion | PENDING-DEVICE-RUN | physical | PENDING | Settings → Accessibility |
| AC 14 — Perf smoke | PENDING-DEVICE-RUN | physical | PENDING | Profiler + meminfo |
| AC 15 — WebView quirks | PENDING-DEVICE-RUN | physical | PENDING | notch + keyboard + back |
| AC 16 — SSH lifecycle | PENDING-DEVICE-RUN | physical | PENDING | WiFi+cellular, BG/FG |
| AC 17 — BG live update | PENDING-DEVICE-RUN | physical | PENDING | |
| AC 18 — Battery/thermal | PENDING-DEVICE-RUN | physical | PENDING | 30 min sustained |

---

## iOS

**Status: iOS-DEFERRED**

**Rationale:** This story was executed in a headless agent context without access to macOS.
Building and running iOS targets requires:
- macOS with Xcode 15+ installed
- iOS 16+ simulator or physical iPhone/iPad
- `xcrun simctl` for deep-link invocation

Per the story's AC 10 caveat and LLM-developer guardrail #4 ("If you cannot run it, explicitly
mark it deferred with rationale"), all iOS-specific executions are deferred.

**Follow-up ticket reference:** Log as T4.x iOS validation story in Epic 4 sprint planning.
iOS build pipeline is tracked in T4.3 (ios-build-pipeline) — attach iOS device validation
as a sub-task of T4.3.

| AC | iOS status | Notes |
|----|-----------|-------|
| AC 1 — Cold-start (iOS) | iOS-deferred | Requires Xcode Instruments |
| AC 2 — Layout at 375×812 (iPhone SE) | iOS-deferred | Requires iOS simulator |
| AC 3 — FPS profile (iOS) | iOS-deferred | Requires Xcode Instruments |
| AC 4 — SSH on iOS | iOS-deferred | Requires physical iOS device on same LAN |
| AC 5 — Terminal latency (iOS) | iOS-deferred | Requires physical iOS device on cellular |
| AC 6 — Review (iOS) | iOS-deferred | |
| AC 7 — Planning chat (iOS) | iOS-deferred | |
| AC 8 — Journeys (iOS) | iOS-deferred | |
| AC 9 — Network transition (iOS) | iOS-deferred | |
| AC 11 — Deep-link (iOS) | iOS-deferred | `xcrun simctl openurl booted "<deep-link>"` |
| AC 13 — Reduced-motion (iOS) | iOS-deferred | Settings → Accessibility → Reduce Motion |
| AC 14 — Perf smoke (iOS) | iOS-deferred | |
| AC 15 — WebView quirks (iOS) | iOS-deferred | Safe-area + home-indicator + scroll-bounce |

---

## Known Android–iOS Divergences (Expected)

These divergences are architectural/expected and do not require platform parity ACs to match:

| Area | Android | iOS | Notes |
|------|---------|-----|-------|
| Deep-link invocation | `adb shell am start -W -a android.intent.action.VIEW` | `xcrun simctl openurl booted` | Different CLI tools, same app behavior |
| Hardware back button | Physical back button / gesture → pops nav stack | No hardware back; swipe-from-left-edge (Tauri WebView may handle via gesture) | iOS back handled by MobileTopAppBar back button |
| Keyboard avoidance | WebView resizes with `adjustResize` window behavior | Keyboard covers WebView; requires `visualViewport` listener | T3.5-5 added relative-positioning fix for composer |
| Scroll bounce | Android overscroll glow (system) | iOS rubber-band bounce (Tauri WebView inherits WKWebView) | Both tested for layout stability in AC 15 |
| Safe-area | Status bar + gesture nav bar | Notch (if applicable) + home indicator | `env(safe-area-inset-*)` tokens handle both |
| Memory profiling | `adb shell dumpsys meminfo` | Xcode Instruments (Leaks/Allocations) | Different tools, same pass criterion (< 250 MB Pss) |
| Screen recording | `adb screenrecord` | QuickTime (physical) or Xcode window capture (simulator) | |

---

## Sign-Off

Android execution: PENDING-DEVICE-RUN (developer TBD + device TBD)
iOS execution: iOS-deferred — macOS unavailable (see rationale above)

Gate closes when:
1. All PENDING-DEVICE-RUN rows above are filled with actual values.
2. `measurements.md` master table shows pass/fail for every Android AC.
3. iOS-deferred is formally acknowledged in the Sign-off of `t3-8-test-report.md`.
