export interface FuzzyResult {
  score: number
  matches: number[]
}

/**
 * fzf-style fuzzy match: characters must appear in order in the target.
 * Returns null if not all query chars found.
 *
 * Scoring:
 *  +1 per matched character
 *  +2 consecutive match bonus
 *  +3 word boundary match (after `-`, `/`, `.`, space, or camelCase)
 *  +5 exact prefix match
 *  -1 per skipped character between matches
 */
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (!query) return { score: 0, matches: [] }

  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const matches: number[] = []
  let score = 0
  let ti = 0

  for (let qi = 0; qi < q.length; qi++) {
    const qc = q[qi]
    let found = false

    while (ti < t.length) {
      if (t[ti] === qc) {
        // Gap penalty
        if (matches.length > 0) {
          const gap = ti - matches[matches.length - 1] - 1
          score -= gap
        }

        matches.push(ti)
        score += 1

        // Consecutive bonus
        if (matches.length >= 2 && matches[matches.length - 1] - matches[matches.length - 2] === 1) {
          score += 2
        }

        // Word boundary bonus
        if (ti === 0 || '-/. '.includes(target[ti - 1])) {
          score += 3
        } else if (
          ti > 0 &&
          target[ti] === target[ti].toUpperCase() &&
          target[ti - 1] === target[ti - 1].toLowerCase() &&
          target[ti].toLowerCase() !== target[ti].toUpperCase()
        ) {
          // camelCase boundary
          score += 3
        }

        // Exact prefix bonus
        if (qi === 0 && ti === 0) {
          score += 5
        }

        ti++
        found = true
        break
      }
      ti++
    }

    if (!found) return null
  }

  return { score, matches }
}

/**
 * Filter and sort items by fuzzy match score (descending).
 * Items that don't match are excluded.
 */
export function fuzzyFilter<T>(query: string, items: T[], getText: (item: T) => string): T[] {
  if (!query) return items

  const scored: { item: T; score: number }[] = []
  for (const item of items) {
    const result = fuzzyMatch(query, getText(item))
    if (result) {
      scored.push({ item, score: result.score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}
