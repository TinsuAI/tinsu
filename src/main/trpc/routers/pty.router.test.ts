import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ptyRouter } from './pty.router'
import { ptyService } from '../../services/pty.service'
import { TRPCError } from '@trpc/server'

// Helper to create a test caller
function createTestCaller(): ReturnType<typeof ptyRouter.createCaller> {
  const createCaller = ptyRouter.createCaller
  return createCaller({
    db: {} as never,
    projectRoot: process.cwd()
  })
}

describe('ptyRouter', () => {
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    caller = createTestCaller()
  })

  afterEach(() => {
    // Clean up all PTY processes after each test
    ptyService.killAll()
  })

  describe('spawn', () => {
    it('should spawn a process and return process ID', async () => {
      const processId = await caller.spawn({})

      expect(processId).toBeDefined()
      // UUID v4 format
      expect(processId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    it('should spawn with default shell command when not specified', async () => {
      const processId = await caller.spawn({})

      const proc = ptyService.getProcess(processId)
      expect(proc).toBeDefined()
      expect(proc?.command).toBe('/bin/bash')
    })

    it('should spawn with custom command and args', async () => {
      const processId = await caller.spawn({
        command: 'echo',
        args: ['hello', 'world']
      })

      const proc = ptyService.getProcess(processId)
      expect(proc?.command).toBe('echo')
      expect(proc?.args).toEqual(['hello', 'world'])
    })

    it('should spawn with custom working directory', async () => {
      const processId = await caller.spawn({
        command: 'pwd',
        cwd: '/tmp'
      })

      const proc = ptyService.getProcess(processId)
      expect(proc?.cwd).toBe('/tmp')
    })

    it('should spawn with custom dimensions', async () => {
      const processId = await caller.spawn({
        cols: 120,
        rows: 40
      })

      expect(processId).toBeDefined()
      // Process should be created successfully
      expect(ptyService.getProcess(processId)).toBeDefined()
    })
  })

  describe('write', () => {
    it('should write data to a running process', async () => {
      const processId = await caller.spawn({ command: 'cat' })

      // Wait for process to start
      await new Promise((r) => setTimeout(r, 100))

      // Should not throw
      await caller.write({ processId, data: 'test data\n' })

      // Kill the process to clean up
      ptyService.kill(processId)
    })

    it('should throw NOT_FOUND for non-existent process', async () => {
      await expect(
        caller.write({ processId: 'non-existent-id', data: 'test' })
      ).rejects.toThrowError(TRPCError)

      try {
        await caller.write({ processId: 'non-existent-id', data: 'test' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('kill', () => {
    it('should kill a running process', async () => {
      const processId = await caller.spawn({ command: 'sleep', args: ['60'] })
      expect(ptyService.getProcess(processId)).toBeDefined()

      await caller.kill({ processId })

      // Wait for process cleanup
      await new Promise((r) => setTimeout(r, 100))

      // Process should be cleaned up after exit
      expect(ptyService.getProcess(processId)).toBeUndefined()
    })

    it('should be a silent no-op for non-existent process', async () => {
      // Should not throw
      await expect(caller.kill({ processId: 'non-existent-id' })).resolves.not.toThrow()
    })
  })

  describe('resize', () => {
    it('should resize a running process', async () => {
      const processId = await caller.spawn({})

      // Should not throw
      await caller.resize({ processId, cols: 120, rows: 40 })

      ptyService.kill(processId)
    })

    it('should throw NOT_FOUND for non-existent process', async () => {
      await expect(
        caller.resize({ processId: 'non-existent-id', cols: 80, rows: 24 })
      ).rejects.toThrowError(TRPCError)

      try {
        await caller.resize({ processId: 'non-existent-id', cols: 80, rows: 24 })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })

    it('should validate positive integer dimensions via Zod schema', async () => {
      const processId = await caller.spawn({})

      // Invalid dimensions should fail Zod validation
      await expect(caller.resize({ processId, cols: 0, rows: 24 })).rejects.toThrow()
      await expect(caller.resize({ processId, cols: 80, rows: 0 })).rejects.toThrow()
      await expect(caller.resize({ processId, cols: -1, rows: 24 })).rejects.toThrow()
      await expect(caller.resize({ processId, cols: 80.5, rows: 24 })).rejects.toThrow()

      ptyService.kill(processId)
    })
  })

  // Note: Subscription tests would require a different testing approach
  // as tRPC subscriptions are tested differently (typically via integration tests)
  // The subscriptions are tested indirectly through the pty.service.test.ts
})
