# BMAD Framework Installation Feature

**Date:** 2026-03-22
**Status:** Draft

## Problem

When TinSu opens a project that doesn't have BMAD installed, the planning workspace fails because `PersonaContextService` tries to read `_bmad/bmm/agents/*.md` files that don't exist. The error:

```
ENOENT: no such file or directory, open '<projectPath>/_bmad/bmm/agents/pm.md'
```

Users need a way to install BMAD into their projects directly from TinSu's UI — both during new project creation and from project settings.

## Solution

Integrate `npx bmad-method install` into TinSu via a UI form that collects installer options and invokes the CLI non-interactively using its documented flags. A progress spinner with status messages provides feedback during installation.

### Prerequisites

The BMAD installer requires Node.js/npx on the system PATH. TinSu detects whether Node.js is available and offers to install it if missing.

## Architecture

### 1. BmadInstallService (`src/main/services/bmad-install.service.ts`)

Handles Node.js detection, BMAD status checking, and CLI invocation.

#### Node.js Detection & Installation

- `checkNodejs(): Promise<{ installed: boolean, version: string | null }>` — runs `node --version` via `child_process.exec`
- `installNodejs(): Promise<{ success: boolean, error?: string }>` — detects OS via `process.platform` and attempts installation:
  - **Linux:** opens the default terminal emulator (`x-terminal-emulator` or `gnome-terminal`) running `curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs`
  - **macOS:** opens Terminal.app running `brew install node` (checks for brew first; if not found, suggests nvm)
  - **Windows:** uses Electron's `shell.openExternal()` to open the Node.js download page at `https://nodejs.org/en/download/`
  - After the external terminal/browser action completes, the user clicks a "Verify Installation" button which re-runs `checkNodejs()` to confirm
  - **Fallback:** if auto-install fails or the platform is unsupported, show a message: "Please install Node.js from https://nodejs.org" with a clickable link via `shell.openExternal()`

#### BMAD Status Check

- `checkBmadStatus(projectPath: string): Promise<BmadStatus>` — two-tier check:
  1. **Filesystem check:** verifies `_bmad/` directory exists. If not, returns `{ installed: false }`
  2. **CLI check:** if `_bmad/` exists, runs `npx --yes bmad-method status` (confirmed working — outputs version, location, and module versions in a structured format) from the project directory to get version and module info. Parses the CLI output for version string and module list.
  3. **Fallback:** if CLI check fails (network issues, etc.), parses `_bmad/bmm/config.yaml` directly for basic status info
- Returns: `{ installed: boolean, version?: string, modules?: string[], tools?: string[] }`

**Verified CLI output format:**
```
◇  BMAD Status
│  Version:       6.2.0
│  Location:      /path/to/_bmad
│  Installed:     3/21/2026
◇  Module Versions
│  Built-in Modules
│    core                 6.2.0 ✓
│    bmm                  6.2.0 ✓
│  External Modules (Official)
│    bmb                  1.1.0 ✓
│    cis                  0.1.9 ✓
│    tea                  1.7.1 ✓
│    wds                  0.3.0 ✓
```

#### BMAD Installation

- `installBmad(projectPath: string, options: BmadInstallOptions): Promise<{ success: boolean, error?: string }>` — constructs and runs:
  ```
  npx --yes bmad-method install \
    --directory <projectPath> \
    --modules <comma-separated> \
    --tools <comma-separated> \
    --user-name <name> \
    --communication-language <lang> \
    --document-output-language <lang> \
    --output-folder <path> \
    --yes
  ```
- Spawns via `child_process.spawn`, parses stdout for progress events
- 120-second timeout; kills process if exceeded
- If the user closes the dialog or clicks Cancel during installation, the spawned child process is killed via `process.kill()`. A partial install can be re-run from Settings.

#### BMAD Update

- `updateBmad(projectPath: string, options: BmadInstallOptions): Promise<{ success: boolean, error?: string }>` — same as install but with `--action update`

