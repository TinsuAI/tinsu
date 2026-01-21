import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResizableWorkspace, type WorkspaceTask } from './ResizableWorkspace'

// Mock the child components to simplify testing
vi.mock('@renderer/components/task/TaskTerminal', () => ({
  TaskTerminal: vi.fn(({ taskId }: { taskId: string }) => (
    <div data-testid="task-terminal">Terminal for {taskId}</div>
  ))
}))

vi.mock('@renderer/components/task/ActivitiesTab', () => ({
  ActivitiesTab: vi.fn(({ taskId }: { taskId: string }) => (
    <div data-testid="activities-tab">Activities for {taskId}</div>
  ))
}))

vi.mock('@renderer/components/task/DiffPlaceholder', () => ({
  DiffPlaceholder: vi.fn(() => <div data-testid="diff-placeholder">Diff Placeholder</div>)
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

const mockTask: WorkspaceTask = {
  id: 'task-1',
  title: 'Test Task',
  description: 'Test description',
  status: 'in_progress',
  epic_id: 'epic-1',
  story_number: 1,
  full_content: '# Test Content',
  created_at: new Date(),
  updated_at: new Date()
}

describe('ResizableWorkspace', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders three columns with section headers', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content Editor</div>}
      />
    )

    // Check all section headers are present
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Activities')).toBeInTheDocument()
    expect(screen.getByText('Diff')).toBeInTheDocument()
  })

  it('renders the content section passed as prop', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div data-testid="content-editor">My Content Editor</div>}
      />
    )

    expect(screen.getByTestId('content-editor')).toBeInTheDocument()
    expect(screen.getByText('My Content Editor')).toBeInTheDocument()
  })

  it('renders TaskTerminal with correct taskId', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(screen.getByTestId('task-terminal')).toBeInTheDocument()
    expect(screen.getByText('Terminal for task-1')).toBeInTheDocument()
  })

  it('renders ActivitiesTab with correct taskId', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(screen.getByTestId('activities-tab')).toBeInTheDocument()
    expect(screen.getByText('Activities for task-1')).toBeInTheDocument()
  })

  it('renders DiffPlaceholder', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(screen.getByTestId('diff-placeholder')).toBeInTheDocument()
  })

  it('renders expand buttons for all sections', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(screen.getByLabelText('Expand Content')).toBeInTheDocument()
    expect(screen.getByLabelText('Expand Terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Expand Activities')).toBeInTheDocument()
    expect(screen.getByLabelText('Expand Diff')).toBeInTheDocument()
  })

  it('expands content section when expand button clicked', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div data-testid="content-editor">Content</div>}
      />
    )

    const expandButton = screen.getByLabelText('Expand Content')
    fireEvent.click(expandButton)

    // Should now show expanded view with collapse button
    expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse Content')).toBeInTheDocument()

    // Other sections should not be visible when expanded
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument()
  })

  it('expands terminal section when expand button clicked', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    const expandButton = screen.getByLabelText('Expand Terminal')
    fireEvent.click(expandButton)

    expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse Terminal')).toBeInTheDocument()
  })

  it('expands activities section when expand button clicked', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    const expandButton = screen.getByLabelText('Expand Activities')
    fireEvent.click(expandButton)

    expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse Activities')).toBeInTheDocument()
  })

  it('expands diff section when expand button clicked', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    const expandButton = screen.getByLabelText('Expand Diff')
    fireEvent.click(expandButton)

    expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse Diff')).toBeInTheDocument()
  })

  it('collapses back to 3-column view when collapse button clicked', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div data-testid="content-section">My Editor</div>}
      />
    )

    // Expand content section
    fireEvent.click(screen.getByLabelText('Expand Content'))
    expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()

    // Collapse it
    fireEvent.click(screen.getByLabelText('Collapse Content'))

    // Should be back to normal 3-column view
    expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
    expect(screen.queryByTestId('resizable-workspace-expanded')).not.toBeInTheDocument()

    // All section headers should be visible again (use testid to be more specific)
    expect(screen.getByTestId('section-header-content')).toBeInTheDocument()
    expect(screen.getByTestId('section-header-terminal')).toBeInTheDocument()
    expect(screen.getByTestId('section-header-activities')).toBeInTheDocument()
    expect(screen.getByTestId('section-header-diff')).toBeInTheDocument()
  })

  it('loads saved layout from localStorage', () => {
    const savedLayout = {
      horizontal: { content: 25, center: 30, diff: 45 },
      vertical: { terminal: 50, activities: 50 }
    }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedLayout))

    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(localStorageMock.getItem).toHaveBeenCalledWith('tinsu-workspace-layout')
  })

  it('handles invalid localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json')

    // Should not throw
    expect(() => {
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )
    }).not.toThrow()

    expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
  })

  it('renders with default data-testid', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
  })

  it('renders resize handles (Separators)', () => {
    render(
      <ResizableWorkspace
        task={mockTask}
        contentSection={<div>Content</div>}
      />
    )

    // The library renders separators with role="separator"
    const separators = screen.getAllByRole('separator')
    // Should have at least 3: 2 horizontal (between columns) and 1 vertical (terminal/activities)
    expect(separators.length).toBeGreaterThanOrEqual(3)
  })
})
