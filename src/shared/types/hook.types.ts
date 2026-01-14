/**
 * Claude Code hook event payload types.
 *
 * Claude Code hooks (Stop, PostToolUse) receive JSON payloads via stdin
 * with this structure. These types are used for session-task mapping
 * and activity logging.
 *
 * @see TES-1.7: Session-Task Mapping & Event Routing
 * @see Claude Code documentation for hook event details
 */

/**
 * Base Claude Code hook event payload structure.
 *
 * Both Stop and PostToolUse hooks receive JSON via stdin
 * with these common fields.
 */
export interface ClaudeHookPayload {
  /** Unique identifier for the Claude Code session */
  session_id: string
  /** Path to the transcript JSON file */
  transcript_path: string
  /** Current working directory where Claude is running */
  cwd: string
  /** Name of the hook event (Stop, PostToolUse, etc.) */
  hook_event_name: string
}

/**
 * PostToolUse hook specific payload.
 *
 * Extended payload received when Claude uses a tool.
 */
export interface ClaudePostToolUsePayload extends ClaudeHookPayload {
  /** Name of the tool that was used */
  tool_name?: string
  /** Input provided to the tool */
  tool_input?: unknown
  /** Output returned from the tool */
  tool_output?: unknown
}

/**
 * Stop hook specific payload.
 *
 * Extended payload received when Claude session ends.
 */
export interface ClaudeStopPayload extends ClaudeHookPayload {
  /** Reason for session stop (if available) */
  stop_reason?: string
}

/**
 * Extracts session_id from a hook payload safely.
 *
 * Returns null if payload is invalid or session_id is missing.
 * Uses defensive programming to handle malformed or unexpected
 * payload structures.
 *
 * @param payload - The raw hook payload (unknown type from stdin)
 * @returns The session_id string if valid, null otherwise
 *
 * @example
 * ```typescript
 * const payload = JSON.parse(stdin)
 * const sessionId = extractSessionId(payload)
 * if (sessionId) {
 *   await TaskSessionService.routeHookEvent(sessionId, 'PostToolUse', payload)
 * }
 * ```
 */
export function extractSessionId(payload: unknown): string | null {
  // Guard against null/undefined
  if (payload === null || payload === undefined) {
    return null
  }

  // Must be an object
  if (typeof payload !== 'object') {
    return null
  }

  // Check for session_id property
  if (!('session_id' in payload)) {
    return null
  }

  // session_id must be a non-empty string
  const sessionId = (payload as ClaudeHookPayload).session_id
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return null
  }

  return sessionId
}

/**
 * Type guard to check if a payload is a valid ClaudeHookPayload.
 *
 * @param payload - The raw payload to check
 * @returns true if payload has all required ClaudeHookPayload fields
 */
export function isClaudeHookPayload(payload: unknown): payload is ClaudeHookPayload {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return false
  }

  const p = payload as Partial<ClaudeHookPayload>

  return (
    typeof p.session_id === 'string' &&
    typeof p.transcript_path === 'string' &&
    typeof p.cwd === 'string' &&
    typeof p.hook_event_name === 'string'
  )
}
