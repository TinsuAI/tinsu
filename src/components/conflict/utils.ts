/**
 * Conflict Resolution Utilities
 *
 * Parsing and resolution logic for git merge conflict markers.
 * Handles both standard and diff3 conflict formats.
 *
 * Story 8.8: Conflict Resolution UI - Task 3
 */

/**
 * Represents a single conflict region within a file.
 */
export interface ConflictRegion {
  /** Line number where the conflict starts (1-indexed) */
  startLine: number
  /** Line number where the conflict ends (1-indexed) */
  endLine: number
  /** Character offset where the conflict starts */
  startOffset: number
  /** Character offset where the conflict ends */
  endOffset: number
  /** Content from the current (HEAD/ours) branch */
  currentContent: string
  /** Content from the incoming (theirs) branch */
  incomingContent: string
  /** Original content before divergence (diff3 format only) */
  baseContent?: string
  /** Branch name shown in the conflict marker (e.g., "HEAD", "feature-branch") */
  currentBranchLabel: string
  /** Branch name shown in the incoming marker */
  incomingBranchLabel: string
}

/**
 * Result of parsing conflict regions from a file.
 */
export interface ConflictParseResult {
  /** Array of conflict regions found */
  regions: ConflictRegion[]
  /** Whether any unresolved conflicts remain */
  hasConflicts: boolean
}

/**
 * Regular expression patterns for conflict markers.
 */
const CONFLICT_START_PATTERN = /^<<<<<<< (.+)$/
const CONFLICT_BASE_PATTERN = /^\|\|\|\|\|\|\| (.+)$/
const CONFLICT_SEPARATOR = '======='
const CONFLICT_END_PATTERN = /^>>>>>>> (.+)$/

/**
 * Parse conflict regions from file content.
 *
 * Supports both standard git conflict format:
 * ```
 * <<<<<<< HEAD
 * current content
 * =======
 * incoming content
 * >>>>>>> feature-branch
 * ```
 *
 * And diff3 format with common ancestor:
 * ```
 * <<<<<<< HEAD
 * current content
 * ||||||| merged common ancestors
 * base content
 * =======
 * incoming content
 * >>>>>>> feature-branch
 * ```
 *
 * @param content - The file content to parse
 * @returns ConflictParseResult with regions and hasConflicts flag
 */
export function parseConflictRegions(content: string): ConflictParseResult {
  const regions: ConflictRegion[] = []
  const lines = content.split('\n')

  let i = 0
  let charOffset = 0

  while (i < lines.length) {
    const line = lines[i]
    const startMatch = CONFLICT_START_PATTERN.exec(line)

    if (startMatch) {
      const startLine = i + 1 // 1-indexed
      const startOffset = charOffset
      const currentBranchLabel = startMatch[1]

      // Collect current content
      const currentLines: string[] = []
      let baseLines: string[] | undefined
      i++

      // Skip past start marker in offset calculation
      let currentOffset = charOffset + line.length + 1

      // Look for base (diff3) or separator
      while (i < lines.length) {
        const checkLine = lines[i]

        // Check for diff3 base marker
        const baseMatch = CONFLICT_BASE_PATTERN.exec(checkLine)
        if (baseMatch) {
          // Note: baseMatch[1] contains the base branch label (not currently used)
          baseLines = []
          currentOffset += checkLine.length + 1
          i++

          // Collect base content until separator
          while (i < lines.length && lines[i] !== CONFLICT_SEPARATOR) {
            baseLines.push(lines[i])
            currentOffset += lines[i].length + 1
            i++
          }
          break
        }

        // Check for separator (no diff3 base)
        if (checkLine === CONFLICT_SEPARATOR) {
          break
        }

        currentLines.push(checkLine)
        currentOffset += checkLine.length + 1
        i++
      }

      // Skip separator
      if (i < lines.length && lines[i] === CONFLICT_SEPARATOR) {
        currentOffset += lines[i].length + 1
        i++
      }

      // Collect incoming content
      const incomingLines: string[] = []
      while (i < lines.length) {
        const checkLine = lines[i]
        const endMatch = CONFLICT_END_PATTERN.exec(checkLine)

        if (endMatch) {
          const incomingBranchLabel = endMatch[1]
          const endLine = i + 1 // 1-indexed
          const endOffset = currentOffset + checkLine.length + 1

          regions.push({
            startLine,
            endLine,
            startOffset,
            endOffset,
            currentContent: currentLines.join('\n'),
            incomingContent: incomingLines.join('\n'),
            baseContent: baseLines?.join('\n'),
            currentBranchLabel,
            incomingBranchLabel
          })

          charOffset = endOffset
          i++
          break
        }

        incomingLines.push(checkLine)
        currentOffset += checkLine.length + 1
        i++
      }
    } else {
      charOffset += line.length + 1
      i++
    }
  }

  return {
    regions,
    hasConflicts: regions.length > 0
  }
}