#### Types

```typescript
interface BmadInstallOptions {
  modules: string[]       // e.g., ['bmm', 'cis', 'tea']
  tools: string[]         // e.g., ['claude-code', 'cursor']
  userName: string
  communicationLanguage: string
  documentOutputLanguage: string
  outputFolder: string    // default: '_bmad-output'
}

interface BmadStatus {
  installed: boolean
  version?: string
  modules?: string[]
  tools?: string[]
}

/** Canonical ordered list of available BMAD modules */
const BMAD_MODULES = [
  { id: 'core', name: 'Core Framework', builtIn: true },
  { id: 'bmm', name: 'Core Method', builtIn: true },
  { id: 'bmb', name: 'Build', builtIn: false },
  { id: 'cis', name: 'Creative Innovation Skills', builtIn: false },
  { id: 'tea', name: 'Test Engineering Architecture', builtIn: false },
  { id: 'wds', name: 'Web Design System', builtIn: false },
] as const
```

### 2. tRPC Router (`src/main/trpc/routers/bmad.router.ts`)

New router merged into the app router via `src/main/trpc/index.ts`.

**Queries:**
- `bmad.checkNodejs` — returns `{ installed: boolean, version: string | null }`
- `bmad.checkStatus` — uses `ProjectService.getCurrentProject()` for project path (consistent with existing codebase pattern), returns `BmadStatus`
- `bmad.availableModules` — returns the `BMAD_MODULES` list

**Mutations:**
- `bmad.installNodejs` — returns `{ success: boolean, error?: string }`
- `bmad.install` — input: `BmadInstallOptions` (project path from `ProjectService.getCurrentProject()`), returns `{ success: boolean, error?: string }`
- `bmad.installToPath` — input: `{ projectPath: string } & BmadInstallOptions` — used by New Project Dialog before the project is registered as "current". Returns `{ success: boolean, error?: string }`
- `bmad.update` — input: `BmadInstallOptions`, uses current project path, runs with `--action update`

### 3. New Project Dialog (`src/renderer/src/components/NewProjectDialog.tsx`)

Modified to include BMAD setup as a default part of project creation.

**Layout additions (after existing Location section):**
- Divider
- **"Initialize BMAD Framework"** checkbox — **checked by default**
- When checked, collapsible panel shows:
  - **User Name** — text input, defaults to system username
  - **Modules** — checkbox list (`bmm` and `core` checked by default):
    - `core` (Core Framework), `bmm` (Core Method), `bmb` (Build), `cis` (Creative Innovation), `tea` (Test Engineering), `wds` (Web Design)
  - **Tools / IDE** — checkbox list: `claude-code`, `cursor`, etc.
  - **Language** — dropdown, defaults to English
- Dialog scrolls if content overflows

