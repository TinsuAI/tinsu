import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { observable } from '@trpc/server/observable'
import { tasks, epics, task_sessions, sprints } from '../../db/schema'
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
import { ScrollbackBackupService, type BackupMetadata } from '../../services/scrollback-backup.service'
import { TaskSessionService } from '../../services/task-session.service'
import { ptyService } from '../../services/pty.service'
import { isPlanningTask, isStoryTask, isBasicTask, type Task } from '../../../shared/types/task.types'
import { sessionEventEmitter, type SessionEndedEventData, type SessionStalledEventData, type SessionEventData } from '../../lib/session-events'
import { StallDetectorService } from '../../services/stall-detector.service'
import { ActivityLogService } from '../../services/activity-log.service'

/**
 * TES-1.11: Maps processId to taskId for stall detection.
 * Needed because PTY events only have processId, but stall detection needs taskId.
 */
const processToTaskMap = new Map<string, string>()

/**
 * TES-1.11: Listen to PTY output events for stall detection.
 * Records output timing to detect when sessions go stale.
 */
ptyService.on('output', (event) => {
  const taskId = processToTaskMap.get(event.processId)
  if (taskId) {
    StallDetectorService.recordOutput(taskId)
  }
})

/**
 * TES-1.11: Cleanup processToTaskMap on PTY exit to prevent memory leaks.
 * This handles cases where PTY exits unexpectedly (crash, etc.) without
 * going through the normal detachTaskTerminal cleanup path.
 */