/**
 * Resolve a single conflict region by choosing a side or combining both.
 *
 * @param content - The full file content
 * @param region - The conflict region to resolve
 * @param choice - Resolution choice: 'current' | 'incoming' | 'both'
 * @returns The content with the conflict resolved
 */
export function resolveConflict(
  content: string,
  region: ConflictRegion,
  choice: 'current' | 'incoming' | 'both'
): string {
  const lines = content.split('\n')

  // Calculate line indices (0-indexed)
  const startIdx = region.startLine - 1
  const endIdx = region.endLine - 1

  // Determine replacement content based on choice
  let replacement: string
  switch (choice) {
    case 'current':
      replacement = region.currentContent
      break
    case 'incoming':
      replacement = region.incomingContent
      break
    case 'both':
      // Concatenate both with a newline between if both have content
      if (region.currentContent && region.incomingContent) {
        replacement = region.currentContent + '\n' + region.incomingContent
      } else {
        replacement = region.currentContent + region.incomingContent
      }
      break
  }

  // Replace the conflict lines with the chosen content
  const replacementLines = replacement ? replacement.split('\n') : []
  lines.splice(startIdx, endIdx - startIdx + 1, ...replacementLines)

  return lines.join('\n')
}

/**
 * Check if content has any unresolved conflict markers.
 *
 * @param content - The file content to check
 * @returns true if unresolved conflicts exist
 */
export function hasUnresolvedConflicts(content: string): boolean {
  const lines = content.split('\n')

  for (const line of lines) {
    if (CONFLICT_START_PATTERN.test(line)) {
      return true
    }
  }

  return false
}

/**
 * Get line numbers for each part of a conflict region.
 * Useful for applying Monaco decorations.
 *
 * @param content - The file content
 * @param region - The conflict region
 * @returns Object with line ranges for each section
 */
export function getConflictLineRanges(
  content: string,
  region: ConflictRegion
): {
  markerStart: number
  currentStart: number
  currentEnd: number
  baseStart?: number
  baseEnd?: number
  separatorLine: number
  incomingStart: number
  incomingEnd: number
  markerEnd: number
} {
  // Note: content parameter kept for potential future use in validation
  void content
  let lineNum = region.startLine

  const markerStart = lineNum // <<<<<<< line
  lineNum++

  const currentStart = lineNum
  const currentLines = region.currentContent
    .split('\n')
    .filter((l) => l !== '' || region.currentContent === '').length
  const currentEnd = currentLines > 0 ? lineNum + currentLines - 1 : lineNum - 1
  lineNum = currentEnd + 1

  let baseStart: number | undefined
  let baseEnd: number | undefined

  // Check for diff3 base section
  if (region.baseContent !== undefined) {
    // ||||||| line
    lineNum++
    baseStart = lineNum
    const baseLines = region.baseContent
      .split('\n')
      .filter((l) => l !== '' || region.baseContent === '').length
    baseEnd = baseLines > 0 ? lineNum + baseLines - 1 : lineNum - 1
    lineNum = baseEnd + 1
  }

  const separatorLine = lineNum // ======= line
  lineNum++

  const incomingStart = lineNum
  const incomingLines = region.incomingContent
    .split('\n')
    .filter((l) => l !== '' || region.incomingContent === '').length
  const incomingEnd = incomingLines > 0 ? lineNum + incomingLines - 1 : lineNum - 1

  const markerEnd = region.endLine // >>>>>>> line

  return {
    markerStart,
    currentStart,
    currentEnd: Math.max(currentStart - 1, currentEnd),
    baseStart,
    baseEnd,
    separatorLine,
    incomingStart,
    incomingEnd: Math.max(incomingStart - 1, incomingEnd),
    markerEnd
  }
}

/**
 * Get the programming language based on file extension.
 *
 * @param filePath - The file path
 * @returns Monaco language identifier
 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell'
  }

  return languageMap[ext || ''] || 'plaintext'
}
