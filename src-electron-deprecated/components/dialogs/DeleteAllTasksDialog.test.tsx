import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteAllTasksDialog } from './DeleteAllTasksDialog'

// Mock tRPC
const mockMutate = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      deleteAll: {
        useMutation: vi.fn((opts: { onSuccess?: (result: { deletedCount: number }) => void }) => ({
          mutate: () => {
            mockMutate()
            opts.onSuccess?.({ deletedCount: 5 })
          },
          isPending: false
        }))
      }
    },
    useUtils: () => ({
      tasks: {
        getAll: { invalidate: mockInvalidate },
        getPlanningTasks: { invalidate: mockInvalidate },
        getAllWithEpics: { invalidate: mockInvalidate }
      }
    })
  }
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

describe('DeleteAllTasksDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    expect(screen.getByRole('heading', { name: /Delete All Tasks/i })).toBeInTheDocument()
    expect(screen.getByText(/permanently delete all tasks/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <DeleteAllTasksDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.queryByText('Delete All Tasks')).not.toBeInTheDocument()
  })

  it('calls onOpenChange with false when Cancel is clicked', () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    fireEvent.click(screen.getByTestId('cancel-delete-all'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls deleteAll mutation when Delete All Tasks is clicked', async () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    fireEvent.click(screen.getByTestId('confirm-delete-all'))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })

  it('calls onSuccess callback after successful deletion', async () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    fireEvent.click(screen.getByTestId('confirm-delete-all'))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(5)
    })
  })

  it('closes dialog after successful deletion', async () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    fireEvent.click(screen.getByTestId('confirm-delete-all'))

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('shows warning icon in title', () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    // The AlertTriangle icon should be present in the heading
    const heading = screen.getByRole('heading', { name: /Delete All Tasks/i })
    expect(heading.querySelector('svg')).toBeInTheDocument()
  })

  it('displays warning message about permanent deletion', () => {
    render(
      <DeleteAllTasksDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
    )

    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByText(/planning tasks and story tasks/i)).toBeInTheDocument()
  })
})
