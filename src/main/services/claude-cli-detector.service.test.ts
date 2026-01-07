import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClaudeCliDetectorService } from './claude-cli-detector.service'
import { exec } from 'child_process'

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

describe('ClaudeCliDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache before each test
    ClaudeCliDetectorService.clearCache()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('isClaudeCodeInstalled', () => {
    it('returns true when claude is in PATH', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '/usr/local/bin/claude\n', stderr: '' }
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await ClaudeCliDetectorService.isClaudeCodeInstalled()

      expect(result).toBe(true)
    })

    it('returns false when claude is not installed', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        const error = new Error('Command failed: which claude') as Error & { code?: number }
        error.code = 1
        ;(callback as (error: Error | null, result?: { stdout: string; stderr: string }) => void)(
          error
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await ClaudeCliDetectorService.isClaudeCodeInstalled()

      expect(result).toBe(false)
    })

    it('caches the result after first check', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '/usr/local/bin/claude\n', stderr: '' }
        )
        return {} as ReturnType<typeof exec>
      })

      // First call
      await ClaudeCliDetectorService.isClaudeCodeInstalled()
      // Second call should use cache
      await ClaudeCliDetectorService.isClaudeCodeInstalled()

      expect(exec).toHaveBeenCalledTimes(1)
    })
  })

  describe('getClaudeCodePath', () => {
    it('returns path when getClaudeCodePath succeeds', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '/usr/local/bin/claude\n', stderr: '' }
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await ClaudeCliDetectorService.getClaudeCodePath()

      expect(result).toBe('/usr/local/bin/claude')
    })

    it('returns null when claude is not found', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        const error = new Error('Command failed') as Error & { code?: number }
        error.code = 1
        ;(callback as (error: Error | null, result?: { stdout: string; stderr: string }) => void)(
          error
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await ClaudeCliDetectorService.getClaudeCodePath()

      expect(result).toBeNull()
    })

    it('trims whitespace from path', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '  /opt/claude/bin/claude  \n', stderr: '' }
        )
        return {} as ReturnType<typeof exec>
      })

      const result = await ClaudeCliDetectorService.getClaudeCodePath()

      expect(result).toBe('/opt/claude/bin/claude')
    })
  })

  describe('clearCache', () => {
    it('allows re-checking after cache clear', async () => {
      vi.mocked(exec).mockImplementation((_cmd, callback) => {
        ;(callback as (error: Error | null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: '/usr/local/bin/claude\n', stderr: '' }
        )
        return {} as ReturnType<typeof exec>
      })

      // First call
      await ClaudeCliDetectorService.isClaudeCodeInstalled()
      expect(exec).toHaveBeenCalledTimes(1)

      // Clear cache
      ClaudeCliDetectorService.clearCache()

      // Third call should re-check
      await ClaudeCliDetectorService.isClaudeCodeInstalled()
      expect(exec).toHaveBeenCalledTimes(2)
    })
  })
})
