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
    // Call onMount immediately to simulate editor load
    if (onMount) {
      setTimeout(() => onMount(), 0)
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
    init: vi.fn(() => Promise.resolve())
  }
}))

// Mock theme module
vi.mock('./theme', () => ({
  TINSU_DARK_THEME: 'tinsu-dark',
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
      render(<MonacoDiffEditor {...defaultProps} height="100%" />)
      expect(screen.getByTestId('monaco-height')).toHaveTextContent('100%')
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

    it('enables hiding unchanged regions (AC #5)', () => {
      render(<MonacoDiffEditor {...defaultProps} />)
      const options = JSON.parse(screen.getByTestId('monaco-options').textContent || '{}')
      expect(options.hideUnchangedRegions.enabled).toBe(true)
      expect(options.hideUnchangedRegions.minimumLineCount).toBe(3)
      expect(options.hideUnchangedRegions.contextLineCount).toBe(3)
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
})
