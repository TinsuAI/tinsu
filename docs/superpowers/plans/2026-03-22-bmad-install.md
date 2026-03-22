# BMAD Framework Installation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to install and manage the BMAD framework in their projects via TinSu's UI — both during new project creation and from project settings.

**Architecture:** A `BmadInstallService` wraps the `npx bmad-method install` CLI with non-interactive flags. A `bmad.router.ts` exposes tRPC endpoints. The `NewProjectDialog` adds a default-on BMAD setup section, and a new `BmadSettingsPanel` is added to the Settings dialog for managing BMAD in existing projects.

**Tech Stack:** Node.js child_process.spawn, tRPC, React, Radix UI (Checkbox, Select), Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-bmad-install-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main/services/bmad-install.service.ts` | Node.js detection, BMAD status/install/update via CLI |
| `src/main/services/bmad-install.service.test.ts` | Service unit tests |
| `src/main/trpc/routers/bmad.router.ts` | tRPC endpoints for BMAD operations |
| `src/main/trpc/routers/bmad.router.test.ts` | Router unit tests |
| `src/main/trpc/index.ts` | Merge bmad router into appRouter |
| `src/shared/types/bmad.types.ts` | Shared types for BMAD options/status |
| `src/renderer/src/components/settings/BmadSettingsPanel.tsx` | Settings panel for BMAD config |
| `src/renderer/src/components/settings/BmadSettingsPanel.test.tsx` | Panel tests |
| `src/renderer/src/components/dialogs/SettingsDialog.tsx` | Add BmadSettingsPanel |
| `src/renderer/src/components/NewProjectDialog.tsx` | Add BMAD setup section |
| `src/renderer/src/components/NewProjectDialog.test.tsx` | Updated tests |

---

### Task 1: Shared Types

**Files:**
- Create: `src/shared/types/bmad.types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// src/shared/types/bmad.types.ts

export interface BmadInstallOptions {
  modules: string[]
  tools: string[]
  userName: string
  communicationLanguage: string
  documentOutputLanguage: string
  outputFolder: string
}

export interface BmadStatus {
  installed: boolean
  version?: string
  modules?: string[]
  tools?: string[]
}

export interface BmadModule {
  id: string
  name: string
  builtIn: boolean
}

export const BMAD_MODULES: BmadModule[] = [
  { id: 'core', name: 'Core Framework', builtIn: true },
  { id: 'bmm', name: 'Core Method', builtIn: true },
  { id: 'bmb', name: 'Build', builtIn: false },
  { id: 'cis', name: 'Creative Innovation Skills', builtIn: false },
  { id: 'tea', name: 'Test Engineering Architecture', builtIn: false },
  { id: 'wds', name: 'Web Design System', builtIn: false },
]

export const BMAD_TOOLS = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'windsurf', name: 'Windsurf' },
]

export const BMAD_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Italian', 'Dutch',
]
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/bmad.types.ts
git commit -m "feat: add shared BMAD types for install options, status, and module definitions"
```

---

### Task 2: BmadInstallService — Node.js Detection

**Files:**
- Create: `src/main/services/bmad-install.service.ts`
- Create: `src/main/services/bmad-install.service.test.ts`

- [ ] **Step 1: Write failing tests for checkNodejs**

```typescript
// src/main/services/bmad-install.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exec } from 'child_process'

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}))

// Must import after mocks
import { BmadInstallService } from './bmad-install.service'

const mockExec = vi.mocked(exec)

