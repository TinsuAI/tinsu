import type { MobileTabId } from './mobile-nav.store'

/**
 * Result of parsing a tinsu:// deep-link URI.
 *
 * Story T3.5-1 — Deep-Link Routing Table.
 *
 * Table (from architecture.md §"Deep-Link Routing Table"):
 *
 *   tinsu://chat/{sessionId}        → tab: 'planning', stack: ['sessions', 'chat:{sessionId}']
 *   tinsu://task/{taskId}           → tab: 'tasks',    stack: ['list', 'workspace:{taskId}']
 *   tinsu://task/{taskId}/diff      → tab: 'tasks',    stack: ['list', 'workspace:{taskId}', 'diff']
 *
 * All other URIs (unknown host/path, empty ids, wrong schemes) → null.
 */
export interface DeepLinkTarget {
  tab: MobileTabId
  stack: string[]
}

/**
 * Parse a `tinsu://` URI into a navigation target.
 *
 * Uses the `URL` constructor with a triple-slash workaround so the non-standard
 * scheme doesn't confuse the parser:
 *   `tinsu://chat/abc` → `tinsu:///chat/abc`  → host='chat', pathname='/abc'
 *
 * Returns null if:
 *   - URI is not parseable
 *   - Scheme is not `tinsu:`
 *   - Host (first path segment) is not in the routing table
 *   - Any required ID is empty
 */
export function parseDeepLink(uri: string): DeepLinkTarget | null {
  if (!uri) return null

  let url: URL
  try {
    // Triple-slash makes `host` = first path segment and `pathname` = rest
    url = new URL(uri.replace(/^tinsu:\/\//, 'tinsu:///'))
  } catch {
    console.warn('[deeplinks] Failed to parse URI:', uri)
    return null
  }

  // Validate scheme
  if (url.protocol !== 'tinsu:') {
    console.warn('[deeplinks] Unknown scheme in URI:', uri)
    return null
  }

  // pathname starts with '/' — split and filter empty strings
  // parts[0] = first path segment (acts as "host" for tinsu:// scheme)
  // parts[1..] = remaining path segments
  const allParts = url.pathname.split('/').filter(Boolean)
  const host = allParts[0] ?? ''   // e.g. 'chat', 'task'
  const parts = allParts.slice(1)  // remaining segments

  switch (host) {
    case 'chat': {
      const sessionId = parts[0] ?? ''
      if (!sessionId) {
        console.warn('[deeplinks] tinsu://chat missing sessionId:', uri)
        return null
      }
      return {
        tab: 'planning',
        stack: ['sessions', `chat:${sessionId}`],
      }
    }

    case 'task': {
      const taskId = parts[0] ?? ''
      if (!taskId) {
        console.warn('[deeplinks] tinsu://task missing taskId:', uri)
        return null
      }
      const hasDiff = parts[1] === 'diff'
      return {
        tab: 'tasks',
        stack: hasDiff
          ? ['list', `workspace:${taskId}`, 'diff']
          : ['list', `workspace:${taskId}`],
      }
    }

    case 'settings': {
      // T3.5-7: tinsu://settings/connections → settings tab with connections list
      // All other tinsu://settings/* URIs return null — T3.5-8 may extend later.
      if (parts[0] === 'connections') {
        return {
          tab: 'settings',
          stack: ['home', 'connections'],
        }
      }
      console.warn('[deeplinks] Unknown settings sub-path:', parts[0], 'in URI:', uri)
      return null
    }

    default: {
      console.warn('[deeplinks] Unknown deep-link host:', host, 'in URI:', uri)
      return null
    }
  }
}
