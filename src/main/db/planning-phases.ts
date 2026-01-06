// BMAD Planning Phases Configuration (Story 3.1 - AC3)
// Maps phase numbers (1-5) to their names, agents, and workflow paths

export const BMAD_PLANNING_PHASES = {
  1: {
    name: 'Product Brief',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
  },
  2: {
    name: 'PRD',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/2-discovery/create-prd/workflow.yaml'
  },
  3: {
    name: 'Architecture',
    agent: 'bmad:bmm:agents:architect',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
  },
  4: {
    name: 'UX Design',
    agent: 'bmad:bmm:agents:ux-designer',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-ux-design/workflow.yaml'
  },
  5: {
    name: 'Epics & Stories',
    agent: 'bmad:bmm:agents:pm',
    workflow: '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.yaml'
  }
} as const

// Type-safe phase number type
export type PhaseNumber = keyof typeof BMAD_PLANNING_PHASES

// Type for a single planning phase configuration
export type PlanningPhase = (typeof BMAD_PLANNING_PHASES)[PhaseNumber]

// Helper to validate phase number
export function isValidPhaseNumber(num: number): num is PhaseNumber {
  return num >= 1 && num <= 5 && Number.isInteger(num)
}

// Helper to get phase by number with type safety
export function getPhaseConfig(phaseNumber: PhaseNumber): PlanningPhase {
  return BMAD_PLANNING_PHASES[phaseNumber]
}

// Array of phase numbers for iteration
export const PHASE_NUMBERS = [1, 2, 3, 4, 5] as const
