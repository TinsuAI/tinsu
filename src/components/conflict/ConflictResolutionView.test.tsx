/**
 * Integration tests for ConflictResolutionView component.
 *
 * Story 8.8: Conflict Resolution UI - Task 10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConflictResolutionView } from './ConflictResolutionView'

// Mock tRPC
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      tasks: {
        getById: { invalidate: vi.fn() },
        getAllWithEpics: { invalidate: vi.fn() }
      },
      git: {
        getConflictFileContent: { invalidate: vi.fn() }
      }
    }),
    git: {
      getConflictFileContent: {
        useQuery: vi.fn(() => ({
          data: `<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> feature-branch`,
          isLoading: false,
          error: null
        }))
      },
      saveConflictFileContent: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync.mockResolvedValue({ success: true }),
          isPending: false
        }))
      },
      stageResolvedFile: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync.mockResolvedValue({ success: true }),
          isPending: false
        }))
      },
      completeConflictResolution: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate,
          mutateAsync: mockMutateAsync.mockResolvedValue({ success: true }),
          isPending: false
        }))
      },
      openInSystemEditor: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate,
          isPending: false
        }))
      }
    }
  }
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="mock-monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )),
  loader: {
    config: vi.fn()
  }
}))

describe('ConflictResolutionView', () => {
  const defaultProps = {
    taskId: 'task-123',
    conflictFiles: ['src/main.ts', 'package.json'],
    worktreePath: '/project/.tinsu/worktrees/task-123',
    branchName: 'tinsu/story-task-123-feature',
    onClose: vi.fn(),
    onResolved: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders file list correctly', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByText('main.ts')).toBeInTheDocument()
    expect(screen.getByText('package.json')).toBeInTheDocument()
  })

  it('displays branch name in header', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByText(defaultProps.branchName)).toBeInTheDocument()
  })

  it('shows progress indicator', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByText(/of 2/)).toBeInTheDocument()
    expect(screen.getByText(/files resolved/)).toBeInTheDocument()
  })

  it('selects first file by default', async () => {
    render(<ConflictResolutionView {...defaultProps} />)

    // First file should be selected (has different styling)
    const firstFileButton = screen.getByRole('button', { name: /main\.ts/i })
    expect(firstFileButton).toHaveClass('bg-amber-500/15')
  })

  it('changes selected file on click', async () => {
    render(<ConflictResolutionView {...defaultProps} />)

    const secondFile = screen.getByRole('button', { name: /package\.json/i })
    fireEvent.click(secondFile)

    await waitFor(() => {
      expect(secondFile).toHaveClass('bg-amber-500/15')
    })
  })

  it('shows Complete Merge button as disabled when files unresolved', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    const completeMergeBtn = screen.getByRole('button', { name: /Complete Merge/i })
    expect(completeMergeBtn).toBeDisabled()
  })

  it('calls onClose when close button clicked', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    const closeBtn = screen.getByRole('button', { name: /Close/i })
    fireEvent.click(closeBtn)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('opens external editor when button clicked', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    const openEditorBtn = screen.getByRole('button', { name: /Open in Editor/i })
    fireEvent.click(openEditorBtn)

    expect(mockMutate).toHaveBeenCalledWith({ path: defaultProps.worktreePath })
  })

  it('displays file path in editor area', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByText('src/main.ts')).toBeInTheDocument()
  })

  it('has accessible dialog role', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows Refresh button', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })

  it('renders conflict resolution title', () => {
    render(<ConflictResolutionView {...defaultProps} />)

    expect(screen.getByText('Resolve Merge Conflicts')).toBeInTheDocument()
  })
})
