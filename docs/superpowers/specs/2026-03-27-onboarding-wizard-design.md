# Onboarding Wizard for Existing Projects

**Date:** 2026-03-27
**Status:** Approved

## Problem

When opening an existing project for the first time on a new machine (e.g., cloned from git), TinSu has no verification that required tools are installed. Users hit silent failures — tmux sessions won't create, Claude CLI won't spawn, BMAD commands fail — with no clear guidance on what's missing or how to fix it.

## Solution

Evolve the existing `NewProjectDialog` into a stepper-based `ProjectSetupDialog` that handles both project creation and existing-project onboarding. Add a `ToolVerificationService` that checks all required tools and reports status. Trigger the wizard on first open and automatically when critical tools go missing.

## Tool Verification

### Tools Checked

| Tool | Check Method | Critical | Install Action |
|------|-------------|----------|----------------|
| git | `git --version` via exec | Yes | Platform-specific install instructions (text) |
| tmux | `TmuxService.checkTmuxInstalled()` (existing) | Yes | Platform-specific install instructions (reuse `TmuxService.getInstallInstructions()`) |
| Node.js | `BmadInstallService.checkNodejs()` (existing) | Yes | Reuse existing `BmadInstallService.installNodejs()` |
| Claude Code CLI | `claude --version` via exec | Yes | Show install command: `npm install -g @anthropic-ai/claude-code` |
| BMAD | `BmadInstallService.checkBmadStatus()` (existing) | Yes | Inline config form with Install button |
| Project IDE tools | Read from BMAD config → check binaries on PATH | No | Show name of missing tool (skippable) |

Critical tools block the user from proceeding into the workspace. IDE tools are informational only.

### BMAD Detection for Existing Projects

When onboarding an existing project, the wizard attempts to detect the previous BMAD configuration:

1. **Try:** Read existing `_bmad/` directory contents and `_bmad/bmm/config.yaml` to extract modules, tools, and language settings.
2. **If detected:** Pre-populate the BMAD config form with the detected settings. Show as "needs install/restore" with an Install button.
3. **If not detected:** Show the full fresh BMAD config form (same as create mode).

### Shared Types

```typescript
// src/shared/types/tool-verification.types.ts

interface ToolCheckResult {
  id: string           // 'git' | 'tmux' | 'nodejs' | 'claude-cli' | 'bmad' | string
  name: string         // Display name
  status: 'installed' | 'missing' | 'error' // 'checking' is frontend-only UI state, not returned by backend
  version?: string
  critical: boolean
  installHint?: string // Platform-specific install instructions
}
```

## Stepper-based ProjectSetupDialog

The existing `NewProjectDialog` is renamed and refactored into `ProjectSetupDialog` with two modes.

### Props

```typescript
interface ProjectSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (info: { path: string; projectName: string }) => void
  mode: 'create' | 'onboard'
  projectPath?: string // Required for onboard mode
}
```

### Create Mode (existing flow, improved)

- **Step 1: Project Basics** — Project name, parent directory, path preview (unchanged from current `NewProjectDialog`)
- **Step 2: Tool Verification & Setup** — Runs all tool checks, shows BMAD config form, blocks on critical tools

### Onboard Mode (new flow)

- Skips Step 1 (project path already known)
- Goes straight to **Step 2: Tool Verification & Setup**

### Step 2 Layout

A vertical checklist showing each tool with its status:

- **Green checkmark** = installed (with version number)
- **Red X** = missing, with an "Install" action button where possible
- **Spinner** = currently checking or installing
- Critical tools show a lock icon

The "Continue" button stays disabled until all critical tools pass. A "Re-check" button lets users manually re-run verification after installing something externally (e.g., via their terminal).

### Component Tree

```
ProjectSetupDialog
├── Step 1: ProjectBasicsStep (create mode only)
│   └── name, directory, path preview (existing code extracted here)
└── Step 2: ToolVerificationStep (both modes)
    ├── ToolCheckList (status rows for each tool)
    ├── BmadConfigForm (extracted from current dialog, reusable)
    └── Action buttons (Re-check, Continue)
```

