import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskDetailContent, type TaskDetailContentProps } from './TaskDetailContent'
import { trpc } from '@renderer/lib/trpc'
import * as QuadPaneLayoutHook from '@renderer/hooks/useQuadPaneLayout'

// Mock dependencies
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getById: {
        useQuery: vi.fn()
      },
      updateFullContent: {
        useMutation: vi.fn()
      },
      getAllWithEpics: {
        invalidate: vi.fn()
      }
    },
    epics: {
      getAll: {
        useQuery: vi.fn()
      }
    },
    agent: {
      getTaskSession: {
        useQuery: vi.fn()
      }
    },
    useUtils: vi.fn()
  }
}))

vi.mock('@renderer/components/task/ActivitiesTab', () => ({
  ActivitiesTab: () => <div data-testid="mock-activities-tab">Activities Tab</div>
}))

vi.mock('@renderer/components/task/TaskTerminal', () => ({
  TaskTerminal: ({ taskId }: { taskId: string }) => (
    <div data-testid="mock-task-terminal" data-task-id={taskId}>
      Terminal Output
    </div>
  )
}))

vi.mock('@renderer/components/editor', () => ({
  NotionEditor: ({ content, onChange }: { content: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="mock-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}))

vi.mock('@renderer/components/task/EpicBadge', () => ({
  EpicBadge: ({ title }: { title: string }) => <div data-testid="mock-epic-badge">{title}</div>
}))

vi.mock('@renderer/hooks/useQuadPaneLayout', () => ({
  useQuadPaneLayout: vi.fn()
}))

vi.mock('@renderer/stores/quad-pane.store', () => ({
  useQuadPaneStore: () => ({
    expandSection: vi.fn()
  })
}))

describe('TaskDetailContent', () => {
  const defaultProps: TaskDetailContentProps = {
    taskId: 'task-123',
    onClose: vi.fn()
  }

  const mockTask = {
    id: 'task-123',
    title: 'Test Task',
    status: 'in_progress',
    description: 'Task description',
    full_content: 'Full content',
    epic_id: 'epic-1',
    story_number: 5,
    project_id: 'proj-1',
    sprint_id: 'sprint-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sort_order: 1
  }

  const mockEpic = {
    id: 'epic-1',
    title: 'Test Epic',
    color: 'blue'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Default to tabbed mode for tests
    vi.mocked(QuadPaneLayoutHook.useQuadPaneLayout).mockReturnValue('tabbed')

    // Setup default mock returns
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as any)

    vi.mocked(trpc.epics.getAll.useQuery).mockReturnValue({
      data: [mockEpic]
    } as any)

    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: null
    } as any)

    vi.mocked(trpc.tasks.updateFullContent.useMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    } as any)

    vi.mocked(trpc.useUtils).mockReturnValue({
      tasks: {
        getById: { invalidate: vi.fn() },
        getAllWithEpics: { invalidate: vi.fn() }
      }
    } as any)
  })

  it('renders loading state', () => {
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      isLoading: true
    } as any)

    render(<TaskDetailContent {...defaultProps} />)
    expect(screen.getByText('Loading task...')).toBeInTheDocument()
  })

  it('renders task not found state', () => {
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: null,
      isLoading: false
    } as any)

    render(<TaskDetailContent {...defaultProps} />)
    expect(screen.getByText('Task not found')).toBeInTheDocument()
  })

  it('renders task content correctly', () => {
    render(<TaskDetailContent {...defaultProps} />)

    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('Story #5')).toBeInTheDocument()
    expect(screen.getByText('Test Epic')).toBeInTheDocument()
    expect(screen.getByText('Full content')).toBeVisible()
  })

  it('switches tabs correctly', () => {
    render(<TaskDetailContent {...defaultProps} />)

    // Default tab is content
    expect(screen.getByText('Full content')).toBeVisible()
    // Other tabs should be hidden but present in DOM
    expect(screen.getByTestId('mock-activities-tab').closest('[data-testid="quad-pane-section"]')).toHaveClass('hidden')

    // Switch to Activities
    fireEvent.click(screen.getByRole('tab', { name: /activities/i }))
    expect(screen.getByTestId('mock-activities-tab')).toBeVisible()
    expect(screen.getByText('Full content').closest('[data-testid="quad-pane-section"]')).toHaveClass('hidden')

    // Switch to Terminal
    fireEvent.click(screen.getByRole('tab', { name: /terminal/i }))
    expect(screen.getByTestId('mock-task-terminal')).toBeVisible()

    // Switch back to Content
    fireEvent.click(screen.getByRole('tab', { name: /content/i }))
    expect(screen.getByText('Full content')).toBeVisible()
  })

  it('enters edit mode and saves changes', async () => {
    const mutateMock = vi.fn()
    vi.mocked(trpc.tasks.updateFullContent.useMutation).mockReturnValue({
      mutate: mutateMock,
      isPending: false
    } as any)

    render(<TaskDetailContent {...defaultProps} />)

    // Click Edit button
    fireEvent.click(screen.getByText('Edit'))

    // Check editor is present
    const editor = screen.getByTestId('mock-editor')
    expect(editor).toBeVisible()
    expect(editor).toHaveValue('Full content')

    // Change content
    fireEvent.change(editor, { target: { value: 'Updated content' } })
    expect(screen.getByText('Unsaved changes')).toBeVisible()

    // Click Save
    fireEvent.click(screen.getByText('Save'))

    expect(mutateMock).toHaveBeenCalledWith({
      id: 'task-123',
      fullContent: 'Updated content'
    })
  })

  it('discards changes when cancelling edit', () => {
    render(<TaskDetailContent {...defaultProps} />)

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit'))

    // Change content
    const editor = screen.getByTestId('mock-editor')
    fireEvent.change(editor, { target: { value: 'Updated content' } })

    // Discard
    fireEvent.click(screen.getByText('Discard'))

    // Should return to view mode
    expect(screen.queryByTestId('mock-editor')).not.toBeInTheDocument()
    // Should show original content
    expect(screen.getByText('Full content')).toBeVisible()
  })

  it('calls onClose when close button is clicked', () => {
    render(<TaskDetailContent {...defaultProps} />)

    fireEvent.click(screen.getByLabelText('Close panel'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
