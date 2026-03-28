---
name: growth-hacking-setup
description: Sets up Growth Hacking module in a project. Use when the user requests to 'install growth module', 'configure growth hacking', or 'setup growth hacking'.
---

# Module Setup

## Overview

Installs and configures the Growth Hacking module into a project. Module identity (name, code, version) comes from `./assets/module.yaml`. Collects user preferences and writes them to three files:

- **`{project-root}/_bmad/config.yaml`** — shared project config: core settings at root plus a section per module with metadata and module-specific values. User-only keys (`user_name`, `communication_language`) are **never** written here.
- **`{project-root}/_bmad/config.user.yaml`** — personal settings intended to be gitignored: `user_name`, `communication_language`, and any module variable marked `user_setting: true` in `./assets/module.yaml`. These values live exclusively here.
- **`{project-root}/_bmad/module-help.csv`** — registers module capabilities for the help system.

Both config scripts use an anti-zombie pattern — existing entries for this module are removed before writing fresh ones, so stale values never persist.

`{project-root}` is a **literal token** in config values — never substitute it with an actual path. It signals to the consuming LLM that the value is relative to the project root, not the skill root.

## On Activation

1. Read `./assets/module.yaml` for module metadata and variable definitions (the `code` field is the module identifier)
2. Check if `{project-root}/_bmad/config.yaml` exists — if a section matching the module's code is already present, inform the user this is an update
3. Check for per-module configuration at `{project-root}/_bmad/{module-code}/config.yaml` and `{project-root}/_bmad/core/config.yaml`. If either file exists:
   - If `{project-root}/_bmad/config.yaml` does **not** yet have a section for this module: this is a **fresh install**. Inform the user that installer config was detected and values will be consolidated into the new format.
   - If `{project-root}/_bmad/config.yaml` **already** has a section for this module: this is a **legacy migration**. Inform the user that legacy per-module config was found alongside existing config, and legacy values will be used as fallback defaults.
   - In both cases, per-module config files and directories will be cleaned up after setup.

If the user provides arguments (e.g. `accept all defaults`, `--headless`, or inline values like `user name is BMad, I speak Swahili`), map any provided values to config keys, use defaults for the rest, and skip interactive prompting. Still display the full confirmation summary at the end.

## Collect Configuration

Ask the user for values. Show defaults in brackets. Present all values together so the user can respond once with only the values they want to change (e.g. "change output to _growth-output, rest are fine"). Never tell the user to "press enter" or "leave blank" — in a chat interface they must type something to respond.

**Default priority** (highest wins): existing new config values > legacy config values > `./assets/module.yaml` defaults. When legacy configs exist, read them and use matching values as defaults instead of `module.yaml` defaults. Only keys that match the current schema are carried forward — changed or removed keys are ignored.

**Core config** (only if no core keys exist yet): `user_name` (default: BMad), `communication_language` and `document_output_language` (default: English — ask as a single language question, both keys get the same answer), `output_folder` (default: `{project-root}/_bmad-output`). Of these, `user_name` and `communication_language` are written exclusively to `config.user.yaml`. The rest go to `config.yaml` at root and are shared across all modules.

**Module config**: Read each variable in `./assets/module.yaml` that has a `prompt` field. Ask using that prompt with its default value (or legacy value if available).

## Write Files

Write a temp JSON file with the collected answers structured as `{"core": {...}, "module": {...}}` (omit `core` if it already exists). Then run both scripts — they can run in parallel since they write to different files:

```bash
python3 ./scripts/merge-config.py --config-path "{project-root}/_bmad/config.yaml" --user-config-path "{project-root}/_bmad/config.user.yaml" --module-yaml ./assets/module.yaml --answers {temp-file} --legacy-dir "{project-root}/_bmad"
python3 ./scripts/merge-help-csv.py --target "{project-root}/_bmad/module-help.csv" --source ./assets/module-help.csv --legacy-dir "{project-root}/_bmad" --module-code {module-code}
```

Both scripts output JSON to stdout with results. If either exits non-zero, surface the error and stop. The scripts automatically read legacy config values as fallback defaults, then delete the legacy files after a successful merge. Check `legacy_configs_deleted` and `legacy_csvs_deleted` in the output to confirm cleanup.

## Create Output Directories

After writing config, create any output directories that were configured. For filesystem operations only (such as creating directories), resolve the `{project-root}` token to the actual project root and create each path-type value from `config.yaml` that does not yet exist — this includes `output_folder` and any module variable whose value starts with `{project-root}/`. Use `mkdir -p` or equivalent to create the full path.

## Install Bundled Skills

After writing config, copy bundled skills from `./assets/skills/` to their target locations. The module bundles all required skills so it's a single-folder install.

**Project-level skills** — copy to `{project-root}/.claude/skills/`:
```
./assets/skills/bmad-agent-growth-guru/  → {project-root}/.claude/skills/bmad-agent-growth-guru/
./assets/skills/bmad-growth-review/      → {project-root}/.claude/skills/bmad-growth-review/
./assets/skills/growth-hacking-guru-pipeline/ → {project-root}/.claude/skills/growth-hacking-guru-pipeline/
```

**Global skills** — copy to `~/.claude/skills/` (user's home, available across all projects):
```
./assets/skills/growth-hacking-guru/          → ~/.claude/skills/growth-hacking-guru/
./assets/skills/growth-hacking-guru-pipeline/ → ~/.claude/skills/growth-hacking-guru-pipeline/
```

Also copy the pipeline skill to the project root for subagent access:
```
./assets/skills/growth-hacking-guru-pipeline/ → {project-root}/growth-hacking-guru-pipeline/
```

Use `cp -r` and only overwrite if the source is newer or the target doesn't exist. Report which skills were installed or updated.

## Cleanup Legacy Directories

After both merge scripts complete successfully, remove the installer's package directories if they exist.

```bash
python3 ./scripts/cleanup-legacy.py --bmad-dir "{project-root}/_bmad" --module-code {module-code} --skills-dir "{project-root}/.claude/skills"
```

The script verifies that every skill in the legacy directories exists at `.claude/skills/` before removing anything. If the script exits non-zero, surface the error and stop. Missing directories (already cleaned by a prior run) are not errors — the script is idempotent.

## Confirm

Use the script JSON output to display what was written — config values set, help entries added, fresh install vs update. If legacy files were deleted, mention the migration. Then display the `module_greeting` from `./assets/module.yaml` to the user.

## Outcome

Once the user's `user_name` and `communication_language` are known (from collected input, arguments, or existing config), use them consistently for the remainder of the session.
