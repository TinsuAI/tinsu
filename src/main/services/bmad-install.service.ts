import { exec } from 'child_process'
import { shell } from 'electron'

/**
 * Service for managing BMAD Method installation and status.
 *
 * Handles Node.js detection, BMAD CLI operations, and module management.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class BmadInstallService {
  /**
   * Checks if Node.js is installed and returns the version.
   *
   * @returns Object with installed flag and version string
   */
  static checkNodejs(): Promise<{ installed: boolean; version: string | null }> {
    return new Promise((resolve) => {
      exec('node --version', (error, stdout) => {
        if (error) {
          resolve({ installed: false, version: null })
        } else {
          resolve({ installed: true, version: stdout.trim() })
        }
      })
    })
  }

  /**
   * Guides the user to install Node.js based on their operating system.
   *
   * - Linux: opens a terminal with the nodesource install script
   * - macOS: opens Terminal.app with brew install node
   * - Windows: opens the Node.js download page in the browser
   * - Fallback: opens the Node.js download page
   *
   * @returns Object with success flag and optional error message
   */
  static async installNodejs(): Promise<{ success: boolean; error?: string }> {
    try {
      const platform = process.platform

      if (platform === 'linux') {
        exec(
          'x-terminal-emulator -e "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs && echo Done && read"'
        )
        return { success: true }
      } else if (platform === 'darwin') {
        exec(
          'open -a Terminal.app "$(echo \'brew install node || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install --lts)\')"'
        )
        return { success: true }
      } else if (platform === 'win32') {
        await shell.openExternal('https://nodejs.org/en/download/')
        return { success: true }
      } else {
        await shell.openExternal('https://nodejs.org/en/download/')
        return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open Node.js installer'
      }
    }
  }
}
