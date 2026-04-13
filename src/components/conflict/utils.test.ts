/**
 * Unit tests for conflict resolution utilities.
 *
 * Story 8.8: Conflict Resolution UI - Task 9
 */

import { describe, it, expect } from 'vitest'
import {
  parseConflictRegions,
  resolveConflict,
  hasUnresolvedConflicts,
  getLanguageFromPath,
  type ConflictRegion
} from './utils'

describe('parseConflictRegions', () => {
  it('parses single conflict correctly', () => {
    const content = `line 1
<<<<<<< HEAD
current content
=======
incoming content
>>>>>>> feature-branch
line 2`

    const result = parseConflictRegions(content)

    expect(result.hasConflicts).toBe(true)
    expect(result.regions).toHaveLength(1)
    expect(result.regions[0].currentContent).toBe('current content')
    expect(result.regions[0].incomingContent).toBe('incoming content')
    expect(result.regions[0].currentBranchLabel).toBe('HEAD')
    expect(result.regions[0].incomingBranchLabel).toBe('feature-branch')
    expect(result.regions[0].startLine).toBe(2)
    expect(result.regions[0].endLine).toBe(6)
  })

  it('handles multiple conflicts in one file', () => {
    const content = `start
<<<<<<< HEAD
first current
=======
first incoming
>>>>>>> branch1
middle
<<<<<<< HEAD
second current
=======
second incoming
>>>>>>> branch2
end`

    const result = parseConflictRegions(content)

    expect(result.hasConflicts).toBe(true)
    expect(result.regions).toHaveLength(2)
    expect(result.regions[0].currentContent).toBe('first current')
    expect(result.regions[0].incomingContent).toBe('first incoming')
    expect(result.regions[1].currentContent).toBe('second current')
    expect(result.regions[1].incomingContent).toBe('second incoming')
  })

  it('parses diff3 format with common ancestor', () => {
    const content = `<<<<<<< HEAD
current version
||||||| merged common ancestors
original version
=======
incoming version
>>>>>>> feature`

    const result = parseConflictRegions(content)

    expect(result.hasConflicts).toBe(true)
    expect(result.regions).toHaveLength(1)
    expect(result.regions[0].currentContent).toBe('current version')
    expect(result.regions[0].baseContent).toBe('original version')
    expect(result.regions[0].incomingContent).toBe('incoming version')
  })

  it('handles empty content in conflict regions', () => {
    const content = `<<<<<<< HEAD
=======
only incoming
>>>>>>> branch`

    const result = parseConflictRegions(content)

    expect(result.hasConflicts).toBe(true)
    expect(result.regions[0].currentContent).toBe('')
    expect(result.regions[0].incomingContent).toBe('only incoming')
  })

  it('handles multiline content in regions', () => {
    const content = `<<<<<<< HEAD
line 1
line 2
line 3
=======
other 1
other 2
>>>>>>> branch`

    const result = parseConflictRegions(content)

    expect(result.regions[0].currentContent).toBe('line 1\nline 2\nline 3')
    expect(result.regions[0].incomingContent).toBe('other 1\nother 2')
  })

  it('returns empty regions for no conflicts', () => {
    const content = `normal file
with no conflicts
just regular content`

    const result = parseConflictRegions(content)

    expect(result.hasConflicts).toBe(false)
    expect(result.regions).toHaveLength(0)
  })
})

