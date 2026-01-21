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
 * - Basic tasks (Story 5.3b - AC: 1) - direct execution without BMAD workflow
 *
 * All launch functions expand the terminal dock on success.
 *
 * @example
 * ```tsx
 * function StoryTaskCard({ task }) {
 *   const { launchCreateStory, launchDevStory, launchBasicTask, isLaunching } = useAgentLauncher()
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
    clearAgent,
    agentTaskId,
    agentWorkflowType,
    activeProcessId
  } = useTerminalStore()

  // Story 5.3 - Task 8: Check if agent is already running
  const isAgentRunning = agentTaskId !== null

  // Story 5.3 - AC: 2: Track workflow type and task ID for completion handling
  // IMPORTANT: These refs are set ONLY when launching an agent, not on every render.
  // This prevents race conditions where useTerminal clears activeProcessId before
  // the exit handler runs, causing a re-render that would clear these values.
  const workflowTypeRef = useRef<AgentWorkflowType>(null)
  const taskIdRef = useRef<string | null>(null)
  // Story 5.3b fix: Track processId in ref to keep subscription stable even when
  // useTerminal clears activeProcessId from store on exit
  const processIdRef = useRef<string | null>(null)

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
      // Set refs for completion handler (immune to re-renders)
      workflowTypeRef.current = 'planning'
      taskIdRef.current = variables.taskId
      processIdRef.current = result.processId
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
      // Set refs for completion handler (immune to re-renders)
      workflowTypeRef.current = 'create_story'
      taskIdRef.current = variables.taskId
      processIdRef.current = result.processId
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
      // Set refs for completion handler (immune to re-renders)
      workflowTypeRef.current = 'dev_story'
      taskIdRef.current = variables.taskId
      processIdRef.current = result.processId
      // Story 5.3 Task 3: Expand terminal dock on workflow start
      setExpanded(true)
      toast.success('Dev Story workflow started', {
        description: 'Check the terminal for progress'
      })
    },
    onError: handleAgentError
  })

  // Basic task mutation (Story 5.3b - AC: 1)
  const basicTaskMutation = trpc.agent.startBasicTask.useMutation({
    onSuccess: (result, variables) => {
      // Track the active agent process
      setActiveProcess(result.processId)
      // Track which task spawned this agent
      setAgentTask(variables.taskId)
      // Story 5.3b - AC: 1: Track workflow type for completion handling
      setAgentWorkflowType('basic_task')
      // Set refs for completion handler (immune to re-renders)
      workflowTypeRef.current = 'basic_task'
      taskIdRef.current = variables.taskId
      processIdRef.current = result.processId
      // Expand terminal dock on workflow start
      setExpanded(true)
      toast.success('Basic task started', {
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

  // Story 5.3b - AC: 3: Mutation for handling basic task completion
  const handleBasicTaskCompleteMutation = trpc.agent.handleBasicTaskComplete.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Basic task completed', {
          description: 'Task moved to Review'
        })
        // Invalidate tasks query to refresh UI
        utils.tasks.getAll.invalidate()
      } else if (result.error) {
        console.warn(`[useAgentLauncher] Basic task completion: ${result.error}`)
      }
    },
    onError: (error) => {
      console.warn(`[useAgentLauncher] Failed to handle basic task completion: ${error.message}`)
    }
  })

  // Story 5.5 - AC: 5: Mutation for handling dev-story workflow completion
  // Auto-transition to code review on successful completion
  const handleDevStoryCompleteMutation = trpc.agent.handleDevStoryComplete.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('DEV implementation complete', {
          description: 'Starting code review...'
        })
        // Invalidate tasks query to refresh UI
        utils.tasks.getAll.invalidate()
        // TODO: Story 5.6 will add automatic code review workflow trigger here
      } else if (result.error) {
        console.warn(`[useAgentLauncher] Dev story completion: ${result.error}`)
      }
    },
    onError: (error) => {
      console.warn(`[useAgentLauncher] Failed to handle dev-story completion: ${error.message}`)
    }
  })

  // Story 5.3 - AC: 2: Subscribe to PTY exit events for completion handling
  // Story 5.3b - AC: 3: Extended to handle basic_task completion
  // Story 5.3b fix: Use processIdRef for subscription stability - useTerminal clears
  // activeProcessId on exit which could disable this subscription before handler runs
  const subscriptionProcessId = processIdRef.current ?? activeProcessId ?? ''
  trpc.pty.onExit.useSubscription(
    { processId: subscriptionProcessId },
    {
      enabled: !!subscriptionProcessId,
      onData: (event) => {
        // Capture ref values immediately (before any re-renders clear them)
        const currentWorkflowType = workflowTypeRef.current
        const currentTaskId = taskIdRef.current
        const currentProcessId = processIdRef.current

        console.log('[useAgentLauncher] PTY exit event received:', {
          eventProcessId: event.processId,
          exitCode: event.exitCode,
          currentWorkflowType,
          currentTaskId,
          currentProcessId,
          storeAgentTaskId: agentTaskId
        })

        // Clear refs to prevent stale data on next run
        workflowTypeRef.current = null
        taskIdRef.current = null
        processIdRef.current = null

        // CRITICAL: Clear the agent state when any agent exits (regardless of exit code)
        // This allows subsequent workflows (like dev-story after create-story) to launch
        console.log('[useAgentLauncher] Calling clearAgent() to reset agent state')
        clearAgent()

        // Only handle successful exits (exit code 0) and verify processId matches
        if (event.exitCode === 0 && currentProcessId) {
          // Handle create-story workflow completion
          if (currentWorkflowType === 'create_story' && currentTaskId) {
            // Call completion handler to scan for story file and update task
            handleCreateStoryCompleteMutation.mutate({ taskId: currentTaskId })
          }

          // Story 5.3b - AC: 3: Handle basic task completion
          if (currentWorkflowType === 'basic_task' && currentTaskId) {
            // Call completion handler to update task status to 'review'
            handleBasicTaskCompleteMutation.mutate({ taskId: currentTaskId })
          }

          // Story 5.5 - AC: 5: Handle dev-story workflow completion
          // Auto-transition to code review on successful completion
          if (currentWorkflowType === 'dev_story' && currentTaskId) {
            // Call completion handler to update task status to 'review'
            handleDevStoryCompleteMutation.mutate({ taskId: currentTaskId })
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
      console.log('[useAgentLauncher] launchDevStory called:', {
        taskId,
        isAgentRunning,
        agentTaskId,
        activeProcessId
      })
      // Story 5.3 - Task 8: Block concurrent execution (AC 5)
      if (isAgentRunning) {
        console.log('[useAgentLauncher] BLOCKED: Agent already running, showing warning')
        toast.warning('Agent already running', {
          description: 'Another workflow is currently executing. Wait for it to complete.'
        })
        return // Block the launch - don't allow concurrent execution
      }
      console.log('[useAgentLauncher] Calling devStoryMutation.mutate')
      devStoryMutation.mutate({ taskId })
    },
    [devStoryMutation, isAgentRunning, agentTaskId, activeProcessId]
  )

  // Story 5.3b - AC: 1: Launch basic task directly
  const launchBasicTask = useCallback(
    (taskId: string) => {
      // Block concurrent execution
      if (isAgentRunning) {
        toast.warning('Agent already running', {
          description: 'Another workflow is currently executing. Wait for it to complete.'
        })
        return // Block the launch - don't allow concurrent execution
      }
      basicTaskMutation.mutate({ taskId })
    },
    [basicTaskMutation, isAgentRunning]
  )

  return {
    /** Launch a BMAD planning agent for the given task ID */
    launchPlanningAgent,
    /** Story 5.3 - AC: 1: Launch create-story workflow for the given task ID */
    launchCreateStory,
    /** Story 5.3 - AC: 3: Launch dev-story workflow for the given task ID */
    launchDevStory,
    /** Story 5.3b - AC: 1: Launch basic task directly (no BMAD workflow) */
    launchBasicTask,
    /** Whether any agent launch is currently in progress */
    isLaunching:
      launchPlanningMutation.isPending ||
      createStoryMutation.isPending ||
      devStoryMutation.isPending ||
      basicTaskMutation.isPending,
    /** Whether create-story is currently launching */
    isCreatingStory: createStoryMutation.isPending,
    /** Whether dev-story is currently launching */
    isDevStory: devStoryMutation.isPending,
    /** Story 5.3b: Whether basic task is currently launching */
    isBasicTask: basicTaskMutation.isPending,
    /** Story 5.3 - Task 8: Whether an agent is currently running */
    isAgentRunning
  }
}
