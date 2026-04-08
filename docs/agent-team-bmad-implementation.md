# Agent Team: BMAD Implementation Pipeline

This document defines the automated agent team workflow for implementing epics story-by-story.

## Team Composition

| Agent | Model | Role |
|-------|-------|------|
| **SM** (Scrum Master) | Opus 4.6 | Creates stories from epic backlog |
| **DEV 1** (Developer) | Opus 4.6 | Implements story code |
| **DEV 2** (Reviewer) | Sonnet 4.6 | Reviews code and auto-fixes issues |

## Pipeline Steps (per story)

### Step 1: Create Story
**Agent:** SM (Opus 4.6)
```
/bmad-create-story *story-number
```
- Generates the story file with acceptance criteria, tasks, and technical details
- Output: Story file ready for development
- **Status update:** `sprint-status.yaml` story status → `ready-for-dev`

### Step 2: Develop Story
**Agent:** DEV 1 (Opus 4.6)
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
- Commit message references the story number

### Step 5: Repeat
- Move to the next story number and repeat from Step 1
- Continue until all stories in the epic are complete

## Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│                   For each story:                             │
│                                                              │
│  SM (Opus 4.6)                                                │
│  └─► /bmad-create-story *N                                   │
│       status: backlog → ready-for-dev                        │
│       │                                                      │
│       ▼                                                      │
│  DEV 1 (Opus 4.6)                                             │
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

### SM Agent Prompt
```
You are Agent SM (Scrum Master) in the BMAD implementation pipeline.

Before starting, read these two files for context:
1. {project-root}/agent-team-bmad-implementation.md
2. {project-root}/CLAUDE.md

Your ONLY task: Use the Skill tool to run /bmad-bmm-create-story {story-number}

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

After completion, verify that sprint-status.yaml shows the story as "review".
Report back what files were created/modified and confirm the status update.
```

### DEV 2 Agent Prompt
```
You are Agent DEV 2 (Code Reviewer) in the BMAD implementation pipeline.

Before starting, read these two files for context:
1. {project-root}/agent-team-bmad-implementation.md
2. {project-root}/CLAUDE.md

Your ONLY task: Use the Skill tool to run /bmad-code-review {story-number}

You MUST use the Skill tool to invoke this command. Do NOT attempt to review the code
manually or read files directly. The Skill tool will load the full BMAD workflow which
you must follow step by step — including status updates in sprint-status.yaml.

When the review workflow presents fix options, choose option 1 (fix automatically).

After completion, verify that sprint-status.yaml shows the story as "done".
Report back what issues were found, what was fixed, and confirm the status update.
```

## Important Notes

- Each agent must load this file and CLAUDE.md into context before starting work
- Stories are processed sequentially — each story must complete all 4 steps before the next begins
- The pipeline runs continuously until all stories in the epic are implemented
- **Agents must NOT carry context between stories** — always reset after completing a step
