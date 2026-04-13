/**
 * Unit tests for MonacoDiffEditor component
 *
 * Monaco Editor is difficult to test in JSDOM, so we mock the module
 * and verify props are passed correctly.
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MonacoDiffEditor } from './MonacoDiffEditor'

// Mock @monaco-editor/react
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: vi.fn(({ original, modified, language, theme, height, options, onMount }: any) => {
    // Mock decorations collection
    const mockDecorationsCollection = {
      clear: vi.fn()
    }

    // Mock Monaco instance for onMount callback
    const mockMonaco = {
      editor: {
        MouseTargetType: {
          GUTTER_GLYPH_MARGIN: 2,
          GUTTER_LINE_NUMBERS: 3,
          GUTTER_LINE_DECORATIONS: 4
        }
      },
      // Story 7.5 Task 8: Mock Range constructor for decorations
      Range: class {
        constructor(
          public startLineNumber: number,
          public startColumn: number,
          public endLineNumber: number,
          public endColumn: number
        ) {}
      }
    }

    // Mock editor instance
    const mockEditor = {
      getModifiedEditor: () => ({
        getContentHeight: () => 300,
        onDidContentSizeChange: () => ({ dispose: vi.fn() }),
        onMouseDown: () => ({ dispose: vi.fn() }),
        // Story 7.5 Task 8: Mock createDecorationsCollection
        createDecorationsCollection: vi.fn(() => mockDecorationsCollection)
      }),
      getOriginalEditor: () => ({
        onMouseDown: () => ({ dispose: vi.fn() })
      }),
      layout: vi.fn()
    }

    // Call onMount immediately to simulate editor load
    if (onMount) {
      setTimeout(() => onMount(mockEditor, mockMonaco), 0)
    }

    return (
      <div data-testid="mock-monaco-diff-editor">
        <div data-testid="monaco-original">{original}</div>
        <div data-testid="monaco-modified">{modified}</div>
        <div data-testid="monaco-language">{language}</div>
        <div data-testid="monaco-theme">{theme}</div>
        <div data-testid="monaco-height">{String(height)}</div>
        <div data-testid="monaco-options">{JSON.stringify(options)}</div>
      </div>
    )
  }),
  loader: {
    init: vi.fn(() => Promise.resolve()),
    config: vi.fn()
  }
}))

// Mock theme module
vi.mock('./theme', () => ({
  TINSU_DARK_THEME: 'tinsu-dark',
  TINSU_LIGHT_THEME: 'tinsu-light',
  registerTinsuThemes: vi.fn(),
  registerTinsuTheme: vi.fn()
}))

describe('MonacoDiffEditor', () => {
  const defaultProps = {
    original: 'const x = 1;',
    modified: 'const x = 2;',
    language: 'typescript',
    filePath: 'src/test.ts'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the component with test id', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })

    it('renders with aria-label for accessibility', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByLabelText('Diff viewer for src/test.ts')).toBeInTheDocument()
    })

    it('shows loading skeleton initially', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-loading')).toBeInTheDocument()
    })

    it('hides loading skeleton after mount', async () => {
      render(<MonacoDiffEditor {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByTestId('monaco-loading')).not.toBeInTheDocument()
      })
    })
  })

  describe('props passing', () => {
    it('passes original content to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-original')).toHaveTextContent('const x = 1;')
    })

    it('passes modified content to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-modified')).toHaveTextContent('const x = 2;')
    })

    it('passes language to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-language')).toHaveTextContent('typescript')
    })

    it('passes tinsu-dark theme to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-theme')).toHaveTextContent('tinsu-dark')
    })

    it('passes default height of 300 to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      expect(screen.getByTestId('monaco-height')).toHaveTextContent('300')
    })

    it('passes custom height to DiffEditor', () => {
      render(<MonacoDiffEditor {...defaultProps} height={500} />)
      expect(screen.getByTestId('monaco-height')).toHaveTextContent('500')
    })

    it('accepts string height values', () => {
      // Note: The component calculates height dynamically from Monaco's getContentHeight()
      // When height is a string like "100%", it falls back to the default numeric 300
      render(<MonacoDiffEditor {...defaultProps} height="100%" />)
      // The height shown is the calculated height, not the string prop
      expect(screen.getByTestId('monaco-height')).toHaveTextContent('300')
    })
  })

  describe('editor options', () => {
    it('configures read-only mode', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.readOnly).toBe(true)
      expect(options.originalEditable).toBe(false)
    })

    it('configures side-by-side view by default (split mode)', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.renderSideBySide).toBe(true)
      expect(options.enableSplitViewResizing).toBe(true)
    })

    it('configures split view when viewMode is split (TES-4.5)', () => {
      render(<MonacoDiffEditor {...defaultProps} viewMode="split" />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.renderSideBySide).toBe(true)
    })

    it('configures unified view when viewMode is unified (TES-4.5)', () => {
      render(<MonacoDiffEditor {...defaultProps} viewMode="unified" />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.renderSideBySide).toBe(false)
    })

    it('configures line numbers', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.lineNumbers).toBe('on')
    })

    it('disables minimap', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.minimap.enabled).toBe(false)
    })

    it('disables hiding unchanged regions (was causing blank diff issues)', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      // Disabled to prevent blank diff view - Monaco was collapsing too aggressively
      expect(options.hideUnchangedRegions.enabled).toBe(false)
    })
  })

  describe('custom className', () => {
    it('applies additional className to container', () => {
      render(<MonacoDiffEditor {...defaultProps} className="custom-class" />)
      const container = screen.getByTestId('monaco-diff-editor')
      expect(container).toHaveClass('custom-class')
    })
  })

  describe('different languages', () => {
    it.each([
      ['typescript', 'src/file.ts'],
      ['javascript', 'src/file.js'],
      ['json', 'package.json'],
      ['markdown', 'README.md'],
      ['python', 'script.py']
    ])('renders with %s language', (language) => {
      render(<MonacoDiffEditor {...defaultProps} language={language} />)
      expect(screen.getByTestId('monaco-language')).toHaveTextContent(language)
    })
  })

  describe('empty content handling', () => {
    it('handles empty original content', () => {
      render(<MonacoDiffEditor {...defaultProps} original="" />)
      expect(screen.getByTestId('monaco-original')).toHaveTextContent('')
    })

    it('handles empty modified content', () => {
      render(<MonacoDiffEditor {...defaultProps} modified="" />)
      expect(screen.getByTestId('monaco-modified')).toHaveTextContent('')
    })

    it('handles both empty (new file scenario)', () => {
      render(<MonacoDiffEditor {...defaultProps} original="" modified="new content" />)
      expect(screen.getByTestId('monaco-original')).toHaveTextContent('')
      expect(screen.getByTestId('monaco-modified')).toHaveTextContent('new content')
    })
  })

  describe('gutter click for inline comments (Story 7.5)', () => {
    it('disables glyph margin by default', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.glyphMargin).toBe(false)
    })

    it('enables glyph margin when enableCommentGutter is true', () => {
      render(<MonacoDiffEditor {...defaultProps} enableCommentGutter={true} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.glyphMargin).toBe(true)
    })

    it('passes onGutterClick callback', () => {
      const onGutterClick = vi.fn()
      render(
        <MonacoDiffEditor
          {...defaultProps}
          onGutterClick={onGutterClick}
          enableCommentGutter={true}
        />
      )
      // The callback is registered but can't be tested without a real Monaco instance
      // This test verifies the component accepts the prop without errors
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })
  })

  describe('inline comment decorations (Story 7.5 Task 8)', () => {
    it('accepts comments prop without errors', () => {
      const comments = [
        {
          id: 'comment-1',
          filePath: 'src/test.ts',
          lineNumber: 5,
          content: 'Fix this null check',
          createdAt: Date.now()
        }
      ]
      render(
        <MonacoDiffEditor
          {...defaultProps}
          enableCommentGutter={true}
          comments={comments}
        />
      )
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })

    it('renders with empty comments array by default', () => {
      render(<MonacoDiffEditor {...defaultProps} enableCommentGutter={true} />)
      // Should render without errors
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })

    it('accepts multiple comments for different files', () => {
      const comments = [
        {
          id: 'comment-1',
          filePath: 'src/test.ts',
          lineNumber: 5,
          content: 'Comment on this file',
          createdAt: Date.now()
        },
        {
          id: 'comment-2',
          filePath: 'src/other.ts',
          lineNumber: 10,
          content: 'Comment on different file',
          createdAt: Date.now()
        }
      ]
      render(
        <MonacoDiffEditor
          {...defaultProps}
          enableCommentGutter={true}
          comments={comments}
        />
      )
      // Should render without errors - only comments for 'src/test.ts' will show decorations
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })

    it('accepts multiple comments on same line', () => {
      const comments = [
        {
          id: 'comment-1',
          filePath: 'src/test.ts',
          lineNumber: 5,
          content: 'First comment',
          createdAt: Date.now()
        },
        {
          id: 'comment-2',
          filePath: 'src/test.ts',
          lineNumber: 5,
          content: 'Second comment',
          createdAt: Date.now() + 1000
        }
      ]
      render(
        <MonacoDiffEditor
          {...defaultProps}
          enableCommentGutter={true}
          comments={comments}
        />
      )
      // Should render without errors - both comments grouped on line 5
      expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument()
    })
  })
})
