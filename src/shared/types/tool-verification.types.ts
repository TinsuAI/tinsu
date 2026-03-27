export interface ToolCheckResult {
  id: string
  name: string
  status: 'installed' | 'missing' | 'error'
  version?: string
  critical: boolean
  installHint?: string
}
