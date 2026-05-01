/**
 * MobileLicenses — Open-source licenses screen.
 *
 * Story T3.5-8, Task 9 (AC: 10e, 17, 18, 19).
 *
 * Route key: 'licenses'.
 * Renders INSIDE MobileScreen shell — tab bar visible (AC-14).
 *
 * v1: hard-coded short attribution placeholder.
 * TODO(T3.5-9): wire generated licenses.json once a license generator is set up.
 * Do NOT block on license generator — ship the screen with placeholder. AC-10e.
 *
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 */

import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'

/* ── Placeholder OSS notice ─────────────────────────────────────── */

// TODO(T3.5-9): Replace with generated licenses.json content from
// `license-checker` or similar tool run at build time.
const OSS_NOTICE = `
TinSu uses the following open-source libraries:

React
  License: MIT
  Copyright (c) Meta Platforms, Inc. and affiliates.
  https://github.com/facebook/react

Tauri
  License: MIT / Apache-2.0
  Copyright (c) 2019-2024 Tauri Programme within The Commons Conservancy
  https://github.com/tauri-apps/tauri

Tailwind CSS
  License: MIT
  Copyright (c) Tailwind Labs, Inc.
  https://github.com/tailwindlabs/tailwindcss

Zustand
  License: MIT
  Copyright (c) 2019 Paul Henschel
  https://github.com/pmndrs/zustand

Radix UI
  License: MIT
  Copyright (c) 2022 WorkOS
  https://github.com/radix-ui/primitives

Lucide React
  License: ISC
  Copyright (c) 2020, Lucide Contributors
  https://github.com/lucide-icons/lucide

TanStack Query
  License: MIT
  Copyright (c) 2021-present Tanner Linsley
  https://github.com/TanStack/query

Sonner
  License: MIT
  Copyright (c) 2023 Emil Kowalski
  https://github.com/emilkowalski/sonner

Zod
  License: MIT
  Copyright (c) 2020 Colin McDonnell
  https://github.com/colinhacks/zod

SQLite (via rusqlite)
  License: MIT
  https://github.com/rusqlite/rusqlite

Rust (rustc, cargo)
  License: MIT / Apache-2.0
  Copyright (c) The Rust Project Contributors
  https://www.rust-lang.org

---

Full license texts are available in the LICENSES directory
of the TinSu source repository.
`.trim()

/* ── Component ──────────────────────────────────────────────────── */

export function MobileLicenses() {
  const { popRoute } = useMobileNavStore()

  return (
    <div className="flex flex-col h-full" data-testid="mobile-licenses">
      {/* Sub-screen top bar with back button */}
      <MobileTopAppBar
        title="Open-source licenses"
        backButton={{
          onClick: () => popRoute('settings'),
          ariaLabel: 'Back to settings',
        }}
      />

      {/* License text */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <pre
          className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-words"
          data-testid="licenses-text"
        >
          {OSS_NOTICE}
        </pre>
      </div>
    </div>
  )
}
