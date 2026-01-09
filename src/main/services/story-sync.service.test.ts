import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, chmodSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { StorySyncService, SyncError } from './story-sync.service'

describe('StorySyncService', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'story-sync-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('updateStoryFileStatus', () => {
    it('updates status in markdown file', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

Status: ready-for-dev

## Story

As a user, I want something.

## Acceptance Criteria

1. AC1
`
      writeFileSync(filePath, content)

      await StorySyncService.updateStoryFileStatus(filePath, 'in-progress')

      const updated = readFileSync(filePath, 'utf-8')
      expect(updated).toContain('Status: in-progress')
      expect(updated).not.toContain('Status: ready-for-dev')
    })

    it('preserves file content when updating status', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

Status: ready-for-dev

## Story

As a user, I want something.

## Acceptance Criteria

1. **Given** some condition
   **When** something happens
   **Then** result occurs

## Tasks / Subtasks

- [ ] Task 1
- [ ] Task 2
`
      writeFileSync(filePath, content)

      await StorySyncService.updateStoryFileStatus(filePath, 'done')

      const updated = readFileSync(filePath, 'utf-8')
      expect(updated).toContain('# Story 3.9: Test Story')
      expect(updated).toContain('## Story')
      expect(updated).toContain('As a user, I want something.')
      expect(updated).toContain('## Acceptance Criteria')
      expect(updated).toContain('## Tasks / Subtasks')
      expect(updated).toContain('- [ ] Task 1')
    })

    it('handles status without Status: prefix line (inserts after title)', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

## Story

As a user, I want something.
`
      writeFileSync(filePath, content)

      await StorySyncService.updateStoryFileStatus(filePath, 'in-progress')

      const updated = readFileSync(filePath, 'utf-8')
      expect(updated).toContain('Status: in-progress')
      expect(updated).toContain('# Story 3.9: Test Story')
    })

    it('throws SyncError with FILE_NOT_FOUND for non-existent file', async () => {
      const filePath = join(tempDir, 'non-existent.md')

      try {
        await StorySyncService.updateStoryFileStatus(filePath, 'in-progress')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(SyncError)
        expect((error as SyncError).code).toBe('FILE_NOT_FOUND')
        expect((error as SyncError).message).toContain('Story file not found')
      }
    })

    // Note: Permission tests are skipped on Windows and may not work in all CI environments
    it.skipIf(process.platform === 'win32')('throws SyncError with PERMISSION_DENIED for read-only file', async () => {
      const filePath = join(tempDir, '3-9-readonly.md')
      writeFileSync(filePath, '# Story\n\nStatus: ready-for-dev\n')
      // Make file read-only
      chmodSync(filePath, 0o444)

      try {
        await StorySyncService.updateStoryFileStatus(filePath, 'in-progress')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(SyncError)
        expect((error as SyncError).code).toBe('PERMISSION_DENIED')
      } finally {
        // Restore permissions for cleanup
        chmodSync(filePath, 0o644)
      }
    })

    it('handles different status values', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

Status: backlog

## Story
`
      writeFileSync(filePath, content)

      // Update to each status
      const statuses = ['ready-for-dev', 'in-progress', 'review', 'done']
      for (const status of statuses) {
        await StorySyncService.updateStoryFileStatus(filePath, status)
        const updated = readFileSync(filePath, 'utf-8')
        expect(updated).toContain(`Status: ${status}`)
      }
    })
  })

  describe('readStoryFileContent', () => {
    it('reads status from file correctly', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

Status: in-progress

## Story

Content here.
`
      writeFileSync(filePath, content)

      const result = await StorySyncService.readStoryFileContent(filePath)

      expect(result.status).toBe('in-progress')
      expect(result.fullContent).toBe(content)
    })

    it('extracts title from story file', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Bidirectional Sync

Status: ready-for-dev

## Story
`
      writeFileSync(filePath, content)

      const result = await StorySyncService.readStoryFileContent(filePath)

      expect(result.title).toBe('Bidirectional Sync')
    })

    it('defaults to backlog when no status found', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test Story

## Story

Content without status line.
`
      writeFileSync(filePath, content)

      const result = await StorySyncService.readStoryFileContent(filePath)

      expect(result.status).toBe('backlog')
    })

    it('includes mtime in result', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      writeFileSync(filePath, '# Story 3.9\n\nStatus: ready-for-dev\n')

      const result = await StorySyncService.readStoryFileContent(filePath)

      expect(result.mtime).toBeGreaterThan(0)
    })

    it('throws SyncError with FILE_NOT_FOUND for missing file', async () => {
      const filePath = join(tempDir, 'non-existent.md')

      try {
        await StorySyncService.readStoryFileContent(filePath)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(SyncError)
        expect((error as SyncError).code).toBe('FILE_NOT_FOUND')
        expect((error as SyncError).message).toContain('Story file not found')
      }
    })
  })

  describe('hasFileChanged', () => {
    it('returns false when file has not changed', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      writeFileSync(filePath, '# Story\n\nContent')

      const content = await StorySyncService.readStoryFileContent(filePath)
      const mtime = content.mtime

      const result = await StorySyncService.hasFileChanged(filePath, mtime)

      expect(result).toBe(false)
    })

    it('returns true when file has changed', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      writeFileSync(filePath, '# Story\n\nContent')

      const content = await StorySyncService.readStoryFileContent(filePath)
      const mtime = content.mtime

      // Wait a bit and modify the file
      await new Promise((resolve) => setTimeout(resolve, 100))
      writeFileSync(filePath, '# Story\n\nUpdated content')

      const result = await StorySyncService.hasFileChanged(filePath, mtime)

      expect(result).toBe(true)
    })

    it('returns false for deleted file (not considered a change)', async () => {
      const filePath = join(tempDir, 'non-existent.md')

      const result = await StorySyncService.hasFileChanged(filePath, Date.now())

      expect(result).toBe(false)
    })
  })

  describe('detectFileChanges (content comparison)', () => {
    it('returns true when content differs', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      writeFileSync(filePath, '# Story\n\nNew content')

      const result = await StorySyncService.detectFileChanges(
        filePath,
        '# Story\n\nOld content'
      )

      expect(result).toBe(true)
    })

    it('returns false when content matches', async () => {
      const filePath = join(tempDir, '3-9-test-story.md')
      const content = '# Story\n\nSame content'
      writeFileSync(filePath, content)

      const result = await StorySyncService.detectFileChanges(filePath, content)

      expect(result).toBe(false)
    })

    it('returns false for non-existent file', async () => {
      const filePath = join(tempDir, 'non-existent.md')

      const result = await StorySyncService.detectFileChanges(filePath, 'any content')

      expect(result).toBe(false)
    })
  })
})