describe('resolveConflict', () => {
  const createBasicConflict = (): { content: string; region: ConflictRegion } => {
    const content = `before
<<<<<<< HEAD
current
=======
incoming
>>>>>>> branch
after`

    return {
      content,
      region: {
        startLine: 2,
        endLine: 6,
        startOffset: 0,
        endOffset: 0,
        currentContent: 'current',
        incomingContent: 'incoming',
        currentBranchLabel: 'HEAD',
        incomingBranchLabel: 'branch'
      }
    }
  }

  it('resolves with current choice - removes incoming and markers', () => {
    const { content, region } = createBasicConflict()

    const result = resolveConflict(content, region, 'current')

    expect(result).toBe(`before
current
after`)
    expect(result).not.toContain('<<<<<<<')
    expect(result).not.toContain('=======')
    expect(result).not.toContain('>>>>>>>')
    expect(result).not.toContain('incoming')
  })

  it('resolves with incoming choice - removes current and markers', () => {
    const { content, region } = createBasicConflict()

    const result = resolveConflict(content, region, 'incoming')

    expect(result).toBe(`before
incoming
after`)
    expect(result).not.toContain('<<<<<<<')
    expect(result).not.toContain('current')
  })

  it('resolves with both choice - keeps both, removes markers', () => {
    const { content, region } = createBasicConflict()

    const result = resolveConflict(content, region, 'both')

    expect(result).toBe(`before
current
incoming
after`)
    expect(result).not.toContain('<<<<<<<')
    expect(result).not.toContain('=======')
    expect(result).not.toContain('>>>>>>>')
  })

  it('handles multiline content in resolution', () => {
    const content = `start
<<<<<<< HEAD
line 1
line 2
=======
other 1
other 2
other 3
>>>>>>> branch
end`

    const region: ConflictRegion = {
      startLine: 2,
      endLine: 9,
      startOffset: 0,
      endOffset: 0,
      currentContent: 'line 1\nline 2',
      incomingContent: 'other 1\nother 2\nother 3',
      currentBranchLabel: 'HEAD',
      incomingBranchLabel: 'branch'
    }

    const result = resolveConflict(content, region, 'incoming')

    expect(result).toBe(`start
other 1
other 2
other 3
end`)
  })

  it('handles empty current content', () => {
    const content = `<<<<<<< HEAD
=======
incoming only
>>>>>>> branch`

    const region: ConflictRegion = {
      startLine: 1,
      endLine: 4,
      startOffset: 0,
      endOffset: 0,
      currentContent: '',
      incomingContent: 'incoming only',
      currentBranchLabel: 'HEAD',
      incomingBranchLabel: 'branch'
    }

    const result = resolveConflict(content, region, 'both')

    expect(result).toBe('incoming only')
  })
})

describe('hasUnresolvedConflicts', () => {
  it('detects conflict markers correctly', () => {
    const conflicted = `some text
<<<<<<< HEAD
content
=======
other
>>>>>>> branch`

    expect(hasUnresolvedConflicts(conflicted)).toBe(true)
  })

  it('returns false when no conflicts', () => {
    const clean = `normal file
with no conflict markers
just regular text`

    expect(hasUnresolvedConflicts(clean)).toBe(false)
  })

  it('handles partial conflict (missing end marker)', () => {
    // This is technically invalid but we detect start marker
    const partial = `<<<<<<< HEAD
content here`

    expect(hasUnresolvedConflicts(partial)).toBe(true)
  })

  it('returns false for empty content', () => {
    expect(hasUnresolvedConflicts('')).toBe(false)
  })

  it('detects multiple conflicts', () => {
    const multiple = `<<<<<<< HEAD
a
=======
b
>>>>>>> x
<<<<<<< HEAD
c
=======
d
>>>>>>> y`

    expect(hasUnresolvedConflicts(multiple)).toBe(true)
  })
})

describe('getLanguageFromPath', () => {
  it('detects TypeScript files', () => {
    expect(getLanguageFromPath('src/main.ts')).toBe('typescript')
    expect(getLanguageFromPath('component.tsx')).toBe('typescript')
  })

  it('detects JavaScript files', () => {
    expect(getLanguageFromPath('app.js')).toBe('javascript')
    expect(getLanguageFromPath('component.jsx')).toBe('javascript')
  })

  it('detects common file types', () => {
    expect(getLanguageFromPath('data.json')).toBe('json')
    expect(getLanguageFromPath('README.md')).toBe('markdown')
    expect(getLanguageFromPath('styles.css')).toBe('css')
    expect(getLanguageFromPath('styles.scss')).toBe('scss')
    expect(getLanguageFromPath('config.yaml')).toBe('yaml')
    expect(getLanguageFromPath('config.yml')).toBe('yaml')
    expect(getLanguageFromPath('index.html')).toBe('html')
  })

  it('handles paths with directories', () => {
    expect(getLanguageFromPath('src/components/Button.tsx')).toBe('typescript')
    expect(getLanguageFromPath('/absolute/path/to/file.py')).toBe('python')
  })

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageFromPath('file.unknown')).toBe('plaintext')
    expect(getLanguageFromPath('noextension')).toBe('plaintext')
  })

  it('is case insensitive for extensions', () => {
    expect(getLanguageFromPath('FILE.TS')).toBe('typescript')
    expect(getLanguageFromPath('data.JSON')).toBe('json')
  })
})
