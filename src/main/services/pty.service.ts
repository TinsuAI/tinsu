import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

/**
 * Custom error class for PTY-related errors.
 * Provides typed error codes for better error handling.
 */
export class PtyError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID_STATE' | 'SPAWN_ERROR' | 'KILLED',
    public readonly details?: string
  ) {
    super(message)
    this.name = 'PtyError'
  }
}

/**
 * Options for spawning a new PTY process.
 */
export interface PtySpawnOptions {
  /** Working directory for the process */
  cwd?: string
  /** Additional environment variables (merged with process.env) */
  env?: Record<string, string>
  /** Terminal columns (default: 80) */
  cols?: number
  /** Terminal rows (default: 24) */
  rows?: number
}

/**
 * Internal representation of a PTY process.
 */
export interface PtyProcess {
  /** Unique process identifier */
  id: string
  /** The underlying node-pty instance */
  pty: pty.IPty
  /** The command that was executed */
  command: string
  /** Arguments passed to the command */
  args: string[]
  /** Working directory of the process */
  cwd: string
  /** Current process state */
  state: 'running' | 'paused' | 'killed'
}

/**
 * Event emitted when a PTY process outputs data.
 */
export interface PtyOutputEvent {
  /** ID of the process that generated output */
  processId: string
  /** The output data */
  data: string
}

/**
 * Event emitted when a PTY process exits.
 */
export interface PtyExitEvent {
  /** ID of the process that exited */
  processId: string
  /** Exit code of the process */
  exitCode: number
  /** Signal that caused the exit, if any */
  signal?: number
}

/**
 * Event emitted when an error occurs in a PTY process.
 */
export interface PtyErrorEvent {
  /** ID of the process that errored */
  processId: string
  /** Error message */
  error: string
}

/**
 * Service for managing pseudo-terminal (PTY) processes.
 * Wraps node-pty for process spawning and control.
 *
 * Emits events:
 * - 'output': PtyOutputEvent - when a process outputs data
 * - 'exit': PtyExitEvent - when a process exits
 * - 'error': PtyErrorEvent - when an error occurs
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class PtyService extends EventEmitter {
  private processes: Map<string, PtyProcess> = new Map()

  /**
   * Spawns a new PTY process.
   *
   * @param command - The command to execute
   * @param args - Arguments to pass to the command (default: [])
   * @param options - Spawn options (cwd, env, cols, rows)
   * @returns The unique process ID
   * @throws PtyError if spawn fails
   */
  spawn(command: string, args: string[] = [], options: PtySpawnOptions = {}): string {
    const id = randomUUID()
    const cwd = options.cwd || process.cwd()

    try {
      // Spawn PTY process with xterm-256color for proper terminal emulation
      const ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd,
        // Inherit environment and merge with custom env
        env: { ...process.env, ...options.env } as Record<string, string>
      })

      // Subscribe to data events - emit immediately for <100ms latency
      ptyProcess.onData((data) => {
        this.emit('output', { processId: id, data } satisfies PtyOutputEvent)
      })

      // Subscribe to exit events
      ptyProcess.onExit(({ exitCode, signal }) => {
        this.emit('exit', { processId: id, exitCode, signal } satisfies PtyExitEvent)
        // Clean up process from map
        this.processes.delete(id)
      })

      // Store process in map
      this.processes.set(id, {
        id,
        pty: ptyProcess,
        command,
        args,
        cwd,
        state: 'running'
      })

      return id
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown spawn error'
      this.emit('error', { processId: id, error: message } satisfies PtyErrorEvent)
      throw new PtyError(`Failed to spawn process: ${command}`, 'SPAWN_ERROR', message)
    }
  }

  /**
   * Writes data to a running process's stdin.
   *
   * @param processId - ID of the target process
   * @param data - Data to write (can include control characters like \\x03 for Ctrl+C)
   * @throws PtyError if process not found or not in running state
   */
  write(processId: string, data: string): void {
    const proc = this.processes.get(processId)
    if (!proc) {
      throw new PtyError(`Process ${processId} not found`, 'NOT_FOUND', processId)
    }
    if (proc.state !== 'running') {
      throw new PtyError(`Process ${processId} is ${proc.state}`, 'INVALID_STATE', proc.state)
    }
    proc.pty.write(data)
  }

  /**
   * Kills a PTY process.
   * Sends SIGTERM to the process. Silent no-op if process not found.
   *
   * @param processId - ID of the process to kill
   */
  kill(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) return // Silent no-op for idempotency

    proc.state = 'killed'
    proc.pty.kill()
  }

  /**
   * Pauses a running process (SIGSTOP).
   *
   * @param processId - ID of the process to pause
   * @throws PtyError if process not found or signal fails
   */
  pause(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) {
      throw new PtyError(`Process ${processId} not found`, 'NOT_FOUND', processId)
    }
    if (proc.state !== 'running') return // No-op if not running

    try {
      process.kill(proc.pty.pid, 'SIGSTOP')
      proc.state = 'paused'
    } catch {
      // Process may have exited between state check and signal - treat as no-op
      // The exit event will handle cleanup
    }
  }

  /**
   * Resumes a paused process (SIGCONT).
   *
   * @param processId - ID of the process to resume
   * @throws PtyError if process not found or signal fails
   */
  resume(processId: string): void {
    const proc = this.processes.get(processId)
    if (!proc) {
      throw new PtyError(`Process ${processId} not found`, 'NOT_FOUND', processId)
    }
    if (proc.state !== 'paused') return // No-op if not paused

    try {
      process.kill(proc.pty.pid, 'SIGCONT')
      proc.state = 'running'
    } catch {
      // Process may have exited between state check and signal - treat as no-op
      // The exit event will handle cleanup
    }
  }

  /**
   * Kills all active processes.
   * Used for cleanup on app shutdown.
   */
  killAll(): void {
    for (const proc of this.processes.values()) {
      proc.pty.kill()
    }
    this.processes.clear()
  }

  /**
   * Gets a process by ID.
   *
   * @param processId - ID of the process
   * @returns The process info, or undefined if not found
   */
  getProcess(processId: string): PtyProcess | undefined {
    return this.processes.get(processId)
  }

  /**
   * Gets IDs of all active processes.
   *
   * @returns Array of process IDs
   */
  getActiveProcesses(): string[] {
    return Array.from(this.processes.keys())
  }

  /**
   * Gets the count of active processes.
   *
   * @returns Number of active processes
   */
  getProcessCount(): number {
    return this.processes.size
  }

  /**
   * Resizes a PTY process terminal.
   *
   * @param processId - ID of the process
   * @param cols - New column count (must be positive integer)
   * @param rows - New row count (must be positive integer)
   * @throws PtyError if process not found or dimensions invalid
   */
  resize(processId: string, cols: number, rows: number): void {
    const proc = this.processes.get(processId)
    if (!proc) {
      throw new PtyError(`Process ${processId} not found`, 'NOT_FOUND', processId)
    }
    // Validate dimensions are positive integers
    if (!Number.isInteger(cols) || cols < 1 || !Number.isInteger(rows) || rows < 1) {
      throw new PtyError(
        `Invalid dimensions: cols=${cols}, rows=${rows} (must be positive integers)`,
        'INVALID_STATE',
        `cols=${cols}, rows=${rows}`
      )
    }
    proc.pty.resize(cols, rows)
  }
}

/** Singleton instance for app-wide usage */
export const ptyService = new PtyService()
