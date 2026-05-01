# Agent Team: BMAD Implementation Pipeline

This document defines the automated agent team workflow for implementing epics story-by-story.

## Team Composition

| Agent | Model | Role |
|-------|-------|------|
| **SM** (Scrum Master) | Opus 4.7 | Creates stories from epic backlog |
| **DEV 1** (Developer) | Sonnet 4.6 | Implements story code |
| **DEV 2** (Reviewer) | Sonnet 4.6 | Reviews code and auto-fixes issues |

## Pipeline Steps (per story)

### Step 1: Create Story
**Agent:** SM (Opus 4.7)
```
/bmad-create-story *story-number
```
- Generates the story file with acceptance criteria, tasks, and technical details
- Output: Story file ready for development
- **Status update:** `sprint-status.yaml` story status → `ready-for-dev`

### Step 2: Develop Story
**Agent:** DEV 1 (Sonnet 4.6)
```
/bmad-dev-story *story-number
```
- Implements all code changes defined in the story
- Follows project conventions from CLAUDE.md
- **For all UI-related tasks** (new pages, components, UI updates): MUST use the `/frontend-design` skill to generate the UI code. This ensures distinctive, production-grade frontend design that avoids generic AI aesthetics.
- Ensures tests are written and passing
- **Status update:** `sprint-status.yaml` story status → `review`

### Step 3: Code Review & Auto-Fix
**Agent:** DEV 2 (Sonnet 4.6)
```
/bmad-code-review *story-number
```
- Reviews the implemented code for quality, conventions, and correctness
- Automatically fixes all identified issues
- Ensures code meets project standards
- **Status update:** `sprint-status.yaml` story status → `done`

### Step 4: Commit Changes
- Stage and commit all changes from the story implementation
- **Commit message MUST include the story number** (e.g., `feat: [14-1-1] remove required file enforcement backend`)

### Step 5: Repeat
- Move to the next story number and repeat from Step 1
- Continue until all stories in the epic are complete

## Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   For each story:                             │
│                                                              │
│  SM (Opus 4.7)                                                 │
│  └─► /bmad-create-story *N                                   │
│       status: backlog → ready-for-dev                        │
│       │                                                      │
│       ▼                                                      │
│  DEV 1 (Sonnet 4.6)                                            │
│  └─► /bmad-dev-story *N                                      │
│       status: ready-for-dev → in-progress → review           │
│       │                                                      │
│       ▼                                                      │
│  DEV 2 (Sonnet 4.6)                                          │
│  └─► /bmad-code-review *N  (review + auto-fix)              │
│       status: review → done                                  │
│       │                                                      │
│       ▼                                                      │
│  Commit changes                                              │
│       │                                                      │
│       ▼                                                      │
│  Next story (N+1) ──► Loop back to top                       │
└──────────────────────────────────────────────────────────────┘
```

## Context Management (Critical)

**Each agent MUST reset/clear their context after completing their step.** This is essential because:

- Story implementations can be large and consume significant context window
- Stale context from a previous story can cause confusion or hallucinations
- Fresh context ensures each story gets full attention and accurate work

### Reset Rule

After an agent finishes their step for a story, they must:
1. Complete their work and confirm it's done
2. **Reset their context** (terminate and respawn fresh for the next story)
3. On respawn, reload this file (`agent-team-bmad-implementation.md`) and `CLAUDE.md` before starting

This means for each story iteration, all three agents start with a **clean context** — only loading the project instructions and the current story they need to work on.

## Story Status Tracking (Critical)

**Every agent MUST update `sprint-status.yaml` as part of their workflow.** This is non-negotiable — the BMAD workflow instructions define these transitions explicitly:

| Step | Agent | Status Transition | Workflow Reference |
|------|-------|-------------------|--------------------|
| Create Story | SM | `backlog` → `ready-for-dev` | `create-story/instructions.xml` |
| Develop Story | DEV 1 | `ready-for-dev` → `in-progress` → `review` | `dev-story/instructions.xml` Steps 4, 9 |
| Code Review | DEV 2 | `review` → `done` | `code-review/instructions.xml` Step 5 |

### Rules for Agents

1. **Follow ALL workflow steps in `instructions.xml`** — not just the implementation steps. The status update steps (dev-story Steps 4 and 9, code-review Step 5) are mandatory.
2. **Verify the status was updated** before reporting completion. Check `sprint-status.yaml` and confirm the story key shows the correct status.
3. **If an agent finishes without updating status**, the team lead must fix it before committing.

### Status File Location
```
_bmad-output/implementation-artifacts/sprint-status.yaml
```

## Agent Prompt Templates (Critical)

The team lead MUST use these exact prompt templates when spawning agents.

**IMPORTANT — Lesson Learned:** Agents will take shortcuts if the prompt gives them enough
context to do the work without invoking the skill. DO NOT describe what the skill does or
list files in the prompt. Keep prompts minimal so the agent MUST use the Skill tool, which
loads the full BMAD workflow chain (workflow.xml → workflow.yaml → instructions.xml) with
all steps including status updates.

### Model Selection (Critical)

**Model assignment is per-role and MUST be set explicitly:**
- **SM** → `model: "opus"` (story creation)
- **DEV 1** → `model: "sonnet"` (implementation)
- **DEV 2** → `model: "sonnet"` (code review)

Always pass the correct model to the Agent tool when spawning each agent.

### SM Agent Prompt
```
You are Agent SM (Scrum Master) in the BMAD implementation pipeline.

