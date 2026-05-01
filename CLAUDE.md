When creating any story involving React components, UI styling, or visual elements, the story will include that bold note:

  🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.
- run (npm run rebuild:electron) after each db changes
- whenever update schema, update  migration in db/index.ts
- When PM agent run correct course session Update sprint-status.yaml to reflect approved epic changes
- when doing codebase exploring, or any sub agents, use model Haiku with very detailed instructions so they can do great job
- we ported to src-tauri Tauri app
- Android dev build uses Tailscale: TAURI_DEV_HOST is set in .env (gitignored), loaded by android:dev script via `--host $TAURI_DEV_HOST`
- Mobile UI lives in `src/mobile/`. Do not add `useIsMobile()` branches to desktop components — mobile and desktop are separate trees rendered conditionally at `App.tsx` (Epic 3.5, sprint-change-proposal-2026-04-30.md). Reuse Rust backend, Zustand domain stores, rspc hooks, Calm Command tokens.

## Task Delegation

Spawn subagents to isolate context, parallelize independent work, or offload bulk mechanical tasks. Don't spawn when the parent needs the reasoning, when synthesis requires holding things together, or when spawn overhead dominates.

Pick the cheapest model that can do the subtask well:
- Haiku: bulk mechanical work, no judgment
- Sonnet: scoped research, code exploration, in-scope synthesis
- Opus: subtasks needing real planning or tradeoffs

Subagents follow the same rules recursively, with two caps:
- Haiku does not spawn further subagents. If it needs to, the task was wrong-sized for Haiku — return to the parent.
- Maximum spawn depth is 2 (parent → subagent → one further tier).

Don't escalate tiers without a concrete reason. If a subagent realizes it needs a higher tier than itself, return to the parent rather than spawning up.

Parent owns final output and cross-spawn synthesis. User instructions override.

## Preferred Tools

### Data Fetching

1. **WebFetch** — free, text-only, works on public pages that don't block bots.
2. **agent-browser CLI** — free, local Rust CLI + Chrome via CDP. For dynamic pages or auth walls that WebFetch can't handle. Returns the accessibility tree with element refs (
@e1
, 
@e2
) — ~82% fewer tokens than screenshot-based tools. Install: `npm i -g agent-browser && agent-browser install`. Use `snapshot` for AI-friendly DOM state, element refs for interaction.
3. **Notice recurring fetch patterns and propose wrapping them as dedicated tools.** When the same fetch/parse logic comes up more than once, suggest wrapping it as a named tool (e.g. a skill file or a .py script that calls `agent-browser` with the snapshot and extraction steps baked in for that source). Add the entry to `## Dedicated Tools` below and reference it by name on future calls.

### PDF Files

Use 'pdftotext', not the 'Read' tool. Use 'Read' only when the user directly asks to analyze images or charts inside the document.

## Dedicated Tools

<!-- List project-specific tools here. For each, link to its skill or script file (e.g. `tools/reddit_fetch.py`). The orchestration logic lives in those files, not here. -->