import { exec } from 'child_process'
import type { ToolCheckResult } from '../../shared/types/tool-verification.types'
import { TmuxService } from './tmux.service'
import { BmadInstallService } from './bmad-install.service'

/**
 * Service for verifying that all required external tools are installed.
 *
 * Used by the onboarding wizard to check prerequisites before setting up
 * a project. Each check returns a ToolCheckResult with status information
 * and install hints for missing tools.
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class ToolVerificationService {
  /**
   * Checks if git is installed and returns its version.
   *
   * Runs `git --version` and parses the semver from output like "git version 2.43.0".
   *
   * @returns ToolCheckResult with id 'git'
   */
  static checkGit(): Promise<ToolCheckResult> {
    return new Promise((resolve) => {
      exec('git --version', (error, stdout) => {
        if (error) {
          resolve({
            id: 'git',
            name: 'Git',
            status: 'missing',
            critical: true,
            installHint: ToolVerificationService.gitInstallHint()
          })
        } else {
          // Parse version from "git version X.Y.Z"
          const match = stdout.trim().match(/git version (.+)/)
          const version = match ? match[1].trim() : undefined
          resolve({
            id: 'git',
            name: 'Git',
            status: 'installed',
            version,
            critical: true
          })
        }
      })
    })
  }

  /**
   * Checks if tmux is installed by delegating to TmuxService.
   *
   * @returns ToolCheckResult with id 'tmux'
   */
  static async checkTmux(): Promise<ToolCheckResult> {
    try {
      const installed = await TmuxService.checkTmuxInstalled()
      if (installed) {
        const version = await TmuxService.getTmuxVersion().catch(() => null)
        return {
          id: 'tmux',
          name: 'tmux',
          status: 'installed',
          version: version ?? undefined,
          critical: true
        }
      }
      return {
        id: 'tmux',
        name: 'tmux',
        status: 'missing',
        critical: true,
        installHint: TmuxService.getInstallInstructions()
      }
    } catch {
      return {
        id: 'tmux',
        name: 'tmux',
        status: 'error',
        critical: true,
        installHint: TmuxService.getInstallInstructions()
      }
    }
  }

  /**
   * Checks if Node.js is installed by delegating to BmadInstallService.
   *
   * @returns ToolCheckResult with id 'nodejs'
   */
  static async checkNodejs(): Promise<ToolCheckResult> {
    const result = await BmadInstallService.checkNodejs()
    if (result.installed) {
      return {
        id: 'nodejs',
        name: 'Node.js',
        status: 'installed',
        version: result.version ? result.version.replace(/^v/, '') : undefined,
        critical: true
      }
    }
    return {
      id: 'nodejs',
      name: 'Node.js',
      status: 'missing',
      critical: true,
      installHint: ToolVerificationService.nodejsInstallHint()
    }
  }

  /**
   * Checks if the Claude CLI is installed and returns its version.
   *
   * Runs `claude --version` and parses the version from output.
   *
   * @returns ToolCheckResult with id 'claude-cli'
   */
  static checkClaude(): Promise<ToolCheckResult> {
    return new Promise((resolve) => {
      exec('claude --version', (error, stdout) => {
        if (error) {
          resolve({
            id: 'claude-cli',
            name: 'Claude CLI',
            status: 'missing',
            critical: true,
            installHint: 'npm install -g @anthropic-ai/claude-code'
          })
        } else {
          const version = stdout.trim() || undefined
          resolve({
            id: 'claude-cli',
            name: 'Claude CLI',
            status: 'installed',
            version,
            critical: true
          })
        }
      })
    })
  }

  /**
   * Checks if BMAD is installed in the given project by delegating to BmadInstallService.
   *
   * @param projectPath - Path to the project root
   * @returns ToolCheckResult with id 'bmad'
   */
  static async checkBmad(projectPath: string): Promise<ToolCheckResult> {
    const status = await BmadInstallService.checkBmadStatus(projectPath)
    if (status.installed) {
      return {
        id: 'bmad',
        name: 'BMAD Method',
        status: 'installed',
        version: status.version,
        critical: true
      }
    }
    return {
      id: 'bmad',
      name: 'BMAD Method',
      status: 'missing',
      critical: true,
      installHint: 'BMAD can be installed from the setup wizard below.'
    }
  }

  /**
   * Verifies all 5 tools in parallel: git, tmux, nodejs, claude-cli, bmad.
   *
   * @param projectPath - Path to the project root (used for bmad check)
   * @returns Array of ToolCheckResult in order [git, tmux, nodejs, claude-cli, bmad]
   */
  static async verifyAllTools(projectPath: string): Promise<ToolCheckResult[]> {
    return Promise.all([
      ToolVerificationService.checkGit(),
      ToolVerificationService.checkTmux(),
      ToolVerificationService.checkNodejs(),
      ToolVerificationService.checkClaude(),
      ToolVerificationService.checkBmad(projectPath)
    ])
  }

  /**
   * Verifies health tools (git, tmux, nodejs, claude-cli) in parallel — no bmad.
   *
   * Used for startup health checks where bmad project-specific checks are not needed.
   *
   * @returns Array of ToolCheckResult in order [git, tmux, nodejs, claude-cli]
   */
  static async verifyHealthTools(): Promise<ToolCheckResult[]> {
    return Promise.all([
      ToolVerificationService.checkGit(),
      ToolVerificationService.checkTmux(),
      ToolVerificationService.checkNodejs(),
      ToolVerificationService.checkClaude()
    ])
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static gitInstallHint(): string {
    const platform = process.platform
    if (platform === 'darwin') {
      return 'Install git via Homebrew: brew install git'
    }
    if (platform === 'linux') {
      return 'Install git: sudo apt install git  or  sudo dnf install git'
    }
    return 'Download git from https://git-scm.com/downloads'
  }

  private static nodejsInstallHint(): string {
    const platform = process.platform
    if (platform === 'darwin') {
      return 'Install Node.js via Homebrew: brew install node  or  visit https://nodejs.org'
    }
    if (platform === 'linux') {
      return 'Install Node.js: sudo apt install nodejs  or  visit https://nodejs.org'
    }
    return 'Download Node.js from https://nodejs.org'
  }
}