Before starting, read these two files for context:
1. {project-root}/agent-team-bmad-implementation.md
2. {project-root}/CLAUDE.md

Your ONLY task: Use the Skill tool to run /bmad-create-story {story-number}

You MUST use the Skill tool to invoke this command. Do NOT attempt to create the story
manually. The Skill tool will load the full BMAD workflow which you must follow step by step.

After completion, verify that sprint-status.yaml shows the story as "ready-for-dev".
Report back what was produced and confirm the status update.
```

### DEV 1 Agent Prompt
```
You are Agent DEV 1 (Developer) in the BMAD implementation pipeline.

Before starting, read these two files for context:
1. {project-root}/agent-team-bmad-implementation.md
2. {project-root}/CLAUDE.md

Your ONLY task: Use the Skill tool to run /bmad-dev-story {story-number}

You MUST use the Skill tool to invoke this command. Do NOT attempt to implement the story
manually or read the story file directly. The Skill tool will load the full BMAD workflow
which you must follow step by step — including status updates in sprint-status.yaml.

IMPORTANT — Frontend Design Requirement:
For ANY UI-related tasks (new pages, new components, component updates, layout changes),
you MUST use the Skill tool to invoke /frontend-design BEFORE writing UI code. This skill
generates distinctive, production-grade frontend code. Pass it a clear description of the
UI you need (what component, what it should display, interactions, and the tech stack:
Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui). Then integrate its output into
the codebase. Do NOT write UI code from scratch without using /frontend-design first.

If the workflow includes a commit step, the commit message MUST include the story number
(e.g., `feat: [14-1-1] remove required file enforcement backend`).

After completion, verify that sprint-status.yaml shows the story as "review".
Report back what files were created/modified and confirm the status update.
```

### DEV 2 Agent Prompt
```
You are Agent DEV 2 (Code Reviewer) in the BMAD implementation pipeline.

CRITICAL — AUTO-FIX RULE: At every step of the review workflow, automatically fix all
identified issues without pausing. When presented with any fix options, always choose
to fix automatically. Do NOT wait for human input at any checkpoint — auto-proceed and
auto-fix throughout the entire workflow.

Before starting, read these two files for context:
1. {project-root}/docs/agent-team-bmad-implementation.md
2. {project-root}/CLAUDE.md

Your ONLY task: Use the Skill tool to run /bmad-code-review {story-number}

You MUST use the Skill tool to invoke this command. Do NOT attempt to review the code
manually or read files directly. The Skill tool will load the full BMAD workflow which
you must follow step by step — including status updates in sprint-status.yaml.

