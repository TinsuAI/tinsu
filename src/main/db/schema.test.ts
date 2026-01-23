import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { BMAD_PLANNING_PHASES, isValidPhaseNumber, getPhaseConfig } from './planning-phases'

type TestDb = BetterSQLite3Database<typeof schema>

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the projects table first (Story 3.1.5)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
    CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at);
  `)

  // Create the agent_runs table (required for task foreign key)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_ms INTEGER,
      token_usage INTEGER,
      exit_status TEXT,
      log_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_task_id ON agent_runs(task_id);
  `)

  // Create the tasks table matching Drizzle schema (including all columns through Story 7.7)
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
      context_notes TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      worktree_path TEXT,
      branch_name TEXT,
      merge_commit_sha TEXT,
      has_merge_conflict INTEGER DEFAULT 0,
      conflict_files TEXT,
      worktree_skipped INTEGER DEFAULT 0,
      rejection_feedback TEXT,
      rejected_agent_run_id TEXT REFERENCES agent_runs(id),
      inline_comments TEXT,
      rejection_count INTEGER DEFAULT 0,
      last_review_commit TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  `)

  // Story 3.10: Create task_artifacts table for artifact linking
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      artifact_type TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      section_ref TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
  `)

  // TES-2.1: Create task_activities table for event/activity logging
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_activities_event_type ON task_activities(event_type);
    CREATE INDEX IF NOT EXISTS idx_task_activities_created_at ON task_activities(created_at);
    CREATE INDEX IF NOT EXISTS idx_task_activities_task_id_created_at ON task_activities(task_id, created_at);
  `)

  // Story 7.7: Create task_versions table for review history tracking
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_versions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      commit_sha TEXT,
      rejection_feedback TEXT,
      inline_comments TEXT,
      status_outcome TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_task_versions_task_id ON task_versions(task_id);
  `)

  return drizzle({ client: sqlite, schema })
}