**Creation flow (mutation chaining):**
The `handleCreate` function is rewritten to chain two async mutations:
1. `await createMutation.mutateAsync({ parentDir, projectName })` — creates folder, git init, .tinsu setup
2. If BMAD checkbox is checked → `await bmadInstallMutation.mutateAsync({ projectPath: result.path, ...bmadOptions })` using `bmad.installToPath` (since the project isn't "current" yet)
3. Success → `onProjectCreated(result)` fires, dialog closes
4. BMAD failure → error shown in BMAD section; `onProjectCreated` still fires (project is usable without BMAD), toast suggests retrying from Settings

**Cancel behavior:** If the user closes the dialog during BMAD installation, the mutation's AbortController cancels the request. The backend kills the spawned child process.

**Node.js check:** On dialog open, `bmad.checkNodejs` runs. If missing, BMAD section shows warning + "Install Node.js" button instead of the form.

**UI implementation:** Uses `/frontend-design` skill for all visual components.

### 4. Settings Dialog (`src/renderer/src/components/dialogs/SettingsDialog.tsx`)

New `BmadSettingsPanel` component added between `AgentSettingsPanel` and `GitLogsPanel`.

**Project path:** `BmadSettingsPanel` calls `trpc.project.getCurrent.useQuery()` to get the current project info (consistent with how other settings panels obtain project context). The `bmad.checkStatus` and `bmad.install` endpoints use `ProjectService.getCurrentProject()` internally.

**When BMAD is NOT installed:**
- Status badge: "Not Installed"
- Same form as New Project Dialog's BMAD section (modules, tools, user name, language)
- "Install BMAD" button
- Spinner + status text during installation
- Cancel button appears during installation to abort

**When BMAD IS installed:**
- Status badge: "Installed v6.2.0"
- Installed modules shown as tags/chips
- Configured tools shown as tags/chips
- All fields pre-filled from current config.yaml, editable
- "Update BMAD" button — runs `--action update` with changed options
- Displays `user_name`, `communication_language`, `document_output_language`

**Node.js check:** Same pattern — if missing, show warning + install button.

**UI implementation:** Uses `/frontend-design` skill for all visual components.

### 5. Config Compatibility

The BMAD installer generates `_bmad/bmm/config.yaml` which includes all fields required by `PersonaContextService`:
- `project_name` — set from the project directory name by the installer
- `user_name` — from the `--user-name` flag
- `planning_artifacts` — derived from `--output-folder` (defaults to `{project-root}/_bmad-output/planning-artifacts`)
- `output_folder` — from the `--output-folder` flag
- `communication_language` — from the `--communication-language` flag
- `document_output_language` — from the `--document-output-language` flag (not currently read by `PersonaContextService` but stored in config for future use)

No changes needed to `PersonaContextService` or its `BmadProjectConfig` interface — the installer's generated config is fully compatible.

### 6. Error Handling

**Node.js installation:**
- If auto-install fails (permissions, unsupported OS), fall back to showing a link to nodejs.org with manual instructions via `shell.openExternal()`
- After install attempt, user clicks "Verify Installation" button which re-runs `checkNodejs` to confirm

**BMAD installation failures:**
- Network errors → "Unable to download BMAD. Check your internet connection" + retry button
- Permission errors → display CLI error message
- Partial install (process killed) → `checkStatus` detects incomplete state, Settings shows Install button for re-run

**New Project Dialog failures:**
- Project creation succeeds but BMAD install fails → project still created and opened
- Toast notification: "BMAD setup failed — retry from Settings"
- Planning workspace features show: "BMAD not installed. Go to Settings to set up."

**Cancellation:**
- Cancel button visible during installation phase
- Closing dialog during install kills the child process
- Partial installs are safe to re-run

**Version conflicts:**
- Manual `bmad-method install` outside TinSu → Settings panel picks up current state via `checkStatus`

**Timeout:**
- 120-second timeout on CLI process; show timeout error with retry option

## Files Changed

| File | Change |
|------|--------|
| `src/main/services/bmad-install.service.ts` | **New** — Node.js detection, BMAD status/install/update |
| `src/main/services/bmad-install.service.test.ts` | **New** — Unit tests |
| `src/main/trpc/routers/bmad.router.ts` | **New** — tRPC endpoints |
| `src/main/trpc/routers/bmad.router.test.ts` | **New** — Router tests |
| `src/main/trpc/index.ts` | **Modified** — merge bmad router into appRouter |
| `src/renderer/src/components/NewProjectDialog.tsx` | **Modified** — add BMAD setup section |
| `src/renderer/src/components/NewProjectDialog.test.tsx` | **Modified** — update tests |
| `src/renderer/src/components/settings/BmadSettingsPanel.tsx` | **New** — BMAD config panel |
| `src/renderer/src/components/settings/BmadSettingsPanel.test.tsx` | **New** — Panel tests |
| `src/renderer/src/components/dialogs/SettingsDialog.tsx` | **Modified** — include BmadSettingsPanel |
