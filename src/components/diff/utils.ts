/**
 * Utility functions for Monaco Diff Editor
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import type { GitDiffHunk } from '@shared/types/git-diff.types'

/**
 * Language mapping from file extension to Monaco language identifier.
 * Used for syntax highlighting in the diff editor.
 */
const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Web
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
  // Database
  '.sql': 'sql',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  // Python
  '.py': 'python',
  // Rust
  '.rs': 'rust',
  // Go
  '.go': 'go',
  // Other
  '.txt': 'plaintext'
}

/**
 * Get Monaco language identifier from file path.
 *
 * @param filePath - Full path or filename with extension
 * @returns Monaco language identifier (defaults to 'plaintext')
 *
 * @example
 * getLanguageFromPath('src/App.tsx') // 'typescript'
 * getLanguageFromPath('README.md') // 'markdown'
 * getLanguageFromPath('unknown.foo') // 'plaintext'
 */
export function getLanguageFromPath(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) {
    return 'plaintext'
  }
  const ext = filePath.substring(lastDot).toLowerCase()
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}

/**
 * Result of content reconstruction from diff hunks.
 */
export interface ReconstructedContent {
  /** Original file content (before changes) */
  original: string
  /** Modified file content (after changes) */
  modified: string
}

/**
 * Reconstructs original and modified file content from diff hunks.
 *
 * Takes the parsed diff hunks and rebuilds the complete file content
 * for both the original (old) and modified (new) versions.
 *
 * @param hunks - Array of diff hunks from GitService (can be null/undefined for safe handling)
 * @returns Object containing original and modified content strings
 *
 * @example
 * const { original, modified } = reconstructFileContent(file.hunks)
 * // original = content before changes
 * // modified = content after changes
 */
export function reconstructFileContent(
  hunks: GitDiffHunk[] | null | undefined
): ReconstructedContent {
  if (!hunks || hunks.length === 0) {
    return { original: '', modified: '' }
  }

  const originalLines: string[] = []
  const modifiedLines: string[] = []

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        originalLines.push(line.content)
        modifiedLines.push(line.content)
      } else if (line.type === 'remove') {
        originalLines.push(line.content)
      } else if (line.type === 'add') {
        modifiedLines.push(line.content)
      }
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n')
  }
}
