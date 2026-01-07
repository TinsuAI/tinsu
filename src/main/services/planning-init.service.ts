// Planning Task Initialization Service (Story 3.2 - Task 3)
// Creates the 5 BMAD planning phase tasks when a project is initialized

import { randomUUID } from 'crypto'
import { db } from '../db'
import { tasks, Task } from '../db/schema'
import { BMAD_PLANNING_PHASES, PHASE_NUMBERS } from '../db/planning-phases'
import { ArtifactDetectorService } from './artifact-detector.service'

export class PlanningInitService {
  /**
   * Initializes the 5 BMAD planning phase tasks for a project.
   *
   * For each phase (1-5):
   * - Creates a task with task_type: 'planning'
   * - Sets phase_number, phase_name, bmad_agent, bmad_workflow from BMAD_PLANNING_PHASES
   * - Sets status based on whether artifact exists ('done' if exists, 'backlog' if not)
   * - Sets sort_order sequentially (0, 1, 2, 3, 4) for proper ordering
   * - Story 3.1.5: Sets project_id from the provided projectId parameter
   *
   * @param projectPath - Root path of the project to initialize
   * @param projectId - ID of the project to associate tasks with (Story 3.1.5)
   * @returns Array of created planning tasks in phase order
   */
  static async initializePlanningTasks(projectPath: string, projectId: string): Promise<Task[]> {
    const existingArtifacts = ArtifactDetectorService.detectExistingArtifacts(projectPath)
    const createdTasks: Task[] = []

    for (const phaseNum of PHASE_NUMBERS) {
      const phase = BMAD_PLANNING_PHASES[phaseNum]
      const hasArtifact = existingArtifacts.has(phaseNum)
      const now = new Date()

      const task = db
        .insert(tasks)
        .values({
          id: randomUUID(),
          title: phase.name,
          description: `BMAD Planning Phase ${phaseNum}: ${phase.name}`,
          task_type: 'planning',
          phase_number: phaseNum,
          phase_name: phase.name,
          bmad_agent: phase.agent,
          bmad_workflow: phase.workflow,
          status: hasArtifact ? 'done' : 'backlog',
          sort_order: phaseNum - 1, // 0-indexed for proper ordering
          is_start_here: phaseNum === 1 ? true : null, // Story 3.2: Only phase 1 is "Start Here"
          project_id: projectId, // Story 3.1.5: Associate with project
          created_at: now,
          updated_at: now
        })
        .returning()
        .get()

      createdTasks.push(task)
    }

    return createdTasks
  }
}
