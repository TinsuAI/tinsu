import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Welcome } from './Welcome'

// Mock tRPC — must cover all hooks Welcome.tsx uses
const mockOpenMutate = vi.fn()
let mockOpenIsPending = false
let mockOpenOnSuccess: ((result: unknown) => void) | null = null
let mockOpenOnError: ((error: unknown) => void) | null = null

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      open: {
        useMutation: (options?: {
          onSuccess?: (result: unknown) => void
          onError?: (error: unknown) => void
        }): object => {
          mockOpenOnSuccess = options?.onSuccess || null
          mockOpenOnError = options?.onError || null
          return {
            mutate: mockOpenMutate,
            mutateAsync: mockOpenMutate,
            isPending: mockOpenIsPending,
            isError: false,
            error: null
          }
        }
      },
      openPath: {
        useMutation: (): object => ({
          mutate: vi.fn(),
          isPending: false,
          isError: false,
          error: null
        })
      },
      remove: {
        useMutation: (): object => ({
          mutate: vi.fn(),
          isPending: false,
          isError: false,
          error: null
        })
      },
      getRecent: {
        useQuery: (): object => ({
          data: [],
          isLoading: false,
          isError: false
        })
      },
      validatePath: {},
      // Story 1.11: NewProjectDialog needs these
      selectParentDirectory: {
        useMutation: (): object => ({
          mutate: vi.fn(),
          isPending: false,
          isError: false,
          error: null
        })
      },
      create: {
        useMutation: (): object => ({
          mutate: vi.fn(),
          isPending: false,
          isError: false,
          error: null
        })
      }
    },
    useUtils: () => ({
      project: {
        getRecent: {
          invalidate: vi.fn()
        }
      }
    }),
    useQueries: () => []
  }
}))

describe('Welcome', () => {
  beforeEach(() => {
    mockOpenMutate.mockReset()
    mockOpenIsPending = false
    mockOpenOnSuccess = null
    mockOpenOnError = null
  })

  it('should render TinSu branding', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render "Open Existing Project" button', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByRole('button', { name: /open existing project/i })).toBeInTheDocument()
  })

  it('should display updated hint text', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByText(/open an existing git repository or create a new project/i)).toBeInTheDocument()
  })

  it('should trigger project.open mutation when button is clicked', async () => {
    render(<Welcome onProjectOpened={() => {}} />)

    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    expect(mockOpenMutate).toHaveBeenCalled()
  })

  it('should call onProjectOpened callback when project is successfully opened', async () => {
    const onProjectOpened = vi.fn()

    render(<Welcome onProjectOpened={onProjectOpened} />)

    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    // Simulate successful mutation callback
    if (mockOpenOnSuccess) {
      mockOpenOnSuccess({
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
    if (mockOpenOnSuccess) {
      mockOpenOnSuccess(null)
    }

    // Wait a bit and verify callback was not called
    await waitFor(() => {
      expect(mockOpenMutate).toHaveBeenCalled()
    })

    expect(onProjectOpened).not.toHaveBeenCalled()
  })

  // Story 1.11: "Create New Project" button tests
  it('should render "Create New Project" button on Welcome screen', () => {
    render(<Welcome onProjectOpened={() => {}} />)
    expect(screen.getByRole('button', { name: /create new project/i })).toBeInTheDocument()
  })

  it('should open NewProjectDialog when "Create New Project" is clicked', async () => {
    render(<Welcome onProjectOpened={() => {}} />)

    const createButton = screen.getByRole('button', { name: /create new project/i })
    fireEvent.click(createButton)

    // Dialog should appear - look for the dialog role element and its content
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // The dialog contains the "Project Name" label and "Choose Folder" button
      expect(screen.getByPlaceholderText('my-project')).toBeInTheDocument()
    })
  })
})

describe('Welcome loading state', () => {
  it('should disable button when isPending is true', () => {
    // Set isPending to true for this test
    mockOpenIsPending = true

    render(<Welcome onProjectOpened={() => {}} />)

    const button = screen.getByRole('button', { name: /opening/i })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Opening...')
  })
})

describe('Welcome error handling', () => {
  beforeEach(() => {
    // Reset state after loading state test
    mockOpenIsPending = false
  })

  it('should display error message when project.open fails', async () => {
    render(<Welcome onProjectOpened={() => {}} />)

    // Click button to trigger mutation
    const button = screen.getByRole('button', { name: /open existing project/i })
    fireEvent.click(button)

    // Simulate error callback
    if (mockOpenOnError) {
      mockOpenOnError({ message: 'TinSu requires a git repository' })
    }

    // Check error is displayed
    await waitFor(() => {
      expect(screen.getByText(/TinSu requires a git repository/i)).toBeInTheDocument()
    })
  })
})
