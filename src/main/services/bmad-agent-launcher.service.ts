import { TaskTerminalService } from './task-terminal.service'
import { PlanningTask } from '../../shared/types/task.types'
import type { ClaudeModel } from '../../shared/types/config.types'

/**
 * Result returned when launching a BMAD agent.
 *
 * Note: Since agents run inside tmux sessions (not separate PTY processes),
 * there's no processId. The command runs inside the task's tmux session
 * which can be attached to via TaskTerminalService.
 */
export interface BmadAgentLaunchResult {
  /** The full command that was sent to the tmux session */
  command: string
  /** Whether the command was successfully sent */
  success: boolean
}

/**
 * Service for launching BMAD planning agents via Claude Code CLI.
 *
 * This service sends Claude Code CLI commands to the task's tmux session,
 * using the agent identifier stored in the task to determine which BMAD agent
 * to invoke.
 *
 * Commands are sent via `tmux send-keys` so they run inside the persistent
 * tmux session created when the task moved to "In Progress".
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class BmadAgentLauncherService {
  /**
   * Launches the appropriate BMAD agent for a planning task.
   *
   * Uses the task's `bmad_agent` field to invoke the correct Claude Code skill.
   * The command is sent to the task's tmux session via send-keys.
   *
   * @param taskId - The task ID (used to find tmux session)
   * @param task - The planning task to launch agent for (must be a valid PlanningTask)
   * @param projectPath - Root path of the project (used as working directory via cd)
   * @param model - Optional Claude model to use (opus, sonnet, haiku). If not specified, uses CLI default.
   * @returns Result with command and success status
   * @throws Error if no tmux session exists for the task
   *
   * @example
   * ```typescript
   * const result = await BmadAgentLauncherService.launchPlanningAgent(taskId, task, '/path/to/project', 'opus')
   * console.log(`Launched: ${result.command}`)
   * ```
   */
  static async launchPlanningAgent(
    taskId: string,
    task: PlanningTask,
    projectPath: string,
    model?: ClaudeModel
  ): Promise<BmadAgentLaunchResult> {
    // Build the claude command with skill flag
    // e.g., 'bmad:bmm:agents:pm' -> claude --skill bmad:bmm:agents:pm
    const args = ['--skill', task.bmad_agent]

    // Add model flag if specified (Story 5.1: Agent Model Configuration)
    if (model) {
      args.push('--model', model)
    }

    // Build full command: cd to project dir and run claude
    const fullCommand = `cd ${JSON.stringify(projectPath)} && claude ${args.join(' ')}`

    // Send command to tmux session
    await TaskTerminalService.sendCommand(taskId, fullCommand)

    return {
      command: fullCommand,
      success: true
    }
  }

  /**
   * Launches the BMAD create-story workflow to generate a full story file.
   *
   * Story 5.3 - AC: 1
   *
   * Uses `--dangerously-skip-permissions` flag for non-interactive execution.
   * Passes the story identifier (e.g., "5.3") to target a specific story.
   *
   * @param taskId - The task ID (used to find tmux session)
   * @param projectPath - Root path of the project (used as working directory)
   * @param storyIdentifier - Story identifier in format "epic.story" (e.g., "5.3")
   * @param model - Optional Claude model to use (opus, sonnet, haiku)
   * @returns Result with command and success status
   * @throws Error if no tmux session exists for the task
   *
   * @example
   * ```typescript
   * const result = await BmadAgentLauncherService.launchCreateStory(taskId, '/path/to/project', '5.3', 'opus')
   * console.log(`Launched: ${result.command}`)
   * ```
   */
  static async launchCreateStory(
    taskId: string,
    projectPath: string,
    storyIdentifier: string,
    model?: ClaudeModel
  ): Promise<BmadAgentLaunchResult> {
    // Combine workflow command and story identifier as single string argument
    const workflowWithArg = `/bmad:bmm:workflows:create-story ${storyIdentifier}`
    const args = ['--dangerously-skip-permissions', JSON.stringify(workflowWithArg)]

    // Add model flag if specified
    if (model) {
      args.push('--model', model)
    }

    // Build full command: cd to project dir and run claude
    const fullCommand = `cd ${JSON.stringify(projectPath)} && claude ${args.join(' ')}`

    // Send command to tmux session
    await TaskTerminalService.sendCommand(taskId, fullCommand)

    return {
      command: fullCommand,
      success: true
    }
  }

  /**
   * Launches the BMAD dev-story workflow to implement a story.
   *
   * Story 5.3 - AC: 3
   *
   * Uses `--dangerously-skip-permissions` flag for non-interactive execution.
   * Passes the story file path as an argument to the workflow.
   *
   * @param taskId - The task ID (used to find tmux session)
   * @param projectPath - Root path of the project (used as working directory)
   * @param storyFilePath - Full path to the story file (.md) to implement
   * @param model - Optional Claude model to use (opus, sonnet, haiku)
   * @returns Result with command and success status
   * @throws Error if no tmux session exists for the task
   *
   * @example
   * ```typescript
   * const result = await BmadAgentLauncherService.launchDevStory(
   *   taskId,
   *   '/path/to/project',
   *   '/path/to/story/5-3-story.md',
   *   'sonnet'
   * )
   * console.log(`Launched: ${result.command}`)
   * ```
   */
  static async launchDevStory(
    taskId: string,
    projectPath: string,
    storyFilePath: string,
    model?: ClaudeModel
  ): Promise<BmadAgentLaunchResult> {
    // Combine workflow command and story file path as single string argument
    const workflowWithArg = `/bmad:bmm:workflows:dev-story ${storyFilePath}`
    const args = ['--dangerously-skip-permissions', JSON.stringify(workflowWithArg)]

    // Add model flag if specified
    if (model) {
      args.push('--model', model)
    }

    // Build full command: cd to project dir and run claude
    const fullCommand = `cd ${JSON.stringify(projectPath)} && claude ${args.join(' ')}`

    // Send command to tmux session
    await TaskTerminalService.sendCommand(taskId, fullCommand)

    return {
      command: fullCommand,
      success: true
    }
  }

  /**
   * Launches Claude Code directly for a basic (manually-created) task.
   *
   * Story 5.3b - AC: 1
   *
   * Basic tasks execute directly without BMAD workflow overhead.
   * Uses `--dangerously-skip-permissions` flag for non-interactive execution.
   * Passes task title and description as the prompt.
   *
   * @param taskId - The task ID (used to find tmux session)
   * @param projectPath - Root path of the project (used as working directory)
   * @param taskTitle - Title of the task to execute
   * @param taskDescription - Optional detailed description of the task
   * @param model - Optional Claude model to use (opus, sonnet, haiku)
   * @returns Result with command and success status
   * @throws Error if no tmux session exists for the task
   *
   * @example
   * ```typescript
   * const result = await BmadAgentLauncherService.launchBasicTask(
   *   taskId,
   *   '/path/to/project',
   *   'Fix login bug',
   *   'The login button does not work on mobile Safari',
   *   'sonnet'
   * )
   * console.log(`Launched: ${result.command}`)
   * ```
   */
  static async launchBasicTask(
    taskId: string,
    projectPath: string,
    taskTitle: string,
    taskDescription?: string,
    model?: ClaudeModel
  ): Promise<BmadAgentLaunchResult> {
    // Construct prompt from task title and description
    const prompt = taskDescription ? `${taskTitle}\n\n${taskDescription}` : taskTitle
    const args = ['--dangerously-skip-permissions', JSON.stringify(prompt)]

    // Add model flag if specified
    if (model) {
      args.push('--model', model)
    }

    // Build full command: cd to project dir and run claude
    const fullCommand = `cd ${JSON.stringify(projectPath)} && claude ${args.join(' ')}`

    // Send command to tmux session
    await TaskTerminalService.sendCommand(taskId, fullCommand)

    return {
      command: fullCommand,
      success: true
    }
  }
}
