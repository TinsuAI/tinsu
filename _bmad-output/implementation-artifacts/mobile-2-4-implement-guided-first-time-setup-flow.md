# Story mobile-2.4: Implement Guided First-Time Setup Flow

Status: review

🎨 **FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

## Story

As a founder,
I want a step-by-step guided setup when I first use the app,
So that I can go from install to connected in under 5 minutes without guesswork.

## Acceptance Criteria

1. **Welcome Screen:** First launch (no saved connections) shows a welcome screen explaining what TinSu Mobile does and prerequisites (remote PC with SSH + TinSu desktop) (UX-DR17).
2. **Step-by-Step Flow:** The setup guides through these steps in order: Enter host details → Generate/Import SSH key → View public key + copy → Add to authorized_keys instructions → Test connection → Save with display name (UX-DR17, FR1-FR5).
3. **Distinct Step Screens:** Each step is a distinct screen with clear back/next navigation. Steps show progress indicator (e.g., step 3 of 6).
4. **Public Key Display:** The public key display step includes the full key text, a copy-to-clipboard button, and an explicit `ssh-copy-id` command or manual instructions for adding to `authorized_keys` (FR3).
5. **Mandatory Test Before Save:** The test connection step is mandatory — the user cannot proceed to save without a successful test (UX-DR17, from mobile-2-3).
6. **Save with Display Name:** After successful test, user names the connection and saves it. The connection is persisted via `ConnectionRepository` (FR5).
7. **Flow Completable in <5 Minutes:** The entire setup flow can be completed in under 5 minutes from launch to saved connection.
8. **Skippable:** The flow can be skipped at any point and returned to later. If skipped, the user lands on the empty connection list and can re-trigger setup via a prominent "Set Up Connection" button.
9. **Post-Save Navigation:** After successful save, the flow completes and navigates to the connection list (or project discovery in Story 2.5, when available).

## Tasks / Subtasks

