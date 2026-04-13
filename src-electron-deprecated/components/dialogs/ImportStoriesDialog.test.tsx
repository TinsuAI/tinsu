import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImportStoriesDialog } from './ImportStoriesDialog'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock the hooks and trpc
const mockImportStoriesAsync = vi.fn()
const mockReset = vi.fn()
let mockIsImporting = false

vi.mock('@renderer/hooks/useStoryImport', () => ({
  useStoryImport: () => ({
    importStoriesAsync: mockImportStoriesAsync,
    isImporting: mockIsImporting,
    reset: mockReset
  })
}))

const mockShowOpenDialogMutate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    config: {
      showOpenDialog: {
        useMutation: (options: { onSuccess?: (path: string | null) => void }) => ({
          mutate: (input: object) => {
            mockShowOpenDialogMutate(input)
            // Simulate file picker returning a path
            options.onSuccess?.('/selected/path/epics.md')
          },
          isPending: false
        })
      }
    }
  }
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ImportStoriesDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'test-project-id',
    defaultPath: '/default/path/epics.md'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockImportStoriesAsync.mockResolvedValue({
      epicsCreated: 2,
      storiesCreated: 5,
      epicIds: ['e1', 'e2'],
      storyIds: ['s1', 's2', 's3', 's4', 's5']
    })
    mockIsImporting = false
  })

  it('renders dialog with title and description', () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('Import Stories from epics.md')).toBeInTheDocument()
    expect(
      screen.getByText('Select your epics.md file to import all epics and stories to the Kanban board.')
    ).toBeInTheDocument()
  })

  it('shows default path in input', () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    const input = screen.getByTestId('epics-path-input')
    expect(input).toHaveValue('/default/path/epics.md')
  })

  it('allows typing a custom path', () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    const input = screen.getByTestId('epics-path-input')
    fireEvent.change(input, { target: { value: '/custom/path/epics.md' } })

    expect(input).toHaveValue('/custom/path/epics.md')
  })

  it('opens file picker when browse button clicked', () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('browse-button'))

    expect(mockShowOpenDialogMutate).toHaveBeenCalledWith({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      title: 'Select epics.md File'
    })
  })

  it('updates path when file picker returns a path', () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('browse-button'))

    const input = screen.getByTestId('epics-path-input')
    expect(input).toHaveValue('/selected/path/epics.md')
  })

  it('shows error when import clicked with empty path', async () => {
    render(<ImportStoriesDialog {...defaultProps} defaultPath="" />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('import-button'))

    await waitFor(() => {
      expect(screen.getByTestId('path-error')).toHaveTextContent('Please select an epics.md file')
    })
  })

  it('calls importStoriesAsync with correct parameters', async () => {
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('import-button'))

    await waitFor(() => {
      expect(mockImportStoriesAsync).toHaveBeenCalledWith(
        'test-project-id',
        '/default/path/epics.md'
      )
    })
  })

  it('calls onSuccess callback with result', async () => {
    const onSuccess = vi.fn()
    render(<ImportStoriesDialog {...defaultProps} onSuccess={onSuccess} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('import-button'))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        epicsCreated: 2,
        storiesCreated: 5,
        epicIds: ['e1', 'e2'],
        storyIds: ['s1', 's2', 's3', 's4', 's5']
      })
    })
  })

  it('closes dialog after successful import', async () => {
    const onOpenChange = vi.fn()
    render(<ImportStoriesDialog {...defaultProps} onOpenChange={onOpenChange} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('import-button'))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it('shows loading state while importing', () => {
    mockIsImporting = true
    render(<ImportStoriesDialog {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('import-button')).toHaveTextContent('Importing...')
    expect(screen.getByTestId('cancel-button')).toBeDisabled()
  })

  it('closes dialog when cancel clicked', () => {
    const onOpenChange = vi.fn()
    render(<ImportStoriesDialog {...defaultProps} onOpenChange={onOpenChange} />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByTestId('cancel-button'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('resets form when dialog opens', () => {
    const { rerender } = render(
      <ImportStoriesDialog {...defaultProps} open={false} />,
      { wrapper: createWrapper() }
    )

    rerender(<ImportStoriesDialog {...defaultProps} open={true} />)

    expect(mockReset).toHaveBeenCalled()
  })
})
