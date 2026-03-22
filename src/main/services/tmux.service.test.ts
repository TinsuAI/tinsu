import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TmuxService } from './tmux.service'
import { exec } from 'child_process'

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

describe('TmuxService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test
    TmuxService.clearCache()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('checkTmuxInstalled', () => {
    it('returns true when tmux is installed', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.checkTmuxInstalled()

      expect(result).toBe(true)
    })

    it('returns false when tmux is not installed (exit code 127)', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        // Handle both (cmd, callback) and (cmd, options, callback) signatures
        const cb = typeof _options === 'function' ? _options : callback
        const error = new Error('Command failed: tmux -V') as Error & { code?: number }
        error.code = 127
        ;(cb as any)(error)
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.checkTmuxInstalled()

      expect(result).toBe(false)
    })

    it('throws error for non-installation failures (e.g., permission denied)', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        const error = new Error('Permission denied') as Error & { code?: number }
        error.code = 126 // Permission denied exit code
        ;(cb as any)(error)
        return {} as ReturnType<typeof exec>
      })

      await expect(TmuxService.checkTmuxInstalled()).rejects.toThrow('Permission denied')
    })

    it('caches the result after first check', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      // First call
      await TmuxService.checkTmuxInstalled()
      // Second call should use cache
      await TmuxService.checkTmuxInstalled()

      expect(exec).toHaveBeenCalledTimes(1)
    })
  })

  describe('getTmuxVersion', () => {
    it('returns version string when tmux is installed', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.getTmuxVersion()

      expect(result).toBe('3.4')
    })

    it('returns version with prefix (e.g., next-3.5)', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux next-3.5\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.getTmuxVersion()

      expect(result).toBe('next-3.5')
    })

    it('returns null when tmux is not installed', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        const error = new Error('Command failed') as Error & { code?: number }
        error.code = 127
        ;(cb as any)(error)
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.getTmuxVersion()

      expect(result).toBeNull()
    })

    it('trims whitespace from version', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: '  tmux 3.3a  \n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      const result = await TmuxService.getTmuxVersion()

      expect(result).toBe('3.3a')
    })

    it('caches the version after first check', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      // First call
      await TmuxService.getTmuxVersion()
      // Second call should use cache
      await TmuxService.getTmuxVersion()

      expect(exec).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearCache', () => {
    it('allows re-checking after cache clear', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      // First call
      await TmuxService.checkTmuxInstalled()
      expect(exec).toHaveBeenCalledTimes(1)

      // Clear cache
      TmuxService.clearCache()

      // Third call should re-check
      await TmuxService.checkTmuxInstalled()
      expect(exec).toHaveBeenCalledTimes(2)
    })

    it('clears both installed and version caches', async () => {
      (vi.mocked(exec) as any).mockImplementation((_cmd: string, _options: unknown, callback?: Function) => {
        const cb = typeof _options === 'function' ? _options : callback
        ;(cb as any)(null, {
          stdout: 'tmux 3.4\n',
          stderr: ''
        })
        return {} as ReturnType<typeof exec>
      })

      // First calls
      await TmuxService.checkTmuxInstalled()
      await TmuxService.getTmuxVersion()
      expect(exec).toHaveBeenCalledTimes(2)

      // Clear cache
      TmuxService.clearCache()

      // Both should re-check
      await TmuxService.checkTmuxInstalled()
      await TmuxService.getTmuxVersion()
      expect(exec).toHaveBeenCalledTimes(4)
    })
  })

  describe('getInstallInstructions', () => {
    it('returns installation instructions string', () => {
      const instructions = TmuxService.getInstallInstructions()

      expect(instructions).toContain('tmux')
      expect(instructions).toContain('brew install tmux')
      expect(instructions).toContain('sudo apt install tmux')
      expect(instructions).toContain('sudo dnf install tmux')
      expect(instructions).toContain('After installing, restart TinSu')
    })
  })
})
