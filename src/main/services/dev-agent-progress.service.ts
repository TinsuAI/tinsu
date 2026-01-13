/**
 * Agent execution state for tracking DEV workflow progress.
 *
 * - idle: No agent running
 * - dev_implementing: DEV agent is implementing the story
 * - code_reviewing: Code review agent is running
 */
export type AgentExecutionState = 'idle' | 'dev_implementing' | 'code_reviewing'

/**
 * Progress information for the DEV agent workflow.
 */
export interface DevAgentProgressInfo {
  /** Current step number (1-3) */
  step: number
  /** Total number of steps */
  total: number
  /** Human-readable label for current step */
  label: string
}

type ProgressListener = (progress: DevAgentProgressInfo) => void

/**
 * Service for tracking DEV agent execution progress.
 *
 * Tracks the current state of the agent workflow and emits
 * events when state changes. Used by the renderer to show
 * progress indicators.
 *
 * The workflow has 3 steps:
 * 1. SM (Story Management) - creates story file (may be skipped)
 * 2. DEV - implements the story
 * 3. Review - automated code review
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class DevAgentProgressService {
  private state: AgentExecutionState = 'idle'
  private listeners: Set<ProgressListener> = new Set()

  /**
   * Gets the current execution state.
   */
  getState(): AgentExecutionState {
    return this.state
  }

  /**
   * Sets the execution state and emits progress event.
   *
   * @param state - New execution state
   */
  setState(state: AgentExecutionState): void {
    this.state = state
    this.emitProgress()
  }

  /**
   * Gets the current step information for the progress indicator.
   *
   * Returns step number, total steps, and a human-readable label.
   *
   * @returns Progress info object
   */
  getCurrentStep(): DevAgentProgressInfo {
    switch (this.state) {
      case 'idle':
        return {
          step: 0,
          total: 3,
          label: 'Ready'
        }
      case 'dev_implementing':
        // Story says "Step 2/3: DEV Implementing"
        // SM is step 1 but typically skipped when story file already exists
        return {
          step: 2,
          total: 3,
          label: 'Step 2/3: DEV Implementing'
        }
      case 'code_reviewing':
        return {
          step: 3,
          total: 3,
          label: 'Step 3/3: Code Review'
        }
    }
  }

  /**
   * Subscribes to progress events.
   *
   * @param listener - Callback function to receive progress updates
   * @returns Unsubscribe function
   */
  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Disposes the service and removes all listeners.
   */
  dispose(): void {
    this.listeners.clear()
  }

  /**
   * Emits the current progress to all listeners.
   */
  private emitProgress(): void {
    const progress = this.getCurrentStep()
    for (const listener of this.listeners) {
      listener(progress)
    }
  }
}

// Singleton instance for use across the application
export const devAgentProgressService = new DevAgentProgressService()
