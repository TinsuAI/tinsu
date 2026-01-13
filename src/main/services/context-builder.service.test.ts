import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContextBuilderService } from './context-builder.service'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}))

describe('ContextBuilderService', () => {
  const mockStoryPath = '/home/user/project/_bmad-output/implementation-artifacts/5-5-story.md'
  const mockProjectRoot = '/home/user/project'

  const mockStoryContent = `# Story 5.5: DEV Agent: Implement Story

Status: ready-for-dev

## Story

As a founder,
I want the Dev agent to implement the story with full context injection,
So that code is written according to requirements and architecture (FR8).

## Acceptance Criteria

1. **Given** SM draft completes (or is skipped)
   **When** DEV agent spawns
   **Then** Context Builder provides: story AC, PRD summary, architecture, UX design

## Tasks / Subtasks

- [ ] Task 1: Create ContextBuilderService
- [ ] Task 2: Create DevAgentProgressService

## Dev Notes

### Critical Architecture Patterns

**Electron Process Boundaries:**
- All context building happens in main process
`

  const mockProjectContextContent = `---
project_name: 'TinSu'
---

# Project Context for AI Agents

## Critical Implementation Rules

- Use tRPC for all IPC
- Tests co-located with source
`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('buildStoryContext', () => {
    it('loads story content from file path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(fs.readFileSync).toHaveBeenCalledWith(mockStoryPath, 'utf-8')
      expect(context.storyContent).toBe(mockStoryContent)
    })

    it('returns storyContent containing acceptance criteria', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyContent).toContain('## Acceptance Criteria')
    })

    it('returns storyContent containing tasks section', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyContent).toContain('## Tasks / Subtasks')
    })

    it('sets storyFilePath to the provided path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyFilePath).toBe(mockStoryPath)
    })

    it('returns undefined for optional fields when not available', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.contextNotes).toBeUndefined()
      expect(context.projectContextPath).toBeUndefined()
    })

    it('throws error when story file cannot be read', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file')
      })

      expect(() => {
        ContextBuilderService.buildStoryContext(mockStoryPath)
      }).toThrow('ENOENT: no such file')
    })
  })

  describe('buildStoryContextWithProjectContext', () => {
    it('loads project context when available and returns in context object', () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === mockStoryPath) return mockStoryContent
        if (typeof filePath === 'string' && filePath.includes('project-context.md')) {
          return mockProjectContextContent
        }
        throw new Error('File not found')
      })
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const projectContextPath = path.join(mockProjectRoot, '_bmad-output/planning-artifacts/project-context.md')
      const context = ContextBuilderService.buildStoryContextWithProjectContext(
        mockStoryPath,
        projectContextPath
      )

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.projectContextContent).toBe(mockProjectContextContent)
      expect(context.projectContextPath).toBe(projectContextPath)
    })

    it('returns undefined projectContextContent when project context file does not exist', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const projectContextPath = path.join(mockProjectRoot, '_bmad-output/planning-artifacts/project-context.md')
      const context = ContextBuilderService.buildStoryContextWithProjectContext(
        mockStoryPath,
        projectContextPath
      )

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.projectContextContent).toBeUndefined()
      expect(context.projectContextPath).toBeUndefined()
    })
  })

  describe('buildStoryContextWithNotes', () => {
    it('includes context notes when provided', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const notes = 'Remember to use the existing auth module'
      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, notes)

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBe(notes)
    })

    it('handles undefined context notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, undefined)

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBeUndefined()
    })

    it('handles empty string context notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, '')

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBe('')
    })
  })
})
