/**
 * Readiness Gate Parsing Service
 * Story 9.6: Readiness Gate Results Panel
 *
 * Parses the BMAD implementation readiness report markdown and extracts
 * structured gate results including decision, rationale, and issues.
 */

export interface GateIssue {
  severity: 'critical' | 'major' | 'minor'
  description: string
  artifactKey?: string
  sectionRef?: string
}

export interface ParsedGateResult {
  decision: 'pass' | 'concerns' | 'fail'
  rationale: string
  issues: GateIssue[]
}

/**
 * Map artifact keywords in issue descriptions to workflow keys.
 */
const ARTIFACT_KEYWORDS: Record<string, string> = {
  'product brief': 'product-brief',
  prd: 'prd',
  requirements: 'prd',
  ux: 'ux-design',
  architecture: 'architecture',
  epics: 'epics-stories',
  stories: 'epics-stories'
}

/**
 * Infer artifact key from issue description text.
 */
function inferArtifactKey(description: string): string | undefined {
  const lower = description.toLowerCase()
  for (const [keyword, key] of Object.entries(ARTIFACT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return key
    }
  }
  return undefined
}

/**
 * Extract a section reference (heading text) from description if present.
 */
function inferSectionRef(description: string): string | undefined {
  // Match patterns like "Story 3.2", "Section 5", or "Epic 2"
  const match = description.match(/(?:Story|Section|Epic)\s+[\d.]+/i)
  return match?.[0]
}

/**
 * Parse the "Summary and Recommendations" section for the overall status.
 * Maps: "READY" → pass, "NEEDS WORK" → concerns, "NOT READY" → fail
 */
function parseDecision(content: string): 'pass' | 'concerns' | 'fail' {
  // Look for "Overall Readiness Status" section
  const statusSectionMatch = content.match(
    /(?:Overall\s+Readiness\s+Status|Overall\s+Assessment)[^\n]*\n([\s\S]*?)(?=\n##|\n---|$)/i
  )
  const statusSection = statusSectionMatch?.[1] ?? content

  // Check for status keywords (case-insensitive)
  if (/\bNOT\s+READY\b/i.test(statusSection)) return 'fail'
  if (/\bNEEDS\s+WORK\b/i.test(statusSection)) return 'concerns'
  if (/\bREADY\b/i.test(statusSection)) return 'pass'

  // Also check full content if section didn't have a clear status
  if (/\bNOT\s+READY\b/i.test(content)) return 'fail'
  if (/\bNEEDS\s+WORK\b/i.test(content)) return 'concerns'
  if (/\bREADY\b/i.test(content)) return 'pass'

  // Default to concerns if no status found
  return 'concerns'
}

/**
 * Extract the rationale text from the "Summary and Recommendations" section.
 */
function parseRationale(content: string): string {
  // Try "Summary and Recommendations" section
  const summaryMatch = content.match(
    /##\s*Summary\s+and\s+Recommendations[^\n]*\n([\s\S]*?)(?=\n##[^#]|$)/i
  )
  if (summaryMatch?.[1]) {
    const text = summaryMatch[1].trim()
    // Remove sub-headings and extract text content
    const lines = text
      .split('\n')
      .filter((l) => !l.startsWith('#'))
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length > 0) {
      return lines.join(' ').substring(0, 2000)
    }
  }

  // Try "Recommended Next Steps" as fallback
  const nextStepsMatch = content.match(
    /###\s*Recommended\s+Next\s+Steps[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n###|$)/i
  )
  if (nextStepsMatch?.[1]) {
    return nextStepsMatch[1].trim().substring(0, 2000)
  }

  return 'No summary available.'
}

/**
 * Parse issues from severity-marked sections in the report.
 * Looks for: 🔴 Critical, 🟠 Major, 🟡 Minor markers.
 */
function parseIssues(content: string): GateIssue[] {
  const issues: GateIssue[] = []

  // Parse critical issues (🔴)
  const criticalSections = content.match(
    /(?:🔴|Critical\s+(?:Violations?|Issues?))[^\n]*\n([\s\S]*?)(?=\n(?:#{1,4}\s|🟠|🟡|🔴)|$)/gi
  )
  if (criticalSections) {
    for (const section of criticalSections) {
      const bullets = section.match(/^[-*]\s+(.+)$/gm)
      if (bullets) {
        for (const bullet of bullets) {
          const desc = bullet.replace(/^[-*]\s+/, '').trim()
          if (desc) {
            issues.push({
              severity: 'critical',
              description: desc,
              artifactKey: inferArtifactKey(desc),
              sectionRef: inferSectionRef(desc)
            })
          }
        }
      }
    }
  }

  // Parse major issues (🟠)
  const majorSections = content.match(
    /(?:🟠|Major\s+Issues?)[^\n]*\n([\s\S]*?)(?=\n(?:#{1,4}\s|🔴|🟡|🟠)|$)/gi
  )
  if (majorSections) {
    for (const section of majorSections) {
      const bullets = section.match(/^[-*]\s+(.+)$/gm)
      if (bullets) {
        for (const bullet of bullets) {
          const desc = bullet.replace(/^[-*]\s+/, '').trim()
          if (desc) {
            issues.push({
              severity: 'major',
              description: desc,
              artifactKey: inferArtifactKey(desc),
              sectionRef: inferSectionRef(desc)
            })
          }
        }
      }
    }
  }

  // Parse minor issues (🟡)
  const minorSections = content.match(
    /(?:🟡|Minor\s+(?:Concerns?|Issues?))[^\n]*\n([\s\S]*?)(?=\n(?:#{1,4}\s|🔴|🟠|🟡)|$)/gi
  )
  if (minorSections) {
    for (const section of minorSections) {
      const bullets = section.match(/^[-*]\s+(.+)$/gm)
      if (bullets) {
        for (const bullet of bullets) {
          const desc = bullet.replace(/^[-*]\s+/, '').trim()
          if (desc) {
            issues.push({
              severity: 'minor',
              description: desc,
              artifactKey: inferArtifactKey(desc),
              sectionRef: inferSectionRef(desc)
            })
          }
        }
      }
    }
  }

  // Fallback: parse from "Critical Issues Requiring Immediate Action" section
  if (issues.length === 0) {
    const criticalActionMatch = content.match(
      /Critical\s+Issues\s+Requiring\s+Immediate\s+Action[^\n]*\n([\s\S]*?)(?=\n##[^#]|\n###|$)/i
    )
    if (criticalActionMatch?.[1]) {
      const bullets = criticalActionMatch[1].match(/^[-*]\s+(.+)$/gm)
      if (bullets) {
        for (const bullet of bullets) {
          const desc = bullet.replace(/^[-*]\s+/, '').trim()
          if (desc) {
            issues.push({
              severity: 'critical',
              description: desc,
              artifactKey: inferArtifactKey(desc),
              sectionRef: inferSectionRef(desc)
            })
          }
        }
      }
    }
  }

  return issues
}

/**
 * Parse a readiness report markdown file content into structured gate result.
 */
export function parseReadinessReport(markdownContent: string): ParsedGateResult {
  return {
    decision: parseDecision(markdownContent),
    rationale: parseRationale(markdownContent),
    issues: parseIssues(markdownContent)
  }
}
