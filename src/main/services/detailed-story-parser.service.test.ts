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
      expect(result).toEqual({ epicNumber: 3, storyNumber: 4 })
    })

    it('handles double-digit numbers', () => {
      const result = DetailedStoryParserService.parseFileName('10-15-some-feature.md')
      expect(result).toEqual({ epicNumber: 10, storyNumber: 15 })
    })

    it('returns null for invalid filenames', () => {
      expect(DetailedStoryParserService.parseFileName('sprint-status.yaml')).toBeNull()
      expect(DetailedStoryParserService.parseFileName('README.md')).toBeNull()
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
  })
})
