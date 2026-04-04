---
title: 'Planning Chat Input Enhancements'
slug: 'planning-chat-input-enhancements'
created: '2026-04-03'
status: 'ready'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React', 'TypeScript', 'Zustand', 'tRPC', 'xterm.js', 'node-pty']
files_to_modify:
  - 'src/renderer/src/constants/planning-workspace.ts'
  - 'src/renderer/src/constants/slash-commands.ts'
  - 'src/renderer/src/hooks/useAutocomplete.ts'
  - 'src/renderer/src/lib/fuzzy-match.ts (NEW)'
  - 'src/main/trpc/routers/planning.router.ts'
  - 'src/main/trpc/routers/chat-session.router.ts'
  - 'src/main/services/chat-cli.service.ts'
  - 'src/renderer/src/components/planning/AutocompleteDropdown.tsx'
code_patterns:
  - 'tRPC query for data from main process'
  - 'Client-side filtering with React state'
  - 'PTY write via ptyService.write()'
test_patterns:
  - 'No existing tests for autocomplete/slash-commands — add unit tests for fuzzy-match'
---

# Planning Chat Input Enhancements

## Overview

### Problem Statement

The planning workspace chat input has three issues:
1. **Outdated command list** — Only 10 pipeline workflows are registered. Names are stale (e.g., `/bmad-create-product-brief` should be `/bmad-product-brief`). 55 installed skills are missing from autocomplete.
2. **No fuzzy search** — Current `getFilteredCommands()` uses simple `includes()` substring matching. Typing "prd" won't match `/bmad-create-prd` if characters aren't contiguous. Same limitation for `@` file path search.
3. **Newline bug** — Shift+Enter inserts a newline in the textarea, but the message is sent as a single line to Claude Code CLI because the send path intentionally strips newlines (comment: "newlines trigger paste-mode").

### Solution

1. Add a tRPC query that reads the BMAD skill manifest CSV dynamically, so autocomplete always reflects installed skills. Fix the 2 renamed pipeline workflow commands.
2. Implement fzf-style fuzzy matching (character adjacency scoring) for both `/` command and `@` file path autocomplete.
3. Use bracketed paste mode (`\x1b[200~`...`\x1b[201~`) when sending multi-line messages to preserve newlines in the PTY.

### Scope

**In Scope:**
- Fix renamed workflow commands (`/bmad-create-product-brief` → `/bmad-product-brief`, `/bmad-growth-review` → `/growth-hacking-guru`)
- Dynamically load all installed BMAD skills into slash command autocomplete via manifest CSV
- Fuzzy matching for `/` commands (client-side)
- Fuzzy matching for `@` file paths (client-side re-ranking of backend results)
- Bracketed paste for multi-line PTY writes

**Out of Scope:**
- Changes to BMAD skill implementations themselves
- New autocomplete trigger types beyond `/` and `@`
- Chat UI layout/design changes

---

## Investigation Results

### Item 1: Command List — Current vs Correct

**Skill manifest source:** `_bmad/_config/skill-manifest.csv` (53 entries with fields: `canonicalId`, `name`, `description`, `module`, `path`, `install_to_bmad`)

**Plus 2 growth skills in `.claude/skills/` not in manifest:** `growth-hacking-guru-pipeline`, `growth-hacking-setup`

**Renamed commands (delta):**
| Old (hardcoded) | New (actual skill) |
|---|---|
| `/bmad-create-product-brief` | `/bmad-product-brief` |
| `/bmad-growth-review` | `/growth-hacking-guru` |

**Current architecture:**
- `BMAD_WORKFLOWS` in `planning-workspace.ts:46-151` — 10 pipeline workflows with rich metadata (`phase`, `stepNumber`, `persona`, `outputFilename`)
- `BMAD_WORKFLOW_COMMANDS` in `slash-commands.ts:82-87` — maps those 10 into `SlashCommandDefinition[]`
- `SLASH_COMMANDS` in `slash-commands.ts:92` — merges `CLAUDE_CODE_COMMANDS` (34) + `BMAD_WORKFLOW_COMMANDS` (10) = 44 total