If the workflow includes a commit step, the commit message MUST include the story number
(e.g., `fix: [14-1-1] code review fixes`).

After completion, verify that sprint-status.yaml shows the story as "done".
Report back what issues were found, what was fixed, and confirm the status update.
```

## Agent Completion Enforcement (Critical)

**The team lead MUST verify that each agent completed its job before moving on.** Agents can terminate early due to context limits, especially on large UI stories. This is non-negotiable:

### Detection

After every agent returns, the team lead checks:
1. Did the agent report completion of ALL tasks?
2. Is `sprint-status.yaml` updated to the expected status?
3. Do `git status` results show all expected files were created/modified?

**IMPORTANT — Wait for the completion report, do NOT interrupt:** Only intervene (check status, send messages) after the agent has sent a completion report message. Do not ping agents mid-work just because they went idle — idle is normal during sub-agent delegation. An agent going idle without sending a completion report does NOT require intervention unless significant time has passed.

### Idle ≠ Stopped (Critical)

**An idle notification does NOT mean the agent has stopped or failed.** Agents go idle between turns — this is normal. An agent running a skill (e.g., `/bmad-code-review`) may spawn local sub-agents internally and appear idle while waiting for them to finish. Before treating an agent as failed:

1. **Check `sprint-status.yaml`** — if the status has NOT changed, the agent may still be working
2. **Send a status-check message** and wait for a real response (not just another idle notification)
3. **Do NOT spawn a replacement** just because the agent went idle — only replace if the agent has truly stopped (no response after multiple prompts, or confirmed context limit exceeded)

**NEVER spawn a duplicate agent while the original is still running.** If you spawned a duplicate by mistake, shut it down immediately before the original finishes, to avoid conflicting writes.

### Recovery

If an agent stopped midway (incomplete output, missing files, status not updated):
1. **Shutdown the stale agent first** via `SendMessage(type: shutdown_request)` then `tmux kill-pane -t <paneId>` — check `~/.claude/teams/bmad-pipeline/config.json` for the pane ID. **NEVER spawn a replacement before killing the stale one.**
2. **Spawn a single replacement agent** to continue the work
3. The new agent prompt MUST include:
   - What was already completed (list specific files created/modified)
   - What still needs to be done (remaining tasks from the story file)
   - Instruction to read the story file and existing code before continuing
3. If the replacement agent also stops midway, spawn another one — **repeat until the step is fully complete**
4. Only proceed to the next pipeline step (e.g., DEV 2 review) after ALL work for the current step is verified complete

### Why This Matters

- Large UI stories (Epic 7) routinely exceed a single agent's context window
- Partial implementations left uncommitted cause drift and confusion
- The team lead is responsible for pipeline continuity — never stop and wait for user intervention

## Agent Shutdown Protocol (Critical)

**When an agent completes their step, the team lead MUST shut them down properly** — do not leave idle agents running. This frees resources and prevents stale context pollution.

### Shutdown Sequence

After verifying an agent's work is complete and status is updated:

1. **Send shutdown request** via `SendMessage`:
   ```
   SendMessage(to: "<agent-name>", message: {type: "shutdown_request"})
   ```
2. **Wait for acknowledgement** — the agent will confirm and exit gracefully
3. **Kill the tmux pane** for that agent's session:
   ```bash
   tmux kill-pane -t <session-name>:1.1
   ```
   or kill the entire session if it's dedicated to that agent:
   ```bash
   tmux kill-session -t <session-name>
   ```

### Rules

- **Never leave an agent running after their pipeline step is done** — idle agents waste resources
- **Kill the tmux pane immediately** after the agent acknowledges shutdown, don't wait
- For recovery/replacement agents that were spawned mid-story: shut them down the same way once their continuation work is verified complete
- After shutdown, the team lead spawns a **fresh agent** for the next pipeline step — never reuse a session

### Finding the Agent's Tmux Session

Agent sessions are visible with `tmux list-sessions`. Look for sessions matching the agent's spawn time or name pattern. Each Claude Code agent session runs in its own tmux session.

```bash
tmux list-sessions   # find the agent session
tmux kill-session -t <session-name>
```

## Important Notes

- Each agent must load this file and CLAUDE.md into context before starting work
- Stories are processed sequentially — each story must complete all 4 steps before the next begins
- The pipeline runs continuously until all stories in the epic are implemented
- **Agents must NOT carry context between stories** — always reset after completing a step

## T3.5-8: Mobile Activity Feed and Settings

**Story**: `t3-5-8-mobile-activity-feed-and-settings`
**Status**: Review (DEV 1 complete 2026-04-30)
**Tests**: 535 mobile tests passing | TypeScript clean

### New Files

| File | Purpose |
|------|---------|
| `src/mobile/primitives/MobileSettingsRow.tsx` | Reusable settings list row primitive (16th mobile primitive) |
| `src/mobile/primitives/MobileSettingsRow.test.tsx` | 12 tests |
| `src/mobile/activity/activity-meta.ts` | Pure helpers: event type → title/icon/category, payload subtitle, relative time |
| `src/mobile/activity/activity-meta.test.ts` | 38 tests |
| `src/mobile/activity/MobileActivityRow.tsx` | Domain-specific activity feed row with glow animation |
| `src/mobile/activity/MobileActivityRow.test.tsx` | 9 tests |
| `src/mobile/activity/MobileActivityDetail.tsx` | Bottom sheet detail view with JSON payload, "Open task" button |
| `src/mobile/activity/MobileActivityFeedScreen.test.tsx` | 9 tests |
| `src/mobile/settings/MobileAgentSettings.tsx` | Dev/review model selection screen |
| `src/mobile/settings/MobileAgentSettings.test.tsx` | 5 tests |
| `src/mobile/settings/MobileThemeSettings.tsx` | Light/Dark/System theme selection screen |
| `src/mobile/settings/MobileThemeSettings.test.tsx` | 5 tests |
| `src/mobile/settings/MobileDiagnostics.tsx` | Read-only diagnostics with copy-to-clipboard |
| `src/mobile/settings/MobileDiagnostics.test.tsx` | 4 tests |
| `src/mobile/settings/MobileAbout.tsx` | Static about screen with stub rows |
| `src/mobile/settings/MobileAbout.test.tsx` | 4 tests |
| `src/mobile/settings/MobileLicenses.tsx` | Static OSS licenses screen |
| `src/hooks/useGlobalActivitySubscription.ts` | Cross-task Tauri event subscription hook (no task_id filter) |
| `src/hooks/useGlobalActivitySubscription.test.ts` | 4 tests |
| `src/__mocks__/tauri-plugin-os.ts` | Test stub for @tauri-apps/plugin-os |

### Modified Files

| File | Change |
|------|--------|
| `src/mobile/activity/MobileActivityFeedScreen.tsx` | Full implementation: seed fetch, cross-task merge, chip filter, live subscription, deep-link bridge |
| `src/mobile/settings/MobileSettingsHome.tsx` | Full sectioned list: Agent, Connections, Appearance, About sections |
| `src/mobile/MobileApp.tsx` | Added 5 new route cases + mocks in test |
| `src/mobile/MobileApp.test.tsx` | Added mocks for new screens |
| `src/mobile/shell/deeplinks.ts` | Extended DeepLinkTarget with pendingTaskId; added settings/* and activity/* routes |
| `src/mobile/shell/deeplinks.test.ts` | 7 new deep-link tests |
| `src/mobile/shell/mobile-nav.store.ts` | Added pendingActivityForTask state + setPendingActivityForTask action |
| `src/mobile/shell/mobile-nav.store.test.ts` | 4 new store tests |
| `src/mobile/primitives/index.ts` | Exported MobileSettingsRow |
| `src/globals.css` | Added @keyframes activity-glow + .animate-activity-glow class |
| `vitest.config.ts` | Added @tauri-apps/plugin-os alias to stub |

### Key Architecture Decisions

- **Cross-task feed**: TS-side merge (Promise.all per task, no new Rust command) — intentional v1 choice
- **pendingActivityForTask**: Transient store field bridges deep-link → activity feed screen
- **Activity dedup**: Both initial fetch (Set<id>) and live subscription (prev.some check)
- **MobileActivityFeedScreen activity mock**: Tests use `mockUseGlobalActivitySubscription.mock.calls` to retrieve callback (vi.doMock pattern doesn't work for already-imported modules)
- **@tauri-apps/plugin-os**: Not installed in node_modules; stubbed via vitest.config.ts alias
- **Dynamic imports in components**: Changed to static imports for testability (MobileDiagnostics)

---

## T3.5-9: Real-Device Validation Gate

**Story:** `t3-5-9-real-device-validation-gate`
**Status:** review (automation complete; Android device runs pending)
**Agent:** DEV 1 (Sonnet 4.6), 2026-04-30

This story is the Epic 3.5 gate between mobile parallel-tree implementation and Epic 4 CI/CD
pipelines. It validates all T3.5-1 through T3.5-8 screens on real Android hardware and documents
platform parity. iOS execution is deferred pending macOS availability.

### Automated Deliverables Shipped

| Artifact | Status |
|----------|--------|
| `scripts/audit-touch-targets.ts` | SHIPPED — 15/15 tests PASS |
| `scripts/vitest.touch-targets.config.ts` | SHIPPED — vitest config for audit script |
| `package.json` audit:touch-targets script | SHIPPED |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/measurements.md` | SHIPPED — master table with PENDING-DEVICE-RUN stubs |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/touch-target-audit.md` | SHIPPED — automated + device rows |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/t3-5-9-platform-parity.md` | SHIPPED — iOS-deferred documented |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/t3-5-9-followup-bugs.md` | SHIPPED — BUG-001 logged |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/logs/reduced-motion-grep.txt` | SHIPPED — 96-line grep evidence |
| `_bmad-output/implementation-artifacts/t3-5-9-evidence/ci-snapshot-final.txt` | SHIPPED |
| `_bmad-output/implementation-artifacts/t3-8-test-report.md` | UPDATED — in-place with real AC status |