describe('Task Schema (Story 3.1)', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  describe('task_type field (AC: 1)', () => {
    it('defaults new tasks to story type', () => {
      // Insert task without specifying task_type
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'task-1')).get()
      expect(task?.task_type).toBe('story')
    })

    it('allows creating planning tasks', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-planning',
          title: 'Product Brief',
          task_type: 'planning',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'task-planning')).get()
      expect(task?.task_type).toBe('planning')
    })

    it('existing tasks default to story type (backward compatibility)', () => {
      // This test verifies the DEFAULT behavior
      const task = db
        .insert(schema.tasks)
        .values({
          id: 'existing-task',
          title: 'Existing Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning()
        .get()

      expect(task.task_type).toBe('story')
    })
  })

  describe('planning-specific fields (AC: 2)', () => {
    it('allows creating planning task with all phase fields', () => {
      const phaseConfig = BMAD_PLANNING_PHASES[1]

      db.insert(schema.tasks)
        .values({
          id: 'planning-task-1',
          title: 'Product Brief',
          task_type: 'planning',
          phase_number: 1,
          phase_name: phaseConfig.name,
          bmad_agent: phaseConfig.agent,
          bmad_workflow: phaseConfig.workflow,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const task = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, 'planning-task-1'))
        .get()

      expect(task?.task_type).toBe('planning')
      expect(task?.phase_number).toBe(1)
      expect(task?.phase_name).toBe('Product Brief')
      expect(task?.bmad_agent).toBe('bmad:bmm:agents:pm')
      expect(task?.bmad_workflow).toBe(
        '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
      )
    })

    it('has null phase fields for story tasks', () => {
      db.insert(schema.tasks)
        .values({
          id: 'story-task',
          title: 'Story Task',
          task_type: 'story',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'story-task')).get()

      expect(task?.task_type).toBe('story')
      expect(task?.phase_number).toBeNull()
      expect(task?.phase_name).toBeNull()
      expect(task?.bmad_agent).toBeNull()
      expect(task?.bmad_workflow).toBeNull()
    })

    it('can query planning tasks with their phase information', () => {
      // Create a planning task with full phase info
      const phase = BMAD_PLANNING_PHASES[3]
      db.insert(schema.tasks)
        .values({
          id: 'arch-task',
          title: 'Architecture',
          task_type: 'planning',
          phase_number: 3,
          phase_name: phase.name,
          bmad_agent: phase.agent,
          bmad_workflow: phase.workflow,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'arch-task')).get()

      expect(task?.phase_number).toBe(3)
      expect(task?.phase_name).toBe('Architecture')
      expect(task?.bmad_agent).toBe('bmad:bmm:agents:architect')
    })
  })

  describe('querying by task_type', () => {
    beforeEach(() => {
      // Create mixed tasks
      db.insert(schema.tasks)
        .values([
          {
            id: 'story-1',
            title: 'Story 1',
            task_type: 'story',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'story-2',
            title: 'Story 2',
            task_type: 'story',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'planning-1',
            title: 'Planning 1',
            task_type: 'planning',
            phase_number: 1,
            phase_name: 'Product Brief',
            bmad_agent: 'bmad:bmm:agents:pm',
            bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml',
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 'planning-2',
            title: 'Planning 2',
            task_type: 'planning',
            phase_number: 2,
            phase_name: 'PRD',
            bmad_agent: 'bmad:bmm:agents:pm',
            bmad_workflow: '_bmad/bmm/workflows/2-discovery/create-prd/workflow.yaml',
            created_at: new Date(),
            updated_at: new Date()
          }
        ])
        .run()
    })

    it('filters planning tasks only', () => {
      const planningTasks = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.task_type, 'planning'))
        .all()

      expect(planningTasks).toHaveLength(2)
      expect(planningTasks.every((t) => t.task_type === 'planning')).toBe(true)
    })

    it('filters story tasks only', () => {
      const storyTasks = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.task_type, 'story'))
        .all()

      expect(storyTasks).toHaveLength(2)
      expect(storyTasks.every((t) => t.task_type === 'story')).toBe(true)
    })
  })

  describe('data preservation on migration (AC: 4)', () => {
    it('preserves existing task data with default task_type', () => {
      // Simulate existing task (without task_type specified)
      const task = db
        .insert(schema.tasks)
        .values({
          id: 'existing-task',
          title: 'Existing Task',
          description: 'A description',
          status: 'in_progress',
          epic_id: 'epic-1',
          sprint_id: 'sprint-1',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning()
        .get()

      // Verify all existing fields are preserved
      expect(task.title).toBe('Existing Task')
      expect(task.description).toBe('A description')
      expect(task.status).toBe('in_progress')
      expect(task.epic_id).toBe('epic-1')
      expect(task.sprint_id).toBe('sprint-1')
      // And new fields default correctly
      expect(task.task_type).toBe('story')
      expect(task.phase_number).toBeNull()
    })
  })
})

describe('Story 5.2b: story_file_status field', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  it('allows creating task with story_file_status', () => {
    db.insert(schema.tasks)
      .values({
        id: 'task-with-status',
        title: 'Task with Story File Status',
        status: 'create_story',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'task-with-status')).get()
    expect(task?.status).toBe('create_story')
    expect(task?.story_file_status).toBeNull()
  })

  it('allows setting story_file_status to summary_only', () => {
    db.insert(schema.tasks)
      .values({
        id: 'summary-task',
        title: 'Summary Only Task',
        status: 'create_story',
        story_file_status: 'summary_only',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'summary-task')).get()
    expect(task?.story_file_status).toBe('summary_only')
  })

  it('allows setting story_file_status to story_ready', () => {
    db.insert(schema.tasks)
      .values({
        id: 'ready-task',
        title: 'Story Ready Task',
        status: 'in_progress',
        story_file_status: 'story_ready',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'ready-task')).get()
    expect(task?.story_file_status).toBe('story_ready')
  })

  it('allows create_story as a valid status', () => {
    db.insert(schema.tasks)
      .values({
        id: 'create-story-task',
        title: 'Create Story Task',
        status: 'create_story',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, 'create-story-task')).get()
    expect(task?.status).toBe('create_story')
  })
})

