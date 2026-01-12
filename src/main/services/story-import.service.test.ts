import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'

// Mock the database module before importing StoryImportService (required for ArtifactLinkingService)
vi.mock('../db', () => ({
  db: null as unknown as BetterSQLite3Database<typeof schema>
}))

import * as dbModule from '../db'
import { StoryImportService } from './story-import.service'
import type { ParsedEpic } from './epics-parser.service'
import type { StoryKey } from './detailed-story-parser.service'

type TestDb = BetterSQLite3Database<typeof schema>

const TEST_PROJECT_ID = 'test-project-id'

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create the epics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      epic_number INTEGER,
      goal TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);
  `)

  // Create the tasks table (Story 3.7: story_file_path, full_content)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      sort_order INTEGER NOT NULL DEFAULT 0,
      epic_id TEXT,
      sprint_id TEXT,
      task_type TEXT NOT NULL DEFAULT 'story',
      phase_number INTEGER,
      phase_name TEXT,
      bmad_agent TEXT,
      bmad_workflow TEXT,
      is_start_here INTEGER,
      artifact_path TEXT,
      story_number TEXT,
      story_file_path TEXT,
      full_content TEXT,
      story_file_status TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  const db = drizzle({ client: sqlite, schema })

  // Create test project
  db.insert(schema.projects)
    .values({
      id: TEST_PROJECT_ID,
      path: '/test/project',
      name: 'Test Project'
    })
    .run()

  return db
}

describe('StoryImportService', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  describe('importFromParsedEpics', () => {
    it('creates epic records in database', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Project Foundation',
          goal: 'Set up the base infrastructure',
          stories: []
        }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      expect(result.epicsCreated).toBe(1)

      const epics = db.select().from(schema.epics).all()
      expect(epics).toHaveLength(1)
      expect(epics[0].title).toBe('Project Foundation')
      expect(epics[0].epic_number).toBe(1)
      expect(epics[0].goal).toBe('Set up the base infrastructure')
      expect(epics[0].project_id).toBe(TEST_PROJECT_ID)
    })

    it('creates story tasks linked to epics', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Foundation',
          goal: 'Build foundation',
          stories: [
            {
              epicNumber: 1,
              storyNumber: "1", storyNumberInt: 1,
              title: 'Initialize Project',
              userStory: {
                role: 'developer',
                action: 'initialize the project',
                benefit: 'I can start development'
              },
              acceptanceCriteria: '**Given** nothing\n**When** I setup\n**Then** done'
            },
            {
              epicNumber: 1,
              storyNumber: "2", storyNumberInt: 2,
              title: 'Configure Tools',
              userStory: {
                role: 'developer',
                action: 'configure tools',
                benefit: 'development is easier'
              },
              acceptanceCriteria: '**Given** setup\n**When** I configure\n**Then** tools work'
            }
          ]
        }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      expect(result.storiesCreated).toBe(2)

      const tasks = db.select().from(schema.tasks).all()
      expect(tasks).toHaveLength(2)

      // Check first task
      expect(tasks[0].task_type).toBe('story')
      expect(tasks[0].story_number).toBe('1')
      expect(tasks[0].project_id).toBe(TEST_PROJECT_ID)
      expect(tasks[0].epic_id).not.toBeNull()

      // Check second task
      expect(tasks[1].story_number).toBe('2')
    })

    it('sets correct task_type as story', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Test Epic',
          goal: 'Test',
          stories: [
            {
              epicNumber: 1,
              storyNumber: "1", storyNumberInt: 1,
              title: 'Test Story',
              userStory: { role: 'user', action: 'test', benefit: 'works' },
              acceptanceCriteria: ''
            }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const tasks = db.select().from(schema.tasks).all()
      expect(tasks[0].task_type).toBe('story')
    })

    it('returns accurate import counts', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic 1',
          goal: 'Goal 1',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story 1.1', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'Story 1.2', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        },
        {
          epicNumber: 2,
          title: 'Epic 2',
          goal: 'Goal 2',
          stories: [
            { epicNumber: 2, storyNumber: "1", storyNumberInt: 1, title: 'Story 2.1', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      expect(result.epicsCreated).toBe(2)
      expect(result.storiesCreated).toBe(3)
      expect(result.epicIds).toHaveLength(2)
      expect(result.storyIds).toHaveLength(3)
    })

    it('formats story description with user story and acceptance criteria', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            {
              epicNumber: 1,
              storyNumber: "1", storyNumberInt: 1,
              title: 'Test Story',
              userStory: {
                role: 'developer',
                action: 'write code',
                benefit: 'features work'
              },
              acceptanceCriteria: '**Given** ready\n**When** I code\n**Then** it works'
            }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const task = db.select().from(schema.tasks).get()
      expect(task?.description).toContain('As a developer')
      expect(task?.description).toContain('I want to write code')
      expect(task?.description).toContain('So that features work')
      expect(task?.description).toContain('Acceptance Criteria')
      expect(task?.description).toContain('**Given** ready')
    })

    it('handles epic without stories', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Empty Epic',
          goal: 'No stories yet',
          stories: []
        }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      expect(result.epicsCreated).toBe(1)
      expect(result.storiesCreated).toBe(0)

      const epics = db.select().from(schema.epics).all()
      expect(epics).toHaveLength(1)

      const tasks = db.select().from(schema.tasks).all()
      expect(tasks).toHaveLength(0)
    })

    it('assigns epic colors from palette', async () => {
      const parsedEpics: ParsedEpic[] = [
        { epicNumber: 1, title: 'Epic 1', goal: '', stories: [] },
        { epicNumber: 2, title: 'Epic 2', goal: '', stories: [] },
        { epicNumber: 3, title: 'Epic 3', goal: '', stories: [] }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const epics = db.select().from(schema.epics).all()
      // Each epic should have a valid color from the palette
      expect(schema.EPIC_COLORS).toContain(epics[0].color)
      expect(schema.EPIC_COLORS).toContain(epics[1].color)
      expect(schema.EPIC_COLORS).toContain(epics[2].color)
    })

    it('sets story title with epic and story number prefix', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 2,
          title: 'Features',
          goal: 'Add features',
          stories: [
            {
              epicNumber: 2,
              storyNumber: "3", storyNumberInt: 3,
              title: 'Implement Feature',
              userStory: { role: 'user', action: 'use feature', benefit: 'happy' },
              acceptanceCriteria: ''
            }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const task = db.select().from(schema.tasks).get()
      expect(task?.title).toBe('2.3: Implement Feature')
    })

    it('sets initial status as backlog', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            {
              epicNumber: 1,
              storyNumber: "1", storyNumberInt: 1,
              title: 'Story',
              userStory: { role: 'u', action: 'a', benefit: 'b' },
              acceptanceCriteria: ''
            }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const task = db.select().from(schema.tasks).get()
      expect(task?.status).toBe('backlog')
    })

    it('sets sort_order based on epic and story number', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic 1',
          goal: '',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'S 1.1', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'S 1.2', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        },
        {
          epicNumber: 2,
          title: 'Epic 2',
          goal: '',
          stories: [
            { epicNumber: 2, storyNumber: "1", storyNumberInt: 1, title: 'S 2.1', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const tasks = db.select().from(schema.tasks).orderBy(schema.tasks.sort_order).all()
      // Verify sort order increases (exact values may vary, but order should be maintained)
      expect(tasks[0].sort_order).toBeLessThan(tasks[1].sort_order)
      expect(tasks[1].sort_order).toBeLessThan(tasks[2].sort_order)
    })
  })

  // Story 3.7 AC 7: Re-import is safe - existing stories updated rather than duplicated
  describe('re-import duplicate detection', () => {
    it('updates existing epic instead of creating duplicate', async () => {
      const initialEpics: ParsedEpic[] = [
        { epicNumber: 1, title: 'Original Title', goal: 'Original Goal', stories: [] }
      ]

      const updatedEpics: ParsedEpic[] = [
        { epicNumber: 1, title: 'Updated Title', goal: 'Updated Goal', stories: [] }
      ]

      // First import
      const result1 = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, initialEpics)
      expect(result1.epicsCreated).toBe(1)

      // Re-import with same epic number but updated content
      const result2 = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, updatedEpics)
      expect(result2.epicsUpdated).toBe(1)
      expect(result2.epicsCreated).toBe(0)

      // Should still only have one epic
      const epics = db.select().from(schema.epics).all()
      expect(epics).toHaveLength(1)
      expect(epics[0].title).toBe('Updated Title')
      expect(epics[0].goal).toBe('Updated Goal')
    })

    it('updates existing story instead of creating duplicate', async () => {
      const initialEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Original Story', userStory: { role: 'user', action: 'act', benefit: 'gain' }, acceptanceCriteria: 'Original AC' }
          ]
        }
      ]

      const updatedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Updated Story', userStory: { role: 'admin', action: 'manage', benefit: 'control' }, acceptanceCriteria: 'Updated AC' }
          ]
        }
      ]

      // First import
      const result1 = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, initialEpics)
      expect(result1.storiesCreated).toBe(1)

      // Re-import with same story number but updated content
      const result2 = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, updatedEpics)
      expect(result2.storiesUpdated).toBe(1)
      expect(result2.storiesCreated).toBe(0)

      // Should still only have one story
      const tasks = db.select().from(schema.tasks).all()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('1.1: Updated Story')
      expect(tasks[0].description).toContain('As a admin')
      expect(tasks[0].description).toContain('Updated AC')
    })

    it('preserves story status on re-import', async () => {
      const initialEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // First import
      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, initialEpics)

      // Simulate user moving story to in_progress
      const task = db.select().from(schema.tasks).get()
      db.update(schema.tasks).set({ status: 'in_progress' }).where(eq(schema.tasks.id, task!.id)).run()

      // Re-import with updated title
      const updatedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Updated Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, updatedEpics)

      // Status should be preserved
      const updatedTask = db.select().from(schema.tasks).get()
      expect(updatedTask?.status).toBe('in_progress')
      expect(updatedTask?.title).toBe('1.1: Updated Story')
    })

    it('creates new stories while updating existing ones', async () => {
      const initialEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story 1', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // First import
      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, initialEpics)
      const tasksBefore = db.select().from(schema.tasks).all()
      expect(tasksBefore).toHaveLength(1)

      // Re-import with one existing and one new story
      const updatedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story 1 Updated', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'Story 2 New', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, updatedEpics)

      expect(result.storiesUpdated).toBe(1)
      expect(result.storiesCreated).toBe(1)

      const tasksAfter = db.select().from(schema.tasks).all()
      expect(tasksAfter).toHaveLength(2)
    })

    it('handles re-import with new epic and existing epic', async () => {
      const initialEpics: ParsedEpic[] = [
        { epicNumber: 1, title: 'Epic 1', goal: 'Goal 1', stories: [] }
      ]

      // First import
      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, initialEpics)

      // Re-import with one existing and one new epic
      const updatedEpics: ParsedEpic[] = [
        { epicNumber: 1, title: 'Epic 1 Updated', goal: 'Goal 1 Updated', stories: [] },
        { epicNumber: 2, title: 'Epic 2 New', goal: 'Goal 2', stories: [] }
      ]

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, updatedEpics)

      expect(result.epicsUpdated).toBe(1)
      expect(result.epicsCreated).toBe(1)

      const epics = db.select().from(schema.epics).all()
      expect(epics).toHaveLength(2)
    })
  })

  describe('sprint status mapping', () => {
    describe('generateStoryKey', () => {
      it('generates correct key format', () => {
        const key = StoryImportService.generateStoryKey(3, '7', 'Story Import After Epics Phase')
        expect(key).toBe('3-7-story-import-after-epics-phase')
      })

      it('handles special characters', () => {
        const key = StoryImportService.generateStoryKey(1, '1', "Initialize Project's Core & Setup")
        expect(key).toBe('1-1-initialize-projects-core-setup')
      })

      it('converts slashes to hyphens', () => {
        const key1 = StoryImportService.generateStoryKey(1, '2', 'Configure Tailwind CSS 4 and shadcn/ui')
        expect(key1).toBe('1-2-configure-tailwind-css-4-and-shadcn-ui')

        const key2 = StoryImportService.generateStoryKey(2, '5', 'Add Sprint/Epic/Story Hierarchy')
        expect(key2).toBe('2-5-add-sprint-epic-story-hierarchy')
      })

      it('handles multiple spaces', () => {
        const key = StoryImportService.generateStoryKey(2, '3', 'Add   Extra   Spaces')
        expect(key).toBe('2-3-add-extra-spaces')
      })

      it('handles letter suffix in story number', () => {
        const key = StoryImportService.generateStoryKey(5, '2b', 'Add Create Story Column')
        expect(key).toBe('5-2b-add-create-story-column')
      })

      it('handles sub-story numbers with dots', () => {
        const key = StoryImportService.generateStoryKey(3, '1.5', 'Multi-Project Database Support')
        expect(key).toBe('3-1-5-multi-project-database-support')
      })
    })

    describe('mapSprintStatusToKanban', () => {
      it('maps done to done', () => {
        expect(StoryImportService.mapSprintStatusToKanban('done')).toBe('done')
      })

      it('maps in-progress to in_progress', () => {
        expect(StoryImportService.mapSprintStatusToKanban('in-progress')).toBe('in_progress')
      })

      it('maps review to review', () => {
        expect(StoryImportService.mapSprintStatusToKanban('review')).toBe('review')
      })

      it('maps ready-for-dev to backlog', () => {
        expect(StoryImportService.mapSprintStatusToKanban('ready-for-dev')).toBe('backlog')
      })

      it('maps backlog to backlog', () => {
        expect(StoryImportService.mapSprintStatusToKanban('backlog')).toBe('backlog')
      })

      it('maps deferred to backlog', () => {
        expect(StoryImportService.mapSprintStatusToKanban('deferred')).toBe('backlog')
      })

      it('maps optional to backlog', () => {
        expect(StoryImportService.mapSprintStatusToKanban('optional')).toBe('backlog')
      })

      it('maps undefined to backlog', () => {
        expect(StoryImportService.mapSprintStatusToKanban(undefined)).toBe('backlog')
      })
    })

    describe('importFromParsedEpics with status map', () => {
      it('applies status from status map when creating new stories', async () => {
        const parsedEpics: ParsedEpic[] = [
          {
            epicNumber: 1,
            title: 'Epic',
            goal: 'Goal',
            stories: [
              { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Done Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
              { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'In Progress Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
              { epicNumber: 1, storyNumber: "3", storyNumberInt: 3, title: 'Backlog Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
            ]
          }
        ]

        // Create status map simulating sprint-status.yaml
        const statusMap = new Map([
          ['1-1-done-story', 'done' as const],
          ['1-2-in-progress-story', 'in-progress' as const],
          ['1-3-backlog-story', 'backlog' as const]
        ])

        await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, statusMap)

        const tasks = db.select().from(schema.tasks).orderBy(schema.tasks.story_number).all()
        expect(tasks).toHaveLength(3)
        expect(tasks[0].status).toBe('done')
        expect(tasks[1].status).toBe('in_progress')
        expect(tasks[2].status).toBe('backlog')
      })

      it('defaults to backlog when story not in status map', async () => {
        const parsedEpics: ParsedEpic[] = [
          {
            epicNumber: 1,
            title: 'Epic',
            goal: 'Goal',
            stories: [
              { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Unknown Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
            ]
          }
        ]

        // Empty status map
        const statusMap = new Map()

        await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, statusMap)

        const task = db.select().from(schema.tasks).get()
        expect(task?.status).toBe('backlog')
      })
    })
  })

  // Story 5.2c: story_file_status handling
  describe('story_file_status setting (Story 5.2c)', () => {
    it('sets story_file_status to summary_only when creating new story', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Test Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      const task = db.select().from(schema.tasks).get()
      expect(task?.story_file_status).toBe('summary_only')
    })

    it('sets story_file_status to story_ready when detailed story file exists', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Test Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/to/1-1-story.md', fullContent: '# Story content' }]
      ])

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)

      const task = db.select().from(schema.tasks).get()
      expect(task?.story_file_status).toBe('story_ready')
    })

    it('updates story_file_status on re-import based on detailed story existence', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Test Story', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // First import - no detailed story, should be summary_only
      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)
      let task = db.select().from(schema.tasks).get()
      expect(task?.story_file_status).toBe('summary_only')

      // Re-import WITH detailed story - should update to story_ready
      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/to/1-1-story.md', fullContent: '# Story content' }]
      ])

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)

      // story_file_status should be updated to story_ready
      task = db.select().from(schema.tasks).get()
      expect(task?.story_file_status).toBe('story_ready')
      expect(task?.story_file_path).toBe('/path/to/1-1-story.md')
    })
  })

  describe('detailed story import', () => {
    it('stores story_file_path and full_content from detailed stories map', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story One', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/to/1-1-story-one.md', fullContent: '# Story 1.1: Story One\n\nFull detailed content here.' }]
      ])

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)

      const task = db.select().from(schema.tasks).get()
      expect(task?.story_file_path).toBe('/path/to/1-1-story-one.md')
      expect(task?.full_content).toBe('# Story 1.1: Story One\n\nFull detailed content here.')
    })

    it('sets null for stories without detailed content', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story One', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'Story Two', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // Only provide detailed content for story 1-1
      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/to/1-1.md', fullContent: 'Detailed content' }]
      ])

      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)

      const tasks = db.select().from(schema.tasks).orderBy(schema.tasks.story_number).all()
      expect(tasks).toHaveLength(2)

      expect(tasks[0].story_file_path).toBe('/path/to/1-1.md')
      expect(tasks[0].full_content).toBe('Detailed content')

      expect(tasks[1].story_file_path).toBeNull()
      expect(tasks[1].full_content).toBeNull()
    })

    it('counts detailedStoriesImported correctly', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story One', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "2", storyNumberInt: 2, title: 'Story Two', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' },
            { epicNumber: 1, storyNumber: "3", storyNumberInt: 3, title: 'Story Three', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // Only provide detailed content for 2 of 3 stories
      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/1-1.md', fullContent: 'Content 1' }],
        ['1-3' as StoryKey, { filePath: '/path/1-3.md', fullContent: 'Content 3' }]
      ])

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)

      expect(result.detailedStoriesImported).toBe(2)
      expect(result.storiesCreated).toBe(3)
    })

    it('updates detailed content on re-import', async () => {
      const parsedEpics: ParsedEpic[] = [
        {
          epicNumber: 1,
          title: 'Epic',
          goal: 'Goal',
          stories: [
            { epicNumber: 1, storyNumber: "1", storyNumberInt: 1, title: 'Story One', userStory: { role: 'u', action: 'a', benefit: 'b' }, acceptanceCriteria: '' }
          ]
        }
      ]

      // First import without detailed content
      await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics)

      let task = db.select().from(schema.tasks).get()
      expect(task?.full_content).toBeNull()

      // Re-import with detailed content
      const detailedStoriesMap = new Map<StoryKey, { filePath: string; fullContent: string }>([
        ['1-1' as StoryKey, { filePath: '/path/1-1.md', fullContent: 'New detailed content' }]
      ])

      const result = await StoryImportService.importFromParsedEpics(db, TEST_PROJECT_ID, parsedEpics, undefined, detailedStoriesMap)
      expect(result.storiesUpdated).toBe(1)
      expect(result.detailedStoriesImported).toBe(1)

      task = db.select().from(schema.tasks).get()
      expect(task?.story_file_path).toBe('/path/1-1.md')
      expect(task?.full_content).toBe('New detailed content')
    })
  })
})
