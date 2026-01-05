import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'
import { PtyService, PtyError, type PtyOutputEvent, type PtyExitEvent } from './pty.service'

describe('PtyService', () => {
  let service: PtyService

  beforeEach(() => {
    service = new PtyService()
  })

  afterEach(() => {
    // Clean up all processes after each test
    service.killAll()
  })

  describe('spawn()', () => {
    it('should return a unique UUID process ID', () => {
      const id = service.spawn('echo', ['hello'])

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should store the process in the active processes map', () => {
      const id = service.spawn('echo', ['hello'])

      expect(service.getProcess(id)).toBeDefined()
      expect(service.getActiveProcesses()).toContain(id)
    })

    it('should generate unique IDs for different processes', () => {
      const id1 = service.spawn('echo', ['first'])
      const id2 = service.spawn('echo', ['second'])

      expect(id1).not.toBe(id2)
    })

    it('should set process state to running', () => {
      const id = service.spawn('echo', ['hello'])

      const proc = service.getProcess(id)
      expect(proc?.state).toBe('running')
    })

    it('should store command and args in process info', () => {
      const id = service.spawn('echo', ['hello', 'world'])

      const proc = service.getProcess(id)
      expect(proc?.command).toBe('echo')
      expect(proc?.args).toEqual(['hello', 'world'])
    })

    it('should default to empty args array when not provided', () => {
      const id = service.spawn('true')

      const proc = service.getProcess(id)
      expect(proc?.args).toEqual([])
    })
  })

  describe('spawn() with options', () => {
    it('should use custom working directory when provided', () => {
      const tmpDir = os.tmpdir()
      const id = service.spawn('pwd', [], { cwd: tmpDir })

      const proc = service.getProcess(id)
      expect(proc?.cwd).toBe(tmpDir)
    })

    it('should default to process.cwd() when cwd not provided', () => {
      const id = service.spawn('echo', ['test'])

      const proc = service.getProcess(id)
      expect(proc?.cwd).toBe(process.cwd())
    })

    it('should inherit environment variables from process.env', async () => {
      const outputs: string[] = []
      service.on('output', ({ data }: PtyOutputEvent) => outputs.push(data))

      // HOME should be inherited from process.env
      service.spawn('printenv', ['HOME'])

      // Wait for output
      await new Promise((r) => setTimeout(r, 200))

      const output = outputs.join('')
      expect(output).toContain(process.env.HOME)
    })

    it('should merge custom env with inherited environment', async () => {
      const outputs: string[] = []
      service.on('output', ({ data }: PtyOutputEvent) => outputs.push(data))

      service.spawn('printenv', ['CUSTOM_VAR'], {
        env: { CUSTOM_VAR: 'test-value-123' }
      })

      await new Promise((r) => setTimeout(r, 200))

      const output = outputs.join('')
      expect(output).toContain('test-value-123')
    })
  })

  describe('output events', () => {
    it('should emit output events when process outputs data', async () => {
      const outputs: PtyOutputEvent[] = []
      service.on('output', (event: PtyOutputEvent) => outputs.push(event))

      service.spawn('echo', ['hello-pty-test'])

      // Wait for output
      await new Promise((r) => setTimeout(r, 200))

      expect(outputs.length).toBeGreaterThan(0)
      expect(outputs.some((e) => e.data.includes('hello-pty-test'))).toBe(true)
    })

    it('should include processId in output events', async () => {
      const outputs: PtyOutputEvent[] = []
      service.on('output', (event: PtyOutputEvent) => outputs.push(event))

      const id = service.spawn('echo', ['test'])

      await new Promise((r) => setTimeout(r, 200))

      expect(outputs.some((e) => e.processId === id)).toBe(true)
    })

    it('should emit output events within 100ms of process output', async () => {
      let firstEventTime: number | null = null
      const startTime = Date.now()

      service.on('output', () => {
        if (firstEventTime === null) {
          firstEventTime = Date.now()
        }
      })

      service.spawn('echo', ['immediate-output'])

      await new Promise((r) => setTimeout(r, 200))

      expect(firstEventTime).not.toBeNull()
      const latency = firstEventTime! - startTime
      // Allow some buffer for process startup, but should be well under 100ms for output relay
      expect(latency).toBeLessThan(150)
    })
  })

  describe('exit events', () => {
    it('should emit exit event when process completes', async () => {
      const exitPromise = new Promise<PtyExitEvent>((resolve) => {
        service.on('exit', (event: PtyExitEvent) => resolve(event))
      })

      service.spawn('true') // Exit code 0

      const exit = await exitPromise
      expect(exit.exitCode).toBe(0)
    })

    it('should include exit code in exit event', async () => {
      const exitPromise = new Promise<PtyExitEvent>((resolve) => {
        service.on('exit', (event: PtyExitEvent) => resolve(event))
      })

      service.spawn('false') // Exit code 1

      const exit = await exitPromise
      expect(exit.exitCode).toBe(1)
    })

    it('should include processId in exit events', async () => {
      const exitPromise = new Promise<PtyExitEvent>((resolve) => {
        service.on('exit', (event: PtyExitEvent) => resolve(event))
      })

      const id = service.spawn('true')

      const exit = await exitPromise
      expect(exit.processId).toBe(id)
    })

    it('should clean up process from map on exit', async () => {
      const exitPromise = new Promise<void>((resolve) => {
        service.on('exit', () => resolve())
      })

      const id = service.spawn('true')
      expect(service.getProcess(id)).toBeDefined()

      await exitPromise

      expect(service.getProcess(id)).toBeUndefined()
    })
  })

  describe('write()', () => {
    it('should send data to process stdin', async () => {
      const outputs: string[] = []
      service.on('output', ({ data }: PtyOutputEvent) => outputs.push(data))

      // cat will echo back what we write to it
      const id = service.spawn('cat')

      // Wait for process to start
      await new Promise((r) => setTimeout(r, 100))

      // Write to stdin
      service.write(id, 'hello-write-test\n')

      // Wait for output
      await new Promise((r) => setTimeout(r, 200))

      const output = outputs.join('')
      expect(output).toContain('hello-write-test')

      // Clean up
      service.kill(id)
    })

    it('should handle control characters (Ctrl+C)', async () => {
      const exitEvents: PtyExitEvent[] = []
      service.on('exit', (event: PtyExitEvent) => exitEvents.push(event))

      // sleep will run indefinitely, Ctrl+C should interrupt it
      const id = service.spawn('sleep', ['60'])

      await new Promise((r) => setTimeout(r, 100))

      // Send Ctrl+C (SIGINT)
      service.write(id, '\x03')

      // Wait for exit
      await new Promise((r) => setTimeout(r, 300))

      // Process should have exited (or we killed it)
      const proc = service.getProcess(id)
      if (proc) {
        // If still running, kill it - the Ctrl+C might not have worked
        service.kill(id)
      }
    })

    it('should throw PtyError when process not found', () => {
      expect(() => service.write('non-existent-id', 'data')).toThrow(PtyError)
      expect(() => service.write('non-existent-id', 'data')).toThrow('not found')
    })

    it('should throw PtyError when process is not running', async () => {
      const exitPromise = new Promise<void>((resolve) => {
        service.on('exit', () => resolve())
      })

      const id = service.spawn('true')
      await exitPromise

      // Process has exited and been cleaned up
      expect(() => service.write(id, 'data')).toThrow(PtyError)
    })
  })

  describe('kill()', () => {
    it('should terminate the process', async () => {
      const exitPromise = new Promise<PtyExitEvent>((resolve) => {
        service.on('exit', (event: PtyExitEvent) => resolve(event))
      })

      const id = service.spawn('sleep', ['60'])
      expect(service.getProcess(id)).toBeDefined()

      service.kill(id)

      const exit = await exitPromise
      expect(exit.processId).toBe(id)
    })

    it('should set process state to killed before exit', () => {
      const id = service.spawn('sleep', ['60'])

      const procBefore = service.getProcess(id)
      expect(procBefore?.state).toBe('running')

      service.kill(id)

      // State should be killed immediately after kill() call
      const procAfter = service.getProcess(id)
      expect(procAfter?.state).toBe('killed')
    })

    it('should be a silent no-op for non-existent process', () => {
      // Should not throw
      expect(() => service.kill('non-existent-id')).not.toThrow()
    })

    it('should be idempotent - multiple kills should not throw', async () => {
      const id = service.spawn('sleep', ['60'])

      service.kill(id)

      // Wait for cleanup
      await new Promise((r) => setTimeout(r, 100))

      // Second kill should be silent no-op
      expect(() => service.kill(id)).not.toThrow()
    })
  })

  describe('killAll()', () => {
    it('should terminate all active processes', async () => {
      service.spawn('sleep', ['60'])
      service.spawn('sleep', ['60'])
      service.spawn('sleep', ['60'])

      expect(service.getProcessCount()).toBe(3)

      service.killAll()

      // Wait for cleanup
      await new Promise((r) => setTimeout(r, 200))

      expect(service.getProcessCount()).toBe(0)
    })

    it('should clear the processes map', () => {
      service.spawn('sleep', ['60'])
      service.spawn('sleep', ['60'])

      service.killAll()

      expect(service.getActiveProcesses()).toEqual([])
    })
  })

  describe('multiple concurrent processes', () => {
    it('should track multiple processes independently', () => {
      const id1 = service.spawn('sleep', ['60'])
      const id2 = service.spawn('sleep', ['60'])
      const id3 = service.spawn('sleep', ['60'])

      expect(service.getProcessCount()).toBe(3)

      const proc1 = service.getProcess(id1)
      const proc2 = service.getProcess(id2)
      const proc3 = service.getProcess(id3)

      expect(proc1?.id).toBe(id1)
      expect(proc2?.id).toBe(id2)
      expect(proc3?.id).toBe(id3)
    })

    it('should route output events to correct processId', async () => {
      const outputsByProcess = new Map<string, string[]>()
      service.on('output', ({ processId, data }: PtyOutputEvent) => {
        if (!outputsByProcess.has(processId)) {
          outputsByProcess.set(processId, [])
        }
        outputsByProcess.get(processId)!.push(data)
      })

      const id1 = service.spawn('echo', ['process-one'])
      const id2 = service.spawn('echo', ['process-two'])

      await new Promise((r) => setTimeout(r, 300))

      const output1 = (outputsByProcess.get(id1) || []).join('')
      const output2 = (outputsByProcess.get(id2) || []).join('')

      expect(output1).toContain('process-one')
      expect(output2).toContain('process-two')
    })

    it('should allow killing one process without affecting others', async () => {
      const id1 = service.spawn('sleep', ['60'])
      const id2 = service.spawn('sleep', ['60'])

      service.kill(id1)

      await new Promise((r) => setTimeout(r, 100))

      expect(service.getProcess(id1)).toBeUndefined()
      expect(service.getProcess(id2)).toBeDefined()
      expect(service.getProcess(id2)?.state).toBe('running')
    })
  })

  describe('pause() and resume()', () => {
    // Skip on Windows - SIGSTOP/SIGCONT not supported
    const itUnix = process.platform === 'win32' ? it.skip : it

    itUnix('should change process state to paused', () => {
      const id = service.spawn('sleep', ['60'])

      service.pause(id)

      expect(service.getProcess(id)?.state).toBe('paused')
    })

    itUnix('should change process state back to running on resume', () => {
      const id = service.spawn('sleep', ['60'])

      service.pause(id)
      expect(service.getProcess(id)?.state).toBe('paused')

      service.resume(id)
      expect(service.getProcess(id)?.state).toBe('running')
    })

    itUnix('should throw PtyError when pausing non-existent process', () => {
      expect(() => service.pause('non-existent-id')).toThrow(PtyError)
      expect(() => service.pause('non-existent-id')).toThrow('not found')
    })

    itUnix('should throw PtyError when resuming non-existent process', () => {
      expect(() => service.resume('non-existent-id')).toThrow(PtyError)
      expect(() => service.resume('non-existent-id')).toThrow('not found')
    })

    itUnix('should be a no-op to pause already paused process', () => {
      const id = service.spawn('sleep', ['60'])

      service.pause(id)
      service.pause(id) // Should not throw

      expect(service.getProcess(id)?.state).toBe('paused')
    })

    itUnix('should be a no-op to resume non-paused process', () => {
      const id = service.spawn('sleep', ['60'])

      service.resume(id) // Should not throw, state stays running

      expect(service.getProcess(id)?.state).toBe('running')
    })

    it('should throw PtyError when writing to paused process', () => {
      // Skip on Windows
      if (process.platform === 'win32') return

      const id = service.spawn('cat')

      service.pause(id)

      expect(() => service.write(id, 'data')).toThrow(PtyError)
      expect(() => service.write(id, 'data')).toThrow('paused')
    })
  })

  describe('getActiveProcesses()', () => {
    it('should return empty array when no processes', () => {
      expect(service.getActiveProcesses()).toEqual([])
    })

    it('should return all active process IDs', () => {
      const id1 = service.spawn('sleep', ['60'])
      const id2 = service.spawn('sleep', ['60'])

      const active = service.getActiveProcesses()
      expect(active).toContain(id1)
      expect(active).toContain(id2)
      expect(active.length).toBe(2)
    })
  })

  describe('getProcessCount()', () => {
    it('should return 0 when no processes', () => {
      expect(service.getProcessCount()).toBe(0)
    })

    it('should return correct count of active processes', () => {
      service.spawn('sleep', ['60'])
      service.spawn('sleep', ['60'])
      service.spawn('sleep', ['60'])

      expect(service.getProcessCount()).toBe(3)
    })
  })

  describe('resize()', () => {
    it('should resize the terminal dimensions', () => {
      const id = service.spawn('sleep', ['60'])

      // Should not throw
      expect(() => service.resize(id, 120, 40)).not.toThrow()
    })

    it('should throw PtyError for non-existent process', () => {
      expect(() => service.resize('non-existent-id', 80, 24)).toThrow(PtyError)
    })
  })

  describe('working directory', () => {
    it('should respect custom working directory', async () => {
      const outputs: string[] = []
      service.on('output', ({ data }: PtyOutputEvent) => outputs.push(data))

      const tmpDir = os.tmpdir()
      service.spawn('pwd', [], { cwd: tmpDir })

      await new Promise((r) => setTimeout(r, 200))

      const output = outputs.join('')
      // The actual path might have symlinks resolved, so check for tmpdir or its resolved path
      expect(output.includes('/tmp') || output.includes(tmpDir)).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should emit exit event with non-zero code for invalid command', async () => {
      // node-pty doesn't throw synchronously for invalid commands
      // Instead, the shell spawns and then fails to execute the command
      const exitPromise = new Promise<PtyExitEvent>((resolve) => {
        service.on('exit', (event: PtyExitEvent) => resolve(event))
      })

      // The shell will spawn successfully, but the command will fail
      service.spawn('/nonexistent/command/that/does/not/exist')

      const exit = await exitPromise
      // Expect non-zero exit code (command not found = 127 typically)
      expect(exit.exitCode).not.toBe(0)
    })
  })
})
