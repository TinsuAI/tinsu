/**
 * Monaco Editor Theme Configuration
 *
 * Custom dark theme for TinSu diff viewer matching the application design.
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import type * as monacoNamespace from 'monaco-editor'

/**
 * Theme name constant for consistency across the application.
 */
export const TINSU_DARK_THEME = 'tinsu-dark'

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
 * Registers the TinSu dark theme with Monaco Editor.
 *
 * Call this function once when Monaco is initialized.
 * Uses the monaco global which is provided by @monaco-editor/react.
 *
 * @param monaco - Monaco namespace from loader or editor mount
 */
export function registerTinsuTheme(monaco: typeof monacoNamespace): void {
  monaco.editor.defineTheme(TINSU_DARK_THEME, tinsuDarkTheme)
}
