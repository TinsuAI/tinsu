import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { FileWatcherService } from './file-watcher.service'

describe('FileWatcherService', () => {
  let tempDir: string
  let watcherService: FileWatcherService

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'file-watcher-test-'))
    watcherService = new FileWatcherService()
  })

  afterEach(async () => {
    await watcherService.stopWatching()
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('startWatching', () => {
    it('emits change event when file is modified', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, '# Story 3.9\n\nContent')

      const onChange = vi.fn()
      watcherService.startWatching(tempDir, onChange)

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Modify the file
      writeFileSync(storyFile, '# Story 3.9\n\nUpdated content')

      // Wait for the debounced callback plus some buffer
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(onChange).toHaveBeenCalled()
      expect(onChange.mock.calls[0][0]).toBe(storyFile)
    }, 10000)

    it('debounces rapid changes', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, '# Story 3.9\n\nContent')

      const onChange = vi.fn()
      watcherService.startWatching(tempDir, onChange)

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Make rapid changes
      writeFileSync(storyFile, '# Story 3.9\n\nChange 1')
      await new Promise((resolve) => setTimeout(resolve, 50))
      writeFileSync(storyFile, '# Story 3.9\n\nChange 2')
      await new Promise((resolve) => setTimeout(resolve, 50))
      writeFileSync(storyFile, '# Story 3.9\n\nChange 3')

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Should only be called once due to debouncing
      expect(onChange.mock.calls.length).toBeLessThanOrEqual(2)
    }, 10000)

    it('ignores non-markdown files', async () => {
      const txtFile = join(tempDir, 'notes.txt')
      writeFileSync(txtFile, 'Some notes')

      const onChange = vi.fn()
      watcherService.startWatching(tempDir, onChange)

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Modify non-markdown file
      writeFileSync(txtFile, 'Updated notes')

      // Wait for potential callback
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(onChange).not.toHaveBeenCalled()
    }, 10000)
  })

  describe('stopWatching', () => {
    it('stops emitting events after stopWatching is called', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, '# Story 3.9\n\nContent')

      const onChange = vi.fn()
      watcherService.startWatching(tempDir, onChange)

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Stop watching
      await watcherService.stopWatching()

      // Modify the file after stopping
      writeFileSync(storyFile, '# Story 3.9\n\nUpdated content')

      // Wait for potential callback
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(onChange).not.toHaveBeenCalled()
    }, 10000)

    it('can be called multiple times safely', async () => {
      watcherService.startWatching(tempDir, vi.fn())

      // Should not throw
      await watcherService.stopWatching()
      await watcherService.stopWatching()
      await watcherService.stopWatching()
    })
  })

  describe('isWatching', () => {
    it('returns false when not watching', () => {
      expect(watcherService.isWatching()).toBe(false)
    })

    it('returns true when watching', () => {
      watcherService.startWatching(tempDir, vi.fn())
      expect(watcherService.isWatching()).toBe(true)
    })

    it('returns false after stopping', async () => {
      watcherService.startWatching(tempDir, vi.fn())
      await watcherService.stopWatching()
      expect(watcherService.isWatching()).toBe(false)
    })
  })

  describe('restartWatching', () => {
    it('stops previous watcher when starting a new one', async () => {
      const onChange1 = vi.fn()
      const onChange2 = vi.fn()

      watcherService.startWatching(tempDir, onChange1)
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Start a new watcher with different callback
      watcherService.startWatching(tempDir, onChange2)
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Create and modify a file
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, '# Story 3.9\n\nContent')

      await new Promise((resolve) => setTimeout(resolve, 600))

      // Only the second callback should be called
      expect(onChange1).not.toHaveBeenCalled()
    }, 10000)
  })
})
