/**
 * BmadConfigForm
 *
 * Reusable BMAD configuration form component extracted from BmadSettingsPanel and
 * NewProjectDialog. Renders user name, modules, tools, and language fields.
 */

import React, { useState } from 'react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import type { BmadModule, BmadTool } from '@shared/types/bmad.types'

function ToolCheckboxGrid({
  tools,
  selectedTools,
  toggleTool,
  disabled
}: {
  tools: BmadTool[]
  selectedTools: string[]
  toggleTool: (id: string) => void
  disabled: boolean
}): React.JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const preferred = tools.filter((t) => t.preferred)
  const other = tools.filter((t) => !t.preferred)

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tools / IDE</Label>
      <div className="grid grid-cols-2 gap-2">
        {preferred.map((tool) => (
          <label
            key={tool.id}
            className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
          >
            <Checkbox
              checked={selectedTools.includes(tool.id)}
              onCheckedChange={(): void => toggleTool(tool.id)}
              disabled={disabled}
              data-testid={`tool-checkbox-${tool.id}`}
            />
            <span>{tool.name}</span>
          </label>
        ))}
      </div>
      {other.length > 0 && (
        <>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={(): void => setShowAll((v) => !v)}
          >
            {showAll ? '▾ Hide other tools' : `▸ Show ${other.length} more tools…`}
          </button>
          {showAll && (
            <div className="grid grid-cols-2 gap-2">
              {other.map((tool) => (
                <label
                  key={tool.id}
                  className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={selectedTools.includes(tool.id)}
                    onCheckedChange={(): void => toggleTool(tool.id)}
                    disabled={disabled}
                    data-testid={`tool-checkbox-${tool.id}`}
                  />
                  <span>{tool.name}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export interface BmadConfigFormProps {
  userName: string
  onUserNameChange: (value: string) => void
  selectedModules: string[]
  onToggleModule: (moduleId: string) => void
  selectedTools: string[]
  onToggleTool: (toolId: string) => void
  language: string
  onLanguageChange: (value: string) => void
  modules: BmadModule[]
  tools: BmadTool[]
  languages: string[]
  disabled: boolean
}

export function BmadConfigForm({
  userName,
  onUserNameChange,
  selectedModules,
  onToggleModule,
  selectedTools,
  onToggleTool,
  language,
  onLanguageChange,
  modules,
  tools,
  languages,
  disabled
}: BmadConfigFormProps): React.JSX.Element {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4 rounded-lg border border-border/30 bg-muted/20 p-4"
      data-testid="bmad-config-section"
    >
      {/* User Name */}
      <div className="space-y-1.5">
        <Label htmlFor="bmad-username" className="text-sm font-medium">
          User Name
        </Label>
        <Input
          id="bmad-username"
          placeholder="Your name (used in BMAD templates)"
          value={userName}
          onChange={(e) => onUserNameChange(e.target.value)}
          data-testid="bmad-username-input"
        />
      </div>

      {/* Modules */}
      {modules.length > 0 && (
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
                  onCheckedChange={() => onToggleModule(mod.id)}
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
      )}

      {/* Tools / IDE */}
      {tools.length > 0 && (
        <ToolCheckboxGrid
          tools={tools}
          selectedTools={selectedTools}
          toggleTool={onToggleTool}
          disabled={disabled}
        />
      )}

      {/* Language */}
      <div className="space-y-1.5">
        <Label htmlFor="bmad-language" className="text-sm font-medium">
          Language
        </Label>
        <Select value={language} onValueChange={onLanguageChange}>
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
  )
}
