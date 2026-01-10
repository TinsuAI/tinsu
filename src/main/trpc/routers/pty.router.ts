import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { observable } from '@trpc/server/observable'
import { ptyService, PtyError, PtyOutputEvent, PtyExitEvent } from '../../services/pty.service'

/**
 * Gets the default shell for the current platform.
 * - Windows: Uses ComSpec env var (usually cmd.exe) or falls back to powershell
 * - Unix/Linux/macOS: Uses SHELL env var or falls back to /bin/bash
 */
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

export const ptyRouter = router({
  /**
   * Spawns a new PTY process.
   * Returns the unique process ID.
   */
  spawn: publicProcedure
    .input(
      z.object({
        command: z.string().optional(),
        args: z.array(z.string()).optional().default([]),
        cwd: z.string().optional(),
        cols: z.number().int().positive().optional(),
        rows: z.number().int().positive().optional()
      })
    )
    .mutation(({ input }) => {
      const command = input.command || getDefaultShell()
      try {
        return ptyService.spawn(command, input.args, {
          cwd: input.cwd,
          cols: input.cols,
          rows: input.rows
        })
      } catch (error) {
        if (error instanceof PtyError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error
          })
        }
        throw error
      }
    }),

  /**
   * Writes data to a running process's stdin.
   */
  write: publicProcedure
    .input(
      z.object({
        processId: z.string(),
        data: z.string()
      })
    )
    .mutation(({ input }) => {
      try {
        ptyService.write(input.processId, input.data)
      } catch (error) {
        if (error instanceof PtyError) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message,
              cause: error
            })
          }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error
          })
        }
        throw error
      }
    }),

  /**
   * Kills a PTY process.
   * Silent no-op if process not found (idempotent).
   */
  kill: publicProcedure.input(z.object({ processId: z.string() })).mutation(({ input }) => {
    ptyService.kill(input.processId)
  }),

  /**
   * Resizes a PTY process terminal dimensions.
   */
  resize: publicProcedure
    .input(
      z.object({
        processId: z.string(),
        cols: z.number().int().positive(),
        rows: z.number().int().positive()
      })
    )
    .mutation(({ input }) => {
      try {
        ptyService.resize(input.processId, input.cols, input.rows)
      } catch (error) {
        if (error instanceof PtyError) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message,
              cause: error
            })
          }
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error
          })
        }
        throw error
      }
    }),

  /**
   * Subscribes to PTY output events for a specific process.
   * Emits data events as the process writes to stdout/stderr.
   */
  onOutput: publicProcedure.input(z.object({ processId: z.string() })).subscription(({ input }) => {
    return observable<PtyOutputEvent>((emit) => {
      const handler = (event: PtyOutputEvent): void => {
        if (event.processId === input.processId) {
          emit.next(event)
        }
      }
      ptyService.on('output', handler)
      return () => {
        ptyService.off('output', handler)
      }
    })
  }),

  /**
   * Subscribes to PTY exit events for a specific process.
   * Emits when the process terminates with exit code and optional signal.
   */
  onExit: publicProcedure.input(z.object({ processId: z.string() })).subscription(({ input }) => {
    return observable<PtyExitEvent>((emit) => {
      const handler = (event: PtyExitEvent): void => {
        if (event.processId === input.processId) {
          emit.next(event)
        }
      }
      ptyService.on('exit', handler)
      return () => {
        ptyService.off('exit', handler)
      }
    })
  })
})