describe('BmadInstallService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkNodejs', () => {
    it('returns installed true with version when node is found', async () => {
      mockExec.mockImplementation((_cmd, callback) => {
        (callback as Function)(null, { stdout: 'v20.11.0\n', stderr: '' })
        return {} as any
      })

      const result = await BmadInstallService.checkNodejs()
      expect(result).toEqual({ installed: true, version: 'v20.11.0' })
    })

    it('returns installed false when node is not found', async () => {
      mockExec.mockImplementation((_cmd, callback) => {
        (callback as Function)(new Error('command not found'), { stdout: '', stderr: '' })
        return {} as any
      })

      const result = await BmadInstallService.checkNodejs()
      expect(result).toEqual({ installed: false, version: null })
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement checkNodejs**

```typescript
// src/main/services/bmad-install.service.ts
import { exec, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { shell } from 'electron'
import type { BmadInstallOptions, BmadStatus } from '../../shared/types/bmad.types'

export class BmadInstallService {
  /**
   * Check if Node.js is installed on the system.
   */
  static checkNodejs(): Promise<{ installed: boolean; version: string | null }> {
    return new Promise((resolve) => {
      exec('node --version', (error, stdout) => {
        if (error) {
          resolve({ installed: false, version: null })
          return
        }
        resolve({ installed: true, version: stdout.trim() })
      })
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/bmad-install.service.ts src/main/services/bmad-install.service.test.ts
git commit -m "feat: add BmadInstallService with Node.js detection"
```

---

### Task 3: BmadInstallService — Node.js Installation

**Files:**
- Modify: `src/main/services/bmad-install.service.ts`
- Modify: `src/main/services/bmad-install.service.test.ts`

- [ ] **Step 1: Write failing tests for installNodejs**

Add to the test file:

```typescript
describe('installNodejs', () => {
  it('opens terminal with install command on linux', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })

    mockExec.mockImplementation((_cmd, callback) => {
      (callback as Function)(null, { stdout: '', stderr: '' })
      return {} as any
    })

    const result = await BmadInstallService.installNodejs()
    expect(result).toEqual({ success: true, error: undefined })
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('x-terminal-emulator'),
      expect.any(Function)
    )

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  it('opens nodejs.org on windows', async () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })

    const mockShell = vi.spyOn(shell, 'openExternal').mockResolvedValue()

    const result = await BmadInstallService.installNodejs()
    expect(result).toEqual({ success: true, error: undefined })
    expect(mockShell).toHaveBeenCalledWith('https://nodejs.org/en/download/')

    Object.defineProperty(process, 'platform', { value: originalPlatform })
    mockShell.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: FAIL — installNodejs not defined

- [ ] **Step 3: Implement installNodejs**

Add to `BmadInstallService`:

```typescript
  /**
   * Attempt to install Node.js on the system.
   * Opens a terminal on Linux/macOS, or the download page on Windows.
   */
  static async installNodejs(): Promise<{ success: boolean; error?: string }> {
    const platform = process.platform

    try {
      if (platform === 'win32') {
        await shell.openExternal('https://nodejs.org/en/download/')
        return { success: true }
      }

      if (platform === 'darwin') {
        return new Promise((resolve) => {
          exec(
            'open -a Terminal "$(which brew > /dev/null 2>&1 && echo \'brew install node\' || echo \'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash && nvm install --lts\')"',
            (error) => {
              if (error) {
                shell.openExternal('https://nodejs.org/en/download/')
              }
              resolve({ success: true })
            }
          )
        })
      }

      // Linux
      return new Promise((resolve) => {
        exec(
          'x-terminal-emulator -e "bash -c \'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs; read -p Press-Enter\'"',
          (error) => {
            if (error) {
              shell.openExternal('https://nodejs.org/en/download/')
            }
            resolve({ success: true })
          }
        )
      })
    } catch {
      await shell.openExternal('https://nodejs.org/en/download/')
      return { success: true }
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/bmad-install.service.ts src/main/services/bmad-install.service.test.ts
git commit -m "feat: add Node.js installation support to BmadInstallService"
```

---

### Task 4: BmadInstallService — BMAD Status Check

**Files:**
- Modify: `src/main/services/bmad-install.service.ts`
- Modify: `src/main/services/bmad-install.service.test.ts`

- [ ] **Step 1: Write failing tests for checkBmadStatus**

Add to the test file:

```typescript
import * as fs from 'fs'
import * as path from 'path'

// Add mock for fs at top level
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() }
})

const mockExistsSync = vi.mocked(fs.existsSync)
const mockReadFileSync = vi.mocked(fs.readFileSync)

describe('checkBmadStatus', () => {
  it('returns not installed when _bmad dir does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await BmadInstallService.checkBmadStatus('/test/project')
    expect(result).toEqual({ installed: false })
  })

  it('returns installed with version and modules when CLI succeeds', async () => {
    mockExistsSync.mockReturnValue(true)
    mockExec.mockImplementation((_cmd, _opts, callback) => {
      const cb = typeof _opts === 'function' ? _opts : callback
      ;(cb as Function)(null, {
        stdout: `◇  BMAD Status
│  Version:       6.2.0
│  Location:      /test/project/_bmad
◇  Module Versions
│  Built-in Modules
│    core                 6.2.0 ✓
│    bmm                  6.2.0 ✓
│  External Modules (Official)
│    cis                  0.1.9 ✓
│    tea                  1.7.1 ✓`,
        stderr: ''
      })
      return {} as any
    })

    const result = await BmadInstallService.checkBmadStatus('/test/project')
    expect(result.installed).toBe(true)
    expect(result.version).toBe('6.2.0')
    expect(result.modules).toEqual(expect.arrayContaining(['core', 'bmm', 'cis', 'tea']))
  })

  it('falls back to config.yaml parsing when CLI fails', async () => {
    mockExistsSync.mockReturnValue(true)
    mockExec.mockImplementation((_cmd, _opts, callback) => {
      const cb = typeof _opts === 'function' ? _opts : callback
      ;(cb as Function)(new Error('npx failed'), { stdout: '', stderr: '' })
      return {} as any
    })
    mockReadFileSync.mockReturnValue('project_name: test\nuser_name: dev\n')

    const result = await BmadInstallService.checkBmadStatus('/test/project')
    expect(result.installed).toBe(true)
    expect(result.version).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: FAIL — checkBmadStatus not defined

- [ ] **Step 3: Implement checkBmadStatus**

Add to `BmadInstallService`:

```typescript
  /**
   * Check BMAD installation status for a project.
   * First checks filesystem, then runs CLI for details, falls back to config parsing.
   */
  static async checkBmadStatus(projectPath: string): Promise<BmadStatus> {
    const bmadDir = join(projectPath, '_bmad')
    if (!existsSync(bmadDir)) {
      return { installed: false }
    }

    // Try CLI status check
    try {
      const cliResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        exec('npx --yes bmad-method status', { cwd: projectPath, timeout: 30000 }, (error, stdout, stderr) => {
          if (error) reject(error)
          else resolve({ stdout, stderr })
        })
      })

      return this.parseStatusOutput(cliResult.stdout)
    } catch {
      // Fallback: parse config.yaml directly
      return this.parseConfigFallback(projectPath)
    }
  }

  /** Parse the output of `npx bmad-method status` */
  private static parseStatusOutput(stdout: string): BmadStatus {
    const versionMatch = stdout.match(/Version:\s+(\S+)/)
    const version = versionMatch ? versionMatch[1] : undefined

    // Parse module names from lines like "│    core                 6.2.0 ✓"
    const moduleRegex = /│\s{4}(\w+)\s+[\d.]+\s+✓/g
    const modules: string[] = []
    let match
    while ((match = moduleRegex.exec(stdout)) !== null) {
      modules.push(match[1])
    }

    return { installed: true, version, modules: modules.length > 0 ? modules : undefined }
  }

  /** Fallback: check config.yaml for basic status */
  private static parseConfigFallback(projectPath: string): BmadStatus {
    try {
      const configPath = join(projectPath, '_bmad', 'bmm', 'config.yaml')
      readFileSync(configPath, 'utf-8')
      return { installed: true }
    } catch {
      return { installed: true } // _bmad dir exists but config may be missing
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/bmad-install.service.ts src/main/services/bmad-install.service.test.ts
git commit -m "feat: add BMAD status check with CLI parsing and config fallback"
```

---

### Task 5: BmadInstallService — Install & Update

**Files:**
- Modify: `src/main/services/bmad-install.service.ts`
- Modify: `src/main/services/bmad-install.service.test.ts`

- [ ] **Step 1: Write failing tests for installBmad and updateBmad**

Add to the test file:

```typescript
const mockSpawn = vi.mocked(spawn)

describe('installBmad', () => {
  const defaultOptions: BmadInstallOptions = {
    modules: ['bmm', 'core'],
    tools: ['claude-code'],
    userName: 'TestUser',
    communicationLanguage: 'English',
    documentOutputLanguage: 'English',
    outputFolder: '_bmad-output',
  }

  it('spawns npx with correct flags and resolves on success', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    }
    mockSpawn.mockReturnValue(mockProcess as any)

    const promise = BmadInstallService.installBmad('/test/project', defaultOptions)

    // Simulate process completion
    const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')![1]
    closeHandler(0)

    const result = await promise
    expect(result).toEqual({ success: true })
    expect(mockSpawn).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining([
        '--yes', 'bmad-method', 'install',
        '--directory', '/test/project',
        '--modules', 'bmm,core',
        '--tools', 'claude-code',
        '--user-name', 'TestUser',
        '--yes',
      ]),
      expect.objectContaining({ cwd: '/test/project' })
    )
  })

  it('resolves with error on non-zero exit code', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn((event: string, cb: (data: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from('install failed'))
      }) },
      on: vi.fn(),
    }
    mockSpawn.mockReturnValue(mockProcess as any)

    const promise = BmadInstallService.installBmad('/test/project', defaultOptions)

    const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')![1]
    closeHandler(1)

    const result = await promise
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('updateBmad', () => {
  it('passes --action update flag', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    }
    mockSpawn.mockReturnValue(mockProcess as any)

    const promise = BmadInstallService.updateBmad('/test/project', {
      modules: ['bmm'],
      tools: [],
      userName: 'User',
      communicationLanguage: 'English',
      documentOutputLanguage: 'English',
      outputFolder: '_bmad-output',
    })

    const closeHandler = mockProcess.on.mock.calls.find(c => c[0] === 'close')![1]
    closeHandler(0)

    await promise
    expect(mockSpawn).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['--action', 'update']),
      expect.any(Object)
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: FAIL — installBmad/updateBmad not defined

- [ ] **Step 3: Implement installBmad and updateBmad**

Add to `BmadInstallService`:

```typescript
  /** 120-second timeout for CLI operations */
  private static readonly CLI_TIMEOUT_MS = 120_000

  /**
   * Install BMAD into a project directory.
   * Spawns `npx bmad-method install` with the provided options.
   */
  static installBmad(
    projectPath: string,
    options: BmadInstallOptions
  ): Promise<{ success: boolean; error?: string }> {
    return this.runBmadCli(projectPath, options)
  }

  /**
   * Update BMAD in a project directory.
   * Runs install with --action update.
   */
  static updateBmad(
    projectPath: string,
    options: BmadInstallOptions
  ): Promise<{ success: boolean; error?: string }> {
    return this.runBmadCli(projectPath, options, 'update')
  }

  /**
   * Run the BMAD CLI with the given options.
   */
  private static runBmadCli(
    projectPath: string,
    options: BmadInstallOptions,
    action?: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const args = [
        '--yes', 'bmad-method', 'install',
        '--directory', projectPath,
        '--modules', options.modules.join(','),
        '--user-name', options.userName,
        '--communication-language', options.communicationLanguage,
        '--document-output-language', options.documentOutputLanguage,
        '--output-folder', options.outputFolder,
        '--yes',
      ]

      if (options.tools.length > 0) {
        args.push('--tools', options.tools.join(','))
      } else {
        args.push('--tools', 'none')
      }

      if (action) {
        args.push('--action', action)
      }

      const child = spawn('npx', args, {
        cwd: projectPath,
        env: { ...process.env },
      })

      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        console.log(`[BmadInstall] ${data.toString().trim()}`)
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      // Timeout
      const timer = setTimeout(() => {
        child.kill()
        resolve({ success: false, error: 'Installation timed out after 120 seconds' })
      }, this.CLI_TIMEOUT_MS)

      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: stderr.trim() || `Process exited with code ${code}` })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        resolve({ success: false, error: err.message })
      })
    })
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/services/bmad-install.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/bmad-install.service.ts src/main/services/bmad-install.service.test.ts
git commit -m "feat: add BMAD install and update via CLI invocation"
```

---

### Task 6: tRPC Router — bmad.router.ts

**Files:**
- Create: `src/main/trpc/routers/bmad.router.ts`
- Create: `src/main/trpc/routers/bmad.router.test.ts`
- Modify: `src/main/trpc/index.ts`

- [ ] **Step 1: Write failing tests for the router**

```typescript
// src/main/trpc/routers/bmad.router.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() }
}))

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}))

