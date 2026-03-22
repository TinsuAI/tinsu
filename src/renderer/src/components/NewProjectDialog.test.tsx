import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { NewProjectDialog } from './NewProjectDialog'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  }
}))

// Mock tRPC
const mockCreateMutateAsync = vi.fn()
const mockCreateMutate = vi.fn()
const mockSelectDirMutate = vi.fn()
const mockBmadInstallMutateAsync = vi.fn()
let mockCreateIsPending = false
let mockSelectDirIsPending = false
let mockBmadInstallIsPending = false
let mockSelectDirOnSuccess: ((result: unknown) => void) | null = null
let mockNodeStatus: { installed: boolean; version?: string } = { installed: true, version: 'v20.0.0' }
let mockAvailableModules: {
  modules: { id: string; name: string; builtIn: boolean }[]
  tools: { id: string; name: string; preferred: boolean; category: string }[]
  languages: string[]
} = {
  modules: [
    { id: 'core', name: 'Core Framework', builtIn: true },
    { id: 'bmm', name: 'Core Method', builtIn: true },
    { id: 'bmb', name: 'Build', builtIn: false },
  ],
  tools: [
    { id: 'claude-code', name: 'Claude Code', preferred: true, category: 'cli' },
    { id: 'cursor', name: 'Cursor', preferred: true, category: 'ide' },
  ],
  languages: ['English', 'Spanish', 'French'],
}

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      create: {
        useMutation: (): object => {
          return {
            mutate: mockCreateMutate,
            mutateAsync: mockCreateMutateAsync,
            isPending: mockCreateIsPending,
            isError: false,
            error: null
          }
        }
      },
      selectParentDirectory: {
        useMutation: (options?: {
          onSuccess?: (result: unknown) => void
        }): object => {
          mockSelectDirOnSuccess = options?.onSuccess || null
          return {
            mutate: mockSelectDirMutate,
            isPending: mockSelectDirIsPending,
            isError: false,
            error: null
          }
        }
      }
    },
    bmad: {
      checkNodejs: {
        useQuery: (): object => ({
          data: mockNodeStatus,
          isLoading: false,
        })
      },
      availableModules: {
        useQuery: (): object => ({
          data: mockAvailableModules,
          isLoading: false,
        })
      },
      installToPath: {
        useMutation: (): object => ({
          mutateAsync: mockBmadInstallMutateAsync,
          isPending: mockBmadInstallIsPending,
        })
      }
    }
  }
}))

