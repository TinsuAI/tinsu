import { exec } from 'child_process'

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
}