**Target architecture:**
- Keep `BMAD_WORKFLOWS` for the 10 pipeline workflows (fix the 2 renamed commands) — these have phase/persona metadata used by the planning dashboard
- Add tRPC query `planning.getSkillManifest` that reads the CSV and returns all skills
- Renderer fetches manifest once, deduplicates against pipeline workflows, merges into autocomplete
- Categories derived from manifest `module` field: `core` → "Utilities", `bmm` → "BMad Workflows", `tea` → "Testing"

### Item 2: Fuzzy Search — Current Implementation

**Current:** `getFilteredCommands()` at `slash-commands.ts:100-106`:
```typescript
const q = query.toLowerCase()
return SLASH_COMMANDS.filter(
  (cmd) => cmd.command.toLowerCase().includes(q) || cmd.label.toLowerCase().includes(q)
)
```
Simple `includes()` — no character skipping, no scoring, no ranking.

**For `@` file paths:** Backend does fuzzy search via `project.searchFiles`, client just displays results as-is. No client-side re-ranking.

**Target:** fzf-style fuzzy matching with scoring:
- Characters must appear in order (not necessarily contiguous)
- Score bonuses: consecutive match (+2), word boundary match (+3), camelCase boundary (+2), exact prefix (+5)
- Score penalties: gap between matches (-1 per char gap)
- Results sorted by score descending
- Apply to both `/` (full client-side) and `@` (re-rank backend results)

### Item 3: Newline Bug — Root Cause

**Renderer side (OK):** `ChatInput.tsx:124` — `value.trim()` preserves internal `\n` characters. Shift+Enter works correctly in the textarea (line 144: only bare Enter triggers submit).

**Router side (STRIPS):** `chat-session.router.ts:955-965`:
```typescript
// IMPORTANT: The message MUST be single-line (no \n). Newlines cause
// Claude's TUI to enter paste/multi-line mode where \r is treated as
// a literal newline rather than as Enter (submit).
let cliMessage = input.content
```
The comment explains why — but this is actually solvable with bracketed paste.

**PTY write side:** `chat-cli.service.ts:780` — `ptyService.write(info.processId, message)` writes raw text, then sends `\r` 300ms later to submit. For multi-line, we need bracketed paste instead.

**Fix:** In `sendMessage()`, detect `\n` in message. If present:
1. Write `\x1b[200~` (start bracketed paste)
2. Write the message (newlines are literal, not interpreted as Enter)
3. Write `\x1b[201~` (end bracketed paste)
4. Write `\r` to submit

Single-line messages keep current behavior (no paste wrapper needed).

---

## Context for Development

- **Electron app** — all PTY/DB operations in main process, React renderer communicates via tRPC
- **Autocomplete state machine** — `useAutocomplete.ts` hook manages trigger detection, filtering, keyboard nav
- **PTY write path** — `chat-cli.service.ts` → `ptyService.write()` → `\r` to submit
- **Slash commands currently** — merged from `CLAUDE_CODE_COMMANDS` (34 CLI cmds) + `BMAD_WORKFLOW_COMMANDS` (10 pipeline workflows mapped from `BMAD_WORKFLOWS`)
- **File autocomplete** — debounced tRPC calls to `project.searchFiles` / `project.listFiles`
- **Skill manifest** — `_bmad/_config/skill-manifest.csv` has all installed BMAD skills with `module` field for categorization
- **No existing tests** for autocomplete or slash-commands modules

---

## Implementation Tasks

### Task 1: Fix Renamed Pipeline Workflow Commands
**File:** `src/renderer/src/constants/planning-workspace.ts`
**Action:** Update 2 entries in `BMAD_WORKFLOWS` array

1. Line 84: Change `command: '/bmad-create-product-brief'` → `command: '/bmad-product-brief'`
2. Line 106: Change `command: '/bmad-growth-review'` → `command: '/growth-hacking-guru'`

**AC:**
- Given the autocomplete is open and user types `/bmad-product`, When results appear, Then `/bmad-product-brief` is listed (not the old name)
- Given the user clicks the Product Brief workflow card, When the command is prefilled, Then it reads `/bmad-product-brief`

---

