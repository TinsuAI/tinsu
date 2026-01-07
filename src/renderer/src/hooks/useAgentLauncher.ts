import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import { toast } from 'sonner'

/**
 * Hook for launching BMAD planning agents via Claude Code CLI.
 *
 * Provides a function to launch an agent for a given planning task,
 * with automatic error handling and terminal dock expansion on success.
 *
 * @example
 * ```tsx
 * function PlanningTaskCard({ task }) {
 *   const { launchPlanningAgent, isLaunching } = useAgentLauncher()
 *
 *   const handleStartPhase = () => {
 *     launchPlanningAgent(task.id)
 *   }
 *
 *   return (
 *     <button onClick={handleStartPhase} disabled={isLaunching}>
 *       Start Phase
 *     </button>
 *   )
 * }
 * ```
 */
export function useAgentLauncher() {
  const { setExpanded, setActiveProcess, setAgentTask } = useTerminalStore()

  const launchMutation = trpc.agent.launchPlanningAgent.useMutation({
    onSuccess: (result, variables) => {
      // Track the active agent process
      setActiveProcess(result.processId)
      // Track which task spawned this agent (Story 3.4)
      setAgentTask(variables.taskId)
      // Expand terminal dock to show agent output
      setExpanded(true)
    },
    onError: (error) => {
      // Show error toast with context-appropriate description
      const isCLIError = error.message.toLowerCase().includes('claude code cli')
      toast.error(error.message, {
        description: isCLIError
          ? 'Please install Claude Code CLI to continue.'
          : 'Please check the task and try again.',
        duration: 10000 // Persist for 10 seconds as per story requirement
      })
    }
  })

  const launchPlanningAgent = useCallback(
    (taskId: string) => {
      launchMutation.mutate({ taskId })
    },
    [launchMutation]
  )

  return {
    /** Launch a BMAD planning agent for the given task ID */
    launchPlanningAgent,
    /** Whether an agent launch is currently in progress */
    isLaunching: launchMutation.isPending
  }
}
