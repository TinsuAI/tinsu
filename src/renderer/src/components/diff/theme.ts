/**
 * Monaco Editor Theme Configuration
 *
 * Custom dark and light themes for TinSu diff viewer matching the application design.
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import type * as monacoNamespace from 'monaco-editor'

/**
 * Theme name constants for consistency across the application.
 */
export const TINSU_DARK_THEME = 'tinsu-dark'
export const TINSU_LIGHT_THEME = 'tinsu-light'

/**
 * GitHub-inspired dark theme for Monaco Editor.
 *
 * Colors match GitHub's commit diff view:
 * - Subtle, muted backgrounds for additions and deletions
 * - GitHub's authentic color palette
 * - Proper contrast for accessibility
 * - Professional, refined appearance
 */
export const tinsuDarkTheme: monacoNamespace.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    // Editor background - GitHub dark theme
    'editor.background': '#0d1117',

    // GitHub-style diff colors - ADDITIONS (green)
    // Very subtle green background matching GitHub's aesthetic
    'diffEditor.insertedTextBackground': '#23863a20', // Text-level changes (more opaque)
    'diffEditor.insertedLineBackground': '#23863a10', // Line-level changes (very subtle)
    'diffEditorGutter.insertedLineBackground': '#23863a25', // Gutter (line number area)

    // Inline added text (character-level diff within a line)
    'diffEditor.insertedTextBorder': '#23863a00',

    // GitHub-style diff colors - DELETIONS (red)
    // Very subtle red/pink background matching GitHub's aesthetic
    'diffEditor.removedTextBackground': '#d73a4920', // Text-level changes (more opaque)
    'diffEditor.removedLineBackground': '#d73a4910', // Line-level changes (very subtle)
    'diffEditorGutter.removedLineBackground': '#d73a4925', // Gutter (line number area)

    // Inline removed text (character-level diff within a line)
    'diffEditor.removedTextBorder': '#d73a4900',

    // Border and UI colors - GitHub style
    'editorLineNumber.foreground': '#484f58',
    'editorLineNumber.activeForeground': '#8b949e',
    'editor.lineHighlightBackground': '#161b22',
    'editor.selectionBackground': '#264f78',
    'editorGutter.background': '#0d1117',

    // Diff overview ruler (scrollbar area)
    'diffEditor.diagonalFill': '#21262d60'
  }
}

/**
 * Sunrise Studio light theme for Monaco Editor.
 *
 * Matches the warm, editorial feel of the light theme:
 * - Warm cream/paper background
 * - Subtle sage green for additions
 * - Muted coral for deletions
 * - Refined contrast for comfortable reading
 */
export const tinsuLightTheme: monacoNamespace.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '2e3440' },
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
    { token: 'keyword', foreground: '5a3d89' },
    { token: 'string', foreground: '22863a' },
    { token: 'number', foreground: 'b76c00' },
    { token: 'type', foreground: '1e5a8a' }
  ],
  colors: {
    // Editor background - warm paper tone
    'editor.background': '#fdfcfa',
    'editor.foreground': '#2e3440',

    // GitHub-style diff colors - ADDITIONS (green)
    // Soft sage green for comfortable reading
    'diffEditor.insertedTextBackground': '#22863a18',
    'diffEditor.insertedLineBackground': '#22863a0c',
    'diffEditorGutter.insertedLineBackground': '#22863a15',
    'diffEditor.insertedTextBorder': '#22863a00',

    // GitHub-style diff colors - DELETIONS (red)
    // Soft coral for deletions
    'diffEditor.removedTextBackground': '#cb2431 18',
    'diffEditor.removedLineBackground': '#cb24310c',
    'diffEditorGutter.removedLineBackground': '#cb243115',
    'diffEditor.removedTextBorder': '#cb243100',

    // Border and UI colors - warm grays
    'editorLineNumber.foreground': '#9ba3ae',
    'editorLineNumber.activeForeground': '#5a6270',
    'editor.lineHighlightBackground': '#f6f5f3',
    'editor.selectionBackground': '#b4d7ff80',
    'editorGutter.background': '#fdfcfa',

    // Diff overview ruler (scrollbar area)
    'diffEditor.diagonalFill': '#e1dfd940',

    // Additional UI elements
    'editorWidget.background': '#fdfcfa',
    'editorWidget.border': '#e1dfd9',
    'dropdown.background': '#fdfcfa',
    'dropdown.border': '#e1dfd9',

    // Cursor and selection
    'editorCursor.foreground': '#4a5568',
    'editor.wordHighlightBackground': '#fef3c740'
  }
}

/**
 * Registers the TinSu themes with Monaco Editor.
 *
 * Call this function once when Monaco is initialized.
 * Uses the monaco global which is provided by @monaco-editor/react.
 *
 * @param monaco - Monaco namespace from loader or editor mount
 */
export function registerTinsuThemes(monaco: typeof monacoNamespace): void {
  monaco.editor.defineTheme(TINSU_DARK_THEME, tinsuDarkTheme)
  monaco.editor.defineTheme(TINSU_LIGHT_THEME, tinsuLightTheme)
}

/**
 * @deprecated Use registerTinsuThemes instead
 */
export function registerTinsuTheme(monaco: typeof monacoNamespace): void {
  registerTinsuThemes(monaco)
}
