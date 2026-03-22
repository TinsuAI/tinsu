import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { shell } from 'electron'
import type { BmadStatus } from '../../shared/types/bmad.types'

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

  /**
   * Checks the BMAD installation status for a project.
   *
   * First checks if `_bmad/` directory exists, then runs the BMAD CLI
   * status command. Falls back to reading config.yaml if CLI fails.
   *
   * @param projectPath - Path to the project root
   * @returns BmadStatus with installed flag, version, and modules
   */
  static async checkBmadStatus(projectPath: string): Promise<BmadStatus> {
    const bmadDir = path.join(projectPath, '_bmad')

    if (!fs.existsSync(bmadDir)) {
      return { installed: false }
    }

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        exec(
          'npx --yes bmad-method status',
          { cwd: projectPath },
          (error, stdout) => {
            if (error) {
              reject(error)
            } else {
              resolve(stdout)
            }
          }
        )
      })

      return BmadInstallService.parseStatusOutput(stdout)
    } catch {
      return BmadInstallService.parseConfigFallback(projectPath)
    }
  }

  /**
   * Parses the output of `npx bmad-method status` into a BmadStatus object.
   */
  private static parseStatusOutput(stdout: string): BmadStatus {
    const status: BmadStatus = { installed: true }

    // Parse version from "│  Version:       6.2.0"
    const versionMatch = stdout.match(/Version:\s+(\S+)/)
    if (versionMatch) {
      status.version = versionMatch[1]
    }

    // Parse module names from lines like "│    core                 6.2.0 ✓"
    const modules: string[] = []
    const moduleRegex = /│\s{4}(\w+)\s+[\d.]+\s+[✓✗]/g
    let match: RegExpExecArray | null
    while ((match = moduleRegex.exec(stdout)) !== null) {
      modules.push(match[1])
    }

    if (modules.length > 0) {
      status.modules = modules
    }

    return status
  }

  /**
   * Fallback: reads _bmad/bmm/config.yaml when CLI is unavailable.
   */
  private static parseConfigFallback(projectPath: string): BmadStatus {
    try {
      const configPath = path.join(projectPath, '_bmad', 'bmm', 'config.yaml')
      fs.readFileSync(configPath, 'utf-8')
      return { installed: true }
    } catch {
      return { installed: true }
    }
  }
}
