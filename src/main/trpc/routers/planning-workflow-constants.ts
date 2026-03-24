/**
 * Known BMAD workflow artifact files for planning artifact scanning.
 * Story 9.2: Phase Progress Dashboard
 *
 * Maps workflow keys to their expected output filenames in _bmad-output/planning-artifacts/.
 * Use `glob` instead of `filename` for workflows that produce date-stamped files
 * in a subdirectory (e.g., brainstorming sessions).
 */
export const BMAD_WORKFLOWS: Array<{ workflowKey: string; filename?: string; glob?: string }> = [
  { workflowKey: 'brainstorming', glob: 'brainstorming/brainstorming-session-*.md' },
  { workflowKey: 'product-brief', filename: 'product-brief.md' },
  { workflowKey: 'market-research', filename: 'market-research.md' },
  { workflowKey: 'domain-research', filename: 'domain-research.md' },
  { workflowKey: 'prd', filename: 'prd.md' },
  { workflowKey: 'ux-design', filename: 'ux-design-specification.md' },
  { workflowKey: 'architecture', filename: 'architecture.md' },
  { workflowKey: 'epics-stories', filename: 'epics.md' },
  { workflowKey: 'readiness-check', filename: 'readiness-check.md' }
]