// Mock BmadInstallService
vi.mock('../../services/bmad-install.service', () => ({
  BmadInstallService: {
    checkNodejs: vi.fn(),
    installNodejs: vi.fn(),
    checkBmadStatus: vi.fn(),
    installBmad: vi.fn(),
    updateBmad: vi.fn(),
  }
}))

// Mock ProjectService
vi.mock('../../services/project.service', () => ({
  ProjectService: {
    getCurrentProject: vi.fn().mockReturnValue('/test/project'),
    getCurrentProjectId: vi.fn().mockReturnValue('test-id'),
  }
}))

import { bmadRouter } from './bmad.router'
import { BmadInstallService } from '../../services/bmad-install.service'
import { router } from '../trpc'
import type { Context } from '../context'

const testRouter = router({ bmad: bmadRouter })

function createTestContext(): Context {
  return {
    projectRoot: '/test/project',
    db: {} as Context['db'],
    projectId: 'test-id',
    activityLogService: {} as Context['activityLogService'],
    hookListenerService: {} as Context['hookListenerService'],
  }
}

describe('bmadRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkNodejs', () => {
    it('returns node status', async () => {
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true, version: 'v20.11.0'
      })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.checkNodejs()
      expect(result).toEqual({ installed: true, version: 'v20.11.0' })
    })
  })

  describe('checkStatus', () => {
    it('returns BMAD status for current project', async () => {
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: true, version: '6.2.0', modules: ['bmm', 'core']
      })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.checkStatus()
      expect(result).toEqual({ installed: true, version: '6.2.0', modules: ['bmm', 'core'] })
      expect(BmadInstallService.checkBmadStatus).toHaveBeenCalledWith('/test/project')
    })
  })

  describe('availableModules', () => {
    it('returns the module, tool, and language lists', async () => {
      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.availableModules()
      expect(result.modules).toHaveLength(6)
      expect(result.modules[0].id).toBe('core')
      expect(result.tools).toHaveLength(3)
      expect(result.languages).toContain('English')
    })
  })

  describe('installNodejs', () => {
    it('calls BmadInstallService.installNodejs', async () => {
      vi.mocked(BmadInstallService.installNodejs).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.installNodejs()
      expect(result).toEqual({ success: true })
    })
  })

  describe('update', () => {
    it('updates BMAD in current project', async () => {
      vi.mocked(BmadInstallService.updateBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.update({
        modules: ['bmm', 'core'],
        tools: [],
        userName: 'Test',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output',
      })
      expect(result).toEqual({ success: true })
      expect(BmadInstallService.updateBmad).toHaveBeenCalledWith('/test/project', expect.any(Object))
    })
  })

  describe('install', () => {
    it('installs BMAD to current project', async () => {
      vi.mocked(BmadInstallService.installBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.install({
        modules: ['bmm', 'core'],
        tools: ['claude-code'],
        userName: 'Test',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output',
      })
      expect(result).toEqual({ success: true })
      expect(BmadInstallService.installBmad).toHaveBeenCalledWith('/test/project', expect.any(Object))
    })
  })

  describe('installToPath', () => {
    it('installs BMAD to specified path', async () => {
      vi.mocked(BmadInstallService.installBmad).mockResolvedValue({ success: true })

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.bmad.installToPath({
        projectPath: '/other/project',
        modules: ['bmm'],
        tools: [],
        userName: 'Test',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output',
      })
      expect(result).toEqual({ success: true })
      expect(BmadInstallService.installBmad).toHaveBeenCalledWith('/other/project', expect.any(Object))
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/trpc/routers/bmad.router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the router**

```typescript
// src/main/trpc/routers/bmad.router.ts
import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { BmadInstallService } from '../../services/bmad-install.service'
import { BMAD_MODULES, BMAD_TOOLS, BMAD_LANGUAGES } from '../../../shared/types/bmad.types'

const bmadInstallOptionsSchema = z.object({
  modules: z.array(z.string()).min(1, 'At least one module is required'),
  tools: z.array(z.string()),
  userName: z.string().min(1, 'User name is required'),
  communicationLanguage: z.string().default('English'),
  documentOutputLanguage: z.string().default('English'),
  outputFolder: z.string().default('_bmad-output'),
})

export const bmadRouter = router({
  checkNodejs: publicProcedure.query(async () => {
    return BmadInstallService.checkNodejs()
  }),

  checkStatus: publicProcedure.query(async ({ ctx }) => {
    return BmadInstallService.checkBmadStatus(ctx.projectRoot)
  }),

  availableModules: publicProcedure.query(() => {
    return { modules: BMAD_MODULES, tools: BMAD_TOOLS, languages: BMAD_LANGUAGES }
  }),

  installNodejs: publicProcedure.mutation(async () => {
    return BmadInstallService.installNodejs()
  }),

  install: publicProcedure
    .input(bmadInstallOptionsSchema)
    .mutation(async ({ ctx, input }) => {
      return BmadInstallService.installBmad(ctx.projectRoot, input)
    }),

  installToPath: publicProcedure
    .input(bmadInstallOptionsSchema.extend({
      projectPath: z.string().min(1, 'Project path is required'),
    }))
    .mutation(async ({ input }) => {
      const { projectPath, ...options } = input
      return BmadInstallService.installBmad(projectPath, options)
    }),

  update: publicProcedure
    .input(bmadInstallOptionsSchema)
    .mutation(async ({ ctx, input }) => {
      return BmadInstallService.updateBmad(ctx.projectRoot, input)
    }),
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/trpc/routers/bmad.router.test.ts`
Expected: PASS

- [ ] **Step 5: Register the router in appRouter**

Modify `src/main/trpc/index.ts`:
- Add import: `import { bmadRouter } from './routers/bmad.router'`
- Add to appRouter: `bmad: bmadRouter,`

- [ ] **Step 6: Run full test suite to verify nothing is broken**

Run: `npx vitest run src/main/trpc/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/main/trpc/routers/bmad.router.ts src/main/trpc/routers/bmad.router.test.ts src/main/trpc/index.ts
git commit -m "feat: add bmad tRPC router with install, status, and update endpoints"
```

---

### Task 7: BmadSettingsPanel

**Files:**
- Create: `src/renderer/src/components/settings/BmadSettingsPanel.tsx`
- Create: `src/renderer/src/components/settings/BmadSettingsPanel.test.tsx`
- Modify: `src/renderer/src/components/dialogs/SettingsDialog.tsx`

**NOTE:** This task involves UI components. Use `/frontend-design` skill for implementation.

- [ ] **Step 1: Write failing test for the panel**

```typescript
// src/renderer/src/components/settings/BmadSettingsPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BmadSettingsPanel } from './BmadSettingsPanel'

// Mock trpc hooks
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    bmad: {
      checkNodejs: { useQuery: vi.fn().mockReturnValue({ data: { installed: true, version: 'v20.11.0' }, isLoading: false }) },
      checkStatus: { useQuery: vi.fn().mockReturnValue({ data: { installed: false }, isLoading: false }) },
      availableModules: { useQuery: vi.fn().mockReturnValue({
        data: {
          modules: [
            { id: 'core', name: 'Core Framework', builtIn: true },
            { id: 'bmm', name: 'Core Method', builtIn: true },
          ],
          tools: [{ id: 'claude-code', name: 'Claude Code' }],
          languages: ['English', 'Spanish'],
        },
        isLoading: false,
      }) },
      install: { useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }) },
      update: { useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }) },
      installNodejs: { useMutation: vi.fn().mockReturnValue({ mutateAsync: vi.fn(), isPending: false }) },
    },
    useUtils: vi.fn().mockReturnValue({
      bmad: { checkStatus: { invalidate: vi.fn() } },
    }),
  },
}))

describe('BmadSettingsPanel', () => {
  it('renders "Not Installed" badge when BMAD is not installed', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByText('Not Installed')).toBeInTheDocument()
  })

  it('shows install form when BMAD is not installed', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByText('Install BMAD')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/settings/BmadSettingsPanel.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BmadSettingsPanel using /frontend-design skill**

The panel should have:
- Node.js status check (warning + install button if missing)
- When BMAD not installed: form with modules checkboxes, tools checkboxes, user name input, language select, "Install BMAD" button
- When BMAD installed: status badge with version, module/tool tags, editable form, "Update BMAD" button
- Spinner during install/update operations

@frontend-design — Use this skill to implement the component with polished visuals.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/settings/BmadSettingsPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Add BmadSettingsPanel to SettingsDialog**

Modify `src/renderer/src/components/dialogs/SettingsDialog.tsx`:
- Add import: `import { BmadSettingsPanel } from '@renderer/components/settings/BmadSettingsPanel'`
- Add between AgentSettingsPanel and GitLogsPanel:
  ```tsx
  <hr className="border-border" />
  <BmadSettingsPanel />
  ```

- [ ] **Step 6: Run full frontend tests**

Run: `npx vitest run src/renderer/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/settings/BmadSettingsPanel.tsx src/renderer/src/components/settings/BmadSettingsPanel.test.tsx src/renderer/src/components/dialogs/SettingsDialog.tsx
git commit -m "feat: add BmadSettingsPanel to settings dialog with install/update support"
```

---

### Task 8: NewProjectDialog — BMAD Setup Section

**Files:**
- Modify: `src/renderer/src/components/NewProjectDialog.tsx`
- Modify: `src/renderer/src/components/NewProjectDialog.test.tsx`

**NOTE:** This task involves UI components. Use `/frontend-design` skill for implementation.

- [ ] **Step 1: Update existing trpc mock and write failing tests for BMAD section**

The existing test file mocks `trpc.project.create.useMutation` with callback-based `mutate`. Since `handleCreate` is being rewritten to use `mutateAsync` chaining, the mock structure must be updated.

Update the trpc mock in `src/renderer/src/components/NewProjectDialog.test.tsx` to:
1. Add `mutateAsync` to `project.create` mock (returns `{ path: '/test/path', config: { projectName: 'test' } }`)
2. Add `bmad.checkNodejs.useQuery` mock (returns `{ data: { installed: true, version: 'v20' }, isLoading: false }`)
3. Add `bmad.availableModules.useQuery` mock (returns module/tool/language data)
4. Add `bmad.installToPath.useMutation` mock (returns `{ mutateAsync: vi.fn(), isPending: false }`)
5. Keep existing `mutate` on `project.create` for backward compatibility with existing tests
6. Update existing tests that use `mockCreateOnSuccess` callback pattern to work with the new `mutateAsync` flow

Add new test cases:

```typescript
describe('BMAD setup section', () => {
  it('shows BMAD setup section checked by default', () => {
    render(<NewProjectDialog {...defaultProps} />)
    const checkbox = screen.getByRole('checkbox', { name: /initialize bmad/i })
    expect(checkbox).toBeChecked()
  })

  it('shows module checkboxes when BMAD is enabled', () => {
    render(<NewProjectDialog {...defaultProps} />)
    expect(screen.getByText('Core Method')).toBeInTheDocument()
  })

  it('calls bmad.installToPath after project creation when BMAD is enabled', async () => {
    const mockBmadInstall = vi.fn().mockResolvedValue({ success: true })
    // Override the bmad.installToPath mock for this test
    // ... (setup mutateAsync to resolve with project result, then verify bmadInstall was called)

    render(<NewProjectDialog {...defaultProps} />)

    // Fill in project name
    fireEvent.change(screen.getByPlaceholderText('my-project'), { target: { value: 'test' } })
    // Simulate dir selection
    if (mockSelectDirOnSuccess) {
      mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
    }

    // Click create
    fireEvent.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() => {
      expect(mockBmadInstall).toHaveBeenCalledWith(
        expect.objectContaining({ projectPath: '/Users/me/dev/test' })
      )
    })
  })

  it('shows Node.js warning when Node is not installed', () => {
    // Override checkNodejs mock to return { installed: false }
    render(<NewProjectDialog {...defaultProps} />)
    expect(screen.getByText(/node\.js.*required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/src/components/NewProjectDialog.test.tsx`
Expected: FAIL — new elements not found

- [ ] **Step 3: Implement BMAD section using /frontend-design skill**

Modify `NewProjectDialog.tsx`:

Key changes:
1. Add state for BMAD options: `installBmad` (boolean, default true), `bmadModules`, `bmadTools`, `userName`, `language`
2. Add `bmad.checkNodejs` query on dialog open
3. Add `bmad.installToPath` mutation
4. Rewrite `handleCreate` to use `mutateAsync` chaining:
   ```typescript
   const handleCreate = async () => {
     if (!parentDir || !projectName.trim()) return
     setCreateError(null)
     try {
       const result = await createMutation.mutateAsync({ parentDir, projectName: projectName.trim() })
       if (installBmad) {
         try {
           await bmadInstallMutation.mutateAsync({
             projectPath: result.path,
             modules: bmadModules,
             tools: bmadTools,
             userName,
             communicationLanguage: language,
             documentOutputLanguage: language,
             outputFolder: '_bmad-output',
           })
         } catch (bmadErr) {
           // BMAD failed but project was created — toast and continue
           toast.error('BMAD setup failed — you can retry from Settings')
         }
       }
       onProjectCreated({ path: result.path, projectName: result.config.projectName })
       onOpenChange(false)
     } catch (err) {
       setCreateError(err instanceof Error ? err.message : 'Failed to create project')
     }
   }
   ```
5. Add BMAD form section after Location (divider, checkbox, collapsible options)
6. Show Node.js warning if not installed

@frontend-design — Use this skill to implement the BMAD section with polished visuals matching the existing dialog style.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/src/components/NewProjectDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/NewProjectDialog.tsx src/renderer/src/components/NewProjectDialog.test.tsx
git commit -m "feat: add BMAD setup section to NewProjectDialog with default-on install"
```

---

### Task 9: Integration Test & Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No errors (fix any that appear)

- [ ] **Step 4: Manual smoke test (dev mode)**

Run: `npm run dev:linux`
- Open Settings → verify BmadSettingsPanel appears
- Create new project → verify BMAD section appears with defaults
- If Node.js is available, test the install flow

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from BMAD install feature"
```
