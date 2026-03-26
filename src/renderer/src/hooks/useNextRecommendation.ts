import { useMemo } from 'react'
import {
  BMAD_RECOMMENDATION_CHAIN
} from '@renderer/constants/planning-workspace'
import type { PlanningPhase } from '@renderer/stores/planning-workspace.store'

/**
 * Artifact scan result shape from the planning.scanArtifacts tRPC query.
 */
interface ArtifactScanItem {
  workflowKey: string
  exists: boolean
}

/**
 * Recommendation result: a next step, a completion state, or null (no prerequisites met).
 */
export type RecommendationResult =
  | {
      workflowKey: string
      label: string
      reason: string
      produces: string
      phase: PlanningPhase
      optional?: boolean
    }
  | { complete: true; message: string }
  | null

/**
 * Pure computation: determine the next recommended BMAD workflow step.
 *
 * Walks the BMAD_RECOMMENDATION_CHAIN in order, returns the first entry
 * whose artifact is missing AND whose prerequisites are all satisfied.
 */
export function computeNextRecommendation(
  artifacts: ArtifactScanItem[],
  skippedKeys: string[] = []
): RecommendationResult {
  const existsMap = new Map<string, boolean>()
  for (const a of artifacts) {
    existsMap.set(a.workflowKey, a.exists)
  }

  // Find first missing entry whose prerequisites are met (excluding skipped)
  for (const entry of BMAD_RECOMMENDATION_CHAIN) {
    const artifactExists = existsMap.get(entry.workflowKey) === true

    if (artifactExists) continue
    if (skippedKeys.includes(entry.workflowKey)) continue

    // Check all prerequisites are satisfied
    const prerequisitesMet = entry.requires.every(
      (req) => existsMap.get(req) === true
    )

    if (prerequisitesMet) {
      return {
        workflowKey: entry.workflowKey,
        label: entry.label,
        reason: entry.reason,
        produces: entry.produces,
        phase: entry.phase,
        optional: entry.optional
      }
    }
  }

  // All non-optional chain entries present?
  const requiredEntries = BMAD_RECOMMENDATION_CHAIN.filter((e) => !e.optional)
  const allRequiredExist = requiredEntries.every(
    (e) => existsMap.get(e.workflowKey) === true
  )

  if (allRequiredExist) {
    return { complete: true, message: 'All planning artifacts are complete!' }
  }

  // Prerequisites not met for any remaining entry
  return null
}

/**
 * React hook that computes the next recommended BMAD planning step.
 *
 * Story 9.4: "What Next?" Recommender Engine
 *
 * @param artifacts - Array of artifact scan results from scanArtifacts query
 * @param skippedKeys - Array of workflow keys the user has chosen to skip
 */
export function useNextRecommendation(
  artifacts: ArtifactScanItem[] | undefined,
  skippedKeys: string[] = []
): RecommendationResult {
  return useMemo(() => {
    if (!artifacts) return null
    return computeNextRecommendation(artifacts, skippedKeys)
  }, [artifacts, skippedKeys])
}
