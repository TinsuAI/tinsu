import { EventEmitter } from 'events'

/**
 * Session event data for session state changes.
 *
 * TES-1.11: Session End & Unresponsive Detection
 */
export interface SessionEventData {
  /** Task ID for the session */
  taskId: string
  /** tmux session name (optional, included when available) */
  sessionName?: string
}

/**
 * Session ended event data with reason.
 */
export interface SessionEndedEventData extends SessionEventData {
  /** Reason why the session ended */
  reason: 'process_exit' | 'session_killed' | 'detected_stale'
}

/**
 * Session stalled event data.
 */
export interface SessionStalledEventData extends SessionEventData {
  /** Timestamp of last output received */
  lastOutputTime: number
  /** How long the stall duration threshold is (ms) */
  stallDurationMs: number
}

/**
 * Type-safe event emitter for session lifecycle events.
 *
 * Used for cross-service communication between:
 * - TaskTerminalService (emits session:ended)
 * - StallDetectorService (emits session:stalled, session:recovered)
 * - tRPC subscriptions (consumes events for UI updates)
 *
 * @see TES-1.11: Session End & Unresponsive Detection
 */
class SessionEventEmitter extends EventEmitter {
  /**
   * Emit a session ended event.
   */
  emitSessionEnded(data: SessionEndedEventData): boolean {
    return this.emit('session:ended', data)
  }

  /**
   * Emit a session stalled event.
   */
  emitSessionStalled(data: SessionStalledEventData): boolean {
    return this.emit('session:stalled', data)
  }

  /**
   * Emit a session recovered event (output received after stall).
   */
  emitSessionRecovered(data: SessionEventData): boolean {
    return this.emit('session:recovered', data)
  }

  /**
   * Subscribe to session ended events.
   */
  onSessionEnded(listener: (data: SessionEndedEventData) => void): this {
    return this.on('session:ended', listener)
  }

  /**
   * Subscribe to session stalled events.
   */
  onSessionStalled(listener: (data: SessionStalledEventData) => void): this {
    return this.on('session:stalled', listener)
  }

  /**
   * Subscribe to session recovered events.
   */
  onSessionRecovered(listener: (data: SessionEventData) => void): this {
    return this.on('session:recovered', listener)
  }

  /**
   * Unsubscribe from session ended events.
   */
  offSessionEnded(listener: (data: SessionEndedEventData) => void): this {
    return this.off('session:ended', listener)
  }

  /**
   * Unsubscribe from session stalled events.
   */
  offSessionStalled(listener: (data: SessionStalledEventData) => void): this {
    return this.off('session:stalled', listener)
  }

  /**
   * Unsubscribe from session recovered events.
   */
  offSessionRecovered(listener: (data: SessionEventData) => void): this {
    return this.off('session:recovered', listener)
  }
}

/**
 * Singleton instance of the session event emitter.
 * Import this in services and routers that need to emit or listen to session events.
 */
export const sessionEventEmitter = new SessionEventEmitter()