### Task 2: Add tRPC Query for Skill Manifest
**File:** `src/main/trpc/routers/planning.router.ts` (EXISTS — already has artifact scanning, workflow runs, gate decisions)
**Action:** Add `getSkillManifest` query to the existing planning router

The planning router already exists at `src/main/trpc/routers/planning.router.ts` and imports from `planning-workflow-constants.ts`. Add a new query procedure.

1. Add `getSkillManifest` query that takes `{ projectPath: string }` input
2. Read `{projectPath}/_bmad/_config/skill-manifest.csv`
3. Parse CSV with quoted-field support: extract `canonicalId`, `name`, `description`, `module` columns. Descriptions contain commas inside double-quotes — must respect quoting
4. Also scan `{projectPath}/.claude/skills/` directory names for skills not in manifest (e.g., `growth-hacking-*`) — assign them `module: 'growth'` or derive from directory prefix
5. Return merged, deduplicated array of `{ id: string, name: string, description: string, module: string }`
6. Wrap in try/catch — return `[]` if manifest or directory doesn't exist

**Note:** The manifest CSV does have quoted fields with commas in descriptions (e.g., `"Create or update product briefs through guided or autonomous discovery. Use when..."`). Use proper CSV parsing — split on `,` but respect quoted fields. A simple regex or manual parser suffices (no need for a CSV library).

**AC:**
- Given the project has `_bmad/_config/skill-manifest.csv`, When `planning.getSkillManifest` is called, Then all 55 skills are returned with id, name, description, module
- Given the manifest doesn't exist (non-BMAD project), When the query is called, Then an empty array is returned (no error)
- Given a skill description contains commas inside quotes, When CSV is parsed, Then the description is correctly extracted as one field

---

### Task 3: Create Fuzzy Match Utility
**File:** `src/renderer/src/lib/fuzzy-match.ts` (NEW)
**Action:** Implement fzf-style fuzzy matching function

```typescript
interface FuzzyResult {
  score: number
  matches: number[] // indices of matched characters in the target string
}

function fuzzyMatch(query: string, target: string): FuzzyResult | null
function fuzzyFilter<T>(query: string, items: T[], getText: (item: T) => string): T[]
```

Scoring rules:
- Each matched character: +1
- Consecutive match bonus: +2
- Word boundary match (after `-`, `/`, `.`, space, or camelCase): +3
- Exact prefix match: +5
- Gap penalty: -1 per skipped character between matches
- Return `null` if not all query chars found in order

`fuzzyFilter` wraps `fuzzyMatch`, filters nulls, sorts by score descending.

**AC:**
- Given query "prd", target "/bmad-create-prd", When fuzzyMatch is called, Then score > 0 and matches = indices of 'p','r','d'
- Given query "arch", target "/bmad-create-architecture", When fuzzyMatch is called, Then matches at word boundary "arch" in "architecture" scores higher than scattered matches
- Given query "xyz", target "/bmad-help", When fuzzyMatch is called, Then result is null
- Given query "tea", items include "/bmad-tea" and "/bmad-testarch-atdd", When fuzzyFilter is called, Then "/bmad-tea" ranks first (shorter, exact boundary match)

---

### Task 4: Wire Skill Manifest into Autocomplete
**Files:**
- `src/renderer/src/constants/slash-commands.ts` — update types and merge logic
- `src/renderer/src/hooks/useAutocomplete.ts` — fetch manifest, use fuzzy matching

**Action:**

1. In `slash-commands.ts`:
   - Add new category values: `'skill-core' | 'skill-bmm' | 'skill-tea' | 'skill-growth'`
   - Update `SlashCommandDefinition` category type
   - Replace `getFilteredCommands()` with `fuzzyFilterCommands()` that uses the fuzzy-match utility
   - Export a `mergeManifestSkills(manifest, existingCommands)` function that:
     - Maps manifest entries to `SlashCommandDefinition` (command = `/${id}`, category from module)
     - Deduplicates against existing workflow commands (by command string)
     - Returns merged array

2. In `useAutocomplete.ts`:
   - Fetch skill manifest via `trpc.planning.getSkillManifest.useQuery()` (cached, fetch once)
   - On mount or manifest change, merge manifest skills into the command list
   - Replace `getFilteredCommands('/' + found.query)` with `fuzzyFilterCommands(allCommands, found.query)`
   - For `@` file results, apply `fuzzyFilter()` client-side to re-rank backend results

