import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { DetailedStoryParserService } from './detailed-story-parser.service'

describe('DetailedStoryParserService', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'detailed-story-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('isStoryFile', () => {
    it('returns true for valid story file names', () => {
      expect(DetailedStoryParserService.isStoryFile('1-1-some-story.md')).toBe(true)
      expect(DetailedStoryParserService.isStoryFile('3-4-bmad-agent-launcher.md')).toBe(true)
      expect(DetailedStoryParserService.isStoryFile('10-15-long-story-name.md')).toBe(true)
      // With prefix
      expect(DetailedStoryParserService.isStoryFile('tes-1-1-tmux-check.md')).toBe(true)
      expect(DetailedStoryParserService.isStoryFile('tes-1-11-session-end-detection.md')).toBe(true)
    })

    it('returns false for non-story files', () => {
      expect(DetailedStoryParserService.isStoryFile('sprint-status.yaml')).toBe(false)
      expect(DetailedStoryParserService.isStoryFile('schema-gap-multi-project-support.md')).toBe(
        false
      )
      expect(DetailedStoryParserService.isStoryFile('README.md')).toBe(false)
      expect(DetailedStoryParserService.isStoryFile('1-some-file.md')).toBe(false)
    })
  })

  describe('parseFileName', () => {
    it('extracts epic and story numbers from valid filenames', () => {
      const result = DetailedStoryParserService.parseFileName('3-4-bmad-agent-launcher.md')
      expect(result).toEqual({ epicNumber: 3, storyNumber: '4' })
    })

    it('handles double-digit numbers', () => {
      const result = DetailedStoryParserService.parseFileName('10-15-some-feature.md')
      expect(result).toEqual({ epicNumber: 10, storyNumber: '15' })
    })

    it('handles prefixed filenames', () => {
      const result = DetailedStoryParserService.parseFileName('tes-1-1-tmux-check.md')
      expect(result).toEqual({ prefix: 'tes', epicNumber: 1, storyNumber: '1' })

      const result2 = DetailedStoryParserService.parseFileName('tes-1-11-session-end.md')
      expect(result2).toEqual({ prefix: 'tes', epicNumber: 1, storyNumber: '11' })
    })

    it('returns null for invalid filenames', () => {
      expect(DetailedStoryParserService.parseFileName('sprint-status.yaml')).toBeNull()
      expect(DetailedStoryParserService.parseFileName('README.md')).toBeNull()
      expect(DetailedStoryParserService.parseFileName('1-some-file.md')).toBeNull()
    })
  })

  describe('generateKey', () => {
    it('generates correct story key', () => {
      expect(DetailedStoryParserService.generateKey(3, '4')).toBe('3-4')
      expect(DetailedStoryParserService.generateKey(1, '10')).toBe('1-10')
    })

    it('handles letter suffixes in story numbers', () => {
      expect(DetailedStoryParserService.generateKey(5, '2b')).toBe('5-2b')
    })

    it('handles sub-story numbers', () => {
      expect(DetailedStoryParserService.generateKey(3, '1-5')).toBe('3-1-5')
    })

    it('includes prefix when provided', () => {
      expect(DetailedStoryParserService.generateKey(1, '1', 'tes')).toBe('tes-1-1')
      expect(DetailedStoryParserService.generateKey(1, '11', 'tes')).toBe('tes-1-11')
    })
  })

  describe('extractPrefixFromTaskId', () => {
    it('extracts prefix from task IDs with prefix', () => {
      expect(
        DetailedStoryParserService.extractPrefixFromTaskId('tes-1-1-tmux-dependency-check')
      ).toBe('tes')
      expect(DetailedStoryParserService.extractPrefixFromTaskId('abc-2-3-some-story')).toBe('abc')
    })

    it('returns undefined for task IDs without prefix', () => {
      expect(
        DetailedStoryParserService.extractPrefixFromTaskId('1-1-initialize-electron-project')
      ).toBeUndefined()
      expect(
        DetailedStoryParserService.extractPrefixFromTaskId('3-4-bmad-agent-launcher')
      ).toBeUndefined()
    })
  })

  describe('scanDetailedStories', () => {
    it('returns empty map for non-existent directory', async () => {
      const result = await DetailedStoryParserService.scanDetailedStories('/non/existent/path')
      expect(result.size).toBe(0)
    })

    it('returns empty map for empty directory', async () => {
      const result = await DetailedStoryParserService.scanDetailedStories(tempDir)
      expect(result.size).toBe(0)
    })

    it('scans and parses story files', async () => {
      // Create test story files
      writeFileSync(
        join(tempDir, '1-1-first-story.md'),
        '# Story 1.1: First Story\n\nContent here'
      )
      writeFileSync(
        join(tempDir, '1-2-second-story.md'),
        '# Story 1.2: Second Story\n\nMore content'
      )

      const result = await DetailedStoryParserService.scanDetailedStories(tempDir)

      expect(result.size).toBe(2)
      expect(result.has('1-1')).toBe(true)
      expect(result.has('1-2')).toBe(true)

      const story1 = result.get('1-1')
      expect(story1?.epicNumber).toBe(1)
      expect(story1?.storyNumber).toBe('1')
      expect(story1?.fullContent).toContain('First Story')
    })

    it('ignores non-story files', async () => {
      writeFileSync(join(tempDir, '1-1-story.md'), 'Story content')
      writeFileSync(join(tempDir, 'sprint-status.yaml'), 'status: done')
      writeFileSync(join(tempDir, 'README.md'), 'Read me')

      const result = await DetailedStoryParserService.scanDetailedStories(tempDir)

      expect(result.size).toBe(1)
      expect(result.has('1-1')).toBe(true)
    })

    it('stores correct file path', async () => {
      const storyPath = join(tempDir, '2-3-test-story.md')
      writeFileSync(storyPath, 'Test content')

      const result = await DetailedStoryParserService.scanDetailedStories(tempDir)

      const story = result.get('2-3')
      expect(story?.filePath).toBe(storyPath)
    })

    it('scans prefixed story files', async () => {
      // Create prefixed story files (like TES sprint)
      writeFileSync(join(tempDir, 'tes-1-1-tmux-check.md'), '# Story TES-1.1\n\nTmux check content')
      writeFileSync(join(tempDir, 'tes-1-11-session-end.md'), '# Story TES-1.11\n\nSession end content')
      // Create regular story file
      writeFileSync(join(tempDir, '1-1-initialize.md'), '# Story 1.1\n\nInitialize content')

      const result = await DetailedStoryParserService.scanDetailedStories(tempDir)

      expect(result.size).toBe(3)
      // Prefixed stories use prefixed keys
      expect(result.has('tes-1-1')).toBe(true)
      expect(result.has('tes-1-11')).toBe(true)
      // Non-prefixed story uses non-prefixed key
      expect(result.has('1-1')).toBe(true)

      const tesStory = result.get('tes-1-1')
      expect(tesStory?.prefix).toBe('tes')
      expect(tesStory?.epicNumber).toBe(1)
      expect(tesStory?.storyNumber).toBe('1')
      expect(tesStory?.fullContent).toContain('Tmux check content')
    })
  })

  describe('findStoryFile', () => {
    it('returns null for non-existent directory', async () => {
      const result = await DetailedStoryParserService.findStoryFile('/non/existent', 1, '1')
      expect(result).toBeNull()
    })

    it('returns null when story file not found', async () => {
      writeFileSync(join(tempDir, '1-1-story.md'), 'Content')

      const result = await DetailedStoryParserService.findStoryFile(tempDir, 2, '2')
      expect(result).toBeNull()
    })

    it('finds and returns specific story file', async () => {
      const content = '# Story 3.4\n\nFull detailed content here.'
      writeFileSync(join(tempDir, '3-4-specific-story.md'), content)

      const result = await DetailedStoryParserService.findStoryFile(tempDir, 3, '4')

      expect(result).not.toBeNull()
      expect(result?.epicNumber).toBe(3)
      expect(result?.storyNumber).toBe('4')
      expect(result?.fullContent).toBe(content)
    })

    it('finds story file with letter suffix', async () => {
      const content = '# Story 5.2b\n\nLetter suffix content.'
      writeFileSync(join(tempDir, '5-2b-add-create-story-column.md'), content)

      const result = await DetailedStoryParserService.findStoryFile(tempDir, 5, '2b')

      expect(result).not.toBeNull()
      expect(result?.storyNumber).toBe('2b')
    })

    it('finds prefixed story file', async () => {
      const content = '# Story TES-1.1\n\nPrefixed story content.'
      writeFileSync(join(tempDir, 'tes-1-1-tmux-check.md'), content)
      // Also create a non-prefixed 1-1 file to ensure we get the right one
      writeFileSync(join(tempDir, '1-1-other-story.md'), 'Other content')

      const result = await DetailedStoryParserService.findStoryFile(tempDir, 1, '1', 'tes')

      expect(result).not.toBeNull()
      expect(result?.prefix).toBe('tes')
      expect(result?.epicNumber).toBe(1)
      expect(result?.storyNumber).toBe('1')
      expect(result?.fullContent).toContain('Prefixed story content')
    })

    it('does not find prefixed file when no prefix specified', async () => {
      // Only create prefixed file
      writeFileSync(join(tempDir, 'tes-1-1-tmux-check.md'), 'Prefixed content')

      // Search without prefix should not find it
      const result = await DetailedStoryParserService.findStoryFile(tempDir, 1, '1')
      expect(result).toBeNull()
    })
  })
})