### Extracted Components

- **`BmadConfigForm`** — The BMAD configuration form (user name, modules, tools, language) extracted from the current `NewProjectDialog`. Shared between `ToolVerificationStep` and the existing `BmadSettingsPanel`.
- **`ToolCheckList`** — Renders the vertical list of `ToolCheckResult` items with status icons and install actions.
- **`ProjectBasicsStep`** — The project name/directory form, extracted from current dialog.

## Trigger Points

### 1. First Open on This Machine

When `ProjectService.openProject()` runs, it checks if the project exists in the local database via `registerOrUpdateProject()`. If no existing row is found, this is the first time this machine has opened this project.

- `openProject()` returns `needsOnboarding: true` in the `ProjectInfo` response.
- The renderer (in `App.tsx`) intercepts this flag and shows `ProjectSetupDialog` in `mode="onboard"` instead of entering the workspace.

### 2. Critical Tool Goes Missing During Use

Two detection layers:

**Background health check:**
- Runs `project.checkToolHealth` (critical tools only) on window focus and project switch.
- If any critical tool fails, the onboard dialog opens automatically.
- Lightweight — only checks binary availability, no version parsing.

**Point-of-failure intercept:**
- When a service call fails because a tool is missing (e.g., tmux session creation, Claude CLI spawn), the error propagates with a `TOOL_MISSING` error code.
- The renderer catches `TOOL_MISSING` errors and opens the onboard dialog targeting that specific tool.

## Backend Changes

### New: `src/main/services/tool-verification.service.ts`

- `verifyAllTools(projectPath: string): Promise<ToolCheckResult[]>` — Checks all tools, returns full results.
- `verifyHealthTools(): Promise<ToolCheckResult[]>` — Lightweight check of critical tools only (for background monitoring).
- `checkGit(): Promise<ToolCheckResult>` — New. Runs `git --version`.
- `checkClaude(): Promise<ToolCheckResult>` — New. Runs `claude --version`.
- Reuses `TmuxService.checkTmuxInstalled()`, `BmadInstallService.checkNodejs()`, and `BmadInstallService.checkBmadStatus()` for existing checks.

### Modified: `src/main/services/project.service.ts`

- `openProject()` — Sets `needsOnboarding: true` in the returned `ProjectInfo` when the project has no existing record in the local database (first open on this machine).

### Modified: `src/main/trpc/routers/project.router.ts`

- New `verifyTools` query — Accepts project path, calls `ToolVerificationService.verifyAllTools()`.
- New `checkToolHealth` query — Calls `ToolVerificationService.verifyHealthTools()`.

### Modified: `src/main/index.ts`

- Remove `checkTmuxDependency()` function and its call in `app.whenReady()`.
- Remove the app-quit behavior when tmux is missing — the onboarding wizard now handles this.

### New: `src/shared/types/tool-verification.types.ts`

- `ToolCheckResult` interface (see above).

## Frontend Changes

### Renamed: `NewProjectDialog.tsx` → `ProjectSetupDialog.tsx`

- Accepts `mode` and `projectPath` props.
- Internal stepper state for step navigation.
- Step 1 rendered only in create mode.
- Step 2 rendered in both modes.

### Modified: `Welcome.tsx`

- Import `ProjectSetupDialog` instead of `NewProjectDialog`.
- Pass `mode="create"` for the Create New Project button.

### Modified: `App.tsx`

- After `openProject` returns with `needsOnboarding: true`, show `ProjectSetupDialog` in `mode="onboard"` with the project path.
- Add window focus listener: call `trpc.project.checkToolHealth`, show onboard dialog if any critical tool fails.
- Add error boundary/handler for `TOOL_MISSING` errors that opens the onboard dialog.

### Modified: `BmadSettingsPanel.tsx`

- Import and use the extracted `BmadConfigForm` component instead of duplicating the form.
