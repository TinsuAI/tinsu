# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tool verification and onboarding wizard for existing projects opened on a new machine, by evolving NewProjectDialog into a stepper-based ProjectSetupDialog.

**Architecture:** New `ToolVerificationService` checks git, tmux, Node.js, Claude CLI, and BMAD. `ProjectService.openProject()` gains a `needsOnboarding` flag. The existing `NewProjectDialog` becomes `ProjectSetupDialog` with create/onboard modes and a stepper pattern. Background health checks and point-of-failure intercepts re-trigger the wizard when critical tools go missing.

**Tech Stack:** TypeScript, Electron (main process), tRPC, React, Zustand, Vitest, Tailwind CSS, Radix UI

**Spec:** `docs/superpowers/specs/2026-03-27-onboarding-wizard-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/shared/types/tool-verification.types.ts` | Shared `ToolCheckResult` type |
| Create | `src/main/services/tool-verification.service.ts` | Tool checking logic |
| Create | `src/main/services/tool-verification.service.test.ts` | Tests for above |
| Modify | `src/main/services/project.service.ts` | Add `needsOnboarding` to `ProjectInfo` |
| Modify | `src/main/services/index.ts` | Export new service |
| Modify | `src/main/trpc/routers/project.router.ts` | Add `verifyTools` and `checkToolHealth` endpoints |
| Modify | `src/main/index.ts` | Remove `checkTmuxDependency()` |
| Create | `src/renderer/src/components/setup/BmadConfigForm.tsx` | Extracted reusable BMAD config form |
| Create | `src/renderer/src/components/setup/ToolCheckList.tsx` | Tool status checklist UI |
| Create | `src/renderer/src/components/setup/ProjectBasicsStep.tsx` | Extracted project name/dir form |
| Create | `src/renderer/src/components/setup/ToolVerificationStep.tsx` | Step 2: tool checks + BMAD config |
| Rename+Modify | `NewProjectDialog.tsx` → `src/renderer/src/components/ProjectSetupDialog.tsx` | Stepper dialog with create/onboard modes |
| Modify | `src/renderer/src/components/Welcome.tsx` | Use ProjectSetupDialog |
| Modify | `src/renderer/src/App.tsx` | Onboard trigger + health checks |
| Modify | `src/renderer/src/components/settings/BmadSettingsPanel.tsx` | Use extracted BmadConfigForm |

---

### Task 1: Shared Types — ToolCheckResult

**Files:**
- Create: `src/shared/types/tool-verification.types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// src/shared/types/tool-verification.types.ts

export interface ToolCheckResult {
  id: string
  name: string
  status: 'installed' | 'missing' | 'error'
  version?: string
  critical: boolean
  installHint?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/tool-verification.types.ts
git commit -m "feat(onboard): add ToolCheckResult shared type"
```

---

### Task 2: ToolVerificationService — Tests

**Files:**
- Create: `src/main/services/tool-verification.service.test.ts`

- [ ] **Step 1: Write failing tests for checkGit**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exec } from 'child_process'

vi.mock('child_process', () => ({
  exec: vi.fn()
}))

// Mock BmadInstallService and TmuxService to isolate ToolVerificationService
vi.mock('./bmad-install.service', () => ({
  BmadInstallService: {
    checkNodejs: vi.fn(),
    checkBmadStatus: vi.fn()
  }
}))

vi.mock('./tmux.service', () => ({
  TmuxService: {
    checkTmuxInstalled: vi.fn(),
    getInstallInstructions: vi.fn().mockReturnValue('Install tmux: sudo apt install tmux')
  }
}))

import { ToolVerificationService } from './tool-verification.service'
import { BmadInstallService } from './bmad-install.service'
import { TmuxService } from './tmux.service'

