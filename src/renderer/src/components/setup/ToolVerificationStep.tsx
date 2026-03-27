/**
 * ToolVerificationStep
 *
 * Step 2 of the onboarding wizard — shows tool checklist and BMAD config form
 * when BMAD needs installation.
 */

import React, { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { ToolCheckList } from './ToolCheckList'
import { BmadConfigForm } from './BmadConfigForm'
import { trpc } from '@renderer/lib/trpc'

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

  // Tool verification query
  const {
    data: toolResults,
    isFetching: isChecking,
    refetch: recheckTools
  } = trpc.project.verifyTools.useQuery({ projectPath })

  // BMAD available modules/tools/languages
  const { data: availableModulesData } = trpc.bmad.availableModules.useQuery()

  // BMAD check status for pre-population
  const { data: bmadStatus } = trpc.bmad.checkStatus.useQuery()

  // Pre-populate from existing BMAD config
  useEffect(() => {
    if (bmadStatus?.installed) {
      if (bmadStatus.modules && bmadStatus.modules.length > 0) {
        setBmadModules(bmadStatus.modules)
      }
      if (bmadStatus.tools && bmadStatus.tools.length > 0) {
        setBmadTools(bmadStatus.tools)
      }
    }
  }, [bmadStatus])

  // Notify parent whether all critical tools pass
  useEffect(() => {
    if (!toolResults) return
    const allCriticalPassed = toolResults
      .filter((r) => r.critical)
      .every((r) => r.status === 'installed')
    onAllCriticalPassed(allCriticalPassed)
  }, [toolResults, onAllCriticalPassed])

  // BMAD install mutation
  const bmadInstallMutation = trpc.bmad.installToPath.useMutation({
    onSuccess: () => {
      toast.success('BMAD Framework installed successfully!')
      recheckTools()
    },
    onError: (err) => {
      toast.error(`BMAD installation failed: ${err.message}`)
    }
  })

  // Node.js install mutation
  const installNodeMutation = trpc.bmad.installNodejs.useMutation({
    onSuccess: () => {
      toast.success('Node.js installed successfully!')
      recheckTools()
    },
    onError: (err) => {
      toast.error(`Node.js installation failed: ${err.message}`)
    }
  })

  function handleInstallAction(toolId: string): void {
    if (toolId === 'nodejs') {
      installNodeMutation.mutate()
    }
    // Other tools show install hints in the list — no action needed here
  }

  function handleInstallBmad(): void {
    bmadInstallMutation.mutate({
      projectPath,
      modules: bmadModules,
      tools: bmadTools,
      userName,
      communicationLanguage: language,
      documentOutputLanguage: language
    })
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

  // Show BMAD config form when BMAD is not yet installed
  const bmadNeedsInstall =
    toolResults?.some((r) => r.id === 'bmad' && r.status !== 'installed') ?? false

  const modules = availableModulesData?.modules ?? []
  const tools = availableModulesData?.tools ?? []
  const languages = availableModulesData?.languages ?? ['English']

  return (
    <div className="space-y-5">
      {/* Header with Re-check button */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Tool Verification</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => recheckTools()}
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
        results={toolResults ?? []}
        isChecking={isChecking}
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
            modules={modules}
            tools={tools}
            languages={languages}
            disabled={bmadInstallMutation.isPending}
          />

          <Button
            onClick={handleInstallBmad}
            disabled={bmadInstallMutation.isPending || !userName.trim()}
            data-testid="install-bmad-btn"
          >
            {bmadInstallMutation.isPending ? (
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