describe('BMAD Planning Phases (AC: 3)', () => {
  it('defines all 5 phases correctly', () => {
    expect(Object.keys(BMAD_PLANNING_PHASES)).toHaveLength(5)

    expect(BMAD_PLANNING_PHASES[1].name).toBe('Product Brief')
    expect(BMAD_PLANNING_PHASES[2].name).toBe('PRD')
    expect(BMAD_PLANNING_PHASES[3].name).toBe('Architecture')
    expect(BMAD_PLANNING_PHASES[4].name).toBe('UX Design')
    expect(BMAD_PLANNING_PHASES[5].name).toBe('Epics & Stories')
  })

  it('maps each phase to specific BMAD agent', () => {
    expect(BMAD_PLANNING_PHASES[1].agent).toBe('bmad:bmm:agents:pm')
    expect(BMAD_PLANNING_PHASES[2].agent).toBe('bmad:bmm:agents:pm')
    expect(BMAD_PLANNING_PHASES[3].agent).toBe('bmad:bmm:agents:architect')
    expect(BMAD_PLANNING_PHASES[4].agent).toBe('bmad:bmm:agents:ux-designer')
    expect(BMAD_PLANNING_PHASES[5].agent).toBe('bmad:bmm:agents:pm')
  })

  it('maps each phase to specific workflow path', () => {
    expect(BMAD_PLANNING_PHASES[1].workflow).toContain('create-product-brief')
    expect(BMAD_PLANNING_PHASES[2].workflow).toContain('create-prd')
    expect(BMAD_PLANNING_PHASES[3].workflow).toContain('create-architecture')
    expect(BMAD_PLANNING_PHASES[4].workflow).toContain('create-ux-design')
    expect(BMAD_PLANNING_PHASES[5].workflow).toContain('create-epics-and-stories')
  })

  describe('isValidPhaseNumber helper', () => {
    it('returns true for valid phase numbers 1-5', () => {
      expect(isValidPhaseNumber(1)).toBe(true)
      expect(isValidPhaseNumber(2)).toBe(true)
      expect(isValidPhaseNumber(3)).toBe(true)
      expect(isValidPhaseNumber(4)).toBe(true)
      expect(isValidPhaseNumber(5)).toBe(true)
    })

    it('returns false for invalid phase numbers', () => {
      expect(isValidPhaseNumber(0)).toBe(false)
      expect(isValidPhaseNumber(6)).toBe(false)
      expect(isValidPhaseNumber(-1)).toBe(false)
      expect(isValidPhaseNumber(1.5)).toBe(false)
    })
  })

  describe('getPhaseConfig helper', () => {
    it('returns correct phase config for each phase', () => {
      expect(getPhaseConfig(1).name).toBe('Product Brief')
      expect(getPhaseConfig(3).agent).toBe('bmad:bmm:agents:architect')
      expect(getPhaseConfig(5).workflow).toContain('create-epics-and-stories')
    })
  })
})