describe('ToolVerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('checkGit', () => {
    it('returns installed with version when git is available', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(null, 'git version 2.43.0\n', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkGit()

      expect(result).toEqual({
        id: 'git',
        name: 'Git',
        status: 'installed',
        version: '2.43.0',
        critical: true
      })
    })

    it('returns missing when git is not found', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(new Error('Command not found'), '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkGit()

      expect(result.status).toBe('missing')
      expect(result.critical).toBe(true)
      expect(result.installHint).toBeDefined()
    })
  })

  describe('checkClaude', () => {
    it('returns installed with version when claude is available', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(null, '1.0.12\n', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkClaude()

      expect(result).toEqual({
        id: 'claude-cli',
        name: 'Claude Code CLI',
        status: 'installed',
        version: '1.0.12',
        critical: true
      })
    })

    it('returns missing when claude is not found', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(new Error('Command not found'), '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkClaude()

      expect(result.status).toBe('missing')
      expect(result.installHint).toContain('npm install -g @anthropic-ai/claude-code')
    })
  })

  describe('verifyAllTools', () => {
    it('returns results for all tools including BMAD', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          if (_cmd === 'git --version') {
            callback(null, 'git version 2.43.0\n', '')
          } else if (_cmd === 'claude --version') {
            callback(null, '1.0.12\n', '')
          }
          return {} as ReturnType<typeof exec>
        }
      )
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: true,
        version: '6.2.0',
        modules: ['core', 'bmm']
      })

      const results = await ToolVerificationService.verifyAllTools('/fake/project')

      expect(results).toHaveLength(5)
      expect(results.every((r) => r.status === 'installed')).toBe(true)
      const ids = results.map((r) => r.id)
      expect(ids).toEqual(['git', 'tmux', 'nodejs', 'claude-cli', 'bmad'])
    })
  })

  describe('verifyHealthTools', () => {
    it('returns only critical tools', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(null, 'version output\n', '')
          return {} as ReturnType<typeof exec>
        }
      )
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })

      const results = await ToolVerificationService.verifyHealthTools()

      expect(results.every((r) => r.critical)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(4)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/tool-verification.service.test.ts`
Expected: FAIL — `tool-verification.service` module not found

- [ ] **Step 3: Commit failing tests**

```bash
git add src/main/services/tool-verification.service.test.ts
git commit -m "test(onboard): add failing tests for ToolVerificationService"
```

---

### Task 3: ToolVerificationService — Implementation

**Files:**
- Create: `src/main/services/tool-verification.service.ts`
- Modify: `src/main/services/index.ts`

- [ ] **Step 1: Implement ToolVerificationService**

```typescript
import { exec } from 'child_process'
import { TmuxService } from './tmux.service'
import { BmadInstallService } from './bmad-install.service'
import type { ToolCheckResult } from '../../shared/types/tool-verification.types'

export class ToolVerificationService {
  static checkGit(): Promise<ToolCheckResult> {
    return new Promise((resolve) => {
      exec('git --version', (error, stdout) => {
        if (error) {
          resolve({
            id: 'git',
            name: 'Git',
            status: 'missing',
            critical: true,
            installHint:
              'Install git:\n• macOS: brew install git\n• Ubuntu/Debian: sudo apt install git\n• Fedora: sudo dnf install git'
          })
        } else {
          const versionMatch = stdout.match(/git version (\S+)/)
          resolve({
            id: 'git',
            name: 'Git',
            status: 'installed',
            version: versionMatch?.[1] ?? stdout.trim(),
            critical: true
          })
        }
      })
    })
  }

  static async checkTmux(): Promise<ToolCheckResult> {
    try {
      const installed = await TmuxService.checkTmuxInstalled()
      if (!installed) {
        return {
          id: 'tmux',
          name: 'tmux',
          status: 'missing',
          critical: true,
          installHint: TmuxService.getInstallInstructions()
        }
      }
      return {
        id: 'tmux',
        name: 'tmux',
        status: 'installed',
        critical: true
      }
    } catch {
      return {
        id: 'tmux',
        name: 'tmux',
        status: 'error',
        critical: true,
        installHint: TmuxService.getInstallInstructions()
      }
    }
  }

  static async checkNodejs(): Promise<ToolCheckResult> {
    const result = await BmadInstallService.checkNodejs()
    if (!result.installed) {
      return {
        id: 'nodejs',
        name: 'Node.js',
        status: 'missing',
        critical: true,
        installHint:
          'Install Node.js:\n• macOS: brew install node\n• Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs\n• Or download from https://nodejs.org'
      }
    }
    return {
      id: 'nodejs',
      name: 'Node.js',
      status: 'installed',
      version: result.version ?? undefined,
      critical: true
    }
  }

  static checkClaude(): Promise<ToolCheckResult> {
    return new Promise((resolve) => {
      exec('claude --version', (error, stdout) => {
        if (error) {
          resolve({
            id: 'claude-cli',
            name: 'Claude Code CLI',
            status: 'missing',
            critical: true,
            installHint: 'Install Claude Code CLI:\nnpm install -g @anthropic-ai/claude-code'
          })
        } else {
          resolve({
            id: 'claude-cli',
            name: 'Claude Code CLI',
            status: 'installed',
            version: stdout.trim(),
            critical: true
          })
        }
      })
    })
  }

  static async checkBmad(projectPath: string): Promise<ToolCheckResult> {
    try {
      const status = await BmadInstallService.checkBmadStatus(projectPath)
      if (!status.installed) {
        return {
          id: 'bmad',
          name: 'BMAD Framework',
          status: 'missing',
          critical: true,
          installHint: 'BMAD can be installed from the setup wizard below.'
        }
      }
      return {
        id: 'bmad',
        name: 'BMAD Framework',
        status: 'installed',
        version: status.version,
        critical: true
      }
    } catch {
      return {
        id: 'bmad',
        name: 'BMAD Framework',
        status: 'error',
        critical: true,
        installHint: 'BMAD can be installed from the setup wizard below.'
      }
    }
  }

  static async verifyAllTools(projectPath: string): Promise<ToolCheckResult[]> {
    const [git, tmux, nodejs, claude, bmad] = await Promise.all([
      this.checkGit(),
      this.checkTmux(),
      this.checkNodejs(),
      this.checkClaude(),
      this.checkBmad(projectPath)
    ])
    return [git, tmux, nodejs, claude, bmad]
  }

  static async verifyHealthTools(): Promise<ToolCheckResult[]> {
    const [git, tmux, nodejs, claude] = await Promise.all([
      this.checkGit(),
      this.checkTmux(),
      this.checkNodejs(),
      this.checkClaude()
    ])
    return [git, tmux, nodejs, claude]
  }
}
```

- [ ] **Step 2: Add export to services barrel file**

In `src/main/services/index.ts`, add after the TmuxService export (line 28):

```typescript
// Tool verification service (onboarding wizard)
export { ToolVerificationService } from './tool-verification.service'
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/main/services/tool-verification.service.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/services/tool-verification.service.ts src/main/services/index.ts
git commit -m "feat(onboard): implement ToolVerificationService"
```

---

### Task 4: ProjectService — Add needsOnboarding flag

**Files:**
- Modify: `src/main/services/project.service.ts:38-43` (ProjectInfo interface)
- Modify: `src/main/services/project.service.ts:161-227` (openProject method)

- [ ] **Step 1: Add needsOnboarding to ProjectInfo**

In `src/main/services/project.service.ts`, modify the `ProjectInfo` interface at line 38:

```typescript
export interface ProjectInfo {
  id: string
  path: string
  config: ProjectConfig
  isNewProject: boolean
  needsOnboarding: boolean
}
```

- [ ] **Step 2: Update openProject to set needsOnboarding**

In `src/main/services/project.service.ts`, the `openProject` method currently calls `registerOrUpdateProject` at line 204 which returns a project ID. We need to also know if the project was already in the DB. Modify `registerOrUpdateProject` to return both the ID and whether it existed:

Change the private method signature and return type at line 236:

```typescript
private static async registerOrUpdateProject(
  projectPath: string,
  projectName?: string
): Promise<{ id: string; alreadyRegistered: boolean }> {
  const existingProject = db
    .select()
    .from(projects)
    .where(eq(projects.path, projectPath))
    .get()

  if (existingProject) {
    db.update(projects)
      .set({ last_opened_at: new Date() })
      .where(eq(projects.id, existingProject.id))
      .run()
    return { id: existingProject.id, alreadyRegistered: true }
  }

  const projectId = nanoid()
  const name = projectName || path.basename(projectPath)

  db.insert(projects)
    .values({
      id: projectId,
      path: projectPath,
      name,
      last_opened_at: new Date()
    })
    .run()

  return { id: projectId, alreadyRegistered: false }
}
```

Then update the `openProject` method to use the new return shape. Change lines 204-224:

```typescript
    // Story 3.1.5: Register or lookup project in database
    const { id: projectId, alreadyRegistered } = await this.registerOrUpdateProject(projectPath, config.projectName)

    // Ensure project has at least one sprint (create default Backlog if none exist)
    this.ensureDefaultSprint(projectId)

    // Initialize planning tasks if not already done (Story 3.2)
    if (!config.planningTasksInitialized) {
      await PlanningInitService.initializePlanningTasks(projectPath, projectId)
      const configService = new ConfigService(projectPath)
      config = configService.updateConfig({ planningTasksInitialized: true })
    }

    // Store current project
    this.currentProjectPath = projectPath
    this.currentProjectId = projectId
    this.currentProjectInfo = {
      id: projectId,
      path: projectPath,
      config,
      isNewProject,
      needsOnboarding: !alreadyRegistered
    }

    return this.currentProjectInfo
```

- [ ] **Step 3: Run existing project service tests**

Run: `npx vitest run src/main/services/project.service`
Expected: PASS (if tests exist; the new field doesn't break anything since it's additive)

- [ ] **Step 4: Commit**

```bash
git add src/main/services/project.service.ts
git commit -m "feat(onboard): add needsOnboarding flag to ProjectInfo"
```

---

### Task 5: tRPC Endpoints — verifyTools and checkToolHealth

**Files:**
- Modify: `src/main/trpc/routers/project.router.ts:171-341`

- [ ] **Step 1: Add verifyTools query to project router**

In `src/main/trpc/routers/project.router.ts`, add the import for `ToolVerificationService` at line 8:

```typescript
import { ToolVerificationService } from '../../services/tool-verification.service'
```

Then add two new endpoints inside the `projectRouter = router({...})` block, after the `listFiles` endpoint (before the closing `})` at line 341):

```typescript
  /**
   * Verifies all required tools for project setup.
   * Returns status for git, tmux, Node.js, Claude CLI, and BMAD.
   */
  verifyTools: publicProcedure
    .input(z.object({ projectPath: z.string().min(1) }))
    .query(async ({ input }) => {
      return ToolVerificationService.verifyAllTools(input.projectPath)
    }),

  /**
   * Lightweight health check for critical tools only.
   * Used for background monitoring — does not check BMAD.
   */
  checkToolHealth: publicProcedure.query(async () => {
    return ToolVerificationService.verifyHealthTools()
  }),
