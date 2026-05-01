/**
 * MobileDiagnostics — read-only diagnostics information screen.
 *
 * Story T3.5-8, Task 8 (AC: 10c, 17, 18, 19, 20).
 *
 * Route key: 'diagnostics'.
 * Renders INSIDE MobileScreen shell — tab bar visible (AC-14).
 *
 * Shows: app version, Tauri version, platform, database path.
 * "Copy Diagnostics" button copies JSON via Web Clipboard API + shows toast.
 *
 * If commands.getDiagnostics does not exist (not in current bindings), falls
 * back to partial info via @tauri-apps/api/app and @tauri-apps/plugin-os.
 * TODO(T3.5-9): expand once getDiagnostics command lands in Rust.
 *
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: "Copy Diagnostics" button min-h-11.
 * AC-19: Accessibility via MobileSettingsRow roles.
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Cpu, Package, Monitor, Database, Hash } from 'lucide-react'
import { getVersion, getTauriVersion } from '@tauri-apps/api/app'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileSettingsRow } from '../primitives/MobileSettingsRow'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'

/* ── Diagnostics data type ──────────────────────────────────────── */

interface DiagnosticsData {
  appVersion: string
  tauriVersion: string
  platform: string
  databasePath: string
  buildHash: string
}

/* ── Component ──────────────────────────────────────────────────── */

export function MobileDiagnostics() {
  const { popRoute } = useMobileNavStore()
  const [diag, setDiag] = useState<DiagnosticsData>({
    appVersion: 'Loading…',
    tauriVersion: 'Loading…',
    platform: 'Loading…',
    databasePath: 'Unavailable',
    buildHash: import.meta.env.VITE_BUILD_HASH ?? 'dev',
  })

  useEffect(() => {
    let cancelled = false

    const loadDiag = async () => {
      const updates: Partial<DiagnosticsData> = {}

      // App version
      try {
        updates.appVersion = await getVersion()
      } catch {
        updates.appVersion = import.meta.env.VITE_APP_VERSION ?? 'Unknown'
      }

      // Tauri version
      try {
        updates.tauriVersion = await getTauriVersion()
      } catch {
        updates.tauriVersion = 'Unknown'
      }

      // Platform (imported via static alias in vitest.config.ts)
      try {
        const { platform } = await import('@tauri-apps/plugin-os')
        updates.platform = String(await platform())
      } catch {
        updates.platform = navigator.platform ?? 'Unknown'
      }

      // Database path — TODO(T3.5-9): expand once getDiagnostics command lands
      // commands.getDiagnostics does not exist in current bindings.
      updates.databasePath = 'Unavailable'

      if (!cancelled) {
        setDiag((prev) => ({ ...prev, ...updates }))
      }
    }

    void loadDiag()
    return () => { cancelled = true }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2))
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy diagnostics')
    }
  }

  return (
    <div className="flex flex-col h-full" data-testid="mobile-diagnostics">
      {/* Sub-screen top bar with back button */}
      <MobileTopAppBar
        title="Diagnostics"
        backButton={{
          onClick: () => popRoute('settings'),
          ariaLabel: 'Back to settings',
        }}
      />

      {/* Diagnostics fields */}
      <div className="flex-1 overflow-y-auto">
        <div role="list" aria-label="Diagnostic information">
          <MobileSettingsRow
            icon={<Package className="h-4 w-4" />}
            title="App version"
            value={diag.appVersion}
            data-testid="diag-app-version"
          />
          <MobileSettingsRow
            icon={<Cpu className="h-4 w-4" />}
            title="Tauri version"
            value={diag.tauriVersion}
            data-testid="diag-tauri-version"
          />
          <MobileSettingsRow
            icon={<Monitor className="h-4 w-4" />}
            title="Platform"
            value={diag.platform}
            data-testid="diag-platform"
          />
          <MobileSettingsRow
            icon={<Database className="h-4 w-4" />}
            title="Database path"
            subtitle={diag.databasePath}
            data-testid="diag-db-path"
          />
          <MobileSettingsRow
            icon={<Hash className="h-4 w-4" />}
            title="Build"
            value={diag.buildHash}
            data-testid="diag-build-hash"
          />
        </div>
      </div>

      {/* Copy Diagnostics action bar (AC-18: ≥ 44px) */}
      <MobileBottomActionBar
        primary={{
          label: 'Copy Diagnostics',
          onPress: () => { void handleCopy() },
          ariaLabel: 'Copy diagnostics to clipboard',
        }}
      />
    </div>
  )
}
