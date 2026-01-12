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
}
