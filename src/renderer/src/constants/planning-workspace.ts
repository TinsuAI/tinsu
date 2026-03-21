import type { PlanningPhase } from '@renderer/stores/planning-workspace.store'

/**
 * BMAD Planning Workspace constants.
 *
 * Story 9.1: Planning Workspace Route & Navigation
 */

export interface BmadPhaseDefinition {
  key: PlanningPhase
  label: string
  description: string
}

export const BMAD_PHASES: BmadPhaseDefinition[] = [
  {
    key: 'analysis',
    label: 'Analysis',
    description: 'Research and define your product vision'
  },
  {
    key: 'planning',
    label: 'Planning',
    description: 'Document requirements and design UX'
  },
  {
    key: 'solutioning',
    label: 'Solutioning',
    description: 'Design architecture and break down work'
  }
]

export interface BmadWorkflowDefinition {
  key: string
  phase: PlanningPhase
  name: string
  purpose: string
  outputFilename: string
}

export const BMAD_WORKFLOWS: BmadWorkflowDefinition[] = [
  // Analysis phase
  {
    key: 'brainstorming',
    phase: 'analysis',
    name: 'Brainstorming',
    purpose: 'Explore ideas and define product direction',
    outputFilename: 'product-brief.md'
  },
  {
    key: 'product-brief',
    phase: 'analysis',
    name: 'Product Brief',
    purpose: 'Define product vision and target users',
    outputFilename: 'product-brief.md'
  },
  {
    key: 'market-research',
    phase: 'analysis',
    name: 'Market Research',
    purpose: 'Analyze competition and market landscape',
    outputFilename: 'market-research.md'
  },
  {
    key: 'domain-research',
    phase: 'analysis',
    name: 'Domain Research',
    purpose: 'Deep dive into domain-specific knowledge',
    outputFilename: 'domain-research.md'
  },

  // Planning phase
  {
    key: 'prd',
    phase: 'planning',
    name: 'Create PRD',
    purpose: 'Document detailed requirements and features',
    outputFilename: 'prd.md'
  },
  {
    key: 'ux-design',
    phase: 'planning',
    name: 'UX Design',
    purpose: 'Plan user experience and interface patterns',
    outputFilename: 'ux-design-specification.md'
  },

  // Solutioning phase
  {
    key: 'architecture',
    phase: 'solutioning',
    name: 'Architecture',
    purpose: 'Design technical architecture and stack decisions',
    outputFilename: 'architecture.md'
  },
  {
    key: 'epics-stories',
    phase: 'solutioning',
    name: 'Epics & Stories',
    purpose: 'Break down work into implementable stories',
    outputFilename: 'epics.md'
  },
  {
    key: 'readiness-check',
    phase: 'solutioning',
    name: 'Implementation Readiness',
    purpose: 'Validate specs are complete before development',
    outputFilename: 'readiness-check.md'
  }
]

/**
 * Get workflows for a specific phase.
 */
export function getWorkflowsForPhase(phase: PlanningPhase): BmadWorkflowDefinition[] {
  return BMAD_WORKFLOWS.filter((w) => w.phase === phase)
}

/**
 * Map planning task phase_number to BMAD phase.
 * Phase 1 → analysis, Phase 2 → planning, Phase 3 → solutioning,
 * Phase 4 → planning, Phase 5 → solutioning
 */
export function phaseNumberToBmadPhase(phaseNumber: number): PlanningPhase {
  switch (phaseNumber) {
    case 1:
      return 'analysis'
    case 2:
    case 4:
      return 'planning'
    case 3:
    case 5:
      return 'solutioning'
    default:
      return 'analysis'
  }
}
