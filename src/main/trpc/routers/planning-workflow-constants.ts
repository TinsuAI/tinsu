/**
 * Known BMAD workflow artifact files for planning artifact scanning.
 * Story 9.2: Phase Progress Dashboard
 *
 * Maps workflow keys to their expected output filenames.
 * Default base directory is `_bmad-output/planning-artifacts/`.
 * Use `baseDir` to override (e.g., empty string for `_bmad-output/` root).
 * Use `glob` instead of `filename` for workflows that produce date-stamped files.
 */
export const BMAD_WORKFLOWS: Array<{
  workflowKey: string
  filename?: string
  glob?: string
  /** Override base dir relative to _bmad-output/. Defaults to 'planning-artifacts'. */
  baseDir?: string
}> = [
  { workflowKey: 'brainstorming', glob: 'brainstorming/brainstorming-session-*.md', baseDir: '' },
  { workflowKey: 'product-brief', glob: 'product-brief-*.md' },
  { workflowKey: 'market-research', glob: 'research/market-*-research-*.md' },
  { workflowKey: 'domain-research', glob: 'research/domain-*-research-*.md' },
  { workflowKey: 'prd', filename: 'prd.md' },
  { workflowKey: 'growth-review', filename: 'growth-hacking-review.md' },
  { workflowKey: 'ux-design', filename: 'ux-design-specification.md' },
  { workflowKey: 'architecture', filename: 'architecture.md' },
  { workflowKey: 'epics-stories', filename: 'epics.md' },
  { workflowKey: 'readiness-check', glob: 'implementation-readiness-report-*.md' }
]
