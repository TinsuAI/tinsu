/**
 * ToolVerificationStep
 *
 * Step 2 of the onboarding wizard — shows tool checklist and BMAD config form
 * when BMAD needs installation. Uses Tauri commands directly (no tRPC).
 */

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { ToolCheckList } from './ToolCheckList'
import { BmadConfigForm } from './BmadConfigForm'
import { commands } from '@renderer/lib/rspc'
import { BMAD_MODULES, BMAD_TOOLS, BMAD_LANGUAGES } from '@shared/types/bmad.types'
import type { ToolCheckResult } from '@shared/types/tool-verification.types'

export interface ToolVerificationStepProps {
  projectPath: string
  onAllCriticalPassed: (passed: boolean) => void
}

export function ToolVerificationStep({
  projectPath,
  onAllCriticalPassed
}: ToolVerificationStepProps): React.JSX.Element {
  const [userName, setUserName] = useState('')
  const [bmadModules, setBmadModules] = useState<string[]>(['core', 'bmm'])
  const [bmadTools, setBmadTools] = useState<string[]>([])
  const [language, setLanguage] = useState('English')

  const [toolResults, setToolResults] = useState<ToolCheckResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [isInstallingBmad, setIsInstallingBmad] = useState(false)
  const [isInstallingNode, setIsInstallingNode] = useState(false)

  const runVerification = useCallback(async () => {
    setIsChecking(true)
    const result = await commands.verifyTools(projectPath)
    setIsChecking(false)

    if (result.status === 'error') {
      toast.error(`Tool check failed: ${JSON.stringify(result.error)}`)
      return
    }

    const results = result.data as ToolCheckResult[]
    setToolResults(results)

    const allCriticalPassed = results
      .filter((r) => r.critical)
      .every((r) => r.status === 'installed')
    onAllCriticalPassed(allCriticalPassed)
  }, [projectPath, onAllCriticalPassed])

  // Pre-populate from existing BMAD config
  useEffect(() => {
    if (!projectPath) return
    commands.bmadCheckStatus(projectPath).then((result) => {
      if (result.status === 'error') return
      const status = result.data
      if (status.installed) {
        if (status.modules && status.modules.length > 0) {
          setBmadModules(status.modules)
        }
      }
    })
  }, [projectPath])

  // Run verification on mount
  useEffect(() => {
    runVerification()
  }, [runVerification])

  async function handleInstallAction(toolId: string): Promise<void> {
    if (toolId === 'nodejs') {
      setIsInstallingNode(true)
      const result = await commands.installNodejs()
      setIsInstallingNode(false)
      if (result.status === 'error') {
        toast.error(`Node.js installation failed: ${JSON.stringify(result.error)}`)
      } else {
        toast.success('Node.js installed successfully!')
        runVerification()
      }
    }
  }

  async function handleInstallBmad(): Promise<void> {
    setIsInstallingBmad(true)
    const result = await commands.bmadInstallToPath({
      project_path: projectPath,
      modules: bmadModules,
      tools: bmadTools,
      user_name: userName,
      communication_language: language,
      document_output_language: language,
      output_folder: null
    })
    setIsInstallingBmad(false)
    if (result.status === 'error') {
      toast.error(`BMAD installation failed: ${JSON.stringify(result.error)}`)
    } else {
      toast.success('BMAD Framework installed successfully!')
      runVerification()
    }
  }

  function toggleModule(moduleId: string): void {
    setBmadModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    )
  }

  function toggleTool(toolId: string): void {
    setBmadTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    )
  }

  const bmadNeedsInstall =
    toolResults.some((r) => r.id === 'bmad' && r.status !== 'installed') ?? false

  return (
    <div className="space-y-5">
      {/* Header with Re-check button */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Tool Verification</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => runVerification()}
          disabled={isChecking}
          data-testid="recheck-tools-btn"
        >
          {isChecking ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Re-check
        </Button>
      </div>

      {/* Tool Check List */}
      <ToolCheckList
        results={toolResults}
        isChecking={isChecking || isInstallingNode}
        onInstallAction={handleInstallAction}
      />

      {/* BMAD Config Form — shown only when BMAD needs installation */}
      {bmadNeedsInstall && (
        <div className="space-y-4">
          <hr className="border-border/50" />

          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <h4 className="text-sm font-semibold">BMAD Framework Setup</h4>
          </div>

          <BmadConfigForm
            userName={userName}
            onUserNameChange={setUserName}
            selectedModules={bmadModules}
            onToggleModule={toggleModule}
            selectedTools={bmadTools}
            onToggleTool={toggleTool}
            language={language}
            onLanguageChange={setLanguage}
            modules={BMAD_MODULES}
            tools={BMAD_TOOLS}
            languages={BMAD_LANGUAGES}
            disabled={isInstallingBmad}
          />

          <Button
            onClick={handleInstallBmad}
            disabled={isInstallingBmad || !userName.trim()}
            data-testid="install-bmad-btn"
          >
            {isInstallingBmad ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Installing BMAD...
              </>
            ) : (
              'Install BMAD'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
