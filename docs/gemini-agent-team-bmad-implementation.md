# Gemini CLI: BMAD Implementation Pipeline

This document defines the automated workflow for implementing epics story-by-story using the Gemini CLI and its sub-agent ecosystem.

## Pipeline Architecture

The pipeline uses a **Strategic Orchestrator** pattern. The main Gemini CLI session acts as the lead, delegating each phase to a `generalist` sub-agent. This ensures a "Clean Slate" (context reset) for every step.

| Role | Agent / Tool | Primary Responsibility |
|-------|--------------|------------------------|
| **Orchestrator** | Gemini CLI (Main) | Manages flow, verifies status, and handles commits. |
| **SM** (Scrum Master) | `generalist` Sub-Agent | Creates stories via `bmad-create-story`. |
| **DEV** (Developer) | `generalist` Sub-Agent | Implements code via `bmad-dev-story`. |
| **Reviewer** | `generalist` Sub-Agent | Reviews/fixes via `bmad-code-review`. |

## Pipeline Steps (Per Story)

### Step 1: Create Story
**Agent:** `generalist`
- **Action:** `activate_skill("bmad-create-story")` then execute for `*story-number`.
- **Goal:** Generate the story file with acceptance criteria and technical tasks.
- **Verification:** Ensure `sprint-status.yaml` status → `ready-for-dev`.

### Step 2: Develop Story
**Agent:** `generalist`
- **Action:** `activate_skill("bmad-dev-story")` then execute for `*story-number`.
- **UI Requirement:** For any UI tasks, use `activate_skill("wds-7-design-system")` or `bmad-agent-ux-designer` to ensure high-quality, distinctive frontend code before implementation.
- **Goal:** Implement code and passing tests.
- **Verification:** Ensure `sprint-status.yaml` status → `review`.

### Step 3: Code Review & Auto-Fix
**Agent:** `generalist`
- **Action:** `activate_skill("bmad-code-review")` then execute for `*story-number`.
- **Constraint:** Must use "Auto-Fix" mode to resolve issues without interruption.
- **Goal:** Validated, convention-compliant code.
- **Verification:** Ensure `sprint-status.yaml` status → `done`.

### Step 4: Verification & Commit
**Agent:** Orchestrator (Main Session)
- **Action:** Run `git status`, verify files, and commit.
- **Message Pattern:** `feat: [*story-number] summary of changes` or `fix: [*story-number] review fixes`.

## Context Management (The "Clean Slate" Rule)

To prevent context exhaustion and hallucinations, **every step MUST be run in a fresh `generalist` call.** 

1. The Orchestrator calls `generalist`.
2. The `generalist` activates the necessary skill, performs the work, and returns a summary.
3. The Orchestrator receives the summary and immediately proceeds to the next delegation.
4. This effectively resets the context for the heavy lifting while the Orchestrator maintains the "long-term memory" of the epic's progress.

## Status Tracking

All agents must update the master status file:
`_bmad-output/implementation-artifacts/sprint-status.yaml`

| Stage | Expected Status |
|-------|-----------------|
| After SM | `ready-for-dev` |
| After DEV | `review` |
| After Review | `done` |

## Orchestrator Execution Prompts

The Orchestrator should use these specific prompts when delegating to the `generalist`.

### SM Delegation
```text
Delegate to generalist: 
"Use 'activate_skill' for 'bmad-create-story'. Create story {story-number}. 
Follow the workflow in its entirety and ensure 'sprint-status.yaml' is updated to 'ready-for-dev'."
```

### DEV Delegation
```text
Delegate to generalist: 
"Use 'activate_skill' for 'bmad-dev-story'. Implement story {story-number}. 
If UI components are needed, use 'wds-7-design-system' first for specifications. 
Ensure tests pass and 'sprint-status.yaml' is updated to 'review'."
```

### Reviewer Delegation
```text
Delegate to generalist: 
"Use 'activate_skill' for 'bmad-code-review'. Perform an adversarial review of {story-number}. 
Apply ALL auto-fixes immediately. Ensure 'sprint-status.yaml' is updated to 'done'."
```

## Recovery Protocol

If a `generalist` sub-agent fails or returns an incomplete summary:
1. **Analyze:** Check `git status` and `sprint-status.yaml` to see how far it got.
2. **Re-delegate:** Call a fresh `generalist` with a "Resume" prompt, specifying the exact remaining tasks.
3. **Verify:** Do not proceed to the next story until the current story is explicitly marked `done` and committed.
