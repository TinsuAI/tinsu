import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/** Timeout for tmux commands in milliseconds */
const TMUX_COMMAND_TIMEOUT = 5000

/**
 * Error type returned by promisified exec
 */
interface ExecError extends Error {
  code?: number
  stderr?: string
  cmd?: string
}

/**
 * Service for detecting and interacting with tmux.
 *
 * Uses `tmux -V` to check if tmux is available and get version info.
 * Results are cached for performance (cleared per-session or manually).
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class TmuxService {
  private static cachedIsInstalled: boolean | null = null
  private static cachedVersion: string | null = null

  /**
   * Checks if tmux is installed and available in PATH.
   *
   * Results are cached after first check to avoid repeated shell calls.
   * Use `clearCache()` to force re-check.
   *
   * @returns true if `tmux` command is found, false if not installed
   * @throws Error if tmux check fails due to non-installation issues
   *         (e.g., permission denied, timeout, tmux crash)
   *
   * @example
   * ```typescript
   * try {
   *   const installed = await TmuxService.checkTmuxInstalled()
   *   if (!installed) {
   *     dialog.showErrorBox('tmux Required', 'Please install tmux')
   *   }
   * } catch (error) {
   *   // Handle other errors (permission denied, etc.)
   * }
   * ```
   */
  static async checkTmuxInstalled(): Promise<boolean> {
    // Return cached result if available
    if (this.cachedIsInstalled !== null) {
      return this.cachedIsInstalled
    }

    try {
      await execAsync('tmux -V', { timeout: TMUX_COMMAND_TIMEOUT })
      this.cachedIsInstalled = true
      return true
    } catch (error) {
      const execError = error as ExecError
      // Exit code 127 = command not found (shell)
      // This is the definitive "tmux not installed" case
      if (execError.code === 127) {
        this.cachedIsInstalled = false
        return false
      }
      // For other errors (permission denied, timeout, tmux crash, etc.),
      // throw so caller can handle appropriately (AC#3)
      throw error
    }
  }

  /**
   * Gets the installed tmux version.
   *
   * Parses the output of `tmux -V` which returns strings like "tmux 3.4" or "tmux next-3.5".
   *
   * @returns The version string (e.g., "3.4") if found, null otherwise
   *
   * @example
   * ```typescript
   * const version = await TmuxService.getTmuxVersion()
   * if (version) {
   *   console.log(`tmux version: ${version}`)
   * }
   * ```
   */
  static async getTmuxVersion(): Promise<string | null> {
    // Return cached version if available
    if (this.cachedVersion !== null) {
      return this.cachedVersion
    }

    try {
      const { stdout } = await execAsync('tmux -V', { timeout: TMUX_COMMAND_TIMEOUT })
      // tmux -V outputs "tmux X.Y" or "tmux next-X.Y"
      const trimmed = stdout.trim()
      // Extract version part after "tmux "
      const versionMatch = trimmed.match(/^tmux\s+(.+)$/)
      if (versionMatch) {
        this.cachedVersion = versionMatch[1]
        return this.cachedVersion
      }
      // If no match, return the full output
      this.cachedVersion = trimmed
      return this.cachedVersion
    } catch {
      return null
    }
  }

  /**
   * Clears the cached installation and version check results.
   *
   * Call this when you want to force a fresh check (e.g., after
   * user attempts to install tmux).
   */
  static clearCache(): void {
    this.cachedIsInstalled = null
    this.cachedVersion = null
  }

  /**
   * Gets platform-specific installation instructions for tmux.
   *
   * @returns A formatted string with install instructions for the current platform
   */
  static getInstallInstructions(): string {
    return `TinSu requires tmux for per-task terminal sessions.

Please install tmux:

macOS:
  brew install tmux

Linux (Debian/Ubuntu):
  sudo apt install tmux

Linux (Fedora/RHEL):
  sudo dnf install tmux

After installing, restart TinSu.`
  }
}
