import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BmadSettingsPanel } from './BmadSettingsPanel'

// --- Mock state variables ---
let mockNodeStatus: { installed: boolean; version: string | null } = {
  installed: true,
  version: 'v20.11.0'
}
let mockBmadStatus: {
  installed: boolean
  version?: string
  modules?: string[]
  tools?: string[]
} = { installed: false }
let mockAvailable = {
  modules: [
    { id: 'core', name: 'Core Framework', builtIn: true },
    { id: 'bmm', name: 'Core Method', builtIn: true },
    { id: 'bmb', name: 'Build', builtIn: false }
  ],
  tools: [
    { id: 'claude-code', name: 'Claude Code', preferred: true, category: 'cli' },
    { id: 'cursor', name: 'Cursor', preferred: true, category: 'ide' }
  ],
  languages: ['English', 'Spanish', 'French']
}
let mockIsLoadingNode = false
let mockIsLoadingStatus = false
let mockIsLoadingAvailable = false

const mockInstallMutate = vi.fn()
const mockUpdateMutate = vi.fn()
const mockInstallNodeMutate = vi.fn()
const mockInvalidateCheckStatus = vi.fn()
const mockInvalidateCheckNodejs = vi.fn()

const mockCallbacks: Record<string, ((...args: unknown[]) => void) | null> = {
  installOnSuccess: null,
  installOnError: null,
  updateOnSuccess: null,
  updateOnError: null,
  installNodeOnSuccess: null,
  installNodeOnError: null
}

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    bmad: {
      checkNodejs: {
        useQuery: () => ({
          data: mockNodeStatus,
          isLoading: mockIsLoadingNode
        })
      },
      checkStatus: {
        useQuery: () => ({
          data: mockBmadStatus,
          isLoading: mockIsLoadingStatus
        })
      },
      availableModules: {
        useQuery: () => ({
          data: mockAvailable,
          isLoading: mockIsLoadingAvailable
        })
      },
      install: {
        useMutation: (options?: {
          onSuccess?: () => void
          onError?: (error: unknown) => void
        }) => {
          mockCallbacks.installOnSuccess = options?.onSuccess || null
          mockCallbacks.installOnError = options?.onError || null
          return { mutate: mockInstallMutate, isPending: false }
        }
      },
      update: {
        useMutation: (options?: {
          onSuccess?: () => void
          onError?: (error: unknown) => void
        }) => {
          mockCallbacks.updateOnSuccess = options?.onSuccess || null
          mockCallbacks.updateOnError = options?.onError || null
          return { mutate: mockUpdateMutate, isPending: false }
        }
      },
      installNodejs: {
        useMutation: (options?: {
          onSuccess?: () => void
          onError?: (error: unknown) => void
        }) => {
          mockCallbacks.installNodeOnSuccess = options?.onSuccess || null
          mockCallbacks.installNodeOnError = options?.onError || null
          return { mutate: mockInstallNodeMutate, isPending: false }
        }
      }
    },
    useUtils: () => ({
      bmad: {
        checkStatus: { invalidate: mockInvalidateCheckStatus },
        checkNodejs: { invalidate: mockInvalidateCheckNodejs }
      }
    })
  }
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('BmadSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNodeStatus = { installed: true, version: 'v20.11.0' }
    mockBmadStatus = { installed: false }
    mockIsLoadingNode = false
    mockIsLoadingStatus = false
    mockIsLoadingAvailable = false
    mockCallbacks.installOnSuccess = null
    mockCallbacks.installOnError = null
    mockCallbacks.updateOnSuccess = null
    mockCallbacks.updateOnError = null
    mockCallbacks.installNodeOnSuccess = null
    mockCallbacks.installNodeOnError = null
  })

  it('renders loading state when queries are loading', () => {
    mockIsLoadingNode = true
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('bmad-settings-loading')).toBeInTheDocument()
  })

  it('renders "Not Installed" badge when BMAD is not installed', () => {
    mockBmadStatus = { installed: false }
    render(<BmadSettingsPanel />)
    const badge = screen.getByTestId('bmad-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Not Installed')
  })

  it('shows "Install BMAD" button when not installed', () => {
    mockBmadStatus = { installed: false }
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('install-bmad-btn')).toBeInTheDocument()
    expect(screen.getByTestId('install-bmad-btn')).toHaveTextContent('Install BMAD')
  })

  it('shows installed badge with version when installed', () => {
    mockBmadStatus = {
      installed: true,
      version: '1.2.3',
      modules: ['core', 'bmm'],
      tools: ['claude-code']
    }
    render(<BmadSettingsPanel />)
    const badge = screen.getByTestId('bmad-status-badge')
    expect(badge).toHaveTextContent('Installed v1.2.3')
  })

  it('shows "Update BMAD" button when installed', () => {
    mockBmadStatus = {
      installed: true,
      version: '1.0.0',
      modules: ['core'],
      tools: []
    }
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('update-bmad-btn')).toBeInTheDocument()
    expect(screen.getByTestId('update-bmad-btn')).toHaveTextContent('Update BMAD')
  })

  it('shows Node.js warning when Node is not installed', () => {
    mockNodeStatus = { installed: false, version: null }
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('node-warning')).toBeInTheDocument()
    expect(screen.getByText('Node.js is required to install BMAD')).toBeInTheDocument()
    expect(screen.getByTestId('install-node-btn')).toBeInTheDocument()
  })

  it('disables form when Node.js is not installed', () => {
    mockNodeStatus = { installed: false, version: null }
    render(<BmadSettingsPanel />)
    const installBtn = screen.getByTestId('install-bmad-btn')
    expect(installBtn).toBeDisabled()
  })

  it('renders module checkboxes from available modules', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('module-checkbox-core')).toBeInTheDocument()
    expect(screen.getByTestId('module-checkbox-bmm')).toBeInTheDocument()
    expect(screen.getByTestId('module-checkbox-bmb')).toBeInTheDocument()
  })

  it('renders tool checkboxes from available tools', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('tool-checkbox-claude-code')).toBeInTheDocument()
    expect(screen.getByTestId('tool-checkbox-cursor')).toBeInTheDocument()
  })

  it('renders language select', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('bmad-language-select')).toBeInTheDocument()
  })

  it('renders user name input', () => {
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('bmad-username-input')).toBeInTheDocument()
  })

  it('shows installed modules as badges when BMAD is installed', () => {
    mockBmadStatus = {
      installed: true,
      version: '1.0.0',
      modules: ['core', 'bmm'],
      tools: ['claude-code']
    }
    render(<BmadSettingsPanel />)
    expect(screen.getByTestId('installed-module-core')).toBeInTheDocument()
    expect(screen.getByTestId('installed-module-bmm')).toBeInTheDocument()
    expect(screen.getByTestId('installed-tool-claude-code')).toBeInTheDocument()
  })

  it('shows success toast on successful install', async () => {
    const { toast } = await import('sonner')
    render(<BmadSettingsPanel />)
    if (mockCallbacks.installOnSuccess) {
      mockCallbacks.installOnSuccess()
    }
    expect(toast.success).toHaveBeenCalledWith('BMAD framework installed successfully')
    expect(mockInvalidateCheckStatus).toHaveBeenCalled()
  })

  it('shows error toast on failed install', async () => {
    const { toast } = await import('sonner')
    render(<BmadSettingsPanel />)
    if (mockCallbacks.installOnError) {
      mockCallbacks.installOnError({ message: 'Something went wrong' })
    }
    expect(toast.error).toHaveBeenCalledWith('Failed to install BMAD', {
      description: 'Something went wrong'
    })
  })
})
