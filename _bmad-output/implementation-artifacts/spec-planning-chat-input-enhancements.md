---
title: 'Planning Chat Input Enhancements'
type: 'feature'
created: '2026-04-03'
status: 'done'
baseline_commit: '52e4bdfd'
context:
  - '_bmad/_config/skill-manifest.csv'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The planning chat autocomplete is stale (10 workflows hardcoded, 2 with wrong names, 55 installed skills missing), uses substring matching instead of fuzzy search, and Shift+Enter newlines are silently stripped because the PTY send path avoids paste mode.

**Approach:** Fix the 2 renamed commands, add a tRPC query to dynamically load the BMAD skill manifest CSV, implement fzf-style fuzzy matching for both `/` and `@` autocomplete, and use bracketed paste mode (`\x1b[200~…\x1b[201~`) to preserve newlines in multi-line messages.

## Boundaries & Constraints

**Always:**
- Keep existing `BMAD_WORKFLOWS` array for pipeline workflows (phase/persona metadata used by dashboard)
- Deduplicate manifest skills against pipeline workflow commands — prefer pipeline version (richer metadata)
- Single-line messages must behave identically to current (no regression)
- Slash commands (`/`-prefixed) never use bracketed paste

**Ask First:**
- Adding a CSV parsing library (a manual parser should suffice)
- Capping the autocomplete dropdown item count when query is empty

**Never:**
- Modify BMAD skill implementations
- Add new autocomplete trigger types beyond `/` and `@`
- Change chat UI layout or design

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fuzzy match hit | query `"prd"`, target `"/bmad-create-prd"` | Match with score > 0, chars in order | N/A |
| Fuzzy match miss | query `"xyz"`, target `"/bmad-help"` | `null` (no match) | Filtered out |
| Empty query | query `""` | All items returned unfiltered | N/A |
| CSV quoted field | `"Create or update briefs, through guided..."` | Description extracted as single field | N/A |
| Missing manifest | No `_bmad/_config/skill-manifest.csv` | Empty array returned, only CLI commands show | No error thrown |
| Multi-line msg | `"line 1\nline 2"` | Wrapped in `\x1b[200~…\x1b[201~` + `\r` | N/A |
| Single-line msg | `"hello"` | Written directly + `\r` (current behavior) | N/A |
| Slash cmd with newline | `"/compact\nfoo"` | Treated as slash command — no bracketed paste | N/A |
| Multi-line + attachments | `"text\nmore" + [file.ts]` | Attachment suffix appended, full message bracketed-paste wrapped | N/A |

</frozen-after-approval>

## Code Map

- `src/renderer/src/constants/planning-workspace.ts` -- `BMAD_WORKFLOWS` array with 10 pipeline workflows (2 have stale command names)
- `src/renderer/src/constants/slash-commands.ts` -- `getFilteredCommands()` with `includes()` matching, `SLASH_COMMANDS` merge
- `src/renderer/src/hooks/useAutocomplete.ts` -- autocomplete state machine, fetches file paths, calls `getFilteredCommands`
- `src/renderer/src/components/planning/AutocompleteDropdown.tsx` -- dropdown UI with category grouping
- `src/renderer/src/lib/fuzzy-match.ts` (NEW) -- fzf-style fuzzy matching utility
- `src/main/trpc/routers/planning.router.ts` -- planning router (add `getSkillManifest` query)
- `src/main/trpc/routers/chat-session.router.ts:955-965` -- single-line restriction comment + message build
- `src/main/services/chat-cli.service.ts:774-797` -- `sendMessage()` PTY write + submit logic

## Tasks & Acceptance

