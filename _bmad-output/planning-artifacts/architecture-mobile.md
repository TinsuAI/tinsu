---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prd-mobile.md
  - _bmad-output/planning-artifacts/project-context.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/product-brief-TinSu-2026-01-02.md
  - _bmad-output/planning-artifacts/mobile-ui-design-recommendations.md
workflowType: 'architecture'
project_name: 'TinSu Mobile'
user_name: 'Tinsu'
date: '2026-04-06'
status: 'complete'
completedAt: '2026-04-06'
lastStep: 8
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The PRD defines 48 functional requirements across 8 capability areas:

- **Connection Management (FR1-FR8):** SSH key generation, connection CRUD, mosh transport selection, secure key storage
- **Remote Session Management (FR9-FR15):** SSH/mosh connectivity, project discovery, tmux session attachment, connection state detection, auto-reconnect, message buffering
- **Agent Chat (FR16-FR23):** Session listing, message history, send/receive via tmux stdin/stdout, agent persona selection, session status indicators
- **Planning Document Viewer (FR24-FR28):** Remote directory browsing, markdown rendering, offline cache, in-document search, internal link navigation
- **Code Review (FR29-FR36):** Task list with status, diff viewer with syntax highlighting, pinch-to-zoom, approve/request-changes/reject actions, agent reasoning log
- **Project Dashboard (FR37-FR39):** Overview with active sessions/pending reviews, bottom navigation, attention count badges
- **Local Mode — Android Only (FR40-FR44):** Termux integration, Node.js detection, local project management, Claude Code CLI execution, unified UI for local projects
- **Settings & Configuration (FR45-FR48):** Connection management, mosh settings, cache management, diagnostics

**Non-Functional Requirements:**

- **Performance (NFR1-NFR10):** SSH <5s, mosh handoff <3s, cold start <2s, navigation <200ms, chat render <500ms, diff render <1s for 1000 lines, pinch-to-zoom 60fps, cache lookup <100ms
- **Reliability (NFR11-NFR18):** Zero message loss on network transitions, graceful timeout recovery, message preservation across backgrounding, cache validation on reconnect, secure key storage, no plaintext credentials, tmux session independence from app crashes, app state preservation
- **Integration (NFR19-NFR25):** Ed25519/RSA/ECDSA key support, mosh UDP port 60000-61000, OpenSSH 7.4+ compatibility, reads same SQLite + file structure as desktop app, actions reflected immediately on desktop refresh, Termux 0.118+ compatibility
- **Platform (NFR26-NFR31):** Material 3 (Android), HIG (iOS), dark/light mode, dynamic text sizing, SDK 34/minSdk 29 (Android), iPhone SE 2nd gen+ (iOS)

**Scale & Complexity:**

- Primary domain: Native mobile application (Android + iOS)
- Complexity level: Medium
- Estimated architectural components: 8-10 major subsystems (connection layer, session manager, agent chat engine, document viewer, code review, cache/offline, platform services, UI layer)

### Technical Constraints & Dependencies

1. **Remote PC Prerequisite:** TinSu desktop must be installed with SSH access configured and Claude Code CLI running on the remote machine
2. **No Cloud Backend:** All data flows through SSH — no intermediate server, no sync service, no user accounts
3. **Remote PC is Source of Truth:** Same SQLite database and file structure as the desktop Electron app, accessed via SSH/SFTP
4. **Platform Fragmentation:** Android gets both Local + Remote modes; iOS gets Remote only
5. **Termux Dependency (Android Local Mode):** Relies on F-Droid-distributed Termux — not Google Play Store version
6. **tmux Session Convention:** Must match desktop naming pattern `tinsu-{projectName}-{taskId}` for session discovery and attachment
7. **Mosh Protocol:** UDP-based — requires port range forwarding (60000-61000) on remote PC firewall
8. **SSH Key Storage:** Must use platform secure enclave (Android Keystore / iOS Keychain) — no file-based key storage
9. **MVP Scope:** Remote Mode only for Phase 1; Local Mode (Termux) deferred to Phase 2

### Cross-Cutting Concerns Identified

1. **Connection Lifecycle Management:** Establishing, maintaining, reconnecting, and tearing down SSH/mosh sessions — affects every feature that touches the remote PC
2. **Data Channel Abstraction:** Agent chat, doc viewer, code review, and project dashboard all need remote data — the transport (SSH/SFTP/tmux) must be abstracted so the UI layer doesn't care whether data is local or remote
3. **Offline/Cache Strategy:** Documents, chat history, and diffs need local caching with timestamp-based invalidation — affects storage, sync, and UX for all read operations
4. **Platform Abstraction:** Shared business logic (connection management, data parsing, cache) vs platform-specific concerns (UI toolkit, secure storage, background execution, Termux IPC)
5. **Session State Persistence:** App backgrounding, network drops, device sleep — the app must resume exactly where the user left off without re-authentication or context loss
6. **Security & Key Management:** SSH key lifecycle (generate, store, export, use) across both platforms with different secure storage APIs
7. **Desktop Compatibility:** Reading desktop app's SQLite schema, matching tmux session naming, ensuring mobile actions (approve/reject) are reflected on desktop

## Starter Template Evaluation

### Primary Technology Domain

Native Mobile Application (Android + iOS) with Kotlin Multiplatform (KMP) for shared business logic and fully native UIs on each platform.

### Starter Options Considered

| Option | Approach | Code Sharing | Trade-off |
|---|---|---|---|
| KMP + Compose Multiplatform | Single codebase, shared UI + logic | ~80-90% | iOS gets Material 3 instead of HIG |
| **KMP + Native UI** | **Shared logic, separate native UIs** | **~50-70%** | **Two UI codebases, but platform-native UX** |
| Fully Separate Native | Independent Kotlin + Swift projects | 0% | Everything built twice |

Critical constraint: No KMP-compatible SSH library exists. SSH/mosh requires platform-specific implementations (`expect`/`actual`) regardless of approach.

### Selected Starter: JetBrains KMP Wizard (Shared Logic + Native UI)

**Rationale for Selection:**

1. Solo founder needs code sharing for business logic (connection management, data parsing, caching, SSH abstraction)
2. Separate native UIs maximize UX quality on each platform — Material 3 Expressive on Android, SwiftUI + HIG on iOS
3. KMP `expect`/`actual` cleanly separates platform concerns (SSH, keychain, Termux IPC)
4. 50-70% shared code in the logic layer, with each UI optimized for its platform
5. KMP is stable and production-ready (since 2023), used by Netflix, Cash App, McDonald's

**UI Architecture Decision:**

Each platform gets a fully native UI implementation:
- **Android:** Kotlin + Jetpack Compose + Material 3 Expressive (Compose BOM 2025.05.01+)
- **iOS:** Swift + SwiftUI + Human Interface Guidelines, SF Symbols

Detailed UI recommendations documented in `mobile-ui-design-recommendations.md`.

