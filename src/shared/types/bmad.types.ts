// src/shared/types/bmad.types.ts

export interface BmadInstallOptions {
  modules: string[]
  tools: string[]
  userName: string
  communicationLanguage: string
  documentOutputLanguage: string
  outputFolder: string
}

export interface BmadStatus {
  installed: boolean
  version?: string
  modules?: string[]
  tools?: string[]
}

export interface BmadModule {
  id: string
  name: string
  builtIn: boolean
}

export const BMAD_MODULES: BmadModule[] = [
  { id: 'core', name: 'Core Framework', builtIn: true },
  { id: 'bmm', name: 'Core Method', builtIn: true },
  { id: 'bmb', name: 'Build', builtIn: false },
  { id: 'cis', name: 'Creative Innovation Skills', builtIn: false },
  { id: 'tea', name: 'Test Engineering Architecture', builtIn: false },
  { id: 'wds', name: 'Web Design System', builtIn: false }
]

export interface BmadTool {
  id: string
  name: string
  preferred: boolean
  category: 'cli' | 'ide'
}

export const BMAD_TOOLS: BmadTool[] = [
  // Recommended
  { id: 'claude-code', name: 'Claude Code', preferred: true, category: 'cli' },
  { id: 'codex', name: 'Codex', preferred: true, category: 'cli' },
  { id: 'cursor', name: 'Cursor', preferred: true, category: 'ide' },
  { id: 'github-copilot', name: 'GitHub Copilot', preferred: true, category: 'ide' },
  // Other IDEs
  { id: 'cline', name: 'Cline', preferred: false, category: 'ide' },
  { id: 'codebuddy', name: 'CodeBuddy', preferred: false, category: 'ide' },
  { id: 'crush', name: 'Crush', preferred: false, category: 'ide' },
  { id: 'firebender', name: 'Firebender', preferred: false, category: 'ide' },
  { id: 'iflow', name: 'iFlow', preferred: false, category: 'ide' },
  { id: 'junie', name: 'Junie', preferred: false, category: 'ide' },
  { id: 'kilo', name: 'KiloCoder', preferred: false, category: 'ide' },
  { id: 'kimi-code', name: 'Kimi Code', preferred: false, category: 'ide' },
  { id: 'kiro', name: 'Kiro', preferred: false, category: 'ide' },
  { id: 'kode', name: 'Kode', preferred: false, category: 'ide' },
  { id: 'neovate', name: 'Neovate', preferred: false, category: 'ide' },
  { id: 'ona', name: 'Ona', preferred: false, category: 'ide' },
  { id: 'opencode', name: 'OpenCode', preferred: false, category: 'ide' },
  { id: 'pochi', name: 'Pochi', preferred: false, category: 'ide' },
  { id: 'qoder', name: 'Qoder', preferred: false, category: 'ide' },
  { id: 'qwen', name: 'QwenCoder', preferred: false, category: 'ide' },
  { id: 'replit', name: 'Replit Agent', preferred: false, category: 'ide' },
  { id: 'roo', name: 'Roo Code', preferred: false, category: 'ide' },
  { id: 'rovo-dev', name: 'Rovo Dev', preferred: false, category: 'ide' },
  { id: 'cortex', name: 'Snowflake Cortex Code', preferred: false, category: 'ide' },
  { id: 'trae', name: 'Trae', preferred: false, category: 'ide' },
  { id: 'windsurf', name: 'Windsurf', preferred: false, category: 'ide' },
  { id: 'zencoder', name: 'Zencoder', preferred: false, category: 'ide' },
  // Other CLIs
  { id: 'adal', name: 'AdaL', preferred: false, category: 'cli' },
  { id: 'amp', name: 'Sourcegraph Amp', preferred: false, category: 'cli' },
  { id: 'antigravity', name: 'Google Antigravity', preferred: false, category: 'cli' },
  { id: 'auggie', name: 'Auggie', preferred: false, category: 'cli' },
  { id: 'bob', name: 'IBM Bob', preferred: false, category: 'cli' },
  { id: 'command-code', name: 'Command Code', preferred: false, category: 'cli' },
  { id: 'droid', name: 'Factory Droid', preferred: false, category: 'cli' },
  { id: 'gemini', name: 'Gemini CLI', preferred: false, category: 'cli' },
  { id: 'goose', name: 'Block Goose', preferred: false, category: 'cli' },
  { id: 'mistral-vibe', name: 'Mistral Vibe', preferred: false, category: 'cli' },
  { id: 'mux', name: 'Mux', preferred: false, category: 'cli' },
  { id: 'openclaw', name: 'OpenClaw', preferred: false, category: 'cli' },
  { id: 'openhands', name: 'OpenHands', preferred: false, category: 'cli' },
  { id: 'pi', name: 'Pi', preferred: false, category: 'cli' },
  { id: 'warp', name: 'Warp', preferred: false, category: 'cli' },
]

export const BMAD_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Italian',
  'Dutch'
]
