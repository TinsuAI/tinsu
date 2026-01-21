import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileTree } from './FileTree'
import type { GitDiffFile } from '@main/services/git.service'

/**
 * Test suite for FileTree component
 * Story TES-4.3: File Tree Component
 */

// Mock files for testing - covers all status types
const mockFiles: GitDiffFile[] = [
  {
    path: 'src/added.ts',
    status: 'added',
    additions: 45,
    deletions: 0,
    hunks: []
  },
  {
    path: 'src/modified.ts',
    status: 'modified',
    additions: 10,
    deletions: 5,
    hunks: []
  },
  {
    path: 'src/deleted.ts',
    status: 'deleted',
    additions: 0,
    deletions: 30,
    hunks: []
  },
  {
    path: 'src/renamed.ts',
    oldPath: 'src/old-name.ts',
    status: 'renamed',
    additions: 2,
    deletions: 1,
    hunks: []
  }
]

describe('FileTree', () => {
  describe('rendering', () => {
    it('renders all files in the list', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByText('added.ts')).toBeInTheDocument()
      expect(screen.getByText('modified.ts')).toBeInTheDocument()
      expect(screen.getByText('deleted.ts')).toBeInTheDocument()
      expect(screen.getByText('renamed.ts')).toBeInTheDocument()
    })

    it('renders empty state when no files provided', () => {
      render(<FileTree files={[]} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByTestId('file-tree-empty')).toBeInTheDocument()
      expect(screen.getByText('No files changed')).toBeInTheDocument()
    })

    it('renders with file-tree test id when files exist', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByTestId('file-tree')).toBeInTheDocument()
    })

    it('has role="list" for accessibility', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByRole('list')).toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('sorts files by status: modified first, then added, then deleted, then renamed', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const buttons = screen.getAllByRole('button')

      // Order should be: modified → added → deleted → renamed
      expect(buttons[0]).toHaveTextContent('modified.ts')
      expect(buttons[1]).toHaveTextContent('added.ts')
      expect(buttons[2]).toHaveTextContent('deleted.ts')
      expect(buttons[3]).toHaveTextContent('renamed.ts')
    })

    it('maintains sort order when files arrive in different order', () => {
      // Provide files in reverse order
      const reversedFiles = [...mockFiles].reverse()
      render(<FileTree files={reversedFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const buttons = screen.getAllByRole('button')

      // Should still be sorted correctly
      expect(buttons[0]).toHaveTextContent('modified.ts')
      expect(buttons[1]).toHaveTextContent('added.ts')
      expect(buttons[2]).toHaveTextContent('deleted.ts')
      expect(buttons[3]).toHaveTextContent('renamed.ts')
    })
  })

  describe('status icons and labels', () => {
    it('shows "(new)" label for added files', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByText('(new)')).toBeInTheDocument()
    })

    it('shows "(deleted)" label for deleted files', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByText('(deleted)')).toBeInTheDocument()
    })

    it('does not show status labels for modified files', () => {
      const modifiedOnly: GitDiffFile[] = [
        { path: 'test.ts', status: 'modified', additions: 1, deletions: 1, hunks: [] }
      ]
      render(<FileTree files={modifiedOnly} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.queryByText('(new)')).not.toBeInTheDocument()
      expect(screen.queryByText('(deleted)')).not.toBeInTheDocument()
    })

    it('does not show status labels for renamed files', () => {
      const renamedOnly: GitDiffFile[] = [
        {
          path: 'new.ts',
          oldPath: 'old.ts',
          status: 'renamed',
          additions: 0,
          deletions: 0,
          hunks: []
        }
      ]
      render(<FileTree files={renamedOnly} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.queryByText('(new)')).not.toBeInTheDocument()
      expect(screen.queryByText('(deleted)')).not.toBeInTheDocument()
    })
  })

  describe('line statistics', () => {
    it('displays additions with green color and + prefix', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      // Check that +45 is displayed (from added.ts)
      expect(screen.getByText('+45')).toBeInTheDocument()
      expect(screen.getByText('+45')).toHaveClass('text-green-500')
    })

    it('displays deletions with red color and - prefix', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      // Check that -30 is displayed (from deleted.ts)
      expect(screen.getByText('-30')).toBeInTheDocument()
      expect(screen.getByText('-30')).toHaveClass('text-red-500')
    })

    it('displays both additions and deletions for modified files', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      // modified.ts has +10 -5
      expect(screen.getByText('+10')).toBeInTheDocument()
      expect(screen.getByText('-5')).toBeInTheDocument()
    })

    it('shows ±0 when file has no line changes', () => {
      const noChanges: GitDiffFile[] = [
        { path: 'empty.ts', status: 'modified', additions: 0, deletions: 0, hunks: [] }
      ]
      render(<FileTree files={noChanges} selectedFile={null} onFileSelect={vi.fn()} />)

      expect(screen.getByText('±0')).toBeInTheDocument()
    })
  })

  describe('file selection', () => {
    it('calls onFileSelect with correct path when file is clicked', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={onFileSelect} />)

      fireEvent.click(screen.getByText('modified.ts'))

      expect(onFileSelect).toHaveBeenCalledWith('src/modified.ts')
    })

    it('calls onFileSelect with full path, not just filename', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={onFileSelect} />)

      fireEvent.click(screen.getByText('added.ts'))

      expect(onFileSelect).toHaveBeenCalledWith('src/added.ts')
    })
  })

  describe('selected file highlighting', () => {
    it('highlights the selected file with bg-muted/40 class', () => {
      render(<FileTree files={mockFiles} selectedFile="src/modified.ts" onFileSelect={vi.fn()} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      expect(modifiedButton).toHaveClass('bg-muted/40')
    })

    it('does not highlight non-selected files', () => {
      render(<FileTree files={mockFiles} selectedFile="src/modified.ts" onFileSelect={vi.fn()} />)

      const addedButton = screen.getByText('added.ts').closest('button')
      expect(addedButton).not.toHaveClass('bg-muted/40')
    })

    it('has no highlighted files when selectedFile is null', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).not.toHaveClass('bg-muted/40')
      })
    })
  })

  describe('scrollable container', () => {
    it('has kanban-scroll class for styling', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveClass('kanban-scroll')
    })

    it('has overflow-auto for scrollability', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveClass('overflow-auto')
    })
  })

  describe('accessibility', () => {
    it('provides aria-label with file information', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      expect(modifiedButton).toHaveAttribute(
        'aria-label',
        'modified.ts, modified, 10 additions, 5 deletions'
      )
    })

    it('provides title attribute with full path for tooltip', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const addedButton = screen.getByText('added.ts').closest('button')
      expect(addedButton).toHaveAttribute('title', 'src/added.ts')
    })

    it('shows old path in title for renamed files', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const renamedButton = screen.getByText('renamed.ts').closest('button')
      expect(renamedButton).toHaveAttribute('title', 'src/old-name.ts → src/renamed.ts')
    })

    it('has aria-label on the container', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const container = screen.getByRole('list')
      expect(container).toHaveAttribute('aria-label', 'Changed files')
    })
  })

  describe('className prop', () => {
    it('applies additional className to container', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onFileSelect={vi.fn()}
          className="custom-class"
        />
      )

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveClass('custom-class')
    })

    it('applies className to empty state container', () => {
      render(
        <FileTree
          files={[]}
          selectedFile={null}
          onFileSelect={vi.fn()}
          className="custom-empty-class"
        />
      )

      const container = screen.getByTestId('file-tree-empty')
      expect(container).toHaveClass('custom-empty-class')
    })
  })

  describe('keyboard navigation', () => {
    it('navigates to next file when ArrowDown is pressed', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile="src/modified.ts" onFileSelect={onFileSelect} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      if (modifiedButton) {
        fireEvent.keyDown(modifiedButton, { key: 'ArrowDown' })
      }

      // Should select next file (added.ts)
      expect(onFileSelect).toHaveBeenCalledWith('src/added.ts')
    })

    it('navigates to previous file when ArrowUp is pressed', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile="src/added.ts" onFileSelect={onFileSelect} />)

      const addedButton = screen.getByText('added.ts').closest('button')
      if (addedButton) {
        fireEvent.keyDown(addedButton, { key: 'ArrowUp' })
      }

      // Should select previous file (modified.ts)
      expect(onFileSelect).toHaveBeenCalledWith('src/modified.ts')
    })

    it('does not navigate beyond first file with ArrowUp', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile="src/modified.ts" onFileSelect={onFileSelect} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      if (modifiedButton) {
        fireEvent.keyDown(modifiedButton, { key: 'ArrowUp' })
      }

      // Should not call onFileSelect (already at first item)
      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('does not navigate beyond last file with ArrowDown', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile="src/renamed.ts" onFileSelect={onFileSelect} />)

      const renamedButton = screen.getByText('renamed.ts').closest('button')
      if (renamedButton) {
        fireEvent.keyDown(renamedButton, { key: 'ArrowDown' })
      }

      // Should not call onFileSelect (already at last item)
      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('selects file when Enter key is pressed', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={onFileSelect} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      if (modifiedButton) {
        fireEvent.keyDown(modifiedButton, { key: 'Enter' })
      }

      expect(onFileSelect).toHaveBeenCalledWith('src/modified.ts')
    })

    it('selects file when Space key is pressed', () => {
      const onFileSelect = vi.fn()
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={onFileSelect} />)

      const modifiedButton = screen.getByText('modified.ts').closest('button')
      if (modifiedButton) {
        fireEvent.keyDown(modifiedButton, { key: ' ' })
      }

      expect(onFileSelect).toHaveBeenCalledWith('src/modified.ts')
    })
  })

  describe('edge cases', () => {
    it('handles files with missing path gracefully', () => {
      const edgeCaseFiles: GitDiffFile[] = [
        // @ts-expect-error - Testing edge case with missing path
        { path: null, status: 'modified', additions: 1, deletions: 0, hunks: [] }
      ]

      render(<FileTree files={edgeCaseFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      // Should display "Unknown" fallback
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('handles files with empty path gracefully', () => {
      const edgeCaseFiles: GitDiffFile[] = [
        { path: '', status: 'modified', additions: 1, deletions: 0, hunks: [] }
      ]

      render(<FileTree files={edgeCaseFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      // Should display "Unknown" fallback
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('compact mode (TES-4.6)', () => {
    it('renders compact view when compact prop is true', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveAttribute('data-compact', 'true')
    })

    it('renders normal view when compact prop is false', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={false} />
      )

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveAttribute('data-compact', 'false')
    })

    it('defaults to non-compact mode when compact prop is not provided', () => {
      render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveAttribute('data-compact', 'false')
    })

    it('uses horizontal layout in compact mode', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const container = screen.getByTestId('file-tree')
      expect(container).toHaveClass('flex-wrap')
    })

    it('displays icon buttons in compact mode', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      // Should have 4 buttons (one for each file)
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(4)
    })

    it('calls onFileSelect when compact icon is clicked', () => {
      const onFileSelect = vi.fn()
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onFileSelect={onFileSelect}
          compact={true}
        />
      )

      const buttons = screen.getAllByRole('button')
      fireEvent.click(buttons[0]) // Click first button (modified.ts)

      expect(onFileSelect).toHaveBeenCalledWith('src/modified.ts')
    })

    it('highlights selected file in compact mode', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile="src/modified.ts"
          onFileSelect={vi.fn()}
          compact={true}
        />
      )

      const buttons = screen.getAllByRole('button')
      // First button should be selected (modified.ts comes first after sorting)
      expect(buttons[0]).toHaveClass('ring-1')
    })

    it('has accessible aria-labels in compact mode', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const buttons = screen.getAllByRole('button')
      // Check first button has accessibility info
      expect(buttons[0]).toHaveAttribute(
        'aria-label',
        'modified.ts, modified, 10 additions, 5 deletions'
      )
    })

    it('has compact view aria-label on container', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const container = screen.getByRole('list')
      expect(container).toHaveAttribute('aria-label', 'Changed files (compact view)')
    })

    it('does not show filenames in compact mode', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      // Filenames should not be visible as text nodes (only in tooltips)
      expect(screen.queryByText('modified.ts')).not.toBeInTheDocument()
      expect(screen.queryByText('added.ts')).not.toBeInTheDocument()
    })

    it('shows filenames in normal mode', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={false} />
      )

      // Filenames should be visible
      expect(screen.getByText('modified.ts')).toBeInTheDocument()
      expect(screen.getByText('added.ts')).toBeInTheDocument()
    })

    it('has keyboard focus indicators on compact mode buttons', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const buttons = screen.getAllByRole('button')
      // Check first button has focus-visible classes for accessibility
      expect(buttons[0]).toHaveClass('focus-visible:outline-none')
      expect(buttons[0]).toHaveClass('focus-visible:ring-2')
    })

    it('compact mode icons have proper color classes', () => {
      render(
        <FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} compact={true} />
      )

      const buttons = screen.getAllByRole('button')
      // All buttons should be present (4 files)
      expect(buttons).toHaveLength(4)

      // Each button should have accessible labels with status info
      buttons.forEach(button => {
        const label = button.getAttribute('aria-label')
        expect(label).toBeTruthy()
        expect(label).toMatch(/modified|added|deleted|renamed/)
      })
    })
  })
})
