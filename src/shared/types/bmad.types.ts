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
  { id: 'wds', name: 'Web Design System', builtIn: false },
]

export const BMAD_TOOLS = [
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'windsurf', name: 'Windsurf' },
]

export const BMAD_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Chinese', 'Japanese', 'Korean', 'Italian', 'Dutch',
]
