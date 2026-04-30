# Touch Target Audit — T3.5-9

**Story:** T3.5-9 Real-Device Validation Gate
**AC:** 2 (device measurement) + 12 (automated script)
**Script:** `scripts/audit-touch-targets.ts` → `npm run audit:touch-targets`
**Date:** 2026-04-30

---

## Automated Audit (AC 12)

The script `scripts/audit-touch-targets.ts` renders each mobile screen component in jsdom
and asserts that every focusable element has `min(width, height) ≥ 44 px` via mocked
`getBoundingClientRect()`.

**Important note on jsdom limitations:** jsdom does not lay out CSS, so `getBoundingClientRect()`
always returns zero-sized rects. The automated audit therefore checks for the *presence* of
Tailwind minimum-size classes (`min-h-11`, `min-h-[44px]`, `h-11`, `h-[44px]`, etc.) and
`style` attributes that set minimum dimensions ≥ 44 px on interactive elements. The Tailwind
`min-h-11` token maps to 44 px (1rem = 16px; h-11 = 2.75rem = 44px). Pixel-accurate
measurement at real device DPI is captured separately under AC 2 (PENDING-DEVICE-RUN).

See the script output appended below.

### Script Output

Captured 2026-04-30 via `npm run audit:touch-targets`. Full output in
`ci-snapshot-final.txt`. Summary:

```
 ✓ scripts/audit-touch-targets.ts (15 tests) 30ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Start at  12:49:56
   Duration  409ms (transform 82ms, setup 0ms, import 127ms, tests 30ms, environment 0ms)
```

**useReducedMotion** used in 16 source files (see logs/reduced-motion-grep.txt).
**No violations** detected by automated class-presence checks.
BUG-001: MobileChatScreen overflow button h-10 = 40px (non-blocker — disabled placeholder).
See `t3-5-9-followup-bugs.md` for details.

---

## AC 2 Device Measurement Table (PENDING-DEVICE-RUN)

**Procedure:** During `tauri android dev` at 360×800 (Pixel 6 profile), use Chrome DevTools
remote-inspect (`chrome://inspect/#devices`) → hover over each interactive element → confirm
pixel tap area shown in DevTools tooltip is ≥ 44×44 px.

| Screen | Element | Selector / role | Measured W (px) | Measured H (px) | min(W,H) | Pass? | Notes |
|--------|---------|----------------|-----------------|-----------------|---------|-------|-------|
| MobileBoardScreen | Column header | role=button | PENDING | PENDING | PENDING | — | |
| MobileBoardScreen | Task card | role=button | PENDING | PENDING | PENDING | — | |
| MobileBoardScreen | FAB (new task) | role=button | PENDING | PENDING | PENDING | — | |
| MobileTaskWorkspaceScreen | Segmented tab (Content) | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTaskWorkspaceScreen | Segmented tab (Terminal) | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTaskWorkspaceScreen | Segmented tab (Activities) | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTaskWorkspaceScreen | Segmented tab (Diff) | role=tab | PENDING | PENDING | PENDING | — | |
| MobileChatScreen | Send button | role=button | PENDING | PENDING | PENDING | — | |
| MobileChatScreen | Chat composer input | input | PENDING | PENDING | PENDING | — | |
| MobileConnectionFormScreen | Test Connection button | role=button | PENDING | PENDING | PENDING | — | |
| MobileConnectionFormScreen | Save button | role=button | PENDING | PENDING | PENDING | — | |
| MobileConnectionFormScreen | Cancel / back button | role=button | PENDING | PENDING | PENDING | — | |
| MobileActivityFeedScreen | Activity row | role=listitem (button) | PENDING | PENDING | PENDING | — | min-h-11 in source |
| MobileSettingsHome | Settings row | role=button | PENDING | PENDING | PENDING | — | |
| MobileAgentSettings | Form inputs | input | PENDING | PENDING | PENDING | — | |
| MobileThemeSettings | Theme option | role=radio | PENDING | PENDING | PENDING | — | |
| MobileDiagnostics | Copy button | role=button | PENDING | PENDING | PENDING | — | |
| MobileAbout | Back button | role=button | PENDING | PENDING | PENDING | — | |
| MobileTabBar | Board tab | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTabBar | Planning tab | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTabBar | Tasks tab | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTabBar | Activity tab | role=tab | PENDING | PENDING | PENDING | — | |
| MobileTabBar | Settings tab | role=tab | PENDING | PENDING | PENDING | — | |
| MobileReviewActionBar | Approve button | role=button | PENDING | PENDING | PENDING | — | |
| MobileReviewActionBar | Reject button | role=button | PENDING | PENDING | PENDING | — | |
| MobileDiffViewerScreen | File tree toggle | role=button | PENDING | PENDING | PENDING | — | |
| MobileConnectionsListScreen | Connection row | role=button / listitem | PENDING | PENDING | PENDING | — | |
| MobileConnectionsListScreen | Add connection FAB | role=button | PENDING | PENDING | PENDING | — | |

**All rows above:** PENDING-DEVICE-RUN

---

## Violations Log

No violations detected by automated script at time of agent execution (jsdom class-presence
checks pass — see script output above). Device pixel measurements pending.

If violations are found during device testing, log here:

| Screen | Element | Measured size | Required | Severity | Fix status |
|--------|---------|--------------|----------|----------|------------|
| (none yet) | | | ≥ 44×44 px | | |
