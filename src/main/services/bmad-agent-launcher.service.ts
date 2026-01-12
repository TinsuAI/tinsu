import { ptyService } from './pty.service'
import { PlanningTask } from '../../shared/types/task.types'
import type { ClaudeModel } from '../../shared/types/config.types'

/**
 * Result returned when launching a BMAD planning agent.
 */
export interface BmadAgentLaunchResult {
  /** Unique process ID returned by PTY service */
  processId: string
  /** The command that was executed */
  command: string
  /** Arguments passed to the command */
  args: string[]
}

/**
 * Service for launching BMAD planning agents via Claude Code CLI.
 *
 * This service spawns the appropriate Claude Code CLI process for planning tasks,
 * using the agent identifier stored in the task to determine which BMAD agent
 * to invoke.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class BmadAgentLauncherService {
  /**
   * Launches the appropriate BMAD agent for a planning task.
   *
   * Uses the task's `bmad_agent` field to invoke the correct Claude Code skill.
   * The process runs in a PTY for proper terminal emulation.
   *
   * @param task - The planning task to launch agent for (must be a valid PlanningTask)
   * @param projectPath - Root path of the project (used as working directory)
   * @param model - Optional Claude model to use (opus, sonnet, haiku). If not specified, uses CLI default.
   * @returns Process ID, command, and args for tracking
   * @throws Error if ptyService.spawn fails
   *
   * @example
   * ```typescript
   * const result = BmadAgentLauncherService.launchPlanningAgent(task, '/path/to/project', 'opus')
   * console.log(`Launched process ${result.processId}`)
   * ```
   */
  static launchPlanningAgent(
    task: PlanningTask,
    projectPath: string,
    model?: ClaudeModel
  ): BmadAgentLaunchResult {
    // Use the --skill flag with agent identifier as documented in Dev Notes
    // e.g., 'bmad:bmm:agents:pm' -> claude --skill bmad:bmm:agents:pm
    const command = 'claude'
    const args = ['--skill', task.bmad_agent]

    // Add model flag if specified (Story 5.1: Agent Model Configuration)
    if (model) {
      args.push('--model', model)
    }

    // Spawn the process via PTY service
    const processId = ptyService.spawn(command, args, {
      cwd: projectPath
    })

    return {
      processId,
      command,
      args
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
   * @param projectPath - Root path of the project (used as working directory)
   * @param storyIdentifier - Story identifier in format "epic.story" (e.g., "5.3")
   * @param model - Optional Claude model to use (opus, sonnet, haiku)
   * @returns Process ID, command, and args for tracking
   * @throws Error if ptyService.spawn fails
   *
   * @example
   * ```typescript
   * const result = BmadAgentLauncherService.launchCreateStory('/path/to/project', '5.3', 'opus')
   * console.log(`Launched process ${result.processId}`)
   * ```
   */
  static launchCreateStory(
    projectPath: string,
    storyIdentifier: string,
    model?: ClaudeModel
  ): BmadAgentLaunchResult {
    const command = 'claude'
    // Combine workflow command and story identifier as single string argument
    // This passes the story number as part of the workflow invocation message
    const workflowWithArg = `/bmad:bmm:workflows:create-story ${storyIdentifier}`
    const args = ['--dangerously-skip-permissions', workflowWithArg]

    // Add model flag if specified
    if (model) {
      args.push('--model', model)
    }

    // Spawn the process via PTY service
    const processId = ptyService.spawn(command, args, {
      cwd: projectPath
    })

    return {
      processId,
      command,
      args
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
   * @param projectPath - Root path of the project (used as working directory)
   * @param storyFilePath - Full path to the story file (.md) to implement
   * @param model - Optional Claude model to use (opus, sonnet, haiku)
   * @returns Process ID, command, and args for tracking
   * @throws Error if ptyService.spawn fails
   *
   * @example
   * ```typescript
   * const result = BmadAgentLauncherService.launchDevStory(
   *   '/path/to/project',
   *   '/path/to/story/5-3-story.md',
   *   'sonnet'
   * )
   * console.log(`Launched process ${result.processId}`)
   * ```
   */
  static launchDevStory(
    projectPath: string,
    storyFilePath: string,
    model?: ClaudeModel
  ): BmadAgentLaunchResult {
    const command = 'claude'
    // Combine workflow command and story file path as single string argument
    // This passes the story path as part of the workflow invocation message
    const workflowWithArg = `/bmad:bmm:workflows:dev-story ${storyFilePath}`
    const args = ['--dangerously-skip-permissions', workflowWithArg]

    // Add model flag if specified
    if (model) {
      args.push('--model', model)
    }

    // Spawn the process via PTY service
    const processId = ptyService.spawn(command, args, {
      cwd: projectPath
    })

    return {
      processId,
      command,
      args
    }
  }
}
