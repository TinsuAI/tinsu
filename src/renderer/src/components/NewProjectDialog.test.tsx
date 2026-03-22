import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewProjectDialog } from './NewProjectDialog'

// Mock tRPC mutations
const mockCreateMutate = vi.fn()
const mockSelectDirMutate = vi.fn()
let mockCreateIsPending = false
let mockSelectDirIsPending = false
// mockCreateOnSuccess callback captured from useMutation (write-only, used for mock setup)
let mockCreateOnError: ((error: unknown) => void) | null = null
let mockSelectDirOnSuccess: ((result: unknown) => void) | null = null

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      create: {
        useMutation: (options?: {
          onSuccess?: (result: unknown) => void
          onError?: (error: unknown) => void
        }): object => {
          void options?.onSuccess
          mockCreateOnError = options?.onError || null
          return {
            mutate: mockCreateMutate,
            isPending: mockCreateIsPending,
            isError: false,
            error: null
          }
        }
      },
      selectParentDirectory: {
        useMutation: (options?: {
          onSuccess?: (result: unknown) => void
        }): object => {
          mockSelectDirOnSuccess = options?.onSuccess || null
          return {
            mutate: mockSelectDirMutate,
            isPending: mockSelectDirIsPending,
            isError: false,
            error: null
          }
        }
      }
    }
  }
}))

describe('NewProjectDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onProjectCreated: vi.fn()
  }

  beforeEach(() => {
    mockCreateMutate.mockReset()
    mockSelectDirMutate.mockReset()
    mockCreateIsPending = false
    mockSelectDirIsPending = false
    // mockCreateOnSuccess reset handled by mock setup
    mockCreateOnError = null
    mockSelectDirOnSuccess = null
    defaultProps.onOpenChange.mockReset()
    defaultProps.onProjectCreated.mockReset()
  })

  it('should render project name input and Choose Folder button', () => {
    render(<NewProjectDialog {...defaultProps} />)

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('my-project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument()
  })

  it('should have Create Project button disabled until both fields are filled', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const createButton = screen.getByRole('button', { name: /create project/i })
    expect(createButton).toBeDisabled()

    // Type a project name
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Still disabled because no parent dir
    expect(createButton).toBeDisabled()
  })

  it('should show path preview when both fields have values', async () => {
    render(<NewProjectDialog {...defaultProps} />)

    // Type project name
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Simulate selecting a directory via the captured onSuccess callback
    if (mockSelectDirOnSuccess) {
      mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
    }

    // Path preview should show the combined path
    await waitFor(() => {
      expect(screen.getByText('Will be created at:')).toBeInTheDocument()
      expect(screen.getByText('/Users/me/dev/test-project')).toBeInTheDocument()
    })
  })

  it('should show inline error on mutation failure', async () => {
    render(<NewProjectDialog {...defaultProps} />)

    // Fill in fields first
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Simulate error
    if (mockCreateOnError) {
      mockCreateOnError({ message: "A folder named 'test-project' already exists at that location." })
    }

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    })
  })

  it('should disable inputs during isPending', () => {
    mockCreateIsPending = true

    render(<NewProjectDialog {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText('my-project')
    expect(nameInput).toBeDisabled()

    const chooseFolderButton = screen.getByRole('button', { name: /choose folder/i })
    expect(chooseFolderButton).toBeDisabled()

    // Button should show "Creating..."
    expect(screen.getByText(/creating/i)).toBeInTheDocument()
  })

  it('should call onOpenChange(false) when Cancel is clicked', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should strip invalid characters from project name', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'my:project?name' } })

    // Invalid chars should be stripped, leaving "myprojectname"
    expect(nameInput).toHaveValue('myprojectname')

    // Should show validation message
    expect(screen.getByText(/invalid characters/i)).toBeInTheDocument()
  })
})
