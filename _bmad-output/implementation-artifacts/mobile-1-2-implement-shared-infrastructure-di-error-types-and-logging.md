# Story 1.2: Implement Shared Infrastructure — DI, Error Types, and Logging

Status: done

## Story

As a developer,
I want shared DI modules, domain error types, and platform-abstracted logging,
So that all future features use consistent patterns for dependency injection, error handling, and diagnostics.

## Acceptance Criteria

1. **Given** the KMP project from Story 1.1 is set up
   **When** the shared infrastructure is implemented
   **Then** Koin modules exist: `SharedModule` (commonMain), `AndroidModule` (androidMain), `IosModule` (iosMain)

2. **And** a `Result<T>` sealed interface with `Success<T>` and `Failure(AppError)` cases exists in `shared/commonMain/kotlin/com/tinsu/mobile/util/`

3. **And** an `AppError` sealed interface with `ConnectionFailed(reason)`, `Timeout(operation)`, `SyncFailed(reason)` cases exists

4. **And** an `expect` Logger class exists in commonMain with `actual` implementations: `android.util.Log` on Android, `os_log` on iOS

5. **And** logging format follows `[TAG] message` convention where TAG is the class name

6. **And** feature-based package structure is created: `connection/`, `security/`, `chat/`, `documents/`, `review/`, `project/`, `sync/`, `db/`, `di/`, `util/`

7. **And** unit tests verify `Result<T>` success and failure paths

## Tasks / Subtasks

- [x] Task 1: Create `Result<T>` sealed interface (AC: 2)
  - [x] 1.1 Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/Result.kt`
  - [x] 1.2 Define `sealed interface Result<out T>` with `data class Success<T>(val data: T) : Result<T>` and `data class Failure(val error: AppError) : Result<Nothing>`
  - [x] 1.3 Add convenience extension functions: `Result<T>.isSuccess`, `Result<T>.getOrNull()`, `Result<T>.getOrElse(default)`, `Result<T>.map(transform)`, `Result<T>.flatMap(transform)`

- [x] Task 2: Create `AppError` sealed interface (AC: 3)
  - [x] 2.1 Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/AppError.kt`
  - [x] 2.2 Define `sealed interface AppError` with cases: `data class ConnectionFailed(val reason: String)`, `data class Timeout(val operation: String)`, `data class SyncFailed(val reason: String)`
  - [x] 2.3 Add `val userMessage: String` property on `AppError` that returns a user-friendly string (not raw technical details)

