import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskWorkspacePage } from './TaskWorkspacePage'
import { useTaskWorkspaceStore } from '@renderer/stores/task-workspace.store'
import { trpc } from '@renderer/lib/trpc'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getById: {
        useQuery: vi.fn()
      }
    }
  }
}))

// Mock TaskDetailContent since it has its own tests
vi.mock('@renderer/components/task/TaskDetailContent', () => ({
  TaskDetailContent: ({ taskId, onClose }: { taskId: string; onClose: () => void }) => (
    <div data-testid="task-detail-content">
      <span data-testid="content-task-id">{taskId}</span>
      <button data-testid="mock-back-button" onClick={onClose}>
        Back
      </button>
    </div>
  )
}))

describe('TaskWorkspacePage', () => {
  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'in_progress' as const,
    task_type: 'story' as const,
    sort_order: 0,
    created_at: new Date(),
    updated_at: new Date()
  }

  beforeEach(() => {
    // Reset store state before each test
    useTaskWorkspaceStore.setState({
      activeTaskId: null,
      returnTaskId: null
    })

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore body scroll after each test
    document.body.style.overflow = ''
  })

  describe('when no task is active', () => {
    it('should render nothing when activeTaskId is null', () => {
      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        error: null
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)

      const { container } = render(<TaskWorkspacePage />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when task is loading', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)

      render(<TaskWorkspacePage />)

      expect(screen.getByText('Loading task...')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should show error message when task is not found', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Task not found')
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)

      render(<TaskWorkspacePage />)

      expect(screen.getByText('Task not found')).toBeInTheDocument()
      expect(screen.getByText(/doesn't exist or has been deleted/)).toBeInTheDocument()
    })

    it('should show back button on error page', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Task not found')
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)

      render(<TaskWorkspacePage />)

      expect(screen.getByText('Back to Board')).toBeInTheDocument()
    })

    it('should navigate back when clicking back button on error page', () => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Task not found')
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)

      render(<TaskWorkspacePage />)

      fireEvent.click(screen.getByText('Back to Board'))

      // Should have closed the workspace
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBeNull()
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBe('task-1')
    })
  })

  describe('successful render', () => {
    beforeEach(() => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: mockTask,
        isLoading: false,
        error: null
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)
    })

    it('should render TaskDetailContent with correct taskId', () => {
      render(<TaskWorkspacePage />)

      expect(screen.getByTestId('task-detail-content')).toBeInTheDocument()
      expect(screen.getByTestId('content-task-id')).toHaveTextContent('task-1')
    })

    it('should lock body scroll when mounted', () => {
      render(<TaskWorkspacePage />)

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when unmounted', () => {
      const { unmount } = render(<TaskWorkspacePage />)

      expect(document.body.style.overflow).toBe('hidden')

      unmount()

      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('keyboard navigation (AC: #2)', () => {
    beforeEach(() => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: mockTask,
        isLoading: false,
        error: null
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)
    })

    it('should navigate back when Escape key is pressed', async () => {
      render(<TaskWorkspacePage />)

      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => {
        expect(useTaskWorkspaceStore.getState().activeTaskId).toBeNull()
        expect(useTaskWorkspaceStore.getState().returnTaskId).toBe('task-1')
      })
    })

    it('should not navigate back when Escape is pressed in input field', () => {
      render(<TaskWorkspacePage />)

      // Create an input element and focus it
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      fireEvent.keyDown(window, { key: 'Escape' })

      // Should not have navigated back
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-1')

      document.body.removeChild(input)
    })

    it('should not navigate back when Escape is pressed in textarea', () => {
      render(<TaskWorkspacePage />)

      // Create a textarea element and focus it
      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      fireEvent.keyDown(window, { key: 'Escape' })

      // Should not have navigated back
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-1')

      document.body.removeChild(textarea)
    })

    it('should not navigate back when Escape is pressed in contenteditable element', () => {
      render(<TaskWorkspacePage />)

      // Create a contenteditable div and focus it
      const editableDiv = document.createElement('div')
      editableDiv.setAttribute('contenteditable', 'true')
      document.body.appendChild(editableDiv)
      editableDiv.focus()

      fireEvent.keyDown(window, { key: 'Escape' })

      // Should not have navigated back
      expect(useTaskWorkspaceStore.getState().activeTaskId).toBe('task-1')

      document.body.removeChild(editableDiv)
    })
  })

  describe('back button navigation (AC: #1, #2)', () => {
    beforeEach(() => {
      useTaskWorkspaceStore.setState({ activeTaskId: 'task-1' })

      vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
        data: mockTask,
        isLoading: false,
        error: null
      } as ReturnType<typeof trpc.tasks.getById.useQuery>)
    })

    it('should navigate back when back button is clicked', () => {
      render(<TaskWorkspacePage />)

      fireEvent.click(screen.getByTestId('mock-back-button'))

      expect(useTaskWorkspaceStore.getState().activeTaskId).toBeNull()
      expect(useTaskWorkspaceStore.getState().returnTaskId).toBe('task-1')
    })
  })
})
