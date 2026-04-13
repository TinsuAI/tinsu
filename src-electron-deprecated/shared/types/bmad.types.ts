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
  { id: 'windsurf', name: 'Windsurf', preferred: true, category: 'ide' },
  { id: 'cursor', name: 'Cursor', preferred: true, category: 'ide' },
  // Other IDEs
  { id: 'cline', name: 'Cline', preferred: false, category: 'ide' },
  { id: 'opencode', name: 'OpenCode', preferred: false, category: 'ide' },
  { id: 'roo', name: 'Roo Cline', preferred: false, category: 'ide' },
  { id: 'rovo', name: 'Rovo', preferred: false, category: 'ide' },
  { id: 'rovo-dev', name: 'Rovo Dev', preferred: false, category: 'ide' },
  { id: 'github-copilot', name: 'GitHub Copilot', preferred: false, category: 'ide' },
  { id: 'qwen', name: 'QwenCoder', preferred: false, category: 'ide' },
  { id: 'iflow', name: 'iFlow', preferred: false, category: 'ide' },
  { id: 'kilo', name: 'KiloCoder', preferred: false, category: 'ide' },
  { id: 'crush', name: 'Crush', preferred: false, category: 'ide' },
  { id: 'antigravity', name: 'Google Antigravity', preferred: false, category: 'ide' },
  { id: 'trae', name: 'Trae', preferred: false, category: 'ide' },
  // Other CLIs
  { id: 'auggie', name: 'Auggie', preferred: false, category: 'cli' },
  { id: 'kiro-cli', name: 'Kiro CLI', preferred: false, category: 'cli' },
  { id: 'codex', name: 'Codex', preferred: false, category: 'cli' },
  { id: 'gemini', name: 'Gemini CLI', preferred: false, category: 'cli' },
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
