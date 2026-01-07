import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentLauncher } from './useAgentLauncher'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}))

// Mock tRPC
const mockLaunchMutate = vi.fn()
let mockOnSuccess: ((result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void) | undefined
let mockOnError: ((error: Error) => void) | undefined

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    agent: {
      launchPlanningAgent: {
        useMutation: (options?: {
          onSuccess?: (result: { processId: string; command: string; args: string[] }, variables: { taskId: string }) => void
          onError?: (error: Error) => void
        }) => {
          // Store the callbacks for testing
          mockOnSuccess = options?.onSuccess
          mockOnError = options?.onError
          return {
            mutate: mockLaunchMutate,
            isPending: false
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
      agentTaskId: null
    })
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

  describe('onSuccess', () => {
    it('should set active process on success', () => {
      renderHook(() => useAgentLauncher())

      // Simulate successful launch
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

      // Simulate successful launch
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
      // Start with terminal collapsed
      useTerminalStore.setState({ isExpanded: false })

      renderHook(() => useAgentLauncher())

      // Simulate successful launch
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

  describe('onError', () => {
    it('should show error toast when CLI not installed', () => {
      renderHook(() => useAgentLauncher())

      // Simulate error
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

      // Simulate generic error (not CLI related)
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

  describe('isLaunching', () => {
    it('should return isLaunching from mutation state', () => {
      const { result } = renderHook(() => useAgentLauncher())

      // Default mock returns isPending: false
      expect(result.current.isLaunching).toBe(false)
    })
  })
})