- [x] Task 3: Create platform-abstracted Logger (AC: 4, 5)
  - [x] 3.1 Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/Logger.kt` with `expect class Logger(tag: String)` and methods: `fun debug(message: String)`, `fun info(message: String)`, `fun warn(message: String)`, `fun error(message: String, throwable: Throwable? = null)`
  - [x] 3.2 Create `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/util/AndroidLogger.kt` — `actual class Logger` using `android.util.Log` (Log.d, Log.i, Log.w, Log.e) with `[tag]` format
  - [x] 3.3 Create `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/util/IosLogger.kt` — `actual class Logger` using `platform.Foundation.NSLog` (since `os_log` requires Darwin-specific interop) with `[tag]` format

- [x] Task 4: Create Koin DI modules (AC: 1)
  - [x] 4.1 Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt` — defines `val sharedModule = module { }` (empty scaffold, populated by future stories as repositories/ViewModels are added)
  - [x] 4.2 Create `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt` — defines `val androidModule = module { }` (will hold Android-specific bindings like database driver)
  - [x] 4.3 Create `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/IosModule.kt` — defines `val iosModule = module { }` (will hold iOS-specific bindings like database driver)
  - [x] 4.4 Create `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt` — `fun initKoin()` function callable from Swift that starts Koin with `sharedModule + iosModule`
  - [x] 4.5 Update `mobile/androidApp/src/main/java/com/tinsu/mobile/MainActivity.kt` — add Koin initialization in `onCreate` using `startKoin { androidContext(this); modules(sharedModule, androidModule) }` (or create a `TinsuApplication` class if one doesn't exist)
  - [x] 4.6 Update `mobile/iosApp/iosApp/iOSApp.swift` — call `KoinHelperKt.initKoin()` in the app `init {}`

- [x] Task 5: Ensure feature-based package structure (AC: 6)
  - [x] 5.1 Verify these packages exist in `shared/commonMain/kotlin/com/tinsu/mobile/`: `connection/`, `security/`, `chat/`, `documents/`, `review/`, `project/`, `db/`, `di/`, `util/`
  - [x] 5.2 Create `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/sync/` package (with `.gitkeep` if needed) — this is the sync orchestration package defined in architecture but not created in Story 1.1 (Story 1.1 created `cache/` instead)
  - [x] 5.3 Verify platform directories exist in `androidMain` and `iosMain`: `connection/`, `security/`, `util/`, `di/`

- [x] Task 6: Write unit tests (AC: 7)
  - [x] 6.1 Create `mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/util/ResultTest.kt`
  - [x] 6.2 Test `Result.Success` wraps data correctly and `isSuccess` returns true
  - [x] 6.3 Test `Result.Failure` wraps `AppError` correctly and `isSuccess` returns false
  - [x] 6.4 Test `getOrNull()` returns data for Success, null for Failure
  - [x] 6.5 Test `getOrElse(default)` returns data for Success, default for Failure
  - [x] 6.6 Test `map()` transforms Success data, passes Failure through unchanged
  - [x] 6.7 Test `flatMap()` chains Result operations correctly
  - [x] 6.8 Test each `AppError` subtype has correct `userMessage`

- [x] Task 7: Validate build (AC: all)
  - [x] 7.1 Run `./gradlew :shared:build` from `mobile/` — must compile without errors
  - [x] 7.2 Run `./gradlew :shared:allTests` — all tests pass
  - [x] 7.3 Run `./gradlew :androidApp:assembleDebug` — Android app compiles with Koin init
  - [x] 7.4 Verify no unresolved dependency warnings

## Dev Notes

### Project Location

All work is in `mobile/` at the repo root. This is the KMP project created in Story 1.1. **DO NOT** modify any desktop app files (`src/`, `package.json`, etc.).

### Existing Codebase State (from Story 1.1)

Story 1.1 established:
- KMP project with Kotlin 2.1.10, K2 compiler, Android + iOS targets
- Gradle version catalog with Koin 3.5.6, kotlinx.coroutines 1.10.1, kotlinx.serialization 1.8.0
- `expect fun getPlatform(): Platform` / `actual` pattern in `Platform.kt` / `Platform.android.kt` / `Platform.ios.kt`
- Feature package directories with `.gitkeep` files (connection, chat, documents, review, project, cache, db, di, util, security)
- Hello World screens on both platforms using shared `Greeting` class
- Build verified: 209 Gradle tasks, BUILD SUCCESSFUL

**Key files from Story 1.1 to be aware of:**
- `mobile/shared/build.gradle.kts` — already has `implementation(libs.koin.core)` in commonMain, `implementation(libs.koin.android)` in androidMain
- `mobile/gradle/libs.versions.toml` — Koin 3.5.6 defined
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/Platform.kt` — existing expect/actual pattern reference
- `mobile/androidApp/src/main/java/com/tinsu/mobile/MainActivity.kt` — current Android entry point

### Result<T> Implementation

Architecture mandates a domain `Result<T>` type — **DO NOT** use `kotlin.Result` from stdlib. Create a custom sealed interface:

```kotlin
// shared/commonMain/kotlin/com/tinsu/mobile/util/Result.kt
package com.tinsu.mobile.util

sealed interface Result<out T> {
    data class Success<T>(val data: T) : Result<T>
    data class Failure(val error: AppError) : Result<Nothing>
}
```

Key rules from architecture:
- Use `Result<T>` for ALL operations that can fail
- NEVER throw exceptions across module boundaries
- NEVER use generic `Exception` types
- NEVER show raw technical errors to user — `AppError` provides `userMessage`

[Source: architecture-mobile.md — Process Patterns > Error Handling]

### AppError Sealed Interface

```kotlin
// shared/commonMain/kotlin/com/tinsu/mobile/util/AppError.kt
package com.tinsu.mobile.util

sealed interface AppError {
    val userMessage: String
    data class ConnectionFailed(val reason: String) : AppError {
        override val userMessage: String get() = "Connection failed. Check your network and try again."
    }
    data class Timeout(val operation: String) : AppError {
        override val userMessage: String get() = "Operation timed out. Please try again."
    }
    data class SyncFailed(val reason: String) : AppError {
        override val userMessage: String get() = "Sync failed. Data may be outdated."
    }
}
```

Future stories will add more error subtypes as needed (e.g., `AuthenticationFailed`, `NotFound`).

[Source: architecture-mobile.md — Process Patterns > Error Handling]
[Source: epics-mobile.md — Story 1.2 Acceptance Criteria]

### Logger Implementation

The architecture specifies `expect`/`actual` for platform logging. Use `expect class` pattern:

```kotlin
// commonMain — expect declaration
expect class Logger(tag: String) {
    fun debug(message: String)
    fun info(message: String)
    fun warn(message: String)
    fun error(message: String, throwable: Throwable? = null)
}
```

**Android actual** — use `android.util.Log`:
```kotlin
actual class Logger actual constructor(private val tag: String) {
    actual fun debug(message: String) { Log.d(tag, "[$tag] $message") }
    actual fun info(message: String) { Log.i(tag, "[$tag] $message") }
    actual fun warn(message: String) { Log.w(tag, "[$tag] $message") }
    actual fun error(message: String, throwable: Throwable?) { Log.e(tag, "[$tag] $message", throwable) }
}
```

**iOS actual** — use `platform.Foundation.NSLog`:
```kotlin
actual class Logger actual constructor(private val tag: String) {
    actual fun debug(message: String) { NSLog("[$tag] DEBUG: $message") }
    actual fun info(message: String) { NSLog("[$tag] INFO: $message") }
    actual fun warn(message: String) { NSLog("[$tag] WARN: $message") }
    actual fun error(message: String, throwable: Throwable?) {
        NSLog("[$tag] ERROR: $message${throwable?.let { " | ${it.message}" } ?: ""}")
    }
}
```

Note: `NSLog` is more straightforward than `os_log` for KMP interop. `os_log` requires Darwin `OSLog` object creation and C interop for format strings. `NSLog` is available directly via `platform.Foundation`.

**Logging levels from architecture:**

| Level | When | Example |
|---|---|---|
| ERROR | Unrecoverable failure | `"SSH connection failed: ${e.message}"` |
| WARN | Recoverable issue | `"Reconnection attempt 3/5"` |
| INFO | Significant state change | `"Connected to home-pc:22"` |
| DEBUG | Development details | `"tmux capture-pane returned 500 lines"` |

[Source: architecture-mobile.md — Communication Patterns > Logging]

### Koin DI Setup

Koin 3.5.6 is already in the version catalog and shared module dependencies. The modules at this stage are scaffolds — future stories (1.3 for SQLDelight, 2.x for SSH, etc.) will register their services.

**SharedModule (commonMain):**
```kotlin
val sharedModule = module {
    // Future: singleOf(::ConnectionRepository)
    // Future: viewModelOf(::ChatViewModel)
}
```

**AndroidModule (androidMain):**
```kotlin
val androidModule = module {
    // Future: single<SqlDriver> { AndroidSqliteDriver(TinsuMobile.Schema, get(), "tinsu-mobile.db") }
}
```

**IosModule (iosMain):**
```kotlin
val iosModule = module {
    // Future: single<SqlDriver> { NativeSqliteDriver(TinsuMobile.Schema, "tinsu-mobile.db") }
}
```

**Android Koin init** — either create `TinsuApplication` class or add to existing `MainActivity`. The `TinsuApplication` pattern is preferred (standard Android practice):

```kotlin
class TinsuApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@TinsuApplication)
            modules(sharedModule, androidModule)
        }
    }
}
```

If creating `TinsuApplication`, also register it in `AndroidManifest.xml`:
```xml
<application android:name=".TinsuApplication" ...>
```

**iOS Koin init** — create a `KoinHelper.kt` in iosMain that Swift can call:
```kotlin
fun initKoin() {
    startKoin {
        modules(sharedModule, iosModule)
    }
}
```

Called from Swift:
```swift
import Shared

