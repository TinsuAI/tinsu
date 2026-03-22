import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import { exec } from 'child_process'
import { shell } from 'electron'
import { BmadInstallService } from './bmad-install.service'

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn()
}))

// Mock electron shell
vi.mock('electron', () => ({
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock fs module for existsSync/readFileSync
vi.mock('fs')

describe('BmadInstallService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('checkNodejs', () => {
    it('returns installed true with version when node is found', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, stdout: string, stderr: string) => void)(
          null,
          'v20.11.0\n',
          ''
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await BmadInstallService.checkNodejs()

      expect(result.installed).toBe(true)
      expect(result.version).toBe('v20.11.0')
    })

    it('returns installed false when node is not found', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        const error = new Error('Command failed: node --version') as Error & { code?: number }
        error.code = 1
        ;(callback as (error: Error | null, stdout?: string, stderr?: string) => void)(error)
        return {} as ReturnType<typeof exec>
      })

      const result = await BmadInstallService.checkNodejs()

      expect(result.installed).toBe(false)
      expect(result.version).toBeNull()
    })
  })

  describe('installNodejs', () => {
    const originalPlatform = process.platform

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('opens terminal with install command on linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' })

      // exec is already mocked; just ensure it gets called
      vi.mocked(exec).mockImplementation(() => {
        return {} as ReturnType<typeof exec>
      })

      const result = await BmadInstallService.installNodejs()

      expect(result.success).toBe(true)
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('nodesource'))
    })

    it('opens nodejs.org on windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32' })

      const result = await BmadInstallService.installNodejs()

      expect(result.success).toBe(true)
      expect(shell.openExternal).toHaveBeenCalledWith('https://nodejs.org/en/download/')
    })
  })

  describe('checkBmadStatus', () => {
    it('returns not installed when _bmad dir does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = await BmadInstallService.checkBmadStatus('/test/project')

      expect(result.installed).toBe(false)
    })

    it('returns installed with version and modules when CLI succeeds', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const cliOutput = `◇  BMAD Status
│  Version:       6.2.0
│  Location:      /test/project/_bmad
◇  Module Versions
│  Built-in Modules
│    core                 6.2.0 ✓
│    bmm                  6.2.0 ✓
│  External Modules (Official)
│    cis                  0.1.9 ✓
│    tea                  1.7.1 ✓`

      // checkBmadStatus uses 3-arg exec(cmd, options, callback)
      vi.mocked(exec).mockImplementation((_cmd: unknown, optionsOrCb: unknown, cb?: unknown) => {
        const callback = (typeof optionsOrCb === 'function' ? optionsOrCb : cb) as (
          error: Error | null,
          stdout: string,
          stderr: string
        ) => void
        callback(null, cliOutput, '')
        return {} as ReturnType<typeof exec>
      })

      const result = await BmadInstallService.checkBmadStatus('/test/project')

      expect(result.installed).toBe(true)
      expect(result.version).toBe('6.2.0')
      expect(result.modules).toEqual(['core', 'bmm', 'cis', 'tea'])
    })

    it('falls back to config.yaml parsing when CLI fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('version: 6.0.0\nmodules:\n  - core\n')

      // Make exec fail for the CLI call
      vi.mocked(exec).mockImplementation((_cmd: unknown, optionsOrCb: unknown, cb?: unknown) => {
        const callback = (typeof optionsOrCb === 'function' ? optionsOrCb : cb) as (
          error: Error | null,
          stdout?: string,
          stderr?: string
        ) => void
        callback(new Error('npx not found'))
        return {} as ReturnType<typeof exec>
      })

      const result = await BmadInstallService.checkBmadStatus('/test/project')

      expect(result.installed).toBe(true)
    })
  })
})
