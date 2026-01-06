// Artifact Detection Service (Story 3.2 - Task 2)
// Detects existing BMAD planning artifacts to determine phase completion status

import * as fs from 'fs'
import * as path from 'path'
import { PhaseNumber, PHASE_NUMBERS } from '../db/planning-phases'

// Patterns to match artifact files for each planning phase
const ARTIFACT_PATTERNS: Record<PhaseNumber, RegExp> = {
  1: /^product-brief.*\.md$/i,
  2: /^prd.*\.md$/i,
  3: /^architecture.*\.md$/i,
  4: /^(ux-design.*|.*ux.*)\.md$/i,
  5: /^epics.*\.md$/i
}

export class ArtifactDetectorService {
  /**
   * Detects existing BMAD planning artifacts in a project.
   *
   * @param projectPath - Root path of the project
   * @returns Map of phase number to artifact file path for detected artifacts
   */
  static detectExistingArtifacts(projectPath: string): Map<PhaseNumber, string> {
    const artifactsDir = path.join(projectPath, '_bmad-output', 'planning-artifacts')
    const results = new Map<PhaseNumber, string>()

    if (!fs.existsSync(artifactsDir)) {
      return results
    }

    const files = fs.readdirSync(artifactsDir)

    for (const phaseNum of PHASE_NUMBERS) {
      const pattern = ARTIFACT_PATTERNS[phaseNum]
      const match = files.find((f) => pattern.test(String(f)))
      if (match) {
        results.set(phaseNum, path.join(artifactsDir, String(match)))
      }
    }

    return results
  }
}
