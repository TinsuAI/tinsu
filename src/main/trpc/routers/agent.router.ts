import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { observable } from '@trpc/server/observable'
import { tasks, epics, task_sessions } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { ConfigService } from '../../services/config.service'
import { StoryCompletionService } from '../../services/story-completion.service'
import {
  devAgentProgressService,
  type DevAgentProgressInfo
} from '../../services/dev-agent-progress.service'
import { TaskTerminalService } from '../../services/task-terminal.service'
import { ptyService } from '../../services/pty.service'
import { isPlanningTask, isStoryTask, isBasicTask, type Task } from '../../../shared/types/task.types'

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

      // Story 5.5 - AC: 2: Set progress state to dev_implementing
      devAgentProgressService.setState('dev_implementing')

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
    }),

  /**
   * Start a basic task directly with Claude Code.
   *
   * Story 5.3b - AC: 1
   *
   * Spawns Claude Code directly with the task title/description as prompt.
   * No BMAD workflow is used - this is for manually-created quick tasks.
   *
   * @param taskId - ID of the basic task to start
   * @returns Process ID and command details for tracking
   *
   * @throws PRECONDITION_FAILED - If Claude Code CLI is not installed
   * @throws NOT_FOUND - If task doesn't exist
   * @throws BAD_REQUEST - If task is not a basic task (has story_number)
   */
  startBasicTask: publicProcedure
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

      // Validate task is a basic task (story type without story_number)
      const typedTask = task as Task
      if (!isBasicTask(typedTask)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Task is not a basic task. Use create-story or dev-story for imported stories.'
        })
      }

      // Get configured dev agent model from project config
      const configService = new ConfigService(ctx.projectRoot)
      const devAgentModel = configService.getDevAgentModel()

      // Launch Claude Code directly with task title and description
      const result = BmadAgentLauncherService.launchBasicTask(
        ctx.projectRoot,
        typedTask.title,
        typedTask.description ?? undefined,
        devAgentModel
      )

      return result
    }),

  /**
   * Handle basic task completion.
   *
   * Story 5.3b - AC: 3
   *
   * Called when the basic task process exits successfully.
   * Updates the task status to 'review'.
   *
   * @param taskId - ID of the basic task that completed
   * @returns Result indicating whether the task was updated
   */
  handleBasicTaskComplete: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get task from database
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        return { success: false, error: 'Task not found' }
      }

      // Update task status to 'review'
      ctx.db.update(tasks).set({ status: 'review', updated_at: new Date() }).where(eq(tasks.id, input.taskId)).run()

      return { success: true, newStatus: 'review' }
    }),

  /**
   * Handle dev-story workflow completion.
   *
   * Story 5.5 - AC: 5
   *
   * Called when the dev-story process exits successfully.
   * Updates the task status to 'review' and resets progress state.
   *
   * @param taskId - ID of the story task that completed
   * @returns Result indicating whether the task was updated
   */
  handleDevStoryComplete: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Reset progress state to idle
      devAgentProgressService.setState('idle')

      // Get task from database
      const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

      if (!task) {
        return { success: false, error: 'Task not found' }
      }

      // Update task status to 'review'
      ctx.db.update(tasks).set({ status: 'review', updated_at: new Date() }).where(eq(tasks.id, input.taskId)).run()

      return { success: true, newStatus: 'review' }
    }),

  /**
   * Get current DEV agent progress information.
   *
   * Story 5.5 - AC: 2
   *
   * Returns the current step and label for the DEV agent workflow.
   * Used by the progress indicator component to show current state.
   *
   * @returns Progress info with step, total, and label
   */
  getDevAgentProgress: publicProcedure.query(() => {
    return devAgentProgressService.getCurrentStep()
  }),

  /**
   * Subscribe to DEV agent progress events.
   *
   * Story 5.5 - AC: 2
   *
   * Emits progress updates when the DEV agent workflow state changes.
   * Used by the progress indicator component to update in real-time.
   *
   * @returns Observable stream of progress updates
   */
  onDevAgentProgress: publicProcedure.subscription(() => {
    return observable<DevAgentProgressInfo>((emit) => {
      // Emit current state immediately
      emit.next(devAgentProgressService.getCurrentStep())

      // Subscribe to state changes
      const unsubscribe = devAgentProgressService.onProgress((progress) => {
        emit.next(progress)
      })

      return () => {
        unsubscribe()
      }
    })
  }),

  // ===== TES-1.4: Task Terminal Attachment =====

  /**
   * Get the task session record for a task.
   *
   * Story TES-1.4 - AC: #1, #3
   *
   * Returns the task_sessions record if one exists, including
   * tmux session name, Claude Code session ID, and current phase.
   *
   * @param taskId - ID of the task to get session for
   * @returns The task session record, or null if no session exists
   */
  getTaskSession: publicProcedure
    .input(
      z.object({
        taskId: z.string()
      })
    )
    .query(({ ctx, input }) => {
      return ctx.db
        .select()
        .from(task_sessions)
        .where(eq(task_sessions.task_id, input.taskId))
        .get() ?? null
    }),

  /**
   * Attach xterm.js to a task's tmux session via PTY.
   *
   * Story TES-1.4 - AC: #1
   *
   * Spawns a PTY process that runs `tmux attach-session -t {sessionName}`.
   * This connects xterm.js in the renderer to the existing tmux session.
   *
   * The PTY output can be streamed via the existing `pty.onOutput` subscription.
   *
   * @param taskId - ID of the task to attach terminal for
   * @returns Object with attached status and processId (if successful)
   *
   * Flow:
   * 1. Get tmux session name from TaskTerminalService
   * 2. Verify session exists
   * 3. Spawn PTY with tmux attach command
   * 4. Return processId for output subscription
   */
  attachTaskTerminal: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        cols: z.number().int().positive().optional(),
        rows: z.number().int().positive().optional()
      })
    )
    .mutation(async ({ input }) => {
      // Get the attach command (returns null if no session)
      const attachCmd = await TaskTerminalService.getAttachCommand(input.taskId)
      if (!attachCmd) {
        return { attached: false, processId: null }
      }

      // Spawn PTY that attaches to tmux
      // Use bash -c wrapper to ensure proper shell environment
      const processId = ptyService.spawn('bash', ['-c', attachCmd], {
        cols: input.cols ?? 80,
        rows: input.rows ?? 24
      })

      return { attached: true, processId }
    }),

  /**
   * Detach from a task terminal (kill the PTY process).
   *
   * Story TES-1.4 - AC: #1
   *
   * Cleans up the PTY process when the user navigates away or
   * the terminal component unmounts. This is a soft detach - the
   * underlying tmux session continues running.
   *
   * @param processId - ID of the PTY process to kill
   */
  detachTaskTerminal: publicProcedure
    .input(
      z.object({
        processId: z.string()
      })
    )
    .mutation(({ input }) => {
      ptyService.kill(input.processId)
      return { detached: true }
    }),

  // ===== TES-1.5: User Command Input =====

  /**
   * Send a command to a task's tmux session.
   *
   * Story TES-1.5 - AC: #1
   *
   * Sends user input to the task's terminal via `tmux send-keys`.
   * The command is executed in the tmux session and the output
   * appears in the attached xterm.js terminal.
   *
   * @param taskId - ID of the task to send command to
   * @param command - The command string to send (trimmed, non-empty)
   * @returns Success status
   *
   * @throws TRPCError NOT_FOUND if no terminal session exists for the task
   * @throws TRPCError INTERNAL_SERVER_ERROR if tmux send-keys fails
   */
  sendTerminalCommand: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        command: z.string().min(1)
      })
    )
    .mutation(async ({ input }) => {
      try {
        await TaskTerminalService.sendCommand(input.taskId, input.command)

        // TODO (TES-2.x): Log activity event
        // await activityLogService.logActivity(input.taskId, 'user_command', { command: input.command })

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send command'

        // Check if it's a "no session" error
        if (message.includes('No terminal session')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message
        })
      }
    })
})
