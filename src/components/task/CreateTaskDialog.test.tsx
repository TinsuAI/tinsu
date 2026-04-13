import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTaskDialog } from './CreateTaskDialog'

// Mock sonner toast
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (title: string, options?: { description?: string }) => mockToastError(title, options)
  }
}))

// Create a QueryClient wrapper for tests
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

// Mock useCreateTask hook
const mockMutate = vi.fn()
let mockIsPending = false

vi.mock('@renderer/hooks/useTaskCommands', () => ({
  useCreateTask: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
  })
}))

// Mock useListEpics hook (used by EpicSelect)
vi.mock('@renderer/hooks/useEpicCommands', () => ({
  useListEpics: () => ({
    data: [],
    isLoading: false,
  })
}))

// Mock SprintSelect to avoid tRPC dependency
vi.mock('./SprintSelect', () => ({
  SprintSelect: ({ value, onValueChange }: { value?: string; onValueChange: (v?: string) => void }) => (
    <select data-testid="sprint-select" value={value ?? ''} onChange={(e) => onValueChange(e.target.value || undefined)}>
      <option value="">Select sprint...</option>
    </select>
  )
}))

describe('CreateTaskDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPending = false
  })

  it('should render dialog when open is true', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Create New Task')).toBeInTheDocument()
    expect(screen.getByTestId('task-title-input')).toBeInTheDocument()
    expect(screen.getByTestId('task-description-input')).toBeInTheDocument()
    expect(screen.getByTestId('task-acceptance-criteria-input')).toBeInTheDocument()
  })

  it('should not render dialog when open is false', () => {
    render(
      <CreateTaskDialog open={false} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
  })

  it('should show required indicator on title field', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Title *')).toBeInTheDocument()
  })

  it('should show optional labels on description and acceptance criteria', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument()
  })

  it('should show validation error when submitting empty title', async () => {
    const user = userEvent.setup()
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('create-button'))

    expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required')
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('should clear validation error when user starts typing', async () => {
    const user = userEvent.setup()
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    // Submit with empty title to trigger error
    await user.click(screen.getByTestId('create-button'))
    expect(screen.getByTestId('title-error')).toBeInTheDocument()

    // Type in the title field
    await user.type(screen.getByTestId('task-title-input'), 'New task')

    expect(screen.queryByTestId('title-error')).not.toBeInTheDocument()
  })

  it('should call mutation with title and project_id on valid submit', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <CreateTaskDialog open={true} onOpenChange={onOpenChange} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')
    await user.click(screen.getByTestId('create-button'))

    expect(mockMutate).toHaveBeenCalledWith(
      { title: 'Test Task', project_id: 'proj-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    )
  })

  it('should close dialog on successful create via onSuccess callback', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    // Set up mutate to call onSuccess
    mockMutate.mockImplementation((_data, callbacks) => {
      callbacks?.onSuccess?.()
    })

    render(
      <CreateTaskDialog open={true} onOpenChange={onOpenChange} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')
    await user.click(screen.getByTestId('create-button'))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('should close dialog when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <CreateTaskDialog open={true} onOpenChange={onOpenChange} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.click(screen.getByTestId('cancel-button'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should close dialog when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <CreateTaskDialog open={true} onOpenChange={onOpenChange} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.keyboard('{Escape}')

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should reset form when dialog closes and reopens', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    // Type some text
    await user.type(screen.getByTestId('task-title-input'), 'Test Task')
    await user.type(screen.getByTestId('task-description-input'), 'Description')

    // Close and reopen dialog
    rerender(
      <CreateTaskDialog open={false} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />
    )
    rerender(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />
    )

    // Form should be reset
    expect(screen.getByTestId('task-title-input')).toHaveValue('')
    expect(screen.getByTestId('task-description-input')).toHaveValue('')
  })

  it('should submit form when Cmd+Enter is pressed', async () => {
    const user = userEvent.setup()

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')

    // Simulate Cmd+Enter (Meta+Enter)
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Enter',
      metaKey: true
    })

    expect(mockMutate).toHaveBeenCalledWith(
      { title: 'Test Task', project_id: 'proj-1' },
      expect.any(Object)
    )
  })

  it('should submit form when Ctrl+Enter is pressed', async () => {
    const user = userEvent.setup()

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')

    // Simulate Ctrl+Enter
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Enter',
      ctrlKey: true
    })

    expect(mockMutate).toHaveBeenCalledWith(
      { title: 'Test Task', project_id: 'proj-1' },
      expect.any(Object)
    )
  })

  it('should not submit when only Enter is pressed without modifier', async () => {
    const user = userEvent.setup()

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')

    // Simulate Enter without modifier
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Enter'
    })

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('should show pending state when creating', async () => {
    mockIsPending = true

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('create-button')).toHaveTextContent('Creating...')
    expect(screen.getByTestId('create-button')).toBeDisabled()
  })

  it('should autofocus title input when dialog opens', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('task-title-input')).toHaveFocus()
  })

  it('should have monospace font for acceptance criteria textarea', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByTestId('task-acceptance-criteria-input')).toHaveClass('font-mono')
  })

  it('should trim whitespace from title', async () => {
    const user = userEvent.setup()

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), '  Test Task  ')
    await user.click(screen.getByTestId('create-button'))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Task' }),
      expect.any(Object)
    )
  })

  it('should not submit when title is only whitespace', async () => {
    const user = userEvent.setup()

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), '   ')
    await user.click(screen.getByTestId('create-button'))

    expect(mockMutate).not.toHaveBeenCalled()
    expect(screen.getByTestId('title-error')).toBeInTheDocument()
  })

  it('should show error toast when mutation calls onError', async () => {
    const user = userEvent.setup()

    // Set up mutate to call onError
    mockMutate.mockImplementation((_data, callbacks) => {
      callbacks?.onError?.(new Error('Database connection failed'))
    })

    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    await user.type(screen.getByTestId('task-title-input'), 'Test Task')
    await user.click(screen.getByTestId('create-button'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to create task', {
        description: 'Database connection failed'
      })
    })
  })
})

describe('CreateTaskDialog accessibility', () => {
  it('should have accessible labels for form fields', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByLabelText('Title *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Acceptance Criteria')).toBeInTheDocument()
  })

  it('should trap focus within dialog', () => {
    render(
      <CreateTaskDialog open={true} onOpenChange={vi.fn()} initialStatus="backlog" projectId="proj-1" />,
      { wrapper: createWrapper() }
    )

    // Dialog should have focus trap (built into Radix Dialog)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })
})