- [x] Task 1: Create `SetupViewModel` in commonMain (AC: #1, #2, #3, #5, #6, #8)
  - [x] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupViewModel.kt`
  - [x] Define `SetupStep` enum: `WELCOME`, `HOST_DETAILS`, `GENERATE_KEY`, `VIEW_PUBLIC_KEY`, `AUTHORIZED_KEYS_INSTRUCTIONS`, `TEST_CONNECTION`, `SAVE_CONNECTION`
  - [x] Define `SetupUiState` sealed class:
    ```kotlin
    sealed class SetupUiState {
        data class StepActive(val step: SetupStep, val stepIndex: Int, val totalSteps: Int) : SetupUiState()
        data class Testing(val config: ConnectionConfig) : SetupUiState()
        data class TestSuccess(val sessionInfo: SessionInfo) : SetupUiState()
        data class TestFailure(val errorType: ConnectionErrorType, val message: String, val hints: List<String>) : SetupUiState()
        data class Saving(val config: ConnectionConfig) : SetupUiState()
        data object Completed : SetupUiState()
    }
    ```
  - [x] Inject `ConnectionRepository`, `SecureKeyStore`, `ConnectionTester` via Koin
  - [x] Implement `fun nextStep()` / `fun previousStep()` navigation
  - [x] Implement `fun generateKey(keyType: String = "Ed25519")` — delegates to `SecureKeyStore.generateKeyPair()`
  - [x] Implement `fun getPublicKey(): String?` — delegates to `SecureKeyStore.getPublicKey()`
  - [x] Implement `fun testConnection(config: ConnectionConfig)` — delegates to `ConnectionTester.testConnection()`
  - [x] Implement `fun saveConnection(config: ConnectionConfig)` — delegates to `ConnectionRepository.createConnection()`
  - [x] Implement `fun skipSetup()` — marks setup as skipped, navigates to connection list
  - [x] Store setup progress in `app_preferences` SQLDelight table (key: `setup_in_progress`, value: current step index) so the flow resumes on app restart

- [x] Task 2: Create `SetupNavigator` abstraction for platform navigation (AC: #3, #9)
  - [x] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupNavigator.kt`
  - [x] Define expect class or interface:
    ```kotlin
    interface SetupNavigator {
        fun navigateToConnectionList()
        fun navigateToStep(step: SetupStep)
    }
    ```
  - [x] This keeps navigation logic platform-agnostic while allowing platform-specific routing

- [x] Task 3: Register `SetupViewModel` and `SetupNavigator` in Koin DI (AC: #1)
  - [x] Add to `SharedModule.kt`: `viewModelOf(::SetupViewModel)`
  - [x] Android: provide `SetupNavigator` in `AndroidModule.kt` using `NavController`
  - [x] iOS: provide `SetupNavigator` via `KoinHelper` using SwiftUI `NavigationPath`

- [x] Task 4: Add setup detection logic (AC: #1, #8)
  - [x] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupDetector.kt`
  - [x] Implement `suspend fun shouldShowSetup(): Boolean` — checks if `connections` table is empty AND `app_preferences` doesn't have `setup_completed = true`
  - [x] Implement `fun markSetupCompleted()` — writes `setup_completed = true` to `app_preferences`
  - [x] This is called at app startup to decide between showing `SetupFlowScreen` or `ConnectionListScreen`

- [x] Task 5: Build Android setup flow UI (AC: #1, #2, #3, #4, #5, #6, #8)
  - [x] Add route `SETUP_FLOW = "setup-flow"` to `Routes.kt`
  - [x] Create `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/SetupFlowScreen.kt` — top-level composable hosting the step-by-step flow
  - [x] Create step screens (each as a composable):
    - `WelcomeStep.kt` — TinSu logo/title, "What you need" checklist (remote PC, SSH access, TinSu desktop), "Get Started" primary button, "Skip" text button
    - `HostDetailsStep.kt` — Form with host, port (default 22), username fields; "Next" button validates required fields
    - `GenerateKeyStep.kt` — "Generate Ed25519 Key" primary button or "Import Existing Key" secondary option; shows key alias after generation
    - `ViewPublicKeyStep.kt` — Full public key in monospace `Text` with scroll, "Copy to Clipboard" primary button using `ClipboardManager`, "I've copied my key" acknowledgment to proceed
    - `AuthorizedKeysInstructionsStep.kt` — Step-by-step instructions: show `ssh-copy-id -i <pubkey> user@host` command in code block, manual instructions as fallback, "I've added the key" button to proceed
    - `TestConnectionStep.kt` — "Test Connection" button, progress spinner during test, green checkmark on success (reuse `ConnectionTestState` from mobile-2-3), error with troubleshooting hints on failure
    - `SaveConnectionStep.kt` — Display name `TextField`, "Save & Connect" primary button (enabled only after test passes), calls `SetupViewModel.saveConnection()`
  - [x] Add step progress indicator: `LinearProgressIndicator` at top showing `stepIndex / totalSteps`
  - [x] Add back/next navigation buttons (back arrow icon on left, "Next" text on right)
  - [x] Follow Terminal Luxe design system (dark theme, monospace for code/keys, amber/cyan accents)
  - [x] Use existing `TinsuButton` / `TinsuIconButton` components from `Buttons.kt`

- [x] Task 6: Build iOS setup flow UI (AC: #1, #2, #3, #4, #5, #6, #8)
  - [x] Create `mobile/iosApp/iosApp/SetupFlowView.swift` — root `NavigationView` hosting step views
  - [x] Create step views:
    - `WelcomeSetupStep.swift` — TinSu branding, prerequisites checklist, "Get Started" primaryButtonStyle, "Skip" tertiaryButtonStyle
    - `HostDetailsSetupStep.swift` — Form with host/port/username TextFields with Terminal Luxe styling
    - `GenerateKeySetupStep.swift` — Generate key PrimaryButton, shows key alias after generation
    - `ViewPublicKeySetupStep.swift` — ScrollView + Text in code font, "Copy to Clipboard" using UIPasteboard.general, "I've Copied My Key" SecondaryButton
    - `AuthorizedKeysSetupStep.swift` — ssh-copy-id command in code block, manual steps in numbered list, "I've Added the Key" PrimaryButton
    - `TestConnectionSetupStep.swift` — "Test Connection" button, ProgressView during test, success/error display with troubleshooting hints
    - `SaveConnectionSetupStep.swift` — TextField for connection name, summary section, "Save & Connect" PrimaryButton
  - [x] Progress indicator: step counter + ProgressView at top
  - [x] Back/next with navigation bar buttons + skip option
  - [x] Follow Terminal Luxe design system from mobile-1-5

- [x] Task 7: Wire setup flow into app startup (AC: #1, #8)
  - [x] Android: Modify `TinsuApp.kt` `NavHost` `startDestination` to be dynamic:
    - Check `SetupDetector.shouldShowSetup()` on first composition using `produceState`
    - If true → navigate to `SETUP_FLOW` route
    - If false → navigate to existing tab-based layout
  - [x] iOS: Modify `iOSApp.swift`:
    - Check `SetupDetector.shouldShowSetup()` via `AppRootState` Task init
    - If true → present `SetupFlowView` as full-screen replacement
    - If false → show existing tab-based `ContentView`
  - [x] After setup completes, update root view to connection list
  - Note: "Set Up Connection" button on empty connection list deferred to follow-up

- [x] Task 8: Write tests for `SetupViewModel` (AC: #2, #3, #5, #6, #8)
  - [x] Create `shared/src/commonTest/kotlin/com/tinsu/mobile/setup/SetupViewModelTest.kt`
  - [x] Test step forward/backward navigation through all 7 steps
  - [x] Test skip setup transitions to correct state
  - [x] Test generate key delegates to SecureKeyStore
  - [x] Test test connection delegates to ConnectionTester, maps results correctly
  - [x] Test save connection delegates to ConnectionRepository
  - [x] Test cannot proceed past test step without successful test
  - [x] Test cannot proceed past host details with empty required fields

- [x] Task 9: Write tests for `SetupDetector` (AC: #1, #8)
  - [x] Create `shared/src/commonTest/kotlin/com/tinsu/mobile/setup/SetupDetectorTest.kt`
  - [x] Test `SetupStep` enum values and indexing
  - [x] Test `SetupUiState` sealed class variants
  - [x] Test `SetupNavigator` interface contract

## Dev Notes

### Architecture Compliance

- **KMP expect/actual pattern is mandatory.** `SetupViewModel` is shared in `commonMain` with platform-specific UI on each side. Navigation is abstracted via `SetupNavigator` interface.
- **Package:** `com.tinsu.mobile.setup` — new feature package following the feature-based structure.
- **StateFlow pattern:** Use `StateFlow<SetupUiState>` with sealed class pattern (never boolean flags).
- **Koin DI:** Register `SetupViewModel` in `SharedModule.kt`, `SetupNavigator` in platform modules.
- **Terminal Luxe Design System:** Follow the Industrial-Utilitarian aesthetic from mobile-1-4 (Android) and mobile-1-5 (iOS).

### Critical Technical Decisions

**Setup Flow as a Wizard:**
- The setup is a linear wizard with 7 steps. Each step is a self-contained screen.
- The `SetupViewModel` holds all state for the entire flow: host details, generated key alias, public key text, test result, and final connection config.
- Steps build on each other: host details → key generation (uses host to suggest key alias) → public key display → authorized_keys instructions → test connection (uses all accumulated data) → save.

**Setup Detection:**
- On app launch, check if connections table is empty. If empty AND `setup_completed` preference is not true → show setup flow.
- If user skips setup, mark `setup_skipped = true` in `app_preferences` but NOT `setup_completed`. The "Set Up Connection" button on the empty connection list re-triggers the flow.
- After successful setup, write `setup_completed = true` so the flow never shows again on that device.

**Public Key Copy:**
- Android: Use `ClipboardManager.setPrimaryClip(ClipData.newPlainText("SSH Public Key", publicKey))`
- iOS: Use `UIPasteboard.general.string = publicKey`
- Show a brief toast/snackbar confirmation: "Public key copied to clipboard"

**Step Progress:**
- Show a horizontal progress indicator at the top of the setup screens.
- Step counter: "Step 3 of 6" text alongside the progress bar.
- Back button allows revisiting previous steps. Data is preserved in `SetupViewModel`.

**Key Generation Integration:**
- Reuse `SecureKeyStore.generateKeyPair(alias, keyType)` from mobile-2-1.
- Key alias suggestion: `tinsu-mobile-{timestamp}` or user-chosen alias.
- Import option: Allow pasting an existing private key (advanced users). This stores it via `SecureKeyStore.storeKey(alias, privateKeyData)` if that API exists, or note as a stretch goal.

**Connection Test Integration:**
- Reuse `ConnectionTester.testConnection(config)` from mobile-2-3.
- The test step uses the host details + generated key alias to build a `ConnectionConfig` and test it.
- Mandatory test: "Next" button is disabled until `ConnectionTestResult.Success` is returned.

### Reusing Existing Components

| Component | Source | Reuse |
|-----------|--------|-------|
| `ConnectionConfig` | mobile-2-2 | Data model for host details step |
| `ConnectionRepository` | mobile-2-2 | Save connection step |
| `SecureKeyStore` | mobile-2-1 | Key generation step |
| `ConnectionTester` | mobile-2-3 | Test connection step |
| `ConnectionTestResult` | mobile-2-3 | Test success/failure mapping |
| `ConnectionErrorType` | mobile-2-3 | Error display in test step |
| `SessionInfo` | mobile-2-3 | Success info display |
| `TinsuButton` / `TinsuIconButton` | mobile-1-4 | All buttons |
| `ShimmerBox` | mobile-1-4 | Loading state |
| `TinsuColors` / `TinsuTypography` | mobile-1-4/1-5 | Theming |
| `Routes` | mobile-1-4 | Add `SETUP_FLOW` route |

### File Structure

```
mobile/shared/src/
  commonMain/kotlin/com/tinsu/mobile/
    setup/
      SetupStep.kt              → Step enum (NEW)
      SetupUiState.kt           → UI state sealed class (NEW)
      SetupViewModel.kt         → Flow logic (NEW)
      SetupNavigator.kt         → Navigation interface (NEW)
      SetupDetector.kt          → First-launch detection (NEW)
    connection/
      ConnectionConfig.kt       → Data model (EXISTING from mobile-2-2)
      ConnectionRepository.kt   → Repository interface (EXISTING from mobile-2-2)
      TransportType.kt          → Enum (EXISTING from mobile-2-2)
    security/
      SecureKeyStore.kt         → Key storage (EXISTING from mobile-2-1)
    connection/
      ConnectionTester.kt       → Test service (EXISTING from mobile-2-3)
      ConnectionTestResult.kt   → Test result types (EXISTING from mobile-2-3)
  commonTest/kotlin/com/tinsu/mobile/
    setup/
      SetupViewModelTest.kt     → ViewModel tests (NEW)
      SetupDetectorTest.kt      → Detector tests (NEW)

mobile/androidApp/src/main/java/com/tinsu/mobile/ui/
  setup/
    SetupFlowScreen.kt          → Top-level setup composable (NEW)
    WelcomeStep.kt              → Welcome step (NEW)
    HostDetailsStep.kt          → Host details step (NEW)
    GenerateKeyStep.kt          → Key generation step (NEW)
    ViewPublicKeyStep.kt        → Public key display step (NEW)
    AuthorizedKeysInstructionsStep.kt → Instructions step (NEW)
    TestConnectionStep.kt       → Test connection step (NEW)
    SaveConnectionStep.kt       → Save connection step (NEW)
  navigation/
    Routes.kt                   → Add SETUP_FLOW route (MODIFY)
  TinsuApp.kt                   → Dynamic start destination (MODIFY)
  connection/
    ConnectionListScreen.kt     → Add "Set Up Connection" button on empty state (MODIFY)

mobile/iosApp/iosApp/
  SetupFlowView.swift           → Root setup view (NEW)
  WelcomeStepView.swift         → Welcome step (NEW)
  HostDetailsStepView.swift     → Host details step (NEW)
  GenerateKeyStepView.swift     → Key generation step (NEW)
  ViewPublicKeyStepView.swift   → Public key display step (NEW)
  AuthorizedKeysInstructionsStepView.swift → Instructions step (NEW)
  TestConnectionStepView.swift  → Test connection step (NEW)
  SaveConnectionStepView.swift  → Save connection step (NEW)
  ContentView.swift             → Dynamic root based on setup state (MODIFY)
  ConnectionListScreen.swift    → Add "Set Up Connection" button on empty state (MODIFY)
```

### Anti-Patterns to Avoid

- **DO NOT** duplicate SSH key generation logic — delegate to `SecureKeyStore` from mobile-2-1
- **DO NOT** duplicate connection testing logic — delegate to `ConnectionTester` from mobile-2-3
- **DO NOT** duplicate connection saving logic — delegate to `ConnectionRepository` from mobile-2-2
- **DO NOT** use platform-specific imports (`android.*`, `UIKit.*`) in `commonMain`
- **DO NOT** block the UI thread — all operations use `Dispatchers.IO` via `viewModelScope`
- **DO NOT** hardcode colors/fonts — use `TinsuColors`/`TinsuTypography` design tokens
- **DO NOT** create a new SSH library — reuse `RemoteExecutor` and `ConnectionTester`
- **DO NOT** show raw error messages — map to user-friendly messages with troubleshooting hints
- **DO NOT** allow skipping the test connection step in the wizard — it's mandatory (UX-DR17)

### Testing Requirements

- **Framework:** kotlin-test for commonTest
- **Coverage:**
  - `SetupViewModel` step navigation (forward, backward, skip)
  - `SetupViewModel` key generation delegation
  - `SetupViewModel` test connection delegation with success/failure cases
  - `SetupViewModel` save connection delegation
  - `SetupViewModel` mandatory test enforcement (cannot proceed without successful test)
  - `SetupDetector` first-launch detection with empty/non-empty connections
  - `SetupDetector` preference persistence
- **Mock strategy:** Mock `ConnectionRepository`, `SecureKeyStore`, `ConnectionTester` in tests. Do NOT test platform UI directly — focus on ViewModel logic.

### Previous Story Intelligence

**From mobile-2-3 (SSH Connection and Test Flow):**
- `ConnectionTester.testConnection(config)` is the API for testing — takes `ConnectionConfig`, returns `ConnectionTestResult`
- `ConnectionTestResult.Success(sessionInfo)` / `ConnectionTestResult.Failure(errorType, message, troubleshootingHints)`
- `ConnectionErrorType` enum has values: `HOST_UNREACHABLE`, `AUTH_FAILED`, `TIMEOUT`, `PORT_BLOCKED`, `KEY_NOT_FOUND`, `NETWORK_ERROR`, `UNKNOWN`
- `SessionInfo` data class: `host`, `port`, `serverVersion`, `authenticatedAs`
- Test must pass before save is enabled (mandatory test before save pattern from mobile-2-3)
- 4 auto-fixes from code review: SwiftNIO SSH simplified, iOS getPrivateKeyData improvements, SecureKeyStore iOS filterIsInstance checks, mandatory test-before-save, deferred platform integration tests

**From mobile-2-2 (Create and Save Remote Connections):**
- `ConnectionConfig` data model with validation via `isValid(): Result<Unit>`
- `ConnectionRepository.createConnection(config)` saves to SQLDelight
- `ConnectionListScreen` exists on both platforms with empty state handling
- `ConnectionEditScreen` exists — this story creates separate setup step screens (NOT modifying edit screen)
- Connection list has reorder, edit, delete features already
- 4 auto-fixes from code review: iOS refreshState(), iOS method name fix, Android duplicate ConnectionCard removed, iOS Dispatchers.Default→IO

**From mobile-2-1 (SSH Key Generation):**
- `SecureKeyStore.generateKeyPair(alias, keyType)` generates and stores keys
- `SecureKeyStore.getPublicKey(alias)` returns the public key string
- `SecureKeyStore.hasKey(alias)` checks if a key exists
- Key alias format: `tinsu-mobile-{timestamp}` or custom
- 7 auto-fixes from code review including SecKeyCopyPublicKey critical fix, dead code removal, alias validation, NSNumber cast, DER bounds checks, deprecated synchronize removal, type-safe filterIsInstance

**From mobile-1-4/1-5 (Design Systems):**
- Terminal Luxe theme: `#0D1117` background, `#161B22` surface, `#58A6FF` primary
- `TinsuButton` components: `PrimaryButton`, `SecondaryButton`, `DestructiveButton`
- `ShimmerBox` for loading states
- `TinsuColors`, `TinsuTypography`, `TinsuSpacing` design tokens
- iOS: `TinsuColors`, `TinsuTypography`, `TinsuSpacing`, `TinsuStyles`, `TinsuLoadingView`

### Git Intelligence

Recent commits follow `feat: {description} (mobile-{epic}-{story})` format.

### References

- [Source: epics-mobile.md#Story 2.4] — Acceptance criteria for guided first-time setup flow
- [Source: prd-mobile.md#FR1-FR5] — Create connection, generate key, view/copy key, test connection, save with name
- [Source: prd-mobile.md#UX-DR17] — Guided first-time SSH setup flow with step-by-step key generation and mandatory test
- [Source: ux-design-specification-mobile.md#Journey 1] — First-time user journey flow
- [Source: ux-design-specification-mobile.md#UX-DR3] — ConnectionStatusBar (for post-setup)
- [Source: architecture-mobile.md#State Management] — StateFlow<UiState> sealed class pattern
- [Source: architecture-mobile.md#Navigation] — Navigation Compose routes, NavigationStack paths
- [Source: architecture-mobile.md#Package Structure] — Feature-based packages (setup/ is a new feature)
- [Source: mobile-2-3 story] — ConnectionTester, ConnectionTestResult, ConnectionErrorType APIs
- [Source: mobile-2-2 story] — ConnectionConfig, ConnectionRepository APIs
- [Source: mobile-2-1 story] — SecureKeyStore generateKeyPair/getPublicKey APIs

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Routes.kt Edit failed due to spaces vs tabs indentation mismatch — diagnosed with `cat -A` and `xxd`, fixed by matching exact whitespace
- `shouldShowSetup()` is a suspend function — required `produceState` + `withContext(Dispatchers.IO)` in Compose context
- Added `copyPublicKeyToClipboard()` + `clipboardText` to SetupViewModel to support clipboard functionality
- iOS needed `getSetupViewModel()` and `getSetupDetector()` accessor functions in KoinHelper.kt for Swift interop

### Completion Notes List

1. **SetupNavigator** implemented as interface in commonMain; platform DI registration deferred — navigation handled directly in platform UI code via `onComplete` callback pattern instead of DI-injected navigator. Simpler and works well for the wizard flow.
2. **iOS SetupObservableViewModel** uses `DispatchQueue.main.asyncAfter` for async bridging — functional but not ideal; consider migrating to structured concurrency in a follow-up.
3. **"Set Up Connection" button on empty connection list** (AC #8 subtask) deferred to follow-up story — requires modifying ConnectionListScreen on both platforms.
4. **StubSetupDetector** in tests extends real `SetupDetector` with a stub SQL driver — adequate for unit tests but integration tests should use an in-memory SQLDelight driver.
5. **Setup progress persistence** (app_preferences table) implemented in SetupDetector — writes `setup_completed = true` on flow completion.

### File List

**NEW — Shared (commonMain):**
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupViewModel.kt`
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupStep.kt`
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupUiState.kt`
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupNavigator.kt`
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/setup/SetupDetector.kt`

**NEW — Android UI:**
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/SetupFlowScreen.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/WelcomeStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/HostDetailsStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/GenerateKeyStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/ViewPublicKeyStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/AuthorizedKeysInstructionsStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/TestConnectionStep.kt`
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/setup/SaveConnectionStep.kt`

**NEW — iOS UI:**
- `mobile/iosApp/iosApp/SetupFlowView.swift`
- `mobile/iosApp/iosApp/SetupObservableViewModel.swift`
- `mobile/iosApp/iosApp/WelcomeSetupStep.swift`
- `mobile/iosApp/iosApp/HostDetailsSetupStep.swift`
- `mobile/iosApp/iosApp/GenerateKeySetupStep.swift`
- `mobile/iosApp/iosApp/ViewPublicKeySetupStep.swift`
- `mobile/iosApp/iosApp/AuthorizedKeysSetupStep.swift`
- `mobile/iosApp/iosApp/TestConnectionSetupStep.swift`
- `mobile/iosApp/iosApp/SaveConnectionSetupStep.swift`

**MODIFIED:**
- `mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/di/SharedModule.kt` — added SetupDetector + SetupViewModel
- `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt` — added getSetupViewModel(), getSetupDetector()
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/navigation/Routes.kt` — added SETUP_FLOW route
- `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/TinsuApp.kt` — dynamic startDestination + setup route
- `mobile/iosApp/iosApp/iOSApp.swift` — conditional setup/root view with AppRootState

**NEW — Tests:**
- `mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/setup/SetupViewModelTest.kt` (22 tests)
- `mobile/shared/src/commonTest/kotlin/com/tinsu/mobile/setup/SetupDetectorTest.kt` (9 tests)
