// Phase descriptions for planning tasks
// Each phase produces a specific artifact in the BMAD methodology

export const PHASE_DESCRIPTIONS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Define your product vision and target users',
  2: 'Document detailed requirements and features',
  3: 'Design technical architecture and stack',
  4: 'Plan user experience and interface design',
  5: 'Break down work into implementable stories'
}

// Phase names for display (matches phase_name in database)
export const PHASE_NAMES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Product Brief',
  2: 'PRD',
  3: 'Architecture',
  4: 'UX Design',
  5: 'Epics & Stories'
}
