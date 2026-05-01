/**
 * MobileSettingsHome — settings tab root screen.
 *
 * Story T3.5-8, Task 5 (AC: 9, 11, 12, 17, 18, 19, 20).
 *
 * Replaces the T3.5-7 transitional placeholder with the full sectioned settings list.
 *
 * Sections (AC-9):
 *   Agent        → Dev agent model, Review agent model
 *   Connections  → SSH connections (subtitle: n configured / "No SSH connections yet")
 *   Appearance   → Theme (value: Light / Dark / System)
 *   About        → About TinSu, Diagnostics, Open-source licenses
 *
 * Stub rows (AC-11): SSH Keys, Mosh, Cache — "Coming soon" toast.
 *
 * AC-12: Connections row calls pushRoute('settings', 'connections').
 * AC-14: isFullScreenRoute() NOT extended — settings sub-screens render inside MobileScreen.
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: min-h-11 on all rows via MobileSettingsRow.
 * AC-19: role="list" + role="listitem" via MobileSettingsRow.
 */

import { Bot, Network, Palette, Info, FileText, Key, Wifi, HardDrive, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@renderer/lib/trpc'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileSettingsRow } from '../primitives/MobileSettingsRow'
import { useListSshConnections } from '@renderer/hooks/useSshCommands'
import { useThemeStore } from '@renderer/stores/theme.store'

/* ── Model label helper ─────────────────────────────────────────── */

function modelLabel(model: string | undefined): string {
  switch (model) {
    case 'opus':   return 'Opus'
    case 'sonnet': return 'Sonnet'
    case 'haiku':  return 'Haiku'
    default:       return '—'
  }
}

/* ── Helpers ────────────────────────────────────────────────────── */

// AC-11: stub rows emit "Coming in a future release."
function showComingSoonToast() {
  toast('Coming in a future release.')
}

/* ── Section header ─────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs uppercase tracking-wider text-muted-foreground px-4 pt-6 pb-2 select-none">
      {label}
    </p>
  )
}

/* ── Component ──────────────────────────────────────────────────── */

export function MobileSettingsHome() {
  const { pushRoute } = useMobileNavStore()
  const theme = useThemeStore((s) => s.theme)

  // Agent model config (AC-9: value=current model)
  const { data: config } = trpc.config.get.useQuery()

  // Connections count (AC-12)
  const { data: connections = [] } = useListSshConnections()
  const connectionsSubtitle =
    connections.length === 0
      ? 'No SSH connections yet'
      : `${connections.length} configured`

  // Theme display value
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="mobile-settings-home">
      {/* ── Agent section ── */}
      <SectionHeader label="Agent" />
      <div role="list" aria-label="Agent settings">
        <MobileSettingsRow
          icon={<Bot className="h-4 w-4" />}
          title="Dev agent model"
          value={modelLabel(config?.devAgentModel)}
          trailing="chevron"
          onPress={() => pushRoute('settings', 'agent-settings')}
          data-testid="settings-row-dev-agent"
        />
        <MobileSettingsRow
          icon={<Bot className="h-4 w-4" />}
          title="Review agent model"
          value={modelLabel(config?.reviewAgentModel)}
          trailing="chevron"
          onPress={() => pushRoute('settings', 'agent-settings')}
          data-testid="settings-row-review-agent"
        />
      </div>

      {/* ── Connections section ── */}
      <SectionHeader label="Connections" />
      <div role="list" aria-label="Connections settings">
        <MobileSettingsRow
          icon={<Network className="h-4 w-4" />}
          title="Connections"
          subtitle={connectionsSubtitle}
          trailing="chevron"
          onPress={() => pushRoute('settings', 'connections')}
          data-testid="settings-row-connections"
        />
        {/* Stub: SSH Keys (AC-11) */}
        <MobileSettingsRow
          icon={<Key className="h-4 w-4" />}
          title="SSH Keys"
          subtitle="Coming soon"
          trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
          onPress={showComingSoonToast}
          data-testid="settings-row-ssh-keys"
        />
        {/* Stub: Mosh (AC-11) */}
        <MobileSettingsRow
          icon={<Wifi className="h-4 w-4" />}
          title="Mosh"
          subtitle="Coming soon"
          trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
          onPress={showComingSoonToast}
          data-testid="settings-row-mosh"
        />
      </div>

      {/* ── Appearance section ── */}
      <SectionHeader label="Appearance" />
      <div role="list" aria-label="Appearance settings">
        <MobileSettingsRow
          icon={<Palette className="h-4 w-4" />}
          title="Theme"
          value={themeLabel}
          trailing="chevron"
          onPress={() => pushRoute('settings', 'theme-settings')}
          data-testid="settings-row-theme"
        />
        {/* Stub: Cache (AC-11) */}
        <MobileSettingsRow
          icon={<HardDrive className="h-4 w-4" />}
          title="Cache"
          subtitle="Coming soon"
          trailing={<ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
          onPress={showComingSoonToast}
          data-testid="settings-row-cache"
        />
      </div>

      {/* ── About section ── */}
      <SectionHeader label="About" />
      <div role="list" aria-label="About settings">
        <MobileSettingsRow
          icon={<Info className="h-4 w-4" />}
          title="About TinSu"
          trailing="chevron"
          onPress={() => pushRoute('settings', 'about')}
          data-testid="settings-row-about"
        />
        <MobileSettingsRow
          icon={<Info className="h-4 w-4" />}
          title="Diagnostics"
          trailing="chevron"
          onPress={() => pushRoute('settings', 'diagnostics')}
          data-testid="settings-row-diagnostics"
        />
        <MobileSettingsRow
          icon={<FileText className="h-4 w-4" />}
          title="Open-source licenses"
          trailing="chevron"
          onPress={() => pushRoute('settings', 'licenses')}
          data-testid="settings-row-licenses"
        />
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  )
}
