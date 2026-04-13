import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictResolutionDialog } from './ConflictResolutionDialog'

// Mock useStorySync
const mockResolveConflict = vi.fn()
const mockIsTaskSyncing = vi.fn()

vi.mock('@renderer/hooks/useStorySync', () => ({
  useStorySync: () => ({
    resolveConflict: mockResolveConflict,
    isTaskSyncing: mockIsTaskSyncing
  })
}))

describe('ConflictResolutionDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    taskId: 'task-123',
    taskTitle: 'Test Story',
    conflictInfo: {
      hasConflict: true,
      hasStatusConflict: true,
      hasContentConflict: false,
      kanbanStatus: 'in_progress',
      fileStatus: 'done'
    },
    onResolved: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveConflict.mockResolvedValue(undefined)
    mockIsTaskSyncing.mockReturnValue(false)
  })

  it('renders dialog with task title', () => {
    render(<ConflictResolutionDialog {...defaultProps} />)

    expect(screen.getByText(/Resolve Conflict: Test Story/)).toBeInTheDocument()
  })

  it('displays status conflict information', () => {
    render(<ConflictResolutionDialog {...defaultProps} />)

    expect(screen.getByText('Kanban Version')).toBeInTheDocument()
    expect(screen.getByText('File Version')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('displays content when hasContentConflict is true', () => {
    const propsWithContent = {
      ...defaultProps,
      conflictInfo: {
        hasConflict: true,
        hasStatusConflict: false,
        hasContentConflict: true,
        kanbanContent: 'Kanban content here',
        fileContent: 'File content here'
      }
    }

    render(<ConflictResolutionDialog {...propsWithContent} />)

    expect(screen.getByText('Kanban content here')).toBeInTheDocument()
    expect(screen.getByText('File content here')).toBeInTheDocument()
  })

  it('truncates long content with ellipsis', () => {
    const longContent = 'x'.repeat(600)
    const propsWithLongContent = {
      ...defaultProps,
      conflictInfo: {
        hasConflict: true,
        hasStatusConflict: false,
        hasContentConflict: true,
        kanbanContent: longContent,
        fileContent: longContent
      }
    }

    render(<ConflictResolutionDialog {...propsWithLongContent} />)

    // Should truncate to 500 chars + '...'
    const preElements = screen.getAllByText(/x+\.\.\./)
    expect(preElements.length).toBe(2)
  })

  it('calls resolveConflict with keepKanban=true when Keep Kanban clicked', async () => {
    render(<ConflictResolutionDialog {...defaultProps} />)

    const keepKanbanButton = screen.getByTestId('keep-kanban')
    fireEvent.click(keepKanbanButton)

    expect(mockResolveConflict).toHaveBeenCalledWith('task-123', true)
  })

  it('calls resolveConflict with keepKanban=false when Keep File clicked', async () => {
    render(<ConflictResolutionDialog {...defaultProps} />)

    const keepFileButton = screen.getByTestId('keep-file')
    fireEvent.click(keepFileButton)

    expect(mockResolveConflict).toHaveBeenCalledWith('task-123', false)
  })

  it('calls onOpenChange(false) when Cancel clicked', () => {
    render(<ConflictResolutionDialog {...defaultProps} />)

    const cancelButton = screen.getByTestId('cancel-conflict')
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows both buttons disabled when syncing', () => {
    mockIsTaskSyncing.mockReturnValue(true)

    render(<ConflictResolutionDialog {...defaultProps} />)

    expect(screen.getByTestId('keep-kanban')).toBeDisabled()
    expect(screen.getByTestId('keep-file')).toBeDisabled()
    expect(screen.getByTestId('cancel-conflict')).toBeDisabled()
  })

  it('does not render when open is false', () => {
    render(<ConflictResolutionDialog {...defaultProps} open={false} />)

    expect(screen.queryByText(/Resolve Conflict/)).not.toBeInTheDocument()
  })
})
