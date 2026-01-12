import { useCallback, useRef } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import type { AgentWorkflowType } from '@renderer/stores/terminal.store'
import { toast } from 'sonner'

/**
 * Hook for launching BMAD agents via Claude Code CLI.
 *
 * Provides functions to launch agents for:
 * - Planning tasks (existing)
 * - Create-story workflow (Story 5.3 - AC: 1)
 * - Dev-story workflow (Story 5.3 - AC: 3)
 *
 * All launch functions expand the terminal dock on success.
 *
 * @example
 * ```tsx
 * function StoryTaskCard({ task }) {
 *   const { launchCreateStory, launchDevStory, isLaunching } = useAgentLauncher()
 *
 *   const handleCreateStory = () => {
 *     launchCreateStory(task.id)
 *   }
 *
 *   return (
 *     <button onClick={handleCreateStory} disabled={isLaunching}>
 *       Create Story
 *     </button>
 *   )
 * }
 * ```
 */
export function useAgentLauncher() {
  const {
    setExpanded,
    setActiveProcess,
    setAgentTask,
    setAgentWorkflowType,
    agentTaskId,
    agentWorkflowType,
    activeProcessId
  } = useTerminalStore()

  // Story 5.3 - Task 8: Check if agent is already running
  const isAgentRunning = agentTaskId !== null

  // Story 5.3 - AC: 2: Track workflow type and task ID for completion handling
  const workflowTypeRef = useRef<AgentWorkflowType>(null)
  const taskIdRef = useRef<string | null>(null)
  workflowTypeRef.current = agentWorkflowType
  taskIdRef.current = agentTaskId

  // TanStack Query client for cache invalidation
  const utils = trpc.useUtils()

  // Common error handler for CLI-related errors
  const handleAgentError = useCallback((error: { message: string }) => {
    const isCLIError = error.message.toLowerCase().includes('claude code cli')
    toast.error(error.message, {
      description: isCLIError
        ? 'Please install Claude Code CLI to continue.'
        : 'Please check the task and try again.',
      duration: 10000 // Persist for 10 seconds as per story requirement
    })
  }, [])

  // Planning agent mutation (existing)
  const launchPlanningMutation = trpc.agent.launchPlanningAgent.useMutation({
    onSuccess: (result, variables) => {
      // Track the active agent process
      setActiveProcess(result.processId)
      // Track which task spawned this agent (Story 3.4)
      setAgentTask(variables.taskId)
      // Story 5.3 - AC: 2: Track workflow type for completion handling
      setAgentWorkflowType('planning')
      // Expand terminal dock to show agent output
      setExpanded(true)
    },
    onError: handleAgentError
  })

  // Create-story workflow mutation (Story 5.3 - AC: 1)
  const createStoryMutation = trpc.agent.startCreateStory.useMutation({
    onSuccess: (result, variables) => {
      // Track the active agent process
      setActiveProcess(result.processId)
      // Track which task spawned this agent
      setAgentTask(variables.taskId)
      // Story 5.3 - AC: 2: Track workflow type for completion handling
      setAgentWorkflowType('create_story')
      // Story 5.3 Task 3: Expand terminal dock on workflow start
      setExpanded(true)
      toast.success('Create Story workflow started', {
        description: 'Check the terminal for progress'
      })
    },
    onError: handleAgentError
  })

  // Dev-story workflow mutation (Story 5.3 - AC: 3)
  const devStoryMutation = trpc.agent.startDevStory.useMutation({
    onSuccess: (result, variables) => {
      // Track the active agent process
      setActiveProcess(result.processId)
      // Track which task spawned this agent
      setAgentTask(variables.taskId)
      // Story 5.3 - AC: 2: Track workflow type for completion handling
      setAgentWorkflowType('dev_story')
      // Story 5.3 Task 3: Expand terminal dock on workflow start
      setExpanded(true)
      toast.success('Dev Story workflow started', {
        description: 'Check the terminal for progress'
      })
    },
    onError: handleAgentError
  })

  // Story 5.3 - AC: 2: Mutation for handling create-story workflow completion
  const handleCreateStoryCompleteMutation = trpc.agent.handleCreateStoryComplete.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Story file created', {
          description: 'Task updated with story file path'
        })
        // Invalidate tasks query to refresh UI
        utils.tasks.getAll.invalidate()
      } else if (result.error) {
        // Log but don't show error toast - might be expected if workflow didn't create a file
        console.warn(`[useAgentLauncher] Create story completion: ${result.error}`)
      }
    },
    onError: (error) => {
      console.warn(`[useAgentLauncher] Failed to handle create-story completion: ${error.message}`)
    }
  })

  // Story 5.3 - AC: 2: Subscribe to PTY exit events for completion handling
  trpc.pty.onExit.useSubscription(
    { processId: activeProcessId ?? '' },
    {
      enabled: !!activeProcessId,
      onData: (event) => {
        // Only handle successful exits (exit code 0)
        if (event.exitCode === 0) {
          const currentWorkflowType = workflowTypeRef.current
          const currentTaskId = taskIdRef.current

          // Handle create-story workflow completion
          if (currentWorkflowType === 'create_story' && currentTaskId) {
            // Call completion handler to scan for story file and update task
            handleCreateStoryCompleteMutation.mutate({ taskId: currentTaskId })
          }
        }
      }
    }
  )

  const launchPlanningAgent = useCallback(
    (taskId: string) => {
      // Story 5.3 - Task 8: Block concurrent execution (AC 5)
      if (isAgentRunning) {
        toast.warning('Agent already running', {
          description: 'Another workflow is currently executing. Wait for it to complete.'
        })
        return // Block the launch - don't allow concurrent execution
      }
      launchPlanningMutation.mutate({ taskId })
    },
    [launchPlanningMutation, isAgentRunning]
  )

  // Story 5.3 - AC: 1: Launch create-story workflow
  const launchCreateStory = useCallback(
    (taskId: string) => {
      // Story 5.3 - Task 8: Block concurrent execution (AC 5)
      if (isAgentRunning) {
        toast.warning('Agent already running', {
          description: 'Another workflow is currently executing. Wait for it to complete.'
        })
        return // Block the launch - don't allow concurrent execution
      }
      createStoryMutation.mutate({ taskId })
    },
    [createStoryMutation, isAgentRunning]
  )

  // Story 5.3 - AC: 3: Launch dev-story workflow
  const launchDevStory = useCallback(
    (taskId: string) => {
      // Story 5.3 - Task 8: Block concurrent execution (AC 5)
      if (isAgentRunning) {
        toast.warning('Agent already running', {
          description: 'Another workflow is currently executing. Wait for it to complete.'
        })
        return // Block the launch - don't allow concurrent execution
      }
      devStoryMutation.mutate({ taskId })
    },
    [devStoryMutation, isAgentRunning]
  )

  return {
    /** Launch a BMAD planning agent for the given task ID */
    launchPlanningAgent,
    /** Story 5.3 - AC: 1: Launch create-story workflow for the given task ID */
    launchCreateStory,
    /** Story 5.3 - AC: 3: Launch dev-story workflow for the given task ID */
    launchDevStory,
    /** Whether any agent launch is currently in progress */
    isLaunching:
      launchPlanningMutation.isPending ||
      createStoryMutation.isPending ||
      devStoryMutation.isPending,
    /** Whether create-story is currently launching */
    isCreatingStory: createStoryMutation.isPending,
    /** Whether dev-story is currently launching */
    isDevStory: devStoryMutation.isPending,
    /** Story 5.3 - Task 8: Whether an agent is currently running */
    isAgentRunning
  }
}
