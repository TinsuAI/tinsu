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

## Deferred from: code review of mobile-1-2-implement-shared-infrastructure-di-error-types-and-logging (2026-04-06)

- **`AppError` missing catch-all/unknown variant** — No `Unknown(cause: Throwable?)` subtype; adding new subtypes is a binary break. Add before first external library release.
- **`NSLog` unfiltered in production builds** — Debug/info logs visible in device console on production iOS builds. Add build-variant guard or use `os_log` in a future logging story.
- **`Result<T>` name shadows `kotlin.Result`** — Requires explicit import qualification when both are in scope. Accepted as architecture decision; revisit if it causes ambiguity in future stories.
- **`getOrElse` eager default evaluation** — Signature takes `T` not `() -> T`; callers pay cost of default on success. Matches story spec; reconsider API in future ergonomics pass.
- **`AppError` no structured log message accessor** — No `toLogMessage()` method; callers may log vague `userMessage` instead of actionable `reason`. Add in a future logging story.
- **iOS `iOSApp.init()` not `@MainActor` annotated** — Global Koin state mutation in `init()` not actor-isolated; future-proofing concern as Swift strict concurrency becomes default.
- **No `isFailure` property** — Asymmetric API (only `isSuccess`). Low impact; add in future utility pass if callers request it.
- **`map`/`flatMap` do not catch transform exceptions** — Throwing transform escapes `Result` abstraction. Design choice for KMP utilities; revisit when usage patterns emerge.
- **Android `Log` tag truncation at >23 chars** — Platform limitation; add tag length validation in a future logging story.
- **`Timeout.operation` not surfaced in logs** — Field is captured but never logged or displayed. Add `toLogMessage()` helper (see above) to surface it.
- **Android TinsuApplication Koin re-init in instrumented tests** — No guard; test runner calling `startKoin` twice throws. Add test-specific Koin setup in a future testing infrastructure story.
