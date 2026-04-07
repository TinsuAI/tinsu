# Deferred Work

## Deferred from: code review of mobile-1-1-initialize-kmp-project-with-jetbrains-wizard (2026-04-07)

- **Release `isMinifyEnabled=false`, no signing config** — Enable R8 shrinking and add signing config before Play Store submission; not needed for development scaffold
- **`android:allowBackup=true` without backup exclusion rules** — Add `android:dataExtractionRules` exclusion file when SQLDelight DB and auth tokens are introduced (Story 1.3+)
- **Legacy `Theme.Material.Light.NoActionBar` parent theme** — Migrate to `Theme.Material3.DayNight.NoActionBar` in Story 1.4 (Terminal Luxe design system)
- **SQLDelight plugin not applied in shared module** — Correct for this story scope; plugin + `.sq` schema files added in Story 1.3
- **Configuration cache enabled with AGP 8.7.3** — Known partial incompatibilities; monitor and suppress specific task warnings if CI failures arise
- **No `android:icon` in manifest** — Add launcher icon in Story 1.4

## Sync I/O in planning router
**Source:** Code review of planning-chat-input-enhancements  
**Issue:** `getSkillManifest` (and all other planning router queries) use synchronous filesystem I/O (`readFileSync`, `readdirSync`, `statSync`) which blocks the Electron main process thread. Should be migrated to async `fs/promises` equivalents.
