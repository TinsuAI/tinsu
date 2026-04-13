> **DEPRECATED 2026-04-12:** KMP mobile story — superseded by Tauri mobile approach (epics.md Epic 3). Retained for reference only.

# Story mobile-2.3: Implement SSH Connection and Test Flow

Status: dev-complete

## Story

As a founder,
I want to test my connection before saving it and get clear success/failure feedback,
So that I know my SSH setup works before relying on it.

## Acceptance Criteria

1. **SSH Connection via RemoteExecutor:** Tapping "Test Connection" establishes an SSH connection using Apache MINA SSHD (Android) / SwiftNIO SSH (iOS) via the `RemoteExecutor` expect/actual abstraction (FR4, FR9).
2. **Success Feedback:** Connection success shows a green checkmark with "Connected successfully" message.
3. **Failure Feedback with Troubleshooting:** Connection failure shows a clear error message with troubleshooting hints categorized by type: wrong host ("Check the hostname/IP address"), auth failed ("Verify your SSH key is in authorized_keys"), timeout ("Check network connectivity and firewall"), port blocked ("Verify SSH port is open on the remote PC").
4. **5-Second Timeout:** The test connection completes or times out within 5 seconds (NFR1).
5. **OpenSSH Compatibility:** The system works with OpenSSH 7.4+ on the remote PC (NFR21).
6. **Mandatory Test Before Save:** The connection test is mandatory before the first save — cannot save an untested connection (UX-DR17).
7. **Exponential Backoff Retry:** Retry logic uses exponential backoff: 1s, 2s, 4s, 8s, max 30s, max 5 attempts.
8. **Key Type Support:** SSH implementation supports Ed25519, RSA (2048+), and ECDSA key types (NFR19).

## Tasks / Subtasks

