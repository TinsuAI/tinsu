import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { isPlanningTask } from '../../../shared/types/task.types'

/**
 * tRPC router for BMAD agent operations.
 *
 * Provides procedures for:
 * - Checking if Claude Code CLI is installed
 * - Launching BMAD planning agents for planning tasks
 *
 * CRITICAL: Agent operations happen in the main process only.
 */
export const agentRouter = router({
  /**
   * Check if Claude Code CLI is installed.
   *
   * Use this for preflight checks before attempting to launch an agent.
   * Results are cached after first check.
   *
   * @returns true if `claude` command is available in PATH
   */
  checkClaudeCliInstalled: publicProcedure.query(async () => {
    return ClaudeCliDetectorService.isClaudeCodeInstalled()
  }),

  /**
   * Launch a BMAD planning agent for a task.
   *
   * Prerequisites:
   * - Claude Code CLI must be installed
   * - Task must exist and be a valid planning task
   *
   * @param taskId - ID of the planning task to launch agent for
   * @returns Process ID and command details for tracking
   *
   * @throws PRECONDITION_FAILED - If Claude Code CLI is not installed
   * @throws NOT_FOUND - If task doesn't exist
   * @throws BAD_REQUEST - If task is not a planning task
   */
  launchPlanningAgent: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check CLI is installed first (most common failure case)
      const isInstalled = await ClaudeCliDetectorService.isClaudeCodeInstalled()
      if (!isInstalled) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Claude Code CLI is not installed. Run: npm install -g @anthropic-ai/claude-code'
        })
      }

      // Get task from database
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Task not found'
        })
      }

      // Validate task is a planning task using type guard
      if (!isPlanningTask(task)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task is not a planning task'
        })
      }

      // Launch the agent using the service
      const result = BmadAgentLauncherService.launchPlanningAgent(task, ctx.projectRoot)

      return result
    })
})