3. In `AutocompleteDropdown.tsx`:
   - Update category-to-label mapping for new categories
   - Category display names: "Commands", "Planning Workflows", "Utilities", "Testing", "Growth", "Files"

**AC:**
- Given BMAD is installed and manifest has 53 skills, When user types `/` in chat, Then all Claude Code commands + all BMAD skills appear grouped by category
- Given user types `/tea`, When autocomplete shows, Then `/bmad-tea` and testarch skills appear (fuzzy match)
- Given user types `@comp`, When file results return, Then results are re-ranked by fuzzy score (exact prefix "comp" ranks highest)
- Given manifest is empty (no BMAD), When user types `/`, Then only Claude Code commands appear (graceful fallback)

---

### Task 5: Fix Multi-line Message Sending (Bracketed Paste)
**Files:**
- `src/main/services/chat-cli.service.ts` — update `sendMessage()`
- `src/main/trpc/routers/chat-session.router.ts` — remove single-line restriction

**Action:**

1. In `chat-session.router.ts` (lines 955-965):
   - Remove the `// IMPORTANT: The message MUST be single-line` comment
   - Pass `input.content` through as-is (preserve newlines)

2. In `chat-cli.service.ts` `sendMessage()` (lines 758-807):
   - Detect if `message.includes('\n')`
   - If multi-line:
     ```typescript
     // Bracketed paste mode: terminal treats content as literal paste, not commands
     const wrapped = `\x1b[200~${message}\x1b[201~`
     ptyService.write(info.processId, wrapped)
     ```
   - Then submit with `\r` after the usual 300ms delay
   - If single-line: keep existing behavior unchanged
   - Slash command detection (`message.startsWith('/')`) remains single-line only — slash commands with newlines don't make sense

**AC:**
- Given user types "line 1\nline 2" with Shift+Enter, When message is sent to CLI, Then Claude Code receives the full multi-line text as a single input
- Given user types a single-line message, When sent, Then behavior is identical to current (no regression)
- Given user types a slash command `/compact`, When sent, Then Escape+Enter flow is used (no bracketed paste)
- Given user types multi-line with attachments, When sent, Then attachment paths are appended and bracketed paste wraps the full message

---

## Dependency Order

```
Task 1 (fix renamed commands)     — standalone, no deps
Task 3 (fuzzy match utility)      — standalone, no deps
Task 5 (bracketed paste)          — standalone, no deps
Task 2 (tRPC skill manifest)      — standalone, no deps
Task 4 (wire it all together)     — depends on Tasks 1, 2, 3
```

Tasks 1, 2, 3, 5 can be implemented in parallel. Task 4 wires everything together last.

---

## Edge Cases & Risks

1. **Manifest CSV parsing** — Descriptions contain commas inside double-quotes. Must handle quoted CSV fields. Test with actual manifest content.
2. **Duplicate commands** — Pipeline workflow commands (e.g., `/bmad-product-brief`) also appear in the manifest. `mergeManifestSkills` must deduplicate by command string, preferring the pipeline version (richer metadata).
3. **Large dropdown** — 55 skills + 34 CLI commands = ~89 items. The dropdown has `max-h-64` (256px). Fuzzy filtering will naturally reduce visible items, but when query is empty and user just types `/`, consider showing a capped list (e.g., top 20 by category) or keeping the scroll behavior.
4. **Bracketed paste + slash commands** — A message starting with `/` that contains newlines should NOT use bracketed paste. Slash commands are single-line by definition. The `isSlashCommand` check already exists — gate bracketed paste behind `!isSlashCommand && message.includes('\n')`.
5. **Attachment path appending with newlines** — When attachments are present, the `[Attached files: ...]` suffix is appended. Ensure this is appended after the last line, and the entire combined message is wrapped in bracketed paste.
6. **Empty query fuzzy match** — When query is empty string, `fuzzyMatch` should return all items (no filtering). `fuzzyFilter` should return the input array unchanged when query is empty.
