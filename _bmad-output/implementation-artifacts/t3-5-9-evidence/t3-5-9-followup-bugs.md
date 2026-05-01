# T3.5-9 Follow-Up Bugs

**Story:** T3.5-9 Real-Device Validation Gate
**AC:** 21
**Date:** 2026-04-30

Per story AC 21: Any defect found during validation MUST be triaged here.
Blockers are fixed in-place; non-blockers are logged below.

No silently-deferred bugs. If you saw it, it is recorded.

---

## Blockers Fixed In-Place

_(none found during automation pass — device-run blockers TBD)_

| Bug ID | AC | Screen | Description | Fix commit | Re-run evidence |
|--------|----|--------|-------------|------------|-----------------|
| — | — | — | — | — | — |

---

## Non-Blockers (Deferred to Follow-Up Epic)

### BUG-001 — MobileChatScreen overflow button slightly below 44px touch target

- **Severity:** Non-Blocker (disabled placeholder — not interactive)
- **AC affected:** AC 12 (touch target audit)
- **Screen:** MobileChatScreen — chat header overflow button (MoreVertical icon)
- **Repro steps:**
  1. Source: `src/mobile/planning/MobileChatScreen.tsx` line ~201
  2. Observe: `<button disabled className="h-10 w-10 ...">` — h-10 = 40px, below 44px
  3. Expected: min-h-11 (44px) or min-h-[2.75rem] (44px) on the button
- **Context:** Button is `disabled` with `opacity-30 cursor-not-allowed` — it is a "Coming in T3.5-8" placeholder and not currently interactive. The 40px size is therefore non-blocking for this story.
- **Follow-up Epic suggestion:** When T3.5-8 wires up the real overflow menu, update the button to `min-h-11 min-w-11` or `h-11 w-11` to meet the 44px touch target requirement.
- **Status:** [ ] Open — fix when overflow menu is implemented

### Template for new entries:

```
### BUG-NNN — <one-line summary>

- **Severity:** Non-Blocker (cosmetic / edge-case / future-network-condition)
- **AC affected:** AC X
- **Screen:** <component name>
- **Repro steps:**
  1. Step 1
  2. Step 2
  3. Observe: <what happens>
  4. Expected: <what should happen>
- **Follow-up Epic suggestion:** Epic 4 / T4.x sprint (describe the suggested fix)
- **Status:** [ ] Open
```

---

## Pre-Device Automation Findings

The following items were noted during the automated pass (2026-04-30) but are NOT bugs — they
are known limitations of the jsdom environment that the audit script operates in:

1. **jsdom getBoundingClientRect() always returns zero** — the touch-target audit script
   checks for Tailwind class presence as a proxy. Real pixel measurements require device runs
   (AC 2 PENDING-DEVICE-RUN). If any classes are found absent on device, they will be added
   here as non-blockers or blockers depending on severity.

2. **No physical device available** — all device-run ACs are structurally pending, not
   failing. This is expected per story dev notes. The story is in `review` status with
   pending-device-run documentation, not `done`.
