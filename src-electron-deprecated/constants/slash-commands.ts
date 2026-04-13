/**
 * Slash command definitions for chat input autocomplete.
 *
 * Combines Claude Code CLI commands with BMAD workflow commands
 * and dynamically loaded skill manifest entries for unified `/` autocomplete.
 */

import { BMAD_WORKFLOWS } from './planning-workspace'
import { fuzzyFilter } from '@renderer/lib/fuzzy-match'

export type SlashCommandCategory =
  | 'claude-code'
  | 'workflow'
  | 'skill-core'
  | 'skill-bmm'
  | 'skill-tea'
  | 'skill-growth'
  | 'skill-custom'

export interface SlashCommandDefinition {
  command: string
  label: string
  description: string
  category: SlashCommandCategory
}

/**
 * Claude Code CLI commands relevant for chat sessions.
 * Ordered by expected frequency of use.
 */
const CLAUDE_CODE_COMMANDS: SlashCommandDefinition[] = [
  // Context & Memory
  { command: '/compact', label: 'Compact', description: 'Compact conversation to free context', category: 'claude-code' },
  { command: '/clear', label: 'Clear', description: 'Clear conversation history', category: 'claude-code' },
  { command: '/memory', label: 'Memory', description: 'Edit CLAUDE.md or toggle auto-memory', category: 'claude-code' },
  { command: '/context', label: 'Context', description: 'Visualize context usage', category: 'claude-code' },

  // Code & Tools
  { command: '/diff', label: 'Diff', description: 'Open interactive diff viewer', category: 'claude-code' },
  { command: '/plan', label: 'Plan', description: 'Enter plan mode', category: 'claude-code' },
  { command: '/security-review', label: 'Security Review', description: 'Analyze changes for vulnerabilities', category: 'claude-code' },
  { command: '/rewind', label: 'Rewind', description: 'Rewind conversation/code to prior point', category: 'claude-code' },

  // Configuration
  { command: '/model', label: 'Model', description: 'Select or change AI model', category: 'claude-code' },
  { command: '/config', label: 'Config', description: 'Open settings interface', category: 'claude-code' },
  { command: '/effort', label: 'Effort', description: 'Set model effort level', category: 'claude-code' },
  { command: '/fast', label: 'Fast', description: 'Toggle fast mode', category: 'claude-code' },
  { command: '/permissions', label: 'Permissions', description: 'View or update permissions', category: 'claude-code' },
  { command: '/vim', label: 'Vim', description: 'Toggle Vim editing mode', category: 'claude-code' },
  { command: '/theme', label: 'Theme', description: 'Change color theme', category: 'claude-code' },

  // Information
  { command: '/cost', label: 'Cost', description: 'Show token usage statistics', category: 'claude-code' },
  { command: '/status', label: 'Status', description: 'Show version, model, and connectivity', category: 'claude-code' },
  { command: '/usage', label: 'Usage', description: 'Show plan usage and rate limits', category: 'claude-code' },
  { command: '/stats', label: 'Stats', description: 'Visualize daily usage and session history', category: 'claude-code' },
  { command: '/help', label: 'Help', description: 'Show help and available commands', category: 'claude-code' },

  // Session
  { command: '/copy', label: 'Copy', description: 'Copy last response to clipboard', category: 'claude-code' },
  { command: '/export', label: 'Export', description: 'Export conversation as plain text', category: 'claude-code' },
  { command: '/rename', label: 'Rename', description: 'Rename the current session', category: 'claude-code' },
  { command: '/add-dir', label: 'Add Dir', description: 'Add a working directory to session', category: 'claude-code' },

  // Integrations
  { command: '/mcp', label: 'MCP', description: 'Manage MCP servers and auth', category: 'claude-code' },
  { command: '/hooks', label: 'Hooks', description: 'View hook configurations', category: 'claude-code' },
  { command: '/skills', label: 'Skills', description: 'List available skills', category: 'claude-code' },
  { command: '/agents', label: 'Agents', description: 'Manage agent configurations', category: 'claude-code' },
  { command: '/plugin', label: 'Plugin', description: 'Manage plugins', category: 'claude-code' },

  // Admin
  { command: '/doctor', label: 'Doctor', description: 'Diagnose and verify installation', category: 'claude-code' },
  { command: '/init', label: 'Init', description: 'Initialize project with CLAUDE.md', category: 'claude-code' },
  { command: '/login', label: 'Login', description: 'Sign in to Anthropic account', category: 'claude-code' },
  { command: '/logout', label: 'Logout', description: 'Sign out from Anthropic account', category: 'claude-code' },

  // Misc
  { command: '/voice', label: 'Voice', description: 'Toggle push-to-talk dictation', category: 'claude-code' },
  { command: '/feedback', label: 'Feedback', description: 'Submit feedback about Claude Code', category: 'claude-code' },
  { command: '/release-notes', label: 'Release Notes', description: 'View full changelog', category: 'claude-code' },
  { command: '/pr-comments', label: 'PR Comments', description: 'Fetch GitHub PR comments', category: 'claude-code' },
  { command: '/btw', label: 'BTW', description: 'Quick side question without history', category: 'claude-code' },
  { command: '/schedule', label: 'Schedule', description: 'Create or manage scheduled tasks', category: 'claude-code' },
  { command: '/insights', label: 'Insights', description: 'Generate session patterns report', category: 'claude-code' },
]

/**
 * BMAD workflow commands mapped from BMAD_WORKFLOWS.
 */
const BMAD_WORKFLOW_COMMANDS: SlashCommandDefinition[] = BMAD_WORKFLOWS.map((w) => ({
  command: w.command,
  label: w.name,
  description: w.purpose,
  category: 'workflow' as const
}))

/**
 * All available slash commands: Claude Code CLI + BMAD workflows.
 */
export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  ...CLAUDE_CODE_COMMANDS,
  ...BMAD_WORKFLOW_COMMANDS
]

/**
 * Fuzzy-filter slash commands by query string.
 * When query is empty, returns all commands unfiltered.
 */
export function fuzzyFilterCommands(
  commands: SlashCommandDefinition[],
  query: string
): SlashCommandDefinition[] {
  if (!query) return commands
  return fuzzyFilter(query, commands, (cmd) => `${cmd.command} ${cmd.label}`)
}

const MODULE_TO_CATEGORY: Record<string, SlashCommandCategory> = {
  core: 'skill-core',
  bmm: 'skill-bmm',
  tea: 'skill-tea',
  growth: 'skill-growth'
}

/**
 * Merge manifest skills into existing commands, deduplicating by command string.
 * Pipeline workflow commands (richer metadata) take precedence over manifest entries.
 */
export function mergeManifestSkills(
  manifest: { id: string; name: string; description: string; module: string }[],
  existingCommands: SlashCommandDefinition[]
): SlashCommandDefinition[] {
  const existing = new Set(existingCommands.map((c) => c.command))
  const merged = [...existingCommands]

  for (const skill of manifest) {
    const command = `/${skill.id}`
    if (existing.has(command)) continue
    existing.add(command)
    merged.push({
      command,
      label: skill.name,
      description: skill.description,
      category: MODULE_TO_CATEGORY[skill.module] ?? 'skill-custom'
    })
  }

  return merged
}
