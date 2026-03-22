/**
 * PersonaContextService - Story 10.4
 *
 * Loads BMAD agent persona markdown files and project config,
 * then combines them into a context injection string for CLI sessions.
 *
 * Runs in the main process only. NEVER import this in the renderer.
 *
 * @see Story 10.4: BMAD Agent Persona Context Injection (AC: 1-5)
 */

import fs from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'

/** Parsed project config from _bmad/bmm/config.yaml */
export interface BmadProjectConfig {
  user_name: string
  project_name: string
  planning_artifacts: string
  output_folder: string
  communication_language: string
}

/**
 * Maps persona keys (used in renderer's AGENT_PERSONA_CONFIG and chat_sessions.agent_persona)
 * to their corresponding .md file paths relative to the _bmad/ directory.
 */
const PERSONA_FILE_MAP: Readonly<Record<string, string>> = Object.freeze({
  'bmad:bmm:agents:pm': 'bmm/agents/pm.md',
  'bmad:bmm:agents:architect': 'bmm/agents/architect.md',
  'bmad:bmm:agents:ux-designer': 'bmm/agents/ux-designer.md',
  'bmad:bmm:agents:analyst': 'bmm/agents/analyst.md'
})

/**
 * Service for loading and formatting BMAD agent persona context.
 *
 * Reads persona markdown files from disk and combines them with project
 * config to produce a context injection string sent as the first CLI message.
 *
 * CRITICAL: Main process only. Never import in renderer.
 */
export class PersonaContextService {
  private bmadRoot: string
  private projectRoot: string
  private cachedConfig: BmadProjectConfig | null = null

  /**
   * @param bmadRoot - Absolute path to the _bmad directory
   * @param projectRoot - Absolute path to the project root
   */
  constructor(bmadRoot: string, projectRoot: string) {
    this.bmadRoot = bmadRoot
    this.projectRoot = projectRoot
  }

  /**
   * Load project config from _bmad/bmm/config.yaml.
   *
   * Parses YAML, resolves {project-root} placeholders in values,
   * and caches the result after first load.
   *
   * @returns Parsed and resolved project config
   * @throws Error if config file cannot be read or parsed
   */
  loadConfig(): BmadProjectConfig {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    const configPath = join(this.bmadRoot, 'bmm', 'config.yaml')
    const rawContent = fs.readFileSync(configPath, 'utf-8')
    const parsed = parseYaml(rawContent) as Record<string, string>

    const resolve = (value: string | undefined): string => {
      if (!value) return ''
      return value.replace(/\{project-root\}/g, this.projectRoot)
    }

    this.cachedConfig = {
      user_name: parsed.user_name ?? '',
      project_name: parsed.project_name ?? '',
      planning_artifacts: resolve(parsed.planning_artifacts),
      output_folder: resolve(parsed.output_folder),
      communication_language: parsed.communication_language ?? 'English'
    }

    return this.cachedConfig
  }

  /**
   * Build the full context injection string for a persona.
   *
   * Loads the persona's markdown file and project config, then formats
   * them into a structured context string for CLI injection.
   *
   * @param personaKey - The persona identifier (e.g., 'bmad:bmm:agents:pm')
   * @returns Formatted context injection string
   * @throws Error if personaKey is unknown or persona file cannot be read
   *
   * @see AC 1-5: Persona context with project config
   */
  buildContext(personaKey: string): string {
    const relativePath = PERSONA_FILE_MAP[personaKey]
    if (!relativePath) {
      throw new Error(
        `Unknown persona key: "${personaKey}". Valid keys: ${Object.keys(PERSONA_FILE_MAP).join(', ')}`
      )
    }

    const personaFilePath = join(this.bmadRoot, relativePath)
    const personaContent = fs.readFileSync(personaFilePath, 'utf-8')

    const config = this.loadConfig()

    return [
      `You are acting as a BMAD planning agent in ${config.project_name}. Follow the persona instructions below.`,
      '',
      '<persona-instructions>',
      personaContent,
      '</persona-instructions>',
      '',
      '<project-config>',
      `Project: ${config.project_name}`,
      `User: ${config.user_name}`,
      `Communication Language: ${config.communication_language}`,
      `Planning Artifacts Output: ${config.planning_artifacts}`,
      `Output Folder: ${config.output_folder}`,
      '</project-config>',
      '',
      `IMPORTANT: When producing any artifacts (PRDs, architecture docs, etc.), save them to: ${config.planning_artifacts}/`
    ].join('\n')
  }

  /**
   * Get the absolute path to a persona's markdown file.
   *
   * @param personaKey - The persona identifier
   * @returns Absolute path if personaKey is known, null otherwise
   */
  getPersonaFilePath(personaKey: string): string | null {
    const relativePath = PERSONA_FILE_MAP[personaKey]
    if (!relativePath) return null
    return join(this.bmadRoot, relativePath)
  }
}
