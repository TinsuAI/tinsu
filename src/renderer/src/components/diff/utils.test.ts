/**
 * Unit tests for Monaco Diff Editor utilities
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import { describe, it, expect } from 'vitest'
import { getLanguageFromPath, reconstructFileContent } from './utils'
import type { GitDiffHunk } from '@main/services/git.service'

describe('getLanguageFromPath', () => {
  describe('JavaScript/TypeScript files', () => {
    it('returns typescript for .ts files', () => {
      expect(getLanguageFromPath('src/App.ts')).toBe('typescript')
    })

    it('returns typescript for .tsx files', () => {
      expect(getLanguageFromPath('components/Button.tsx')).toBe('typescript')
    })

    it('returns javascript for .js files', () => {
      expect(getLanguageFromPath('index.js')).toBe('javascript')
    })

    it('returns javascript for .jsx files', () => {
      expect(getLanguageFromPath('App.jsx')).toBe('javascript')
    })

    it('returns javascript for .mjs files', () => {
      expect(getLanguageFromPath('module.mjs')).toBe('javascript')
    })

    it('returns javascript for .cjs files', () => {
      expect(getLanguageFromPath('config.cjs')).toBe('javascript')
    })
  })

  describe('Web files', () => {
    it('returns html for .html files', () => {
      expect(getLanguageFromPath('index.html')).toBe('html')
    })

    it('returns css for .css files', () => {
      expect(getLanguageFromPath('styles.css')).toBe('css')
    })

    it('returns scss for .scss files', () => {
      expect(getLanguageFromPath('app.scss')).toBe('scss')
    })

    it('returns less for .less files', () => {
      expect(getLanguageFromPath('theme.less')).toBe('less')
    })
  })

  describe('Data files', () => {
    it('returns json for .json files', () => {
      expect(getLanguageFromPath('package.json')).toBe('json')
    })

    it('returns yaml for .yaml files', () => {
      expect(getLanguageFromPath('config.yaml')).toBe('yaml')
    })

    it('returns yaml for .yml files', () => {
      expect(getLanguageFromPath('docker-compose.yml')).toBe('yaml')
    })

    it('returns xml for .xml files', () => {
      expect(getLanguageFromPath('pom.xml')).toBe('xml')
    })
  })

  describe('Markdown files', () => {
    it('returns markdown for .md files', () => {
      expect(getLanguageFromPath('README.md')).toBe('markdown')
    })

    it('returns markdown for .mdx files', () => {
      expect(getLanguageFromPath('docs.mdx')).toBe('markdown')
    })
  })

  describe('Database and Shell files', () => {
    it('returns sql for .sql files', () => {
      expect(getLanguageFromPath('schema.sql')).toBe('sql')
    })

    it('returns shell for .sh files', () => {
      expect(getLanguageFromPath('deploy.sh')).toBe('shell')
    })

    it('returns shell for .bash files', () => {
      expect(getLanguageFromPath('setup.bash')).toBe('shell')
    })

    it('returns shell for .zsh files', () => {
      expect(getLanguageFromPath('.zshrc.zsh')).toBe('shell')
    })
  })

  describe('Other languages', () => {
    it('returns python for .py files', () => {
      expect(getLanguageFromPath('main.py')).toBe('python')
    })

    it('returns rust for .rs files', () => {
      expect(getLanguageFromPath('lib.rs')).toBe('rust')
    })

    it('returns go for .go files', () => {
      expect(getLanguageFromPath('main.go')).toBe('go')
    })

    it('returns plaintext for .txt files', () => {
      expect(getLanguageFromPath('notes.txt')).toBe('plaintext')
    })
  })

  describe('Edge cases', () => {
    it('returns plaintext for unknown extensions', () => {
      expect(getLanguageFromPath('file.unknown')).toBe('plaintext')
    })

    it('returns plaintext for files without extension', () => {
      expect(getLanguageFromPath('Makefile')).toBe('plaintext')
    })

    it('handles files with multiple dots in path', () => {
      expect(getLanguageFromPath('path/to/my.file.test.tsx')).toBe('typescript')
    })

    it('handles uppercase extensions', () => {
      expect(getLanguageFromPath('FILE.TS')).toBe('typescript')
    })

    it('handles mixed case extensions', () => {
      expect(getLanguageFromPath('test.TsX')).toBe('typescript')
    })
  })
})

describe('reconstructFileContent', () => {
  describe('basic reconstruction', () => {
    it('returns empty strings for empty hunks array', () => {
      const result = reconstructFileContent([])
      expect(result.original).toBe('')
      expect(result.modified).toBe('')
    })

    it('returns empty strings for null hunks', () => {
      const result = reconstructFileContent(null)
      expect(result.original).toBe('')
      expect(result.modified).toBe('')
    })

    it('returns empty strings for undefined hunks', () => {
      const result = reconstructFileContent(undefined)
      expect(result.original).toBe('')
      expect(result.modified).toBe('')
    })

    it('handles context-only lines', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: '@@ -1,3 +1,3 @@',
          lines: [
            { type: 'context', content: 'line 1' },
            { type: 'context', content: 'line 2' },
            { type: 'context', content: 'line 3' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)
      expect(result.original).toBe('line 1\nline 2\nline 3')
      expect(result.modified).toBe('line 1\nline 2\nline 3')
    })

    it('handles added lines only', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 2,
          header: '@@ -1,0 +1,2 @@',
          lines: [
            { type: 'add', content: 'new line 1' },
            { type: 'add', content: 'new line 2' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)
      expect(result.original).toBe('')
      expect(result.modified).toBe('new line 1\nnew line 2')
    })

    it('handles removed lines only', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 0,
          header: '@@ -1,2 +1,0 @@',
          lines: [
            { type: 'remove', content: 'old line 1' },
            { type: 'remove', content: 'old line 2' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)
      expect(result.original).toBe('old line 1\nold line 2')
      expect(result.modified).toBe('')
    })
  })

  describe('mixed changes', () => {
    it('handles mixed add/remove/context lines', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          header: '@@ -1,3 +1,3 @@',
          lines: [
            { type: 'context', content: 'unchanged' },
            { type: 'remove', content: 'old value' },
            { type: 'add', content: 'new value' },
            { type: 'context', content: 'also unchanged' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)
      expect(result.original).toBe('unchanged\nold value\nalso unchanged')
      expect(result.modified).toBe('unchanged\nnew value\nalso unchanged')
    })

    it('handles multiple hunks', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          header: '@@ -1,1 +1,1 @@',
          lines: [
            { type: 'remove', content: 'first old' },
            { type: 'add', content: 'first new' }
          ]
        },
        {
          oldStart: 10,
          oldLines: 1,
          newStart: 10,
          newLines: 1,
          header: '@@ -10,1 +10,1 @@',
          lines: [
            { type: 'remove', content: 'second old' },
            { type: 'add', content: 'second new' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)
      expect(result.original).toBe('first old\nsecond old')
      expect(result.modified).toBe('first new\nsecond new')
    })
  })

  describe('real-world scenarios', () => {
    it('reconstructs a function modification', () => {
      const hunks: GitDiffHunk[] = [
        {
          oldStart: 1,
          oldLines: 5,
          newStart: 1,
          newLines: 6,
          header: '@@ -1,5 +1,6 @@',
          lines: [
            { type: 'context', content: 'function greet(name) {' },
            { type: 'remove', content: '  console.log("Hello, " + name);' },
            { type: 'add', content: '  const greeting = `Hello, ${name}!`;' },
            { type: 'add', content: '  console.log(greeting);' },
            { type: 'context', content: '}' }
          ]
        }
      ]

      const result = reconstructFileContent(hunks)

      expect(result.original).toBe(
        'function greet(name) {\n  console.log("Hello, " + name);\n}'
      )
      expect(result.modified).toBe(
        'function greet(name) {\n  const greeting = `Hello, ${name}!`;\n  console.log(greeting);\n}'
      )
    })
  })
})
