import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import {
  ProjectConfig,
  ProjectConfigSchema,
  ProjectConfigUpdate
} from '../../shared/types/config.types'

/**
 * Custom error class for configuration-related errors.
 * Provides clear, user-friendly error messages.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'WRITE_ERROR',
    public readonly details?: string
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Service for managing project configuration stored in YAML format.
 * Handles reading, writing, and validation of .tinsu/config.yaml
 */
export class ConfigService {
  private readonly configDir: string
  private readonly configPath: string

  constructor(projectRoot: string) {
    this.configDir = path.join(projectRoot, '.tinsu')
    this.configPath = path.join(this.configDir, 'config.yaml')
  }

  /**
   * Returns the full path to the config file.
   */
  getConfigPath(): string {
    return this.configPath
  }

  /**
   * Loads the configuration from disk.
   * @throws ConfigError if file doesn't exist, has invalid YAML, or fails validation
   */
  loadConfig(): ProjectConfig {
    // Check if file exists
    if (!fs.existsSync(this.configPath)) {
      throw new ConfigError(
        'Config file not found. Run getOrCreateConfig() to create a default config.',
        'NOT_FOUND'
      )
    }

    // Read file content
    let content: string
    try {
      content = fs.readFileSync(this.configPath, 'utf-8')
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      throw new ConfigError(`Failed to read config file: ${err.message}`, 'PARSE_ERROR', err.code)
    }

    // Parse YAML
    let parsed: unknown
    try {
      parsed = yaml.load(content)
    } catch (error) {
      const yamlError = error as yaml.YAMLException
      throw new ConfigError(
        `Invalid YAML syntax in config file: ${yamlError.message}`,
        'PARSE_ERROR',
        yamlError.mark
          ? `Line ${yamlError.mark.line + 1}, Column ${yamlError.mark.column + 1}`
          : undefined
      )
    }

    // Validate with Zod schema
    const result = ProjectConfigSchema.safeParse(parsed)
    if (!result.success) {
      // Zod v4 uses 'issues' instead of 'errors'
      const issues = result.error.issues || []
      const fieldErrors = issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      throw new ConfigError(
        `Invalid config: ${fieldErrors}`,
        'VALIDATION_ERROR',
        result.error.message
      )
    }

    return result.data
  }

  /**
   * Saves the configuration to disk.
   * Creates the .tinsu directory if it doesn't exist.
   */
  saveConfig(config: ProjectConfig): void {
    // Validate before saving
    const result = ProjectConfigSchema.safeParse(config)
    if (!result.success) {
      // Zod v4 uses 'issues' instead of 'errors'
      const issues = result.error.issues || []
      const fieldErrors = issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      throw new ConfigError(`Invalid config: ${fieldErrors}`, 'VALIDATION_ERROR')
    }

    // Ensure directory exists
    this.ensureConfigDir()

    // Convert to YAML and write
    try {
      const yamlContent = yaml.dump(result.data, {
        indent: 2,
        lineWidth: 120,
        quotingType: '"',
        forceQuotes: false
      })
      fs.writeFileSync(this.configPath, yamlContent, 'utf-8')
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      throw new ConfigError(`Failed to write config file: ${err.message}`, 'WRITE_ERROR', err.code)
    }
  }

  /**
   * Gets the current config or creates a default one if it doesn't exist.
   * This is the main entry point for getting configuration.
   */
  getOrCreateConfig(): ProjectConfig {
    if (fs.existsSync(this.configPath)) {
      return this.loadConfig()
    }

    // Create default config
    const defaultConfig = this.createDefaultConfig()
    this.saveConfig(defaultConfig)
    return defaultConfig
  }

  /**
   * Updates specific fields in the config while preserving others.
   * @throws ConfigError if the config file doesn't exist
   */
  updateConfig(updates: ProjectConfigUpdate): ProjectConfig {
    // Load existing config (will throw if doesn't exist)
    const current = this.loadConfig()

    // Merge updates
    const updated: ProjectConfig = {
      ...current,
      ...updates
    }

    // Save merged config
    this.saveConfig(updated)

    return updated
  }

  /**
   * Creates a default configuration for a new project.
   */
  private createDefaultConfig(): ProjectConfig {
    // Try to detect project name from folder
    const projectName = this.detectProjectName()

    return {
      projectName,
      methodology: 'bmad',
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }
  }

  /**
   * Attempts to detect the project name from package.json or folder name.
   */
  private detectProjectName(): string {
    // Try package.json first
    const packageJsonPath = path.join(path.dirname(this.configDir), 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        if (packageJson.name && typeof packageJson.name === 'string') {
          return packageJson.name
        }
      } catch {
        // Ignore errors, fall back to folder name
      }
    }

    // Fall back to folder name
    return path.basename(path.dirname(this.configDir))
  }

  /**
   * Ensures the .tinsu directory exists.
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true })
    }
  }
}
