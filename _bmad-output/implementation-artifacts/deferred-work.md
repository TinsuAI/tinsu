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

## Deferred from: code review of mobile-1-3-set-up-sqldelight-local-cache-schema (2026-04-07)

- **agent_runs and task_activities missing ON DELETE CASCADE** — Deleting a task leaves orphaned agent_runs/task_activities rows. Add `ON DELETE CASCADE` to FK constraints in a future DB maintenance story.
- **document_cache.project_id has no FK to projects** — Mobile-only table; add FK constraint and cascade when document sync logic is built (Story 4.x).
- **tasks.rejected_agent_run_id references agent_runs without FK** — Mirrors desktop schema as-is. Add FK constraint when mobile task execution features are built (Story 5.x).
- **SQLite FK enforcement requires PRAGMA foreign_keys = ON** — Must be set on each connection at driver setup. Add when any FK-constrained data mutation is introduced (Story 2.x+).

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

## Deferred from: code review of mobile-2-1-implement-ssh-key-generation-and-secure-storage (2026-04-07)

- **Key rotation mechanism not addressed** — No API for rotating existing SSH keys (generate new + retire old under same alias). Out of scope for this story; add when connection management stories require key lifecycle management (Epic 2 retrospective or dedicated security story).

## Deferred from: code review of mobile-1-5-implement-terminal-luxe-design-system-ios (2026-04-07)

- **`KoinHelper.kt` broad `catch (_: Exception)` swallows non-reentry errors** — Pre-existing try-catch pattern accepted in mobile-1-3 review. The expected exception is `KoinAlreadyStartedException`; catching all Exception types could mask module configuration errors. Revisit when testing infrastructure is added to verify Koin module health.

## Deferred from: code review of mobile-2-5-discover-and-select-remote-projects (2026-04-08)

- **Missing connectionId extraction and navigation wiring** — SaveConnectionStep/ConnectionListScreen not wired to PROJECT_DISCOVERY route; broader integration gap deferred to mobile-2-6 when connection lifecycle is formalized
- **iOS polling timer inefficiency** — 200ms polling instead of direct StateFlow observation; matches mobile-2-4 SetupObservableViewModel pattern, change would require refactoring across multiple bridge files
- **ViewModel init main thread DB access** — getSelectedProject() is synchronous; matches SetupDetector pattern, SQLDelight synchronous queries on local SQLite are <1ms
- **JSON deserialization exception swallowing** — fromJson() exceptions return null silently; graceful degradation but no logging, deferred until logging module is added
