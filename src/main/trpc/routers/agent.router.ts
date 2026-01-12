import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { tasks, epics } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { ConfigService } from '../../services/config.service'
import { StoryCompletionService } from '../../services/story-completion.service'
import { isPlanningTask, isStoryTask, type Task } from '../../../shared/types/task.types'

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
      // Cast to Task type since drizzle returns string for status column
      const typedTask = task as Task
      if (!isPlanningTask(typedTask)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task is not a planning task'
        })
      }

      // Story 5.1: Get configured dev agent model from project config
      const configService = new ConfigService(ctx.projectRoot)
      const devAgentModel = configService.getDevAgentModel()

      // Launch the agent using the service with configured model
      const result = BmadAgentLauncherService.launchPlanningAgent(
        typedTask,
        ctx.projectRoot,
        devAgentModel
      )

      return result
    }),

  /**
   * Start the create-story workflow for a story task.
   *
   * Story 5.3 - AC: 1
   *
   * Spawns Claude Code with the BMAD create-story workflow to generate
   * a full story file from the sprint-status.yaml.
   *
   * @param taskId - ID of the story task to create story for
   * @returns Process ID and command details for tracking
   *
   * @throws PRECONDITION_FAILED - If Claude Code CLI is not installed
   * @throws NOT_FOUND - If task doesn't exist
   * @throws BAD_REQUEST - If task is not a story task
   */
  startCreateStory: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check CLI is installed first
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

      // Validate task is a story task
      const typedTask = task as Task
      if (!isStoryTask(typedTask)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task is not a story task'
        })
      }

      // Get epic to form story identifier (e.g., "5.3")
      let storyIdentifier = ''
      if (typedTask.epic_id && typedTask.story_number !== null) {
        const epic = ctx.db.select().from(epics).where(eq(epics.id, typedTask.epic_id)).get()
        if (epic && epic.epic_number !== null) {
          storyIdentifier = `${epic.epic_number}.${typedTask.story_number}`
        }
      }

      // Fallback to story number only if no epic
      if (!storyIdentifier && typedTask.story_number !== null) {
        storyIdentifier = String(typedTask.story_number)
      }

      // Validate we have a story identifier
      if (!storyIdentifier) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot determine story identifier. Task must have story_number and epic with epic_number.'
        })
      }

      // Get configured dev agent model from project config
      const configService = new ConfigService(ctx.projectRoot)
      const devAgentModel = configService.getDevAgentModel()

      // Launch the create-story workflow with story identifier
      const result = BmadAgentLauncherService.launchCreateStory(
        ctx.projectRoot,
        storyIdentifier,
        devAgentModel
      )

      return result
    }),

  /**
   * Start the dev-story workflow to implement a story.
   *
   * Story 5.3 - AC: 3
   *
   * Spawns Claude Code with the BMAD dev-story workflow to implement
   * a story from its full story file.
   *
   * @param taskId - ID of the story task to implement
   * @returns Process ID and command details for tracking
   *
   * @throws PRECONDITION_FAILED - If Claude Code CLI is not installed
   * @throws NOT_FOUND - If task doesn't exist
   * @throws BAD_REQUEST - If task is not a story task
   * @throws BAD_REQUEST - If story file is not ready (status != 'story_ready')
   * @throws BAD_REQUEST - If story file path is missing
   */
  startDevStory: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check CLI is installed first
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

      // Validate task is a story task
      const typedTask = task as Task
      if (!isStoryTask(typedTask)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task is not a story task'
        })
      }

      // Validate story file is ready
      if (typedTask.story_file_status !== 'story_ready') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Story file not ready. Run create-story workflow first.'
        })
      }

      // Validate story file path exists
      if (!typedTask.story_file_path) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Story file path is missing'
        })
      }

      // Get configured dev agent model from project config
      const configService = new ConfigService(ctx.projectRoot)
      const devAgentModel = configService.getDevAgentModel()

      // Launch the dev-story workflow with story file path
      const result = BmadAgentLauncherService.launchDevStory(
        ctx.projectRoot,
        typedTask.story_file_path,
        devAgentModel
      )

      return result
    }),

  /**
   * Handle create-story workflow completion.
   *
   * Story 5.3 - AC: 2
   *
   * Called when the create-story workflow process exits successfully.
   * Scans implementation-artifacts for the newly created story file
   * and updates the task's story_file_status and story_file_path.
   *
   * @param taskId - ID of the story task that was processed
   * @returns Result indicating whether the story file was found and task updated
   */
  handleCreateStoryComplete: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await StoryCompletionService.handleCreateStoryComplete(
        ctx.db,
        input.taskId,
        ctx.projectRoot
      )

      if (!result.success && result.error) {
        // Log the error but don't throw - the workflow may have just not created a file
        console.warn(`[agent.handleCreateStoryComplete] ${result.error}`)
      }

      return result
    })
})