@main
struct iOSApp: App {
    init() {
        KoinHelperKt.initKoin()
    }
    var body: some Scene { ... }
}
```

[Source: architecture-mobile.md — Structure Patterns > Project Organization]
[Source: architecture-mobile.md — Complete Project Directory Structure]

### Package Structure — sync/ vs cache/

Story 1.1 created a `cache/` directory. The architecture defines `sync/` (containing SyncEngine, SyncState, OfflineQueue). These are different concerns:
- `sync/` — orchestrates data synchronization between mobile and remote PC
- Document/chat caching lives within their respective feature packages (`documents/DocumentCache.kt`, `chat/ChatRepository.kt`)

**Create the `sync/` package** as specified in the architecture. The existing `cache/` package from Story 1.1 can remain (it may be useful as a shared cache utility), but `sync/` is the canonical directory per architecture.

[Source: architecture-mobile.md — Complete Project Directory Structure]

### Naming Conventions

Follow these rules from the architecture:
- **Kotlin classes:** PascalCase (`SharedModule`, `AppError`)
- **Functions/properties:** camelCase (`getOrNull()`, `userMessage`)
- **Constants:** SCREAMING_SNAKE (`MAX_RETRY_COUNT`)
- **Packages:** lowercase dot-separated (`com.tinsu.mobile.util`)
- **Files:** PascalCase `.kt` (`Result.kt`, `AppError.kt`, `Logger.kt`)
- **No I prefix** on interfaces (`AppError`, not `IAppError`)
- **expect/actual:** Same class name in commonMain and platform sources

[Source: architecture-mobile.md — Naming Patterns]

### What NOT to Do

- Do NOT create SSH libraries or connection classes (Story 2.1)
- Do NOT create SQLDelight schema files (Story 1.3)
- Do NOT create ViewModels or Repositories (future stories)
- Do NOT create UI themes or components (Stories 1.4, 1.5)
- Do NOT add CI/CD workflows (Story 1.6)
- Do NOT modify the desktop Electron app in any way
- Do NOT use `kotlin.Result` — create the custom `Result<T>` sealed interface
- Do NOT throw exceptions across module boundaries
- Do NOT create boolean-flag state classes (use sealed classes)

### Project Structure Notes

- All new files go under `mobile/shared/src/` (commonMain, androidMain, iosMain) or `mobile/androidApp/`
- Tests co-located: `commonTest/kotlin/com/tinsu/mobile/util/ResultTest.kt`
- The `di/` package already has `.gitkeep` from Story 1.1 — replace with real `.kt` files
- The `util/` package already has `.gitkeep` from Story 1.1 — replace with real `.kt` files

### Previous Story Intelligence (Story 1.1)

Key learnings from Story 1.1 implementation:
- **Gradle version issue:** `dependencyResolution` API is Gradle 8.13+ only; current project uses Gradle 8.11, so use `dependencyResolutionManagement` instead
- **Kotlin 2.1 deprecation:** `kotlinOptions` is deprecated — use `compilerOptions` DSL
- **SQLDelight 2.2.1:** Requires `compileSdk = 35` (already set)
- **AGP lint crash:** NullSafeMutableLiveData lint crash with Kotlin 2.1 — already disabled
- **iOS tests:** Skipped on non-macOS build machines — expected behavior
- **Build pattern:** `./gradlew clean build` from `mobile/` directory validates all modules

### References

- [Source: _bmad-output/planning-artifacts/epics-mobile.md — Epic 1, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Process Patterns > Error Handling]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Communication Patterns > Logging]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Anti-Patterns to Avoid]
- [Source: _bmad-output/planning-artifacts/architecture-mobile.md — Enforcement Guidelines]
- [Koin 3.5.6 documentation: https://insert-koin.io/docs/reference/koin-mp/kmp/]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `./gradlew :shared:build` — BUILD SUCCESSFUL (95 tasks, 14s)
- `./gradlew :shared:testDebugUnitTest` — 16 tests, 0 failures, 0 skipped (ResultTest: 16/16 pass)
- `./gradlew :androidApp:assembleDebug` — BUILD SUCCESSFUL (55 tasks)
- Note: expect/actual classes warning (KT-61573) is informational only, not an error

### Completion Notes List

- Task 1: Created `Result<T>` sealed interface with `Success<T>` and `Failure(AppError)` cases plus 5 extension functions (`isSuccess`, `getOrNull`, `getOrElse`, `map`, `flatMap`)
- Task 2: Created `AppError` sealed interface with `ConnectionFailed`, `Timeout`, `SyncFailed` subtypes, each with user-friendly `userMessage`
- Task 3: Created expect/actual `Logger` class — Android uses `android.util.Log`, iOS uses `platform.Foundation.NSLog`, both follow `[TAG] message` format
- Task 4: Created Koin DI scaffold modules (`SharedModule`, `AndroidModule`, `IosModule`), `KoinHelper` for iOS, `TinsuApplication` for Android Koin init, registered in AndroidManifest.xml, updated iOSApp.swift to call `initKoin()`
- Task 4 fix: Added `koin-android` dependency to `androidApp/build.gradle.kts` (shared module had it but app module didn't)
- Task 5: Created `sync/` package with `.gitkeep`, verified all feature packages exist in commonMain/androidMain/iosMain, removed `.gitkeep` from `di/` and `util/` (replaced by real `.kt` files)
- Task 6: Created ResultTest with 16 unit tests covering all Result operations and AppError userMessages — all passing
- Task 7: All builds and tests pass (shared:build, shared:allTests, androidApp:assembleDebug)

### Review Findings

- [x] [Review][Patch] Android Logger double-tags: tag appears in both Log first-param and message string [mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/util/Logger.kt:7-19] — fixed: removed [$tag] from message string
- [x] [Review][Patch] `initKoin()` has no guard against double-initialization — second call throws `KoinApplicationAlreadyStartedException` [mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt:5-8] — fixed: added GlobalContext.getOrNull() != null guard
- [x] [Review][Patch] iOS Logger `error()` logs only `throwable.message` — full stack trace lost [mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/util/Logger.kt:18] — fixed: changed to stackTraceToString()
- [x] [Review][Defer] `AppError` missing catch-all/unknown variant — deferred, pre-existing design choice per architecture
- [x] [Review][Defer] `NSLog` emits debug/info to device console in production builds — deferred, NSLog approved per dev notes
- [x] [Review][Defer] `Result<T>` name shadows `kotlin.Result` — deferred, architecture explicitly specifies this name
- [x] [Review][Defer] `getOrElse` eager evaluation of default — deferred, matches story spec requirements
- [x] [Review][Defer] `AppError` no structured log message accessor — deferred, beyond story scope
- [x] [Review][Defer] iOS `iOSApp.init()` not `@MainActor` annotated — deferred, Swift strict concurrency future concern
- [x] [Review][Defer] No `isFailure` property — deferred, not in spec
- [x] [Review][Defer] `map`/`flatMap` don't catch transform exceptions — deferred, design choice for KMP utilities
- [x] [Review][Defer] Android `Log` tag truncation at >23 chars — deferred, platform limitation
- [x] [Review][Defer] `Timeout.operation` field not surfaced in logs — deferred, by design
- [x] [Review][Defer] Android TinsuApplication Koin re-init in instrumented tests — deferred, test setup concern

### Change Log

- 2026-04-07: Initial implementation of shared infrastructure — DI, error types, and logging (all 7 tasks complete)

### File List

- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/Result.kt (new)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/AppError.kt (new)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/Logger.kt (new)
- mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/util/Logger.kt (new)
- mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/util/Logger.kt (new)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt (new)
- mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt (new)
- mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/IosModule.kt (new)
- mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt (new)
- mobile/androidApp/src/main/java/com/tinsu/mobile/TinsuApplication.kt (new)
- mobile/androidApp/src/main/AndroidManifest.xml (modified — added android:name=".TinsuApplication")
- mobile/androidApp/build.gradle.kts (modified — added koin-android dependency)
- mobile/iosApp/iosApp/iOSApp.swift (modified — added Shared import, KoinHelper init call)
- mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/util/ResultTest.kt (new)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/sync/.gitkeep (new)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/.gitkeep (deleted)
- mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/util/.gitkeep (deleted)