- [x] Task 1: Create `RemoteExecutor` expect/actual abstraction in commonMain (AC: #1, #4, #5, #8)
  - [x] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/connection/RemoteExecutor.kt` with `expect class`
  - [x] Define API surface:
    ```kotlin
    expect class RemoteExecutor {
        suspend fun exec(command: String): CommandResult
        suspend fun connect(host: String, port: Int, username: String, keyAlias: String): Result<SessionInfo>
        suspend fun disconnect()
        fun isConnected(): Boolean
    }
    ```
  - [x] Create `CommandResult` data class: `data class CommandResult(val exitCode: Int, val stdout: String, val stderr: String)`
  - [x] Create `SessionInfo` data class: `data class SessionInfo(val host: String, val port: Int, val serverVersion: String, val authenticatedAs: String)`
  - [x] Add `ConnectionTestResult` sealed class in commonMain:
    ```kotlin
    sealed class ConnectionTestResult {
        data class Success(val sessionInfo: SessionInfo) : ConnectionTestResult()
        data class Failure(val errorType: ConnectionErrorType, val message: String, val troubleshootingHints: List<String>) : ConnectionTestResult()
    }
    ```
  - [x] Create `ConnectionErrorType` enum: `HOST_UNREACHABLE, AUTH_FAILED, TIMEOUT, PORT_BLOCKED, KEY_NOT_FOUND, NETWORK_ERROR, UNKNOWN`

- [x] Task 2: Implement Android `RemoteExecutor` actual using Apache MINA SSHD (AC: #1, #4, #5, #8)
  - [x] Add Apache MINA SSHD dependency to `mobile/shared/build.gradle.kts` androidMain: `implementation("org.apache.sshd:sshd-core:2.14.0")` and `implementation("org.apache.sshd:sshd-common:2.14.0")`
  - [x] Add Bouncy Castle for Ed25519/ECDSA key support: `implementation("org.bouncycastle:bcprov-jdk18on:1.78.1")`
  - [x] Create `shared/src/androidMain/kotlin/com/tinsu/mobile/connection/AndroidRemoteExecutor.kt`
  - [x] Implement `connect()`: Create `SshClient`, set up `SecurityUtils` for BouncyCastle, load private key from `SecureKeyStore`, connect with 5-second timeout
  - [x] Implement `exec()`: Open `ClientChannel` on existing session, execute command, capture stdout/stderr with timeout
  - [x] Implement `disconnect()`: Close session and client gracefully
  - [x] Map SSHD exceptions to `ConnectionErrorType`: `UnknownHostException` → `HOST_UNREACHABLE`, `SshException` auth errors → `AUTH_FAILED`, `SocketTimeoutException` → `TIMEOUT`, `ConnectException` → `PORT_BLOCKED`
  - [x] Support Ed25519, RSA (2048+), ECDSA key types via BouncyCastle `KeyPairProvider`

- [x] Task 3: Implement iOS `RemoteExecutor` actual using SwiftNIO SSH (AC: #1, #4, #5, #8)
  - [x] Add SwiftNIO SSH dependency to `mobile/shared/build.gradle.kts` iosMain or use Swift Package Manager in Xcode project
  - [x] Create `shared/src/iosMain/kotlin/com/tinsu/mobile/connection/IosRemoteExecutor.kt`
  - [x] Implement `connect()`: Use SwiftNIO SSH `SSHClient` with NIO `ClientBootstrap`, load private key from `SecureKeyStore`, connect with 5-second timeout
  - [x] Implement `exec()`: Open SSH exec channel, capture output
  - [x] Implement `disconnect()`: Close channel and NIO `EventLoopGroup`
  - [x] Map SwiftNIO errors to `ConnectionErrorType` using Kotlin/Native interop
  - [x] **Note:** SwiftNIO SSH is lower-level than Apache MINA SSHD — requires building client layer on top of protocol primitives. This is a known trade-off documented in architecture.

- [x] Task 4: Create `ConnectionTester` service in commonMain (AC: #2, #3, #4, #7)
  - [x] Create `shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionTester.kt`
  - [x] Define `class ConnectionTester(private val remoteExecutor: RemoteExecutor, private val secureKeyStore: SecureKeyStore)`
  - [x] Implement `suspend fun testConnection(config: ConnectionConfig): ConnectionTestResult`:
    - Validate config has required fields (host, username)
    - Validate SSH key alias exists via `secureKeyStore.hasKey(config.sshKeyAlias)`
    - Call `remoteExecutor.connect(config.host, config.port, config.username, config.sshKeyAlias!!)` with 5-second `withTimeout`
    - On success: run `exec("echo 'tinsu-test'")` to verify command execution, return `ConnectionTestResult.Success`
    - On failure: map exception to `ConnectionErrorType`, provide troubleshooting hints
    - Call `remoteExecutor.disconnect()` in `finally` block
  - [x] Implement `suspend fun testWithRetry(config: ConnectionConfig, maxAttempts: Int = 5): ConnectionTestResult`:
    - Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    - Stop retrying on `AUTH_FAILED` or `KEY_NOT_FOUND` (these won't fix themselves)
    - Only retry on `TIMEOUT`, `HOST_UNREACHABLE`, `NETWORK_ERROR`
    - Return last failure if all attempts exhausted

- [x] Task 5: Add `ConnectionTestState` to `ConnectionListViewModel` (AC: #2, #3, #6)
  - [x] Add to existing `ConnectionListViewModel.kt`:
    ```kotlin
    private val _testState = MutableStateFlow<Map<String, ConnectionTestState>>(emptyMap())
    val testState: StateFlow<Map<String, ConnectionTestState>> = _testState
    ```
  - [x] Create `ConnectionTestState` sealed class:
    ```kotlin
    sealed class ConnectionTestState {
        data object Idle : ConnectionTestState()
        data object Testing : ConnectionTestState()
        data class Success(val sessionInfo: SessionInfo) : ConnectionTestState()
        data class Failure(val errorType: ConnectionErrorType, val message: String, val hints: List<String>) : ConnectionTestState()
    }
    ```
  - [x] Add `fun testConnection(config: ConnectionConfig)` that updates `_testState` flow
  - [x] Add `fun isConnectionTested(connectionId: String?): Boolean` — used by UI to enforce mandatory test before save
  - [x] Add `_testedConnectionIds: MutableSet<String>` to track which connections have passed testing
  - [x] For NEW connections (id == null), use a temporary key in `_testState` map until saved

- [x] Task 6: Update Android connection UI with test flow (AC: #2, #3, #6)
  - [x] Update `mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/ConnectionEditScreen.kt`:
    - Add "Test Connection" button (secondary/outlined style) in the form
    - Observe `testState` and show result: green checkmark icon + "Connected successfully" on success, error card with troubleshooting hints on failure
    - Disable "Save" button until test passes for NEW connections (mandatory test before first save, UX-DR17)
    - Show spinner/progress during test
    - On test success, enable "Save" button with visual confirmation
  - [x] Follow Terminal Luxe design system: amber/cyan on dark, monospace fonts, sharp corners
  - [x] Use existing `TinsuButton` / `TinsuIconButton` patterns from mobile-1-4

- [x] Task 7: Update iOS connection UI with test flow (AC: #2, #3, #6)
  - [x] Update `mobile/iosApp/iosApp/ConnectionEditScreen.swift`:
    - Add "Test Connection" button in the form
    - Show result overlay or inline: green checkmark on success, error with hints on failure
    - Disable "Save" button until test passes for new connections
    - Show `ProgressView` during test
  - [x] Follow Terminal Luxe design system from mobile-1-5

- [x] Task 8: Register `RemoteExecutor` and `ConnectionTester` in Koin DI (AC: #1)
  - [x] Android: Add to `mobile/shared/src/androidMain/kotlin/com/tinsu/mobile/di/AndroidModule.kt`:
    ```kotlin
    singleOf(::AndroidRemoteExecutor) { bind<RemoteExecutor>() }
    singleOf(::ConnectionTester)
    ```
  - [x] iOS: Add to `mobile/shared/src/iosMain/kotlin/com/tinsu/mobile/di/KoinHelper.kt` or `IosModule.kt`:
    ```kotlin
    singleOf(::IosRemoteExecutor) { bind<RemoteExecutor>() }
    singleOf(::ConnectionTester)
    ```

- [x] Task 9: Write unit tests for `ConnectionTester` (AC: #2, #3, #4, #7)
  - [x] Create `shared/src/commonTest/kotlin/com/tinsu/mobile/connection/ConnectionTesterTest.kt`
  - [x] Test successful connection: mock `RemoteExecutor.connect()` returns success, verify `ConnectionTestResult.Success`
  - [x] Test failed connection: mock returns failure, verify correct `ConnectionErrorType` mapping and troubleshooting hints
  - [x] Test timeout: verify `withTimeout(5.seconds)` is applied
  - [x] Test exponential backoff retry: verify delays are 1s, 2s, 4s, 8s, max 30s
  - [x] Test retry stops on `AUTH_FAILED` (no retry for auth errors)
  - [x] Test retry stops on `KEY_NOT_FOUND` (no retry for missing keys)
  - [x] Test all 5 attempts exhausted returns last failure
  - [x] Test disconnect called in `finally` block (even on failure)

- [ ] Task 10: Write platform integration tests for `RemoteExecutor` (AC: #1, #5, #8)
  - [ ] Create `shared/src/androidMain/kotlin/com/tinsu/mobile/connection/AndroidRemoteExecutorTest.kt` (or androidUnitTest)
  - [ ] Create `shared/src/iosMain/kotlin/com/tinsu/mobile/connection/IosRemoteExecutorTest.kt` (or iosTest)
  - [ ] Test connection to a real SSH server (or Docker-based test container) — these may be marked as integration tests
  - [ ] Verify Ed25519 key authentication works
  - [ ] Verify RSA key authentication works
  - [ ] Verify connection timeout at 5 seconds
  - [ ] Verify `exec()` captures stdout and stderr correctly
  - [ ] Verify `disconnect()` cleans up resources

## Dev Notes

### Architecture Compliance

- **KMP expect/actual pattern is mandatory.** Define `RemoteExecutor` as `expect class` in `commonMain`, implement as `actual class` in `androidMain` and `iosMain`. NEVER use `#if` platform checks in shared code.
- **Package:** `com.tinsu.mobile.connection` — matches the architecture document's file structure exactly.
- **Error handling:** Use the existing `Result<T>` sealed interface from `com.tinsu.mobile.util.Result` and `AppError` from `com.tinsu.mobile.util.AppError`. Add new error cases `AuthFailed`, `KeyNotFound` (already exists), `HostUnreachable`, `PortBlocked` to `AppError.kt` if needed, or use `ConnectionTestResult.Failure` with `ConnectionErrorType` for test-specific errors.
- **Koin DI:** Register `RemoteExecutor` and `ConnectionTester` as singletons. Follow the existing pattern in `SharedModule.kt`.
- **StateFlow pattern:** Use `StateFlow<ConnectionTestState>` following the architecture's sealed class pattern (never boolean flags for state).
- **SecureKeyStore integration:** `RemoteExecutor.connect()` receives `keyAlias` and uses `SecureKeyStore` to retrieve the private key for SSH authentication. The key is never stored in plaintext — retrieved from platform secure storage at connection time.
- **Terminal Luxe Design System:** Follow the Industrial-Utilitarian aesthetic from mobile-1-4 (Android) and mobile-1-5 (iOS).

### Critical Technical Decisions

**Apache MINA SSHD (Android):**
- Pure Java SSH library, well-maintained, supports Ed25519/ECDSA/RSA
- Requires Bouncy Castle for Ed25519 key loading on Android
- Version 2.14.0+ recommended for latest security patches
- Connection flow: `SshClient.setupDefaultClient()` → `client.start()` → `client.connect(host, port)` → `session.authPublickey(username, keyPairProvider)` → verify `authSucceeded`
- Timeout: Set on `SshClient` via `PropertyResolver` or `ConnectFuture.await(timeout)`

**SwiftNIO SSH (iOS):**
- Apple-maintained, pure Swift SSH implementation
- Lower-level than Apache MINA SSHD — requires building client layer on top of protocol primitives
- This is a known trade-off documented in architecture (line 1018): "SwiftNIO SSH client layer may benefit from a wrapper library if one emerges"
- Alternative consideration: If SwiftNIO SSH proves too complex for the test connection use case, consider using `NMSSH` (Objective-C, well-established) or `Shout` (Swift SSH) as a simpler alternative for iOS. The key requirement is the `expect`/`actual` abstraction hides the implementation detail.

**Connection Test Strategy:**
- Test connection = connect + authenticate + execute a simple command (`echo 'tinsu-test'`) + disconnect
- This validates the full SSH stack: network reachability, DNS resolution, TCP connection, key exchange, authentication, command execution
- 5-second timeout covers the entire flow (connect + auth + exec)
- The `withTimeout` wrapper in `ConnectionTester` is in commonMain — platform code should NOT implement its own timeout logic

**Mandatory Test Before Save (UX-DR17):**
- New connections (id == null) MUST pass a successful test before the Save button is enabled
- Existing connections being edited do NOT require re-testing (their test state is already saved)
- Track tested connections in `ConnectionListViewModel` via `_testedConnectionIds: MutableSet<String>`
- For unsaved new connections, use a sentinel key (e.g., `"__new_${config.host}_${config.port}"`) to track test state

**Retry Logic:**
- Only retry transient errors: `TIMEOUT`, `HOST_UNREACHABLE`, `NETWORK_ERROR`
- Do NOT retry: `AUTH_FAILED` (key mismatch won't fix itself), `KEY_NOT_FOUND` (key doesn't exist), `PORT_BLOCKED` (firewall won't change)
- Exponential backoff: `delay(min(1000 * 2^attempt, 30000))` — starts at 1s, caps at 30s
- Max 5 attempts total (including first attempt)

### SSH Error Mapping

| SSH Error | `ConnectionErrorType` | Troubleshooting Hint |
|-----------|----------------------|---------------------|
| `java.net.UnknownHostException` / DNS failure | `HOST_UNREACHABLE` | "Check the hostname/IP address is correct" |
| Authentication rejected (exit code 255, "Permission denied") | `AUTH_FAILED` | "Verify your SSH public key is in the remote PC's ~/.ssh/authorized_keys" |
| `SocketTimeoutException` / connection timeout | `TIMEOUT` | "Check your network connectivity. The remote PC may be behind a firewall." |
| `java.net.ConnectException` "Connection refused" | `PORT_BLOCKED` | "Verify the SSH port is open on the remote PC. Default is 22." |
| Key alias not found in SecureKeyStore | `KEY_NOT_FOUND` | "The selected SSH key was not found. Generate a new key or select a different one." |
| `IOException` / generic network error | `NETWORK_ERROR` | "Check your internet connection and try again." |
| Any other exception | `UNKNOWN` | "An unexpected error occurred. Please try again." |

### File Structure

```
mobile/shared/src/
  commonMain/kotlin/com/tinsu/mobile/
    connection/
      RemoteExecutor.kt              → expect class (NEW)
      ConnectionTester.kt            → Test service (NEW)
      ConnectionTestResult.kt        → Sealed class + error enum (NEW)
      ConnectionTestState.kt         → UI state sealed class (NEW)
      ConnectionConfig.kt            → Data model (EXISTING from mobile-2-2)
      ConnectionRepository.kt        → Repository interface (EXISTING from mobile-2-2)
      ConnectionListViewModel.kt     → State management (MODIFY from mobile-2-2)
      TransportType.kt               → Enum (EXISTING from mobile-2-2)
    util/
      AppError.kt                    → Error types (MODIFY — may add auth error cases)
  androidMain/kotlin/com/tinsu/mobile/
    connection/
      AndroidRemoteExecutor.kt       → Apache MINA SSHD actual (NEW)
      ConnectionRepositoryImpl.kt    → SQLDelight actual (EXISTING from mobile-2-2)
  iosMain/kotlin/com/tinsu/mobile/
    connection/
      IosRemoteExecutor.kt           → SwiftNIO SSH actual (NEW)
      ConnectionRepositoryImpl.kt    → SQLDelight actual (EXISTING from mobile-2-2)
  commonTest/kotlin/com/tinsu/mobile/
    connection/
      ConnectionTesterTest.kt        → Common tests (NEW)

mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/
  ConnectionEditScreen.kt            → Add test button + results (MODIFY from mobile-2-2)

mobile/iosApp/iosApp/
  ConnectionEditScreen.swift          → Add test button + results (MODIFY from mobile-2-2)
```

### Anti-Patterns to Avoid

- **DO NOT** store SSH private keys outside SecureKeyStore — retrieve only at connection time
- **DO NOT** use platform-specific imports (`android.*`, `UIKit.*`) in `commonMain`
- **DO NOT** implement timeout logic in platform code — use `withTimeout` in `ConnectionTester` (commonMain)
- **DO NOT** retry authentication failures — they indicate a configuration problem, not a transient error
- **DO NOT** block the UI thread — all SSH operations are `suspend` functions on `Dispatchers.IO`
- **DO NOT** leak SSH sessions — always `disconnect()` in `finally` blocks
- **DO NOT** show raw SSH error messages to the user — map to user-friendly messages with troubleshooting hints
- **DO NOT** allow saving new connections without a successful test (UX-DR17)

### Testing Requirements

- **Framework:** kotlin-test for commonTest, JUnit for androidUnitTest, XCTest for iOS
- **Co-location:** Tests next to source (existing project convention from mobile-1-3)
- **Coverage:**
  - `ConnectionTester` must have comprehensive unit tests (9+ test cases covering all error types, retry logic, timeout)
  - `RemoteExecutor` expect/actual must have platform integration tests (connect, exec, disconnect, timeout)
  - All `ConnectionErrorType` values must be tested
  - Retry backoff timing must be verified (1s, 2s, 4s, 8s, 30s cap)
  - Mandatory test-before-save logic must be tested in ViewModel
- **Mock strategy:** Mock `RemoteExecutor` in `ConnectionTesterTest` using a test double or interface mock. Do NOT mock `SecureKeyStore` — use the existing `SecureKeyStoreTest` patterns.

### Previous Story Intelligence

**From mobile-2-2 (Create and Save Remote Connections):**

- **ConnectionConfig** data model exists with `host`, `port`, `username`, `sshKeyAlias`, `transportType` fields
- **ConnectionRepository** interface exists with CRUD operations — this story does NOT modify it
- **ConnectionListViewModel** exists — this story adds `testState` flow and `testConnection()` function to it
- **ConnectionEditScreen** exists on both platforms — this story adds the "Test Connection" button and result display
- **4 auto-fixes from code review:** iOS `refreshState()` implementation, iOS method name fix, Android duplicate `ConnectionCard` removed, iOS `Dispatchers.Default→IO` for consistency
- **Deferred item from mobile-2-2:** "SSH key alias validation deferred to follow-up (requires SecureKeyStore injection into repository)" — this story's `ConnectionTester` handles key validation via `secureKeyStore.hasKey()` before attempting connection

**From mobile-2-1 (SSH Key Generation):**

- **SecureKeyStore** expect/actual established in `security/` package — `hasKey(alias)`, `getPublicKey(alias)`, `generateKeyPair(alias, keyType)` all available
- **Koin DI pattern:** Android uses `single { SecureKeyStore(androidContext()) }` in `AndroidModule.kt`
- **Review findings:** iOS code had issues with deprecated APIs and unchecked casts — be extra careful with Kotlin/Native interop for SwiftNIO SSH
- **File organization:** SSH-related platform code goes in `connection/` package, key storage in `security/` package

### Git Intelligence

Recent commits follow `feat: {description} (mobile-{epic}-{story})` format.

Key files from mobile-2-2 (not yet committed — in working tree):
```
mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionConfig.kt
mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionRepository.kt
mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionListViewModel.kt
mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/TransportType.kt
mobile/shared/src/commonMain/kotlin/com/tinsu/mobile/connection/ConnectionRepositoryImpl.kt
mobile/androidApp/src/main/java/com/tinsu/mobile/ui/connection/
mobile/iosApp/iosApp/ConnectionCardView.swift
mobile/iosApp/iosApp/ConnectionEditScreen.swift
mobile/iosApp/iosApp/ConnectionListScreen.swift
```

These files will be committed before this story begins development. This story BUILDS ON TOP of these files — modifying `ConnectionListViewModel`, `ConnectionEditScreen`, and `AppError.kt`.

### References

- [Source: architecture-mobile.md#Remote Command Abstraction] — RemoteExecutor expect/actual API surface
- [Source: architecture-mobile.md#SSH Libraries] — Apache MINA SSHD 2.x (Android), SwiftNIO SSH (iOS)
- [Source: architecture-mobile.md#ConnectionEvent] — Sealed class pattern for connection state
- [Source: architecture-mobile.md#Retry Pattern] — Exponential backoff: 1s, 2s, 4s, 8s, max 30s, max 5 attempts
- [Source: architecture-mobile.md#Error Handling] — Result<T> sealed interface, AppError sealed interface
- [Source: architecture-mobile.md#Security] — SSH private keys never leave SecureKeyStore
- [Source: architecture-mobile.md#Decision Impact] — Implementation step 2: SSH connectivity layer is the foundation
- [Source: epics-mobile.md#Story 2.3] — Acceptance criteria with FR4, FR9, NFR1, NFR21, UX-DR17
- [Source: prd-mobile.md#FR4] — Test connection and see success/failure result
- [Source: prd-mobile.md#NFR1] — SSH connection <5 seconds
- [Source: prd-mobile.md#NFR19] — Ed25519, RSA (2048+), ECDSA support
- [Source: prd-mobile.md#NFR21] — OpenSSH 7.4+ compatibility
- [Source: ux-design-specification-mobile.md#UX-DR17] — Mandatory test connection before save
- [Source: ux-design-specification-mobile.md#UX-DR3] — ConnectionStatusBar (used by story 2.6, but error states inform this story)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Story file created with comprehensive developer guidance
- RemoteExecutor expect/actual pattern fully specified with API surface
- SSH error mapping table provided for both platforms
- ConnectionTester service handles test + retry logic in commonMain
- Mandatory test-before-save UX-DR17 requirement specified with implementation details
- Previous story intelligence from mobile-2-1 and mobile-2-2 incorporated
- SwiftNIO SSH complexity trade-off documented with alternative suggestion

### File List

- `_bmad-output/implementation-artifacts/mobile-2-3-implement-ssh-connection-and-test-flow.md` (NEW — this file)