// TES-2.1: Task Activities Schema Tests
describe('Task Activities Schema (TES-2.1)', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  describe('table creation (AC: #1)', () => {
    it('creates task_activities table with correct columns', () => {
      // Insert a task first (required for foreign key)
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Insert an activity
      const now = Math.floor(Date.now() / 1000)
      db.insert(schema.taskActivities)
        .values({
          id: 'activity-1',
          task_id: 'task-1',
          event_type: 'status_change',
          payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
          created_at: now
        })
        .run()

      const activity = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.id, 'activity-1'))
        .get()

      expect(activity).toBeDefined()
      expect(activity?.id).toBe('activity-1')
      expect(activity?.task_id).toBe('task-1')
      expect(activity?.event_type).toBe('status_change')
      expect(activity?.payload).toBe('{"from":"backlog","to":"in_progress"}')
      expect(activity?.created_at).toBe(now)
    })

    it('allows null payload', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.taskActivities)
        .values({
          id: 'activity-1',
          task_id: 'task-1',
          event_type: 'session_ended',
          payload: null,
          created_at: Math.floor(Date.now() / 1000)
        })
        .run()

      const activity = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.id, 'activity-1'))
        .get()

      expect(activity?.payload).toBeNull()
    })

    it('supports all expected event types', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const eventTypes = [
        'status_change',
        'agent_start',
        'agent_complete',
        'tool_used',
        'user_command',
        'automation_trigger',
        'error',
        'session_ended',
        'stall_detected',
        'stall_recovered'
      ]

      const now = Math.floor(Date.now() / 1000)
      eventTypes.forEach((eventType, idx) => {
        db.insert(schema.taskActivities)
          .values({
            id: `activity-${idx}`,
            task_id: 'task-1',
            event_type: eventType,
            created_at: now + idx
          })
          .run()
      })

      const activities = db.select().from(schema.taskActivities).all()
      expect(activities).toHaveLength(eventTypes.length)
      expect(activities.map((a) => a.event_type).sort()).toEqual(eventTypes.sort())
    })
  })

  describe('cascade delete behavior (AC: #2)', () => {
    it('deletes activities when task is deleted', () => {
      // Create task with activities
      db.insert(schema.tasks)
        .values({
          id: 'task-to-delete',
          title: 'Task to Delete',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const now = Math.floor(Date.now() / 1000)
      db.insert(schema.taskActivities)
        .values([
          {
            id: 'activity-1',
            task_id: 'task-to-delete',
            event_type: 'status_change',
            created_at: now
          },
          {
            id: 'activity-2',
            task_id: 'task-to-delete',
            event_type: 'agent_start',
            created_at: now + 1
          },
          {
            id: 'activity-3',
            task_id: 'task-to-delete',
            event_type: 'agent_complete',
            created_at: now + 2
          }
        ])
        .run()

      // Verify activities exist
      let activities = db.select().from(schema.taskActivities).all()
      expect(activities).toHaveLength(3)

      // Delete the task
      db.delete(schema.tasks).where(eq(schema.tasks.id, 'task-to-delete')).run()

      // Verify activities are deleted (cascade)
      activities = db.select().from(schema.taskActivities).all()
      expect(activities).toHaveLength(0)
    })

    it('does not error when deleting task without activities', () => {
      // Create task without activities
      db.insert(schema.tasks)
        .values({
          id: 'task-no-activities',
          title: 'Task without Activities',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Delete should not error
      expect(() => {
        db.delete(schema.tasks).where(eq(schema.tasks.id, 'task-no-activities')).run()
      }).not.toThrow()

      // Verify task is deleted
      const task = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, 'task-no-activities'))
        .get()
      expect(task).toBeUndefined()
    })

    it('only deletes activities for the deleted task', () => {
      // Create two tasks with activities
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const now = Math.floor(Date.now() / 1000)
      db.insert(schema.taskActivities)
        .values([
          { id: 'activity-1-1', task_id: 'task-1', event_type: 'status_change', created_at: now },
          { id: 'activity-1-2', task_id: 'task-1', event_type: 'agent_start', created_at: now + 1 },
          { id: 'activity-2-1', task_id: 'task-2', event_type: 'status_change', created_at: now },
          { id: 'activity-2-2', task_id: 'task-2', event_type: 'agent_start', created_at: now + 1 }
        ])
        .run()

      // Delete only task-1
      db.delete(schema.tasks).where(eq(schema.tasks.id, 'task-1')).run()

      // Verify only task-2's activities remain
      const activities = db.select().from(schema.taskActivities).all()
      expect(activities).toHaveLength(2)
      expect(activities.every((a) => a.task_id === 'task-2')).toBe(true)
    })
  })

  describe('index usage for fast queries (AC: #1)', () => {
    it('can query activities by task_id efficiently', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const now = Math.floor(Date.now() / 1000)
      for (let i = 0; i < 10; i++) {
        db.insert(schema.taskActivities)
          .values({
            id: `activity-${i}`,
            task_id: 'task-1',
            event_type: i % 2 === 0 ? 'status_change' : 'agent_start',
            created_at: now + i
          })
          .run()
      }

      // Query by task_id (uses idx_task_activities_task_id)
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, 'task-1'))
        .all()

      expect(activities).toHaveLength(10)
    })

    it('can query activities by event_type', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const now = Math.floor(Date.now() / 1000)
      db.insert(schema.taskActivities)
        .values([
          { id: 'a1', task_id: 'task-1', event_type: 'status_change', created_at: now },
          { id: 'a2', task_id: 'task-1', event_type: 'status_change', created_at: now + 1 },
          { id: 'a3', task_id: 'task-1', event_type: 'agent_start', created_at: now + 2 },
          { id: 'a4', task_id: 'task-1', event_type: 'error', created_at: now + 3 }
        ])
        .run()

      // Query by event_type (uses idx_task_activities_event_type)
      const statusChanges = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.event_type, 'status_change'))
        .all()

      expect(statusChanges).toHaveLength(2)
    })
  })

  describe('type exports', () => {
    it('exports TaskActivity type', () => {
      // This test verifies TypeScript compilation - if types aren't exported correctly, it won't compile
      const activity: schema.TaskActivity = {
        id: 'test',
        task_id: 'task-1',
        event_type: 'status_change',
        payload: null,
        created_at: 123456789
      }
      expect(activity.id).toBe('test')
    })

    it('exports NewTaskActivity type', () => {
      // NewTaskActivity is for insert operations
      const newActivity: schema.NewTaskActivity = {
        id: 'test',
        task_id: 'task-1',
        event_type: 'agent_complete',
        created_at: 123456789
      }
      expect(newActivity.event_type).toBe('agent_complete')
    })

    it('exports ACTIVITY_EVENT_TYPE enum', () => {
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('status_change')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('agent_start')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('agent_complete')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('tool_used')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('user_command')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('automation_trigger')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('error')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('session_ended')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('stall_detected')
      expect(schema.ACTIVITY_EVENT_TYPE).toContain('stall_recovered')
    })
  })
})

