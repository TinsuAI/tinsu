import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exec } from 'child_process'

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

// Mock TmuxService to isolate
vi.mock('./tmux.service', () => ({
  TmuxService: {
    checkTmuxInstalled: vi.fn(),
    getTmuxVersion: vi.fn(),
    getInstallInstructions: vi.fn()
  }
}))

// Mock BmadInstallService to isolate
vi.mock('./bmad-install.service', () => ({
  BmadInstallService: {
    checkNodejs: vi.fn(),
    checkBmadStatus: vi.fn()
  }
}))

import { ToolVerificationService } from './tool-verification.service'
import { TmuxService } from './tmux.service'
import { BmadInstallService } from './bmad-install.service'

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

      expect(result.id).toBe('git')
      expect(result.status).toBe('installed')
      expect(result.version).toBe('2.43.0')
      expect(result.critical).toBe(true)
    })

    it('returns missing when git is not found', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          const error = new Error('Command not found: git') as Error & { code?: number }
          error.code = 127
          callback(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkGit()

      expect(result.id).toBe('git')
      expect(result.status).toBe('missing')
      expect(result.version).toBeUndefined()
      expect(result.critical).toBe(true)
      expect(result.installHint).toBeDefined()
    })
  })

  describe('checkClaude', () => {
    it('returns installed with version when claude is available', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(null, '1.2.3\n', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkClaude()

      expect(result.id).toBe('claude-cli')
      expect(result.status).toBe('installed')
      expect(result.version).toBeTruthy()
      expect(result.critical).toBe(true)
    })

    it('returns missing when claude is not found', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          const error = new Error('Command not found: claude') as Error & { code?: number }
          error.code = 127
          callback(error, '', '')
          return {} as ReturnType<typeof exec>
        }
      )

      const result = await ToolVerificationService.checkClaude()

      expect(result.id).toBe('claude-cli')
      expect(result.status).toBe('missing')
      expect(result.version).toBeUndefined()
      expect(result.critical).toBe(true)
      expect(result.installHint).toBe('npm install -g @anthropic-ai/claude-code')
    })
  })

  describe('checkTmux', () => {
    it('returns installed when tmux is available', async () => {
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(TmuxService.getTmuxVersion).mockResolvedValue('3.4')
      vi.mocked(TmuxService.getInstallInstructions).mockReturnValue('brew install tmux')

      const result = await ToolVerificationService.checkTmux()

      expect(result.id).toBe('tmux')
      expect(result.status).toBe('installed')
      expect(result.critical).toBe(true)
    })

    it('returns missing when tmux is not installed', async () => {
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(false)
      vi.mocked(TmuxService.getInstallInstructions).mockReturnValue('brew install tmux')

      const result = await ToolVerificationService.checkTmux()

      expect(result.id).toBe('tmux')
      expect(result.status).toBe('missing')
      expect(result.critical).toBe(true)
      expect(result.installHint).toBeDefined()
    })
  })

  describe('checkNodejs', () => {
    it('returns installed with version when node is available', async () => {
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })

      const result = await ToolVerificationService.checkNodejs()

      expect(result.id).toBe('nodejs')
      expect(result.status).toBe('installed')
      expect(result.version).toBe('20.11.0')
      expect(result.critical).toBe(true)
    })

    it('returns missing when node is not installed', async () => {
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: false,
        version: null
      })

      const result = await ToolVerificationService.checkNodejs()

      expect(result.id).toBe('nodejs')
      expect(result.status).toBe('missing')
      expect(result.critical).toBe(true)
      expect(result.installHint).toBeDefined()
    })
  })

  describe('checkBmad', () => {
    it('returns installed when bmad is found', async () => {
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: true,
        version: '6.2.0'
      })

      const result = await ToolVerificationService.checkBmad('/some/project')

      expect(result.id).toBe('bmad')
      expect(result.status).toBe('installed')
      expect(result.version).toBe('6.2.0')
      expect(result.critical).toBe(true)
    })

    it('returns missing when bmad is not installed', async () => {
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: false
      })

      const result = await ToolVerificationService.checkBmad('/some/project')

      expect(result.id).toBe('bmad')
      expect(result.status).toBe('missing')
      expect(result.critical).toBe(true)
      expect(result.installHint).toBe('BMAD can be installed from the setup wizard below.')
    })
  })

  describe('verifyAllTools', () => {
    it('returns results for all 5 tools', async () => {
      // Mock all dependencies
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          if (_cmd.includes('git')) {
            callback(null, 'git version 2.43.0\n', '')
          } else if (_cmd.includes('claude')) {
            callback(null, '1.2.3\n', '')
          }
          return {} as ReturnType<typeof exec>
        }
      )
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(TmuxService.getInstallInstructions).mockReturnValue('brew install tmux')
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: true,
        version: '6.2.0'
      })

      const results = await ToolVerificationService.verifyAllTools('/some/project')

      expect(results).toHaveLength(5)
      const ids = results.map((r) => r.id)
      expect(ids).toContain('git')
      expect(ids).toContain('tmux')
      expect(ids).toContain('nodejs')
      expect(ids).toContain('claude-cli')
      expect(ids).toContain('bmad')
    })

    it('returns results in [git, tmux, nodejs, claude, bmad] order', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          callback(null, 'git version 2.43.0\n', '')
          return {} as ReturnType<typeof exec>
        }
      )
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(TmuxService.getInstallInstructions).mockReturnValue('brew install tmux')
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })
      vi.mocked(BmadInstallService.checkBmadStatus).mockResolvedValue({
        installed: false
      })

      const results = await ToolVerificationService.verifyAllTools('/some/project')

      expect(results[0].id).toBe('git')
      expect(results[1].id).toBe('tmux')
      expect(results[2].id).toBe('nodejs')
      expect(results[3].id).toBe('claude-cli')
      expect(results[4].id).toBe('bmad')
    })
  })

  describe('verifyHealthTools', () => {
    it('returns only critical tools without bmad (4 tools)', async () => {
      ;(vi.mocked(exec) as any).mockImplementation(
        (_cmd: string, callback: Function) => {
          if (_cmd.includes('git')) {
            callback(null, 'git version 2.43.0\n', '')
          } else if (_cmd.includes('claude')) {
            callback(null, '1.2.3\n', '')
          }
          return {} as ReturnType<typeof exec>
        }
      )
      vi.mocked(TmuxService.checkTmuxInstalled).mockResolvedValue(true)
      vi.mocked(TmuxService.getInstallInstructions).mockReturnValue('brew install tmux')
      vi.mocked(BmadInstallService.checkNodejs).mockResolvedValue({
        installed: true,
        version: 'v20.11.0'
      })

      const results = await ToolVerificationService.verifyHealthTools()

      expect(results).toHaveLength(4)
      const ids = results.map((r) => r.id)
      expect(ids).toContain('git')
      expect(ids).toContain('tmux')
      expect(ids).toContain('nodejs')
      expect(ids).toContain('claude-cli')
      expect(ids).not.toContain('bmad')
    })
  })
})