**Design Direction:** Industrial-Utilitarian Terminal Luxe — refined control room aesthetic, dark-by-default, monospaced code fonts (JetBrains Mono), instrument-panel status indicators. Dense with information but never cluttered.

**Initialization:**

Generated via JetBrains Kotlin Multiplatform Wizard (https://kmp.jetbrains.com/):
- Targets: Android + iOS
- Shared UI: **Disabled** (native UI on each platform)
- Kotlin: 2.1+ with K2 compiler
- No Compose Multiplatform for UI sharing

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
Kotlin 2.1+ with K2 compiler. Android target compiles to JVM bytecode. iOS target compiles to native binary via Kotlin/Native. Shared code in `commonMain`, platform-specific in `androidMain`/`iosMain`.

**Build Tooling:**
Gradle with KMP plugin for build orchestration. Xcode project generated for iOS builds and App Store submission. Android builds via standard Gradle/AGP pipeline.

**Project Structure:**
```
shared/
  commonMain/     → Shared business logic (connection, cache, data models, SSH abstraction)
  androidMain/    → Android platform implementations (SSH, Keystore, Termux IPC)
  iosMain/        → iOS platform implementations (SSH, Keychain)
androidApp/       → Jetpack Compose UI (Material 3 Expressive)
iosApp/           → SwiftUI UI (HIG, SF Symbols)
```

**Platform Abstraction:**
`expect`/`actual` declarations for: SSH connections, secure key storage, background execution, Termux IPC (Android only), mosh session management.

**Android UI Stack:**

| Library | Purpose |
|---|---|
| Jetpack Compose (via BOM 2025.05.01+) | UI framework |
| Material 3 Expressive | Design system |
| Navigation Compose 2.8+ | Type-safe navigation with @Serializable routes |
| multiplatform-markdown-renderer (mikepenz) | Markdown rendering |
| Coil 3 | Image loading |
| JetBrains Mono | Code font |

**iOS UI Stack:**

| Library | Purpose |
|---|---|
| SwiftUI | UI framework |
| SF Symbols | Iconography |
| NavigationStack + NavigationPath | Type-safe navigation |
| MarkdownUI / Textual (gonzalezreal) | Markdown rendering |
| HighlightSwift (appstefan) | Syntax highlighting for diffs |
| SF Mono / JetBrains Mono | Code font |

**Shared Logic Stack (KMP):**

| Library | Purpose |
|---|---|
| Ktor | HTTP/networking (KMP-native) |
| SQLDelight | Local cache database (KMP-native) |
| Koin | Dependency injection (KMP-native) |
| kotlinx.serialization | Data serialization |
| kotlinx.coroutines | Async operations |
| kotlin-test | Shared unit testing |

**Additional Platform-Specific Libraries to Evaluate (Step 4):**

| Need | Android | iOS |
|---|---|---|
| SSH connectivity | JSch / Apache MINA SSHD | NMSSH / SwiftSSH |
| Mosh protocol | Native mosh-client port | Blink Shell mosh implementation |
| Secure key storage | Android Keystore | iOS Keychain (Security framework) |
| Termux IPC (Phase 2) | Termux API | N/A |

**Note:** Project initialization using the KMP Wizard should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- SSH library selection (Apache MINA SSHD for Android, SwiftNIO SSH for iOS)
- Mosh integration approach (NDK-compiled on Android, Blink fork on iOS)
- Data sync strategy (SFTP file transfer for SQLite DB)
- Remote command abstraction (KMP expect/actual RemoteExecutor)
- tmux session interaction pattern (send-keys / capture-pane)

**Important Decisions (Shape Architecture):**
- Shared ViewModel pattern (StateFlow in commonMain)
- Local cache schema (hybrid: mirrored desktop tables + mobile-only tables)
- Cache invalidation (timestamp-based on reconnect)
- MVP platform priority (Android first)

**Deferred Decisions (Post-MVP):**
- Termux IPC protocol (Phase 2)
- Push notification infrastructure (Phase 3)
- Tablet/foldable adaptive layouts (Phase 4)
- Widget implementations (Phase 4)

### Data Architecture

**Remote Data Access:**
- Mobile app downloads the desktop SQLite database file via SFTP
- SQLDelight 2.2.1 opens the file locally for type-safe querying
- Sync trigger: on reconnect, compare remote DB modified timestamp vs. last sync
- If changed: re-download full DB file (small — task metadata only)
- Documents synced individually via SFTP with per-file timestamp checking

**Local Cache Schema (SQLDelight):**

| Table Source | Tables | Purpose |
|---|---|---|
| Mirrored from desktop | tasks, sprints, epics, agent_runs, task_sessions, task_activities | Desktop data accessible offline |
| Mobile-only | connections | Saved SSH connection profiles |
| Mobile-only | document_cache | Cached planning docs with timestamps |
| Mobile-only | app_preferences | Settings, last active project, UI state |
| Mobile-only | chat_cache | Cached agent chat messages for offline reading |

**Cache Invalidation:**
- DB sync: remote file modified timestamp vs. local last_synced timestamp
- Document sync: per-file SFTP stat timestamp comparison
- Chat sync: tmux capture-pane output compared to cached content
- All invalidation happens on reconnect — no background polling

### Authentication & Security

**SSH Libraries:**

| Platform | Library | Version | Rationale |
|---|---|---|---|
| Android | Apache MINA SSHD | 2.x (latest stable) | Active maintenance, Ed25519/ECDSA/RSA support, pure Java, JGit standard |
| iOS | SwiftNIO SSH | latest | Apple-maintained, pure Swift, modern crypto, SwiftNIO ecosystem |

**Mosh Implementation:**

| Platform | Approach | Source |
|---|---|---|
| Android | NDK-compiled mosh-client | Sonelli/mosh fork (pre-built libs: arm64-v8a, armeabi-v7a, x86_64) |
| iOS | Compiled mosh library | blinksh/mosh fork (iOS-proven, App Store shipped) |

**Secure Key Storage:**
- Android: Android Keystore (hardware-backed where available)
- iOS: iOS Keychain via Security framework
- KMP abstraction: `expect class SecureKeyStore` with platform `actual` implementations
- Key types supported: Ed25519 (preferred), RSA 2048+, ECDSA (P-256, P-384, P-521)
- No plaintext key storage at any point (NFR16)

### API & Communication Patterns

**No traditional REST/GraphQL API.** All communication flows through SSH/SFTP/tmux:

| Operation | Transport | Method |
|---|---|---|
| Read database | SFTP | Download `.db` file |
| Read documents | SFTP | Download markdown files |
| Read diffs | SSH exec | `git diff` on remote |
| Agent chat (send) | SSH exec | `tmux send-keys -t {session} "{message}" Enter` |
| Agent chat (receive) | SSH exec | `tmux capture-pane -t {session} -p -S -500` (polled) |
| Approve/reject task | SSH exec | DB update + git merge via shell commands |
| Project discovery | SSH exec | Find TinSu project directories |
| Connection status | Mosh protocol | Built-in state reporting |

**Remote Command Abstraction (KMP):**

```kotlin
// commonMain
expect class RemoteExecutor {
    suspend fun exec(command: String): CommandResult
    suspend fun downloadFile(remotePath: String, localPath: String)
    suspend fun uploadFile(localPath: String, remotePath: String)
    suspend fun stat(remotePath: String): FileStat
}
```

**tmux Session Interaction:**
- Send: `tmux send-keys -t tinsu-{project}-{taskId} "{escaped}" Enter`
- Receive: Poll `tmux capture-pane -t {session} -p -S -500` at 1s interval
- Discovery: `tmux list-sessions -F "#{session_name}"` filtered by `tinsu-` prefix
- Status detection: Parse output patterns for agent state (thinking/idle/completed/exited)

### Frontend Architecture

**Shared State Management:**
- Shared ViewModels in KMP `commonMain` using `kotlinx.coroutines.flow.StateFlow`
- Android: `collectAsStateWithLifecycle()` in Compose
- iOS: `@Published` wrapper in `ObservableObject` observing Kotlin `StateFlow`
- All business logic (connection state, chat messages, task lists, sync status) lives in shared Kotlin ViewModels

**Navigation:**
- Each platform manages navigation natively (Navigation Compose / NavigationStack)
- Shared layer emits `NavigationEvent` sealed class that platform UI consumes
- Deep link support: `tinsu://chat/{sessionId}`, `tinsu://task/{taskId}`

### Infrastructure & Deployment

**Distribution:**

| Platform | Channel | Notes |
|---|---|---|
| Android | Google Play Store | Primary distribution |
| Android | F-Droid | Phase 2 — for Local Mode (Termux) distribution |
| iOS | Apple App Store | Standard distribution |

**CI/CD:**
- GitHub Actions for both platforms
- Android: Gradle → signed AAB → Play Store via Fastlane
- iOS: xcodebuild → signed IPA → App Store via Fastlane
- Shared tests run on every PR

**MVP Platform Priority:**
Android first (founder's primary device). iOS follows — KMP shared logic means only the SwiftUI UI layer needs to be built for iOS.

### Decision Impact Analysis

**Implementation Sequence:**
1. KMP project scaffold (JetBrains Wizard)
2. SSH connectivity layer (Apache MINA SSHD / SwiftNIO SSH via expect/actual)
3. RemoteExecutor abstraction + SFTP file operations
4. SQLDelight schema (mirrored desktop + mobile-only tables)
5. Connection Manager UI (first screen users see)
6. tmux session interaction layer
7. Agent Chat UI + shared ViewModel
8. Document Viewer UI + cache layer
9. Code Review / Diff Viewer UI
10. Mosh integration (resilient connections)
11. Project Dashboard UI
12. Settings + diagnostics

**Cross-Component Dependencies:**
- Everything depends on SSH connectivity (step 2) — it's the foundation
- Agent Chat, Doc Viewer, and Code Review all depend on RemoteExecutor (step 3)
- Cache layer depends on SQLDelight schema (step 4)
- Mosh can be added incrementally on top of SSH (step 10) — SSH works first, mosh adds resilience

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
14 areas where AI agents could make different choices across 3 codebases (shared KMP, Android UI, iOS UI).

### Naming Patterns

**Database Naming (SQLDelight):**

| Element | Convention | Example | Anti-pattern |
|---|---|---|---|
| Tables | snake_case plural | `tasks`, `agent_runs` | `Task`, `agentRuns` |
| Columns | snake_case | `created_at`, `task_id` | `createdAt`, `taskID` |
| Foreign keys | `{referenced_table_singular}_id` | `sprint_id`, `task_id` | `fk_sprint`, `sprintFK` |
| Indexes | `idx_{table}_{columns}` | `idx_tasks_status` | `tasks_status_index` |
| Migration files | `{version}.sqm` | `1.sqm`, `2.sqm` | `migration_v1.sqm` |

Matches desktop conventions from project-context.md for compatibility.

**Kotlin Code Naming (shared + androidApp):**

| Element | Convention | Example | Anti-pattern |
|---|---|---|---|
| Classes | PascalCase | `ConnectionManager`, `ChatViewModel` | `connectionManager`, `connection_manager` |
| Functions | camelCase | `connectToHost()`, `sendMessage()` | `connect_to_host()`, `SendMessage()` |
| Properties | camelCase | `connectionState`, `isConnected` | `connection_state`, `IsConnected` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT`, `DEFAULT_PORT` | `maxRetryCount`, `defaultPort` |
| Packages | lowercase dot-separated | `com.tinsu.mobile.ssh` | `com.tinsu.mobile.SSH` |
| Interfaces | PascalCase, no I prefix | `RemoteExecutor`, `SecureKeyStore` | `IRemoteExecutor`, `RemoteExecutorInterface` |
| expect/actual | Same name, platform suffix in package | `expect class SshClient` in commonMain | `SshClientAndroid`, `SshClientIos` |

**Swift Code Naming (iosApp):**

| Element | Convention | Example | Anti-pattern |
|---|---|---|---|
| Types/Structs | PascalCase | `ConnectionManager`, `ChatBubbleView` | `connectionManager` |
| Functions | camelCase | `connectToHost()`, `sendMessage()` | `connect_to_host()` |
| Properties | camelCase | `connectionState`, `isConnected` | `connection_state` |
| Protocols | PascalCase, `-able`/`-ing` suffix where natural | `Connectable`, `MessageSending` | `IConnectable`, `ConnectableProtocol` |
| Enums | PascalCase type, camelCase cases | `ConnectionState.connected` | `ConnectionState.Connected` |
| SwiftUI Views | PascalCase + `View` suffix | `ChatBubbleView`, `DiffLineView` | `ChatBubble`, `chat_bubble_view` |

**File Naming:**

| Module | Convention | Example | Anti-pattern |
|---|---|---|---|
| shared (Kotlin) | PascalCase `.kt` | `ConnectionManager.kt`, `RemoteExecutor.kt` | `connection-manager.kt` |
| androidApp (Compose) | PascalCase `.kt` | `ChatScreen.kt`, `DiffViewer.kt` | `chat-screen.kt` |
| iosApp (SwiftUI) | PascalCase `.swift` | `ChatScreen.swift`, `DiffLineView.swift` | `chat-screen.swift` |
| SQLDelight | PascalCase `.sq` | `Tasks.sq`, `Connections.sq` | `tasks.sq` |
| Tests | `{ClassName}Test.kt` / `{ClassName}Tests.swift` | `ConnectionManagerTest.kt` | `TestConnectionManager.kt` |

### Structure Patterns

**Project Organization — By Feature:**

```
shared/
  commonMain/kotlin/com/tinsu/mobile/
    connection/          → SSH/mosh connection management
      ConnectionManager.kt
      RemoteExecutor.kt
      ConnectionState.kt
    chat/                → Agent chat business logic
      ChatRepository.kt
      ChatViewModel.kt
      TmuxSessionManager.kt
    documents/           → Planning doc management
      DocumentRepository.kt
      DocumentCache.kt
    review/              → Code review business logic
      ReviewRepository.kt
      DiffParser.kt
    project/             → Project discovery and dashboard
      ProjectRepository.kt
      ProjectViewModel.kt
    cache/               → Local cache management
      CacheManager.kt
      SyncEngine.kt
    db/                  → SQLDelight schema and queries
      Tasks.sq
      Connections.sq
      DocumentCache.sq
    di/                  → Koin module definitions
      SharedModule.kt
  androidMain/kotlin/com/tinsu/mobile/
    connection/          → Apache MINA SSHD implementation
    security/            → Android Keystore implementation
  iosMain/kotlin/com/tinsu/mobile/
    connection/          → SwiftNIO SSH implementation
    security/            → iOS Keychain bridge

androidApp/src/main/kotlin/com/tinsu/mobile/
  ui/
    chat/                → Chat screen composables
    docs/                → Document viewer composables
    review/              → Diff viewer composables
    dashboard/           → Dashboard composables
    connection/          → Connection manager composables
    settings/            → Settings composables
    components/          → Shared UI components (ChatBubble, StatusIndicator)
    theme/               → Material 3 theme, colors, typography
    navigation/          → Navigation graph, routes
  di/                    → Android-specific Koin modules

iosApp/Sources/TinsuMobile/
  UI/
    Chat/                → Chat screen SwiftUI views
    Docs/                → Document viewer views
    Review/              → Diff viewer views
    Dashboard/           → Dashboard views
    Connection/          → Connection manager views
    Settings/            → Settings views
    Components/          → Shared UI components
    Theme/               → Colors, typography, styles
    Navigation/          → Router, tab configuration
  Bridge/                → KMP-Swift interop helpers
```

**Test Location — Co-located with Source:**

| Module | Test Location | Example |
|---|---|---|
| shared | `shared/commonTest/` mirroring `commonMain/` structure | `connection/ConnectionManagerTest.kt` |
| androidApp | Co-located `*Test.kt` next to source | `ui/chat/ChatScreenTest.kt` |
| iosApp | `iosApp/Tests/` mirroring source structure | `UI/Chat/ChatScreenTests.swift` |

### Format Patterns

**Data Exchange Between Shared and UI Layers:**

- Shared ViewModels expose `StateFlow<UiState>` — never raw data models
- UI state is always a sealed class/interface:

```kotlin
// DO:
sealed interface ChatUiState {
    data object Loading : ChatUiState
    data class Success(val messages: List<ChatMessage>) : ChatUiState
    data class Error(val message: String) : ChatUiState
}

// DON'T:
data class ChatUiState(
    val isLoading: Boolean,   // WRONG: boolean flags
    val messages: List<ChatMessage>?,  // WRONG: nullable
    val error: String?  // WRONG: nullable
)
```

**Date/Time Handling:**

| Context | Format | Example |
|---|---|---|
| SQLDelight storage | INTEGER (Unix timestamp seconds) | `1712380800` |
| Kotlin data models | `kotlinx.datetime.Instant` | `Instant.fromEpochSeconds(...)` |
| UI display (Android) | Format with `kotlinx.datetime` | `"Apr 6, 2026 3:00 AM"` |
| UI display (iOS) | Format with `Foundation.DateFormatter` | `"Apr 6, 2026 3:00 AM"` |
| Remote file timestamps | Unix timestamp from SFTP stat | Compare as Long |

Matches desktop convention from project-context.md.

**JSON/Serialization:**

- All shared data models use `@Serializable` (kotlinx.serialization)
- JSON field naming: snake_case (matches desktop SQLite schema)
- Null handling: use Kotlin's nullability — never send "null" strings
- Boolean: `true`/`false` (never 1/0)

### Communication Patterns

**Connection State Events:**

```kotlin
sealed interface ConnectionEvent {
    data class Connected(val host: String) : ConnectionEvent
    data class Reconnecting(val attempt: Int) : ConnectionEvent
    data class Disconnected(val reason: String) : ConnectionEvent
    data object Offline : ConnectionEvent
}
```

- State exposed as `StateFlow<ConnectionEvent>` from `ConnectionManager`
- UI observes and renders status indicator (green/yellow/red/gray)
- Event naming: sealed class cases use **past tense or adjective** (`Connected`, not `Connect`)

**ViewModel → UI Communication:**

- State: `StateFlow<UiState>` (observed continuously)
- One-shot events: `SharedFlow<UiEvent>` (navigation, toasts, errors)
- User actions: ViewModel exposes functions (`fun sendMessage(text: String)`)
- Never expose `MutableStateFlow` to UI layer

**Logging:**

| Level | When | Example |
|---|---|---|
| ERROR | Unrecoverable failure | `"SSH connection failed: ${e.message}"` |
| WARN | Recoverable issue | `"Reconnection attempt 3/5"` |
| INFO | Significant state change | `"Connected to home-pc:22"` |
| DEBUG | Development details | `"tmux capture-pane returned 500 lines"` |

- Format: `[TAG] message` where TAG is the class name
- Use Kotlin's `expect`/`actual` for platform logging (`Log.d` on Android, `os_log` on iOS)

### Process Patterns

**Error Handling:**

| Layer | Pattern |
|---|---|
| SSH/SFTP operations | Catch, wrap in domain `Result<T>` type, propagate to ViewModel |
| ViewModels | Map `Result.failure` to `UiState.Error(userMessage)` |
| Android UI | Observe `UiState.Error`, show Snackbar |
| iOS UI | Observe error state, show `.alert()` |

```kotlin
// DO: Domain Result type
sealed interface Result<out T> {
    data class Success<T>(val data: T) : Result<T>
    data class Failure(val error: AppError) : Result<Nothing>
}

sealed interface AppError {
    data class ConnectionFailed(val reason: String) : AppError
    data class Timeout(val operation: String) : AppError
    data class SyncFailed(val reason: String) : AppError
}

// DON'T: Throw exceptions across module boundaries
// DON'T: Use generic Exception types
// DON'T: Show raw technical errors to user
```

**Loading States:**

- Every screen has exactly 3 states: `Loading`, `Success(data)`, `Error(message)`
- Loading shown as: skeleton/shimmer on Android (Material 3), `ProgressView` on iOS
- Pull-to-refresh triggers re-sync for all data screens (Chat, Docs, Tasks)
- No global loading state — each ViewModel manages its own

**Retry Pattern:**

- SSH connection: exponential backoff (1s, 2s, 4s, 8s, max 30s), max 5 attempts
- SFTP file operations: 3 retries with 1s delay
- tmux commands: no retry (idempotent — re-poll on next interval)
- Mosh: built-in reconnection (handled by protocol)

**Offline Behavior:**

- App detects offline state via `ConnectionEvent.Offline`
- All cached data remains readable (docs, chat history, diffs)
- Write operations (send message, approve task) queued locally
- Queue flushed on reconnect in FIFO order
- UI shows "Offline — cached data" banner

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow the naming conventions table for their module (shared/android/ios)
2. Organize code by feature, not by type (no `models/`, `utils/`, `helpers/` catch-all folders)
3. Use sealed class `UiState` pattern for all screen states — never boolean flags
4. Use `Result<T>` for all operations that can fail — never throw across module boundaries
5. Co-locate tests with source code
6. Use `expect`/`actual` for all platform-specific code — never `#if` platform checks in shared code
7. Expose `StateFlow` (not `MutableStateFlow`) from ViewModels to UI
8. Match desktop database naming conventions (snake_case tables and columns)

**Pattern Verification:**

- Shared module: `kotlin-test` unit tests validate data layer patterns
- Android: Compose Preview for UI components, `@Composable` naming verified by lint
- iOS: SwiftUI Preview for views, SwiftLint for naming enforcement
- CI: KtLint (Kotlin) + SwiftLint (Swift) run on every PR

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|---|---|
| `data class State(isLoading: Boolean, data: T?, error: String?)` | Sealed class `UiState` with `Loading/Success/Error` |
| `throw Exception()` across module boundaries | Return `Result.Failure(AppError)` |
| Platform-specific code in `commonMain` | Use `expect`/`actual` declarations |
| `MutableStateFlow` exposed to UI | Expose read-only `StateFlow` |
| `utils/` or `helpers/` folders | Put utilities in the feature module that uses them |
| Boolean flags for multiple states | Sealed classes/enums |
| Raw SQL strings in Kotlin code | SQLDelight `.sq` files only |
| Hardcoded strings in UI | String resources (Android `strings.xml`, iOS `Localizable.strings`) |
| `var` for state in ViewModels | `val` + `MutableStateFlow` internally, `StateFlow` externally |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
tinsu-mobile/
├── .github/
│   └── workflows/
│       ├── android-ci.yml          → Android build + test on PR
│       ├── ios-ci.yml              → iOS build + test on PR
│       ├── shared-tests.yml        → KMP shared module tests on PR
│       └── release.yml             → Fastlane deploy to stores
├── .gitignore
├── build.gradle.kts                → Root Gradle build (KMP plugin)
├── settings.gradle.kts             → Module declarations
├── gradle.properties               → KMP/Android/Compose versions
├── gradle/
│   └── libs.versions.toml          → Version catalog
├── shared/
│   ├── build.gradle.kts            → KMP shared module config
│   ├── src/
│   │   ├── commonMain/
│   │   │   ├── kotlin/com/tinsu/mobile/
│   │   │   │   ├── connection/
│   │   │   │   │   ├── ConnectionManager.kt        → SSH/mosh lifecycle (FR9-FR15)
│   │   │   │   │   ├── ConnectionConfig.kt          → Host, port, username, transport type
│   │   │   │   │   ├── ConnectionState.kt           → Sealed interface: Connected/Reconnecting/Disconnected/Offline
│   │   │   │   │   ├── ConnectionRepository.kt      → CRUD for saved connections (FR1, FR5-FR6)
│   │   │   │   │   ├── RemoteExecutor.kt            → expect: exec, downloadFile, uploadFile, stat
│   │   │   │   │   ├── SftpClient.kt                → expect: SFTP operations
│   │   │   │   │   └── MoshSession.kt               → expect: mosh session management (FR7, FR14)
│   │   │   │   ├── security/
│   │   │   │   │   ├── SecureKeyStore.kt            → expect: key generation, storage, export (FR2-FR3, FR8)
│   │   │   │   │   └── KeyType.kt                   → Ed25519, RSA, ECDSA enum
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatViewModel.kt             → Agent chat state management (FR16-FR23)
│   │   │   │   │   ├── ChatRepository.kt            → Message persistence + remote fetch
│   │   │   │   │   ├── ChatMessage.kt               → Data model: sender, content, timestamp, type
│   │   │   │   │   ├── TmuxSessionManager.kt        → tmux send-keys/capture-pane abstraction (FR12, FR19-FR20)
│   │   │   │   │   ├── SessionStatus.kt             → Sealed: Thinking/Idle/Completed/Exited (FR23)
│   │   │   │   │   └── AgentPersona.kt              → PM, Architect, Dev, etc. enum (FR22)
│   │   │   │   ├── documents/
│   │   │   │   │   ├── DocumentViewModel.kt         → Doc viewer state management (FR24-FR28)
│   │   │   │   │   ├── DocumentRepository.kt        → Remote fetch + cache management
│   │   │   │   │   ├── DocumentCache.kt             → Offline cache with timestamp invalidation (FR26)
│   │   │   │   │   └── MarkdownDocument.kt          → Data model: path, content, lastSynced
│   │   │   │   ├── review/
│   │   │   │   │   ├── ReviewViewModel.kt           → Code review state management (FR29-FR36)
│   │   │   │   │   ├── ReviewRepository.kt          → Task list + diff fetching
│   │   │   │   │   ├── DiffParser.kt                → Unified diff → DiffFile/DiffHunk/DiffLine models
│   │   │   │   │   ├── DiffModels.kt                → DiffFile, DiffHunk, DiffLine data classes
│   │   │   │   │   └── ReviewAction.kt              → Sealed: Approve/RequestChanges/Reject (FR33-FR35)
│   │   │   │   ├── project/
│   │   │   │   │   ├── ProjectViewModel.kt          → Dashboard state management (FR37-FR39)
│   │   │   │   │   ├── ProjectRepository.kt         → Project discovery + metadata (FR10-FR11)
│   │   │   │   │   └── ProjectInfo.kt               → Data model: name, path, activeSessionCount
│   │   │   │   ├── sync/
│   │   │   │   │   ├── SyncEngine.kt                → Orchestrates DB + doc + chat sync
│   │   │   │   │   ├── SyncState.kt                 → Sealed: Syncing/Synced/Failed
│   │   │   │   │   └── OfflineQueue.kt              → Queued write operations for offline (FR15)
│   │   │   │   ├── db/
│   │   │   │   │   ├── Tasks.sq                     → tasks table (mirrored from desktop)
│   │   │   │   │   ├── Sprints.sq                   → sprints table (mirrored)
│   │   │   │   │   ├── Epics.sq                     → epics table (mirrored)
│   │   │   │   │   ├── AgentRuns.sq                 → agent_runs table (mirrored)
│   │   │   │   │   ├── TaskSessions.sq              → task_sessions table (mirrored)
│   │   │   │   │   ├── TaskActivities.sq            → task_activities table (mirrored)
│   │   │   │   │   ├── Connections.sq               → connections table (mobile-only)
│   │   │   │   │   ├── DocumentCache.sq             → document_cache table (mobile-only)
│   │   │   │   │   ├── ChatCache.sq                 → chat_cache table (mobile-only)
│   │   │   │   │   └── AppPreferences.sq            → app_preferences table (mobile-only)
│   │   │   │   ├── di/
│   │   │   │   │   └── SharedModule.kt              → Koin module: repositories, ViewModels, managers
│   │   │   │   └── util/
│   │   │   │       ├── Result.kt                    → Result<T> sealed interface
│   │   │   │       ├── AppError.kt                  → AppError sealed interface
│   │   │   │       └── Logger.kt                    → expect: platform logging
│   │   │   └── sqldelight/
│   │   │       └── com/tinsu/mobile/db/
│   │   │           └── TinsuMobile.sq               → SQLDelight database definition
│   │   ├── androidMain/
│   │   │   └── kotlin/com/tinsu/mobile/
│   │   │       ├── connection/
│   │   │       │   ├── AndroidRemoteExecutor.kt     → actual: Apache MINA SSHD implementation
│   │   │       │   ├── AndroidSftpClient.kt         → actual: MINA SFTP
│   │   │       │   └── AndroidMoshSession.kt        → actual: NDK mosh-client JNI bridge
│   │   │       ├── security/
│   │   │       │   └── AndroidSecureKeyStore.kt     → actual: Android Keystore
│   │   │       ├── util/
│   │   │       │   └── AndroidLogger.kt             → actual: android.util.Log
│   │   │       └── di/
│   │   │           └── AndroidModule.kt             → Android-specific Koin bindings
│   │   ├── iosMain/
│   │   │   └── kotlin/com/tinsu/mobile/
│   │   │       ├── connection/
│   │   │       │   ├── IosRemoteExecutor.kt         → actual: SwiftNIO SSH implementation
│   │   │       │   ├── IosSftpClient.kt             → actual: SwiftNIO SFTP
│   │   │       │   └── IosMoshSession.kt            → actual: Blink mosh library bridge
│   │   │       ├── security/
│   │   │       │   └── IosSecureKeyStore.kt         → actual: iOS Keychain via Security framework
│   │   │       ├── util/
│   │   │       │   └── IosLogger.kt                 → actual: os_log
│   │   │       └── di/
│   │   │           └── IosModule.kt                 → iOS-specific Koin bindings
│   │   └── commonTest/
│   │       └── kotlin/com/tinsu/mobile/
│   │           ├── connection/
│   │           │   └── ConnectionManagerTest.kt
│   │           ├── chat/
│   │           │   ├── ChatViewModelTest.kt
│   │           │   └── TmuxSessionManagerTest.kt
│   │           ├── documents/
│   │           │   └── DocumentCacheTest.kt
│   │           ├── review/
│   │           │   └── DiffParserTest.kt
│   │           ├── sync/
│   │           │   └── SyncEngineTest.kt
│   │           └── project/
│   │               └── ProjectRepositoryTest.kt
├── androidApp/
│   ├── build.gradle.kts                → Android app module config
│   ├── src/main/
│   │   ├── AndroidManifest.xml         → Permissions, deep links, intent filters
│   │   ├── kotlin/com/tinsu/mobile/
│   │   │   ├── TinsuApplication.kt     → Application class, Koin init
│   │   │   ├── MainActivity.kt         → Single activity, Compose entry point
│   │   │   ├── ui/
│   │   │   │   ├── TinsuApp.kt         → Root composable, navigation host
│   │   │   │   ├── navigation/
│   │   │   │   │   ├── TinsuNavGraph.kt         → Top-level navigation graph
│   │   │   │   │   ├── ChatNavGraph.kt          → Chat tab navigation
│   │   │   │   │   ├── DocsNavGraph.kt          → Docs tab navigation
│   │   │   │   │   ├── TasksNavGraph.kt         → Tasks tab navigation
│   │   │   │   │   ├── SettingsNavGraph.kt      → Settings tab navigation
│   │   │   │   │   └── Routes.kt                → @Serializable route objects
│   │   │   │   ├── theme/
│   │   │   │   │   ├── Theme.kt                 → Material 3 theme (dark/light)
│   │   │   │   │   ├── Color.kt                 → Color palette (#0D1117 dark, accents)
│   │   │   │   │   ├── Typography.kt            → JetBrains Mono + display font
│   │   │   │   │   └── Shape.kt                 → M3 shape definitions
│   │   │   │   ├── connection/
│   │   │   │   │   ├── ConnectionListScreen.kt  → Saved connections list (FR5-FR6)
│   │   │   │   │   ├── AddConnectionScreen.kt   → New connection form (FR1)
│   │   │   │   │   ├── KeySetupScreen.kt        → SSH key generation/export (FR2-FR3)
│   │   │   │   │   └── ConnectionTestScreen.kt  → Test connection flow (FR4)
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── DashboardScreen.kt       → Project overview (FR37-FR39)
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatListScreen.kt        → Session list (FR16)
│   │   │   │   │   ├── ChatScreen.kt            → Chat conversation (FR17-FR21)
│   │   │   │   │   └── NewChatScreen.kt         → Start new session (FR22)
│   │   │   │   ├── docs/
│   │   │   │   │   ├── DocBrowserScreen.kt      → Document list (FR24)
│   │   │   │   │   └── DocViewerScreen.kt       → Rendered markdown (FR25, FR27-FR28)
│   │   │   │   ├── review/
│   │   │   │   │   ├── TaskListScreen.kt        → Tasks by status (FR29)
│   │   │   │   │   ├── DiffViewerScreen.kt      → Code diff (FR30-FR32)
│   │   │   │   │   └── ReviewActionSheet.kt     → Approve/Request/Reject (FR33-FR35)
│   │   │   │   ├── settings/
│   │   │   │   │   ├── SettingsScreen.kt        → Main settings (FR45-FR48)
│   │   │   │   │   ├── MoshSettingsScreen.kt    → Mosh config (FR46)
│   │   │   │   │   └── DiagnosticsScreen.kt     → Connection diagnostics (FR48)
│   │   │   │   └── components/
│   │   │   │       ├── ChatBubble.kt            → Message bubble composable
│   │   │   │       ├── ConnectionStatusBar.kt   → Green/yellow/red/gray indicator (FR13)
│   │   │   │       ├── SessionStatusChip.kt     → Thinking/Idle/Completed chip (FR23)
│   │   │   │       ├── DiffLine.kt              → Single diff line composable
│   │   │   │       └── BottomNavBar.kt          → 4-tab navigation bar (FR38)
│   │   │   └── di/
│   │   │       └── AndroidAppModule.kt          → Android UI Koin module
│   │   └── res/
│   │       ├── values/
│   │       │   ├── strings.xml                  → String resources
│   │       │   └── themes.xml                   → Android theme
│   │       └── font/
│   │           └── jetbrains_mono.ttf           → Code font
│   └── src/test/                                → Android-specific unit tests
│       └── kotlin/com/tinsu/mobile/ui/
│           ├── chat/ChatScreenTest.kt
│           └── review/DiffViewerScreenTest.kt
├── iosApp/
│   ├── iosApp.xcodeproj/                        → Xcode project (auto-generated by KMP)
│   ├── iosApp/
│   │   ├── Info.plist                           → App configuration, URL schemes
│   │   ├── TinsuMobileApp.swift                 → @main entry point
│   │   ├── ContentView.swift                    → Root view with TabView
│   │   ├── UI/
│   │   │   ├── Navigation/
│   │   │   │   ├── AppRouter.swift              → Router ObservableObject
│   │   │   │   ├── ChatDestination.swift        → Chat tab routes (Hashable enum)
│   │   │   │   ├── DocsDestination.swift        → Docs tab routes
│   │   │   │   ├── TasksDestination.swift       → Tasks tab routes
│   │   │   │   └── SettingsDestination.swift    → Settings tab routes
│   │   │   ├── Theme/
│   │   │   │   ├── TinsuColors.swift            → Color palette (matching Android)
│   │   │   │   ├── TinsuTypography.swift        → Font definitions
│   │   │   │   └── TinsuStyles.swift            → Reusable ViewModifiers
│   │   │   ├── Connection/
│   │   │   │   ├── ConnectionListView.swift     → Saved connections (FR5-FR6)
│   │   │   │   ├── AddConnectionView.swift      → New connection (FR1)
│   │   │   │   ├── KeySetupView.swift           → SSH key setup (FR2-FR3)
│   │   │   │   └── ConnectionTestView.swift     → Test flow (FR4)
│   │   │   ├── Dashboard/
│   │   │   │   └── DashboardView.swift          → Project overview (FR37-FR39)
│   │   │   ├── Chat/
│   │   │   │   ├── ChatListView.swift           → Session list (FR16)
│   │   │   │   ├── ChatView.swift               → Conversation (FR17-FR21)
│   │   │   │   └── NewChatView.swift            → New session (FR22)
│   │   │   ├── Docs/
│   │   │   │   ├── DocBrowserView.swift         → Document list (FR24)
│   │   │   │   └── DocViewerView.swift          → Rendered markdown (FR25, FR27-FR28)
│   │   │   ├── Review/
│   │   │   │   ├── TaskListView.swift           → Tasks by status (FR29)
│   │   │   │   ├── DiffViewerView.swift         → Code diff (FR30-FR32)
│   │   │   │   └── ReviewActionSheet.swift      → Approve/Request/Reject (FR33-FR35)
│   │   │   ├── Settings/
│   │   │   │   ├── SettingsView.swift           → Main settings (FR45-FR48)
│   │   │   │   ├── MoshSettingsView.swift       → Mosh config (FR46)
│   │   │   │   └── DiagnosticsView.swift        → Diagnostics (FR48)
│   │   │   └── Components/
│   │   │       ├── ChatBubbleView.swift         → Message bubble
│   │   │       ├── ConnectionStatusBar.swift    → Status indicator (FR13)
│   │   │       ├── SessionStatusLabel.swift     → Status label (FR23)
│   │   │       └── DiffLineView.swift           → Single diff line
│   │   └── Bridge/
│   │       ├── ViewModelWrapper.swift           → Wraps KMP StateFlow → @Published
│   │       └── KoinHelper.swift                 → Swift-side Koin access
│   ├── Assets.xcassets/                         → App icons, color sets
│   └── Tests/
│       └── TinsuMobileTests/
│           ├── Chat/ChatViewTests.swift
│           └── Review/DiffViewerViewTests.swift
└── fastlane/
    ├── Fastfile                                 → Lane definitions (android, ios)
    ├── Appfile                                  → App identifiers
    └── Matchfile                                → iOS code signing (if using match)
```

### Architectural Boundaries

**Module Boundaries (KMP):**

| Boundary | Rule |
|---|---|
| `commonMain` → `androidMain`/`iosMain` | Only via `expect`/`actual`. No direct platform imports in common. |
| `shared` → `androidApp`/`iosApp` | ViewModels + data models exposed. UI layers import shared, never the reverse. |
| `androidApp` ↔ `iosApp` | Zero dependency. These modules do not know about each other. |

**Data Flow Boundaries:**

```
Remote PC (SQLite + files + tmux)
    ↕ SSH/SFTP/mosh
shared/connection/ (RemoteExecutor, SftpClient, MoshSession)
    ↕ Kotlin interfaces
shared/chat|documents|review|project/ (Repositories)
    ↕ StateFlow
shared/*/ViewModel (ChatViewModel, ReviewViewModel, etc.)
    ↕ StateFlow<UiState>
androidApp/ui/ OR iosApp/UI/ (Platform UI)
```

**Security Boundaries:**

| Boundary | Enforcement |
|---|---|
| SSH private keys | Never leave SecureKeyStore. Accessed only by RemoteExecutor. |
| Connection credentials | Stored in encrypted SQLDelight DB, decrypted only at connection time. |
| Remote data | Cached locally in plain SQLite (acceptable — device-local, user's own data). |

### Requirements to Structure Mapping

**FR1-FR8 (Connection Management):**
- Shared: `connection/ConnectionRepository.kt`, `security/SecureKeyStore.kt`
- Android: `ui/connection/*.kt`, `connection/AndroidRemoteExecutor.kt`
- iOS: `UI/Connection/*.swift`, `connection/IosRemoteExecutor.kt`
- DB: `db/Connections.sq`

**FR9-FR15 (Remote Session Management):**
- Shared: `connection/ConnectionManager.kt`, `connection/MoshSession.kt`, `sync/OfflineQueue.kt`
- Android: `connection/AndroidMoshSession.kt`
- iOS: `connection/IosMoshSession.kt`
- UI: `components/ConnectionStatusBar` on both platforms

**FR16-FR23 (Agent Chat):**
- Shared: `chat/ChatViewModel.kt`, `chat/TmuxSessionManager.kt`, `chat/ChatRepository.kt`
- Android: `ui/chat/*.kt`, `ui/components/ChatBubble.kt`
- iOS: `UI/Chat/*.swift`, `UI/Components/ChatBubbleView.swift`
- DB: `db/ChatCache.sq`

**FR24-FR28 (Planning Document Viewer):**
- Shared: `documents/DocumentViewModel.kt`, `documents/DocumentRepository.kt`, `documents/DocumentCache.kt`
- Android: `ui/docs/*.kt` (mikepenz markdown renderer)
- iOS: `UI/Docs/*.swift` (MarkdownUI)
- DB: `db/DocumentCache.sq`

**FR29-FR36 (Code Review):**
- Shared: `review/ReviewViewModel.kt`, `review/DiffParser.kt`, `review/ReviewRepository.kt`
- Android: `ui/review/*.kt`, `ui/components/DiffLine.kt`
- iOS: `UI/Review/*.swift`, `UI/Components/DiffLineView.swift`

**FR37-FR39 (Project Dashboard):**
- Shared: `project/ProjectViewModel.kt`, `project/ProjectRepository.kt`
- Android: `ui/dashboard/DashboardScreen.kt`
- iOS: `UI/Dashboard/DashboardView.swift`

**FR45-FR48 (Settings):**
- Shared: `connection/ConnectionRepository.kt` (reused)
- Android: `ui/settings/*.kt`
- iOS: `UI/Settings/*.swift`
- DB: `db/AppPreferences.sq`

### Integration Points

**Internal Communication:**
- ViewModels ↔ Repositories: direct function calls (suspend), results via `Result<T>`
- Repositories ↔ RemoteExecutor: suspend function calls for SSH/SFTP
- ConnectionManager → all ViewModels: `StateFlow<ConnectionEvent>` observed by all features
- SyncEngine: orchestrates DB + document + chat sync on connection state changes

**External Integrations:**

| Integration | Protocol | Implementation |
|---|---|---|
| Desktop TinSu SQLite DB | SFTP file download | `SftpClient.downloadFile()` |
| tmux sessions on remote PC | SSH exec | `TmuxSessionManager` |
| Git operations on remote PC | SSH exec | `RemoteExecutor.exec("git diff ...")` |
| Android Keystore | Android SDK | `AndroidSecureKeyStore` |
| iOS Keychain | Security framework | `IosSecureKeyStore` |
| Mosh server on remote PC | UDP (mosh protocol) | `MoshSession` platform implementations |

**Data Flow — Agent Chat (example):**

```
User types message → ChatViewModel.sendMessage(text)
  → TmuxSessionManager.sendToSession(sessionName, text)
    → RemoteExecutor.exec("tmux send-keys -t $session \"$text\" Enter")
      → SSH exec over connection
        → tmux on remote PC delivers to Claude Code stdin

(1s poll interval)
TmuxSessionManager.captureOutput(sessionName)
  → RemoteExecutor.exec("tmux capture-pane -t $session -p -S -500")
    → Parse output → detect new content → emit via StateFlow
      → ChatViewModel updates ChatUiState.Success(messages)
        → Android: Compose recomposes chat UI
        → iOS: SwiftUI updates chat view
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are compatible. KMP 2.1+ supports the shared-logic-native-UI pattern. SQLDelight, Koin, Ktor, and kotlinx libraries are all KMP-native. SSH libraries (Apache MINA SSHD for Android, SwiftNIO SSH for iOS) are platform-appropriate and abstracted behind `expect`/`actual`. No contradictory decisions.

**Pattern Consistency:**
Naming conventions align across modules (snake_case DB, PascalCase classes, camelCase functions). Sealed class `UiState` and `Result<T>` patterns are applied uniformly. Feature-based organization is consistent across shared, Android, and iOS modules.

**Structure Alignment:**
Project structure supports all architectural decisions. Module boundaries enforce separation. Data flows uni-directionally from remote → shared → UI. No circular dependencies.

### Requirements Coverage ✅

**Functional Requirements:**
All 48 FRs are architecturally supported. FR1-FR39 and FR45-FR48 are covered by MVP architecture. FR40-FR44 (Local Mode) are explicitly deferred to Phase 2 with a clear architectural extension point (Termux IPC via `expect`/`actual`).

**Non-Functional Requirements:**
All 31 NFRs are addressed. Performance targets supported by native UI frameworks and efficient SSH libraries. Reliability covered by mosh resilience, offline queue, and cache invalidation. Security covered by platform secure enclaves and no-plaintext-ever rule. Platform requirements met by Material 3 Expressive (Android) and SwiftUI HIG (iOS).

### Implementation Readiness ✅

**Decision Completeness:**
All critical and important decisions are documented with specific libraries, versions, and rationale. Code examples provided for UiState pattern, Result type, error handling, and data flow.

**Structure Completeness:**
Complete project tree with 100+ files mapped to specific FRs. Every screen, ViewModel, repository, and data model has a defined location.

**Pattern Completeness:**
14 conflict areas identified and resolved with conventions, examples, and anti-patterns.

### Gap Analysis

**Critical Gaps:** None

**Important Notes:**
- SwiftNIO SSH requires building a client layer on top of protocol primitives — more implementation effort on iOS than Android. Documented as known trade-off.
- Desktop SQLite schema must be kept in sync between desktop Drizzle definitions and mobile SQLDelight `.sq` files — manual process, no automated schema sync.

**Deferred (Post-MVP):**
- Local Mode / Termux integration (Phase 2)
- Push notifications (Phase 3)
- Tablet/foldable layouts (Phase 4)
- Voice input, widgets, share sheet (Phase 4)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (48 FRs, 31 NFRs)
- [x] Scale and complexity assessed (Medium)
- [x] Technical constraints identified (9 constraints)
- [x] Cross-cutting concerns mapped (7 concerns)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (KMP + Jetpack Compose + SwiftUI)
- [x] Integration patterns defined (SSH/SFTP/tmux)
- [x] Performance considerations addressed
- [x] Security architecture defined (SecureKeyStore, no plaintext)

**✅ Implementation Patterns**
- [x] Naming conventions established (DB, Kotlin, Swift, files)
- [x] Structure patterns defined (feature-based, co-located tests)
- [x] Communication patterns specified (StateFlow, sealed UiState)
- [x] Process patterns documented (error handling, retry, offline)

**✅ Project Structure**
- [x] Complete directory structure defined (100+ files)
- [x] Component boundaries established (shared/android/ios modules)
- [x] Integration points mapped (SSH, SFTP, tmux, Keystore/Keychain)
- [x] Requirements to structure mapping complete (all FR groups)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
1. Clean separation via KMP `expect`/`actual` — platform concerns isolated
2. Desktop compatibility ensured — same DB schema, same tmux conventions
3. Offline-first design — cached data readable without connection
4. Battle-tested SSH/mosh infrastructure — not inventing protocols
5. Comprehensive patterns prevent AI agent conflicts across 3 codebases

**Areas for Future Enhancement:**
1. Automated desktop-mobile schema sync (currently manual)
2. SwiftNIO SSH client layer may benefit from a wrapper library if one emerges
3. Tablet/foldable layouts can be added incrementally via Material 3 Adaptive
4. Background sync (currently only syncs on reconnect — could add periodic polling)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Reference `mobile-ui-design-recommendations.md` for UI-specific guidance

**First Implementation Priority:**
1. Generate KMP project via JetBrains Wizard (https://kmp.jetbrains.com/) with Android + iOS targets, shared UI disabled
2. Set up Gradle version catalog with all library versions
3. Implement `RemoteExecutor` expect/actual with Apache MINA SSHD (Android) as first platform
4. Build Connection Manager UI (Android first) — this is the entry point for all user flows

