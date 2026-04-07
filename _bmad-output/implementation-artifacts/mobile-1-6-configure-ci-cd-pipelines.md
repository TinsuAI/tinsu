# Story mobile-1.6: Configure CI/CD Pipelines

Status: done

## Story

As a developer,
I want GitHub Actions workflows that validate every PR and automate store deployments,
so that code quality is enforced and releases are streamlined.

## Acceptance Criteria

1. `android-ci.yml` runs on PR: compiles Android module, runs unit tests, runs KtLint.
2. `ios-ci.yml` runs on PR: compiles iOS module, runs unit tests, runs SwiftLint.
3. `shared-tests.yml` runs on PR: compiles shared KMP module, runs commonTest suite.
4. `release.yml` is configured for Fastlane deployment: Android → signed AAB → Play Store, iOS → signed IPA → App Store.
5. KtLint is configured to enforce Kotlin naming conventions (PascalCase classes, camelCase functions, SCREAMING_SNAKE constants).
6. SwiftLint is configured to enforce Swift naming conventions (PascalCase types, camelCase functions, PascalCase + View suffix for SwiftUI views).
7. All three CI workflows pass on the current codebase.

## Tasks / Subtasks

- [ ] Task 1: Add KtLint plugin to Gradle build (AC: #5, #7)
  - [ ] Add `jlleitschuh/ktlint-gradle` plugin (`id "org.jlleitschuh.gradle.ktlint" version "12.1.2"`) to `mobile/build.gradle.kts` plugins block (apply false)
  - [ ] Apply the ktlint plugin in `mobile/shared/build.gradle.kts` and `mobile/androidApp/build.gradle.kts`
  - [ ] Add `.editorconfig` at `mobile/` root with ktlint configuration:
    - `ktlint_standard_no-wildcard-imports = enabled`
    - `ktlint_standard_trailing-comma-on-call-site = disabled`
    - `ktlint_standard_trailing-comma-on-declaration-site = disabled`
  - [ ] Exclude `build/` directory from ktlint scanning (add `ktlint { filter { exclude("**/build/**") } }`)
  - [ ] Run `./gradlew ktlintCheck` from `mobile/` and fix any violations in existing Kotlin files
  - [ ] Verify no violations: `./gradlew :shared:ktlintCheck :androidApp:ktlintCheck`

- [ ] Task 2: Add SwiftLint configuration (AC: #6, #7)
  - [ ] Create `mobile/iosApp/.swiftlint.yml` with the following rules:
    - Enable `type_name` (PascalCase — min: 3, max: 50)
    - Enable `identifier_name` (camelCase functions/vars — min: 1, max: 50)
    - Enable `custom_rules` for SwiftUI View suffix enforcement (regex: `struct\s+\w+:\s*View` must match `struct\s+[A-Z][A-Za-z]+View:`)
    - Exclude: `iosApp.xcodeproj`, `Pods`, generated files
    - Exclude: `iosApp/iosApp/TinsuDesignPreview.swift` (if it contains preview structs that shouldn't need `View` suffix)
  - [ ] Run SwiftLint locally against `mobile/iosApp/iosApp/` and fix any violations
  - [ ] Verify all 7 existing Swift files pass (`TinsuColors.swift`, `TinsuTypography.swift`, `TinsuSpacing.swift`, `TinsuStyles.swift`, `TinsuLoadingView.swift`, `ContentView.swift`, `iOSApp.swift`)

- [ ] Task 3: Create `android-ci.yml` GitHub Actions workflow (AC: #1)
  - [ ] Create `.github/workflows/android-ci.yml` at repo root (`/home/tinxu-luna/tinsu/.github/workflows/`)
  - [ ] Trigger: `on: pull_request:` with `paths: ['mobile/**']`
  - [ ] Runner: `ubuntu-latest`
  - [ ] Steps:
    1. `actions/checkout@v4`
    2. `actions/setup-java@v4` with `java-version: '17'`, `distribution: 'temurin'`
    3. `gradle/actions/setup-gradle@v4` (caches Gradle dependencies)
    4. KtLint check: `./gradlew :shared:ktlintCheck :androidApp:ktlintCheck` from `mobile/`
    5. Compile Android: `./gradlew :androidApp:assembleDebug` from `mobile/`
    6. Run unit tests: `./gradlew :androidApp:test :shared:testDebugUnitTest` from `mobile/`
  - [ ] Set `defaults: run: working-directory: mobile`

- [ ] Task 4: Create `ios-ci.yml` GitHub Actions workflow (AC: #2)
  - [ ] Create `.github/workflows/ios-ci.yml` at repo root
  - [ ] Trigger: `on: pull_request:` with `paths: ['mobile/**']`
  - [ ] Runner: `macos-latest` (required for Xcode/Swift toolchain)
  - [ ] Steps:
    1. `actions/checkout@v4`
    2. Install SwiftLint: `brew install swiftlint`
    3. Run SwiftLint: `swiftlint lint --strict --path mobile/iosApp/iosApp`
    4. Select Xcode version: `sudo xcode-select -s /Applications/Xcode.app`
    5. Build iOS: `xcodebuild build -project iosApp.xcodeproj -scheme iosApp -destination 'platform=iOS Simulator,name=iPhone 16' CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO` from `mobile/iosApp/`
  - [ ] Note: `xcodebuild test` is optional for this story — build success is sufficient for CI validation

- [ ] Task 5: Create `shared-tests.yml` GitHub Actions workflow (AC: #3)
  - [ ] Create `.github/workflows/shared-tests.yml` at repo root
  - [ ] Trigger: `on: pull_request:` with `paths: ['mobile/shared/**']`
  - [ ] Runner: `ubuntu-latest`
  - [ ] Steps:
    1. `actions/checkout@v4`
    2. `actions/setup-java@v4` with `java-version: '17'`, `distribution: 'temurin'`
    3. `gradle/actions/setup-gradle@v4`
    4. Compile shared: `./gradlew :shared:compileKotlinMetadata` from `mobile/`
    5. Run commonTest: `./gradlew :shared:jvmTest` from `mobile/` (JVM target for commonTest execution on Linux)
    6. Run Android unit tests: `./gradlew :shared:testDebugUnitTest` from `mobile/`
  - [ ] Set `defaults: run: working-directory: mobile`

- [ ] Task 6: Create `release.yml` Fastlane workflow (AC: #4)
  - [ ] Create `.github/workflows/mobile-release.yml` at repo root
  - [ ] Trigger: `on: workflow_dispatch:` (manual trigger) with inputs: `platform` (android/ios/both)
  - [ ] Android lane (ubuntu-latest): checkout → Java 17 → `bundle exec fastlane android release`
  - [ ] iOS lane (macos-latest): checkout → `bundle exec fastlane ios release`
  - [ ] Add Secrets comment block: `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` (Android); `APP_STORE_CONNECT_API_KEY` (iOS)
  - [ ] Note: Actual signing credentials are NOT configured in this story — only the workflow structure is created

- [ ] Task 7: Create Fastlane structure (AC: #4)
  - [ ] Create `mobile/fastlane/Fastfile` with:
    - `platform :android` lane `release`: comment-only placeholder for `gradle(task: "bundle", build_type: "Release")` + `upload_to_play_store`
    - `platform :ios` lane `release`: comment-only placeholder for `gym` + `upload_to_app_store`
  - [ ] Create `mobile/fastlane/Appfile` with:
    - `app_identifier "com.tinsu.mobile"`
    - `package_name "com.tinsu.mobile"` (Android)
  - [ ] Create `mobile/fastlane/Matchfile` (stub): `git_url ""`, `type "appstore"`
  - [ ] Create `mobile/Gemfile` with `gem "fastlane"` (required for `bundle exec fastlane`)

- [ ] Task 8: Verify all CI workflows pass locally (AC: #7)
  - [ ] Run `./gradlew :shared:ktlintCheck :androidApp:ktlintCheck` from `mobile/` — must exit 0
  - [ ] Run `./gradlew :shared:compileKotlinMetadata` from `mobile/` — must exit 0
  - [ ] Run `./gradlew :androidApp:assembleDebug` from `mobile/` — must exit 0
  - [ ] Run `./gradlew :shared:testDebugUnitTest` from `mobile/` — must exit 0
  - [ ] (iOS steps verified via existing build check from Story 1-5: `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64`)
  - [ ] Document any ktlint violations found and confirm all are fixed before marking complete

## Dev Notes

### Critical: GitHub Actions Workflow Location

**GitHub Actions workflows MUST be at the repository root** `.github/workflows/`, not inside `mobile/`. The git repository root is `/home/tinxu-luna/tinsu/`, so workflows go at `/home/tinxu-luna/tinsu/.github/workflows/`. Use `paths: ['mobile/**']` to ensure they only trigger on mobile code changes, preventing interference with desktop app workflows.

Do NOT create `mobile/.github/workflows/` — GitHub won't detect workflows in subdirectories.

```
/home/tinxu-luna/tinsu/
└── .github/
    └── workflows/
        ├── android-ci.yml         ← mobile Android CI
        ├── ios-ci.yml             ← mobile iOS CI
        ├── shared-tests.yml       ← mobile KMP shared tests
        └── mobile-release.yml     ← Fastlane deployment
```

### KtLint Integration

Use `jlleitschuh/ktlint-gradle` plugin **v12.1.2** (latest stable as of 2025-Q1). Add to `mobile/build.gradle.kts` plugins block:

```kotlin
// mobile/build.gradle.kts
plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.kotlinAndroid) apply false
    alias(libs.plugins.kotlinSerialization) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.sqldelight) apply false
    id("org.jlleitschuh.gradle.ktlint") version "12.1.2" apply false  // ADD THIS
}
```

Apply in submodules (`mobile/shared/build.gradle.kts` and `mobile/androidApp/build.gradle.kts`):

```kotlin
plugins {
    // ... existing plugins
    id("org.jlleitschuh.gradle.ktlint")
}

ktlint {
    filter {
        exclude("**/build/**")
        exclude("**/generated/**")
    }
}
```

**DO NOT apply ktlint to the root `build.gradle.kts`** — apply false at root, apply true in submodules.

### KtLint: .editorconfig Configuration

Create `mobile/.editorconfig`:

```editorconfig
[*.{kt,kts}]
ktlint_standard_no-wildcard-imports = enabled
ktlint_standard_trailing-comma-on-call-site = disabled
ktlint_standard_trailing-comma-on-declaration-site = disabled
ktlint_standard_function-signature = disabled
# Allow Composable function names to follow PascalCase (standard in Compose)
ktlint_standard_function-naming = disabled
```

**Important:** Composable functions in Jetpack Compose use PascalCase by convention (e.g., `TinsuApp()`, `PrimaryButton()`). The `function-naming` rule must be disabled because ktlint's default enforcement of camelCase conflicts with Compose conventions. The `@Composable` annotation is the signal for PascalCase — ktlint v12 doesn't have built-in Compose awareness without the `ktlint-compose-rules` addon.

### KtLint: Expected Violations to Fix

Based on reviewing existing Kotlin files, potential issues:

1. **`mobile/androidApp/src/main/java/com/tinsu/mobile/ui/theme/Color.kt`**: Material 3 color definitions use `val md_theme_*` pattern — these are lowercase underscore names for Material color tokens (acceptable, not ktlint violations in standard ruleset).
2. **`mobile/androidApp/src/main/java/com/tinsu/mobile/ui/theme/Spacing.kt`**: If it defines an extension property for `dp`, ensure the format matches ktlint expectations.
3. **Composable functions** (`TinsuApp`, `PrimaryButton`, etc.): PascalCase — will trigger `function-naming` rule → disabled in `.editorconfig`.
4. **Generated SQLDelight files** under `build/` — must be excluded.

Run `./gradlew :androidApp:ktlintCheck` first to see all violations before fixing.

### SwiftLint: .swiftlint.yml Configuration

Place at `mobile/iosApp/.swiftlint.yml` (SwiftLint auto-discovers this when run from `mobile/iosApp/`):

```yaml
# mobile/iosApp/.swiftlint.yml
included:
  - iosApp

excluded:
  - iosApp.xcodeproj
  - Pods
  - build

opt_in_rules:
  - force_unwrapping
  - empty_count

disabled_rules:
  - trailing_whitespace    # handled by editorconfig

rules_customization:
  type_name:
    min_length: 3
    max_length: 50
    
  identifier_name:
    min_length: 1
    max_length: 50
    excluded:
      - id
      - x
      - y

custom_rules:
  swiftui_view_suffix:
    name: "SwiftUI View Suffix"
    regex: 'struct\s+(\w+):\s*(some\s+)?View\b'
    capture_group: 1
    match_kinds:
      - identifier
    message: "SwiftUI View structs must end with 'View' suffix"
    severity: warning
```

**Note on custom `swiftui_view_suffix` rule:** SwiftLint custom rules using `capture_group` for naming checks are advanced. If the regex approach proves problematic, simplify to a warning-level check or skip the custom rule. The standard `type_name` and `identifier_name` rules (PascalCase/camelCase) are the critical enforcement.

**Existing Swift files that must pass:**
- `TinsuColors.swift` — `TinsuColors` struct (PascalCase ✓)
- `TinsuTypography.swift` — `TinsuTypography` struct (PascalCase ✓)
- `TinsuSpacing.swift` — `TinsuSpacing` enum (PascalCase ✓)
- `TinsuStyles.swift` — `PrimaryButtonStyle`, `SecondaryButtonStyle`, etc. (PascalCase ✓)
- `TinsuLoadingView.swift` — `TinsuLoadingView` struct with `View` suffix (PascalCase + View ✓)
- `ContentView.swift` — `ContentView` struct (PascalCase + View ✓)
- `iOSApp.swift` — `iOSApp` struct (passes `identifier_name` — no View suffix needed, it's an App not a View)

### GitHub Actions Workflow Patterns

**Android CI workflow pattern:**

```yaml
# .github/workflows/android-ci.yml
name: Mobile Android CI
on:
  pull_request:
    paths:
      - 'mobile/**'
defaults:
  run:
    working-directory: mobile
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: gradle/actions/setup-gradle@v4
      - name: KtLint Check
        run: ./gradlew :shared:ktlintCheck :androidApp:ktlintCheck
      - name: Build Android Debug
        run: ./gradlew :androidApp:assembleDebug
      - name: Run Android Tests
        run: ./gradlew :androidApp:test :shared:testDebugUnitTest
```

**iOS CI workflow pattern:**

```yaml
# .github/workflows/ios-ci.yml
name: Mobile iOS CI
on:
  pull_request:
    paths:
      - 'mobile/**'
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install SwiftLint
        run: brew install swiftlint
      - name: Run SwiftLint
        run: swiftlint lint --strict
        working-directory: mobile/iosApp
      - name: Build iOS
        run: |
          xcodebuild build \
            -project iosApp.xcodeproj \
            -scheme iosApp \
            -destination 'platform=iOS Simulator,name=iPhone 16' \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO
        working-directory: mobile/iosApp
```

**Shared tests workflow pattern:**

```yaml
# .github/workflows/shared-tests.yml  
name: Mobile Shared Tests
on:
  pull_request:
    paths:
      - 'mobile/shared/**'
defaults:
  run:
    working-directory: mobile
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: gradle/actions/setup-gradle@v4
      - name: Compile Shared Module
        run: ./gradlew :shared:compileKotlinMetadata
      - name: Run Shared Tests
        run: ./gradlew :shared:jvmTest :shared:testDebugUnitTest
```

### KMP: commonTest Target for JVM

The shared module uses `kotlin-test` for commonTest. On Linux CI, run these via the JVM target, not the native target. The relevant Gradle task is `:shared:jvmTest`. If `jvmTest` fails because no JVM target is configured in `shared/build.gradle.kts`, add one:

```kotlin
// In shared/build.gradle.kts kotlin {} block
jvm()  // Add JVM target for test execution on Linux
```

If a JVM target creates complications (e.g., conflicting with Android), use `:shared:testDebugUnitTest` only (Android unit test target, runs on JVM).

### Fastlane Structure

```
mobile/
├── Gemfile                    ← gem "fastlane"
├── Gemfile.lock               ← generated, gitignore or commit
└── fastlane/
    ├── Fastfile               ← lane definitions
    ├── Appfile                ← app identifiers
    └── Matchfile              ← iOS code signing (stub)
```

The Fastfile, Appfile, and Matchfile for this story are **stubs only** — actual signing credentials and store configuration are deferred. Release lanes should contain commented-out placeholder steps showing the intended flow.

### Project Structure Notes

- All workflows: `/home/tinxu-luna/tinsu/.github/workflows/` (repo root)
- KtLint editorconfig: `mobile/.editorconfig`
- SwiftLint config: `mobile/iosApp/.swiftlint.yml`
- Fastlane: `mobile/fastlane/`, `mobile/Gemfile`
- Existing mobile source: `mobile/shared/`, `mobile/androidApp/`, `mobile/iosApp/`
- Naming conventions: snake_case DB, PascalCase Kotlin/Swift types, camelCase functions, SCREAMING_SNAKE constants

### References

- [Source: epics-mobile.md#Story 1.6] Story acceptance criteria
- [Source: architecture-mobile.md#CI/CD] "GitHub Actions for both platforms; Android: Gradle → signed AAB → Play Store via Fastlane; iOS: xcodebuild → signed IPA → App Store via Fastlane"
- [Source: architecture-mobile.md#Complete Project Directory Structure] `.github/workflows/` structure with `android-ci.yml`, `ios-ci.yml`, `shared-tests.yml`, `release.yml`; `fastlane/` at mobile root
- [Source: architecture-mobile.md#Anti-Patterns] "CI: KtLint (Kotlin) + SwiftLint (Swift) run on every PR"
- [Source: epics-mobile.md#Additional Requirements] "CI/CD: GitHub Actions for both platforms; Fastlane for store deployment"
- [Source: mobile/gradle/libs.versions.toml] Kotlin 2.1.10, AGP 8.7.3, compileSdk 35, minSdk 29
- [Source: mobile/shared/build.gradle.kts] JVM target 17; existing KMP module structure

### Review Findings

- [x] [Review][Patch] SwiftLint `rules_customization` invalid key — moved type_name/identifier_name to top-level config [mobile/iosApp/.swiftlint.yml]
- [x] [Review][Patch] Fastlane files missing (Task 7) — created Fastfile, Appfile, Matchfile, Gemfile stubs [mobile/fastlane/*, mobile/Gemfile]
- [x] [Review][Patch] release.yml uses tag-trigger instead of workflow_dispatch with platform input (Task 6) — changed to workflow_dispatch with android/ios/both choice [.github/workflows/mobile-release.yml]
- [x] [Review][Patch] shared:jvmTest will fail (no JVM target in shared module) — removed jvmTest step, kept testDebugUnitTest [.github/workflows/shared-tests.yml]
- [x] [Review][Patch] ios-ci.yml SwiftLint may not find config from repo root — added working-directory and --config flag [.github/workflows/ios-ci.yml]
- [x] [Review][Defer] ios-ci.yml does not run iOS unit tests (AC #2) — deferred per story dev notes: "build success is sufficient for CI validation"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

- .github/workflows/android-ci.yml (new)
- .github/workflows/ios-ci.yml (new, patched: SwiftLint working-directory)
- .github/workflows/shared-tests.yml (new, patched: removed jvmTest)
- .github/workflows/mobile-release.yml (new, patched: workflow_dispatch + platform input)
- mobile/.editorconfig (new)
- mobile/iosApp/.swiftlint.yml (new, patched: rules_customization → top-level)
- mobile/build.gradle.kts (modified: ktlint plugin)
- mobile/androidApp/build.gradle.kts (modified: ktlint plugin + filter)
- mobile/shared/build.gradle.kts (modified: ktlint plugin + filter)
- mobile/fastlane/Fastfile (new, review fix)
- mobile/fastlane/Appfile (new, review fix)
- mobile/fastlane/Matchfile (new, review fix)
- mobile/Gemfile (new, review fix)
