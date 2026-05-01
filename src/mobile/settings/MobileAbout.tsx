/**
 * MobileAbout — static About TinSu screen.
 *
 * Story T3.5-8, Task 9 (AC: 10d, 17, 18, 19).
 *
 * Route key: 'about'.
 * Renders INSIDE MobileScreen shell — tab bar visible (AC-14).
 *
 * Shows: TinSu logo placeholder, version, short description.
 * Stub rows: "Visit website", "Privacy policy", "Terms" — each fires MobileToast.
 *
 * AC-10d: stub rows marked with subtitle "Coming soon" + emit toast on tap.
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: min-h-11 touch targets via MobileSettingsRow.
 */

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Globe, Shield, FileText } from 'lucide-react'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileSettingsRow } from '../primitives/MobileSettingsRow'

/* ── Component ──────────────────────────────────────────────────── */

export function MobileAbout() {
  const { popRoute } = useMobileNavStore()
  const [appVersion, setAppVersion] = useState(import.meta.env.VITE_APP_VERSION ?? '1.0.0')

  useEffect(() => {
    let cancelled = false
    const loadVersion = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const v = await getVersion()
        if (!cancelled) setAppVersion(v)
      } catch {
        // Fallback: keep env var value
      }
    }
    void loadVersion()
    return () => { cancelled = true }
  }, [])

  const handleComingSoon = () => {
    toast('Coming soon')
  }

  return (
    <div className="flex flex-col h-full" data-testid="mobile-about">
      {/* Sub-screen top bar with back button */}
      <MobileTopAppBar
        title="About TinSu"
        backButton={{
          onClick: () => popRoute('settings'),
          ariaLabel: 'Back to settings',
        }}
      />

      {/* Logo + version header */}
      <div className="flex flex-col items-center gap-3 px-8 py-10">
        {/* Logo placeholder */}
        <div
          className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"
          aria-label="TinSu logo"
        >
          <span className="text-3xl font-bold text-primary select-none">T</span>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-xl font-bold text-foreground">TinSu</h1>
          <p className="text-sm text-muted-foreground">Version {appVersion}</p>
          <p className="text-sm text-muted-foreground max-w-[280px] mt-2 leading-relaxed">
            Your AI-powered development assistant. Manage tasks, review code, and monitor agents — all in one place.
          </p>
        </div>
      </div>

      {/* Stub link rows */}
      <div role="list" aria-label="About links">
        <MobileSettingsRow
          icon={<Globe className="h-4 w-4" />}
          title="Visit website"
          subtitle="Coming soon"
          trailing="chevron"
          onPress={handleComingSoon}
          data-testid="about-row-website"
        />
        <MobileSettingsRow
          icon={<Shield className="h-4 w-4" />}
          title="Privacy policy"
          subtitle="Coming soon"
          trailing="chevron"
          onPress={handleComingSoon}
          data-testid="about-row-privacy"
        />
        <MobileSettingsRow
          icon={<FileText className="h-4 w-4" />}
          title="Terms"
          subtitle="Coming soon"
          trailing="chevron"
          onPress={handleComingSoon}
          data-testid="about-row-terms"
        />
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  )
}