// Story 7.7: Task Versions Schema Tests
describe('Task Versions Schema (Story 7.7)', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  describe('table creation (AC: 1, 3, 4)', () => {
    it('creates task_versions table with correct columns', () => {
      // Insert a task first (required for foreign key)
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Insert a version
      db.insert(schema.taskVersions)
        .values({
          id: 'version-1',
          task_id: 'task-1',
          version_number: 1,
          commit_sha: 'abc123def456',
          status_outcome: 'pending',
          created_at: new Date()
        })
        .run()

      const version = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.id, 'version-1'))
        .get()

      expect(version).toBeDefined()
      expect(version?.id).toBe('version-1')
      expect(version?.task_id).toBe('task-1')
      expect(version?.version_number).toBe(1)
      expect(version?.commit_sha).toBe('abc123def456')
      expect(version?.status_outcome).toBe('pending')
    })

    it('allows null commit_sha for worktrees that may be cleaned up', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.taskVersions)
        .values({
          id: 'version-1',
          task_id: 'task-1',
          version_number: 1,
          commit_sha: null,
          status_outcome: 'pending',
          created_at: new Date()
        })
        .run()

      const version = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.id, 'version-1'))
        .get()

      expect(version?.commit_sha).toBeNull()
    })

    it('supports all status_outcome values', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const outcomes = ['pending', 'rejected', 'changes_requested', 'approved']

      outcomes.forEach((outcome, idx) => {
        db.insert(schema.taskVersions)
          .values({
            id: `version-${idx}`,
            task_id: 'task-1',
            version_number: idx + 1,
            status_outcome: outcome,
            created_at: new Date()
          })
          .run()
      })

      const versions = db.select().from(schema.taskVersions).all()
      expect(versions).toHaveLength(4)
      expect(versions.map((v) => v.status_outcome).sort()).toEqual(outcomes.sort())
    })

    it('defaults status_outcome to pending', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.taskVersions)
        .values({
          id: 'version-1',
          task_id: 'task-1',
          version_number: 1,
          created_at: new Date()
        })
        .run()

      const version = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.id, 'version-1'))
        .get()

      expect(version?.status_outcome).toBe('pending')
    })
  })

  describe('rejection feedback storage (AC: 3, 4)', () => {
    it('stores rejection feedback for rejected versions', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.taskVersions)
        .values({
          id: 'version-1',
          task_id: 'task-1',
          version_number: 1,
          rejection_feedback: 'Missing error handling in auth module',
          status_outcome: 'rejected',
          created_at: new Date()
        })
        .run()

      const version = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.id, 'version-1'))
        .get()

      expect(version?.rejection_feedback).toBe('Missing error handling in auth module')
      expect(version?.status_outcome).toBe('rejected')
    })

    it('stores inline comments as JSON for changes_requested versions', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const inlineComments = JSON.stringify([
        { id: 'c1', filePath: 'src/auth.ts', lineNumber: 42, content: 'Add null check' },
        { id: 'c2', filePath: 'src/db.ts', lineNumber: 15, content: 'Use parameterized query' }
      ])

      db.insert(schema.taskVersions)
        .values({
          id: 'version-1',
          task_id: 'task-1',
          version_number: 1,
          inline_comments: inlineComments,
          status_outcome: 'changes_requested',
          created_at: new Date()
        })
        .run()

      const version = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.id, 'version-1'))
        .get()

      expect(version?.inline_comments).toBe(inlineComments)
      const comments = JSON.parse(version?.inline_comments || '[]')
      expect(comments).toHaveLength(2)
      expect(comments[0].filePath).toBe('src/auth.ts')
    })
  })

  describe('cascade delete behavior', () => {
    it('deletes versions when task is deleted', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-to-delete',
          title: 'Task to Delete',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.taskVersions)
        .values([
          { id: 'v1', task_id: 'task-to-delete', version_number: 1, created_at: new Date() },
          { id: 'v2', task_id: 'task-to-delete', version_number: 2, created_at: new Date() },
          { id: 'v3', task_id: 'task-to-delete', version_number: 3, created_at: new Date() }
        ])
        .run()

      // Verify versions exist
      let versions = db.select().from(schema.taskVersions).all()
      expect(versions).toHaveLength(3)

      // Delete the task
      db.delete(schema.tasks).where(eq(schema.tasks.id, 'task-to-delete')).run()

      // Verify versions are deleted (cascade)
      versions = db.select().from(schema.taskVersions).all()
      expect(versions).toHaveLength(0)
    })

    it('only deletes versions for the deleted task', () => {
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      db.insert(schema.taskVersions)
        .values([
          { id: 'v1-1', task_id: 'task-1', version_number: 1, created_at: new Date() },
          { id: 'v1-2', task_id: 'task-1', version_number: 2, created_at: new Date() },
          { id: 'v2-1', task_id: 'task-2', version_number: 1, created_at: new Date() }
        ])
        .run()

      // Delete only task-1
      db.delete(schema.tasks).where(eq(schema.tasks.id, 'task-1')).run()

      // Verify only task-2's versions remain
      const versions = db.select().from(schema.taskVersions).all()
      expect(versions).toHaveLength(1)
      expect(versions[0].task_id).toBe('task-2')
    })
  })

  describe('version numbering (AC: 1)', () => {
    it('supports auto-incrementing version numbers across rejections', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Simulate rejection cycle: v1 rejected -> v2 changes_requested -> v3 approved
      db.insert(schema.taskVersions)
        .values([
          {
            id: 'v1',
            task_id: 'task-1',
            version_number: 1,
            commit_sha: 'sha-1',
            rejection_feedback: 'Missing tests',
            status_outcome: 'rejected',
            created_at: new Date()
          },
          {
            id: 'v2',
            task_id: 'task-1',
            version_number: 2,
            commit_sha: 'sha-2',
            inline_comments: '[]',
            status_outcome: 'changes_requested',
            created_at: new Date()
          },
          {
            id: 'v3',
            task_id: 'task-1',
            version_number: 3,
            commit_sha: 'sha-3',
            status_outcome: 'approved',
            created_at: new Date()
          }
        ])
        .run()

      const versions = db
        .select()
        .from(schema.taskVersions)
        .where(eq(schema.taskVersions.task_id, 'task-1'))
        .orderBy(schema.taskVersions.version_number)
        .all()

      expect(versions).toHaveLength(3)
      expect(versions[0].version_number).toBe(1)
      expect(versions[0].status_outcome).toBe('rejected')
      expect(versions[1].version_number).toBe(2)
      expect(versions[1].status_outcome).toBe('changes_requested')
      expect(versions[2].version_number).toBe(3)
      expect(versions[2].status_outcome).toBe('approved')
    })
  })

  describe('type exports', () => {
    it('exports TaskVersion type', () => {
      const version: schema.TaskVersion = {
        id: 'test',
        task_id: 'task-1',
        version_number: 1,
        commit_sha: 'abc123',
        rejection_feedback: null,
        inline_comments: null,
        status_outcome: 'pending',
        created_at: new Date()
      }
      expect(version.id).toBe('test')
    })

    it('exports NewTaskVersion type', () => {
      const newVersion: schema.NewTaskVersion = {
        id: 'test',
        task_id: 'task-1',
        version_number: 1
      }
      expect(newVersion.version_number).toBe(1)
    })

    it('exports VERSION_STATUS_OUTCOME enum', () => {
      expect(schema.VERSION_STATUS_OUTCOME).toContain('pending')
      expect(schema.VERSION_STATUS_OUTCOME).toContain('rejected')
      expect(schema.VERSION_STATUS_OUTCOME).toContain('changes_requested')
      expect(schema.VERSION_STATUS_OUTCOME).toContain('approved')
    })
  })
})