```

- [ ] **Step 2: Run the dev build to verify no type errors**

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/trpc/routers/project.router.ts
git commit -m "feat(onboard): add verifyTools and checkToolHealth tRPC endpoints"
```

---

### Task 6: Remove Legacy tmux Dependency Check

**Files:**
- Modify: `src/main/index.ts:72-97` (remove checkTmuxDependency function)
- Modify: `src/main/index.ts:146-151` (remove call and app.quit)

- [ ] **Step 1: Remove checkTmuxDependency function and its call**

In `src/main/index.ts`, remove the entire `checkTmuxDependency` function (lines 72-97):

```typescript
// DELETE: lines 72-97 (the entire checkTmuxDependency function)
```

Then find the call site in the `app.whenReady()` handler (around line 146-151) and remove:

```typescript
// DELETE these lines:
  // Check tmux dependency before proceeding
  const tmuxAvailable = await checkTmuxDependency()
  if (!tmuxAvailable) {
    app.quit()
    return
  }
```

The `dialog` import from electron at line 1 may become unused — check if it's used elsewhere in the file. If only used by `checkTmuxDependency`, remove it from the import.

- [ ] **Step 2: Verify the app still starts**

Run: `npm run dev`
Expected: App starts without the native tmux dialog appearing. If tmux is installed, everything works. If tmux is not installed, the app still starts (wizard will handle it).

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "refactor(onboard): remove legacy checkTmuxDependency in favor of wizard"
```

---

### Task 7: Extract BmadConfigForm Component

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

**Files:**
- Create: `src/renderer/src/components/setup/BmadConfigForm.tsx`

This component is extracted from the BMAD configuration form that exists in both `NewProjectDialog.tsx` (lines 296-371) and `BmadSettingsPanel.tsx` (lines 301-367). They share the same fields: userName, modules checkboxes, tools checkbox grid, language select.

- [ ] **Step 1: Create BmadConfigForm**

```typescript
import React, { useState } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import type { BmadModule, BmadTool } from '@shared/types/bmad.types'

