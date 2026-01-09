import { describe, it, expect } from 'vitest'
import { EpicsParserService } from './epics-parser.service'
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('EpicsParserService', () => {
  let tempDir: string

  function createTempFile(content: string): string {
    tempDir = mkdtempSync(join(tmpdir(), 'epics-parser-test-'))
    const filePath = join(tempDir, 'epics.md')
    writeFileSync(filePath, content, 'utf-8')
    return filePath
  }

  function cleanup(filePath: string) {
    try {
      unlinkSync(filePath)
    } catch {
      // Ignore cleanup errors
    }
  }

  describe('parseEpicsFile', () => {
    it('parses epic headers correctly', async () => {
      const content = `## Epic 1: Project Foundation

**Goal:** Initialize the Electron application with core infrastructure.

### Story 1.1: Initialize Project

As a developer,
I want to initialize the project,
So that I have a working development environment.

**Acceptance Criteria:**

**Given** an empty project directory
**When** I run the setup
**Then** the project scaffolds correctly
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        expect(result).toHaveLength(1)
        expect(result[0].epicNumber).toBe(1)
        expect(result[0].title).toBe('Project Foundation')
        expect(result[0].goal).toBe('Initialize the Electron application with core infrastructure.')
      } finally {
        cleanup(filePath)
      }
    })

    it('extracts story numbers from title pattern', async () => {
      const content = `## Epic 2: Task Management

**Goal:** Deliver the Kanban interface.

### Story 2.3: Implement Drag and Drop

As a founder,
I want to drag tasks between columns,
So that I can change their status.

**Acceptance Criteria:**

**Given** the board is loaded
**When** I drag a task
**Then** the status changes
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        expect(result).toHaveLength(1)
        expect(result[0].stories).toHaveLength(1)
        expect(result[0].stories[0].epicNumber).toBe(2)
        expect(result[0].stories[0].storyNumber).toBe(3)
        expect(result[0].stories[0].title).toBe('Implement Drag and Drop')
      } finally {
        cleanup(filePath)
      }
    })

    it('parses user story As/I want/So that format', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Set up base.

### Story 1.1: Initialize

As a developer,
I want to set up the project structure,
So that I can start building features.

**Acceptance Criteria:**

**Given** nothing
**When** I start
**Then** it works
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        const story = result[0].stories[0]
        expect(story.userStory.role).toBe('developer')
        expect(story.userStory.action).toBe('set up the project structure')
        expect(story.userStory.benefit).toBe('I can start building features')
      } finally {
        cleanup(filePath)
      }
    })

    it('extracts Given/When/Then acceptance criteria', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Set up base.

### Story 1.1: Initialize

As a developer,
I want something,
So that it works.

**Acceptance Criteria:**

**Given** the project from Story 1.2
**When** I install packages
**Then** the packages install without errors
**And** native bindings compile

**Given** second condition
**When** I do something else
**Then** result happens
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        const story = result[0].stories[0]
        expect(story.acceptanceCriteria).toContain('**Given** the project from Story 1.2')
        expect(story.acceptanceCriteria).toContain('**When** I install packages')
        expect(story.acceptanceCriteria).toContain('**Then** the packages install without errors')
        expect(story.acceptanceCriteria).toContain('**And** native bindings compile')
        expect(story.acceptanceCriteria).toContain('**Given** second condition')
      } finally {
        cleanup(filePath)
      }
    })

    it('handles multiple epics in one file', async () => {
      const content = `## Epic 1: Foundation

**Goal:** First goal.

### Story 1.1: First Story

As a developer,
I want first,
So that first.

**Acceptance Criteria:**

**Given** first
**When** first
**Then** first

---

## Epic 2: Features

**Goal:** Second goal.

### Story 2.1: Second Story

As a user,
I want second,
So that second.

**Acceptance Criteria:**

**Given** second
**When** second
**Then** second
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        expect(result).toHaveLength(2)
        expect(result[0].epicNumber).toBe(1)
        expect(result[0].title).toBe('Foundation')
        expect(result[1].epicNumber).toBe(2)
        expect(result[1].title).toBe('Features')
      } finally {
        cleanup(filePath)
      }
    })

    it('handles empty file gracefully', async () => {
      const content = ''
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)
        expect(result).toEqual([])
      } finally {
        cleanup(filePath)
      }
    })

    it('handles malformed markdown without crashing', async () => {
      const content = `## Epic 1: Foundation

Some random text without proper structure.

### Story without number

Missing user story format.

Random content
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)
        // Should not throw, may return partial results or empty
        expect(Array.isArray(result)).toBe(true)
      } finally {
        cleanup(filePath)
      }
    })

    it('handles epic without stories', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Set up base infrastructure.

---

## Epic 2: Features

**Goal:** Build features.

### Story 2.1: First Feature

As a user,
I want features,
So that it works.

**Acceptance Criteria:**

**Given** ready
**When** I click
**Then** it works
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        // Epic 1 has no stories
        expect(result[0].stories).toHaveLength(0)
        // Epic 2 has 1 story
        expect(result[1].stories).toHaveLength(1)
      } finally {
        cleanup(filePath)
      }
    })

    it('handles stories without acceptance criteria', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Set up base.

### Story 1.1: Initialize

As a developer,
I want to set up the project,
So that I can build.

---

### Story 1.2: Configure

As a developer,
I want to configure,
So that it is configured.
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        const story = result[0].stories[0]
        // Should have empty or missing acceptance criteria
        expect(story.acceptanceCriteria).toBeDefined()
      } finally {
        cleanup(filePath)
      }
    })

    it('handles missing epic goal', async () => {
      const content = `## Epic 1: Foundation

### Story 1.1: Initialize

As a developer,
I want to initialize,
So that it works.

**Acceptance Criteria:**

**Given** start
**When** I do
**Then** done
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        expect(result[0].epicNumber).toBe(1)
        expect(result[0].goal).toBe('') // Empty goal, not undefined
      } finally {
        cleanup(filePath)
      }
    })

    it('preserves non-sequential story numbers', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Base setup.

### Story 1.1: First

As a dev,
I want first,
So that first.

**Acceptance Criteria:**

**Given** a
**When** b
**Then** c

---

### Story 1.5: Fifth

As a dev,
I want fifth,
So that fifth.

**Acceptance Criteria:**

**Given** a
**When** b
**Then** c

---

### Story 1.10: Tenth

As a dev,
I want tenth,
So that tenth.

**Acceptance Criteria:**

**Given** a
**When** b
**Then** c
`
      const filePath = createTempFile(content)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)

        const stories = result[0].stories
        expect(stories).toHaveLength(3)
        expect(stories[0].storyNumber).toBe(1)
        expect(stories[1].storyNumber).toBe(5)
        expect(stories[2].storyNumber).toBe(10)
      } finally {
        cleanup(filePath)
      }
    })

    it('throws error when file does not exist', async () => {
      await expect(
        EpicsParserService.parseEpicsFile('/non/existent/path/epics.md')
      ).rejects.toThrow()
    })

    it('handles file with BOM marker', async () => {
      const bomContent = '\uFEFF## Epic 1: Foundation\n\n**Goal:** Set up base.\n'
      const filePath = createTempFile(bomContent)

      try {
        const result = await EpicsParserService.parseEpicsFile(filePath)
        expect(result).toHaveLength(1)
        expect(result[0].epicNumber).toBe(1)
      } finally {
        cleanup(filePath)
      }
    })
  })
})
