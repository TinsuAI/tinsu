import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Service for detecting Claude Code CLI installation.
 *
 * Uses the `which` command to check if `claude` is available in PATH.
 * Results are cached for performance (cleared per-session or manually).
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class ClaudeCliDetectorService {
  private static cachedIsInstalled: boolean | null = null

  /**
   * Checks if Claude Code CLI is installed and available in PATH.
   *
   * Results are cached after first check to avoid repeated shell calls.
   * Use `clearCache()` to force re-check.
   *
   * @returns true if `claude` command is found, false otherwise
   *
   * @example
   * ```typescript
   * const installed = await ClaudeCliDetectorService.isClaudeCodeInstalled()
   * if (!installed) {
   *   throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Install Claude Code CLI' })
   * }
   * ```
   */
  static async isClaudeCodeInstalled(): Promise<boolean> {
    // Return cached result if available
    if (this.cachedIsInstalled !== null) {
      return this.cachedIsInstalled
    }

    try {
      await execAsync('which claude')
      this.cachedIsInstalled = true
      return true
    } catch {
      this.cachedIsInstalled = false
      return false
    }
  }

  /**
   * Gets the full path to the Claude Code CLI executable.
   *
   * @returns The path to `claude` if found, null otherwise
   *
   * @example
   * ```typescript
   * const path = await ClaudeCliDetectorService.getClaudeCodePath()
   * if (path) {
   *   console.log(`Claude CLI found at: ${path}`)
   * }
   * ```
   */
  static async getClaudeCodePath(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('which claude')
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * Clears the cached installation check result.
   *
   * Call this when you want to force a fresh check (e.g., after
   * user attempts to install Claude CLI).
   */
  static clearCache(): void {
    this.cachedIsInstalled = null
  }
}