**Execution:**
- [x] `src/renderer/src/constants/planning-workspace.ts` -- Fix 2 renamed commands: line 84 `/bmad-create-product-brief` → `/bmad-product-brief`, line 106 `/bmad-growth-review` → `/growth-hacking-guru`
- [x] `src/main/trpc/routers/planning.router.ts` -- Add `getSkillManifest` query: read `_bmad/_config/skill-manifest.csv`, parse with quoted-field support, scan `.claude/skills/` for extras, return deduplicated `{id, name, description, module}[]`
- [x] `src/renderer/src/lib/fuzzy-match.ts` (NEW) -- Create `fuzzyMatch(query, target)` and `fuzzyFilter(query, items, getText)` with scoring: +1 per char, +2 consecutive, +3 word boundary, +5 exact prefix, -1 gap penalty
- [x] `src/renderer/src/constants/slash-commands.ts` + `src/renderer/src/hooks/useAutocomplete.ts` + `src/renderer/src/components/planning/AutocompleteDropdown.tsx` -- Wire manifest into autocomplete: fetch via tRPC, merge/deduplicate skills, replace `getFilteredCommands` with `fuzzyFilterCommands`, add skill categories, re-rank `@` file results client-side
- [x] `src/main/trpc/routers/chat-session.router.ts` + `src/main/services/chat-cli.service.ts` -- Remove single-line restriction, detect `\n` in message, wrap multi-line non-slash messages in bracketed paste (`\x1b[200~…\x1b[201~`) before PTY write

**Acceptance Criteria:**
- Given user types `/bmad-product` in chat, when autocomplete appears, then `/bmad-product-brief` is listed
- Given BMAD is installed with 53 manifest skills, when user types `/` in chat, then all CLI commands + all BMAD skills appear grouped by category
- Given user types `/tea`, when autocomplete shows, then `/bmad-tea` and testarch skills appear via fuzzy match
- Given user types `@comp`, when file results return, then results are re-ranked by fuzzy score
- Given manifest doesn't exist, when user types `/`, then only Claude Code commands appear
- Given user sends "line 1\nline 2" via Shift+Enter, when message reaches CLI, then Claude Code receives multi-line text as single input
- Given user sends single-line message, then behavior is identical to current
- Given user sends `/compact`, then Escape+Enter flow is used (no bracketed paste)

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors
- `npm run lint` -- expected: no lint errors

**Manual checks:**
- Type `/prd` in planning chat and verify fuzzy match returns `/bmad-create-prd`
- Type a multi-line message with Shift+Enter and verify Claude Code receives it with newlines preserved
- Open autocomplete with `/` and verify BMAD skills from manifest appear in categorized groups

## Suggested Review Order

**Fuzzy match engine**

- Core algorithm: greedy char-order matching with boundary/consecutive scoring
  [`fuzzy-match.ts:17`](../../src/renderer/src/lib/fuzzy-match.ts#L17)

**Command system overhaul**

- Renamed 2 stale pipeline workflow commands to match actual skill names
  [`planning-workspace.ts:84`](../../src/renderer/src/constants/planning-workspace.ts#L84)

- New category type union and `mergeManifestSkills` dedup logic
  [`slash-commands.ts:10`](../../src/renderer/src/constants/slash-commands.ts#L10)

- Replaced `getFilteredCommands` with `fuzzyFilterCommands` using the new engine
  [`slash-commands.ts:108`](../../src/renderer/src/constants/slash-commands.ts#L108)

**Dynamic skill manifest loading**

- CSV parser with quoted-field support and CRLF handling
  [`planning.router.ts:56`](../../src/main/trpc/routers/planning.router.ts#L56)

- `getSkillManifest` query: reads manifest CSV + scans `.claude/skills/`
  [`planning.router.ts:656`](../../src/main/trpc/routers/planning.router.ts#L656)

**Autocomplete wiring**

- Fetches manifest via tRPC, merges into `allCommands`, uses fuzzy filtering
  [`useAutocomplete.ts:140`](../../src/renderer/src/hooks/useAutocomplete.ts#L140)

- Re-ranks `@` file results client-side by fuzzy score
  [`useAutocomplete.ts:182`](../../src/renderer/src/hooks/useAutocomplete.ts#L182)

- Category label mapping for new skill categories
  [`useAutocomplete.ts:53`](../../src/renderer/src/hooks/useAutocomplete.ts#L53)

**Multi-line message fix**

- Removed single-line restriction comment, passes newlines through
  [`chat-session.router.ts:956`](../../src/main/trpc/routers/chat-session.router.ts#L956)

- Bracketed paste wrapping with ESC sanitization for multi-line PTY writes
  [`chat-cli.service.ts:779`](../../src/main/services/chat-cli.service.ts#L779)
