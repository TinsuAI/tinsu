import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentSettingsPanel } from './AgentSettingsPanel'

// Mock tRPC
const mockMutate = vi.fn()
let mockIsPending = false
let mockIsLoading = false
let mockConfigData: { devAgentModel?: string; reviewAgentModel?: string } | undefined = {
  devAgentModel: 'opus',
  reviewAgentModel: 'sonnet'
}
let mockOnSuccess: (() => void) | null = null
let mockOnError: ((error: unknown) => void) | null = null

const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    config: {
      get: {
        useQuery: () => ({
          data: mockConfigData,
          isLoading: mockIsLoading,
          isError: false,
          error: null
        })
      },
      update: {
        useMutation: (options?: {
          onSuccess?: () => void
          onError?: (error: unknown) => void
        }) => {
          mockOnSuccess = options?.onSuccess || null
          mockOnError = options?.onError || null
          return {
            mutate: mockMutate,
            isPending: mockIsPending
          }
        }
      }
    },
    useUtils: () => ({
      config: {
        get: {
          invalidate: mockInvalidate
        }
      }
    })
  }
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('AgentSettingsPanel', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockInvalidate.mockReset()
    mockIsPending = false
    mockIsLoading = false
    mockConfigData = {
      devAgentModel: 'opus',
      reviewAgentModel: 'sonnet'
    }
    mockOnSuccess = null
    mockOnError = null
  })

  it('should render loading state', () => {
    mockIsLoading = true
    render(<AgentSettingsPanel />)
    expect(screen.getByTestId('agent-settings-loading')).toBeInTheDocument()
  })

  it('should render agent settings panel', () => {
    render(<AgentSettingsPanel />)
    expect(screen.getByTestId('agent-settings-panel')).toBeInTheDocument()
  })

  it('should render dev agent model select with current value', () => {
    render(<AgentSettingsPanel />)
    const select = screen.getByTestId('dev-agent-model-select')
    expect(select).toBeInTheDocument()
    expect(select).toHaveTextContent('Claude Opus')
  })

  it('should render review agent model select with current value', () => {
    render(<AgentSettingsPanel />)
    const select = screen.getByTestId('review-agent-model-select')
    expect(select).toBeInTheDocument()
    expect(select).toHaveTextContent('Claude Sonnet')
  })

  it('should render info icons for tooltips', () => {
    render(<AgentSettingsPanel />)
    expect(screen.getByTestId('dev-agent-info')).toBeInTheDocument()
    expect(screen.getByTestId('review-agent-info')).toBeInTheDocument()
  })

  it('should render how it works info box', () => {
    render(<AgentSettingsPanel />)
    expect(screen.getByText('How it works:')).toBeInTheDocument()
    expect(screen.getByText(/Story Tasks use BMAD workflows automatically/i)).toBeInTheDocument()
    expect(screen.getByText(/Basic Tasks execute directly with Claude Code/i)).toBeInTheDocument()
  })

  it('should render recommendation badge', () => {
    render(<AgentSettingsPanel />)
    expect(screen.getByText('Recommended Setup')).toBeInTheDocument()
  })

  it('should call updateConfig when dev agent model is changed', async () => {
    render(<AgentSettingsPanel />)

    // Click the dev agent select trigger
    const trigger = screen.getByTestId('dev-agent-model-select')
    fireEvent.click(trigger)

    // Wait for options to appear and click haiku
    await waitFor(() => {
      const haikuOption = screen.getByTestId('dev-model-haiku')
      fireEvent.click(haikuOption)
    })

    expect(mockMutate).toHaveBeenCalledWith({ devAgentModel: 'haiku' })
  })

  it('should call updateConfig when review agent model is changed', async () => {
    render(<AgentSettingsPanel />)

    // Click the review agent select trigger
    const trigger = screen.getByTestId('review-agent-model-select')
    fireEvent.click(trigger)

    // Wait for options to appear and click opus
    await waitFor(() => {
      const opusOption = screen.getByTestId('review-model-opus')
      fireEvent.click(opusOption)
    })

    expect(mockMutate).toHaveBeenCalledWith({ reviewAgentModel: 'opus' })
  })

  it('should disable selects when update is pending', () => {
    mockIsPending = true
    render(<AgentSettingsPanel />)

    const devSelect = screen.getByTestId('dev-agent-model-select')
    const reviewSelect = screen.getByTestId('review-agent-model-select')

    expect(devSelect).toHaveAttribute('data-disabled', '')
    expect(reviewSelect).toHaveAttribute('data-disabled', '')
  })

  it('should show default values when config has no model settings', () => {
    mockConfigData = {}
    render(<AgentSettingsPanel />)

    const devSelect = screen.getByTestId('dev-agent-model-select')
    const reviewSelect = screen.getByTestId('review-agent-model-select')

    expect(devSelect).toHaveTextContent('Claude Opus')
    expect(reviewSelect).toHaveTextContent('Claude Sonnet')
  })

  it('should show success toast when settings are updated', async () => {
    const { toast } = await import('sonner')
    render(<AgentSettingsPanel />)

    // Trigger onSuccess callback
    if (mockOnSuccess) {
      mockOnSuccess()
    }

    expect(toast.success).toHaveBeenCalledWith('Agent settings updated')
    expect(mockInvalidate).toHaveBeenCalled()
  })

  it('should show error toast when update fails', async () => {
    const { toast } = await import('sonner')
    render(<AgentSettingsPanel />)

    // Trigger onError callback
    if (mockOnError) {
      mockOnError({ message: 'Network error' })
    }

    expect(toast.error).toHaveBeenCalledWith('Failed to update settings', {
      description: 'Network error'
    })
  })
})
