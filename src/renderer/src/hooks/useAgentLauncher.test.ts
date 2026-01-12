import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentLauncher } from './useAgentLauncher'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}))

// Mock tRPC
const mockLaunchMutate = vi.fn()
const mockCreateStoryMutate = vi.fn()
const mockDevStoryMutate = vi.fn()
const mockBasicTaskMutate = vi.fn()
const mockHandleCompleteMutate = vi.fn()
const mockHandleBasicTaskCompleteMutate = vi.fn()
let mockOnSuccess: ((result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void) | undefined
let mockOnError: ((error: Error) => void) | undefined
let mockCreateStoryOnSuccess: ((result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void) | undefined
let mockCreateStoryOnError: ((error: Error) => void) | undefined
let mockDevStoryOnSuccess: ((result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void) | undefined
let mockDevStoryOnError: ((error: Error) => void) | undefined
let mockBasicTaskOnSuccess: ((result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void) | undefined
let mockBasicTaskOnError: ((error: Error) => void) | undefined
let mockHandleCompleteOnSuccess: ((result: { success: boolean; storyFilePath: string | null; error?: string }) => void) | undefined
let mockHandleBasicTaskCompleteOnSuccess: ((result: { success: boolean; newStatus?: string; error?: string }) => void) | undefined
let mockExitSubscriptionOnData: ((event: { processId: string; exitCode: number; signal?: number }) => void) | undefined

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      tasks: {
        getAll: {
          invalidate: vi.fn()
        }
      }
    }),
    agent: {
      launchPlanningAgent: {
        useMutation: (options?: {
          onSuccess?: (result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockOnSuccess = options?.onSuccess
          mockOnError = options?.onError
          return {
            mutate: mockLaunchMutate,
            isPending: false
          }
        }
      },
      startCreateStory: {
        useMutation: (options?: {
          onSuccess?: (result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockCreateStoryOnSuccess = options?.onSuccess
          mockCreateStoryOnError = options?.onError
          return {
            mutate: mockCreateStoryMutate,
            isPending: false
          }
        }
      },
      startDevStory: {
        useMutation: (options?: {
          onSuccess?: (result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockDevStoryOnSuccess = options?.onSuccess
          mockDevStoryOnError = options?.onError
          return {
            mutate: mockDevStoryMutate,
            isPending: false
          }
        }
      },
      handleCreateStoryComplete: {
        useMutation: (options?: {
          onSuccess?: (result: { success: boolean; storyFilePath: string | null; error?: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockHandleCompleteOnSuccess = options?.onSuccess
          return {
            mutate: mockHandleCompleteMutate,
            isPending: false
          }
        }
      },
      startBasicTask: {
        useMutation: (options?: {
          onSuccess?: (result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockBasicTaskOnSuccess = options?.onSuccess
          mockBasicTaskOnError = options?.onError
          return {
            mutate: mockBasicTaskMutate,
            isPending: false
          }
        }
      },
      handleBasicTaskComplete: {
        useMutation: (options?: {
          onSuccess?: (result: { success: boolean; newStatus?: string; error?: string }) => void
          onError?: (error: Error) => void
        }) => {
          mockHandleBasicTaskCompleteOnSuccess = options?.onSuccess
          return {
            mutate: mockHandleBasicTaskCompleteMutate,
            isPending: false
          }
        }
      }
    },
    pty: {
      onExit: {
        useSubscription: (
          _input: { processId: string },
          options: { enabled: boolean; onData: (event: { processId: string; exitCode: number; signal?: number }) => void }
        ) => {
          if (options.enabled) {
            mockExitSubscriptionOnData = options.onData
          }
        }
      }
    }
  }
}))

describe('useAgentLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset terminal store to default state
    useTerminalStore.setState({
      isExpanded: false,
      height: 300,
      activeProcessId: null,
      agentTaskId: null,
      agentWorkflowType: null
    })
    // Reset subscription callback
    mockExitSubscriptionOnData = undefined
  })

  describe('launchPlanningAgent', () => {
    it('should call the tRPC mutation with taskId', () => {
      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchPlanningAgent('task-123')
      })

      expect(mockLaunchMutate).toHaveBeenCalledWith({ taskId: 'task-123' })
    })

    it('should accept different taskIds on each call', () => {
      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchPlanningAgent('task-1')
      })
      act(() => {
        result.current.launchPlanningAgent('task-2')
      })

      expect(mockLaunchMutate).toHaveBeenCalledTimes(2)
      expect(mockLaunchMutate).toHaveBeenNthCalledWith(1, { taskId: 'task-1' })
      expect(mockLaunchMutate).toHaveBeenNthCalledWith(2, { taskId: 'task-2' })
    })
  })

  describe('launchPlanningAgent - onSuccess', () => {
    it('should set active process on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockOnSuccess?.(
          { processId: 'process-abc-123', command: 'claude', args: ['bmad:bmm:agents:pm'] },
          { taskId: 'task-xyz' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.activeProcessId).toBe('process-abc-123')
    })

    it('should set agent task id on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockOnSuccess?.(
          { processId: 'process-123', command: 'claude', args: ['bmad:bmm:agents:pm'] },
          { taskId: 'task-456' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentTaskId).toBe('task-456')
    })

    it('should expand terminal dock on success', () => {
      useTerminalStore.setState({ isExpanded: false })

      renderHook(() => useAgentLauncher())

      act(() => {
        mockOnSuccess?.(
          { processId: 'process-123', command: 'claude', args: ['bmad:bmm:agents:pm'] },
          { taskId: 'task-789' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.isExpanded).toBe(true)
    })
  })

  describe('launchPlanningAgent - onError', () => {
    it('should show error toast when CLI not installed', () => {
      renderHook(() => useAgentLauncher())

      const error = new Error('Claude Code CLI is not installed. Run: npm install -g @anthropic-ai/claude-code')
      act(() => {
        mockOnError?.(error)
      })

      expect(toast.error).toHaveBeenCalledWith(
        'Claude Code CLI is not installed. Run: npm install -g @anthropic-ai/claude-code',
        expect.objectContaining({
          description: 'Please install Claude Code CLI to continue.',
          duration: 10000
        })
      )
    })

    it('should show context-appropriate error toast for non-CLI errors', () => {
      renderHook(() => useAgentLauncher())

      const error = new Error('Task not found')
      act(() => {
        mockOnError?.(error)
      })

      expect(toast.error).toHaveBeenCalledWith(
        'Task not found',
        expect.objectContaining({
          description: 'Please check the task and try again.'
        })
      )
    })
  })

  describe('launchCreateStory (Story 5.3 - AC: 1)', () => {
    it('should call the tRPC mutation with taskId', () => {
      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchCreateStory('task-123')
      })

      expect(mockCreateStoryMutate).toHaveBeenCalledWith({ taskId: 'task-123' })
    })

    it('should expand terminal dock on success (Task 3)', () => {
      useTerminalStore.setState({ isExpanded: false })

      renderHook(() => useAgentLauncher())

      act(() => {
        mockCreateStoryOnSuccess?.(
          { processId: 'process-create-1', command: 'claude', args: ['--dangerously-skip-permissions', '/bmad:bmm:workflows:create-story'] },
          { taskId: 'task-create-story' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.isExpanded).toBe(true)
    })

    it('should set active process on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockCreateStoryOnSuccess?.(
          { processId: 'process-create-2', command: 'claude', args: [] },
          { taskId: 'task-456' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.activeProcessId).toBe('process-create-2')
    })

    it('should set agent task id on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockCreateStoryOnSuccess?.(
          { processId: 'process-create-3', command: 'claude', args: [] },
          { taskId: 'task-789' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentTaskId).toBe('task-789')
    })

    it('should show success toast on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockCreateStoryOnSuccess?.(
          { processId: 'process-create-4', command: 'claude', args: [] },
          { taskId: 'task-toast' }
        )
      })

      expect(toast.success).toHaveBeenCalledWith('Create Story workflow started', {
        description: 'Check the terminal for progress'
      })
    })

    it('should show error toast on error', () => {
      renderHook(() => useAgentLauncher())

      const error = new Error('Task not found')
      act(() => {
        mockCreateStoryOnError?.(error)
      })

      expect(toast.error).toHaveBeenCalledWith(
        'Task not found',
        expect.objectContaining({
          description: 'Please check the task and try again.'
        })
      )
    })
  })

  describe('launchDevStory (Story 5.3 - AC: 3)', () => {
    it('should call the tRPC mutation with taskId', () => {
      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchDevStory('task-123')
      })

      expect(mockDevStoryMutate).toHaveBeenCalledWith({ taskId: 'task-123' })
    })

    it('should expand terminal dock on success (Task 3)', () => {
      useTerminalStore.setState({ isExpanded: false })

      renderHook(() => useAgentLauncher())

      act(() => {
        mockDevStoryOnSuccess?.(
          { processId: 'process-dev-1', command: 'claude', args: ['--dangerously-skip-permissions', '/bmad:bmm:workflows:dev-story'] },
          { taskId: 'task-dev-story' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.isExpanded).toBe(true)
    })

    it('should set active process on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockDevStoryOnSuccess?.(
          { processId: 'process-dev-2', command: 'claude', args: [] },
          { taskId: 'task-456' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.activeProcessId).toBe('process-dev-2')
    })

    it('should set agent task id on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockDevStoryOnSuccess?.(
          { processId: 'process-dev-3', command: 'claude', args: [] },
          { taskId: 'task-789' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentTaskId).toBe('task-789')
    })

    it('should show success toast on success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockDevStoryOnSuccess?.(
          { processId: 'process-dev-4', command: 'claude', args: [] },
          { taskId: 'task-toast' }
        )
      })

      expect(toast.success).toHaveBeenCalledWith('Dev Story workflow started', {
        description: 'Check the terminal for progress'
      })
    })

    it('should show error toast on error', () => {
      renderHook(() => useAgentLauncher())

      const error = new Error('Story file not ready')
      act(() => {
        mockDevStoryOnError?.(error)
      })

      expect(toast.error).toHaveBeenCalledWith(
        'Story file not ready',
        expect.objectContaining({
          description: 'Please check the task and try again.'
        })
      )
    })
  })

  describe('isLaunching', () => {
    it('should return isLaunching from mutation state', () => {
      const { result } = renderHook(() => useAgentLauncher())

      // Default mock returns isPending: false
      expect(result.current.isLaunching).toBe(false)
    })
  })

  describe('isAgentRunning (Story 5.3 - Task 8)', () => {
    it('should return false when no agent is running', () => {
      useTerminalStore.setState({ agentTaskId: null })

      const { result } = renderHook(() => useAgentLauncher())

      expect(result.current.isAgentRunning).toBe(false)
    })

    it('should return true when an agent is running', () => {
      useTerminalStore.setState({ agentTaskId: 'task-123' })

      const { result } = renderHook(() => useAgentLauncher())

      expect(result.current.isAgentRunning).toBe(true)
    })
  })

  describe('concurrent execution blocking (Story 5.3 - AC 5)', () => {
    it('should show warning and BLOCK launch when agent is running (launchCreateStory)', () => {
      useTerminalStore.setState({ agentTaskId: 'existing-task' })

      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchCreateStory('task-123')
      })

      expect(toast.warning).toHaveBeenCalledWith('Agent already running', {
        description: 'Another workflow is currently executing. Wait for it to complete.'
      })
      // CRITICAL: Verify mutation was NOT called (blocked)
      expect(mockCreateStoryMutate).not.toHaveBeenCalled()
    })

    it('should not show warning and ALLOW launch when no agent is running', () => {
      useTerminalStore.setState({ agentTaskId: null })

      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchCreateStory('task-123')
      })

      expect(toast.warning).not.toHaveBeenCalled()
      // Verify mutation WAS called (allowed)
      expect(mockCreateStoryMutate).toHaveBeenCalledWith({ taskId: 'task-123' })
    })

    it('should show warning and BLOCK launch when agent is running (launchDevStory)', () => {
      useTerminalStore.setState({ agentTaskId: 'existing-task' })

      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchDevStory('task-456')
      })

      expect(toast.warning).toHaveBeenCalledWith('Agent already running', {
        description: 'Another workflow is currently executing. Wait for it to complete.'
      })
      // CRITICAL: Verify mutation was NOT called (blocked)
      expect(mockDevStoryMutate).not.toHaveBeenCalled()
    })

    it('should show warning and BLOCK launch when agent is running (launchPlanningAgent)', () => {
      useTerminalStore.setState({ agentTaskId: 'existing-task' })

      const { result } = renderHook(() => useAgentLauncher())

      act(() => {
        result.current.launchPlanningAgent('task-789')
      })

      expect(toast.warning).toHaveBeenCalledWith('Agent already running', {
        description: 'Another workflow is currently executing. Wait for it to complete.'
      })
      // CRITICAL: Verify mutation was NOT called (blocked)
      expect(mockLaunchMutate).not.toHaveBeenCalled()
    })
  })

  describe('workflow type tracking (Story 5.3 - AC: 2)', () => {
    it('should set workflow type to "planning" on planning agent success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockOnSuccess?.(
          { processId: 'process-planning', command: 'claude', args: [] },
          { taskId: 'task-123' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentWorkflowType).toBe('planning')
    })

    it('should set workflow type to "create_story" on create-story success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockCreateStoryOnSuccess?.(
          { processId: 'process-create', command: 'claude', args: [] },
          { taskId: 'task-456' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentWorkflowType).toBe('create_story')
    })

    it('should set workflow type to "dev_story" on dev-story success', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockDevStoryOnSuccess?.(
          { processId: 'process-dev', command: 'claude', args: [] },
          { taskId: 'task-789' }
        )
      })

      const state = useTerminalStore.getState()
      expect(state.agentWorkflowType).toBe('dev_story')
    })
  })

  describe('handleCreateStoryComplete callback (Story 5.3 - AC: 2)', () => {
    it('should show success toast when completion handler succeeds', () => {
      renderHook(() => useAgentLauncher())

      act(() => {
        mockHandleCompleteOnSuccess?.({
          success: true,
          storyFilePath: '/path/to/5-3-story.md'
        })
      })

      expect(toast.success).toHaveBeenCalledWith('Story file created', {
        description: 'Task updated with story file path'
      })
    })

    it('should not show toast when completion handler returns error', () => {
      // Clear previous calls
      vi.clearAllMocks()

      renderHook(() => useAgentLauncher())

      act(() => {
        mockHandleCompleteOnSuccess?.({
          success: false,
          storyFilePath: null,
          error: 'Story file not found'
        })
      })

      // Should not show success toast for errors
      expect(toast.success).not.toHaveBeenCalled()
    })
  })
})
