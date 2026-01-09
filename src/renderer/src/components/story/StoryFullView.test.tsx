import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoryFullView } from './StoryFullView'
import { useStoryViewStore } from '@renderer/stores'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock trpc
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      getById: {
        useQuery: vi.fn()
      },
      updateFullContent: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false
        }))
      }
    },
    epics: {
      getAll: {
        useQuery: vi.fn(() => ({ data: [] }))
      }
    },
    useUtils: vi.fn(() => ({
      tasks: {
        getById: { invalidate: vi.fn() },
        getAllWithEpics: { invalidate: vi.fn() }
      }
    }))
  }
}))

// Import the mock after mocking
import { trpc } from '@renderer/lib/trpc'

// Mock story task data
const mockTask = {
  id: 'story-1',
  title: '1.1: Initialize Project',
  description: 'Test description',
  status: 'backlog',
  sort_order: 0,
  epic_id: 'epic-1',
  sprint_id: null,
  project_id: 'proj-1',
  task_type: 'story',
  story_number: 1,
  story_file_path: '/path/to/story.md',
  full_content: '# Story 1.1\n\nFull content here with **markdown**.',
  phase_number: null,
  phase_name: null,
  bmad_agent: null,
  bmad_workflow: null,
  is_start_here: null,
  artifact_path: null,
  created_at: new Date('2026-01-01').toISOString(),
  updated_at: new Date('2026-01-01').toISOString()
}

// Helper to wrap with providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  }
}

describe('StoryFullView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useStoryViewStore.setState({
      activeStoryId: null,
      isEditing: false
    })
  })

  it('returns null when no activeStoryId', () => {
    useStoryViewStore.setState({ activeStoryId: null })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    const { container } = renderWithProviders(<StoryFullView />)

    expect(container.firstChild).toBeNull()
  })

  it('shows loading state while fetching', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText('Loading story...')).toBeInTheDocument()
  })

  it('shows not found message when task is null', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText('Story not found')).toBeInTheDocument()
    expect(screen.getByText('Back to Board')).toBeInTheDocument()
  })

  it('renders story title and content', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText('1.1: Initialize Project')).toBeInTheDocument()
    // Markdown content is rendered
    expect(screen.getByText(/Full content here/)).toBeInTheDocument()
  })

  it('shows back button that calls closeStory', async () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    const { user } = renderWithProviders(<StoryFullView />)

    const backButton = screen.getByRole('button', { name: /back to board/i })
    await user.click(backButton)

    expect(useStoryViewStore.getState().activeStoryId).toBeNull()
  })

  it('shows edit button that enables edit mode', async () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    const { user } = renderWithProviders(<StoryFullView />)

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    expect(useStoryViewStore.getState().isEditing).toBe(true)
  })

  it('shows textarea in edit mode', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1', isEditing: true })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByText('Editing mode')).toBeInTheDocument()
  })

  it('shows cancel button in edit mode', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1', isEditing: true })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('shows status badge', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText('backlog')).toBeInTheDocument()
  })

  it('shows story number indicator', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText(/Story #1/)).toBeInTheDocument()
  })

  it('shows empty state when no content', () => {
    useStoryViewStore.setState({ activeStoryId: 'story-1' })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: { ...mockTask, full_content: null, description: null },
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)

    renderWithProviders(<StoryFullView />)

    expect(screen.getByText('No content yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add content/i })).toBeInTheDocument()
  })
})

describe('StoryFullView keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStoryViewStore.setState({
      activeStoryId: 'story-1',
      isEditing: false
    })
    vi.mocked(trpc.tasks.getById.useQuery).mockReturnValue({
      data: mockTask,
      isLoading: false
    } as ReturnType<typeof trpc.tasks.getById.useQuery>)
  })

  it('Escape closes the view when not editing', async () => {
    const { user } = renderWithProviders(<StoryFullView />)

    await user.keyboard('{Escape}')

    expect(useStoryViewStore.getState().activeStoryId).toBeNull()
  })

  it('Escape cancels editing when in edit mode', async () => {
    useStoryViewStore.setState({ isEditing: true })
    const { user } = renderWithProviders(<StoryFullView />)

    await user.keyboard('{Escape}')

    expect(useStoryViewStore.getState().isEditing).toBe(false)
    expect(useStoryViewStore.getState().activeStoryId).toBe('story-1')
  })

  it('Ctrl+E toggles edit mode', async () => {
    const { user } = renderWithProviders(<StoryFullView />)

    await user.keyboard('{Control>}e{/Control}')

    expect(useStoryViewStore.getState().isEditing).toBe(true)
  })
})
