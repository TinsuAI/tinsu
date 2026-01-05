import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Welcome } from './Welcome'

// Mock tRPC
const mockMutate = vi.fn()
let mockIsPending = false
let mockOnSuccess: ((result: unknown) => void) | null = null
let mockOnError: ((error: unknown) => void) | null = null

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      open: {
        useMutation: (options?: {
          onSuccess?: (result: unknown) => void
          onError?: (error: unknown) => void
        }): object => {
          mockOnSuccess = options?.onSuccess || null
          mockOnError = options?.onError || null
          return {
            mutate: mockMutate,
            mutateAsync: mockMutate,
            isPending: mockIsPending,
            isError: false,
            error: null
          }
        }
      }
    }
  }
}))

describe('Welcome', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockIsPending = false
    mockOnSuccess = null
    mockOnError = null
  })

  it('should render TinSu branding', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render "Open Existing Project" button', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByRole('button', { name: /open existing project/i })).toBeInTheDocument()
  })

  it('should display git requirement text', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByText(/git repositories/i)).toBeInTheDocument()
  })

  it('should trigger project.open mutation when button is clicked', async () => {
    render(<Welcome onProjectOpened={() => {}} />)

    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should call onProjectOpened callback when project is successfully opened', async () => {
    const onProjectOpened = vi.fn()

    render(<Welcome onProjectOpened={onProjectOpened} />)

    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    // Simulate successful mutation callback
    if (mockOnSuccess) {
      mockOnSuccess({
        path: '/test/project',
        config: { projectName: 'TestProject' },
        isNewProject: true
      })
    }

    await waitFor(() => {
      expect(onProjectOpened).toHaveBeenCalledWith({
        path: '/test/project',
        projectName: 'TestProject'
      })
    })
  })

  it('should not call onProjectOpened when dialog is cancelled', async () => {
    const onProjectOpened = vi.fn()

    render(<Welcome onProjectOpened={onProjectOpened} />)

    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    // Simulate cancelled dialog (null result)
    if (mockOnSuccess) {
      mockOnSuccess(null)
    }

    // Wait a bit and verify callback was not called
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })

    expect(onProjectOpened).not.toHaveBeenCalled()
  })
})

describe('Welcome loading state', () => {
  it('should disable button when isPending is true', () => {
    // Set isPending to true for this test
    mockIsPending = true

    render(<Welcome onProjectOpened={() => {}} />)

    const button = screen.getByRole('button', { name: /opening/i })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Opening...')
  })
})

describe('Welcome error handling', () => {
  beforeEach(() => {
    // Reset state after loading state test
    mockIsPending = false
  })

  it('should display error message when project.open fails', async () => {
    render(<Welcome onProjectOpened={() => {}} />)

    // Click button to trigger mutation
    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    // Simulate error callback
    if (mockOnError) {
      mockOnError({ message: 'TinSu requires a git repository' })
    }

    // Check error is displayed
    await waitFor(() => {
      expect(screen.getByText(/TinSu requires a git repository/i)).toBeInTheDocument()
    })
  })
})
