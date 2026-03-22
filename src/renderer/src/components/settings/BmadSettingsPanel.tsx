/**
 * BMAD Settings Panel
 *
 * Settings panel for managing the BMAD framework installation.
 * Shows status, allows install/update, and manages modules/tools configuration.
 */

import { useState, useEffect } from 'react'
import { Package, AlertTriangle, CheckCircle2, Loader2, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@renderer/lib/trpc'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Badge } from '@renderer/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import type { BmadInstallOptions } from '@shared/types/bmad.types'

export function BmadSettingsPanel() {
  const utils = trpc.useUtils()

  // --- Queries ---
  const { data: nodeStatus, isLoading: nodeLoading } = trpc.bmad.checkNodejs.useQuery()
  const { data: bmadStatus, isLoading: statusLoading } = trpc.bmad.checkStatus.useQuery()
  const { data: available, isLoading: availableLoading } = trpc.bmad.availableModules.useQuery()

  // --- Form state ---
  const [userName, setUserName] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>(['bmm', 'core'])
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [language, setLanguage] = useState('English')

  // Sync form with installed status
  useEffect(() => {
    if (bmadStatus?.installed && bmadStatus.modules) {
      setSelectedModules(bmadStatus.modules)
    }
    if (bmadStatus?.installed && bmadStatus.tools) {
      setSelectedTools(bmadStatus.tools)
    }
  }, [bmadStatus])

  // --- Mutations ---
  const installMutation = trpc.bmad.install.useMutation({
    onSuccess: () => {
      utils.bmad.checkStatus.invalidate()
      toast.success('BMAD framework installed successfully')
    },
    onError: (error) => {
      toast.error('Failed to install BMAD', { description: error.message })
    }
  })

  const updateMutation = trpc.bmad.update.useMutation({
    onSuccess: () => {
      utils.bmad.checkStatus.invalidate()
      toast.success('BMAD framework updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update BMAD', { description: error.message })
    }
  })

  const installNodeMutation = trpc.bmad.installNodejs.useMutation({
    onSuccess: () => {
      utils.bmad.checkNodejs.invalidate()
      toast.success('Node.js installed successfully')
    },
    onError: (error) => {
      toast.error('Failed to install Node.js', { description: error.message })
    }
  })

  // --- Handlers ---
  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    )
  }

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    )
  }

  const buildOptions = (): BmadInstallOptions => ({
    modules: selectedModules,
    tools: selectedTools,
    userName,
    communicationLanguage: language,
    documentOutputLanguage: language,
    outputFolder: '.bmad'
  })

  const handleInstall = () => {
    installMutation.mutate(buildOptions())
  }

  const handleUpdate = () => {
    updateMutation.mutate(buildOptions())
  }

  const handleInstallNode = () => {
    installNodeMutation.mutate()
  }

  // --- Loading state ---
  const isLoading = nodeLoading || statusLoading || availableLoading
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="bmad-settings-loading">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">BMAD Framework</h3>
        </div>
        <div className="space-y-3">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  const nodeInstalled = nodeStatus?.installed ?? false
  const bmadInstalled = bmadStatus?.installed ?? false
  const isMutating = installMutation.isPending || updateMutation.isPending
  const modules = available?.modules ?? []
  const tools = available?.tools ?? []
  const languages = available?.languages ?? ['English']

  return (
    <div className="space-y-5" data-testid="bmad-settings-panel">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">BMAD Framework</h3>
        </div>
        {bmadInstalled ? (
          <Badge
            data-testid="bmad-status-badge"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Installed v{bmadStatus?.version ?? '?'}
          </Badge>
        ) : (
          <Badge
            data-testid="bmad-status-badge"
            variant="secondary"
            className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/10"
          >
            Not Installed
          </Badge>
        )}
      </div>

      {/* Node.js warning */}
      {!nodeInstalled && (
        <div
          className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"
          data-testid="node-warning"
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-amber-300">Node.js is required to install BMAD</span>
            {nodeStatus?.version && (
              <span className="text-muted-foreground text-xs">({nodeStatus.version})</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleInstallNode}
            disabled={installNodeMutation.isPending}
            data-testid="install-node-btn"
          >
            {installNodeMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Download className="mr-1 h-3 w-3" />
            )}
            Install Node.js
          </Button>
        </div>
      )}

      {/* Installed modules & tools badges */}
      {bmadInstalled && (bmadStatus?.modules?.length || bmadStatus?.tools?.length) && (
        <div className="space-y-2">
          {bmadStatus?.modules && bmadStatus.modules.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Modules:</span>
              {bmadStatus.modules.map((mod) => (
                <Badge
                  key={mod}
                  variant="outline"
                  className="text-xs font-normal px-2 py-0"
                  data-testid={`installed-module-${mod}`}
                >
                  {mod}
                </Badge>
              ))}
            </div>
          )}
          {bmadStatus?.tools && bmadStatus.tools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Tools:</span>
              {bmadStatus.tools.map((tool) => (
                <Badge
                  key={tool}
                  variant="outline"
                  className="text-xs font-normal px-2 py-0"
                  data-testid={`installed-tool-${tool}`}
                >
                  {tool}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configuration form */}
      <fieldset disabled={!nodeInstalled || isMutating} className="space-y-4">
        {/* User Name */}
        <div className="space-y-1.5">
          <Label htmlFor="bmad-username" className="text-sm font-medium">
            User Name
          </Label>
          <Input
            id="bmad-username"
            placeholder="Your name (used in BMAD templates)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            data-testid="bmad-username-input"
          />
        </div>

        {/* Modules */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Modules</Label>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((mod) => (
              <label
                key={mod.id}
                className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedModules.includes(mod.id)}
                  onCheckedChange={() => toggleModule(mod.id)}
                  data-testid={`module-checkbox-${mod.id}`}
                />
                <span>{mod.name}</span>
                {mod.builtIn && (
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                    built-in
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Tools / IDE */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tools / IDE</Label>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => (
              <label
                key={tool.id}
                className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedTools.includes(tool.id)}
                  onCheckedChange={() => toggleTool(tool.id)}
                  data-testid={`tool-checkbox-${tool.id}`}
                />
                <span>{tool.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="space-y-1.5">
          <Label htmlFor="bmad-language" className="text-sm font-medium">
            Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="bmad-language" data-testid="bmad-language-select">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {/* Action button */}
      {bmadInstalled ? (
        <Button
          onClick={handleUpdate}
          disabled={!nodeInstalled || isMutating}
          className="w-full"
          data-testid="update-bmad-btn"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Update BMAD
        </Button>
      ) : (
        <Button
          onClick={handleInstall}
          disabled={!nodeInstalled || isMutating}
          className="w-full"
          data-testid="install-bmad-btn"
        >
          {installMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Install BMAD
        </Button>
      )}
    </div>
  )
}