ptyService.on('exit', (event) => {
  const taskId = processToTaskMap.get(event.processId)
  if (taskId) {
    StallDetectorService.stopTracking(taskId)
    processToTaskMap.delete(event.processId)
  }
})

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
      // Command is sent to the task's tmux session
      const result = await BmadAgentLauncherService.launchPlanningAgent(
        input.taskId,
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

      // Get sprint's story_prefix for prefixed story identifiers (e.g., "tes-1.1")
      let storyPrefix: string | null = null
      if (typedTask.sprint_id) {
        const sprint = ctx.db.select().from(sprints).where(eq(sprints.id, typedTask.sprint_id)).get()
        if (sprint && sprint.story_prefix) {
          storyPrefix = sprint.story_prefix
        }
      }

      // Get epic to form story identifier (e.g., "5.3" or "tes-1.1")
      let storyIdentifier = ''
      if (typedTask.epic_id && typedTask.story_number !== null) {
        const epic = ctx.db.select().from(epics).where(eq(epics.id, typedTask.epic_id)).get()
        if (epic && epic.epic_number !== null) {
          // Include prefix if available (e.g., "tes-1.1" vs "5.3")
          const baseIdentifier = `${epic.epic_number}.${typedTask.story_number}`
          storyIdentifier = storyPrefix ? `${storyPrefix}-${baseIdentifier}` : baseIdentifier
        }
      }

      // Fallback to story number only if no epic
      if (!storyIdentifier && typedTask.story_number !== null) {
        const baseIdentifier = String(typedTask.story_number)
        storyIdentifier = storyPrefix ? `${storyPrefix}-${baseIdentifier}` : baseIdentifier
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
      // Command is sent to the task's tmux session
      const result = await BmadAgentLauncherService.launchCreateStory(
        input.taskId,
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
      console.log('[agent.router] startDevStory mutation called with taskId:', input.taskId)

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
      // Command is sent to the task's tmux session
      console.log('[agent.router] startDevStory: Calling BmadAgentLauncherService.launchDevStory')
      const result = await BmadAgentLauncherService.launchDevStory(
        input.taskId,
        ctx.projectRoot,
        typedTask.story_file_path,
        devAgentModel
      )

      console.log('[agent.router] startDevStory: Complete, result:', result)
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
      // Command is sent to the task's tmux session
      const result = await BmadAgentLauncherService.launchBasicTask(
        input.taskId,
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

      // TES-1.11: Track processId -> taskId mapping for stall detection
      processToTaskMap.set(processId, input.taskId)
      StallDetectorService.startTracking(input.taskId)

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
      // TES-1.11: Clean up stall tracking
      const taskId = processToTaskMap.get(input.processId)
      if (taskId) {
        StallDetectorService.stopTracking(taskId)
        processToTaskMap.delete(input.processId)
      }

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

        // TES-2.8: Log user_command activity
        try {
          // Security: Mask common secrets and truncate long commands for logging
          // We don't limit the actual execution, just the audit log to prevent bloating/leaks
          let safeCommand = input.command
          if (safeCommand.length > 1000) {
            safeCommand = safeCommand.slice(0, 1000) + '... (truncated)'
          }
          // Basic masking for common secret patterns (password, token, key)
          // Simple regex to catch --password value or password=value
          safeCommand = safeCommand.replace(/(--?(?:password|token|key|secret)[=\s]+)(\S+)/gi, '$1*****')

          await ActivityLogService.logActivity(input.taskId, 'user_command', {
            command: safeCommand
          })
        } catch (logError) {
          console.warn('[agent.sendTerminalCommand] Failed to log user_command activity:', logError)
          // Don't fail the mutation - command was sent successfully
        }

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
    }),

  // ===== TES-1.7: Session-Task Mapping & Event Routing =====

  /**
   * Register a Claude Code session ID with a task.
   *
   * Story TES-1.7 - AC: #3
   *
   * Called when the first hook fires and session_id becomes known.
   * Updates task_sessions table and in-memory cache for fast lookups.
   *
   * @param taskId - ID of the task to register session for
   * @param sessionId - The Claude Code session ID from hook payload
   * @returns Success status
   *
   * @throws NOT_FOUND - If no task_sessions record exists for the taskId
   *
   * @example
   * ```typescript
   * // Called from hook handler when first event received
   * await trpc.agent.registerSessionId.mutate({
   *   taskId: 'task-123',
   *   sessionId: 'claude-abc-def'
   * })
   * ```
   */
  registerSessionId: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        sessionId: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify task_sessions record exists before updating
      const existingSession = ctx.db
        .select()
        .from(task_sessions)
        .where(eq(task_sessions.task_id, input.taskId))
        .get()

      if (!existingSession) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No task session found for task ${input.taskId}. Task must have an active terminal session.`
        })
      }

      await TaskSessionService.updateSessionId(input.taskId, input.sessionId)
      return { success: true }
    }),

  // ===== TES-1.9: Scrollback Restoration After App Restart =====

  /**
   * Get scrollback backup content for restoration.
   *
   * Story TES-1.9 - AC: #1, #3
   *
   * Returns null content if no backup exists (not an error).
   * This is called when opening a task after app restart to restore
   * terminal history from the persisted backup.
   *
   * Edge cases handled (TES-1.9 Task 6):
   * - Corrupted gzip: returns null content (handled by service)
   * - Missing metadata: returns content anyway with null metadata
   * - Timeout: fails gracefully after 5 seconds
   *
   * @param taskId - ID of the task to get scrollback backup for
   * @returns Object with content (decompressed string or null) and metadata (or null)
   */
  getScrollbackBackup: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }): Promise<{ content: string | null; metadata: BackupMetadata | null }> => {
      // TES-1.9 Task 6: Add timeout for restoration (5 seconds)
      const RESTORATION_TIMEOUT = 5000

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Scrollback restoration timed out')), RESTORATION_TIMEOUT)
      })

      try {
        // Race between restoration and timeout
        const [content, metadata] = await Promise.race([
          Promise.all([
            ScrollbackBackupService.restoreScrollback(input.taskId),
            ScrollbackBackupService.getBackupMetadata(input.taskId)
          ]),
          timeoutPromise
        ])

        return { content, metadata }
      } catch (error) {
        // On timeout or other errors, return null content gracefully
        console.warn(
          `[agent.getScrollbackBackup] Restoration failed for ${input.taskId}:`,
          error instanceof Error ? error.message : error
        )
        return { content: null, metadata: null }
      }
    }),

  /**
   * Get backup metadata only (without content).
   *
   * Story TES-1.9 - AC: #1
   *
   * Used by UI to show "Last backup: X minutes ago" in terminal header
   * without loading the full scrollback content.
   *
   * @param taskId - ID of the task to get backup info for
   * @returns BackupMetadata or null if no backup exists
   */
  getBackupInfo: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }): Promise<BackupMetadata | null> => {
      return ScrollbackBackupService.getBackupMetadata(input.taskId)
    }),

  // ===== TES-1.11: Session Status Changes Subscription =====

  /**
   * Subscribe to session status change events for a task.
   *
   * Story TES-1.11 - AC: #1
   *
   * Emits events when a task's terminal session:
   * - Ends (process exits, session killed, or detected as stale)
   * - Stalls (no output for 5 minutes)
   * - Recovers (output received after stall)
   *
   * @param taskId - ID of the task to subscribe to
   * @returns Observable stream of session status updates
   */
  onSessionStatusChange: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .subscription(({ input }) => {
      return observable<{ status: 'ended' | 'stalled' | 'recovered'; reason?: string }>((emit) => {
        const onEnded = (data: SessionEndedEventData) => {
          if (data.taskId === input.taskId) {
            emit.next({ status: 'ended', reason: data.reason })
          }
        }

        const onStalled = (data: SessionStalledEventData) => {
          if (data.taskId === input.taskId) {
            emit.next({ status: 'stalled' })
          }
        }

        const onRecovered = (data: SessionEventData) => {
          if (data.taskId === input.taskId) {
            emit.next({ status: 'recovered' })
          }
        }

        sessionEventEmitter.onSessionEnded(onEnded)
        sessionEventEmitter.onSessionStalled(onStalled)
        sessionEventEmitter.onSessionRecovered(onRecovered)

        return () => {
          sessionEventEmitter.offSessionEnded(onEnded)
          sessionEventEmitter.offSessionStalled(onStalled)
          sessionEventEmitter.offSessionRecovered(onRecovered)
        }
      })
    }),

  /**
   * Start monitoring a task's terminal session for exit/stall events.
   *
   * Story TES-1.11 - AC: #1
   *
   * Call this after attaching to a task terminal to enable session monitoring.
   * The monitor will detect when the tmux session exits and emit events.
   *
   * @param taskId - ID of the task to start monitoring
   */
  startSessionMonitor: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await TaskTerminalService.startSessionMonitor(input.taskId)
      return { success: true }
    }),

  /**
   * Stop monitoring a task's terminal session.
   *
   * Story TES-1.11 - AC: #1
   *
   * Call this when detaching from a task terminal or when no longer
   * interested in session events.
   *
   * @param taskId - ID of the task to stop monitoring
   */
  stopSessionMonitor: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(({ input }) => {
      TaskTerminalService.stopSessionMonitor(input.taskId)
      return { success: true }
    })
})
