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
  command: string
  /** Default agent persona for this workflow */
  persona: string
  /** Global step number across all phases for ordered display */
  stepNumber: number
}

export const BMAD_WORKFLOWS: BmadWorkflowDefinition[] = [
  // Analysis phase (canonical BMAD sequence)
  {
    key: 'brainstorming',
    phase: 'analysis',
    name: 'Brainstorming',
    purpose: 'Explore ideas and define product direction',
    outputFilename: 'brainstorming/brainstorming-session-*.md',
    command: '/bmad-brainstorming',
    persona: 'bmad:bmm:agents:analyst',
    stepNumber: 1
  },
  {
    key: 'market-research',
    phase: 'analysis',
    name: 'Market Research',
    purpose: 'Analyze competition and market landscape',
    outputFilename: 'research/market-*-research-*.md',
    command: '/bmad-market-research',
    persona: 'bmad:bmm:agents:analyst',
    stepNumber: 2
  },
  {
    key: 'domain-research',
    phase: 'analysis',
    name: 'Domain Research',
    purpose: 'Deep dive into domain-specific knowledge',
    outputFilename: 'research/domain-*-research-*.md',
    command: '/bmad-domain-research',
    persona: 'bmad:bmm:agents:analyst',
    stepNumber: 3
  },
  {
    key: 'product-brief',
    phase: 'analysis',
    name: 'Product Brief',
    purpose: 'Define product vision and target users',
    outputFilename: 'product-brief-*.md',
    command: '/bmad-create-product-brief',
    persona: 'bmad:bmm:agents:analyst',
    stepNumber: 4
  },

  // Planning phase
  {
    key: 'prd',
    phase: 'planning',
    name: 'Create PRD',
    purpose: 'Document detailed requirements and features',
    outputFilename: 'prd.md',
    command: '/bmad-create-prd',
    persona: 'bmad:bmm:agents:pm',
    stepNumber: 5
  },
  {
    key: 'growth-review',
    phase: 'planning',
    name: 'Growth Review',
    purpose: 'Evaluate PRD for organic growth potential before architecture',
    outputFilename: 'growth-hacking-review.md',
    command: '/bmad-growth-review',
    persona: 'bmad:ghk:agents:growth-guru',
    stepNumber: 6
  },
  {
    key: 'ux-design',
    phase: 'planning',
    name: 'UX Design',
    purpose: 'Plan user experience and interface patterns',
    outputFilename: 'ux-design-specification.md',
    command: '/bmad-create-ux-design',
    persona: 'bmad:bmm:agents:ux-designer',
    stepNumber: 7
  },

  // Solutioning phase
  {
    key: 'architecture',
    phase: 'solutioning',
    name: 'Architecture',
    purpose: 'Design technical architecture and stack decisions',
    outputFilename: 'architecture.md',
    command: '/bmad-create-architecture',
    persona: 'bmad:bmm:agents:architect',
    stepNumber: 8
  },
  {
    key: 'epics-stories',
    phase: 'solutioning',
    name: 'Epics & Stories',
    purpose: 'Break down work into implementable stories',
    outputFilename: 'epics.md',
    command: '/bmad-create-epics-and-stories',
    persona: 'bmad:bmm:agents:pm',
    stepNumber: 9
  },
  {
    key: 'readiness-check',
    phase: 'solutioning',
    name: 'Implementation Readiness',
    purpose: 'Validate specs are complete before development',
    outputFilename: 'implementation-readiness-report-*.md',
    command: '/bmad-check-implementation-readiness',
    persona: 'bmad:bmm:agents:pm',
    stepNumber: 10
  }
]

/**
 * BMAD recommendation chain — ordered pipeline steps with dependency relationships.
 *
 * Story 9.4: "What Next?" Recommender Engine
 */
export interface BmadRecommendationEntry {
  workflowKey: string
  label: string
  reason: string
  produces: string
  requires: string[]
  optional?: boolean
  phase: PlanningPhase
}

export const BMAD_RECOMMENDATION_CHAIN: readonly BmadRecommendationEntry[] = [
  {
    workflowKey: 'product-brief',
    label: 'Create Product Brief',
    reason: 'Product Brief defines your vision. Everything starts here.',
    produces: 'product-brief-*.md',
    requires: [],
    phase: 'analysis'
  },
  {
    workflowKey: 'prd',
    label: 'Create PRD',
    reason: 'Product Brief is complete. PRD defines requirements before solutioning.',
    produces: 'prd.md',
    requires: ['product-brief'],
    phase: 'planning'
  },
  {
    workflowKey: 'growth-review',
    label: 'Run Growth Review',
    reason: 'PRD is complete. Evaluate organic growth potential before architecture locks decisions.',
    produces: 'growth-hacking-review.md',
    requires: ['prd'],
    phase: 'planning'
  },
  {
    workflowKey: 'architecture',
    label: 'Design Architecture',
    reason: 'PRD is complete. Architecture defines your technical approach.',
    produces: 'architecture.md',
    requires: ['prd'],
    phase: 'solutioning'
  },
  {
    workflowKey: 'ux-design',
    label: 'UX Design',
    reason: 'PRD is complete. UX Design maps user flows and interface patterns.',
    produces: 'ux-design-specification.md',
    requires: ['prd'],
    optional: true,
    phase: 'planning'
  },
  {
    workflowKey: 'epics-stories',
    label: 'Create Epics & Stories',
    reason: 'Architecture is complete. Break down work into implementable stories.',
    produces: 'epics.md',
    requires: ['architecture'],
    phase: 'solutioning'
  },
  {
    workflowKey: 'readiness-check',
    label: 'Run Implementation Readiness Check',
    reason: 'All planning artifacts exist. Validate specs before development begins.',
    produces: 'implementation-readiness-report-*.md',
    requires: ['epics-stories'],
    phase: 'solutioning'
  }
]

/**
 * Agent persona configuration — maps agent identifiers to display properties.
 *
 * Story 9.8: Agent Persona Indicator
 */
export interface AgentPersonaConfig {
  /** Display name shown in the UI (e.g., "Analyst", "PM") */
  displayName: string
  /** BMAD agent character name (e.g., "Mary", "John") */
  characterName: string
  /** Tailwind color classes for the persona badge */
  bg: string
  text: string
  border: string
  dot: string
}

export const AGENT_PERSONA_CONFIG: Readonly<Record<string, AgentPersonaConfig>> = Object.freeze({
  'general': {
    displayName: 'General',
    characterName: '',
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400'
  },
  'bmad:bmm:agents:analyst': {
    displayName: 'Analyst',
    characterName: 'Mary',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400'
  },
  'bmad:bmm:agents:pm': {
    displayName: 'PM',
    characterName: 'John',
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
    dot: 'bg-green-400'
  },
  'bmad:bmm:agents:architect': {
    displayName: 'Architect',
    characterName: 'Winston',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400'
  },
  'bmad:bmm:agents:ux-designer': {
    displayName: 'UX Designer',
    characterName: 'Sally',
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400'
  },
  'bmad:ghk:agents:growth-guru': {
    displayName: 'Growth Guru',
    characterName: 'Greg',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400'
  }
})

/**
 * Look up agent persona config by agent name identifier.
 * Returns null for unknown or null agents.
 */
export function getAgentPersona(agentName: string | null): AgentPersonaConfig | null {
  if (!agentName) return null
  return AGENT_PERSONA_CONFIG[agentName] ?? null
}

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
