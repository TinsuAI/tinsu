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
 * TinSu dark theme definition for Monaco Editor.
 *
 * Colors are designed to:
 * - Match TinSu's dark UI aesthetic (#1a1a1a background)
 * - Use green-500 at 15% opacity for additions (per AC #2)
 * - Use red-500 at 15% opacity for removals (per AC #3)
 * - Maintain proper contrast for accessibility
 */
export const tinsuDarkTheme: monacoNamespace.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    // Editor background matching TinSu panels
    'editor.background': '#1a1a1a',

    // Diff highlighting colors per acceptance criteria
    // AC #2: Added lines have green background rgba(34, 197, 94, 0.15)
    'diffEditor.insertedTextBackground': 'rgba(34, 197, 94, 0.15)',
    'diffEditor.insertedLineBackground': 'rgba(34, 197, 94, 0.08)',
    'diffEditorGutter.insertedLineBackground': 'rgba(34, 197, 94, 0.3)',

    // AC #3: Removed lines have red background rgba(239, 68, 68, 0.15)
    'diffEditor.removedTextBackground': 'rgba(239, 68, 68, 0.15)',
    'diffEditor.removedLineBackground': 'rgba(239, 68, 68, 0.08)',
    'diffEditorGutter.removedLineBackground': 'rgba(239, 68, 68, 0.3)',

    // Border and UI colors
    'editorLineNumber.foreground': '#4a4a4a',
    'editorLineNumber.activeForeground': '#888888',
    'editor.lineHighlightBackground': '#262626',
    'editor.selectionBackground': '#3a3a3a'
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
