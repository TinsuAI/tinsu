import type { MobileTabId } from './mobile-nav.store'

/**
 * Result of parsing a tinsu:// deep-link URI.
 *
 * Story T3.5-1 — Deep-Link Routing Table.
 * Story T3.5-8 — Extended with settings sub-paths + activity/{taskId}.
 *
 * Table (from architecture.md §"Deep-Link Routing Table"):
 *
 *   tinsu://chat/{sessionId}        → tab: 'planning', stack: ['sessions', 'chat:{sessionId}']
 *   tinsu://task/{taskId}           → tab: 'tasks',    stack: ['list', 'workspace:{taskId}']
 *   tinsu://task/{taskId}/diff      → tab: 'tasks',    stack: ['list', 'workspace:{taskId}', 'diff']
 *   tinsu://settings/connections    → tab: 'settings', stack: ['home', 'connections']
 *   tinsu://settings/agent          → tab: 'settings', stack: ['home', 'agent-settings']
 *   tinsu://settings/theme          → tab: 'settings', stack: ['home', 'theme-settings']
 *   tinsu://settings/diagnostics    → tab: 'settings', stack: ['home', 'diagnostics']
 *   tinsu://settings/about          → tab: 'settings', stack: ['home', 'about']
 *   tinsu://activity/{taskId}       → tab: 'activity', stack: ['feed'],
 *                                     pendingTaskId: taskId (for detail sheet on mount)
 *
 * All other URIs (unknown host/path, empty ids, wrong schemes) → null.
 */
export interface DeepLinkTarget {
  tab: MobileTabId
  stack: string[]
  /**
   * Transient: set only for tinsu://activity/{taskId} deep-links.
   * Consumed by MobileActivityFeedScreen on mount to open the detail sheet
   * for the most-recent activity of this task. T3.5-8, AC-13.
   */
  pendingTaskId?: string
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
      // T3.5-7: tinsu://settings/connections → settings tab with connections list (kept)
      // T3.5-8: extended with agent, theme, diagnostics, about sub-paths
      switch (parts[0]) {
        case 'connections':
          return { tab: 'settings', stack: ['home', 'connections'] }
        case 'agent':
          return { tab: 'settings', stack: ['home', 'agent-settings'] }
        case 'theme':
          return { tab: 'settings', stack: ['home', 'theme-settings'] }
        case 'diagnostics':
          return { tab: 'settings', stack: ['home', 'diagnostics'] }
        case 'about':
          return { tab: 'settings', stack: ['home', 'about'] }
        default:
          console.warn('[deeplinks] Unknown settings sub-path:', parts[0], 'in URI:', uri)
          return null
      }
    }

    case 'activity': {
      // T3.5-8: tinsu://activity/{taskId} → activity tab at feed root
      // Sets pendingTaskId so MobileActivityFeedScreen opens the detail sheet on mount.
      const taskId = parts[0] ?? ''
      if (!taskId) {
        console.warn('[deeplinks] tinsu://activity missing taskId:', uri)
        return null
      }
      return {
        tab: 'activity',
        stack: ['feed'],
        pendingTaskId: taskId,
      }
    }

    default: {
      console.warn('[deeplinks] Unknown deep-link host:', host, 'in URI:', uri)
      return null
    }
  }
}
