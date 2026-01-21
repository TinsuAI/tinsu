import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  // Story TES-3.3: Keyboard shortcut tests
  describe('Keyboard shortcuts (Story TES-3.3)', () => {
    it('collapses expanded section when Escape is pressed (AC: #2)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div data-testid="content-editor">Content</div>}
        />
      )

      // First expand a section
      const expandButton = screen.getByLabelText('Expand Content')
      await user.click(expandButton)
      expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()

      // Press Escape
      await user.keyboard('{Escape}')

      // Should return to 3-column view
      expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
      expect(screen.queryByTestId('resizable-workspace-expanded')).not.toBeInTheDocument()
    })

    it('does nothing when Escape is pressed and no section is expanded', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      // Press Escape when in 3-column view
      await user.keyboard('{Escape}')

      // Should still be in 3-column view
      expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
    })

    it('expands Content section when key 1 is pressed (AC: #3)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      await user.keyboard('1')

      expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse Content')).toBeInTheDocument()
    })

    it('expands Terminal section when key 2 is pressed (AC: #3)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      await user.keyboard('2')

      expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse Terminal')).toBeInTheDocument()
    })

    it('expands Activities section when key 3 is pressed (AC: #3)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      await user.keyboard('3')

      expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse Activities')).toBeInTheDocument()
    })

    it('expands Diff section when key 4 is pressed (AC: #3)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      await user.keyboard('4')

      expect(screen.getByTestId('resizable-workspace-expanded')).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse Diff')).toBeInTheDocument()
    })

    it('switches between expanded sections with number keys (AC: #3)', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      // Expand Content with key 1
      await user.keyboard('1')
      expect(screen.getByLabelText('Collapse Content')).toBeInTheDocument()

      // Switch to Terminal with key 2
      await user.keyboard('2')
      expect(screen.getByLabelText('Collapse Terminal')).toBeInTheDocument()
      expect(screen.queryByLabelText('Collapse Content')).not.toBeInTheDocument()

      // Switch to Activities with key 3
      await user.keyboard('3')
      expect(screen.getByLabelText('Collapse Activities')).toBeInTheDocument()

      // Switch to Diff with key 4
      await user.keyboard('4')
      expect(screen.getByLabelText('Collapse Diff')).toBeInTheDocument()
    })

    it('does not handle keyboard shortcuts when typing in input', async () => {
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<input data-testid="test-input" />}
        />
      )

      const input = screen.getByTestId('test-input')
      input.focus()

      // Dispatch keyboard event while input is focused
      fireEvent.keyDown(window, { key: '1' })

      // Should NOT expand - still in 3-column view
      expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
      expect(screen.queryByTestId('resizable-workspace-expanded')).not.toBeInTheDocument()
    })

    it('does not handle keyboard shortcuts when typing in textarea', async () => {
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<textarea data-testid="test-textarea" />}
        />
      )

      const textarea = screen.getByTestId('test-textarea')
      textarea.focus()

      // Dispatch keyboard event while textarea is focused
      fireEvent.keyDown(window, { key: '2' })

      // Should NOT expand - still in 3-column view
      expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
      expect(screen.queryByTestId('resizable-workspace-expanded')).not.toBeInTheDocument()
    })

    it('does not handle number keys when modifier keys are pressed', async () => {
      const user = userEvent.setup()
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      // Ctrl+1 should not expand
      await user.keyboard('{Control>}1{/Control}')
      expect(screen.getByTestId('resizable-workspace')).toBeInTheDocument()
      expect(screen.queryByTestId('resizable-workspace-expanded')).not.toBeInTheDocument()
    })

    it('has smooth transition classes on expanded view', () => {
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      // Expand a section
      fireEvent.click(screen.getByLabelText('Expand Content'))

      const expandedView = screen.getByTestId('resizable-workspace-expanded')
      expect(expandedView).toHaveClass('transition-all', 'duration-200', 'ease-out')

      // Note: AC #3 requires <200ms transition. Tailwind's duration-200 = 200ms.
      // Actual animation performance validated manually - automated timing tests
      // are unreliable in test environments due to JSDOM limitations.
    })

    it('has smooth transition classes on normal 3-column view', () => {
      render(
        <ResizableWorkspace
          task={mockTask}
          contentSection={<div>Content</div>}
        />
      )

      const normalView = screen.getByTestId('resizable-workspace')
      expect(normalView).toHaveClass('transition-all', 'duration-200', 'ease-out')
    })
  })
})
