import { describe, it, expect } from 'vitest'
import { parseReadinessReport } from './readiness-gate.service'

describe('parseReadinessReport', () => {
  it('should parse READY status as pass', () => {
    const content = `## Summary and Recommendations
### Overall Readiness Status
**READY** - All artifacts pass validation.
### Recommended Next Steps
1. Proceed with implementation.
`
    const result = parseReadinessReport(content)
    expect(result.decision).toBe('pass')
  })

  it('should parse NEEDS WORK status as concerns', () => {
    const content = `## Summary and Recommendations
### Overall Readiness Status
**NEEDS WORK** - Several issues need attention.
### Recommended Next Steps
1. Fix the identified issues.
`
    const result = parseReadinessReport(content)
    expect(result.decision).toBe('concerns')
  })

  it('should parse NOT READY status as fail', () => {
    const content = `## Summary and Recommendations
### Overall Readiness Status
**NOT READY** - Critical issues found.
### Recommended Next Steps
1. Address critical issues before proceeding.
`
    const result = parseReadinessReport(content)
    expect(result.decision).toBe('fail')
  })

  it('should default to concerns when no status found', () => {
    const content = `## Summary
Some text without a clear status.
`
    const result = parseReadinessReport(content)
    expect(result.decision).toBe('concerns')
  })

  it('should extract rationale from Summary and Recommendations', () => {
    const content = `## Summary and Recommendations
The project is well-prepared for implementation.

### Overall Readiness Status
**READY**
### Recommended Next Steps
1. Start implementation of Epic 1.
2. Focus on core features first.
`
    const result = parseReadinessReport(content)
    expect(result.rationale).toContain('well-prepared')
  })

  it('should extract critical issues from 🔴 sections', () => {
    const content = `#### 🔴 Critical Violations
- Missing PRD validation for Story 3.2
- Architecture does not define database schema

## Summary and Recommendations
### Overall Readiness Status
**NOT READY**
`
    const result = parseReadinessReport(content)
    expect(result.issues.filter((i) => i.severity === 'critical')).toHaveLength(2)
    expect(result.issues[0].severity).toBe('critical')
    expect(result.issues[0].description).toContain('Missing PRD validation')
  })

  it('should extract major issues from 🟠 sections', () => {
    const content = `#### 🟠 Major Issues
- UX design lacks mobile considerations
- Epics missing acceptance criteria

## Summary and Recommendations
### Overall Readiness Status
**NEEDS WORK**
`
    const result = parseReadinessReport(content)
    expect(result.issues.filter((i) => i.severity === 'major')).toHaveLength(2)
  })

  it('should extract minor issues from 🟡 sections', () => {
    const content = `#### 🟡 Minor Concerns
- Architecture naming inconsistency

## Summary and Recommendations
### Overall Readiness Status
**READY**
`
    const result = parseReadinessReport(content)
    expect(result.issues.filter((i) => i.severity === 'minor')).toHaveLength(1)
    expect(result.issues[0].severity).toBe('minor')
  })

  it('should extract all severity levels together', () => {
    const content = `#### 🔴 Critical Violations
- Missing PRD section

#### 🟠 Major Issues
- Architecture needs update

#### 🟡 Minor Concerns
- Naming inconsistency in epics

## Summary and Recommendations
### Overall Readiness Status
**NEEDS WORK**
`
    const result = parseReadinessReport(content)
    expect(result.issues).toHaveLength(3)
    expect(result.issues.map((i) => i.severity)).toEqual(['critical', 'major', 'minor'])
  })

  it('should infer artifactKey from issue description', () => {
    const content = `#### 🔴 Critical Violations
- PRD missing validation rules
- Architecture does not cover caching

#### 🟠 Major Issues
- Epics need refinement

## Summary and Recommendations
### Overall Readiness Status
**NOT READY**
`
    const result = parseReadinessReport(content)
    expect(result.issues[0].artifactKey).toBe('prd')
    expect(result.issues[1].artifactKey).toBe('architecture')
    expect(result.issues[2].artifactKey).toBe('epics-stories')
  })

  it('should infer sectionRef from issue description', () => {
    const content = `#### 🔴 Critical Violations
- Story 3.2 lacks acceptance criteria

## Summary and Recommendations
### Overall Readiness Status
**NOT READY**
`
    const result = parseReadinessReport(content)
    expect(result.issues[0].sectionRef).toBe('Story 3.2')
  })

  it('should handle missing sections gracefully', () => {
    const content = `# Some random content
Without any recognized sections.
`
    const result = parseReadinessReport(content)
    expect(result.decision).toBe('concerns')
    expect(result.rationale).toBe('No summary available.')
    expect(result.issues).toHaveLength(0)
  })

  it('should handle empty content', () => {
    const result = parseReadinessReport('')
    expect(result.decision).toBe('concerns')
    expect(result.rationale).toBe('No summary available.')
    expect(result.issues).toHaveLength(0)
  })

  it('should not set artifactKey when no keyword matches', () => {
    const content = `#### 🟡 Minor Concerns
- General formatting issues in documentation

## Summary and Recommendations
### Overall Readiness Status
**READY**
`
    const result = parseReadinessReport(content)
    expect(result.issues[0].artifactKey).toBeUndefined()
  })
})