describe('NewProjectDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onProjectCreated: vi.fn()
  }

  beforeEach(() => {
    mockCreateMutate.mockReset()
    mockCreateMutateAsync.mockReset()
    mockSelectDirMutate.mockReset()
    mockBmadInstallMutateAsync.mockReset()
    mockCreateIsPending = false
    mockSelectDirIsPending = false
    mockBmadInstallIsPending = false
    mockSelectDirOnSuccess = null
    mockNodeStatus = { installed: true, version: 'v20.0.0' }
    mockAvailableModules = {
      modules: [
        { id: 'core', name: 'Core Framework', builtIn: true },
        { id: 'bmm', name: 'Core Method', builtIn: true },
        { id: 'bmb', name: 'Build', builtIn: false },
      ],
      tools: [
        { id: 'claude-code', name: 'Claude Code', preferred: true, category: 'cli' },
        { id: 'cursor', name: 'Cursor', preferred: true, category: 'ide' },
      ],
      languages: ['English', 'Spanish', 'French'],
    }
    defaultProps.onOpenChange.mockReset()
    defaultProps.onProjectCreated.mockReset()
  })

  it('should render project name input and Choose Folder button', () => {
    render(<NewProjectDialog {...defaultProps} />)

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('my-project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument()
  })

  it('should have Create Project button disabled until both fields are filled', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const createButton = screen.getByRole('button', { name: /create project/i })
    expect(createButton).toBeDisabled()

    // Type a project name
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Still disabled because no parent dir
    expect(createButton).toBeDisabled()
  })

  it('should show path preview when both fields have values', async () => {
    render(<NewProjectDialog {...defaultProps} />)

    // Type project name
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Simulate selecting a directory via the captured onSuccess callback
    if (mockSelectDirOnSuccess) {
      mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
    }

    // Path preview should show the combined path
    await waitFor(() => {
      expect(screen.getByText('Will be created at:')).toBeInTheDocument()
      expect(screen.getByText('/Users/me/dev/test-project')).toBeInTheDocument()
    })
  })

  it('should show inline error on mutation failure', async () => {
    mockCreateMutateAsync.mockRejectedValue(new Error("A folder named 'test-project' already exists at that location."))

    render(<NewProjectDialog {...defaultProps} />)

    // Fill in fields first
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    // Select a directory (state update needs act)
    act(() => {
      if (mockSelectDirOnSuccess) {
        mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
      }
    })

    // Click create
    const createButton = screen.getByRole('button', { name: /create project/i })
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    })
  })

  it('should disable inputs during isPending', () => {
    mockCreateIsPending = true

    render(<NewProjectDialog {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText('my-project')
    expect(nameInput).toBeDisabled()

    const chooseFolderButton = screen.getByRole('button', { name: /choose folder/i })
    expect(chooseFolderButton).toBeDisabled()

    // Button should show "Creating..."
    expect(screen.getByText(/creating/i)).toBeInTheDocument()
  })

  it('should call onOpenChange(false) when Cancel is clicked', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('should strip invalid characters from project name', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'my:project?name' } })

    // Invalid chars should be stripped, leaving "myprojectname"
    expect(nameInput).toHaveValue('myprojectname')

    // Should show validation message
    expect(screen.getByText(/invalid characters/i)).toBeInTheDocument()
  })

  // --- BMAD Setup Section tests ---

  it('should show BMAD setup section with checkbox checked by default', () => {
    render(<NewProjectDialog {...defaultProps} />)

    const bmadCheckbox = screen.getByTestId('install-bmad-checkbox')
    expect(bmadCheckbox).toBeInTheDocument()
    expect(bmadCheckbox).toHaveAttribute('data-state', 'checked')

    expect(screen.getByText('Initialize BMAD Framework')).toBeInTheDocument()
  })

  it('should show module checkboxes when BMAD is enabled', () => {
    render(<NewProjectDialog {...defaultProps} />)

    // Module checkboxes should be visible since BMAD is enabled by default
    expect(screen.getByText('Core Framework')).toBeInTheDocument()
    expect(screen.getByText('Core Method')).toBeInTheDocument()
    expect(screen.getByText('Build')).toBeInTheDocument()

    // core and bmm should be checked by default
    const coreCheckbox = screen.getByTestId('module-checkbox-core')
    expect(coreCheckbox).toHaveAttribute('data-state', 'checked')

    const bmmCheckbox = screen.getByTestId('module-checkbox-bmm')
    expect(bmmCheckbox).toHaveAttribute('data-state', 'checked')

    // bmb should not be checked
    const bmbCheckbox = screen.getByTestId('module-checkbox-bmb')
    expect(bmbCheckbox).toHaveAttribute('data-state', 'unchecked')
  })

  it('should show tool checkboxes when BMAD is enabled', () => {
    render(<NewProjectDialog {...defaultProps} />)

    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(screen.getByText('Cursor')).toBeInTheDocument()

    // Tools should not be checked by default
    const claudeCodeCheckbox = screen.getByTestId('tool-checkbox-claude-code')
    expect(claudeCodeCheckbox).toHaveAttribute('data-state', 'unchecked')
  })

  it('should show Node.js warning when Node is not installed', () => {
    mockNodeStatus = { installed: false }

    render(<NewProjectDialog {...defaultProps} />)

    const warning = screen.getByTestId('node-warning')
    expect(warning).toBeInTheDocument()
    expect(screen.getByText(/Node\.js is required/i)).toBeInTheDocument()

    // Module/tool checkboxes should NOT be shown
    expect(screen.queryByTestId('bmad-config-section')).not.toBeInTheDocument()
  })

  it('should hide BMAD config when checkbox is unchecked', () => {
    render(<NewProjectDialog {...defaultProps} />)

    // Config section should be visible initially
    expect(screen.getByTestId('bmad-config-section')).toBeInTheDocument()

    // Uncheck the BMAD checkbox
    const bmadCheckbox = screen.getByTestId('install-bmad-checkbox')
    fireEvent.click(bmadCheckbox)

    // Config section should be hidden
    expect(screen.queryByTestId('bmad-config-section')).not.toBeInTheDocument()
  })

  it('should show "Installing BMAD..." when BMAD install is pending', () => {
    mockBmadInstallIsPending = true

    render(<NewProjectDialog {...defaultProps} />)

    expect(screen.getByText(/installing bmad/i)).toBeInTheDocument()
  })

  it('should call mutateAsync with BMAD options on create', async () => {
    mockCreateMutateAsync.mockResolvedValue({
      path: '/Users/me/dev/test-project',
      config: { projectName: 'test-project' }
    })
    mockBmadInstallMutateAsync.mockResolvedValue({ success: true })

    render(<NewProjectDialog {...defaultProps} />)

    // Fill in fields
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    act(() => {
      if (mockSelectDirOnSuccess) {
        mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
      }
    })

    // Click create
    const createButton = screen.getByRole('button', { name: /create project/i })
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        parentDir: '/Users/me/dev',
        projectName: 'test-project'
      })
    })

    await waitFor(() => {
      expect(mockBmadInstallMutateAsync).toHaveBeenCalledWith({
        projectPath: '/Users/me/dev/test-project',
        modules: ['core', 'bmm'],
        tools: [],
        userName: 'test-project',
        communicationLanguage: 'English',
        documentOutputLanguage: 'English',
        outputFolder: '_bmad-output',
      })
    })

    await waitFor(() => {
      expect(defaultProps.onProjectCreated).toHaveBeenCalledWith({
        path: '/Users/me/dev/test-project',
        projectName: 'test-project'
      })
    })
  })

  it('should skip BMAD install when checkbox is unchecked', async () => {
    mockCreateMutateAsync.mockResolvedValue({
      path: '/Users/me/dev/test-project',
      config: { projectName: 'test-project' }
    })

    render(<NewProjectDialog {...defaultProps} />)

    // Uncheck BMAD
    const bmadCheckbox = screen.getByTestId('install-bmad-checkbox')
    fireEvent.click(bmadCheckbox)

    // Fill in fields
    const nameInput = screen.getByPlaceholderText('my-project')
    fireEvent.change(nameInput, { target: { value: 'test-project' } })

    act(() => {
      if (mockSelectDirOnSuccess) {
        mockSelectDirOnSuccess({ canceled: false, path: '/Users/me/dev' })
      }
    })

    const createButton = screen.getByRole('button', { name: /create project/i })
    await act(async () => {
      fireEvent.click(createButton)
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalled()
    })

    // BMAD install should NOT have been called
    expect(mockBmadInstallMutateAsync).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(defaultProps.onProjectCreated).toHaveBeenCalled()
    })
  })
})
