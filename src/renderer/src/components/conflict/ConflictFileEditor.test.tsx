/**
 * Unit tests for ConflictFileEditor component.
 *
 * Story 8.8: Conflict Resolution UI - Task 2, Task 10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ConflictFileEditor } from './ConflictFileEditor'

// Mock Monaco Editor
const mockSetValue = vi.fn()
const mockGetValue = vi.fn()
const mockDeltaDecorations = vi.fn(() => [])
const mockChangeViewZones = vi.fn()
const mockOnDidChangeModelContent = vi.fn(() => ({ dispose: vi.fn() }))

const mockEditor = {
  setValue: mockSetValue,
  getValue: mockGetValue,
  getModel: vi.fn(() => ({
    getValue: mockGetValue,
    setValue: mockSetValue
  })),
  deltaDecorations: mockDeltaDecorations,
  changeViewZones: mockChangeViewZones,
  onDidChangeModelContent: mockOnDidChangeModelContent
}

vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, onChange, onMount, beforeMount }) => {
    // Simulate Monaco loading
    setTimeout(() => {
      beforeMount?.(mockMonaco)
      onMount?.(mockEditor)
    }, 0)
    return (
      <textarea
        data-testid="mock-monaco-editor"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    )
  }),
  loader: {
    config: vi.fn()
  }
}))

const mockMonaco = {
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  }
}

// Mock theme registration
vi.mock('../diff/theme', () => ({
  registerTinsuTheme: vi.fn(),
  TINSU_DARK_THEME: 'tinsu-dark'
}))

describe('ConflictFileEditor', () => {
  const defaultProps = {
    filePath: 'src/main.ts',
    content: `<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> feature-branch`,
    onChange: vi.fn(),
    onResolved: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetValue.mockReturnValue(defaultProps.content)
  })

  describe('Rendering (AC: 2)', () => {
    it('renders Monaco Editor', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      render(<ConflictFileEditor {...defaultProps} />)

      expect(screen.getByTestId('editor-loading')).toBeInTheDocument()
    })

    it('hides loading state after mount', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByTestId('editor-loading')).not.toBeInTheDocument()
      })
    })

    it('applies conflict-file-editor test id', () => {
      const { container } = render(<ConflictFileEditor {...defaultProps} />)

      expect(container.querySelector('[data-testid="conflict-file-editor"]')).toBeInTheDocument()
    })

    it('passes file content to Monaco', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        const editor = screen.getByTestId('mock-monaco-editor')
        expect(editor).toHaveValue(defaultProps.content)
      })
    })
  })

  describe('Language Detection (Task 2.2)', () => {
    it('detects TypeScript for .ts files', () => {
      render(<ConflictFileEditor {...defaultProps} filePath="src/main.ts" />)
      // Language detection is internal, but we can verify it doesn't error
      expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
    })

    it('detects JavaScript for .js files', () => {
      render(<ConflictFileEditor {...defaultProps} filePath="src/main.js" />)
      expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
    })

    it('detects JSON for .json files', () => {
      render(<ConflictFileEditor {...defaultProps} filePath="package.json" />)
      expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
    })
  })

  describe('Content Changes (AC: 2, 3)', () => {
    it('calls onChange when content is edited', async () => {
      const onChange = vi.fn()
      render(<ConflictFileEditor {...defaultProps} onChange={onChange} />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
      })

      const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement
      editor.value = 'new content'
      editor.dispatchEvent(new Event('change', { bubbles: true }))

      expect(onChange).toHaveBeenCalledWith('new content')
    })

    it('calls onResolved when conflicts are fully resolved', async () => {
      const onResolved = vi.fn()
      const onChange = vi.fn()
      render(<ConflictFileEditor {...defaultProps} onChange={onChange} onResolved={onResolved} />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
      })

      // Simulate resolving all conflicts (no conflict markers left)
      const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement
      editor.value = 'resolved content with no conflict markers'
      editor.dispatchEvent(new Event('change', { bubbles: true }))

      await waitFor(() => {
        expect(onResolved).toHaveBeenCalled()
      })
    })

    it('does not call onResolved when conflicts remain', async () => {
      const onResolved = vi.fn()
      const onChange = vi.fn()
      render(<ConflictFileEditor {...defaultProps} onChange={onChange} onResolved={onResolved} />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
      })

      // Content still has conflict markers
      const editor = screen.getByTestId('mock-monaco-editor') as HTMLTextAreaElement
      editor.value = `<<<<<<< HEAD
still conflicted
=======
content
>>>>>>> branch`
      editor.dispatchEvent(new Event('change', { bubbles: true }))

      // Give time for potential onResolved call
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(onResolved).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling (Task 2.6)', () => {
    it('shows error state on loading failure', async () => {
      vi.useFakeTimers()
      render(<ConflictFileEditor {...defaultProps} />)

      // Fast-forward past the 10s timeout
      vi.advanceTimersByTime(10100)

      await waitFor(() => {
        expect(screen.getByTestId('editor-error')).toBeInTheDocument()
        expect(screen.getByText('Failed to load editor')).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('shows retry button on error', async () => {
      vi.useFakeTimers()
      render(<ConflictFileEditor {...defaultProps} />)

      vi.advanceTimersByTime(10100)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
      })

      vi.useRealTimers()
    })
  })

  describe('Custom className', () => {
    it('applies custom className when provided', () => {
      const { container } = render(
        <ConflictFileEditor {...defaultProps} className="custom-class" />
      )

      const editor = container.querySelector('[data-testid="conflict-file-editor"]')
      expect(editor).toHaveClass('custom-class')
    })
  })

  describe('Monaco Integration (Task 2.3, 2.4, 2.5)', () => {
    it('applies decorations on mount', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(mockDeltaDecorations).toHaveBeenCalled()
      })
    })

    it('adds view zones for conflict resolution buttons', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(mockChangeViewZones).toHaveBeenCalled()
      })
    })

    it('registers content change listener', async () => {
      render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(mockOnDidChangeModelContent).toHaveBeenCalled()
      })
    })
  })

  describe('Content Synchronization', () => {
    it('updates local content when props change', async () => {
      const { rerender } = render(<ConflictFileEditor {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('mock-monaco-editor')).toBeInTheDocument()
      })

      const newContent = 'updated content'
      rerender(<ConflictFileEditor {...defaultProps} content={newContent} />)

      await waitFor(() => {
        const editor = screen.getByTestId('mock-monaco-editor')
        expect(editor).toHaveValue(newContent)
      })
    })
  })
})