### AC Verification Summary

- **AC 12 (touch targets):** AUTOMATED PASS — `npm run audit:touch-targets` → 15/15
- **AC 13 (reduced-motion):** PARTIALLY-AUTOMATED — `useReducedMotion` used in 16 source files; device recordings pending
- **AC 11 (deep-links):** Unit tests PASS (23/23); device cold/warm runs pending
- **AC 22 (no regression):** Mobile suite 531/531 PASS; full suite pre-existing failures only; TypeScript clean
- **ACs 1–10, 14–18:** PENDING-DEVICE-RUN with structured measurement tables

### Key Findings

- `useReducedMotion` hook correctly consumed in 16 mobile source files including all primitives with animations.
- No `useIsMobile()` branches found in `src/mobile/` — parallel-tree rule upheld.
- `MobileScreen` uses `100dvh` (not `100vh`) — iOS Safari-safe.
- Safe-area `env()` tokens verified in MobileTabBar and MobileBottomActionBar.
- **BUG-001:** `MobileChatScreen` overflow button (`h-10 w-10` = 40px) below 44px — non-blocker (button is disabled placeholder; fix when wiring T3.5-8's real overflow menu).

### Evidence Directory

`_bmad-output/implementation-artifacts/t3-5-9-evidence/`
- `screenshots/` — device screenshots (PENDING-DEVICE-RUN)
- `recordings/` — screen recordings (PENDING-DEVICE-RUN)
- `traces/` — CPU/frame profiler traces (PENDING-DEVICE-RUN)
- `logs/` — logcat + grep outputs (partial — reduced-motion grep captured)
- `ci-snapshot-final.txt` — automated CI results
- `measurements.md` — master evidence table
- `touch-target-audit.md` — touch-target audit results
- `t3-5-9-platform-parity.md` — Android vs iOS parity doc
- `t3-5-9-followup-bugs.md` — bug triage
