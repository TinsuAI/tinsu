import { exec, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { shell } from 'electron'
import type { BmadStatus, BmadInstallOptions } from '../../shared/types/bmad.types'

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
        await shell.openExternal('https://nodejs.org/en/download/')
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
          { cwd: projectPath, timeout: 30000 },
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
    const configPath = path.join(projectPath, '_bmad', 'bmm', 'config.yaml')
    if (fs.existsSync(configPath)) {
      return { installed: true }
    }
    return { installed: true } // _bmad dir exists even if config is missing
  }

  /**
   * Installs BMAD Method into a project.
   *
   * @param projectPath - Path to the project root
   * @param options - Installation options (modules, tools, language, etc.)
   * @returns Object with success flag and optional error message
   */
  static async installBmad(
    projectPath: string,
    options: BmadInstallOptions
  ): Promise<{ success: boolean; error?: string }> {
    return BmadInstallService.runBmadCli(projectPath, options)
  }

  /**
   * Updates an existing BMAD Method installation.
   *
   * @param projectPath - Path to the project root
   * @param options - Installation options (modules, tools, language, etc.)
   * @returns Object with success flag and optional error message
   */
  static async updateBmad(
    projectPath: string,
    options: BmadInstallOptions
  ): Promise<{ success: boolean; error?: string }> {
    return BmadInstallService.runBmadCli(projectPath, options, 'update')
  }

  /**
   * Runs the BMAD CLI install/update command via npx.
   *
   * @param projectPath - Path to the project root
   * @param options - Installation options
   * @param action - Optional action flag (e.g., 'update')
   * @returns Object with success flag and optional error message
   */
  private static runBmadCli(
    projectPath: string,
    options: BmadInstallOptions,
    action?: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const toolsArg = options.tools.length > 0 ? options.tools.join(',') : 'none'

      const args = [
        '--yes', 'bmad-method', 'install', // --yes is for npx (auto-install package)
        '--directory',
        projectPath,
        '--modules',
        options.modules.join(','),
        '--tools',
        toolsArg,
        '--user-name',
        options.userName,
        '--communication-language',
        options.communicationLanguage,
        '--document-output-language',
        options.documentOutputLanguage,
        '--output-folder',
        options.outputFolder,
        '--yes' // --yes is for bmad-method (skip interactive prompts)
      ]

      if (action) {
        args.push('--action', action)
      }

      const child = spawn('npx', args, {
        cwd: projectPath
      })

      let stderr = ''
      let resolved = false

      child.stdout?.on('data', (data: Buffer) => {
        console.log(`[bmad-cli] ${data.toString().trim()}`)
      })

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      // 120-second timeout
      const timeout = setTimeout(() => {
        child.kill()
        if (!resolved) {
          resolved = true
          resolve({ success: false, error: 'Installation timed out after 120 seconds' })
        }
      }, 120_000)

      child.on('close', (code) => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          if (code === 0) {
            resolve({ success: true })
          } else {
            resolve({
              success: false,
              error: stderr || `Process exited with code ${code}`
            })
          }
        }
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        if (!resolved) {
          resolved = true
          resolve({ success: false, error: err.message })
        }
      })
    })
  }
}
