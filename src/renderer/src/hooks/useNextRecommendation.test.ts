import { describe, it, expect } from 'vitest'
import { computeNextRecommendation } from './useNextRecommendation'

/**
 * Helper to build scan results with specific artifacts marked as existing.
 */
function buildArtifacts(existingKeys: string[]) {
  const allKeys = [
    'brainstorming',
    'product-brief',
    'market-research',
    'domain-research',
    'prd',
    'ux-design',
    'architecture',
    'epics-stories',
    'readiness-check'
  ]
  return allKeys.map((key) => ({
    workflowKey: key,
    exists: existingKeys.includes(key)
  }))
}

describe('computeNextRecommendation', () => {
  describe('empty artifacts', () => {
    it('recommends product-brief when no artifacts exist', () => {
      const result = computeNextRecommendation(buildArtifacts([]))
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('complete')
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('product-brief')
        expect(result.label).toBe('Create Product Brief')
        expect(result.phase).toBe('analysis')
      }
    })
  })

  describe('linear progression', () => {
    it('recommends prd when product-brief exists', () => {
      const result = computeNextRecommendation(buildArtifacts(['product-brief']))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('prd')
        expect(result.label).toBe('Create PRD')
        expect(result.phase).toBe('planning')
      }
    })

    it('recommends architecture when product-brief and prd exist', () => {
      const result = computeNextRecommendation(buildArtifacts(['product-brief', 'prd']))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('architecture')
        expect(result.phase).toBe('solutioning')
      }
    })

    it('recommends epics-stories when architecture and ux-design exist', () => {
      const result = computeNextRecommendation(
        buildArtifacts(['product-brief', 'prd', 'architecture', 'ux-design'])
      )
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('epics-stories')
      }
    })

    it('recommends readiness-check when epics-stories exists', () => {
      const result = computeNextRecommendation(
        buildArtifacts(['product-brief', 'prd', 'architecture', 'ux-design', 'epics-stories'])
      )
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('readiness-check')
        expect(result.label).toBe('Run Implementation Readiness Check')
      }
    })
  })

  describe('completion state', () => {
    it('returns complete when all required artifacts exist', () => {
      const result = computeNextRecommendation(
        buildArtifacts([
          'product-brief',
          'prd',
          'ux-design',
          'architecture',
          'epics-stories',
          'readiness-check'
        ])
      )
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('complete', true)
      if (result && 'complete' in result) {
        expect(result.message).toBe('All planning artifacts are complete!')
      }
    })

    it('returns complete even when optional ux-design is also present', () => {
      const result = computeNextRecommendation(
        buildArtifacts([
          'product-brief',
          'prd',
          'ux-design',
          'architecture',
          'epics-stories',
          'readiness-check'
        ])
      )
      expect(result).toHaveProperty('complete', true)
    })
  })

  describe('optional UX Design behavior', () => {
    it('recommends ux-design as optional after architecture when prd exists', () => {
      // architecture is recommended first (order in chain), then ux-design
      const result = computeNextRecommendation(
        buildArtifacts(['product-brief', 'prd', 'architecture'])
      )
      // architecture exists, so next after it should be ux-design or epics-stories
      // ux-design comes after architecture in chain order, but its prerequisite is prd
      // Actually in the chain, architecture is index 2, ux-design is index 3
      // So with architecture existing, the first missing with prereqs met:
      // ux-design requires prd (met), epics-stories requires architecture (met)
      // ux-design comes first in chain order
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('ux-design')
        expect(result.optional).toBe(true)
      }
    })

    it('skips ux-design when included in skippedKeys', () => {
      const result = computeNextRecommendation(
        buildArtifacts(['product-brief', 'prd', 'architecture']),
        ['ux-design']
      )
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('epics-stories')
      }
    })
  })

  describe('prerequisite enforcement', () => {
    it('cannot recommend architecture before prd exists', () => {
      // Only product-brief exists — prd prerequisite for architecture not met
      const result = computeNextRecommendation(buildArtifacts(['product-brief']))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('prd')
        expect(result.workflowKey).not.toBe('architecture')
      }
    })

    it('cannot recommend epics-stories before architecture exists', () => {
      const result = computeNextRecommendation(buildArtifacts(['product-brief', 'prd']))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).not.toBe('epics-stories')
      }
    })
  })

  describe('brainstorming alias', () => {
    it('treats brainstorming artifact as product-brief for prerequisite checking', () => {
      const result = computeNextRecommendation(buildArtifacts(['brainstorming']))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        // brainstorming covers product-brief, so prd should be next
        expect(result.workflowKey).toBe('prd')
      }
    })
  })

  describe('reason and produces fields', () => {
    it('includes reason text for each recommendation', () => {
      const result = computeNextRecommendation(buildArtifacts([]))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.reason).toBeTruthy()
        expect(typeof result.reason).toBe('string')
      }
    })

    it('includes produces filename for each recommendation', () => {
      const result = computeNextRecommendation(buildArtifacts([]))
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.produces).toBe('product-brief.md')
      }
    })
  })

  describe('edge cases', () => {
    it('recommends product-brief when artifacts array is empty', () => {
      // Empty array means no scan data — but the function should still work
      // With no artifacts, product-brief has no prerequisites, so it should recommend it
      const result = computeNextRecommendation([])
      expect(result).not.toBeNull()
      if (result && !('complete' in result)) {
        expect(result.workflowKey).toBe('product-brief')
      }
    })
  })
})