function ToolCheckboxGrid({
  tools,
  selectedTools,
  toggleTool,
  disabled
}: {
  tools: BmadTool[]
  selectedTools: string[]
  toggleTool: (id: string) => void
  disabled: boolean
}): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const preferred = tools.filter((t) => t.preferred)
  const other = tools.filter((t) => !t.preferred)

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tools / IDE</Label>
      <div className="grid grid-cols-2 gap-2">
        {preferred.map((tool) => (
          <label
            key={tool.id}
            className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
          >
            <Checkbox
              checked={selectedTools.includes(tool.id)}
              onCheckedChange={(): void => toggleTool(tool.id)}
              disabled={disabled}
              data-testid={`tool-checkbox-${tool.id}`}
            />
            <span>{tool.name}</span>
          </label>
        ))}
      </div>
      {other.length > 0 && (
        <>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={(): void => setShowAll((v) => !v)}
          >
            {showAll ? '▾ Hide other tools' : `▸ Show ${other.length} more tools…`}
          </button>
          {showAll && (
            <div className="grid grid-cols-2 gap-2">
              {other.map((tool) => (
                <label
                  key={tool.id}
                  className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={selectedTools.includes(tool.id)}
                    onCheckedChange={(): void => toggleTool(tool.id)}
                    disabled={disabled}
                    data-testid={`tool-checkbox-${tool.id}`}
                  />
                  <span>{tool.name}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export interface BmadConfigFormProps {
  userName: string
  onUserNameChange: (value: string) => void
  selectedModules: string[]
  onToggleModule: (moduleId: string) => void
  selectedTools: string[]
  onToggleTool: (toolId: string) => void
  language: string
  onLanguageChange: (value: string) => void
  modules: BmadModule[]
  tools: BmadTool[]
  languages: string[]
  disabled: boolean
}

export function BmadConfigForm({
  userName,
  onUserNameChange,
  selectedModules,
  onToggleModule,
  selectedTools,
  onToggleTool,
  language,
  onLanguageChange,
  modules,
  tools,
  languages,
  disabled
}: BmadConfigFormProps): React.JSX.Element {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4 rounded-lg border border-border/30 bg-muted/20 p-4"
      data-testid="bmad-config-section"
    >
      {/* User Name */}
      <div className="space-y-1.5">
        <Label htmlFor="bmad-username" className="text-sm font-medium">
          User Name
        </Label>
        <Input
          id="bmad-username"
          placeholder="Your name (used in BMAD templates)"
          value={userName}
          onChange={(e) => onUserNameChange(e.target.value)}
          data-testid="bmad-username-input"
        />
      </div>

      {/* Modules */}
      {modules.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Modules</Label>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((mod) => (
              <label
                key={mod.id}
                className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedModules.includes(mod.id)}
                  onCheckedChange={() => onToggleModule(mod.id)}
                  data-testid={`module-checkbox-${mod.id}`}
                />
                <span>{mod.name}</span>
                {mod.builtIn && (
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                    built-in
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tools / IDE */}
      {tools.length > 0 && (
        <ToolCheckboxGrid
          tools={tools}
          selectedTools={selectedTools}
          toggleTool={onToggleTool}
          disabled={disabled}
        />
      )}

      {/* Language */}
      <div className="space-y-1.5">
        <Label htmlFor="bmad-language" className="text-sm font-medium">
          Language
        </Label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger id="bmad-language" data-testid="bmad-language-select">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/setup/BmadConfigForm.tsx
git commit -m "feat(onboard): extract reusable BmadConfigForm component"
```

---

### Task 8: Extract ProjectBasicsStep Component

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

**Files:**
- Create: `src/renderer/src/components/setup/ProjectBasicsStep.tsx`

Extracted from `NewProjectDialog.tsx` lines 217-258 (project name input, directory selector, path preview).

- [ ] **Step 1: Create ProjectBasicsStep**

```typescript
import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'

const INVALID_CHARS_TEST = /[/\\:*?"<>|]/
const INVALID_CHARS_REPLACE = /[/\\:*?"<>|]/g

export interface ProjectBasicsStepProps {
  projectName: string
  onProjectNameChange: (value: string) => void
  parentDir: string | null
  onSelectDirectory: () => void
  nameError: string | null
  onNameErrorChange: (error: string | null) => void
  disabled: boolean
}

export function ProjectBasicsStep({
  projectName,
  onProjectNameChange,
  parentDir,
  onSelectDirectory,
  nameError,
  onNameErrorChange,
  disabled
}: ProjectBasicsStepProps): React.JSX.Element {
  const handleNameChange = (value: string): void => {
    if (INVALID_CHARS_TEST.test(value)) {
      onNameErrorChange('Project name contains invalid characters')
    } else {
      onNameErrorChange(null)
    }
    onProjectNameChange(value.replace(INVALID_CHARS_REPLACE, ''))
  }

  const fullPath =
    parentDir && projectName.trim() ? `${parentDir}/${projectName.trim()}` : null

  return (
    <div className="space-y-5">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          placeholder="my-project"
          value={projectName}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={disabled}
          autoFocus
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>

      {/* Parent Directory */}
      <div className="space-y-2">
        <Label>Location</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 truncate rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-sm text-muted-foreground">
            {parentDir ?? 'No folder selected'}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectDirectory}
            disabled={disabled}
          >
            <FolderOpen className="mr-1.5 h-4 w-4" />
            Choose Folder
          </Button>
        </div>
      </div>

      {/* Path Preview */}
      {fullPath && (
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Will be created at:</p>
          <code className="mt-0.5 block truncate font-mono text-sm text-foreground/80">
            {fullPath}
          </code>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/setup/ProjectBasicsStep.tsx
git commit -m "feat(onboard): extract ProjectBasicsStep component"
```

---

### Task 9: ToolCheckList Component

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

**Files:**
- Create: `src/renderer/src/components/setup/ToolCheckList.tsx`

- [ ] **Step 1: Create ToolCheckList**

```typescript
import React from 'react'
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { ToolCheckResult } from '@shared/types/tool-verification.types'

export interface ToolCheckListProps {
  results: ToolCheckResult[]
  isChecking: boolean
  onInstallAction?: (toolId: string) => void
}

function StatusIcon({ status }: { status: ToolCheckResult['status'] }): React.JSX.Element {
  switch (status) {
    case 'installed':
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />
    case 'missing':
      return <XCircle className="h-5 w-5 text-red-400" />
    case 'error':
      return <AlertTriangle className="h-5 w-5 text-amber-400" />
  }
}

export function ToolCheckList({
  results,
  isChecking,
  onInstallAction
}: ToolCheckListProps): React.JSX.Element {
  return (
    <div className="space-y-2" data-testid="tool-check-list">
      {results.map((tool) => (
        <div
          key={tool.id}
          className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3"
          data-testid={`tool-check-${tool.id}`}
        >
          {isChecking ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <StatusIcon status={tool.status} />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{tool.name}</span>
              {tool.critical && (
                <Lock className="h-3 w-3 text-muted-foreground" title="Required" />
              )}
              {tool.version && tool.status === 'installed' && (
                <span className="text-xs text-muted-foreground">v{tool.version}</span>
              )}
            </div>
            {tool.status !== 'installed' && tool.installHint && (
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                {tool.installHint}
              </p>
            )}
          </div>

          {tool.status !== 'installed' && tool.id !== 'bmad' && onInstallAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInstallAction(tool.id)}
              data-testid={`install-${tool.id}`}
            >
              Install
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/setup/ToolCheckList.tsx
git commit -m "feat(onboard): add ToolCheckList component"
```

---

### Task 10: ToolVerificationStep Component

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

**Files:**
- Create: `src/renderer/src/components/setup/ToolVerificationStep.tsx`

This is Step 2 of the wizard — shows the tool checklist and the BMAD config form when BMAD needs installation.

- [ ] **Step 1: Create ToolVerificationStep**

```typescript
import React, { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { ToolCheckList } from './ToolCheckList'
import { BmadConfigForm } from './BmadConfigForm'
import { trpc } from '@renderer/lib/trpc'
import type { ToolCheckResult } from '@shared/types/tool-verification.types'

export interface ToolVerificationStepProps {
  projectPath: string
  onAllCriticalPassed: (passed: boolean) => void
}

export function ToolVerificationStep({
  projectPath,
  onAllCriticalPassed
}: ToolVerificationStepProps): React.JSX.Element {
  // Tool verification query
  const {
    data: toolResults,
    isLoading: isChecking,
    refetch: recheckTools
  } = trpc.project.verifyTools.useQuery(
    { projectPath },
    { enabled: !!projectPath }
  )

  // BMAD queries
  const { data: available } = trpc.bmad.availableModules.useQuery()
  const { data: bmadStatus } = trpc.bmad.checkStatus.useQuery(undefined, {
    enabled: !!projectPath
  })

  // BMAD config state — pre-populate from detected config
  const [userName, setUserName] = useState('')
  const [bmadModules, setBmadModules] = useState<string[]>(['core', 'bmm'])
  const [bmadTools, setBmadTools] = useState<string[]>([])
  const [language, setLanguage] = useState('English')

  // Pre-populate from existing BMAD config if detected
  useEffect(() => {
    if (bmadStatus?.installed && bmadStatus.modules) {
      setBmadModules(bmadStatus.modules)
    }
    if (bmadStatus?.installed && bmadStatus.tools) {
      setBmadTools(bmadStatus.tools)
    }
  }, [bmadStatus])

  // BMAD install mutation
  const bmadInstallMutation = trpc.bmad.installToPath.useMutation({
    onSuccess: () => {
      toast.success('BMAD framework installed successfully')
      recheckTools()
    },
    onError: (error) => {
      toast.error('Failed to install BMAD', { description: error.message })
    }
  })

  // Node.js install mutation
  const installNodeMutation = trpc.bmad.installNodejs.useMutation({
    onSuccess: () => {
      toast.success('Node.js installation started — re-check after install completes')
    }
  })

  // Compute whether all critical tools pass
  useEffect(() => {
    if (toolResults) {
      const allCriticalPassed = toolResults
        .filter((t) => t.critical)
        .every((t) => t.status === 'installed')
      onAllCriticalPassed(allCriticalPassed)
    }
  }, [toolResults, onAllCriticalPassed])

  const handleInstallAction = (toolId: string): void => {
    if (toolId === 'nodejs') {
      installNodeMutation.mutate()
    }
    // For git, tmux, claude-cli: installHint is shown in the list.
    // User installs externally and clicks Re-check.
  }

  const handleInstallBmad = (): void => {
    bmadInstallMutation.mutate({
      projectPath,
      modules: bmadModules,
      tools: bmadTools,
      userName: userName || 'User',
      communicationLanguage: language,
      documentOutputLanguage: language,
      outputFolder: '_bmad-output'
    })
  }

  const bmadResult = toolResults?.find((t) => t.id === 'bmad')
  const bmadNeedsInstall = bmadResult && bmadResult.status !== 'installed'
  const modules = available?.modules ?? []
  const tools = available?.tools ?? []
  const languages = available?.languages ?? ['English']

  const toggleModule = (moduleId: string): void => {
    setBmadModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    )
  }

  const toggleTool = (toolId: string): void => {
    setBmadTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Tool Verification</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => recheckTools()}
          disabled={isChecking}
          data-testid="recheck-tools-btn"
        >
          {isChecking ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Re-check
        </Button>
      </div>

      <ToolCheckList
        results={toolResults ?? []}
        isChecking={isChecking}
        onInstallAction={handleInstallAction}
      />

      {/* BMAD Config Form — shown when BMAD needs installation */}
      {bmadNeedsInstall && (
        <div className="space-y-4">
          <hr className="border-border/40" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium">BMAD Framework Setup</span>
          </div>

          <BmadConfigForm
            userName={userName}
            onUserNameChange={setUserName}
            selectedModules={bmadModules}
            onToggleModule={toggleModule}
            selectedTools={bmadTools}
            onToggleTool={toggleTool}
            language={language}
            onLanguageChange={setLanguage}
            modules={modules}
            tools={tools}
            languages={languages}
            disabled={bmadInstallMutation.isPending}
          />

          <Button
            onClick={handleInstallBmad}
            disabled={bmadInstallMutation.isPending}
            className="w-full"
            data-testid="install-bmad-btn"
          >
            {bmadInstallMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Installing BMAD...
              </>
            ) : (
              'Install BMAD'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/setup/ToolVerificationStep.tsx
git commit -m "feat(onboard): add ToolVerificationStep component"
```

---

### Task 11: ProjectSetupDialog — Stepper Refactor

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

**Files:**
- Delete: `src/renderer/src/components/NewProjectDialog.tsx`
- Create: `src/renderer/src/components/ProjectSetupDialog.tsx`

- [ ] **Step 1: Create ProjectSetupDialog**

```typescript
import React, { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog'
import { ProjectBasicsStep } from './setup/ProjectBasicsStep'
import { ToolVerificationStep } from './setup/ToolVerificationStep'
import { trpc } from '@renderer/lib/trpc'

interface ProjectSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (info: { path: string; projectName: string }) => void
  mode: 'create' | 'onboard'
  projectPath?: string
}

export function ProjectSetupDialog({
  open,
  onOpenChange,
  onProjectCreated,
  mode,
  projectPath: initialProjectPath
}: ProjectSetupDialogProps): React.JSX.Element {
  // Stepper state
  const totalSteps = mode === 'create' ? 2 : 1
  const [step, setStep] = useState(1)

  // Step 1 state (create mode only)
  const [projectName, setProjectName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [installBmad, setInstallBmad] = useState(true)

  // Step 2 state
  const [allCriticalPassed, setAllCriticalPassed] = useState(false)
  const [createdProjectPath, setCreatedProjectPath] = useState<string | null>(null)

  // The project path to use for tool verification
  const effectiveProjectPath = initialProjectPath ?? createdProjectPath

  // Mutations
  const selectDirMutation = trpc.project.selectParentDirectory.useMutation({
    onSuccess: (result) => {
      if (!result.canceled && result.path) {
        setParentDir(result.path)
        setCreateError(null)
      }
    }
  })

  const createMutation = trpc.project.create.useMutation()

  const handleCreateAndNext = async (): Promise<void> => {
    if (!parentDir || !projectName.trim()) return
    setCreateError(null)
    try {
      const result = await createMutation.mutateAsync({
        parentDir,
        projectName: projectName.trim()
      })
      setCreatedProjectPath(result.path)
      setStep(2)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleContinue = (): void => {
    if (effectiveProjectPath) {
      // For create mode, we need the project name from the form.
      // For onboard mode, we extract it from the path.
      const name =
        mode === 'create'
          ? projectName.trim()
          : effectiveProjectPath.split('/').pop() ?? 'Project'
      onProjectCreated({ path: effectiveProjectPath, projectName: name })
      onOpenChange(false)
    }
  }

  const handleAllCriticalPassed = useCallback((passed: boolean) => {
    setAllCriticalPassed(passed)
  }, [])

  const isStep1Valid = projectName.trim().length > 0 && parentDir !== null && !nameError
  const isPending = createMutation.isPending || selectDirMutation.isPending

  // Reset form state when dialog closes
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setStep(1)
      setProjectName('')
      setParentDir(null)
      setNameError(null)
      setCreateError(null)
      setInstallBmad(true)
      setAllCriticalPassed(false)
      setCreatedProjectPath(null)
    }
    onOpenChange(nextOpen)
  }

  // Determine which step we're on logically
  const currentStep = mode === 'onboard' ? 2 : step
  const isOnStep1 = currentStep === 1
  const isOnStep2 = currentStep === 2

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {isOnStep1 && (
            <>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new project folder with git initialized.
              </DialogDescription>
            </>
          )}
          {isOnStep2 && (
            <>
              <DialogTitle>
                {mode === 'onboard' ? 'Project Setup' : 'Tool Verification'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'onboard'
                  ? 'Verify required tools are installed before continuing.'
                  : 'Verify tools and configure your project.'}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {/* Step indicator for create mode */}
        {mode === 'create' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={step === 1 ? 'font-semibold text-foreground' : ''}>
              1. Project
            </span>
            <span>→</span>
            <span className={step === 2 ? 'font-semibold text-foreground' : ''}>
              2. Tools
            </span>
          </div>
        )}

        <div className="py-1">
          {/* Step 1: Project Basics (create mode only) */}
          {isOnStep1 && (
            <ProjectBasicsStep
              projectName={projectName}
              onProjectNameChange={(value) => {
                setProjectName(value)
                setCreateError(null)
              }}
              parentDir={parentDir}
              onSelectDirectory={() => selectDirMutation.mutate()}
              nameError={nameError}
              onNameErrorChange={setNameError}
              disabled={isPending}
            />
          )}

          {/* Step 2: Tool Verification */}
          {isOnStep2 && effectiveProjectPath && (
            <ToolVerificationStep
              projectPath={effectiveProjectPath}
              onAllCriticalPassed={handleAllCriticalPassed}
            />
          )}

          {/* Create Error */}
          {createError && (
            <div className="mt-4 rounded-md border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {createError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isOnStep1 && (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAndNext}
                disabled={!isStep1Valid || isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </>
          )}
          {isOnStep2 && (
            <>
              {mode === 'create' && (
                <Button variant="ghost" onClick={() => setStep(1)} disabled={isPending}>
                  Back
                </Button>
              )}
              {mode === 'onboard' && (
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleContinue}
                disabled={!allCriticalPassed}
              >
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Delete the old NewProjectDialog**

```bash
rm src/renderer/src/components/NewProjectDialog.tsx
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: Errors in Welcome.tsx (still imports NewProjectDialog) — fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ProjectSetupDialog.tsx
git rm src/renderer/src/components/NewProjectDialog.tsx
git commit -m "feat(onboard): create stepper-based ProjectSetupDialog, remove NewProjectDialog"
```

---

### Task 12: Update Welcome.tsx to Use ProjectSetupDialog

**Files:**
- Modify: `src/renderer/src/components/Welcome.tsx:6` (import)
- Modify: `src/renderer/src/components/Welcome.tsx:226-230` (component usage)

- [ ] **Step 1: Update import**

In `src/renderer/src/components/Welcome.tsx`, change line 6:

From:
```typescript
import { NewProjectDialog } from './NewProjectDialog'
```

To:
```typescript
import { ProjectSetupDialog } from './ProjectSetupDialog'
```

- [ ] **Step 2: Update component usage**

Change lines 226-230:

From:
```typescript
      <NewProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={onProjectOpened}
      />
```

To:
```typescript
      <ProjectSetupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={onProjectOpened}
        mode="create"
      />
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Welcome.tsx
git commit -m "refactor(onboard): update Welcome to use ProjectSetupDialog"
```

---

### Task 13: Update App.tsx — Onboard Trigger and Health Checks

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add onboarding state and imports**

Add the import at top of `src/renderer/src/App.tsx`:

```typescript
import { ProjectSetupDialog } from './components/ProjectSetupDialog'
```

Inside the `App` function, add state for onboarding after the crash recovery state (after line 37):

```typescript
  // Onboarding wizard state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingProjectPath, setOnboardingProjectPath] = useState<string | null>(null)
```

- [ ] **Step 2: Modify openPathMutation to check needsOnboarding**

Update the `openPathMutation` onSuccess handler (lines 46-58) to intercept the `needsOnboarding` flag:

```typescript
  const openPathMutation = trpc.project.openPath.useMutation({
    onSuccess: (result) => {
      if (result.needsOnboarding) {
        // First time on this machine — show onboarding wizard
        setOnboardingProjectPath(result.path)
        setShowOnboarding(true)
        setIsReopening(false)
        return
      }
      setProject(result.path, result.config.projectName)
      setIsReopening(false)
      // Story 8.10 AC4: Check for crashed operations after project opens
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary
          })
          setShowCrashRecovery(true)
        }
      })
    },
    onError: () => {
      clearProject()
      setIsReopening(false)
    }
  })
```

- [ ] **Step 3: Update handleProjectOpened to also check needsOnboarding**

The `handleProjectOpened` callback is used by Welcome.tsx when opening projects via file dialog or recent list. The `open` mutation in project.router.ts also returns `ProjectInfo`. Update the callback:

First, add a new mutation for the file-dialog open that can check needsOnboarding:

```typescript
  const openProjectMutationForWelcome = trpc.project.open.useMutation()
```

Actually, the Welcome component handles the open mutation itself and calls `onProjectOpened`. The issue is that Welcome.tsx's `openProjectMutation` and `openPathMutation` both call `onProjectOpened` which just does `setProject`. We need to update `handleProjectOpened` to accept the full `ProjectInfo`:

Update `handleProjectOpened` (lines 77-92):

```typescript
  const handleProjectOpened = useCallback(
    (info: { path: string; projectName: string; needsOnboarding?: boolean }): void => {
      if (info.needsOnboarding) {
        setOnboardingProjectPath(info.path)
        setShowOnboarding(true)
        return
      }
      setProject(info.path, info.projectName)
      // Story 8.10 AC4: Check for crashed operations after project opens
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary
          })
          setShowCrashRecovery(true)
        }
      })
    },
    [setProject, crashRecoveryQuery]
  )
```

- [ ] **Step 4: Add background health check on window focus**

Add a health check effect after the existing useEffect (after line 75):

```typescript
  // Background health check: re-verify critical tools on window focus
  const healthCheckQuery = trpc.project.checkToolHealth.useQuery(undefined, {
    enabled: false // Only run manually
  })

  useEffect(() => {
    if (!projectPath || !projectName) return

    const handleFocus = (): void => {
      healthCheckQuery.refetch().then((response) => {
        if (response.data) {
          const anyMissing = response.data.some(
            (t) => t.critical && t.status !== 'installed'
          )
          if (anyMissing) {
            setOnboardingProjectPath(projectPath)
            setShowOnboarding(true)
          }
        }
      })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [projectPath, projectName, healthCheckQuery])
```

- [ ] **Step 5: Add onboarding completion handler and dialog render**

Add a handler for when onboarding completes:

```typescript
  const handleOnboardingComplete = useCallback(
    (info: { path: string; projectName: string }): void => {
      setShowOnboarding(false)
      setOnboardingProjectPath(null)
      setProject(info.path, info.projectName)
      // Check for crash recovery after onboarding completes
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary
          })
          setShowCrashRecovery(true)
        }
      })
    },
    [setProject, crashRecoveryQuery]
  )
```

Then add the `ProjectSetupDialog` to the JSX. In the `isReopening` return block (lines 95-107), also show it if onboarding is needed:

```typescript
  // Show onboarding wizard if triggered
  if (showOnboarding && onboardingProjectPath) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <ProjectSetupDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setShowOnboarding(false)
                setOnboardingProjectPath(null)
                clearProject()
              }
            }}
            onProjectCreated={handleOnboardingComplete}
            mode="onboard"
            projectPath={onboardingProjectPath}
          />
        </div>
        <Toaster />
      </>
    )
  }
```

Place this block after the `isReopening` block and before the `!projectPath || !projectName` check.

- [ ] **Step 6: Update Welcome.tsx to pass needsOnboarding**

In `src/renderer/src/components/Welcome.tsx`, the `openProjectMutation` and `openPathMutation` call `onProjectOpened` with `{ path, projectName }`. We need to also pass `needsOnboarding`. Update lines 57-58:

```typescript
    onSuccess: (result) => {
      if (result) {
        onProjectOpened({
          path: result.path,
          projectName: result.config.projectName,
          needsOnboarding: result.needsOnboarding
        })
      }
    },
```

And lines 72-76:

```typescript
    onSuccess: (result) => {
      onProjectOpened({
        path: result.path,
        projectName: result.config.projectName,
        needsOnboarding: result.needsOnboarding
      })
    },
```

Update the `ProjectOpenedInfo` interface at the top of Welcome.tsx:

```typescript
interface ProjectOpenedInfo {
  path: string
  projectName: string
  needsOnboarding?: boolean
}
```

And update `WelcomeProps`:

```typescript
interface WelcomeProps {
  onProjectOpened: (info: ProjectOpenedInfo) => void
  className?: string
}
```

- [ ] **Step 7: Verify no type errors**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/components/Welcome.tsx
git commit -m "feat(onboard): wire up onboarding trigger and background health checks in App"
```

---

### Task 14: Update BmadSettingsPanel to Use Extracted BmadConfigForm

**Files:**
- Modify: `src/renderer/src/components/settings/BmadSettingsPanel.tsx`

- [ ] **Step 1: Replace inline BMAD form with BmadConfigForm**

In `src/renderer/src/components/settings/BmadSettingsPanel.tsx`:

1. Add the import at top:
```typescript
import { BmadConfigForm } from '@renderer/components/setup/BmadConfigForm'
```

2. Remove the inline `ToolCheckboxGrid` component (lines 26-91) — it's now in `BmadConfigForm.tsx`.

3. Replace the `<fieldset>` block (lines 301-367) with:

```typescript
      <BmadConfigForm
        userName={userName}
        onUserNameChange={setUserName}
        selectedModules={selectedModules}
        onToggleModule={toggleModule}
        selectedTools={selectedTools}
        onToggleTool={toggleTool}
        language={language}
        onLanguageChange={setLanguage}
        modules={modules}
        tools={tools}
        languages={languages}
        disabled={!nodeInstalled || isMutating}
      />
```

4. Remove unused imports that were only used by the inline form: `Input`, `Label`, `Checkbox`, `Select*` — check if they're still used by other parts of the panel. Keep `Badge`, `Button`, `Loader2`, `Package`, `AlertTriangle`, `CheckCircle2`, `Download`, `RefreshCw` since those are used by the status display and action buttons.

- [ ] **Step 2: Verify no type errors and the panel still renders**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/BmadSettingsPanel.tsx
git commit -m "refactor(onboard): use extracted BmadConfigForm in BmadSettingsPanel"
```

---

### Task 15: Manual Integration Testing

- [ ] **Step 1: Run all existing tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the Electron build**

Run: `npm run rebuild:electron`
Expected: Build succeeds

- [ ] **Step 3: Manual test — Create New Project flow**

1. Start the app: `npm run dev`
2. Click "Create New Project"
3. Verify Step 1 shows project name + directory
4. Fill in name, select directory, click "Next"
5. Verify Step 2 shows tool verification checklist
6. Verify all critical tools show status
7. If all pass, click "Continue"
8. Verify project opens in workspace

- [ ] **Step 4: Manual test — Onboard existing project flow**

To simulate first-time onboarding:
1. Open the app with a project that's already opened (in the DB)
2. Use the DB browser or reset the local DB to remove the project record
3. Re-open the project
4. Verify the onboarding wizard shows in onboard mode (straight to tool verification)
5. Verify all critical tools must pass before "Continue" works

- [ ] **Step 5: Manual test — Re-check button**

1. In the wizard, click "Re-check"
2. Verify the tool statuses refresh

- [ ] **Step 6: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix(onboard): address issues found during manual integration testing"
```

(Only if fixes were needed)
